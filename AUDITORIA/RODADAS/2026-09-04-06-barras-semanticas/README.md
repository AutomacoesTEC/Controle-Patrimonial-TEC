# Rodada 06 — barras semânticas nos cards estatísticos

## 1. Falha nomeada

Os cards estatísticos usam barras decorativas em gradiente: verde-ciano,
laranja-vermelho e roxo-rosa. Em Ganhos de Capital, o card de ganho positivo
usa a variante roxa, sem relação com o significado do valor. Isso contraria o
sistema visual Ardósia, que reserva cores funcionais para significado fiscal
e proíbe gradientes chamativos.

Trajetória: importar AJU-01, abrir Dashboard, Ganhos de Capital e Atividade
Rural nos dois temas e ler o estilo computado do pseudo-elemento `::after` de
todos os cards estatísticos, além do botão verde de exportação.

## 2. Previsão escrita antes da mudança

- Gradientes nos sete cards medidos: 7 para 0 em cada tema.
- Todas as barras passam de 3 px para 2 px e usam cor sólida semântica:
  primária para neutro, verde para ganho/resultado e vermelho para
  dívida/despesa/perda.
- O card de Ganhos de Capital passa de roxo para verde no fixture, cujo total
  é positivo.
- O botão `.btn-success` também deixa de depender do token de gradiente
  removido, sem mudar texto ou ação.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Telas: Dashboard, Ganhos de Capital e Atividade Rural
- Temas: escuro e claro; viewport: 1366x768
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `b353215e489b313b9dee40fa35f5ac2ecd2a9a8e`
- Medidor: `medir-barras.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente tokens e aplicação visual das barras de cards estatísticos e do token
verde removido. Estrutura, conteúdo, dados e cálculos não mudam.

## 5. Decisão

**MANTER.** Antes, as 14 barras medidas (sete por tema) tinham gradiente e
3 px; depois, 14/14 são sólidas e têm 2 px. Cards neutros usam o token
primário, dívida/despesa usam `danger` e ganho/resultado positivo usam
`success`. No fixture, Ganhos de Capital mudou corretamente de `purple` para
`green`. O botão `.btn-success` também passou de gradiente para verde sólido.

Os tokens `--gradient-success` e `--gradient-warm` foram removidos e a regra
foi registrada em `DESIGN.md`. Estrutura e conteúdo ficaram intocados. Saídas
brutas: `antes.json` e `depois.json`.

Verificações adicionais: `npm run build` concluído; `npm test` com 37 arquivos
e 872 testes aprovados.
