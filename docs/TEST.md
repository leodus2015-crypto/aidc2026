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
- [ ] 依次切换：机房布局、机房布局 3D、机房供电、机房液冷、TCP、算力估算、机柜规划、产品协同、案例 A、案例 B、机房工期和造价、ROI；子页有内容，整站不卸载成空白。
- [ ] 直达 `ai-dc-design.html?tab=tcp`、`?tab=computeEst`、`?tab=plan`、`?tab=roomLayout3d`、`?tab=power`、`?tab=liquidRack`、`?tab=scheduleBudget`，打开即对应面板。
- [ ] 打开 `ai-dc-design.html?embed=1`（或子页 `?embed=1`），站点顶栏/大导航隐藏。

### 新页：TCP / 算力估算 / 机柜

- [ ] `ai-dc-tcp.html`：切换 1024 液冷 / 768 风冷，链路数字与对照区同步变化（卡数、MW、面积）。
- [ ] TCP 页「进入测算工具」落到算力估算，「进入布局工具」落到机柜规划（或带 `tab=` 的规划容器）。
- [ ] `ai-dc-computeEst.html`：默认口径算出卡数（与 TCP 1024 档同量级，约 1024）；`batch`/渗透等改为 0 或非法时有错误，结果不是 NaN。
- [ ] 算力页改渗透率或冗余后，卡数与「显存下限 / 算力需求」约束标签更新。
- [ ] `ai-dc-layout.html`：改卡数或功率后平面/汇总更新；断 API 仍可本机看图。

### 推理计算

- [ ] `index.html`：填一组合法参数，混部结果有数字（非 `--` / NaN）。
- [ ] 切到 PD 分离，改 Prefill/Decode 卡数，headline 随瓶颈侧变化。
- [ ] KV 估算：选有 profile 的模型，seq/batch 为正整数，GiB 有值；batch=0 显示错误而不是 NaN。

### ROI

- [ ] `aidc-investment-roi.html`：改 TPS 或规模，结果区更新。
- [ ] 停掉 API（或不访问 8012）：页面仍可用，配置来源为本地默认。
- [ ] API 正常时：错误管理凭据不能解锁；正确 `ADMIN_TOKEN` 可解锁并写入配置。
- [ ] API 不可用时：只读测算仍可用，但关键参数不能解锁或写入。
- [ ] 云端配置版本冲突时：当前输入保留，提示重新加载，不覆盖他人更新。

### 机房工期和造价

- [ ] `ai-dc-design.html?tab=scheduleBudget` 或主导航「机房工期和造价」：iframe 内工期甘特与造价区可见，不是空白。
- [ ] 切换建设方案后周期与工作包更新；改卡数后造价更新；非法输入（卡数 0、PUE < 1）显示错误而不是 NaN。
- [ ] 切中英和 Light/Dark 不整页重载；子页 `?embed=1` 时自带顶栏隐藏。

### 机房液冷

- [ ] `ai-dc-design.html?tab=liquidRack` 或主导航「机房液冷」：iframe 内液冷机柜剖面可见，不是空白。
- [ ] 切换总览/正视、图层开关后场景仍在；切中英和 Light/Dark 不整页重载。
- [ ] 子页 `?embed=1` 时自带顶栏隐藏；WebGL 不可用时显示回退说明。

### 机房供电

- [ ] `ai-dc-design.html?tab=power` 或主导航「机房供电」：iframe 内供电场景可见，不是空白。
- [ ] 「模拟停电」后状态文案变化；「正常供电」可恢复。切中英和 Light/Dark 不整页重载。
- [ ] 子页 `?embed=1` 时自带顶栏隐藏；WebGL 不可用时显示回退说明。

### 机房布局 3D

- [ ] `ai-dc-design.html?tab=roomLayout3d` 或主导航「机房布局 3D」：iframe 内 3D 场景可见，不是空白。
- [ ] 子页 `?embed=1` 时自带顶栏隐藏；切中英和 Light/Dark 后场景仍在，不整页重载。
- [ ] WebGL 不可用时显示回退说明，而不是空白或脚本报错裸奔。

### 3D 配置

- [ ] 两个 3D 页面：错误管理凭据不能解锁布局和规则；正确 `ADMIN_TOKEN` 可以解锁。
- [ ] API 不可用时：本地默认场景仍可查看，但布局和规则保持锁定。

### 中英 / 主题

- [ ] 任一主页面点 EN，再点中文，可见文案切换且无大片 key 路径（如 `nav.home`）。
- [ ] `?lang=en` 打开后再进另一页，语言保持 EN。
- [ ] Light / Dark 切换后颜色跟 `css/theme.css`，iframe 子页同步且不整页重载。

### 状态页

- [ ] `status.html`：不入口令看不到分析数字。
- [ ] 错误口令被拒绝；正确口令（与服务器 `ADMIN_TOKEN` 一致）才能看到摘要；未配置 `ADMIN_TOKEN` 时接口应不可用。

### 部署后（可选）

- [ ] `https://www.aidc2026.cn/ai-dc-design.html` HTTP 200
- [ ] `https://www.aidc2026.cn/js/lang-switch.js` HTTP 200
- [ ] `https://www.aidc2026.cn/i18n/common.zh.json` HTTP 200

暂不上 Playwright。清单稳定、同一路径反复回归时再补 5～6 条自动化，不要全站录屏。
