# Story 4.2: 保护形态的标准 API 对外网关暴露

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a 外部开发者,
I want 使用获得鉴权的通用 OpenAPI 定义请求系统的同、异步对话端点接口,
so that 我就能够基于贵公司的逻辑基座包裹开发属于我的原生 APP 版本，极速落地自有生态内.

## Acceptance Criteria

1. **Given** 管理员在应用概览页 (`application-overview`) 下，**When** 点击"API Key"按钮，**Then** 前端弹出 `APIKeyDialog.vue` 展示 API Key 列表，**And** 可执行创建（`POST`）、启用/禁用（`PUT is_active`）、设置跨域/过期（`PUT`）、删除（`DELETE`）操作。
2. **Given** 某合法外部系统携带正确的 API Key（格式 `agent-<32位MD5 hash>`），**When** 在 `Authorization: Bearer agent-<key>` Header 中向 `/chat/api/<application_id>/chat/completions` 发起 POST 请求，**Then** 后端通过 `ApplicationKey` 鉴权处理器放行，`OpenAIView` 调起该应用对应的编排引擎处理对话，**And** 响应遵循 OpenAI Chat Completions 格式。
3. **Given** API Key 的 `is_active=False` 或已过期（`is_permanent=False` 且 `expire_time < now()`），**When** 携带该 Key 发起请求，**Then** 后端鉴权层返回 500 错误（`Secret key is invalid` / `Secret key is expired`），请求被拒绝。
4. **Given** API Key 启用了跨域限制（`allow_cross_domain=True`，`cross_domain_list=[...]`），**When** 来自不在白名单中的域名请求到达，**Then** 后端中间件拒绝该跨域请求。
5. **Given** drf-spectacular 已在系统中配置，**When** 访问 `{CONFIG.get_admin_path()}/api-doc/`（默认为 `/admin/api-doc/`，由运行时配置决定），**Then** 可以看到所有 Application API Key 相关端点（创建/列表/修改/删除）以及 OpenAI 兼容端点的 Swagger 文档，**And** 鉴权方式标注为 Bearer（`AUTHORIZATION` Header）。

> **⚠️ 棕地背景说明**：API Key 管理与 OpenAI 兼容网关的核心基础架构已在生产代码中完整实现。本故事重点是**验证端到端数据流、测试覆盖与潜在缺口修复**，而非从零重写。

## Tasks / Subtasks

- [ ] Task 1：验证 `ApplicationApiKey` 模型与 `ApplicationKeySerializer` 核心逻辑（AC: #1, #3）
  - [ ] 阅读 `apps/application/models/application_api_key.py`，确认字段完整性：`secret_key`、`is_active`、`allow_cross_domain`、`cross_domain_list`、`expire_time`、`is_permanent`
  - [ ] 确认 `ApplicationKeySerializer.generate()` 生成格式：`agent-` + `hashlib.md5(str(uuid.uuid7()).encode()).hexdigest()`（完整 32 位 MD5）
  - [ ] 确认 `generate()` 创建 `ApplicationApiKey` 时 `workspace_id` 的来源：模型 `default="default"` 兜底，但视图层 `ApplicationKey.post()` 传入了 `workspace_id` 参数——需确认序列化器是否将其正确写入 `ApplicationApiKey.workspace_id`，避免多租户场景下数据隔离缺口
  - [ ] 确认 `Operate.edit()` 正确更新 `is_active`、`allow_cross_domain`、`cross_domain_list`、`is_permanent`、`expire_time`
  - [ ] 确认 `Operate.delete()` 正确调用 `del_application_api_key()` 清除缓存后再删记录

- [ ] Task 2：验证 API Key 管理路由与视图（AC: #1）
  - [ ] 检查 `apps/application/urls.py`，确认路由：
    - `POST /admin/api/workspace/<workspace_id>/application/<application_id>/application_key` → `ApplicationKey.post()` → `.generate()`
    - `GET /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<page>/<size>` → `ApplicationKey.Page.get()` → `.page()`
    - `PUT /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<api_key_id>` → `ApplicationKey.Operate.put()` → `.edit()`
    - `DELETE /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<api_key_id>` → `ApplicationKey.Operate.delete()` → `.delete()`
  - [ ] 确认所有路由响应格式符合标准封套 `{"code": 200, "message": "success", "data": {...}}`
  - [ ] 确认所有路由使用 `TokenAuth` 并正确校验管理员权限（`PermissionConstants.APPLICATION_OVERVIEW_API_KEY`）

