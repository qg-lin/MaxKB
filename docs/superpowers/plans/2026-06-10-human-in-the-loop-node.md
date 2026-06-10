# Human-in-the-loop Node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workflow node that pauses execution in the current chat window, waits for the current user to confirm/reject or submit text, then resumes from that node and routes the next branch.

**Architecture:** Reuse the existing `form-node` pause/resume path: chat cards submit `runtime_node_id`, `chat_record_id`, and `node_data`; `ChatSerializers.chat_work_flow()` passes those values to `WorkflowManage.load_node()`. Add a focused `human-in-the-loop-node` backend node with its own waiting payload and branch result, plus a frontend workflow node and chat renderer for `<human_in_the_loop>{...}</human_in_the_loop>`.

**Tech Stack:** Django 5.2, Django REST Framework serializers, existing MaxKB workflow engine, Vue 3 Composition API, Element Plus, LogicFlow-based workflow editor.

---

## File Structure

Backend:

- Create `apps/application/flow/step_node/human_in_the_loop_node/__init__.py`: export `BaseHumanInTheLoopNode`.
- Create `apps/application/flow/step_node/human_in_the_loop_node/i_human_in_the_loop_node.py`: node serializer and interface class.
- Create `apps/application/flow/step_node/human_in_the_loop_node/impl/__init__.py`: export implementation.
- Create `apps/application/flow/step_node/human_in_the_loop_node/impl/base_human_in_the_loop_node.py`: pause/resume logic, context writing, details.
- Modify `apps/application/flow/step_node/__init__.py`: import and register node.
- Modify `apps/application/flow/workflow_manage.py`: pass generic `node_data` to resumed nodes without forcing it into `form_data` only.
- Add tests in `apps/application/tests.py`: focused unit coverage for waiting and submitted node behavior.

Frontend workflow editor:

- Modify `ui/src/enums/application.ts`: add `HumanInTheLoopNode`.
- Modify `ui/src/workflow/common/data.ts`: add default node data, menu entry, and `nodeDict` entry.
- Create `ui/src/workflow/nodes/human-in-the-loop-node/index.ts`: LogicFlow registration.
- Create `ui/src/workflow/nodes/human-in-the-loop-node/index.vue`: node configuration panel.
- Create `ui/src/workflow/icons/human-in-the-loop-node-icon.vue`: icon component.
- Modify locale files found by `rg "formNode|replyNode|workflow.nodes" ui/src/locales ui/src -S`: add labels for the new node.

Frontend chat rendering:

- Create `ui/src/components/markdown/HumanInTheLoopRander.vue`: confirmation/text card renderer.
- Modify `ui/src/components/markdown/MdRenderer.vue`: split `<human_in_the_loop>` tags and render the new component.

Verification:

- Backend: `rtk uv run python manage.py test application.tests`
- Frontend: `rtk npm --prefix ui run lint` if available; otherwise `rtk npm --prefix ui run build`
- Manual: create a workflow with the new node and verify confirm/reject/text resume paths.

---

### Task 1: Backend Node Skeleton And Tests

**Files:**
- Modify: `apps/application/tests.py`
- Create: `apps/application/flow/step_node/human_in_the_loop_node/__init__.py`
- Create: `apps/application/flow/step_node/human_in_the_loop_node/i_human_in_the_loop_node.py`
- Create: `apps/application/flow/step_node/human_in_the_loop_node/impl/__init__.py`
- Create: `apps/application/flow/step_node/human_in_the_loop_node/impl/base_human_in_the_loop_node.py`

- [ ] **Step 1: Write failing tests for waiting and submitted behavior**

Replace `apps/application/tests.py` with focused tests that instantiate the node with small fake workflow objects:

