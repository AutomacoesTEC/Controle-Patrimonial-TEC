# Rodada 56 — Alerta de IRRF mensal abaixo do esperado

## Falha e previsão

O painel consolida o IRRF informado, mas não calcula referência mensal: um
rendimento PJ de 2026 com retenção abaixo da tabela não gera alerta. A
inspeção encontra cálculo=false, redutor=false e zero fixtures de retenção
menor.

Previsão: para bruto mensal de R$ 6.500, previdência de R$ 650 e um dependente,
o cálculo conservador usa deduções legais de R$ 839,59 (maiores que o desconto
simplificado de R$ 607,20), chega a IRRF esperado de R$ 534,71 e acusa
exatamente R$ 34,71 quando o informado é R$ 500. Em R$ 5.000 sem deduções, o
redutor zera o imposto e não há falso alerta. Registros anuais ou fora de 2026
não são inferidos como mensais.

Fontes oficiais congeladas:

- Receita Federal, [Tributação de 2026](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026), consultada em 04/09/2026.
- Presidência da República, [Lei nº 15.270/2025](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15270.htm), art. 3º-A, consultada em 04/09/2026.

Fixture de lógica com valores e data fixos, sem seeds, modelo Codex baseado em
GPT-5 (identificador exato não exposto), commit-base `4a688f8`; saídas
`antes.txt`/`depois.txt`. Camada causal única: verificação determinística da
retenção mensal informada, sem alterar valores fiscais.

## Decisão

**MANTER.** O cálculo retornou base R$ 5.660,41, referência R$ 534,71 e
diferença R$ 34,71, exatamente como previsto. R$ 5.000 zerou após o redutor e
o total anual em 31/12 foi ignorado. O navegador exibiu uma única ressalva,
sem alterar o dado e sem overflow. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações finais: regressão com 50 arquivos e 905 testes aprovados; build
de produção aprovado com 666 módulos transformados; fixture Chromium aprovado.
