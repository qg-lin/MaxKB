---
stepsCompleted: ['step-01-validate-prerequisites']
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md']
---

# MaxKB - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for MaxKB, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR1: 全局管理员必须能配置 SSO 单点登录（支持 LDAP/OIDC/CAS/OAuth2 协议）及企业微信/钉钉/飞书扫码登录。(限PE/EE)
- FR2: 工作空间管理员必须能创建与物理/逻辑隔离对应的多个 Multi-Workspace，分配并限制资源配额。(限EE)
- FR3: 系统管理员必须能为用户分配细粒度的角色权限 (RBAC)，每种角色可独立控制对配置、编排、知识读写各域的访问级别。(限PE/EE)
- FR4: 用户必须能顺滑上传 PDF、Word 等多介质本地案卷库，并允许输入指定网页进行爬虫解析抓取。
- FR5: 系统在用户上传文档后必须自动完成文本分段与向量化处理，支持段落智能提取与分段策略配置。
- FR6: 库运维员可在 WebUI 中直接编辑查阅块碎段和修改对应的标引特征源标记。
- FR7: 编排工程师必须能在可视化空间通过节点点选与拖拽重连构成对话流程骨架。
- FR8: 编排工程师必须能使用至少四种核心节点类型：模型提供方切换、外部请求连接、知识检索拉取、异常兜底出口。
- FR9: 终端用户必须能以流式推送方式实时接收 AI 推理输出，呈现逐字渲染的打字机效果。
- FR10: 对话界面必须要能把触底支撑它的置信文档段落高亮标识进行可视化跟随抛出 (Citations/Reference 标记)。
- FR11: 用户必须可对输出消息进行 “赞与踩 (Thumbs-up/down)” 的意图纠错存储反馈。
- FR12: 管理员必须能一键生成可嵌入第三方网站的集成代码，支持至少两种嵌入方式。
- FR13: 外部开发者必须能通过经鉴权保护的标准 API 端点发起同步与异步对话请求。
- FR14: 管理员必须能配置提问端的身份验证策略，对终端对话用户进行身份识别与管理。(限PE/EE)
- FR15: 管理员必须能将应用接入企业微信、钉钉、飞书、微信公众号及 Slack 等第三方 IM 渠道。(限PE/EE)
- FR16: 管理员必须能对接飞书知识库并配置内容定时同步策略。(限PE/EE)
- FR17: 系统必须记录关键管理操作的审计日志，供管理员检索与导出。(限PE/EE)
- FR18: 管理员必须能通过开放 API 对系统资源进行程序化管理操作。(限PE/EE)
- FR19: 管理员必须能自定义系统 Logo、主题配色等全局外观设置，以及对话框浮窗入口、AI 头像、免责声明等应用级显示元素。(限PE/EE)
- FR20: 管理员必须能在多租户模式下配置知识库、工具和模型资源的跨组织共享策略。(限EE)

### NonFunctional Requirements

- NFR1 (TTFT Latency): 系统的中间请求代理到大模型的建立连接周转阶段耗时（TTFT前置处理耗时）必须控制于 < 500ms 以下。
- NFR2 (Search Efficiency): 向量库在容纳 1 亿 Token 单域数据段级别的体量内，近邻比对召回时间务必维持在 < 1 秒钟之内。
- NFR3 (Zero Trust Boundaries): 数据操作引擎在接受所有的读写变更服务前必须先被阻断进入底层验证权限（必须具有所在租户空间 Workspace 内的强校验声明）。绝不承认用户自行越界推入的假随机表识查改。
- NFR4 (Offline Full Capacity): 系统使用内部闭源 LLM 服务连接池模式下运作时，无论断裂何种外部骨干网段，其均应满足内部服务请求流转 100% 生效畅通而不存在远程锁止瘫痪。
- NFR5 (Decoupled Architecture): 适配各类大模型，不应涉及到核心流程分路层重编译。仅仅依靠拓展针对的模型适配解析插件注入即能无缝包容。
- NFR6 (Infrastructure Compatibility): 容器化微服务及周边配套中间件依赖（如向量库），除了必须稳定工作在标准 x86 宿主机下，亦必须原生支持 ARM 异构指令集架构，以此兼容信创要求。

### Additional Requirements

