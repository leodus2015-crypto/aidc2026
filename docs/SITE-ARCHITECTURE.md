# AIDC 页面目录与关联关系

本文说明站点目录职责、HTML 页面层级和资源关联。机器可读的唯一页面清单是 `data/page-registry.json`；新增、移动或删除页面时必须同步更新注册表，并通过 `scripts/check-site.py`。

开发约束见 `docs/DEVELOPMENT-STANDARDS.md`，测试方法见 `docs/TEST.md`。

## 1. 运行形态

AIDC 由两部分组成：

1. 静态站点：HTML、CSS、JavaScript、i18n 和本地数据文件，可独立提供主要阅读与计算功能。
2. FastAPI 服务：提供配置、访问分析和数据库访问；不可用时，仅允许明确声明了本地回退的页面降级运行。

浏览器只能访问 HTTP API，不得直连 MySQL。Nginx 同时提供静态站点、`/api/` 反向代理、安全头、缓存和历史 URL 301。

## 2. 目录职责

```text
aidc/
├── *.html                  主入口、AI DC 容器及其 iframe 子页
├── inference/              推理原理与服务数据流 iframe 子页
├── js/                     共享能力和页面专属逻辑
├── css/                    全站主题、embed、动画控件及页面补充样式
├── i18n/                   页面中英文文案；名称与 data-i18n-page 对齐
├── data/                   公开静态数据、配置回退、版本及页面注册表
├── api/                    FastAPI 路由、响应模型、数据库和分析查询
├── sql/                    空库引导 schema；结构变化必须写入 sql/migrations/
├── scripts/                静态检查、构建、数据任务和部署脚本
├── tests/                  API、公式和站点检查
├── deploy/                 Nginx、安全、缓存和访问分析配置
├── docs/                   开发规范、架构、测试及运维文档
└── .github/workflows/      CI 与部署工作流
```

## 3. 顶层入口

- `ai-dc-design.html`：AI DC 规划容器，也是站点 Logo 的默认入口。
- `index.html`：Agentic 推理容器，同时承载混部、分离和 KV Cache 计算。
- `post-training.html`：后训练独立页面。
- `white-paper.html`：白皮书独立页面，按需加载 PDF。
- `about-us.html`：团队、版本和 Token 用量。
- `404.html`：站点错误页。
- `status.html`：内部访问观测页，不出现在主导航；入口来自 About US。

主导航结构由 `js/aidc-mega-nav.js` 和各页面顶栏共同呈现。导航文案来自 `i18n/common.{zh,en}.json`。

## 4. AI DC 规划页面树

```text
ai-dc-design.html
├── tab=roomLayout → ai-dc-room-layout.html
│   ├── fourLayer   → ai-dc-four-layer.html
│   └── floorDetail → ai-dc-floor-detail.html
├── tab=roomLayout3d → ai-dc-room-layout-3d.html
├── tab=power      → ai-dc-power.html
├── tab=liquidRack → ai-dc-liquid-rack.html
├── tab=tcp        → ai-dc-tcp.html
├── tab=computeEst → ai-dc-computeEst.html
├── tab=plan       → ai-dc-layout.html
├── tab=synergy    → ai-dc-deployment-perf.html
├── tab=a          → datacenter-3d-case-b.html
├── tab=b          → datacenter-3d-v3-2.html
├── tab=scheduleBudget → ai-dc-schedule-budget.html
└── tab=roi        → aidc-investment-roi.html
```

第一层 iframe 关系由 `js/ai-dc-design-page.js` 管理。机房布局的第二层 iframe 由 `js/ai-dc-room-layout-page.js` 管理。父页负责选择 Tab、拼接 `embed=1` 和语言参数；子页负责响应主题及语言同步。

注意：`datacenter-3d-case-b.html` 当前对应界面“案例 A”，文件历史名称与展示名称不一致。修改名称或 URL 前需提供兼容迁移，不能直接重命名。

## 5. Agentic 推理页面树

```text
index.html
├── tab=principles → inference/basic.html
├── tab=dataflow   → inference/server-dataflow.html
├── tab=mixed      → index.html 内部计算面板
├── tab=separated  → index.html 内部计算面板
└── tab=kvcache    → index.html 内部计算面板
```

iframe URL 与语言同步由 `js/index-page.js` 管理。`inference/styles.css` 是两个推理子页的共享样式。

## 6. 页面与资源关联

每个 HTML 必须在 `data/page-registry.json` 登记：

- `path`：仓库根目录相对路径。
- `id`：`data-i18n-page` 的稳定页面 ID。
- `kind`：`entry`、`container`、`embedded`、`internal` 或 `error`。
- `visibility`：`public` 或 `internal`。
- `parents`：iframe 父页面、Tab 或 slot。
- `embeds`：该页面直接嵌入的 HTML。
- `assets`：页面专属脚本、样式、i18n 和关键静态资源。
- `dataSources`：公开静态数据或 API 路径。
- `optionalDataSources`：允许部署时缺失并由页面显示降级状态的资源。