- [ ] Task 3：验证 `ApplicationKey` 鉴权处理器（AC: #2, #3）
  - [ ] 阅读 `apps/common/auth/handle/impl/application_key.py`
  - [ ] 确认 `support()` 方法：接受 `application-` 或 `agent-` 前缀的 Token（`str(token).startswith("application-") or str(token).startswith('agent-')`）
  - [ ] 确认 `handle()` 流程：
    1. 通过 `secret_key=token` 查询 `ApplicationApiKey`（注意：token 在 `AUTHORIZATION` Header 中格式为 `Bearer agent-<key>`，鉴权框架去掉 `Bearer ` 前缀后传入）
    2. Key 不存在 → `AppAuthenticationFailed(500, 'Secret key is invalid')`
    3. `is_active=False` → `AppAuthenticationFailed(500, 'Secret key is invalid')`
    4. `is_permanent=False` 且 `expire_time < now()` → `AppAuthenticationFailed(500, 'Secret key is expired')`
    5. 通过 → 返回 `ChatAuth(application_id=..., chat_user_type=APPLICATION_API_KEY)`
  - [ ] 确认 `ApplicationAccessToken.authentication` 检查（PE/EE 功能）对社区版不影响基本流程
  - [ ] **安全验证**：确认 `/chat/api/<application_id>/chat/completions` 中的 URL `application_id` 与鉴权后 `auth.application_id`（来自 API Key 绑定的 Application）是否做一致性校验——若不校验，攻击者可用应用 A 的 Key 访问应用 B 的端点，属于越权漏洞；验证 `OpenAIView` 或序列化器是否有此防护

- [ ] Task 4：验证 OpenAI 兼容端点（AC: #2）
  - [ ] 阅读 `apps/chat/views/chat.py` 中的 `OpenAIView`（第 69 行）
  - [ ] 确认路由：`POST /chat/api/<application_id>/chat/completions` → `OpenAIView.post()`
  - [ ] 确认 `OpenAIView` 使用 `ChatTokenAuth`（接受 API Key 鉴权）
  - [ ] 确认 `OpenAIChatSerializer` 正确处理请求数据并调起对话引擎（`source.type = ChatSourceChoices.API_CALL`）
  - [ ] 确认接受的 OpenAI 兼容请求字段：`messages`（`[{"role": "user"/"assistant"/"system", "content": "..."}]`）、`model`（可选，映射到 MaxKB 应用绑定的模型）、`stream`（`true` → SSE 流式，`false` → 单次 JSON 响应）
  - [ ] 确认流式响应通过 SSE 返回（`stream=True` 时返回 `data: <JSON>\n\n` 格式），非流式返回标准 OpenAI 格式（含 `id`、`object`、`choices`、`model` 字段，**注意：此端点不使用标准 `{"code": 200, "data": {...}}` 封套，直接返回 OpenAI 格式**）

- [ ] Task 5：验证跨域处理逻辑（AC: #4）
  - [ ] 检查 `apps/common/cache_data/application_api_key_cache.py`，确认缓存了 `allow_cross_domain` 和 `cross_domain_list` 字段
  - [ ] 追踪跨域拒绝逻辑在哪里实现（中间件或视图层），确认 `allow_cross_domain=True` 时正确校验来源域名
  - [ ] 确认缓存在 Key 修改（`Operate.edit()`）后通过 `get_application_api_key(..., False)` 正确刷新

- [ ] Task 6：验证前端 `APIKeyDialog.vue` 与 `SettingAPIKeyDrawer.vue`（AC: #1）
  - [ ] 阅读 `ui/src/views/application-overview/index.vue`，确认 API Key 入口：`APIKeyDialogRef.value.open()` 由概览页中的"API Key"按钮触发，且该按钮受 `permissionPrecise.overview_api_key(id)` 权限控制（社区版可见，部分版本限制 PE/EE）
  - [ ] 阅读 `ui/src/views/application-overview/component/APIKeyDialog.vue`
  - [ ] 确认通过 `loadSharedApi({type: 'applicationKey', systemType: apiType.value})` 调用后端 API
  - [ ] 确认 `createApiKey()` → `postAPIKey(id, loading)` → `POST .../application_key`
  - [ ] 确认 `changeState(bool, row)` → `putAPIKey(id, row.id, {is_active: bool}, loading)` → 列表刷新
  - [ ] 确认 `deleteApiKey(row)` 弹出确认对话框后 → `delAPIKey(id, row.id, loading)` → 列表刷新
  - [ ] 阅读 `SettingAPIKeyDrawer.vue`，确认编辑表单提交 → `putAPIKey(id, APIKeyId, {...}, loading)` 正确传递 `allow_cross_domain`、`cross_domain_list`（换行分隔文本 → 数组转换）、`is_permanent`、`expire_time`

