# Story 5.2: 细粒度角色与操作控制板 (RBAC)

Status: done

## Story

As a 企业 IT 管理员,
I want 自由配置角色集，能够按读操作、写操作拆分如：知识管理员、财务人员等定制角色并发配给系统内置员工账号,
so that 我能够放心地把业务下发因为不同的角色永远无法看到彼此无权控制的内容与组件面板.

## Acceptance Criteria

1. **AC1 - 内置角色列表**：`GET /api/system/role` 返回 `{ internal_role: [...], custom_role: [...] }`，内置角色包含 ADMIN（超级管理员）、WORKSPACE_MANAGE（工作空间管理员）、USER（普通用户），且内置角色不可删除、不可修改权限。

2. **AC2 - 自定义角色 CRUD**：管理员可通过 `POST /api/system/role` 创建自定义角色，`DELETE /api/system/role/{role_id}` 删除角色，角色名不重复。PE/EE 版本守卫（CE 版返回 403）。

3. **AC3 - 权限配置**：`GET /api/system/role/{role_id}/permission` 返回带模块/操作分组的权限树（含 `enable` 状态），`POST /api/system/role/{role_id}/permission` 保存权限勾选结果，持久化到数据库。

4. **AC4 - 权限模板**：`GET /api/system/role/template/{role_type}` 返回对应角色类型的默认权限模板（用于新建角色时的参考）。

5. **AC5 - 角色成员管理**：管理员可向角色添加/移除成员（系统用户），`GET /api/system/role/{role_id}/member` 返回成员列表，`POST /api/system/role/{role_id}/member` 批量添加。

6. **AC6 - 前端路由守卫**：为角色分配"只读知识库"权限后，该用户登录系统，前端路由守卫自动将其拦截导离编排（workflow/application）模块，无权模块菜单不可见。

7. **AC7 - 后端 API 零信任拦截**：用户无对应权限时，后端所有受保护接口（POST/PUT/DELETE）返回 403，不依赖前端隐藏实现安全防护。使用已有 `has_permissions` 装饰器 + `ViewPermission` 机制。

8. **AC8 - 版本限制**：RBAC 自定义角色管理仅在 PE/EE 版本可用。CE 版用户角色固定为 ADMIN/USER，不暴露角色管理页面。

## Tasks / Subtasks

