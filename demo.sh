#!/usr/bin/env bash
# demo.sh — one-shot launcher for a live GeoEdge demo
#
# Usage:
#   bash demo.sh          # build + start everything
#   bash demo.sh --dev    # use vite dev (hot reload) instead of prod preview
#   bash demo.sh --stop   # tear down
#
# Gates:
#   - docker + docker compose available
#   - .env present (copy .env.example if missing)
#   - port 3000 + 8000 + 5434 free
#
# After launch, demo is ready at http://192.168.1.93:3000 (LAN) or
# http://localhost:3000 (local).
set -e

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

MODE="preview"
if [ "${1:-}" = "--dev" ]; then MODE="dev"; fi
if [ "${1:-}" = "--stop" ]; then
  docker compose down
  echo "[demo.sh] stack stopped"
  exit 0
fi

# ── 1. Preflight ──────────────────────────────────────────────────────────
if [ ! -f .env ]; then
  echo "[demo.sh] .env missing, copying from .env.example"
  cp .env.example .env
  echo "[demo.sh] WARNING: fill .env with real secrets before proceeding"
  exit 1
fi

command -v docker >/dev/null || { echo "[demo.sh] docker not found"; exit 1; }
docker compose version >/dev/null || { echo "[demo.sh] docker compose v2 not found"; exit 1; }

# ── 2. Backend stack (Postgres + FastAPI) ─────────────────────────────────
echo "[demo.sh] starting backend + db…"
docker compose up -d db backend
for i in $(seq 1 30); do
  if curl -sf -o /dev/null -m 1 http://localhost:8000/health; then
    echo "[demo.sh] backend healthy"
    break
  fi
  sleep 1
done

# ── 3. Deep health check ──────────────────────────────────────────────────
echo "[demo.sh] deep health:"
curl -s "http://localhost:8000/health?deep=1" | python -m json.tool || true

# ── 4. Frontend ────────────────────────────────────────────────────────────
cd frontend

if [ "$MODE" = "dev" ]; then
  echo "[demo.sh] starting vite dev…"
  npx vite --host 0.0.0.0 --port 3000 &
else
  if [ ! -d dist ]; then
    echo "[demo.sh] building frontend (vite build)…"
    npx vite build
  fi
  echo "[demo.sh] starting vite preview (prod build)…"
  npx vite preview --host 0.0.0.0 --port 3000 &
fi

VITE_PID=$!

# Wait for frontend
for i in $(seq 1 30); do
  if curl -sf -o /dev/null -m 1 http://localhost:3000/; then
    echo "[demo.sh] frontend ready on http://localhost:3000"
    break
  fi
  sleep 1
done

cat <<EOF

╭─────────────────────────────────────────────────────────────────╮
│  GeoEdge demo READY                                             │
╞═════════════════════════════════════════════════════════════════╡
│  Frontend   http://localhost:3000   or http://192.168.1.93:3000 │
│  Backend    http://localhost:8000                               │
│  API docs   http://localhost:8000/docs                          │
│                                                                 │
│  Demo login: demo@para-oracle.app / demo1234 (pre-filled)      │
│                                                                 │
│  Read DEMO_SCRIPT.md for the 3-minute narration.               │
│                                                                 │
│  Stop:      bash demo.sh --stop   (+ kill the vite pid above)  │
╰─────────────────────────────────────────────────────────────────╯
EOF

wait "$VITE_PID"
