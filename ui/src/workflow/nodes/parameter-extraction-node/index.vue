<template>
  <NodeContainer :nodeModel="nodeModel">
    <h5 class="title-decoration-1 mb-8">{{ $t('workflow.nodeSetting') }}</h5>
    <el-card shadow="never" class="card-never" style="--el-card-padding: 12px">
      <el-form
        @submit.prevent
        :model="form_data"
        label-position="top"
        require-asterisk-position="right"
        label-width="auto"
        ref="VariableSplittingRef"
        hide-required-asterisk
      >
        <el-form-item
          :label="$t('views.application.form.aiModel.label')"
          prop="model_id"
          :rules="{
            required: true,
            message: $t('views.application.form.aiModel.placeholder'),
            trigger: 'change',
          }"
        >
          <template #label>
            <div class="flex-between w-full">
              <div>
                <span
                  >{{ $t('views.application.form.aiModel.label')
                  }}<span class="color-danger ml-4">*</span></span
                >
              </div>

              <el-button
                :disabled="!form_data.model_id"
                type="primary"
                link
                @click="openAIParamSettingDialog(form_data.model_id)"
                @refreshForm="refreshParam"
              >
                <AppIcon iconName="app-setting"></AppIcon>
              </el-button>
            </div>
          </template>
          <ModelSelect
            @change="model_change"
            @wheel="wheel"
            :teleported="false"
            v-model="form_data.model_id"
            :placeholder="$t('views.application.form.aiModel.placeholder')"
            :options="modelOptions"
            @submitModel="getSelectModel"
            showFooter
            :model-type="'LLM'"
          ></ModelSelect>
        </el-form-item>
        <el-form-item
          prop="input_variable"
          :rules="{
            message: $t('workflow.variable.placeholder'),
            trigger: 'blur',
            required: true,
          }"
        >
          <template #label>
            <div class="flex-between">
              <div>
                {{ $t('workflow.nodes.variableSplittingNode.inputVariables') }}
                <span class="color-danger">*</span>
              </div>
            </div>
          </template>
          <NodeCascader
            ref="nodeCascaderRef"
            :nodeModel="nodeModel"
            class="w-full"
            :placeholder="$t('workflow.variable.placeholder')"
            v-model="form_data.input_variable"
          />
        </el-form-item>
        <!-- 提示词配置区域 -->
        <el-form-item>
          <template #label>
            <span>{{ $t('workflow.nodes.parameterExtractionNode.prompt.label') }}</span>
          </template>
          <div class="w-full">
            <el-radio-group v-model="form_data.prompt_type" class="mb-8">
              <el-radio value="system">
                {{ $t('workflow.nodes.parameterExtractionNode.prompt.systemDefault') }}
              </el-radio>
              <el-radio value="custom">
                {{ $t('workflow.nodes.parameterExtractionNode.prompt.custom') }}
              </el-radio>
            </el-radio-group>
            <!-- 系统默认：只读展示 -->
            <el-input
              v-if="form_data.prompt_type !== 'custom'"
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 8 }"
              :model-value="DEFAULT_SYSTEM_PROMPT"
              disabled
            />
            <!-- 自定义：可编辑 -->
            <el-input
              v-else
              type="textarea"
              :autosize="{ minRows: 4, maxRows: 12 }"
              v-model="form_data.custom_prompt"
              :placeholder="$t('workflow.nodes.parameterExtractionNode.prompt.placeholder')"
            />
          </div>
        </el-form-item>
        <el-form-item
          prop="variable_list"
          :rules="{
            message: $t(
              'workflow.nodes.parameterExtractionNode.extractParameters.variableListPlaceholder',
            ),
            trigger: 'blur',
            required: true,
          }"
        >
          <ParametersFieldTable
            ref="ParametersFieldTableRef"
            :node-model="nodeModel"
          ></ParametersFieldTable>
        </el-form-item>
      </el-form>
    </el-card>
    <AIModeParamSettingDialog ref="AIModeParamSettingDialogRef" @refresh="refreshParam" />
  </NodeContainer>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, inject, watch } from 'vue'
