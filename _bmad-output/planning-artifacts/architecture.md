---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/project-context.md']
workflowType: 'architecture'
project_name: 'MaxKB'
user_name: 'Boss'
date: '2026-03-04'
lastStep: 8
status: 'complete'
completedAt: '2026-03-04'
---

# 架构决策文档 (Architecture Decision Document)

_本文档通过基于步骤的协同发现构建。随着我们一起完成各项架构决策，新的小节将被补充到该文档中。_

## 项目上下文分析 (Project Context Analysis)

### 需求概述 (Requirements Overview)

**功能性需求 (Functional Requirements):**
从 PRD 中提取了 20 个核心功能性需求，涵盖了 8 个业务领域。
在架构层面上，这意味着系统需要极度解耦与模块化。问答引擎必须支持标准的基于服务器推送事件（SSE）的流式返回链路。可视化工作流层（Agentic Orchestration）要求系统具备强大的异步状态流转与执行记录追踪机制。此外，涉及到企业版本的身份集成（SSO单点登录）、多渠道 IM 的反向回调系统以及多租户数据空间的绝对权限隔离，都是决定底层资源如何映射挂架的核心。

**非功能性需求 (Non-Functional Requirements):**
驱动关键架构设计的非功能要素包括：
- **瞬时性能指标：** 模型前置处理延迟需严格控制在 <500ms，而 1 亿大体量 Token 分段的向量召回时间需保证 <1秒。要求实施多级缓存结构（Redis）与极致优化的向量检素层。
- **安全与审计防御：** 要求设立零信任作用域拦截网关 (Middleware)，任何底层表单调阅都不可越权并必须强验证租户所有权；全体系具备溯源审计追踪。
- **多端异构兼容：** 为了适应信创与私有物理机房纯离线运转场景，镜像打包与数据库连接必须原生支持 x86 与 ARM 指令集，解耦任何对外部公有云的硬强依赖行为。

**规模与复杂性 (Scale & Complexity):**
基于分析结果，这是一个中高复杂度的企业级系统。

- 主要领域: B2B SaaS & Enterprise AI Platform
- 复杂度级别: 中高 (Medium-High)
- 预估架构组件数: 至少包含 7-10 组核心组件板块（如：接入网关服务、安全鉴权/SSO中心、知识文档切片处理引擎、统一大模型桥接调度代理、图灵完备图工作流引擎、IM 通道消息适配服务等）。

### 技术约束与依赖 (Technical Constraints & Dependencies)

- **栈绑定限制:** 结合项目规范定义，后端必须深度依托于 Python (Django) 框架辅以 Celery 执行异步任务分离；前端必须利用 Vue3/Vite/TypeScript 体系保障组件化状态流转。
- **异构大模型中立:** 面临众多供应商基座 API 的不确定性变换，核心调度代码与特定的大模型平台间必须实施高度可插拔（Pluggable）的设配隔离层防渗漏，以便热切换或容灾 fallback 回退。
- **数据库设计规范:** 绝对依赖于关系型（PostgreSQL）的 ORM 及事务一致性管控。

### 已识别的交叉切面关注点 (Cross-Cutting Concerns Identified)

- **多租户数据隔离空间 (Multi-Tenancy Isolation):** 贯穿各个数据表的查询层和路由注入拦截，包括对资源配额治理的宏观限制控制。
- **全面合规与审计埋点 (Security & Audit Tracking):** 每个管理员的调整配置和权限颁发皆需以旁路的形式留下操作可查留档池记录。
- **故障熔断及兜底能力 (Resilience & Fallback):** 在遭逢高频 API 并发墙或外部 LLM 供应商崩溃下线的状态下，整个系统应能保证其余业务节点的“软性功能收缩降级 (Graceful Degradation)”体验，不发生级联瘫痪。

## 起步模板评估 (Starter Template Evaluation)

### 主要技术领域 (Primary Technology Domain)

Full-stack (B2B SaaS / Enterprise AI Platform)，采用严格的前后端分离微服务架构理念。

### 起步选项考量 (Starter Options Considered)

对于这种量级的项目，依赖集成式的一键 Full-stack 脚手架（如 Next.js 或 Nuxt）并不合适，因为后端强依赖于 Python 科学计算及 LangChain 生态库。
因此，评估策略分为**独立后端脚手架**与**独立前端脚手架**的解耦初始化：

