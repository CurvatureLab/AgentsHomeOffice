#!/bin/bash
echo "Starting Curvature Agent Home Office..."

# 1. Install dependencies (skip in Docker where they are pre-installed)
if [ -z "$DOCKER_ENV" ]; then
  echo "Installing Python & Node dependencies..."
  pip install -r backend/requirements.txt websockets > /dev/null 2>&1
  npm install ws http-proxy express cors > /dev/null 2>&1

  # Kill existing processes (local dev only)
  kill $(ps aux | grep "backend/app.py" | grep -v grep | awk '{print $2}') 2>/dev/null || true
  kill $(ps aux | grep "backend/event_bus.py" | grep -v grep | awk '{print $2}') 2>/dev/null || true
  kill $(ps aux | grep "node proxy.js" | grep -v grep | awk '{print $2}') 2>/dev/null || true
fi

# 2. Start backend services in background
export STAR_BACKEND_PORT=19001
python3 backend/app.py &
python3 backend/event_bus.py &
sleep 2

echo "✅ Deployment Successful! Access: http://127.0.0.1:${PORT:-8080}"

# 3. Start proxy as foreground process (keeps container alive)
exec node proxy.js
