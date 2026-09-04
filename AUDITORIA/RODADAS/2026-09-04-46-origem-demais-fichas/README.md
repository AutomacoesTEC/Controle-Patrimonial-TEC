# Rodada 46 — Origem nas demais fichas principais

## Falha e previsão

Dívidas, Rendimentos e Pagamentos ainda misturam itens manuais e importados
sem badge, filtro ou coluna Origem na exportação, embora Bens já ofereça esse
contrato e os registros já persistam `origem`.

Previsão: fixtures com um item manual adicional exibem 3/19/9 badges; o filtro
Manual mostra 1/1/1 e Declaração mostra 2/18/8. As três exportações ganham a
coluna Origem sem alterar as demais colunas.

Fixture `verificar-origens.py`, AJU-01 com um item manual determinístico por
ficha, viewport 1366 × 768, sem seeds, modelo Codex baseado em GPT-5
(identificador exato não exposto), commit-base `042fac8`; saídas
`antes.txt`/`depois.txt`. Camada causal única: exposição e filtro da
proveniência já persistida.

## Decisão

**MANTER.** As três fichas preservaram 3/19/9 linhas e passaram a 3/19/9
badges. Manual isolou 1/1/1; Declaração isolou 2/18/8, exatamente como
plantado. As três exportações receberam Origem. A tentativa com rótulos
incorretos da sidebar foi preservada. Evidência em `antes.txt`/`depois.txt`.

Verificações: build de produção com 663 módulos; regressão com 42 arquivos e
888 testes aprovados.
