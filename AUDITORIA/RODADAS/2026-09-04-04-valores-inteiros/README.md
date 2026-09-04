# Rodada 04 — valores monetários inteiros em tabelas largas

## 1. Falha nomeada

Em 1280x720, com a rolagem horizontal na posição inicial, blocos monetários
atravessam a borda direita das tabelas: `Valor/IRRF` em Rendimentos,
`Valor pago/Parcela não dedutível` em Pagamentos e as cinco colunas de `Custo`
até `Imposto pago` na Apuração do Ganho de Capital. O resultado é um número
fiscal cortado no meio ou encoberto pela coluna de ações.

Trajetória: importar AJU-01, abrir cada uma das três telas no tema claro e no
escuro, em 1280x720 e `scrollLeft=0`, e medir cabeçalho e primeira célula de
cada coluna monetária alvo contra os limites do contêiner.

## 2. Previsão escrita antes da mudança

- Cabeçalhos e primeiras células dos nove campos monetários ficarão
  integralmente visíveis nas seis combinações tela/tema.
- Rendimentos e Pagamentos continuarão com `Ações` visível.
- A sobra horizontal de cada tabela não diminuirá: nenhuma coluna ou texto
  será comprimido; cálculos e valores permanecerão idênticos.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Viewport: 1280x720; temas escuro e claro
- Telas/colunas: Rendimentos (`Valor`, `IRRF`), Pagamentos (`Valor Pago`,
  `Parcela Não Dedutível`) e Ganhos de Capital (`Custo`, `Valor Alienação`,
  `Ganho`, `Imposto Devido`, `Imposto Pago`)
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `335bc1df76a070cfd7b7e945212c5d24cae50a87`
- Medidor: `medir-valores.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente posicionamento responsivo dos blocos monetários dessas três tabelas.
Dados, formatação monetária, cálculos e tabelas fora do escopo não mudam.

## 5. Decisão

**MANTER.** Antes, cinco dos nove campos-alvo estavam parcial ou totalmente
fora do contêiner em cada tema: `Valor`, `IRRF`, `Parcela Não Dedutível`,
`Imposto Devido` e `Imposto Pago`. Depois, cabeçalho e primeira célula dos
nove campos estão integralmente visíveis nas seis combinações tela/tema.

As ações de Rendimentos e Pagamentos continuam visíveis. As sobras horizontais
permaneceram exatamente 322, 318 e 205 px em cada par, demonstrando que não
houve compressão. A mudança apenas ativa, por tabela, o bloco de colunas fixas
adicionado na rodada anterior. Saídas brutas: `antes.json` e `depois.json`.

Verificações adicionais: `npm run build` concluído; `npm test` com 37 arquivos
e 872 testes aprovados.
