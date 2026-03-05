# Story 3.1: SSE 实时推流式推理响应

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 终端最终用者,
I want 发送提问后能立刻像打字机一样接收到 AI 推理输出字符流,
so that 我不需要像传统调用一样干等好几秒才一次性得到几千字，缓解我的等待焦躁感.

## Acceptance Criteria

1. **Given** 网络连通且对话引擎后端 TTFT（首字节延时）小于 500ms，**When** 终端用户发送一句话质询给机器人，**Then** 前端应用应立刻通过读取 Server-Sent Events (SSE) 协议展示流式包裹的内容，呈现逐字渲染的打字机效果。
2. **Given** 用户发起对话请求，**When** 后端处理 AI 推理时，**Then** 后端必须利用非阻塞方式推发 SSE 协议（不得使用 WebSocket 长连接），HTTP Worker 线程不得被阻塞。
3. **Given** SSE 流式响应正在进行，**When** AI 推理完成时，**Then** 后端须发送带有 `"is_end": true` 标记的最终 chunk，前端正确识别结束信号并停止流式渲染。
4. **Given** SSE 流式推理过程中发生异常，**When** 后端捕获到错误，**Then** 后端须将错误内容作为最终 chunk 发送（`is_end: true`），前端展示错误信息而非白屏挂死。
5. **Given** 前端开始发送对话请求，**When** 请求发出至 SSE 流结束，**Then** UI 组件必须维持 `loading` 状态（loading.value = true）并阻止重复提交。

## Tasks / Subtasks

> **⚠️ 棕地项目注意**：SSE 基础架构已在生产代码中存在。本故事重点是**验证、测试覆盖与潜在缺口修复**，而非重新造轮子。开发前必须先阅读下方"Dev Notes"中的现有实现说明。

- [ ] Task 1：理解并验证现有 SSE 后端实现（AC: #1, #2）
  - [ ] 阅读 `apps/application/flow/tools.py` 中的 `event_content()` 和 `to_stream_response()` 函数
  - [ ] 阅读 `apps/chat/views/chat.py` 中的 `ChatView.post()` 入口逻辑
  - [ ] 确认 `StreamingHttpResponse` 正确使用 `content_type='text/event-stream;charset=utf-8'` 及 `Cache-Control: no-cache`
  - [ ] 确认后端不阻塞 HTTP worker（Celery / 生成器惰性求值模式）
- [ ] Task 2：验证 SSE 数据格式规范合规性（AC: #1, #3）
  - [ ] 确认每条 SSE chunk 格式为 `data: {"chat_id":"...","id":"...","operate":true,"content":"...","is_end":false}\n\n`
  - [ ] 确认最终结束包为 `data: {"chat_id":"...","id":"...","operate":true,"content":"","is_end":true}\n\n`
  - [ ] 确认所有 JSON 使用 `ensure_ascii=False` 以正确支持中文
- [ ] Task 3：验证前端 SSE 流式读取逻辑（AC: #1, #3, #5）
  - [ ] 阅读 `ui/src/components/ai-chat/index.vue` 中的 `getWrite()` 函数
  - [ ] 验证 ReadableStream 缓冲区正则匹配 `/data:.*?}\n\n/g` 能正确处理分片 chunk
  - [ ] 确认 PR #4796 的修复（`return write()` 替代 `return reader.read().then(write)`）已合并在当前代码中
  - [ ] 确认 `loading.value = true` 在请求发出前设置，流结束后重置（AC: #5）
- [ ] Task 4：验证错误处理路径（AC: #4）
  - [ ] 确认 `event_content()` 的 `except` 块将异常字符串以 `is_end: true` 形式发送
  - [ ] 在前端测试当 SSE 返回错误时 UI 的呈现行为（展示错误消息，非挂死）
- [ ] Task 5：编写/补全后端测试（AC: #1~#4）
  - [ ] 在 `apps/chat/tests.py` 或 `apps/application/tests.py` 中为 `ChatView.post()` 添加集成测试
  - [ ] 测试正常流式响应（验证 StreamingHttpResponse + SSE 格式）
  - [ ] 测试异常情况下的错误 chunk 输出
  - [ ] 测试 is_end 标记的正确发送时机
