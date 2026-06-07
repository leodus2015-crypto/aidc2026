#!/usr/bin/env bash
# 生产环境启动 Config API（无 --reload，仅监听本机，由 Nginx 反代 /api/）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_DIR="${ROOT}/api"
PORT="${API_PORT:-8012}"
BIND="${API_BIND:-127.0.0.1}"

if [[ ! -f "${ROOT}/.env" ]]; then
  echo "错误：未找到 ${ROOT}/.env" >&2
  exit 1
fi

python3 -c "import fastapi, uvicorn, pymysql" 2>/dev/null || {
  echo "安装 API 依赖…" >&2
  python3 -m pip install -r "${API_DIR}/requirements.txt"
}

echo "Starting AIDC Config API (production):" >&2
echo "  root : ${ROOT}" >&2
echo "  bind : ${BIND}:${PORT}" >&2
echo "  health: http://${BIND}:${PORT}/api/health" >&2

cd "${API_DIR}"
exec python3 -m uvicorn main:app --host "${BIND}" --port "${PORT}" --workers 1