```python
from types import SimpleNamespace

from django.test import TestCase

from application.flow.common import WorkflowMode
from application.flow.step_node.human_in_the_loop_node.impl.base_human_in_the_loop_node import BaseHumanInTheLoopNode


class FakeWorkflowManage:
    def __init__(self):
        self.flow = SimpleNamespace(workflow_mode=WorkflowMode.APPLICATION)
        self.context = {}
        self.chat_context = {}

    def get_params_serializer_class(self):
        return None

    def generate_prompt(self, prompt):
        return prompt

    def get_workflow_content(self):
        return {"global": self.context, "chat": self.chat_context}


def make_node(node_data):
    node = SimpleNamespace(
        id="hitl-node",
        type="human-in-the-loop-node",
        properties={
            "stepName": "Human Check",
            "node_data": node_data,
            "status": 200,
            "enableException": False,
        },
    )
    workflow_params = {
        "chat_id": "chat-1",
        "chat_record_id": "record-1",
        "stream": True,
        "question": "hello",
        "re_chat": False,
        "workspace_id": "workspace-1",
        "application_id": "application-1",
        "debug": True,
        "history_chat_record": [],
    }
    instance = BaseHumanInTheLoopNode(node, workflow_params, FakeWorkflowManage())
    instance.valid_args(instance.node_params, workflow_params)
    return instance


class HumanInTheLoopNodeTest(TestCase):
    def test_confirmation_first_run_waits_and_outputs_payload(self):
        node = make_node({
            "mode": "confirmation",
            "title": "Continue?",
            "content": "Run the next step?",
            "actions": [
                {"value": "confirm", "label": "Confirm", "branch_id": "confirm"},
                {"value": "reject", "label": "Reject", "branch_id": "reject"},
            ],
            "node_data": None,
            "is_result": True,
        })

        result = node.run()
        chunks = list(result.write_context(node, node.workflow_manage))

        self.assertTrue(result.is_interrupt_exec(node))
        self.assertEqual(node.context["status"], "waiting")
        self.assertIn("<human_in_the_loop>", chunks[0])
        self.assertIn('"mode": "confirmation"', chunks[0])
        self.assertIn('"runtime_node_id"', chunks[0])

    def test_confirmation_resume_sets_branch_and_context(self):
        node = make_node({
            "mode": "confirmation",
            "title": "Continue?",
            "content": "Run the next step?",
            "actions": [
                {"value": "confirm", "label": "Confirm", "branch_id": "confirm"},
                {"value": "reject", "label": "Reject", "branch_id": "reject"},
            ],
            "node_data": {
                "interaction_type": "human_in_the_loop",
                "action": "reject",
                "user_input": "",
                "comment": "not now",
                "payload": {},
            },
            "is_result": True,
        })

        result = node.run()
        list(result.write_context(node, node.workflow_manage))

        self.assertFalse(result.is_interrupt_exec(node))
        self.assertTrue(result.is_assertion_result())
        self.assertEqual(result.node_variable["branch_id"], "reject")
        self.assertEqual(node.context["status"], "submitted")
        self.assertEqual(node.context["action"], "reject")
        self.assertEqual(node.context["confirmed"], False)
        self.assertEqual(node.context["comment"], "not now")

    def test_text_resume_requires_user_input_and_routes_submit(self):
        node = make_node({
            "mode": "text",
            "title": "Add details",
            "content": "Please add missing details.",
            "placeholder": "Type here",
            "submit_label": "Submit",
            "branch_id": "submit",
            "node_data": {
                "interaction_type": "human_in_the_loop",
                "action": "submit",
                "user_input": "More details",
                "comment": "",
                "payload": {},
            },
            "is_result": True,
        })

        result = node.run()
        list(result.write_context(node, node.workflow_manage))

        self.assertEqual(result.node_variable["branch_id"], "submit")
        self.assertEqual(node.context["user_input"], "More details")
        self.assertIsNone(node.context["confirmed"])
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
rtk uv run python manage.py test application.tests
```

Expected: FAIL with `ModuleNotFoundError` for `human_in_the_loop_node`.

- [ ] **Step 3: Add node interface**

Create `apps/application/flow/step_node/human_in_the_loop_node/i_human_in_the_loop_node.py`:

```python
# coding=utf-8
from typing import Type

from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

from application.flow.common import WorkflowMode
from application.flow.i_step_node import INode, NodeResult
from common.exception.app_exception import AppApiException


class HumanActionSerializer(serializers.Serializer):
    value = serializers.CharField(required=True, label=_("Action value"))
    label = serializers.CharField(required=True, label=_("Action label"))
    branch_id = serializers.CharField(required=False, allow_blank=True, label=_("Branch id"))


class HumanInTheLoopNodeParamsSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(required=True, choices=["confirmation", "text"], label=_("Interaction mode"))
    title = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Title"))
    content = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Content"))
    actions = serializers.ListField(child=HumanActionSerializer(), required=False, label=_("Actions"))
    placeholder = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Placeholder"))
    submit_label = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Submit label"))
    allow_comment = serializers.BooleanField(required=False, label=_("Allow comment"))
    branch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Branch id"))
    node_data = serializers.DictField(required=False, allow_null=True, label=_("Submitted interaction data"))
    is_result = serializers.BooleanField(required=False, label=_("Whether to return content"))

    def is_valid(self, *, raise_exception=False):
        super().is_valid(raise_exception=True)
        mode = self.data.get("mode")
        if mode == "confirmation" and len(self.data.get("actions") or []) == 0:
            raise AppApiException(500, _("Action list cannot be empty"))


class IHumanInTheLoopNode(INode):
    type = "human-in-the-loop-node"
    view_type = "single_view"
    support = [WorkflowMode.APPLICATION, WorkflowMode.APPLICATION_LOOP]

    def get_node_params_serializer_class(self) -> Type[serializers.Serializer]:
        return HumanInTheLoopNodeParamsSerializer

    def _run(self):
        return self.execute(**self.node_params_serializer.data, **self.flow_params_serializer.data)

    def execute(self, mode, title=None, content=None, actions=None, placeholder=None,
                submit_label=None, allow_comment=False, branch_id=None, node_data=None, **kwargs) -> NodeResult:
        pass
```

