# Auditoria independente — Demonstrativo patrimonial e de caixa

Data: 05/09/2026. Estado: **RELATÓRIO PRÉVIO; CORREÇÕES DO MOTOR NÃO APLICADAS**.

O Demonstrativo funciona como conciliação de origens e aplicações patrimoniais. Não é, atualmente, um livro de movimentação bancária. A aritmética básica fecha nos cenários de salário líquido, compra financiada, venda com perda e continuidade anual. Encontramos 11 divergências reproduzidas em testes do motor e um achado adicional no indicador percentual (D12), descritos abaixo. Nenhuma fórmula de produção foi alterada por esta auditoria.

## Escopo e evidência

Leitura prévia de `AUDITORIA/ESTUDO-VARIACAO-PATRIMONIAL-E-SALDOS-COMPENSAVEIS.md`. Código base identificado durante a auditoria: `5437be361d9c0f7b321fd9f14e5936ee5df06577`, com trabalho concorrente da implementação de interface. Linhas indicadas correspondem à leitura desta execução e podem deslocar-se posteriormente. Não se trata de campanha pareada de mudança de harness: não houve troca de modelo, intervenção no motor nem estimativa estatística de melhoria.

Fixtures: `src/store/auditoriaDemonstrativo20260905.test.js`; dados integralmente sintéticos, datas e valores fixos, sem aleatoriedade/seeds. Oráculos: dinheiro efetivamente recebido menos dinheiro efetivamente desembolsado, estoque inicial/final e não duplicação de eventos econômicos. Execução: `node node_modules/vitest/vitest.mjs run src/store/auditoriaDemonstrativo20260905.test.js --reporter=verbose`. Resultado: **5 controles passaram; 11 falhas esperadas foram confirmadas, 16 cenários no total**. `it.fails` conserva a expectativa correta e mantém visíveis os defeitos ainda não corrigidos; verde nessa suíte não significa aprovação do Demonstrativo. Saída bruta: `demonstrativo-vitest-bruto.txt` nesta pasta.

## Achados reproduzidos

Valores em reais. A coluna atual descreve o resultado do motor para a fixture; esperado é o oráculo do cenário, não uma alíquota estimada.

| ID | Cenário | Atual | Esperado | Classificação |
|---|---|---:|---:|---|
| D01 | PF/exterior: 10.000 recebidos, carnê-leão pago 2.000 no período | 10.000 | 8.000 | Saída financeira omitida |
| D02 | RRA tributável 20.000 e IRRF 3.000 | 20.000 | 17.000 | Retenção omitida |
| D03 | 13º já líquido 8.000; IRRF informativo 1.000 | 7.000 | 8.000 | Retenção duplicada |
| D04 | Ganho mensal RV 10.000 cadastrado sem linha exclusiva separada, sem DARF pago | 0 | 10.000 | Fonte mensal incompleta no caixa |
| D05 | Perda mensal FII de 4.000 | 0 | -4.000 | Ficha não consumida |
| D06 | Doação de dezembro de 1.000 consultada em janeiro | 1.000 de saída | 0 de saída | Data ignorada |
| D07 | Rural importado: receita 10.000, despesa 2.000; nova despesa adicional 100 no mesmo mês | -100 | 7.900 | Substituição indevida para fluxo incremental |
| D08 | Duas vendas diferentes com mesma data/preço 15.000; custos 10.000 e 12.000 | 5.000 de ganho | 8.000 de ganho | Deduplicação sem identidade |
| D09 | Foto anual 10.000 → 20.000, sem eventos datados; soma das variações de janeiro e fevereiro | 20.000 | no máximo 10.000 | Precisão temporal inventada |
| D10 | Venda 15.000, custo 10.000; ganho 5.000 em GCAP e exclusivo | 20.000 de recursos | 15.000 de recursos | Rendimento duplicado |
| D11 | Doação diretamente na DAA base 2025, paga em maio/2026, valor 1.000 | saída em 2025 | saída em 2026 | Competência fiscal confundida com caixa |

