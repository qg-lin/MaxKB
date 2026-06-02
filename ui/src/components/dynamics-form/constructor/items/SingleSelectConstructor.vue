<template>
  <el-form-item v-if="getModel">
    <template #label>
      <div class="flex-between">
        {{ $t('dynamicsForm.AssignmentMethod.label', '赋值方式') }}
      </div>
    </template>

    <el-row style="width: 100%" :gutter="10">
      <el-radio-group @change="formValue.option_list = []" v-model="formValue.assignment_method">
        <el-radio :value="item.value" size="large" v-for="item in assignment_method_option_list"
          >{{ item.label }}
          <el-popover
            width="300px"
            v-if="item.value == 'ref_variables'"
            class="box-item"
            placement="top-start"
          >
            {{ $t('dynamicsForm.AssignmentMethod.ref_variables.popover') }}:<br />
            [<br />
            {<br />
            "label": "xx",<br />
            "value": "xx",<br />
            "default": false<br />
            }<br />
            ]<br />
            label: {{ $t('dynamicsForm.AssignmentMethod.ref_variables.popover_label') }}
            {{ $t('common.required') }}<br />
            value: {{ $t('dynamicsForm.AssignmentMethod.ref_variables.popover_value') }}
            {{ $t('common.required') }}<br />
            default: {{ $t('dynamicsForm.AssignmentMethod.ref_variables.popover_default') }}
            <template #reference>
              <el-icon><InfoFilled /></el-icon>
            </template> </el-popover
        ></el-radio>
      </el-radio-group>
    </el-row>
    <el-row v-if="formValue.assignment_method == 'ref_variables'" style="width: 100%; margin-top: 12px" :gutter="10">
      <el-radio-group v-model="formValue.ref_variables_mode">
        <el-radio value="only" size="large">{{ $t('dynamicsForm.refVariablesMode.only', '纯引用变量') }}</el-radio>
        <el-radio value="with_candidates" size="large">{{ $t('dynamicsForm.refVariablesMode.withCandidates', '引用变量+候选值') }}</el-radio>
      </el-radio-group>
    </el-row>
  </el-form-item>
  <el-form-item
    v-if="formValue.assignment_method == 'ref_variables'"
    :required="true"
    prop="option_list"
    :rules="[default_ref_variables_value_rule]"
  >
    <NodeCascader
      ref="nodeCascaderRef"
      :nodeModel="model"
      class="w-full"
      :placeholder="$t('workflow.variable.placeholder')"
      v-model="formValue.option_list"
    />
  </el-form-item>
  <el-form-item v-if="formValue.assignment_method == 'ref_variables' && formValue.ref_variables_mode == 'with_candidates'">
    <template #label>
      <div class="flex-between">
        {{ $t('dynamicsForm.candidate.label', '候选值') }}<span class="candidate-count">(总计 {{ formValue.candidate_list?.length || 0 }})</span>
        <el-button link type="primary" @click.stop="addCandidate()">
          <AppIcon iconName="app-add-outlined" class="mr-4"></AppIcon>
          {{ $t('common.add') }}
        </el-button>
        <el-button link type="primary" @click.stop="importCandidateCsv()">
          <AppIcon iconName="app-import" class="mr-4"></AppIcon>
          {{ $t('dynamicsForm.Select.importCsv') }}
        </el-button>
      </div>
    </template>

    <el-row style="width: 100%" :gutter="10">
      <el-col :span="10">
        {{ $t('dynamicsForm.tag.label') }}
      </el-col>
      <el-col :span="12">
        {{ $t('dynamicsForm.Select.label') }}
      </el-col>
    </el-row>
    <el-row
      style="width: 100%"
      v-for="(option, $index) in displayedCandidates"
      :key="$index"
      :gutter="10"
      class="mb-8"
    >
      <el-col :span="10">
        <el-input
          v-model="formValue.candidate_list[$index].label"
          :placeholder="$t('dynamicsForm.tag.placeholder')"
        />
      </el-col>
      <el-col :span="12">
        <el-input
          v-model="formValue.candidate_list[$index].value"
          :placeholder="$t('dynamicsForm.Select.label')"
        />
      </el-col>
      <el-col :span="1">
        <el-button link class="ml-8" @click.stop="delCandidate($index)">
          <AppIcon iconName="app-delete"></AppIcon>
        </el-button>
      </el-col>
    </el-row>
    <div v-if="hasMoreCandidates" class="load-more">
      <el-button link type="primary" @click.stop="loadMoreCandidates">
        点击加载更多
      </el-button>
    </div>
  </el-form-item>
  <el-form-item v-if="formValue.assignment_method == 'custom'">
    <template #label>
      <div class="flex-between">
        {{ $t('dynamicsForm.Select.label') }}
        <el-button link type="primary" @click.stop="addOption()">
          <AppIcon iconName="app-add-outlined" class="mr-4"></AppIcon>
          {{ $t('common.add') }}
        </el-button>
        <el-button link type="primary" @click.stop="importCsv()">
          <AppIcon iconName="app-import" class="mr-4"></AppIcon>
          {{ $t('dynamicsForm.Select.importCsv') }}
        </el-button>
      </div>
    </template>

    <el-row style="width: 100%" :gutter="10">
      <el-col :span="10">
        {{ $t('dynamicsForm.tag.label') }}
      </el-col>
      <el-col :span="12">
        {{ $t('dynamicsForm.Select.label') }}
      </el-col>
    </el-row>
    <el-row
      style="width: 100%"
      v-for="(option, $index) in displayedOptions"
      :key="$index"
      :gutter="10"
      class="mb-8"
    >
      <el-col :span="10">
        <el-input
          v-model="formValue.option_list[$index].label"
          :placeholder="$t('dynamicsForm.tag.placeholder')"
        />
      </el-col>
      <el-col :span="12">
        <el-input
          v-model="formValue.option_list[$index].value"
          :placeholder="$t('dynamicsForm.Select.label')"
        />
      </el-col>
      <el-col :span="1">
        <el-button link class="ml-8" @click.stop="delOption($index)">
          <AppIcon iconName="app-delete"></AppIcon>
        </el-button>
      </el-col>
    </el-row>
    <div v-if="hasMoreOptions" class="load-more">
      <el-button link type="primary" @click.stop="loadMoreOptions">
        点击加载更多
      </el-button>
    </div>
  </el-form-item>
  <el-form-item
    v-if="formValue.assignment_method == 'custom'"
    class="defaultValueItem"
    :required="formValue.required"
    prop="default_value"
    :label="$t('dynamicsForm.default.label')"
    :rules="
      formValue.required
        ? [
            {
              required: true,
              message: `${$t('dynamicsForm.default.label')}${$t('dynamicsForm.default.requiredMessage')}`,
            },
          ]
        : []
    "
  >
    <div class="defaultValueCheckbox">
      <el-checkbox
        v-model="formValue.show_default_value"
        :label="$t('dynamicsForm.default.show')"
      />
    </div>

    <el-select
      v-model="formValue.default_value"
      :teleported="false"
      popper-class="max-w-350"
    >
      <el-option
        v-for="(option, index) in formValue.option_list"
        :key="index"
        :label="option.label"
        :value="option.value"
      />
    </el-select>
  </el-form-item>
  <input
    ref="csvInputRef"
    type="file"
    accept=".csv"
    style="display: none"
    @change="handleCsvFileChange"
  />
  <input
    ref="candidateCsvInputRef"
    type="file"
    accept=".csv"
    style="display: none"
    @change="handleCandidateCsvFileChange"
  />
