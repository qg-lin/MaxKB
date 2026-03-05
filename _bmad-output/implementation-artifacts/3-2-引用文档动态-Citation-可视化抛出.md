# Story 3.2: 引用文档动态 Citation 可视化抛出

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 终端最终用者,
I want 能在系统回复消息下方清晰地看到它参考了哪几个特定文档的部分原文并可以点亮高亮,
so that 我能通过追溯原始依据来信任平台给出的答案，杜绝所谓的 AI 大厂'幻觉'现象.

## Acceptance Criteria

1. **Given** 某问题的回答引用了知识库中的文档片段，**When** AI 回答渲染完毕（SSE `is_end:true` 触发后），**Then** 消息气泡下方应展示"知识来源"区域，含"引用段落 N"按钮，N 为引用段落数量。
2. **Given** 后端工作流包含 `search-knowledge-node` 或 `reranker-node` 节点，**When** 节点设置 `show_knowledge=True`，**Then** 该节点提取的 `paragraph_list` 应被合并至对话记录的引用数据集。
3. **Given** `ApplicationAccessToken.show_source = True`（或处于 `debug-ai-chat`/`log` 模式），**When** 前端渲染 `KnowledgeSourceComponent`，**Then** 引用卡片列表（含文件类型图标、文档名）应正确显示，**且** `application.show_source = False` 时引用区域应完全隐藏。
4. **Given** 引用数据已展示，**When** 用户点击"引用段落 N"按钮，**Then** 弹出 Dialog 以相似度排序展示详细段落原文内容（`ParagraphSourceContent`）。
5. **Given** 引用数据来源于答疑 API（`getChatRecord`），**When** SSE 流结束后调用该接口，**Then** 响应数据应包含 `paragraph_list`（按 `id` 去重的合并段落列表）和 `knowledge_list`（知识库来源摘要列表）。

## Tasks / Subtasks

> **⚠️ 棕地项目注意**：Citation 可视化基础架构已在生产代码中存在。本故事重点是**验证端到端数据流、测试覆盖与潜在缺口修复**，而非重新造轮子。

- [ ] Task 1：验证后端 `ChatRecordView` → `reset_chat_record()` 数据提取路径（AC: #1, #2, #5）
  - [ ] 阅读 `apps/chat/views/chat.py` 中的 `ChatRecordView.get()` 方法，确认其调用 `ApplicationChatRecordQuerySerializers.reset_chat_record(chat_record, show_source, show_exec)` 并正确传入 `show_source` 标志
  - [ ] 在 `apps/application/serializers/application_chat_record.py` 的 `reset_chat_record()` 中确认三条引用数据提取路径均正常工作：
    - 路径①（遗留）：`chat_record.details['search_step']['paragraph_list']`
    - 路径②（主流）：`type == 'search-knowledge-node' AND show_knowledge=True` → `item['paragraph_list']`
    - 路径③（重排序）：`type == 'reranker-node' AND show_knowledge=True` → `item['result_list'][*]['metadata']`（需含 `document_id` 和 `knowledge_id`）
  - [ ] 确认段落列表按 `id` 字段去重：`list({p.get('id'): p for p in paragraph_list}.values())`
  - [ ] 确认 `knowledge_list` 由 `paragraph_list` 聚合生成，含 `id`、`knowledge_name`、`knowledge_type` 字段
- [ ] Task 2：验证 `ApplicationAccessToken.show_source` 配置对引用显示的控制（AC: #3）
  - [ ] 确认 `ApplicationAccessToken` 模型中 `show_source` 字段的默认值（预期为 `True`）
  - [ ] 确认 `ChatRecordOperateSerializer.one()` 读取 `show_source` 并传给 `reset_chat_record()`
  - [ ] 测试：`show_source=True` 时响应含 `paragraph_list`；`show_source=False` 时响应不含 `paragraph_list`