- [ ] Task 6：TTFT 性能基准验证（AC: #1 中的 <500ms 要求）
  - [ ] 在本地环境发起对话请求，测量从 POST 请求发出到首个非空 SSE chunk 到达前端的延时
  - [ ] 如发现性能瓶颈（> 500ms），记录在 Dev Agent Record 中并提出优化建议

## Dev Notes

### ⚠️ 棕地背景：这是一个增强/验证故事

本故事对应的 SSE 流式推理功能**在生产代码库中已有完整实现**。开发工作的重点是：

1. **验证**：确认现有实现完全满足所有 AC
2. **测试覆盖**：补全缺失的测试用例
3. **缺口修复**：如发现不符合 AC 的地方，进行最小化修复
4. **文档**：在 Dev Agent Record 中记录验证结果

**禁止**：不要重写已正常工作的 SSE 逻辑，不要切换为 WebSocket，不要引入新的流式库。

---

### 现有 SSE 后端实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| SSE 生成器与响应转换 | `apps/application/flow/tools.py` |
| 对话入口 View | `apps/chat/views/chat.py` |
| 对话 Serializer | `apps/chat/serializers/chat.py` |
| 对话 URL 路由 | `apps/chat/urls.py` |
| ChatRecord 模型 | `apps/application/models/application_chat.py` |

#### SSE 生成器：`event_content()`

位于 `apps/application/flow/tools.py`，第 142~169 行：

```python
def event_content(chat_id, chat_record_id, response, workflow, write_context, post_handler):
    answer = ''
    try:
        for chunk in response:          # response 是 LLM 的流式迭代器
            answer += chunk.content
            yield 'data: ' + json.dumps({
                'chat_id': str(chat_id),
                'id': str(chat_record_id),
                'operate': True,
                'content': chunk.content,
                'is_end': False
            }, ensure_ascii=False) + "\n\n"
        write_context(answer, 200)      # 将完整答案写入上下文（供下游节点使用）
        post_handler.handler(...)       # 后置处理：保存记录、更新状态
        yield 'data: ' + json.dumps({
            'chat_id': str(chat_id), 'id': str(chat_record_id),
            'operate': True, 'content': '', 'is_end': True
        }, ensure_ascii=False) + "\n\n"
    except Exception as e:
        answer = str(e)
        write_context(answer, 500)
        post_handler.handler(...)
        yield 'data: ' + json.dumps({
            'chat_id': str(chat_id), 'id': str(chat_record_id),
            'operate': True, 'content': answer, 'is_end': True
        }, ensure_ascii=False) + "\n\n"
```

#### SSE 响应包装：`to_stream_response()`

位于 `apps/application/flow/tools.py`，第 172~190 行：

```python
def to_stream_response(chat_id, chat_record_id, response, workflow, write_context, post_handler):
    r = StreamingHttpResponse(
        streaming_content=event_content(...),
        content_type='text/event-stream;charset=utf-8',
        charset='utf-8')
    r['Cache-Control'] = 'no-cache'
    return r
```

#### API 路由

```
POST /chat/api/chat_message/{chat_id}   → ChatView （对话主入口）
PATCH /chat/api/vote/chat/{chat_id}/chat_record/{chat_record_id} → VoteView（赞踩，属于 Story 3.3）
```

#### SSE 数据格式（精确规范）

```
# 中间 chunk（每个 token 或多个 token）
data: {"chat_id": "<uuid>", "id": "<record_uuid>", "operate": true, "content": "推理文本片段", "is_end": false}\n\n

# 最终结束包
data: {"chat_id": "<uuid>", "id": "<record_uuid>", "operate": true, "content": "", "is_end": true}\n\n

# 错误情况（is_end=true，content 为错误描述）
data: {"chat_id": "<uuid>", "id": "<record_uuid>", "operate": true, "content": "错误信息", "is_end": true}\n\n
```

---

### 现有前端 SSE 实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| 主对话组件（SSE 读取） | `ui/src/components/ai-chat/index.vue` |
| 答案内容渲染 | `ui/src/components/ai-chat/component/answer-content/index.vue` |
| 操作按钮（赞踩入口） | `ui/src/components/ai-chat/component/operation-button/ChatOperationButton.vue` |
| Chat API 封装 | `ui/src/api/` （需确认具体文件名） |

#### 前端 SSE 读取方式

