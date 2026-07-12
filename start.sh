#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PID_BACKEND=""

cleanup() {
    echo ""
    echo "Shutting down..."
    if [ -n "$PID_BACKEND" ] && kill -0 "$PID_BACKEND" 2>/dev/null; then
        kill "$PID_BACKEND" 2>/dev/null
        wait "$PID_BACKEND" 2>/dev/null
    fi
    exit 0
}

trap cleanup EXIT

echo "Better Scanner"
echo "=============="
echo ""

if [ ! -d "backend/.venv" ] || [ ! -d "frontend/node_modules" ]; then
    echo "Running first-time setup..."
    bash setup.sh
    echo ""
fi

echo "Starting backend..."
cd backend
source .venv/bin/activate
python main.py &
PID_BACKEND=$!
cd "$SCRIPT_DIR"

sleep 2

echo "Starting frontend..."
echo ""
echo "Backend:  http://localhost:8000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both"

cd frontend
npm start