- [ ] Task 3：验证前端 SSE 后自动触发 `getSourceDetail` 的链路（AC: #1, #5）
  - [ ] 确认 `ui/src/components/ai-chat/index.vue` 第 593 行：SSE `write()` Promise resolve 后，`.then(() => { getSourceDetail(chat) })` 无条件调用
  - [ ] 确认 `getSourceDetail()` 调用 `chatAPI.getChatRecord(chat.chat_id, chat.record_id)` → `GET /chat/api/historical_conversation/{chat_id}/record/{chat_record_id}`
  - [ ] 确认返回数据通过 `row[key] = res.data[key]` 合并到 `chat` 响应式对象（排除 `answer_text`、`id`、`answer_text_list`）
- [ ] Task 4：验证前端 `KnowledgeSourceComponent` 渲染逻辑（AC: #3, #4）
  - [ ] 阅读 `ui/src/components/ai-chat/component/answer-content/index.vue`，找到 `showSource(chatRecord)` 函数，确认其逻辑（预期：检查 `paragraph_list?.length > 0` 或 `execution_details`）
  - [ ] 验证 `KnowledgeSourceComponent` 中 `application.show_source` prop 的控制逻辑：
    - `type === 'log'` 或 `'debug-ai-chat'`：强制显示（忽略 `show_source`）
    - 其他类型：仅当 `application.show_source === true` 时显示
  - [ ] 确认 `uniqueParagraphList` computed property 按 `document_name.trim()` 去重（前端显示层去重，与后端 `id` 去重不冲突）
  - [ ] 确认 `meta` 字段处理：若 `typeof paragraph.meta === 'string'`，需 `JSON.parse()` 转换
  - [ ] 验证"引用段落 N"按钮点击后打开 Dialog，展示 `ParagraphSourceContent`，段落按 `similarity` 字段降序排列
- [ ] Task 5：验证文件类型图标渲染（AC: #3）
  - [ ] 确认 Web 链接段落（`meta.source_file_id` 或 `meta.source_url`）显示 `web-link-icon.svg`
  - [ ] 确认其他文档类型通过 `getImgUrl(document_name)` 获取对应图标
  - [ ] 确认 PDF 文件（`document_name.endsWith('.pdf') AND meta.source_file_id AND executionIsRightPanel`）显示可点击文档预览链接
- [ ] Task 6：编写/补全后端测试（AC: #1, #2, #5）
  - [ ] 在 `apps/application/tests.py` 或 `apps/chat/tests.py` 中为 `reset_chat_record()` 添加单元测试：
    - 测试路径①（search_step）的 paragraph 提取
    - 测试路径②（search-knowledge-node with show_knowledge=True）的提取
    - 测试路径③（reranker-node with show_knowledge=True）的提取
    - 测试 `id` 去重逻辑
    - 测试 `show_source=False` 时响应不含 `paragraph_list`
  - [ ] 测试 `ChatRecordView.get()` 返回正确的 `paragraph_list` 结构（含必须字段）

## Dev Notes

### ⚠️ 棕地背景：这是一个验证/修复故事

本故事对应的 Citation 可视化基础架构**在生产代码中已有完整实现**。开发工作重点：
1. **验证**：确认端到端数据流完全符合所有 AC
2. **测试覆盖**：补全缺失的测试用例
3. **缺口修复**：发现不符合 AC 的地方进行最小化修复

**禁止**：不要重写已有 KnowledgeSourceComponent，不要改变 Citation 数据模型，不要修改 SSE 流本身。

---

### 完整端到端 Citation 数据流

```
[SSE 流完成: is_end=true]
        ↓
  write() Promise resolve  (ui/src/components/ai-chat/index.vue:586-587)
        ↓
  .then(() => getSourceDetail(chat))  (index.vue:593) ← 无条件调用
        ↓
  getChatRecordDetailsAPI(row)
  → chatAPI.getChatRecord(chat_id, record_id)  (index.vue:390)
  → GET /chat/api/historical_conversation/{chat_id}/record/{chat_record_id}
        ↓
  ChatRecordView.get()  (apps/chat/views/chat.py)
  → ChatRecordOperateSerializer.one(debug=False)
  → ApplicationChatRecordQuerySerializers.reset_chat_record(
        chat_record,
        show_source=token.show_source,
        show_exec=token.show_exec
    )  (apps/application/serializers/application_chat_record.py:124)
        ↓
  reset_chat_record() 提取 paragraph_list:
    ├── chat_record.details['search_step']['paragraph_list']  ← 路径①
    ├── details[*][type='search-knowledge-node', show_knowledge=True]['paragraph_list']  ← 路径②
    └── details[*][type='reranker-node', show_knowledge=True]['result_list'][*]['metadata']  ← 路径③
  按 id 去重 → 生成 knowledge_list
        ↓
  响应: { paragraph_list: [...], knowledge_list: [...], execution_details: [...], ... }
        ↓
  getSourceDetail() 将数据合并到 chat 响应式对象  (index.vue:401-407)
  row['paragraph_list'] = res.data['paragraph_list']
        ↓
  AnswerContent.vue 渲染:
  <KnowledgeSourceComponent :data="chatRecord" v-if="showSource(chatRecord)" />
        ↓
  KnowledgeSourceComponent 显示:
  - 引用来源区域（受 application.show_source 控制）
  - 执行详情区域（受 application.show_exec 控制）
  - 文档卡片列表（uniqueParagraphList，按 document_name 去重）
```

