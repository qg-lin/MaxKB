# 表单选择器CSV导入候选值设计方案

## 需求

在表单选择器（SingleSelect、MultiSelect、RadioCard、RadioRow、MultiRow）的选项编辑区，添加"导入CSV"按钮，支持批量导入候选值。

## CSV格式

```csv
label,value
同行,同行
直客,直客
指定货,指定货
```

要求CSV列头必须为 `label` 和 `value`。

## 交互流程

1. 用户点击"导入CSV"按钮
2. 弹出文件选择框（只接受.csv文件）
3. 上传到后端解析
4. 成功：合并去重后更新列表，提示成功数量
5. 失败：提示错误信息，不更新列表

## 后端接口

```
POST /api/application/form-node/parse-csv
Content-Type: multipart/form-data
file: CSV文件

响应：
- 成功：{code: 200, message: "Success", data: [{label, value}, ...]}
- 失败：{code: 500, message: "解析失败：xxx"}
```

## 去重逻辑

导入的选项与现有选项合并时，基于 `value` 字段去重，**已有选项保留**。

## 涉及文件

### 后端新增
- `apps/application/flow/step_node/form_node/serializers.py` — 新增CSV解析方法

### 前端修改
- `ui/src/components/dynamics-form/constructor/items/SingleSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiSelectConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioCardConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/RadioRowConstructor.vue`
- `ui/src/components/dynamics-form/constructor/items/MultiRowConstructor.vue`

## 页面提示

CSV文件列头必须为 `label` 和 `value`。
