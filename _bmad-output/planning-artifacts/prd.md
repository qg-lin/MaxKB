---
stepsCompleted:
  - 'step-01-init'
  - 'step-02-discovery'
  - 'step-02b-vision'
  - 'step-02c-executive-summary'
  - 'step-03-success'
  - 'step-04-journeys'
  - 'step-05-domain'
  - 'step-06-innovation'
  - 'step-07-project-type'
  - 'step-08-scoping'
  - 'step-09-functional'
  - 'step-10-nonfunctional'
  - 'step-11-polish'
  - 'step-12-complete'
inputDocuments:
  - '{project-root}/_bmad-output/project-context.md'
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 1
workflowType: 'prd'
classification:
  projectType: 'saas_b2b'
  domain: 'enterprise'
  complexity: 'medium'
  projectContext: 'brownfield'
---

# Product Requirements Document - MaxKB

**Author:** Boss
**Date:** 2026-03-03T23:23:11+08:00

## Executive Summary
MaxKB (Max Knowledge Brain) 定位为强大且开箱即用的企业级智能体运维管理平台。它旨在降低企业在 AI 落地过程中的门槛与成本。产品设计理念为“开箱即用，伴随成长”，提供从基础文本检索增强 (RAG)、智能工作流自动化编排到高级智能体 (Agent) 的无缝进阶演进路线。

### What Makes This Special
- **渐进式商业矩阵 (Multi-tier Strategy):** 提供开源社区版 (CE)、专业版 (PE) 和企业版 (EE) 三类形态。系统横跨从单兵零代码部署 RAG 验证，直至解锁企业级 SSO 认证与多渠道 IM 集成、运营审计与开放 API，以及面向集团化客户的多租户 (Multi-Tenant) 隔离与集群部署的高净值演变。
- **解耦的视觉化工作流 (Agentic Workflow):** 内置强大的可视化微服务节点引擎，原生支持对主流 LLM 及 MCP（Model Context Protocol）系统的整合，使业务侧在此基础上以零代码形式完成图灵完备的复杂流排版。
- **架构中立与零侵入集成 (Model-Agnostic):** 拒绝绑定特定的模型基座。提供高度隔离的一键嵌入代码 (Web SDK / iframe) 与 RESTful 路由支持，消除企业主系统重构成败风险。

## Project Classification
- **Project Type:** B2B SaaS & Enterprise Platform
- **Domain:** AI Infrastructure & Knowledge Management Software
- **Complexity Level:** Medium-High (涉及多模态文本分割引擎、并发控制与复杂大模型网络中间件交互)
- **Project Context:** Brownfield

## Success Criteria
### User Success
- **Time-to-Value:** 使用者通过系统预制镜像启动应用，并串通首个企业专属文档的“大模型问答全链路”时间应 ≤ 10 分钟。
- **配置自由度:** 纯业务角色（零代码认知）必须能独立闭环 80% 业务流程的可视化 AI 流程拖拽发布。
### Business Success
- **漏斗与存量:** 构建明确顺滑的自开源 (CE 版推广) 向上转企业商业增值 (EE/PE 版本) 体系的授权转化路径。
- **支持成本:** 借由插件化的配置矩阵，使企业私有部署实施与对接交付的售后成本缩减至少 50%。
### Technical Success
- **高并发检出时长:** 单域知识库向量召回执行耗时必须控制在 1 秒以内（基于高效向量索引过滤）。
- **韧性与高可用:** 对诸如模型渠道 API QPS 短期熔断进行软性隔离、条件分叉回退 (Fallback)。

## Project Scoping & Phased Development
系统商业生命周期迭代建立在阶段性演化的基座上：

### Phase 1: MVP - 开源社区版 (Community Edition)
旨在向开发者交付轻量可伸缩的"纯净知识脑库基座"：
- 单租户模式下的完整知识库管理，支持多格式文档（Markdown/TXT/DOCX/PDF/HTML/XLSX/CSV 等）摄取、Web 站点同步与向量化处理。
- 全量适配国内外主流模型供应商及本地大模型的 Provider 底座（原生支持如 DeepSeek、通义千问 Qwen、OpenAI、Claude 等头部模型），涵盖大语言、向量化、重排、语音识别/合成、图片理解/生成等多种模型类型。
- 可视化工作流编排（含 AI 对话/TTS/STT/MCP 等节点类型）、内置工具（数据库查询、联网搜索等）与自定义工具商店。
- 应用嵌入第三方网站（全屏/移动端/浮窗）、知识来源显示与下载、对话日志运营分析与全局变量支持。

