# AIDC 基线代码检视（2026-09-16 · v2026.09.10 / build 88）

整改后全站重检。只读记录；已有自动化覆盖的标「已回归」。本轮重点：独立机房页、Topic、工期造价运维费率。

检视格式：严重度 · 位置 · 现象 · 建议测试层。

## 页面盘点（相对 2026-09-05）

规划容器 `ai-dc-design.html` 现为 **9 Tab**（不再内嵌供电/液冷/工期）：

- 仍 iframe：`roomLayout`、`roomLayout3d`、`tcp`、`computeEst`、`plan`→`aidc-layout-Card2Power.html`、`synergy`、`a`/`b`、`roi`
- 独立入口：`ai-dc-power.html`、`ai-dc-liquid-requirements.html`、`ai-dc-liquid-rack.html`、`ai-dc-schedule-budget.html`
- 旧 `?tab=power|liquidRack|liquidRequirements|scheduleBudget` 由 `STANDALONE_BY_TAB` **replace** 到独立 HTML

新增/升级：

- `ai-dc-room-layout-3d.html`：机房立体布局（WebGL）
- Topic：`topic.html` 目录、`white-paper-2024.html`、`topic-sovereign-ai.html` + 中英幻灯片 iframe
- `js/ai-dc-schedule-budget-model.js`：无 DOM 公式；年 OPEX = 年电费 + CAPEX×运维费率

`ai-dc-layout.html` 仍为旧地址入口（跳转/兼容）。幻灯片 `topic/sovereign-ai/*.html` 无站点壳，登记为 chromeless。

## 1. 鉴权与密钥

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | `api/settings.py` | 无默认 `ADMIN_TOKEN`。 | 单测 |
| 已回归 | 前端 | 禁止 `site.unlock_password`。 | 静态 |
| 中 | `status.html` | 路径可猜；生产应 Nginx 再挡一层。 | 浏览器门禁 |

## 2. 公式

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 高 | `js/ai-dc-schedule-budget-model.js` | 已抽纯函数；默认风冷 2.5% / 液冷 3% 运维。Python 黄金用例必须含运维，否则回收期会偏。 | 单测 `schedule_scenario(..., maintenance_rate)` |
| 高 | TCP / 算力 coding | 1024 档：12700×100%、Tuser 10M、M=3 N=45 K=1.2 → 1270 亿 Token/日、1024 卡、机房 2515 kW。 | 既有 TCP/computeEst 单测 |
| 中 | KV / ROI / PD | 仍在页面逻辑。 | 既有单测 + 浏览器 |
| 低 | Card2Power / 3D 几何 | 不做几何单测。 | 浏览器改参 |

## 3. 导航契约

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 高 | `STANDALONE_BY_TAB` | 独立页不得回到 `IFRAME_BASE`；mega-nav 必须直达 HTML。 | 静态 + `test_design_nav` |
| 中 | `roomLayout3d` | iframe 带 `rev=campus-row-3`；切 Tab 必须有场景或 WebGL 回退。 | 浏览器 |
| 中 | Topic | `data/topics.json` published 页必须存在；不得再链 `white-paper.html`。 | `test_topics.py` |
| 低 | `ai-dc-layout.html` | 兼容旧 URL。 | 打开后应落到 Card2Power |

## 4. i18n / 主题 / embed

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | TCP / 算力 / 机柜 / 后训练 | 页内 I18N 与 bundle 并存。 | `?lang=en` |
| 中 | 供电 / 液冷 / 立体 | WebGL；不可用时必须有回退文案。 | 浏览器 |
| 低 | 主权 AI 幻灯片 | 中英分文件；wrapper 切语言换 iframe，全屏走 Fullscreen API。 | 浏览器 |

## 5. 配置与 API

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | 六配置键 + PUT 409 + verify | 单测已有。 | pytest |
| 低 | 独立机房页 | 本机计算/展示，不依赖 API。 | 断 8012 仍可开 |

## 6. 部署

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | `check-site.py` | JSON、注册表、密钥、exclude、CI。 | 静态 |
| 中 | 新 HTML/JS/CSS/i18n | 必须在 rsync 范围内。 | 部署后 HTTP 200 |

## 本轮测试消化顺序

1. 独立页 redirect + mega-nav + registry kind=entry。
2. 工期造价黄金用例对齐运维费率。
3. 回归 TCP/算力/API/Topic。
4. 浏览器：9 Tab、独立四页、Topic、WebGL 回退、四态。