- [ ] **Step 4: Add minimal implementation**

Create `apps/application/flow/step_node/human_in_the_loop_node/impl/base_human_in_the_loop_node.py`:

```python
# coding=utf-8
import json
import time
from datetime import datetime, timezone
from typing import Dict

from common.exception.app_exception import AppApiException
from django.utils.translation import gettext_lazy as _

from application.flow.i_step_node import NodeResult
from application.flow.step_node.human_in_the_loop_node.i_human_in_the_loop_node import IHumanInTheLoopNode


def _write_context(step_variable: Dict, global_variable: Dict, node, workflow):
    if step_variable is not None:
        for key, value in step_variable.items():
            node.context[key] = value
        if "result" in step_variable and workflow.is_result(node, NodeResult(step_variable, global_variable)):
            node.answer_text = step_variable["result"]
            yield step_variable["result"]
    node.context["run_time"] = time.time() - node.context["start_time"]


def _is_waiting(node, step_variable: Dict, global_variable: Dict):
    return step_variable.get("status") == "waiting"


def default_actions():
    return [
        {"value": "confirm", "label": "确认", "branch_id": "confirm"},
        {"value": "reject", "label": "拒绝", "branch_id": "reject"},
    ]


class BaseHumanInTheLoopNode(IHumanInTheLoopNode):
    def save_context(self, details, workflow_manage):
        for key in [
            "status", "action", "confirmed", "user_input", "comment", "submitted_at",
            "interaction_payload", "branch_id", "result", "run_time", "start_time",
        ]:
            self.context[key] = details.get(key)
        self.context["exception_message"] = details.get("err_message")
        if self.node_params.get("is_result", False):
            self.answer_text = details.get("result")

    def execute(self, mode, title=None, content=None, actions=None, placeholder=None,
                submit_label=None, allow_comment=False, branch_id=None, node_data=None, **kwargs) -> NodeResult:
        actions = actions or default_actions()
        if node_data:
            return self._resume(mode, actions, branch_id or "submit", node_data)
        return self._wait(mode, title, content, actions, placeholder, submit_label, allow_comment)

    def _render_text(self, value):
        return self.workflow_manage.generate_prompt(value or "")

    def _wait(self, mode, title, content, actions, placeholder, submit_label, allow_comment):
        payload = {
            "interaction_type": "human_in_the_loop",
            "mode": mode,
            "runtime_node_id": self.runtime_node_id,
            "chat_record_id": self.flow_params_serializer.data.get("chat_record_id"),
            "title": self._render_text(title),
            "content": self._render_text(content),
            "actions": [{"value": a.get("value"), "label": a.get("label")} for a in actions],
            "placeholder": self._render_text(placeholder),
            "submit_label": submit_label or "提交",
            "allow_comment": bool(allow_comment),
            "submitted": False,
        }
        result = f"<human_in_the_loop>{json.dumps(payload, ensure_ascii=False)}</human_in_the_loop>"
        return NodeResult(
            {
                "status": "waiting",
                "interaction_payload": payload,
                "action": None,
                "confirmed": None,
                "user_input": "",
                "comment": "",
                "result": result,
            },
            {},
            _write_context=_write_context,
            _is_interrupt=_is_waiting,
        )

    def _resume(self, mode, actions, default_branch_id, node_data):
        if node_data.get("interaction_type") != "human_in_the_loop":
            raise AppApiException(500, _("Interaction type error"))
        action = node_data.get("action")
        user_input = node_data.get("user_input") or ""
        if mode == "text" and len(user_input.strip()) == 0:
            raise AppApiException(500, _("User input cannot be empty"))
        action_map = {a.get("value"): a for a in actions}
        if mode == "confirmation" and action not in action_map:
            raise AppApiException(500, _("Action value error"))
        selected = action_map.get(action, {})
        branch_id = selected.get("branch_id") or default_branch_id or action
        confirmed = True if action == "confirm" else False if action == "reject" else None
        submitted_at = datetime.now(timezone.utc).isoformat()
        return NodeResult(
            {
                "status": "submitted",
                "action": action or "submit",
                "confirmed": confirmed,
                "user_input": user_input,
                "comment": node_data.get("comment") or "",
                "submitted_at": submitted_at,
                "branch_id": branch_id,
                "result": user_input,
            },
            {},
            _write_context=_write_context,
            _is_interrupt=_is_waiting,
        )

    def get_details(self, index: int, **kwargs):
        return {
            "name": self.node.properties.get("stepName"),
            "index": index,
            "type": self.node.type,
            "status": self.status,
            "node_status": self.context.get("status"),
            "action": self.context.get("action"),
            "confirmed": self.context.get("confirmed"),
            "user_input": self.context.get("user_input"),
            "comment": self.context.get("comment"),
            "submitted_at": self.context.get("submitted_at"),
            "interaction_payload": self.context.get("interaction_payload"),
            "branch_id": self.context.get("branch_id"),
            "result": self.context.get("result"),
            "run_time": self.context.get("run_time"),
            "err_message": self.err_message,
            "enableException": self.node.properties.get("enableException"),
        }
```

