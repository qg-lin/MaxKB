# Story 5.5: White-Labeling 私有品牌标识替换

Status: done

## Story

As a 品牌管理员,
I want 能随意上载企业的 Logo 图片，挑选页面 CSS 主色调以及定制诸如免责声明等特定声明挂架在界面,
so that 整个对外的 AI Agent 表现出的就是完完全全我司自己的定制 SaaS 无缝整合服务了.

## Acceptance Criteria

1. **AC1 - 获取外观配置（公开接口）**：`GET /display/info` 无需认证即可访问（CE/PE/EE 全版本均可），返回当前系统的主题配置。若未设置过配置则返回默认值：`theme="#3370FF"`, `title="MaxKB"`, `icon=null`, `loginLogo=null`, `loginImage=null` 及平台链接开关。响应格式 `{ "code": 200, "data": { "theme": "...", "icon": "...", ... } }`。

2. **AC2 - 更新外观配置（PE/EE + ADMIN）**：`PUT /display/update` 接受 `multipart/form-data`，支持字段：`theme`（颜色 hex 字符串）、`icon`（文件/字符串）、`loginLogo`（文件/字符串）、`loginImage`（文件/字符串）、`title`（最长 128 字符）、`slogan`（最长 64 字符）、`showUserManual`（布尔）、`userManualUrl`（最长 128 字符）、`showForum`（布尔）、`forumUrl`（最长 128 字符）、`showProject`（布尔）、`projectUrl`（最长 128 字符）。需要 `APPEARANCE_SETTINGS_EDIT` 权限 + `ADMIN` 角色；CE 版返回 403。

3. **AC3 - 文件存储与 URL 返回**：上传的图片文件（icon/loginLogo/loginImage）保存到系统存储目录（`display/` 路径），保存后返回可访问的 URL 路径。若字段传入为空字符串则清除对应图片；若字段传入为已有 URL 字符串（非 File 对象）则保持不变。

4. **AC4 - 持久化到 SystemSetting**：主题配置以 JSON 格式保存在 `SystemSetting` 表中（`type=SettingType.THEME`）。`PUT /display/update` 使用 `update_or_create` 写入，`GET /display/info` 读取后返回，若记录不存在则返回系统默认值。

5. **AC5 - 版本权限守卫**：`PUT /display/update` 在 CE 版（`settings.edition` 不为 PE/EE）时返回 HTTP 403，并提示版本不支持。`GET /display/info` 不受版本限制。

6. **AC6 - 前端无需改动**：前端 `ui/src/api/system-settings/theme.ts`、`ui/src/stores/modules/theme.ts`、`ui/src/views/system-setting/theme/index.vue` 已完整实现，后端只需精确匹配前端约定的 API 契约即可。

## Tasks / Subtasks

