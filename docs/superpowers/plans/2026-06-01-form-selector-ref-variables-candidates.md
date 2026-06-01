# 表单选择器引用变量+候选值 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在表单选择器（SingleSelect、MultiSelect等）的引用变量模式下，支持配置候选值作为静态选项展示

**Architecture:** 前端修改选择器组件UI，支持子模式切换和候选值编辑；后端修改reset_field方法，合并引用变量值和候选值

**Tech Stack:** Vue3, Element Plus, Python

---

## 文件变更概览

### 前端（5个组件）
- `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

### 后端
- `apps/application/flow/step_node/form_node/impl/base_form_node.py`

---

## Task 1: SingleSelectConstructor.vue 前端修改

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`

- [ ] **Step 1: 在 assignment_method == 'ref_variables' 时新增子模式选择**

在第10行 `el-radio-group` 后方，添加子模式选择UI：

```vue
<el-form-item v-if="formValue.assignment_method == 'ref_variables'" :label="'模式'">
  <el-radio-group v-model="formValue.ref_variables_mode">
    <el-radio value="only">纯引用变量</el-radio>
    <el-radio value="with_candidates">引用变量+候选值</el-radio>
  </el-radio-group>
</el-form-item>
```

- [ ] **Step 2: 在 ref_variables_mode == 'with_candidates' 时显示候选值编辑区**

在第52行 `</el-form-item>` 后添加（与 custom 模式相同的选项编辑UI）：

```vue
<el-form-item v-if="formValue.assignment_method == 'ref_variables' && formValue.ref_variables_mode == 'with_candidates'">
  <template #label>
    <div class="flex-between">
      {{ $t('dynamicsForm.candidate.label', '候选值') }}
      <el-button link type="primary" @click.stop="addCandidate()">
        <AppIcon iconName="app-add-outlined" class="mr-4"></AppIcon>
        {{ $t('common.add') }}
      </el-button>
    </div>
  </template>
  <el-row style="width: 100%" :gutter="10">
    <el-col :span="10">{{ $t('dynamicsForm.tag.label') }}</el-col>
    <el-col :span="12">{{ $t('dynamicsForm.Select.label') }}</el-col>
  </el-row>
  <el-row
    style="width: 100%"
    v-for="(candidate, $index) in formValue.candidate_list"
    :key="$index"
    :gutter="10"
    class="mb-8"
  >
    <el-col :span="10">
      <el-input v-model="formValue.candidate_list[$index].label" :placeholder="$t('dynamicsForm.tag.placeholder')" />
    </el-col>
    <el-col :span="12">
      <el-input v-model="formValue.candidate_list[$index].value" :placeholder="$t('dynamicsForm.Select.label')" />
    </el-col>
    <el-col :span="1">
      <el-button link class="ml-8" @click.stop="delCandidate($index)">
        <AppIcon iconName="app-delete"></AppIcon>
      </el-button>
    </el-col>
  </el-row>
</el-form-item>
```

- [ ] **Step 3: 添加 addCandidate 和 delCandidate 方法**

在第190行 `addOption` 方法后添加：

```javascript
const addCandidate = () => {
  if (!formValue.value.candidate_list) {
    formValue.value.candidate_list = []
  }
  formValue.value.candidate_list.push({ value: '', label: '' })
}

const delCandidate = (index: number) => {
  formValue.value.candidate_list.splice(index, 1)
}
```

- [ ] **Step 4: 修改 getData 方法返回新增字段**

在第202行 `getData` 方法中添加：

```javascript
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
    ref_variables_mode: formValue.value.ref_variables_mode || 'only',  // 新增
    candidate_list: formValue.value.candidate_list || [],               // 新增
  }
}
```

- [ ] **Step 5: 修改 rander 方法回显新增字段**

在第214行 `rander` 方法中添加：

```javascript
const rander = (form_data: any) => {
  formValue.value.option_list = form_data.option_list || []
  formValue.value.default_value = form_data.default_value
  formValue.value.show_default_value = form_data.show_default_value
  formValue.value.assignment_method = form_data.assignment_method || 'custom'
  formValue.value.ref_variables_mode = form_data.ref_variables_mode || 'only'   // 新增
  formValue.value.candidate_list = form_data.candidate_list || []               // 新增
}
```

- [ ] **Step 6: 在 onMounted 中初始化新字段**

在第226行后添加：

```javascript
if (formValue.value.ref_variables_mode === undefined) {
  formValue.value.ref_variables_mode = 'only'
}
if (formValue.value.candidate_list === undefined) {
  formValue.value.candidate_list = []
}
```

- [ ] **Step 7: 提交 SingleSelectConstructor.vue**

```bash
git add ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue
git commit -m "feat: SingleSelect支持引用变量+候选值模式"
```

