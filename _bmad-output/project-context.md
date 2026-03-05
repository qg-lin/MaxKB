---
project_name: 'MaxKB'
user_name: 'Boss'
date: '2026-03-03T23:01:00Z'
sections_completed:
  ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 14
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

**核心后端 (Python/Django)**
- Python: `~=3.11.0`
- Django: `==5.2.9`
- psycopg (PostgreSQL): `3.2.9`
- Celery (异步任务): `==5.5.3` (协同 `django-celery-beat` 与 Redis)
- LangChain 核心套件: `langchain-core==0.3.81`, `langchain-openai==0.3.35`, `langgraph==0.5.3`

**核心前端 (Vue3/Vite)**
- Vue: `^3.5.13` (Composition API 推荐)
- TypeScript: `~5.8.0`
- Vite: `^6.2.4`
- 组件库: `element-plus: ^2.12.0`
- 状态管理/路由: `pinia: ^3.0.1`, `vue-router: ^4.5.0`

## Critical Implementation Rules

### Language-Specific Rules

**Python / Django**
- **解耦隔离**: 所有独立业务或功能应该抽象注册为单独的 Django App 并拆解在 `apps/` 目录下（如 `chat`, `chat_pipeline`, `system_manage` 等），禁止跨 App 的反模式循环引用。
- **并发与异步**: 当编写长耗时间的模型相关交互或者调度任务时，必须通过 `concurrent.futures.ThreadPoolExecutor` 或者 `Celery` 进行资源隔离以避免接口阻塞。
- **流式返回约定**: Backend 的对话管道需要具备 Generator 生成器设计。流式数据使用 Server-Sent Events (SSE) 协议，格式约定必须是类似 `'data: ' + json.dumps({...}) + "\n\n"` 的数据块返回包裹（参考 WorkflowManage 中 `get_chunk_content`）。

**TypeScript / Vue**
- **组合式函数**: 全部采用 Vue 3 的 `<script setup lang="ts">` Composition API 进行编写。必须尽可能利用 `computed` 和 `ref` 管理响应式数据，避免使用旧版 Options API (`data()/methods:`)。
- **Lint与格式化**: 配置有严格的代码格式验证体系，由 `@vue/eslint-config-typescript` 控制。任何代码更改不仅不能有 `Any` 滥用（如果可以避免），还要求跑过 `pnpm/npm run lint` 与 `prettier --write`。
- **导入机制**: Vite 支持以 `@/` 指向项目的 `src` 保护屏障，跨模块引用组件必须坚持这种绝对路径解析模式。

### Framework-Specific Rules

**Langgraph / AI Workflow 体系**
- 任何流程控制必须继承核心 `__init__.py` 或 `i_step_node.py` 中的基类(e.g., `INode`, `WorkflowManage`)，以保障标准化的数据载体 `context` 能够在各节点通过。
- 当涉及到模型调度流时，要求强制捕获一切由于第三方模型服务异常导致的异常机制，并具备自适应 fallback（失败重试或切换备用提供方）。
- Prompt 的动态模板编译应交由专门格式化器执行（类似 `PromptTemplate`），并通过上下文安全的填充变量（例如 `{% raw %}{{globeValue}}{% endraw %}` 渲染替代符）。

**Vue Router 与状态 (Pinia)**
- 若组件与组件通信或存储用户的长生命周期权限/全局聊天参数设置，使用 `chatUser.ts`，`workspace.ts` 定义的 **Pinia stores** 模块。
- 动态路由依赖于权限管理，所有的视图（`views/**`）文件内加载时，不直接包含巨大的业务逻辑，将重负载移入 `api/` 服务发起 axios 请求。

### Code Quality & Style Rules

**Linting / Formatting（前端强制）**
- **ESlint与Prettier**: 在提交代码或者完成前端模块修改后，要确保能够通过 `npm run lint` 和 `npm run format` (prettier)。
- **Vue单文件组件**: 组件模板必须坚持精简 `template` 层逻辑，把计算量移交给 `<script setup>` 的 Hooks(像 `computed` ) 等处理，并且不要给组件加任何复杂的行内 CSS / 而是使用独立 `class` 然后基于 SCSS 构建 `style` 规则。
- 不要关闭任何 Typescript 全局变量或者随意采用 `eslint-disable` 注释跳过扫描。除非是被判定为底层库或者特殊动态渲染的 API。

**文件和目录层级约束**
- Vue 页面存放在 /views/ 路径下，可复用的逻辑或者 UI 拆件必须在 /components/ 中；而服务请求放置于 /api 下保证和前端解耦。
- 后端新增模块或服务不能直接挂载在 `main.py` 或同级，只能以 Django App 的形态放在 `apps/` 目录下并通过 `settings.py` (一般在 `maxkb/configs/` 中或者对应入口文件) 注册。

### Development Workflow Rules

**运行指令限制**
- 开发前端模块时切勿直接暴露修改端口或环境配置，采用标准的 `npm run dev` 即可集成 Vite 工作流进行热更新。
- 本系统强重度依赖 Python/Django 环境的 Postgres 和 Redis 数据连接服务支撑，进行功能代码更改时不要破坏 ORM 迁移模型，除非已经走完整一套标准的 `python manage.py makemigrations/migrate` 数据库变更策略。

### Critical Don't-Miss Rules

**安全警示**
- 不硬编码密钥：涉及到模型供应方 (LLM providers) 或 OSS (阿里云、AWS，腾讯云等) 乃至数据库连接的凭证等敏感信息，绝对不能以明文硬编码储存在代码里，必须走系统注入的环境变量设置 (`dotenv`) 和动态加载配置模型。
- 前端防挂载（XSS）：在加载并渲染 Markdown （或涉及从后端生成的系统响应如大模型生成的对话文本内容时），不要随意使用未经 `sanitize-html` 或类似于 `xss()` 拦截层处理的内容作为裸的 `v-html` 或 DOM innerHTML 输出。特别是那些允许展示 `<script>` 标签内容块或者 HTML iframes 的区域。

**边缘错误陷阱**
- 在使用 Django ORM 以及与 Langchain 生态系统的组件组合时，如果有循环的关联查询或加载重度 `Message` 历史的复杂流程控制（如 `Application node` 和 `Graph flow`），请一定通过限流控制（Page limiting）与懒加载的方式。
- UI/Vue 节点交互绘制（如 LogicFlow 节点图设计器）：注意监听和销毁各类绑定事件（例如通过 `onMounted()` 内初始化 LF 后，确保 `onUnmounted()` 里 `disconnectAll` 等清理以避免内存泄漏卡顿严重）。

---

## Usage Guidelines

**For AI Agents:**

- 在实现任何代码之前，务必先阅读此文件
- 必须严格遵循所有记录的规则
- 如果存在疑问，倾向于选择更严格/保险的方案
- 如果在这个项目中发现了新的开发模式，请主动更新此文件

**For Humans:**

- 保持此文件精简，并始终聚焦于 AI 智能体的需求侧
- 仅当技术栈发生实质改变时进行更新
- 建议每季度检查一次是否有过时的规则
- 持续移除那些随着时间推移已变成“常识”的冗余规则

Last Updated: 2026-03-03T23:01:00Z