- [ ] Task 7：验证前端 API 封装（AC: #1）
  - [ ] 检查 `ui/src/api/application/application-key.ts`，确认：
    - `getAPIKey(application_id, current_page, page_size, params, loading?)` → `GET .../application_key/<page>/<size>`
    - `postAPIKey(application_id, loading?)` → `POST .../application_key`
    - `putAPIKey(application_id, api_key_id, data, loading?)` → `PUT .../application_key/<api_key_id>`
    - `delAPIKey(application_id, api_key_id, loading?)` → `DELETE .../application_key/<api_key_id>`
  - [ ] 确认所有函数走 Axios 拦截器（Bearer Token + loading 状态）
  - [ ] 确认 `loadSharedApi({type: 'applicationKey'})` 正确路由：`workspace` → `application-key.ts`；`systemManage` → `system-resource-management/application-key.ts`

- [ ] Task 8：编写后端单元测试（AC: #1, #2, #3）
  - [ ] 在 `apps/application/tests.py` 或新建 `apps/application/tests/test_api_key.py` 中添加：
    - `test_generate_api_key_creates_agent_prefixed_key()`：创建后 `secret_key` 以 `agent-` 开头，长度为 `agent-` + 32 位 MD5
    - `test_generate_api_key_is_active_by_default()`：新建 Key 默认 `is_active=True`，`is_permanent=True`
    - `test_edit_api_key_toggle_active()`：`is_active` 切换正确持久化
    - `test_edit_api_key_cross_domain()`：`allow_cross_domain=True` + `cross_domain_list` 正确持久化
    - `test_edit_api_key_expiry()`：`is_permanent=False` 时 `expire_time` 正确存储
    - `test_delete_api_key_clears_cache()`：删除 Key 后缓存被清除（mock `del_application_api_key`）
    - `test_api_key_auth_handler_valid_key()`：有效 `agent-` Key 通过鉴权，返回正确 `ChatAuth`
    - `test_api_key_auth_handler_inactive_key()`：`is_active=False` 的 Key 返回 `AppAuthenticationFailed`
    - `test_api_key_auth_handler_expired_key()`：过期 Key 返回 `AppAuthenticationFailed(500, 'Secret key is expired')`

## Dev Notes

### ⚠️ 棕地背景：这是一个验证/修复故事

本故事对应的 API Key 管理与 OpenAI 兼容网关基础架构**在生产代码中已完整实现**：
- 后端 `ApplicationApiKey` 模型（DB 表 `application_api_key`）
- 后端 `ApplicationKeySerializer` CRUD 逻辑（`generate`、`page`、`edit`、`delete`）
- 后端 `ApplicationKey` 视图（POST/GET/PUT/DELETE）
- 鉴权处理器 `ApplicationKey`（`apps/common/auth/handle/impl/application_key.py`）
- OpenAI 兼容端点（`/chat/api/<application_id>/chat/completions` → `OpenAIView`）
- 跨域缓存（`application_api_key_cache.py`）
- 前端 `APIKeyDialog.vue`、`SettingAPIKeyDrawer.vue`
- 前端 API 封装（`application-key.ts`）

**开发工作重点：**
1. **验证**：确认 API Key 管理端到端流程、OpenAI 兼容端点与鉴权完全符合所有 AC
2. **测试覆盖**：补全缺失的后端单元测试
3. **缺口修复**：发现不符合 AC 的地方进行最小化修复

**禁止**：不要重写 `APIKeyDialog.vue` 核心逻辑，不要更改 `ApplicationApiKey` 模型结构，不要引入 WebSocket（SSE 是流式对话的唯一协议）。

---

### 完整端到端 API Key 数据流

```
===== 管理员侧：API Key 生命周期管理 =====
[管理员点击"API Key"按钮]
        ↓
application-overview/index.vue → APIKeyDialogRef.value.open()
        ↓
APIKeyDialog.vue: getApiKeyList()
  → loadSharedApi({type: 'applicationKey', systemType: 'workspace'}).getAPIKey(id, page, size, param, loading)
  → GET /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<page>/<size>
        ↓
ApplicationKey.Page.get() → ApplicationKeySerializer.page()
  → QuerySet(ApplicationApiKey).filter(application_id=...).order_by(...) → 分页返回

[管理员点击"创建"]
  → postAPIKey(id, loading)
  → POST /admin/api/workspace/<workspace_id>/application/<application_id>/application_key
        ↓
ApplicationKey.post() → ApplicationKeySerializer.generate()
  → secret_key = 'agent-' + hashlib.md5(str(uuid.uuid7()).encode()).hexdigest()  # agent- + 32位
  → ApplicationApiKey.save()

[管理员编辑设置]
  → SettingAPIKeyDrawer.vue: submit() → putAPIKey(id, APIKeyId, obj, loading)
  → PUT /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<api_key_id>
        ↓
ApplicationKey.Operate.put() → ApplicationKeySerializer.Operate.edit()
  → 更新 is_active / allow_cross_domain / cross_domain_list / is_permanent / expire_time
  → 刷新缓存: get_application_api_key('Bearer ' + secret_key, False)

===== 开发者侧：使用 API Key 发起对话 =====
[外部系统发起请求]
  → POST /chat/api/<application_id>/chat/completions
  → Header: Authorization: Bearer agent-<32位MD5>
        ↓
ChatTokenAuth 鉴权层
  → ApplicationKey.support(): token 以 'agent-' 开头 → 匹配
  → ApplicationKey.handle():
      1. QuerySet(ApplicationApiKey).filter(secret_key=token).first()
      2. 校验 is_active、is_permanent、expire_time
      3. 返回 ChatAuth(application_id=..., chat_user_type=APPLICATION_API_KEY)
        ↓
OpenAIView.post(request, application_id)
  → OpenAIChatSerializer(data={application_id, chat_user_id, chat_user_type, ip_address,
                                source: {type: ChatSourceChoices.API_CALL}}).chat(request.data)
  → 调起应用编排引擎执行对话
  → 流式返回（stream=True）: SSE 格式 data: <JSON>\n\n
  → 非流式返回: {"id": ..., "choices": [...], "model": ..., ...} OpenAI 格式
```

