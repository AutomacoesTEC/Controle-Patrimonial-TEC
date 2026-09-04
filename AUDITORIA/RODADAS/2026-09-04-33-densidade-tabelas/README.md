# Rodada 33 — Densidade compacta persistida por tabela

## Falha e previsão

Em Bens e Direitos, todas as linhas usam padding fixo de 12 × 16 px; não há
controle compacto, e uma tabela longa exige mais rolagem que o necessário.

Previsão no fixture AJU-01: botão `Compacto` 0→1; após acioná-lo, padding da
primeira célula 12×16→8×12 e armazenamento da preferência; após reload, o
padding compacto permanece; a tabela de Dívidas continua 12×16, provando
isolamento por tabela.

Fixture `verificar-densidade.py`, viewport 1366 × 768, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `d3ba113`,
saídas brutas `antes.txt`/`depois.txt`.

Camada causal única: estado de apresentação/densidade das tabelas. Larguras
continuam voltando ao padrão, conforme decisão da usuária já registrada no
componente; dados, colunas e cálculos não mudam.

## Decisão

**MANTER.** O botão passou de 0 para 1. Em Bens, o padding caiu de 12×16 para
8×12, gravou `{"bens":true}` e permaneceu compacto após reload. Dívidas
continuou 12×16 com `aria-pressed=false`, provando isolamento. Evidência bruta
em `antes.txt`/`depois.txt`; erros de fixture sem medição estão preservados.

Verificação adicional: build aprovado; 41 arquivos e 885 testes passaram.
