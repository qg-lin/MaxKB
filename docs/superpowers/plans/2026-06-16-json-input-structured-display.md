# JSON Input Structured Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a structured display mode for JSON form fields so designers configure key/path display rules and end users see business-friendly forms, tables, and groups instead of raw JSON.

**Architecture:** Keep `JsonInput.vue` as the compatibility entry point. Add focused pure TypeScript modules for display config types, JSON path read/write, and rule inference; add one config editor for design mode and one structured renderer for user mode. Existing fields without `json_display_config.mode === 'structured'` keep the current CodeMirror behavior.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Element Plus, existing `vue-codemirror`, existing `vue-tsc` type-checking, Node 22 `--experimental-strip-types` for local pure-function assertions.

---

## File Structure

- Create: `ui/src/components/dynamics-form/items/json-display/types.ts`
  - Owns `JsonDisplayConfig`, `JsonDisplayField`, `JsonDisplayValueType`, and root type definitions.
- Create: `ui/src/components/dynamics-form/items/json-display/jsonPathValue.ts`
  - Owns JSON path parsing, value reading, value writing, and type conversion helpers.
- Create: `ui/src/components/dynamics-form/items/json-display/jsonDisplayInfer.ts`
  - Owns sample JSON to `json_display_config` inference.
- Create: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`
  - Dev-only assertion runner for pure utility behavior. Do not import it from app code.
- Create: `ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue`
  - Design-mode rule editor used by `JsonInputConstructor.vue`.
- Create: `ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue`
  - User-mode renderer used by `JsonInput.vue` when structured config exists.
- Modify: `ui/src/components/dynamics-form/type.ts`
  - Add optional `json_display_config` to `FormField`.
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`
  - Add rule generation/editing UI and save/rander `json_display_config`.
- Modify: `ui/src/components/dynamics-form/items/JsonInput.vue`
  - Switch between existing CodeMirror and `StructuredJsonInput`.

## Verification Commands

Run from `ui/` unless otherwise noted:

```bash
node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
npm run type-check
```

Expected final result:

- Assertion runner prints `json-display assertions passed`.
- `npm run type-check` exits with code 0.

---

### Task 1: Add JSON Display Types

**Files:**
- Create: `ui/src/components/dynamics-form/items/json-display/types.ts`
- Modify: `ui/src/components/dynamics-form/type.ts`

- [x] **Step 1: Write the type definitions**

Create `ui/src/components/dynamics-form/items/json-display/types.ts`:

```ts
export type JsonDisplayRootType = 'object' | 'array' | 'value'

export type JsonDisplayValueType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'single_select'
  | 'multi_select'
  | 'object'
  | 'array_object'
  | 'array_value'
  | 'unknown'

export interface JsonDisplayField {
  path: string
  key: string
  label: string
  valueType: JsonDisplayValueType
  visible: boolean
  editable: boolean
  children?: JsonDisplayField[]
}

export interface JsonDisplayConfig {
  mode: 'structured'
  rootType: JsonDisplayRootType
  fields: JsonDisplayField[]
}

export const jsonDisplayValueTypeOptions: Array<{ label: string; value: JsonDisplayValueType }> = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
  { label: '单选', value: 'single_select' },
  { label: '多选', value: 'multi_select' },
  { label: '对象', value: 'object' },
  { label: '对象数组', value: 'array_object' },
  { label: '基础值数组', value: 'array_value' },
  { label: '待配置', value: 'unknown' },
]

export const isStructuredJsonDisplayConfig = (value: unknown): value is JsonDisplayConfig => {
  const config = value as JsonDisplayConfig
  return config?.mode === 'structured' && Array.isArray(config.fields)
}
```

- [x] **Step 2: Add the optional field type**

Modify `ui/src/components/dynamics-form/type.ts`:

```ts
import type { JsonDisplayConfig } from '@/components/dynamics-form/items/json-display/types'
```

Add this property inside `interface FormField` near `default_value`:

