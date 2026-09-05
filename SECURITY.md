# 安全说明

本仓库是静态站点加小型配置/分析 API。请勿在公开 Issue 或 PR 中粘贴口令、`ADMIN_TOKEN`、SSH 私钥、数据库口令或未脱敏的访问日志。

## 报告漏洞

优先使用 GitHub 仓库的 **Security advisory / private vulnerability report**。若无法使用该功能，请通过仓库维护者私信说明影响范围，不要公开复现步骤中的真实凭据。

## 运维基线

- 生产 `ADMIN_TOKEN` 必须是强随机值，且只放在服务器环境变量中。
- 页面解锁与管理写操作都走服务端校验，禁止把口令放进公开配置或前端默认值。
- 分析接口与 `status.html` 建议再加一层 Nginx 访问控制，见 `deploy/nginx-analytics.conf`。
- 轮换凭据后，同步更新服务器 `.env`、analytics htpasswd 和部署 SSH 密钥。

## 范围外

示意图、规划估算和案例数据不是施工图或安全认证结论。请勿把本站输出直接用于生产机房验收。
