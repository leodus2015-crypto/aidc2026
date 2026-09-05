# 本地测试报告

本目录给**另一个编码窗口**读取，按报告里的「待优化」改代码。不要改本 README 的命名约定。

## 命名

```text
docs/test-reports/YYYY-MM-DD-<site-version>-b<asset-build>.md
```

- 日期：生成当天（本地日历）
- `<site-version>`：[`data/site-release.json`](../../data/site-release.json) 的 `version`（如 `v2026.08.29`）
- `b<asset-build>`：同文件 `build`，与 [`data/asset-version.json`](../../data/asset-version.json) 的 `version` 一致

示例：`2026-09-05-v2026.09.01-b84.md`

## 生成后怎么用

1. 打开本目录下**最新日期**的那份报告。
2. 只处理「待优化 / 建议下一窗口」中的条目，不要顺手大重构。
3. 改完后在 aidc 窗口重跑 `python3 scripts/check-site.py` 与 `python3 -m pytest tests -q`。
