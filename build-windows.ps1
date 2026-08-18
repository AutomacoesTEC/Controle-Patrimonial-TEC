# build-windows.ps1 — gera o instalador ControlePatrimonial_Setup.exe
#
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File build-windows.ps1
#
# Etapas:
#   1. Build do frontend (npm run build → dist/)
#   2. venv Python em .build-venv\ com pywebview + pyinstaller
#   3. PyInstaller com ControlePatrimonial.spec → dist-app\ControlePatrimonial\
#   4. Inno Setup (setup.iss) → installer\ControlePatrimonial_Setup.exe
#
# Pré-requisitos: Node.js no PATH, Python 3.10+ no PATH (ou `py`),
# Inno Setup 6 instalado (https://jrsoftware.org/isdl.php).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "==> 1/4 Build do frontend (Vite)" -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }

Write-Host "==> 2/4 Ambiente Python (.build-venv)" -ForegroundColor Cyan
$venv = Join-Path $root '.build-venv'
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
    $py = (Get-Command python -ErrorAction SilentlyContinue) ? 'python' : 'py'
    & $py -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "criação do venv falhou" }
}
$venvPy = Join-Path $venv 'Scripts\python.exe'
& $venvPy -m pip install --quiet --upgrade pip
& $venvPy -m pip install --quiet pyinstaller pywebview
if ($LASTEXITCODE -ne 0) { throw "pip install falhou" }

Write-Host "==> 3/4 PyInstaller" -ForegroundColor Cyan
& $venvPy -m PyInstaller --noconfirm --clean --distpath dist-app --workpath build-app ControlePatrimonial.spec
if ($LASTEXITCODE -ne 0) { throw "PyInstaller falhou" }

Write-Host "==> 4/4 Inno Setup" -ForegroundColor Cyan
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
if (-not (Test-Path $iscc)) { $iscc = (Get-Command iscc -ErrorAction SilentlyContinue)?.Source }
if (-not $iscc) {
    Write-Host "Inno Setup 6 não encontrado. Instale de https://jrsoftware.org/isdl.php e rode novamente." -ForegroundColor Yellow
    Write-Host "O executável já está pronto em dist-app\ControlePatrimonial\" -ForegroundColor Yellow
    exit 2
}
& $iscc setup.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup falhou" }

Write-Host ""
Write-Host "Pronto: installer\ControlePatrimonial_Setup.exe" -ForegroundColor Green
