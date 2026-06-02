# 表单选择器选项/候选值折叠 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在表单选择器的选项列表和候选值列表超过 20 条时折叠，点击"加载更多"每次多展示 20 条

**Architecture:** 纯前端 UI 改造。每个组件使用 computed 切片控制显示数量，底部添加"加载更多"按钮

**Tech Stack:** Vue 3, Element Plus, TypeScript

---

## 文件变更概览

### 前端修改（5个组件，同样的改动模式）
- `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

每个组件需要：
1. 模板：`v-for` 改为使用 `displayedOptions` / `displayedCandidates`
2. 模板：列表底部添加"加载更多"按钮
3. Script：添加 6 个 ref/computed（每个列表 3 个：count, displayed, hasMore）
4. Script：添加 2 个方法（loadMoreOptions, loadMoreCandidates）

---

## Task 1: SingleSelectConstructor.vue 折叠改造

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`

- [ ] **Step 1: 修改 option_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.option_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 2: 在 option_list 列表底部添加加载更多按钮**

在 `option_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 3: 修改 candidate_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.candidate_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedCandidates"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 4: 在 candidate_list 列表底部添加加载更多按钮**

在 `candidate_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreCandidates" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreCandidates">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 5: 添加 JavaScript 状态**

在 `<script setup lang="ts">` 块中，找到 `const existingOptionValues = computed(() => {` 之后，添加：

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

- [ ] **Step 6: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue
git commit -m "feat: SingleSelect 选项/候选值列表折叠"
```

---

## Task 2: MultiSelectConstructor.vue 折叠改造

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`

- [ ] **Step 1: 修改 option_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.option_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 2: 在 option_list 列表底部添加加载更多按钮**

在 `option_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 3: 修改 candidate_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.candidate_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedCandidates"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 4: 在 candidate_list 列表底部添加加载更多按钮**

在 `candidate_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreCandidates" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreCandidates">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 5: 添加 JavaScript 状态**

在 `<script setup lang="ts">` 块中，找到 `const existingOptionValues = computed(() => {` 之后，添加：

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

- [ ] **Step 6: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue
git commit -m "feat: MultiSelect 选项/候选值列表折叠"
```

---

## Task 3: RadioCardConstructor.vue 折叠改造

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`

- [ ] **Step 1: 修改 option_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.option_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 2: 在 option_list 列表底部添加加载更多按钮**

在 `option_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 3: 修改 candidate_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.candidate_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedCandidates"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 4: 在 candidate_list 列表底部添加加载更多按钮**

在 `candidate_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreCandidates" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreCandidates">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 5: 添加 JavaScript 状态**

在 `<script setup lang="ts">` 块中，找到 `const existingOptionValues = computed(() => {` 之后，添加：

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

- [ ] **Step 6: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue
git commit -m "feat: RadioCard 选项/候选值列表折叠"
```

---

## Task 4: RadioRowConstructor.vue 折叠改造

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`

- [ ] **Step 1: 修改 option_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.option_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 2: 在 option_list 列表底部添加加载更多按钮**

在 `option_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 3: 修改 candidate_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.candidate_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedCandidates"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 4: 在 candidate_list 列表底部添加加载更多按钮**

在 `candidate_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreCandidates" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreCandidates">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 5: 添加 JavaScript 状态**

在 `<script setup lang="ts">` 块中，找到 `const existingOptionValues = computed(() => {` 之后，添加：

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

- [ ] **Step 6: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue
git commit -m "feat: RadioRow 选项/候选值列表折叠"
```

---

## Task 5: MultiRowConstructor.vue 折叠改造

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

- [ ] **Step 1: 修改 option_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.option_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedOptions"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 2: 在 option_list 列表底部添加加载更多按钮**

在 `option_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreOptions" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreOptions">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 3: 修改 candidate_list 模板的 v-for**

找到 `v-for="(option, $index) in formValue.candidate_list"`，改为：

```vue
<el-row
  style="width: 100%"
  v-for="(option, $index) in displayedCandidates"
  :key="$index"
  :gutter="10"
  class="mb-8"
>
```

- [ ] **Step 4: 在 candidate_list 列表底部添加加载更多按钮**

在 `candidate_list` 列表的 `</el-row>` 闭合之后，`</el-form-item>` 之前，添加：

```vue
<div v-if="hasMoreCandidates" class="load-more">
  <el-button link type="primary" @click.stop="loadMoreCandidates">
    点击加载更多
  </el-button>
</div>
```

- [ ] **Step 5: 添加 JavaScript 状态**

在 `<script setup lang="ts">` 块中，找到 `const existingOptionValues = computed(() => {` 之后，添加：

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

- [ ] **Step 6: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue
git commit -m "feat: MultiRow 选项/候选值列表折叠"
```

---

## 自检清单

- [ ] spec覆盖：5个组件都覆盖
- [ ] 无占位符：所有代码块完整可执行
- [ ] 命名一致性：optionDisplayedCount / candidateDisplayedCount / loadMoreOptions / loadMoreCandidates 跨任务一致
- [ ] 模板结构：v-for 改为 displayedOptions / displayedCandidates，按钮位置在 `</el-row>` 后 `</el-form-item>` 前
