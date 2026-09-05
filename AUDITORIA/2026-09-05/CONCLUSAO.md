# Entrega das alterações e auditoria

Data: 05/09/2026. Aplicativo CP-TEC. Escopo executado no código-fonte e no navegador local; nenhuma base real foi usada para testes de escrita. O fluxo adotado é base patrimonial do ano-calendário2025, fatos datados em2026 e relatório preparatório para a declaração de2027.

## Resultado por requisito

| Pedido | Implementação e evidência |
|---|---|
| Acompanhar mudanças no localhost | Servidor Vite em127.0.0.1:5173. Abrir http://localhost:5173 no computador com WSL. Não foi publicada uma URL externa. Os testes usam contextos descartáveis, não o armazenamento do navegador do usuário. |
| Cadastros/alterações pelo ano da data, sem seletor anual no formulário | Datas em bens, dívidas, titular/dependentes, rendimentos, pagamentos, despesas, doações e rural; validação ISO completa. Consultas continuam com seleção de ano; RV mantém competência mensal. uso-congelado.txt, validacao-cadastros.txt e SUBAUDITORIA-CADASTROS.md. |
| Movimento em2026 cadastrado com2025 ativo aparece no destino | Roteamento pela data preserva a seleção, cria abertura derivada e permite corrigir a data de um movimento existente. fluxoAnual.test.js e auditoriaIndependente20260905.test.js; fluxo com recarga/troca de ano em uso-congelado.txt. |
| Continuidade entre anos já abertos | Correção tardia atualiza saldos de abertura dos anos manuais derivados, preserva movimentos próprios e não sobrescreve declaração importada. CONTINUIDADE-RETIFICADORA-EVIDENCIAS.md. |
| Titular ou dependente nos bens e demais registros | Seleção explícita, vínculo por CPF/id e indicação na listagem; inclusive pagamentos, despesas, doações e rural. SeletorTitularidade e titularidade.test.js; cadastros reais de navegador em uso-congelado.txt. Não se atribui titularidade desconhecida por suposição. |
| Dashboard geral/titular/dependente | Filtro de pessoa incluindo histórico. Dados não atribuídos ficam na visão geral, com aviso no recorte. Cálculos originais não foram modificados. Teste puro do filtro e três seleções no navegador. |
| Colunas redimensionáveis em todas as fichas tabulares | Todas as46tabelas JSX de produção estão envolvidas pelo componente de redimensionamento, incluindo detalhes e relatórios. Arraste real em cinco fichas, cabeçalhos das demais inspecionados no código; imagens e rodada-3-depois.json. Não há promessa de testar todas as larguras possíveis. |
| Remover Compacto e rolagem vertical das abas horizontais | Botão/estado de compacto removidos; abas horizontais com overflow-y:hidden. O menu lateral ainda rola quando sua altura excede a janela, para não esconder fichas. rodada-3-depois.json. |
| Dívidas desalinhadas | Ações com espaço mínimo e tabela uniforme; captura dividas-1366.png e testes de cadastro, edição, exclusão e movimentos. |
| Campos de rendimentos conforme natureza | PJ: previdência e13º; PF/exterior: previdência, pensão e livro-caixa; RRA: bruto/deduções/meses/tributação; isentos de operação sem fonte obrigatória indevida. Fontes oficiais em RODADA-5.md; testes de campos/payload e navegador. Não equivale a apuração fiscal automática completa. |
| Pagamentos: selecionar o dependente | Selecionar Dependente abre lista vinculada; teste gravou CPF correto e transportou edição entre anos. |
| Imagem10: somente Ações fixa | Pagamentos passou de quatro colunas fixas para uma. Valores e demais colunas rolam. rodada-3-depois.json. |
| Relatório anual utilizável | Excel inclui todas as fichas modeladas preenchidas, datas, titularidade, complementos, movimentos e trilha. Exportação individual de doações corrigida para nomes válidos no Excel. Exportação testada com reabertura do XLSX e downloads. |
| Auditor independente e teste das funções | Inventário em AUDITORIA-INDEPENDENTE-DADOS.md; auditoria adicional de21cenários em E2E-FUNCOES-ADICIONAIS.md; testes principais e importação/perfis descritos abaixo. Defeitos fora do motor corrigidos e verificados. |
| Relatório prévio do Demonstrativo | RELATORIO-DEMONSTRATIVO.md:11falhas do motor reproduzidas por testes e D12 do indicador percentual. Fórmulas preservadas. |
| Consultoria de otimizações | OTIMIZACOES-PROPOSTAS.md prioriza conciliação, identidade das operações, datas financeiras/fiscais, fechamento mensal/anual, comprovantes e restauração. São recomendações, não funcionalidades declaradas como implementadas. |