**重要**：前端使用的是 `fetch` + `ReadableStream` API，**不是** `EventSource`。
原因：EventSource 不支持 POST 请求和自定义 Headers（Bearer Token 鉴权），而 fetch 支持。

```typescript
// ui/src/components/ai-chat/index.vue 中的核心逻辑（简化示意）
const getWrite = (chat, reader, stream) => {
  let tempResult = ''

  const write_stream = async () => {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      tempResult += new TextDecoder().decode(value)
      // 正则匹配完整的 SSE 数据包（处理网络分片）
      const split = tempResult.match(/data:.*?}\n\n/g)

      if (split) {
        for (const item of split) {
          const chunk = JSON.parse(item.replace('data:', ''))
          ChatManagement.appendChunk(chat.id, chunk)  // 累积内容到状态
          if (chunk.is_end) return Promise.resolve()  // 结束信号
        }
        // 移除已处理的数据，保留未完整接收的 buffer
        tempResult = tempResult.replace(split.join(''), '')
      }
    }
  }

  return stream ? write_stream : write_json
}
```

#### ⚠️ 关键 Bug 修复（PR #4796，已合并）

提交 `98c558f30` 修复了工作流对话无法完整输出内容的问题：

```typescript
// ❌ 修复前（导致最后一个 chunk 丢失）：
return reader.read().then(write)

// ✅ 修复后（让 while 循环自然完成）：
return write()
```

开发时**确认**此修复已在代码中，不要回退。

---

### 架构约束与强制规则

参见 `_bmad-output/planning-artifacts/architecture.md`：

1. **SSE 不得换成 WebSocket**：PRD 和架构文档明确规定使用 SSE（`text/event-stream`），禁止改用 WebSocket。
2. **不得阻塞 HTTP Worker**：长事务（LLM 推理）必须通过生成器惰性求值或 Celery 任务完成，不得在 Django View 中同步等待。
3. **API 调用封装规范**：前端所有 HTTP 请求必须通过 `ui/src/api/` 中的封装函数发起，由 Axios 拦截器注入 Bearer Token，不得在 Vue 组件内直接调用 fetch/axios。
4. **loading 状态管理**：`loading.value = true` 必须在请求发出前设置，请求完成（无论成功/失败）后重置。
5. **API 响应格式**：普通 REST 响应使用标准格式 `{"code": 200, "message": "success", "data": {...}}`；SSE 响应格式见上文。
6. **Celery 任务隔离**：凡可能运行超过几百毫秒的任务（如大型知识库检索），应转移至 Celery；轻量推理的流式生成器在 HTTP 进程内通过 Python 生成器实现，这是可接受的（Django StreamingHttpResponse 不阻塞其他请求）。
7. **命名规范**：后端所有字段使用 `snake_case`（`chat_id`, `chat_record_id`），前端 TypeScript 接口按需使用 `camelCase`。

---

### 完整数据流（端到端）

```
[用户输入] → POST /chat/api/chat_message/{chat_id}
                ↓
           ChatView.post() (apps/chat/views/chat.py)
                ↓
           ChatSerializers.chat() (apps/chat/serializers/chat.py)
                ↓
           WorkflowManage.run() (apps/application/ 工作流引擎)
                ↓
           各 Step 节点执行（含 AI Chat Step → LLM 流式调用）
                ↓
           LangChain BaseMessageChunk 迭代器（惰性）
                ↓
           to_stream_response() → StreamingHttpResponse
                ↓
           event_content() 生成器（边迭代 LLM 输出，边 yield SSE chunk）
                ↓
           HTTP 响应流（text/event-stream）
                ↓
           [前端] fetch + ReadableStream.getReader()
                ↓
           getWrite() → 正则提取 SSE 数据包
                ↓
           ChatManagement.appendChunk() → Pinia 状态更新
                ↓
           Vue 响应式渲染（打字机效果）
```

---

### 相关历史 Bug（近期修复，了解避坑）

| PR / Commit | 问题描述 | 修复要点 |
|-------------|---------|---------|
| #4796 (`98c558f30`) | 工作流对话最后 chunk 不输出完整内容 | 前端流读取递归改为 while 循环 |
| #4797 / #4798 (`c3fe1a1`, `3378b54`) | 并行节点后的 AI 对话节点在不同分支首次到达时上下文不同步 | 修复工作流引擎中并行节点上下文传播 |
| `bbd9718c8` | Huge chunk write error | 大 chunk 写入错误修复（检查 write_context 的大小限制） |