---

### 现有后端实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| ApiKey 模型 | `apps/application/models/application_api_key.py` |
| ApiKey 序列化器（CRUD） | `apps/application/serializers/application_api_key.py` |
| ApiKey API 视图 | `apps/application/views/application_api_key.py` |
| ApiKey OpenAPI 文档定义 | `apps/application/api/application_api_key.py` |
| ApiKey 路由 | `apps/application/urls.py`（第 14、18、19 行） |
| ApiKey 鉴权处理器 | `apps/common/auth/handle/impl/application_key.py` |
| ApiKey 跨域缓存 | `apps/common/cache_data/application_api_key_cache.py` |
| OpenAI 兼容视图 | `apps/chat/views/chat.py` → `OpenAIView`（第 69 行） |
| OpenAI 序列化器 | `apps/chat/serializers/chat.py` → `OpenAIChatSerializer`（第 217 行） |
| OpenAI 路由 | `apps/chat/urls.py`（第 20 行） |

#### `ApplicationApiKey` 模型字段

```python
class ApplicationApiKey(AppModelMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid7, ...)
    secret_key = models.CharField(max_length=1024, unique=True)   # 格式: agent-<32位MD5>
    user = models.ForeignKey(User, ...)
    workspace_id = models.CharField(max_length=64, db_index=True)
    application = models.ForeignKey(Application, ...)
    is_active = models.BooleanField(default=True)                  # 是否启用
    allow_cross_domain = models.BooleanField(default=False)        # 是否允许跨域
    cross_domain_list = ArrayField(base_field=CharField(...), default=list)  # 跨域白名单
    expire_time = models.DateTimeField(default=timezone.now)       # 过期时间
    is_permanent = models.BooleanField(default=True)               # 是否永久有效

    class Meta:
        db_table = "application_api_key"
```

#### API 路由

```
# 管理员侧（TokenAuth 保护）
POST   /admin/api/workspace/<workspace_id>/application/<application_id>/application_key
       → ApplicationKey.post() → ApplicationKeySerializer.generate() → 创建新 Key

GET    /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<page>/<size>
       → ApplicationKey.Page.get() → ApplicationKeySerializer.page() → 分页列表

PUT    /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<api_key_id>
       → ApplicationKey.Operate.put() → ApplicationKeySerializer.Operate.edit() → 修改设置

DELETE /admin/api/workspace/<workspace_id>/application/<application_id>/application_key/<api_key_id>
       → ApplicationKey.Operate.delete() → ApplicationKeySerializer.Operate.delete() → 删除

# 开发者侧（ChatTokenAuth / API Key 保护）
POST   /chat/api/<application_id>/chat/completions
       → OpenAIView.post() → OpenAIChatSerializer.chat() → 对话引擎
```

#### `ApplicationKeySerializer.generate()` 核心逻辑

```python
def generate(self, with_valid=True):
    if with_valid:
        self.is_valid(raise_exception=True)
    application_id = self.data.get("application_id")
    application = QuerySet(Application).filter(id=application_id).first()
    # 格式: agent- + 完整 32 位 MD5 hash
    secret_key = 'agent-' + hashlib.md5(str(uuid.uuid7()).encode()).hexdigest()
    application_api_key = ApplicationApiKey(
        id=uuid.uuid7(),
        secret_key=secret_key,
        user_id=application.user_id,
        application_id=application_id
    )
    application_api_key.save()
    return ApplicationKeySerializerModel(application_api_key).data
```

#### 鉴权处理器核心逻辑

