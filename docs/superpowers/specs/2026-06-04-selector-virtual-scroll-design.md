# 选择器虚拟滚动 — 设计文档

**日期**: 2026-06-04
**状态**: 设计中
**关联分支**: feature/select-v2

## 背景

`dynamics-form` 模块中的选择器组件在候选值超过 ~1万条时，页面卡顿甚至崩溃。

**根因**：`SingleSelect.vue` / `MultiSelect.vue` / `SingleSelectConstructor` 默认值选择器都用 `el-select` + `v-for` 渲染全部 `<el-option>`，1万条即 1万 个 DOM 节点。

## 目标

- 1万+ 候选项不卡顿、不崩溃
- 保持 el-select 外观 / 交互 / props / events
- 搜索 + 滚动均流畅

## 非目标

- 不在编辑侧（选项/candidate 列表编辑区）做虚拟化 — 已有的"加载更多/100+ 弹确认"模式满足需要
- 本期不引入本地缓存（IndexedDB 等）— 后续如二次打开仍是热点再加

## 方案

将 3 处渲染热点从 `el-select` 替换为 `el-select-v2`（Element Plus 2.12+ 内置的虚拟滚动选择器）。

### 文件变更

| 文件 | 变更 |
|---|---|
| `ui/src/components/dynamics-form/items/select/SingleSelect.vue` | `el-select` → `el-select-v2`，`<el-option v-for>` → `:options` 计算属性 |
| `ui/src/components/dynamics-form/items/select/MultiSelect.vue` | 同上 |
| `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`（line 197-208 默认值选择器） | 同上 |

### 行为兼容

- `text_field` / `value_field` 字段映射：通过计算属性把 `formField.option_list` 归一化为 `[{value, label}]`
- `v-bind="$attrs"` 透传：v2 接受同名 props，无需改父组件
- `SingleSelect` 的"value 不在 options 中自动置空"逻辑：从 `label()` 函数移到 `watch(() => props.modelValue)` 中
- `MultiSelect` 的 `allow-create`：v2 支持，新创建项由组件内部维护，无需修改 options 数组
- `teleported` / `popper-class` / `clearable` / `filterable` / `defaultFirstOption` / `reserveKeyword` 等 props 在 v2 中同名同义

### 阈值

不对列表长度做判断，全部统一使用 `el-select-v2`。v2 在 1条 和 1万条 时表现均稳定，引入阈值反而增加复杂度。

## 测试

- 手动验证：在 `dynamics-form/Demo.vue` 中造 1万/5万/10万 条数据，确认下拉/搜索/选中不卡
- 检查未选中 → 选中 → 清空 → 重新选中的完整链路
- 检查 `MultiSelect` 的 `allow-create` 仍能正常工作
- 检查 `SingleSelect` 的"value 失效后自动清空"逻辑仍触发

## 风险

- 极小：v2 是 Element Plus 官方组件，行为与 v1 高度一致
- 唯一需关注：`allow-create` 的新 value 不会自动写回 `formField.option_list` — 与原 `el-select` 行为一致，无需特别处理

## 后续（不在本期）

- 若实测仍有性能瓶颈，考虑 IndexedDB 缓存 formField.option_list
- 若用户在编辑器侧也需要"全量查看"的更快体验，可单独评估编辑器列表虚拟化