Create `apps/application/flow/step_node/human_in_the_loop_node/impl/__init__.py`:

```python
# coding=utf-8
from .base_human_in_the_loop_node import BaseHumanInTheLoopNode
```

Create `apps/application/flow/step_node/human_in_the_loop_node/__init__.py`:

```python
# coding=utf-8
from .impl import BaseHumanInTheLoopNode
```

- [ ] **Step 5: Run test to verify node behavior passes**

Run:

```bash
rtk uv run python manage.py test application.tests
```

Expected: PASS for the three Human-in-the-loop node tests.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/application/tests.py apps/application/flow/step_node/human_in_the_loop_node
rtk git commit -m "test: cover human-in-the-loop node behavior"
```

---

### Task 2: Backend Workflow Registration And Generic Resume Data

**Files:**
- Modify: `apps/application/flow/step_node/__init__.py`
- Modify: `apps/application/flow/workflow_manage.py`
- Modify: `apps/application/tests.py`

- [ ] **Step 1: Add failing test for `get_node` registration**

Append to `apps/application/tests.py`:

```python
from application.flow.step_node import get_node


class HumanInTheLoopRegistrationTest(TestCase):
    def test_node_is_registered_for_application_workflow(self):
        self.assertIs(get_node("human-in-the-loop-node", WorkflowMode.APPLICATION), BaseHumanInTheLoopNode)
        self.assertIs(get_node("human-in-the-loop-node", WorkflowMode.APPLICATION_LOOP), BaseHumanInTheLoopNode)
```

- [ ] **Step 2: Run registration test to verify it fails**

Run:

```bash
rtk uv run python manage.py test application.tests.HumanInTheLoopRegistrationTest -v 2
```

Expected: FAIL because `get_node("human-in-the-loop-node", ...)` is not registered.

- [ ] **Step 3: Register backend node**

Modify `apps/application/flow/step_node/__init__.py`:

```python
from .human_in_the_loop_node import BaseHumanInTheLoopNode
```

Add `BaseHumanInTheLoopNode` to `node_list` near `BaseFormNode`:

```python
BaseImageUnderstandNode, BaseFormNode, BaseHumanInTheLoopNode, BaseSpeechToTextNode, BaseTextToSpeechNode,
```

- [ ] **Step 4: Preserve existing form resume and add generic node resume**

In `apps/application/flow/workflow_manage.py`, change the `get_node_params` closure inside `load_node()` so it still sets `form_data` for `form-node`, but also sets `node_data` for generic resumed nodes:

```python
def get_node_params(n):
    is_result = False
    if n.type == 'application-node':
        is_result = True
    if n.type == 'loop-node':
        is_result = True
    node_params = {**n.properties.get('node_data')}
    if n.type == 'form-node':
        node_params['form_data'] = start_node_data
    else:
        node_params['node_data'] = start_node_data
    node_params['child_node'] = self.child_node
    node_params['is_result'] = is_result
    return node_params