import NodeContainer from '@/workflow/common/NodeContainer.vue'
import NodeCascader from '@/workflow/common/NodeCascader.vue'
import AIModeParamSettingDialog from '@/views/application/component/AIModeParamSettingDialog.vue'
import ParametersFieldTable from '@/workflow/nodes/parameter-extraction-node/component/ParametersFieldTable.vue'
import { useRoute } from 'vue-router'
import { loadSharedApi } from '@/utils/dynamics-api/shared-api'
import { set, groupBy } from 'lodash'
const getResourceDetail = inject('getResourceDetail') as any
const props = defineProps<{ nodeModel: any }>()
const AIModeParamSettingDialogRef = ref<InstanceType<typeof AIModeParamSettingDialog>>()
const route = useRoute()
const {
  params: { id },
} = route as any
const openAIParamSettingDialog = (modelId: string) => {
  if (modelId) {
    AIModeParamSettingDialogRef.value?.open(modelId, id, form_data.value.model_params_setting)
  }
}
function refreshParam(data: any) {
  set(props.nodeModel.properties.node_data, 'model_params_setting', data)
}
const resource = getResourceDetail()
const modelOptions = ref<any>(null)
const wheel = (e: any) => {
  if (e.ctrlKey === true) {
    e.preventDefault()
    return true
  } else {
    e.stopPropagation()
    return true
  }
}
const apiType = computed(() => {
  if (route.path.includes('resource-management')) {
    return 'systemManage'
  } else if (route.path.includes('shared')) {
    return 'systemShare'
  } else {
    return 'workspace'
  }
})
function getSelectModel() {
  const obj =
    apiType.value === 'systemManage'
      ? {
          model_type: 'LLM',
          workspace_id: resource.value?.workspace_id,
        }
      : {
          model_type: 'LLM',
        }
  loadSharedApi({ type: 'model', systemType: apiType.value })
    .getSelectModelList(obj)
    .then((res: any) => {
      modelOptions.value = groupBy(res?.data, 'provider')
    })
}

const DEFAULT_SYSTEM_PROMPT = `Please strictly process the text according to the following requirements:
**Task**:
Extract specified field information from given text

**Enter text**:
{{question}}

**Extract configuration**:
{{properties}}

**Rule**:
- Strictly follow the data and field of Extract configuration
- If not found, use null value
- Only return pure JSON without additional text
- Keep the string format neat`

const form = {
  input_variable: [],
  model_params_setting: {},
  model_id: '',
  variable_list: [],
  prompt_type: 'system',
  custom_prompt: '',
}

const form_data = computed({
  get: () => {
    if (props.nodeModel.properties.node_data) {
      return props.nodeModel.properties.node_data
    } else {
      set(props.nodeModel.properties, 'node_data', form)
    }
    return props.nodeModel.properties.node_data
  },
  set: (value) => {
    set(props.nodeModel.properties, 'node_data', value)
  },
})

const model_change = (model_id?: string) => {
  if (model_id) {
    AIModeParamSettingDialogRef.value?.reset_default(model_id, id)
  } else {
    refreshParam({})
  }
}

const VariableSplittingRef = ref()
const validate = async () => {
  return VariableSplittingRef.value.validate().catch((err: any) => {
    return Promise.reject({ node: props.nodeModel, errMessage: err })
  })
}

onMounted(() => {
  getSelectModel()
  set(props.nodeModel, 'validate', validate)
  if (props.nodeModel.properties.node_data && !props.nodeModel.properties.node_data.prompt_type) {
    set(props.nodeModel.properties.node_data, 'prompt_type', 'system')
  }
})

watch(
  () => form_data.value.prompt_type,
  (newVal) => {
    if (newVal === 'custom' && !form_data.value.custom_prompt) {
      set(props.nodeModel.properties.node_data, 'custom_prompt', DEFAULT_SYSTEM_PROMPT)
    }
  },
)
</script>
<style lang="scss" scoped></style>
