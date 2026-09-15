# ============================================================
#  ROIReaper — локальный лаунчер
#  Поднимает крошечный сервер на localhost, собирает сведения о ПК
#  и открывает приложение в режиме "как программа" (Edge/Chrome --app).
#  Работает с флешки, без установки и без прав администратора.
# ============================================================
param(
  [string]$Mode = "Portable",
  [int]$Port = 18721
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
. (Join-Path $root "sysinfo.ps1")

$appDir = Join-Path $root "app"
$profileDir = Join-Path $root "profile"
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null

# ---- поиск браузера ----
function Find-Browser {
  $candidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
    "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
    "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe"
  )
  foreach ($c in $candidates) { if ($c -and (Test-Path $c)) { return $c } }
  foreach ($exe in @("msedge.exe", "chrome.exe", "brave.exe")) {
    try {
      $reg = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\$exe" -ErrorAction Stop
      if ($reg.'(default)' -and (Test-Path $reg.'(default)')) { return $reg.'(default)' }
    } catch {}
  }
  return $null
}

# не даём запустить второй экземпляр: просто открываем окно уже работающего
$mutex = New-Object System.Threading.Mutex($false, "Global\ROIReaper-Launcher")
if (-not $mutex.WaitOne(0)) {
  $b = Find-Browser
  if ($b) {
    $alive = $null
    foreach ($p2 in 18721..18726) {
      try {
        $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 "http://localhost:$p2/index.html"
        if ($r.StatusCode -eq 200) { $alive = $p2; break }
      } catch {}
    }
    if ($alive) { Start-Process -FilePath $b -ArgumentList @("--app=http://localhost:$alive/index.html", "--user-data-dir=`"$profileDir`"") }
  }
  exit 0
}

# ---- находим свободный порт ----
function Test-PortFree([int]$p) {
  try {
    $l = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $p)
    $l.Start(); $l.Stop()
    return $true
  } catch { return $false }
}
while (-not (Test-PortFree $Port)) { $Port++ }

# ---- сведения о компьютере (отдаём как window.SYSINFO) ----
$sysinfoJs = "window.SYSINFO="
try {
  $info = Get-ROISystemInfo
  $sysinfoJs += ($info | ConvertTo-Json -Depth 8 -Compress)
} catch {
  $sysinfoJs += (@{ error = "$_" } | ConvertTo-Json -Compress)
}
$sysinfoJs += ";"

# ---- веб-сервер ----
$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js"   = "text/javascript; charset=utf-8"
  ".css"  = "text/css; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".woff2"= "font/woff2"
  ".ttf"  = "font/ttf"
  ".png"  = "image/png"
  ".jpg"  = "image/jpeg"
  ".ico"  = "image/x-icon"
  ".svg"  = "image/svg+xml"
  ".webmanifest" = "application/manifest+json"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()

$url = "http://localhost:$Port/index.html"
# отдельный профиль рядом с программой: независимый процесс + сохранения на флешке
$profileDir = Join-Path $root "profile"
New-Item -ItemType Directory -Force -Path $profileDir | Out-Null
$browser = Find-Browser
$proc = $null
if ($browser) {
  $argList = @(
    "--app=$url",
    "--user-data-dir=`"$profileDir`"",
    "--window-size=1480,920",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-features=Translate"
  )
  $proc = Start-Process -FilePath $browser -ArgumentList $argList -PassThru
} else {
  Start-Process $url
}

Write-Host "ROIReaper работает: $url  (режим: $Mode)" -ForegroundColor DarkYellow

$lastHit = Get-Date
$utf8 = New-Object System.Text.UTF8Encoding($false)

function Send-Bytes($ctx, [byte[]]$bytes, [string]$contentType, [int]$status = 200) {
  $ctx.Response.StatusCode = $status
  $ctx.Response.ContentType = $contentType
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.AddHeader("Cache-Control", "no-store")
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

try {
  while ($listener.IsListening) {
    $task = $listener.GetContextAsync()
    while (-not $task.AsyncWaitHandle.WaitOne(800)) {
      if ($proc -and $proc.HasExited) { break }
      if (((Get-Date) - $lastHit).TotalMinutes -gt 30) { break }
    }
    if (-not $task.IsCompleted) {
      if (($proc -and $proc.HasExited) -or (((Get-Date) - $lastHit).TotalMinutes -gt 30)) { break }
      continue
    }

    $ctx = $task.Result
    $lastHit = Get-Date
    try {
      $reqPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ($reqPath -eq "/") { $reqPath = "/index.html" }

      if ($reqPath -eq "/sysinfo.js") {
        Send-Bytes $ctx $utf8.GetBytes($sysinfoJs) "text/javascript; charset=utf-8"
        continue
      }
      if ($reqPath -eq "/favicon.ico") { $reqPath = "/assets/img/icon-mini.png" }

      # защита от выхода за пределы папки app
      $rel = $reqPath.TrimStart("/") -replace "/", "\"
      $file = [System.IO.Path]::GetFullPath((Join-Path $appDir $rel))
      if (-not $file.StartsWith($appDir, [System.StringComparison]::OrdinalIgnoreCase)) {
        Send-Bytes $ctx $utf8.GetBytes("forbidden") "text/plain" 403; continue
      }
      if (Test-Path -LiteralPath $file -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
        $ct = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
        Send-Bytes $ctx ([System.IO.File]::ReadAllBytes($file)) $ct
      } else {
        Send-Bytes $ctx $utf8.GetBytes("404") "text/plain" 404
      }
    } catch {
      try { Send-Bytes $ctx $utf8.GetBytes("error") "text/plain" 500 } catch {}
    }

    if ($proc -and $proc.HasExited) { break }
  }
} finally {
  try { $listener.Stop() } catch {}
}
