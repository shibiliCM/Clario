Write-Host "=== Clario Backend ===" -ForegroundColor Green

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Venv = Join-Path $Backend ".venv"
$VenvPython = Join-Path $Venv "Scripts\python.exe"

Set-Location $Backend

function Test-Python {
    param([string]$Command)
    try {
        & $Command --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Find-Python {
    $Candidates = @(
        "python",
        "py",
        "python3",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "$env:ProgramFiles\Python312\python.exe",
        "$env:ProgramFiles\Python311\python.exe",
        (Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe")
    )
    foreach ($candidate in $Candidates) {
        if (Test-Python $candidate) {
            return $candidate
        }
    }
    return $null
}

$NeedsVenv = $true
if (Test-Path $VenvPython) {
    try {
        & $VenvPython --version *> $null
        $NeedsVenv = $LASTEXITCODE -ne 0
    } catch {
        $NeedsVenv = $true
    }
}

if ($NeedsVenv -and (Test-Path $Venv)) {
    $Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $Backup = Join-Path $Backend ".venv.broken-$Stamp"
    Write-Host "Existing backend virtual environment is broken. Moving it to $Backup" -ForegroundColor Yellow
    Move-Item -Path $Venv -Destination $Backup
}

if ($NeedsVenv) {
    $Python = Find-Python
    if (-not $Python) {
        Write-Host "Python was not found. Install Python 3.11+ and rerun this script." -ForegroundColor Red
        exit 1
    }
    Write-Host "Creating backend virtual environment..." -ForegroundColor Cyan
    & $Python -m venv $Venv
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
& $VenvPython -m pip install --upgrade pip --quiet
& $VenvPython -m pip install -r requirements.txt --quiet

Write-Host ""
Write-Host "Starting FastAPI server at http://localhost:8000" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

& $VenvPython -m uvicorn rag_chatbot:app --host 0.0.0.0 --port 8000 --reload
