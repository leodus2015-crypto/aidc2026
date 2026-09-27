# AIDC 测试说明

分层：代码检视 → 静态检查 → API/公式单测 → 浏览器冒烟 → 部署门禁。基线发现见 [REVIEW-BASELINE.md](REVIEW-BASELINE.md)。带日期与版本号的本地报告在 [test-reports/](test-reports/)（另一窗口按最新一份的「待优化」改）。

## 怎么跑

```bash
# 静态检查（JSON / i18n 键 / HTML 引用 / 部署 exclude）
python3 scripts/check-site.py

# API + 公式黄金用例（需: pip install -r api/requirements.txt -r tests/requirements.txt）
python3 -m pytest tests -q
```

`./scripts/deploy.sh` 在 commit/rsync **之前**会跑静态检查。跳过（不推荐）：

```bash
SKIP_SITE_CHECK=1 ./scripts/deploy.sh --sync-only
```

GitHub Actions：

- **CI**（`.github/workflows/ci.yml`）：`pull_request` 与非 `main` 的 push 只跑 `check-site.py` + `pytest`，不部署。
- **Deploy**（`.github/workflows/deploy.yml`）：仅 `workflow_dispatch` 备用。正式上线只走本机 `./scripts/deploy.sh`；GitHub 为开源归档。

## 浏览器冒烟（行为，不是一张截图）

本地：

```bash
./preview-8011.sh
# http://127.0.0.1:8011/aidc/ai-dc-design.html
```

改 UI、i18n、主题、计算器或配置加载后，按下面清单走主路径。未列的 3D 大页以目视为准。

### 入口与嵌套

- [ ] 打开 `ai-dc-design.html`，默认 Tab 为机房布局，iframe 子页可见。
- [ ] 规划容器内切换：机房布局、机房布局（立体）、TCP、算力估算、机柜规划、产品协同、案例 A、案例 B、ROI；子页有内容，整站不卸载成空白。
- [ ] 直达 `ai-dc-design.html?tab=tcp`、`?tab=computeEst`、`?tab=plan`、`?tab=roomLayout3d`，打开即对应面板。
- [ ] 旧地址 `?tab=power` / `?tab=liquidRack` / `?tab=liquidRequirements` / `?tab=scheduleBudget` 跳转到对应独立 HTML。
- [ ] 打开 `ai-dc-design.html?embed=1`（或仍内嵌的子页 `?embed=1`），站点顶栏/大导航隐藏。

### 新页：TCP / 算力估算 / 机柜

- [ ] `ai-dc-tcp.html`：切换 1024 液冷 / 768 风冷，链路数字与对照区同步变化（卡数、MW、面积）；Hero 一度电标尺、5 年单位成本、大 EP / 双机实例划分随之更新。
- [ ] TCP 页「进入测算工具」落到算力估算，「进入布局工具」落到 `aidc-layout-Card2Power.html`。
- [ ] `ai-dc-computeEst.html`：默认 coding 口径（12700×100%，与 TCP 1024 档同量级）算出卡数约 1024；渗透等改为 0 或非法时有错误，结果不是 NaN。
- [ ] 算力页改渗透率或冗余后，卡数与「显存下限 / 算力需求」约束标签更新。
- [ ] `aidc-layout-Card2Power.html`：改卡数或功率后平面/汇总更新；断 API 仍可本机看图。主导航「机柜规划」直达本页，不再走 `?tab=plan`。

### 推理计算

- [ ] `index.html`：填一组合法参数，混部结果有数字（非 `--` / NaN）。
- [ ] 切到 PD 分离，改 Prefill/Decode 卡数，headline 随瓶颈侧变化。
- [ ] KV 估算：选有 profile 的模型，seq/batch 为正整数，GiB 有值；batch=0 显示错误而不是 NaN。

### ROI

- [ ] `aidc-investment-roi.html`：改 TPS 或规模，结果区更新。
- [ ] 停掉 API（或不访问 8012）：页面仍可用，配置来源为本地默认。
- [ ] API 正常时：错误管理凭据不能解锁；正确 `ADMIN_TOKEN`（英文字母大小写不敏感）可解锁并写入配置。
- [ ] API 不可用时：只读测算仍可用，但关键参数不能解锁或写入。
- [ ] 云端配置版本冲突时：当前输入保留，提示重新加载，不覆盖他人更新。
- [ ] 未解锁「关键参数」时没有下载按钮；口令解锁后出现「下载 Excel」，文件含当前输入与页面同构公式（黄色可改、蓝色为公式）。

### 机房工期和造价

- [ ] 打开 `ai-dc-schedule-budget.html` 或主导航「机房工期和造价」：工期甘特与造价区可见，不是空白；站点顶栏与大导航可用。
- [ ] 切换建设方案后周期与工作包更新；改卡数或运维费率后造价与回收期更新；非法输入（卡数 0、PUE < 1、运维费率 > 100）显示错误而不是 NaN。
- [ ] 切中英和 Light/Dark 不整页重载。

### 机房液冷

- [ ] 打开 `ai-dc-liquid-rack.html`：液冷机柜剖面可见，不是空白；站点顶栏与大导航可用。
- [ ] 「返回层高承重」落到 `ai-dc-liquid-requirements.html`。
- [ ] 切换总览/正视、图层开关后场景仍在；切中英和 Light/Dark 不整页重载。
- [ ] WebGL 不可用时显示回退说明。

### 机房液冷层高承重

