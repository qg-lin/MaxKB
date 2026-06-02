# 表单选择器选项/候选值列表折叠设计方案

## 需求

在表单选择器（SingleSelect、MultiSelect、RadioCard、RadioRow、MultiRow）的选项列表（`option_list`）和候选值列表（`candidate_list`）中，当条目数量超过 20 条时默认折叠显示前 20 条，底部显示「点击加载更多」按钮，每次点击多加载 20 条。

## 适用范围

| 列表 | 适用组件 | 触发条件 |
|------|---------|---------|
| `option_list`（自定义模式） | 全部5个组件 | `assignment_method == 'custom'` |
| `candidate_list`（引用变量+候选值） | 全部5个组件 | `assignment_method == 'ref_variables' && ref_variables_mode == 'with_candidates'` |

## 折叠规则

| 参数 | 值 | 说明 |
|------|-----|------|
| `INITIAL_DISPLAY_COUNT` | 20 | 初始显示数量 |
| `LOAD_MORE_COUNT` | 20 | 每次点击多加载的数量 |

## 交互流程

1. 列表条目数 ≤ 20：全部展示，无加载按钮
2. 列表条目数 > 20：仅展示前 20 条，底部显示「点击加载更多」按钮
3. 点击「点击加载更多」：再多显示 20 条
4. 重复点击直到完全展开（按钮消失）

## 实现方式

### 状态（每个组件各 4 个 ref/computed，每个列表独立）

```typescript
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
```

### 模板修改

**option_list 部分：**
```vue
<el-row
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  ...
>
  ...
</el-row>
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

**candidate_list 部分：同样模式**

### 行为细节

- 新增/删除选项：仅修改原始列表，不重置 `displayedCount`
- CSV 导入后：保持当前 `displayedCount`，导入的新条目可能被折叠
- 组件 `onMounted` 时初始化 `displayedCount` 为 20

## 涉及文件

### 前端修改（5个组件）
- `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

## 不涉及

- 后端无需修改
- 数据结构无需修改（仍为完整列表，折叠仅是 UI 展示）
