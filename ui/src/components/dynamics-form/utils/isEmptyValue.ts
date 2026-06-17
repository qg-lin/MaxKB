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

export { isEmptyValue }

