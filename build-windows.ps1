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
if ($root.StartsWith('\\')) {
    # Projeto dentro do WSL: o cmd.exe do Windows não aceita pasta UNC como
    # diretório atual, então o npm/vite daqui não roda. O dist/ precisa ter
    # sido gerado antes, DE DENTRO do WSL, com:  npm run build
    if (Test-Path (Join-Path $root 'dist\index.html')) {
        Write-Host "    Projeto no WSL (caminho UNC): usando dist/ já gerado." -ForegroundColor Yellow
        Write-Host "    Para rebuildar o frontend, rode 'npm run build' dentro do WSL antes." -ForegroundColor Yellow
    } else {
        throw "dist/ não encontrado. Rode 'npm run build' DENTRO do WSL (na pasta do projeto) e rode este script de novo."
    }
} else {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build falhou" }
}

Write-Host "==> 2/4 Ambiente Python (.build-venv)" -ForegroundColor Cyan
$venv = Join-Path $root '.build-venv'
if (-not (Test-Path (Join-Path $venv 'Scripts\python.exe'))) {
    $py = 'python'
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) { $py = 'py' }
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
if (-not (Test-Path $iscc)) {
    $isccCmd = Get-Command iscc -ErrorAction SilentlyContinue
    if ($isccCmd) { $iscc = $isccCmd.Source } else { $iscc = $null }
}
if (-not $iscc) {
    Write-Host "Inno Setup 6 não encontrado. Instale de https://jrsoftware.org/isdl.php e rode novamente." -ForegroundColor Yellow
    Write-Host "O executável já está pronto em dist-app\ControlePatrimonial\" -ForegroundColor Yellow
    exit 2
}
& $iscc setup.iss
if ($LASTEXITCODE -ne 0) { throw "Inno Setup falhou" }

# Assinatura digital (opcional, mas é o que tira o aviso de editor desconhecido).
#
# Sem assinatura, o SmartScreen do Windows mostra "O Windows protegeu o
# computador" e o editor aparece como desconhecido. O instalador funciona, mas
# quem recebe precisa clicar em "Mais informações" e "Executar assim mesmo".
#
# Para assinar, defina as duas variáveis de ambiente antes de rodar este
# script, apontando para um certificado de assinatura de código (Code Signing),
# que NÃO é o mesmo certificado e-CNPJ A1 usado para nota fiscal:
#   $env:CP_TEC_CERT_PFX   = 'C:\caminho\certificado.pfx'
#   $env:CP_TEC_CERT_SENHA = 'senha do pfx'
$pfx = $env:CP_TEC_CERT_PFX
$instalador = Join-Path $root 'installer\ControlePatrimonial_Setup.exe'
if ($pfx -and (Test-Path $pfx)) {
    Write-Host "==> Assinando o instalador" -ForegroundColor Cyan
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'x64' } | Select-Object -First 1
    if (-not $signtool) {
        Write-Host "signtool.exe não encontrado (Windows SDK). Instalador NÃO assinado." -ForegroundColor Yellow
    } else {
        & $signtool.FullName sign /f $pfx /p $env:CP_TEC_CERT_SENHA /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $instalador
        if ($LASTEXITCODE -ne 0) { throw "assinatura falhou" }
        Write-Host "Instalador assinado." -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "ATENÇÃO: instalador NÃO assinado digitalmente." -ForegroundColor Yellow
    Write-Host "O Windows vai mostrar aviso de editor desconhecido para quem instalar." -ForegroundColor Yellow
    Write-Host "Para assinar, defina CP_TEC_CERT_PFX e CP_TEC_CERT_SENHA e rode de novo." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pronto: installer\ControlePatrimonial_Setup.exe" -ForegroundColor Green
