# Rodada 12 — quatro cards distribuídos em duas linhas equilibradas

## 1. Falha nomeada

Em laptops, as grades de resumo com quatro cards usam `auto-fit` e acomodam
três cards na primeira linha, deixando o quarto sozinho na segunda. A
trajetória aparece no resumo de Rendimentos e no “Resumo da Declaração
Importada” do Relatório IRPF, prejudicando comparação e equilíbrio visual.

Trajetória: importar AJU-01, abrir as duas grades em 1366x768 e 1280x720, nos
temas claro e escuro, e agrupar seus quatro filhos pela coordenada vertical.

## 2. Previsão escrita antes da mudança

- As oito combinações (2 telas × 2 tamanhos × 2 temas) passarão de distribuição
  `3+1` para `2+2`.
- As grades continuarão sem overflow horizontal.
- Quantidade, ordem, texto e valores dos cards permanecerão iguais.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Grades: resumo de Rendimentos e Resumo da Declaração Importada do Relatório
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `4aa4f9599c1707a269e837bae3161c7a945485a6`
- Medidor: `medir-grade.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente a distribuição responsiva de grades explicitamente marcadas como
grades de quatro cards. Conteúdo, paleta e demais grades ficam fora.

## 5. Decisão

**REVERTER.** A medição “antes” refutou a premissa de que as oito
combinações estavam em `3+1`: Rendimentos em 1366x768 já usa uma linha
equilibrada de quatro cards, nos dois temas. O defeito existe nas outras seis
combinações, mas aplicar a previsão original também mudaria um estado correto.

Nenhuma camada de produto foi alterada. A repetição do mesmo fixture produziu
saída idêntica, preservada em `antes.json` e `depois.json`. A correção será
reformulada em rodada própria para trocar apenas distribuições `3+1` por
`2+2`, mantendo `4` onde os quatro cards já cabem.
