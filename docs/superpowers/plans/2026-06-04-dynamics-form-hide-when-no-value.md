# dynamics-form 无值隐藏 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `dynamics-form` 组件增加"无值隐藏"能力：字段级 + 表单级双层配置，字段级覆盖表单级，运行时按值是否为空（null/undefined/空串/空数组）控制字段显隐。

**Architecture:**
- 在 `FormField` 类型上新增可选字段 `hide_when_no_value?: boolean`
- `DynamicsForm` 组件新增可选 prop `formConfig?: { hide_when_no_value?: boolean }`
- `show()` 函数追加空值判定逻辑
- 字段级 UI 加在公共构造函数；表单级 UI 加在 form-node 工作流节点
- 后端 FormNodeParamsSerializer 同步增加 `form_config` 字段，`form_setting` JSON 中携带
- FormRander 解析 `form_config` 并透传给 DynamicsForm

**Tech Stack:** Vue 3 + TypeScript + Element Plus（前端）；Django + DRF（后端）

**Spec:** `docs/superpowers/specs/2026-06-04-dynamics-form-hide-when-no-value-design.md`

---

## 文件结构

**前端新增/修改：**
- 修改 `ui/src/components/dynamics-form/type.ts` — 新增 `hide_when_no_value` 字段
- 修改 `ui/src/components/dynamics-form/index.vue` — 新增 prop、辅助函数、`show()` 改造
- 修改 `ui/src/components/dynamics-form/constructor/index.vue` — 字段级 UI
- 修改 `ui/src/workflow/nodes/form-node/index.vue` — 表单级 UI
- 修改 `ui/src/components/markdown/FormRander.vue` — 透传 `formConfig` 给 DynamicsForm
- 修改 `ui/src/locales/lang/zh-CN/dynamicsForm.ts` — 字段级 i18n
- 修改 `ui/src/locales/lang/zh-CN/workflow.ts` — 表单级 i18n
- 修改 `ui/src/locales/lang/en-US/dynamicsForm.ts` — 字段级 i18n
- 修改 `ui/src/locales/lang/en-US/workflow.ts` — 表单级 i18n
- 修改 `ui/src/locales/lang/zh-Hant/dynamicsForm.ts` — 字段级 i18n
- 修改 `ui/src/locales/lang/zh-Hant/workflow.ts` — 表单级 i18n

**后端修改：**
- 修改 `apps/application/flow/step_node/form_node/i_form_node.py` — `FormNodeParamsSerializer` 加 `form_config` 字段
- 修改 `apps/application/flow/step_node/form_node/impl/base_form_node.py` — 三处 `form_setting` JSON 都带上 `form_config`

**不在范围内：**
- `user-form/index.vue` 的 formConfig 数据流（spec §8 标为待评估）；本期只保证组件层 `formConfig` prop 正确接收即可
- 单元测试（spec §7 说明项目无测试框架，改为手动验证）

---

## Task 1：扩展 FormField 类型

**Files:**
- Modify: `ui/src/components/dynamics-form/type.ts`

- [ ] **Step 1：打开 type.ts 定位 FormField 接口**

文件末尾（`export type { FormField }` 之前）找到 `interface FormField` 块。

- [ ] **Step 2：在 FormField 接口中新增 `hide_when_no_value` 字段**

定位：在 `required?: boolean` 字段之后插入新字段。最终代码（仅展示新增/修改段）：

```typescript
interface FormField {
  field: string
  input_type: string
  label?: string | any
  required?: boolean
  /**
   * 无值隐藏 - 当该字段值为空（null/undefined/空串/空数组）时隐藏
   * 优先级：字段级未定义时回退到表单级；字段级已定义则覆盖
   */
  hide_when_no_value?: boolean
  default_value?: any
  // ... 其余字段保持不变
}
```

- [ ] **Step 3：保存并 TypeScript 类型检查**

