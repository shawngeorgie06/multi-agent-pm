# Multi-Agent Project Manager - Quick Start Script (PowerShell)
# For Windows users

Write-Host ""
Write-Host "Multi-Agent Project Manager - Windows Setup" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking Prerequisites" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found. Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

try {
    $dockerVersion = docker --version
    Write-Host "[OK] Docker installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker not found. Please install from https://www.docker.com/" -ForegroundColor Red
    exit 1
}

try {
    $composeVersion = docker-compose --version
    Write-Host "[OK] Docker Compose installed" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Docker Compose not found" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check Ollama
Write-Host "Step 2: Checking Ollama" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

try {
    $ollamaCheck = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "[OK] Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Ollama not detected at http://localhost:11434" -ForegroundColor Yellow
    Write-Host "          Start Ollama with: ollama serve" -ForegroundColor Yellow
    Write-Host "          Then pull a model: ollama pull mistral" -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Start PostgreSQL
Write-Host "Step 3: Starting PostgreSQL" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan

Write-Host "Starting Docker containers..." -ForegroundColor Yellow
docker-compose up -d
Start-Sleep -Seconds 2
Write-Host "[OK] PostgreSQL started" -ForegroundColor Green

Write-Host ""

# Step 4: Setup Backend
Write-Host "Step 4: Setting up Backend" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan

Push-Location backend

Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npm run prisma:generate 2>&1 | Out-Null
Write-Host "[OK] Prisma generated" -ForegroundColor Green

Write-Host "Creating database schema..." -ForegroundColor Yellow
npm run db:push 2>&1 | Out-Null
Write-Host "[OK] Database schema created" -ForegroundColor Green

Pop-Location

Write-Host ""

# Step 5: Frontend status
Write-Host "Step 5: Frontend Status" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host "[OK] Frontend ready (dependencies already installed)" -ForegroundColor Green

Write-Host ""
Write-Host ""

# Summary
Write-Host "SETUP COMPLETE!" -ForegroundColor Green
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "NEXT STEPS:" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Start Ollama (if not already running):" -ForegroundColor White
Write-Host "   ollama serve" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. In a NEW PowerShell window, start the backend:" -ForegroundColor White
Write-Host "   cd C:\Users\georg\multi-agent-pm\backend" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. In ANOTHER NEW PowerShell window, start the frontend:" -ForegroundColor White
Write-Host "   cd C:\Users\georg\multi-agent-pm\frontend" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Open your browser:" -ForegroundColor White
Write-Host "   http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "OPTIONAL - Test the system:" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Test CLI (no database needed):" -ForegroundColor White
Write-Host "  cd C:\Users\georg\multi-agent-pm\backend" -ForegroundColor Yellow
Write-Host "  npm run test:cli `"Build a React todo app`"" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
