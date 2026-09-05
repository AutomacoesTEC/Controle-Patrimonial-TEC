# Auditoria independente de dados — 05/09/2026

Escopo: inventário do produto e investigação ativa de continuidade anual, importação/retificadora, persistência, backup e relatório anual. Base inspecionada: commit `5437be361d9c0f7b321fd9f14e5936ee5df06577`, com mudanças de rendimentos em trabalho por outro agente. Fixtures desta investigação são sintéticos. Este auditor não executou navegador nem examinou executável Windows; evidências visuais pertencem à rodada do agente principal. Fórmulas do Demonstrativo não foram alteradas por este auditor.

## Achados reproduzidos antes de correções do agente principal

| Achado | Trajetória e evidência | Consequência |
|---|---|---|
| D01 — movimento transportado duplica custo em ano existente | Bem custa 100 em 2025; benfeitoria de 20 em 2025; abrir 2026; retornar a 2025; corrigir data da benfeitoria para 2026. `auditoriaIndependente20260905.test.js` encontrou abertura 2026 de 120, quando deveria ser 100. O destino soma a benfeitoria sobre a abertura desatualizada. | Correção da data muda indevidamente a base patrimonial. Mesmo cenário com ano ainda inexistente passa. |
| D02 — correção tardia não atualiza abertura manual seguinte | Abrir 2026 sobre bem de 100; retornar a 2025 e incluir benfeitoria de 30. Fechamento 2025 vira 130, abertura 2026 continua 100. | Quebra da continuidade anual; ano já criado impede atualização automática. |
| D03 — retificadora apaga enriquecimento manual de rendimento importado | Rendimento importado recebe data e descrição manual; retificadora do mesmo controle substitui a linha. `data` passa a undefined, embora `UPDATE_RENDIMENTO` tenha conservado o declarado em `valorDeclarado`. | Perda silenciosa de data, metadados e rastreabilidade local. |
| D04 — relatório Excel incompleto | `RelatorioPage.jsx` 213–230 passava apenas bens ao exportador, sem demais fichas e sem titularidade. Teste congelado antes encontrou só duas abas. | Arquivo não atende a preparação anual prometida. Corrigido por este auditor e testado; ver EXPORTACAO-COMPLETA-EVIDENCIAS.md. |

Raiz D01/D02: `estadoNoAno` devolve snapshot existente sem revisar abertura (`reducer.js`, aproximadamente 321); `SALVAR_MOVIMENTACAO_DATADA` remove no ano ativo e aplica no destino sem reconciliar bases de anos já criados (aproximadamente 1307). Uma solução deve distinguir ano manual derivado e declaração importada: não reescrever automaticamente saldos declarados de um documento histórico. D03 decorre de `substituirImportados` na retificadora, que cria linhas novas e não conserva alterações locais do importado. Linhas citadas referem-se à base auditada e podem mudar nas correções.

Saída inicial bruta relevante do teste independente, executado às 15:40:53:

```text
 RUN  v4.1.10 /home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte
 ❯ src/store/auditoriaIndependente20260905.test.js (5 tests | 3 failed) 23ms
 × D01: transportar a mesma benfeitoria para ano já aberto deve manter custo final 120 7ms
 × D02: corrigir saldo anterior deve atualizar a abertura do ano manual já criado 1ms
 × D03: retificadora deve preservar dado manual de rendimento importado ou explicitar conflito 1ms
 FAIL D01
AssertionError: expected 120 to be 100 // Object.is equality
 FAIL D02
AssertionError: expected 100 to be 130 // Object.is equality
 FAIL D03
AssertionError: expected undefined to be '2025-05-01' // Object.is equality
 Test Files  1 failed (1)
      Tests  3 failed | 2 passed (5)
   Start at  15:40:53
   Duration  449ms (transform 234ms, setup 0ms, import 271ms, tests 23ms, environment 0ms)
```

Controles independentes aprovados: transporte de benfeitoria para ano novo, backup completo exportado/lido/restaurado conservando lançamento de ano não ativo, titularidade e campo adicional de comprovante.

## Inventário de fichas e alcance efetivo da verificação

“Lógica executada” abaixo significa testes puros ou testes existentes executados nesta rodada; não significa clique no navegador. Toda função visual (abrir modal, rolar, redimensionar, foco, alinhamento, confirmação, download pelo navegador, impressão) continua dependente da validação visual do agente principal.

