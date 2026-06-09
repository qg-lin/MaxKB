# coding=utf-8
"""
    @project: MaxKB
    @Author：虎虎
    @file： base_variable_splitting_node.py
    @date：2025/10/13 15:02
    @desc:
"""
import json
import re

from django.db.models import QuerySet
from langchain_core.messages import HumanMessage
from langchain_core.prompts import PromptTemplate

from application.flow.i_step_node import NodeResult
from application.flow.step_node.parameter_extraction_node.i_parameter_extraction_node import IParameterExtractionNode
from models_provider.models import Model
from models_provider.tools import get_model_instance_by_model_workspace_id, get_model_credential

prompt = """
Please strictly process the text according to the following requirements:
**Task**: 
Extract specified field information from given text

**Enter text**: 
{{question}}

**Extract configuration**: 
{{properties}}

**Rule**:
- Strictly follow the data and field of Extract configuration
- If not found, use null value
- Only return pure JSON without additional text
- Keep the string format neat
"""


def get_default_model_params_setting(model_id):
    model = QuerySet(Model).filter(id=model_id).first()
    credential = get_model_credential(model.provider, model.model_type, model.model_name)
    model_params_setting = credential.get_model_params_setting_form(
        model.model_name).get_default_form_data()
    return model_params_setting


def generate_properties(variable_list):
    return {variable['field']: {'type': variable['parameter_type'], 'description': (variable.get('desc') or ""),
                                'title': variable['label']} for variable in
            variable_list}


def generate_example(variable_list):
    return {variable['field']: None for variable in variable_list}


def replace_workflow_references(prompt_template_str, workflow_manage):
    reference_list = []
    manager_list = [workflow_manage]
    parent_workflow_manage = getattr(workflow_manage, 'parentWorkflowManage', None)
    if parent_workflow_manage is not None:
        manager_list.append(parent_workflow_manage)

    for manager in manager_list:
        for field in getattr(manager, 'field_list', []):
            reference_list.append({
                'label': f"{field.get('node_name')}.{field.get('value')}",
                'value': workflow_manage.get_reference_field(field.get('node_id'), [field.get('value')])
            })

    for manager in manager_list:
        for field in getattr(manager, 'global_field_list', []):
            value = workflow_manage.get_reference_field('global', [field.get('value')])
            reference_list.append({'label': f"全局变量.{field.get('value')}", 'value': value})
            reference_list.append({'label': f"global.{field.get('value')}", 'value': value})

        for field in getattr(manager, 'chat_field_list', []):
            reference_list.append({
                'label': f"chat.{field.get('value')}",
                'value': workflow_manage.get_reference_field('chat', [field.get('value')])
            })

    for field in getattr(workflow_manage, 'loop_field_list', []):
        reference_list.append({
            'label': f"loop.{field.get('value')}",
            'value': workflow_manage.get_reference_field('loop', [field.get('value')])
        })

    reference_list.sort(key=lambda item: len(item.get('label') or ''), reverse=True)
    reference_variables = {}
    for reference in reference_list:
        label = reference.get('label')
        if not label or label not in prompt_template_str:
            continue
        variable_name = f"__workflow_ref_{len(reference_variables)}"
        prompt_template_str = prompt_template_str.replace(label, variable_name)
        reference_variables[variable_name] = reference.get('value') or ''
    return prompt_template_str, reference_variables


def generate_content(input_variable, variable_list, prompt_template_str=prompt, workflow_manage=None):
    properties = json.dumps(generate_properties(variable_list), ensure_ascii=False)
    reference_variables = {}
    if workflow_manage is not None:
        prompt_template_str, reference_variables = replace_workflow_references(prompt_template_str, workflow_manage)
    prompt_template = PromptTemplate.from_template(prompt_template_str, template_format='jinja2')
    value = prompt_template.format(properties=properties, question=input_variable, **reference_variables)
    return value


def json_loads(response, expected_fields):
    if not response or not isinstance(response, str):
        return {field: None for field in expected_fields}

    cleaned = response.strip()

    extraction_strategies = [
        lambda: json.loads(cleaned),
        lambda: json.loads(re.search(r'```(?:json)?\s*(\{.*?\})\s*```', cleaned, re.DOTALL).group(1)),
        lambda: json.loads(re.search(r'(\{[\s\S]*\})', cleaned).group(1)),
    ]
    for strategy in extraction_strategies:
        try:
            result = strategy()
            return result
        except:
            continue
    return generate_example(expected_fields)


class BaseParameterExtractionNode(IParameterExtractionNode):

    def save_context(self, details, workflow_manage):
        for key, value in details.get('result').items():
            self.context[key] = value
        self.context['result'] = details.get('result')
        self.context['request'] = details.get('request')
        self.context['prompt'] = details.get('prompt')
        self.context['exception_message'] = details.get('err_message')

    def execute(self, input_variable, variable_list, model_params_setting, model_id, prompt_type='system',
                custom_prompt='', **kwargs) -> NodeResult:
        input_variable = str(input_variable)
        self.context['request'] = input_variable
        if model_params_setting is None:
            model_params_setting = get_default_model_params_setting(model_id)
        workspace_id = self.workflow_manage.get_body().get('workspace_id')
        chat_model = get_model_instance_by_model_workspace_id(model_id, workspace_id,
                                                              **model_params_setting)
        custom_prompt = custom_prompt or ''
        if prompt_type == 'custom' and custom_prompt.strip():
            content = generate_content(input_variable, variable_list, custom_prompt, self.workflow_manage)
        else:
            content = generate_content(input_variable, variable_list)
        self.context['prompt'] = content
        response = chat_model.invoke([HumanMessage(content=content)])
        result = json_loads(response.content, variable_list)
        return NodeResult({'result': result, **result}, {})

    def get_details(self, index: int, **kwargs):
        node_params = self.node_params_serializer.data if self.node_params_serializer is not None else self.node_params
        return {
            'name': self.node.properties.get('stepName'),
            "index": index,
            'run_time': self.context.get('run_time'),
            'type': self.node.type,
            'prompt_type': node_params.get('prompt_type', 'system'),
            'prompt': self.context.get('prompt'),
            'request': self.context.get('request'),
            'result': self.context.get('result'),
            'status': self.status,
            'err_message': self.err_message,
            'enableException': self.node.properties.get('enableException'),
        }
