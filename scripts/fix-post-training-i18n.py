#!/usr/bin/env python3
"""Fix post-training i18n runtime issues."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "post-training.html"


def unwrap_const_block(text: str, name: str) -> str:
    pattern = rf"(const {name} = \{{.*?\n        \}};)"
    m = re.search(pattern, text, re.S)
    if not m:
        return text
    block = m.group(1)
    fixed = re.sub(r'L\("([^"]*)"\)', r'"\1"', block)
    fixed = re.sub(r"L\('([^']*)'\)", r"'\1'", fixed)
    return text[: m.start(1)] + fixed + text[m.end(1) :]


def main() -> None:
    text = HTML.read_text(encoding="utf-8")

    # Fix broken nav attributes
    text = text.replace('> data-i18n="nav.inference">', '" data-i18n="nav.inference">')
    text = text.replace('> data-i18n="nav.postTraining">', '" data-i18n="nav.postTraining">')
    text = text.replace('> data-i18n="nav.aiDcLayout">', '" data-i18n="nav.aiDcLayout">')
    text = text.replace('> data-i18n="nav.whitePaper">', '" data-i18n="nav.whitePaper">')
    text = text.replace('> data-i18n="nav.aboutUs">', '" data-i18n="nav.aboutUs">')

    text = unwrap_const_block(text, "mockDatasets")
    text = unwrap_const_block(text, "baseModelAnswers")

    text = text.replace(
        ".innerHTML = L('<p style=\"text-align: center; color: #95a5a6; padding: 40px;\">请选择一个问题开始体验</p>');",
        ".innerHTML = '<p style=\"text-align: center; color: #95a5a6; padding: 40px;\">' + L('请选择一个问题开始体验') + '</p>';",
    )

    text = text.replace(
        "${index + 1}.</span>${item.input}",
        "${index + 1}.</span>${L(item.input)}",
    )
    text = text.replace(
        "<strong>✓ 正确答案:</strong> ${item.output}",
        "<strong>${L('✓ 正确答案:')}</strong> ${L(item.output)}",
    )

    text = text.replace(
        "label.textContent = type === 'user' ? '用户提问' : '模型回答';",
        "label.textContent = type === 'user' ? L('用户提问') : L('模型回答');",
    )

    text = text.replace(
        "alert('请先进行模型训练后再进行效果对比');",
        "alert(L('请先进行模型训练后再进行效果对比'));",
    )

    text = text.replace(
        "document.querySelector('.model-header .model-info h3').textContent = '基础模型';",
        "document.querySelector('.model-header .model-info h3').textContent = L('基础模型');",
    )
    text = text.replace(
        "document.querySelectorAll('.model-header')[1].querySelector('h3').textContent = '增强模型';",
        "document.querySelectorAll('.model-header')[1].querySelector('h3').textContent = L('增强模型');",
    )
    text = text.replace(
        ".textContent = `${baseModelName} - 训练前`;",
        ".textContent = `${baseModelName} - ${L('训练前')}`;",
    )
    text = text.replace(
        ".textContent = `${baseModelName} - 训练后`;",
        ".textContent = `${baseModelName} - ${L('训练后')}`;",
    )

    text = text.replace(
        "addMessage(baseChatBox, 'user', question);",
        "addMessage(baseChatBox, 'user', L(question));",
    )
    text = text.replace(
        "addMessage(enhancedChatBox, 'user', question);",
        "addMessage(enhancedChatBox, 'user', L(question));",
    )
    text = text.replace(
        "addMessage(baseChatBox, 'assistant', baseAnswer);",
        "addMessage(baseChatBox, 'assistant', L(baseAnswer));",
    )
    text = text.replace(
        "addMessage(enhancedChatBox, 'assistant', enhancedAnswer);",
        "addMessage(enhancedChatBox, 'assistant', L(enhancedAnswer));",
    )

    text = text.replace(
        "document.getElementById('modal-title').innerText = `${datasetName} - 前10条数据`;",
        "document.getElementById('modal-title').innerText = `${datasetName} - ${L('前10条数据')}`;",
    )
    text = text.replace(
        "<td>${item.input}</td>\n                    <td>${item.output}</td>",
        "<td>${L(item.input)}</td>\n                    <td>${L(item.output)}</td>",
    )

    HTML.write_text(text, encoding="utf-8")
    print("Fixed", HTML)


if __name__ == "__main__":
    main()
