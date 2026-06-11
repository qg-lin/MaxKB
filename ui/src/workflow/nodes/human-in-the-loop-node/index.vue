<template>
  <NodeContainer :nodeModel="nodeModel">
    <el-card shadow="never" class="card-never" style="--el-card-padding: 12px">
      <el-form
        @submit.prevent
        :model="form_data"
        label-position="top"
        require-asterisk-position="right"
        label-width="auto"
        ref="humanInTheLoopNodeFormRef"
        hide-required-asterisk
      >
        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.mode.label')">
          <el-radio-group v-model="form_data.mode" @change="handleModeChange">
            <el-radio-button label="confirmation">
              {{ $t('workflow.nodes.humanInTheLoopNode.mode.confirmation') }}
            </el-radio-button>
            <el-radio-button label="text">
              {{ $t('workflow.nodes.humanInTheLoopNode.mode.text') }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.title')">
          <el-input
            v-model="form_data.title"
            :placeholder="$t('workflow.nodes.humanInTheLoopNode.title')"
          />
        </el-form-item>

        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.content')">
          <MdEditorMagnify
            :title="$t('workflow.nodes.humanInTheLoopNode.content')"
            v-model="form_data.content"
            style="height: 150px"
            @submitDialog="submitDialog"
          />
        </el-form-item>

        <el-form-item
          v-if="form_data.mode === 'confirmation'"
          :label="$t('workflow.nodes.humanInTheLoopNode.actions.label')"
          @click.prevent
        >
          <template #label>
            <div class="flex-between">
              <h5 class="lighter">
                {{ $t('workflow.nodes.humanInTheLoopNode.actions.label') }}
              </h5>
              <el-button link type="primary" @click="addAction">
                <AppIcon iconName="app-add-outlined" class="mr-4"></AppIcon>
                {{ $t('common.add') }}
              </el-button>
            </div>
          </template>

          <div ref="actionListRef" class="action-list w-full">
            <div
              v-for="(action, index) in form_data.actions"
              :key="index"
              v-resize="resizeActionAnchors"
              class="action-row"
            >
              <el-form-item
                class="action-field"
                :prop="`actions.${index}.label`"
                :rules="{
                  required: true,
                  message: $t('workflow.nodes.humanInTheLoopNode.actions.labelRequired'),
                  trigger: 'blur',
                }"
              >
                <el-input
                  v-model="action.label"
                  :placeholder="$t('workflow.nodes.humanInTheLoopNode.actions.actionLabel')"
                />
              </el-form-item>
              <el-form-item
                class="action-field"
                :prop="`actions.${index}.value`"
                :rules="{
                  required: true,
                  message: $t('workflow.nodes.humanInTheLoopNode.actions.valueRequired'),
                  trigger: 'blur',
                }"
              >
                <el-input
                  v-model="action.value"
                  :placeholder="$t('workflow.nodes.humanInTheLoopNode.actions.actionValue')"
                  @input="refreshBranch"
                />
              </el-form-item>
              <el-form-item class="action-field">
                <el-input
                  v-model="action.branch_id"
                  :placeholder="$t('workflow.nodes.humanInTheLoopNode.actions.branchId')"
                  @input="refreshBranch"
                />
              </el-form-item>
              <el-tooltip effect="dark" :content="$t('common.delete')" placement="top">
                <el-button text type="primary" @click="deleteAction(index)">
                  <AppIcon iconName="app-delete"></AppIcon>
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </el-form-item>

        <template v-if="form_data.mode === 'text'">
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.placeholder')">
            <el-input
              v-model="form_data.placeholder"
              :placeholder="$t('workflow.nodes.humanInTheLoopNode.placeholder')"
            />
          </el-form-item>
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.submitLabel')">
            <el-input
              v-model="form_data.submit_label"
              :placeholder="$t('workflow.nodes.humanInTheLoopNode.submitLabel')"
            />
          </el-form-item>
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.branchId')">
            <el-input
              v-model="form_data.branch_id"
              :placeholder="$t('workflow.nodes.humanInTheLoopNode.branchId')"
              @input="refreshBranch"
            />
          </el-form-item>
        </template>

        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.allowComment')" @click.prevent>
          <el-switch size="small" v-model="form_data.allow_comment" />
        </el-form-item>

        <el-form-item
          v-if="[WorkflowMode.Application, WorkflowMode.ApplicationLoop].includes(workflowMode)"
          :label="$t('workflow.nodes.aiChatNode.returnContent.label')"
          @click.prevent
        >
          <template #label>
            <div class="flex align-center">
              <div class="mr-4">
                <span>{{ $t('workflow.nodes.aiChatNode.returnContent.label') }}</span>
              </div>
              <el-tooltip effect="dark" placement="right" popper-class="max-w-200">
                <template #content>
                  {{ $t('workflow.nodes.aiChatNode.returnContent.tooltip') }}
                </template>
                <AppIcon iconName="app-warning" class="app-warning-icon"></AppIcon>
              </el-tooltip>
            </div>
          </template>
          <el-switch size="small" v-model="form_data.is_result" />
        </el-form-item>
      </el-form>
    </el-card>
  </NodeContainer>