---

## Task 2: MultiSelectConstructor.vue 前端修改

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`

- [ ] **Step 1: 添加子模式选择UI（参考Task 1 Step 1）**

在第39行 `</el-form-item>` 后添加相同的子模式选择和候选值编辑UI

- [ ] **Step 2: 添加 addCandidate 和 delCandidate 方法**

在第196行 `addOption` 方法后添加（与Task 1 Step 3相同）

- [ ] **Step 3: 修改 getData 方法返回新增字段**

在第208行添加 `ref_variables_mode` 和 `candidate_list`

- [ ] **Step 4: 修改 rander 方法回显新增字段**

在第220行添加 `ref_variables_mode` 和 `candidate_list` 的回显

- [ ] **Step 5: 在 onMounted 中初始化新字段**

在第234行后添加初始化代码

- [ ] **Step 6: 提交 MultiSelectConstructor.vue**

```bash
git add ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue
git commit -m "feat: MultiSelect支持引用变量+候选值模式"
```

---

## Task 3: RadioCardConstructor.vue 前端修改

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`

- [ ] **Step 1-6: 参考Task 1完成相同修改**

RadioCardConstructor.vue 与 SingleSelectConstructor.vue 结构相似，执行相同的修改步骤

- [ ] **Step 7: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue
git commit -m "feat: RadioCard支持引用变量+候选值模式"
```

---

## Task 4: RadioRowConstructor.vue 前端修改

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`

- [ ] **Step 1-6: 参考Task 1完成相同修改**

RadioRowConstructor.vue 与 SingleSelectConstructor.vue 结构相似，执行相同的修改步骤

- [ ] **Step 7: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue
git commit -m "feat: RadioRow支持引用变量+候选值模式"
```

---

## Task 5: MultiRowConstructor.vue 前端修改

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

- [ ] **Step 1-6: 参考Task 1完成相同修改**

MultiRowConstructor.vue 与 SingleSelectConstructor.vue 结构相似，执行相同的修改步骤

- [ ] **Step 7: 提交**

```bash
git add ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue
git commit -m "feat: MultiRow支持引用变量+候选值模式"
```

---

## Task 6: 后端 base_form_node.py 修改

**Files:**
- Modify: `apps/application/flow/step_node/form_node/impl/base_form_node.py`

- [ ] **Step 1: 在 reset_field 方法中添加候选值合并逻辑**

找到第93-100行的代码块，修改为：

```python
if ['SingleSelect', 'MultiSelect', 'RadioCard', 'RadioRow', 'MultiRow'].__contains__(field.get('input_type')):
    if field.get('assignment_method') == 'ref_variables':
        option_list = self.workflow_manage.get_reference_field(field.get('option_list')[0],
                                                               field.get('option_list')[1:])
        option_list = option_list if isinstance(option_list, list) else []
        # 如果是引用变量+候选值模式，合并候选值
        if field.get('ref_variables_mode') == 'with_candidates':
            candidate_list = field.get('candidate_list', [])
            if isinstance(candidate_list, list) and len(candidate_list) > 0:
                # 将候选值合并到选项列表
                option_list = option_list + candidate_list
                # 简单的去重（基于value）
                seen = set()
                unique_options = []
                for opt in option_list:
                    if isinstance(opt, dict) and 'value' in opt:
                        if opt['value'] not in seen:
                            seen.add(opt['value'])
                            unique_options.append(opt)
                    else:
                        unique_options.append(opt)
                option_list = unique_options
        field['option_list'] = option_list
        field['default_value'] = get_default_option(option_list, field.get('input_type'),
                                                    field.get('value_field'))
```

- [ ] **Step 2: 提交后端变更**

```bash
git add apps/application/flow/step_node/form_node/impl/base_form_node.py
git commit -m "feat: 支持引用变量模式合并候选值"
```

---

## Task 7: 整体测试

**Files:**
- Modify: `apps/maxkb/const.py`（如需要国际化配置）

- [ ] **Step 1: 启动前端开发服务器**

```bash
cd ui && npm run dev
```

- [ ] **Step 2: 创建测试表单，选择器配置引用变量+候选值模式**

1. 添加 SingleSelect 字段
2. 赋值方式选择"引用变量"
3. 选择一个引用变量
4. 模式选择"引用变量+候选值"
5. 添加几条候选值

- [ ] **Step 3: 验证运行时选项包含引用变量值和候选值**

- [ ] **Step 4: 验证其他选择器类型（MultiSelect、RadioCard等）**

---

## 自检清单

- [ ] spec覆盖：需求中的每项都有对应task
- [ ] 无占位符：所有代码块完整可执行
- [ ] 类型一致性：前端组件新增字段与后端处理逻辑一致
