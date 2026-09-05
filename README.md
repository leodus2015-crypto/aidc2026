<p align="center">
  <a href="https://www.aidc2026.cn">
    <img src="aidc2026-logo.svg" alt="AIDC 2026 · AI Data Center" width="520">
  </a>
</p>

<h1 align="center">AIDC 2026 · AI Data Center</h1>

<p align="center">
  <strong>面向 AI 数据中心（AI DC）领域的研究与学习站点 · 静态开源 · 中英文</strong>
</p>

<p align="center">
  <a href="https://www.aidc2026.cn">在线站点</a> ·
  <a href="https://www.aidc2026.cn/about-us.html">About US</a> ·
  <a href="https://www.aidc2026.cn/ai-dc-design.html">AI DC 规划</a>
</p>

---

## 简介

**AIDC 2026** 是一个 AI Native 的静态知识站点，用于 AI 数据中心领域的概念演示、公式说明与布局案例。本站代码 **开源仅供查阅与参考**，欢迎 fork 后按需改造。

主要模块：

| 模块 | 说明 |
|------|------|
| **Agentic 推理** | 推理原理、推理服务数据流、PD 混部/分离 |
| **AI DC 规划** | 机房布局、机柜布局、3D 案例、ROI |
| **后训练** | 大模型后训练流程示意 |
| **白皮书** | AI DC 白皮书与 2.0 讨论稿 |
| **About US** | 代码量、Token 用量、团队与开源信息 |
| **站点状态** | 内部页 `status.html`（访问观测）；About US 头像悬停 2s 入口；见 `deploy/ANALYTICS.md` |

## 技术栈

- 纯静态 HTML + Tailwind CSS（CDN）
- 单页 + `i18n/*.json` 中英文（`?lang=en` 或页内切换）
- Light / Dark 双主题（`js/aidc-theme.js` + `css/theme.css`，跨 iframe 同步）
- 嵌套 iframe + `?embed=1` 子页模式（见 `css/embed.css`）
- 部署：本机 `scripts/deploy.sh` rsync 至腾讯云；GitHub 仅开源归档，不自动上线

## 页面与素材合并约定

语言和主题是两个独立维度，不复制四套页面：

- 中文 / EN 文案只维护在对应的 `i18n/*.zh.json`、`i18n/*.en.json`
- Light / Dark 颜色统一维护在 `css/theme.css` 或页面已有的 CSS 变量中
- 新页面优先使用 `--aidc-*` 语义颜色，避免在页面壳新增裸 `#hex`
- iframe 子页加载 `js/aidc-theme.js` 后会通过 `postMessage` 与父页同步，不应因切换主题重载 iframe
- SVG 素材优先使用 CSS 变量；必须提供双版本的位图采用 `.light.*` / `.dark.*` 命名
- 合并前检查：中文 Light、中文 Dark、EN Light、EN Dark

## 本地预览

```bash
./preview-8011.sh
# http://127.0.0.1:8011/aidc/ai-dc-design.html
```

## 测试

团队新增页面、接口与数据库变更统一遵循 [`docs/DEVELOPMENT-STANDARDS.md`](docs/DEVELOPMENT-STANDARDS.md) 与 [`CONTRIBUTING.md`](CONTRIBUTING.md)。页面目录和关联关系见 [`docs/SITE-ARCHITECTURE.md`](docs/SITE-ARCHITECTURE.md)。静态检查、API/公式单测与浏览器冒烟清单见 [`docs/TEST.md`](docs/TEST.md)；基线代码检视见 [`docs/REVIEW-BASELINE.md`](docs/REVIEW-BASELINE.md)；安全报告见 [`SECURITY.md`](SECURITY.md)。

```bash
python3 scripts/check-site.py
python3 -m pytest tests -q
```

## 版本

发布版本记录在 [`data/site-release.json`](data/site-release.json)，本机执行 `./scripts/deploy.sh` 且需要提交时会 bump。About 页会读取并展示最新版本号与更新日期。

## 仓库结构（节选）

```
aidc/
├── index.html              Agentic 推理（含容量规划与说明文档）
├── ai-dc-design.html       默认入口 · AI DC 规划（默认 Tab：机房布局）
├── ai-dc-tcp.html          TCP 方法论总览（规划 Tab）
├── ai-dc-computeEst.html   算力卡数匡算（规划 Tab）
├── ai-dc-layout.html       机柜规划 · Card → Power（规划 Tab）
├── about-us.html           About US
├── status.html             站点状态页（访问观测；内部，不在主导航）
├── data/
│   ├── site-release.json   站点版本（部署时更新）
│   ├── analytics/          Nginx 日志聚合快照
│   └── ai-usage.json       Token 用量统计
├── i18n/                   页面文案
├── js/                     页面逻辑与 i18n 引导
├── scripts/
│   ├── check-site.py       部署前静态检查
│   ├── deploy.sh           一键提交 + 部署
│   ├── analytics/          访问日志解析
│   └── merge-usage-events-csv.py
├── tests/                  API / 公式黄金用例
├── docs/TEST.md            测试说明与浏览器冒烟清单
└── preview-8011.sh         本地预览
```

## 协作与门禁

- 用 PR 合入 `main`；模板见 `.github/pull_request_template.md`。
- PR 必须通过 **CI**（不部署）。GitHub 是开源归档与备份，push 不会部署到腾讯云。
- 建议在 GitHub 为 `main` 开启：禁止直接 push、要求 PR、要求 CI 通过、Require review from Code Owners。
- 依赖更新由 Dependabot 每周检查 `api/`、`tests/` 与 GitHub Actions。

## 部署

本机为最新源；腾讯云为对外部署版；GitHub 为开源归档。

```bash
cp deploy.env.example deploy.env   # 填写 SSH，勿提交
./scripts/deploy.sh --sync-only --no-commit   # 正式：本机 rsync 到腾讯云
./scripts/deploy.sh --push-only               # 归档：push 到 GitHub
```

**白皮书 PDF**：仓库 `.gitignore` 忽略 `assets/*.pdf`。部署前请将中文版 PDF 放到 `assets/aidc-whitepaper-2024-zh.pdf`（与 `white-paper.html` 引用路径一致）；未放置时页面会显示「PDF 暂未就绪」提示而非空白 iframe。

线上站点：[https://www.aidc2026.cn](https://www.aidc2026.cn)

## 许可与说明

- 本站为研究与学习用途的开源参考实现。
- 示意图、案例数据等 **非施工图 / 非正式设计交付物**，请勿直接用于工程招标或施工。

## English

**AIDC 2026** is a static, AI-native knowledge site for the **AI data center (AI DC)** domain — concepts, formulas, layout demos, and bilingual (zh/en) pages. Source code is **open for reference**; fork and adapt freely.

- Live: [https://www.aidc2026.cn](https://www.aidc2026.cn)
- Preview locally: `./preview-8011.sh`
- Release metadata: `data/site-release.json` (updated on each deploy)
