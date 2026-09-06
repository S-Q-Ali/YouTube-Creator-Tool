# Niche-Scope one-click launcher (Windows).
# Double-click "Start Niche-Scope.bat" or call: powershell -File scripts\start.ps1
# Flags:  -ServerOnly   skip the background poller
#          -CheckOnly    verify the environment, then exit (no server/browser)
#          -NoShortcut   do not create/refresh the Desktop shortcut
param(
  [switch]$ServerOnly,
  [switch]$CheckOnly,
  [switch]$NoShortcut
)

$ErrorActionPreference = "Continue"

$root        = Split-Path -Parent $PSScriptRoot
$logPath     = Join-Path $env:TEMP "niche-scope-start.log"
$serverUrl   = "http://localhost:3000"
$batPath     = Join-Path $root "Start Niche-Scope.bat"

Add-Content -Path $logPath -Value ("===== " + (Get-Date) + " =====") -Encoding Ascii

function Log {
  param([string]$Line)
  $stamp = Get-Date -Format "HH:mm:ss"
  Add-Content -Path $logPath -Value "[$stamp] $Line" -Encoding Ascii
  Write-Host "[$stamp] $Line"
}

function Hat($Text) { Write-Host ""; Write-Host "=== $Text ===" }

function Fail {
  param([string]$Message)
  Log "FAIL: $Message"
  Write-Host ""
  Write-Host "Launch stopped. Details: $logPath" -ForegroundColor Yellow
  exit 1
}

# --- 1. Runtime ---------------------------------------------------------------

Hat "Niche-Scope one-click start"

$nodeVersion = ""
try { $nodeVersion = (& node -v 2>$null) } catch { $nodeVersion = "" }
$nodeVersion = "$nodeVersion".Trim()
if (-not $nodeVersion -or -not $nodeVersion.StartsWith("v")) {
  Log "Node.js not found on PATH."
  Write-Host "Install Node.js LTS from https://nodejs.org then run this again." -ForegroundColor Yellow
  try { Start-Process "https://nodejs.org" } catch { }
  exit 1
}
$nodeMajor = 0
if ($nodeVersion -match "^v(\d+)\.") { $nodeMajor = [int]$Matches[1] }
Log "Node $nodeVersion detected"
if ($nodeMajor -lt 22) {
  Log "WARN: node:sqlite needs Node 22.5+ (experimental); Node 23.4+ recommended. Upgrade if things fail."
} elseif ($nodeMajor -lt 24) {
  Log "Node $nodeMajor is OK (node:sqlite works; Node 24 recommended)"
}

$npmOk = $true
try { $null = (& npm.cmd -v 2>$null) } catch { $npmOk = $false }
if (-not $npmOk) { Fail "npm not found (npm.cmd must resolve on PATH)" }

# --- 2. Dependencies ----------------------------------------------------------

Hat "Dependencies"
if (Test-Path (Join-Path $root "node_modules\next")) {
  Log "node_modules exists - skipping npm install"
} else {
  Log "node_modules missing - running npm install (first run only)"
  Push-Location $root
  try {
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "npm install failed (exit $LASTEXITCODE)" }
  } catch {
    Pop-Location
    Fail "npm install error: $($_.Exception.Message)"
  }
  Pop-Location
  Log "npm install finished"
}

# --- 3. Setup checks (env, DB, yt-dlp auto-download) --------------------------

Hat "Setup checks"
Push-Location $root
& npm.cmd run setup
$setupCode = $LASTEXITCODE
Pop-Location
Log "npm run setup exit code = $setupCode"
if ($setupCode -ne 0) {
  Write-Host "Fix the items marked X above, then re-run." -ForegroundColor Yellow
  exit 1
}

if ($CheckOnly) {
  Log "CHECK ONLY: environment OK, server not started"
  Write-Host ""
  Write-Host "All checks passed." -ForegroundColor Green
  exit 0
}

# --- 4. Port 3000 guard -------------------------------------------------------

Hat "Server"
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  $alreadyUp = $false
  try {
    $probe = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 4
    if ($probe.StatusCode -eq 200) { $alreadyUp = $true }
  } catch { $alreadyUp = $false }
  if ($alreadyUp) {
    Log "Server already running at $serverUrl - opening browser"
    try { Start-Process $serverUrl } catch { }
    exit 0
  }
  Log "WARN: port 3000 is busy but not responding - the server may start on 3001"
}

# --- 5. Start server (+ poller in full mode) -----------------------------------

$scriptName = if ($ServerOnly) { "run dev" } else { "run dev:full" }
Log "Starting: npm.cmd $scriptName in a new window"
$cmdArgs = "title Niche-Scope Server & cd /d ""$root"" & npm.cmd $scriptName"
$serverPid = $null
try {
  $proc = Start-Process -FilePath "cmd.exe" -ArgumentList "/k", $cmdArgs -WorkingDirectory $root -PassThru
  $serverPid = $proc.Id
  Log "Server window started (PID $serverPid)"
} catch {
  Fail "Could not start server window: $($_.Exception.Message)"
}

# --- 6. Health check + auto-open browser ---------------------------------------

$started = Get-Date
$up = $false
$foundUrl = $serverUrl
Write-Host "Waiting for $serverUrl" -NoNewline
while ((Get-Date) -lt $started.AddSeconds(120)) {
  if ($serverPid -and (Get-Process -Id $serverPid -ErrorAction SilentlyContinue) -eq $null) {
    break
  }
  try {
    $r = Invoke-WebRequest -Uri $serverUrl -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $up = $true; break }
  } catch {
  }
  Start-Sleep -Milliseconds 900
  Write-Host "." -NoNewline
}

if (-not $up) {
  try {
    $r3001 = Invoke-WebRequest -Uri "http://localhost:3001" -UseBasicParsing -TimeoutSec 3
    if ($r3001.StatusCode -eq 200) { $up = $true; $foundUrl = "http://localhost:3001" }
  } catch { $up = $false }
}

Write-Host ""
if ($up) {
  Log "Server is up at $foundUrl"
  try { Start-Process $foundUrl } catch { }
  if (-not $NoShortcut) {
    $desktop = [Environment]::GetFolderPath("Desktop")
    $lnk = Join-Path $desktop "Niche-Scope.lnk"
    if (-not (Test-Path $lnk)) {
      try {
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut($lnk)
        $sc.TargetPath = $batPath
        $sc.WorkingDirectory = $root
        $sc.Description = "Start Niche-Scope (one-click)"
        $sc.IconLocation = "shell32.dll,184"
        $sc.Save()
        Log "Desktop shortcut created: $lnk"
      } catch {
        Log "Could not create Desktop shortcut: $($_.Exception.Message)"
      }
    }
  }
  Write-Host ""
  Write-Host "Niche-Scope is running." -ForegroundColor Green
  Write-Host "The 'Niche-Scope Server' window shows logs - keep it open." -ForegroundColor Green
  Write-Host "You can close this launcher window now." -ForegroundColor DarkCyan
  exit 0
} else {
  Log "Server did not come up within 120s"
  Write-Host "Server failed to start. See the 'Niche-Scope Server' window and $logPath" -ForegroundColor Yellow
  exit 1
}