```ts
  /**
   * JSON 输入框结构化展示配置。不存在时保持原 CodeMirror JSON 编辑器行为。
   */
  json_display_config?: JsonDisplayConfig
```

- [x] **Step 3: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS. There should be no missing import or type errors.

- [x] **Step 4: Commit**

```bash
git add ui/src/components/dynamics-form/type.ts ui/src/components/dynamics-form/items/json-display/types.ts
git commit -m "feat(json-input): add structured display config types"
```

---

### Task 2: Add JSON Path Read/Write Utilities

**Files:**
- Create: `ui/src/components/dynamics-form/items/json-display/jsonPathValue.ts`
- Create: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`

- [x] **Step 1: Write failing assertions**

Create `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`:

```ts
import assert from 'node:assert/strict'
import {
  cloneWithJsonPathValue,
  getJsonPathValue,
  normalizeJsonValueByType,
} from './jsonPathValue.ts'

const source = {
  customer: { name: '旧客户' },
  items: [
    { name: '耳机', qty: 1 },
    { name: '电源', qty: 2 },
  ],
  untouched: 'keep',
}

assert.equal(getJsonPathValue(source, 'customer.name'), '旧客户')
assert.deepEqual(getJsonPathValue(source, 'items[].name'), ['耳机', '电源'])

const updatedName = cloneWithJsonPathValue(source, 'customer.name', '新客户')
assert.equal(updatedName.customer.name, '新客户')
assert.equal(source.customer.name, '旧客户')
assert.equal(updatedName.untouched, 'keep')

const updatedColumn = cloneWithJsonPathValue(source, 'items[].qty', [3, 4])
assert.deepEqual(
  updatedColumn.items.map((item: any) => item.qty),
  [3, 4],
)

assert.equal(normalizeJsonValueByType('42', 'number'), 42)
assert.equal(normalizeJsonValueByType('true', 'boolean'), true)
assert.deepEqual(normalizeJsonValueByType('a,b', 'multi_select'), ['a', 'b'])

console.log('json-display assertions passed')
```

- [x] **Step 2: Run assertions and verify failure**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: FAIL with a module-not-found error for `./jsonPathValue.ts`.

- [x] **Step 3: Implement the path utilities**

Create `ui/src/components/dynamics-form/items/json-display/jsonPathValue.ts`:

```ts
import type { JsonDisplayValueType } from './types'

type PathToken = {
  key: string
  array: boolean
}

const parsePath = (path: string): PathToken[] =>
  path
    .split('.')
    .filter(Boolean)
    .map((segment) => ({
      key: segment.replace(/\[\]$/, ''),
      array: segment.endsWith('[]'),
    }))

const cloneJson = <T>(value: T): T => {
  if (value === undefined || value === null) return value
  return JSON.parse(JSON.stringify(value))
}

export const getJsonPathValue = (source: any, path: string): any => {
  const tokens = parsePath(path)

  const read = (value: any, index: number): any => {
    if (index >= tokens.length) return value
    const token = tokens[index]
    const next = value?.[token.key]

    if (token.array) {
      if (!Array.isArray(next)) return []
      return next.map((item) => read(item, index + 1))
    }

    return read(next, index + 1)
  }

  return read(source, 0)
}

export const cloneWithJsonPathValue = (source: any, path: string, nextValue: any): any => {
  const root = cloneJson(source) ?? {}
  const tokens = parsePath(path)

  const write = (target: any, index: number, value: any): any => {
    const token = tokens[index]
    if (!token) return value

    if (token.array) {
      const currentArray = Array.isArray(target[token.key]) ? target[token.key] : []
      const values = Array.isArray(value) ? value : [value]
      target[token.key] = values.map((itemValue, itemIndex) => {
        const itemTarget = currentArray[itemIndex] ?? {}
        return write(itemTarget, index + 1, itemValue)
      })
      return target
    }

    if (index === tokens.length - 1) {
      target[token.key] = value
      return target
    }

    target[token.key] = target[token.key] ?? {}
    target[token.key] = write(target[token.key], index + 1, value)
    return target
  }

  return write(root, 0, nextValue)
}

