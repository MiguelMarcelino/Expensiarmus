#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="${ROOT}/backend"
FRONTEND="${ROOT}/frontend"
LOG_DIR="${ROOT}/.logs"
mkdir -p "${LOG_DIR}"

BACKEND_PID=""
FRONTEND_PID=""

bold() { printf "\033[1m%s\033[0m\n" "$*"; }

ensure_backend_env() {
  local env_file="${BACKEND}/.env"
  if [[ ! -f "${env_file}" ]]; then
    cat > "${env_file}" <<'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev_secret_change_me"
PORT=4000
EOF
    echo "Created backend/.env"
  fi
}

ensure_frontend_env() {
  local env_file="${FRONTEND}/.env"
  if [[ ! -f "${env_file}" ]]; then
    cat > "${env_file}" <<'EOF'
VITE_API_BASE="http://localhost:4000"
EOF
    echo "Created frontend/.env"
  fi
}

kill_group() {
  local pid="$1"
  if [[ -n "${pid}" ]] && ps -p "${pid}" >/dev/null 2>&1; then
    # Kill the entire process group started by this PID
    kill -TERM "-${pid}" 2>/dev/null || true
    for _ in {1..20}; do
      ps -p "${pid}" >/dev/null 2>&1 || break
      sleep 0.2
    done
    ps -p "${pid}" >/dev/null 2>&1 && kill -KILL "-${pid}" 2>/dev/null || true
  fi
}

stop_all() {
  echo "\nStopping processes..."
  # Prefer in-memory PIDs, fallback to pidfiles
  [[ -z "${BACKEND_PID}" && -f "${LOG_DIR}/backend.pid" ]] && BACKEND_PID="$(cat "${LOG_DIR}/backend.pid" || true)"
  [[ -z "${FRONTEND_PID}" && -f "${LOG_DIR}/frontend.pid" ]] && FRONTEND_PID="$(cat "${LOG_DIR}/frontend.pid" || true)"

  kill_group "${BACKEND_PID}"
  kill_group "${FRONTEND_PID}"

  rm -f "${LOG_DIR}/backend.pid" "${LOG_DIR}/frontend.pid"
  echo "Done."
}

trap 'echo; bold "Shutting down..."; stop_all; exit 0' INT TERM EXIT

start_backend() {
  bold "Installing backend deps..."
  (cd "${BACKEND}" && npm i)
  bold "Generating Prisma client..."
  (cd "${BACKEND}" && npx prisma generate)
  bold "Applying Prisma migrations..."
  (cd "${BACKEND}" && npx prisma migrate dev --name init --skip-generate || true)
  bold "Starting backend on http://localhost:4000 ..."
  (
    cd "${BACKEND}" && npm run dev > "${LOG_DIR}/backend.log" 2>&1 & echo $! > "${LOG_DIR}/backend.pid"
  )
  BACKEND_PID="$(cat "${LOG_DIR}/backend.pid" || true)"
  # wait for health
  for _ in {1..60}; do
    if curl -sf http://localhost:4000/health >/dev/null 2>&1; then
      echo "Backend is up."
      return 0
    fi
    sleep 0.5
  done
  echo "Warning: Backend health check did not pass in time." >&2
}

start_frontend() {
  bold "Installing frontend deps..."
  (cd "${FRONTEND}" && npm i)
  bold "Starting frontend (Vite) ..."
  (
    cd "${FRONTEND}" && npm run dev > "${LOG_DIR}/frontend.log" 2>&1 & echo $! > "${LOG_DIR}/frontend.pid"
  )
  FRONTEND_PID="$(cat "${LOG_DIR}/frontend.pid" || true)"
  echo "Frontend starting; check logs for URL (typically http://localhost:5173)."
}

bold "DivvyUp: Dev setup & run"
ensure_backend_env
ensure_frontend_env
start_backend
start_frontend

bold "Logs: ${LOG_DIR}"
bold "Backend: http://localhost:4000  |  Frontend: http://localhost:5173 (default)"

# Follow logs (Ctrl+C to stop; trap will clean up)
( tail -f "${LOG_DIR}/backend.log" & )
( tail -f "${LOG_DIR}/frontend.log" & )
wait
