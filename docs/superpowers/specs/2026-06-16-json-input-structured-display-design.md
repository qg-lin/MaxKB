# JSON 输入框结构化展示设计

## 背景

表单收集组件中的 JSON 输入目前偏向开发者体验。CodeMirror 能帮助开发者编辑合法 JSON，但对不懂编码的岗位来说，花括号、数组、key、引号和嵌套结构都不够直观。

本设计将 JSON 输入升级为“结构化 JSON 字段”：编辑模式配置展示规则，用户端只按规则看到业务字段、表格和分组。底层提交值仍保持 JSON 结构，避免影响现有工作流和后端协议。

## 目标

- 设计者可以粘贴独立的 JSON 示例文本自动生成展示规则。
- 设计者可以配置 JSON key/path 对应的展示名称和值类型。
- 当值类型是单选或多选时，设计者可以配置候选值，并支持沿用现有 CSV 导入候选值能力。
- 设计者可以显式选择用户端展示方式：原始 CodeMirror 或结构化展示规则。
- 用户端不能配置规则，只按配置后的规则展示和填写。
- 用户端尽量不直接暴露原始 JSON 文本。
- 没有展示规则的旧字段保持现有 CodeMirror 行为。
- 结构化编辑后提交的数据仍是原 JSON 结构。

## 非目标

- 第一版不做复杂拖拽布局设计器。
- 第一版不完全替代高级 JSON 编辑能力。
- 第一版不要求所有深层嵌套都以最优表格形式编辑；复杂嵌套以折叠分组和子配置承接。
- 第一版不改变后端表单提交协议。

## 推荐方案

采用“主路径表格化 + 嵌套渐进展开”的方案。

配置端从独立的 JSON 示例文本推断展示规则，并以规则表展示。对象字段显示为字段配置表；对象数组显示为列配置表；嵌套对象和数组默认折叠，点击路径进入子配置。用户端根据规则渲染为表单、表格和可展开分组。

## 数据结构

在 JSON 表单字段配置中新增可选展示配置，建议命名为 `json_display_config`。该配置与 `default_value`、`attrs`、`props_info` 同级，不改变实际 JSON 值。

同时新增字段级展示模式 `json_display_mode`：

- `codemirror`：用户端显示原来的 CodeMirror JSON 编辑器。
- `structured`：用户端按 `json_display_config` 显示结构化表格/字段。

展示模式和展示规则分离。字段可以保存展示规则草稿，但只有 `json_display_mode === 'structured'` 时才启用结构化用户端渲染。

示例：

```ts
{
  mode: 'structured',
  rootType: 'object',
  fields: [
    {
      path: 'customer.name',
      label: '客户名称',
      valueType: 'text',
      visible: true,
      editable: true,
      children: []
    },
    {
      path: 'items[]',
      label: '商品明细',
      valueType: 'array_object',
      visible: true,
      editable: true,
      children: [
        {
          path: 'items[].name',
          label: '商品名称',
          valueType: 'text',
          visible: true,
          editable: true
        },
        {
          path: 'items[].qty',
          label: '数量',
          valueType: 'number',
          visible: true,
          editable: true
        }
      ]
    }
  ]
}
```

字段规则含义：

- `path`：JSON 路径，支持对象 key、对象数组和嵌套结构，例如 `customer.name`、`items[].qty`。
- `label`：用户端展示名称。
- `valueType`：值类型，用于选择用户端控件和保存时类型转换。
- `option_list`：单选和多选字段的候选值列表，结构沿用现有表单候选值 `{ label, value }`。
- `visible`：是否在用户端展示。
- `editable`：是否允许用户端编辑。
- `children`：对象、对象数组和嵌套结构的子规则。

第一版值类型：

- `text`
- `number`
- `boolean`
- `date`
- `single_select`
- `multi_select`
- `object`
- `array_object`
- `array_value`

## 配置端设计

`JsonInputConstructor.vue` 保留现有赋值方式能力，并新增“生成展示规则/编辑展示规则”的入口。展示规则配置不依赖赋值方式：自定义默认值和引用变量都可以配置规则。

配置端新增“展示方式”选择项：

- 默认“CodeMirror”。
- 选择“展示规则”后，用户端才启用结构化渲染。
- “生成展示规则”和“编辑展示规则”在自定义默认值与引用变量两种赋值方式下都可用。
- 规则生成仍只来自“示例 JSON”弹窗，不从默认值自动生成。

配置流程：

1. 设计者点击“生成展示规则”。
2. 系统打开示例 JSON 输入弹窗。
3. 设计者粘贴用于提取结构的示例 JSON 文本。
4. 系统解析示例 JSON 并生成 `json_display_config` 草稿。
4. 设计者在规则表中调整展示名称、值类型、是否显示、排序。
5. 当规则的值类型为单选或多选时，设计者可以打开候选值编辑器，手动维护候选值或导入 CSV。候选值编辑器复用现有 `OptionListEditor.vue`，CSV 解析复用现有 `parseCsv(file)`。
6. 对嵌套对象和数组，设计者进入子配置继续调整。
7. 保存表单字段时，展示规则随字段配置写入；示例 JSON 只用于生成规则，不作为默认值提交。