</template>

<script setup lang="ts">
import { cloneDeep, set } from 'lodash'
import { computed, inject, nextTick, onMounted, ref } from 'vue'
import { type FormInstance } from 'element-plus'
import NodeContainer from '@/workflow/common/NodeContainer.vue'
import { isLastNode } from '@/workflow/common/data'
import { WorkflowMode } from '@/enums/application'
import { t } from '@/locales'

const workflowMode = (inject('workflowMode') as WorkflowMode) || WorkflowMode.Application
const props = defineProps<{ nodeModel: any }>()

const defaultForm = {
  mode: 'confirmation',
  title: '',
  content: '',
  actions: [
    { value: 'confirm', label: t('common.confirm'), branch_id: 'confirm' },
    { value: 'reject', label: t('workflow.nodes.humanInTheLoopNode.reject'), branch_id: 'reject' },
  ],
  placeholder: '',
  submit_label: t('common.submit'),
  allow_comment: false,
  branch_id: 'submit',
  is_result: true,
}

const humanInTheLoopNodeFormRef = ref<FormInstance>()
const actionListRef = ref<HTMLElement>()

const getBranchId = (action: any) => action?.branch_id || action?.value || ''

const getNextActionValue = () => {
  const usedValues = new Set(
    form_data.value.actions
      .map((action: any) => getBranchId(action))
      .filter((branchId: string) => branchId),
  )
  let index = form_data.value.actions.length + 1
  while (usedValues.has(`option_${index}`)) {
    index += 1
  }
  return `option_${index}`
}

const ensureNodeData = () => {
  if (!props.nodeModel.properties.node_data) {
    set(props.nodeModel.properties, 'node_data', cloneDeep(defaultForm))
  }
  const nodeData = props.nodeModel.properties.node_data
  Object.entries(defaultForm).forEach(([key, value]) => {
    if (typeof nodeData[key] === 'undefined') {
      set(nodeData, key, cloneDeep(value))
    }
  })
  if (!Array.isArray(nodeData.actions)) {
    set(nodeData, 'actions', cloneDeep(defaultForm.actions))
  }
  if (!nodeData.submit_label) {
    set(nodeData, 'submit_label', t('common.submit'))
  }
  if (!nodeData.branch_id) {
    set(nodeData, 'branch_id', 'submit')
  }
  return nodeData
}

const form_data = computed({
  get: () => {
    return ensureNodeData()
  },
  set: (value) => {
    set(props.nodeModel.properties, 'node_data', value)
  },
})

function submitDialog(val: string) {
  set(props.nodeModel.properties.node_data, 'content', val)
}

function addAction() {
  const actionValue = getNextActionValue()
  form_data.value.actions.push({
    label: '',
    value: actionValue,
    branch_id: actionValue,
  })
  refreshBranch()
}

