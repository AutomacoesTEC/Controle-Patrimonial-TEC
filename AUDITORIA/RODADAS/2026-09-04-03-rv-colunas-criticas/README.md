# Rodada 03 — colunas críticas da Renda Variável

## 1. Falha nomeada

Na tabela mensal de Operações Comuns / Day-Trade, em 1366x768 e 1280x720,
a largura excede o contêiner em 491 e 577 px. Com a tabela na posição inicial,
`Resultado day-trade`, `Imposto a pagar`, `Imposto pago` e `Mercados` ficam
fora da área visível, sem qualquer resumo de qual mês esses valores pertencem
depois da rolagem lateral.

Trajetória: importar AJU-01 em perfil novo, abrir Renda Variável na ficha
Operações Comuns / Day-Trade e medir a primeira tabela mensal nos temas claro
e escuro e nos dois viewports, tanto em `scrollLeft=0` quanto no fim da rolagem.

## 2. Previsão escrita antes da mudança

- As três colunas fiscais finais e o botão `Mercados` ficarão integralmente
  visíveis nas quatro combinações, já na posição inicial.
- A coluna `Mês` continuará integralmente visível ao rolar até o extremo
  direito, preservando o contexto da linha.
- A sobra horizontal continuará igual em cada par; nenhuma coluna será
  comprimida e nenhum valor ou cálculo será alterado.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `c81bdf9bfb00a4bef83042c824b935ab2411b26e`
- Medidor: `medir-rv.py`; saídas brutas: `antes.json` e `depois.json`

## 4. Camada causal

Somente layout/posicionamento das colunas da tabela mensal de Operações
Comuns / Day-Trade. Cálculos, dados, tabela anual e ficha FII/Fiagro ficam fora.

## 5. Decisão

**MANTER.** Antes, as quatro colunas críticas estavam ocultas na posição
inicial em 4/4 combinações e a coluna `Mês` desaparecia no extremo direito.
Depois, `Resultado day-trade`, `Imposto a pagar`, `Imposto pago` e `Mercados`
ficam integralmente visíveis em 4/4, e `Mês` continua visível no fim.

A sobra horizontal permaneceu idêntica em cada par: 491 px em 1366x768 e
577 px em 1280x720. Logo, nenhuma coluna foi comprimida. O componente de
tabela ganhou parâmetros opt-in para fixar a primeira coluna e N colunas à
direita; apenas a tabela mensal de Operações Comuns / Day-Trade os ativa.
Saídas brutas: `antes.json` e `depois.json`.

Verificações adicionais: `npm run build` concluído; `npm test` com 37 arquivos
e 872 testes aprovados.
