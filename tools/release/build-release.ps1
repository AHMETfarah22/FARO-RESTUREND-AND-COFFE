<#
  FARO RESTURENT AND COFFE — builds the installation package for a customer's Windows computer.

  Output: release\FARO-Restaurant\  (and a .zip of it)
    FARO-Baslat.cmd   start the system (first run asks for the PostgreSQL password)
    OKUBENI.txt       installation guide (Turkish)
    .env              settings of this installation
    app\              the program: self-contained API (no .NET needed) + the portal in app\wwwroot

  The customer's computer needs PostgreSQL. The program asks for a license key (machine code →
  tools\license\faro-license.mjs) on first start, then for the restaurant name and administrator.

  Usage (from the repository root): paket-olustur.cmd   or   powershell -File tools\release\build-release.ps1
#>
param(
  [string]$Runtime = 'win-x64',
  [switch]$NoZip
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$frontend = Join-Path $root 'frontend'
$project = Join-Path $root 'backend\src\FaroRestaurant.Api\FaroRestaurant.Api.csproj'
$template = Join-Path $PSScriptRoot 'package'
$out = Join-Path $root 'release\FARO-Restaurant'
$app = Join-Path $out 'app'

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }

$dotnet = (Get-Command dotnet -ErrorAction SilentlyContinue).Source
if (-not $dotnet) { $dotnet = 'C:\Program Files\dotnet\dotnet.exe' }
if (-not (Test-Path $dotnet)) { throw '.NET SDK bulunamadı (dotnet). https://dot.net adresinden .NET 10 SDK kurun.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js bulunamadı (npm). https://nodejs.org adresinden kurun.' }

Step 'Portal (frontend) derleniyor'
Push-Location $frontend
try {
  if (-not (Test-Path 'node_modules')) { npm ci; if ($LASTEXITCODE) { throw 'npm ci başarısız' } }
  # Same address as the API: no VITE_API_BASE_URL, portal served from "/".
  $env:VITE_API_BASE_URL = ''
  $env:VITE_BASE_PATH = '/'
  npm run build
  if ($LASTEXITCODE) { throw 'Portal derlenemedi (npm run build).' }
} finally { Pop-Location }

Step 'Sunucu (API) yayınlanıyor'
if (Test-Path $out) {
  # Keep an existing installation's settings and license if the package is rebuilt in place.
  Get-ChildItem $out -Force | Where-Object { $_.Name -notin '.env', 'lisans.key' } | Remove-Item -Recurse -Force
}
& $dotnet publish $project -c Release -r $Runtime --self-contained true -p:PublishReadyToRun=false -o $app --nologo
if ($LASTEXITCODE) { throw 'dotnet publish başarısız.' }

Step 'Portal pakete ekleniyor'
Copy-Item (Join-Path $frontend 'dist') (Join-Path $app 'wwwroot') -Recurse -Force
# Development-only settings (migrations + test data seeding) must never reach a customer.
Remove-Item (Join-Path $app 'appsettings.Development.json') -ErrorAction SilentlyContinue

Step 'Başlatma dosyaları ekleniyor'
Copy-Item (Join-Path $template 'FARO-Baslat.cmd') $out -Force
Copy-Item (Join-Path $template 'OKUBENI.txt') $out -Force
Copy-Item (Join-Path $template 'baslat.ps1') $app -Force
if (-not (Test-Path (Join-Path $out '.env'))) { Copy-Item (Join-Path $template 'env.template') (Join-Path $out '.env') }

if (-not $NoZip) {
  Step 'Zip oluşturuluyor'
  $zip = Join-Path $root ("release\FARO-Restaurant-{0:yyyy-MM-dd}.zip" -f (Get-Date))
  Remove-Item $zip -ErrorAction SilentlyContinue
  Compress-Archive -Path $out -DestinationPath $zip -CompressionLevel Optimal
  Write-Host "Zip: $zip"
}

Write-Host "`nPaket hazır: $out" -ForegroundColor Green
Write-Host 'Müşteri bilgisayarına kopyalayın (ör. C:\FARO), PostgreSQL kurulu olsun ve FARO-Baslat.cmd dosyasına çift tıklayın.'