```python
class ApplicationKey(AuthBaseHandle):
    def support(self, request, token, get_token_details):
        # 匹配 agent- 或 application- 前缀（向后兼容旧格式）
        return str(token).startswith("application-") or str(token).startswith('agent-')

    def handle(self, request, token, get_token_details):
        application_api_key = QuerySet(ApplicationApiKey).filter(secret_key=token).first()
        if application_api_key is None:
            raise AppAuthenticationFailed(500, _('Secret key is invalid'))
        if not application_api_key.is_active:
            raise AppAuthenticationFailed(500, _('Secret key is invalid'))
        if application_api_key.is_permanent is False and application_api_key.expire_time < timezone.now():
            raise AppAuthenticationFailed(500, _('Secret key is expired'))
        # PE/EE 功能: 校验 ApplicationAccessToken.authentication（社区版通常跳过）
        return None, ChatAuth(
            current_role_list=[RoleConstants.CHAT_ANONYMOUS_USER],
            permission_list=[Permission(group=Group.APPLICATION, operate=Operate.READ)],
            application_id=application_api_key.application_id,
            chat_user_id=str(application_api_key.id),
            chat_user_type=ChatUserType.APPLICATION_API_KEY.value
        )
```

---

### 现有前端实现（已存在）

#### 核心文件

| 职责 | 文件路径 |
|------|---------|
| API Key 列表管理对话框 | `ui/src/views/application-overview/component/APIKeyDialog.vue` |
| API Key 设置抽屉（编辑） | `ui/src/views/application-overview/component/SettingAPIKeyDrawer.vue` |
| Workspace 侧 REST API 封装 | `ui/src/api/application/application-key.ts` |
| 系统管理侧 REST API 封装 | `ui/src/api/system-resource-management/application-key.ts` |
| 共享 API 路由器 | `ui/src/utils/dynamics-api/shared-api.ts`（第 56、88 行） |

#### `APIKeyDialog.vue` 关键函数

```typescript
// 创建 Key
function createApiKey() {
  loadSharedApi({type: 'applicationKey', systemType: apiType.value})
    .postAPIKey(id as string, loading)
    .then(() => { getApiKeyList() })
}

// 切换启用状态
async function changeState(bool: boolean, row: any) {
  await loadSharedApi({type: 'applicationKey', systemType: apiType.value})
    .putAPIKey(id as string, row.id, {is_active: bool}, loading)
}

// 删除（需用户确认）
function deleteApiKey(row: any) {
  MsgConfirm(...).then(() => {
    loadSharedApi({type: 'applicationKey', systemType: apiType.value})
      .delAPIKey(id as string, row.id, loading)
      .then(() => { getApiKeyList() })
  })
}
```

#### `SettingAPIKeyDrawer.vue` 提交逻辑

```typescript
const obj = {
  allow_cross_domain: form.value.allow_cross_domain,
  cross_domain_list: form.value.cross_domain_list
    ? form.value.cross_domain_list.split('\n').filter((item: string) => item !== '')
    : [],
  expire_time: form.value.expire_time,
  is_permanent: form.value.expiredTimeType === 'never',  // 'never' → true, 'custom' → false
  is_active: form.value.is_active,
}
// APIType === 'APPLICATION' 时路由到应用 API，否则路由到系统 API
```

---

### 架构约束与强制规则

参见 `_bmad-output/planning-artifacts/architecture.md`：

1. **通信协议**：`/chat/api/<application_id>/chat/completions` 的流式响应必须使用 SSE（`stream=True` 时），不得使用 WebSocket。
2. **鉴权模式**：
   - 管理员侧（API Key 管理 CRUD）：`TokenAuth`（管理员 Session Bearer Token）
   - 开发者侧（OpenAI 兼容端点）：`ChatTokenAuth`（`agent-` 前缀 API Key）
3. **snake_case 强制**：后端字段（`secret_key`, `is_active`, `allow_cross_domain`, `cross_domain_list`, `expire_time`, `is_permanent`）全部为下划线命名。
4. **API 响应封套**：管理员侧所有端点返回 `{"code": 200, "message": "success", "data": {...}}`；开发者侧 OpenAI 兼容端点返回 OpenAI 格式（不封套）。
5. **前端 API 封装**：所有 HTTP 请求必须通过 `ui/src/api/` 下的封装函数，不得在 Vue 组件内裸写 Axios。
6. **loading 状态**：所有异步操作挂载 `loading.value = true`，由 Axios 拦截器自动管理。
7. **禁止硬编码 Key**：`secret_key` 通过 `hashlib.md5(str(uuid.uuid7()).encode()).hexdigest()` 生成，不得硬编码；前端不得将 API Key 存入 localStorage。
8. **Celery 隔离长事务**：对话引擎的异步处理（如需）必须通过 Celery，不得阻塞 HTTP 进程。

---

### Story 4.1 关键学习与遗留问题

