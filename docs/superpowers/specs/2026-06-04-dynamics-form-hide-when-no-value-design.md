# 表单收集组件 — 无值隐藏 功能设计

- **状态**：设计中
- **创建日期**：2026-06-04
- **目标模块**：`ui/src/components/dynamics-form/`

## 1. 目标

为 `dynamics-form` 组件新增"无值隐藏"能力：开启后，当字段的运行值为空（null / undefined / 空字符串 / 空数组）时，该字段自动从表单中隐藏。支持：

1. **字段级配置** — 每个 `FormField` 可单独开启/关闭
2. **表单级配置** — `DynamicsForm` 整体有一个总开关，作为所有字段的默认值
3. **优先级** — 字段级显式配置（`true` 或 `false`）覆盖表单级；字段级未配置时回退到表单级

## 2. 数据模型

### 2.1 `FormField` 新增字段

在 `ui/src/components/dynamics-form/type.ts` 中：

```typescript
interface FormField {
  // ... 现有字段 ...
  /**
   * 无值隐藏 - 当该字段值为空（null/undefined/空串/空数组）时隐藏
   * 优先级：字段级未定义时回退到表单级；字段级已定义则覆盖
   */
  hide_when_no_value?: boolean
}
```

放在 `FormField` 顶层，与 `default_value`、`required`、`show_default_value`、`relation_show_field_dict` 同一层级。`props_info` 专用于 Element UI 的样式/校验/消息等纯渲染属性，本字段属于"行为类"配置。

### 2.2 `DynamicsForm` 新增 prop

在 `ui/src/components/dynamics-form/index.vue` 中：

```typescript
defineProps<{
  // ... 现有 props ...
  /**
   * 表单级配置
   */
  formConfig?: { hide_when_no_value?: boolean }
}>()
```

表单级 `hide_when_no_value` 通过新 prop 传入，不在 `FormField` 上。

## 3. 运行时逻辑

### 3.1 核心辅助函数

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

### 3.2 `show()` 函数更新

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

**关键决策**：
- 与 `relation_show_field_dict` 是 **AND 关系** — 两者关注点不同（一个依赖其他字段的取值，一个看自身取值是否为空），必须同时通过才显示。
- 响应式自动生效：`show()` 在模板中调用，依赖 `formValue.value` 与 `props.formConfig`；`formValue` 已在 `change()` 中被改写，Vue 自动重渲染。

## 4. UI 改动

### 4.1 字段级开关 — 公共构造函数

放在**公共构造函数** `ui/src/components/dynamics-form/constructor/index.vue`（与 `required` 同一区域，所有输入类型共享），避免在 14 个 `*Constructor.vue` 重复添加。

```vue
<!-- 紧跟现有 required 开关后 -->
<el-form-item :label="$t('dynamicsForm.paramForm.hideWhenNoValue.label')">
  <el-switch
    v-model="form_data.hide_when_no_value"
    :active-value="true"
    :inactive-value="false"
  />
</el-form-item>
```

**`getData()` 注入**：
```typescript
return {
  // ... 现有返回 ...
  hide_when_no_value: form_data.value.hide_when_no_value,
}
```

**`rander()` 解析**：
```typescript
form_data.value.hide_when_no_value = data.hide_when_no_value ?? undefined
```

### 4.2 表单级开关 — form-node 工作流节点

在 `ui/src/workflow/nodes/form-node/index.vue` 的 `formSetting` 卡片顶部新增一行（在"添加字段"按钮上方）：

```vue
<el-form-item :label="$t('workflow.nodes.formNode.hideWhenNoValue.label')">
  <el-switch
    v-model="form_data.form_config.hide_when_no_value"
    :active-value="true"
    :inactive-value="false"
  />
  <span class="ml-8 lighter">{{ $t('workflow.nodes.formNode.hideWhenNoValue.tip') }}</span>
</el-form-item>
```

**`form_data` 增加字段**：
```typescript
form_data: {
  // ... 现有 ...
  form_config: { hide_when_no_value: false }
}
```

### 4.3 透传 — 调用方

在所有调用 `<DynamicsForm>` 处透传 `formConfig`：
```vue
<DynamicsForm
  :formConfig="form_config"
  :render_data="inputFieldList"
  ...
/>
```

`form_config` 来源：
- **form-node 渲染时**：直接取 `form_data.form_config`
- **user-form（用户侧）**：本期先保证组件层 `formConfig` prop 正确接收；具体数据流/来源在实现阶段根据 `base-node` 的 `properties` 实际形态确认

### 4.4 i18n 文案

```
dynamicsForm.paramForm.hideWhenNoValue.label = 无值隐藏
dynamicsForm.paramForm.hideWhenNoValue.tip   = 当字段无值时自动隐藏

workflow.nodes.formNode.hideWhenNoValue.label = 表单无值隐藏
workflow.nodes.formNode.hideWhenNoValue.tip   = 默认对所有字段生效，字段级配置可覆盖
```

实际实现时按项目 i18n 规范在 `ui/src/locales/` 对应语言文件中补充所有语言版本。

