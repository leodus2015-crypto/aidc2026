#!/usr/bin/env bash
# 本机为最新源：rsync 到腾讯云（部署版）。GitHub 只作开源归档，不触发线上。
# exclude 列表须与 .github/workflows/deploy.yml 保持一致。
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
  ./scripts/deploy.sh --sync-only --no-commit   仅 rsync 到腾讯云（正式部署）
  ./scripts/deploy.sh --push-only               仅 push GitHub（开源归档）
  ./scripts/deploy.sh --full-reset --sync-only --no-commit
                                                服务器备份 .env 后清空再全量同步
  ./scripts/deploy.sh "提交说明"                提交 + 部署；默认还会 push 归档

  SKIP_BUMP=1 ./scripts/deploy.sh "说明"   提交时不递增资源版本号
  ./scripts/deploy.sh --no-bump "说明"     同上
  SKIP_SITE_CHECK=1 ./scripts/deploy.sh …  跳过 scripts/check-site.py（不推荐）

环境:
  复制 deploy.env.example → deploy.env 并填写 SSH 信息

角色:
  本机 = 最新源；腾讯云 = 部署版（只走本脚本 rsync）；GitHub = 开源归档（不自动部署）
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --sync-only) DO_PUSH=0 ;;
    --push-only) DO_SYNC=0 ;;
    --full-reset) FULL_RESET=1 ;;
    --no-commit) SKIP_COMMIT=1 ;;
    --no-bump) SKIP_BUMP=1 ;;
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
  --exclude '.user.ini'
  --exclude 'api/__pycache__/'
  --exclude '**/__pycache__/'
  --exclude '*.pyc'
  --exclude 'data/analytics/geo-cache.json'
  --exclude 'data/analytics/summary.json'
  --exclude '.pytest_cache/'
  --exclude '.venv/'
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
    if [[ "${SKIP_BUMP:-0}" -eq 0 ]]; then
      echo ">> bump 静态资源版本号"
      python3 "${ROOT}/scripts/bump-asset-version.py" --bump --sync
    else
      echo ">> 跳过 bump（SKIP_BUMP / --no-bump）"
    fi
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
    "chown ${DEPLOY_OWNER} '${DEPLOY_PATH}' && find '${DEPLOY_PATH}' -mindepth 1 ! -name '.user.ini' -exec chown ${DEPLOY_OWNER} {} + && find '${DEPLOY_PATH}' -type d -exec chmod 755 {} \\; && find '${DEPLOY_PATH}' -type f ! -name '.user.ini' -exec chmod 644 {} \\; && find '${DEPLOY_PATH}' -type f -name '*.sh' -exec chmod 755 {} +"
}

verify_deploy() {
  echo ">> 验证"
  local ver
  ver="$(python3 "${ROOT}/scripts/bump-asset-version.py" --show 2>/dev/null || echo '?')"
  ssh "${SSH_OPTS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" \
    "test -f '${DEPLOY_PATH}/js/lang-switch.js' && test -f '${DEPLOY_PATH}/ai-dc-design.html'" \
    && echo "   ✓ 关键文件存在" \
    || { echo "   ✗ 关键文件缺失" >&2; exit 1; }

  if command -v curl >/dev/null 2>&1; then
    code="$(curl -s -o /dev/null -w '%{http_code}' "https://www.aidc2026.cn/js/lang-switch.js?v=${ver}" || true)"
    echo "   https://www.aidc2026.cn/js/lang-switch.js?v=${ver} → HTTP ${code}"
    echo "   asset-version.json → $(curl -s "https://www.aidc2026.cn/data/asset-version.json" 2>/dev/null || echo 'n/a')"
    for path in /ai-dc-design.html /i18n/common.zh.json; do
      live="$(curl -s -o /dev/null -w '%{http_code}' "https://www.aidc2026.cn${path}" || true)"
      echo "   https://www.aidc2026.cn${path} → HTTP ${live}"
    done
  fi
}

run_site_check() {
  if [[ "${SKIP_SITE_CHECK:-0}" -eq 1 ]]; then
    echo ">> 跳过站点静态检查（SKIP_SITE_CHECK=1）"
    return
  fi
  echo ">> 站点静态检查"
  python3 "${ROOT}/scripts/check-site.py"
}

main() {
  [[ "${DO_PUSH}" -eq 1 || "${DO_SYNC}" -eq 1 ]] || {
    usage
    exit 1
  }

  run_site_check

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
