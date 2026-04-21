#!/bin/bash

cd "$(dirname "$0")"

# --- MongoDB via Docker ---
# CONTAINER=swagger-mongo
# MONGO_URI=mongodb://127.0.0.1:27017/swagger-scanner

# STATUS=$(docker inspect $CONTAINER --format '{{.State.Status}}' 2>/dev/null)

# if [ "$STATUS" = "running" ]; then
#   echo "✓ MongoDB already running"
# elif [ "$STATUS" = "exited" ] || [ "$STATUS" = "created" ]; then
#   echo "Starting existing MongoDB container..."
#   docker start $CONTAINER
# elif [ "$STATUS" = "dead" ] || [ -z "$STATUS" ]; then
#   echo "Creating fresh MongoDB container..."
#   docker rm -f $CONTAINER 2>/dev/null
#   docker run -d --name $CONTAINER -p 27017:27017 mongo:7
# fi

# # Wait for MongoDB to be ready
# echo "Waiting for MongoDB..."
# for i in $(seq 1 20); do
#   if docker exec $CONTAINER mongosh --quiet --eval "db.runCommand({ping:1})" >/dev/null 2>&1; then
#     echo "✓ MongoDB ready"
#     break
#   fi
#   sleep 1
# done

# Install dependencies
# echo "Installing dependencies..."
# npm install --registry https://registry.npmjs.org

# Kill leftover processes
# lsof -ti:3002 | xargs kill -9 2>/dev/null
# lsof -ti:4444 | xargs kill -9 2>/dev/null

echo ""
echo "Starting Swagger Scanner..."
echo "  Frontend: http://localhost:4444"
echo "  Backend:  http://localhost:3002"
echo "  MongoDB:  $MONGO_URI"
echo ""

# Start backend
MONGODB_URI=$MONGO_URI node server/index.js &
SERVER_PID=$!

trap "kill $SERVER_PID 2>/dev/null" EXIT

# Start frontend (foreground)
npx vite