- 棕地项目约束 (Brownfield Constraint): 必须继承已有的双独立微服务结构：包含 Django 后端与 Vue3/Vite 组成的前端。Epic 与 Story 的组织须沿用已有的文件夹目录设计。
- 数据库与消息总线: 后端固定使用 PostgreSQL + pgvector 处理数据与向量，采用 Redis + Celery 驱动异步操作，这些依赖不可替代。
- 命名与结构规范约束: RESTful API 和 Django 模型字段严格采用 snake_case (下划线)，不可因为外部原因违背；前端命名遵守 Vue 的小驼峰与大驼峰法则。
- 互动与通讯协议约束: 服务流必须使用 SSE (Server-Sent Events) 而不能用长连接 WebSocket；UI 画布绑定 LogicFlow 需要注意内存控制与生命周期卸载。
- 并发与异常处理: 所有的长事务必须扔进 Celery 执行进程并且禁止阻塞 HTTP 进程；前端调用必挂载 `loading.value = true` 及利用全局的 Axios Tokens 拦截器。

### FR Coverage Map

FR1: Epic 5 - SSO 单点登录与第三方扫码
FR2: Epic 6 - 租户与多工作空间构建
FR3: Epic 5 - RBAC 用户细粒度角色控制
FR4: Epic 1 - 多介质文档上传及爬网
FR5: Epic 1 - 向量化处理及自适应分段
FR6: Epic 1 - 知识库碎片人工审阅与修改
FR7: Epic 2 - 可视化节点排布画布编排
FR8: Epic 2 - 节点内置逻辑 (模型, 知识, API, 兜底)
FR9: Epic 3 - SSE 实时流式响应返回
FR10: Epic 3 - Citation 引用高亮标注体系
FR11: Epic 3 - 意图纠错的 "赞/踩" 反馈网络
FR12: Epic 4 - Web 嵌入式浮窗整合代码生成
FR13: Epic 4 - OpenAPI 端点生成保障
FR14: Epic 5 - 提问端身份识别与管控
FR15: Epic 5 - 第三方沟通 IM (企微/飞书等) 接入
FR16: Epic 5 - 飞书知识协同同步
FR17: Epic 5 - 跨端留痕全量审计日志
FR18: Epic 5 - 面向开放 API 的全程序化资源管理
FR19: Epic 5 - Logo、外观及声明定制化能力白标
FR20: Epic 6 - 跨租户跨组织资源的合规共享配置

## Epic List

### Epic 1: 核心知识库与智能文本解析 (Core Knowledge Base & Processing)
知识管理员能够上传各种本地文档及抓取网页，系统全自动进行向量化分段，支持用户对知识切片的审查修正，实现知识从非结构化向 RAG 可用的转化。
**FRs covered:** FR4, FR5, FR6

### Epic 2: 可视化图灵工作流编排 (Agentic Orchestration & AI Flow Builder)
编排工程师无需写代码，直接在画布上使用模型、知识库、外部接口等各类节点，自由连线拽拖构建复杂的智能体业务流转骨架。
**FRs covered:** FR7, FR8

### Epic 3: AI 对话触达与用户反馈闭环 (End-User Chat Interaction)
终端用户能通过对话框获取如真人般极速响应的流式答复，并能直接看到引用的文档段落以及对结果进行“赞踩”反馈以持续优化模型。
**FRs covered:** FR9, FR10, FR11

### Epic 4: 跨平台内嵌支持与开放能力 (App Publishing & External Integrations)
管理员能轻松将编排好的智能体以代码片段的形式嵌入公司官网，同时开发者能使用 API 在自己的业务线中调用 MaxKB 智能体。
**FRs covered:** FR12, FR13

### Epic 5: 高级企业级运营管控矩阵 (Enterprise Operations & IAM)
企业 IT 部门与合规部门可以安全地基于 SSO/RBAC 接管内部职员，获取深度的操作审计链路，并将系统对话窗口接入诸如企业微信、钉钉等员工常用的内部 IM 平台；实现品牌的全面私有化定制配置。
**FRs covered:** FR1, FR3, FR14, FR15, FR16, FR17, FR18, FR19

### Epic 6: 集团级多租户隔离与联邦治理 (Multi-Tenant Governance)
巨型集团管理者能够开辟出物理或逻辑隔离的多个 Workspace 与租户空间，并进行严谨的数据保护与资源跨域授权共享。
**FRs covered:** FR2, FR20

