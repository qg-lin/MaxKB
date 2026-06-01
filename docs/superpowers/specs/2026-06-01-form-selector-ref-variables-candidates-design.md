# 表单选择器引用变量+候选值设计方案

## 需求

在表单收集组件的选择器（SingleSelect、MultiSelect、RadioCard、RadioRow、MultiRow）中，当赋值方式为"引用变量"时，支持配置候选值。

- 引用变量的值作为下拉选项的数据来源
- 候选值作为静态选项也展示在下拉列表中
- 默认值仍使用引用变量的值

## 现状

当前实现中，选择器的赋值方式有两种：
- `custom`：手动配置选项列表
- `ref_variables`：通过引用变量动态获取选项（变量格式为 `[{label, value, default}, ...]`）

## 设计方案

### 数据结构变更

将 `assignment_method='ref_variables'` 拆分为两种子模式：

```javascript
{
  assignment_method: 'ref_variables',
  ref_variables_mode: 'only' | 'with_candidates',  // 新增
  option_list: ['$var', 'field'],                   // 引用变量路径
  candidate_list: [{ label: '', value: '' }, ...],  // 新增：候选值
  // existing fields...
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `assignment_method` | string | `'ref_variables'` |
| `ref_variables_mode` | string | `'only'`=纯引用变量, `'with_candidates'`=引用变量+候选值 |
| `option_list` | array | 引用变量路径（必填） |
| `candidate_list` | array | 候选值列表（ref_variables_mode=with_candidates时配置） |

### UI 变更

**选择器组件（SingleSelectConstructor.vue 等）**：

1. 当 `assignment_method == 'ref_variables'` 时，显示子模式选择：
   - `only`：纯引用变量（默认）
   - `with_candidates`：引用变量 + 候选值

2. 当 `ref_variables_mode == 'with_candidates'` 时：
   - 引用变量选择器（必填）
   - 候选值列表编辑区（与 `custom` 模式相同的选项编辑 UI）

### 后端变更

**base_form_node.py - reset_field 方法**：

当 `assignment_method == 'ref_variables'` 且 `ref_variables_mode == 'with_candidates'` 时：
1. 获取引用变量的值作为基础选项列表
2. 合并 `candidate_list` 中的候选值
3. 去重（引用变量值优先，候选值去重）

```python
# 伪代码逻辑
if field.get('assignment_method') == 'ref_variables':
    if field.get('ref_variables_mode') == 'with_candidates':
        option_list = workflow_manage.get_reference_field(field.get('option_list')[0], field.get('option_list')[1:])
        candidate_list = field.get('candidate_list', [])
        # 合并并去重
        option_list = merge_options(option_list, candidate_list)
    else:
        option_list = workflow_manage.get_reference_field(...)
```

## 涉及文件

### 前端
- `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`（如果存在）
- `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`（如果存在）
- `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`（如果存在）

### 后端
- `apps/application/flow/step_node/form_node/impl/base_form_node.py`

## 测试要点

1. **纯引用变量模式**：验证现有行为不受影响
2. **引用变量+候选值模式**：
   - 引用变量值和候选值都正确展示
   - 无重复选项
   - 默认值正确（使用引用变量值）
3. **渲染恢复**：重新打开已配置节点的编辑页面，数据正确回显
