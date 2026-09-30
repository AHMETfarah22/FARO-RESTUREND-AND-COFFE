<#
  FARO RESTURENT AND COFFE — starts this installation (run by FARO-Baslat.cmd).

  First run: asks for the PostgreSQL password and creates this installation's session secret in ..\.env.
  Then starts the API (which also serves the portal) and opens the browser as soon as it answers.
#>
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$app = $PSScriptRoot
$root = Split-Path $app -Parent
$envFile = Join-Path $root '.env'
$exe = Join-Path $app 'FaroRestaurant.Api.exe'

function Stop-WithMessage($message) {
  Write-Host ''
  Write-Host $message -ForegroundColor Red
  Read-Host 'Kapatmak için Enter tuşuna basın'
  exit 1
}

if (-not (Test-Path $envFile)) { Stop-WithMessage "Ayar dosyası bulunamadı: $envFile" }
if (-not (Test-Path $exe)) { Stop-WithMessage "Program bulunamadı: $exe" }

# ---- first run: fill in the settings ---------------------------------------------------------------------
# Values are written in single quotes: .env files expand $NAME and treat " #" as a comment otherwise.
$lines = [IO.File]::ReadAllLines($envFile, [Text.Encoding]::UTF8)
$changed = $false

for ($i = 0; $i -lt $lines.Length; $i++) {
  if ($lines[$i] -eq 'Jwt__Secret=__GENERATE__') {
    $bytes = New-Object byte[] 48
    (New-Object System.Security.Cryptography.RNGCryptoServiceProvider).GetBytes($bytes)
    $lines[$i] = "Jwt__Secret='" + [Convert]::ToBase64String($bytes) + "'"
    $changed = $true
  }

  if ($lines[$i].StartsWith('ConnectionStrings__DefaultConnection=') -and $lines[$i].Contains('__POSTGRES_PASSWORD__')) {
    Write-Host ''
    Write-Host 'İlk kurulum' -ForegroundColor Cyan
    Write-Host 'PostgreSQL kurulurken "postgres" kullanıcısı için belirlediğiniz şifreyi girin (ekranda görünmez).'
    $secure = Read-Host 'PostgreSQL şifresi' -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }

    if ($password.Length -eq 0) { Stop-WithMessage 'Şifre boş olamaz. FARO-Baslat.cmd ile yeniden deneyin.' }
    if ($password.Contains("'")) { Stop-WithMessage "Şifrede ' (tek tırnak) kullanılamaz. PostgreSQL şifresini değiştirip yeniden deneyin." }
    # Inside the connection string, a password with ; = " or spaces is wrapped in double quotes.
    if ($password -match '[;="\s]') { $password = '"' + $password.Replace('"', '""') + '"' }

    $value = $lines[$i].Substring('ConnectionStrings__DefaultConnection='.Length).Trim("'")
    $lines[$i] = "ConnectionStrings__DefaultConnection='" + $value.Replace('__POSTGRES_PASSWORD__', $password) + "'"
    $changed = $true
  }
}

if ($changed) { [IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding $false)) }

# ---- start --------------------------------------------------------------------------------------------------
$port = 5080
$urls = $lines | Where-Object { $_ -match '^ASPNETCORE_URLS=' } | Select-Object -First 1
if ($urls -match ':(\d+)') { $port = [int]$Matches[1] }
$local = "http://localhost:$port"

# Already running (e.g. started with Windows)? Then just open the portal.
try {
  Invoke-WebRequest "$local/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
  Write-Host 'FARO zaten çalışıyor; tarayıcı açılıyor.' -ForegroundColor Green
  Start-Process $local
  exit 0
} catch { }

$postgres = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $postgres) {
  Write-Host 'Uyarı: Bu bilgisayarda PostgreSQL hizmeti bulunamadı. Kurulum için OKUBENI.txt dosyasına bakın.' -ForegroundColor Yellow
} else {
  # Right after the computer starts, the database may still be starting.
  for ($i = 0; $i -lt 60 -and (Get-Service -Name $postgres.Name).Status -ne 'Running'; $i++) {
    if ($i -eq 0) { Write-Host 'Veritabanının açılması bekleniyor...' }
    Start-Sleep -Seconds 1
  }
}

# Addresses for phones and tablets on the same Wi-Fi (virtual adapters are skipped).
$lan = @()
try {
  $lan = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
    Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|VirtualBox|VMware|Docker|Loopback|Bluetooth' } |
    ForEach-Object { "http://$($_.IPAddress):$port" }
} catch { }

Write-Host ''
Write-Host 'FARO RESTURENT AND COFFE' -ForegroundColor White
Write-Host "  Bu bilgisayar      : $local"
foreach ($address in $lan) { Write-Host "  Telefon / tablet   : $address" }
Write-Host '  Bu pencereyi KAPATMAYIN (küçültebilirsiniz) — kapanırsa sistem durur.' -ForegroundColor Yellow
Write-Host '  Sunucu durursa kendiliğinden yeniden başlar.'
Write-Host ''

# Open the browser as soon as the API answers (in the background, while the API runs in this window).
$null = Start-Job -ArgumentList $local -ScriptBlock {
  param($url)
  for ($i = 0; $i -lt 120; $i++) {
    try {
      Invoke-WebRequest "$url/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
      Start-Process $url
      return
    } catch { Start-Sleep -Seconds 1 }
  }
}

# Keep the server running: if it stops (an error, the database restarting ...) it is started again.
# If it stops within seconds several times in a row, a setting is wrong — then stop and explain.
$quickStops = 0
Push-Location $app
try {
  while ($quickStops -lt 5) {
    $started = Get-Date
    & $exe
    if (((Get-Date) - $started).TotalSeconds -lt 60) { $quickStops++ } else { $quickStops = 0 }
    Write-Host ''
    Write-Host 'Sunucu durdu; 5 saniye içinde yeniden başlatılıyor...' -ForegroundColor Yellow
    Start-Sleep -Seconds 5
  }
} finally { Pop-Location }

Stop-WithMessage ('Sunucu tekrar tekrar duruyor. Veritabanı bağlantı hatası görüyorsanız ' + $envFile + ' dosyasını Not Defteri ile açıp PostgreSQL şifresini (Password=...) düzeltin ve PostgreSQL hizmetinin çalıştığından emin olun.')