export const normalizeJsonValueByType = (value: any, valueType: JsonDisplayValueType): any => {
  if (value === '' || value === undefined || value === null) return value

  if (valueType === 'number') {
    const result = Number(value)
    if (Number.isNaN(result)) throw new Error('Invalid number')
    return result
  }

  if (valueType === 'boolean') {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error('Invalid boolean')
  }

  if (valueType === 'multi_select') {
    if (Array.isArray(value)) return value
    return String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return value
}
```

- [x] **Step 4: Run assertions and verify pass**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: PASS with `json-display assertions passed`.

- [x] **Step 5: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/jsonPathValue.ts ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
git commit -m "feat(json-input): add json path value helpers"
```

---

### Task 3: Add JSON Display Rule Inference

**Files:**
- Create: `ui/src/components/dynamics-form/items/json-display/jsonDisplayInfer.ts`
- Modify: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`

- [x] **Step 1: Add failing inference assertions**

Add this import near the top of `jsonDisplay.assert.ts`, below the existing imports:

```ts
import { inferJsonDisplayConfig } from './jsonDisplayInfer.ts'
```

Append these assertions before the final `console.log`:

```ts
const inferred = inferJsonDisplayConfig({
  customer: { name: '上海客户', active: true },
  items: [
    { name: '耳机', qty: 1, tags: ['电子', '热销'] },
    { name: '电源', qty: 2 },
  ],
  created_at: '2026-06-16',
})

assert.equal(inferred.mode, 'structured')
assert.equal(inferred.rootType, 'object')
assert.equal(inferred.fields.find((field) => field.path === 'created_at')?.valueType, 'date')
assert.equal(inferred.fields.find((field) => field.path === 'customer')?.valueType, 'object')
assert.equal(inferred.fields.find((field) => field.path === 'items[]')?.valueType, 'array_object')
assert.equal(
  inferred.fields
    .find((field) => field.path === 'items[]')
    ?.children?.find((field) => field.path === 'items[].qty')?.valueType,
  'number',
)
```

- [x] **Step 2: Run assertions and verify failure**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: FAIL with a module-not-found error for `./jsonDisplayInfer.ts`.

- [x] **Step 3: Implement inference**

Create `ui/src/components/dynamics-form/items/json-display/jsonDisplayInfer.ts`:

```ts
import type {
  JsonDisplayConfig,
  JsonDisplayField,
  JsonDisplayRootType,
  JsonDisplayValueType,
} from './types'

const isPlainObject = (value: any): value is Record<string, any> =>
  Object.prototype.toString.call(value) === '[object Object]'

const isDateLike = (value: string): boolean => /^\d{4}-\d{2}-\d{2}($|[ T])/.test(value)

const inferValueType = (value: any): JsonDisplayValueType => {
  if (Array.isArray(value)) {
    if (value.some(isPlainObject)) return 'array_object'
    return 'array_value'
  }
  if (isPlainObject(value)) return 'object'
  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'string') return isDateLike(value) ? 'date' : 'text'
  return 'unknown'
}

const inferRootType = (value: any): JsonDisplayRootType => {
  if (Array.isArray(value)) return 'array'
  if (isPlainObject(value)) return 'object'
  return 'value'
}

const unionObjectKeys = (items: any[]): string[] => {
  const keys = new Set<string>()
  items.forEach((item) => {
    if (isPlainObject(item)) {
      Object.keys(item).forEach((key) => keys.add(key))
    }
  })
  return Array.from(keys)
}

