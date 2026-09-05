# AIDC 基线代码检视（2026-09-05 · v2026.09.01 / build 84）

整改后全站重检。只读记录；已有自动化覆盖的标「已回归」。新页与新契约是本轮重点。

检视格式：严重度 · 位置 · 现象 · 建议测试层。

## 页面盘点（相对上一轮）

新增正式页：

- `ai-dc-tcp.html`（规划 Tab `tcp`）：Token → Card → Power 总览，页内预设 1024 液冷 / 768 风冷。
- `ai-dc-computeEst.html`（规划 Tab `computeEst`）：算力卡数匡算，`calculate()` 在页内。
- `ai-dc-layout.html`：由跳转壳改为机柜规划子页（Tab `plan`）。

已下线：`capacity.html`、`docs.html`、`aidc-investment-roi.en.html`、`inference/index.html`、`ai-dc-layout_37.html`。

导航契约：[`js/ai-dc-design-page.js`](../js/ai-dc-design-page.js) 的 `VALID_TABS` 与 [`data/page-registry.json`](../data/page-registry.json) 必须一致；iframe 键 `caseA`/`caseB` 对应 URL tab `a`/`b`。

## 1. 鉴权与密钥

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | `api/settings.py` | 无默认 `ADMIN_TOKEN`；未配置时写接口 / analytics 503。 | 单测已有 |
| 已回归 | 前端 | 禁止 `site.unlock_password`；凭据走 `POST /api/admin/verify`。 | 静态 + 单测 404 |
| 中 | `status.html` | 路径可猜；生产应再加 Nginx `auth_basic`。 | 浏览器：无口令无数据 |
| 低 | `.gitignore` | `.env` / `deploy.env` 已忽略。 | 不必测 |

## 2. 公式

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 高 | `ai-dc-computeEst.html` `calculate()` | Token→卡数、显存下限、逐年放大均在页内，此前无黄金用例。口径：`N` 为利用率百分比；`n_card = max(n_compute, n_min)`。 | 单测：与 TCP 1024 档默认日 Token / 卡数对齐 |
| 高 | `ai-dc-tcp.html` `COMMON` + `SC` | 总览用预计算刻度，应与算力页默认公式同口径。1024 档：`DAU=3180`、渗透 60% → 日 Token `40640400000`、卡数 1024。 | 单测对照 `SC["1024"]` |
| 中 | `js/index-page.js` | KV / PD 仍在页面逻辑。 | 既有 KV 单测 + 浏览器 PD |
| 中 | `js/aidc-investment-roi-page.js` | mix / 云价已有单测；UI 耦合部分靠冒烟。 | 单测 + 浏览器 |
| 低 | `ai-dc-layout.html` | 机柜/功率以预设与反算为主，几何不做单测。 | 浏览器：改卡数/功率后平面更新 |

## 3. 配置与 API

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | `ALLOWED_CONFIG_KEYS` | 仅 ROI / 3D 六键，与种子对齐。 | 静态 |
| 已回归 | PUT | 需 Bearer + `expected_version`；冲突 409。 | 单测已有 |
| 低 | TCP / 算力页 | 纯本机计算，不打 API；断网应仍可算。 | 浏览器 |
| 低 | `js/config-loader.js` | ROI/3D 失败回退本地，须标明来源。 | 浏览器 |

## 4. i18n

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | TCP / 算力 / 机柜 / 3D / 后训练 | 页内 `I18N` / lookup 与 `data-i18n` 并存，EN 易漏动态串。 | 静态键对齐 + `?lang=en` |
| 低 | `js/i18n.js` | 缺 key 回显路径。 | 浏览器抽查 |

## 5. 跨页状态

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | 规划容器 8 Tab | 新 Tab 切过去 iframe 必须有内容；`?tab=tcp` / `?tab=computeEst` 直达。 | 浏览器 |
| 中 | 主题 / 语言 | iframe postMessage，禁止整页重载。 | 浏览器四态 |
| 低 | `?embed=1` | 新子页须去 chrome。 | 浏览器 |

## 6. 部署与协作

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已回归 | `check-site.py` | JSON、引用、注册表、密钥、API 客户端、exclude、CI。 | 静态 + CI |
| 中 | exclude | 两处手写，靠检查对齐。 | 静态 |
| 低 | CSP | 仍 Report-Only + `unsafe-inline`/`unsafe-eval`。 | 运维，本轮不测 |

## 7. 大页

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 低 | `datacenter-3d-*.html` | `case-b` 文件对应展示「案例 A」。 | 目视 |
| 中 | analytics IP | 展示脱敏，入库策略仍待治理。 | 非本轮 |

## 本轮测试消化顺序

1. 规划导航契约（注册表 ↔ Tab ↔ iframe）。
2. TCP / 算力估算黄金用例（与 1024 档默认对齐）。
3. 浏览器：新 Tab + 直达 URL + 中英/主题 + embed。
4. 回归原有 KV / ROI / API 单测与入口冒烟。
