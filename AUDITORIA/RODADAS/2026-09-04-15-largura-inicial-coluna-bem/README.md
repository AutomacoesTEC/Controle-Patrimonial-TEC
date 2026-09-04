# Rodada 15 — largura inicial explícita para a coluna Bem

## 1. Falha nomeada

O componente `TabelaRedimensionavel` sempre congela as larguras produzidas
pelo layout automático e não oferece contrato para uma tela declarar que uma
coluna textual precisa de mais espaço. Na apuração de ganho de capital, Bem
fica em 104 px e quatro linhas; `width` direto no `<th>` foi comprovadamente
ineficaz e revertido na rodada 14.

Trajetória: importar AJU-01, abrir Ganhos de Capital em 1366x768 e 1280x720,
nos dois temas, e medir as larguras e linhas do primeiro bem.

## 2. Previsão escrita antes da mudança

- Bem passará de 104 px para 260 px e de quatro para no máximo duas linhas nas
  quatro combinações.
- Aquisição e Alienação permanecerão em 104 px; as cinco colunas monetárias
  manterão larguras e visibilidade exatamente iguais.
- O overflow aumentará exatamente 156 px, sem compressão ou mudança de dados.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Tela: Ganhos de Capital; tabela Apuração do Ganho de Capital
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `ef79f3b40cb37d6340c2b50f576d897468e6a299`
- Medidor: `medir-coluna-bem.py`, wrapper do fixture congelado na rodada 14;
  saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente o contrato de largura inicial do componente e seu uso na coluna Bem.
Datas, colunas monetárias, dados e cálculos ficam fora.

## 5. Decisão

**REVERTER.** O contrato produziu o efeito principal (Bem em duas linhas),
mas não cumpriu as previsões exatas: a coluna ficou em 263 px, não 260 px; o
overflow cresceu 157 px, não 156 px; e Ganho passou de 115 para 114 px.

Como “quase igual” não satisfaz uma previsão pareada, o contrato e seu uso
foram removidos. O produto voltou integralmente ao commit-base. A saída
`depois.json` preserva o resultado da tentativa; `antes.json` preserva o
baseline. Uma próxima rodada pode formular o critério correto em termos de
legibilidade e não de arredondamento interno do algoritmo de tabela HTML.