const inferFields = (value: any, basePath = ''): JsonDisplayField[] => {
  if (isPlainObject(value)) {
    return Object.keys(value).map((key) => {
      const childValue = value[key]
      const path = basePath ? `${basePath}.${key}` : key
      const valueType = inferValueType(childValue)
      const field: JsonDisplayField = {
        path: valueType === 'array_object' || valueType === 'array_value' ? `${path}[]` : path,
        key,
        label: key,
        valueType,
        visible: true,
        editable: true,
      }

      if (valueType === 'object') {
        field.children = inferFields(childValue, path)
      }

      if (valueType === 'array_object') {
        const keys = unionObjectKeys(childValue)
        field.children = keys.map((arrayKey) => {
          const sample = childValue.find((item: any) => item?.[arrayKey] !== undefined)?.[arrayKey]
          const childPath = `${path}[].${arrayKey}`
          const childType = inferValueType(sample)
          return {
            path: childType === 'array_object' || childType === 'array_value' ? `${childPath}[]` : childPath,
            key: arrayKey,
            label: arrayKey,
            valueType: childType,
            visible: true,
            editable: true,
            children: childType === 'object' ? inferFields(sample, childPath) : undefined,
          }
        })
      }

      return field
    })
  }

  if (Array.isArray(value)) {
    if (value.some(isPlainObject)) {
      return [
        {
          path: basePath ? `${basePath}[]` : '[]',
          key: basePath || 'items',
          label: basePath || '列表',
          valueType: 'array_object',
          visible: true,
          editable: true,
          children: unionObjectKeys(value).map((key) => {
            const sample = value.find((item: any) => item?.[key] !== undefined)?.[key]
            return {
              path: basePath ? `${basePath}[].${key}` : `[].${key}`,
              key,
              label: key,
              valueType: inferValueType(sample),
              visible: true,
              editable: true,
            }
          }),
        },
      ]
    }

    return [
      {
        path: basePath ? `${basePath}[]` : '[]',
        key: 'value',
        label: '值',
        valueType: 'array_value',
        visible: true,
        editable: true,
      },
    ]
  }

  return [
    {
      path: basePath || 'value',
      key: basePath || 'value',
      label: basePath || '值',
      valueType: inferValueType(value),
      visible: true,
      editable: true,
    },
  ]
}

export const inferJsonDisplayConfig = (value: any): JsonDisplayConfig => ({
  mode: 'structured',
  rootType: inferRootType(value),
  fields: inferFields(value),
})
```

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: both PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/jsonDisplayInfer.ts ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
git commit -m "feat(json-input): infer structured display rules"
```

---

### Task 4: Build the Config Editor

**Files:**
- Create: `ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue`

- [x] **Step 1: Create the editor component**

Create `ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue`:

```vue
<template>
  <div class="json-display-config-editor">
    <el-table :data="fields" border size="small" row-key="path">
      <el-table-column prop="path" label="JSON 路径" min-width="180" />
      <el-table-column label="展示名称" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.label" />
        </template>
      </el-table-column>
      <el-table-column label="值类型" width="150">
        <template #default="{ row }">
          <el-select v-model="row.valueType">
            <el-option
              v-for="item in jsonDisplayValueTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="显示" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.visible" />
        </template>
      </el-table-column>
      <el-table-column label="可编辑" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.editable" />
        </template>
      </el-table-column>
    </el-table>

    <template v-for="field in fields" :key="`${field.path}-children`">
      <el-collapse v-if="field.children?.length" class="mt-12">
        <el-collapse-item :title="`${field.label || field.key} 子配置`" :name="field.path">
          <JsonDisplayConfigEditor v-model:fields="field.children" />
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JsonDisplayField } from './types'
import { jsonDisplayValueTypeOptions } from './types'

const props = defineProps<{
  fields: JsonDisplayField[]
}>()

const emit = defineEmits<{
  'update:fields': [value: JsonDisplayField[]]
}>()

const fields = computed({
  get: () => props.fields,
  set: (value) => emit('update:fields', value),
})
</script>

<style lang="scss" scoped>
.json-display-config-editor {
  width: 100%;
}
</style>
```

- [x] **Step 2: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue
git commit -m "feat(json-input): add display config editor"
```

---

### Task 5: Wire Config Editor into JsonInputConstructor

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`

- [x] **Step 1: Add the configuration UI available for every assignment method**

