<template>
  <div class="json-display-config-editor">
    <el-table :data="fields" border size="small" row-key="path">
      <el-table-column prop="path" label="JSON 路径" min-width="180" />
      <el-table-column label="展示名称" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.label" />
        </template>
      </el-table-column>
      <el-table-column label="值类型" width="150">
        <template #default="{ row }">
          <el-select v-model="row.valueType">
            <el-option
              v-for="item in jsonDisplayValueTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="显示" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.visible" />
        </template>
      </el-table-column>
      <el-table-column label="可编辑" width="100">
        <template #default="{ row }">
          <el-switch v-model="row.editable" />
        </template>
      </el-table-column>
      <el-table-column label="候选值" width="150">
        <template #default="{ row }">
          <el-button
            v-if="isSelectField(row)"
            link
            type="primary"
            @click="openOptionDialog(row)"
          >
            配置候选值({{ row.option_list?.length || 0 }})
          </el-button>
          <span v-else class="json-display-config-editor__muted">-</span>
        </template>
      </el-table-column>
    </el-table>

    <template v-for="field in fields" :key="`${field.path}-children`">
      <el-collapse v-if="field.children?.length" class="mt-12">
        <el-collapse-item :title="`${field.label || field.key} 子配置`" :name="field.path">
          <JsonDisplayConfigEditor v-model:fields="field.children" />
        </el-collapse-item>
      </el-collapse>
    </template>

    <el-dialog
      v-model="optionDialogVisible"
      title="候选值"
      width="760px"
      append-to-body
    >
      <div v-if="currentOptionField" class="json-display-config-editor__option-actions">
        <span>总计 {{ currentOptionField.option_list?.length || 0 }}</span>
        <el-button link type="primary" @click="addOption">添加</el-button>
        <el-button link type="primary" @click="importCsv">导入 CSV</el-button>
      </div>
      <OptionListEditor
        v-if="currentOptionField"
        ref="optionEditorRef"
        :model-value="currentOptionField.option_list || []"
        label-header="标签"
        value-header="选项值"
        label-placeholder="请输入选项标签"
        value-placeholder="请输入选项值"
        @delete="deleteOption"
      />
      <template #footer>
        <el-button type="primary" @click="optionDialogVisible = false">确认</el-button>
      </template>
    </el-dialog>
    <input
      ref="csvInputRef"
      type="file"
      accept=".csv"
      style="display: none"
      @change="handleCsvFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { JsonDisplayField } from './types'
import { jsonDisplayValueTypeOptions } from './types'
import OptionListEditor from '@/components/dynamics-form/constructor/items/OptionListEditor.vue'
import { parseCsv } from '@/api/form-node'

const props = defineProps<{
  fields: JsonDisplayField[]
}>()

const emit = defineEmits<{
  'update:fields': [value: JsonDisplayField[]]
}>()

const fields = computed({
  get: () => props.fields,
  set: (value) => emit('update:fields', value),
})

const optionDialogVisible = ref(false)
const currentOptionField = ref<JsonDisplayField>()
const optionEditorRef = ref<InstanceType<typeof OptionListEditor>>()
const csvInputRef = ref<HTMLInputElement>()

const isSelectField = (field: JsonDisplayField) =>
  field.valueType === 'single_select' ||
  field.valueType === 'multi_select' ||
  field.valueType === 'array_value'

const ensureOptionList = (field: JsonDisplayField) => {
  if (!field.option_list) {
    field.option_list = []
  }
  return field.option_list
}

const openOptionDialog = (field: JsonDisplayField) => {
  ensureOptionList(field)
  currentOptionField.value = field
  optionDialogVisible.value = true
}

const addOption = () => {
  if (!currentOptionField.value) return
  const optionList = ensureOptionList(currentOptionField.value)
  optionList.push({ label: '', value: '' })
  requestAnimationFrame(() => {
    optionEditorRef.value?.scrollToIndex(optionList.length - 1)
  })
}

const deleteOption = (index: number) => {
  currentOptionField.value?.option_list?.splice(index, 1)
}

const importCsv = () => {
  csvInputRef.value?.click()
}

const handleCsvFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !currentOptionField.value) return

  try {
    const res = await parseCsv(file)
    if (res.data && Array.isArray(res.data)) {
      const optionList = ensureOptionList(currentOptionField.value)
      const existingValues = new Set(optionList.map((option) => option.value))
      const newOptions = res.data.filter((option: any) => !existingValues.has(option.value))
      currentOptionField.value.option_list = [...optionList, ...newOptions]
      ElMessage.success(`成功导入${newOptions.length}个候选值`)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }

  if (csvInputRef.value) {
    csvInputRef.value.value = ''
  }
}
</script>

<style lang="scss" scoped>
.json-display-config-editor {
  width: 100%;
}
.json-display-config-editor__muted {
  color: var(--el-text-color-placeholder);
}
.json-display-config-editor__option-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
</style>
