<template>
  <el-select-v2
    filterable
    :teleported="true"
    popper-class="dynamics-single-select"
    clearable
    v-bind="$attrs"
    v-model="_modelValue"
    :options="options"
    @visible-change="handleVisibleChange"
  />
</template>
<script setup lang="ts">
import type { FormField } from '@/components/dynamics-form/type'
import { computed, useAttrs } from 'vue'
import _ from 'lodash'
const attrs = useAttrs() as any

const props = defineProps<{
  modelValue?: string
  formValue?: any
  formfieldList?: Array<FormField>
  field: string
  otherParams: any
  formField: FormField
  view?: boolean
}>()

const emit = defineEmits(['update:modelValue', 'change'])

const _modelValue = computed({
  get() {
    return props.modelValue
  },
  set(value) {
    emit('update:modelValue', value)
    emit('change', props.formField)
  },
})
const textField = computed(() => {
  return props.formField.text_field ? props.formField.text_field : 'key'
})

const valueField = computed(() => {
  return props.formField.value_field ? props.formField.value_field : 'value'
})

const option_list = computed(() => {
  return props.formField.option_list ? props.formField.option_list : []
})

const options = computed(() => {
  return option_list.value.map((item: any) => ({
    value: item[valueField.value],
    label: item[textField.value],
  }))
})

// 保留原 label() 中的"value 失效自动置空"逻辑：在下拉打开时检查
const handleVisibleChange = (visible: boolean) => {
  if (visible && props.modelValue && option_list.value && !attrs['allow-create']) {
    const exists = option_list.value.some(
      (item: any) => item[valueField.value] === props.modelValue,
    )
    if (!exists) {
      emit('update:modelValue', undefined)
    }
  }
}
</script>
<style lang="scss">
.dynamics-single-select {
  .el-select-dropdown {
    max-width: 1px;
  }
}
</style>