In `JsonInputConstructor.vue`, add this block in an independent `el-form-item` after the assignment-method-specific controls so both custom default values and referenced variables can configure display rules:

```vue
    <div class="jsonDisplayConfigActions">
      <el-button @click="openJsonDisplaySampleDialog">
        生成展示规则
      </el-button>
      <el-button
        v-if="structuredJsonDisplayConfig"
        text
        type="primary"
        @click="jsonDisplayConfigVisible = true"
      >
        编辑展示规则
      </el-button>
    </div>
```

Add this dialog near the end of the template:

```vue
  <el-dialog
    v-model="jsonDisplayConfigVisible"
    title="JSON 展示规则"
    width="900px"
    append-to-body
  >
    <JsonDisplayConfigEditor
      v-if="formValue.json_display_config"
      v-model:fields="formValue.json_display_config.fields"
    />
    <template #footer>
      <el-button type="primary" @click="jsonDisplayConfigVisible = false">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
```

- [x] **Step 2: Add imports and state**

In the script section, add:

```ts
import JsonDisplayConfigEditor from '@/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue'
import { inferJsonDisplayConfig } from '@/components/dynamics-form/items/json-display/jsonDisplayInfer'
import { MsgError } from '@/utils/message'
```

Add state:

```ts
const jsonDisplayConfigVisible = ref<boolean>(false)
const jsonDisplaySampleVisible = ref<boolean>(false)
const jsonDisplaySampleValue = ref<any>({})
const jsonDisplaySampleRef = ref<InstanceType<typeof JsonInput>>()
```

Add the generator:

```ts
const openJsonDisplaySampleDialog = () => {
  jsonDisplaySampleValue.value = {}
  jsonDisplaySampleVisible.value = true
}

const confirmGenerateJsonDisplayConfig = () => {
  try {
    const sampleValue = jsonDisplaySampleRef.value?.getParsedValue()
    formValue.value.json_display_config = inferJsonDisplayConfig(sampleValue)
    jsonDisplaySampleVisible.value = false
    jsonDisplayConfigVisible.value = true
  } catch (e) {
    MsgError(t('dynamicsForm.tip.jsonMessage'))
  }
}
```

- [x] **Step 3: Save and render `json_display_config`**

In `getData()`, add:

```ts
    json_display_config: formValue.value.json_display_config,
```

In `rander(form_data)`, add:

```ts
  formValue.value.json_display_config = form_data.json_display_config
```

In `onMounted`, initialize only when absent:

```ts
  if (formValue.value.json_display_config === undefined) {
    formValue.value.json_display_config = undefined
  }
```

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: both PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue
git commit -m "feat(json-input): configure structured display rules"
```

---

### Task 5B: Use Sample JSON for Rule Generation in All Assignment Modes

**Scope note:** Task 5B only delivers the configuration-side flow: every assignment method can generate and edit `json_display_config` from a pasted sample JSON. User-side structured rendering from those rules is still handled by the later Task 6 and Task 7.

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue`
- Modify: `ui/src/components/dynamics-form/items/JsonInput.vue`
- Modify: `docs/superpowers/specs/2026-06-16-json-input-structured-display-design.md`

- [x] **Step 1: Move display-rule actions outside custom default-value mode**

In `JsonInputConstructor.vue`, display “生成展示规则 / 编辑展示规则” for both `custom` and `ref_variables` assignment methods. The actions must no longer live inside the `default_value_assignment_method == 'custom'` default value form item.

Keep the existing default JSON editor only for custom default values. The new rule-generation UI belongs in its own form item after the assignment-method-specific controls.

- [x] **Step 2: Add a sample JSON dialog**

Add a second dialog dedicated to sample JSON extraction:

```vue
<el-dialog
  v-model="jsonDisplaySampleVisible"
  title="示例 JSON"
  width="900px"
  append-to-body
>
  <JsonInput ref="jsonDisplaySampleRef" v-model="jsonDisplaySampleValue" />
  <template #footer>
    <el-button @click="jsonDisplaySampleVisible = false">
      {{ $t('common.cancel') }}
    </el-button>
    <el-button type="primary" @click="confirmGenerateJsonDisplayConfig">
      {{ $t('common.confirm') }}
    </el-button>
  </template>
</el-dialog>
```

