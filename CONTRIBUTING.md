# 参与 AIDC 开发

开始改代码前请阅读：

1. [docs/DEVELOPMENT-STANDARDS.md](docs/DEVELOPMENT-STANDARDS.md) — 页面、UI、API、数据库与合并规范
2. [docs/SITE-ARCHITECTURE.md](docs/SITE-ARCHITECTURE.md) — 页面目录与 iframe 关系
3. [docs/TEST.md](docs/TEST.md) — 静态检查、单测与浏览器冒烟
4. [docs/REVIEW-BASELINE.md](docs/REVIEW-BASELINE.md) — 已知风险与剩余债

## 本地检查

```bash
python3 scripts/check-site.py
python3 -m pytest tests -q
```

涉及 UI 时按 `docs/TEST.md` 验证中文/英文 × Light/Dark。本地预览：

```bash
./preview-8011.sh
# http://127.0.0.1:8011/aidc/ai-dc-design.html
```

## 提交与 PR

- 一个提交只做一件可回退的事，不要混入全仓格式化。
- 用 PR 合入 `main`。PR 模板在 `.github/pull_request_template.md`。
- PR 必须通过 GitHub Actions **CI**（`check-site.py` + `pytest`）。CI 不部署。
- 正式上线只走本机 `scripts/deploy.sh`。GitHub 为开源归档，push 不得覆盖腾讯云。
- 推送归档、合并、部署是三件独立的事，分别确认。

## 不要做的事

- 不要把 `.env`、`deploy.env`、口令或 `ADMIN_TOKEN` 写进仓库。
- 浏览器不要直连数据库，也不要下载用于验证自身的管理凭据。
- 不要绕过 `scripts/check-site.py` 或把测试失败当作可合并状态。