| 类型 | 内容 | 对 4.2 的影响 |
|------|------|-------------|
| 架构确认 | SSE 为必须流式协议，WebSocket 被明确禁止 | OpenAI 兼容端点的流式返回必须使用 SSE |
| 棕地模式 | Story 4.1 全部为验证+测试，不重写 | 本故事同样：验证现有实现，最小化修复 |
| 测试空白 | Story 4.1 后端测试有所补全，但 API Key 相关未测试 | 必须补全 `ApplicationKeySerializer` 和鉴权处理器的单元测试 |
| 缓存刷新 | `access_token` 缓存需在修改后主动刷新 | `ApplicationApiKey` 缓存在 `edit()` 末尾已有 `get_application_api_key(..., False)` 刷新，需验证 |
| 权限控制 | `permissionPrecise.overview_api_key(id)` 控制 API Key 按钮可见性 | 社区版可见，部分功能限 PE/EE |

---

### 关键风险与注意事项

1. **`secret_key` 格式差异**：`ApplicationKeySerializer.generate()` 生成的是 `agent-` + **完整 32 位 MD5**（38 字符），而 `AccessTokenSerializer.one()` 生成的是 16 位截断 MD5（16 字符）。两者用途不同，不得混淆。
2. **`support()` 的向后兼容**：鉴权处理器同时支持 `application-` 和 `agent-` 前缀。老版本 Key 以 `application-` 开头，新版本以 `agent-` 开头，两者均可通过鉴权。
3. **跨域处理位置**：需确认跨域拒绝逻辑的具体实现位置（中间件/视图/装饰器），确保 `allow_cross_domain=True` 时非白名单请求被正确拒绝。
4. **OpenAI 兼容格式**：`OpenAIView` 返回的数据格式应符合 OpenAI Chat Completions API 规范（包含 `id`、`object`、`choices`、`model` 等字段），需验证 `OpenAIChatSerializer.chat()` 的实际输出格式。
5. **API 文档生成**：drf-spectacular 已配置，但需确认 `ApplicationKey` 相关视图的 `@extend_schema` 注解是否完整，以确保 Swagger 文档正确生成（AC #5）。
6. **`workspace_id` 字段**：`ApplicationApiKey` 有 `workspace_id` 字段，但序列化器中创建时从 `Application.workspace_id` 获取，需确认一致性。

---

### 测试策略

#### 后端测试（Python）

位置：`apps/application/tests.py` 或新建 `apps/application/tests/test_api_key.py`