1. **后端 (Django 5.2.9):** 依赖原生的 `django-admin startproject` 辅以最佳实践目录结构规范，通过环境分离 (`base.py`, `dev.py`, `prod.py`) 建立安全的基石。
2. **前端 (Vue 3 + Vite):** 依赖官方 `create-vite` 的 `vue-ts` 模板，能够提供极速的开箱体验并锁定组合式 API + TS 支持。

### 选定起步方案：解耦的双仓（或双目录）微服务初始化

**选择理由 (Rationale for Selection):**
这种由标准官方 CLI 初始化配合我们手动规划“分层解耦”架构的方案，能最大限度降低框架带来的黑盒侵入性。它完美贴合 PRD 中要求的“无解耦不可维系”的高并发容错原则。

**初始化命令 (Initialization Command):**

```bash
# 后端基座初始化 (Backend)
python3 -m venv .venv
source .venv/bin/activate
pip install django==5.2.9 celery==5.5.3 psycopg==3.2.9
django-admin startproject maxkb_core .

# 前端基座初始化 (Frontend)
npm create vite@latest maxkb-web -- --template vue-ts
cd maxkb-web
npm install element-plus pinia vue-router @vue/eslint-config-typescript prettier
```

**由起步方案奠定的架构决策 (Architectural Decisions Provided by Starter):**

**编程语言与运行时 (Language & Runtime):**
- 后端被严格锁定在 Python 3.11 环境下。
- 前端运行在 Node.js 环境下，并由原生 TypeScript 5.8 及 Vue 的 `<script setup>` 组合式 API 给与严格的运行时与编译期类型保护。

**UI 与样式方案 (Styling Solution):**
- 基于 Element Plus 作为骨架，并结合 SCSS 进行模块化样式的独立隔离（避免内联式地狱）。

**构建工具生态 (Build Tooling):**
- 前端摒弃 Webpack，使用 Vite 以保证热重载的开发体验与最终生产构建架构的极致微卷化。

**测试框架部署 (Testing Framework):**
- （待后续专项引入，推荐 Django 原生测试库与针对前端组件的 Vitest）。

**代码结构与约束 (Code Organization):**
- Django `apps/` 目录挂载各隔离模块，通过解耦的蓝图设计规避交叉引用；前端强制 `src/views/`, `src/components/`, `src/api/` 的扁平解耦。

**开发者体验 (Development Experience):**
- 拥有独立的热重载工作流（`npm run dev`），同时由 Python 的 manage.py 驱动模型及路由变更。前后端互不阻塞干扰。

## 核心架构决策 (Core Architectural Decisions)

### 数据架构 (Data Architecture)

基于对项目内 `pyproject.toml` 的检索及源码查阅（`apps/knowledge/vector/pg_vector.py`）：

- **主关系型数据库:** PostgreSQL （通过 `psycopg==3.2.9` 驱动）
- **向量检索引擎:** 深度绑定并应用了 **pgvector**（通过 `django.contrib.postgres.search.SearchVector` 及自定义 SQL 查询如 `embedding_search.sql` 和 `keywords_search.sql` 提供综合检索支持）。
- **缓存与状态消息 (Cache & Broker):** 深度绑定了 **Redis** （通过 `django-redis==6.0.0`），并且同时支撑 `celery==5.5.3` 的异步队列投递，确立了系统的流式通信基带与定时任务（`django-celery-beat==2.8.1`）。

*这些架构决定已作为事实落地于整个项目环境，成为不可辩驳的底层事实。* 

### 身份认证与安全 (Authentication & Security)

基于检索项目的 `settings/base/web.py`，相关安全设定框架已经确定：

- **认证模式:** 采用无状态的 **Bearer Token 验证机制 (类似于 JWT 体系)**。这由 `SPECTACULAR_SETTINGS` 中的 `SECURITY_DEFINITIONS` 可以被彻底证实，后端通过 `AUTHORIZATION` Header 解析。这样的好处是完美适配“嵌入式小窗SDK”及“企业级开放 API”这两块硬伤需求。
- **权限与环境合规:** 系统预留了 `AnonymousAuthentication` 类用于分发免密访问链路，但核心后台拦截必定采取基于角色的强 RBAC 管控；并在 PE 版中拓展实现 SSO 单点登录对接（LDAP/OIDC）。

