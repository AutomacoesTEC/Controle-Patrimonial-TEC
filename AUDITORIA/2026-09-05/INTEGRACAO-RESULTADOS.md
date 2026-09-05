# Integração após D01–D12

Base efd9e2c. A suíte completa encontrou 17 falhas: inclui expectativas das regras antigas e goldens; não é aprovada. Saída preservada em revisao-suite-integracao-1.txt. Nenhum golden será aceito apenas porque o programa o produziu.

Falha adicional nomeada: a sobreposição de resumo fiscal com resultado líquido pode absorver perdas de outras operações/meses, e a integração GCAP ainda não distingue pessoas. Previsão antes de mexer: ganho 10.000, perda 4.000 e resumo de ganho 10.000 deixam ajuste -4.000; resumo do dependente não abate ganho do titular. Camada: alocação da sobreposição apenas sobre ganhos positivos da mesma pessoa. Fixture congelada conciliacaoResultados.test.js, sem aleatoriedade. Antes/depois registrados separadamente.

O primeiro fixture omitiu a data do rendimento, sendo descartado pelo filtro de período. Esse antes não comprova as falhas pretendidas: foi preservado, não apresentado como ensaio pareado válido. Após corrigir o fixture, três cenários de integração e os 17 cenários da auditoria passaram (`integracao-resultados-reteste.txt`). MANTER a correção pela verificação determinística das identidades: ajuste = soma dos resultados menos a parcela positiva já resumida, sempre por pessoa. A ausência de pareamento válido fica explicitada.