运行：
```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

预期：无新错误（仅有既有的"找不到 import"等可忽略警告）。

- [ ] **Step 4：提交**

```bash
git add ui/src/components/dynamics-form/type.ts
git commit -m "feat(dynamics-form): FormField 新增 hide_when_no_value 字段"
```

---

## Task 2：DynamicsForm 实现运行时逻辑

**Files:**
- Modify: `ui/src/components/dynamics-form/index.vue`

- [ ] **Step 1：在 props 中新增 `formConfig`**

定位：`defineProps` 块中，`modelValue` 之后新增。最终代码（仅展示新增段）：

```typescript
const props = withDefaults(
  defineProps<{
    render_data: ...  // 现有
    otherParams?: any
    view?: boolean
    defaultItemWidth?: string
    parent_field?: string
    modelValue?: Dict<any>
    /**
     * 表单级配置
     */
    formConfig?: { hide_when_no_value?: boolean }
  }>(),
  { view: false, defaultItemWidth: '75%', otherParams: () => {} },
)
```

- [ ] **Step 2：新增 `isEmpty` 辅助函数**

定位：在 `const show = (field: FormField) => {` 之前插入。最终代码：

```typescript
/**
 * 严格空值判定：null / undefined / 空串 / 空数组 视为空
 * 0、false、非空对象/Map 视为有值
 */
const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value === '') return true
  if (Array.isArray(value) && value.length === 0) return true
  return false
}

/**
 * 解析"无值隐藏"开关最终值：字段级覆盖表单级
 */
