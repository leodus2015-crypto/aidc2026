#!/usr/bin/env python3
"""DEPRECATED: en/ 目录已移除。英文文案请维护 i18n/*.en.json。"""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EN_DIR = ROOT / "en"

TARGETS = [
    "datacenter-3d-case-b.html",
    "datacenter-3d-v3 2.html",
]

# Longest-first: complete phrases only (avoid atomic 保存/功率/卡/名称 that break compounds)
REPLACEMENTS: list[tuple[str, str]] = sorted([
    # ── Page titles ──
    ("DataCenter 3D 设计器 · 案例A（风冷超节点）", "DataCenter 3D Designer · Case A (Air-Cooled Supernode)"),
    ("DataCenter 3D 设计器 · 案例B（风冷超节点）", "DataCenter 3D Designer · Case B (Air-Cooled Supernode)"),
    ("案例A（风冷超节点） · 数据中心 3D 设计器", "Case A (Air-Cooled Supernode) · Data Center 3D Designer"),
    ("案例B（风冷超节点） · 数据中心 3D 设计器", "Case B (Air-Cooled Supernode) · Data Center 3D Designer"),
    ("案例A（风冷超节点）", "Case A (Air-Cooled Supernode)"),
    ("案例B（风冷超节点）", "Case B (Air-Cooled Supernode)"),
    ("AI数据中心·<span>风冷超节点新建方案</span>", "AI Data Center · <span>Air-Cooled Supernode Greenfield Plan</span>"),
    ("AI数据中心·风冷超节点新建方案", "AI Data Center · Air-Cooled Supernode Greenfield Plan"),
    # ── Config / dialogs ──
    ("配置来源：加载中…", "Config source: loading…"),
    ("配置来源：本地缓存", "Config source: local cache"),
    ("配置来源：云数据库", "Config source: cloud database"),
    ("配置来源：本地默认", "Config source: local defaults"),
    ("输入访问密码", "Enter access password"),
    ("解锁布局或规则需验证身份（不区分大小写）。", "Unlock layout or rules after verification (case-insensitive)."),
    ("密码错误，请重试。", "Incorrect password. Try again."),
    ("确定要执行此操作吗？", "Are you sure you want to proceed?"),
    ("placeholder=\"密码\"", 'placeholder="Password"'),
    # ── Topbar / sidebar ──
    ("俯视", "Top"), ("水平", "Side"), ("透视", "Perspective"),
    ("类型", "Type"), ("功率", "Power"),
    ("📐 布局", "📐 Layout"), ("📋 规则", "📋 Rules"), ("👁 视图", "👁 Views"),
    ("机房结构", "Room layout"), ("排数", "Rows"), ("每排机柜数", "Racks per row"),
    ("冷通道 (m)", "Cold aisle (m)"), ("热通道 (m)", "Hot aisle (m)"),
    ("机柜深度 (m)", "Rack depth (m)"), ("机柜高度 (U)", "Rack height (U)"),
    ("机柜尺寸", "Rack dimensions"), ("宽度 (m)", "Width (m)"), ("深度 (m)", "Depth (m)"),
    ("1U 高 (mm)", "1U height (mm)"), ("机柜功耗", "Rack power"),
    ("总线 (W)", "Bus (W)"), ("空机柜 (W)", "Empty rack (W)"),
    ("✓ 更新布局", "✓ Apply layout"),
    ("机柜类型分配规则", "Rack type assignment rules"),
    ("规则按顺序执行（从上到下），后执行的覆盖前面的冲突。<br>\n        规则中的行列号从 <strong>1</strong> 开始计数。",
     "Rules run top to bottom; later rules override conflicts.<br>\n        Row and column numbers in rules are <strong>1</strong>-indexed."),
    ('placeholder=\'例: "3-6" 或 "1-7:2" 或 "1,3,5,7"\'', 'placeholder=\'e.g. "3-6", "1-7:2", or "1,3,5,7"\''),
    ('placeholder=\'例: "1" 或 "4,7,10"\'', 'placeholder=\'e.g. "1" or "4,7,10"\''),
    ("行号范围", "Row range"), ("列号范围", "Column range"),
    ('行号从 1 开始，如 "3-6" 表示第 3~6 排', 'Rows are 1-indexed; e.g. "3-6" means rows 3–6'),
    ('列号从 1 开始，如 "1" 表示第 1 柜', 'Columns are 1-indexed; e.g. "1" means rack 1'),
    ("AI 设备柜", "AI equipment rack"), ("总线交换机柜", "Bus switch rack"), ("Leaf交换机", "Leaf switch"),
    ("规则名称", "Rule name"), ("✓ 更新", "✓ Update"),
    ("支持格式: <code>开始-结束</code>、<code>开始-结束:步长</code> 或 <code>值1,值2,值3</code>",
     "Supported: <code>start-end</code>, <code>start-end:step</code>, or <code>v1,v2,v3</code>"),
    ("+ 添加规则", "+ Add rule"),
    ("已保存视角", "Saved views"), ("视角名称", "View name"),
    ("排过滤器", "Row filter"), ("只显示", "Show only"), ("全部显示", "Show all"),
    ("操作", "Actions"), ("聚焦", "Focus"), ("清除", "Clear"), ("↺ 重置相机", "↺ Reset camera"),
    ("解锁", "Unlock"), ("已解锁", "Unlocked"), ("提交", "Submit"), ("保存", "Save"),
    ("取消", "Cancel"), ("确认", "Confirm"), ("确定", "OK"), ("恢复", "Restore"),
    # ── Default rules Case A ──
    ("总线柜 (第3-6排, 第1柜)", "Bus racks (rows 3–6, rack 1)"),
    ("AI 奇数排 (1,3,5,7)", "AI odd rows (1,3,5,7)"),
    ("AI 偶数排 (2,4,6,8)", "AI even rows (2,4,6,8)"),
    ("Leaf交换机", "Leaf switch"),
    # ── JS toasts / UI strings (DC3D) ──
    ("已恢复上次的配置", "Restored previous configuration"),
    ("已加载云端配置", "Loaded cloud configuration"),
    ("布局参数已解锁", "Layout parameters unlocked"),
    ("布局已更新并保存", "Layout updated and saved"),
    ("规则已解锁", "Rules unlocked"),
    ("规则已提交并保存", "Rules submitted and saved"),
    ("规则已启用", "Rule enabled"), ("规则已禁用", "Rule disabled"),
    ("规则已删除", "Rule deleted"), ("规则已更新", "Rule updated"),
    ("规则已添加", "Rule added"),
    ("规则已保存，请点击提交锁定", "Rule saved — click Submit to lock"),
    ("请填写行和列范围", "Enter row and column ranges"),
    ("暂未添加规则，所有机柜默认为空机柜。<br>点击下方\"+ 添加规则\"创建。",
     "No rules yet — all racks default to empty.<br>Click \"+ Add rule\" below to create one."),
    ("暂无已保存视角", "No saved views yet"), ("未命名规则", "Unnamed rule"),
    ("AI 机柜", "AI rack"), ("总线机柜", "Bus rack"), ("空机柜", "Empty rack"),
    ("🔵 AI 设备", "🔵 AI equipment"), ("🟢 总线柜", "🟢 Bus rack"), ("🟡 Leaf交换机", "🟡 Leaf switch"),
    ("AI 与 Leaf交换机共用此机柜", "AI and Leaf switch share this rack"),
    ("多种设备规则叠加，共用此机柜", "Multiple device rules overlap on this rack"),
    ("热通道=", "Hot aisle="), ("冷通道=", "Cold aisle="),
    ("总长度=", "Total depth="),
    ("`总宽度 = ${cols}柜 × ${rackW}m = ${totalW.toFixed(1)}m`",
     "`Total width = ${cols} racks × ${rackW}m = ${totalW.toFixed(1)}m`"),
    ("`排 ${ud.row + 1} · 第 ${ud.col + 1} 柜`", "`Row ${ud.row + 1} · Rack ${ud.col + 1}`"),
    ("`排 ${r + 1}`", "`Row ${r + 1}`"),
    ("`第 ${rule.rows} 排 → 第 ${rule.cols} 柜 → ${types[rule.type]}`",
     "`Rows ${rule.rows} → Cols ${rule.cols} → ${types[rule.type]}`"),
    ("`规则 ${store.rules.length + 1}`", "`Rule ${store.rules.length + 1}`"),
    ("`视角 ${store.savedViews.length + 1}`", "`View ${store.savedViews.length + 1}`"),
    ("`已恢复视角「${v.name}」`", "`Restored view \"${v.name}\"`"),
    ("`视角「${name}」已保存`", "`View \"${name}\" saved`"),
    ("合计 ", "Total "),
    (" · 第 ", " · Rack "),
    (" 柜", " racks"),
    ("排 ", "Row "),
    ("DataCenter 3D Designer v2 · 案例A（风冷超节点） 已启动",
     "DataCenter 3D Designer v2 · Case A (Air-Cooled Supernode) started"),
    ("DataCenter 3D Designer v2 已启动", "DataCenter 3D Designer v2 started"),
    ("• 鼠标左键旋转 | 滚轮缩放 | 右键平移", "• Left-drag rotate | Scroll zoom | Right-drag pan"),
    ("• 悬停查看机柜信息", "• Hover racks for details"),
    ("• 配置自动保存到 localStorage", "• Configuration auto-saved to localStorage"),
    # ── aidc-calculation.html ──
    ("建筑层高", "Floor height"), ("楼板承重", "Floor load"),
    ("制冷方式", "Cooling method"), ("建设场景", "Build type"),
    ("风 冷", "Air-cooled"), ("新 建", "Greenfield"),
    ("64 卡", "64 cards"), ("128 卡", "128 cards"), ("256 卡", "256 cards"),
    ("512 卡", "512 cards"), ("1024 卡", "1024 cards"),
    ("按总设计功率反算 →", "Reverse-calc from design power →"),
    ("功率反算结果", "Power reverse-calculation result"),
    ("NPU 卡数", "NPU cards"), ("AI 加速卡", "AI accelerator cards"),
    ("总柜数", "Total racks"), ("设计功率", "Design power"),
    ("全机房总功率", "Total room power"), ("配电方案", "Power distribution"),
    ("冗余架构", "Redundancy"), ("机房面积", "Room area"),
    ("净机房面积", "Net white space"), ("制冷配置", "Cooling"),
    ("个微模块", " micro-modules"), (" 配电", " distribution"),
    ("机柜组成", "Cabinet breakdown"),
    ("智算柜", "AI compute rack"), ("通算柜", "General compute rack"),
    ("总线柜", "Bus rack"), ("网络柜", "Network rack"),
    ("列间空调柜", "In-row AC rack"), ("冷冻水风墙", "Chilled-water fan wall"),
    ("20 kW/柜 · NPU服务器（昇腾）", "20 kW/rack · NPU servers (Ascend)"),
    ("15 kW/柜 · CPU服务器", "15 kW/rack · CPU servers"),
    ("12 kW/柜 · 灵衢总线全对等高速互联", "12 kW/rack · Lingqu bus full-mesh interconnect"),
    ("12 kW/柜 · 参数面交换机·超节点间互联", "12 kW/rack · Parameter-plane switch · supernode interconnect"),
    ("N+2冗余设计 · 行级精密制冷", "N+2 redundancy · row-level precision cooling"),
    ("远端冷冻水制冷·热通道端墙", "Remote chilled water · hot-aisle end wall"),
    ("功率构成", "Power breakdown"), ("总计", "Total"),
    ("机房平面俯视示意", "Room floor plan (top view)"),
    ("智算柜（NPU）", "AI rack (NPU)"), ("通算柜（CPU）", "General compute (CPU)"),
    ("总线柜（灵衢）", "Bus rack (Lingqu)"), ("网络柜（参数面）", "Network rack (parameter plane)"),
    ("列间空调", "In-row AC"), ("列间空调(N+2)", "In-row AC (N+2)"),
    ("热通道", "Hot aisle"), ("密封热通道", "Sealed hot aisle"),
    ("密封冷通道", "Sealed cold aisle"),
    ("冷冻水风墙/端墙", "Chilled-water fan wall / end wall"),
    ("制冷截面示意（动态）", "Cooling cross-section (animated)"),
    ("列间空调 N+2", "In-row AC N+2"),
    ("冷冻水风墙（热通道端墙）", "Chilled-water fan wall (hot-aisle end wall)"),
    ("供电架构示意", "Power distribution diagram"),
    ("2N 配电", "2N distribution"), ("1个微模块", "1 micro-module"),
    ("8智算+7通算+1总线", "8 AI + 7 general + 1 bus"),
    ("2N双路冗余", "2N dual-path redundancy"),
    ("3DR三路设计", "3DR three-path design"),
    ("4DT四路冗余", "4DT four-path redundancy"),
    ("冷侧", "Cold side"), ("← 密封热通道 →", "← Sealed hot aisle →"),
    ("← 密封冷通道 →", "← Sealed cold aisle →"),
    ("开放热通道", "Open hot aisle"), ("热回风管", "Hot return plenum"),
    ("供冷水→", "Chilled supply →"), ("←回水", "← Return"),
    ("热进", "Hot in"), ("冷出", "Cold out"), ("热通道端墙", "Hot-aisle end wall"),
    ("面对面部署 · 列间空调入列", "Face-to-face · in-row AC in rack row"),
    (" ㎡", " m²"), ("㎡", " m²"),
    # CFG notes (full blocks)
    ("2排机柜·1个微模块·列间空调 N+2 共6柜\\n智算8台（8NPU/台）×20kW=160kW | 通算7台×15kW=105kW | 灵衢总线1台×12kW=12kW",
     "2 rack rows · 1 micro-module · 6 in-row AC (N+2)\\n8 AI racks (8 NPU each) ×20kW=160kW | 7 general ×15kW=105kW | 1 bus ×12kW=12kW"),
    ("2排机柜·1个微模块·列间空调 N+2 共10柜\\n智算16台（8NPU/台）×20kW=320kW | 通算6台×15kW=90kW | 灵衢总线2台×12kW=24kW",
     "2 rack rows · 1 micro-module · 10 in-row AC (N+2)\\n16 AI racks (8 NPU each) ×20kW=320kW | 6 general ×15kW=90kW | 2 bus ×12kW=24kW"),
    ("2排机柜·2个微模块·列间空调 N+2 共20柜\\n智算32台（8NPU/台）×20kW=640kW | 通算8台×15kW=120kW | 灵衢总线4台×12kW=48kW",
     "2 rack rows · 2 micro-modules · 20 in-row AC (N+2)\\n32 AI racks (8 NPU each) ×20kW=640kW | 8 general ×15kW=120kW | 4 bus ×12kW=48kW"),
    ("2排机柜·4个微模块·远端冷冻水风墙（热通道端墙）· 620㎡\\n配电：3DR或2N可选 | 风墙作为封闭热通道端墙\\n智算64台×20kW=1280kW | 通算16台×15kW=240kW | 总线8台×12kW=96kW",
     "2 rack rows · 4 micro-modules · remote chilled-water fan wall (hot-aisle end) · 620 m²\\nPower: 3DR or 2N optional | Fan wall as sealed hot-aisle end\\n64 AI ×20kW=1280kW | 16 general ×15kW=240kW | 8 bus ×12kW=96kW"),
    ("2排机柜·8个微模块·远端冷冻水风墙（热通道端墙）·4DT配电·1240㎡\\n智算128台×20kW=2560kW | 通算32台×15kW=480kW\\n灵衢总线16台×12kW=192kW | 参数面网络柜16台×12kW=192kW\\n每微模块24柜（16AI+4通+2总+2网）· 每排12柜 · 完全对称",
     "2 rack rows · 8 micro-modules · remote fan wall (hot-aisle end) · 4DT power · 1240 m²\\n128 AI ×20kW=2560kW | 32 general ×15kW=480kW\\n16 bus ×12kW=192kW | 16 parameter-plane network ×12kW=192kW\\n24 racks/micro-module (16 AI + 4 gen + 2 bus + 2 net) · 12/rack row · symmetric"),
    # Dynamic JS (aidc-calculation)
    ("${c.ai}智算+${c.cmp}通算+${c.bus}总线${c.net?'+'+c.net+'网络':''}",
     "${c.ai} AI + ${c.cmp} general + ${c.bus} bus${c.net?'+'+c.net+' net':''}"),
    ("列间空调×${c.acN}", "In-row AC ×${c.acN}"),
    ("${c.mods}个微模块 · ${c.mods*2}排机柜 · 密封冷通道 · 标准柜600×1000×1867mm(42U)",
     "${c.mods} micro-modules · ${c.mods*2} rack rows · sealed cold aisle · standard 600×1000×1867mm (42U)"),
    ("`AI ${aiP}kW`", "`AI ${aiP} kW`"), ("`通 ${cmpP}kW`", "`Gen ${cmpP} kW`"),
    ("`总 ${busP}kW`", "`Bus ${busP} kW`"),
    ("`按设计功率 ${pMW} MW 反算 — NPU集群规模`",
     "`Reverse-calculated from ${pMW} MW design power — NPU cluster scale`"),
    ("`IT负荷：${itPwr>=1000?(itPwr/1000).toFixed(2)+'MW':itPwr+'kW'} · 利用率${util}%\\n`",
     "`IT load: ${itPwr>=1000?(itPwr/1000).toFixed(2)+'MW':itPwr+'kW'} · utilization ${util}%\\n`"),
    ("`制冷：${vt.acT==='wall'?'冷冻水风墙（≥700kW选用）':'列间空调N+2'} · ${vt.mods}个微模块\\n`",
     "`Cooling: ${vt.acT==='wall'?'Chilled-water fan wall (≥700 kW)':'In-row AC N+2'} · ${vt.mods} micro-modules\\n`"),
    ("`配电：${vt.pduType} · 面积约${vt.area}㎡`", "`Power: ${vt.pduType} · ~${vt.area} m²`"),
    ("`按${pMW}MW设计功率反算 · ${npu} NPU\\n${total}柜（${aiCabs}智算+${cmpCabs}通算+${busCabs}总线）·${vt.mods}个微模块\\n`",
     "`Reverse-calculated from ${pMW} MW · ${npu} NPU\\n${total} racks (${aiCabs} AI + ${cmpCabs} general + ${busCabs} bus) · ${vt.mods} micro-modules\\n`"),
    ("`${vt.acT==='wall'?'冷冻水风墙方案（热通道端墙）':'列间空调N+2方案'} · 面积约${vt.area}㎡\\n`",
     "`${vt.acT==='wall'?'Chilled-water fan wall (hot-aisle end)':'In-row AC N+2'} · ~${vt.area} m²\\n`"),
    ("`智算${aiCabs}台×20kW=${aiCabs*20}kW | 通算${cmpCabs}台×15kW=${cmpCabs*15}kW | 总线${busCabs}台×12kW=${busCabs*12}kW\\n`",
     "`${aiCabs} AI ×20kW=${aiCabs*20}kW | ${cmpCabs} general ×15kW=${cmpCabs*15}kW | ${busCabs} bus ×12kW=${busCabs*12}kW\\n`"),
    ("`IT负荷：${itPwr}kW（设计功率利用率${util}%）`",
     "`IT load: ${itPwr} kW (design power utilization ${util}%)`"),
    ("${Math.ceil(c.total/c.mods)}柜", "${Math.ceil(c.total/c.mods)} racks"),
    ("`共${c.mods}模块`", "`${c.mods} modules total`"),
    ("`⚡ ${ps.desc} · 总功率 ${c.pwr>=1000?(c.pwr/1000).toFixed(1)+'MW':c.pwr+'kW'} · ${c.mods}个微模块`",
     "`⚡ ${ps.desc} · Total ${c.pwr>=1000?(c.pwr/1000).toFixed(1)+'MW':c.pwr+'kW'} · ${c.mods} micro-modules`"),
    ("$('m-cards',c.cards+' 卡')", "$('m-cards',c.cards+' cards')"),
    ("$('m-cabs',c.total+' 柜')", "$('m-cabs',c.total+' racks')"),
    ('<label class="sbf-label" style="font-size:9px;">名称</label>', '<label class="sbf-label" style="font-size:9px;">Name</label>'),
    ("第 ${rule.rows} Row → 第 ${rule.cols} racks → ${types[rule.type]}", "Rows ${rule.rows} → Cols ${rule.cols} → ${types[rule.type]}"),
    ("'N+2冗余设计·行级精密制冷'", "'N+2 redundancy · row-level precision cooling'"),
    ("isW?'风墙':c.acN", "isW?'Fan wall':c.acN"),
    ("'← Sealed cold aisle →':'冷通道'", "'← Sealed cold aisle →':'Cold aisle'"),
    ("共${c.mods}模块", "${c.mods} modules total"),
    ("· 总Power ", "· Total power "),
], key=lambda x: -len(x[0]))