---

### 现有后端 Citation 实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| Citation 数据提取核心 | `apps/application/serializers/application_chat_record.py` → `reset_chat_record()` |
| 对话记录详情 API View | `apps/chat/views/chat.py` → `ChatRecordView` |
| Chat 模型（含 details 字段）| `apps/application/models/application_chat.py` |
| AccessToken 配置（show_source）| `apps/application/models/` → `ApplicationAccessToken` |

#### `reset_chat_record()` 核心逻辑（第 124-173 行）

```python
@staticmethod
def reset_chat_record(chat_record, show_source, show_exec):
    paragraph_list = []
    knowledge_list = []

    # 路径①：遗留的 search_step 路径
    if 'search_step' in chat_record.details:
        paragraph_list = chat_record.details.get('search_step').get('paragraph_list', [])

    # 路径②③：遍历所有 details 节点（含 loop-node 内嵌）
    for item in [*chat_record.details.values(),
                 *get_loop_workflow_node(chat_record.details)]:
        if item.get('type') == 'search-knowledge-node' and item.get('show_knowledge', False):
            paragraph_list += item.get('paragraph_list') or []
        if item.get('type') == 'reranker-node' and item.get('show_knowledge', False):
            paragraph_list += [rl.get('metadata') for rl in (item.get('result_list') or [])
                               if 'document_id' in (rl.get('metadata') or {})
                               and 'knowledge_id' in (rl.get('metadata') or {})]

    # 按 id 去重
    paragraph_list = list({p.get('id'): p for p in paragraph_list}.values())

    # 生成 knowledge_list（唯一知识库来源）
    knowledge_list = [{'id': k_id, **k} for k_id, k in reduce(...).items()]

    # 条件返回
    show_source_dict = {'knowledge_list': knowledge_list, 'paragraph_list': paragraph_list}
    return {
        **ChatRecordSerializerModel(chat_record).data,
        'padding_problem_text': ...,
        **(show_source_dict if show_source else {}),  # ← show_source 控制点
        **(show_exec_dict if show_exec else show_exec_dict),
    }
```

**注意**：`show_exec_dict` 无论 `show_exec` 是否为 True 都会返回（当前实现），但 `start-node` 之外的节点详情仅在 `show_exec=True` 时包含。

#### API 路由

```
GET /chat/api/historical_conversation/{chat_id}/record/{chat_record_id}
  → ChatRecordView.get()
  → ChatRecordOperateSerializer.one(debug=False)
  → reset_chat_record(show_source=token.show_source, show_exec=token.show_exec)
```

#### paragraph_list 数据结构

```json
{
  "id": "<uuid>",
  "document_id": "<uuid>",
  "document_name": "公司规章制度.pdf",
  "knowledge_id": "<uuid>",
  "knowledge_name": "企业知识库",
  "knowledge_type": "0",
  "similarity": 0.87,
  "content": "具体段落文本内容...",
  "meta": {
    "source_file_id": "<file_id 或 null>",
    "source_url": "<URL 或 null>",
    "allow_download": true
  }
}
```

---

