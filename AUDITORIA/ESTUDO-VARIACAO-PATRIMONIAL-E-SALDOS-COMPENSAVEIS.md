# IRRF, Variação Patrimonial e Saldos Compensáveis na DIRPF

> Estudo fornecido pela usuária em 03/09/2026, como base conceitual e jurídica
> do Demonstrativo de Conciliação Patrimonial do Dashboard e do card
> "Saldos que atravessam para o próximo exercício" (`src/store/demonstrativos.js`
> e `src/store/saldosCompensaveis.js`).
>
> Uso: consultar ANTES de mexer em qualquer cálculo do demonstrativo, e para
> responder "por que todos esses dados precisam aparecer". O núcleo (IRRF é
> embutido no bruto e não é origem nova — seções 3, 4 e 14; e o que atravessa
> exercício são prejuízos compensáveis, não IRRF — seções 5 a 10 e 15) já está
> implementado e testado.

---

## 1. Conceito de variação patrimonial

Para fins fiscais, a Receita Federal verifica se o aumento do patrimônio da
pessoa física é compatível com os recursos que ela teve disponíveis no período.

A base jurídica central está no art. 3º, § 1º, da Lei nº 7.713/1988, segundo o
qual também constituem rendimento os acréscimos patrimoniais que não
correspondam aos rendimentos declarados.

Na prática, a lógica é:

    Origens de recursos
    − Aplicações/dispêndios
    = Saldo financeiro disponível

Esse saldo precisa ser compatível com a evolução entre:

- Patrimônio em 31/12 do ano anterior; e
- Patrimônio em 31/12 do ano atual.

---

## 2. Informações da DIRPF que podem funcionar como origem de recursos

Não são somente os rendimentos tributáveis que justificam aumento patrimonial.

| Informação | Justifica aumento patrimonial? | Observação |
|---|---:|---|
| Rendimentos tributáveis | Sim | Salário, pró-labore, aluguel etc. |
| Rendimentos isentos e não tributáveis | Sim | Lucros/dividendos isentos, doações, heranças, FGTS etc. |
| Rendimentos sujeitos à tributação exclusiva/definitiva | Sim | Rendimentos líquidos de determinadas aplicações, JCP, prêmios etc. |
| Ganhos de capital | Sim | Na extensão do recurso efetivamente disponibilizado pela alienação |
| Venda de bens | Sim | O preço recebido é origem financeira, embora somente o ganho seja rendimento tributável |
| Empréstimos recebidos | Sim | Desde que efetivos e comprováveis |
| Doações/heranças recebidas | Sim | Origem patrimonial, ainda que isentas |
| Restituição de IRPF de anos anteriores recebida | Sim | É rendimento isento no ano do recebimento |
| Resgates de investimentos | Sim, como fluxo financeiro | Cuidado para não contar novamente o principal que já integrava o patrimônio |
| Redução de dinheiro em espécie/saldos anteriores | Sim | Representa consumo de patrimônio anteriormente existente |
| Aumento de dívidas efetivamente contraídas | Sim | Financiamento pode justificar aquisição patrimonial |

---

## 3. O IRRF propriamente dito não é uma origem adicional de patrimônio

Exemplo:

- Salário bruto: R$ 120.000
- IRRF: R$ 15.000
- Valor líquido recebido: R$ 105.000

O contribuinte não possui R$ 135.000 de recursos.

O IRRF de R$ 15.000 é apenas uma parcela dos R$ 120.000 que foi destinada ao
pagamento antecipado do imposto.

Na DIRPF, o IRRF entra como imposto pago/antecipação, reduzindo o imposto
apurado.

Portanto:

> **IRRF não deve ser somado novamente como origem de recursos para justificar
> variação patrimonial.**

Caso contrário, haveria duplicidade na disponibilidade financeira.

---

## 4. IRRF normal de salário, pró-labore, aluguel etc.

Pode ser carregado para o ano seguinte? **Não.**

O IRRF correspondente aos rendimentos sujeitos ao ajuste anual é uma
antecipação do imposto daquele ano-calendário.

Na declaração anual:

    Imposto devido
    − IRRF
    − demais antecipações
    = imposto a pagar ou a restituir.

Se o IRRF for maior que o imposto devido, o excedente transforma-se em
**IRPF a restituir**. Ele não permanece como um "saldo de IRRF a compensar" na
declaração seguinte.

Tratamento:

- IRRF de 2025 → utilizado na DIRPF relativa ao ano-calendário 2025;
- eventual excesso → gera restituição;
- não existe transporte desse saldo como IRRF para o ano seguinte.

---

## 5. IRRF de operações comuns em Bolsa

