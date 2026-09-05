# AIDC 基线代码检视（2026-08-29）

只读检视，按风险模块记录。**本轮不顺手大改**；后续用静态检查 / 单测 / 浏览器冒烟消化。

检视格式：严重度 · 位置 · 现象 · 建议测试层。

## 1. 鉴权与密钥

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 已解决 | `api/settings.py`、`api/main.py` | `ADMIN_TOKEN` 无默认值；未配置时管理与 analytics 接口拒绝服务，并使用恒定时间比较。 | 单测：无 Bearer / 错 Bearer → 401 |
| 已解决 | `datacenter-3d-*.html`、`js/aidc-investment-roi-page.js` | 已删除公开的 `site.unlock_password`；浏览器输入凭据后由服务端验证，不再下载口令本身。 | 浏览器：错误口令与 API 不可用均不能解锁 |
| 中 | `status.html` | 管理口令与 `ADMIN_TOKEN` 相同，页面对外路径可猜。 | 浏览器：无口令看不到分析数据 |
| 低 | `.gitignore` | `.env` / `deploy.env` 已忽略。确认未误提交。 | 静态：不检查私密文件是否存在 |

## 2. 公式（KV / ROI / PD）

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | `js/index-page.js` `computeStandardKvCacheBytes` 等 | 公式封在 IIFE，无黄金用例。batch/seq 非正整数已有 UI 拦截，但公式本身未回归。 | 单测：标准 GQA / MLA 对照字节数 |
| 中 | `js/aidc-investment-roi-page.js` `tokenMix` / `blendedCloudPrice` | `total <= 0` 时比例归零；云价加权依赖 mix。改默认 TPS 易 silently 偏。 | 单测：mix 归一化、加权价、TPS↔亿 token/日 |
| 低 | `js/index-page.js` PD 分离 | Prefill/Decode 分卡 + 10% 开销，逻辑与 UI 耦合，适合浏览器点一次，不强行单测。 | 浏览器：混部/分离切换后结果变化 |

## 3. 配置回退

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | `js/config-loader.js` | 3s 超时或非 2xx → 本地默认。行为正确，但 `ALLOWED_CONFIG_KEYS` 含 `inference.defaults` / `aidc_calc.cfg` / `outline.2026` / `ai_usage`，种子目录无对应文件。 | 静态：种子键 ⊆ 白名单；浏览器：断 API 时 ROI 仍出数 |
| 低 | `api/main.py` GET `/api/config/{key}` | DB down → 503。前端靠 catch 回退，与「API 优先」一致。 | 单测：已知 key + DB down → 503 |

## 4. i18n

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | `i18n/*.zh.json` vs `*.en.json` | 键不对齐会导致 EN 显示 key 或错文案。3D 页 historically 有 lookup 错位。 | 静态：成对 JSON 键集合（可白名单） |
| 低 | `js/i18n.js` `t()` | 缺 key 原样返回 key，页面不会崩，但 EN 会露出路径。 | 静态 + 浏览器抽查 |

## 5. 跨页状态

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 中 | `js/aidc-theme.js` + iframe | 主题靠 postMessage，子页不应因切主题整页重载。 | 浏览器：父页切 Light/Dark，子 iframe 同步且不闪白 |
| 低 | `js/lang-switch.js` / `localStorage aidc-locale` | `?lang=` 写入 storage 后跨页保持。 | 浏览器：`?lang=en` 后再开另一页仍为 EN |
| 低 | `js/embed-mode.js` | 仅加 `aidc-embed` class，逻辑薄。 | 浏览器：`?embed=1` 隐藏站点 chrome |

## 6. 部署契约

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 高 | 历史事故 | 线上曾缺 `js/lang-switch.js`。Actions 部署后只测该文件是否存在。 | 静态：HTML 引用的本地资源存在；CI 部署前跑 `check-site.py` |
| 中 | `scripts/deploy.sh` vs `.github/workflows/deploy.yml` | exclude 目前一致，但两处手写，易漂移。 | 静态：两边 `--exclude` 列表必须相同 |
| 低 | `data/analytics/summary.json` | 已在 exclude 中，避免把本机快照覆盖服务器。 | 静态：exclude 对齐 |

## 7. 大页与分析

| 严重度 | 位置 | 现象 | 建议测试层 |
|--------|------|------|------------|
| 低 | `datacenter-3d-*.html` | 大段内联 JS，几何不做单测。 | 检视 + 浏览器目视布局 |
| 中 | `api/analytics.py` `mask_ip` | IPv4 保留前两段；IPv6 只留前两段。无单测。 | 单测：`1.2.3.4` → `1.2.*.*` |
| 低 | `api/settings.py` `CORS_ORIGINS` | 默认仅本机 8011。生产必须靠环境变量，漏配会导致浏览器跨域失败。 | 运维：`cloud-verify` / 生产 `.env` |

## 建议消化顺序

1. 静态检查（缺文件、JSON、i18n 键、exclude）——对应历史部署事故。
2. API 鉴权 + health + `mask_ip` 单测。
3. KV / ROI 黄金用例（Python 对照，避免拆 IIFE）。
4. [docs/TEST.md](TEST.md) 浏览器冒烟；3D 仅目视。
