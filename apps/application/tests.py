from types import SimpleNamespace

from django.test import TestCase

from application.flow.common import WorkflowMode
from application.flow.step_node import get_node
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

    def test_confirmation_resume_without_action_branch_routes_action_value(self):
        node = make_node({
            "mode": "confirmation",
            "title": "Continue?",
            "content": "Run the next step?",
            "actions": [
                {"value": "approve", "label": "Approve"},
                {"value": "reject", "label": "Reject", "branch_id": "reject"},
            ],
            "node_data": {
                "interaction_type": "human_in_the_loop",
                "action": "approve",
                "user_input": "",
                "comment": "",
                "payload": {},
            },
            "is_result": True,
        })

        result = node.run()
        list(result.write_context(node, node.workflow_manage))

        self.assertEqual(result.node_variable["branch_id"], "approve")

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


class HumanInTheLoopRegistrationTest(TestCase):
    def test_node_is_registered_for_application_workflow(self):
        self.assertIs(get_node("human-in-the-loop-node", WorkflowMode.APPLICATION), BaseHumanInTheLoopNode)
        self.assertIs(get_node("human-in-the-loop-node", WorkflowMode.APPLICATION_LOOP), BaseHumanInTheLoopNode)