const resolveHideWhenNoValue = (field: FormField): boolean => {
  if (field.hide_when_no_value !== undefined) return field.hide_when_no_value
  return props.formConfig?.hide_when_no_value === true
}
```

- [ ] **Step 3：扩展 `show()` 函数**

定位：在 `const show = (field: FormField) => {` 函数体末尾、`return true` 之前插入新分支。修改后完整函数体：

```typescript
const show = (field: FormField) => {
  // 1. 现有关系显隐逻辑
  if (field.relation_show_field_dict) {
    const keys = Object.keys(field.relation_show_field_dict)
    for (const index in keys) {
      const key = keys[index]
      const v = _.get(formValue.value, key)
      if (v && v !== undefined && v !== null) {
        const values = field.relation_show_field_dict[key]
        if (values && values.length > 0) {
          if (!values.includes(v)) return false
        }
      } else {
        return false
      }
    }
  }

  // 2. 新增：无值隐藏
  if (resolveHideWhenNoValue(field)) {
    if (isEmpty(formValue.value[field.field])) return false
  }

  return true
}
```

- [ ] **Step 4：保存并 type-check**

运行：
```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

预期：无新错误。

- [ ] **Step 5：提交**

```bash
git add ui/src/components/dynamics-form/index.vue
git commit -m "feat(dynamics-form): 新增 formConfig prop 与无值隐藏运行时逻辑"
```

---

## Task 3：公共构造函数加字段级 UI

**Files:**
- Modify: `ui/src/components/dynamics-form/constructor/index.vue`

- [ ] **Step 1：扩展 `form_data` 初始值**

定位：第 103-109 行 `const form_data = ref<any>({...})` 块。在 `input_type: ''` 之后加 `hide_when_no_value: undefined`。修改后：

```typescript
const form_data = ref<any>({
  label: '',
  field: '',
  tooltip: '',
  required: false,
  input_type: '',
  hide_when_no_value: undefined,
})
```

- [ ] **Step 2：在模板中 `required` 开关后插入新开关**

定位：第 44-52 行 `<el-form-item :label="$t('dynamicsForm.paramForm.required.label')">` 块**之后**插入：

```vue
<el-form-item
  :label="$t('dynamicsForm.paramForm.hideWhenNoValue.label')"
  @click.prevent
>
  <el-switch
    v-model="form_data.hide_when_no_value"
    :active-value="true"
    :inactive-value="false"
  />
</el-form-item>
```

- [ ] **Step 3：在 `getData()` 返回中加 `hide_when_no_value`**

定位：第 116-134 行的 `getData()` 函数，修改返回对象：

```typescript
const getData = () => {
  let label: string | any = form_data.value.label
  if (form_data.value.tooltip) {
    label = {
      input_type: 'TooltipLabel',
      label: form_data.value.label,
      attrs: { tooltip: form_data.value.tooltip },
      props_info: {},
    }
  }
  return {
    label: label,
    required: form_data.value.required,
    field: form_data.value.field,
    default_value: form_data.value.default_value,
    show_default_value: form_data.value.show_default_value,
    hide_when_no_value: form_data.value.hide_when_no_value,
    ...componentFormRef.value.getData(),
  }
}
```

- [ ] **Step 4：在 `rander()` 中加 `hide_when_no_value` 解析**

定位：第 148-167 行的 `rander()` 函数。在 `if (data.show_default_value !== undefined) {...}` 之后插入：

```typescript
if (data.hide_when_no_value !== undefined) {
  form_data.value.hide_when_no_value = data.hide_when_no_value
}
```

- [ ] **Step 5：保存并 type-check**

运行：
```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

预期：无新错误。

- [ ] **Step 6：提交**

```bash
git add ui/src/components/dynamics-form/constructor/index.vue
git commit -m "feat(dynamics-form): 字段构造函数加无值隐藏开关"
```

---

## Task 4：i18n — 字段级文案

**Files:**
- Modify: `ui/src/locales/lang/zh-CN/dynamicsForm.ts`
- Modify: `ui/src/locales/lang/en-US/dynamicsForm.ts`
- Modify: `ui/src/locales/lang/zh-Hant/dynamicsForm.ts`

- [ ] **Step 1：在 zh-CN 中加 key**

定位：在 `paramForm` 对象中找到 `required` 段落后加 `hideWhenNoValue` 段。修改后结构示例（实际按文件中既有排版调整）：

```typescript
paramForm: {
  // ... 现有
  required: {
    label: '必填',
    requiredMessage: '请选择是否必填',
  },
  hideWhenNoValue: {
    label: '无值隐藏',
    tip: '当该字段值为空时自动隐藏',
  },
  // ... 其余
}
```

- [ ] **Step 2：在 en-US 中加 key**

```typescript
hideWhenNoValue: {
  label: 'Hide When Empty',
  tip: 'Auto-hide this field when its value is empty',
},
```

- [ ] **Step 3：在 zh-Hant 中加 key**

```typescript
hideWhenNoValue: {
  label: '無值隱藏',
  tip: '當該欄位值為空時自動隱藏',
},
```

- [ ] **Step 4：保存三个文件**

- [ ] **Step 5：提交**

```bash
git add ui/src/locales/lang/zh-CN/dynamicsForm.ts \
        ui/src/locales/lang/en-US/dynamicsForm.ts \
        ui/src/locales/lang/zh-Hant/dynamicsForm.ts
git commit -m "feat(dynamics-form): 字段级无值隐藏 i18n 文案"
```

---

## Task 5：form-node 加表单级 UI

**Files:**
- Modify: `ui/src/workflow/nodes/form-node/index.vue`

- [ ] **Step 1：扩展 `form` 初始值**

定位：第 205-211 行的 `const form = ref<any>({...})` 块。修改后：

```typescript
const form = ref<any>({
  is_result: true,
  form_content_format: `${t('workflow.nodes.formNode.form_content_format1')}
{{form}}
${t('workflow.nodes.formNode.form_content_format2')}`,
  form_field_list: [],
  form_config: { hide_when_no_value: false },
})
```

- [ ] **Step 2：在 formSetting 卡片顶部插入新 el-form-item**

定位：第 50-64 行 `<el-form-item :label="$t('workflow.nodes.formNode.formSetting')">` 块**之前**插入（"formSetting" 标题项之前，作为该卡片第一项）：

```vue
<el-form-item
  :label="$t('workflow.nodes.formNode.hideWhenNoValue.label')"
  @click.prevent
>
  <div class="flex align-center">
    <el-switch
      v-model="form_data.form_config.hide_when_no_value"
      :active-value="true"
      :inactive-value="false"
    />
    <span class="ml-8 lighter">
      {{ $t('workflow.nodes.formNode.hideWhenNoValue.tip') }}
    </span>
  </div>
</el-form-item>
```

- [ ] **Step 3：保存并 type-check**

运行：
```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

预期：无新错误。

- [ ] **Step 4：提交**

```bash
git add ui/src/workflow/nodes/form-node/index.vue
git commit -m "feat(workflow): form-node 加表单级无值隐藏开关"
```

---

## Task 6：i18n — 表单级文案

**Files:**
- Modify: `ui/src/locales/lang/zh-CN/workflow.ts`
- Modify: `ui/src/locales/lang/en-US/workflow.ts`
- Modify: `ui/src/locales/lang/zh-Hant/workflow.ts`

- [ ] **Step 1：在 zh-CN 中加 key**

定位：找到 `formNode` 对象（通常以 `formNode: { ... }` 形式），在其内合适位置（如 `formSetting` 字段附近）加 `hideWhenNoValue`：

```typescript
formNode: {
  // ... 现有
  formSetting: '表单配置',
  hideWhenNoValue: {
    label: '表单无值隐藏',
    tip: '默认对所有字段生效，字段级配置可覆盖',
  },
  // ... 其余
}
```

- [ ] **Step 2：在 en-US 中加 key**

```typescript
hideWhenNoValue: {
  label: 'Hide Empty Fields',
  tip: 'Applies to all fields by default; field-level settings can override',
},
```

- [ ] **Step 3：在 zh-Hant 中加 key**

```typescript
hideWhenNoValue: {
  label: '表單無值隱藏',
  tip: '預設對所有欄位生效，欄位級設定可覆寫',
},
```

- [ ] **Step 4：保存并提交**

```bash
git add ui/src/locales/lang/zh-CN/workflow.ts \
        ui/src/locales/lang/en-US/workflow.ts \
        ui/src/locales/lang/zh-Hant/workflow.ts
git commit -m "feat(workflow): 表单级无值隐藏 i18n 文案"
```

---

## Task 7：后端 FormNodeParamsSerializer 加 form_config

**Files:**
- Modify: `apps/application/flow/step_node/form_node/i_form_node.py`

- [ ] **Step 1：在 FormNodeParamsSerializer 中加 form_config 字段**

定位：第 19-22 行的 `FormNodeParamsSerializer` 类。修改后：

```python
class FormNodeParamsSerializer(serializers.Serializer):
    form_field_list = serializers.ListField(required=True, label=_("Form Configuration"))
    form_content_format = serializers.CharField(required=True, label=_('Form output content'))
    form_data = serializers.DictField(required=False, allow_null=True, label=_("Form Data"))
    form_config = serializers.DictField(required=False, allow_null=True, label=_("Form Config"))
```

- [ ] **Step 2：保存文件**

- [ ] **Step 3：提交**

```bash
git add apps/application/flow/step_node/form_node/i_form_node.py
git commit -m "feat(form_node): FormNodeParamsSerializer 新增 form_config 字段"
```

---

## Task 8：后端 form_setting JSON 携带 form_config

**Files:**
- Modify: `apps/application/flow/step_node/form_node/impl/base_form_node.py`

- [ ] **Step 1：在 `execute()` 方法的 form_setting dict 中加 form_config**

定位：第 148-150 行。修改后：

```python
form_setting = {
    "form_field_list": form_field_list,
    "runtime_node_id": self.runtime_node_id,
    "chat_record_id": self.flow_params_serializer.data.get("chat_record_id"),
    "is_submit": self.context.get("is_submit", False),
    "form_config": self.node_params_serializer.data.get("form_config"),
}
```

- [ ] **Step 2：在 `get_answer_list()` 的 form_setting dict 中加 form_config**

定位：第 166-169 行。同上方式补充：

```python
form_setting = {
    "form_field_list": form_field_list,
    "runtime_node_id": self.runtime_node_id,
    "chat_record_id": self.flow_params_serializer.data.get("chat_record_id"),
    'form_data': self.context.get('form_data', {}),
    "is_submit": self.context.get("is_submit", False),
    "form_config": self.context.get("form_config"),
}
```

- [ ] **Step 3：在 `get_details()` 的 form_setting dict 中加 form_config**

定位：第 183-186 行。同上方式补充：

```python
form_setting = {
    "form_field_list": form_field_list,
    "runtime_node_id": self.runtime_node_id,
    "chat_record_id": self.flow_params_serializer.data.get("chat_record_id"),
    'form_data': self.context.get('form_data', {}),
    "is_submit": self.context.get("is_submit", False),
    "form_config": self.context.get("form_config"),
}
```

- [ ] **Step 4：保存文件**

- [ ] **Step 5：提交**

```bash
git add apps/application/flow/step_node/form_node/impl/base_form_node.py
git commit -m "feat(form_node): form_setting JSON 携带 form_config 透传至前端"
```

---

## Task 9：FormRander 透传 formConfig 给 DynamicsForm

**Files:**
- Modify: `ui/src/components/markdown/FormRander.vue`

- [ ] **Step 1：扩展 `form_setting_data` computed 读取 form_config**

定位：第 37-43 行 `const form_setting_data = computed(() => {...})` 已返回整个 JSON 对象，无需修改 — 增加一个独立 computed 提取 `form_config`：

```typescript
const form_config = computed(() => {
  return form_setting_data.value.form_config || {}
})
```

- [ ] **Step 2：在模板中给 DynamicsForm 加 `:formConfig` 绑定**

定位：第 3-12 行 `<DynamicsForm>` 标签。修改后：

```vue
<DynamicsForm
  :disabled="is_submit || disabled"
  label-position="top"
  require-asterisk-position="right"
  ref="dynamicsFormRef"
  :render_data="form_field_list"
  :formConfig="form_config"
  label-suffix=":"
  v-model="form_data"
  :model="form_data"
></DynamicsForm>
```

- [ ] **Step 3：保存并 type-check**

运行：
```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npx vue-tsc --noEmit -p tsconfig.json 2>&1 | head -30
```

预期：无新错误。

- [ ] **Step 4：提交**

```bash
git add ui/src/components/markdown/FormRander.vue
git commit -m "feat(markdown): FormRander 透传 formConfig 给 DynamicsForm"
```

---

## Task 10：手动验证关键场景

**Files:** 无代码改动；纯手动验证

- [ ] **Step 1：启动前端开发服务器**

```bash
cd /Users/lqg/code/hgj/MaxKB/ui && npm run dev
```

- [ ] **Step 2：构建一个含 3-5 字段的测试表单**

在 form-node 工作流节点中添加测试字段（如文本/数字/选择混合），保存。

- [ ] **Step 3：场景 1-5 验证（配置覆盖矩阵）**

| # | 操作 | 预期 |
|---|------|------|
| 1 | 字段级开启 + 字段有初始值 | 显示 |
| 2 | 字段级开启 + 字段无值 | 隐藏 |
| 3 | 字段级关闭 + 表单级开启 + 字段无值 | 显示（字段级覆盖） |
| 4 | 表单级开启 + 所有字段无值 | 全部隐藏 |
| 5 | 表单级关闭 + 字段级开启 + 字段无值 | 隐藏 |

操作方式：进入工作流调试界面，运行 form-node 节点，进入表单填写页面，切换开关对比渲染。

- [ ] **Step 4：场景 6-10 验证（空值类型）**

| # | 输入值 | 预期 |
|---|--------|------|
| 6 | `0` | 显示（不视为空） |
| 7 | `false` | 显示（不视为空） |
| 8 | `""` | 隐藏 |
| 9 | `[]` | 隐藏 |
| 10 | `null` / 留空 | 隐藏 |

操作方式：在表单填写页面输入/清空各字段，浏览器控制台查看 `formValue` 实时值。

- [ ] **Step 5：场景 11 验证（与 relation_show_field_dict 组合）**

为某字段同时配置 `relation_show_field_dict` 与 `hide_when_no_value=undefined`（用表单级开启），将依赖字段清空 → 预期隐藏（AND 关系）。

- [ ] **Step 6：场景 12 验证（view 只读模式）**

进入已提交的历史表单详情页（`view=true`），无值字段 → 预期隐藏。

- [ ] **Step 7：场景 13 验证（子表单嵌套）**

在 form-node 中添加 `MultiRow` 或 `ObjectCard` 类型字段（含 children），其子字段按各自的 `show()` 决定 → 父字段被父级 show 决定后，子字段独立判断。

- [ ] **Step 8：场景 14 验证（旧数据兼容）**

加载一份**修改前**保存的 form-node 节点（无 form_config 字段），运行工作流 → 预期行为不变（form_config 默认为 undefined，所有字段遵循字段级配置）。

- [ ] **Step 9：场景 15 验证（旧调用方兼容）**

打开 KnowledgeBase.vue、DataSource.vue、CreateModelDialog.vue、EditModel.vue、AIModeParamSettingDialog.vue、STTModelParamSettingDialog.vue、TTSModeParamSettingDialog.vue、InitParamDrawer.vue、ToolDebugDrawer.vue 等 DynamicsForm 调用方页面 → 预期无报错（因 `formConfig` 是可选 prop，未传时等价于 undefined）。

- [ ] **Step 10：记录结果**

如果全部通过，提交一个 verification 记录 commit：

```bash
git commit --allow-empty -m "test(dynamics-form): 手动验证 15 个无值隐藏场景全部通过"
```

如果失败，记录失败场景并修复后重新验证。

---

## 自审检查

执行完成后做以下检查：

1. **Spec 覆盖**：spec 中所有需求（字段级 + 表单级 + 优先级 + 空值定义 + UI + 透传）都映射到 Task 1-9
2. **占位符扫描**：plan 中无 TBD/TODO；所有代码片段都是完整可粘贴的
3. **类型一致性**：`isEmpty`、`resolveHideWhenNoValue`、`formConfig`、`hide_when_no_value` 在所有任务中名称一致
4. **关注点分离**：每个 Task 单一职责；运行时逻辑（Task 2）与 UI（Task 3/5/9）解耦
5. **回归点**：`formConfig` 与 `hide_when_no_value` 都是可选，向后兼容
