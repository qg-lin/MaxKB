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
    allow_reject = serializers.BooleanField(required=False, label=_("Allow reject"))
    reject_label = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Reject label"))
    reject_branch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, label=_("Reject branch id"))
    node_data = serializers.DictField(required=False, allow_null=True, label=_("Submitted interaction data"))
    is_result = serializers.BooleanField(required=False, label=_("Whether to return content"))

    def is_valid(self, *, raise_exception=False):
        result = super().is_valid(raise_exception=raise_exception)
        if self.data.get("mode") == "confirmation" and len(self.data.get("actions") or []) == 0:
            raise AppApiException(500, _("Action list cannot be empty"))
        return result


class IHumanInTheLoopNode(INode):
    type = "human-in-the-loop-node"
    view_type = "single_view"
    support = [WorkflowMode.APPLICATION, WorkflowMode.APPLICATION_LOOP]

    def get_node_params_serializer_class(self) -> Type[serializers.Serializer]:
        return HumanInTheLoopNodeParamsSerializer

    def _run(self):
        flow_params = self.flow_params_serializer.data if self.flow_params_serializer is not None else self.workflow_params
        return self.execute(**self.node_params_serializer.data, **flow_params)

    def execute(self, mode, title=None, content=None, actions=None, placeholder=None,
                submit_label=None, allow_comment=False, branch_id=None, allow_reject=False,
                reject_label=None, reject_branch_id=None, node_data=None, **kwargs) -> NodeResult:
        pass
