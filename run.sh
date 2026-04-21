#!/bin/bash

# Workspace Script Manager - Run Script

SCRIPT_PID=$$
echo "🚀 Starting Workspace Script Manager..."

# Kill processes on a port
kill_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pids" ]; then
        echo "🛑 Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -TERM 2>/dev/null
        sleep 1
        # Force kill if still alive
        local remaining=$(lsof -ti :$port 2>/dev/null)
        [ -n "$remaining" ] && echo "$remaining" | xargs kill -9 2>/dev/null && sleep 1
    fi
}

# Kill previous server processes, but NOT this script itself
kill_previous() {
    echo "🧹 Cleaning up previous processes..."

    # Kill node server/index.js (backend)
    local pids=$(pgrep -f "node server/index.js" 2>/dev/null)
    if [ -n "$pids" ]; then
        # Filter out current script's process group
        for pid in $pids; do
            [ "$pid" != "$SCRIPT_PID" ] && kill -TERM "$pid" 2>/dev/null
        done
        sleep 1
    fi

    # Kill react-scripts start (frontend) — very specific match
    pgrep -f "react-scripts/scripts/start" 2>/dev/null | xargs kill -TERM 2>/dev/null
    sleep 1

    # Clean up ports as fallback
    kill_port 3001
    kill_port 3000

    sleep 1
    echo "✅ Cleanup done"
}

cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    [ -n "$BACKEND_PID" ]  && kill $BACKEND_PID  2>/dev/null
    [ -n "$FRONTEND_PID" ] && kill $FRONTEND_PID 2>/dev/null
    wait
    exit 0
}
trap cleanup SIGINT SIGTERM

kill_previous

command -v node &>/dev/null || { echo "❌ Node.js not found"; exit 1; }
command -v npm  &>/dev/null || { echo "❌ npm not found";    exit 1; }

[ ! -d "node_modules" ] && { echo "📦 Installing dependencies..."; npm install || exit 1; }

echo "🔧 Starting backend server..."
npm run server &
BACKEND_PID=$!
sleep 2

kill -0 $BACKEND_PID 2>/dev/null || { echo "❌ Failed to start backend"; exit 1; }
echo "✅ Backend started (PID: $BACKEND_PID)"

echo "🌐 Starting frontend..."
npm start &
FRONTEND_PID=$!
sleep 3

kill -0 $FRONTEND_PID 2>/dev/null || { echo "❌ Failed to start frontend"; kill $BACKEND_PID 2>/dev/null; exit 1; }
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

wait