Trata-se, em regra, do IRRF incidente sobre determinadas operações comuns em
bolsa. A IN RFB nº 1.585/2015, art. 63, § 8º, disciplina sua utilização.

O IRRF pode ser:

1. deduzido do imposto sobre ganhos líquidos do próprio mês;
2. compensado com imposto sobre ganhos líquidos dos meses seguintes;
3. se ainda restar saldo, compensado na Declaração de Ajuste Anual;
4. em determinadas hipóteses, compensado com imposto sobre ganho de capital na
   alienação de ações.

Pode ser levado para compensar operações do ano seguinte? **Não como saldo
autônomo de IRRF.** O saldo não utilizado durante o ano deve ser levado à
Declaração de Ajuste Anual correspondente.

Exemplo — IRRF comum de Bolsa retido em 2025:

- compensa ganhos de 2025;
- eventual saldo vai para a DIRPF relativa a 2025;
- o excesso não permanece para compensar DARF de operações de 2026.

---

## 6. IRRF de Day Trade

O IRRF incidente sobre Day Trade possui tratamento mais restritivo. Pode ser:

- deduzido do imposto sobre ganhos de Day Trade do próprio mês;
- compensado com imposto sobre ganhos de Day Trade dos meses seguintes;

mas apenas **até dezembro do mesmo ano-calendário da retenção**.

A IN RFB nº 1.585/2015, art. 65, §§ 8º e 9º, disciplina esse tratamento.

Se restar saldo ao final do ano, o contribuinte pode solicitar restituição.

Portanto: IRRF Day Trade de 2025 restante não pode ser transportado para
compensar imposto de Day Trade de 2026.

---

## 7. Prejuízo de renda variável

Prejuízo não deve ser confundido com IRRF.

**Operações comuns:** o prejuízo pode ser utilizado nos meses seguintes e
também em anos-calendário posteriores. Base legal: art. 64 da IN RFB
nº 1.585/2015.

Assim:

- prejuízo comum de 2024 pode passar para 2025;
- depois para 2026;
- e assim sucessivamente, até sua compensação;
- desde que corretamente declarado.

---

## 8. Prejuízo de Day Trade

Diferença fundamental: **IRRF Day Trade não atravessa o ano, mas prejuízo de
Day Trade pode atravessar.** As perdas podem ser compensadas com ganhos futuros
de Day Trade, observada a segregação da modalidade.

| Item | Passa de um ano para outro? |
|---|---:|
| Prejuízo Day Trade | **Sim** |
| IRRF Day Trade | **Não** |

---

## 9. Prejuízo de FII/FIAGRO

Existe controle separado para prejuízos de FII/FIAGRO. A DIRPF possui campo
próprio para prejuízo de ano anterior dessas operações. No caso de FII, a
IN RFB nº 1.585/2015, art. 37, § 2º, determina tratamento específico para
compensação das perdas.

Esses prejuízos não devem ser misturados indiscriminadamente com prejuízos de
operações comuns ou Day Trade.

---

## 10. Quadro dos saldos que podem ou não atravessar exercícios

| Saldo em 31/12 | Transporta para o ano seguinte? | Tratamento |
|---|---:|---|
| IRRF normal sujeito ao ajuste anual | Não | Utiliza na DIRPF do próprio ano; excesso gera restituição |
| Carnê-Leão pago | Não | Antecipação daquele ano |
| Imposto complementar | Não | Antecipação daquele ano |
| IRRF operações comuns em Bolsa | Não para compensar operações do ano seguinte | Eventual saldo vai para o ajuste anual |
| IRRF Day Trade | Não | Compensa somente até dezembro; eventual saldo é passível de restituição |
| Prejuízo operações comuns | Sim | Compensa ganhos futuros compatíveis |
| Prejuízo Day Trade | Sim | Somente contra ganhos futuros de Day Trade |
| Prejuízo FII/FIAGRO | Sim | Mantido separadamente para compensações compatíveis |
| Prejuízo de atividade rural | Sim | Possui regime próprio |
| Perdas em aplicações no exterior abrangidas pela legislação específica | Em determinadas hipóteses | Deve ser analisado conforme regime próprio |
| Restituição de IRPF ainda não recebida | Não é IRRF transportável | É crédito decorrente do ajuste |
| Saldo bancário/dinheiro existente em 31/12 | Sim, patrimonialmente | Passa como patrimônio, não como crédito tributário |

---

## 11. Saldo financeiro e variação patrimonial

É preciso separar **saldo de IRRF** de **saldo financeiro/patrimonial**.

