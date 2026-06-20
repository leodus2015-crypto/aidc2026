#!/usr/bin/env bash
# 一键：push GitHub → rsync 到云服务器（与 .github/workflows/deploy.yml 规则一致）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE="${DEPLOY_REMOTE:-origin}"
COMMIT_MSG=""
DO_PUSH=1
DO_SYNC=1
FULL_RESET=0
SKIP_COMMIT=0

usage() {
  cat <<EOF
用法:
  ./scripts/deploy.sh "提交说明"     提交 + push + 同步服务器
  ./scripts/deploy.sh --sync-only    仅 rsync（已 push 过）
  ./scripts/deploy.sh --push-only    仅 push GitHub
  ./scripts/deploy.sh --full-reset "提交说明"
                                     服务器备份 .env 后清空目录再全量同步

环境:
  复制 deploy.env.example → deploy.env 并填写 SSH 信息

自动化:
  git push origin main 会触发 GitHub Actions 部署（配置 Secrets 后）
  或: ./scripts/install-deploy-hook.sh 安装 post-push 钩子
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-only) DO_PUSH=0 ;;
    --push-only) DO_SYNC=0 ;;
    --full-reset) FULL_RESET=1 ;;
    --no-commit) SKIP_COMMIT=1 ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -z "${COMMIT_MSG}" ]]; then
        COMMIT_MSG="$1"
      else
        COMMIT_MSG+=" $1"
      fi
      ;;
  esac
  shift
done

if [[ -f "${ROOT}/deploy.env" ]]; then
  # shellcheck disable=SC1091
  source "${ROOT}/deploy.env"
fi

: "${DEPLOY_HOST:?请在 deploy.env 中设置 DEPLOY_HOST}"
: "${DEPLOY_PORT:=22}"
: "${DEPLOY_USER:?请在 deploy.env 中设置 DEPLOY_USER}"
: "${DEPLOY_PATH:?请在 deploy.env 中设置 DEPLOY_PATH}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
DEPLOY_OWNER="${DEPLOY_OWNER:-www:www}"

SSH_OPTS=(-p "${DEPLOY_PORT}" -i "${DEPLOY_SSH_KEY}" -o StrictHostKeyChecking=accept-new)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"
REMOTE_SPEC="${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude '.github/'
  --exclude '.env'
  --exclude 'deploy.env'
  --exclude '.DS_Store'
  --exclude 'api/__pycache__/'
  --exclude '**/__pycache__/'
  --exclude '*.pyc'
)

if [[ -n "${DEPLOY_EXTRA_EXCLUDES:-}" ]]; then
  IFS=',' read -ra EXTRA <<< "${DEPLOY_EXTRA_EXCLUDES}"
  for item in "${EXTRA[@]}"; do
    RSYNC_EXCLUDES+=(--exclude "${item}")
  done
fi

git_commit_and_push() {
  if [[ "${SKIP_COMMIT}" -eq 1 ]]; then
    echo ">> 跳过 commit（--no-commit）"
  elif [[ -n "$(git status --porcelain)" ]]; then
    [[ -n "${COMMIT_MSG}" ]] || {
      echo "错误：有未提交改动，请提供提交说明。" >&2
      exit 1
    }
    git add -A
    git commit -m "${COMMIT_MSG}"
  else
    echo ">> 工作区干净，无需 commit"
  fi

  echo ">> push ${REMOTE} ${BRANCH}"
  git push "${REMOTE}" "${BRANCH}"
}

server_full_reset() {
  echo ">> 服务器全量重置（保留 .env / .user.ini）"
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" bash -s <<EOF
set -euo pipefail
TARGET="${DEPLOY_PATH}"
STAMP=\$(date +%Y%m%d_%H%M%S)
BACKUP="/tmp/aidc_backup_\${STAMP}"
mkdir -p "\${BACKUP}"
[[ -f "\${TARGET}/.env" ]] && cp -a "\${TARGET}/.env" "\${BACKUP}/"
[[ -f "\${TARGET}/.user.ini" ]] && cp -a "\${TARGET}/.user.ini" "\${BACKUP}/"
mkdir -p "\${TARGET}"
find "\${TARGET}" -mindepth 1 -maxdepth 1 ! -name '.env' ! -name '.user.ini' -exec rm -rf {} +
echo "   已清空 \${TARGET}（备份在 \${BACKUP}）"
EOF
}

rsync_to_server() {
  echo ">> rsync → ${REMOTE_SPEC}"
  rsync -avz --delete "${RSYNC_EXCLUDES[@]}" \
    -e "${RSYNC_SSH}" \
    "${ROOT}/" "${REMOTE_SPEC}"

  echo ">> 修正属主 ${DEPLOY_OWNER}"
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "chown -R ${DEPLOY_OWNER} '${DEPLOY_PATH}' && find '${DEPLOY_PATH}' -type d -exec chmod 755 {} \\; && find '${DEPLOY_PATH}' -type f -exec chmod 644 {} \\;"
}

verify_deploy() {
  echo ">> 验证"
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "test -f '${DEPLOY_PATH}/js/lang-switch.js' && test -f '${DEPLOY_PATH}/ai-dc-design.html'" \
    && echo "   ✓ 关键文件存在" \
    || { echo "   ✗ 关键文件缺失" >&2; exit 1; }

  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://www.aidc2026.cn/js/lang-switch.js" || true)"
    echo "   https://www.aidc2026.cn/js/lang-switch.js → HTTP ${code}"
  fi
}

main() {
  [[ "${DO_PUSH}" -eq 1 || "${DO_SYNC}" -eq 1 ]] || {
    usage
    exit 1
  }

  if [[ "${DO_PUSH}" -eq 1 ]]; then
    git_commit_and_push
  fi

  if [[ "${DO_SYNC}" -eq 1 ]]; then
    [[ "${FULL_RESET}" -eq 1 ]] && server_full_reset
    rsync_to_server
    verify_deploy
  fi

  echo ">> 部署完成"
}

main