---

### 测试策略

#### 后端测试（Python）

位置：`apps/chat/tests.py` 或 `apps/application/tests.py`

```python
# 测试要点示例
class SSEStreamingTestCase(TestCase):
    def test_chat_returns_streaming_response(self):
        # 验证 ChatView.post() 返回 StreamingHttpResponse
        # 验证 content_type 包含 text/event-stream
        pass

    def test_sse_chunk_format(self):
        # 验证每条 chunk 格式：data: {...}\n\n
        # 验证必填字段：chat_id, id, operate, content, is_end
        pass

    def test_sse_final_chunk_is_end_true(self):
        # 验证最后一条 chunk 的 is_end=True, content=''
        pass

    def test_sse_error_handling(self):
        # 模拟 LLM 抛出异常
        # 验证错误内容以 is_end=True 形式发送（不挂死）
        pass
```

#### 测试框架

- 后端：Django 原生 `TestCase`，使用 `mock.patch` 模拟 LLM 调用
- 前端：（本故事不强制要求，但可添加 Vitest 单元测试验证 `getWrite` 函数）

---

### TTFT 性能验证方法

TTFT（Time To First Token）要求 < 500ms（NFR1）。

**本地验证方法**：
```bash
# 使用 curl 测量首字节延时
curl -o /dev/null -s -w "Time to first byte: %{time_starttransfer}s\n" \
  -X POST http://localhost:8000/chat/api/chat_message/{chat_id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "你好"}'
```

主要性能瓶颈可能来自：
- LLM 接入层初始化（`models_provider/` 适配器）
- 知识库向量检索（若流程包含 RAG 节点）
- Django ORM 查询（ChatRecord 创建等）

---

### Project Structure Notes

**本故事涉及目录对照（参见 architecture.md）**：

```
apps/
  chat/                        ← 对话入口、历史记录
    views/chat.py              ← ChatView（SSE 响应出口）
    serializers/chat.py        ← 对话序列化、工作流调度
    urls.py                    ← URL 路由
  application/
    flow/tools.py              ← event_content() + to_stream_response()
    models/application_chat.py ← ChatRecord 模型（含 vote_status 字段）

ui/src/
  components/ai-chat/
    index.vue                  ← 主对话组件（SSE 读取核心）
    component/answer-content/  ← 打字机效果渲染
    component/operation-button/← 赞踩按钮（Story 3.3 相关）
  api/                         ← Chat API 封装（须通过此处调用）
  stores/                      ← Pinia chat 状态管理
```

**禁止触碰**（范围外）：
- `apps/knowledge/` — 向量库（Epic 1 已完成）
- `ui/src/workflow/` — 画布编排（Epic 2 已完成）
- `apps/system_manage/` — 权限管理（Epic 5 范围）

### References

- SSE 生成器实现：[apps/application/flow/tools.py](apps/application/flow/tools.py) — `event_content()` 第 142 行，`to_stream_response()` 第 172 行
- 对话 API 路由：[apps/chat/urls.py](apps/chat/urls.py)
- 前端对话组件：[ui/src/components/ai-chat/index.vue](ui/src/components/ai-chat/index.vue)
- 架构约束：[_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md) — SSE/Celery/API 规范章节
- PRD FR9：[_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md) — 第 122 行

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6[1m]

### Debug Log References

- PR #4796 修复（commit `98c558f30`）：前端流读取递归 → while 循环，解决最后 chunk 丢失
- PR #4797/#4798（commit `c3fe1a1`, `3378b54`）：并行节点上下文同步修复

### Completion Notes List

- [ ] 验证现有 SSE 实现满足所有 AC（Task 1-4）
- [ ] 后端测试补全并通过（Task 5）
- [ ] TTFT 性能基准验证完成（Task 6）

### File List

> 预期修改/新增（仅限验证和测试补全）：
- `apps/chat/tests.py` 或 `apps/application/tests.py`（新增 SSE 测试用例）
- 如发现实现缺口，可能涉及：`apps/application/flow/tools.py`、`apps/chat/views/chat.py`
- 如发现前端缺口，可能涉及：`ui/src/components/ai-chat/index.vue`