### 现有前端 Citation 实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| SSE 后触发 Citation 获取 | `ui/src/components/ai-chat/index.vue` 第 589-603 行 |
| 数据合并到 chat 对象 | `ui/src/components/ai-chat/index.vue` 第 399-407 行 `getSourceDetail()` |
| Citation 展示主组件 | `ui/src/components/ai-chat/component/knowledge-source-component/index.vue` |
| 段落详情弹窗 | `ui/src/components/ai-chat/component/knowledge-source-component/ParagraphSourceContent.vue` |
| 执行详情弹窗 | `ui/src/components/ai-chat/component/knowledge-source-component/ExecutionDetailContent.vue` |
| Answer 渲染（含 KnowledgeSource） | `ui/src/components/ai-chat/component/answer-content/index.vue` 第 43-53 行 |
| Chat REST API 封装 | `ui/src/api/chat/chat.ts` → `getChatRecord()` 第 252-258 行 |

#### SSE 后 Citation 触发（index.vue 第 568-611 行）

```typescript
getChatMessageAPI()(chartOpenId.value, obj)
  .then((response) => {
    // ... 获取 SSE reader
    return write()  // SSE 流读取
  })
  .then(() => {
    if (props.chatId === 'new') emit('refresh', chartOpenId.value)
    getSourceDetail(chat)  // ← SSE 结束后无条件触发 Citation 获取
  })
  .finally(() => {
    ChatManagement.close(chat.id)
  })
```

#### getSourceDetail 实现（index.vue 第 399-407 行）

```typescript
function getSourceDetail(row: any) {
  return getChatRecordDetailsAPI(row).then((res) => {
    const exclude_keys = ['answer_text', 'id', 'answer_text_list']
    Object.keys(res.data).forEach((key) => {
      if (!exclude_keys.includes(key)) {
        row[key] = res.data[key]  // 将 paragraph_list 等合并到 chat 响应式对象
      }
    })
  })
}
```

#### KnowledgeSourceComponent 渲染条件（answer-content/index.vue 第 52 行）

```vue
<KnowledgeSourceComponent
  :data="chatRecord"
  :application="application"
  :type="type"
  v-if="showSource(chatRecord) && index === chatRecord.answer_text_list.length - 1"
/>
```
*仅在最后一个 answer block 后显示 Citation 区域。*

#### KnowledgeSourceComponent 可见性控制（knowledge-source-component/index.vue）

```vue
<!-- 引用来源区域 -->
<div v-if="type === 'log' || type === 'debug-ai-chat' ? true : application.show_source">
  <!-- 文档卡片列表 -->
</div>

<!-- 执行详情区域 -->
<div v-if="type === 'log' || type === 'debug-ai-chat' ? true : application.show_exec">
  <!-- tokens 消耗、运行时间、执行详情按钮 -->
</div>
```

#### uniqueParagraphList（前端显示层去重逻辑）

```typescript
const uniqueParagraphList = computed(() => {
  const seen = new Set()
  return props.data.paragraph_list?.filter((paragraph: any) => {
    const key = paragraph.document_name.trim()  // 按文档名去重（非 id）
    if (seen.has(key)) return false
    seen.add(key)
    // meta 字段可能是字符串形式，需要 JSON.parse
    if (paragraph.meta && typeof paragraph.meta === 'string') {
      paragraph.meta = JSON.parse(paragraph.meta)
      paragraph.source_url = paragraph.meta.source_url
    }
    return true
  }) || []
})
```

---

### 架构约束与强制规则

参见 `_bmad-output/planning-artifacts/architecture.md`：

1. **API 调用封装**：`getChatRecord` 必须通过 `ui/src/api/chat/chat.ts` 封装调用，不得在 Vue 组件内直接调用 fetch/axios。
2. **命名规范**：后端 `paragraph_list`、`knowledge_list`、`show_source` 均为 `snake_case`；前端 TypeScript 接口可按需使用 `camelCase`。
3. **loading 状态**：`getSourceDetail` 调用不会设置全局 `loading`，这是正确的——Citation 数据是流结束后的后台增强获取，不应阻塞 UI 交互。
4. **show_source 默认值**：`ApplicationAccessToken.show_source` 默认应为 `True`，确保开箱即用时 Citation 可见。
5. **不得修改 SSE 流**：Citation 数据通过独立的 REST 调用获取，不得修改 SSE 协议加入 citation chunk，保持两条链路解耦。

---

