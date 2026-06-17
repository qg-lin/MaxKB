import assert from 'node:assert/strict'
import {
  cloneWithJsonPathValue,
  getJsonPathValue,
  normalizeJsonInputValue,
  normalizeJsonValueByType,
} from './jsonPathValue.ts'
import { inferJsonDisplayConfig } from './jsonDisplayInfer.ts'
import {
  type JsonDisplayConfig,
  isStructuredJsonDisplayConfig,
  resolveJsonDisplayMode,
  shouldUseStructuredJsonDisplay,
} from './types.ts'
import {
  shouldRenderArrayValueSelectInput,
  shouldRenderSelectInput,
} from './selectFieldDisplay.ts'

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
assert.deepEqual(getJsonPathValue([{ name: 'a' }, { name: 'b' }], '[].name'), ['a', 'b'])
assert.deepEqual(normalizeJsonInputValue('[{"name":"张三"},{"name":"李四"}]'), [
  { name: '张三' },
  { name: '李四' },
])
assert.deepEqual(getJsonPathValue('[{"name":"张三"},{"name":"李四"}]', '[].name'), ['张三', '李四'])
assert.deepEqual(getJsonPathValue("[{'name':'张三','phone':null},{'name':'李四','phone':None}]", '[].phone'), [null, null])

const updatedName = cloneWithJsonPathValue(source, 'customer.name', '新客户')
assert.equal(updatedName.customer.name, '新客户')
assert.equal(source.customer.name, '旧客户')
assert.equal(updatedName.untouched, 'keep')

const updatedStringSource = cloneWithJsonPathValue('[{"name":"张三"}]', '[].name', ['王五'])
assert.deepEqual(updatedStringSource, [{ name: '王五' }])

const updatedColumn = cloneWithJsonPathValue(source, 'items[].qty', [3, 4])
assert.deepEqual(
  updatedColumn.items.map((item: any) => item.qty),
  [3, 4],
)

const updatedRootArray = cloneWithJsonPathValue([{ name: 'a' }], '[].qty', [1])
assert.deepEqual(updatedRootArray, [{ name: 'a', qty: 1 }])

const updatedShortColumn = cloneWithJsonPathValue(source, 'items[].qty', [3])
assert.deepEqual(updatedShortColumn.items, [
  { name: '耳机', qty: 3 },
  { name: '电源', qty: 2 },
])

const updatedNestedArrayColumn = cloneWithJsonPathValue(
  { items: [{ tags: ['x', 'y'], name: 'a' }] },
  'items[].tags[]',
  [['m', 'n']],
)
assert.deepEqual(updatedNestedArrayColumn.items, [{ tags: ['m', 'n'], name: 'a' }])

const updatedNestedObjectColumn = cloneWithJsonPathValue(
  { items: [{ meta: { ok: true }, name: 'a' }] },
  'items[].meta.ok',
  [false],
)
assert.deepEqual(updatedNestedObjectColumn.items, [{ meta: { ok: false }, name: 'a' }])

const updatedArrayValueShorter = cloneWithJsonPathValue(
  { city: ['上海', '深圳'] },
  'city[]',
  ['上海'],
)
assert.deepEqual(updatedArrayValueShorter.city, ['上海'])

const groups = [
  {
    name: 'A',
    items: [
      { name: 'A1', qty: 1 },
      { name: 'A2', qty: 2 },
    ],
  },
  {
    name: 'B',
    items: [{ name: 'B1', qty: 3 }],
  },
]

assert.deepEqual(getJsonPathValue(groups, '[].items[].qty'), [[1, 2], [3]])
assert.equal(getJsonPathValue(42, ''), 42)

const updatedGroups = cloneWithJsonPathValue(groups, '[].items[].qty', [[10, 20], [30]])
assert.deepEqual(getJsonPathValue(updatedGroups, '[].items[].qty'), [[10, 20], [30]])
assert.deepEqual(getJsonPathValue(groups, '[].items[].qty'), [[1, 2], [3]])
assert.equal(cloneWithJsonPathValue(42, '', 7), 7)

assert.equal(normalizeJsonValueByType('42', 'number'), 42)
assert.equal(normalizeJsonValueByType('   ', 'number'), '')
assert.equal(normalizeJsonValueByType('true', 'boolean'), true)
assert.deepEqual(normalizeJsonValueByType('a,b', 'multi_select'), ['a', 'b'])
assert.throws(() => normalizeJsonValueByType('Infinity', 'number'), /Invalid number/)
assert.throws(() => normalizeJsonValueByType('not-boolean', 'boolean'), /Invalid boolean/)

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

