# Exportação anual completa

Falha observada antes: botão Exportar Relatório .xlsx em RelatorioPage exporta apenas a relação de bens e o histórico. Dívidas, rendimentos, pagamentos, doações, rural, identificação, titularidade e dados complementares cadastrados não são entregues nesse arquivo.

Previsão registrada antes da mudança de produção: fixture sintético `src/utils/relatorioCompleto.test.js` passará de 2 abas exportadas para 20 (18 fichas preenchidas adicionais), preservando as duas abas existentes, valores numéricos, datas e metadados. Nenhuma fórmula será alterada.

Fixture congelado: código do teste citado; dados exclusivamente sintéticos; nenhuma aleatoriedade/seed; execução Node/Vitest 4.1.10; commit base `5437be361d9c0f7b321fd9f14e5936ee5df06577`. Modelo do auditor herdado da sessão, sem substituição. Working tree contém mudanças de rendimentos de outro agente e não integra o tratamento causal desta exportação.

Comando antes: `node node_modules/vitest/vitest.mjs run src/utils/relatorioCompleto.test.js`.

Saída antes (captura textual da execução 15:41:53):

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 ❯ src/utils/relatorioCompleto.test.js (1 test | 1 failed) 13ms
 × exporta dados de cada ficha preenchida e preserva bens e histórico 11ms
AssertionError: expected [ 'Relatório IRPF 2026', …(1) ] to deeply equal ArrayContaining{…}
- Expected
+ Received
- ArrayContaining [
+ [
    "Relatório IRPF 2026",
    "Histórico de Alterações",
-   "Titular",
-   "Dependentes",
-   "Bens - dados completos",
-   "Dívidas",
-   "Rendimentos",
-   "Pagamentos",
-   "Despesas Gerais",
-   "Doações Efetuadas",
-   "Doações Partidos",
-   "Doações ECA e Idoso",
-   "Imóveis Rurais",
-   "Bens Rurais",
-   "Dívidas Rurais",
-   "Livro-caixa Rural",
-   "RV Manual",
-   "Ganhos Capital Oficial",
-   "Resumo Importado",
  ]
 Test Files  1 failed (1)
      Tests  1 failed (1)
   Start at  15:41:53
   Duration  362ms (transform 111ms, setup 0ms, import 178ms, tests 13ms, environment 0ms)
```

Camada a alterar: serialização do relatório Excel, com ligação do mesmo conjunto anual já selecionado na tela. Não é uma mudança de harness/modelo. Não muda os saldos nem seu cálculo.

Implementação: `RelatorioPage` entrega os dados do ano selecionado ao exportador. `relatorioCompleto.js` registra 33 fichas/quadros e gera abas para os preenchidos, com estruturas aninhadas abertas em colunas. A relação original de bens e o histórico continuam presentes. Documento-fonte integral e registros técnicos não modelados continuam no backup; não são replicados como relatório de preenchimento. Quadros oficiais e manuais de renda variável ficam nomeados separadamente, evitando sugerir que devem ser somados.

Saída depois, primeira reexecução do fixture original junto às verificações de persistência:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 Test Files  9 passed (9)
      Tests  102 passed (102)
   Start at  15:43:24
   Duration  2.44s (transform 1.92s, setup 0ms, import 2.68s, tests 1.88s, environment 2ms)
```

A previsão tinha um erro de contagem: são 17 fichas preenchidas no fixture e duas abas preexistentes, total 19, não 20. O critério funcional é a lista explícita de abas/campos congelada no teste; ela passou integralmente. Nenhuma ficha do fixture foi removida para obter esse resultado.

Verificação adicional após incluir contrato dos 33 nomes de abas (unicidade, limite Excel de 31 caracteres, preservação de zero e ausência de abas vazias):

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Start at  15:45:09
   Duration  677ms (transform 225ms, setup 0ms, import 336ms, tests 68ms, environment 0ms)
```

Decisão: MANTER. O arquivo Excel passou a conter todas as 17 fichas preenchidas do fixture; a leitura do XLSX serializado preservou número como número. O teste não substitui validação visual em Excel/LibreOffice nem implica que todos os campos exigidos pelo IRPF futuro estejam modelados. Não houve teste estatístico: trata-se de contrato determinístico de serialização, sem alegação sobre taxa de sucesso de agentes.
