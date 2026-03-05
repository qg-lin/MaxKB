# Story 5.1: SSO 单点协议与多平台扫码集成配置

Status: done

## Story

As a 全局管理员,
I want 能在系统里填入 LDAP 树或者 OAuth/OIDC/CAS/SAML2 配置、企微飞书钉钉相关授权参数完成系统级别单点认证绑架,
so that 公司几万员工不需要背诵并注册新密码，彻底简化公司内登入验证网.

## Acceptance Criteria

1. **AC1 - 标准协议配置保存**：全局管理员在 `/system-setting/authentication` 页面下，分别对 LDAP、CAS、OIDC、OAuth2、SAML2 各 Tab 填入配置后点击保存，后端 `PUT /api/system/auth/{auth_type}/info` 接口返回 200，配置持久化到 `system_setting` 表的对应 `type` 行。

2. **AC2 - 配置回显**：保存后重新打开对应 Tab，`GET /api/system/auth/{auth_type}/detail` 返回已保存配置，敏感字段（`password`、`client_secret`、`app_secret`）以掩码形式展示。

3. **AC3 - 连接测试**：LDAP 配置页面"测试连接"按钮触发 `POST /api/system/auth/connection`，后端实际尝试 LDAP bind，返回成功/失败信息。

4. **AC4 - 扫码平台接入**：SCAN Tab 下企业微信、钉钉、飞书三个平台，配置成功后前端 `isValid=true` 且能通过 toggle 开关启用/禁用。

5. **AC5 - 登录页模式切换**：启用任一 SSO 方式后，登录页 `GET /api/system/auth/modes`（或等价接口）返回的 `modeList` 中包含对应协议标识（如 `LDAP`、`OAUTH2`、`QR_CODE`），前端据此展示多登录方式入口。

6. **AC6 - SSO 登录回调**：通过 OAuth2/OIDC/CAS 外部 IdP 授权后，回调到系统指定 URL，后端完成 token 校验并签发系统 Bearer Token，实现用户登录。

7. **AC7 - 扫码登录回调**：用户扫企微/钉钉/飞书二维码完成授权后，系统收到回调并签发 Bearer Token，前端完成自动登录跳转。

8. **AC8 - 版本限制**：SSO 功能仅在 PE/EE 版本生效。CE 版请求配置接口时返回适当的 403 或功能未启用提示，前端 Tab 在 CE 下不可用或展示升级引导。

## Tasks / Subtasks

