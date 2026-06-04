<template>
  <el-form-item :label="$t('dynamicsForm.TextInput.length.label')" required>
    <el-row class="w-full">
      <el-col :span="11">
        <el-form-item
          :rules="[
            {
              required: true,
              message: $t('dynamicsForm.TextInput.length.minRequired'),
              trigger: 'change'
            }
          ]"
          prop="minlength"
        >
          <el-input-number
            style="width: 100%"
            :min="1"
            :step="1"
            step-strictly
            v-model="formValue.minlength"
            controls-position="right"
          />
        </el-form-item>
      </el-col>
      <el-col :span="2" class="text-center">
        <span>-</span>
      </el-col>
      <el-col :span="11">
        <el-form-item
          :rules="[
            {
              required: true,
              message: $t('dynamicsForm.TextInput.length.maxRequired'),
              trigger: 'change'
            }
          ]"
          prop="maxlength"
        >
          <el-input-number
            style="width: 100%"
            :min="formValue.minlength > formValue.maxlength ? formValue.minlength : 1"
            step-strictly
            :step="1"
            v-model="formValue.maxlength"
            controls-position="right"
        /></el-form-item>
      </el-col>
    </el-row>
  </el-form-item>

  <el-form-item v-if="getModel">
    <template #label>
      <div class="flex-between">
        {{ $t('dynamicsForm.AssignmentMethod.label', '赋值方式') }}
      </div>
    </template>
    <el-row style="width: 100%" :gutter="10">
      <el-radio-group v-model="formValue.default_value_assignment_method">
        <el-radio :key="item.value" :value="item.value" size="large" v-for="item in assignment_method_option_list"
          >{{ item.label }}
        </el-radio>
      </el-radio-group>
    </el-row>
  </el-form-item>

  <el-form-item
    v-if="formValue.default_value_assignment_method == 'ref_variables'"
    :required="true"
    prop="default_value"
    :rules="[default_ref_variables_value_rule]"
  >
    <NodeCascader
      ref="nodeCascaderRef"
      :nodeModel="model"
      class="w-full"
      :placeholder="$t('workflow.variable.placeholder')"
      v-model="formValue.default_value"
    />
  </el-form-item>

  <el-form-item
    v-if="formValue.default_value_assignment_method == 'custom'"
    class="defaultValueItem"
    :required="formValue.required"
    prop="default_value"
    :label="$t('dynamicsForm.default.label')"
    :rules="
      formValue.required ? [{ required: true, message: `${$t('dynamicsForm.default.label')}${$t('dynamicsForm.default.requiredMessage')}` }, ...rules] : rules
    "
  >
    <div class="defaultValueCheckbox">
      <el-checkbox
        v-model="formValue.show_default_value"
        :label="$t('dynamicsForm.default.show')"
      />
    </div>

    <el-input
      v-model="formValue.default_value"
      :maxlength="formValue.maxlength"
      :minlength="formValue.minlength"
      :placeholder="$t('dynamicsForm.default.placeholder')"
      show-word-limit
      type="text"
    />
  </el-form-item>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, inject, watch } from 'vue'
import { t } from '@/locales'
import NodeCascader from '@/workflow/common/NodeCascader.vue'
const props = defineProps<{
  modelValue: any
}>()
const getModel = inject('getModel') as any

const assignment_method_option_list = computed(() => {
  const option_list = [
    {
      label: t('common.custom'),
      value: 'custom',
    },
  ]
  if (getModel) {
    option_list.push({
      label: t('workflow.variable.Referencing'),
      value: 'ref_variables',
    })
  }
  return option_list
})

const model = computed(() => {
  if (getModel) {
    return getModel()
  } else {
    return null
  }
})

const nodeCascaderRef = ref<InstanceType<typeof NodeCascader>>()