### API与服务调用通讯 (API & Communication Patterns)

结合代码库事实和需求要求，前后端的通讯形式将被确立：
- **主要 API 架构:** 采用纯正的 **RESTful** 形态，并由 `drf-spectacular` 进行自动化 OpenAPI / Swagger 文档衍生，这给集成方带来极大的便利。
- **流式返回响应:** 在进行 AI 对话推理或长事务生成追踪时，不会使用耗费资源的常驻 WebSocket 长连接，而是使用精美的 **Server-Sent Events (SSE)**，这在规则上下文中已有提及。

### 前端系统架构 (Frontend Architecture)

- **状态管理:** 采用 **Pinia** 划分 `workspace`、`chatUser` 及主系统级别模块，严防污染。
- **画布引擎:** 深度绑定并使用 **LogicFlow** 实作所有复杂图排布任务，且通过 Vue `onMounted/onUnmounted` 的生命周期妥善分离渲染器引用。

### 基础设施与部署 (Infrastructure & Deployment)

- **主推部署形式:** **Docker Compose**。（对于这个中高复杂度带有微服务隔离的架构单元，基于容器化产出物能够最大限度保证异构环境安全落地）。

## 实现模式与一致性规则 (Implementation Patterns & Consistency)

### 模式分类定义 (Pattern Categories Defined)

**关键潜在冲突点:**
针对后续接手的 AI Agent，有 5 个关键的隐患发源地，如果缺乏一致的格式化契约将会导致严重的联调失败：

### 命名模式 (Naming Patterns)

**数据库表列全蛇形 (Database Naming Conventions):**
由于我们采用了 Django 的 ORM。无论是 Table 或是 Column，都**强制要求所有 AI Agent 利用下划线分词法则**。
- `user_id` 不要写成 `userId`，关联外键的 Field 应写作 `author_account_id`（不要带类似 `_fk` 的非主流后缀）。

**API 与参数传递驼峰命名 (API & REST Conventions):**
基于 DRF 我们返回给前端的载荷以及 Query params 约定统一为 **下划线**（受 Django 特性影响最深）。但是如果是前端自造的数据或者由 Vite 进行包装向外暴露的接口定义文件 (`*.d.ts`) 则推荐统一转成前端友好的 `camelCase`。
*(警告点：当 Agent 处理前后端接洽时，需极度关注序列化中的 `snake_case` 和 `camelCase` 转换器机制。推荐让所有的 Django Serializers 输出都统一，前后端均知情如何解析。)*

**前端与组件大小写 (Code Naming Conventions):**
- Vue 组件文件及名称必须是 **大驼峰** `PascalCase`（如 `ChatInterface.vue` 而非 `chat-interface.vue`）以便于 `<ChatInterface />` 全局引入的统一性。
- Backend 中的 app 名字及服务文件名必须符合 Pythonic 下划线标准，如 `apps/system_manage/`。

### 结构与格式规则 (Structure & Format Patterns)

**解耦与扁平存放 (Project Organization):**
正如在 Project Context 指出的，我们实行横向切割：
- API 层不要放在 Views 内！由于这涉及到大模型复杂的调度，前端应将所有的 HTTP 请求定义汇聚到单独的 `/src/api` 夹中。
- 在 Django 端，不能横穿应用直接调用 `models.py`，若跨级需要数据应走公开注册的方法，且所有的长事务逻辑必须转移给 `@shared_task` 给 Celery 执行，不允许塞到接口函数中阻塞。

**API 响应结构封套 (API Response Formats):**
必须保持 DRF 输出与通用格式的高度防弹兜底封装：
```json
// 对于普通 REST 响应的标准格式：
{
  "code": 200, // 或者具体的报错业务码
  "message": "success",
  "data": { ... payload ... }
}
```
并且特别需要**严守流式响应 (SSE) 的协议规范**，其产出物必须为 `data: <JSON String>\n\n` 这种特定的长效块级字符串。

### 流程处理模式 (Process Patterns)

**前端加载及空挂处理 (Loading & Fallback):**
所有的列表以及数据拉取组件，如果无对应数据，不再允许只留空白。要求利用 Element Plus 渲染空状态（Empty States）。在读取请求派对前，务必对关联 UI 变量挂载 `loading.value = true` 防止用户狂刷 API。

