#!/usr/bin/env bash
set -euo pipefail

# Fixed preview port (avoid historically flaky :8001 setups).
PORT="${PREVIEW_PORT:-8011}"
BIND="${PREVIEW_BIND:-127.0.0.1}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  echo "用法:" >&2
  echo "  $0                 启动静态预览（无监听时）" >&2
  echo "  $0 --stop | -s     停止本机 ${PORT} 端口的预览进程" >&2
  echo "  $0 --help | -h     显示帮助" >&2
  echo "环境变量: PREVIEW_PORT、PREVIEW_BIND" >&2
}

case "${1:-}" in
  --help|-h)
    usage
    exit 0
    ;;
  --stop|-s)
    if ! lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "未发现监听 ${BIND}:${PORT} 的进程" >&2
      exit 0
    fi
    while read -r pid; do
      [[ -z "${pid}" ]] && continue
      kill "${pid}" 2>/dev/null || true
      echo "已停止 PID ${pid}（端口 ${PORT}）" >&2
    done < <(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null)
    exit 0
    ;;
  "")
    ;;
  *)
    echo "未知参数: $1" >&2
    usage
    exit 1
    ;;
esac

if lsof -nP -iTCP:"${PORT}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Preview server already listening on ${BIND}:${PORT}" >&2
  echo "Open: http://${BIND}:${PORT}/aidc/index.html" >&2
  echo "停止预览可执行: $(basename "$0") --stop" >&2
  exit 0
fi

echo "Starting preview server:" >&2
echo "  root : ${ROOT_DIR}" >&2
echo "  bind : ${BIND}" >&2
echo "  port : ${PORT}" >&2
echo "  url  : http://${BIND}:${PORT}/aidc/index.html" >&2

cd "${ROOT_DIR}"
exec python3 -m http.server "${PORT}" --bind "${BIND}"
