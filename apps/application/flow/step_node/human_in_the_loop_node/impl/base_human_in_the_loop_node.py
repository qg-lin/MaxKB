# coding=utf-8
import json
import time
from datetime import datetime, timezone
from typing import Dict

from django.utils.translation import gettext_lazy as _

from application.flow.i_step_node import NodeResult
from application.flow.step_node.human_in_the_loop_node.i_human_in_the_loop_node import IHumanInTheLoopNode
from common.exception.app_exception import AppApiException


def _workflow_is_result(workflow, node, step_variable, global_variable):
    if hasattr(workflow, "is_result"):
        return workflow.is_result(node, NodeResult(step_variable, global_variable))
    return node.node_params.get("is_result", False)


def _write_context(step_variable: Dict, global_variable: Dict, node, workflow):
    if step_variable is not None:
        for key, value in step_variable.items():
            node.context[key] = value
        if "result" in step_variable and _workflow_is_result(workflow, node, step_variable, global_variable):
            node.answer_text = step_variable["result"]
            yield step_variable["result"]
    if global_variable is not None:
        for key, value in global_variable.items():
            workflow.context[key] = value
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
        flow_params = self.flow_params_serializer.data if self.flow_params_serializer is not None else self.workflow_params
        payload = {
            "interaction_type": "human_in_the_loop",
            "mode": mode,
            "runtime_node_id": self.runtime_node_id,
            "chat_record_id": flow_params.get("chat_record_id"),
            "title": self._render_text(title),
            "content": self._render_text(content),
            "actions": [{"value": action.get("value"), "label": action.get("label")} for action in actions],
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
        action_map = {action_item.get("value"): action_item for action_item in actions}
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
