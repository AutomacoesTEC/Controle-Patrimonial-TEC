# Rodada 36 — Semântica e foco do Modal

## Falha e previsão

Ao abrir `Novo Bem`, a moldura não declara diálogo/nome, não recebe foco,
permite Tab escapar e não devolve foco ao gatilho ao fechar.

Previsão: `role=dialog`, `aria-modal=true` e `aria-labelledby` válido passam
de ausentes a presentes; foco inicial fica dentro; Tab no último vai ao
primeiro e Shift+Tab no primeiro vai ao último; fechar devolve foco ao botão
`Novo Bem`.

Fixture `verificar-modal.py`, AJU-01, 1366 × 768, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `0af8b8a`;
saídas `antes.txt`/`depois.txt`. Camada causal única: acessibilidade estrutural
e gerenciamento de foco do Modal compartilhado.

## Decisão

**MANTER.** Os três atributos passaram de ausentes a válidos, com nome `Novo
Bem ou Direito`; foco inicial entrou no modal; Tab e Shift+Tab ciclaram; o
fechamento devolveu foco ao gatilho. A medição intermediária que revelou o
efeito antes da montagem está preservada. Evidência em `antes.txt`/`depois.txt`.

Regressão: `npm test -- --run --reporter=dot` — 41 arquivos e 885 testes
aprovados.
