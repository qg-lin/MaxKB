<template>
  <div class="hitl-card">
    <div v-if="setting.title" class="hitl-title">{{ setting.title }}</div>
    <MdPreview
      v-if="setting.content"
      editorId="hitl-content"
      :modelValue="setting.content"
      class="maxkb-md mb-8"
    />

    <template v-if="setting.mode === 'confirmation'">
      <el-input
        v-if="setting.allow_comment"
        v-model="comment"
        type="textarea"
        :rows="2"
        class="mb-8"
        :disabled="isDisabled"
      />
      <el-space wrap>
        <el-button
          v-for="action in setting.actions"
          :key="action.value"
          :disabled="isDisabled"
          :type="action.value === 'confirm' ? 'primary' : 'default'"
          @click="submit(action.value)"
        >
          {{ action.label || action.value }}
        </el-button>
      </el-space>
    </template>

    <template v-else>
      <el-input
        v-model="userInput"
        type="textarea"
        :rows="3"
        :placeholder="setting.placeholder"
        class="mb-8"
        :disabled="isDisabled"
      />
      <el-button
        type="primary"
        :disabled="isDisabled || !userInput.trim()"
        @click="submit('submit')"
      >
        {{ setting.submit_label || $t('common.submit') }}
      </el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import MdPreview from './MdPreview.vue'

type HumanAction = {
  value: string
  label?: string
}

type HumanInteractionSetting = {
  mode?: 'confirmation' | 'text'
  runtime_node_id?: string
  chat_record_id?: string
  payload?: {
    runtime_node_id?: string
    chat_record_id?: string
  }
  title?: string
  content?: string
  actions?: HumanAction[]
  placeholder?: string
  submit_label?: string
  allow_comment?: boolean
  submitted?: boolean
}

const props = withDefaults(
  defineProps<{
    interaction_setting: string
    disabled?: boolean
    sendMessage?: (question: string, type: 'old' | 'new', other_params_data?: any) => void
    child_node?: any
    chat_record_id?: string
    runtime_node_id?: string
  }>(),
  {
    disabled: false,
  },
)

const submitted = ref(false)
const userInput = ref('')
const comment = ref('')

const setting = computed<HumanInteractionSetting>(() => {
  try {
    const value = props.interaction_setting ? JSON.parse(props.interaction_setting) : {}
    return {
      mode: value.mode === 'text' ? 'text' : 'confirmation',
      runtime_node_id: value.runtime_node_id,
      chat_record_id: value.chat_record_id,
      payload: value.payload || {},
      title: value.title || '',
      content: value.content || '',
      actions: Array.isArray(value.actions) ? value.actions : [],
      placeholder: value.placeholder || '',
      submit_label: value.submit_label || '',
      allow_comment: !!value.allow_comment,
      submitted: !!value.submitted,
    }
  } catch {
    return {
      mode: 'confirmation',
      title: '',
      content: '',
      payload: {},
      actions: [],
      placeholder: '',
      submit_label: '',
      allow_comment: false,
      submitted: false,
    }
  }
})

const isDisabled = computed(() => submitted.value || props.disabled || setting.value.submitted)

function submit(action: string) {
  if (isDisabled.value) {
    return
  }
  submitted.value = true
  props.sendMessage?.('', 'old', {
    child_node: props.child_node,
    runtime_node_id:
      props.runtime_node_id || setting.value.runtime_node_id || setting.value.payload?.runtime_node_id,
    chat_record_id:
      props.chat_record_id || setting.value.chat_record_id || setting.value.payload?.chat_record_id,
    node_data: {
      interaction_type: 'human_in_the_loop',
      action,
      user_input: userInput.value,
      comment: comment.value,
      payload: {},
    },
  })
}
</script>

<style lang="scss" scoped>
.hitl-card {
  padding: 12px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-fill-color-blank);
}

.hitl-title {
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}
</style>
