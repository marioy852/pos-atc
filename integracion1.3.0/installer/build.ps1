# Prepara los archivos y compila el instalador. Ejecutar en Windows:
#   powershell -ExecutionPolicy Bypass -File installer\build.ps1
# Requisitos: Node.js con npm, Inno Setup 6 e internet (descarga node.exe y WinSW).
param(
  [string]$NodeVersion = "22.22.3",
  [string]$WinSWVersion = "2.12.0",
  [string]$Iscc = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)
$ErrorActionPreference = "Stop"

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent $here
$staging = Join-Path $here "staging"
$cache = Join-Path $here "cache"

if (-not (Test-Path $Iscc)) { throw "No se encontro Inno Setup en $Iscc (use -Iscc con la ruta de ISCC.exe)" }

Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue
$app = Join-Path $staging "app"
New-Item -ItemType Directory -Force -Path $app, (Join-Path $staging "node"), (Join-Path $staging "winsw"), $cache | Out-Null

# Codigo del integrador, sin .env, devices.json, logs ni node_modules.
foreach ($item in "index.js", "app.js", "package.json", "package-lock.json", "config", "libraryPI", "middlewares", "routes", "services", "validations", "views") {
  Copy-Item -Recurse -Force (Join-Path $repo $item) $app
}

Push-Location $app
try {
  if (Test-Path "package-lock.json") { npm ci --omit=dev } else { npm install --omit=dev }
  if ($LASTEXITCODE -ne 0) { throw "npm fallo con codigo $LASTEXITCODE" }
} finally { Pop-Location }

# node.exe, verificado contra el SHASUMS256.txt oficial de Node.
$nodeBase = "https://nodejs.org/dist/v$NodeVersion"
$nodeExe = Join-Path $cache "node-$NodeVersion.exe"
if (-not (Test-Path $nodeExe)) { Invoke-WebRequest "$nodeBase/win-x64/node.exe" -OutFile $nodeExe }
$sums = (Invoke-WebRequest "$nodeBase/SHASUMS256.txt").Content -split "`n"
$expected = ($sums | Where-Object { $_ -match "win-x64/node\.exe\s*$" } | Select-Object -First 1) -split "\s+" | Select-Object -First 1
$actual = (Get-FileHash $nodeExe -Algorithm SHA256).Hash.ToLower()
if (-not $expected -or $actual -ne $expected) { throw "El hash de node.exe no coincide (esperado $expected, obtenido $actual)" }
Copy-Item $nodeExe (Join-Path $staging "node\node.exe")

# WinSW: convierte node.exe en un servicio de Windows.
$winsw = Join-Path $cache "WinSW-x64-$WinSWVersion.exe"
if (-not (Test-Path $winsw)) { Invoke-WebRequest "https://github.com/winsw/winsw/releases/download/v$WinSWVersion/WinSW-x64.exe" -OutFile $winsw }
Write-Host "SHA256 de WinSW: $((Get-FileHash $winsw -Algorithm SHA256).Hash)"
Copy-Item $winsw (Join-Path $staging "winsw\WinSW-x64.exe")

$version = (Get-Content (Join-Path $repo "package.json") -Raw | ConvertFrom-Json).version
& $Iscc "/DAppVersion=$version" (Join-Path $here "pos-integrador.iss")
if ($LASTEXITCODE -ne 0) { throw "ISCC fallo con codigo $LASTEXITCODE" }
Write-Host "Instalador listo en $(Join-Path $here 'dist')"