## Verificação final

- Suíte completa: 66 arquivos, 1.012 testes aprovados e 11 falhas esperadas conhecidas do Demonstrativo (1.023 cenários). Saída: suite-final-aprovacao.txt. Essas 11 falhas esperadas não significam que o motor esteja correto.
- Backend desktop: 3 testes aprovados, usando janela falsa e armazenamento temporário; desktop-final.txt.
- Build de produção aprovado em diretório temporário, sem sobrescrever o pacote desktop existente; build-final-aprovacao.txt.
- Navegador principal: 16 cenários aprovados, sem erros JavaScript, na repetição final uso-final.txt; execução anterior em uso-congelado.txt.
- Navegador independente adicional: 21 cenários aprovados em rodadas documentadas, não em uma única execução; E2E-FUNCOES-ADICIONAIS.md.
- Importação/perfis/titular: 8 cenários, consolidados em importacao-perfis-depois.txt, importacao-aju-final.txt, perfis-retificadora-final.txt, retificadora-historico-reteste.txt e titular-final.txt. Incluem PDF real sintético, troca de titular, espólio/saída, backup/restauração, senha, apelido/exclusão, conciliação, avanço/carga/exclusão, cancelamento e gravação do titular pelo ano da data. Falhas anteriores de seletor/instrumentação estão preservadas e classificadas, não atribuídas ao produto.
- Impressão: teste pareado de largura A4 passou de330px de excesso para zero; impressao-tabelas-antes.txt e impressao-tabelas-depois.txt. PDF gerado e última página renderizada para inspeção, sem coluna cortada. Impressora física/diálogo nativo não foram exercitados.

Os testes em navegador mantêm suas próprias bases sintéticas. Downloads, PDFs e algumas capturas complementares são artefatos externos temporários, nos caminhos registrados nas saídas; não são apresentados como pacotes selados presentes no repositório. Os scripts e fixtures versionados permitem reexecutar a investigação com Playwright/Chromium instalados.

## Limites e decisões preservadas

1. As12inconsistências do Demonstrativo foram relatadas antes de qualquer correção de fórmula. O chamado saldo de caixa é atualmente uma diferença de conciliação patrimonial, não saldo bancário disponível. Não usar os indicadores como conferidos até resolver esses pontos.
2. Uma edição da data histórica de aquisição não transporta o estoque inteiro para o passado. Movimentos financeiros têm sua própria data; cadastros novos e fluxos usam a data informada. Nova aquisição começa sem saldo anterior; registros importados são preservados.
3. Não houve migração silenciosa dos dados reais do usuário. Movimentos antigos que tenham sido gravados no ano errado precisam ser conferidos; o formulário agora permite corrigir sua data/destino com continuidade. Recomenda-se backup antes de revisar a base antiga.
4. PDF pode conter fichas com cobertura parcial, assinaladas pelo aplicativo. O relatório Excel exporta o que está modelado/armazenado; não promete suficiência para qualquer hipótese fiscal nem presume regras futuras da DIRPF2027.
5. Não há exclusão de mês de RV oferecida pela interface; existe sobrescrita da mesma competência. Uma função de remover ajuste mensal e restaurar a origem importada foi recomendada, não adicionada neste escopo.
6. A auditoria combinou análise independente de código, testes sintéticos, interação Chromium e backend simulado. Não é certificação tributária profissional, prova sobre todos os dados reais ou ensaio do executável Windows empacotado.
