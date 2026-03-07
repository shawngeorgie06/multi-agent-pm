@echo off
setlocal enabledelayedexpansion

echo.
echo ======================================
echo Multi-Agent PM - Starting All Services
echo ======================================
echo.

REM Check if we're in the right directory
if not exist "backend\package.json" (
    echo ERROR: backend/package.json not found
    echo Please run this script from the multi-agent-pm root directory
    pause
    exit /b 1
)

if not exist "frontend\package.json" (
    echo ERROR: frontend/package.json not found
    echo Please run this script from the multi-agent-pm root directory
    pause
    exit /b 1
)

REM Start Backend
echo [1/3] Starting Backend on port 3001...
start "Multi-Agent PM - Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak

REM Start Frontend
echo [2/3] Starting Frontend on port 5173...
start "Multi-Agent PM - Frontend" cmd /k "cd frontend && npm run dev"
timeout /t 2 /nobreak

echo.
echo ======================================
echo Services Started!
echo ======================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
echo NOTE: Make sure Ollama is running!
echo        Start Ollama with: ollama serve
echo.
echo Close any window to stop that service
echo.
pause