## Epic 1: 核心知识库与智能文本解析 (Core Knowledge Base & Processing)

知识管理员能够上传各种本地文档及抓取网页，系统全自动进行向量化分段，支持用户对知识切片的审查修正，实现知识从非结构化向 RAG 可用的转化。

### Story 1.1: 多格式本地文档上传与网页抓取集成

As a 知识管理员,
I want 能在系统内通过拖拽或选择的方式上传 PDF、Word 等格式的文档，并能输入指定 URL 让系统抓取内容,
So that 能将企业现有的分散且格式不一的知识资产统一汇入到知识库中心化管理.

**Acceptance Criteria:**

**Given** 我处于知识库创建/编辑界面
**When** 我选择上传一个 10MB 的 PDF 或输入一个合规的 URL 网页
**Then** 系统应该能够接收这些文件或请求，并显示入库进度状态
**And** 前端必须显示 loading 状态直到通过 Axios 拦截器确认接收成功

### Story 1.2: 文档自动向量化与智能自适应分段

As a 知识管理员,
I want 在上传文档后触发后端的全自动化抽取、切片分段与 Embedding 向量转换,
So that 不需要我人工去标注文档重点，系统即可把原本长篇大论的文件转化为适合检索的独立小段落.

**Acceptance Criteria:**

**Given** 知识库中已经上传了原始文档任务
**When** 系统调度器开始处理该入库任务时
**Then** Celery 应该在后台执行长事务将其切分为块状文本
**And** 将文本片段送往大模型做 Embedding 操作，并将结果存入 PostgreSQL 的 pgvector 字段中

### Story 1.3: 可视化特征源切片修正与查阅

As a 库运维员,
I want 可在 WebUI 界面中搜索、阅读那些经过系统拆分的“块碎段”并编辑其文本与引用源标记,
So that 能在系统切分不完美时人为修正数据，以保证问答时引用的片段精确无误.

**Acceptance Criteria:**

**Given** 某份被向量化完毕的文档详情页中
**When** 我点击'文档切片'列表页卡时
**Then** 系统应从库中调取出对应的分段列表，并允许我对文本及其源元数据进行 Update 覆盖
**And** 保存修正时不得破坏已存在的 pgvector 索引结构

## Epic 2: 可视化图灵工作流编排 (Agentic Orchestration & AI Flow Builder)

编排工程师无需写代码，直接在画布上使用模型、知识库、外部接口等各类节点，自由连线拽拖构建复杂的智能体业务流转骨架。

### Story 2.1: 画布级工作流引擎载入与接线骨架

As a 编排工程师,
I want 打开编排工作区能看到一块图形画布，可在其上放置节点并通过边缘连线搭建逻辑骨架,
So that 直观地规划整个机器人的意图走向而无需书写 Python 解析代码.

**Acceptance Criteria:**

**Given** 我处于应用的'高级编排'界面
**When** 页面加载时
**Then** 系统应利用 LogicFlow 绘制出网格化的拖拽面板供我操作
**And** Vue 组件销毁时 (onUnmounted) 必须彻底释放 LogicFlow 画布对象防止内存泄漏

### Story 2.2: 内置核心流程节点功能实现

As a 编排工程师,
I want 能够把预定义的四类核心节点（模型方切换、外部连接、知识搜索、异常兜底出口）置于画布并配置其内部参数,
So that 我的图解骨架能变成真正带有驱动引擎和接口调用能力的行动流.

**Acceptance Criteria:**

**Given** 我已经在一个节点上配置了'模型调用'或者'外接 API'选项
**When** 我对这个节点填入参数并将其并入到整体流中执行保存时
**Then** 前端会将 JSON 定义发给 API 层
**And** 后端能将其存储在对应的 workflow 规范表里而不断开连接

## Epic 3: AI 对话触达与用户反馈闭环 (End-User Chat Interaction)

终端用户能通过对话框获取如真人般极速响应的流式答复，并能直接看到引用的文档段落以及对结果进行“赞踩”反馈以持续优化模型。

### Story 3.1: SSE 实时推流式推理响应

As a 终端最终用者,
I want 发送提问后能立刻像打字机一样接收到 AI 推理输出字符流,
So that 我不需要像传统调用一样干登好几秒才一次性得到几千字，缓解我的等待焦躁感.