Se, após levantar rendimentos, alienações, empréstimos, despesas e aquisições,
restarem recursos disponíveis em 31 de dezembro, esses recursos podem
justificar movimentações do período seguinte, desde que estejam efetivamente
representados por patrimônio ou disponibilidade comprovável.

Exemplo em 31/12:

- Conta corrente: R$ 30.000
- Aplicações: R$ 120.000
- Dinheiro em espécie comprovado: R$ 50.000
- Total de disponibilidade: R$ 200.000

Esse valor pode funcionar como fonte de recursos para aquisições realizadas no
ano seguinte. Isso é saldo financeiro/patrimonial, não saldo de IRRF.

---

## 12. Dinheiro em espécie

Dinheiro em espécie declarado em 31/12 pode, em tese, justificar utilização de
recursos no ano seguinte. Porém, a mera declaração não transforma
automaticamente o valor em origem incontestável. A Receita pode exigir
comprovação da efetiva existência do numerário.

Não é recomendável utilizar artificialmente a ficha de dinheiro em espécie
apenas para "fechar" variação patrimonial.

---

## 13. Estrutura recomendada para análise profissional da variação patrimonial

**Origens de recursos:**

- rendimentos tributáveis recebidos;
- rendimentos isentos;
- rendimentos sujeitos à tributação exclusiva/definitiva;
- alienações de bens;
- empréstimos efetivamente recebidos;
- doações e heranças;
- restituição de IRPF recebida;
- redução de aplicações;
- utilização de saldos patrimoniais anteriores;
- outras entradas comprovadas.

**Aplicações de recursos:**

- aquisição de imóveis;
- aquisição de veículos;
- participações societárias;
- aplicações financeiras;
- amortização de dívidas;
- doações efetuadas;
- despesas relevantes;
- imposto efetivamente pago;
- consumo pessoal;
- demais saídas comprovadas.

Posteriormente, confrontar o patrimônio líquido em 31/12 do ano atual com o
patrimônio líquido em 31/12 do ano anterior.

---

## 14. IRRF e disponibilidade financeira

Exemplo:

- Salário bruto: R$ 150.000
- Previdência: R$ 15.000
- IRRF: R$ 20.000
- Líquido efetivamente recebido: R$ 115.000

Do ponto de vista financeiro, o contribuinte não teve R$ 150.000 integralmente
disponíveis para aquisição de patrimônio. Teve efetivamente R$ 115.000,
desconsideradas outras entradas ou saídas.

O IRRF constitui antecipação fiscal que será confrontada na declaração de
ajuste. Se posteriormente houver restituição de R$ 8.000, e ela for recebida no
ano seguinte, esses R$ 8.000 passam a representar nova origem financeira no ano
do recebimento.

---

## 15. Conclusão

Para fins de controle entre exercícios, é fundamental separar **crédito fiscal**
de **prejuízo compensável**.

Regra prática:

> **O que normalmente atravessa exercícios são prejuízos compensáveis, e não o
> IRRF.**

**IRRF:**

- IRRF normal → resolve-se no ajuste anual;
- IRRF de operações comuns em Bolsa → utiliza-se durante o ano e eventual saldo
  vai ao ajuste anual;
- IRRF Day Trade → utilização limitada ao próprio ano; eventual saldo deve
  seguir o tratamento de restituição aplicável.

**Prejuízos:**

- operações comuns → podem atravessar exercícios;
- Day Trade → podem atravessar exercícios, separadamente;
- FII/FIAGRO → possuem controle próprio e também podem ser transportados quando
  observadas as regras legais.

---

## Bases legais principais

- **Lei nº 7.713/1988, art. 3º, § 1º** — acréscimo patrimonial não justificado.
- **IN RFB nº 1.585/2015, art. 63, § 8º** — utilização do IRRF de operações
  comuns em renda variável.
- **IN RFB nº 1.585/2015, art. 64** — compensação de perdas em renda variável,
  inclusive em períodos posteriores.
- **IN RFB nº 1.585/2015, art. 65, §§ 8º e 9º** — regras relativas a Day Trade,
  incluindo IRRF e perdas.
- **IN RFB nº 1.585/2015, art. 37, § 2º** — tratamento das perdas envolvendo
  cotas de FII.
- **Manual da DIRPF da Receita Federal** — regras de preenchimento dos campos
  relativos a imposto pago, renda variável, prejuízos anteriores e restituição.

---

## Observação técnica

A análise de variação patrimonial deve ser realizada com base no fluxo
financeiro efetivo, evitando duplicidade entre rendimento bruto, IRRF,
aplicações, resgates, alienações e saldos patrimoniais anteriores.

O IRRF não deve ser considerado uma nova origem de recursos quando já estiver
embutido no rendimento bruto informado.