共享资源无需在每页重复登记，其职责如下：

- `js/aidc-theme.js`、`js/theme-switch.js`、`css/theme.css`：主题初始化与切换。
- `js/i18n.js`、`js/i18n-bootstrap.js`、`js/lang-switch.js`：页面文案与语言切换。
- `js/aidc-locale-bridge.js`：父子 iframe 语言同步。
- `js/embed-mode.js`、`css/embed.css`：iframe 子页去除站点级 chrome。
- `js/aidc-asset-version.js`、`data/asset-version.json`：静态资源和 iframe 版本。
- `js/aidc-api-client.js`：统一 API base、超时、认证、错误和请求 ID。
- `js/config-loader.js`：配置加载兼容包装层，为现有页面保留 `AidcConfig` API。
- `js/aidc-refresh-flash.js`、`js/aidc-replay-control.js`：共享交互反馈与回放控件。

## 7. 数据与 API 关系

- 机房布局 3D / 机房供电 / 机房液冷：纯前端 Three.js 场景，无 API / 数据库依赖；WebGL 不可用时显示回退说明。
- 机房工期和造价：纯前端工期甘特与风冷/液冷造价估算，无 API / 数据库依赖；造价公式在 `js/ai-dc-schedule-budget-model.js`。
- 3D 案例 A/B：读取 `/api/config/dc3d.case_a`、`dc3d.case_b`，失败时回退 `data/dc3d-case-*.defaults.json`。
- Investment ROI：读取和管理 `/api/config/roi.*`，本地默认由页面初始化脚本和 `data/config-seeds/` 保持。
- 站点状态：使用 `/api/analytics/summary`，必须服务端认证。
- About US：读取 `data/ai-usage.json` 和 `data/site-release.json`。
- 白皮书：可选读取 `assets/aidc-whitepaper-2024-zh.pdf`，缺失时必须显示就绪提示。
- 页面文案：所有标准页面读取 `i18n/common.*.json` 和自己的页面 bundle。

管理凭据仅存在于服务端 `ADMIN_TOKEN` 环境变量。ROI 与 3D 页面由用户输入凭据并调用服务端验证；公共配置接口不得返回口令或其验证材料。

API 成功响应由 `api/schemas.py` 定义并保持现有主体兼容。错误统一返回 `error.code`、`error.message`、`error.request_id`；数据库驱动异常只写服务端日志，不返回浏览器。前端生成的 `X-Request-ID` 会由 API 校验并在响应头回传。

配置写入必须携带 `expected_version`。版本不一致返回 `409 CONFLICT`，页面应保留用户输入并提示重新加载。种子导入使用 `force=True`，不走乐观锁。

结构变更必须新增 `sql/migrations/NNNN_name.sql`，由 `python3 scripts/migrate.py` 按文件名顺序执行。脚本会登记校验和；已应用文件被改动会失败。空库仍可用 `sql/schema.sql` 引导，但生产变更不得只改该文件后手工执行。`python3 scripts/migrate.py --check` 不连接数据库。

## 8. 新页面接入步骤

1. 按 `docs/DEVELOPMENT-STANDARDS.md` 确定页面 ID、页面类型、入口和数据边界。
2. 创建 HTML、页面脚本和 `i18n/<id>.{zh,en}.json`。
3. 如为 iframe，先定义唯一父页面、Tab/slot、embed 和语言同步方式。
4. 在 `data/page-registry.json` 登记页面及主要依赖。
5. 更新导航或父页映射，不复制新的站点壳。
6. 运行静态检查、单元测试及适用的浏览器冒烟。

## 9. 删除或迁移页面

1. 查找导航、链接、iframe、i18n、脚本、数据和部署配置引用。
2. 修改注册表和父子关系。
3. 公共旧 URL 在 Nginx 配置 301，不保留空功能 HTML。
4. 删除成为孤立状态的脚本、样式和 i18n。
5. 运行 `scripts/check-site.py`，确认没有未登记页面、失效引用或关系不对称。

## 10. 自动校验边界

`scripts/check-site.py` 负责发现：

- 正式 HTML 未登记或注册了不存在的页面。
- 重复页面路径或页面 ID。
- `data-i18n-page` 与注册 ID 不一致。
- 页面专属资源不存在。
- iframe 父子关系缺失、不对称或指向未登记页面。

静态分析不能证明运行时 Tab、主题、语言和接口行为正确；这些仍需单元测试和 `docs/TEST.md` 中的浏览器冒烟。
