@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting Workspace Script Manager...

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if npm is installed
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not installed. Please install npm first.
    pause
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo 🔧 Starting backend server...
REM Start backend server in background
start /b npm run server

REM Wait for backend to start
timeout /t 3 /nobreak >nul

echo ✅ Backend server started
echo 🌐 Starting frontend development server...

REM Start frontend server
start /b npm start

REM Wait for frontend to start
timeout /t 5 /nobreak >nul

echo ✅ Frontend server started
echo.
echo 🎉 Workspace Script Manager is running!
echo 📱 Frontend: http://localhost:3000
echo 🔧 Backend:  http://localhost:3001
echo.
echo Press any key to stop both servers...
pause >nul

REM Kill all node processes (this will stop both servers)
taskkill /f /im node.exe >nul 2>&1

echo 🛑 Servers stopped
pause