```

This avoids relying on `form_data` for Human-in-the-loop submissions while keeping `form-node` unchanged.

- [ ] **Step 5: Run backend tests**

Run:

```bash
rtk uv run python manage.py test application.tests
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add apps/application/flow/step_node/__init__.py apps/application/flow/workflow_manage.py apps/application/tests.py
rtk git commit -m "feat: register human-in-the-loop workflow node"
```

---

### Task 3: Frontend Workflow Node Registration

**Files:**
- Modify: `ui/src/enums/application.ts`
- Modify: `ui/src/workflow/common/data.ts`
- Create: `ui/src/workflow/icons/human-in-the-loop-node-icon.vue`
- Create: `ui/src/workflow/nodes/human-in-the-loop-node/index.ts`
- Create: `ui/src/workflow/nodes/human-in-the-loop-node/index.vue`

- [ ] **Step 1: Add enum value**

In `ui/src/enums/application.ts`, add:

```typescript
HumanInTheLoopNode = 'human-in-the-loop-node',
```

Place it near `FormNode`.

- [ ] **Step 2: Add workflow node metadata**

In `ui/src/workflow/common/data.ts`, add a new node object near `formNode`:

```typescript
export const humanInTheLoopNode = {
  type: WorkflowType.HumanInTheLoopNode,
  text: t('workflow.nodes.humanInTheLoopNode.text'),
  label: t('workflow.nodes.humanInTheLoopNode.label'),
  height: 260,
  properties: {
    stepName: t('workflow.nodes.humanInTheLoopNode.label'),
    config: {
      fields: [
        { label: t('workflow.nodes.humanInTheLoopNode.fields.action'), value: 'action' },
        { label: t('workflow.nodes.humanInTheLoopNode.fields.confirmed'), value: 'confirmed' },
        { label: t('workflow.nodes.humanInTheLoopNode.fields.userInput'), value: 'user_input' },
        { label: t('workflow.nodes.humanInTheLoopNode.fields.comment'), value: 'comment' },
        { label: t('workflow.nodes.humanInTheLoopNode.fields.status'), value: 'status' },
      ],
    },
    node_data: {
      mode: 'confirmation',
      title: '',
      content: '',
      actions: [
        { value: 'confirm', label: t('workflow.nodes.humanInTheLoopNode.actions.confirm'), branch_id: 'confirm' },
        { value: 'reject', label: t('workflow.nodes.humanInTheLoopNode.actions.reject'), branch_id: 'reject' },
      ],
      placeholder: '',
      submit_label: t('common.submit'),
      allow_comment: false,
      branch_id: 'submit',
      is_result: true,
    },
  },
}
```

Add it to application menu business logic lists:

```typescript
list: [conditionNode, formNode, humanInTheLoopNode, replyNode, loopNode],
```

Add it to application loop menu:

```typescript
list: [conditionNode, formNode, humanInTheLoopNode, replyNode, loopContinueNode, loopBreakNode],
```

Add it to `nodeDict`:

```typescript
[WorkflowType.HumanInTheLoopNode]: humanInTheLoopNode,
```

- [ ] **Step 3: Add icon**

Create `ui/src/workflow/icons/human-in-the-loop-node-icon.vue`:

```vue
<template>
  <div class="flex align-center flex-center w-full h-full">
    <AppIcon iconName="app-user-chat" style="font-size: 20px" />
  </div>
</template>
```

- [ ] **Step 4: Add LogicFlow node registration**

Create `ui/src/workflow/nodes/human-in-the-loop-node/index.ts`:

```typescript
import HumanInTheLoopNodeVue from './index.vue'
import { AppNode, AppNodeModel } from '@/workflow/common/app-node'

class HumanInTheLoopNode extends AppNode {
  constructor(props: any) {
    super(props, HumanInTheLoopNodeVue)
  }
}

