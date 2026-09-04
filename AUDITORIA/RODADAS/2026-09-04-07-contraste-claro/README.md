# Rodada 07 — contraste funcional no tema claro

## 1. Falha nomeada

No tema claro, textos pequenos dos badges azul, verde, laranja, roxo e
vermelho, além de valores monetários positivos e negativos, usam tons criados
para fundo escuro. A medição visual anterior encontrou razões entre 1,54:1 e
3,76:1, abaixo do mínimo WCAG AA de 4,5:1 para texto pequeno.

Trajetória: abrir o app, montar dentro de um card um exemplar de cada uma das
sete classes reais e calcular a razão entre a cor computada do texto e o fundo
efetivo (incluindo a composição alfa do badge), nos dois temas.

## 2. Previsão escrita antes da mudança

- Os sete exemplares do tema claro passarão para razão maior ou igual a 4,5:1.
- Os sete exemplares do tema escuro manterão exatamente as cores e razões do
  baseline.
- Nenhuma cor de fundo, estrutura, texto ou significado funcional mudará.

## 3. Tarefa congelada

- Fixture: sete elementos sintéticos com classes reais, injetados somente no
  navegador pelo `medir-contraste.py`
- Viewport: 1366x768; temas escuro e claro
- Seeds: não aplicável; cálculo determinístico WCAG 2.x
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `a15c6558aff71fc0f93c1995bd0816719d443743`
- Medidor: `medir-contraste.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente cores funcionais de primeiro plano no tema claro. Tema escuro,
tipografia, fundos, dimensões e conteúdo ficam fora desta rodada.

## 5. Decisão

**MANTER.** No tema claro, as sete razões passaram do intervalo
1,49:1–3,76:1 para 4,76:1–6,47:1. O menor resultado final é o badge verde,
com 4,76:1, acima do mínimo previsto de 4,5:1. No tema escuro, todas as sete
cores computadas e razões permaneceram exatamente iguais ao baseline.

Evidência bruta pareada: `antes.json` e `depois.json`, produzidos pelo mesmo
`medir-contraste.py`. A implementação altera somente a cor do texto sob
`:root[data-theme="light"]`; fundos e classes do tema escuro não mudaram.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
