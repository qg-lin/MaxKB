<template>
  <div class="structured-json-input">
    <template v-for="field in visibleFields" :key="field.path">
      <div v-if="isScalar(field.valueType)" class="structured-json-input__field">
        <div class="structured-json-input__label">{{ field.label || field.key }}</div>
        <el-input-number
          v-if="field.valueType === 'number'"
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-switch
          v-else-if="field.valueType === 'boolean'"
          :disabled="disabled || !field.editable"
          :model-value="Boolean(getFieldValue(field))"
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
        <el-select-v2
          v-else-if="shouldRenderSelectInput(field) && field.valueType === 'single_select'"
          filterable
          clearable
          :disabled="disabled || !field.editable"
          :model-value="getFieldValue(field)"
          :options="getSelectOptions(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-select-v2
          v-else-if="shouldRenderSelectInput(field) && field.valueType === 'multi_select'"
          multiple
          filterable
          clearable
          :reserve-keyword="false"
          :disabled="disabled || !field.editable"
          :model-value="getMultiSelectValue(getFieldValue(field))"
          :options="getSelectOptions(field)"
          @update:model-value="updateFieldValue(field, $event)"
        />
        <el-input
          v-else
          :disabled="disabled || !field.editable"
          :model-value="formatInputValue(getFieldValue(field))"
          @update:model-value="updateFieldValue(field, $event)"
        />
      </div>

      <el-card v-else-if="field.valueType === 'object'" class="structured-json-input__group" shadow="never">
        <template #header>
          <span>{{ field.label || field.key }}</span>
        </template>
        <StructuredJsonInput
          :model-value="modelValue"
          :config="{ mode: 'structured', rootType: 'object', fields: field.children || [] }"
          :disabled="disabled || !field.editable"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </el-card>

      <div v-else-if="field.valueType === 'array_object'" class="structured-json-input__table-wrap">
        <div class="structured-json-input__table-title">{{ field.label || field.key }}</div>
        <el-table
          :data="getArrayValue(field)"
          border
          size="small"
          class="structured-json-input__table"
        >
          <el-table-column
            v-for="child in getVisibleChildren(field)"
            :key="child.path"
            :label="child.label || child.key"
            min-width="160"
          >
            <template #default="{ row, $index }">
              <el-input-number
                v-if="child.valueType === 'number'"
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="getArrayObjectCellValue(field, child, row)"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-switch
                v-else-if="child.valueType === 'boolean'"
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="Boolean(getArrayObjectCellValue(field, child, row))"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-date-picker
                v-else-if="child.valueType === 'date'"
                type="date"
                value-format="YYYY-MM-DD"
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="getArrayObjectCellValue(field, child, row)"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-select-v2
                v-else-if="shouldRenderSelectInput(child) && child.valueType === 'single_select'"
                filterable
                clearable
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="getArrayObjectCellValue(field, child, row)"
                :options="getSelectOptions(child)"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-select-v2
                v-else-if="shouldRenderSelectInput(child) && child.valueType === 'multi_select'"
                multiple
                filterable
                clearable
                :reserve-keyword="false"
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="getMultiSelectValue(getArrayObjectCellValue(field, child, row))"
                :options="getSelectOptions(child)"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-input
                v-else-if="isArrayTextType(child.valueType)"
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="formatInputValue(getArrayObjectCellValue(field, child, row))"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
              <el-input
                v-else-if="isReadonlyStructuredType(child.valueType)"
                type="textarea"
                disabled
                :autosize="{ minRows: 1, maxRows: 4 }"
                :model-value="formatJsonPreview(getArrayObjectCellValue(field, child, row))"
              />
              <el-input
                v-else
                :disabled="disabled || !field.editable || !child.editable"
                :model-value="formatInputValue(getArrayObjectCellValue(field, child, row))"
                @update:model-value="updateArrayObjectCell(field, child, $index, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="!disabled && field.editable"
            label="操作"
            width="72"
            fixed="right"
          >
            <template #default="{ $index }">
              <el-button
                link
                type="danger"
                title="移除"
                @click="removeArrayRow(field, $index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-else-if="field.valueType === 'array_value'" class="structured-json-input__table-wrap">
        <div class="structured-json-input__table-title">{{ field.label || field.key }}</div>
        <el-select-v2
          v-if="shouldRenderArrayValueSelectInput(field)"
          multiple
          filterable
          clearable
          :reserve-keyword="false"
          :disabled="disabled || !field.editable"
          :model-value="getMultiSelectValue(getFieldValue(field))"
          :options="getSelectOptions(field)"
          class="structured-json-input__array-select"
          @update:model-value="updateArrayValueField(field, $event)"
        />
        <el-table
          v-else
          :data="toArrayValueRows(getFieldValue(field))"
          border
          size="small"
          class="structured-json-input__table"
        >
          <el-table-column :label="field.label || '值'" min-width="160">
            <template #default="{ row, $index }">
              <el-input
                :disabled="disabled || !field.editable"
                :model-value="formatInputValue(row.value)"
                @update:model-value="updateArrayValue(field, $index, $event)"
              />
            </template>
          </el-table-column>
          <el-table-column
            v-if="!disabled && field.editable"
            label="操作"
            width="72"
            fixed="right"
          >
            <template #default="{ $index }">
              <el-button
                link
                type="danger"
                title="移除"
                @click="removeArrayRow(field, $index)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import type { JsonDisplayConfig, JsonDisplayField, JsonDisplayValueType } from './types'
