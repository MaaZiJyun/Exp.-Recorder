$ErrorActionPreference = "Stop"

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$FrontendDir = Join-Path $ProjectDir "frontend"
$VenvDir = Join-Path $ProjectDir ".venv-windows"
$MockMode = $false
$OpenBrowser = $true
$SkipInstall = $false
$BackendProcess = $null
$FrontendProcess = $null

function Show-Usage {
    Write-Host "Usage: .\start.ps1 [--mock] [--no-open]"
    Write-Host ""
    Write-Host "  --mock          Use simulated hardware"
    Write-Host "  --no-open       Do not open the browser automatically"
    Write-Host "  --skip-install  Skip project dependency installation"
    Write-Host "  --help          Show this help"
}

foreach ($Argument in $args) {
    switch ($Argument) {
        "--mock" { $MockMode = $true }
        "--no-open" { $OpenBrowser = $false }
        "--skip-install" { $SkipInstall = $true }
        { $_ -in @("--help", "-h") } { Show-Usage; exit 0 }
        default {
            Write-Error "Unknown option: $Argument"
            Show-Usage
            exit 2
        }
    }
}

function Update-ProcessPath {
    $MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$MachinePath;$UserPath"
}

function Install-WithWinget([string]$PackageId, [string]$DisplayName) {
    if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
        throw "$DisplayName is required, but winget is unavailable. Install $DisplayName and run this script again."
    }

    Write-Host "[setup] Installing $DisplayName with Windows Package Manager..."
    & winget.exe install --id $PackageId --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) {
        throw "winget could not install $DisplayName (exit code $LASTEXITCODE)."
    }
    Update-ProcessPath
}

function Find-Python {
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        $PythonPath = & py.exe -3 -c "import sys; print(sys.executable); raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) { return $PythonPath.Trim() }
    }
    if (Get-Command python.exe -ErrorAction SilentlyContinue) {
        $PythonPath = & python.exe -c "import sys; print(sys.executable); raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) { return $PythonPath.Trim() }
    }
    return $null
}

function Test-NodeVersion {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { return $false }
    & node.exe -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>20||(a===20&&b>=19)?0:1)"
    return ($LASTEXITCODE -eq 0)
}

$Python = Find-Python
if ($null -eq $Python) {
    Install-WithWinget "Python.Python.3.12" "Python 3.12"
    $Python = Find-Python
    if ($null -eq $Python) { throw "Python was installed but is not available in PATH. Open a new terminal and run start.bat again." }
}

if (-not (Test-NodeVersion)) {
    Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS (20.19 or newer)"
    if (-not (Test-NodeVersion)) { throw "Node.js was installed but a compatible version is not available in PATH. Open a new terminal and run start.bat again." }
}

$NpmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $NpmCommand) { throw "npm is unavailable. Repair the Node.js installation and try again." }

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
if (-not $SkipInstall) {
    if (-not (Test-Path $VenvPython)) {
        Write-Host "[setup] Creating Windows Python virtual environment..."
        & $Python -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) { throw "Failed to create the Python virtual environment." }
    }

    $RequirementsFile = Join-Path $ProjectDir "requirements.txt"
    $RequirementsMarker = Join-Path $VenvDir ".requirements-sha256"
    $RequirementsHash = (Get-FileHash $RequirementsFile -Algorithm SHA256).Hash
    $InstalledHash = if (Test-Path $RequirementsMarker) { (Get-Content $RequirementsMarker -Raw).Trim() } else { "" }
    if ($RequirementsHash -ne $InstalledHash) {
        Write-Host "[setup] Installing Python dependencies..."
        & $VenvPython -m pip install --disable-pip-version-check -r $RequirementsFile
        if ($LASTEXITCODE -ne 0) { throw "Failed to install Python dependencies." }
        Set-Content -Path $RequirementsMarker -Value $RequirementsHash -Encoding ASCII
    }

    $NodeModulesDir = Join-Path $FrontendDir "node_modules"
    $PackageLock = Join-Path $FrontendDir "package-lock.json"
    $NpmMarker = Join-Path $VenvDir ".frontend-package-lock-sha256"
    $PackageLockHash = (Get-FileHash $PackageLock -Algorithm SHA256).Hash
    $InstalledPackageLockHash = if (Test-Path $NpmMarker) { (Get-Content $NpmMarker -Raw).Trim() } else { "" }
    $NeedsNpmInstall = (-not (Test-Path $NodeModulesDir)) -or
        ($PackageLockHash -ne $InstalledPackageLockHash)
    if ($NeedsNpmInstall) {
        Write-Host "[setup] Installing frontend dependencies..."
        & $NpmCommand.Source --prefix $FrontendDir install
        if ($LASTEXITCODE -ne 0) { throw "Failed to install frontend dependencies." }
        Set-Content -Path $NpmMarker -Value $PackageLockHash -Encoding ASCII
    }
} elseif (-not (Test-Path $VenvPython)) {
    $VenvPython = $Python
}

function Test-Endpoint([string]$Url) {
    try {
        $Response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
        return ($Response.StatusCode -ge 200 -and $Response.StatusCode -lt 400)
    } catch {
        return $false
    }
}

function Wait-ForEndpoint([System.Diagnostics.Process]$Process, [string]$Url, [int]$Seconds, [string]$FailureMessage) {
    for ($Attempt = 0; $Attempt -lt $Seconds; $Attempt++) {
        if ($Process.HasExited) { throw "$FailureMessage The process exited with code $($Process.ExitCode)." }
        if (Test-Endpoint $Url) { return }
        Start-Sleep -Seconds 1
    }
    throw "$FailureMessage Timed out after $Seconds seconds."
}

try {
    Write-Host "[start] Python hardware API -> http://127.0.0.1:8000"
    $BackendArguments = '"{0}"' -f (Join-Path $ProjectDir "main.py")
    if ($MockMode) { $BackendArguments += " --mock" }
    $BackendProcess = Start-Process -FilePath $VenvPython -ArgumentList $BackendArguments -WorkingDirectory $ProjectDir -NoNewWindow -PassThru
    Wait-ForEndpoint $BackendProcess "http://127.0.0.1:8000/api/health" 30 "Python API did not start."

    Write-Host "[start] Next.js control panel -> http://127.0.0.1:3001"
    $FrontendArguments = '--prefix "{0}" run dev' -f $FrontendDir
    $FrontendProcess = Start-Process -FilePath $NpmCommand.Source -ArgumentList $FrontendArguments -WorkingDirectory $ProjectDir -NoNewWindow -PassThru
    Wait-ForEndpoint $FrontendProcess "http://127.0.0.1:3001/backend/health" 60 "Exp. Recorder did not start."

    Write-Host "[ready] Exp. Recorder is running. Press Ctrl+C to stop."
    if ($OpenBrowser) { Start-Process "http://127.0.0.1:3001" }

    while (-not $BackendProcess.HasExited -and -not $FrontendProcess.HasExited) {
        Start-Sleep -Seconds 1
    }
    throw "A server stopped unexpectedly."
} finally {
    Write-Host "`n[stop] Shutting down Exp. Recorder..."
    foreach ($Process in @($FrontendProcess, $BackendProcess)) {
        if ($null -ne $Process -and -not $Process.HasExited) {
            & taskkill.exe /PID $Process.Id /T /F 2>$null | Out-Null
        }
    }
}
