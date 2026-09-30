<#
  FARO RESTURENT AND COFFE — turns "start with Windows" on or off.

  Puts (or removes) a shortcut to the given launcher in the user's Startup folder, so the system starts by itself
  when the computer is switched on and the user signs in. Run by Otomatik-Baslat.cmd (installation) and otomatik-baslat.cmd (development computer).

    otomatik-baslat.ps1 -Target <launcher .cmd> [-Mode ask|on|off] [-StartupDir <folder>]
#>
param(
  [Parameter(Mandatory)][string]$Target,
  [ValidateSet('ask', 'on', 'off')][string]$Mode = 'ask',
  [string]$StartupDir = [Environment]::GetFolderPath('Startup')
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8

$Target = (Resolve-Path $Target).Path
$shortcut = Join-Path $StartupDir 'FARO RESTURENT AND COFFE.lnk'
$enabled = Test-Path $shortcut

if ($Mode -eq 'ask') {
  Write-Host ''
  Write-Host 'FARO RESTURENT AND COFFE — bilgisayar açılınca otomatik başlatma' -ForegroundColor Cyan
  if ($enabled) {
    Write-Host 'Şu an AÇIK: FARO, Windows açıldığında kendiliğinden başlıyor.' -ForegroundColor Green
    $answer = Read-Host 'Kapatmak için K yazıp Enter''a basın (değiştirmemek için sadece Enter)'
    $Mode = if ($answer -match '^[kK]') { 'off' } else { 'none' }
  } else {
    Write-Host 'Şu an KAPALI: FARO''yu her seferinde elle başlatmanız gerekiyor.' -ForegroundColor Yellow
    $answer = Read-Host 'Açmak için A yazıp Enter''a basın (değiştirmemek için sadece Enter)'
    $Mode = if ($answer -match '^[aA]') { 'on' } else { 'none' }
  }
}

if ($Mode -eq 'on') {
  $shell = New-Object -ComObject WScript.Shell
  $link = $shell.CreateShortcut($shortcut)
  $link.TargetPath = $Target
  $link.WorkingDirectory = Split-Path $Target -Parent
  $link.WindowStyle = 7 # minimized: the server window stays out of the way
  $link.Description = 'FARO RESTURENT AND COFFE'
  $link.Save()
  Write-Host ''
  Write-Host 'AÇILDI. Bilgisayar her açıldığında FARO kendiliğinden başlar (pencere simge durumunda açılır).' -ForegroundColor Green
} elseif ($Mode -eq 'off') {
  if (Test-Path $shortcut) { Remove-Item $shortcut -Force }
  Write-Host ''
  Write-Host 'KAPATILDI. FARO artık Windows ile birlikte başlamaz.' -ForegroundColor Yellow
}
