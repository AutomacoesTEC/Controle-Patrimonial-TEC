# Rodada 38 — Foco visível global

## Falha e previsão

Na trajetória por teclado `Dashboard → navegação lateral → linha Variação dos
Bens`, controles focados não têm um indicador global consistente: a linha
recém-tornada interativa não desenha contorno, e diversos controles dependem
do estilo incidental do navegador ou apenas de troca sutil de borda.

Previsão: o botão de navegação, o botão de tema e a linha clicável passam a
exibir, quando `:focus-visible`, contorno sólido de `2px` na cor
`--accent-primary`, com afastamento de `2px`.

Fixture `verificar-foco.py`, perfil AJU-01, tema escuro, viewport 1366 × 768,
sem seeds, modelo Codex baseado em GPT-5 (identificador exato não exposto),
commit-base `8772a8c`; saídas `antes.txt`/`depois.txt`. Camada causal única:
estilo global do indicador de foco.

## Decisão

**MANTER.** Nos três representantes, o contorno nativo `auto`, preto, de 1px
e sem afastamento passou ao padrão previsto: sólido, `2px`, cor exata do
acento e `2px` de afastamento. A leitura intermediária durante a transição de
150 ms foi preservada e o fixture final aguarda 250 ms nos dois estados.
Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 658 módulos; regressão com 41 arquivos e
885 testes aprovados.
