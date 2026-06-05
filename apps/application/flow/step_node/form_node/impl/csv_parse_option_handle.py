# apps/application/flow/step_node/form_node/impl/csv_parse_option_handle.py
# coding=utf-8
"""
    CSV解析处理器
"""
import csv
import io

from charset_normalizer import detect
from common.utils.logger import maxkb_logger


class CsvParseOptionHandle:
    # 按真实使用频率排序：现代系统默认 UTF-8；中国 Windows 常用 GBK/GB18030
    ENCODING_CANDIDATES = ('utf-8-sig', 'utf-8', 'gb18030', 'gbk')

    def support(self, file):
        file_name: str = file.name.lower()
        if file_name.endswith(".csv"):
            return True
        return False

    @classmethod
    def parse(cls, file) -> list:
        buffer = file.read()
        if not buffer:
            raise Exception("CSV文件为空")

        # 先按业务最常见的编码顺序试一遍
        rows = None
        for encoding in cls.ENCODING_CANDIDATES:
            try:
                reader = csv.reader(io.TextIOWrapper(io.BytesIO(buffer), encoding=encoding))
                rows = list(reader)
                break
            except (UnicodeDecodeError, csv.Error, LookupError):
                continue

        # 常见编码都失败，再用 charset_normalizer 兜底（极少数非中文/非 UTF-8 场景）
        if rows is None:
            try:
                detected = detect(buffer)
                if isinstance(detected, dict):
                    enc = detected.get('encoding')
                    if enc:
                        try:
                            reader = csv.reader(io.TextIOWrapper(io.BytesIO(buffer), encoding=enc))
                            rows = list(reader)
                        except (UnicodeDecodeError, csv.Error, LookupError):
                            rows = None
            except Exception as e:
                maxkb_logger.warning(f"Error detecting encoding: {e}")

        if rows is None:
            raise Exception(f"CSV解析失败：文件编码无法识别，请确认文件为 UTF-8/GBK/GB18030 编码")

        if len(rows) == 0:
            raise Exception("CSV文件为空")

        # 第一行为标题
        header = [h.strip().lower() for h in rows[0]]

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
