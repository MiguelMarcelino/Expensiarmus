#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND="${ROOT}/backend"
FRONTEND="${ROOT}/frontend"
LOG_DIR="${ROOT}/.logs"
mkdir -p "${LOG_DIR}"

bold() { printf "\033[1m%s\033[0m\n" "$*"; }

ensure_backend_env() {
  local env_file="${BACKEND}/.env"
  if [[ ! -f "${env_file}" ]]; then
    cat > "${env_file}" <<'EOF'
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev_secret_change_me"
OPENAI_API_KEY=""
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

start_backend() {
  bold "Installing backend deps..."
  (cd "${BACKEND}" && npm i)
  bold "Generating Prisma client..."
  (cd "${BACKEND}" && npx prisma generate)
  bold "Applying Prisma migrations..."
  (cd "${BACKEND}" && npx prisma migrate dev --name init --skip-generate || true)
  bold "Starting backend on http://localhost:4000 ..."
  (cd "${BACKEND}" && npm run dev > "${LOG_DIR}/backend.log" 2>&1 & echo $! > "${LOG_DIR}/backend.pid")
  sleep 0.5
  # wait for health
  for i in {1..60}; do
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
  (cd "${FRONTEND}" && npm run dev > "${LOG_DIR}/frontend.log" 2>&1 & echo $! > "${LOG_DIR}/frontend.pid")
  echo "Frontend starting; check logs for URL (typically http://localhost:5173)."
}

stop_all() {
  for pidfile in "${LOG_DIR}/backend.pid" "${LOG_DIR}/frontend.pid"; do
    if [[ -f "${pidfile}" ]]; then
      PID=$(cat "${pidfile}" || true)
      if [[ -n "${PID}" ]] && ps -p "${PID}" >/dev/null 2>&1; then
        kill "${PID}" 2>/dev/null || true
      fi
      rm -f "${pidfile}"
    fi
  done
}

trap stop_all EXIT INT TERM

bold "ExpensiArmus: Dev setup & run"
ensure_backend_env
ensure_frontend_env
start_backend
start_frontend

bold "Logs: ${LOG_DIR}"
bold "Backend: http://localhost:4000  |  Frontend: http://localhost:5173 (default)"

# Follow logs
( tail -f "${LOG_DIR}/backend.log" & )
( tail -f "${LOG_DIR}/frontend.log" & )
wait
