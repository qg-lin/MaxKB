export type JsonDisplayRootType = 'object' | 'array' | 'value'

export type JsonDisplayMode = 'codemirror' | 'structured'

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

export interface JsonDisplayOption {
  label: string
  value: string
}

export interface JsonDisplayField {
  path: string
  key: string
  label: string
  valueType: JsonDisplayValueType
  visible: boolean
  editable: boolean
  option_list?: JsonDisplayOption[]
  children?: JsonDisplayField[]
}

export interface JsonDisplayConfig {
  mode: 'structured'
  rootType: JsonDisplayRootType
  fields: JsonDisplayField[]
}

export const jsonDisplayValueTypeOptions = [
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
] as const satisfies ReadonlyArray<{ label: string; value: JsonDisplayValueType }>

const jsonDisplayRootTypes = ['object', 'array', 'value'] as const satisfies ReadonlyArray<JsonDisplayRootType>
const jsonDisplayValueTypes = jsonDisplayValueTypeOptions.map((option) => option.value)

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isJsonDisplayRootType = (value: unknown): value is JsonDisplayRootType =>
  typeof value === 'string' && jsonDisplayRootTypes.includes(value as JsonDisplayRootType)

const isJsonDisplayValueType = (value: unknown): value is JsonDisplayValueType =>
  typeof value === 'string' && jsonDisplayValueTypes.includes(value as JsonDisplayValueType)

const isJsonDisplayOption = (value: unknown): value is JsonDisplayOption =>
  isRecord(value) && typeof value.label === 'string' && typeof value.value === 'string'

const isJsonDisplayField = (value: unknown): value is JsonDisplayField => {
  if (!isRecord(value)) {
    return false
  }

  if (
    typeof value.path !== 'string' ||
    typeof value.key !== 'string' ||
    typeof value.label !== 'string' ||
    !isJsonDisplayValueType(value.valueType) ||
    typeof value.visible !== 'boolean' ||
    typeof value.editable !== 'boolean'
  ) {
    return false
  }

  if (
    value.option_list !== undefined &&
    (!Array.isArray(value.option_list) || !value.option_list.every(isJsonDisplayOption))
  ) {
    return false
  }

  return value.children === undefined || (Array.isArray(value.children) && value.children.every(isJsonDisplayField))
}

export const isStructuredJsonDisplayConfig = (value: unknown): value is JsonDisplayConfig => {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.mode === 'structured' &&
    isJsonDisplayRootType(value.rootType) &&
    Array.isArray(value.fields) &&
    value.fields.every(isJsonDisplayField)
  )
}

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
