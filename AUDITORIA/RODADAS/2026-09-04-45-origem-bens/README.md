# Rodada 45 — Origem visível e filtrável em Bens

## Falha e previsão

Com sete bens importados e um manual, `Bens e Direitos` exibe oito linhas,
mas não há badge nem filtro por origem; a pessoa não consegue executar “só o
que digitei” ou “só o que veio da declaração”, apesar de `origem` já existir
nos registros. A exportação de Bens também omite essa coluna.

Previsão: oito linhas continuam visíveis em `Todas as origens`, cada uma com
badge; `Manual` mostra exatamente uma e `Declaração` mostra sete. A exportação
ganha coluna `Origem`, sem mudar as demais.

Fixture `verificar-origem.py`, AJU-01 acrescido de um bem manual determinístico,
viewport 1366 × 768, sem seeds, modelo Codex baseado em GPT-5 (identificador
exato não exposto), commit-base `305f052`; saídas `antes.txt`/`depois.txt`.
Camada causal única: exposição e filtro da proveniência já persistida.

## Decisão

**MANTER.** As oito linhas permaneceram visíveis no filtro geral e passaram a
oito badges. O filtro Manual mostrou exatamente o item plantado e Declaração
mostrou os sete importados. A exportação recebeu a coluna `Origem`. Evidência
bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 663 módulos; regressão com 42 arquivos e
888 testes aprovados.