- [ ] Task 1: 扩展 SystemSetting 模型并生成迁移 (AC: #4)
  - [ ] 1.1 在 `apps/system_manage/models/system_setting.py` 的 `SettingType` 中添加 `THEME = 3, "主题配置"`
  - [ ] 1.2 运行 `python manage.py makemigrations system_manage` 生成迁移文件
  - [ ] 1.3 验证迁移文件正确性（仅修改 choices，无实际 schema 变更）

- [ ] Task 2: 实现主题序列化器 (AC: #1, #2, #3, #4)
  - [ ] 2.1 新建 `apps/system_manage/serializers/display.py`
  - [ ] 2.2 实现 `DisplaySerializer(serializers.Serializer)` 类，包含字段：`theme`(CharField)、`icon`(FileField/CharField)、`loginLogo`(FileField/CharField)、`loginImage`(FileField/CharField)、`title`(CharField,max=128)、`slogan`(CharField,max=64)、`showUserManual`(BooleanField)、`userManualUrl`(CharField,max=128)、`showForum`(BooleanField)、`forumUrl`(CharField,max=128)、`showProject`(BooleanField)、`projectUrl`(CharField,max=128)
  - [ ] 2.3 实现 `get_default_info()` 类方法，返回系统默认主题配置字典（当 SystemSetting 不存在时使用）
  - [ ] 2.4 实现 `get_info()` 类方法：从 `SystemSetting.objects.filter(type=SettingType.THEME).first()` 读取，若存在则返回 `setting.meta`，否则返回 `get_default_info()`
  - [ ] 2.5 实现 `save_file(file, field_name)` 静态方法：使用 `default_storage.save(f'display/{field_name}/{uuid}/{file.name}', file)` 保存文件，返回可访问 URL（通过 OSS 检索路由或媒体路径）
  - [ ] 2.6 实现 `update()` 方法：遍历 `icon/loginLogo/loginImage` 字段——若为 File 对象则调用 `save_file()` 并更新为 URL；若为空字符串则置为 null；若为已有字符串则保持不变。最后调用 `SystemSetting.objects.update_or_create(type=SettingType.THEME, defaults={'meta': validated_data})`

- [ ] Task 3: 实现主题视图 (AC: #1, #2, #5)
  - [ ] 3.1 新建 `apps/system_manage/views/display.py`
  - [ ] 3.2 实现 `DisplayView(APIView)` 外层类
  - [ ] 3.3 实现内部类 `Info(APIView)`：**不设置** `authentication_classes`（公开接口），GET 方法调用 `DisplaySerializer.get_info()` 并返回 `result.success(data)`
  - [ ] 3.4 实现内部类 `Update(APIView)`：`authentication_classes = [TokenAuth]`，PUT 方法添加 `@has_permissions(PermissionConstants.APPEARANCE_SETTINGS_EDIT, RoleConstants.ADMIN)` 装饰器，调用 `DisplaySerializer(data=request.data).update()` 并返回 `result.success(True)`
  - [ ] 3.5 在 `Update.put` 中添加版本守卫：检查 `settings.edition` 若不为 PE/EE，则返回 `result.error('当前版本不支持此功能', status=403)`（参考 Story 5.1/5.2 的版本守卫模式）

- [ ] Task 4: 注册 URL 路由 (AC: #1, #2)
  - [ ] 4.1 在 `apps/system_manage/urls.py` 添加：
    - `path('display/info', views.DisplayView.Info.as_view())`
    - `path('display/update', views.DisplayView.Update.as_view())`
  - [ ] 4.2 在 `apps/system_manage/views/__init__.py` 导出 `DisplayView`

- [ ] Task 5: 更新序列化器导出 (AC: all)
  - [ ] 5.1 在 `apps/system_manage/serializers/__init__.py` 中导出 `DisplaySerializer`

- [ ] Task 6: 验证前后端联调 (AC: #6)
  - [ ] 6.1 验证 `GET /display/info` 在无 Token 情况下返回 200 和正确数据格式
  - [ ] 6.2 验证 `PUT /display/update` multipart/form-data 上传图片后返回成功，且 `GET /display/info` 可读到更新后的数据
  - [ ] 6.3 验证文件字段 camelCase 命名（`icon`、`loginLogo`、`loginImage`）与前端 FormData 字段名精确匹配

## Dev Notes

### 🔥 核心发现：前端已完全实现，后端全部缺失

**前端已完整实现（禁止修改）：**
- `ui/src/api/system-settings/theme.ts` — API 调用：`GET /display/info` 和 `PUT /display/update`
- `ui/src/stores/modules/theme.ts` — Pinia 主题 store，启动时加载主题
- `ui/src/views/system-setting/theme/index.vue` — 完整 UI（颜色选择器、图片上传、实时预览、平台链接开关）
- `ui/src/components/logo/LogoFull.vue` / `LogoIcon.vue` — 动态 Logo 渲染（读取 store 中的 `themeInfo`）
- `ui/src/utils/theme.ts` — 预设颜色列表 + `defaultSetting` + `defaultPlatformSetting`

**后端需新建（当前全部缺失）：**
- `apps/system_manage/serializers/display.py` — 主题序列化器
- `apps/system_manage/views/display.py` — 主题视图（2 个 API endpoint）
- 修改 `apps/system_manage/models/system_setting.py` — 添加 `SettingType.THEME = 3`
- 修改 `apps/system_manage/urls.py` — 添加 2 条路由
- 修改 `apps/system_manage/views/__init__.py` — 导出 `DisplayView`
- 修改 `apps/system_manage/serializers/__init__.py` — 导出 `DisplaySerializer`

### 前端 API 契约（后端必须精确匹配）

**🔑 关键说明：本 API 使用 camelCase 字段名（而非通常的 snake_case），原因是前端直接将 `themeForm` 对象的 key 映射为 FormData 字段名：**

```typescript
// ui/src/views/system-setting/theme/index.vue:362-365
const fd = new FormData()
Object.keys(themeForm.value).map((item) => {
  fd.append(item, themeForm.value[item])
})
```

**1. 获取主题信息** `GET /display/info`
```
Headers: (无需认证)

Response 200:
{
  "code": 200,
  "data": {
    "theme": "#3370FF",            // 主题颜色，默认 #3370FF
    "icon": "/media/display/...",  // 网站Logo URL，默认 null
    "loginLogo": "/media/...",     // 登录Logo URL，默认 null
    "loginImage": "/media/...",    // 登录背景 URL，默认 null
    "title": "MaxKB",              // 网站名称，默认 "MaxKB"
    "slogan": "...",               // 欢迎语
    "showUserManual": true,        // 是否显示使用手册入口
    "userManualUrl": "https://...",
    "showForum": true,
    "forumUrl": "https://...",
    "showProject": true,
    "projectUrl": "https://github.com/1Panel-dev/MaxKB"
  }
}
```

**2. 更新主题信息** `PUT /display/update`
```
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData fields (camelCase!):
  theme: "#3370FF"               (字符串)
  icon: <File> or <URL string>   (文件或已有URL)
  loginLogo: <File> or <URL>
  loginImage: <File> or <URL>
  title: "企业名称"              (max 128 chars)
  slogan: "欢迎语"               (max 64 chars)
  showUserManual: "true"|"false" (注意：FormData 传字符串)
  userManualUrl: "https://..."   (max 128 chars)
  showForum: "true"|"false"
  forumUrl: "https://..."
  showProject: "true"|"false"
  projectUrl: "https://..."

Response 200: { "code": 200, "data": true }
Response 403: { "code": 403, "message": "..." }  // CE版或无权限
```

⚠️ **FormData 布尔值处理**：`showUserManual` 等布尔字段通过 FormData 传递时为字符串 `"true"/"false"`，序列化器必须正确处理此转换。

### 关键实现细节

**文件存储方案**（参考 OSS 模块，但简化处理）：
```python
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import uuid

@staticmethod
def save_file(file, field_name: str) -> str:
    """保存上传文件，返回可访问的 URL 路径"""
    file_ext = os.path.splitext(file.name)[1]
    file_key = f'display/{field_name}/{uuid.uuid4().hex}{file_ext}'
    path = default_storage.save(file_key, ContentFile(file.read()))
    return default_storage.url(path)
```

**布尔字段处理（FormData 字符串 → Python bool）**：
```python
def _parse_bool(val):
    if isinstance(val, bool):
        return val
    return str(val).lower() in ('true', '1', 'yes')
```

**文件字段更新逻辑**：
```python
for field in ['icon', 'loginLogo', 'loginImage']:
    val = request.data.get(field)
    if hasattr(val, 'read'):  # 是 File 对象
        meta[field] = DisplaySerializer.save_file(val, field)
    elif val == '' or val is None:  # 清除图片
        meta[field] = None
    else:  # 已有 URL 字符串，保持不变
        meta[field] = val
```

**版本守卫参考**（参考 Story 5.1/5.2 实现模式）：
```python
from maxkb.conf import LICENSE_IS_PE_OR_EE  # 或相应的版本检测方法
# 在 PUT 方法中：
if not settings_check_pe_or_ee():
    return result.error('当前版本不支持外观设置', code=403)
```

### SystemSetting 模型修改

**修改 `apps/system_manage/models/system_setting.py`**：
```python
class SettingType(models.IntegerChoices):
    EMAIL = 0, '邮箱'
    RSA = 1, "私钥秘钥"
    LOG = 2, "日志清理时间"
    THEME = 3, "主题配置"   # ← 新增
```

⚠️ **迁移注意**：`type` 字段是 `IntegerField` 且 `choices` 是枚举，添加新的 IntegerChoices 值只影响 Django 层验证，**不需要实际的数据库 schema 变更**。迁移文件可能只修改 `choices` 参数，是安全的非破坏性迁移。

### 默认主题配置

当 `SystemSetting.objects.filter(type=SettingType.THEME)` 不存在时返回的默认值：
```python
DEFAULT_THEME = {
    'theme': '#3370FF',
    'icon': None,
    'loginLogo': None,
    'loginImage': None,
    'title': 'MaxKB',
    'slogan': 'Develop, deploy and use AI/LLM applications with ease',
    'showUserManual': True,
    'userManualUrl': 'https://maxkb.cn/docs/',
    'showForum': True,
    'forumUrl': 'https://bbs.fit2cloud.com/c/mk/11',
    'showProject': True,
    'projectUrl': 'https://github.com/1Panel-dev/MaxKB',
}
```

### 权限常量（已存在，无需创建）

```
apps/common/constants/permission_constants.py:89    → Group.APPEARANCE_SETTINGS
apps/common/constants/permission_constants.py:1217  → APPEARANCE_SETTINGS_READ
apps/common/constants/permission_constants.py:1221  → APPEARANCE_SETTINGS_EDIT
```

### 与前序 Story 的关联

- **Story 5.1 (SSO)**：版本守卫模式参考。PE/EE 版本检测写法。
- **Story 5.2 (RBAC)**：`@has_permissions` 装饰器使用模式参考：`@has_permissions(PermissionConstants.APPEARANCE_SETTINGS_EDIT, RoleConstants.ADMIN)`。
- **Story 5.4 (审计日志)**：`SystemSetting.objects.update_or_create` 写法参考（`LogCleanTimeSerializer.save_clean_time()` 模式）。

### 路由注册位置

`/display/info` 和 `/display/update` 注册在 `apps/system_manage/urls.py` 后，通过主 URL 配置：

```python
# apps/maxkb/urls/web.py:42
path(admin_api_prefix, include("system_manage.urls")),
```

最终生效路径为：`{admin_path}/api/display/info` 和 `{admin_path}/api/display/update`，与前端 `theme.ts` 中 `const prefix = '/display'` 对应（前端 Axios 配置会自动添加 admin prefix）。

### 陷阱与防护

1. **GET `/display/info` 不得设置 `authentication_classes`**：此接口在用户登录前就被调用（Pinia store 初始化阶段），若设置认证则会导致页面主题加载失败，品牌 Logo/颜色无法显示。

2. **FormData 布尔字段为字符串**：`showUserManual`、`showForum`、`showProject` 经 FormData 传输后为 `"true"/"false"` 字符串，不是 Python bool。序列化器必须转换。

3. **图片字段混合类型**：前端若图片未更换则传现有 URL 字符串；若更换则传 File 对象。后端需要用 `hasattr(val, 'read')` 或检查 `isinstance(val, InMemoryUploadedFile)` 区分。

4. **camelCase vs snake_case 例外**：本 API 的所有字段使用 camelCase（`loginLogo`, `showUserManual` 等），这是因为前端直接将 form 对象 key 作为 FormData 字段名。这是与架构规范的刻意例外，开发者不得将字段改为 snake_case。

5. **SettingType.THEME primary key 冲突**：`SystemSetting.type` 是 `primary_key=True`，所以每种 type 只有一条记录。使用 `update_or_create(type=SettingType.THEME, ...)` 是安全的。

6. **文件大小限制**：前端限制 10MB（`file?.size / 1024 / 1024 < 10`），后端可依赖前端校验，但建议后端也验证文件大小防止绕过。

### Project Structure Notes

**新建文件：**
- `apps/system_manage/serializers/display.py` — 主题序列化器

- `apps/system_manage/views/display.py` — 主题视图

**修改文件：**
- `apps/system_manage/models/system_setting.py` — 添加 `SettingType.THEME = 3`
- `apps/system_manage/urls.py` — 添加 2 条 display 路由
- `apps/system_manage/views/__init__.py` — 导出 `DisplayView`
- `apps/system_manage/serializers/__init__.py` — 导出 `DisplaySerializer`

**需要生成迁移（安全的非破坏性变更）：**
- `apps/system_manage/migrations/XXXX_alter_systemsetting_type.py`

**无需修改（前端已完整实现）：**
- `ui/src/api/system-settings/theme.ts`
- `ui/src/stores/modules/theme.ts`
- `ui/src/views/system-setting/theme/index.vue`
- `ui/src/views/system-setting/theme/LoginPreview.vue`
- `ui/src/components/logo/LogoFull.vue`
- `ui/src/components/logo/LogoIcon.vue`
- `ui/src/utils/theme.ts`
- `ui/src/router/modules/system.ts`（路由权限守卫已配置）

### References

- 前端 API 定义：[Source: ui/src/api/system-settings/theme.ts]
- 前端主题 Store：[Source: ui/src/stores/modules/theme.ts]
- 前端主题设置页：[Source: ui/src/views/system-setting/theme/index.vue#L267-L387]
- SystemSetting 模型（type 为 PK）：[Source: apps/system_manage/models/system_setting.py]
- SettingType 枚举（LOG=2，THEME=3 待添加）：[Source: apps/system_manage/models/system_setting.py#L15-L22]
- 权限常量（APPEARANCE_SETTINGS_READ/EDIT）：[Source: apps/common/constants/permission_constants.py#L1217-L1221]
- Email 视图模式参考（内部类结构）：[Source: apps/system_manage/views/email_setting.py]
- @has_permissions 装饰器：[Source: apps/common/auth/authentication.py#L96]
- TokenAuth 认证类：[Source: apps/common/auth/__init__.py]
- result.success() 标准响应：[Source: apps/common/result/]
- URL 主路由挂载点：[Source: apps/maxkb/urls/web.py#L42]
- system_manage 路由文件：[Source: apps/system_manage/urls.py]
- 审计日志 update_or_create 模式：[Source: apps/system_manage/serializers/log_serializers.py（待创建，参考 Story 5.4）]
- 系统设置 URL 已有路由：[Source: apps/system_manage/urls.py#L13-L15]
- API 响应格式标准：[Source: architecture.md#API响应结构封套]
- 命名规范（camelCase 例外说明）：[Source: architecture.md#命名模式]
- OSS 文件上传模式：[Source: apps/oss/views/file.py, apps/oss/serializers/file.py]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
