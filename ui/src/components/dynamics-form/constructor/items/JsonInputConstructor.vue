<template>
  <el-form-item v-if="getModel">
    <template #label>
      <div class="flex-between">
        {{ $t('dynamicsForm.AssignmentMethod.label', '赋值方式') }}
      </div>
    </template>

    <el-row style="width: 100%" :gutter="10">
      <el-radio-group v-model="formValue.default_value_assignment_method">
        <el-radio :value="item.value" size="large" v-for="item in assignment_method_option_list"
          >{{ item.label }}
          <el-popover
            width="300px"
            v-if="item.value == 'ref_variables'"
            class="box-item"
            placement="top-start"
          >
            {{ $t('dynamicsForm.AssignmentMethod.ref_variables.popover') }}:
            {{ $t('dynamicsForm.AssignmentMethod.ref_variables.json_format') }}

            <template #reference>
              <el-icon><InfoFilled /></el-icon>
            </template>
          </el-popover>
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
    class="defaultValueItem"
    :label="$t('dynamicsForm.default.label')"
    :required="formValue.required"
    v-if="formValue.default_value_assignment_method == 'custom'"
    prop="default_value"
    :rules="[default_value_rule]"
  >
    <div class="defaultValueCheckbox">
      <el-checkbox
        v-model="formValue.show_default_value"
        :label="$t('dynamicsForm.default.show')"
      />
    </div>
    <JsonInput ref="jsonInputRef" v-model="formValue.default_value"> </JsonInput>
  </el-form-item>
  <el-form-item label="JSON 展示方式">
    <el-radio-group v-model="formValue.json_display_mode">
      <el-radio value="codemirror">CodeMirror</el-radio>
      <el-radio value="structured">展示规则</el-radio>
    </el-radio-group>
  </el-form-item>
  <el-form-item v-if="formValue.json_display_mode === 'structured'" label="JSON 展示规则">
    <div class="jsonDisplayConfigActions">
      <el-button @click="openJsonDisplaySampleDialog">生成展示规则</el-button>
      <el-button
        v-if="structuredJsonDisplayConfig"
        @click="jsonDisplayConfigVisible = true"
      >
        编辑展示规则
      </el-button>
    </div>
  </el-form-item>
  <el-dialog
    v-model="jsonDisplayConfigVisible"
    title="JSON 展示规则"
    width="900px"
    append-to-body
  >
    <JsonDisplayConfigEditor
      v-if="structuredJsonDisplayConfig"
      v-model:fields="structuredJsonDisplayConfig.fields"
    />
    <template #footer>
      <el-button type="primary" @click="jsonDisplayConfigVisible = false">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
  <el-dialog
    v-model="jsonDisplaySampleVisible"
    title="示例 JSON"
    width="900px"
    append-to-body
    destroy-on-close
  >
    <JsonInput ref="jsonDisplaySampleRef" v-model="jsonDisplaySampleValue" />
    <template #footer>
      <el-button @click="jsonDisplaySampleVisible = false">
        {{ $t('common.cancel') }}
      </el-button>
      <el-button type="primary" @click="confirmGenerateJsonDisplayConfig">
        {{ $t('common.confirm') }}
      </el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, inject, watch } from 'vue'
import { t } from '@/locales'
import NodeCascader from '@/workflow/common/NodeCascader.vue'
import JsonInput from '@/components/dynamics-form/items/JsonInput.vue'
import JsonDisplayConfigEditor from '@/components/dynamics-form/items/json-display/JsonDisplayConfigEditor.vue'
import { inferJsonDisplayConfig } from '@/components/dynamics-form/items/json-display/jsonDisplayInfer'
import {
  isStructuredJsonDisplayConfig,
  resolveJsonDisplayMode,
} from '@/components/dynamics-form/items/json-display/types'
import { MsgError } from '@/utils/message'
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
const emit = defineEmits(['update:modelValue'])
const formValue = computed({
  set: (item) => {
    emit('update:modelValue', item)
  },
  get: () => {
    return props.modelValue
  },
})
type JsonInputInstance = InstanceType<typeof JsonInput> & {
  getParsedValue: () => any
}

const jsonInputRef = ref<JsonInputInstance>()
const jsonDisplayConfigVisible = ref<boolean>(false)
const jsonDisplaySampleVisible = ref<boolean>(false)
const jsonDisplaySampleValue = ref<any>({})
const jsonDisplaySampleRef = ref<JsonInputInstance>()
const structuredJsonDisplayConfig = computed(() => {
  const config = formValue.value.json_display_config
  return isStructuredJsonDisplayConfig(config) ? config : undefined
})
const getData = () => {
  return {
    input_type: 'JsonInput',
    attrs: {},
    props_info: {
      rules: [
        {
          required: formValue.value.required,
          validator: `validator = (rule, value, callback) => {
            return componentFormRef.value?.validate_rules(rule, value, callback);

}`,
          trigger: 'blur',
        },
      ],
    },
    default_value: formValue.value.default_value,
    show_default_value: formValue.value.show_default_value,
    default_value_assignment_method: formValue.value.default_value_assignment_method || 'custom',
    json_display_mode: resolveJsonDisplayMode(
      formValue.value.json_display_mode,
      formValue.value.json_display_config,
    ),
    json_display_config: isStructuredJsonDisplayConfig(formValue.value.json_display_config)
      ? formValue.value.json_display_config
      : undefined,
  }
}

const openJsonDisplaySampleDialog = () => {
  jsonDisplaySampleValue.value = {}
  jsonDisplaySampleVisible.value = true
}

const confirmGenerateJsonDisplayConfig = () => {
  try {
    if (!jsonDisplaySampleRef.value) {
      throw new Error('JsonInput is not ready')
    }
    const sampleValue = jsonDisplaySampleRef.value.getParsedValue()
    formValue.value.json_display_config = inferJsonDisplayConfig(sampleValue)
    formValue.value.json_display_mode = 'structured'
    jsonDisplaySampleVisible.value = false
    jsonDisplayConfigVisible.value = true
  } catch (e) {
    MsgError(t('dynamicsForm.tip.jsonMessage'))
  }
}

const default_value_rule = {
  required: true,
  validator: (rule: any, value: any, callback: any) => {
    jsonInputRef.value?.validate_rules(rule, value, callback)
    return true
  },
  trigger: 'blur',
}
const default_ref_variables_value_rule = {
  required: true,
  validator: (rule: any, value: any, callback: any) => {
    if (!(Array.isArray(value) && value.length > 1)) {
      callback(
        t('workflow.variable.Referencing') + t('common.required'),
      )
    }

    return true
  },
  trigger: 'blur',
}

const rander = (form_data: any) => {
  formValue.value.default_value = form_data.default_value
  formValue.value.json_display_config = isStructuredJsonDisplayConfig(form_data.json_display_config)
    ? form_data.json_display_config
    : undefined
  formValue.value.json_display_mode = resolveJsonDisplayMode(
    form_data.json_display_mode,
    formValue.value.json_display_config,
  )
  formValue.value.default_value_assignment_method =
    form_data.default_value_assignment_method || 'custom'
}
defineExpose({ getData, rander })
onMounted(() => {
  formValue.value.default_value = {}
  formValue.value.default_value_assignment_method = 'custom'
  formValue.value.json_display_mode = resolveJsonDisplayMode(
    formValue.value.json_display_mode,
    formValue.value.json_display_config,
  )
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
.jsonDisplayConfigActions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