</template>
<script setup lang="ts">
import { computed, onMounted, inject, watch, ref } from 'vue'
import NodeCascader from '@/workflow/common/NodeCascader.vue'
import { t } from '@/locales'
import { parseCsv } from '@/api/form-node'
import { ElMessage } from 'element-plus'
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
const props = defineProps<{
  modelValue: any
}>()
const emit = defineEmits(['update:modelValue'])
const formValue = computed({
  set: (item) => {
    emit('update:modelValue', item)
  },
  get: () => {
    return props.modelValue
  },
})

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
const addOption = () => {
  formValue.value.option_list.push({ value: '', label: '' })
}

const delOption = (index: number) => {
  const option = formValue.value.option_list[index]
  if (option.value && formValue.value.default_value == option.value) {
    formValue.value.default_value = ''
  }
  formValue.value.option_list.splice(index, 1)
}

const addCandidate = () => {
  if (!formValue.value.candidate_list) {
    formValue.value.candidate_list = []
  }
  formValue.value.candidate_list.push({ value: '', label: '' })
}

const delCandidate = (index: number) => {
  formValue.value.candidate_list.splice(index, 1)
}

const csvInputRef = ref()
const candidateCsvInputRef = ref()
const existingOptionValues = computed(() => {
  const list = formValue.value.option_list || []
  return new Set(list.map(o => o.value))
})
const optionDisplayedCount = ref(20)
const candidateDisplayedCount = ref(20)

