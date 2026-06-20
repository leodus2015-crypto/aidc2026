#!/usr/bin/env bash
# 包装 git push：push 成功后自动 rsync（Git 无原生 post-push 钩子）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRAPPER="${ROOT}/scripts/push-deploy.sh"

cat > "${WRAPPER}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"
git push "$@"
"${ROOT}/scripts/deploy.sh" --sync-only --no-commit
EOF

chmod +x "${WRAPPER}"
chmod +x "${ROOT}/scripts/deploy.sh"

git -C "${ROOT}" config alias.pushdeploy "!${WRAPPER}"

echo "已配置 git 别名 pushdeploy："
echo "  git pushdeploy origin main    # push 后自动 rsync 服务器"
echo ""
echo "或直接使用："
echo "  ./scripts/deploy.sh \"提交说明\"   # commit + push + rsync"
echo ""
echo "全自动（推荐）：push 到 main 后由 GitHub Actions 部署，见 deploy.env.example 注释。"
