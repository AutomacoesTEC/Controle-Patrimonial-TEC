# Correções de integridade anual

## Volta D01/D02 — continuidade manual

Falha: correção tardia deixa abertura manual de ano seguinte desatualizada; transportar um movimento entre anos já existentes duplica seu efeito.

Previsão antes da mudança: seis casos adversariais D01/D02 hoje negativos passarão; os controles de ano inexistente, backup e snapshot importado continuarão positivos. D03 continuará falhando nesta volta separada.

Fixture congelado: `src/store/auditoriaIndependente20260905.test.js` com 10 testes, dados sintéticos 2025–2027, sem aleatoriedade. Base de produção `5437be361d9c0f7b321fd9f14e5936ee5df06577` mais exportação desta auditoria e alterações de UI por outro agente. Modelo da sessão herdado. Comando `node node_modules/vitest/vitest.mjs run src/store/auditoriaIndependente20260905.test.js`.

Saída antes (15:48:37):

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 ❯ src/store/auditoriaIndependente20260905.test.js (10 tests | 7 failed) 38ms
 × D01: transportar a mesma benfeitoria para ano já aberto deve manter custo final 120 10ms
 × D02: corrigir saldo anterior deve atualizar a abertura do ano manual já criado 1ms
 × D03: retificadora deve preservar dado manual de rendimento importado ou explicitar conflito 2ms
 × D02: bens preserva eventos próprios de 2026 ao corrigir 2025, propagando a 2027 1ms
 × D02: bensRurais preserva eventos próprios de 2026 ao corrigir 2025, propagando a 2027 1ms
 × D02: dividas preserva eventos próprios de 2026 ao corrigir 2025, propagando a 2027 1ms
 × D02: dividasRurais preserva eventos próprios de 2026 ao corrigir 2025, propagando a 2027 1ms
AssertionError: expected 120 to be 100 // D01
AssertionError: expected 100 to be 130 // D02 bens
AssertionError: expected undefined to be '2025-05-01' // D03
AssertionError: expected 100 to be 70 // D02 dívidas
 Test Files  1 failed (1)
      Tests  7 failed | 3 passed (10)
   Start at  15:48:37
   Duration  900ms (transform 379ms, setup 0ms, import 447ms, tests 38ms, environment 0ms)
```

Camada causal: estado anual do reducer. Não alterar fórmulas do Demonstrativo. Reconciliar apenas anos manuais derivados, preservar eventos próprios, parar em anos importados. Uma edição isolada não deve transportar fluxos do ano de origem.

Depois D01/D02, antes de mexer em D03:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 ❯ src/store/auditoriaIndependente20260905.test.js (10 tests | 1 failed) 33ms
 × D03: retificadora deve preservar dado manual de rendimento importado ou explicitar conflito 7ms
AssertionError: expected undefined to be '2025-05-01'
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 139 passed (140)
   Start at  15:50:04
   Duration  972ms (transform 1.10s, setup 0ms, import 1.43s, tests 131ms, environment 1ms)
```

MANTER D01/D02: os seis casos negativos de continuidade passaram, assim como os controles; D03 permaneceu negativo como previsto. Mais dois testes adversariais acrescentados depois verificaram cadastro tardio/titularidade e retificadora anterior com evento próprio no ano seguinte; D02 passou 8 casos na execução 15:50:38. Não são parte do par congelado inicial.

## Volta D03 — metadados locais na retificadora

Falha: substituir rendimento importado descarta data e descrição acrescentadas pelo usuário, apesar do snapshot `valorDeclarado` existir antes da substituição.

Previsão antes da mudança: D03 passará, sem deixar de atualizar o valor declarado para 550. Alteração local conflitante com um valor novo da declaração deverá ficar registrada como pendência, enquanto a nova declaração prevalece no valor oficial. Correspondência ambígua ou item editado removido não deve causar perda silenciosa.

Fixture base: mesmo teste sintético D03 acima (negativo às 15:50:04); mesma base/modelo/seeds. Camada: reconciliação de registros de fluxo no estado. Não altera fórmulas nem interface.

Depois D03, mantendo o fixture original:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 Test Files  3 passed (3)
      Tests  142 passed (142)
   Start at  15:51:42
   Duration  638ms (transform 858ms, setup 0ms, import 1.13s, tests 113ms, environment 0ms)
```

Casos adicionais de conflito e ambiguidade em rendimentos/pagamentos/três doações, depois de adotar preservação do original também na edição de doações:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 Test Files  3 passed (3)
      Tests  148 passed (148)
   Start at  15:53:19
   Duration  1.08s (transform 1.35s, setup 0ms, import 1.81s, tests 168ms, environment 1ms)
```

MANTER D03: complemento local preservado, valor oficial novo atualizado e conflito guardado em `ajustesLocaisRetificadora`; item editado sem vínculo único gera erro antes de qualquer gravação. Ausência da coleção no payload preserva a coleção anterior; lista vazia explícita continua significando remoção oficial, recusada quando apagaria edição sem correspondência.
