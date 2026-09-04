# Rodada 61 — Instalação simplificada para usuário leigo

## Falha e previsão

Havia uma única saída de instalador, que expõe escolhas úteis ao responsável
técnico, mas desnecessárias para o usuário final. Substituí-la eliminaria a
opção completa; mantê-la sozinha não atende a instalação assistida para leigos.

Previsão: o build passa de uma para duas saídas em pastas distintas. A completa
preserva as escolhas atuais; na simplificada, quatro páginas/opções técnicas
caem para zero, o atalho é incondicional e o app abre ao finalizar. As duas
usam o mesmo `dist-app` e a mesma versão 1.2.0.

Fixture estática no teste de empacotamento, sem seeds, modelo Codex baseado em
GPT-5 (identificador exato não exposto), commit-base `427419c`. Camada causal
única: fluxo do instalador Inno Setup; nenhuma lógica do aplicativo é alterada.

## Decisão

**MANTER.** O build passou de uma para duas variantes em pastas distintas. A
completa preservou as escolhas; a simplificada ficou sem páginas técnicas e
com atalho automático. Ambas foram compiladas do mesmo executável 1.2.0. O
teste de empacotamento passou 10/10, o frontend transformou 669 módulos, o
PyInstaller gerou o aplicativo e o Inno Setup concluiu as duas saídas. O
instalador solto antigo foi removido para não haver ambiguidade. Evidência
bruta em `antes.txt` e `depois.txt`.