import {
  cloneWithJsonPathValue,
  getJsonPathValue,
  normalizeJsonValueByType,
} from './jsonPathValue'
import {
  shouldRenderArrayValueSelectInput,
  shouldRenderSelectInput,
} from './selectFieldDisplay'

defineOptions({ name: 'StructuredJsonInput' })

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

const scalarTypes: JsonDisplayValueType[] = [
  'text',
  'number',
  'boolean',
  'date',
  'single_select',
  'multi_select',
  'unknown',
]

const visibleFields = computed(() => props.config.fields.filter((field) => field.visible !== false))

const isScalar = (valueType: JsonDisplayValueType) => scalarTypes.includes(valueType)

const isArrayTextType = (valueType: JsonDisplayValueType) =>
  valueType === 'array_value' || valueType === 'multi_select'

const isReadonlyStructuredType = (valueType: JsonDisplayValueType) =>
  valueType === 'object' || valueType === 'array_object'

const getVisibleChildren = (field: JsonDisplayField) =>
  (field.children || []).filter((child) => child.visible !== false)

const getSelectOptions = (field: JsonDisplayField) =>
  (field.option_list || []).map((option) => ({
    label: option.label,
    value: option.value,
  }))

const getMultiSelectValue = (value: unknown) => (Array.isArray(value) ? value : [])

const formatInputValue = (value: unknown) => {
  if (value === undefined || value === null) {
    return ''
  }

  if (Array.isArray(value)) {
    return value.join(',')
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const formatJsonPreview = (value: unknown) => {
  if (value === undefined || value === null) {
    return ''
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

const getFieldValue = (field: JsonDisplayField) => getJsonPathValue(props.modelValue, field.path)

const getArrayValue = (field: JsonDisplayField) => {
  const value = getFieldValue(field)
  return Array.isArray(value) ? value : []
}

const updateFieldValue = (field: JsonDisplayField, value: unknown) => {
  const nextValue = normalizeJsonValueByType(value, field.valueType)
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, field.path, nextValue))
}

const getArrayChildRelativePath = (parent: JsonDisplayField, child: JsonDisplayField) => {
  if (child.path.startsWith(`${parent.path}.`)) {
    return child.path.slice(parent.path.length + 1)
  }

  if (parent.path === '[]' && child.path.startsWith('[].')) {
    return child.path.slice(3)
  }

  return child.key
}

const getArrayObjectCellValue = (parent: JsonDisplayField, child: JsonDisplayField, row: unknown) =>
  getJsonPathValue(row, getArrayChildRelativePath(parent, child))

const normalizeArrayObjectCellValue = (child: JsonDisplayField, value: unknown) => {
  if (isArrayTextType(child.valueType)) {
    return normalizeJsonValueByType(value, 'multi_select')
  }

  return normalizeJsonValueByType(value, child.valueType)
}

const updateArrayObjectCell = (
  parent: JsonDisplayField,
  child: JsonDisplayField,
  index: number,
  value: unknown,
) => {
  if (isReadonlyStructuredType(child.valueType)) {
    return
  }

  const rows = [...getArrayValue(parent)]
  const row = rows[index] ?? {}
  rows[index] = cloneWithJsonPathValue(
    row,
    getArrayChildRelativePath(parent, child),
    normalizeArrayObjectCellValue(child, value),
  )
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, parent.path, rows))
}

const toArrayValueRows = (value: unknown) =>
  (Array.isArray(value) ? value : []).map((item) => ({ value: item }))

const updateArrayValue = (field: JsonDisplayField, index: number, value: unknown) => {
  const rows = [...getArrayValue(field)]
  rows[index] = value
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, field.path, rows))
}

const updateArrayValueField = (field: JsonDisplayField, value: unknown) => {
  emit(
    'update:modelValue',
    cloneWithJsonPathValue(props.modelValue, field.path, normalizeJsonValueByType(value, 'multi_select')),
  )
}

const removeArrayRow = (field: JsonDisplayField, index: number) => {
  if (props.disabled || !field.editable) return
  const rows = [...getArrayValue(field)]
  rows.splice(index, 1)
  emit('update:modelValue', cloneWithJsonPathValue(props.modelValue, field.path, rows))
}
</script>

<style lang="scss" scoped>
.structured-json-input {
  width: 100%;
}

.structured-json-input__field {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.structured-json-input__label {
  flex: 0 0 120px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 22px;
}

.structured-json-input__group,
.structured-json-input__table-wrap {
  margin-bottom: 12px;
}

.structured-json-input__table-title {
  margin-bottom: 8px;
  color: var(--el-text-color-regular);
  font-size: 14px;
  line-height: 22px;
}

.structured-json-input__table {
  width: 100%;
}

.structured-json-input__array-select {
  width: 100%;
}
</style>