**Acceptance Criteria:**

**Given** 网络连通，对话引擎后端的 TTFT 小于 500ms
**When** 我发送一句话质询给机器人
**Then** 前端应用立刻通过读取 Server-Sent Events (SSE) 协议展示流式包裹的内容
**And** 后端必须利用 Celery 不阻断的方式推发 SSE 协议而不是用 WebSocket 长连接

### Story 3.2: 引用文档动态 Citation 可视化抛出

As a 终端最终用者,
I want 能在系统回复消息下方清晰地看到它参考了哪几个特定文档的部分原文并可以点亮高亮,
So that 我能通过追溯原始依据来信任平台给出的答案，杜绝所谓的 AI 大厂'幻觉'现象.

**Acceptance Criteria:**

**Given** 某问题的回答引用了 ID 为 doc1 的片段
**When** 回答渲染完毕时
**Then** 消息气泡之下应该附着展示一个可以查阅该切片的溯源标记引用图标
**And** 该数据必须是伴随答疑 API 同步投递的前置切片特征

### Story 3.3: 答复质量评估点赞与踩回传存储

As a 终端最终用者,
I want 对产生的每一条问答流回复做单点 Thumbs-up (赞)或 Thumbs-down (踩)的点击,
So that 我的感受和对准确率的纠正意图留档下来帮助后台的工程师做长期调优.

**Acceptance Criteria:**

**Given** 某条流式对话消息已经处于呈现完毕的状态
**When** 我点击了踩或者赞按钮
**Then** UI 端发起一个只读状态翻转的异步请求至后台
**And** 相关的历史记录表中的 'feedback_type' 一列将持久化保存此次点击结果

## Epic 4: 跨平台内嵌支持与开放能力 (App Publishing & External Integrations)

管理员能轻松将编排好的智能体以代码片段的形式嵌入公司官网，同时开发者能使用 API 在自己的业务线中调用 MaxKB 智能体。

### Story 4.1: 免代码内嵌应用组件代码库生成

As a 管理员,
I want 点击一键生成包含如脚本或 iframe 标签的支持内嵌第三方的发行代码片段,
So that 不需改变外部企业现存老旧业务架构，即刻令网页具备浮窗 AI 助手.

**Acceptance Criteria:**

**Given** 我在一个已发布的智能体应用发布页下
**When** 我选择发行方式为'网页嵌入'
**Then** 系统前端需要生成带有相应 APP Token 签名认证的可直接复制拷贝的 JS/iframe 代码串
**And** 这个生成的 Endpoint 必须能处理无状态的 Bearer 授权请求

### Story 4.2: 保护形态的标准 API 对外网关暴露

As a 外部开发者,
I want 使用获得鉴权的通用 OpenAPI 定义请求系统的同、异步对话端点接口,
So that 我就能够基于贵公司的逻辑基座包裹开发属于我的原生 APP 版本，极速落地自有生态内.

**Acceptance Criteria:**

**Given** 某合法的第三方系统携带正确的 API 鉴权 Token
**When** 其向后端的 api/v1/openapi 隔离路由发起 HTTP 请求
**Then** Django 必须通过其拦截网关放行，随后调起该应用对应的编排引擎
**And** 所有的开放端点格式应遵循 drf-spectacular 预制的格式

## Epic 5: 高级企业级运营管控矩阵 (Enterprise Operations & IAM)

企业 IT 部门与合规部门可以安全地基于 SSO/RBAC 接管内部职员，获取深度的操作审计链路，并将系统对话窗口接入诸如企业微信、钉钉等员工常用的内部 IM 平台；实现品牌的全面私有化定制配置。

### Story 5.1: SSO 单点协议与多平台扫码集成配置

As a 全局管理员,
I want 能在系统里填入 LDAP 树或者 OAuth 配置、企微飞书相关授权参数完成系统级别单点认证绑架,
So that 公司几万员工不需要背诵并注册新密码，彻底简化公司内登入验证网.

**Acceptance Criteria:**

**Given** 系统运行环境限定于专业版与企业版(PE/EE)
**When** 进入安全设置填妥了 OIDC 或企微的相关配置数据后
**Then** 后端系统能正确接驳其断言
**And** 用户点击登录可以使用前述外部网关回跳的 Token 实现登录

