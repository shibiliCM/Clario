Write-Host "=== Clario Frontend ===" -ForegroundColor Green

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $Root "frontend")

Write-Host "Installing npm packages..." -ForegroundColor Cyan
npm.cmd install

Write-Host ""
Write-Host "Starting React dev server at http://localhost:5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow

npm.cmd run dev -- --port 5173