Required state:

```ts
const jsonDisplaySampleVisible = ref<boolean>(false)
const jsonDisplaySampleValue = ref<any>({})
const jsonDisplaySampleRef = ref<InstanceType<typeof JsonInput>>()
```

- [x] **Step 3: Generate rules from the sample JSON only**

Replace direct generation from `default_value` with this flow:

```ts
const openJsonDisplaySampleDialog = () => {
  jsonDisplaySampleValue.value = {}
  jsonDisplaySampleVisible.value = true
}

const confirmGenerateJsonDisplayConfig = () => {
  try {
    const sampleValue = jsonDisplaySampleRef.value?.getParsedValue()
    formValue.value.json_display_config = inferJsonDisplayConfig(sampleValue)
    jsonDisplaySampleVisible.value = false
    jsonDisplayConfigVisible.value = true
  } catch (e) {
    MsgError(t('dynamicsForm.tip.jsonMessage'))
  }
}
```

“生成展示规则”按钮 must call `openJsonDisplaySampleDialog`, not infer from `default_value`.

- [x] **Step 4: Keep config validation defensive**

Use `isStructuredJsonDisplayConfig` in `JsonInputConstructor.vue` so invalid persisted configs are not passed to `JsonDisplayConfigEditor`.

When rendering existing field data:

```ts
formValue.value.json_display_config = isStructuredJsonDisplayConfig(form_data.json_display_config)
  ? form_data.json_display_config
  : undefined
```

When saving:

```ts
json_display_config: isStructuredJsonDisplayConfig(formValue.value.json_display_config)
  ? formValue.value.json_display_config
  : undefined,
```

- [x] **Step 5: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: both PASS.

- [x] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-06-16-json-input-structured-display-design.md docs/superpowers/plans/2026-06-16-json-input-structured-display.md ui/src/components/dynamics-form/constructor/items/JsonInputConstructor.vue ui/src/components/dynamics-form/items/JsonInput.vue
git commit -m "feat(json-input): generate display rules from sample json"
```

---

### Task 6: Build Structured User Renderer

**Files:**
- Create: `ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue`
- Modify: `ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts`

- [x] **Step 1: Add a type conversion assertion**

Append before the final `console.log` in `jsonDisplay.assert.ts`:

```ts
assert.throws(() => normalizeJsonValueByType('abc', 'number'), /Invalid number/)
```

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: PASS after Task 2 implementation.

- [x] **Step 2: Create the structured renderer**

Create `ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue`:

```vue
<template>
  <div class="structured-json-input">
    <template v-for="field in visibleFields" :key="field.path">
      <el-form-item v-if="isScalar(field.valueType)" :label="field.label || field.key">
        <el-input
          v-if="field.valueType === 'text'"
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-input-number
          v-else-if="field.valueType === 'number'"
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-switch
          v-else-if="field.valueType === 'boolean'"
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-date-picker
          v-else-if="field.valueType === 'date'"
          type="date"
          value-format="YYYY-MM-DD"
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-input
          v-else
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
      </el-form-item>

      <el-card v-else-if="field.valueType === 'object'" class="structured-json-input__group" shadow="never">
        <template #header>{{ field.label || field.key }}</template>
        <StructuredJsonInput
          :model-value="modelValue"
          :config="{ mode: 'structured', rootType: 'object', fields: field.children || [] }"
          :disabled="disabled || !field.editable"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </el-card>

      <el-table
        v-else-if="field.valueType === 'array_object'"
        :data="getFieldValue(field)"
        border
        size="small"
        class="structured-json-input__table"
      >
        <el-table-column
          v-for="child in field.children?.filter((item) => item.visible !== false)"
          :key="child.path"
          :label="child.label || child.key"
        >
          <template #default="{ row, $index }">
            <el-input
              :disabled="disabled || !child.editable"
              :model-value="row[child.key]"
              @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
            />
          </template>
        </el-table-column>
      </el-table>

      <el-table
        v-else-if="field.valueType === 'array_value'"
        :data="toArrayValueRows(getFieldValue(field))"
        border
        size="small"
        class="structured-json-input__table"
      >
        <el-table-column :label="field.label || '值'">
          <template #default="{ row, $index }">
            <el-input
              :disabled="disabled || !field.editable"
              :model-value="row.value"
              @update:model-value="updateArrayValue(field, $index, $event)"
            />
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JsonDisplayConfig, JsonDisplayField, JsonDisplayValueType } from './types'
import {
  cloneWithJsonPathValue,
  getJsonPathValue,
  normalizeJsonValueByType,
} from './jsonPathValue'

