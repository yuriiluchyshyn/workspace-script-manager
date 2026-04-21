#!/bin/bash

# Simple run script using npm concurrently
echo "🚀 Starting Workspace Script Manager..."

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

echo "🎉 Starting both servers with concurrently..."
echo "📱 Frontend will be available at: http://localhost:3000"
echo "🔧 Backend will be available at: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop both servers"

# Run both servers using concurrently
npm run dev