| Ficha | Funções oferecidas identificadas no código | Verificação executada / limite |
|---|---|---|
| Perfis / desbloqueio | Criar, abrir, editar dados do perfil, proteção por senha, desbloquear, excluir, backup/restaurar, seleção nativa do arquivo | DataContext/App/bootstrap/persistência e backup executados; validação de arquivo, hash, senha, restauração e falha de gravação cobertos pela suíte existente. Seletor Python testado com janela falsa, não janela nativa real. |
| Importar Declaração | Ler PDF/DBK/DEC, validar integridade, prévia/revisão, conciliar retificadora, conferir dependentes, listar/carregar/excluir anos, exportar documento-fonte | Parser PDF sintético e integridade executados; reducer executou importação, retificadora comum/rural, retenção de manuais, vínculo rural e histórico. Fluxo de confirmações não clicado por este auditor. |
| Demonstrativo | Consulta anual/período, saldos, caixa/variação, comparação, identificação titular/dependente, gráficos, exportação, impressão | Este auditor investigou entradas e continuidade, sem recalcular nem alterar fórmulas. Auditoria matemática específica atribuída ao outro auditor. |
| Modalidade | Mostrar modalidade da declaração, espólio, herdeiros/partilha ou saída definitiva | Testes de modalidade executados; são quadros de consulta, sem novo cálculo fiscal. Renderização não testada. |
| Titular e Dependentes | Editar titular preservando cadastro importado; incluir/editar/excluir dependente, informar data e consultar por ano | Reducer testou CRUD e persistência entre anos; titularidade testada. Comportamento dos formulários por data requer browser. |
| Bens e Direitos | Incluir/editar/excluir, titular/dependente, aquisição datada, busca/filtros/ordenação, movimentos de compra/benfeitoria/venda parcial/total/baixa/ajuste, corrigir/excluir movimentos, exportar | Reducer e fluxo anual executados; cenários adversariais D01/D02 falharam inicialmente. Exportação completa conserva movimentos, titularidade, datas e metadados. Redimensionamento visual não executado por este auditor. |
| Dívidas e Ônus | Incluir/editar/excluir, titularidade/data, contratação/amortização/quitação/ajuste, correção/exclusão de movimento, filtros/exportação | Reducer executado; amortização fora do ano ativo passou no fluxoAnual. Os casos adversariais D01/D02 foram exercitados em bens; não se presume cobertura equivalente de cada variante de dívida. |
| Rendimentos | Incluir/editar/excluir tipo/fonte/beneficiário/data/valor/IRRF e campos complementares por tipo, filtros/exportação | CRUD/reconciliação executados; D03 comprovou perda de edição na retificadora. Campos recém-alterados pelo agente principal não tiveram UI exercitada por este auditor. |
| Pagamentos | Incluir/editar/excluir, código, favorecido/documento, titular/dependente, valor e parcela não dedutível, data, filtro/exportação | CRUD, transporte entre anos e backup independente executados; seletor de dependente não clicado aqui. |
| Despesas Gerais | Incluir/editar/excluir despesas pessoais de caixa, categoria/descrição/data/valor, titularidade, filtro/exportação | CRUD e zeragem de fluxos na virada executados na suíte reducer. Relação com cálculo do caixa fica na auditoria matemática. |
| Doações | Três subfichas: efetuadas, partidos/candidatos, ECA/idoso; incluir/editar/excluir, categoria/código/beneficiário/documento/valor/data/titularidade, exportação | CRUD e retificadora que preserva doações manuais executados; exportação das três coleções executada. Não houve validação de todas as opções visuais/códigos fiscais. |
| Rural — Imóveis Explorados | CRUD de imóvel e exploração, participantes importados, exportação | CRUD e reconciliação/vínculo de participantes executados. Data em edição direta identificada para revisão do agente principal. |
| Rural — Bens | CRUD, movimentos patrimoniais, filtro/exportação | Reducer exercitou CRUD, virada e retificadora com movimentos preservados. Não foram clicadas todas as combinações de tipo/data. |
| Rural — Dívidas Vinculadas | CRUD, contratação/amortização/quitação/ajuste, editar/excluir movimento, exportar | Reducer e histórico existentes executados; edição de cadastro despacha diretamente no ano ativo na base auditada. |
| Rural — Receitas e Despesas | Livro-caixa CRUD datado de receita/despesa e quadros mensais importados, filtros/exportação | CRUD/zeragem/retenção em retificadora executados. Regra de precedência manual/importado é questão da auditoria matemática, sem alteração aqui. |
| Rural — Resultado | Mostrar resultado manual/oficial, compensação de prejuízo e saldo a transportar | Reducer testou ajustes/virada e prejuízo importado. Não é certificação de apuração tributária. |
| Rural — Rebanho | Consultar movimentação importada por espécie | Preservação em importação/virada e exportação por registro genérico; não testada UI de cada espécie. |
| Ganhos de Capital | Ganhos derivados de movimentos, detalhamento oficial de imóveis/móveis/participações/moedas, inclusão de bem e venda, filtros/exportação | ganhoCapitalDetalhe/ganhoCapitalJuncao executados; informações de movimentos exportadas. Nenhuma nova garantia de cálculo fiscal de operação complexa. |
| Renda Variável | Operações comuns/day trade/FII/Fiagro por mês e titular/dependente; lançar mês manual, prevalência sobre importado, totais/compensação, filtros/exportação | cálculo mensal, mesclagem mensal, anual e reducer executados. Exportação distingue manual/importado para não induzir soma em duplicidade. |
| Relatório IRPF | Escolher ano, identificação, resumo importado, evolução patrimonial, bens agrupados, quadros oficiais/doações, imprimir/exportar | D04 corrigido. Teste de workbook reabriu XLSX e conferiu número. Aba original e histórico preservados; 33 fichas/quadros suportados no complemento, emitidos conforme disponibilidade. Impressão não executada. |
| Histórico de Alterações | Listar trilha com antes/depois, filtrar data, alternar ordem, redimensionar colunas | reducer.historicoCobertura executado; histórico integrado ao XLSX. Filtro e ordenação de UI apenas lidos. |

