# Multi-Agent PM - Start All Services
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Multi-Agent PM - Starting All Services" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if in correct directory
if (-not (Test-Path "backend/package.json") -or -not (Test-Path "frontend/package.json")) {
    Write-Host "ERROR: Not in multi-agent-pm root directory" -ForegroundColor Red
    Write-Host "Please run this script from: C:\Users\georg\multi-agent-pm" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if Ollama is running
Write-Host "[0/3] Checking Ollama..." -ForegroundColor Yellow
try {
    $null = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "OK - Ollama is running" -ForegroundColor Green
} catch {
    Write-Host "WARNING - Ollama not detected, make sure it is running!" -ForegroundColor Yellow
    Write-Host "Start Ollama with: ollama serve" -ForegroundColor Yellow
}

Write-Host ""

# Start Backend
Write-Host "[1/3] Starting Backend on port 3001..." -ForegroundColor Yellow
$backendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd backend && npm run dev" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "[2/3] Starting Frontend on port 5173..." -ForegroundColor Yellow
$frontendProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd frontend && npm run dev" -PassThru -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host "Services Started!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend:  http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Process IDs:" -ForegroundColor Gray
Write-Host "  Backend:  $($backendProcess.Id)" -ForegroundColor Gray
Write-Host "  Frontend: $($frontendProcess.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "Close terminal windows to stop services" -ForegroundColor Gray
Write-Host ""