```python
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from unittest.mock import patch
from application.models import Application, ApplicationApiKey
from application.serializers.application_api_key import ApplicationKeySerializer
from common.auth.handle.impl.application_key import ApplicationKey as ApplicationKeyAuth
from common.exception.app_exception import AppAuthenticationFailed


class ApplicationKeySerializerTestCase(TestCase):
    def setUp(self):
        # ⚠️ Application 有 user 外键（NOT NULL），必须先创建 User，否则会 IntegrityError
        from users.models import User
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='testpass'
        )
        self.application = Application.objects.create(
            name='Test App',
            workspace_id='default',
            user=self.user,
            # ... 其他必填字段（参考 apps/application/models/__init__.py 确认）
        )

    def test_generate_api_key_creates_agent_prefixed_key(self):
        """创建后 secret_key 以 agent- 开头，总长度 38 字符（agent- + 32位MD5）"""
        result = ApplicationKeySerializer(
            data={'application_id': str(self.application.id), 'workspace_id': 'default'}
        ).generate()
        self.assertTrue(result['secret_key'].startswith('agent-'))
        self.assertEqual(len(result['secret_key']), 38)  # 'agent-' (6) + 32位MD5

    def test_generate_api_key_defaults(self):
        """新建 Key 默认 is_active=True, is_permanent=True"""
        result = ApplicationKeySerializer(
            data={'application_id': str(self.application.id), 'workspace_id': 'default'}
        ).generate()
        self.assertTrue(result['is_active'])
        self.assertTrue(result['is_permanent'])

    def test_edit_api_key_toggle_active(self):
        """is_active 切换正确持久化"""
        key = ApplicationApiKey.objects.create(
            secret_key='agent-' + 'a' * 32,
            user_id=self.application.user_id,
            application_id=self.application.id
        )
        ApplicationKeySerializer.Operate(
            data={'application_id': str(self.application.id), 'api_key_id': str(key.id)}
        ).edit({'is_active': False})
        key.refresh_from_db()
        self.assertFalse(key.is_active)

    def test_edit_api_key_cross_domain_settings(self):
        """allow_cross_domain 和 cross_domain_list 正确持久化"""
        key = ApplicationApiKey.objects.create(
            secret_key='agent-' + 'b' * 32,
            user_id=self.application.user_id,
            application_id=self.application.id
        )
        ApplicationKeySerializer.Operate(
            data={'application_id': str(self.application.id), 'api_key_id': str(key.id)}
        ).edit({'allow_cross_domain': True, 'cross_domain_list': ['https://example.com', 'https://foo.com']})
        key.refresh_from_db()
        self.assertTrue(key.allow_cross_domain)
        self.assertIn('https://example.com', key.cross_domain_list)

    def test_edit_api_key_expiry(self):
        """is_permanent=False 时 expire_time 正确存储"""
        key = ApplicationApiKey.objects.create(
            secret_key='agent-' + 'c' * 32,
            user_id=self.application.user_id,
            application_id=self.application.id
        )
        future_time = timezone.now() + timedelta(days=30)
        ApplicationKeySerializer.Operate(
            data={'application_id': str(self.application.id), 'api_key_id': str(key.id)}
        ).edit({'is_permanent': False, 'expire_time': future_time})
        key.refresh_from_db()
        self.assertFalse(key.is_permanent)

    @patch('application.serializers.application_api_key.del_application_api_key')
    def test_delete_api_key_clears_cache(self, mock_del_cache):
        """删除 Key 后缓存被清除"""
        key = ApplicationApiKey.objects.create(
            secret_key='agent-' + 'd' * 32,
            user_id=self.application.user_id,
            application_id=self.application.id
        )
        ApplicationKeySerializer.Operate(
            data={'application_id': str(self.application.id), 'api_key_id': str(key.id)}
        ).delete()
        mock_del_cache.assert_called_once()
        self.assertFalse(ApplicationApiKey.objects.filter(id=key.id).exists())


class ApplicationKeyAuthHandlerTestCase(TestCase):
    def setUp(self):
        from users.models import User
        self.user = User.objects.create_user(
            username='authuser', email='auth@example.com', password='testpass'
        )
        self.application = Application.objects.create(
            name='Test App', workspace_id='default', user=self.user
        )
        self.key = ApplicationApiKey.objects.create(
            secret_key='agent-' + 'e' * 32,
            user_id=self.application.user_id,
            application_id=self.application.id,
            is_active=True,
            is_permanent=True
        )
        self.auth_handler = ApplicationKeyAuth()

    def test_support_agent_prefix(self):
        """agent- 前缀 Token 被正确匹配"""
        self.assertTrue(self.auth_handler.support(None, 'agent-' + 'e' * 32, None))

    def test_support_application_prefix_backward_compat(self):
        """application- 前缀向后兼容"""
        self.assertTrue(self.auth_handler.support(None, 'application-xxxxx', None))

    def test_handle_valid_key(self):
        """有效 Key 通过鉴权，返回正确 ChatAuth"""
        _, auth = self.auth_handler.handle(None, 'agent-' + 'e' * 32, None)
        self.assertEqual(str(auth.application_id), str(self.application.id))

    def test_handle_inactive_key(self):
        """is_active=False 的 Key 返回 AppAuthenticationFailed"""
        self.key.is_active = False
        self.key.save()
        with self.assertRaises(AppAuthenticationFailed):
            self.auth_handler.handle(None, 'agent-' + 'e' * 32, None)

    def test_handle_expired_key(self):
        """过期 Key 返回 AppAuthenticationFailed"""
        self.key.is_permanent = False
        self.key.expire_time = timezone.now() - timedelta(hours=1)
        self.key.save()
        with self.assertRaises(AppAuthenticationFailed):
            self.auth_handler.handle(None, 'agent-' + 'e' * 32, None)
```

#### 测试框架

- 后端：Django 原生 `TestCase`，使用内置事务隔离
- 数据库：测试数据库，每个测试用例独立

---

### Project Structure Notes

**本故事涉及目录对照（参见 architecture.md）**：

```
apps/
  application/
    models/application_api_key.py          ← ApplicationApiKey 模型（DB 表定义）
    serializers/application_api_key.py     ← ApplicationKeySerializer（CRUD 逻辑）
    views/application_api_key.py           ← ApplicationKey 视图（POST/GET/PUT/DELETE）
    api/application_api_key.py             ← drf-spectacular OpenAPI 文档定义
    urls.py（第 14、18、19 行）             ← /application_key 路由挂载
    tests.py                               ← ⚠️ 需补全 ApiKey 单元测试
  chat/
    views/chat.py（第 69 行）              ← OpenAIView（OpenAI 兼容端点）
    serializers/chat.py（第 217 行）       ← OpenAIChatSerializer（对话逻辑）
    urls.py（第 20 行）                    ← /<application_id>/chat/completions 路由
  common/
    auth/handle/impl/application_key.py    ← API Key 鉴权处理器（ApplicationKey）
    cache_data/application_api_key_cache.py ← 跨域设置缓存
    constants/cache_version.py             ← 缓存版本常量（APPLICATION_API_KEY）

ui/src/
  views/
    application-overview/
      component/
        APIKeyDialog.vue                   ← ⚙️ API Key 列表与管理对话框
        SettingAPIKeyDrawer.vue            ← ⚙️ API Key 编辑设置抽屉
  api/
    application/application-key.ts         ← getAPIKey(), postAPIKey(), putAPIKey(), delAPIKey()
    system-resource-management/application-key.ts ← 系统管理侧同名 API 封装
  utils/
    dynamics-api/shared-api.ts             ← loadSharedApi({type: 'applicationKey'}) 路由器
```

