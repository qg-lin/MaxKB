import assert from 'node:assert/strict'
import { isFormFieldVisible } from '../formFieldVisibility.ts'

assert.equal(
  isFormFieldVisible({
    field: { field: 'remark', show_in_form: false },
    formValue: { remark: 'internal note' },
  }),
  false,
  'field should be hidden when show_in_form is false even if it has value',
)

assert.equal(
  isFormFieldVisible({
    field: { field: 'remark', hide_when_no_value: true },
    formValue: { remark: '' },
  }),
  false,
  'hide-when-no-value should still hide empty fields when show_in_form is not configured',
)

assert.equal(
  isFormFieldVisible({
    field: { field: 'remark', hide_when_no_value: true },
    formValue: { remark: 'visible note' },
  }),
  true,
  'field should remain visible when it is configured to show and has value',
)