- [ ] 打开 `ai-dc-liquid-requirements.html` 或主导航「机房液冷层高承重」：层高/承重内容可见，不是空白；站点顶栏与大导航可用。
- [ ] 「3D演示」落到 `ai-dc-liquid-rack.html`。
- [ ] 切中英和 Light/Dark 不整页重载。

### 机房供电

- [ ] 打开 `ai-dc-power.html` 或主导航「机房供电」：供电场景可见，不是空白；站点顶栏与大导航可用。
- [ ] 「模拟停电」后状态文案变化；「正常供电」可恢复。切中英和 Light/Dark 不整页重载。
- [ ] WebGL 不可用时显示回退说明。

### 机房布局（立体）

- [ ] `ai-dc-design.html?tab=roomLayout3d` 或主导航「机房布局（立体）」：iframe 内场景可见，不是空白。
- [ ] 子页 `?embed=1` 时自带顶栏隐藏；切中英和 Light/Dark 后场景仍在，不整页重载。
- [ ] WebGL 不可用时显示回退说明，而不是空白或脚本报错裸奔。

### Topic

- [ ] 主导航显示 **Topic**（中英相同）；打开 `topic.html` 见短引言与卡片网格，不是整页 PDF。卡片顺序：2026 白皮书 → 主权 AI → SwarmTraces 报告；中文另有 2024 白皮书卡，英文目录不显示仅有中文版的 2024 白皮书卡。
- [ ] 中文下 2024 白皮书卡进入 `white-paper-2024.html`：PDF 可用时预览/下载可用；PDF 缺失时显示就绪提示而不是空白 iframe。
- [ ] 观点卡进入 `topic-sovereign-ai.html`，中文加载 `topic/sovereign-ai/sovereign-ai-zh.html` 幻灯片（含配图），切 EN 后加载 `topic/sovereign-ai/sovereign-ai.html`，切主题不重载 iframe；可返回 Topic 目录。页面不展示演讲稿。
- [ ] 窗口内可直接翻页；窗口外右下角小按钮「全屏播放」进入演讲全屏（站点壳隐藏，16:9 铺满）；方向键/空格翻页；Esc 退出，F 可切换。不支持 Fullscreen API 时仍铺满视口。
- [ ] 2026 白皮书卡进入 `white-paper-2026.html`：中文预览/下载 `topic/ai-dc-white-paper-2026-cn.pdf`，切 EN 后预览/下载 `topic/ai-dc-white-paper-2026-en.pdf`；两份 PDF 均可直接下载。PDF 缺失时显示就绪提示而不是空白 iframe。
- [ ] SwarmTraces 卡进入 `topic-swarmtraces.html`：中文 iframe 显示 `topic/swarmtraces/swarmtraces技术分析报告.html`，「下载 PDF」指向同目录 PDF。切 EN 后 iframe 换成 `topic/swarmtraces/swarmtraces-technical-analysis.html`，不显示 PDF 下载。切主题不重载 iframe。iframe 内仍是单栏阅读，不出现独立顶栏/左侧目录。
- [ ] 「新窗口打开」后：手机宽度保持单栏；电脑宽度顶部为站点链接（含返回 Topic），左侧目录、右侧正文。点击目录可跳转到对应小节。
- [ ] 专题页底部与 HTML 文末有 swarmtraces.org 来源与知识产权声明，链接可打开。
- [ ] 切中英和 Light/Dark：目录与子页文案/颜色正确，卡片不横向溢出。

### 3D 配置

- [ ] 两个 3D 页面：错误管理凭据不能解锁布局和规则；正确 `ADMIN_TOKEN`（英文字母大小写不敏感）可以解锁。
- [ ] API 不可用时：本地默认场景仍可查看，但布局和规则保持锁定。

### 中英 / 主题

- [ ] 任一主页面点 EN，再点中文，可见文案切换且无大片 key 路径（如 `nav.home`）。
- [ ] `?lang=en` 打开后再进另一页，语言保持 EN。
- [ ] Light / Dark 切换后颜色跟 `css/theme.css`，iframe 子页同步且不整页重载。

### 状态页

- [ ] `status.html`：不入口令看不到分析数字。
- [ ] 错误口令被拒绝；正确口令（与服务器 `ADMIN_TOKEN` 一致，英文字母大小写不敏感）才能看到摘要；未配置 `ADMIN_TOKEN` 时接口应不可用。

### 部署后（可选）

- [ ] `https://www.aidc2026.cn/ai-dc-design.html` HTTP 200
- [ ] `https://www.aidc2026.cn/js/lang-switch.js` HTTP 200
- [ ] `https://www.aidc2026.cn/i18n/common.zh.json` HTTP 200
- [ ] `https://aidc2026.cn/favicon.ico` 与 `https://www.aidc2026.cn/favicon.ico` HTTP 200
- [ ] `https://www.aidc2026.cn/robots.txt` HTTP 200，含 `User-agent: *` 与 `Allow: /`
- [ ] `https://www.aidc2026.cn/sitemap.xml` HTTP 200，`Content-Type` 含 xml，含 8 个核心页
- [ ] `curl -sI http://aidc2026.cn/` 的 `Location` 为 `https://…`
- [ ] 浏览器禁用 JS 后，主导航页可见 `<noscript>` 提示与静态正文，不是白屏

暂不上 Playwright。清单稳定、同一路径反复回归时再补 5～6 条自动化，不要全站录屏。