- [ ] Task 1: 扩展 SystemSetting 模型支持 SSO 配置类型 (AC: #1, #2)
  - [ ] 1.1 在 `apps/system_manage/models/system_setting.py` 的 `SettingType` 中追加 SSO 枚举值（LDAP=3, CAS=4, OIDC=5, OAUTH2=6, SAML2=7, WECOM_SCAN=8, DINGTALK_SCAN=9, LARK_SCAN=10）
  - [ ] 1.2 生成 Django migration（`makemigrations system_manage`），校验无破坏性变更（type 是 IntegerChoices，仅追加）

- [ ] Task 2: 实现后端 Auth Setting 视图层 (AC: #1, #2, #3, #4, #5)
  - [ ] 2.1 新建 `apps/system_manage/views/auth_setting.py` 实现：`GET /system/auth/{auth_type}/detail`、`PUT /system/auth/{auth_type}/info`、`POST /system/auth/connection`、`GET /system/auth/modes`
  - [ ] 2.2 在 `apps/system_manage/urls.py` 注册上述路由
  - [ ] 2.3 新建 `apps/system_manage/serializers/auth_setting.py`，按 auth_type 分组定义字段验证规则（各协议必填字段不同）
  - [ ] 2.4 在所有 SSO 接口入口用 `edition` 判断实施 PE/EE 版本守卫，CE 版返回 `{"code": 403, "message": "该功能仅 PE/EE 版本可用"}`

- [ ] Task 3: 实现 LDAP 认证处理器 (AC: #3, #5, #6)
  - [ ] 3.1 新建 `apps/common/auth/handle/impl/ldap_auth_handle.py`，继承 `AuthBaseHandle`，实现 `support()` 和 `handle()` 方法
  - [ ] 3.2 LDAP bind 逻辑：使用 `python-ldap` 或 `ldap3` 库（确认 `pyproject.toml` 中已有或新增依赖）
  - [ ] 3.3 从 `SystemSetting(type=SettingType.LDAP).meta` 读取 ldap_server、base_dn、password、ou、ldap_filter、ldap_mapping
  - [ ] 3.4 用户首次 SSO 登录时，若系统无对应账号则按 ldap_mapping 自动创建 `users.User` 记录
  - [ ] 3.5 在 `apps/maxkb/settings/base/web.py` 的 `AUTH_HANDLES` 列表追加 LDAP handler 路径（遵循已有的 `new_instance_by_class_path` 注册模式）

- [ ] Task 4: 实现 OAuth2 / OIDC / CAS / SAML2 认证处理器及回调端点 (AC: #6)
  - [ ] 4.1 新建 `apps/common/auth/handle/impl/oauth2_auth_handle.py`，实现 PKCE + state 校验的 OAuth2 Authorization Code Flow
  - [ ] 4.2 新建 `apps/common/auth/handle/impl/oidc_auth_handle.py`，实现 ID Token 解码与用户信息端点调用
  - [ ] 4.3 新建 `apps/common/auth/handle/impl/cas_auth_handle.py`，实现 CAS ticket 校验（`/serviceValidate` 端点）
  - [ ] 4.4 新建 `apps/common/auth/handle/impl/saml2_auth_handle.py`，实现 SAML2 Assertion 解析（如需引入 `pysaml2` 库，更新 `pyproject.toml`）
  - [ ] 4.5 在 `apps/system_manage/urls.py` 或 `apps/maxkb/urls.py` 新增回调路由：`/sso/oauth2/callback`、`/sso/oidc/callback`、`/sso/cas/callback`、`/sso/saml2/acs`
  - [ ] 4.6 回调处理器：校验 state/token → 获取用户信息 → 查找或自动创建系统用户 → 签发 Bearer Token → 重定向到前端并携带 token

- [ ] Task 5: 实现扫码登录（企微/钉钉/飞书）回调处理 (AC: #4, #7)
  - [ ] 5.1 新建 `apps/system_manage/views/scan_callback.py`，处理三方 IM 平台 OAuth 回调
  - [ ] 5.2 企业微信：接收 `code` + `state`，通过企微 API 换取 `access_token`，再获取用户信息，签发系统 Token
  - [ ] 5.3 钉钉：接收授权码，调用钉钉 `v2/oauth2/token` 及用户信息接口，签发系统 Token
  - [ ] 5.4 飞书：接收 `code`，调用飞书 `oauth/token` 及用户身份接口，签发系统 Token
  - [ ] 5.5 在 SCAN 平台配置的 `callback_url` 字段中存储上述回调 URL，供前端 QR 组件的 `redirect_uri` 使用
  - [ ] 5.6 新增 `GET /system/auth/scan/{platform}/config` 端点供前端二维码组件获取 corp_id、agent_id、qr_url、callback_url

- [ ] Task 6: 实现登录页 SSO 模式发现接口 (AC: #5)
  - [ ] 6.1 实现 `GET /api/system/auth/modes`（无需鉴权），读取各协议 SystemSetting 记录的 `meta.enable` 字段，返回已启用协议列表（如 `["LDAP", "QR_CODE"]`）
  - [ ] 6.2 前端 `ui/src/views/login/index.vue` 已有调用 modes 接口逻辑，确认接口路径与 `modeList` 构建逻辑匹配

- [ ] Task 7: 编写测试 (AC: all)
  - [ ] 7.1 Django 单元测试：`apps/system_manage/tests.py` 中覆盖 auth_setting CRUD 接口（mock SystemSetting DB 操作）
  - [ ] 7.2 LDAP handler 测试：使用 `unittest.mock` mock ldap 连接，测试 `support()` 和 `handle()` 分支
  - [ ] 7.3 modes 接口测试：验证不同 SystemSetting 组合下返回正确 modeList
  - [ ] 7.4 CE 版本守卫测试：verify `edition='CE'` 时接口返回 403

## Dev Notes

### 架构关键约束

- **版本守卫**：`apps/maxkb/settings/base/web.py` 中 `edition = 'CE'`（CE 版）。SSO 是 PE/EE 专属能力。在视图层入口校验 `from maxkb import settings; settings.edition` 是否为 `'PE'` 或 `'EE'`，CE 版直接返回错误响应，不进入业务逻辑。
- **插件化认证架构**：`apps/common/auth/authenticate.py` 通过 `settings.AUTH_HANDLES` 动态加载 `AuthBaseHandle` 子类列表。新增 SSO handler 需在 settings 中注册。[Source: apps/common/auth/authenticate.py#L42-L45]
- **SystemSetting 存储模式**：所有系统配置使用 `SystemSetting(type: IntegerPK, meta: JSONField)` 单行存储。每种 SSO 协议占一行，配置字段存入 `meta` 字典。禁止新建独立 Model 破坏已有 ORM 结构。[Source: apps/system_manage/models/system_setting.py]
- **Celery 长任务原则**：SSO 回调处理属于同步轻量操作（仅 token 换取 + DB 查找/写入），**不需要** Celery，直接在 APIView 中处理即可。
- **命名规范**：后端 snake_case（`ldap_server`、`client_secret`、`corp_id`），Django Serializer 输出给前端也保持 snake_case（前端已按此格式解析）。[Source: _bmad-output/planning-artifacts/architecture.md#命名模式]

### 现有代码触碰范围

**后端：**
- `apps/system_manage/models/system_setting.py`：追加 `SettingType` 枚举值
- `apps/system_manage/urls.py`：新增 auth 路由
- `apps/system_manage/views/`（新建）：`auth_setting.py`、`scan_callback.py`
- `apps/system_manage/serializers/`（新建）：`auth_setting.py`
- `apps/common/auth/handle/impl/`（新建）：`ldap_auth_handle.py`、`oauth2_auth_handle.py`、`oidc_auth_handle.py`、`cas_auth_handle.py`、`saml2_auth_handle.py`
- `apps/maxkb/settings/base/web.py`：`AUTH_HANDLES` 列表追加新 handler 路径
- `pyproject.toml`：可能需追加 `ldap3`、`pysaml2` 依赖

**前端（理论上已存在，仅做路径验证）：**
- `ui/src/views/system-setting/authentication/index.vue` — Tab 容器，已含所有协议 Tab
- `ui/src/views/system-setting/authentication/component/LDAP.vue` — LDAP 配置表单
- `ui/src/views/system-setting/authentication/component/CAS.vue` — CAS 配置表单
- `ui/src/views/system-setting/authentication/component/OIDC.vue` — OIDC 配置表单
- `ui/src/views/system-setting/authentication/component/OAuth2.vue` — OAuth2 配置表单
- `ui/src/views/system-setting/authentication/component/Saml2.vue` — SAML2 配置表单
- `ui/src/views/system-setting/authentication/component/SCAN.vue` — 扫码平台管理（企微/钉钉/飞书）
- `ui/src/views/login/index.vue` — 登录模式切换（modeList、loginMode、QR_CODE）
- `ui/src/views/login/scanCompinents/wecomQrCode.vue` — 企业微信 iframe QR（使用 `qr_url` + `corp_id` + `agent_id` + `callback_url`）
- `ui/src/api/system/auth.ts` — API 调用封装（`getAuthSetting`、`putAuthSetting`、`postAuthSetting`）

### Project Structure Notes

- **Epic 对照**：架构文档明确 `apps/system_manage/` → `ui/src/permission/` 对应 Identity & Enterprise Management Epic。[Source: _bmad-output/planning-artifacts/architecture.md#Epic对照映射]
- **API 层规范**：新增视图必须置于 `apps/system_manage/views/`，不可直接在 `urls.py` 内联逻辑。
- **前端 API 封装**：前端所有 HTTP 调用必须经由 `ui/src/api/` 目录，不得在 Vue 组件内直接 `axios.get()`，以确保 Bearer Token 自动注入。[Source: _bmad-output/planning-artifacts/architecture.md#API网关与通信边界]
- **重要发现**：前端 SSO UI 组件（LDAP.vue、SCAN.vue 等）和 API 封装（`auth.ts`）已经实现完毕，本故事的实现重点在**后端**。开发 Agent 应优先构建后端接口使前端组件可以正常工作。
- **前端 SCAN.vue 中 Platform 数据结构**：`{ key: string, logoSrc, name, isActive, isValid, config: {[key:string]: string} }`，其中 `config` 字段直接来自 `GET /system/auth/{auth_type}/detail` 响应，后端应按此结构返回 meta 内容。

### References

- SystemSetting 模型：[Source: apps/system_manage/models/system_setting.py]
- 认证处理器架构：[Source: apps/common/auth/authenticate.py]
- AuthBaseHandle 抽象基类：[Source: apps/common/auth/handle/auth_base_handle.py]
- 现有 handler 实现参考：[Source: apps/common/auth/handle/impl/user_token.py]
- Auth Settings 前端 API：[Source: ui/src/api/system/auth.ts]
- 登录页 SSO 模式切换：[Source: ui/src/views/login/index.vue]
- 企微 QR 组件（corp_id/agent_id/callback_url/qr_url）：[Source: ui/src/views/login/scanCompinents/wecomQrCode.vue]
- SCAN.vue Platform 数据结构：[Source: ui/src/views/system-setting/authentication/component/SCAN.vue]
- 架构命名规范（snake_case）：[Source: _bmad-output/planning-artifacts/architecture.md#命名模式]
- 架构边界约束：[Source: _bmad-output/planning-artifacts/architecture.md#架构边界限制]
- Epic 5 业务需求（FR1、FR3、FR14）：[Source: _bmad-output/planning-artifacts/prd.md#FunctionalRequirements]
- 版本限制（PE/EE）：[Source: _bmad-output/planning-artifacts/prd.md#ProjectScoping]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_（由实现 Dev Agent 填写）_

### Completion Notes List

_（由实现 Dev Agent 填写）_

### File List

**后端新建文件：**
- `apps/system_manage/views/auth_setting.py` — SSO 配置 CRUD 视图（detail/info/connection/modes 接口）
- `apps/system_manage/views/scan_callback.py` — 企微/钉钉/飞书扫码回调处理视图
- `apps/system_manage/serializers/auth_setting.py` — 各协议 SSO 配置 Serializer（LDAP/CAS/OIDC/OAuth2/SAML2/SCAN）
- `apps/common/auth/handle/impl/ldap_auth_handle.py` — LDAP AuthBaseHandle 实现
- `apps/common/auth/handle/impl/oauth2_auth_handle.py` — OAuth2 AuthBaseHandle 实现
- `apps/common/auth/handle/impl/oidc_auth_handle.py` — OIDC AuthBaseHandle 实现
- `apps/common/auth/handle/impl/cas_auth_handle.py` — CAS AuthBaseHandle 实现
- `apps/common/auth/handle/impl/saml2_auth_handle.py` — SAML2 AuthBaseHandle 实现

**后端修改文件：**
- `apps/system_manage/models/system_setting.py` — `SettingType` 枚举追加 LDAP=3、CAS=4、OIDC=5、OAUTH2=6、SAML2=7、WECOM_SCAN=8、DINGTALK_SCAN=9、LARK_SCAN=10
- `apps/system_manage/urls.py` — 注册 auth 及 scan callback 路由
- `apps/maxkb/settings/base/web.py` — `AUTH_HANDLES` 列表追加新 SSO handler 路径
- `pyproject.toml` — 按需追加 `ldap3`、`pysaml2` 等依赖

**Django Migrations（自动生成）：**
- `apps/system_manage/migrations/0006_add_sso_setting_types.py`

**前端（验证已存在，无需修改）：**
- `ui/src/views/system-setting/authentication/index.vue`
- `ui/src/views/system-setting/authentication/component/LDAP.vue`
- `ui/src/views/system-setting/authentication/component/CAS.vue`
- `ui/src/views/system-setting/authentication/component/OIDC.vue`
- `ui/src/views/system-setting/authentication/component/OAuth2.vue`
- `ui/src/views/system-setting/authentication/component/Saml2.vue`
- `ui/src/views/system-setting/authentication/component/SCAN.vue`
- `ui/src/views/login/index.vue`
- `ui/src/views/login/scanCompinents/wecomQrCode.vue`
- `ui/src/views/login/scanCompinents/dingtalkQrCode.vue`
- `ui/src/views/login/scanCompinents/larkQrCode.vue`
- `ui/src/api/system/auth.ts`
