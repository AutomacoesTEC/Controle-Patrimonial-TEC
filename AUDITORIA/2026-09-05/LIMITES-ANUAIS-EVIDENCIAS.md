# Limites anuais — camada de estado

Falha: `estadoNoAno` aceita ano não inteiro e executa uma virada para cada ano intermediário; Infinity não termina. Movimentação aceita dia/mês inexistente por extrair só os primeiros quatro caracteres.

Previsão anterior à correção do reducer: rejeitar inteiro fora de 1..9999, datas civis inexistentes e anos expandidos; projeção 2025→2050 terá no máximo dois snapshots intermediários em vez de 25, conservando saldo de 100. Preservar o contrato existente de histórico 2026 ao projetar 2027.

Fixture: `limitesAnoAuditoria.test.js`, 12 casos sintéticos, sem aleatoriedade. Base `5437be361d9c0f7b321fd9f14e5936ee5df06577` mais correções de dados desta rodada. Modelo herdado. A validação comum `dataCadastro.js` foi criada pelo agente principal, que trabalha na UI; esta volta aplica o mesmo contrato no estado e limita materialização de anos.

Antes: execução completa não terminou no caso Infinity e foi interrompida com Ctrl-C (código130). Para obter resultados dos demais casos sem repetir o bloqueio, executou-se `node node_modules/vitest/vitest.mjs run src/store/limitesAnoAuditoria.test.js -t 'projeção|movimento'`:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 ❯ src/store/limitesAnoAuditoria.test.js (12 tests | 4 failed | 7 skipped) 13ms
 × projeção distante não gera todos os snapshots de anos vazios 8ms
 × movimento rejeita data inválida completa: 2026-02-30 2ms
 × movimento rejeita data inválida completa: 2026-13-01 1ms
 × movimento rejeita data inválida completa: 2026-00-01 1ms
AssertionError: expected 25 to be less than or equal to 2
AssertionError: expected [Function] to throw an error
 Test Files  1 failed (1)
      Tests  4 failed | 1 passed | 7 skipped (12)
   Start at  15:54:33
   Duration  427ms (transform 205ms, setup 0ms, import 242ms, tests 13ms, environment 0ms)
```

Depois: primeira execução detectou uma regressão no contrato de importação sem ano (`anoCalendario:null` significa conservar o ano ativo). A guarda foi ajustada apenas para esse contrato já existente; anos numéricos inválidos continuam recusados. Nenhum teste foi removido ou enfraquecido.

```text
 Test Files  9 passed (9)
      Tests  231 passed (231)
   Start at  15:55:35
   Duration  2.56s (transform 3.00s, setup 0ms, import 4.58s, tests 1.84s, environment 2ms)
```

Comando depois: `node node_modules/vitest/vitest.mjs run src/store/limitesAnoAuditoria.test.js src/store/auditoriaIndependente20260905.test.js src/store/reducer.test.js src/store/fluxoAnual.test.js src/store/reducer.historicoCobertura.test.js src/store/DataContext.test.js src/store/backupPerfil.test.js src/store/continuidade.test.js src/store/migracoes.test.js`.

MANTER: os 12 casos de limites agora terminam e passam, assim como continuidade/importação/backup/migração selecionados. A projeção distante cria no máximo dois snapshots; isso não é benchmark estatístico, é limite determinístico de materialização. A execução anterior interrompida continua registrada, sem alegação de medição pareada de duração.
