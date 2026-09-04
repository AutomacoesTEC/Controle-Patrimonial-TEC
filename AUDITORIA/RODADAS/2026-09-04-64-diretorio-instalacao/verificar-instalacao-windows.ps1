$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$instalador = Join-Path $raiz 'installer\simplificada\ControlePatrimonial_Setup_Simplificado.exe'

$processo = Start-Process -FilePath $instalador `
    -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/SP-' `
    -Wait -PassThru
if ($processo.ExitCode -ne 0) {
    throw "O instalador terminou com código $($processo.ExitCode)."
}

$registro = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*' |
    Where-Object { $_.DisplayName -like 'CP-TEC*' } |
    Select-Object -First 1
$esperado = Join-Path $env:LOCALAPPDATA 'Programs\ControlePatrimonial\'

Write-Host "diretorio_registrado=$($registro.InstallLocation)"
Write-Host "diretorio_esperado=$esperado"
if ($registro.InstallLocation -ne $esperado) {
    throw 'O instalador simplificado não usou o diretório padrão.'
}
Write-Host 'diretorio_correto=1'