### D01–D03 — retenções e valores líquidos

`src/store/demonstrativos.js:350–369` soma PF/exterior e RRA sem descontar o imposto informado, enquanto PJ é calculado líquido de previdência e IRRF. A justificativa de que carnê-leão é antecipação do ajuste não afasta o desembolso. Na tela, o campo PF está explicitamente rotulado “Carnê-leão pago”. Proposta: registrar pagamento/data próprios e vínculo à renda; descontar uma só vez e impedir duplicação em Pagamentos Diversos. Para RRA, distinguir bruto, previdência, pensão, isentos, IRRF e líquido efetivamente recebido, considerando `naoSomar` quando transportado para exclusivos. Fontes: [Receita: pagamento em DARF](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/darf), [Receita: rendimentos do trabalho/RRA](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-trabalho).

`src/pages/importParsers.js:174` injeta IRRF sobre o 13º no rendimento exclusivo; `demonstrativos.js:367–369` o desconta. O comentário do parser chama de bruto o campo que a ajuda local do PGD (`../AjudaIRPF-new.txt:384`, também 470) manda informar líquido. A [Solução de Consulta 024/2013, Receita Federal](https://normas.receita.fazenda.gov.br/sijut2consulta/anexoOutros.action?idArquivoBinario=38509) confirma o valor líquido na ficha de exclusivos. Proposta: conservar IRRF como informação fiscal; marcar a natureza bruto/líquido e não subtrair outra vez. Perfis já importados precisam de migração rastreável, não só mudança nos próximos imports. A confirmação se refere ao campo líquido oficial; remunerações especiais e deduções meramente fiscais demandam avaliação própria antes de converter base fiscal em disponibilidade bancária.

### D04–D05 — RV e FII

`demonstrativos.js:999` só leva resultados negativos de operações comuns/day-trade ao caixa. Ganhos positivos dependem de outra ficha, um pressuposto de declaração pronta que não atende ao acompanhamento durante o ano. `consultaPeriodo.js:208` e `demonstrativos.js:920` chamam apenas `linhasComunsDoAno`, apesar de `linhasFiiDoAno` existir em `rendaVariavelMensal.js:37`. Proposta: conciliar fontes por beneficiário, modalidade, mês e operação; gerar o resultado financeiro uma vez e manter apresentação fiscal separada. Não basta somar todos os positivos indiscriminadamente, pois isso duplicaria valores importados em exclusivos/isentos. A [Receita orienta informar resultados mensais separados, IRRF e DARF](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-capital); [operações em fundos têm regime próprio](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/pagamento/renda-variavel/fundos-de-investimento-no-brasil).

Risco adicional observado por leitura: `calculoRendaVariavelMes.js:120` atribui `impostoPago` ao IRRF usado. Isso não comprova pagamento de DARF; é necessária informação de quitação/data independente. Não houve teste de quitação real nesta auditoria. Compensação de prejuízo anterior é tratamento fiscal e não uma saída de dinheiro do ano atual; a fórmula financeira não deve subtrair novamente o saldo transportado.

### D06 e D11 — doações

`demonstrativos.js:979` soma todas as doações sem filtro temporal; `consultaPeriodo.js:190` aplica isso a qualquer trecho do ano. Colocar um campo de data na ficha não resolve esse motor. Para doações normais, filtrar pela data efetiva; importadas anuais sem dia devem carregar precisão “ano”, com limitação explícita em consultas mensais.

Doações diretamente na declaração são um caso diferente: a destinação na DAA do ano-base 2025 pode ser paga em 2026. A orientação de pagamento no exercício consta da ajuda local (`../AjudaIRPF-new.txt:4578`) e de [orientação oficial do CNJ para a declaração de 2026](https://www.cnj.jus.br/se-renda-a-infancia-prazo-para-doar-na-declaracao-de-irpf-2026-se-aproxima-do-fim/). Proposta: separar ano-base fiscal, exercício da declaração e data de pagamento; conservar a dedução no relatório fiscal correspondente e levar o caixa ao ano do desembolso. Também distinguir doação em dinheiro de transferência de bem: transferência patrimonial não implica recebimento ou pagamento bancário.

### D07 — atividade rural

`demonstrativos.js:450–460`: qualquer lançamento manual substitui todo o mês importado. Isso é coerente apenas quando o usuário está substituindo a apuração completa daquele mês. Para lançar uma despesa adicional, apaga receitas e despesas previamente importadas. Proposta: ação explícita entre “complementar com novo evento” e “substituir mês conciliado”, com vínculo de origem. A [Lei 8.023/1990, art. 4º](https://www2.camara.leg.br/legin/fed/lei/1990/lei-8023-12-abril-1990-376215-normaatualizada-pl.html) usa receitas recebidas e despesas pagas; investimento é despesa no pagamento, ressalvada a terra nua. Excluir bens rurais da variação para não duplicar investimento é um critério defensável somente quando o livro-caixa correspondente está completo. Ausência de lançamento do investimento deve ser pendência, não prova de gasto zero.

### D08 e D10 — alienações

`demonstrativos.js:596`: data e preço iguais bastam para descartar uma operação importada. Dois veículos vendidos no mesmo dia pelo mesmo preço são operações distintas. Proposta: identidade estável do bem/operação e conciliação explícita quando não houver chave segura.

`demonstrativos.js:367` soma exclusivos sem distinguir sua origem e `:526` soma a apuração de ganho de capital em paralelo. A ajuda oficial do PGD (`../AjudaIRPF-new.txt:2232`) descreve o transporte do GCAP para exclusivos. A existência desse transporte também aparece no [manual oficial e-Patri, tabela 8](https://www.gov.br/cgu/pt-br/assuntos/informacoes-estrategicas/e-patri/manual-e-patri-2023-2024.pdf). Proposta: uma única origem financeira da operação, com vínculo entre GCAP, exclusivos/isentos e movimentação do bem. Preservar perdas econômicas, tributo efetivamente pago e recebimentos parcelados. Operação de alienação sem calendário de parcelas não prova que todo o preço foi recebido no dia da venda.

### D09 — periodicidade e fotos anuais

`demonstrativos.js:118–138` usa saldo anterior na abertura e saldo atual no fechamento sempre que não há movimentos. Isso fecha uma foto anual, mas a mesma variação pode reaparecer em todos os meses disjuntos. O mesmo problema existe em dívidas, `:199`. É uma convenção de modelagem expressamente descrita nos comentários, não erro de soma. Proposta: precisão da evidência explícita: “saldo anual sem data”, “movimentação datada” e “saldo conciliado em extrato”. Não apresentar variação mensal exata a partir de uma foto anual. Cadastros novos devem produzir o evento datado; importações anteriores devem preservar a incerteza.

## O que foi confirmado e o que o número significa

### D12 — percentual com patrimônio líquido inicial zero

Achado adicional observado por extração e execução da expressão real de `src/pages/Dashboard.jsx:409`, sem alteração de produção. `varPctPeriodo` retorna zero quando `totIni.liquido` é zero; `:1075` formata o resultado como percentual exato. Com patrimônio líquido inicial 0 e final 100.000, o card combina aumento de R$ 100.000 com **0,0%**. Também exibe 0,0% para variação de 0 a -10.000. O denominador zero torna a variação percentual indefinida; não significa estabilidade nem autoriza mostrar infinito como crescimento mensurável. Mesmo 0 → 0 não fornece base para razão percentual.

Proposta anterior à correção: manter a variação monetária e mostrar “sem base percentual”/“—” quando não houver patrimônio inicial diferente de zero. Ausência de dados iniciais deve ter tratamento próprio de indisponibilidade. Controle positivo: 100.000 → 110.000 resulta corretamente em 10,0%. Para base negativa, o código usa valor absoluto do patrimônio inicial: -100.000 → -50.000 resulta em +50,0%, convenção de melhora relativa ao módulo do déficit que deve ser explicitada, pois não é o mesmo que a taxa tradicional com denominador assinado.

Evidência bruta: `d12-percentual-base-zero-bruto.txt` nesta pasta, cinco cenários sintéticos. A expressão foi capturada com regex da declaração de `varPctPeriodo` e executada com entradas sintéticas; não é captura visual nem teste de navegador. **Este achado é adicional aos 11 `it.fails` automatizados; a suíte permanece com 16 cenários (5 controles e 11 falhas esperadas), sem aumentar artificialmente a contagem.** É um defeito de interpretação/exibição matemática do indicador, não uma regra tributária, e não requer alterar as fórmulas de conciliação.

Os controles verificam: PJ líquido 95.000; compra financiada consome 20.000; venda por 70.000 de bem que custou 100.000 libera 70.000; continuidade entre dois anos com saldos encadeados fecha; banco final 110.000 e origens corretamente refletidas produzem residual zero. Os cinco resultados são aritmeticamente corretos para essas premissas.

A expressão final (`demonstrativos.js:962`) é:

`residual = -variação dos bens + variação das dívidas + rendimentos + ganhos/perdas - dispêndios`.

Como bens já incluem bancos e numerário, residual zero pode coexistir com saldo bancário 110.000. Comparar esse residual diretamente às disponibilidades finais não é uma identidade contábil. O texto de referência no Dashboard (`src/pages/Dashboard.jsx:917`) merece revisão conceitual. Recomenda-se distinguir “saldo de conciliação não explicado”, “disponibilidade financeira conciliada” e “patrimônio líquido”. Grupos 04/05/07 também contêm créditos/investimentos que não são necessariamente caixa de liquidez imediata.

O corte titular/dependente, introduzido paralelamente, conserva dados sem identificação somente na visão geral e avisa essa limitação. Isso evita atribuição inventada, mas a visão individual deve continuar sendo apresentada como incompleta quando existem valores não atribuídos. Não houve ensaio de todas as combinações de titularidade/importação nesta suíte; a auditoria de interface cobre a interação correspondente. Uma transferência entre titular e dependente não altera patrimônio consolidado da família, mas exige contrapartidas nas duas visões individuais.

## Propostas para acompanhamento periódico

1. Um evento econômico deve reunir data efetiva, pessoa, conta de origem/destino, comprovante e vínculos às fichas fiscais. Isso permite entrada única e elimina redigitação de renda, venda, imposto e pagamento.
2. Fechamento mensal com saldo inicial + entradas − saídas = saldo bancário final, confrontado com extrato. Mostrar diferença e eventos pendentes; preservar o relatório patrimonial anual em paralelo.
3. Separar data de aquisição, data de pagamento/recebimento, data de registro e ano-base fiscal. Parcelas e benfeitorias precisam de sua própria cronologia.
4. Fechamento de ano versionado, com saldo inicial do seguinte vinculado ao encerramento; retificações devem apresentar impacto sobre anos posteriores.
5. Relatório preparatório da DIRPF por contribuinte, ficha/código, bruto, retenções, líquido, imposto devido/pago, saldos e comprovantes faltantes. Separar pendências de simples valores zero.
6. Antes de aplicar correções ao Demonstrativo, aprovar a semântica dessas três visões e a migração dos dados existentes; depois converter os `it.fails` em regressões normais, um defeito causal por vez, preservando a saída anterior.

Limites: cenários determinísticos cobrem as divergências descritas, não certificam todas as hipóteses de IRPF, nenhum executável Windows nem a totalidade dos documentos importáveis. Regras do exercício 2027 não foram presumidas como publicadas; o fluxo econômico de 2026 pode ser organizado agora, e o preenchimento fiscal futuro deve ser conferido quando houver instruções oficiais aplicáveis.
