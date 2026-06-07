#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="${ROOT}/api"
PORT="${API_PORT:-8012}"
BIND="${API_BIND:-127.0.0.1}"

if [[ ! -f "${ROOT}/.env" ]]; then
  echo "提示：未找到 ${ROOT}/.env，API 将无法连接 MySQL（前端将自动使用本地默认）。" >&2
  echo "可复制 .env.example 为 .env 并填写云 MySQL 信息。" >&2
fi

if ! python3 -c "import fastapi" 2>/dev/null; then
  echo "安装 API 依赖…" >&2
  python3 -m pip install -r "${API_DIR}/requirements.txt"
fi

echo "Starting AIDC Config API:" >&2
echo "  bind : ${BIND}:${PORT}" >&2
echo "  health: http://${BIND}:${PORT}/api/health" >&2
echo "  静态预览仍用 preview-8011.sh（8011 页会自动连 ${BIND}:${PORT}）" >&2

cd "${API_DIR}"
exec python3 -m uvicorn main:app --host "${BIND}" --port "${PORT}" --reload