**禁止触碰**（范围外）：
- `apps/application/models/application_access_token.py` — 嵌入 Token（Story 4.1 范围）
- `ui/src/views/application-overview/component/EmbedDialog.vue` — 嵌入代码（Story 4.1 范围）
- `apps/knowledge/` — 向量库（Epic 1 已完成）
- `ui/src/workflow/` — 画布编排（Epic 2 已完成）
- `apps/system_manage/` — RBAC/SSO（Epic 5 范围）

### References

- ApiKey 模型：[apps/application/models/application_api_key.py](apps/application/models/application_api_key.py)
- ApiKey 序列化器：[apps/application/serializers/application_api_key.py](apps/application/serializers/application_api_key.py)
- ApiKey 视图：[apps/application/views/application_api_key.py](apps/application/views/application_api_key.py)
- Application URL 路由：[apps/application/urls.py](apps/application/urls.py) 第 14、18、19 行
- OpenAI 兼容视图：[apps/chat/views/chat.py](apps/chat/views/chat.py) 第 69 行
- OpenAI 序列化器：[apps/chat/serializers/chat.py](apps/chat/serializers/chat.py) 第 217 行
- Chat URL 路由：[apps/chat/urls.py](apps/chat/urls.py) 第 20 行
- ApiKey 鉴权处理器：[apps/common/auth/handle/impl/application_key.py](apps/common/auth/handle/impl/application_key.py)
- 跨域缓存：[apps/common/cache_data/application_api_key_cache.py](apps/common/cache_data/application_api_key_cache.py)
- API Key 对话框：[ui/src/views/application-overview/component/APIKeyDialog.vue](ui/src/views/application-overview/component/APIKeyDialog.vue)
- 设置抽屉：[ui/src/views/application-overview/component/SettingAPIKeyDrawer.vue](ui/src/views/application-overview/component/SettingAPIKeyDrawer.vue)
- 前端 REST API 封装：[ui/src/api/application/application-key.ts](ui/src/api/application/application-key.ts)
- 共享 API 路由器：[ui/src/utils/dynamics-api/shared-api.ts](ui/src/utils/dynamics-api/shared-api.ts)
- 架构约束：[_bmad-output/planning-artifacts/architecture.md](_bmad-output/planning-artifacts/architecture.md)
- PRD FR13：[_bmad-output/planning-artifacts/prd.md](_bmad-output/planning-artifacts/prd.md)
- Epics 故事定义：[_bmad-output/planning-artifacts/epics.md](_bmad-output/planning-artifacts/epics.md) Epic 4 Story 4.2

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6[1m]

### Debug Log References

- PR #4796：SSE `write_ed` 修复 → 流式对话已修复，OpenAI 兼容端点的流式返回不受影响
- PR #4797/#4798：并行节点上下文修复 → 对话引擎稳定性改善，对 API Key 流程有正面影响

### Completion Notes List

- [ ] 确认 `ApplicationKeySerializer.generate()` 生成 `agent-` + 32位MD5 格式（Task 1）
- [ ] 确认 `Operate.edit()` 全字段更新逻辑正确（Task 1）
- [ ] 确认 API Key 管理路由和响应格式（Task 2）
- [ ] 确认 `ApplicationKey` 鉴权处理器三重校验（存在性、is_active、过期时间）（Task 3）
- [ ] 确认 OpenAI 兼容端点可访问并正确处理 API Key 鉴权（Task 4）
- [ ] 确认跨域限制逻辑（Task 5）
- [ ] 确认 `APIKeyDialog.vue` 完整 CRUD UI 流程（Task 6）
- [ ] 确认 `SettingAPIKeyDrawer.vue` 编辑表单数据处理（Task 6）
- [ ] 确认前端 API 封装正确路由（Task 7）
- [ ] 后端 `ApplicationKeySerializer` 单元测试补全并通过（Task 8）
- [ ] 后端鉴权处理器单元测试补全并通过（Task 8）

### File List

> 预期修改/新增（仅限验证和测试补全）：
- `apps/application/tests.py` 或 `apps/application/tests/test_api_key.py`（新增 ApplicationKeySerializer + 鉴权处理器测试用例）
- 如发现 `SettingAPIKeyDrawer.vue` 中 `cross_domain_list` 换行转数组有边界问题：`ui/src/views/application-overview/component/SettingAPIKeyDrawer.vue`
- 如发现跨域拒绝逻辑存在缺口：相关中间件或视图文件（需 Task 5 排查后确定）
- 如发现 `OpenAIView` 响应格式不完全符合 OpenAI 规范：`apps/chat/views/chat.py` 或 `apps/chat/serializers/chat.py`
