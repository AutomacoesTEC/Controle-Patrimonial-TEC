# Correções autorizadas do Demonstrativo

Autorização: solicitação do usuário após leitura do relatório prévio. Não substituir o relatório original: este arquivo registra as correções posteriores. Fixtures sintéticas determinísticas, sem seeds aleatórios; modelo da sessão mantido. Resultados são regressões funcionais, não estimativas estatísticas.

## D01 — Carnê-leão pago omitido

Base: 96214cc. Falha: 10.000 recebidos de PF/exterior e 2.000 de imposto marcado como pago resultam em 10.000 disponíveis. Previsão anterior à mudança: 8.000, com imposto zero preservando 10.000. Camada: disponibilidade líquida do rendimento. Fixture: D01 em auditoriaDemonstrativo20260905.test.js, convertida de falha esperada para asserção normal antes de corrigir o motor; saída bruta D01-antes.txt/depois.txt.

O campo legado `irrf` em PF/exterior significa Carnê-leão pago, não imposto apenas devido. Ser antecipação não elimina a saída financeira. Fonte conferida nesta rodada: [Receita Federal, Carnê-Leão](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/carne-leao/). A data bancária e o vínculo de um mesmo pagamento entre fichas continuam exigindo evolução do modelo; não presumir que imposto devido equivale a pagamento.

MANTER: o mesmo D01 passou de 10.000 incorretos para 8.000 esperados. Ajuda da tela corrigida e limitação temporal legada explicitada, sem migração de dados.

## D02 — IRRF do RRA omitido

Base e355029. Falha: RRA tributável 20.000 com retenção 3.000 soma 20.000. Previsão: 17.000; preservar exclusão `naoSomar` dos registros já transportados para exclusivos. Camada: retenção do rendimento RRA. Fixture D02 normalizada antes da alteração, mesmos valores e comando antes/depois. Fonte: [Receita, rendimentos do trabalho/RRA](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-trabalho). A mudança não transforma base tributável em bruto bancário; parcelas isentas continuam exigindo classificação própria sem duplicação.

MANTER: D02-antes.txt registra 20.000; D02-depois.txt confirma 17.000.