const displayedOptions = computed(() => {
  const list = formValue.value.option_list || []
  return list.slice(0, optionDisplayedCount.value)
})

const displayedCandidates = computed(() => {
  const list = formValue.value.candidate_list || []
  return list.slice(0, candidateDisplayedCount.value)
})

const hasMoreOptions = computed(() => {
  return (formValue.value.option_list?.length || 0) > optionDisplayedCount.value
})

const hasMoreCandidates = computed(() => {
  return (formValue.value.candidate_list?.length || 0) > candidateDisplayedCount.value
})

const loadMoreOptions = () => {
  optionDisplayedCount.value += 20
}

const loadMoreCandidates = () => {
  candidateDisplayedCount.value += 20
}
const existingCandidateValues = computed(() => {
  const list = formValue.value.candidate_list || []
  return new Set(list.map(o => o.value))
})

const importCsv = () => {
  csvInputRef.value?.click()
}

const importCandidateCsv = () => {
  candidateCsvInputRef.value?.click()
}

const handleCsvFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const res = await parseCsv(file)
    if (res.data && Array.isArray(res.data)) {
      const newOptions = res.data.filter(opt => !existingOptionValues.value.has(opt.value))
      formValue.value.option_list = [...(formValue.value.option_list || []), ...newOptions]
      ElMessage.success(`成功导入${newOptions.length}个选项`)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }
  // 清空input
  if (csvInputRef.value) {
    csvInputRef.value.value = ''
  }
}

const handleCandidateCsvFileChange = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  try {
    const res = await parseCsv(file)
    if (res.data && Array.isArray(res.data)) {
      const newOptions = res.data.filter(opt => !existingCandidateValues.value.has(opt.value))
      formValue.value.candidate_list = [...(formValue.value.candidate_list || []), ...newOptions]
      ElMessage.success(`成功导入${newOptions.length}个候选值`)
    }
  } catch (e: any) {
    ElMessage.error(e.message || '导入失败')
  }
  // 清空input
  if (candidateCsvInputRef.value) {
    candidateCsvInputRef.value.value = ''
  }
}

const getData = () => {
  return {
    input_type: 'SingleSelect',
    attrs: {},
    default_value: formValue.value.default_value,
    show_default_value: formValue.value.show_default_value,
    text_field: 'label',
    value_field: 'value',
    option_list: formValue.value.option_list,
    assignment_method: formValue.value.assignment_method || 'custom',
    ref_variables_mode: formValue.value.ref_variables_mode || 'only',
    candidate_list: formValue.value.candidate_list || [],
  }
}
const rander = (form_data: any) => {
  formValue.value.option_list = form_data.option_list || []
  formValue.value.default_value = form_data.default_value
  formValue.value.show_default_value = form_data.show_default_value
  formValue.value.assignment_method = form_data.assignment_method || 'custom'
  formValue.value.ref_variables_mode = form_data.ref_variables_mode || 'only'
  formValue.value.candidate_list = form_data.candidate_list || []
}

defineExpose({ getData, rander })
onMounted(() => {
  formValue.value.option_list = []
  formValue.value.default_value = ''
  formValue.value.assignment_method = 'custom'
  formValue.value.ref_variables_mode = 'only'
  formValue.value.candidate_list = []
  if (formValue.value.show_default_value === undefined) {
    formValue.value.show_default_value = true
  }
  addOption()
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
.candidate-count {
  color: orange;
  margin-left: 0;
}

</style>
