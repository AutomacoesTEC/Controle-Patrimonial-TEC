; Instalador simplificado do CP-TEC para usuário final.
; Usa o mesmo aplicativo de setup.iss; muda somente o fluxo do assistente.

#define AppName "CP-TEC - Controle de Variação Patrimonial"
#define AppVersion "1.2.0"
#define AppExe "ControlePatrimonial.exe"

[Setup]
AppId={{7F3A9C21-5E4B-4D8A-9F2C-1B6E8D0A3C55}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=CP-TEC
SetupIconFile=assets\cp-tec.ico
UninstallDisplayIcon={app}\{#AppExe}
DefaultDirName={localappdata}\Programs\ControlePatrimonial
DefaultGroupName={#AppName}
OutputDir=installer\simplificada
OutputBaseFilename=ControlePatrimonial_Setup_Simplificado
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableWelcomePage=yes
; O fluxo simplificado não mostra a página de diretório. Portanto ele jamais
; pode herdar silenciosamente um caminho usado em teste ou escolhido por uma
; instalação técnica anterior: sempre parte do DefaultDirName seguro acima.
UsePreviousAppDir=no

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Files]
Source: "dist-app\ControlePatrimonial\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"

[Run]
Filename: "{app}\{#AppExe}"; Description: "Abrir {#AppName}"; Flags: nowait postinstall skipifsilent
