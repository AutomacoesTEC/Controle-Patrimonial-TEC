# Correções autorizadas do Demonstrativo

Autorização: solicitação do usuário após leitura do relatório prévio. Não substituir o relatório original: este arquivo registra as correções posteriores. Fixtures sintéticas determinísticas, sem seeds aleatórios; modelo da sessão mantido. Resultados são regressões funcionais, não estimativas estatísticas.

## D01 — Carnê-leão pago omitido

Base: 96214cc. Falha: 10.000 recebidos de PF/exterior e 2.000 de imposto marcado como pago resultam em 10.000 disponíveis. Previsão anterior à mudança: 8.000, com imposto zero preservando 10.000. Camada: disponibilidade líquida do rendimento. Fixture: D01 em auditoriaDemonstrativo20260905.test.js, convertida de falha esperada para asserção normal antes de corrigir o motor; saída bruta D01-antes.txt/depois.txt.

O campo legado `irrf` em PF/exterior significa Carnê-leão pago, não imposto apenas devido. Ser antecipação não elimina a saída financeira. Fonte conferida nesta rodada: [Receita Federal, Carnê-Leão](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/carne-leao/carne-leao/). A data bancária e o vínculo de um mesmo pagamento entre fichas continuam exigindo evolução do modelo; não presumir que imposto devido equivale a pagamento.

MANTER: o mesmo D01 passou de 10.000 incorretos para 8.000 esperados. Ajuda da tela corrigida e limitação temporal legada explicitada, sem migração de dados.

## D02 — IRRF do RRA omitido

Base e355029. Falha: RRA tributável 20.000 com retenção 3.000 soma 20.000. Previsão: 17.000; preservar exclusão `naoSomar` dos registros já transportados para exclusivos. Camada: retenção do rendimento RRA. Fixture D02 normalizada antes da alteração, mesmos valores e comando antes/depois. Fonte: [Receita, rendimentos do trabalho/RRA](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-trabalho). A mudança não transforma base tributável em bruto bancário; parcelas isentas continuam exigindo classificação própria sem duplicação.

MANTER: D02-antes.txt registra 20.000; D02-depois.txt confirma 17.000.

## D03 — 13º líquido descontado duas vezes

Base bc73fc8. Previsão: valor oficial líquido 8.000 permanecerá 8.000 mesmo com IRRF informativo 1.000; códigos 01/08, com dois ou quatro dígitos, mesma regra nos dados legados e novos. Camada: interpretação do valor líquido oficial, sem reescrever arquivos importados. Fonte conferida: [SC 24/2013, p. 6](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=38509), que orienta valor líquido na linha de 13º. Fixture D03, antes/depois sob o mesmo comando. IRRF continua armazenado e exportado, porém não descontado novamente.

MANTER: D03-antes.txt registra 7.000; D03-depois.txt confirma 8.000. Corrigidos comentário do importador e rótulos de cadastro/demonstrativo.

## D04 — ganho mensal RV ausente

Base cb9b1cd. Previsão: ganho mensal 10.000 sem outro rendimento gera ajuste +10.000; com os mesmos 10.000 já em exclusivos código 05, ajuste zero. Perdas continuam refletidas. Camada: integração do resultado mensal com rendimentos já informados, por pessoa. Não usar imposto devido como pagamento. Fixture D04 antes/depois; controles de sobreposição serão acrescidos, sem chamar esses novos controles de evidência pareada. A conciliação agregada sem identidade de operação exige revisão, não prova automática de caixa bancário.

MANTER: D04 passou de zero a 10.000. Controles adicionais confirmam não duplicar o resumo da mesma pessoa e não abater o resumo de outro dependente. Saídas D04-antes.txt, D04-depois.txt e D04-controles.txt. A linha antes chamada perda agora mostra ajuste financeiro, inclusive positivo.

## D05 — FII/Fiagro ignorado

Base 636da29. Previsão: perda mensal FII de 4.000 produz ajuste -4.000, preservando a precedência manual/oficial da ficha mensal. Camada: inclusão da segunda modalidade no mesmo integrador financeiro RV, sem misturar a compensação fiscal de prejuízos entre modalidades. Fixture D05 idêntica antes/depois. Ganhos de alienação não se confundem com distribuições isentas dos fundos.

MANTER: D05-antes.txt registra zero; D05-depois.txt confirma -4.000.

## D06 — data das doações ignorada

Base d33f32f. Previsão: doação de dezembro não reduz janeiro; com data entra somente no período efetivo. Doação anual sem dia só integra consulta que abrange o ano inteiro, não todos os meses. Camada: filtro temporal de doações. Fixture D06 antes/depois. D11 ainda exige levar desembolso de outro ano-base ao ano financeiro correto.

MANTER: D06-antes.txt registra saída 1.000 em janeiro; D06-depois.txt confirma zero.