### Phase 2: Growth - 专业版 (Professional Edition)
旨在适配业务团队对于企业级运营管控与多渠道集成的追求：
- **Identity IAM 集成:** 支持 LDAP/OIDC/CAS/OAuth2 等单点登录协议，以及企业微信/钉钉/飞书扫码登录。
- **多渠道 IM 接入:** 支持接入企业微信应用、企业微信客服、钉钉应用、飞书应用、微信公众号及 Slack。
- **运营与审计增强:** 提问端身份验证、对话用户管理、系统操作日志、开放 API。
- **知识源扩展:** 飞书知识库对接与同步。
- **White-Labeling:** 自定义系统 Logo/主题配色/外观设置、自定义对话框浮窗入口图标及位置、AI 头像、免责声明等个性化显示。

### Phase 3: Expansion - 企业版 (Enterprise Edition)
专门服务有严格多组织结构隔离需求的集团化集群：
- **Multi-Tenant 架构:** 从单租户升级为多租户机制，支持组织级数据隔离与资源配额管控。
- **跨组织资源共享:** 在多租户隔离前提下支持知识库、工具、模型等资源的跨组织共享。
- **集群部署:** 在单机/冷备基础上新增集群化高可用部署模式，适配大体量环境。

## User Journeys
### 1. 知识管理员 (部署者与知识源发起人)
**目标:** 光速下线低端工单拦截模型。
**动作流:** Docker 分发 → 初始化建库 → 批量投入 PDF + QA 进行分段 Embedding → 引入对话 LLM 网关验证检索分段映射的绝对“引源准确度” → 即刻嵌入其官网。

### 2. 高级编排工程师 (业务流程架构者)
**目标:** 开发不仅解决“知”更须实施“行”的高阶智能操作体。
**动作流:** 打开高级工作编排流面板 → 搭建意图识别网关拦截多分类意图 → 跨越式连接知识回退知识系统或连接外部 HTTP (通过 MCP 向 OA 反推指令) → 提供降级提示兜底系统崩溃抛锚 → 提供发布接口。

### 3. 企业运营与合规审计员 (安全审计层)
**目标:** 保持平台知识合规运行以及越权干预保护。
**动作流:** 调用单点登录进驻后台 → 创建各业务线封闭式的授权组及子工作空间 → 使用数据追踪面板提取敏感操作高频轨迹与检索词分布 → 分析系统内调用令牌计费数据。

### 4. 终端最终用者
**目标:** 体验有如真人的客服质感及强可信度答复。
**动作流:** 打开官网附着服务 → 书写散化口语提问 → 秒级别收到带有明确文档源“引文标注 (Citation)” 的流式渲染排版信息反馈 → 给予积极或否定强化学习点赞回馈。

## Domain-Specific Requirements
### Compliance & Regulative (合规要求)
- **数据驻留 (Data Residency):** 支持全套系统与数据链路断网物理机剥离，禁止未授权特征库或明文向大模型私放。
- **敏感截断 (Data Masking):** 配置强有力的拦截和屏蔽关键词能力，过滤敏感提问请求。
- **回溯审计 (Auditability):** 要求所有对客户端抛出的 AI 回复连带用户质询的指令必须留存不可篡改的操作日志层 (Audit Log)。

