#!/usr/bin/env bash
# 将本机 aidc 静态站 rsync 到华为云 ECS（阶段 1 冷备，与 deploy.sh 排除规则一致）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

ENV_FILE="${ROOT}/deploy.env.huawei"
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "错误：未找到 deploy.env.huawei" >&2
  echo "  cp deploy.env.huawei.example deploy.env.huawei 并填写 HUAWEI_DEPLOY_HOST" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "${ENV_FILE}"

: "${HUAWEI_DEPLOY_HOST:?请在 deploy.env.huawei 中设置 HUAWEI_DEPLOY_HOST}"
: "${HUAWEI_DEPLOY_PORT:=22}"
: "${HUAWEI_DEPLOY_USER:?请在 deploy.env.huawei 中设置 HUAWEI_DEPLOY_USER}"
: "${HUAWEI_DEPLOY_PATH:?请在 deploy.env.huawei 中设置 HUAWEI_DEPLOY_PATH}"
HUAWEI_DEPLOY_SSH_KEY="${HUAWEI_DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
HUAWEI_DEPLOY_OWNER="${HUAWEI_DEPLOY_OWNER:-www:www}"

SSH_OPTS=(-p "${HUAWEI_DEPLOY_PORT}" -i "${HUAWEI_DEPLOY_SSH_KEY}" -o StrictHostKeyChecking=accept-new)
REMOTE_SPEC="${HUAWEI_DEPLOY_USER}@${HUAWEI_DEPLOY_HOST}:${HUAWEI_DEPLOY_PATH}/"

RSYNC_EXCLUDES=(
  --exclude '.git/'
  --exclude '.github/'
  --exclude '.env'
  --exclude 'deploy.env'
  --exclude 'deploy.env.huawei'
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

if [[ -n "${HUAWEI_DEPLOY_EXTRA_EXCLUDES:-}" ]]; then
  IFS=',' read -ra EXTRA <<< "${HUAWEI_DEPLOY_EXTRA_EXCLUDES}"
  for item in "${EXTRA[@]}"; do
    RSYNC_EXCLUDES+=(--exclude "${item}")
  done
fi

echo ">> [华为] rsync → ${REMOTE_SPEC}"
rsync -avz --delete "${RSYNC_EXCLUDES[@]}" \
  -e "ssh ${SSH_OPTS[*]}" \
  "${ROOT}/" "${REMOTE_SPEC}"

echo ">> [华为] 修正属主 ${HUAWEI_DEPLOY_OWNER}"
ssh "${SSH_OPTS[@]}" "${HUAWEI_DEPLOY_USER}@${HUAWEI_DEPLOY_HOST}" \
  "chown ${HUAWEI_DEPLOY_OWNER} '${HUAWEI_DEPLOY_PATH}' && find '${HUAWEI_DEPLOY_PATH}' -mindepth 1 ! -name '.user.ini' -exec chown ${HUAWEI_DEPLOY_OWNER} {} + && find '${HUAWEI_DEPLOY_PATH}' -type d -exec chmod 755 {} \\; && find '${HUAWEI_DEPLOY_PATH}' -type f ! -name '.user.ini' -exec chmod 644 {} \\; && find '${HUAWEI_DEPLOY_PATH}' -type f -name '*.sh' -exec chmod 755 {} +"

echo ">> [华为] 关键文件检查"
ssh "${SSH_OPTS[@]}" "${HUAWEI_DEPLOY_USER}@${HUAWEI_DEPLOY_HOST}" \
  "test -f '${HUAWEI_DEPLOY_PATH}/ai-dc-design.html' && test -f '${HUAWEI_DEPLOY_PATH}/data/asset-version.json'" \
  && echo "   ✓ ai-dc-design.html / asset-version.json 存在" \
  || { echo "   ✗ 关键文件缺失" >&2; exit 1; }

if [[ -n "${HUAWEI_SITE_URL:-}" ]] && command -v curl >/dev/null 2>&1; then
  ver="$(python3 "${ROOT}/scripts/bump-asset-version.py" --show 2>/dev/null || echo '?')"
  base="${HUAWEI_SITE_URL%/}"
  echo ">> [华为] HTTP 探测 ${base}"
  curl -sf "${base}/data/asset-version.json" | python3 -m json.tool 2>/dev/null || echo "   （URL 未通或未配 HTTPS，可忽略）"
  curl -s -o /dev/null -w "   ${base}/ai-dc-design.html → HTTP %{http_code}\n" "${base}/ai-dc-design.html" || true
fi

echo ">> [华为] 同步完成"
