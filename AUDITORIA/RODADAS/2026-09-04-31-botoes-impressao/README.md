# Rodada 31 — Acesso à impressão nas duas telas

## Falha, previsão e congelamento

Mesmo com folhas `print` válidas, Dashboard e Relatório IRPF não oferecem uma
ação visível para abri-las. Previsão: o botão `Imprimir demonstrativo` passa
de 0 para 1 em cada tela e cada clique chama `window.print()` exatamente uma
vez. Fixture `verificar-botoes.py`, AJU-01, 1366 × 768, sem seeds, modelo
Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`f2bd81f`; saídas brutas em `antes.txt`/`depois.txt`.

Camada causal única: ferramenta de acesso à impressão. Folha, conteúdo,
cálculos e exportação XLSX não mudam.

## Decisão

**MANTER.** Cada tela passou de 0 para 1 botão. O clique no Dashboard levou o
contador de `window.print()` a 1 e o clique no Relatório levou o total a 2:
exatamente uma chamada por ação. Build aprovado. Evidência bruta pareada em
`antes.txt` e `depois.txt`.

Suíte adicional: 41 arquivos e 885 testes passaram.
