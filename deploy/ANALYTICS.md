# 站点状态页 · 访问观测（Nginx 日志 → status.html）

## 功能

- 解析 Nginx `access.log`，聚合日 PV / UV、页面 Top、IP Top（脱敏）、状态码
- 写入 MySQL（`sql/analytics.sql`）并导出 `data/analytics/summary.json`
- 隐藏页 [`/status.html`](../status.html)：站点状态页（访问观测；后续整合运行状态），需 Bearer `ADMIN_TOKEN`
- Nginx 建议再加 `auth_basic`（见 [`nginx-analytics.conf`](./nginx-analytics.conf)）

## 服务器一次性配置

```bash
# 1. 建表
mysql -u USER -p aidc < sql/analytics.sql

# 2. .env 增加日志路径（宝塔常见）
# ANALYTICS_LOG=/www/wwwlogs/aidc2026.cn.log

# 3. 确认 API 在跑
./start-api-prod.sh

# 4. 合并 Nginx 片段后重载
# deploy/nginx-analytics.conf → 站点 server{}
# htpasswd -c /www/server/pass/aidc_analytics.htpasswd analytics
nginx -t && nginx -s reload

# 5. 首次全量解析
ANALYTICS_LOG=/www/wwwlogs/aidc2026.cn.log \
  python3 scripts/analytics/parse_nginx_log.py --full
```

## 定时任务（cron）

```cron
*/15 * * * * cd /www/wwwroot/aidc2026.cn && \
  /usr/bin/python3 scripts/analytics/parse_nginx_log.py >> /tmp/aidc-analytics.log 2>&1
```

`.env` 中需配置 `DATABASE_*` 与 `ANALYTICS_LOG`。

## 口径说明

| 指标 | 规则 |
|------|------|
| PV | GET/HEAD、状态 &lt; 400、排除 `.js/.css/图片` 等静态后缀 |
| UV | 按日独立 IP 数；区间 UV 为去重 IP 总数 |
| IP 展示 | `a.b.*.*` 脱敏，并附带国家/城市（解析时查询，带本地缓存） |
| 爬虫 | 默认过滤 UA 含 bot/spider/curl 等 |
| 美国访问 | **默认排除**：Cursor / 开发预览常从美国出口 IP 访问，不计入真实访客（国家匹配「美国」/ United States 等） |

解析写入时即跳过美国 IP；若库中已有历史美国流量，需执行一次 `--full` 重解析以校正 PV/UV。展示侧也会过滤 IP Top 中的美国地址。

## 本地验证

```bash
# 用样例行冒烟（需本地 MySQL）
echo '1.2.3.4 - - [12/Jun/2026:10:00:00 +0800] "GET /index.html HTTP/1.1" 200 100 "-" "Mozilla/5.0"' \
  > /tmp/aidc-access-sample.log
python3 scripts/analytics/parse_nginx_log.py --log /tmp/aidc-access-sample.log --full

curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://127.0.0.1:8012/api/analytics/summary?days=7"
```

打开：`http://127.0.0.1:8011/aidc/status.html`（口令 = `ADMIN_TOKEN`，默认 `aidc2026`）

本地无 MySQL 时可用样例日志冒烟：

```bash
python3 scripts/analytics/parse_nginx_log.py --json-only \
  --log data/analytics/sample-access.log --days 14
./start-api-8012.sh   # 另开终端
./preview-8011.sh
```

## 安全

- 页面不在主导航 / ARCHIVE 公开入口
- `meta robots noindex`
- **必须**配置 Nginx `auth_basic` 或 IP 白名单；前端口令 alone 不够安全
- 勿将 `summary.json`、htpasswd 提交到公开仓库敏感内容中