const emit = defineEmits(['update:modelValue'])
const formValue = computed({
  set: (item) => {
    emit('update:modelValue', item)
  },
  get: () => {
    return props.modelValue
  }
})
watch(
  () => formValue.value.minlength,
  () => {
    if (formValue.value.minlength > formValue.value.maxlength) {
      formValue.value.maxlength = formValue.value.minlength
    }
  }
)
watch(
  () => formValue.value.default_value_assignment_method,
  (newMethod, oldMethod) => {
    if (oldMethod && newMethod !== oldMethod) {
      formValue.value.default_value = newMethod === 'custom' ? '' : []
    }
  }
)

const default_ref_variables_value_rule = {
  required: true,
  validator: (rule: any, value: any, callback: any) => {
    if (!(Array.isArray(value) && value.length > 1)) {
      callback(t('workflow.variable.Referencing') + t('common.required'))
    }
    return true
  },
  trigger: 'blur',
}

const getData = () => {
  return {
    input_type: 'TextInput',
    attrs: {
      maxlength: formValue.value.maxlength,
      minlength: formValue.value.minlength,
      'show-word-limit': true
    },
    default_value: formValue.value.default_value,
    show_default_value: formValue.value.show_default_value,
    default_value_assignment_method: formValue.value.default_value_assignment_method || 'custom',
    props_info: {
      rules: formValue.value.required
        ? [
            { required: true, message: `${formValue.value.label} ${t('dynamicsForm.default.requiredMessage')}` },
            {
              min: formValue.value.minlength,
              max: formValue.value.maxlength,
              message: `${formValue.value.label}${t('dynamicsForm.TextInput.length.requiredMessage1')} ${formValue.value.minlength} ${t('dynamicsForm.TextInput.length.requiredMessage2')} ${formValue.value.maxlength} ${t('dynamicsForm.TextInput.length.requiredMessage3')}`,
              trigger: 'blur'
            }
          ]
        : [
            {
              min: formValue.value.minlength,
              max: formValue.value.maxlength,
              message: `${formValue.value.label}${t('dynamicsForm.TextInput.length.requiredMessage1')} ${formValue.value.minlength} ${t('dynamicsForm.TextInput.length.requiredMessage2')} ${formValue.value.maxlength} ${t('dynamicsForm.TextInput.length.requiredMessage3')}`,
              trigger: 'blur'
            }
          ]
    }
  }
}
const rander = (form_data: any) => {
  const attrs = form_data.attrs || {}
  formValue.value.minlength = attrs.minlength
  formValue.value.maxlength = attrs.maxlength
  formValue.value.default_value = form_data.default_value
  formValue.value.show_default_value = form_data.show_default_value
  formValue.value.default_value_assignment_method =
    form_data.default_value_assignment_method || 'custom'
}
const rangeRules = [
  {
    required: true,
    validator: (rule: any, value: any, callback: any) => {
      if (!formValue.value.minlength) {
        callback(new Error(t('dynamicsForm.TextInput.length.requiredMessage4')))
      }
      if (!formValue.value.maxlength) {
        callback(new Error(t('dynamicsForm.TextInput.length.requiredMessage4')))
      }
      return true
    },
    message: `${formValue.value.label} ${t('dynamicsForm.default.requiredMessage')}`
  }
]
const rules = computed(() => [
  {
    min: formValue.value.minlength,
    max: formValue.value.maxlength,
    message: `${t('dynamicsForm.TextInput.length.requiredMessage1')} ${formValue.value.minlength} ${t('dynamicsForm.TextInput.length.requiredMessage2')} ${formValue.value.maxlength} ${t('dynamicsForm.TextInput.length.requiredMessage3')}`,
    trigger: 'blur'
  }
])

defineExpose({ getData, rander })
onMounted(() => {
  formValue.value.minlength = 0
  formValue.value.maxlength = 200
  if (formValue.value.default_value_assignment_method === undefined) {
    formValue.value.default_value_assignment_method = 'custom'
    formValue.value.default_value = ''
  }
  if (formValue.value.show_default_value === undefined) {
    formValue.value.show_default_value = true
  }
})
</script>
<style lang="scss" scoped>
.defaultValueItem {
  position: relative;
  .defaultValueCheckbox {
    position: absolute;
    right: 0;
    top: -35px;
  }
}
</style>
