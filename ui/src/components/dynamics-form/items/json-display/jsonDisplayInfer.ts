import type {
  JsonDisplayConfig,
  JsonDisplayField,
  JsonDisplayRootType,
  JsonDisplayValueType,
} from './types'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const isDateLike = (value: string): boolean => /^\d{4}-\d{2}-\d{2}($|[ T])/.test(value)

const inferRootType = (value: unknown): JsonDisplayRootType => {
  if (Array.isArray(value)) {
    return 'array'
  }

  if (isPlainObject(value)) {
    return 'object'
  }

  return 'value'
}

const inferValueType = (value: unknown): JsonDisplayValueType => {
  if (Array.isArray(value)) {
    if (value.some(isPlainObject)) {
      return 'array_object'
    }

    return value.length > 0 ? 'array_value' : 'unknown'
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length > 0 ? 'object' : 'unknown'
  }

  if (typeof value === 'number') {
    return 'number'
  }

  if (typeof value === 'boolean') {
    return 'boolean'
  }

  if (typeof value === 'string') {
    return isDateLike(value) ? 'date' : 'text'
  }

  return 'unknown'
}

const unionObjectKeys = (items: unknown[]): string[] => {
  const keys = new Set<string>()

  items.forEach((item) => {
    if (isPlainObject(item)) {
      Object.keys(item).forEach((key) => keys.add(key))
    }
  })

  return Array.from(keys)
}

const findObjectArraySample = (items: unknown[], key: string): unknown =>
  items.find((item) => isPlainObject(item) && item[key] !== null && item[key] !== undefined)

const createField = (
  path: string,
  key: string,
  valueType: JsonDisplayValueType,
  children?: JsonDisplayField[],
  label = key,
): JsonDisplayField => ({
  path,
  key,
  label,
  valueType,
  visible: true,
  editable: true,
  children,
})

const getObjectArrayChildren = (items: unknown[], basePath: string): JsonDisplayField[] =>
  unionObjectKeys(items).map((key) => {
    const sample = findObjectArraySample(items, key)
    const childValue = isPlainObject(sample) ? sample[key] : undefined
    const childType = inferValueType(childValue)
    const childBasePath = `${basePath}[].${key}`
    const childPath = childType === 'array_object' || childType === 'array_value' ? `${childBasePath}[]` : childBasePath

    return createField(
      childPath,
      key,
      childType,
      childType === 'object'
        ? inferFields(childValue, childBasePath)
        : childType === 'array_object' && Array.isArray(childValue)
          ? getObjectArrayChildren(childValue, childBasePath)
          : undefined,
    )
  })

const inferFields = (value: unknown, basePath = ''): JsonDisplayField[] => {
  if (isPlainObject(value)) {
    return Object.keys(value).map((key) => {
      const childValue = value[key]
      const path = basePath ? `${basePath}.${key}` : key
      const valueType = inferValueType(childValue)
      const fieldPath = valueType === 'array_object' || valueType === 'array_value' ? `${path}[]` : path

      return createField(
        fieldPath,
        key,
        valueType,
        valueType === 'object'
          ? inferFields(childValue, path)
          : valueType === 'array_object' && Array.isArray(childValue)
            ? getObjectArrayChildren(childValue, path)
            : undefined,
      )
    })
  }

  if (Array.isArray(value)) {
    const path = basePath ? `${basePath}[]` : '[]'

    if (value.some(isPlainObject)) {
      return [
        createField(path, basePath || 'items', 'array_object', getObjectArrayChildren(value, basePath)),
      ]
    }

    return [
      createField(
        path,
        basePath || 'value',
        value.length > 0 ? 'array_value' : 'unknown',
        undefined,
        basePath || '值',
      ),
    ]
  }

  return [
    createField(basePath, basePath || 'value', inferValueType(value), undefined, basePath || '值'),
  ]
}

export const inferJsonDisplayConfig = (value: unknown): JsonDisplayConfig => ({
  mode: 'structured',
  rootType: inferRootType(value),
  fields: inferFields(value),
})