## Functional Requirements (功能性需约列表)
### 1. Identity & Access Management (身份与访问域)
- **FR1:** 全局管理员必须能配置 SSO 单点登录（支持 LDAP/OIDC/CAS/OAuth2 协议）及企业微信/钉钉/飞书扫码登录。*(限PE/EE)*
- **FR2:** 工作空间管理员必须能创建与物理/逻辑隔离对应的多个 Multi-Workspace，分配并限制资源配额。*(限EE)*
- **FR3:** 系统管理员必须能为用户分配细粒度的角色权限 (RBAC)，每种角色可独立控制对配置、编排、知识读写各域的访问级别。*(限PE/EE)*
### 2. Knowledge Processing (文档摄取域)
- **FR4:** 用户必须能顺滑上传 PDF、Word 等多介质本地案卷库，并允许输入指定网页进行爬虫解析抓取。
- **FR5:** 系统在用户上传文档后必须自动完成文本分段与向量化处理，支持段落智能提取与分段策略配置。
- **FR6:** 库运维员可在 WebUI 中直接编辑查阅块碎段和修改对应的标引特征源标记。
### 3. Agentic Orchestration (调度编排域)
- **FR7:** 编排工程师必须能在可视化空间通过节点点选与拖拽重连构成对话流程骨架。
- **FR8:** 编排工程师必须能使用至少四种核心节点类型：模型提供方切换、外部请求连接、知识检索拉取、异常兜底出口。
### 4. Interaction (交互域)
- **FR9:** 终端用户必须能以流式推送方式实时接收 AI 推理输出，呈现逐字渲染的打字机效果。
- **FR10:** 对话界面必须要能把触底支撑它的置信文档段落高亮标识进行可视化跟随抛出 (Citations/Reference 标记)。
- **FR11:** 用户必须可对输出消息进行 “赞与踩 (Thumbs-up/down)” 的意图纠错存储反馈。
### 5. Integration (外部切入域)
- **FR12:** 管理员必须能一键生成可嵌入第三方网站的集成代码，支持至少两种嵌入方式。
- **FR13:** 外部开发者必须能通过经鉴权保护的标准 API 端点发起同步与异步对话请求。
### 6. Enterprise Operations (企业运营域)
- **FR14:** 管理员必须能配置提问端的身份验证策略，对终端对话用户进行身份识别与管理。*(限PE/EE)*
- **FR15:** 管理员必须能将应用接入企业微信、钉钉、飞书、微信公众号及 Slack 等第三方 IM 渠道。*(限PE/EE)*
- **FR16:** 管理员必须能对接飞书知识库并配置内容定时同步策略。*(限PE/EE)*
- **FR17:** 系统必须记录关键管理操作的审计日志，供管理员检索与导出。*(限PE/EE)*
- **FR18:** 管理员必须能通过开放 API 对系统资源进行程序化管理操作。*(限PE/EE)*
### 7. Branding & Customization (品牌定制域)
- **FR19:** 管理员必须能自定义系统 Logo、主题配色等全局外观设置，以及对话框浮窗入口、AI 头像、免责声明等应用级显示元素。*(限PE/EE)*
### 8. Resource Governance (资源治理域)
- **FR20:** 管理员必须能在多租户模式下配置知识库、工具和模型资源的跨组织共享策略。*(限EE)*
### 9. Agentic Workflow Enhancements (工作流增强域)
- **FR21:** 编排工程师在配置"表单收集"节点时，必须能为 TextInput（单行文本）和 TextareaInput（多行文本）字段设置"引用变量"赋值方式，使字段的默认值可动态绑定工作流上游节点的输出变量，而非仅限于静态文本。

## Non-Functional Requirements (非功能性要求)
### Performance Metrics (性能量化标准)
- **LLM Overhead Latency (内部派发延时):** 系统的中间请求代理到大模型的建立连接周转阶段耗时（TTFT前置处理耗时）必须控制于 **< 500ms** 以下。
- **Search Efficiency (并发检索吞吐):** 向量库在容纳 **1 亿 Token 单域数据段**级别的体量内，近邻比对召回时间务必维持在 **< 1 秒钟**之内。
### Security & Audit Attributes (容错灾难阻断)
- **Zero Trust Boundaries (零容忍围栏越级):** 数据操作引擎在接受所有的读写变更服务前必须先被阻断进入底层验证权限（必须具有所在租户空间 Workspace 内的强校验声明）。绝不承认用户自行越界推入的假随机表识查改。
- **Offline Full Capacity (静默物理能力):** 系统使用内部闭源 LLM 服务连接池模式下运作时，无论断裂何种外部骨干网段，其均应满足内部服务请求流转 100% 生效畅通而不存在远程锁止瘫痪。
### Scalability & Maintainability (维系伸展能力)
- **Decoupled Architecture (去耦合网关):** 适配各类大模型（如未来发布的 GPT-5 系列 API 修改），不应涉及到核心流程分路层重编译。仅仅依靠拓展针对的模型适配解析插件注入即能无缝包容。
- **Infrastructure Compatibility (底层异构兼容):** 容器化微服务及周边配套中间件依赖（如向量库），除了必须稳定工作在标准 x86 宿主机下，亦必须原生支持 ARM 异构指令集架构，以满足信创及国产化服务器软硬件严苛落地的兼容下限要求。*(针对所有商业落地环境)*