const props = withDefaults(
  defineProps<{
    modelValue?: any
    config: JsonDisplayConfig
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const visibleFields = computed(() => props.config.fields.filter((field) => field.visible !== false))

const isScalar = (valueType: JsonDisplayValueType) =>
  ['text', 'number', 'boolean', 'date', 'single_select', 'multi_select', 'unknown'].includes(valueType)

const getFieldValue = (field: JsonDisplayField) => getJsonPathValue(props.modelValue, field.path)

const updateFieldValue = (field: JsonDisplayField, value: any) => {
  const nextValue = normalizeJsonValueByType(value, field.valueType)
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, field.path, nextValue))
}

const updateArrayObjectCell = (
  parent: JsonDisplayField,
  child: JsonDisplayField,
  index: number,
  value: any,
) => {
  const rows = [...(getFieldValue(parent) || [])]
  rows[index] = {
    ...(rows[index] || {}),
    [child.key]: normalizeJsonValueByType(value, child.valueType),
  }
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, parent.path, rows))
}

const toArrayValueRows = (value: any) => (Array.isArray(value) ? value : []).map((item) => ({ value: item }))

const updateArrayValue = (field: JsonDisplayField, index: number, value: any) => {
  const rows = [...(getFieldValue(field) || [])]
  rows[index] = value
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, field.path, rows))
}
</script>

<style lang="scss" scoped>
.structured-json-input {
  width: 100%;
}

.structured-json-input__group,
.structured-json-input__table {
  margin-bottom: 12px;
}
</style>
```

- [x] **Step 3: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: both PASS. If Vue reports a recursive component name issue, add `defineOptions({ name: 'StructuredJsonInput' })` at the top of the script block.

- [x] **Step 4: Commit**

```bash
git add ui/src/components/dynamics-form/items/json-display/StructuredJsonInput.vue ui/src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
git commit -m "feat(json-input): render structured json input"
```

---

### Task 7: Switch JsonInput Between CodeMirror and Structured Mode

**Files:**
- Modify: `ui/src/components/dynamics-form/items/JsonInput.vue`

- [x] **Step 1: Extend props and imports**

In `JsonInput.vue`, add imports:

```ts
import StructuredJsonInput from './json-display/StructuredJsonInput.vue'
import { isStructuredJsonDisplayConfig } from './json-display/types'
import type { FormField } from '@/components/dynamics-form/type'
```

Change props to:

```ts
const props = withDefaults(
  defineProps<{
    modelValue?: any
    formField?: FormField
    disabled?: boolean
  }>(),
  { modelValue: () => {}, disabled: false },
)
```

Add:

```ts
const structuredConfig = computed(() => {
  const config = props.formField?.json_display_config
  return isStructuredJsonDisplayConfig(config) ? config : undefined
})
```

- [x] **Step 2: Wrap the template with structured fallback**

At the top of the template inside the root `<div>`, add:

```vue
    <StructuredJsonInput
      v-if="structuredConfig"
      :model-value="modelValue"
      :config="structuredConfig"
      :disabled="disabled"
      @update:model-value="emit('update:modelValue', $event)"
    />