### 强制执行指导 (Enforcement Guidelines)

**所有的 AI Agent 必须 (All AI Agents MUST):**
- **绝不破坏已有 ORM:** 修改数据源必须要确保可以通过 `makemigrations` 生成稳固脚本。
- **强制依赖分离与清理:** 如果你在 Vue 模板中加载了像 LogicFlow 或者外部原生库这样的大对象，必须！一定！要在 `onUnmounted` 中彻底 `destroy()` 或者清理防内存泄漏。
- **不能硬嵌令牌鉴权:** 绝不在前后台裸写大模型的 API Key 及用户系统密钥，通通依赖读取 Config 中的 Env 值，通过动态机制分发。

## 项目结构与边界 (Project Structure & Boundaries)

基于项目现有工程代码基的大量扫描与映射，已经可以彻底确定这是一个严格的前后端解耦双仓管理系统（由根目录直接切分为 Python 域和 Node 域）。

### 完整的项目目录结构 (Complete Project Directory Structure)

```text
MaxKB/  (Root)
├── pyproject.toml             # Python 生态及依赖声明
├── README.md                  # 概览文档
├── ui/                        # 前端主结构 (Vite + Vue3)
│   ├── package.json
│   ├── vite.config.ts
│   ├── eslint.config.ts
│   ├── public/                # 游离出的静态资产 (如 favicon)
│   └── src/                   # 前端源码核
│       ├── api/               # 横向隔离的 REST 请求封装
│       ├── assets/            # 样式、图片及字体
│       ├── components/        # 可被多处引用的可重用 Vue 组件
│       ├── layout/            # 整体系统的骨架与母版
│       ├── locales/           # i18n 国际化包目录
│       ├── router/            # Vue Router 权限与页面挂载
│       ├── stores/            # Pinia 全局响应式状态 (workspace/chatUser/...)
│       ├── utils/             # 通用 JS 拦截器和工具箱
│       ├── views/             # 特异化的单页路由容器组件
│       └── workflow/          # 【核心】独立的复杂画布及逻辑编排模块
│
└── apps/                      # 后端主结构 (Django Apps 集群)
    ├── manage.py
    ├── maxkb/                 # Django Root Config，包含 settings 分组
    ├── application/           # PRD.Agentic 应用定义与节点分发层
    ├── chat/                  # PRD.Interaction 用户对话端及历史归档
    ├── common/                # 中间件、自定义认证和工具函数基类
    ├── knowledge/             # PRD.Knowledge 文档解析及 pgvector 关联存储
    ├── models_provider/       # PRD.Models LangChain 与异构模型底座适配层
    ├── oss/                   # 对象存储支持
    ├── system_manage/         # PRD.RBAC 企业系统级设置与鉴权核
    ├── tools/                 # MCP 与大模型动作工具商店
    └── trigger/               # 定时及外部事件触发控制
```

### 架构边界限制 (Architectural Boundaries)

**API 网关与通信边界 (API Boundaries):**
- 所有前端组件，不可绕过 `ui/src/api` 单独自命 HTTP 请求，以确保能够被 Axios 拦截器注入 Bearer Token 鉴权凭证以及捕捉统一错误（如 `401 Unauthorized` 或接口限流）。
- 外部集成方调用的接口将由 Django `urls.py` 中特定的 `openapi/` 或 `api/v1/` 空间隔绝提供支持，不与系统内部管理员强状态 API 混用。

**组件边界隔离 (Component Boundaries):**
- **逻辑流放逐:** 组件 (如在 `ui/src/views/`) 内坚决不允许承载巨量业务数据的清洗或者全局状态校验。如果有，必须转移至少一个级别到 `stores/` 进行统一处理分发，以避免 Vue V-dom 的重度阻塞。

**数据流与服务边界 (Service Integration Patterns):**
- `models_provider` 严格定义了**模型方桥接中立性**的边界，`knowledge` 处理向量搜索时，只能借由依赖反转 (DI) 或者适配器与 `models_provider` 沟通去获取 Embedding模型引擎，而不能将特定大厂模型名称（比如 DeepSeek 逻辑）写死进业务模块中。这就是高度隔离的典型解法。

**核心业务/Epic 对照映射 (Epic to Structure Mapping):**

- **Epic [Identity & Enterprise Management]**
   - → 前后端路由配置：`apps/system_manage/`, `ui/src/permission/`
