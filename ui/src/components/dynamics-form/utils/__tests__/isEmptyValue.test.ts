import assert from 'node:assert/strict'
import { isEmptyValue } from '../formFieldVisibility.ts'

assert.equal(
  isEmptyValue({ country: [], city: [], remark: '' }),
  true,
  'json object with only empty properties should be empty',
)

assert.equal(
  isEmptyValue({ country: [], city: ['Shanghai'], remark: '' }),
  false,
  'json object should be non-empty when at least one property is non-empty',
)

assert.equal(
  isEmptyValue([{ phone: '', email: null }]),
  true,
  'array with objects whose properties are all empty should be empty',
)
