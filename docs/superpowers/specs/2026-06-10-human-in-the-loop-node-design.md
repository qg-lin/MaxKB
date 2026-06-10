# Human-in-the-loop Node Design

- **状态**：设计中
- **创建日期**：2026-06-10
- **目标模块**：`apps/application/flow/`、`ui/src/workflow/`、聊天窗口交互渲染

## 1. 背景

MaxKB 工作流目前已经有 `form-node` 的暂停恢复能力：节点首次执行时输出表单并中断，用户提交后通过 `runtime_node_id`、`chat_record_id`、`start_node_data` 从该节点恢复。这个机制适合结构化表单，但不适合更通用的当前聊天用户人工介入场景，例如：

1. 用户点击确认或拒绝后再走不同分支。
2. 用户从几个选项中选择一个动作。
3. 用户用一段自然语言补充信息后继续执行。

本设计新增一个通用但边界清晰的 **Human-in-the-loop 节点**。第一版仅支持当前聊天窗口里的当前用户，不涉及后台管理员、其他用户、多级审批、通知或长期异步任务。

## 2. 目标

- 工作流执行到该节点时可以暂停，并在当前聊天窗口展示交互消息。
- 当前用户完成交互后，工作流从该节点恢复执行。
- 节点把用户响应写入上下文，供后续节点引用。
- 节点可以按用户动作走不同分支。
- 第一版支持确认模式和文本补充模式。
- 底层数据结构预留后续表单、选择、多用户审批、超时、取消等扩展空间。

## 3. 非目标

- 不做后台审批台。
- 不支持其他用户或管理员代处理。
- 不做通知、催办、超时自动流转。
- 不改变简单应用的普通聊天管道。
- 不替代 `form-node`；结构化表单收集仍由 `form-node` 负责。
- 不引入新的持久化任务表；第一版复用现有 `ChatRecord.details` 和恢复链路。

## 4. 推荐方案

采用 **轻量节点 + 通用等待载荷** 的方案：

1. 新增 `human-in-the-loop-node`，作为工作流里的显式人工介入点。
2. 节点输出统一的 `interaction_payload` 给聊天端渲染。
3. 未提交用户响应时，节点中断后续执行。
4. 用户响应后，复用现有恢复参数从该节点继续执行。
5. 节点根据响应写入上下文，并可返回 `branch_id` 触发后续分支。

这个方案比直接复用 `form-node` 语义更清晰，也比一次性实现完整审批流更小。后续如果要扩展表单、审批、超时，只需增加交互类型和恢复处理，不需要重写工作流执行器。

## 5. 节点模式

### 5.1 确认模式

配置项：

- `mode`: `confirmation`
- `title`: 确认标题，支持引用变量
- `content`: 确认说明，支持引用变量
- `actions`: 按钮列表，默认包含 `confirm` 和 `reject`
- `allow_comment`: 是否允许用户填写备注，第一版默认关闭

默认按钮：

```json
[
  { "value": "confirm", "label": "确认", "branch_id": "confirm" },
  { "value": "reject", "label": "拒绝", "branch_id": "reject" }
]
```

恢复后的节点上下文：

```json
{
  "status": "submitted",
  "action": "confirm",
  "confirmed": true,
  "user_input": "",
  "comment": "",
  "submitted_at": "2026-06-10T00:00:00Z"
}
```

分支规则：

- 如果 action 配置了 `branch_id`，节点返回对应 `branch_id`。
- 如果没有配置，默认使用 action 的 `value` 作为 `branch_id`。

### 5.2 文本补充模式

配置项：

- `mode`: `text`
- `title`: 提示标题，支持引用变量
- `content`: 提示说明，支持引用变量
- `placeholder`: 输入框占位文案
- `submit_label`: 提交按钮文案
- `branch_id`: 提交后的分支，默认 `submit`

恢复后的节点上下文：

```json
{
  "status": "submitted",
  "action": "submit",
  "confirmed": null,
  "user_input": "用户补充的自然语言文本",
  "comment": "",
  "submitted_at": "2026-06-10T00:00:00Z"
}
```

文本补充节点不负责抽取字段或判断是否完整。后续可接参数提取节点、AI 节点或条件节点继续处理。

## 6. 数据模型

### 6.1 节点配置

`properties.node_data` 建议结构：

