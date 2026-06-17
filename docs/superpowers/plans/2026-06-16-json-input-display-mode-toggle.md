# JSON 输入框展示模式切换实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 允许 JSON 输入字段显式配置用户端使用原 CodeMirror 或结构化展示规则。

**Architecture:** 增加字段级 `json_display_mode`，并提供一个纯函数判断是否启用结构化渲染。配置端保存展示模式；用户端只在展示模式为 `structured` 且规则合法时使用 `StructuredJsonInput`。

**Tech Stack:** Vue 3、TypeScript、Element Plus、现有 `jsonDisplay.assert.ts` 断言脚本。

---

## File Structure

- Modify: `ui/src/components/dynamics-form/items/json-display/types.ts`
  - 定义 `JsonDisplayMode`
  - 增加 `resolveJsonDisplayMode`
  - 增加 `shouldUseStructuredJsonDisplay`
- Modify: `ui/src/components/dynamics-form/type.ts`
  - 在 `FormField` 上声明 `json_display_mode?: JsonDisplayMode`
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`
  - 增加展示方式单选
  - 保存和回显 `json_display_mode`
  - 生成展示规则后自动切到 `structured`
- Modify: `ui/src/components/dynamics-form/items/JsonInput.vue`
  - 使用 `shouldUseStructuredJsonDisplay` 判断结构化模式
- Modify: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`
  - 增加展示模式兼容断言

---

### Task 1: Display Mode Types and Tests

**Files:**
- Modify: `ui/src/components/dynamics-form/items/json-display/types.ts`
- Modify: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`

- [x] **Step 1: Write the failing assertions**

Add assertions to `jsonDisplay.assert.ts`:

```ts
import {
  resolveJsonDisplayMode,
  shouldUseStructuredJsonDisplay,
} from './types.ts'

const displayConfig = inferJsonDisplayConfig([{ name: '张三' }])

assert.equal(resolveJsonDisplayMode(undefined, undefined), 'codemirror')
assert.equal(resolveJsonDisplayMode(undefined, displayConfig), 'structured')
assert.equal(resolveJsonDisplayMode('codemirror', displayConfig), 'codemirror')
assert.equal(resolveJsonDisplayMode('structured', displayConfig), 'structured')
assert.equal(shouldUseStructuredJsonDisplay({ json_display_mode: 'codemirror', json_display_config: displayConfig }), false)
assert.equal(shouldUseStructuredJsonDisplay({ json_display_mode: 'structured', json_display_config: displayConfig }), true)
assert.equal(shouldUseStructuredJsonDisplay({ json_display_config: displayConfig }), true)
assert.equal(shouldUseStructuredJsonDisplay({}), false)
```

- [x] **Step 2: Run assertions and verify RED**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: FAIL because `resolveJsonDisplayMode` is not exported.

- [x] **Step 3: Implement display mode helpers**

In `types.ts`, add:

```ts
export type JsonDisplayMode = 'codemirror' | 'structured'

export const resolveJsonDisplayMode = (
  mode: unknown,
  config: unknown,
): JsonDisplayMode => {
  if (mode === 'codemirror' || mode === 'structured') {
    return mode
  }

  return isStructuredJsonDisplayConfig(config) ? 'structured' : 'codemirror'
}

export const shouldUseStructuredJsonDisplay = (field: {
  json_display_mode?: unknown
  json_display_config?: unknown
}) =>
  resolveJsonDisplayMode(field.json_display_mode, field.json_display_config) === 'structured' &&
  isStructuredJsonDisplayConfig(field.json_display_config)
```

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/types.ts ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
git commit -m "feat(json-input): add display mode helpers"
```

---

### Task 2: Constructor and Runtime Integration

**Files:**
- Modify: `ui/src/components/dynamics-form/type.ts`
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`
- Modify: `ui/src/components/dynamics-form/items/JsonInput.vue`

- [x] **Step 1: Add FormField type**

In `type.ts`, import `JsonDisplayMode` and add:

```ts
json_display_mode?: JsonDisplayMode
```

- [x] **Step 2: Add constructor display mode UI**

In `JsonInputConstructor.vue`, add a `JSON 展示方式` form item with radio values:

```vue
<el-radio-group v-model="formValue.json_display_mode">
  <el-radio value="codemirror">CodeMirror</el-radio>
  <el-radio value="structured">展示规则</el-radio>
</el-radio-group>
```

- [x] **Step 3: Save, restore, and generate mode**

In `getData`, return `json_display_mode: resolveJsonDisplayMode(...)`.

In `rander`, restore `formValue.value.json_display_mode = resolveJsonDisplayMode(...)`.

In `confirmGenerateJsonDisplayConfig`, after assigning `json_display_config`, set:

```ts
formValue.value.json_display_mode = 'structured'
```

In `onMounted`, initialize:

```ts
formValue.value.json_display_mode = resolveJsonDisplayMode(
  formValue.value.json_display_mode,
  formValue.value.json_display_config,
)
```

- [x] **Step 4: Gate runtime structured rendering by mode**

In `JsonInput.vue`, use `shouldUseStructuredJsonDisplay(props.formField || {})` before returning the config.

- [x] **Step 5: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ui/src/components/dynamics-form/type.ts ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue ui/src/components/dynamics-form/items/JsonInput.vue docs/superpowers/plans/2026-06-16-json-input-display-mode-toggle.md
git commit -m "feat(json-input): allow codemirror display mode"
```

---

### Task 3: Polish Constructor Display Rule Actions

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`

- [x] **Step 1: Hide display rule actions in CodeMirror mode**

In `JsonInputConstructor.vue`, add `v-if="formValue.json_display_mode === 'structured'"` to the `JSON 展示规则` form item.

- [x] **Step 2: Unify action button style**

Use one compact action row and make both action buttons normal Element Plus buttons:

```vue
<div class="jsonDisplayConfigActions">
  <el-button @click="openJsonDisplaySampleDialog">生成展示规则</el-button>
  <el-button
    v-if="structuredJsonDisplayConfig"
    @click="jsonDisplayConfigVisible = true"
  >
    编辑展示规则
  </el-button>
</div>
```

- [x] **Step 3: Add scoped action row style**

Add:

```scss
.jsonDisplayConfigActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
```

- [x] **Step 4: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue docs/superpowers/plans/2026-06-16-json-input-display-mode-toggle.md
git commit -m "fix(json-input): polish display rule actions"
```
