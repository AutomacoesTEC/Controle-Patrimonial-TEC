; setup.iss — instalador do Controle de Variação Patrimonial (Inno Setup 6)
; Gera installer\ControlePatrimonial_Setup.exe a partir de dist-app\ControlePatrimonial\

#define AppName "Controle de Variação Patrimonial"
#define AppVersion "1.2.0"
#define AppExe "ControlePatrimonial.exe"

[Setup]
AppId={{7F3A9C21-5E4B-4D8A-9F2C-1B6E8D0A3C55}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=Controle Patrimonial
DefaultDirName={localappdata}\Programs\ControlePatrimonial
DefaultGroupName={#AppName}
OutputDir=installer
OutputBaseFilename=ControlePatrimonial_Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na Área de Trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "dist-app\ControlePatrimonial\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "Abrir {#AppName}"; Flags: nowait postinstall skipifsilent
