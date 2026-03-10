#!/bin/bash
echo "Starting Curvature Agent Home Office..."

# 1. Install dependencies
echo "Installing Python & Node dependencies..."
pip install -r backend/requirements.txt websockets > /dev/null 2>&1
npm install ws http-proxy-middleware express cors > /dev/null 2>&1

# 2. Kill existing processes
kill $(ps aux | grep "backend/app.py" | grep -v grep | awk '{print $2}') 2>/dev/null || true
kill $(ps aux | grep "backend/event_bus.py" | grep -v grep | awk '{print $2}') 2>/dev/null || true
kill $(ps aux | grep "node proxy.js" | grep -v grep | awk '{print $2}') 2>/dev/null || true

# 3. Start services
export STAR_BACKEND_PORT=19001
nohup python3 backend/app.py > backend.log 2>&1 &
nohup python3 backend/event_bus.py > event_bus.log 2>&1 &
sleep 2
nohup node proxy.js > proxy.log 2>&1 &

echo "✅ Deployment Successful! Access: http://127.0.0.1:19000"
