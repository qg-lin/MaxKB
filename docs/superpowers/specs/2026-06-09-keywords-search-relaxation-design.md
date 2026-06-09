# Keywords Search Relaxation Design

## Background

MaxKB currently supports three knowledge retrieval modes:

- `embedding`: vector similarity search.
- `keywords`: PostgreSQL full-text search.
- `blend`: vector score plus full-text score.

The current `keywords` mode sends the whole segmented user question into:

```sql
websearch_to_tsquery('simple', %s)
```

For a business-style query such as:

```text
客户名称：苏州海管家，主要目的港为厦门、泉州
```

jieba produces a query similar to:

```text
客户 户名 名称 苏州 海 管家 主要 目的 目的港 厦门 泉州
```

The full-text query becomes too strict for single-entity paragraphs. A paragraph for `厦门` does not contain `泉州`, `客户`, or `苏州海管家`, so `keywords` returns zero hits even though useful paragraphs exist.

This design optimizes only keyword retrieval. It does not change embedding search, reranker behavior, document splitting, or LLM-based question rewriting.

## Goals

- Improve `keywords` recall for mixed business sentences and multi-entity queries.
- Keep the public `vector.query(...)` interface unchanged.
- Avoid business-specific stopword lists that might break other knowledge bases.
- Preserve current strict full-text behavior as one scoring signal.
- Make the first version small enough to test with the existing `国际港口信息` use case.

## Non-Goals

- No HanLP or tokenizer replacement.
- No LLM query rewriting.
- No multi-route recall orchestration across embedding/keywords/exact channels.
- No guarantee that each extracted entity returns at least N paragraphs.
- No document splitting changes in this first step.

## Proposed Approach

Add a relaxed token query alongside the existing strict query.

The `keywords` mode will compute two full-text scores:

1. `strict_score`: existing whole-query score.
2. `relaxed_score`: OR query score built from filtered tokens.

The final keyword score is:

```text
comprehensive_score = greatest(strict_score, relaxed_score)
```

This keeps the current behavior when the strict query works, while allowing token-level matches to recall results when the full business sentence is too restrictive.

## Query Processing

### Existing Strict Query

Continue using the current `to_query(text)` output for strict search.

Example:

```text
客户 户名 名称 苏州 海 管家 主要 目的 目的港 厦门 泉州
```

### New Relaxed Token Query

Add a new utility function named `to_or_query(text)`.

It will:

- Run jieba segmentation using the same tokenizer already used by `to_query`.
- Remove empty tokens and punctuation-only tokens.
- Remove duplicate tokens while preserving order.
- Drop single-character CJK tokens by default.
- Keep English, numeric, and mixed code-like tokens.
- Limit the token count to 12.
- Escape tokens for PostgreSQL `to_tsquery`.
- Join terms with `|`.

Example:

```text
厦门 | 泉州 | 苏州 | 管家 | 目的港
```

No broad business stopword list is introduced. The only filtering is generic and low-risk.

## SQL Design

Current `keywords_search.sql` computes one score:

```sql
ts_rank_cd(
  embedding.search_vector,
  websearch_to_tsquery('simple', %s),
  32
) AS similarity
```

The new SQL computes strict and relaxed scores:

```sql
ts_rank_cd(
  embedding.search_vector,
  websearch_to_tsquery('simple', %s),
  32
) AS strict_score,
ts_rank_cd(
  embedding.search_vector,
  to_tsquery('simple', %s),
  32
) AS relaxed_score
```

Then:

```sql
GREATEST(strict_score, relaxed_score) AS comprehensive_score
```

If the relaxed token query is empty, pass a safe no-match query or branch to reuse strict-only behavior. The implementation should avoid SQL errors from empty `to_tsquery`.

## Blend Mode

`blend` currently uses one full-text score inside `blend_search.sql`.

The first implementation will apply the same relaxed keyword score to both `keywords` and `blend`, because the failing test showed `blend` degraded to embedding when the keyword score was zero.

The blend comprehensive score should become:

```text
1 - vector_distance + greatest(strict_keyword_score, relaxed_keyword_score)
```

## Scoring and Ranking

This first version uses `greatest(strict_score, relaxed_score)` rather than summing token scores.

Reasons:

- Smaller SQL change.
- Avoids over-rewarding long queries with many tokens.
- Reduces noise from generic tokens.
- Preserves current score scale more closely than additive scoring.

Future iterations can consider per-token scoring and token hit counts.

## Compatibility

The public API remains unchanged:

```python
vector.query(query_text, query_embedding, knowledge_id_list, ..., search_mode)
```

Internal changes:

- `KeywordsSearch.handle(...)` passes two query parameters: strict query and relaxed OR query.
- `BlendSearch.handle(...)` also passes strict and relaxed keyword query parameters.
- `to_query(...)` remains unchanged for backward compatibility.
- `to_or_query(...)` is additive.

## Error Handling

- If token extraction produces no usable terms, relaxed search is disabled for that query.
- If `to_tsquery` would receive an invalid term, skip that token.
- If all relaxed tokens are skipped, fall back to strict-only scoring.
- The implementation should not raise errors for punctuation-only or very short queries.

## Test Plan

Use local knowledge base `国际港口信息`.

### Case 1: Full business sentence

Input:

```text
客户名称：苏州海管家，主要目的港为厦门、泉州
```

Expected:

- `keywords` returns non-zero hits.
- Results include paragraphs containing `厦门`.
- Results include paragraphs containing `泉州`.

### Case 2: Multi-token entity query

Input:

```text
厦门 泉州
```

Expected:

- `keywords` returns both厦门 and泉州 related paragraphs.

### Case 3: Single entity query

Inputs:

```text
厦门
泉州
```

Expected:

- Results remain at least as good as before.

### Case 4: Code and English query

Inputs:

```text
CNXAM
XIAMEN
```

Expected:

- Results include the corresponding港口 paragraph.

### Case 5: Noise query

Input:

```text
，。！？ ：
```

Expected:

- No SQL error.
- Empty or low-confidence result set.

## Risks

- OR queries may increase recall but also introduce noisy results.
- Generic two-character tokens can still match unrelated paragraphs.
- Relaxed score may pull weak keyword matches above stronger semantic matches in `blend`.
- `to_tsquery` syntax requires careful escaping.

Mitigations:

- Limit relaxed token count.
- Drop single-character CJK tokens.
- Use `greatest` instead of additive token scoring.
- Keep strict score available.
- Test both `keywords` and `blend` before enabling broadly.

## Final Decisions

- The relaxed token utility is named `to_or_query(text)`.
- The relaxed token count limit is 12.
- The first implementation updates both `keywords_search.sql` and `blend_search.sql`.
- The first implementation does not expose a user-facing setting. Relaxed keyword search is internal and covered by tests.