```

Then wrap the current CodeMirror content in:

```vue
    <template v-else>
      <!-- existing Codemirror, footer, format button, dialog -->
    </template>
```

Keep the existing CodeMirror content unchanged inside the `v-else` template.

- [x] **Step 3: Keep validation compatible**

Update `validate_rules`:

```ts
const validate_rules = (rule: any, value: any, callback: any) => {
  if (structuredConfig.value) {
    callback()
    return true
  }
  if (model_value.value) {
    try {
      JSON.parse(model_value.value)
    } catch (e) {
      callback(new Error(t('dynamicsForm.tip.jsonMessage')))
      return false
    }
  }
  callback()
  return true
}
```

- [x] **Step 4: Run assertions and type-check**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
cd ui && npm run type-check
```

Expected: both PASS.

- [x] **Step 5: Commit**

```bash
git add ui/src/components/dynamics-form/items/JsonInput.vue
git commit -m "feat(json-input): enable structured display mode"
```

---

### Task 8: Manual QA and Build Verification

**Files:**
- No required source changes.

- [x] **Step 1: Run pure utility assertions**

Run:

```bash
cd ui && node --experimental-strip-types src/components/dynamics-form/items/json-display/jsonDisplay.assert.ts
```

Expected: PASS with `json-display assertions passed`.

- [x] **Step 2: Run type-check**

Run:

```bash
cd ui && npm run type-check
```

Expected: PASS.

- [x] **Step 3: Run production build**

Run:

```bash
cd ui && npm run build
```

Expected: PASS. Vite build should complete without TypeScript or Vue template errors.

- [x] **Step 4: Start local dev server**

Run:

```bash
cd ui && npm run dev -- --host 127.0.0.1
```

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 5: Manual browser QA**

Partial browser QA completed with both services running:

- Backend started from the local conda `maxkb` environment on `http://127.0.0.1:8080`.
- Frontend dev server started on `http://127.0.0.1:3000`.
- Login succeeded and the workflow editor loaded without console errors.
- The `test3` workflow editor page loaded through real backend APIs.

Full configuration-path QA is still not marked complete because the browser automation drag action did not trigger LogicFlow's component drop handler for adding a new form node.

In the app UI:

Configuration-side checks apply after Task 5B. User-side rendering checks that mention hiding raw JSON or showing grouped fields/table rows are final QA after Task 6 and Task 7 are implemented.

1. Open a workflow form node.
2. Add a JSON input field.
3. Click “生成展示规则”.
4. In the “示例 JSON” dialog, paste this sample JSON:

```json
{
  "customer": {
    "name": "上海示例贸易有限公司",
    "active": true
  },
  "items": [
    {
      "name": "蓝牙耳机",
      "qty": 120,
      "tags": ["电子", "热销"]
    },
    {
      "name": "移动电源",
      "qty": 80,
      "tags": ["配件"]
    }
  ],
  "created_at": "2026-06-16"
}
```

5. Confirm the dialog to generate display rules.
6. Change labels:
   - `customer` -> `客户信息`
   - `customer.name` -> `客户名称`
   - `items[]` -> `商品明细`
   - `items[].qty` -> `数量`
7. For the custom assignment method, optionally set a separate default value and confirm it is not required for rule generation.
8. Save the field and reopen it.
9. Confirm the labels and value types are preserved.
10. Switch the assignment method to referenced variables, choose a variable, and confirm “生成展示规则 / 编辑展示规则” remains available.
11. Open the user-side form rendering.
12. Confirm raw JSON is not shown and the user sees grouped fields/table rows.
13. Edit customer name and item quantity.
14. Submit the form.
15. Confirm the submitted `node_data` keeps the original JSON shape.

- [ ] **Step 6: Commit QA fixes if needed**

If Task 8 reveals source changes, commit them:

```bash
git add ui/src/components/dynamics-form
git commit -m "fix(json-input): polish structured display behavior"
```

If no source changes are needed, do not create an empty commit.
