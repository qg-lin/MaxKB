# apps/application/views/form_node.py
# coding=utf-8
from rest_framework import serializers
from rest_framework.decorators import api_view
from django.http import JsonResponse

from common.exception.app_exception import AppApiException
from common.result import success
from application.flow.step_node.form_node.impl.csv_parse_option_handle import CsvParseOptionHandle


class ParseCsvSerializer(serializers.Serializer):
    file = serializers.FileField(required=True, label="CSV文件")


@api_view(['POST'])
def parse_csv(request):
    """
    解析CSV文件，返回选项列表
    """
    file = request.FILES.get('file')
    if not file:
        return JsonResponse({'code': 500, 'message': '未上传文件'}, status=500)

    handle = CsvParseOptionHandle()
    if not handle.support(file):
        return JsonResponse({'code': 500, 'message': '只支持CSV文件'}, status=500)

    try:
        result = handle.parse(file)
        return success(result)
    except Exception as e:
        return JsonResponse({'code': 500, 'message': f'解析失败：{str(e)}'}, status=500)