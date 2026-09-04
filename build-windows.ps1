# build-windows.ps1 — gera os instaladores completo e simplificado
#
# Uso (PowerShell, na pasta do projeto):
#   powershell -ExecutionPolicy Bypass -File build-windows.ps1
#
# Etapas:
#   1. Build do frontend (npm run build → dist/)
#   2. venv Python em .build-venv\ com pywebview + pyinstaller
#   3. PyInstaller com ControlePatrimonial.spec → dist-app\ControlePatrimonial\
#   4. Inno Setup → installer\completa\ e installer\simplificada\
#
# Pré-requisitos: Node.js no PATH, Python 3.10+ no PATH (ou `py`),
# Inno Setup 6 instalado (https://jrsoftware.org/isdl.php).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# ==> 0/4 De onde este build está saindo
#
# Existe (ou existiu) uma cópia antiga do projeto em
# C:\Users\<usuario>\controle-patrimonial, de quando o .exe era compilado de
# lá. Ela ficou parada em 18/08/2026, versão 0.0.0, ANTES de toda a auditoria
# do importador. Compilar daquela pasta gera um instalador com o app velho e
# sem nenhum aviso. Este bloco recusa o build nesse caso.
#
# A pasta correta é a do repositório, esta mesma, mesmo quando ela está no WSL
# (caminho UNC): a etapa 1 abaixo trata esse caso.
$pacote = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
if ($pacote.version -eq '0.0.0') {
    throw "Esta pasta é a cópia ANTIGA do projeto (package.json na versão 0.0.0). Rode o build a partir do repositório atual."
}
$scriptsSetup = @('setup.iss', 'setup-simplificado.iss')
foreach ($scriptSetup in $scriptsSetup) {
    $versaoSetup = (Select-String -Path (Join-Path $root $scriptSetup) -Pattern '#define AppVersion "([^"]+)"').Matches[0].Groups[1].Value
    if ($versaoSetup -ne $pacote.version) {
        throw "Versão divergente: package.json diz $($pacote.version) e $scriptSetup diz $versaoSetup. Alinhe antes de gerar os instaladores."
    }
}
Write-Host "==> 0/4 Projeto $($pacote.name) versão $($pacote.version)" -ForegroundColor Cyan

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
foreach ($scriptSetup in $scriptsSetup) {
    & $iscc $scriptSetup
    if ($LASTEXITCODE -ne 0) { throw "Inno Setup falhou em $scriptSetup" }
}

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
$instaladores = @(
    (Join-Path $root 'installer\completa\ControlePatrimonial_Setup_Completo.exe'),
    (Join-Path $root 'installer\simplificada\ControlePatrimonial_Setup_Simplificado.exe')
)
if ($pfx -and (Test-Path $pfx)) {
    Write-Host "==> Assinando os instaladores" -ForegroundColor Cyan
    $signtool = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -match 'x64' } | Select-Object -First 1
    if (-not $signtool) {
        Write-Host "signtool.exe não encontrado (Windows SDK). Instalador NÃO assinado." -ForegroundColor Yellow
    } else {
        foreach ($instalador in $instaladores) {
            & $signtool.FullName sign /f $pfx /p $env:CP_TEC_CERT_SENHA /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 $instalador
            if ($LASTEXITCODE -ne 0) { throw "assinatura falhou em $instalador" }
        }
        Write-Host "Instaladores assinados." -ForegroundColor Green
    }
} else {
    Write-Host ""
    Write-Host "ATENÇÃO: instaladores NÃO assinados digitalmente." -ForegroundColor Yellow
    Write-Host "O Windows vai mostrar aviso de editor desconhecido para quem instalar." -ForegroundColor Yellow
    Write-Host "Para assinar, defina CP_TEC_CERT_PFX e CP_TEC_CERT_SENHA e rode de novo." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pronto: installer\completa\ControlePatrimonial_Setup_Completo.exe" -ForegroundColor Green
Write-Host "Pronto: installer\simplificada\ControlePatrimonial_Setup_Simplificado.exe" -ForegroundColor Green
