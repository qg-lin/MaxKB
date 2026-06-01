# apps/application/flow/step_node/form_node/impl/csv_parse_option_handle.py
# coding=utf-8
"""
    CSV解析处理器
"""
import csv
import io
import traceback

from charset_normalizer import detect
from common.utils.logger import maxkb_logger


class CsvParseOptionHandle:
    def support(self, file):
        file_name: str = file.name.lower()
        if file_name.endswith(".csv"):
            return True
        return False

    def parse(self, file) -> list:
        buffer = file.read()
        try:
            encoding = detect(buffer)['encoding']
            content = buffer.decode(encoding)
        except Exception as e:
            maxkb_logger.error(f"Error detecting encoding: {e}")
            content = buffer.decode('utf-8', errors='ignore')

        try:
            reader = csv.reader(io.TextIOWrapper(io.BytesIO(buffer), encoding=encoding))
            rows = list(reader)
        except Exception as e:
            maxkb_logger.error(f"Error parsing CSV: {e}, {traceback.format_exc()}")
            raise Exception(f"CSV解析失败：{str(e)}")

        if len(rows) == 0:
            raise Exception("CSV文件为空")

        # 第一行为标题
        header = rows[0]
        header = [h.strip().lower() for h in header]

        # 查找label和value列
        label_index = None
        value_index = None
        for i, col in enumerate(header):
            if col == 'label':
                label_index = i
            elif col == 'value':
                value_index = i

        if label_index is None or value_index is None:
            raise Exception("CSV列头必须为label和value")

        result = []
        for row_idx, row in enumerate(rows[1:], start=2):
            if not row or all(cell.strip() == '' for cell in row):
                continue
            try:
                label = row[label_index].strip() if label_index < len(row) else ''
                value = row[value_index].strip() if value_index < len(row) else ''
                if label and value:
                    result.append({'label': label, 'value': value})
            except Exception as e:
                maxkb_logger.warning(f"Error parsing row {row_idx}: {e}")
                continue

        return result