LANG_SWITCH_TOPBAR = '<div id="lang-switch-root" class="lang-switch-topbar"></div>\n  '
LANG_SWITCH_SCRIPT = """
<script src="../js/lang-switch.js"></script>
<script>AidcLangSwitch.mount(document.getElementById('lang-switch-root'));</script>
"""


def fix_asset_paths(html: str) -> str:
    def sub_attr(match: re.Match[str]) -> str:
        prefix, path, suffix = match.group(1), match.group(2), match.group(3)
        if path.startswith("../") or "://" in path or path.startswith("/"):
            return match.group(0)
        return f"{prefix}../{path}{suffix}"

    return re.sub(
        r'((?:href|src)=["\'])(?!https?:|#|mailto:|javascript:|\.\./|/)([^"\']+)(["\'])',
        sub_attr,
        html,
    )


def translate(text: str) -> str:
    for zh, en in REPLACEMENTS:
        text = text.replace(zh, en)
    text = text.replace('lang="zh-CN"', 'lang="en"')
    return text


def patch_dc3d(html: str) -> str:
    if 'id="lang-switch-root"' not in html:
        html = html.replace(
            '<button id="sidebar-toggle">',
            LANG_SWITCH_TOPBAR + '<button id="sidebar-toggle">',
            1,
        )
    if "AidcLangSwitch.mount" not in html:
        html = html.replace("</body>", LANG_SWITCH_SCRIPT + "</body>", 1)
    return html


def patch_calculation(html: str) -> str:
    if 'id="lang-switch-root"' not in html:
        html = html.replace(
            '<div class="hdr-badges">',
            '<div id="lang-switch-root" class="lang-switch-topbar" style="margin-left:auto"></div>\n  <div class="hdr-badges">',
            1,
        )
    if "AidcLangSwitch.mount" not in html:
        html = html.replace("</body>", LANG_SWITCH_SCRIPT + "</body>", 1)
    return html


def generate_one(name: str) -> None:
    src = ROOT / name
    dst = EN_DIR / name
    raw = src.read_text(encoding="utf-8")
    out = translate(raw)
    out = fix_asset_paths(out)
    if "sidebar-toggle" in out:
        out = patch_dc3d(out)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(out, encoding="utf-8")
    remaining = len(re.findall(r"[\u4e00-\u9fff]", out))
    print(f"✓ en/{name} ({remaining} CJK chars remaining)")


def main() -> int:
    for name in TARGETS:
        generate_one(name)
    return 0


if __name__ == "__main__":
    raise SystemExit("DEPRECATED: en/ 已移除，请直接编辑 i18n/*.en.json。")
