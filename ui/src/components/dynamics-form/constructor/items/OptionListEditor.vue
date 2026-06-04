<template>
  <div class="option-list-editor">
    <el-row style="width: 100%" :gutter="10">
      <el-col :span="10">
        {{ labelHeader }}
      </el-col>
      <el-col :span="12">
        {{ valueHeader }}
      </el-col>
    </el-row>
    <el-auto-resizer>
      <template #default="{ height }">
        <FixedSizeList
          ref="virtualListRef"
          :data="list"
          :height="height"
          :item-size="itemSize"
          :total="list.length"
          @scroll="handleScroll"
        >
          <template #default="{ data: rowData, index, style }">
            <el-row
              :key="index"
              :gutter="10"
              :style="style"
              class="option-row"
            >
              <el-col :span="10">
                <el-input
                  v-model="rowData[index].label"
                  :placeholder="labelPlaceholder"
                />
              </el-col>
              <el-col :span="12">
                <el-input
                  v-model="rowData[index].value"
                  :placeholder="valuePlaceholder"
                />
              </el-col>
              <el-col :span="1">
                <el-button link class="ml-8" @click.stop="handleDelete(index)">
                  <AppIcon iconName="app-delete"></AppIcon>
                </el-button>
              </el-col>
            </el-row>
          </template>
        </FixedSizeList>
      </template>
    </el-auto-resizer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { FixedSizeList } from 'element-plus'

interface OptionItem {
  label: string
  value: string
  [key: string]: any
}

const props = withDefaults(
  defineProps<{
    modelValue: OptionItem[]
    labelHeader?: string
    valueHeader?: string
    labelPlaceholder?: string
    valuePlaceholder?: string
    itemSize?: number
  }>(),
  {
    labelHeader: '标签',
    valueHeader: '选项值',
    labelPlaceholder: '请输入选项标签',
    valuePlaceholder: '请输入选项值',
    itemSize: 48,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: OptionItem[]]
  delete: [index: number]
  scroll: [offset: number]
}>()

// 直接传递 modelValue 引用：虚拟列表只访问 visibleRange 的 item，触发最小数量的 proxy 创建
const list = computed(() => props.modelValue ?? [])

const virtualListRef = ref<InstanceType<typeof FixedSizeList>>()

const handleDelete = (index: number) => {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur()
  }
  emit('delete', index)
}

const handleScroll = (offset: number) => {
  emit('scroll', offset)
}

const scrollToBottom = () => {
  // FixedSizeList 没有 scrollToBottom；通过 scrollToItem 到最后一项
  virtualListRef.value?.scrollToItem(list.value.length - 1, 'end')
}

const scrollToOffset = (offset: number) => {
  virtualListRef.value?.scrollTo(offset)
}

const scrollToIndex = (index: number) => {
  virtualListRef.value?.scrollToItem(index, 'end')
}

defineExpose({
  scrollToBottom,
  scrollToOffset,
  scrollToIndex,
})
</script>

<style lang="scss" scoped>
.option-list-editor {
  width: 100%;
  height: 500px;
}
.option-row {
  padding: 4px 0;
  display: flex;
  align-items: center;
}
</style>
