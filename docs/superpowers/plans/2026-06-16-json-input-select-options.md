# JSON 展示规则候选值实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 当 JSON 展示规则字段类型为单选或多选时，支持配置候选值并在用户端以下拉框渲染。

**Architecture:** 在 `JsonDisplayField` 上增加 `option_list`，结构沿用现有表单选项 `{ label, value }`。配置端复用 `OptionListEditor.vue` 和 `parseCsv(file)`，用户端 `StructuredJsonInput.vue` 使用 `el-select-v2` 渲染单选/多选。

**Tech Stack:** Vue 3、TypeScript、Element Plus、现有 `OptionListEditor.vue`、现有 `parseCsv(file)`、`jsonDisplay.assert.ts`。

---

### Task 1: Add Option List Type Support

**Files:**
- Modify: `ui/src/components/dynamics-form/items/json-display/types.ts`
- Modify: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`

- [x] **Step 1: Write failing assertions**

Add assertions that a valid `option_list` is accepted and an invalid one is rejected:

```ts
const selectConfig = {
  mode: 'structured',
  rootType: 'object',
  fields: [
    {
      path: 'status',
      key: 'status',
      label: '状态',
      valueType: 'single_select',
      visible: true,
      editable: true,
      option_list: [{ label: '已成交', value: 'won' }],
    },
  ],
}

assert.equal(isStructuredJsonDisplayConfig(selectConfig), true)

assert.equal(
  isStructuredJsonDisplayConfig({
    ...selectConfig,
    fields: [{ ...selectConfig.fields[0], option_list: [{ label: '缺少值' }] }],
  }),
  false,
)
```

- [x] **Step 2: Run assertions and verify RED**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: FAIL because the current type guard rejects or ignores invalid `option_list`.

- [x] **Step 3: Implement `option_list` type support**

Add:

```ts
export interface JsonDisplayOption {
  label: string
  value: string
}
```

Add `option_list?: JsonDisplayOption[]` to `JsonDisplayField`.

Update `isJsonDisplayField` to validate optional `option_list`.

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/types.ts ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts docs/superpowers/specs/2026-06-16-json-input-structured-display-design.md docs/superpowers/plans/2026-06-16-json-input-select-options.md
git commit -m "feat(json-input): add structured select options type"
```

---

### Task 2: Add Candidate Editor to Rule Config

**Files:**
- Modify: `ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue`

- [x] **Step 1: Add option action column**

Add an operation column that only enables candidate configuration for `single_select` and `multi_select`.

- [x] **Step 2: Reuse `OptionListEditor.vue` and `parseCsv(file)`**

Add a dialog containing `OptionListEditor`, Add, Import CSV, and Delete behavior. Use `parseCsv(file)` and de-duplicate by `value`.

- [x] **Step 3: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue docs/superpowers/plans/2026-06-16-json-input-select-options.md
git commit -m "feat(json-input): configure select options in display rules"
```

---

### Task 3: Render Select Controls in Structured JSON Input

**Files:**
- Modify: `ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue`

- [x] **Step 1: Render root scalar single/multi select**

For `single_select`, render `el-select-v2`.

For `multi_select`, render `el-select-v2 multiple`.

- [x] **Step 2: Render table cell single/multi select**

Apply the same behavior for object-array child fields.

- [x] **Step 3: Preserve JSON shape on update**

Keep `single_select` as a single value and `multi_select` as an array.

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue docs/superpowers/plans/2026-06-16-json-input-select-options.md
git commit -m "feat(json-input): render structured select options"
```