export default {
  type: 'human-in-the-loop-node',
  model: AppNodeModel,
  view: HumanInTheLoopNode,
}
```

- [ ] **Step 5: Add node configuration component**

Create `ui/src/workflow/nodes/human-in-the-loop-node/index.vue`:

```vue
<template>
  <NodeContainer :nodeModel="nodeModel">
    <el-card shadow="never" class="card-never" style="--el-card-padding: 12px">
      <el-form
        @submit.prevent
        :model="form_data"
        label-position="top"
        require-asterisk-position="right"
        ref="formRef"
      >
        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.mode.label')">
          <el-radio-group v-model="form_data.mode">
            <el-radio-button value="confirmation">
              {{ $t('workflow.nodes.humanInTheLoopNode.mode.confirmation') }}
            </el-radio-button>
            <el-radio-button value="text">
              {{ $t('workflow.nodes.humanInTheLoopNode.mode.text') }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.title')">
          <el-input v-model="form_data.title" />
        </el-form-item>

        <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.content')">
          <MdEditorMagnify
            v-model="form_data.content"
            :title="$t('workflow.nodes.humanInTheLoopNode.content')"
            style="height: 120px"
            @submitDialog="submitContent"
          />
        </el-form-item>

        <template v-if="form_data.mode === 'confirmation'">
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.actions.label')">
            <div v-for="(action, index) in form_data.actions" :key="index" class="mb-8 w-full">
              <el-input v-model="action.label" class="mb-4">
                <template #prepend>{{ $t('common.name') }}</template>
              </el-input>
              <el-input v-model="action.value" class="mb-4">
                <template #prepend>value</template>
              </el-input>
              <el-input v-model="action.branch_id">
                <template #prepend>branch</template>
              </el-input>
            </div>
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.placeholder')">
            <el-input v-model="form_data.placeholder" />
          </el-form-item>
          <el-form-item :label="$t('workflow.nodes.humanInTheLoopNode.submitLabel')">
            <el-input v-model="form_data.submit_label" />
          </el-form-item>
        </template>

        <el-form-item
          v-if="[WorkflowMode.Application, WorkflowMode.ApplicationLoop].includes(workflowMode)"
          :label="$t('workflow.nodes.aiChatNode.returnContent.label')"
        >
          <el-switch size="small" v-model="form_data.is_result" />
        </el-form-item>
      </el-form>
    </el-card>
  </NodeContainer>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { set } from 'lodash'
import NodeContainer from '@/workflow/common/NodeContainer.vue'
import MdEditorMagnify from '@/components/markdown/MdEditorMagnify.vue'
import { WorkflowMode } from '@/enums/application'

const workflowMode = (inject('workflowMode') as WorkflowMode) || WorkflowMode.Application
const props = defineProps<{ nodeModel: any }>()

const defaultForm = {
  mode: 'confirmation',
  title: '',
  content: '',
  actions: [
    { value: 'confirm', label: '确认', branch_id: 'confirm' },
    { value: 'reject', label: '拒绝', branch_id: 'reject' },
  ],
  placeholder: '',
  submit_label: '提交',
  allow_comment: false,
  branch_id: 'submit',
  is_result: true,
}

const form_data = computed({
  get: () => {
    if (props.nodeModel.properties.node_data) {
      return props.nodeModel.properties.node_data
    }
    set(props.nodeModel.properties, 'node_data', structuredClone(defaultForm))
    return props.nodeModel.properties.node_data
  },
  set: (value) => {
    set(props.nodeModel.properties, 'node_data', value)
  },
})

function submitContent(val: string) {
  set(props.nodeModel.properties.node_data, 'content', val)
}

const formRef = ref()
const validate = () => {
  if (form_data.value.mode === 'confirmation' && !form_data.value.actions?.length) {
    return Promise.reject({
      node: props.nodeModel,
      errMessage: 'Action list cannot be empty',
    })
  }
  return formRef.value?.validate()
}

onMounted(() => {
  set(props.nodeModel, 'validate', validate)
})
</script>
```

- [ ] **Step 6: Run frontend type/build check**

Run:

```bash
rtk npm --prefix ui run build
```

Expected: build progresses past TypeScript compile for the new files. If existing unrelated build failures appear, record them and continue only after confirming they are unrelated.

- [ ] **Step 7: Commit**

```bash
rtk git add ui/src/enums/application.ts ui/src/workflow/common/data.ts ui/src/workflow/icons/human-in-the-loop-node-icon.vue ui/src/workflow/nodes/human-in-the-loop-node
rtk git commit -m "feat: add human-in-the-loop workflow editor node"
```

---

### Task 4: Chat Renderer For Human Interaction Cards

**Files:**
- Create: `ui/src/components/markdown/HumanInTheLoopRander.vue`
- Modify: `ui/src/components/markdown/MdRenderer.vue`

- [ ] **Step 1: Create Human-in-the-loop renderer component**

Create `ui/src/components/markdown/HumanInTheLoopRander.vue`:

```vue
<template>
  <div class="hitl-card border border-r-6 p-12">
    <div class="bold mb-8" v-if="setting.title">{{ setting.title }}</div>
    <MdPreview
      v-if="setting.content"
      editorId="hitl-content"
      :modelValue="setting.content"
      class="maxkb-md mb-8"
    />

    <template v-if="setting.mode === 'confirmation'">
      <el-input
        v-if="setting.allow_comment"
        v-model="comment"
        type="textarea"
        :rows="2"
        class="mb-8"
        :disabled="submitted || disabled || setting.submitted"
      />
      <el-space wrap>
        <el-button
          v-for="action in setting.actions || []"
          :key="action.value"
          :disabled="submitted || disabled || setting.submitted"
          :type="action.value === 'confirm' ? 'primary' : 'default'"
          @click="submit(action.value)"
        >
          {{ action.label }}
        </el-button>
      </el-space>
    </template>

    <template v-else>
      <el-input
        v-model="userInput"
        type="textarea"
        :rows="3"
        :placeholder="setting.placeholder"
        class="mb-8"
        :disabled="submitted || disabled || setting.submitted"
      />
      <el-button
        type="primary"
        :disabled="submitted || disabled || setting.submitted || !userInput.trim()"
        @click="submit('submit')"
      >
        {{ setting.submit_label || $t('common.submit') }}
      </el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { MdPreview } from 'md-editor-v3'

const props = withDefaults(
  defineProps<{
    interaction_setting: string
    disabled?: boolean
    sendMessage?: (question: string, type: 'old' | 'new', other_params_data?: any) => void
    child_node?: any
    chat_record_id?: string
    runtime_node_id?: string
  }>(),
  { disabled: false },
)

const setting = computed(() => JSON.parse(props.interaction_setting || '{}'))
const submitted = ref(false)
const userInput = ref('')
const comment = ref('')

function submit(action: string) {
  if (submitted.value || props.disabled || setting.value.submitted) return
  submitted.value = true
  props.sendMessage?.('', 'old', {
    child_node: props.child_node,
    runtime_node_id: props.runtime_node_id || setting.value.runtime_node_id,
    chat_record_id: props.chat_record_id || setting.value.chat_record_id,
    node_data: {
      interaction_type: 'human_in_the_loop',
      action,
      user_input: userInput.value,
      comment: comment.value,
      payload: {},
    },
  })
}
</script>

<style lang="scss" scoped>
.hitl-card {
  background: var(--el-fill-color-blank);
}
</style>
```

- [ ] **Step 2: Import and render the new component**

In `ui/src/components/markdown/MdRenderer.vue`, import:

```typescript
import HumanInTheLoopRander from './HumanInTheLoopRander.vue'
```

Add a renderer near `FormRander`:

```vue
<HumanInTheLoopRander
  :chat_record_id="chat_record_id"
  :runtime_node_id="runtime_node_id"
  :child_node="child_node"
  :disabled="disabled"
  :send-message="sendMessage"
  v-else-if="item.type === 'human_in_the_loop'"
  :interaction_setting="item.content"
/>
```

- [ ] **Step 3: Split `<human_in_the_loop>` tags**

Refactor `MdRenderer.vue` splitting so form and Human-in-the-loop tags both work. Add a generic helper:

```typescript
function extractTagContent(html: string, tag: string) {
  const results: string[] = []
  const startTag = `<${tag}>`
  const endTag = `</${tag}>`
  let startIndex = html.indexOf(startTag)

  while (startIndex !== -1) {
    const endIndex = html.indexOf(endTag, startIndex)
    if (endIndex === -1) break
    results.push(html.substring(startIndex + startTag.length, endIndex))
    startIndex = html.indexOf(startTag, endIndex + endTag.length)
  }

  return results
}

const split_custom_tag = (result: Array<any>, tag: string) => {
  return result
    .map((item) => split_custom_tag_(item.content, item.type, tag))
    .reduce((x: any, y: any) => [...x, ...y], [])
}

const split_custom_tag_ = (source: string, type: string, tag: string) => {
  const tagContentList = extractTagContent(source, tag).filter((i) => i)
  const uuid = nanoid()
  let sourceWithoutTags = source
  tagContentList.forEach((item) => {
    sourceWithoutTags = sourceWithoutTags.replace(`<${tag}>${item}</${tag}>`, uuid)
  })
  const plainList = sourceWithoutTags
    .split(uuid)
    .filter((item) => item !== undefined)
    .filter((item) => !tagContentList.includes(item))
  return Array.from({ length: tagContentList.length + plainList.length }, (_v, i) => i).map((index) => {
    if (index % 2 === 0) {
      return { type, content: plainList[Math.floor(index / 2)] }
    }
    return { type: tag, content: tagContentList[Math.floor(index / 2)] }
  })
}
```

Update `md_view_list`:

```typescript
const md_view_list = computed(() => {
  const temp_source = props.source
  return split_custom_tag(
    split_custom_tag(
      split_echarts_rander(split_html_rander(split_quick_question([temp_source]))),
      'form_rander',
    ),
    'human_in_the_loop',
  )
})
```

Remove the old form-specific splitter after confirming the generic helper covers `form_rander`.

- [ ] **Step 4: Run frontend build**

Run:

```bash
rtk npm --prefix ui run build
```

Expected: build succeeds or only fails on unrelated pre-existing issues.

- [ ] **Step 5: Commit**

```bash
rtk git add ui/src/components/markdown/HumanInTheLoopRander.vue ui/src/components/markdown/MdRenderer.vue
rtk git commit -m "feat: render human-in-the-loop chat cards"
```

---

### Task 5: Locale Text And Execution Details

**Files:**
- Modify: locale files located by `rtk rg -n "workflow:|nodes:" ui/src/locales ui/src -S`
- Modify: `ui/src/components/execution-detail-card/index.vue`

- [ ] **Step 1: Locate locale files**

Run:

```bash
rtk rg -n "replyNode|formNode|workflow.nodes" ui/src/locales ui/src -S
```

Use the files that define existing `workflow.nodes.*` keys.

- [ ] **Step 2: Add locale keys**

Add equivalent keys to each active language file:

```typescript
humanInTheLoopNode: {
  label: '用户交互',
  text: '等待当前用户确认或补充信息后继续执行',
  mode: {
    label: '交互模式',
    confirmation: '确认',
    text: '文本补充',
  },
  title: '标题',
  content: '说明',
  placeholder: '输入提示',
  submitLabel: '提交按钮文案',
  actions: {
    label: '操作按钮',
    confirm: '确认',
    reject: '拒绝',
  },
  fields: {
    action: '用户动作',
    confirmed: '是否确认',
    userInput: '用户输入',
    comment: '备注',
    status: '状态',
  },
}
```

Translate the same structure for English and Traditional Chinese files if present.

- [ ] **Step 3: Add execution detail display**

In `ui/src/components/execution-detail-card/index.vue`, find the existing node-type-specific sections. Add a compact section for `human-in-the-loop-node`:

```vue
<template v-if="currentNode?.type === 'human-in-the-loop-node'">
  <el-descriptions :column="1" border>
    <el-descriptions-item :label="$t('workflow.nodes.humanInTheLoopNode.fields.status')">
      {{ currentNode.node_status || currentNode.status }}
    </el-descriptions-item>
    <el-descriptions-item :label="$t('workflow.nodes.humanInTheLoopNode.fields.action')">
      {{ currentNode.action }}
    </el-descriptions-item>
    <el-descriptions-item :label="$t('workflow.nodes.humanInTheLoopNode.fields.userInput')">
      {{ currentNode.user_input }}
    </el-descriptions-item>
    <el-descriptions-item :label="$t('workflow.nodes.humanInTheLoopNode.fields.comment')">
      {{ currentNode.comment }}
    </el-descriptions-item>
  </el-descriptions>
</template>
```

Use the local variable names already present in that component; if it uses `item` instead of `currentNode`, adapt only the variable name.

- [ ] **Step 4: Run frontend build**

Run:

```bash
rtk npm --prefix ui run build
```

Expected: build succeeds or reports unrelated existing failures.

- [ ] **Step 5: Commit**

```bash
rtk git add ui/src ui/src/components/execution-detail-card/index.vue
rtk git commit -m "feat: add human-in-the-loop labels and details"
```

---

### Task 6: End-to-End Verification And Cleanup

**Files:**
- No planned source edits unless verification finds a defect.

- [ ] **Step 1: Run backend tests**

Run:

```bash
rtk uv run python manage.py test application.tests
```

Expected: PASS.

- [ ] **Step 2: Run frontend build**

Run:

```bash
rtk npm --prefix ui run build
```

Expected: PASS. If dependency installation is missing or network is required, request escalation only for the exact install/build command and record the result.

- [ ] **Step 3: Manual workflow verification**

Start the app using the repo's normal local development process. In the UI:

1. Create a workflow application.
2. Add `AI Chat -> Human-in-the-loop confirmation -> Reply`.
3. Configure confirm branch to one reply and reject branch to another reply.
4. Send a chat message.
5. Verify a confirmation card appears and workflow stops.
6. Click confirm and verify the confirm branch reply appears.
7. Repeat and click reject; verify the reject branch reply appears.
8. Switch node to text mode, submit text, and verify downstream nodes can reference `user_input`.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
rtk git status --short
rtk git diff --stat
```

Expected: only intended files are modified.

- [ ] **Step 5: Final commit if verification required fixes**

If Step 3 found and fixed defects:

```bash
rtk git add <fixed-files>
rtk git commit -m "fix: stabilize human-in-the-loop workflow"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: backend pause/resume, current-chat-only scope, confirmation mode, text mode, context outputs, branch routing, frontend workflow node, chat renderer, details, and extension fields are covered.
- Deliberate deferrals: backend admin approval, other assignees, notifications, timeout, and persistent task tables remain out of scope as required by the spec.
- Type consistency: node type is consistently `human-in-the-loop-node`; tag is consistently `human_in_the_loop`; resume payload uses `node_data` with `interaction_type`, `action`, `user_input`, `comment`, and `payload`.
- Test posture: plan starts with backend failing tests and validates frontend through build plus manual end-to-end workflow because the repo does not currently expose an obvious frontend unit test harness.
