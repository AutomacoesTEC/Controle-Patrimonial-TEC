# Revisão das referências do Demonstrativo

Base 0fd8902, com ajuste de cadastro DAA em curso. Três goldens falham por contratos anteriores, não por instabilidade da execução. Antes bruto: revisao-suite-integracao-2.txt. O perfil sintético AJU-01 permanece inalterado. Nenhum dado real utilizado.

Antes de regenerar foi acrescentado oráculo aritmético explícito em demonstrativo.golden.test.js. Memória das fichas de origem:

- PJ líquido: 51.989,60. Isentos: 45.523,70. Exclusivos informados: 142.197,69 (13º já líquido). Rural: 21.565,66. Soma: 261.276,65.
- Ganhos de operações: 102.003,03; resumo exclusivo correspondente: 92.162,65; complemento: 9.840,38. Esta memória segue o critério custo/preço existente, sem afirmar conciliação bancária de corretagens e parcelas.
- RV titular: resultado 6.202,20, retenções/DARF informados 2.174,71, ganhos positivos líquidos 5.830,32 cobertos pelo resumo fiscal. Dependente: 3.935,39 menos tributos 786,12. Ajuste combinado: 1.346,44. Perdas preservadas.
- Doações ordinárias 16.307,26 + partidos 1.201,44; DAA 603,91 sem pagamento datado permanece pendente.
- Residual anual: -337.309,08 -31.996,97 +261.276,65 +9.840,38 +1.346,44 -26.137,88 -17.508,70 = -140.489,16.
- Semestre: nenhum movimento de estoque datado, projeção patrimonial zero; rural 21.565,66 + RV financeira 5.746,65 = 27.312,31. Não é saldo bancário nem prova de que o patrimônio ficou estável.
- O snapshot seguinte não possui novos fluxos; consulta bienal conserva o residual anual.

Previsão: estes totais devem passar ANTES de atualizar o golden, mantendo as três falhas estruturais antigas. Só depois regenerar a referência e executar normalmente, sem UPDATE_GOLDEN. Não se atribui mérito estatístico a essa atualização deliberada de contrato.

MANTER: golden-oraculo-antes.txt confirma memória aritmética aprovada e três referências antigas divergentes. Após geração deliberada, golden-oraculo-depois.txt confirma quatro testes aprovados na execução normal, sem opção de atualizar. A fixture de entrada não foi modificada.