## 5. 边界情况

| 场景 | 行为 | 设计理由 |
|------|------|----------|
| 字段 `default_value` 有值且 `show_default_value=true` | `initDefaultData` 已写入 `formValue`，"无值隐藏"开启时**不隐藏** | 字段已有值，符合"非空才显示" |
| 字段 `default_value` 有值但 `show_default_value=false` | `formValue` 中该字段为 `undefined`，开启"无值隐藏"**会隐藏** | 默认值未生效，运行时确为空 |
| 字段同时有 `relation_show_field_dict` 与 `hide_when_no_value` | 两者 AND：关系规则不过 → 隐藏；关系规则过但值为空 → 隐藏 | §3.2 已说明 |
| 嵌套子表单（`children`） | `show()` 在父 FormField 上执行，子字段可见性由各自 `FormField` 决定 | 现有架构，无需特殊处理 |
| 表单 `view` 模式（只读） | 隐藏逻辑仍然生效 | 一致性 |
| 后端 `form_data` 已有该字段值 | 渲染时 `formValue` 已被 `getFormDefaultValue` 填充，开启"无值隐藏"**不隐藏** | 已有真实值 |
| 字段值为 `0` 或 `false` | 视为有值，**不隐藏** | 用户确认严格空值 |
| 字段值为 `{}` 或 `{a:1}` | 视为有值，**不隐藏** | 仅检查 null/undefined/空串/空数组，不递归判空 |
| `field.hide_when_no_value` 为 `undefined` | 回退到 `formConfig.hide_when_no_value` | 已确认优先级 |
| `field.hide_when_no_value` 为 `false`（显式关闭） | 强制显示，覆盖表单级 | 已确认优先级 |

## 6. 回归影响

1. `show()` 函数被多处依赖（如 form-node 内部表格预览、form-node 触发子表单），逻辑是追加式的（早返回条件未变，新增末尾的 `isEmpty` 判定），不会破坏现有行为。
2. `FormField` 新增可选字段 `hide_when_no_value`，向后兼容旧数据（缺省视为 `undefined`）。
3. `DynamicsForm` 新增可选 prop `formConfig`，向后兼容所有现有调用方。

## 7. 测试策略

项目目前未见显式单元测试基础设施（未发现 `*.spec.ts` / `*.test.ts`），不引入额外测试框架。改为手动验证关键场景。

### 7.1 关键场景清单

| # | 场景 | 预期 | 验证位置 |
|---|------|------|----------|
| 1 | 字段级开启 + 字段有初始值 | 显示 | form-node 设计器预览 |
| 2 | 字段级开启 + 字段无值 | 隐藏 | form-node 设计器预览 |
| 3 | 字段级关闭 + 表单级开启 + 字段无值 | **显示**（字段级覆盖） | form-node 设计器预览 |
| 4 | 表单级开启 + 所有字段无值 | 全部隐藏 | form-node 设计器预览 |
| 5 | 表单级关闭 + 字段级开启 + 字段无值 | 隐藏 | form-node 设计器预览 |
| 6 | 字段值为 `0` | 显示（不视为空） | Runtime |
| 7 | 字段值为 `false` | 显示（不视为空） | Runtime |
| 8 | 字段值为 `""` | 隐藏 | Runtime |
| 9 | 字段值为 `[]` | 隐藏 | Runtime |
| 10 | 字段值为 `null` / `undefined` | 隐藏 | Runtime |
| 11 | 同时有 `relation_show_field_dict` 关系规则，依赖字段无值 | 隐藏（AND 关系） | 组合场景 |
| 12 | `view` 只读模式 + 字段无值 | 隐藏 | Runtime |
| 13 | 子表单（`children`） | 父字段按 `show()` 决定，子字段按各自 `show()` 决定 | 嵌套场景 |
| 14 | 旧数据无 `hide_when_no_value` 字段 | 行为不变（向后兼容） | 加载旧数据 |
| 15 | 旧调用方未传 `formConfig` prop | 行为不变 | 静态检查 |

### 7.2 验证步骤

1. 在 `form-node` 中配置一个测试表单（3-5 个字段混合文本/数字/选择）
2. 切换"表单级无值隐藏"开关，对比渲染
3. 在字段构造函数切换单个字段开关，验证覆盖
4. 启动工作流调试，进入 user-form 运行时，输入/清空字段，验证隐藏/显示
5. 用浏览器控制台查看 `formValue` 实时值，确认判空逻辑正确

## 8. 待确认/不在本期范围

- **user-form 侧 `formConfig` 数据流**：`form-node` 节点设计的 `form_config.hide_when_no_value` 在工作流保存/传递至 `user-form` 时，后端模型（`form_field_list` JSON）是否需要新增 `form_config` 字段？实现阶段需确认：
  - 若后端 `form_field_list` 是自由 JSON 数组（schema-less），可无需后端改动
  - 若后端有严格 schema，需同步后端模型

  本期范围限定为"组件层完整支持"，后端 schema 同步在实现阶段单独评估。