const inferredRootValue = inferJsonDisplayConfig(42)
assert.equal(inferredRootValue.rootType, 'value')
assert.equal(inferredRootValue.fields[0]?.path, '')
assert.equal(inferredRootValue.fields[0]?.key, 'value')
assert.equal(inferredRootValue.fields[0]?.label, '值')
assert.equal(inferredRootValue.fields[0]?.valueType, 'number')

const inferredNull = inferJsonDisplayConfig(null)
assert.equal(inferredNull.rootType, 'value')
assert.equal(inferredNull.fields[0]?.path, '')
assert.equal(inferredNull.fields[0]?.valueType, 'unknown')

const inferredEmptyArray = inferJsonDisplayConfig([])
assert.equal(inferredEmptyArray.rootType, 'array')
assert.equal(inferredEmptyArray.fields[0]?.path, '[]')
assert.equal(inferredEmptyArray.fields[0]?.valueType, 'unknown')

const inferredEmptyObject = inferJsonDisplayConfig({})
assert.equal(inferredEmptyObject.rootType, 'object')
assert.deepEqual(inferredEmptyObject.fields, [])

const inferredNullableArray = inferJsonDisplayConfig([{ qty: null }, { qty: 2 }])
assert.equal(
  inferredNullableArray.fields[0]?.children?.find((field) => field.path === '[].qty')?.valueType,
  'number',
)

const inferredNestedArray = inferJsonDisplayConfig([{ meta: { ok: true }, tags: ['a'] }])
const rootArrayChildren = inferredNestedArray.fields[0]?.children
const metaField = rootArrayChildren?.find((field) => field.path === '[].meta')
assert.equal(metaField?.valueType, 'object')
assert.equal(metaField?.children?.find((field) => field.path === '[].meta.ok')?.valueType, 'boolean')
assert.equal(rootArrayChildren?.find((field) => field.path === '[].tags[]')?.valueType, 'array_value')

const displayConfig = inferJsonDisplayConfig([{ name: '张三' }])
assert.equal(resolveJsonDisplayMode(undefined, undefined), 'codemirror')
assert.equal(resolveJsonDisplayMode(undefined, displayConfig), 'structured')
assert.equal(resolveJsonDisplayMode('codemirror', displayConfig), 'codemirror')
assert.equal(resolveJsonDisplayMode('structured', displayConfig), 'structured')
assert.equal(
  shouldUseStructuredJsonDisplay({
    json_display_mode: 'codemirror',
    json_display_config: displayConfig,
  }),
  false,
)
assert.equal(
  shouldUseStructuredJsonDisplay({
    json_display_mode: 'structured',
    json_display_config: displayConfig,
  }),
  true,
)
assert.equal(shouldUseStructuredJsonDisplay({ json_display_config: displayConfig }), true)
assert.equal(shouldUseStructuredJsonDisplay({}), false)

const selectConfig: JsonDisplayConfig = {
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
assert.equal(shouldRenderSelectInput(selectConfig.fields[0]), true)
assert.equal(shouldRenderSelectInput({ ...selectConfig.fields[0], option_list: [] }), false)
assert.equal(shouldRenderSelectInput({ ...selectConfig.fields[0], option_list: undefined }), false)
assert.equal(
  shouldRenderArrayValueSelectInput({
    path: 'city[]',
    key: 'city',
    label: '城市',
    valueType: 'array_value',
    visible: true,
    editable: true,
    option_list: [
      { label: '上海', value: '上海' },
      { label: '深圳', value: '深圳' },
    ],
  }),
  true,
)
assert.equal(
  shouldRenderArrayValueSelectInput({
    path: 'city[]',
    key: 'city',
    label: '城市',
    valueType: 'array_value',
    visible: true,
    editable: true,
  }),
  false,
)
assert.equal(
  isStructuredJsonDisplayConfig({
    ...selectConfig,
    fields: [{ ...selectConfig.fields[0], option_list: [{ label: '缺少值' }] }],
  }),
  false,
)

assert.throws(() => normalizeJsonValueByType('abc', 'number'), /Invalid number/)

console.log('json-display assertions passed')