- **Epic [Knowledge Processing & Embedding]**
   - → 包含 `apps/knowledge/vector/pg_vector.py`，挂载点在 `ui/src/views/knowledge/`
- **Epic [Agentic Orchestration Canvas]**
   - → 由专属目录承载 `ui/src/workflow/` 和负责流解析转发的 `apps/application/` 以及配套动作插件 `apps/tools/`
- **Epic [Terminal Interaction & Chat]**
   - → 对话历史 `apps/chat/`，前端渲染位于 `ui/src/views/chat/` 及 `ui/src/chat.ts` 相关的状态存储 `ui/src/stores/chatUser.ts`。

## 架构校验与定稿 (Architecture Validation & Completion)

### 连贯性验证 (Coherence Validation) ✅

**技术决策兼容性 (Decision Compatibility):**
所选 Python 3.11/Django 5.2.9 与 Vue3/Vite 完全兼容于 RESTful API 标准解耦模型。引入 Celery 处理大模型推流和异步重负载与 DRF SSE 回调完美嵌套。所有底层技术栈均无版本级和生态理念冲突。

**模式一致性 (Pattern Consistency):**
强制统一采用的 Snake_case (下划线) API 参数协议能与 Django 原生驱动做到零成本无缝转换。Pinia/Vue Router 加载配合统一网络 Axios 拦截器有效支撑了 JWT 鉴权的闭环传递。

**架构边界对齐 (Structure Alignment):**
目录层将核心架构一分为二(`apps/` vs `ui/`)，充分体现了 PRD 中预想的离线物理打包部署能力(通过 Docker 分装)，与业务逻辑上强调的“中继分离”高度契合。

### 需求覆盖验证 (Requirements Coverage Validation) ✅

**功能需求实现点 (Functional Requirements Coverage):**
- **智能知识萃取分析：** 依赖 `apps/knowledge/` 解析文档，入库基于内建支持的 PostgreSQL + pgvector 实现毫秒级响应机制。
- **动态应用画布：** 由前端 `LogicFlow` 接驳 `ui/src/workflow/` 获取图形化，而后端 `apps/application/` 下发执行网络流配置。
- **安全与权限审计：** 通过 Django 原生鉴权网关与 `system_manage/` 应用协同，支撑 RBAC 与企业级 SSO 协议挂载。

**非功能性指标支撑 (NFRs Assessed):**
高瞬时并发与断网回撤的 NFR 被 Celery 和 Redis 高速队列缓冲完美拆借。一切模型响应以 SSE 推流进行 UI 层实时渲染抵消了超长网络等待阻塞体验。

### 落地实现准备评估 (Implementation Readiness Validation) ✅

- [x] 多智能体协作规约 (Coding patterns/Consistency for AI) 全面锁死
- [x] 项目双仓底层基建目录精确查明
- [x] 配置驱动与环境变量防泄漏保护锁死

### 当前残余小缺口诊断 (Gap Analysis Results)

- **[中优先级] 前端测试框架空白：** 目前 Vue 这边缺乏像 Vitest 这样的 TDD 基石文档，这是需要后续加入的组件。
- **[低优先级] 日志上传统一：** 目前未明确 Django 是把日志写在 Volume 文件内部还是丢给外部的 Logstash。考虑到这是开源的 MaxKB，通常暂以 `logging` 组件写库或文本为主。

这些 Gap 并**不构成**下一步写代码（故事实现）的重大路障，可在开发迭代的 DevOps 补充周期进行修复完善。

### 最终架构准入放行决议 (Architecture Readiness Assessment)

**整体状态:** READY FOR IMPLEMENTATION (准备就绪可投入生产实现)
**开发置信度:** HIGH (因架构源自已在良好运作的生产基石)

**对于接管本库开发的 AI 智能体的强制嘱托 (Handoff Guidelines for AI Agents)：**
1. 请完全遵循上述对于“驼峰/蛇形命名、Celery 剥离耗时大模型请求、Vue onUnmounted 销毁监听”的铁律！
2. 架构本身就是法律，如果你擅自在 `ui/src/views/` 裸写请求而逃避 API 封装，将被视为破坏架构行为。
3. 一切行动基于本文件 `architecture.md` 以及 `project-context.md` 为最优先真理准则。