function deleteAction(index: number) {
  form_data.value.actions.splice(index, 1)
  refreshBranch()
}

function handleModeChange(mode: string | number | boolean | undefined) {
  if (mode === 'confirmation' && form_data.value.actions.length === 0) {
    form_data.value.actions = cloneDeep(defaultForm.actions)
  }
  refreshBranch()
}

function syncActionAnchors() {
  if (form_data.value.mode !== 'confirmation') {
    set(props.nodeModel.properties, 'action_anchor_list', [])
    return false
  }
  const actionListElement = actionListRef.value
  const nodeElement = actionListElement?.closest('.workflow-node-container')
  if (!actionListElement || !nodeElement) {
    return false
  }
  const nodeRect = nodeElement.getBoundingClientRect()
  const modelWidth = props.nodeModel.width || props.nodeModel.properties.width || nodeRect.width
  const scale = nodeRect.width / modelWidth || 1
  const actionAnchors = Array.from(actionListElement.querySelectorAll<HTMLElement>('.action-row'))
    .map((row, index) => {
      const rowRect = row.getBoundingClientRect()
      const action = form_data.value.actions[index]
      const branchId = getBranchId(action)
      if (!branchId) {
        return null
      }
      return {
        index,
        branch_id: branchId,
        anchor_top: Math.round(((rowRect.top - nodeRect.top + rowRect.height / 2) / scale) * 10) / 10,
        height: Math.round((rowRect.height / scale) * 10) / 10,
      }
    })
    .filter((item) => item)
  const oldActionAnchors = props.nodeModel.properties.action_anchor_list || []
  if (JSON.stringify(oldActionAnchors) === JSON.stringify(actionAnchors)) {
    return false
  }
  set(props.nodeModel.properties, 'action_anchor_list', actionAnchors)
  return true
}

let resizeActionAnchorTimer: number | undefined

function resizeActionAnchors() {
  if (resizeActionAnchorTimer) {
    window.cancelAnimationFrame(resizeActionAnchorTimer)
  }
  resizeActionAnchorTimer = window.requestAnimationFrame(() => {
    resizeActionAnchorTimer = undefined
    nextTick(() => {
      if (syncActionAnchors()) {
        props.nodeModel.refreshBranch()
      }
    })
  })
}

function refreshBranch() {
  nextTick(() => {
    syncActionAnchors()
    const validAnchorIds = props.nodeModel
      .getDefaultAnchor()
      .filter((anchor: any) => anchor.type === 'right')
      .map((anchor: any) => anchor.id)

    const staleEdgeIds = (props.nodeModel.outgoing?.edges || [])
      .filter((edge: any) => !validAnchorIds.includes(edge.sourceAnchorId))
      .map((edge: any) => edge.id)

    if (staleEdgeIds.length > 0) {
      props.nodeModel.graphModel.eventCenter.emit('delete_edge', staleEdgeIds)
    }
    props.nodeModel.refreshBranch()
  })
}

const validate = () => {
  if (form_data.value.mode === 'confirmation' && form_data.value.actions.length === 0) {
    return Promise.reject({
      node: props.nodeModel,
      errMessage: t('workflow.nodes.humanInTheLoopNode.actions.requiredMessage'),
    })
  }
  return humanInTheLoopNodeFormRef.value?.validate().catch((err: any) => {
    return Promise.reject({ node: props.nodeModel, errMessage: err })
  })
}

onMounted(() => {
  if (typeof props.nodeModel.properties.node_data?.is_result === 'undefined') {
    if (isLastNode(props.nodeModel)) {
      set(props.nodeModel.properties.node_data, 'is_result', true)
    }
  }
  set(props.nodeModel, 'validate', validate)
  resizeActionAnchors()
})
</script>

<style lang="scss" scoped>
.action-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 32px;
  gap: 8px;
  align-items: flex-start;
}

.action-field {
  margin-bottom: 0;
}
</style>
