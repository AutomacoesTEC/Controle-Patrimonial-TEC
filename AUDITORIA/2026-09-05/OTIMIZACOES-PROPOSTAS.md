# Propostas para acompanhamento periódico

Documento de consultoria técnica, não alteração automática do produto. Elaborado a partir do inventário independente, dos testes de cadastro e da auditoria matemática. As propostas do Demonstrativo dependem da revisão do relatório prévio e da autorização do responsável. Não presume instruções futuras da DIRPF 2027.

## Prioridade 1 — tornar o acompanhamento verificável

1. **Separar três números:** patrimônio líquido (bens menos dívidas), disponibilidade financeira conciliada (contas e numerário) e diferença não explicada entre origens e aplicações. Hoje o chamado saldo de caixa é um residual patrimonial; não se deve tratá-lo como dinheiro disponível. Critério de aceite: a mesma família pode ter banco de R$110 mil e diferença de conciliação zero, sem mensagens contraditórias.
2. **Uma operação, várias representações fiscais:** venda de bem, recebimentos, custo baixado, ganho, imposto e rendimento exclusivo devem compartilhar identidade, evitando digitação e soma duplicadas. Critério: importar GCAP após cadastrar uma venda não altera o resultado econômico da operação já reconhecida.
3. **Conciliação mensal por conta:** saldo inicial + entradas − saídas = saldo do extrato. Transferências próprias não são renda nem despesa; titular/dependente são contrapartes identificadas. Critério: cada diferença tem lista de movimentos que a explica e itens ainda pendentes.
4. **Precisão da data:** distinguir aquisição, fato econômico, pagamento/recebimento, registro no aplicativo e competência fiscal. Declaração anual sem dia conhecido deve permanecer anual; não distribuir artificialmente sua variação por meses. Critério: somar períodos disjuntos não multiplica uma foto anual.

## Prioridade 2 — rotina mensal e fechamento anual

- Lista de pendências: comprovantes ausentes, dependente não identificado, saldo incompatível entre anos, parcelas pendentes, imposto sem quitação e conflito de retificadora. Cada pendência precisa de origem e ação de resolução, não apenas cor de alerta.
- Parcelamento de vendas/compras e dívidas: separar principal, juros, amortização e pagamento. Um contrato de venda não comprova recebimento integral no dia da assinatura.
- Fechamento mensal com responsável e data; reabertura controlada preservando versão anterior. Retificação tardia deve mostrar quais aberturas futuras mudam e quais declarações importadas permanecem intocadas.
- Anexos ou referências locais aos comprovantes, associados à operação e acessíveis pelo relatório anual. Evitar inserir PDFs grandes no localStorage: usar armazenamento local de documentos no desktop e backup que declare explicitamente o que inclui.
- Checklist de encerramento: conciliar contas, revisar saldos de bens/dívidas, identificar rendimentos e impostos, verificar titular/dependentes e emitir relatório por ficha/código. O Excel preparatório não substitui o programa oficial nem confirma cobertura de todas as hipóteses fiscais.

## Prioridade 3 — manutenção, segurança e usabilidade

- Backup versionado e teste periódico de restauração em perfil descartável; confirmação de senha e integridade antes de afirmar que uma cópia é recuperável. Nunca testar restauração sobre o único perfil de trabalho.
- Migrações de dados com prévia: detectar movimentos antigos armazenados fora do ano da data, propor destinos e vínculos e manter cópia anterior. Não corrigir ambiguidades por semelhança de descrição.
- Revisão de proveniência: diferenciar valor declarado, enriquecimento local e decisão tomada numa retificadora. Mostrar diferenças na tela e no relatório.
- Modais e tabelas com teste automatizado de teclado, largura reduzida, rolagem e impressão. Para E2E, congelar o código durante a execução: atualização automática de desenvolvimento pode desmontar uma janela e invalidar o teste.
- Separar as regras de integração fiscal dos componentes visuais, com testes sintéticos de não duplicação e invariantes contábeis. A suíte do Demonstrativo contém falhas esperadas: sua cor verde não é aprovação do motor.
- Oferecer remoção explícita do ajuste mensal de RV para restaurar o valor importado. Hoje o usuário pode sobrescrever o mês, mas não desfazer a sobreposição pela interface.
- Refinar paginação dos relatórios impressos para aproveitar melhor a folha, mantendo os valores e todos os cabeçalhos legíveis. O corte lateral foi corrigido; aproveitamento de espaço continua sendo uma melhoria de apresentação.

## Ordem recomendada de implementação futura

Primeiro aprovar conceitos e migração do Demonstrativo; depois corrigir uma divergência reproduzida por vez; em seguida introduzir contas/conciliação e parcelas; por último automatizar checklist, anexos e fechamento. Fazer apenas melhorias visuais não torna confiável um indicador com origem econômica incompleta.

As fontes e os exemplos numéricos das recomendações fiscais estão no relatório RELATORIO-DEMONSTRATIVO.md. Este documento apresenta recomendações de arquitetura e operação; não promete certificação tributária nem testes de todas as versões do aplicativo desktop.