### Story 3.1 关键学习与遗留问题

| 类型 | 内容 | 对 3.2 的影响 |
|------|------|-------------|
| Bug Fix (PR #4796) | SSE 流最后 chunk 丢失修复 | `is_end=true` 现在可靠触发，`getSourceDetail` 会被正确调用 |
| Bug Fix (PR #4797/#4798) | 并行节点上下文同步 | `chat_record.details` 现在包含所有节点的完整数据，`search-knowledge-node` 路径数据可靠 |
| 架构确认 | SSE 流不包含 citation 数据 | Citation 通过独立 REST 调用获取，这是设计决策 |
| 测试空白 | Story 3.1 需补充 `apps/chat/tests.py` | Story 3.2 应为 `reset_chat_record()` 补充测试 |

---

### 关键风险与注意事项

1. **`show_source` 默认值**：若 `ApplicationAccessToken.show_source` 默认 `False`，新创建的应用将看不到 Citation，需确认默认值。
2. **`loop-node` 支持**：`reset_chat_record()` 已通过 `get_loop_workflow_node()` 处理 loop 节点内嵌的 `search-knowledge-node`，需验证此路径是否有测试覆盖。
3. **`meta` 字段类型**：前端 `uniqueParagraphList` 中有 `typeof paragraph.meta === 'string'` 检查并做 `JSON.parse()`，说明后端可能在某些路径下返回字符串化的 meta，需验证一致性。
4. **`getSourceDetail` 失败处理**：当前实现中 `getSourceDetail` 的 Promise rejection 不会显示错误（仅静默失败），确认这是否可接受（Citation 数据获取失败不影响主流程）。
5. **Debug/Log 模式特殊处理**：`type === 'debug-ai-chat'` 时走 `chatLogApi.getChatRecordDetails()` 而非 `chatAPI.getChatRecord()`，两个接口的响应格式需保持一致。

---

### 测试策略

#### 后端测试（Python）

位置：`apps/application/tests.py` 或新建 `apps/application/tests/test_chat_record.py`

```python
class ResetChatRecordTestCase(TestCase):
    def setUp(self):
        # 创建 ChatRecord 测试数据
        pass

    def test_search_step_path(self):
        """验证路径①：search_step paragraph 提取"""
        chat_record.details = {
            'search_step': {
                'paragraph_list': [{'id': 'p1', 'document_name': 'doc1.pdf', ...}]
            }
        }
        result = ApplicationChatRecordQuerySerializers.reset_chat_record(
            chat_record, show_source=True, show_exec=False
        )
        assert 'paragraph_list' in result
        assert len(result['paragraph_list']) == 1

    def test_search_knowledge_node_path(self):
        """验证路径②：search-knowledge-node with show_knowledge=True"""
        chat_record.details = {
            'node_abc': {
                'type': 'search-knowledge-node',
                'show_knowledge': True,
                'paragraph_list': [{'id': 'p2', 'document_name': 'doc2.pdf', ...}]
            }
        }
        result = reset_chat_record(chat_record, True, False)
        assert len(result['paragraph_list']) == 1

    def test_search_knowledge_node_hidden_when_show_knowledge_false(self):
        """验证 show_knowledge=False 时段落不被提取"""
        chat_record.details = {
            'node_abc': {'type': 'search-knowledge-node', 'show_knowledge': False, ...}
        }
        result = reset_chat_record(chat_record, True, False)
        assert result['paragraph_list'] == []

    def test_deduplication_by_id(self):
        """验证按 id 去重逻辑"""
        # 同一 paragraph 在 search_step 和 search-knowledge-node 中均出现
        ...

    def test_show_source_false_excludes_paragraph_list(self):
        """验证 show_source=False 时响应不含 paragraph_list"""
        result = reset_chat_record(chat_record, show_source=False, show_exec=False)
        assert 'paragraph_list' not in result
        assert 'knowledge_list' not in result

    def test_reranker_node_path(self):
        """验证路径③：reranker-node metadata 提取"""
        chat_record.details = {
            'node_xyz': {
                'type': 'reranker-node',
                'show_knowledge': True,
                'result_list': [
                    {'metadata': {'document_id': 'd1', 'knowledge_id': 'k1', 'id': 'p3', ...}}
                ]
            }
        }
        result = reset_chat_record(chat_record, True, False)
        assert len(result['paragraph_list']) == 1
```

#### 测试框架
- 后端：Django 原生 `TestCase`，使用 `mock.patch` 或 fixture 构造 `ChatRecord` 实例

---

### Project Structure Notes

**本故事涉及目录对照（参见 architecture.md）**：

```
apps/
  application/
    serializers/
      application_chat_record.py  ← reset_chat_record() 核心（路径①②③提取逻辑）
    models/
      application_chat.py         ← ChatRecord（含 details JSONField）
                                  ← ApplicationAccessToken（含 show_source 字段）
  chat/
    views/chat.py                 ← ChatRecordView.get() → one(debug=False)
    urls.py                       ← /historical_conversation/{chat_id}/record/{chat_record_id}

ui/src/
  components/ai-chat/
    index.vue                     ← getSourceDetail() 触发（SSE 后 line 593）
    component/
      answer-content/index.vue    ← KnowledgeSourceComponent 渲染条件
      knowledge-source-component/
        index.vue                 ← Citation 卡片 UI（show_source 控制）
        ParagraphSourceContent.vue ← 引用段落详情弹窗
        ExecutionDetailContent.vue ← 执行详情弹窗
  api/chat/chat.ts                ← getChatRecord() REST 调用封装
```

**禁止触碰**（范围外）：
- `apps/application/flow/tools.py` — SSE 生成器（Story 3.1 范围，不修改）
- `apps/knowledge/` — 向量库（Epic 1 已完成）
- `ui/src/workflow/` — 画布编排（Epic 2 已完成）

### References

- Citation 提取核心：[apps/application/serializers/application_chat_record.py](apps/application/serializers/application_chat_record.py) — `reset_chat_record()` 第 124-173 行
- 对话详情 API：[apps/chat/urls.py](apps/chat/urls.py) — `/historical_conversation/{chat_id}/record/{chat_record_id}`
- SSE 后触发 Citation：[ui/src/components/ai-chat/index.vue](ui/src/components/ai-chat/index.vue) — `getSourceDetail()` 第 399 行，调用点第 593 行
- Citation UI 组件：[ui/src/components/ai-chat/component/knowledge-source-component/index.vue](ui/src/components/ai-chat/component/knowledge-source-component/index.vue)
- Citation REST API：[ui/src/api/chat/chat.ts](ui/src/api/chat/chat.ts) — `getChatRecord()` 第 252 行
- 架构约束：[_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md)
- PRD FR10：[_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md)
- Story 3.1 上下文：[_bmad-output/implementation-artifacts/3-1-sse-实时推流式推理响应.md](_bmad-output/implementation-artifacts/3-1-sse-实时推流式推理响应.md)

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6[1m]

### Debug Log References

- PR #4796 (commit `98c558f30`)：SSE `write()` 递归改 while 循环，确保 `is_end=true` 后 `getSourceDetail` 被触发
- PR #4797/#4798 (commit `c3fe1a1`, `3378b54`)：并行节点上下文修复，确保 `chat_record.details` 包含所有 `search-knowledge-node` 的完整数据

### Completion Notes List

- [ ] 验证三条 paragraph_list 提取路径均正常工作（Task 1）
- [ ] 确认 `ApplicationAccessToken.show_source` 默认值为 True（Task 2）
- [ ] 验证 `getSourceDetail` SSE 后无条件触发（Task 3）
- [ ] 验证 `KnowledgeSourceComponent` 渲染条件正确（Task 4）
- [ ] 验证文件类型图标渲染逻辑（Task 5）
- [ ] 后端测试补全并通过（Task 6）

### File List

> 预期修改/新增（仅限验证和测试补全）：
- `apps/application/tests.py` 或 `apps/application/tests/test_chat_record.py`（新增 reset_chat_record 测试用例）
- 如发现 `show_source` 默认值问题：`apps/application/models/`（ApplicationAccessToken 模型）
- 如发现 `meta` 字段序列化不一致：`apps/application/serializers/application_chat_record.py`
- 如发现 `showSource()` 逻辑缺陷：`ui/src/components/ai-chat/component/answer-content/index.vue`
