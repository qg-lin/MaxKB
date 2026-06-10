SELECT
	paragraph_id,
	comprehensive_score,
	comprehensive_score AS similarity
FROM
	(
	SELECT DISTINCT ON
		( "paragraph_id" ) ( 1 - distance + GREATEST(strict_ts_similarity, relaxed_ts_similarity) ) as similarity, *,
		(1 - distance + GREATEST(strict_ts_similarity, relaxed_ts_similarity)) AS comprehensive_score
	FROM
		(
		SELECT
			*,
			(embedding.embedding::vector(%s) <=>  %s) as distance,
			(ts_rank_cd( embedding.search_vector, websearch_to_tsquery('simple', %s ), 32 )) AS strict_ts_similarity,
			(ts_rank_cd( embedding.search_vector, to_tsquery('simple', %s ), 32 )) AS relaxed_ts_similarity
		FROM
			embedding ${embedding_query}
		    ORDER BY distance
		) TEMP
	ORDER BY
		paragraph_id,
		similarity DESC
	) DISTINCT_TEMP
WHERE
	comprehensive_score >%s
ORDER BY
	comprehensive_score DESC
	LIMIT %s
