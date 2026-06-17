type VisibilityField = {
  field: string
  required?: boolean
  show_in_form?: boolean
  hide_when_no_value?: boolean
  relation_show_field_dict?: Record<string, Array<unknown>>
}

type VisibilityOptions = {
  field: VisibilityField
  formValue: Record<string, unknown>
  formConfig?: { hide_when_no_value?: boolean }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === '[object Object]'
}

/**
 * Strict empty value check for hide-when-no-value.
 * 0 and false are treated as non-empty values.
 */
const isEmptyValue = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value === '') return true
  if (Array.isArray(value)) return value.length === 0 || value.every(isEmptyValue)
  if (isRecord(value)) return Object.values(value).every(isEmptyValue)
  return false
}

const resolveHideWhenNoValue = (
  field: VisibilityField,
  formConfig?: { hide_when_no_value?: boolean },
): boolean => {
  if (field.hide_when_no_value !== undefined) return field.hide_when_no_value
  return formConfig?.hide_when_no_value === true
}

const getValueByPath = (value: Record<string, unknown>, path: string): unknown => {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key]
    }
    return undefined
  }, value)
}

const isFormFieldVisible = ({ field, formValue, formConfig }: VisibilityOptions): boolean => {
  if (field.show_in_form === false) return false

  if (field.relation_show_field_dict) {
    const keys = Object.keys(field.relation_show_field_dict)
    for (const key of keys) {
      const value = getValueByPath(formValue, key)
      if (value && value !== undefined && value !== null) {
        const values = field.relation_show_field_dict[key]
        if (values && values.length > 0 && !values.includes(value)) return false
      } else {
        return false
      }
    }
  }

  if (!field.required && resolveHideWhenNoValue(field, formConfig)) {
    if (isEmptyValue(formValue[field.field])) return false
  }

  return true
}

export { isEmptyValue, isFormFieldVisible }
