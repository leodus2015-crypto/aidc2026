#!/usr/bin/env bash
# 在云服务器 aidc 项目根目录执行，检查 .env、数据库与 API 是否正常
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

echo "== 1. 项目根目录 =="
echo "   ${ROOT}"
echo

echo "== 2. .env =="
if [[ -f "${ROOT}/.env" ]]; then
  echo "   ✓ 找到 .env"
  # 只打印键名，不泄露密码
  grep -E '^[A-Z_]+=' "${ROOT}/.env" | cut -d= -f1 | sed 's/^/   - /'
else
  echo "   ✗ 未找到 ${ROOT}/.env"
  echo "     请确认 .env 在 aidc 仓库根目录，而不是 /root 或其他路径"
  exit 1
fi
echo

echo "== 3. Python 依赖 =="
python3 -c "import fastapi, uvicorn, pymysql; print('   ✓ fastapi / uvicorn / pymysql')"
echo

echo "== 4. 数据库连接（通过 API 模块） =="
python3 <<'PY'
import sys
sys.path.insert(0, "api")
from db import ping_database, get_db_error
from settings import DATABASE_HOST, DATABASE_NAME, DATABASE_USER

print(f"   HOST={DATABASE_HOST or '(空)'}  DB={DATABASE_NAME}  USER={DATABASE_USER or '(空)'}")
if ping_database():
    print("   ✓ MySQL 连接成功")
else:
    print(f"   ✗ MySQL 连接失败: {get_db_error()}")
    sys.exit(1)
PY
echo

echo "== 5. 配置表数据 =="
python3 <<'PY'
import sys
sys.path.insert(0, "api")
from db import fetch_config
for key in ("roi.defaults", "roi.cloud_compare", "dc3d.case_a", "dc3d.case_b"):
    row = fetch_config(key)
    if row:
        print(f"   ✓ {key}  version={row.get('version')}")
    else:
        print(f"   ○ {key}  尚未导入（可执行: python3 scripts/seed-config.py）")
PY
echo

PORT="${API_PORT:-8012}"
echo "== 6. API 进程（可选） =="
if curl -sf "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
  curl -s "http://127.0.0.1:${PORT}/api/health" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:${PORT}/api/health"
  echo
else
  echo "   ○ API 未在 127.0.0.1:${PORT} 监听"
  echo "     请先执行: ./start-api-prod.sh  或  ./start-api-8012.sh"
fi
echo
echo "完成。若 4、5 通过，可启动 API 并用 Nginx 反代 /api/ 后访问网站。"
