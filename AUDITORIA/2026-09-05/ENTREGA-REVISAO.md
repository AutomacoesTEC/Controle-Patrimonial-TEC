# Entrega da revisão após estudo

05/09/2026. Código-fonte do CP-TEC; alterações locais, sem publicar em serviço externo e sem modificar as bases reais do usuário. A versão anterior da auditoria continua preservada no Git e nos relatórios históricos.

## Ordem solicitada e resultado

1. O estudo externo `D:\Download DATA\deep-research-report (2).md` foi lido integralmente antes das alterações. Diretrizes e escopo registrados em REVISAO-ESTUDO.md. Ele orientou a separação entre patrimônio fiscal, recursos financeiros e diferença de conciliação; não foi interpretado como autorização para construir todos os módulos sugeridos.
2. As três imagens foram examinadas. Item foi substituído por Titularidade, conforme a instrução posterior do usuário; número original permanece nos dados/exportação. Filtro geral/titular/dependente individual, totais do recorte e alinhamento central de titularidade/grupo/código. Na edição de Bens, campos destacados recolhidos em Dados do Bem/Mostrar mais; continuam disponíveis no topo do novo cadastro. A caixa principal foi mantida por sua utilidade de conferência, renomeada Diferença de conciliação e esclarecida como residual, não banco disponível. Removida a tolerância ajustável.
3. Os achados D01–D12 foram tratados sequencialmente, com commits, testes e saídas de diagnóstico. Complementos de integração preservam perdas, segregam pessoas e separam DARF confirmado de imposto apenas apurado.
4. OTIMIZACOES-PROPOSTAS.md foi revisado após as correções. As propostas futuras não foram implementadas automaticamente; a próxima etapa depende do OK do usuário.

## Evidência por achado

| Achado | Resultado verificado |
|---|---|
| D01 | 10.000 de PF/exterior menos 2.000 de Carnê-leão informado como pago = 8.000. |
| D02 | RRA tributável 20.000 menos IRRF 3.000 = 17.000. |
| D03 | 13º já líquido 8.000 permanece 8.000; retenção informativa não é descontada de novo. |
| D04 | Resultado RV mensal positivo entra sem exigir redigitação; resumo da mesma pessoa evita sobreposição. |
| D05 | Perda FII de 4.000 reduz recursos em 4.000; modalidade integrada sem alterar sua apuração fiscal própria. |
| D06 | Doação de dezembro não reduz janeiro; total anual sem data não é repetido em cada mês. |
| D07 | Receita rural 10.000 menos despesa importada 2.000 e complemento 100 = 7.900. Substituição de mês somente explícita. |
| D08 | Vendas distintas com mesmo preço/data são preservadas; supressão exige vínculo, coincidências ficam para revisão. |
| D09 | Diferença anual sem data não é repetida em meses disjuntos. Projeção intermediária usa abertura e eventos datados, com aviso sobre a limitação. |
| D10 | Venda 15.000/custo 10.000/ganho 5.000 em operação e exclusivo resulta em 15.000, não 20.000. Sobreposição deduzida em linha visível. |
| D11 | DAA fiscal 2025 paga em 2026 permanece na ficha fiscal original e afeta o período financeiro de 2026. |
| D12 | Base inicial zero mostra sem base percentual; variação monetária permanece. |

Detalhes: CORRECOES-DEMONSTRATIVO.md e INTEGRACAO-RESULTADOS.md. As 11 falhas esperadas da auditoria foram convertidas em testes normais; não são falhas ocultas sob suíte verde. D12 possui cinco casos matemáticos próprios.

## Verificação

- Suíte completa: 71 arquivos e 1.042 testes aprovados, sem falhas esperadas (`revisao-suite-final.txt`).
- Golden: memória aritmética das fichas sintéticas conferida antes de regenerar a referência. Quatro testes aprovados na execução normal (`REVISAO-GOLDEN.md`, `golden-oraculo-depois.txt`).
- Navegador: filtro/totais/alinhamento, cadastro e edição de Bens, residual, DARF sem preenchimento presumido e DAA com ano fiscal preservado, sem erros JavaScript (`revisao-navegador-final-reteste.txt`).
- Regressão de uso: 16 fluxos aprovados, incluindo troca de ano, movimentações, cadastros, edição/exclusão, rural, RV, arraste de colunas e exportações, sem erros JavaScript (`revisao-uso-final.txt`).
- Build de produção aprovado em diretório temporário, preservando o pacote desktop existente (`revisao-build-final.txt`).

Os testes usam fixtures e perfis descartáveis. Falhas anteriores, erros de fixture e indisponibilidade do servidor foram preservados e classificados, não convertidos em alegações de resultado positivo. Não foi testado o executável nativo Windows nem a base privada real.

## Limites que exigem atenção operacional

- Diferença de conciliação não é caixa bancário disponível nem prova individual da origem dos créditos. Não use o número isoladamente para declarar ausência de risco fiscal.
- A integração com resumos fiscais é agregada; não substitui identidade e conciliação de cada operação. Resumos divergentes, taxas, parcelas, impostos em fichas diferentes e titularidade incompleta precisam de conferência. O aplicativo não deve ser tomado como apuração fiscal integral para todos os regimes.
- Carnê-leão legado compartilha a data do rendimento; RV conserva competência mensal. Cronologia bancária diária e quitação do mesmo tributo lançada em mais de uma ficha precisam de vínculos próprios. O mesmo DARF não deve ser duplicado em Despesas.
- Doação diretamente na DAA sem data de pagamento permanece pendente para fins financeiros. Cadastro novo adota ano-base anterior ao pagamento; documentos antigos/em atraso requerem conferência do ano-base original.
- Fotos anuais não demonstram saldos mensais. O saldo de 31/12 é preservado sem afirmar que sua diferença ocorreu em dezembro.
- Meses rurais anteriormente usados como substituição implícita devem ser revistos, usando a opção explícita quando essa era a intenção. Nenhuma migração silenciosa foi executada sobre a base real.

Recomendação imediata: fazer backup antes de revisar períodos antigos, conferir as mudanças de reconhecimento financeiro e manter as propostas futuras aguardando aprovação.
