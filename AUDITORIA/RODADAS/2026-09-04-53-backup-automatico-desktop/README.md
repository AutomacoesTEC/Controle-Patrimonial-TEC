# Rodada 53 — Backup automático periódico no desktop

## Falha e previsão

No executável pywebview, trabalhar e fechar o app sem usar manualmente
`Exportar backup` deixa apenas o `localStorage`: `main.py` não expõe API de
backup e o frontend não agenda nenhuma cópia. A medição estática encontra
ponte=false, método=false, agendamento=false e intervalo nulo.

Trajetória: abrir um perfil no executável, alterar dados, não clicar em
exportar e aguardar; nenhum `.cptec.json` é criado fora do armazenamento do
WebView.

Previsão: a mesma inspeção passa a ponte=true, método=true, agendamento=true e
intervalo=15 minutos. O fixture JS deve provar uma gravação imediata ao abrir o
perfil e outra no primeiro intervalo; o fixture Python deve provar escrita
atômica apenas na pasta dedicada e retenção máxima de 30 cópias.

Fixtures com estado/perfil e relógio fixos, sem seeds, modelo Codex baseado em
GPT-5 (identificador exato não exposto), commit-base `e568843`; saídas
`antes.txt`/`depois.txt`. Camada causal única: mecanismo de persistência de
backup do perfil no ambiente desktop.

## Decisão

**MANTER.** A inspeção passou aos quatro valores previstos. O fixture JS
confirmou o mesmo envelope íntegro do backup manual, execução imediata e nova
execução aos 15 minutos. O fixture Python criou somente arquivos confinados à
pasta dedicada, sem temporário residual, e reteve 30 de 32 cópias. Falhas do
bridge geram aviso visível no app, sem fallback silencioso. Evidência bruta em
`antes.txt`/`depois.txt`.

Verificações finais: regressão com 47 arquivos e 897 testes JS aprovados; um
teste Python aprovado; build de produção aprovado com 664 módulos
transformados. A primeira regressão expôs e corrigiu uma asserção textual do
empacotamento; a saída foi preservada em `verificacao-intermediaria.txt`.
