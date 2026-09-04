# Rodada 16 — coluna Bem legível por contrato do componente

## 1. Falha nomeada

Na apuração de ganho de capital, o identificador do Bem ocupa quatro linhas
porque o componente congela a largura automática em 104 px e não aceita uma
largura inicial adequada a conteúdo textual.

Trajetória: importar AJU-01, abrir Ganhos de Capital em 1366x768 e 1280x720,
nos dois temas, e medir as larguras e linhas do primeiro bem.

## 2. Previsão escrita antes da mudança

- O texto do Bem passará de quatro para no máximo duas linhas e sua coluna
  terá pelo menos 240 px nas quatro combinações.
- Aquisição e Alienação permanecerão com a mesma largura do baseline.
- As cinco colunas monetárias continuarão integralmente visíveis; variação de
  até 1 px de arredondamento por coluna é aceita pelo algoritmo de tabela.
- Texto, valores e cálculos permanecerão iguais.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Tela: Ganhos de Capital; tabela Apuração do Ganho de Capital
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `a4c8a3b5be04a38fc86ba02e24293f2fc6fe4565`
- Medidor: `medir-coluna-bem.py`, wrapper do fixture da rodada 14; saídas:
  `antes.json` e `depois.json`

## 4. Camada causal

Somente o contrato de largura inicial do componente e seu uso na coluna Bem.
Datas, bloco monetário, dados e cálculos ficam fora.

## 5. Decisão

**MANTER.** Nas quatro combinações, Bem passou de 104 para 263 px e de
quatro para duas linhas. Aquisição e Alienação permaneceram em 104 px. As
cinco colunas monetárias continuaram integralmente visíveis; quatro mantiveram
a largura exata e Ganho variou de 115 para 114 px, dentro da tolerância de
arredondamento prevista.

Texto e valores permaneceram idênticos. O overflow cresceu para acomodar o
conteúdo, sem comprimir as colunas críticas. Evidência bruta pareada:
`antes.json` e `depois.json`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