### Story 5.2: 细粒度角色与操作控制板 (RBAC)

As a 企业 IT 管理员,
I want 自由配置角色集，能够按读操作、写操作拆分如：知识管理员，财务人员等定制角色发配给系统内置员工账号,
So that 我能够放心地把业务下发因为不同的角色永远无法看到彼此无权控制的内容与组件面板.

**Acceptance Criteria:**

**Given** 处于具有限制功能的 PE/EE 环境中
**When** 我为一个组用户分配只具备‘阅读知识库’权限时
**Then** 该用户层的前端路由必须自动将其导离编排模块且其 API Get 被强阻截拦截
**And** 所有后端 API 的授权验证都遵循零信任原则不依靠前端隐蔽解决

### Story 5.3: 全渠道触达之三方 IM 系统连接

As a 管理员,
I want 能将已经编辑完备并测试可行的单一智能体机器人挂载到类似企业微信、钉钉频道当成机器人帐号回应发问,
So that 我们公司的使用员工完全不需要专门安装额外的网站就能在工作聊天框里完成问答操作.

**Acceptance Criteria:**

**Given** 处于具有限制功能的 PE/EE 环境中
**When** 为机器人设定渠道发布并提供类似企微对应的 Appsecret
**Then** 后端应该能注册 Webhook 通信代理来监听、转发从企微发出的 POST 回响并调起模型推演，后异步写回

### Story 5.4: 全链路不可逆审计日志搜集

As a 企业合规审计员,
I want 能在后台面板查看或导出带时间戳的任何账号诸如删除模型、重制工作流、改变用户权限这种敏感操作的数据包日志,
So that 保证合规检查能够定责并溯源每一个风险指令是由谁操作出来的.

**Acceptance Criteria:**

**Given** 企业版系统启用
**When** 用户发生了变更型的 (POST/PUT/DELETE) 等配置项动作时候
**Then** Django 旁路系统将截获动作的 Payload 及触发人类行为 ID 并静默储基于关系库中
**And** 并保证日志本身没有对一般用户权限展示的页面通道

### Story 5.5: White-Labeling 私有品牌标识替换

As a 品牌管理员,
I want 能随意上载企业的 Logo 图片，挑选页面 CSS 主色调以及定制诸如免责声明等特定声明挂架在界面,
So that 整个对外的 AI Agent 表现出的就是完完全全我司自己的定制 SaaS 无缝整合服务了.

**Acceptance Criteria:**

**Given** 开启高级品牌配置限制功能的体系内
**When** 我对系统的核心基础 Logo 作了修改并下发应用层保存
**Then** 对应的文件应当走系统的静态路由与缓存分离管理
**And** 在 Vue 端初始化时将调用一则基建配置接口做动态加载覆写

## Epic 6: 集团级多租户隔离与联邦治理 (Multi-Tenant Governance)

巨型集团管理者能够开辟出物理或逻辑隔离的多个 Workspace 与租户空间，并进行严谨的数据保护与资源跨域授权共享。

### Story 6.1: 多重物理与逻辑租户隔离的硬管控边界

As a 系统根管理组,
I want 在顶层能够一键开辟出归属给例如分部公司A、子公司B的专属带容量配额及空间隔离的云环境,
So that 使得母公司下所有的子机构互不侵犯不泄漏并享受集团统管.

**Acceptance Criteria:**

**Given** 旗舰级的 EE 部署版本
**When** 使用超管创立一个包含使用量受限限制的新 Workspace 并分配超级租客总管时
**Then** 从底层 PostgreSQL 开始它的向量库和基础资源池必须与外界脱钩
**And** 所有数据操作请求都要通过此 Workspace 的外围围墙验证通过方可下钻数据源

### Story 6.2: 联邦治理下的知识合规共享穿透配置

As a 多租户群管理,
I want 设置特定的跨组织特权通道让在租客A生成的“公共规定类知识库”可以被授权给其他租户读调用使用,
So that 既保护敏感又规避集团重复维护通用公共资产引发的冗余工作.

**Acceptance Criteria:**

**Given** 某租户设定存在一个被标记共享的特征知识源同时受到 EE 企业版规范管辖
**When** 他方租户发起针对该知识库的调阅
**Then** 该调取能够被跨租户查询器无损转发处理，但其禁止一切越权的变更及覆写操作

