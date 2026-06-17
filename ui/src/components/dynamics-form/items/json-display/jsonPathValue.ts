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

const canReplaceBareToken = (text: string, index: number, token: string) => {
  const before = text[index - 1]
  const after = text[index + token.length]
  return !/[A-Za-z0-9_$]/.test(before || '') && !/[A-Za-z0-9_$]/.test(after || '')
}

const escapeJsonStringChar = (char: string) =>
  char
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')

const normalizeJsonLikeText = (text: string) => {
  let result = ''
  let quote: "'" | '"' | undefined

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (quote) {
      if (char === '\\') {
        const nextChar = text[index + 1]
        if (nextChar !== undefined) {
          result += quote === "'" ? escapeJsonStringChar(nextChar) : `${char}${nextChar}`
          index += 1
          continue
        }
      }

      if (char === quote) {
        result += '"'
        quote = undefined
        continue
      }

      result += quote === "'" ? escapeJsonStringChar(char) : char
      continue
    }

    if (char === "'" || char === '"') {
      quote = char
      result += '"'
      continue
    }

    if (text.startsWith('None', index) && canReplaceBareToken(text, index, 'None')) {
      result += 'null'
      index += 3
      continue
    }

    if (text.startsWith('True', index) && canReplaceBareToken(text, index, 'True')) {
      result += 'true'
      index += 3
      continue
    }

    if (text.startsWith('False', index) && canReplaceBareToken(text, index, 'False')) {
      result += 'false'
      index += 4
      continue
    }

    result += char
  }

  return result
}

export const normalizeJsonInputValue = (value: any): any => {
  if (typeof value !== 'string') return value

  const trimmedValue = value.trim()
  if (!trimmedValue || !/^[{[]/.test(trimmedValue)) return value

  try {
    return JSON.parse(trimmedValue)
  } catch (error) {
    try {
      return JSON.parse(normalizeJsonLikeText(trimmedValue))
    } catch (fallbackError) {
      return value
    }
  }
}

export const getJsonPathValue = (source: any, path: string): any => {
  const normalizedSource = normalizeJsonInputValue(source)
  if (path === '') return normalizedSource

  const tokens = parsePath(path)

  const read = (value: any, index: number): any => {
    if (index >= tokens.length) return value
    const token = tokens[index]

    if (token.array) {
      const next = token.key ? value?.[token.key] : value
      if (!Array.isArray(next)) return []
      return next.map((item) => read(item, index + 1))
    }

    const next = value?.[token.key]
    return read(next, index + 1)
  }

  return read(normalizedSource, 0)
}

export const cloneWithJsonPathValue = (source: any, path: string, nextValue: any): any => {
  if (path === '') return nextValue

  const root = cloneJson(normalizeJsonInputValue(source)) ?? {}
  const tokens = parsePath(path)

  const write = (target: any, index: number, value: any): any => {
    const token = tokens[index]
    if (!token) return value

    if (token.array) {
      const currentArray = token.key
        ? Array.isArray(target[token.key])
          ? target[token.key]
          : []
        : Array.isArray(target)
          ? target
          : []
      const values = Array.isArray(value) ? value : [value]
      const shouldPreserveTrailingItems = index < tokens.length - 1
      const nextArray = Array.from({ length: shouldPreserveTrailingItems ? Math.max(currentArray.length, values.length) : values.length }, (_, itemIndex) => {
        const itemTarget = currentArray[itemIndex] ?? {}
        if (itemIndex >= values.length) return itemTarget
        const itemValue = values[itemIndex]
        return write(itemTarget, index + 1, itemValue)
      })
      if (!token.key) return nextArray
      target[token.key] = nextArray
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
    const normalizedValue = typeof value === 'string' ? value.trim() : value
    if (normalizedValue === '') return ''
    const result = Number(normalizedValue)
    if (!Number.isFinite(result)) throw new Error('Invalid number')
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
