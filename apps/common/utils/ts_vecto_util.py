# coding=utf-8
"""
    @project: maxkb
    @Author：虎
    @file： ts_vecto_util.py
    @date：2024/4/16 15:26
    @desc:
"""
import re
import uuid_utils.compat as uuid
from typing import List

import jieba
import jieba.posseg

jieba_word_list_cache = [chr(item) for item in range(38, 84)]

for jieba_word in jieba_word_list_cache:
    jieba.add_word('#' + jieba_word + '#')
# r"(?i)\b(?:https?|ftp|tcp|file)://[^\s]+\b",
# 某些不分词数据
# r'"([^"]*)"'
word_pattern_list = [r"v\d+.\d+.\d+",
                     r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}"]

remove_chars = '\n , :\'<>！@#￥%……&*（）!@#$%^&*()： ；，/"./'

jieba_remove_flag_list = ['x', 'w']

NO_MATCH_TS_QUERY = 'maxkbnomatchtoken'
CJK_PATTERN = re.compile(r'^[\u4e00-\u9fff]+$')
TOKEN_PATTERN = re.compile(r'[A-Za-z0-9_]+|[\u4e00-\u9fff]+')


def get_word_list(text: str):
    result = []
    for pattern in word_pattern_list:
        word_list = re.findall(pattern, text)
        for child_list in word_list:
            for word in child_list if isinstance(child_list, tuple) else [child_list]:
                # 不能有: 所以再使用: 进行分割
                if word.__contains__(':'):
                    item_list = word.split(":")
                    for w in item_list:
                        result.append(w)
                else:
                    result.append(word)
    return result


def replace_word(word_dict, text: str):
    for key in word_dict:
        pattern = '(?<!#)' + re.escape(word_dict[key]) + '(?!#)'
        text = re.sub(pattern, key, text)
    return text


def get_word_key(text: str, use_word_list):
    j_word = next((j for j in jieba_word_list_cache if j not in text and all(j not in used for used in use_word_list)),
                  None)
    if j_word:
        return j_word
    j_word = str(uuid.uuid7())
    jieba.add_word(j_word)
    return j_word


def to_word_dict(word_list: List, text: str):
    word_dict = {}
    for word in word_list:
        key = get_word_key(text, set(word_dict))
        word_dict['#' + key + '#'] = word
    return word_dict


def get_key_by_word_dict(key, word_dict):
    v = word_dict.get(key)
    if v is None:
        return key
    return v


def to_ts_vector(text: str):
    # 分词
    result = jieba.lcut(text, cut_all=True)
    return " ".join(result)


def to_query(text: str):
    extract_tags = jieba.lcut(text, cut_all=True)
    result = " ".join(extract_tags)
    return result


def to_or_query(text: str, max_terms: int = 12):
    token_list = jieba.lcut(text, cut_all=True)
    result = []
    exist = set()
    for token in token_list:
        for word in TOKEN_PATTERN.findall(token):
            word = word.strip()
            if not word:
                continue
            if CJK_PATTERN.match(word) and len(word) <= 1:
                continue
            key = word.lower()
            if key in exist:
                continue
            exist.add(key)
            result.append(word)
            if len(result) >= max_terms:
                return " | ".join(result)
    return " | ".join(result) if len(result) > 0 else NO_MATCH_TS_QUERY
