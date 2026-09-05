# Integração após D01–D12

Base efd9e2c. A suíte completa encontrou 17 falhas: inclui expectativas das regras antigas e goldens; não é aprovada. Saída preservada em revisao-suite-integracao-1.txt. Nenhum golden será aceito apenas porque o programa o produziu.

Falha adicional nomeada: a sobreposição de resumo fiscal com resultado líquido pode absorver perdas de outras operações/meses, e a integração GCAP ainda não distingue pessoas. Previsão antes de mexer: ganho 10.000, perda 4.000 e resumo de ganho 10.000 deixam ajuste -4.000; resumo do dependente não abate ganho do titular. Camada: alocação da sobreposição apenas sobre ganhos positivos da mesma pessoa. Fixture congelada conciliacaoResultados.test.js, sem aleatoriedade. Antes/depois registrados separadamente.

O primeiro fixture omitiu a data do rendimento, sendo descartado pelo filtro de período. Esse antes não comprova as falhas pretendidas: foi preservado, não apresentado como ensaio pareado válido. Após corrigir o fixture, três cenários de integração e os 17 cenários da auditoria passaram (`integracao-resultados-reteste.txt`). MANTER a correção pela verificação determinística das identidades: ajuste = soma dos resultados menos a parcela positiva já resumida, sempre por pessoa. A ausência de pareamento válido fica explicitada.

## Contratos antigos revisados

## DARF de RV: pagamento versus apuração

Base 6ef7433. Falha observada no código: formulário preenche automaticamente imposto pago com o imposto a pagar; o motor não desconta retenção/DARF confirmado. Previsão: 10.000 de ganho com IRRF corrente 100 e DARF confirmado 1.400 resulta em 8.500; crédito de IRRF de meses anteriores não gera nova saída. Dado legado automático não é prova de quitação. Camada: reconhecimento financeiro do tributo, não apuração fiscal. Fixture rvFinanceiro.test.js com antes/depois. Cadastro novo inicia pago zero; valor pago positivo exige confirmação explícita. Mensalidade conserva a competência da ficha RV, sem inventar data bancária diária.

MANTER: rv-financeiro-antes.txt reproduz retenções/pagamento ignorados; rv-financeiro-depois.txt confirma os três contratos e preserva os 20 cenários de auditoria/integração. A confirmação altera somente o reconhecimento do pagamento manual; valor legado não é apagado. Ainda é necessário testar a interação no navegador e revisar os goldens finais.

Camada de verificação, produção sem alterações nesta etapa. As 14 falhas fora do golden exigiam explicitamente comportamentos revogados por D02/D03/D04/D07/D08/D09/D11: 13º descontado novamente, RRA sem retenção, ganho RV omitido, substituição rural implícita, identidade apenas por preço/data e posição mensal inventada. As asserções foram revistas com memória aritmética nos comentários. O cenário de mesma venda agora possui vínculo explícito e continua exigindo exatamente três vendas; o de substituição mensal exige escolha explícita e mantém o mesmo resultado. Não foram removidos testes nem relaxadas tolerâncias. Resultado: 126 testes aprovados em integracao-contratos-revisados.txt. Os três goldens permanecem pendentes de revisão separada; esta aprovação não cobre a suíte inteira.