- [ ] Task 1: 实现角色列表与 CRUD 后端接口 (AC: #1, #2)
  - [ ] 1.1 新建 `apps/users/views/role.py`（或 `apps/system_manage/views/role.py`），实现 `GET /system/role`（内置+自定义分组返回）
  - [ ] 1.2 实现 `POST /system/role` 创建/更新自定义角色（校验名称唯一性），`DELETE /system/role/{role_id}` 删除自定义角色（内置角色拒删）
  - [ ] 1.3 新建 `apps/users/serializers/role.py`（或 `apps/system_manage/serializers/role.py`），定义 `RoleSerializer`、`RoleCreateSerializer`
  - [ ] 1.4 在对应 `urls.py` 注册路由，在入口用 `settings.edition` 校验 PE/EE 版本守卫
  - [ ] 1.5 内置角色来自 `RoleConstants` 枚举（ADMIN、WORKSPACE_MANAGE、USER），从 `permission_constants.py` 动态构建，无需额外 DB 表

- [ ] Task 2: 实现权限树配置接口 (AC: #3, #4)
  - [ ] 2.1 实现 `GET /system/role/template/{role_type}`：根据 `RoleTypeEnum` 返回 `PermissionConstants` 枚举中对应 `role_list` 的权限集合，结构为 `[{id, name, module, enable}]`
  - [ ] 2.2 实现 `GET /system/role/{role_id}/permission`：读取该角色已保存的权限配置，与全量权限模板合并，返回带 `enable` 字段的权限树
  - [ ] 2.3 实现 `POST /system/role/{role_id}/permission`：接收 `[{id, enable}]` 数组，持久化到数据库（新建 `role_permission` 关联表 或 JSONField 存储）
  - [ ] 2.4 权限树按 `SystemGroup`/`WorkspaceGroup` 分组，按 `Operate` 列举操作，生成前端 `PermissionConfiguration.vue` 期望的树形结构
  - [ ] 2.5 生成 Django migration（如需新表）

- [ ] Task 3: 实现角色成员管理接口 (AC: #5)
  - [ ] 3.1 实现 `GET /system/role/{role_id}/member` 返回角色下的用户列表（分页）
  - [ ] 3.2 实现 `POST /system/role/{role_id}/member` 批量为角色添加用户成员
  - [ ] 3.3 实现 `DELETE /system/role/{role_id}/member/{user_id}` 移除角色成员
  - [ ] 3.4 成员关联通过 `User.role` 字段或新增 `role_user_mapping` 表实现（优先复用已有 `WorkspaceUserResourcePermission` 或 `User.role` 字段模式，保持架构一致）

- [ ] Task 4: 强化后端 API 零信任权限拦截 (AC: #7)
  - [ ] 4.1 审查 `apps/knowledge/`、`apps/application/`、`apps/tools/` 等模块的 views，确认所有写操作（POST/PUT/DELETE）均已使用 `@has_permissions(ViewPermission(...))` 装饰器
  - [ ] 4.2 对缺失权限拦截的接口补充 `has_permissions` 注解，参考 `apps/common/auth/authentication.py` 中 `has_permissions` 用法
  - [ ] 4.3 确保权限校验不依赖前端传入的角色信息，从 request 的 Auth 对象中读取服务端解析的角色/权限

- [ ] Task 5: 前端路由守卫与菜单权限控制 (AC: #6, #8)
  - [ ] 5.1 检查 `ui/src/router/` 中的路由守卫逻辑，确认基于用户权限的路由过滤已实现或补充
  - [ ] 5.2 确认 `ui/src/directives/hasPermission.ts` 的 `v-hasPermission` 指令调用链路（`hasPermission` utility → 用户权限 store）正确工作
  - [ ] 5.3 CE 版本隐藏角色管理菜单入口（`ui/src/views/system/role/` 路由在 CE 下不注册或重定向）
  - [ ] 5.4 验证角色页面已有组件可正常工作：`index.vue`（角色列表+切换）、`CreateOrUpdateRoleDialog.vue`（创建/编辑）、`PermissionConfiguration.vue`（权限勾选）、`Member.vue`（成员管理）

- [ ] Task 6: 编写测试 (AC: all)
  - [ ] 6.1 单元测试：角色 CRUD 接口（mock DB），测试创建/删除/查询分支
  - [ ] 6.2 权限验证测试：无权限用户访问 POST/PUT/DELETE 接口返回 403
  - [ ] 6.3 CE 版本守卫测试：`edition='CE'` 时角色管理接口返回 403

## Dev Notes

### 架构关键约束

- **现有权限骨架已完整**：`apps/common/constants/permission_constants.py` 已定义全套 `PermissionConstants` 枚举、`RoleConstants`（ADMIN/WORKSPACE_MANAGE/USER/EXTENDS_ADMIN 等）、`ViewPermission`、`Auth`、`CompareConstants`。开发不应重复定义权限枚举，**直接复用**。[Source: apps/common/constants/permission_constants.py]
- **内置角色无需 DB**：ADMIN、WORKSPACE_MANAGE、USER 来自 `RoleConstants` 枚举，`role_list` 字段在 `PermissionConstants` 各 Permission 中已声明，API 从枚举动态构建无需写 DB 表。自定义角色才需要 DB 持久化。
- **`User.role` 字段**：`apps/users/models/user.py` 的 `User` 模型有 `role = models.CharField` 字段，存储角色名（如 `"ADMIN"`、`"USER"`）。角色分配操作应更新此字段，或在新增 mapping 表时保持与此字段同步。[Source: apps/users/models/user.py]
- **`WorkspaceUserResourcePermission`**：`apps/system_manage/models/workspace_user_permission.py` 存储的是工作空间维度的**资源级**权限（知识库/应用的读写），与系统级角色（ADMIN/USER）是不同粒度，不要混用。[Source: apps/system_manage/models/workspace_user_permission.py]
- **`has_permissions` 装饰器**：位于 `apps/common/auth/authentication.py`，接受 `ViewPermission(roleList, permissionList, compare)` 参数。所有写操作 API 必须通过此装饰器而非在业务逻辑内部做 if 判断。[Source: apps/common/auth/authentication.py]
- **版本守卫**：`from maxkb import settings; settings.edition in ['PE', 'EE']`，CE 版自定义角色接口返回 403。
- **命名**：DB 表字段 snake_case，Python 类名 PascalCase，前端 TypeScript 接口 camelCase（DRF Serializer 输出 snake_case，前端按此解析）。[Source: _bmad-output/planning-artifacts/architecture.md#命名模式]

### 现有代码触碰范围

**后端新建文件：**
- `apps/system_manage/views/role.py`（或 `apps/users/views/role.py`）— 角色 CRUD + 权限 + 成员管理视图
- `apps/system_manage/serializers/role.py`（或 `apps/users/serializers/role.py`）— 角色相关 Serializer

**后端修改文件：**
- 对应 `apps/system_manage/urls.py` 或 `apps/users/urls.py` — 注册新路由
- `apps/knowledge/views/*.py`、`apps/application/views/*.py` 等 — 补充缺失的 `has_permissions` 装饰器（仅补缺，不重构已有逻辑）

**数据库（如需新表）：**
- 自定义角色表：`custom_role`（id, name, description, workspace_id）
- 角色权限关联：`role_permission_mapping`（role_id, permission_id, enable）
- 若复用 `User.role` 字段，无需新 mapping 表；若需多角色支持，需新建 `user_role_mapping`

**前端（理论上已存在，需验证接口路径匹配）：**
- `ui/src/views/system/role/index.vue` — 角色列表页（内置/自定义分栏）
- `ui/src/views/system/role/component/CreateOrUpdateRoleDialog.vue` — 角色创建/编辑弹窗
- `ui/src/views/system/role/component/PermissionConfiguration.vue` — 权限勾选表格（模块+操作 checkbox）
- `ui/src/views/system/role/component/Member.vue` — 成员列表
- `ui/src/views/system/role/component/AddMemberDrawer.vue` — 添加成员抽屉
- `ui/src/api/system/role.ts` — 完整 API 封装（`getRoleList`、`getRoleTemplate`、`getRolePermissionList`、`CreateOrUpdateRole`、`deleteRole`、`saveRolePermission`）
- `ui/src/directives/hasPermission.ts` — 全局权限指令（已实现）
- `ui/src/utils/permission.ts`（预期存在）— `hasPermission` 工具函数

### Project Structure Notes

- **Epic 对照**：架构文档将 Identity & Enterprise Management 对应到 `apps/system_manage/` + `ui/src/permission/`。[Source: _bmad-output/planning-artifacts/architecture.md#Epic对照映射]
- **重要发现**：前端角色管理 UI（`ui/src/views/system/role/`）和 API 封装（`role.ts`）已经完整实现，包括权限配置 checkbox 表格和成员管理抽屉。本故事实现重点在**后端 API**，需与前端已有接口契约对齐。
- **`role.ts` 中的接口契约**：`getRoleList` → `GET /system/role`，`getRoleTemplate(role_type)` → `GET /system/role/template/{role_type}`，`getRolePermissionList(role_id)` → `GET /system/role/{role_id}/permission`，`CreateOrUpdateRole(data)` → `POST /system/role`，`deleteRole(role_id)` → `DELETE /system/role/{role_id}`，`saveRolePermission(role_id, [{id, enable}])` → `POST /system/role/{role_id}/permission`。[Source: ui/src/api/system/role.ts]
- **`PermissionConfiguration.vue` 数据结构**：期望权限数据格式为 `[{id, name, module, permission: [{id, name, enable}]}]`，后端需按模块分组输出。[Source: ui/src/views/system/role/component/PermissionConfiguration.vue]
- **上一个故事（5-1）关联**：SSO 已通过 `AuthBaseHandle` 机制对接用户来源（`User.source` 字段）。RBAC 角色分配时需考虑 SSO 用户（`source != 'LOCAL'`）的默认角色策略。

### References

- RoleConstants 定义（ADMIN/WORKSPACE_MANAGE/USER）：[Source: apps/common/constants/permission_constants.py#L295-L303]
- PermissionConstants 全集（含 role_list 声明）：[Source: apps/common/constants/permission_constants.py]
- has_permissions 装饰器：[Source: apps/common/auth/authentication.py]
- hasPermission 前端指令：[Source: ui/src/directives/hasPermission.ts]
- User 模型（role 字段、source 字段）：[Source: apps/users/models/user.py]
- WorkspaceUserResourcePermission 模型（资源级权限）：[Source: apps/system_manage/models/workspace_user_permission.py]
- 角色 API 封装（前端接口契约）：[Source: ui/src/api/system/role.ts]
- 角色列表 + 权限配置组件：[Source: ui/src/views/system/role/]
- 架构零信任安全要求：[Source: _bmad-output/planning-artifacts/architecture.md#身份认证与安全]
- FR3 业务需求：[Source: _bmad-output/planning-artifacts/prd.md#FunctionalRequirements]
- NFR3 零信任边界：[Source: _bmad-output/planning-artifacts/prd.md#NonFunctionalRequirements]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_（由实现 Dev Agent 填写）_

### Completion Notes List

_（由实现 Dev Agent 填写）_

### File List

**后端新建文件：**
- `apps/system_manage/views/role.py` — 角色 CRUD、权限树、成员管理视图
- `apps/system_manage/serializers/role.py` — RoleSerializer、RoleCreateSerializer、RolePermissionSerializer

**后端修改文件：**
- `apps/system_manage/urls.py` — 注册 /system/role 路由组
- 各业务模块 views（`apps/knowledge/views/*.py`、`apps/application/views/*.py` 等）— 补充缺失 `has_permissions` 装饰器

**Django Migrations（按需）：**
- `apps/system_manage/migrations/0007_add_custom_role_tables.py`（如需新表）

**前端（验证已存在，接口路径匹配后无需修改）：**
- `ui/src/views/system/role/index.vue`
- `ui/src/views/system/role/component/CreateOrUpdateRoleDialog.vue`
- `ui/src/views/system/role/component/PermissionConfiguration.vue`
- `ui/src/views/system/role/component/Member.vue`
- `ui/src/views/system/role/component/AddMemberDrawer.vue`
- `ui/src/api/system/role.ts`
- `ui/src/directives/hasPermission.ts`