```json
{
  "mode": "confirmation",
  "title": "是否继续执行？",
  "content": "请确认是否执行下一步操作。",
  "actions": [
    { "value": "confirm", "label": "确认", "branch_id": "confirm" },
    { "value": "reject", "label": "拒绝", "branch_id": "reject" }
  ],
  "placeholder": "",
  "submit_label": "提交",
  "allow_comment": false,
  "is_result": true
}
```

### 6.2 用户响应

用户提交给恢复接口的 `start_node_data` 建议结构：

```json
{
  "interaction_type": "human_in_the_loop",
  "action": "confirm",
  "user_input": "",
  "comment": "",
  "payload": {}
}
```

`payload` 作为扩展字段保留，后续可承载表单数据、审批元数据、附件或客户端信息。

### 6.3 聊天端渲染载荷

节点首次执行时输出：

```json
{
  "interaction_type": "human_in_the_loop",
  "mode": "confirmation",
  "runtime_node_id": "<runtime_node_id>",
  "chat_record_id": "<chat_record_id>",
  "title": "是否继续执行？",
  "content": "请确认是否执行下一步操作。",
  "actions": [
    { "value": "confirm", "label": "确认" },
    { "value": "reject", "label": "拒绝" }
  ],
  "placeholder": "",
  "submit_label": "提交",
  "allow_comment": false,
  "submitted": false
}
```

第一版可以沿用类似 `form-node` 的标签包装方式，但建议使用新标签，避免和表单渲染耦合：

```text
<human_in_the_loop>{...}</human_in_the_loop>
```

## 7. 后端设计

### 7.1 节点类

新增目录：

- `apps/application/flow/step_node/human_in_the_loop_node/`
- `apps/application/flow/step_node/human_in_the_loop_node/i_human_in_the_loop_node.py`
- `apps/application/flow/step_node/human_in_the_loop_node/impl/base_human_in_the_loop_node.py`

节点类型：

```python
type = "human-in-the-loop-node"
view_type = "single_view"
support = [WorkflowMode.APPLICATION, WorkflowMode.APPLICATION_LOOP]
```

### 7.2 中断逻辑

当前 `is_interrupt` 只判断 `form-node`。本设计新增通用判断：

```python
def is_interrupt(node, step_variable, global_variable):
    return step_variable.get("status") == "waiting"
```

为降低回归风险，第一版可以不全局改造 `NodeResult`，只在 Human-in-the-loop 节点返回自定义 `_is_interrupt`：

```python
NodeResult(
  {"status": "waiting", "interaction_payload": payload},
  {},
  _write_context=write_context,
  _is_interrupt=lambda node, step_variable, global_variable: step_variable.get("status") == "waiting"
)
```

这样不影响现有 `form-node`。

### 7.3 首次执行

当 `start_node_data` 为空时：

1. 解析节点配置中的标题、说明、按钮文案。
2. 写入上下文：
   - `status = "waiting"`
   - `interaction_payload = {...}`
   - `action = None`
   - `user_input = ""`
   - `confirmed = None`
3. 输出 `<human_in_the_loop>{...}</human_in_the_loop>`。
4. 中断后续节点。

### 7.4 恢复执行

当 `start_node_data` 有值时：

1. 校验 `interaction_type == "human_in_the_loop"`。
2. 校验 action 是否在配置的 actions 中，文本模式校验 `user_input` 非空。
3. 写入上下文：
   - `status = "submitted"`
   - `action`
   - `confirmed`
   - `user_input`
   - `comment`
   - `submitted_at`
4. 返回 `branch_id`，确认模式按 action 分支，文本模式默认走 `submit` 分支。

### 7.5 运行详情

`get_details()` 保存：

- 节点名称、类型、运行状态。
- `interaction_payload`。
- 用户响应。
- `branch_id`。
- `status`。
- `run_time`。
- 错误信息。

这保证刷新页面或查看执行详情时可以还原交互卡片状态。

## 8. 前端工作流设计

### 8.1 节点注册

新增：

- `ui/src/workflow/nodes/human-in-the-loop-node/index.ts`
- `ui/src/workflow/nodes/human-in-the-loop-node/index.vue`
- `ui/src/workflow/icons/human-in-the-loop-node-icon.vue`

并注册到：

- `ui/src/workflow/common/data.ts`
- `ui/src/workflow/common/validate.ts` 如需声明分支出口规则
- 工作流类型枚举或节点字典
- i18n 文案