## Pontos adicionais para acompanhamento

1. `ImportPage` 167–175 identifica dados preexistentes por uma lista parcial de coleções. Doações, renda variável e despesas gerais isoladas podem não ativar o mesmo aviso/fluxo de reconciliação. Em snapshot histórico a origem se chama `origem`, mas o teste de importação anterior em torno de 231 lê `origemAnoAtual`. Evidência por inspeção, sem reprodução UI independente; comunicada ao agente principal.
2. Alterar data do cadastro de um bem não é necessariamente transportar toda a sua posição anual: um bem adquirido em ano anterior precisa continuar visível no ano atual. É necessário separar correção da data de aquisição, data de cadastro e data da movimentação para não destruir continuidade. Movimentos e fluxos têm contratos diferentes de estoques patrimoniais.
3. Exportação completa melhora entrega dos dados existentes, mas não cria dados ainda ausentes no app. Declarar o arquivo como suficiente para toda hipótese fiscal futura exigiria mapear campos por ficha e exercício do programa oficial. Documentos-fonte e quadros oficiais devem ser consultados quando existirem avisos de cobertura parcial.

## Execuções adicionais

21 arquivos de testes selecionados passaram inicialmente: 419 testes (102 em 9 arquivos + 317 em 12 arquivos). Após acrescentar validação dos nomes de abas, o arquivo de exportação passou 2 testes. Esses números não devem ser somados às execuções repetidas como se fossem casos únicos novos.

```text
 Test Files  12 passed (12)
      Tests  317 passed (317)
   Start at  15:43:46
   Duration  2.38s (transform 4.28s, setup 0ms, import 6.28s, tests 1.73s, environment 2ms)

...
----------------------------------------------------------------------
Ran 3 tests in 15.917s
OK
```

Suíte Python executada: `python3 -m unittest test_desktop_api.py`, com diretórios temporários e janela falsa. Não alterou perfis reais. Testes independentes D01–D03 foram entregues ao agente principal antes das correções; o resultado final deles deve ser anexado por quem integrar a correção, sem substituir o registro negativo acima.

## Correções adicionais autorizadas após o inventário

O agente principal delegou posteriormente a este auditor a correção de D01/D02/D03, mantendo o veto a mudanças de fórmulas. Foram corrigidos no reducer:

- Continuidade manual em bens/dívidas comuns e rurais, com eventos próprios conservados e interrupção em ano importado. Cadastro tardio também propaga saldo e titularidade. Foram executados casos de 2025–2027 e retificadora anterior com evento próprio no ano seguinte.
- Complementos manuais de rendimentos/pagamentos/doações preservados na retificadora por correspondência única. Se a declaração altera um valor também editado localmente, o valor novo prevalece e o local fica documentado em `ajustesLocaisRetificadora`. Sem correspondência segura de item editado, a reconciliação recusa a gravação e explica o motivo.
- Validação civil compartilhada de datas/anos no estado e projeção de anos distantes limitada a duas viradas, preservando o contrato de ano seguinte. Infinity antes não terminava; passou a ser recusado.

As evidências separadas estão em `CONTINUIDADE-RETIFICADORA-EVIDENCIAS.md` e `LIMITES-ANUAIS-EVIDENCIAS.md`. Última rodada selecionada passou 231 testes em 9 arquivos. O código de produção foi congelado às 15:55 para o E2E do agente principal. Esta auditoria não executou UI e não declara o app integralmente validado a partir apenas dos testes puros.

## Complemento posterior: testes reais de navegador

Após essa entrega inicial, o agente principal solicitou testes independentes complementares na UI. Foram executados os casos descritos em `E2E-FUNCOES-ADICIONAIS.md`, com script `auditar-funcoes-adicionais.py`. Assim, as ressalvas anteriores de UI não exercitada se aplicam à primeira etapa, não às funções explicitamente verificadas no complemento.

O E2E encontrou falha real nas exportações individuais de doações Partidos e ECA/Idoso: títulos de abas excediam o limite Excel. O agente principal corrigiu o exportador; reexecução comprovou edição/exportação/exclusão nas três subfichas. Também foram executadas edição/exclusão de rendimentos/despesas, edição/exclusão de movimentos nas quatro coleções patrimoniais, filtros e ordenação, histórico, sobrescrita mensal de RV comuns/FII e impressão/PDF Chromium. Não houve erro JS nas reexecuções. A ausência de exclusão de mês de RV foi registrada como melhoria futura.
