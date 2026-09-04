# Rodada 34 — Zebra sutil nas tabelas

## Falha, previsão e congelamento

Na tabela de Bens, linhas adjacentes têm o mesmo fundo nos temas escuro e
claro, dificultando acompanhar uma linha através de muitas colunas.

Previsão: em ambos os temas, fundos computados da primeira e segunda linhas
passarão de iguais para diferentes; a linha par usará mistura de
`--bg-card-hover` a 40%; padding permanecerá 12×16 e conteúdo inalterado.

Fixture `verificar-zebra.py`, AJU-01, 1366 × 768, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `c82a548`;
saídas `antes.txt`/`depois.txt`. Camada causal única: apresentação de linhas.

## Decisão

**MANTER.** Linhas adjacentes passaram de fundos iguais para diferentes nos
temas escuro e claro. Padding 12×16 e os dois textos completos permaneceram
idênticos. Evidência bruta em `antes.txt`/`depois.txt`.

Verificação adicional: build aprovado; 41 arquivos e 885 testes passaram.
