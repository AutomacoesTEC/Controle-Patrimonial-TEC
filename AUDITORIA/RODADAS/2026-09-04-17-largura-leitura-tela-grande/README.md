# Rodada 17 — largura de leitura em tela grande

## 1. Falha nomeada

Em 2880x1620, `.page-body` ocupa toda a largura disponível. No Demonstrativo
do Dashboard, o rótulo fica muito distante do valor correspondente, exigindo
uma varredura horizontal longa para conferir cada linha.

Trajetória: importar AJU-01, abrir o Dashboard em 2880x1620 e 1366x768, nos
dois temas, e medir largura do corpo, largura do card Variação Patrimonial,
distância entre texto e valor da primeira linha e margens laterais.

## 2. Previsão escrita antes da mudança

- Em 2880x1620, o corpo terá no máximo 1600 px, ficará centralizado e o card
  terá no máximo 1544 px; a distância texto–valor ficará abaixo de 1400 px.
- Em 1366x768, todas as medidas permanecerão exatamente iguais ao baseline.
- Temas, textos, valores, cálculos e rolagem vertical não mudarão.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Tela: Dashboard; card Variação Patrimonial
- Viewports: 2880x1620 e 1366x768; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `be74a6bc1406be4cfca46d50fe0d89a81ec11964`
- Medidor: `medir-largura.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente largura máxima e centralização do corpo das páginas em telas grandes.
Componentes internos, tamanhos de laptop, conteúdo e cálculos ficam fora.

## 5. Decisão

**MANTER.** Em 2880x1620, o corpo passou de 2620 para 1600 px, o card de
2564 para 1544 px e a distância entre rótulo e valor de 2318 para 1298 px.
O corpo ficou centralizado, com margens iguais de 510 px. Nos dois temas, as
quatro medidas de 1366x768 permaneceram exatamente iguais ao baseline.

A rolagem vertical continuou ativa em todas as combinações. A regra só atua
a partir de 1800 px e não altera componentes internos. Evidência bruta:
`antes.json` e `depois.json`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: segunda execução aprovada, com 37 arquivos e 872 testes. A
  primeira terminou com três timeouts preexistentes de extração de PDF
  (5/10 s), sem falha de asserção: 858 testes passaram e 13 ficaram pulados
  pelos hooks interrompidos. A repetição integral passou sem alteração.