### 8.2 节点配置 UI

第一版配置项：

- 模式：确认 / 文本补充
- 标题
- 说明内容
- 确认模式按钮列表
- 文本模式占位提示和提交按钮
- 是否作为结果输出

确认模式下按钮列表至少保留一个按钮。默认两个按钮：确认、拒绝。

### 8.3 分支出口

确认模式建议提供动态分支出口：

- `confirm`
- `reject`
- 用户自定义 action value

文本模式提供：

- `submit`
- 可选 `exception`

如果当前图编辑器动态分支成本过高，第一版可以固定 `confirm`、`reject`、`submit` 三个出口，其中不适用的出口在配置 UI 中隐藏或禁用。

## 9. 聊天端交互设计

聊天消息渲染层新增对 `<human_in_the_loop>` 的识别：

- `confirmation`：渲染标题、说明、按钮。
- `text`：渲染标题、说明、输入框、提交按钮。

提交时复用现有聊天发送/恢复链路，携带：

- `chat_record_id`
- `runtime_node_id`
- `start_node_data`

提交后该交互卡片进入已提交状态，按钮或输入框禁用，避免重复提交。

## 10. 错误处理

| 场景 | 行为 |
|------|------|
| action 不在配置中 | 节点报错，走异常分支或返回错误 |
| 文本模式提交空文本 | 前端阻止提交；后端仍做兜底校验 |
| 重复提交同一个交互 | 前端禁用；后端以当前 `ChatRecord.details` 中已提交状态为准，避免重复继续 |
| 恢复时找不到 `runtime_node_id` | 返回恢复失败错误 |
| 节点配置缺失 | 使用默认确认配置 |
| 用户刷新页面 | 通过 `ChatRecord.answer_text_list` 和 `details` 还原已等待或已提交状态 |

## 11. 扩展预留

本设计通过 `interaction_type`、`mode`、`payload`、`status` 预留扩展点：

- `mode = "select"`：单选或多选。
- `mode = "form"`：未来可统一表单交互，但第一版仍由 `form-node` 负责。
- `mode = "approval"`：未来支持后台审批。
- `status = "timeout"`：未来支持超时。
- `status = "cancelled"`：未来支持取消。
- `payload.assignee`：未来支持指定处理人。
- `payload.attachments`：未来支持附件。

第一版不实现这些能力，但字段命名和恢复载荷不阻碍后续增加。

## 12. 测试策略

### 12.1 后端验证

- 确认模式首次执行：输出交互载荷并中断后续节点。
- 确认模式恢复：`confirm` 走确认分支，`reject` 走拒绝分支。
- 文本模式首次执行：输出文本补充载荷并中断。
- 文本模式恢复：写入 `user_input` 并走 `submit` 分支。
- 非法 action：返回错误或进入异常分支。
- 历史详情：`get_details()` 能保存等待态和提交态。

### 12.2 前端验证

- 工作流画布可以添加、保存、回显 Human-in-the-loop 节点。
- 确认模式按钮列表可编辑，默认值正确。
- 文本补充模式 UI 切换正确。
- 聊天窗口能渲染确认卡片和文本补充卡片。
- 提交后卡片禁用，并从该节点继续执行。

### 12.3 回归验证

- 现有 `form-node` 暂停和恢复不受影响。
- 普通 `reply-node`、`condition-node`、`ai-chat-node` 执行链不受影响。
- loop 内使用 Human-in-the-loop 节点时，`runtime_node_id` 带 salt 的恢复路径可用。

## 13. 实施顺序建议

1. 后端新增节点和序列化器。
2. 后端接入节点注册表。
3. 聊天端新增 `<human_in_the_loop>` 渲染和提交。
4. 前端工作流新增节点配置 UI。
5. 增加 i18n 文案。
6. 做端到端手动验证。

## 14. 风险

- 现有恢复逻辑主要由 `form-node` 使用，Human-in-the-loop 节点需要确保 `start_node_data` 不破坏旧路径。
- loop 内暂停恢复已有特殊处理，第一版实现时必须单独验证。
- 分支出口如果做动态按钮，前端图编辑器和后端 `branch_id` 需要保持一致。
- 重复提交需要前后端双重保护，否则可能导致工作流继续执行多次。
