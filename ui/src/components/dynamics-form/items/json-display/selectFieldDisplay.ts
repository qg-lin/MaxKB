import type { JsonDisplayField } from './types'

export const isSelectField = (field: JsonDisplayField) =>
  field.valueType === 'single_select' || field.valueType === 'multi_select'

export const shouldRenderSelectInput = (field: JsonDisplayField) =>
  isSelectField(field) && Array.isArray(field.option_list) && field.option_list.length > 0

export const shouldRenderArrayValueSelectInput = (field: JsonDisplayField) =>
  field.valueType === 'array_value' &&
  Array.isArray(field.option_list) &&
  field.option_list.length > 0
