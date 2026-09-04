# Rodada 66 — Seletor de backup no diretório do usuário

## Falha e previsão

Ao clicar em “Já usou o CP-TEC?”, o `<input type=file>` do WebView abriu no
último/diretório de trabalho do processo, que nesta máquina era um caminho do
Linux/WSL. O navegador controla esse ponto inicial e o frontend não consegue
corrigi-lo. Em outro computador o resultado também dependeria do estado local,
portanto não havia um destino inicial globalmente previsível.

Previsão: a inspeção passa de 0/4 para 4/4 sinais: API nativa ligada à janela,
diálogo iniciado em `Downloads` do usuário atual, leitura somente do arquivo
escolhido no diálogo e fallback preservado no navegador. Em teste Windows, a
seleção deve iniciar em `%USERPROFILE%\Downloads`; em qualquer outro PC, o
mesmo cálculo usa o perfil daquele usuário, nunca um caminho fixo desta
máquina.

Fixtures fixas em `verificar-seletor.py`, `test_desktop_api.py` e
`persistenciaDesktop.test.js`, sem seeds, modelo Codex baseado em GPT-5
(identificador exato não exposto), commit-base `0b87966`. Camada causal única:
ferramenta de seleção de arquivo no desktop.

## Decisão

**MANTER.** Os sinais passaram de 0/4 para 4/4. No desktop, o clique chama o
diálogo nativo vinculado à janela e começa em `Downloads` calculado a partir do
perfil do usuário atual. O frontend recebe somente o nome e o conteúdo do
arquivo que a própria pessoa autorizou no diálogo; nenhum caminho arbitrário
é aceito da interface. A versão web mantém o seletor HTML como fallback. Vinte
e cinco testes JavaScript, três testes Python e o build de 669 módulos
passaram. Evidência bruta em `antes.txt` e `depois.txt`.
