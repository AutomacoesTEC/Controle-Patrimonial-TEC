# Rodada 10 — contraste do botão destrutivo no tema claro

## 1. Falha nomeada

No tema claro, o botão `.btn-danger` mantém fundo `#ef4444` com texto branco.
A trajetória congelada da rodada 08 mediu 3,76:1, abaixo do mínimo WCAG AA de
4,5:1 para seu rótulo pequeno.

Trajetória: abrir o app, montar um botão `.btn.btn-danger` dentro de um card e
calcular a razão entre as cores computadas do texto e do fundo nos dois temas.

## 2. Previsão escrita antes da mudança

- No tema claro, o botão passará de 3,76:1 para razão maior ou igual a 4,5:1.
- No tema escuro, cor e razão permanecerão exatamente iguais ao baseline.
- Texto, dimensões, estrutura e outras cores funcionais não mudarão.

## 3. Tarefa congelada

- Fixture: um botão sintético com as classes reais `.btn.btn-danger`, injetado
  somente no navegador pelo `medir-contraste.py`
- Viewport: 1366x768; temas escuro e claro
- Seeds: não aplicável; cálculo determinístico WCAG 2.x
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `ba8decf8f2cb131bd25b1cb11f7c37937486104e`
- Medidor: `medir-contraste.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente a superfície normal/hover do botão destrutivo no tema claro. Tema
escuro, tipografia, dimensões e conteúdo ficam fora desta rodada.

## 5. Decisão

**MANTER.** No tema claro, a razão passou de 3,76:1 para 4,83:1, acima
do mínimo previsto de 4,5:1. No tema escuro, cor computada do texto, fundo e
razão permaneceram exatamente iguais ao baseline.

Evidência bruta pareada: `antes.json` e `depois.json`, produzidos pelo mesmo
`medir-contraste.py`. A implementação acrescenta apenas os estados normal e
hover do botão sob `:root[data-theme="light"]`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
