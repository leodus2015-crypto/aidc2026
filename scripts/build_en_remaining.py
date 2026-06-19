#!/usr/bin/env python3
"""DEPRECATED: en/ 目录已移除。英文文案请维护 i18n/*.en.json。"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = Path(__file__).resolve().parent
EN = ROOT / "en"

COMMON_NAV = {
    "主导航": "Main navigation",
    "AIDC 2026 · 首页": "AIDC 2026 · Home",
    "Agentic推理": "Agentic Inference",
    "后训练": "Post-Training",
    "AI DC布局": "AI DC Layout",
    "白皮书": "White Paper",
    "About US": "About Us",
    "工信部备案号：": "MIIT filing:",
    "公安备案号：": "Public security filing:",
}

LANG_SWITCH_NAV = '\n      <div id="lang-switch-root" class="ml-auto shrink-0"></div>'
LANG_SWITCH_SCRIPTS = (
    '\n  <script src="../js/lang-switch.js"></script>'
    '\n  <script>AidcLangSwitch.mount(document.getElementById(\'lang-switch-root\'));</script>'
)
LANG_SWITCH_TOPBAR = '<div id="lang-switch-root" class="lang-switch-topbar" style="margin-left:auto;"></div>'


def fix_assets(content: str) -> str:
    content = content.replace('lang="zh-CN"', 'lang="en"')

    def asset_repl(m: re.Match) -> str:
        attr, val = m.group(1), m.group(2)
        if val.startswith("../") or val.startswith("http://") or val.startswith("https://") or val.startswith("//"):
            return m.group(0)
        if val.startswith("#"):
            return m.group(0)
        return f'{attr}="../{val}"'

    content = re.sub(r'(src|href)="([^"]+)"', asset_repl, content)
    # Restore internal en/ page links (strip ../ from .html links without path)
    content = re.sub(r'href="\.\./([a-zA-Z0-9_.\-]+\.html[^"]*)"', r'href="\1"', content)
    return content


def inject_lang_switch(content: str, mode: str = "nav") -> str:
    if 'id="lang-switch-root"' in content:
        pass
    elif mode == "nav":
        content = re.sub(
            r"(</ul>\s*)(</nav>)",
            r"\1" + LANG_SWITCH_NAV + r"\n    \2",
            content,
            count=1,
        )
    elif mode == "topbar":
        content = content.replace(
            '<span id="hint">',
            LANG_SWITCH_TOPBAR + '\n    <span id="hint">',
            1,
        )
    elif mode == "header":
        content = content.replace(
            '<div class="click-hint">',
            LANG_SWITCH_TOPBAR + '\n  <div class="click-hint">',
            1,
        )

    if "../js/lang-switch.js" not in content:
        content = content.replace("</body>", LANG_SWITCH_SCRIPTS + "\n</body>")
    return content


def apply_translations(content: str, mapping: dict[str, str]) -> str:
    for zh, en in sorted(mapping.items(), key=lambda x: len(x[0]), reverse=True):
        content = content.replace(zh, en)
    return content


FLOOR_DETAIL = {
    **COMMON_NAV,
    "单层详细平面图 · AI Data Center": "Single Floor Plan · AI Data Center",
    "AI 数据中心单层详细平面图：EHU 空调机房、风冷/液冷机房、配电与水力模块。": "Single-floor AI data center plan: EHU HVAC rooms, air/liquid-cooled halls, power and hydraulic modules.",
    "单层详细平面图": "Single Floor Plan",
    "根据手绘草图整理为结构化示意图，非施工比例图；房间名称与尺寸按图中可识别信息保留。": "Structured schematic from a hand sketch; not to construction scale. Room names and dimensions follow identifiable labels in the source drawing.",
    "单层数据中心详细平面图": "Single-floor data center detailed plan",
    "EHU 空调机房": "EHU HVAC Room",
    "风冷 / 液冷机房": "Air / Liquid Cooled Hall",
    "液冷": "Liquid",
    "水力": "Hydraulic",
    "模块间": "Module Room",
    "低压": "LV",
    "配电": "Power",
    "电气": "Electrical",
    "室": "Room",
    "中压": "MV",
    "预留": "Reserved",
    "低压配电": "LV Power Distribution",
    "中压室": "MV Room",
    "水力模块间": "Hydraulic Module Room",
    "示意图 · 非施工图": "Schematic · Not for construction",
}

HOT_AISLE = {
    "机房冷热通道 · 3D 示意": "Hot/Cold Aisle · 3D Demo",
    "冷风自冷通道地板进入机柜 → 热风排向热通道 → 上升至机柜上方消失": "Cold air enters racks from the cold aisle floor → hot air exits to the hot aisle → rises above racks",
    "冷风": "Cold air",
    "热风": "Hot air",
    "拖拽旋转 · 滚轮缩放": "Drag to rotate · Scroll to zoom",
    "冷通道": "Cold Aisle",
    "热通道": "Hot Aisle",
}

DOCS = {
    **COMMON_NAV,
    "重定向至说明文档 · AI Data Center": "Redirect to Documentation · AI Data Center",
    "说明文档已合并至首页第三部分。": "Documentation has been merged into section three on the home page.",
    "前往「说明文档」区块": "Go to Documentation section",
}

CAPACITY = {
    **COMMON_NAV,
    "重定向至容量规划 · AI Data Center": "Redirect to Capacity Planning · AI Data Center",
    "容量规划内容已合并至首页 Agentic 推理下方。": "Capacity planning content has been merged below Agentic Inference on the home page.",
    "前往「容量规划」区块": "Go to Capacity Planning section",
}

OUTLINE = {
    "重定向 · 白皮书 2.0讨论稿": "Redirect · White Paper 2.0 Draft",
    "前往 2.0讨论稿": "Go to 2.0 Draft",
}

DRAFT = {
    **COMMON_NAV,
    "AI DC 白皮书 2.0 讨论稿：章节规划对齐工作台。": "AI DC White Paper 2.0 draft: chapter alignment workbench.",
    "白皮书 2.0讨论稿 · AI Data Center": "White Paper 2.0 Draft · AI Data Center",
    "内部 · 章节对齐": "Internal · Chapter Alignment",
    "2.0讨论稿": "2.0 Draft",
    "视图模式": "View mode",
    "预览": "Preview",
    "编辑": "Edit",
    "导出 Markdown": "Export Markdown",
    "导出 JSON": "Export JSON",
    "导入 Markdown": "Import Markdown",
    "立即保存": "Save now",
    "编辑内容会自动保存到浏览器本地（刷新后仍可恢复）；也可随时点击「立即保存」或导出 JSON 备份。": "Edits auto-save locally in your browser (persist after refresh). You can also click Save now or export JSON for backup.",
    "加载中…": "Loading…",
    "关闭": "Close",
    "粘贴 Markdown 文本，或选择 .md 文件。导入前可先预览解析结果。": "Paste Markdown or choose a .md file. Preview parsing before import.",
    "选择文件": "Choose file",
    "Markdown 内容": "Markdown content",
    "# 第1章 …": "# Chapter 1 …",
    "预览解析": "Preview parse",
    "确认导入": "Confirm import",
}

POST_TRAINING = {
    **COMMON_NAV,
    "后训练 · 强化学习训练流程演示（数据制作、模型准备、参数配置、训练与评测）。": "Post-training · RL training flow demo (data prep, model setup, configuration, training, and evaluation).",
    "后训练 · 强化学习训练流程 · AI Data Center": "Post-Training · RL Training Flow · AI Data Center",
    "强化学习训练流程演示": "Reinforcement Learning Training Demo",
    "数据制作": "Data Preparation",
    "模型准备": "Model Setup",
    "参数配置": "Configuration",
    "训练过程": "Training",
    "训练结果": "Results",
    "效果体验": "Experience",
    "开始训练": "Start Training",
    "重置演示": "Reset Demo",
    "📊 数据制作": "📊 Data Preparation",
    "返回首页": "Back to Home",
    "数据集配置": "Dataset Configuration",
    "用例集选择": "Use-case Dataset",
    "选择特定行业的训练数据集，用于微调模型以适应特定领域的问答和任务。": "Choose an industry dataset to fine-tune the model for domain Q&A and tasks.",
    "保险行业数据集 (.Parquet格式, 300条训练集，50条测试集)": "Insurance dataset (.Parquet, 300 train / 50 test)",
    "教育培训数据集 (.Parquet格式, 400条训练集，80条测试集)": "Education dataset (.Parquet, 400 train / 80 test)",
    "证券行业数据集 (.Parquet格式, 300条训练集，50条测试集)": "Securities dataset (.Parquet, 300 train / 50 test)",
    "查看数据集详情 (前10条)": "View dataset details (first 10 rows)",
    "数据集详情": "Dataset Details",
    "问题(question)": "Question",
    "答案(answer)": "Answer",
    "返回": "Back",
    "数据集准备流程": "Dataset Preparation Pipeline",
    "Step 1. 数据清洗": "Step 1. Data Cleaning",
    "过滤低质量样本：移除过短/过长文本、重复内容去重、特殊字符及有毒内容检测，确保训练数据纯净度与安全性": "Filter low-quality samples: remove too-short/long text, deduplicate, detect special/toxic content to keep training data clean and safe.",
    "Step 2. 指令生成": "Step 2. Instruction Generation",
    "基于Self-Instruct范式，用种子指令引导LLM批量生成多样化任务指令，覆盖分类/生成/推理等类型，低成本扩充高质量SFT数据": "Self-Instruct style: seed prompts guide the LLM to batch-generate diverse instructions (classification/generation/reasoning) for low-cost SFT data.",
    "Step 3. 偏好标注": "Step 3. Preference Labeling",
    "人工或AI对同一prompt的多个回复进行排序/二选一，构建(chosen, rejected)偏好对，为Reward Model训练提供监督信号，是RLHF核心数据来源": "Humans or AI rank or pairwise-compare responses to build (chosen, rejected) pairs—core RLHF supervision for reward model training.",
    "Step 4. 质量评估": "Step 4. Quality Evaluation",
    "通过自动指标（长度分布、毒性分数、任务多样性）与人工抽查结合，量化数据集质量，防止模型学习噪声或虚假相关性（如“长回复=优质”）": "Combine automatic metrics (length, toxicity, diversity) with spot checks to avoid spurious correlations (e.g. longer = better).",
    "Step 5. 数据合成": "Step 5. Data Synthesis",
    "利用强模型（如Deepseek）自动生成指令-回复对或偏好对，结合规则过滤构建百万级数据集，解决人工标注成本高、规模受限问题。": "Use strong models (e.g. DeepSeek) to synthesize instruction-response or preference pairs with rule filtering at scale.",
    "下一步": "Next",
    "上一步": "Previous",
    "🧠 模型准备": "🧠 Model Setup",
    "模型选择": "Model Selection",
    "基础模型": "Base Model",
    "选择预训练大语言模型：8B适合快速实验，14B平衡性能与成本，32B提供最强性能": "Pick a pretrained LLM: 8B for fast experiments, 14B balances cost/performance, 32B for peak performance.",
    "Qwen3-8B (约8亿参数)": "Qwen3-8B (~8B parameters)",
    "Qwen3-14B (约14亿参数)": "Qwen3-14B (~14B parameters)",
    "Qwen3-32B (约32亿参数)": "Qwen3-32B (~32B parameters)",
    "NPU卡数量": "NPU Count",
    "NPU卡数量决定可用显存，当前使用64GB显存版本：8B建议8卡，14B建议16卡，32B建议32卡": "NPU count sets available memory; with 64GB cards: 8B→8 NPUs, 14B→16, 32B→32.",
    "硬件型号": "Hardware Model",
    "训练硬件款型": "Training hardware SKU",
    "⚙️ 参数配置": "⚙️ Configuration",
    "算法选择": "Algorithm Selection",
    "训练框架": "Training Framework",
    "verl 是一个灵活、高效且可用于生产环境的强化学习（RL）训练框架，专为大型语言模型（LLMs）的后训练设计": "verl is a flexible, efficient, production-ready RL framework for LLM post-training.",
    "RL训练算法": "RL Algorithm",
    "选择强化学习算法：PPO稳定高效，GPRO结合策略梯度和进化算法": "Choose RL algorithm: PPO is stable; GRPO uses group-relative optimization.",
    "PPO算法": "PPO Algorithm",
    "近端策略优化算法 PPO（Proximal Policy Optimization Algorithms）：包括4个模型，Reward Model 提供奖励型号，Value Model  提供价值评估，通过 Reference Model 提供参考输出，叠加KL散度惩罚机制，限制策略更新幅度，确保训练稳定性和效率。该算法需要同时训练2个模型，方案实施比较复杂。": "PPO uses four models: reward, value, reference, and policy with KL penalty to limit updates. Requires training two models—more complex to deploy.",
    "GRPO算法": "GRPO Algorithm",
    "组相对策略优化 GRPO（Group Relative Policy Optimization）：使用3个模型，针对每个 Prompt 生成一组 Response，通过 Reference Model 提供参考输出，叠加KL散度惩罚机制，使用组内相对值奖励来估计优势函数。该方法不需要训练 Value Model，降低方案复杂度，提高了训练效率。": "GRPO uses three models, generates a response group per prompt, applies KL penalty vs. reference, and estimates advantage from group-relative rewards—no value model needed.",
    "训练参数": "Training Parameters",
    "典型 RLHF lr: 1e-6 ~ 5e-6，过低导致学习缓慢, 过大导致震荡": "Typical RLHF lr: 1e-6–5e-6; too low slows learning, too high oscillates.",
    "每次训练使用的样本数量：32-128常用，大批次训练稳定，小批次更新频繁": "Samples per step: 32–128 common; large batches stabilize, small batches update often.",
    "总训练轮数": "Total training epochs",
    "设置完成多少个step后保存一次模型权重": "Save model weights every N completed steps.",
    "为每个 prompt 生成的 response 数量，也即 GRPO 中的 group size。": "Responses generated per prompt—the GRPO group size.",
    "🎯 训练过程": "🎯 Training",
    "当前轮数": "Current Epoch",
    "当前奖励": "Current Reward",
    "当前损失": "Current Loss",
    "平均奖励": "Average Reward",
    "训练日志": "Training Log",
    "[系统] 等待开始训练...": "[System] Waiting to start training...",
    "📈 训练结果": "📈 Results",
    "最终奖励": "Final Reward",
    "训练轮数": "Training Epochs",
    "效率": "Efficiency",
    "平均损失": "Average Loss",
    "Reward 曲线": "Reward Curve",
    "Loss 曲线": "Loss Curve",
    "训练总结": "Training Summary",
    "训练完成！模型性能已达到预期目标。": "Training complete! Model performance meets expectations.",
    "重新训练": "Retrain",
    "🎭 效果体验": "🎭 Experience",
    "预设问题选择": "Preset Questions",
    "选择一个问题，查看基础模型和增强模型的回答差异": "Pick a question to compare base vs. enhanced model answers.",
    "Base Model - 训练前": "Base Model - Before Training",
    "Enhanced Model - 训练后": "Enhanced Model - After Training",
    "请选择一个问题开始体验": "Select a question to start",
    "返回结果": "Back to Results",
    "完成演示": "Finish Demo",
    "训练正在进行中，确定要返回吗？": "Training is in progress. Leave anyway?",
    "开始训练，总轮数: ${totalEpisodes}, 每轮包含 ${STEPS_PER_EPISODE} 个step, 总训练次数: ${totalSteps}": "Starting training: ${totalEpisodes} epochs, ${STEPS_PER_EPISODE} steps each, ${totalSteps} total iterations",
    "学习率: ${learningRate}": "Learning rate: ${learningRate}",
    "数据集: ${datasetName}": "Dataset: ${datasetName}",
    "轮次 ${currentEpisode}/${totalEpisodes}: 得分=${episodeReward.toFixed(2)}, Loss=${episodeLoss.toFixed(4)}": "Epoch ${currentEpisode}/${totalEpisodes}: score=${episodeReward.toFixed(2)}, loss=${episodeLoss.toFixed(4)}",
    "训练完成！共完成 ${totalEpisodes} 轮训练, 总计 ${totalSteps} 次迭代": "Training complete! ${totalEpisodes} epochs, ${totalSteps} total iterations",
    "高效率": "High efficiency",
    "训练完成！": "Training complete!",
    "模型经过 ${trainingData.episodes.length} 轮训练，性能显著提升：": "After ${trainingData.episodes.length} epochs, performance improved significantly:",
    "奖励从 ${initialReward.toFixed(2)} 提升到 ${finalReward.toFixed(2)}，提升了 ${rewardImprovement}%": "Reward rose from ${initialReward.toFixed(2)} to ${finalReward.toFixed(2)} (+${rewardImprovement}%)",
    "损失从 ${initialLoss.toFixed(4)} 降低到 ${finalLoss.toFixed(4)}，降低了 ${lossReduction}%": "Loss fell from ${initialLoss.toFixed(4)} to ${finalLoss.toFixed(4)} (-${lossReduction}%)",
    "平均最终奖励: ${(trainingData.avgRewards[trainingData.avgRewards.length - 1] || 0).toFixed(2)}": "Mean final reward: ${(trainingData.avgRewards[trainingData.avgRewards.length - 1] || 0).toFixed(2)}",
    "模型训练成功，可以部署使用。": "Training succeeded—ready to deploy.",
    "${datasetName} - 前10条数据": "${datasetName} - first 10 rows",
    "${baseModelName} - 训练前": "${baseModelName} - before training",
    "${baseModelName} - 训练后": "${baseModelName} - after training",
    "请先进行模型训练后再进行效果对比": "Run training before comparing model outputs.",
    "用户提问": "User",
    "模型回答": "Model",
    "✓ 正确答案:": "✓ Correct answer:",
    "强化学习训练流程Demo已加载": "RL training demo loaded",
    # mock datasets - insurance
    "请问车险理赔需要哪些材料？": "What documents are needed for auto insurance claims?",
    "车险理赔通常需要：保险单正本、索赔申请书、交通事故责任认定书、车辆修理发票、损失清单等。": "Typically: policy, claim form, accident liability report, repair invoice, loss list, etc.",
    "意外险包含医疗费用吗？": "Does accident insurance cover medical expenses?",
    "大部分意外险包含意外医疗费用报销，具体保额和免赔额请参照您的保险合同条款。": "Most policies include accidental medical reimbursement—see your policy for limits and deductibles.",
    "重疾险等待期是多长时间？": "How long is the critical illness waiting period?",
    "重疾险的等待期通常为90天或180天，等待期内确诊疾病一般不赔付，具体视产品而定。": "Usually 90 or 180 days; claims during waiting period are generally excluded—product-specific.",
    "寿险受益人可以指定吗？": "Can life insurance beneficiaries be designated?",
    "可以。投保人或者被保险人可以指定一人或者数人为身故保险金受益人。": "Yes. The policyholder or insured may designate one or more death benefit beneficiaries.",
    "家财险保什么？": "What does home property insurance cover?",
    "家庭财产保险主要保障房屋主体、室内装修、以及室内财产（如家电、家具）因火灾、爆炸等造成的损失。": "Covers structure, interior finishes, and contents (appliances, furniture) from fire, explosion, etc.",
    "保险犹豫期是多久？": "How long is the insurance cooling-off period?",
    "长期保险通常有10-15天的犹豫期，犹豫期内退保可全额退还保费（扣除工本费）。": "Long-term policies often have 10–15 days; full premium refund minus fees if cancelled in period.",
    "社保断缴会有影响吗？": "Does a gap in social insurance payments matter?",
    "社保断缴可能会影响医保报销待遇和养老金领取年限，建议连续缴纳。": "Gaps may affect medical reimbursement and pension eligibility—continuous payment is advised.",
    "如何查询保单状态？": "How do I check policy status?",
    "您可以通过保险公司官方APP、微信公众号或拨打客服热线查询保单状态。": "Use the insurer app, WeChat official account, or customer service hotline.",
    "医疗险有免赔额吗？": "Do medical policies have deductibles?",
    "百万医疗险通常有1万元免赔额，超过免赔额的部分才能报销；小额医疗险免赔额较低或无免赔额。": "Major medical often has ¥10k deductible; minor medical may have lower or none.",
    "投保人豁免是什么？": "What is policyholder waiver of premium?",
    "投保人豁免是指如果投保人发生合同约定的风险（如身故、重疾），可以免交后续保费，保障继续有效。": "If the policyholder hits covered events (death, critical illness), future premiums are waived while coverage continues.",
    # education
    "什么是牛顿第一定律？": "What is Newton's first law?",
    "牛顿第一定律，又称惯性定律，指一切物体在没有受到外力作用的时候，总保持匀速直线运动状态或静止状态。": "Newton's first law (inertia): objects stay at rest or uniform motion unless acted on by a force.",
    "如何提高英语听力？": "How to improve English listening?",
    "提高英语听力可以通过多听英文广播、看英文电影、跟读模仿以及进行专门的精听练习来实现。": "Listen to broadcasts, watch films, shadow speech, and do focused listening drills.",
    "勾股定理公式是什么？": "What is the Pythagorean theorem?",
    "勾股定理公式为 a² + b² = c²，其中a和b是直角三角形的两条直角边，c是斜边。": "a² + b² = c² where a and b are legs and c is the hypotenuse.",
    "光合作用的意义是什么？": "Why is photosynthesis important?",
    "光合作用是制造有机物的主要途径，是生物界获取能量的根本来源，同时还维持了大气中的碳氧平衡。": "It builds organic matter, powers ecosystems, and balances atmospheric CO₂/O₂.",
    "《红楼梦》的作者是谁？": "Who wrote Dream of the Red Chamber?",
    "《红楼梦》的作者一般认为是曹雪芹，后四十回通常认为是高鹗所续。": "Generally attributed to Cao Xueqin; the last 40 chapters often credited to Gao E.",
    "什么是微积分？": "What is calculus?",
    "微积分是研究函数的微分、积分以及有关概念和应用的数学分支，它是高等数学的基础。": "Calculus studies derivatives, integrals, and applications—foundation of advanced math.",
    "如何制定学习计划？": "How to make a study plan?",
    "制定学习计划应明确目标、分解任务、合理安排时间，并坚持执行与定期复盘。": "Set goals, break tasks down, schedule time, execute consistently, and review regularly.",
    "二战结束于哪一年？": "When did WWII end?",
    "第二次世界大战于1945年结束。": "World War II ended in 1945.",
    "什么是元素周期表？": "What is the periodic table?",
    "元素周期表是根据原子序数从小到大排序的化学元素列表，揭示了元素性质的周期性变化规律。": "Elements ordered by atomic number showing periodic property trends.",
    "如何培养孩子的阅读兴趣？": "How to foster children's reading interest?",
    "可以通过亲子共读、营造家庭阅读氛围、让孩子自主选择感兴趣的书籍等方式培养阅读兴趣。": "Shared reading, a reading-friendly home, and letting kids choose books they like.",
    # securities
    "什么是市盈率（PE）？": "What is P/E ratio?",
    "市盈率是指股票价格除以每股收益的比率，通常用来衡量股票的投资价值及风险。": "Price divided by earnings per share—a common valuation metric.",
    "牛市和熊市有什么区别？": "What's the difference between bull and bear markets?",
    "牛市指证券市场行情普遍看涨，延续时间较长的大升市；熊市则指行情普遍看淡，延续时间较长的大跌市。": "Bull: prolonged rising market; bear: prolonged declining market.",
    "什么是K线图？": "What is a candlestick chart?",
    "K线图又称蜡烛图，记录了股票一天的开盘价、收盘价、最高价和最低价，是技术分析的基础工具。": "Candlesticks show open, close, high, low—core technical analysis tool.",
    "如何开通股票账户？": "How to open a brokerage account?",
    "开通股票账户需要准备身份证和银行卡，通过券商的APP或营业部现场办理开户手续。": "ID and bank card; apply via broker app or branch.",
    "什么是ETF？": "What is an ETF?",
    "ETF（交易型开放式指数基金）是一种在交易所上市交易的、基金份额可变的一种开放式基金。": "Exchange-traded open-end index fund with variable shares.",
    "什么是止损？": "What is a stop-loss?",
    "止损是指当某一投资出现的亏损达到预定数额时，及时斩仓出局，以避免形成更大的亏损。": "Exit when loss hits a preset threshold to limit further damage.",
    "分红派息对股价有影响吗？": "Do dividends affect share price?",
    "分红派息后，股价通常会进行除权除息处理，导致股价下调，但投资者总资产（股票+现金）理论上不变。": "Ex-dividend adjustment lowers price; total wealth (shares + cash) is theoretically unchanged.",
    "什么是IPO？": "What is an IPO?",
    "IPO（Initial Public Offering）即首次公开募股，指企业第一次通过证券交易所向公众公开发行股票。": "Initial public offering—the first public sale of company shares.",
    "如何分析基本面？": "How to analyze fundamentals?",
    "基本面分析主要关注公司的财务状况、盈利能力、行业地位、宏观经济环境等因素。": "Focus on financials, profitability, industry position, and macro context.",
    "什么是换手率？": "What is turnover rate?",
    "换手率是指在一定时间内市场中股票转手买卖的频率，是反映股票流通性强弱的指标之一。": "How often shares trade—liquidity indicator.",
    # base model wrong answers
    "保险理赔需要身份证和银行卡。": "Claims only need ID and bank card.",
    "意外险不包含医疗费用。": "Accident insurance excludes medical costs.",
    "重疾险等待期是30天。": "Critical illness waiting period is 30 days.",
    "寿险受益人不能指定。": "Beneficiaries cannot be designated.",
    "家财险只保房屋。": "Home insurance covers the building only.",
    "保险没有犹豫期。": "There is no cooling-off period.",
    "社保断缴没有影响。": "Payment gaps have no effect.",
    "只能去线下查询保单。": "Policies can only be checked in person.",
    "医疗险没有免赔额。": "Medical insurance has no deductible.",
    "投保人豁免是免费的。": "Premium waiver is free.",
    "牛顿第一定律是关于运动的定律。": "Newton's first law is about motion.",
    "多听音乐就能提高听力。": "Listening to more music improves listening.",
    "勾股定理是a+b=c。": "Pythagorean theorem is a+b=c.",
    "光合作用是植物生长。": "Photosynthesis is plant growth.",
    "《红楼梦》作者是鲁迅。": "Dream of the Red Chamber was written by Lu Xun.",
    "微积分是数学计算。": "Calculus is math calculation.",
    "学习计划就是多做题。": "A study plan means doing more exercises.",
    "二战结束于1999年。": "WWII ended in 1999.",
    "元素周期表是化学表格。": "The periodic table is a chemistry table.",
    "给孩子多买书就能培养兴趣。": "Buying more books builds reading interest.",
    "市盈率是股票价格。": "P/E is the stock price.",
    "牛市和熊市是一样的。": "Bull and bear markets are the same.",
    "K线图是价格图表。": "Candlesticks are price charts.",
    "股票账户不需要身份证。": "No ID needed for a brokerage account.",
    "ETF是股票基金。": "ETF is a stock fund.",
    "止损是继续持有。": "Stop-loss means keep holding.",
    "分红派息不改变股价。": "Dividends don't change share price.",
    "IPO是首次发行。": "IPO is first issuance.",
    "基本面就是看公司名字。": "Fundamentals means looking at the company name.",
    "换手率是交易次数。": "Turnover is number of trades.",
    "增强模型": "Enhanced Model",
    "学习率(actor_rollout_ref.actor.optim.lr)": "Learning rate (actor_rollout_ref.actor.optim.lr)",
    "单次训练Batch size(data.train_batch_size)": "Training batch size (data.train_batch_size)",
    "训练总轮数(trainer.total_epochs)": "Total epochs (trainer.total_epochs)",
    "模型权重保存频率(trainer.save_freq)": "Model save frequency (trainer.save_freq)",
    "每问题推理生成答案数量(actor_rollout_ref.rollout.n)": "Responses per prompt (actor_rollout_ref.rollout.n)",
}

RACK_JSON = SCRIPTS / "rack_view_translations.json"
RACK_VIEW = {**COMMON_NAV, **json.loads(RACK_JSON.read_text(encoding="utf-8"))}
RACK_VIEW["'Microsoft YaHei','微软雅黑',Arial,sans-serif"] = (
    "'Segoe UI',-apple-system,BlinkMacSystemFont,Arial,sans-serif"
)


def build(name: str, mapping: dict | None = None, nav_mode: str = "nav") -> str:
    src = ROOT / name
    if not src.exists():
        raise FileNotFoundError(name)
    text = src.read_text(encoding="utf-8")
    text = fix_assets(text)
    if mapping:
        text = apply_translations(text, mapping)
    text = inject_lang_switch(text, nav_mode)
    return text


def main() -> None:
    EN.mkdir(exist_ok=True)
    jobs = [
        ("docs.html", DOCS, "nav"),
        ("capacity.html", CAPACITY, "nav"),
        ("post-training.html", POST_TRAINING, "nav"),
    ]
    created = []
    for name, mapping, mode in jobs:
        out = EN / name
        out.write_text(build(name, mapping, mode), encoding="utf-8")
        created.append(name)
        print(f"Created {out}")

    # Verify remaining Chinese in user-visible areas
    for name in created:
        text = (EN / name).read_text(encoding="utf-8")
        remaining = len(re.findall(r"[\u4e00-\u9fff]", text))
        if remaining:
            print(f"  WARN {name}: {remaining} Chinese chars remain")


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