如果示例 JSON 无法解析，配置端展示 JSON 校验提示，不生成展示规则。

## 推断规则

推断逻辑以“保守可编辑”为原则，只生成草稿，不替设计者决定业务语义。

- 对象：每个 key 生成一个字段规则。
- 对象数组：合并数组内对象的 key，生成表格列规则。
- 基础值数组：生成单列表格规则，默认列名为“值”。
- 嵌套对象：生成折叠分组，子层继续生成字段规则。
- 嵌套数组：按数组内容推断为对象数组、基础值数组或待配置数组。
- 字符串：默认 `text`；符合日期格式时建议为 `date`。
- 数字：推断为 `number`。
- 布尔：推断为 `boolean`。
- `null`、空对象、空数组：标记为待配置，不强行猜测类型。

## 用户端设计

用户端 `JsonInput.vue` 根据字段配置切换展示方式。

- 存在 `json_display_mode === 'structured'` 且 `json_display_config.mode === 'structured'` 时，渲染结构化 UI。
- `json_display_mode === 'codemirror'` 时，即使存在展示规则，也保持现有 CodeMirror 行为。
- 不存在展示模式的旧字段按兼容规则处理：有合法 `json_display_config` 的字段视为 `structured`，没有规则的字段视为 `codemirror`。
- 对象渲染为表单分组。
- 对象数组渲染为表格，每一行对应数组项。
- 基础值数组渲染为单列表格。
- 单选字段渲染为下拉选择，值保存为单个候选值 `value`。
- 多选字段渲染为多选下拉，值保存为候选值 `value` 数组。
- 嵌套对象和数组渲染为可展开子区域。
- 用户修改后，组件按规则路径写回 JSON。
- 未映射字段不展示，但写回时保留在原 JSON 中，避免丢失数据。

## 组件拆分

建议新增小型、边界清晰的模块：

- `jsonDisplayConfig.ts`：展示规则类型定义。
- `jsonDisplayInfer.ts`：从 JSON 值推断展示规则。
- `jsonPathValue.ts`：按规则路径读取和写回 JSON 值。
- `JsonDisplayConfigEditor.vue`：配置端规则编辑器。
- `StructuredJsonInput.vue`：用户端结构化渲染组件。

现有 `JsonInput.vue` 作为入口组件，负责在 CodeMirror 和结构化组件之间切换。

## 错误处理

- 示例 JSON 非法：展示 JSON 校验错误，不生成规则。
- 规则 path 在当前值里不存在：展示空控件，允许用户填写。
- 当前值类型和规则类型不匹配：按规则控件展示，保存时尝试转换。
- 类型转换失败：给出字段级错误，阻止提交。
- 展示规则缺失或格式异常：回退到现有 CodeMirror 行为。

## 兼容性

该设计不改变 JSON 字段原始值结构。旧表单字段没有 `json_display_config`，仍按现有 CodeMirror 渲染。旧表单字段如果已经保存了 `json_display_config` 但没有 `json_display_mode`，按结构化展示处理，避免本功能开发期间已配置的规则失效。新字段保存后只增加可选配置，后端如果当前字段配置为自由 JSON 存储，则无需新增数据库字段。

## 测试计划

- 推断函数覆盖对象、对象数组、基础值数组、嵌套对象、嵌套数组、空值和类型冲突。
- 路径读写函数覆盖 `customer.name`、`items[].name`、嵌套数组对象。
- 组件回归验证无规则时仍使用现有 CodeMirror 行为。
- 用户端提交验证结构化编辑后提交值保持原 JSON 结构。
- 配置端保存验证展示规则可以随表单字段保存和编辑回显。
- 展示模式验证 CodeMirror 与结构化展示可以显式切换；有规则但选择 CodeMirror 时不渲染结构化 UI。
- 单选/多选候选值验证手动添加、删除、CSV 导入、规则保存回显和用户端下拉渲染。

## 验收标准

- 设计者可以基于示例 JSON 一键生成展示规则。
- 自定义默认值和引用变量两种赋值方式都可以配置展示规则。
- 设计者可以修改展示名称和值类型。
- 单选/多选规则可以配置候选值并在用户端以下拉框展示。
- 用户端选择“展示规则”且存在规则时不直接看到原始 JSON 文本。
- 用户端选择“CodeMirror”时保持原始 JSON 编辑体验。
- 用户端编辑结构化控件后，提交数据仍是合法 JSON。
- 旧字段和无规则字段行为不变。
