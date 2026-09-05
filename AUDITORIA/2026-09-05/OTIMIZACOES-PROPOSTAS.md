# Propostas para acompanhamento periódico

Revisão de 05/09/2026, após estudo integral de `deep-research-report (2).md` e autorização das correções D01–D12. Documento de consultoria técnica, não autorização para implementar automaticamente as propostas abaixo. A versão anterior permanece no histórico Git. Não presume instruções futuras da DIRPF 2027.

## Nova avaliação

O aplicativo ganhou uma base melhor de conciliação patrimonial: corrigiu retenções, integração de RV/FII, duplicidades reproduzidas, complementos rurais, datas de doações e precisão dos saldos anuais. A identificação titular/dependente agora está na primeira coluna de Bens, com filtro e totais do recorte. A caixa principal passou a se chamar Diferença de conciliação, sem tolerância configurável para esconder desvios. Isso **não transforma a aplicação em um razão bancário conciliado**.

A próxima prioridade não é acrescentar mais índices. É registrar a identidade e a cronologia dos fatos que sustentam os índices. O estudo reforçou três visões distintas: patrimônio fiscal, fluxo financeiro conciliado e patrimônio econômico opcional. Hoje a primeira existe e a segunda é parcialmente inferida das fichas; a terceira não deve ser misturada à DIRPF.

Antes de usar a base antiga após essas mudanças: faça backup; confira o 13º informado como líquido, os pagamentos de impostos, os meses rurais antes usados como substituição implícita, as doações da DAA sem data e as vendas sem vínculo. O código não reescreveu silenciosamente os dados reais. O reconhecimento financeiro mudou e pode alterar os indicadores de períodos já cadastrados.

## Prioridade 1 — tornar o acompanhamento verificável

1. **Completar a separação das três visões:** o residual principal já foi renomeado, mas ainda falta uma disponibilidade financeira calculada por contas/extratos e, opcionalmente, patrimônio econômico a mercado. Créditos e investimentos não são automaticamente caixa disponível. Critério de aceite: banco de R$ 110 mil e diferença de conciliação zero coexistem sem mensagens contraditórias; indicadores fiscais não recebem valorização de mercado sem fundamento.
2. **Uma operação, várias representações fiscais:** venda de bem, recebimentos, custo baixado, ganho, imposto e rendimento exclusivo devem compartilhar identidade, evitando digitação e soma duplicadas. Critério: importar GCAP após cadastrar uma venda não altera o resultado econômico da operação já reconhecida.
3. **Conciliação mensal por conta:** saldo inicial + entradas − saídas = saldo do extrato. Transferências próprias não são renda nem despesa; titular/dependente são contrapartes identificadas. Critério: cada diferença tem lista de movimentos que a explica e itens ainda pendentes.
4. **Completar a precisão das datas:** a repetição da foto anual nos meses foi corrigida; doação na DAA já separa ano-base e pagamento. Faltam datas financeiras próprias para os demais tributos, parcelas e recebimentos. O Carnê-leão legado está associado à data do rendimento e RV à competência mensal: isso não prova o dia bancário. Critério: consultas disjuntas somam o total sem duplicação e distinguem realizado, projetado e desconhecido.

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
- Separar as regras de integração fiscal dos componentes visuais, com testes sintéticos de não duplicação e invariantes. Os 11 casos antes marcados como falhas esperadas foram convertidos em regressões normais; D12 tem cinco cenários próprios. Manter os oráculos aritméticos além dos goldens: atualizar uma referência não prova a correção do motor.
- Oferecer remoção explícita do ajuste mensal de RV para restaurar o valor importado. Hoje o usuário pode sobrescrever o mês, mas não desfazer a sobreposição pela interface.
- Refinar paginação dos relatórios impressos para aproveitar melhor a folha, mantendo os valores e todos os cabeçalhos legíveis. O corte lateral foi corrigido; aproveitamento de espaço continua sendo uma melhoria de apresentação.

## Ordem recomendada de implementação futura

1. Conferir a base antiga com backup e lista de impactos das correções já feitas.
2. Criar identidade de operação e conciliação explícita entre fichas: a sobreposição agregada atual é limitada e exige revisão quando resumos divergem ou pertencem a operações distintas.
3. Introduzir contas, extratos, transferências internas pareadas e cronograma de parcelas; separar custo, principal, rendimento, taxas e imposto pago.
4. Implantar fechamento mensal versionado, pendências documentais e anexos.
5. Ampliar regimes específicos conforme os perfis atendidos: rural, MEI/PJ relacionada, exterior e cripto. Regras novas devem ser pesquisadas oficialmente por ano de vigência antes de codificar alíquotas ou obrigações.

Não recomendo preencher dados faltantes com zero nem considerar uma conciliação fiscal fechada como prova da origem individual de todos os créditos. Para acompanhamento satisfatório, o fechamento mensal deve trazer saldo do extrato, operações explicadas, documentos pendentes e revisão de titularidade, com aprovação humana registrada.

As fontes e os exemplos numéricos das recomendações fiscais estão no relatório RELATORIO-DEMONSTRATIVO.md. Este documento apresenta recomendações de arquitetura e operação; não promete certificação tributária nem testes de todas as versões do aplicativo desktop.
