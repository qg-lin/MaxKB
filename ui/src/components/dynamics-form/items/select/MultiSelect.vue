<template>
  <el-select-v2
    class="m-2"
    multiple
    filterable
    allow-create
    clearable
    default-first-option
    :reserve-keyword="false"
    v-bind="$attrs"
    v-model="_modelValue"
    :options="options"
  />
</template>
<script setup lang="ts">
import type { FormField } from '@/components/dynamics-form/type'
import { computed, ref } from 'vue'
import _ from 'lodash'
const rowTemp = ref<any>()

const props = defineProps<{
  modelValue?: Array<any>
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
    if (props.modelValue) {
      return props.modelValue
    }
    return []
  },
  set($event) {
    emit('update:modelValue', $event)
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
</script>
<style lang="scss"></style>
