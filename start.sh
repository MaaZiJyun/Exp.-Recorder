#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"
VENV_DIR="$PROJECT_DIR/.venv"
MOCK_MODE=0
OPEN_BROWSER=1
SKIP_INSTALL=0
BACKEND_PID=""
FRONTEND_PID=""

usage() {
  echo "Usage: ./start.sh [--mock] [--no-open]"
  echo ""
  echo "  --mock       Use simulated hardware"
  echo "  --no-open    Do not open the browser automatically"
  echo "  --help       Show this help"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --mock)
      MOCK_MODE=1
      ;;
    --no-open)
      OPEN_BROWSER=0
      ;;
    --skip-install)
      # Intended for CI/smoke tests that already provide dependencies.
      SKIP_INSTALL=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

for command_name in python3 node npm curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name" >&2
    exit 1
  fi
done

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
  for node_candidate in /opt/homebrew/opt/node@20/bin /usr/local/opt/node@20/bin; do
    if [ -x "$node_candidate/node" ] && "$node_candidate/node" -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
      PATH="$node_candidate:$PATH"
      export PATH
      break
    fi
  done
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 20 || (major === 20 && minor >= 19) ? 0 : 1)'; then
  echo "Node.js 20.19 or newer is required. Current version: $(node --version)" >&2
  exit 1
fi

if [ "$SKIP_INSTALL" -eq 0 ]; then
  if [ ! -x "$VENV_DIR/bin/python" ]; then
    echo "[setup] Creating Python virtual environment…"
    python3 -m venv "$VENV_DIR"
  fi

  REQUIREMENTS_MARKER="$VENV_DIR/.requirements-installed"
  if [ ! -f "$REQUIREMENTS_MARKER" ] || [ "$PROJECT_DIR/requirements.txt" -nt "$REQUIREMENTS_MARKER" ]; then
    echo "[setup] Installing Python dependencies…"
    "$VENV_DIR/bin/python" -m pip install --disable-pip-version-check -q -r "$PROJECT_DIR/requirements.txt"
    touch "$REQUIREMENTS_MARKER"
  fi
  PYTHON_BIN="$VENV_DIR/bin/python"

  if [ ! -d "$FRONTEND_DIR/node_modules" ] || [ "$FRONTEND_DIR/package-lock.json" -nt "$FRONTEND_DIR/node_modules/.package-lock.json" ]; then
    echo "[setup] Installing frontend dependencies…"
    npm --prefix "$FRONTEND_DIR" install
  fi
else
  if [ -x "$VENV_DIR/bin/python" ]; then
    PYTHON_BIN="$VENV_DIR/bin/python"
  else
    PYTHON_BIN="python3"
  fi
fi

cleanup() {
  trap - EXIT INT TERM
  echo ""
  echo "[stop] Shutting down Exp. Recorder…"
  if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  [ -z "$FRONTEND_PID" ] || wait "$FRONTEND_PID" 2>/dev/null || true
  [ -z "$BACKEND_PID" ] || wait "$BACKEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[start] Python hardware API → http://127.0.0.1:8000"
if [ "$MOCK_MODE" -eq 1 ]; then
  "$PYTHON_BIN" "$PROJECT_DIR/main.py" --mock &
else
  "$PYTHON_BIN" "$PROJECT_DIR/main.py" &
fi
BACKEND_PID=$!

BACKEND_READY=0
for _ in $(seq 1 30); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "Python API exited before startup completed." >&2
    exit 1
  fi
  if curl --fail --silent http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
    BACKEND_READY=1
    break
  fi
  sleep 1
done

if [ "$BACKEND_READY" -ne 1 ]; then
  echo "Timed out waiting for the Python API." >&2
  exit 1
fi

echo "[start] Next.js control panel → http://127.0.0.1:3000"
npm --prefix "$FRONTEND_DIR" run dev &
FRONTEND_PID=$!

READY=0
for _ in $(seq 1 60); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null || ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "A server exited before startup completed." >&2
    exit 1
  fi
  if curl --fail --silent http://127.0.0.1:3000/backend/health >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "Timed out waiting for Exp. Recorder to start." >&2
  exit 1
fi

echo "[ready] Exp. Recorder is running. Press Ctrl+C to stop."
if [ "$OPEN_BROWSER" -eq 1 ] && command -v open >/dev/null 2>&1; then
  open http://127.0.0.1:3000
fi

while kill -0 "$BACKEND_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done

echo "A server stopped unexpectedly." >&2
exit 1
