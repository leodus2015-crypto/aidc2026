# 静态资源缓存与 cache-bust

## 机制

| 组件 | 作用 |
|------|------|
| `data/asset-version.json` | 全站版本号唯一来源 |
| `js/aidc-asset-version.js` | 首屏加载，设置 `window.AIDC_ASSET_VERSION` |
| HTML `?v=N` | 所有本地 `js/`、`css/` 引用带版本 query |
| `js/i18n.js` | i18n JSON fetch 使用 `AIDC_ASSET_VERSION` |
| `js/ai-dc-design-page.js` | iframe URL 的 `v` 参数同源 |
| `deploy/nginx-static-cache.conf` | HTML 不缓存；带 `?v=` 的 JS/CSS 长期缓存 |

## 日常

```bash
# 查看当前版本
python3 scripts/bump-asset-version.py --show

# 仅同步（不改版本号，例如手改 json 后）
python3 scripts/bump-asset-version.py --sync

# 版本 +1 并同步（deploy.sh 提交前会自动执行）
python3 scripts/bump-asset-version.py --bump --sync
```

`./scripts/deploy.sh "说明"` 在有未提交改动时会 **自动 `--bump`**。  
跳过 bump：`SKIP_BUMP=1 ./scripts/deploy.sh --no-commit --sync-only`

## 服务器

1. 宝塔 / Nginx：将 `deploy/nginx-static-cache.conf` 合并进站点配置  
2. 若前面有 CDN：部署后 purge 该域名（或等待 TTL）  
3. 自测：`Cmd+Shift+R` 硬刷新；或无痕窗口打开

## 验收

```bash
curl -sI 'https://www.aidc2026.cn/ai-dc-design.html' | grep -i cache-control
curl -s 'https://www.aidc2026.cn/data/asset-version.json'
curl -sI 'https://www.aidc2026.cn/js/i18n.js?v=5' | grep -i cache-control
```
