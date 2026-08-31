# Roteiro manual — declaração sintética completa IRPF 2026

## Finalidade

Este roteiro serve para criar, no programa oficial IRPF 2026, uma declaração **fictícia, não transmissível e preenchida para auditoria do PDF**. O objetivo não é obter um cálculo fiscal realista, mas fazer cada ficha e cada campo imprimível aparecerem no PDF com valores fáceis de reconhecer.

O resultado principal será o arquivo `AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`. Saída definitiva e espólio não cabem na mesma declaração de ajuste anual; por isso aparecem no fim como dois casos separados.

## Regras obrigatórias de segurança

1. Use apenas a instalação de testes do IRPF 2026.
2. Não abra nem altere declarações verdadeiras já existentes.
3. Crie uma declaração **Original**, por preenchimento manual.
4. Nunca clique em **Entregar declaração**, **Transmitir**, **gov.br** ou geração de DARF para pagamento.
5. Não substitua os dados sintéticos deste roteiro por dados pessoais reais.
6. Se o programa recusar um CPF, CNPJ, código ou combinação, anote o nome exato do campo e tire uma captura; não improvise outro valor sem registrar a troca.
7. Preencha apenas campos editáveis. Totais, bases, deduções e impostos marcados como calculados devem ser deixados para o PGD.
8. Salve frequentemente, mas não gere cópia em nuvem.

## Como usar os valores sentinela

- Todo texto começa com `AJU` e a sigla da ficha.
- Os valores monetários possuem centavos diferentes. Não arredonde e não repita valores.
- Quando uma ficha permitir titular e dependente, faça uma linha para cada um.
- Quando houver botão **Novo**, **Adicionar**, `+` ou **Incluir**, crie exatamente os itens indicados.
- Se um campo indicado não existir na sua versão do programa, escreva `NÃO EXIBIDO` na lista de ocorrências ao final.
- Se surgir um campo adicional que não está no roteiro, preencha-o com um texto começando por `AJU EXTRA` ou valor monetário ainda não usado e anote-o.

## Controle inicial

- [ ] Programa exibindo `IRPF 2026`.
- [ ] Ano-calendário exibido pelo programa conferido.
- [ ] Declaração nova, Original, iniciada por preenchimento manual.
- [ ] Nenhuma declaração real aberta.
- [ ] Nome do caso: `AJU-01`.

---

# PARTE A — Declaração de Ajuste Anual `AJU-01`

## 1. Identificação do contribuinte

Preencha a ficha **Identificação do Contribuinte**:

| Campo | Valor a preencher |
|---|---|
| CPF | `111.444.777-35` |
| Nome | `AUDITORIA PDF TEC AJUSTE` |
| Data de nascimento | `11/01/1980` |
| Título eleitoral, se editável | `111122223333` |
| Raça/cor | `Parda` |
| Houve alteração de dados cadastrais | `Sim` |
| Possui cônjuge ou companheiro(a) | `Sim` |
| CPF do cônjuge/companheiro | `222.333.444-05` |
| Residente no exterior que passou a residir no Brasil em 2025 | `Não` |
| Tipo de logradouro | `Rua` |
| Logradouro | `SENTINELA AJU PES` |
| Número | `1101` |
| Complemento | `APTO 11` |
| Bairro/distrito | `BAIRRO SENTINELA` |
| UF | `SP` |
| Município | `SAO PAULO` |
| CEP | `01001-000` |
| DDD/telefone | `(11) 3456-7890` |
| DDD/celular | `(11) 99876-5432` |
| E-mail | `auditoria.pdf.aju@example.invalid` |
| Natureza da ocupação | `12 - Proprietário de empresa ou firma individual/empregador-titular` |
| Ocupação principal | `391 - Outros técnicos de nível médio` |

Se houver perguntas novas da Lei 14.973 ou atualização patrimonial, escolha **Não** e anote o texto exato da pergunta na lista de ocorrências.

## 2. Dependentes

Inclua um dependente:

| Campo | Valor |
|---|---|
| Tipo | `21 - Filho(a) ou enteado(a) até 21 anos` |
| CPF | `333.444.555-08` |
| Nome | `AJU PES DEPENDENTE UM` |
| Nascimento | `12/02/2015` |
| Raça/cor | `Parda` |
| E-mail | `aju.pes.dep1@example.invalid` |
| Celular | `(11) 99765-4321` |
| Mora com o titular/endereço igual | `Não` / endereço diferente, conforme a pergunta |

Não altere a dedução calculada. O valor esperado no resumo é o calculado automaticamente pelo PGD.

## 3. Alimentandos

Inclua um alimentando:

| Campo | Valor |
|---|---|
| Residência | `No Brasil` |
| CPF | `444.555.666-19` |
| Nome | `AJU PES ALIMENTANDO UM` |
| Nascimento | `13/03/2010` |
| Alimentando do | `Titular` |
| Tipo de processo | `Escritura pública` |
| CNPJ do cartório | `55.566.677/0001-83` |
| Cartório | `CARTORIO AJU PES SENTINELA` |
| Livro | `L11` |
| Folhas | `F22` |
| UF/município | `SP / SAO PAULO` |
| Data da lavratura | `14/04/2025` |
| Confirmação dos requisitos legais | Marcar/confirmar |

O aviso de alimentando ainda não vinculado a uma despesa é esperado. Ele será vinculado na ficha Pagamentos Efetuados.

## 4. Rendimentos tributáveis recebidos de pessoa jurídica — titular

Inclua uma fonte:

| Campo | Valor |
|---|---:|
| CNPJ da fonte | `55.566.677/0001-83` |
| Nome da fonte | `AJU RPJ FONTE TITULAR` |
| Rendimentos recebidos | `51.101,11` |
| Contribuição previdenciária oficial | `5.102,12` |
| Pensão alimentícia | `1.103,13` |
| Imposto retido na fonte | `4.104,14` |
| 13º salário | `5.105,15` |
| IRRF sobre o 13º, se houver | `505,16` |

## 5. Rendimentos tributáveis recebidos de pessoa jurídica — dependente

Selecione `AJU PES DEPENDENTE UM` e inclua:

| Campo | Valor |
|---|---:|
| CNPJ da fonte | `55.566.677/0001-83` |
| Nome da fonte | `AJU RPJ FONTE DEPENDENTE` |
| Rendimentos recebidos | `12.201,21` |
| Previdência oficial | `1.202,22` |
| Pensão alimentícia | `203,23` |
| IRRF | `904,24` |
| 13º salário | `1.205,25` |
| IRRF sobre 13º, se houver | `105,26` |

## 6. Rendimentos de pessoa física e do exterior — titular

Abra a ficha mensal do titular. Preencha pelo menos janeiro, fevereiro e março; deixe os outros meses zerados para facilitar a identificação.

### Janeiro — pessoa física

| Campo | Valor |
|---|---:|
| Rendimentos de trabalho não assalariado | `6.301,31` |
| Aluguéis | `2.302,32` |
| Outros | `303,33` |
| Livro-caixa | `1.304,34` |
| Pensão alimentícia | `305,35` |
| Carnê-Leão pago/DARF | `406,36` |

Se o programa exigir o pagador, inclua CPF `444.555.666-19`, nome `AJU RPF PAGADOR JANEIRO` e natureza compatível com trabalho não assalariado.

### Fevereiro — exterior

| Campo | Valor |
|---|---:|
| País | `249 - Estados Unidos` ou a opção equivalente |
| Rendimentos do exterior | `7.311,41` |
| Imposto pago no exterior | `711,42` |
| Livro-caixa/despesa admitida, se exibido | `1.312,43` |
| Carnê-Leão pago, se editável | `512,44` |

### Março — transporte

Se houver quadro de transporte dentro desta ficha:

| Campo | Valor |
|---|---:|
| Transporte de carga — receita bruta | `8.321,51` |
| Transporte de passageiros — receita bruta | `4.322,52` |
| Parcela tributável calculada | Não editar |

## 7. Rendimentos de pessoa física e do exterior — dependente

Selecione o dependente e preencha abril e maio:

| Mês/campo | Valor |
|---|---:|
| Abril — trabalho não assalariado | `3.401,61` |
| Abril — aluguel | `1.402,62` |
| Abril — livro-caixa | `403,63` |
| Abril — Carnê-Leão | `204,64` |
| Maio — exterior | `2.411,65` |
| Maio — imposto exterior | `211,66` |
| País | `063 - Argentina` ou equivalente |

## 8. Rendimentos isentos e não tributáveis

Crie itens separados. Use o código que mais precisamente corresponde à descrição; não concentre tudo em “Outros”.

| Beneficiário | Tipo sugerido | Fonte/descrição | Valor |
|---|---|---|---:|
| Titular | Parcela isenta de aposentadoria, se aplicável e aceita | `AJU ISE APOSENTADORIA` | `10.501,71` |
| Titular | Lucros e dividendos | CNPJ acima / `AJU ISE DIVIDENDOS` | `20.502,72` |
| Titular | Rendimentos de poupança/LCA/LCI | `AJU ISE APLICACAO` | `3.503,73` |
| Titular | Transferência patrimonial — doação | CPF do cônjuge / `AJU ISE DOACAO RECEBIDA` | `14.504,74` |
| Titular | Ganho de capital isento, se disponível | `AJU ISE GANHO ISENTO` | `5.505,75` |
| Dependente | Outros | `AJU ISE DEPENDENTE DETALHE` | `1.506,76` |

Se algum tipo exigir dados adicionais, preencha todos: CNPJ/CPF da fonte, nome da fonte e descrição. Não use uma situação incompatível com a idade do dependente.

## 9. Rendimentos sujeitos à tributação exclusiva/definitiva

| Beneficiário | Tipo | Fonte/descrição | Valor |
|---|---|---|---:|
| Titular | 13º salário | `AJU EXC DECIMO TERCEIRO` | deixar o item vindo da ficha PJ |
| Titular | Rendimentos de aplicações financeiras | CNPJ acima / `AJU EXC APLICACAO` | `6.601,81` |
| Titular | Juros sobre capital próprio | CNPJ acima / `AJU EXC JCP` | `2.602,82` |
| Titular | Prêmios/sorteios | `AJU EXC PREMIO` | `1.603,83` |
| Dependente | Outros | `AJU EXC DEPENDENTE` | `604,84` |

## 10. Rendimentos de PJ com exigibilidade suspensa — titular

Inclua uma fonte e preencha todos os campos editáveis:

| Campo | Valor |
|---|---:|
| CNPJ | `55.566.677/0001-83` |
| Fonte | `AJU EXI FONTE TITULAR` |
| Rendimentos tributáveis | `17.701,91` |
| Depósito judicial | `7.702,92` |
| Previdência oficial | `1.703,93` |
| Pensão alimentícia | `704,94` |
| IRRF | `1.705,95` |

## 11. Exigibilidade suspensa — dependente

| Campo | Valor |
|---|---:|
| Dependente | `AJU PES DEPENDENTE UM` |
| CNPJ | `55.566.677/0001-83` |
| Fonte | `AJU EXI FONTE DEPENDENTE` |
| Rendimentos | `8.711,96` |
| Depósito judicial | `3.712,97` |
| Previdência | `713,98` |
| Pensão | `314,99` |
| IRRF | `615,09` |

## 12. Rendimentos recebidos acumuladamente — RRA do titular

Crie dois itens se o programa permitir escolher as duas formas de tributação; caso não permita no mesmo caso, mantenha somente “Exclusiva na fonte”.

| Campo | Valor |
|---|---:|
| CNPJ da fonte | `55.566.677/0001-83` |
| Fonte | `AJU RRA TITULAR EXCLUSIVA` |
| Opção | `Exclusiva na fonte` |
| Rendimentos recebidos | `31.801,01` |
| Contribuição previdenciária | `3.802,02` |
| Pensão alimentícia | `1.803,03` |
| Imposto retido | `4.804,04` |
| Número de meses | `11` |
| Despesas com ação judicial | `2.805,05` |

## 13. RRA do dependente

| Campo | Valor |
|---|---:|
| Dependente | `AJU PES DEPENDENTE UM` |
| CNPJ | `55.566.677/0001-83` |
| Fonte | `AJU RRA DEPENDENTE AJUSTE` |
| Opção | `Ajuste anual` |
| Rendimentos | `9.811,06` |
| Previdência | `812,07` |
| Pensão | `313,08` |
| IRRF | `914,09` |
| Meses | `7` |
| Despesas judiciais | `515,10` |

## 14. Imposto pago ou retido

Abra a ficha e preencha somente campos editáveis que não vieram automaticamente das fichas anteriores:

| Campo | Valor |
|---|---:|
| Imposto complementar | `1.901,11` |
| Imposto pago no exterior | conferir o valor transportado; não duplicar |
| Carnê-Leão | conferir valores transportados; não duplicar |
| IRRF Lei 11.033/2004, se editável | `902,12` |
| Imposto retido do titular | calculado/importado das fichas |
| Imposto retido dos dependentes | calculado/importado das fichas |

Anote quais campos estavam bloqueados e quais aceitaram edição.

## 15. Pagamentos efetuados

Crie itens de naturezas diferentes. Em cada um, selecione corretamente titular, dependente ou alimentando.

| Código/natureza | Beneficiário do serviço | Prestador | Valor pago | Não dedutível |
|---|---|---|---:|---:|
| Médico no Brasil | Titular | CPF `444.555.666-19`, `AJU PAG MEDICO` | `2.001,21` | `101,22` se permitido |
| Dentista no Brasil | Dependente | CPF `444.555.666-19`, `AJU PAG DENTISTA DEP` | `1.502,23` | `102,24` se permitido |
| Hospital/laboratório | Titular | CNPJ `55.566.677/0001-83`, `AJU PAG HOSPITAL` | `3.003,25` | `0,00` |
| Instrução no Brasil | Dependente | CNPJ acima, `AJU PAG ESCOLA DEP` | `4.504,26` | `504,27` se exibido |
| Advogado | Titular | CPF acima, `AJU PAG ADVOGADO RRA` | `2.805,05` | `0,00` |
| Pensão alimentícia por escritura | Alimentando cadastrado | `AJU PES ALIMENTANDO UM` | `6.006,28` | `0,00` |
| Previdência complementar | Titular | CNPJ acima, `AJU PAG PREVIDENCIA` | `5.507,29` | `507,30` se exibido |
| Outros | Titular | CPF acima, `AJU PAG OUTROS DETALHE` | `808,31` | `108,32` |

Se o código escolhido não oferecer parcela não dedutível, deixe-a zerada; não troque o código só para habilitar o campo.

## 16. Doações efetuadas

| Tipo | Donatário | Valor |
|---|---|---:|
| Doação em dinheiro | CPF `222.333.444-05`, `AJU DOA PESSOA FISICA` | `7.101,41` |
| Doação em bens/direitos | CPF `333.444.555-08`, `AJU DOA BEM DEPENDENTE` | `8.102,42` |
| Incentivo permitido, se existir | CNPJ `55.566.677/0001-83`, `AJU DOA INCENTIVO` | `1.103,43` |

## 17. Doações a partidos políticos e candidatos

Inclua uma linha apenas se o programa aceitar os dados sem exigir identificador oficial não fictício:

| Campo | Valor |
|---|---:|
| Tipo | Partido político ou candidato, conforme disponível |
| CNPJ | `55.566.677/0001-83` |
| Nome | `AJU ELEITORAL SENTINELA` |
| Valor | `1.201,44` |

Se houver validação contra cadastro eleitoral e a linha for recusada, registre `RECUSADO POR CADASTRO EXTERNO`; não use dados reais.

## 18. Doações diretamente na declaração — ECA

Essa ficha pode depender de imposto devido e cadastro oficial. Tente criar um item, mas não gere pagamento:

| Campo | Valor |
|---|---:|
| Esfera | `Municipal` |
| UF/município | `SP / SAO PAULO` |
| Fundo | selecionar o fundo apresentado pelo PGD |
| CNPJ | preenchido automaticamente pelo programa |
| Valor | `301,45`, somente se aceito dentro do limite calculado |

Se o limite calculado for menor, use exatamente o maior valor aceito e anote-o. Não emita DARF.

## 19. Doações diretamente na declaração — Pessoa Idosa

Repita a lógica anterior:

| Campo | Valor |
|---|---:|
| Esfera | `Estadual` |
| UF | `SP` |
| Fundo | selecionar um fundo apresentado pelo PGD |
| CNPJ | automático |
| Valor | `302,46`, se aceito pelo limite |

## 20. Bens e direitos

Inclua os itens abaixo. Preencha todos os campos adicionais que o código abrir.

### 20.1 Imóvel urbano

| Campo | Valor |
|---|---|
| Grupo/código | Bem imóvel / apartamento |
| País | `105 - Brasil` |
| Discriminação | `AJU BEM IMOVEL APARTAMENTO SENTINELA, adquirido em 15/05/2025, matrícula 11001, cartório AJU, 50% do titular.` |
| Endereço | Rua `AJU BEM IMOVEL`, nº `2101`, apto `21`, São Paulo/SP, CEP `01001-000` |
| Inscrição municipal/IPTU | `AJU-IPTU-2101` |
| Registro/matrícula | `11001` |
| Área | `71,21` m² |
| Data de aquisição | `15/05/2025` |
| Situação em 31/12/2024 | `0,00` |
| Situação em 31/12/2025 | `210.101,51` |

### 20.2 Veículo

| Campo | Valor |
|---|---|
| Grupo/código | Bem móvel / veículo automotor |
| RENAVAM | `AJU220022` se o campo aceitar texto; caso contrário, valor numérico válido solicitado pelo PGD |
| Discriminação | `AJU BEM VEICULO MODELO SENTINELA ANO 2025 COR AZUL` |
| Situação anterior | `0,00` |
| Situação atual | `82.202,52` |

### 20.3 Conta bancária

| Campo | Valor |
|---|---|
| Grupo/código | Depósito à vista/conta corrente |
| CNPJ do banco | `55.566.677/0001-83` |
| Banco | `AJU BANCO SENTINELA` |
| Agência | `2303` |
| Conta e DV | `240024-5` |
| Discriminação | `AJU BEM CONTA BANCARIA TITULAR` |
| Situação anterior | `12.303,53` |
| Situação atual | `23.304,54` |

### 20.4 Aplicação financeira

| Campo | Valor |
|---|---|
| Grupo/código | Aplicação de renda fixa |
| CNPJ | `55.566.677/0001-83` |
| Discriminação | `AJU BEM APLICACAO RENDA FIXA SENTINELA` |
| Situação anterior | `31.405,55` |
| Situação atual | `42.406,56` |

### 20.5 Participação societária

| Campo | Valor |
|---|---|
| Grupo/código | Quotas ou quinhões de capital |
| CNPJ | `55.566.677/0001-83` |
| Discriminação | `AJU BEM PARTICIPACAO SOCIETARIA 1234 QUOTAS` |
| Situação anterior | `50.507,57` |
| Situação atual | `61.508,58` |

### 20.6 Bem do dependente

| Campo | Valor |
|---|---|
| Titularidade | Dependente `AJU PES DEPENDENTE UM` |
| Grupo/código | Numerário em espécie - moeda nacional |
| Discriminação | `AJU BEM NUMERARIO DEPENDENTE` |
| Situação anterior | `1.609,59` |
| Situação atual | `2.610,60` |

### 20.7 Aplicação financeira no exterior — Lei 14.754

| Campo | Valor |
|---|---|
| País | `249 - Estados Unidos` |
| Grupo/código | Aplicação financeira no exterior compatível |
| Discriminação | `AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA` |
| Moeda | `USD` |
| Situação anterior em reais | `11.711,61` |
| Situação atual em reais | `22.712,62` |
| Rendimento no ano, se solicitado | `3.713,63` |
| Imposto pago, se solicitado | `314,64` |
| Opção/indicador Lei 14.754 | Marcar a opção que faça o quadro ser impresso e anotar o texto exato |

## 21. Dívidas e ônus reais

Inclua duas linhas:

| Tipo | Credor/discriminação | 31/12/2024 | 31/12/2025 | Pago em 2025 |
|---|---|---:|---:|---:|
| Pessoa jurídica | CNPJ acima, `AJU DIV FINANCIAMENTO SENTINELA` | `91.801,71` | `72.802,72` | `19.003,73` |
| Pessoa física | CPF do cônjuge, `AJU DIV EMPRESTIMO PESSOAL` | `10.804,74` | `6.805,75` | `3.998,99` |

Não registre dívida de financiamento vinculada a bem se o próprio código do bem já exigir tratamento diferente; nesse caso use “outras pessoas jurídicas”.

## 22. Atividade rural no Brasil — identificação do imóvel

Inclua um imóvel explorado:

| Campo | Valor |
|---|---|
| Nome | `AJU RUR FAZENDA BRASIL SENTINELA` |
| Localização | `ESTRADA AJU RURAL KM 22` |
| Município/UF | `UBERABA/MG` |
| CEP | `38000-000` |
| Área | `123,45` ha |
| Participação | `75,00%` |
| Condição de exploração | `Proprietário` |
| Atividade | `Pecuária` ou equivalente |
| CIB/NIRF | preencher somente se o programa aceitar identificador sintético; senão anotar a exigência |
| Data de aquisição | `16/06/2020` |

Adicione participante, se a ficha habilitar:

| Campo | Valor |
|---|---|
| CPF | `222.333.444-05` |
| Nome | `AJU RUR PARTICIPANTE UM` |
| Participação | `25,00%` |

## 23. Atividade rural no Brasil — receitas, despesas e investimentos

Preencha meses distintos:

| Mês | Receita | Despesa | Investimento |
|---|---:|---:|---:|
| Janeiro | `18.101,01` | `8.102,02` | `3.103,03` |
| Fevereiro | `19.104,04` | `9.105,05` | `4.106,06` |
| Março | `20.107,07` | `10.108,08` | `5.109,09` |
| Abril | `21.110,10` | `11.111,11` | `6.112,12` |

Se receita e despesa forem detalhadas por espécie/documento, use as mesmas quantias e descrição `AJU RUR RECEITA/DESPESA MES NN`. Deixe totais e resultado para cálculo.

## 24. Atividade rural no Brasil — apuração

| Campo | Orientação/valor |
|---|---|
| Resultado do exercício | Calculado |
| Prejuízo anterior a compensar | `7.201,13`, somente se editável |
| Compensação de prejuízo | deixar calcular ou usar o limite aceito |
| Opção por 20% da receita bruta | `Não`, para preservar despesas detalhadas |
| Resultado tributável | Calculado |

## 25. Atividade rural no Brasil — rebanho

Inclua uma espécie e preencha todas as colunas:

| Campo | Quantidade |
|---|---:|
| Espécie | `BOVINOS AJU SENTINELA` |
| Estoque inicial | `101` |
| Compras/entradas | `22` |
| Nascimentos | `13` |
| Consumo | `4` |
| Perdas | `5` |
| Vendas/saídas | `26` |
| Estoque final | `101` se calculado pela equação; use o valor que a tela calcular |

## 26. Atividade rural no Brasil — bens

| Campo | Valor |
|---|---|
| Código | Trator/máquina ou equivalente |
| Discriminação | `AJU RUR BEM TRATOR SENTINELA SERIE 2601` |
| 31/12/2024 | `81.301,14` |
| 31/12/2025 | `92.302,15` |

## 27. Atividade rural no Brasil — dívidas

| Campo | Valor |
|---|---|
| Discriminação/credor | `AJU RUR DIVIDA CUSTEIO SENTINELA` |
| CPF/CNPJ, se exibido | CNPJ acima |
| 31/12/2024 | `41.401,16` |
| 31/12/2025 | `32.402,17` |

## 28. Atividade rural no exterior — seis quadros

Use país `249 - Estados Unidos`, moeda `USD` e o texto `AJU RUE` em todas as descrições.

### 28.1 Identificação

| Campo | Valor |
|---|---|
| Imóvel | `AJU RUE FARM EXTERIOR SENTINELA` |
| Localização | `2801 AUDIT FARM ROAD` |
| Área | `234,56` ha |
| Participação | `100,00%` |
| Condição | Proprietário |
| Aquisição | `17/07/2021` |

### 28.2 Receitas, despesas e investimentos

| Mês | Receita | Despesa | Investimento |
|---|---:|---:|---:|
| Janeiro | `28.501,21` | `12.502,22` | `6.503,23` |
| Fevereiro | `29.504,24` | `13.505,25` | `7.506,26` |

Preencha nas unidades e conversões pedidas pela tela. Se houver valor na moeda original e em reais, use o valor acima como reais e anote a cotação/valor original aceito.

### 28.3 Apuração

Prejuízo anterior `8.507,27`, somente se editável; demais campos calculados.

### 28.4 Rebanho

Espécie `AJU RUE CATTLE`; inicial `51`, entradas `12`, nascimentos `8`, consumo `2`, perdas `3`, vendas `16`, final `50`.

### 28.5 Bens rurais

Descrição `AJU RUE BEM MAQUINA SENTINELA`; anterior `51.508,28`; atual `62.509,29`.

### 28.6 Dívidas rurais

Descrição `AJU RUE DIVIDA EXTERIOR SENTINELA`; anterior `31.510,30`; atual `24.511,31`.

## 29. Ganho de capital — imóveis

Normalmente os dados vêm do GCAP 2025. Se o IRPF oferecer apenas **Importar GCAP**, não invente preenchimento direto: crie a operação no GCAP 2025 e importe-a. Preencha todos os campos que aparecerem:

| Campo | Valor |
|---|---|
| Descrição | `AJU GCI IMOVEL URBANO SENTINELA` |
| País/UF/município | Brasil / SP / São Paulo |
| Aquisição | `18/08/2018` |
| Alienação | `18/08/2025` |
| Adquirente | CPF `222.333.444-05`, `AJU GCI ADQUIRENTE` |
| Custo de aquisição | `100.601,41` |
| Valor de alienação | `160.602,42` |
| Despesas de alienação | `5.603,43` |
| Forma de recebimento | À vista |
| Natureza | Venda |
| Isenção | Não, salvo bloqueio do programa |
| Ganho e imposto | Calculados |

## 30. Ganho de capital — bem móvel

| Campo | Valor |
|---|---|
| Bem | `AJU GCM VEICULO SENTINELA` |
| Aquisição | `19/09/2022` |
| Alienação | `19/09/2025` |
| Adquirente | CPF do cônjuge |
| Custo | `30.611,44` |
| Alienação | `42.612,45` |
| Despesas | `1.613,46` |
| Recebimento | A prazo, 3 parcelas |
| Parcelas | `14.204,15`, `14.204,15`, `14.204,15`, ajustando centavos se o GCAP exigir soma exata |

## 31. Ganho de capital — participação societária

| Campo | Valor |
|---|---|
| Empresa | CNPJ acima / `AJU GCP EMPRESA SENTINELA` |
| Participação alienada | `12,34%` |
| Aquisição | `20/10/2019` |
| Alienação | `20/10/2025` |
| Adquirente | CPF do cônjuge |
| Custo | `40.621,47` |
| Alienação | `70.622,48` |
| Despesas | `2.623,49` |
| Resultado/imposto | Calculados |

## 32. Ganho de capital — moeda estrangeira em espécie

| Campo | Valor |
|---|---|
| Moeda/país | USD / Estados Unidos |
| Descrição | `AJU GCE MOEDA ESPECIE SENTINELA` |
| Aquisição | `21/11/2024` |
| Alienação | `21/11/2025` |
| Quantidade alienada | `1.234,56 USD` |
| Custo em reais | `6.631,50` |
| Alienação em reais | `8.632,51` |
| Imposto | Calculado |

## 33. Renda variável — operações comuns e day trade do titular

Preencha janeiro, fevereiro e março. Em cada mês, abra todos os mercados disponíveis; use ao menos mercado à vista e opções se a tela permitir.

| Mês | Operação comum — resultado | Day trade — resultado | IRRF comum | IRRF day trade | Imposto pago |
|---|---:|---:|---:|---:|---:|
| Janeiro | `2.701,61` | `701,62` | `27,63` | `140,64` | `501,65` |
| Fevereiro | `-1.702,66` | `802,67` | `17,68` | `160,69` | `202,70` |
| Março | `3.703,71` | `-903,72` | `37,73` | `90,74` | `604,75` |

Quando o resultado vier da soma dos mercados, distribua o valor principal no mercado à vista e `101,01` em opções, reduzindo o mercado à vista para manter o total. Prejuízos, base e imposto a pagar devem ser calculados.

## 34. Renda variável — dependente

Selecione o dependente e preencha abril:

| Campo | Valor |
|---|---:|
| Operações comuns | `1.711,76` |
| Day trade | `411,77` |
| IRRF comum | `17,78` |
| IRRF day trade | `82,79` |
| Imposto pago | `303,80` |

## 35. FII e Fiagro — titular

| Mês | Resultado | IRRF | Imposto pago |
|---|---:|---:|---:|
| Maio | `1.801,81` | `18,82` | `361,83` |
| Junho | `-902,84` | `9,85` | `0,00` |

Deixe prejuízo a compensar, base e imposto calculados quando bloqueados.

## 36. FII e Fiagro — dependente

| Mês | Resultado | IRRF | Imposto pago |
|---|---:|---:|---:|
| Julho | `1.811,86` | `18,87` | `362,88` |

## 37. Demais rendimentos e transportes

Se existirem fichas autônomas com esses nomes, preencha cada tipo disponível com um valor exclusivo:

| Quadro | Beneficiário | Valor/descrição |
|---|---|---|
| Outros rendimentos | Titular | `AJU DEM TITULAR`, `2.901,91` |
| Outros rendimentos | Dependente | `AJU DEM DEPENDENTE`, `1.902,92` |
| Transporte de carga | Titular | `AJU DEM CARGA`, receita `9.903,93` |
| Transporte de passageiros | Titular | `AJU DEM PASSAGEIROS`, receita `8.904,94` |

Não duplique um quadro se esses valores já estiverem dentro da ficha mensal de PF/exterior; nesse caso apenas marque `ABSORVIDO NA FICHA RPF`.

## 38. Resumo da declaração

Não edite valores calculados. Abra e confira todas as abas do resumo:

- Rendimentos tributáveis e isentos.
- Deduções.
- Imposto devido.
- Imposto pago/retido.
- Restituição ou imposto a pagar.
- Bens e direitos.
- Dívidas e ônus.
- Evolução patrimonial.
- Comparação entre deduções legais e desconto simplificado.

Selecione **Deduções legais** para a impressão principal, se o programa permitir. Anote também o imposto do modelo simplificado mostrado na comparação.

## 39. Verificar pendências

Clique em **Verificar pendências**.

1. Corrija somente erros que impedem salvar ou imprimir.
2. Avisos são aceitáveis na amostra, desde que anotados.
3. Não substitua dados sintéticos por cadastros reais para eliminar aviso.
4. Copie para a lista de ocorrências: severidade, ficha, campo e mensagem integral.
5. Tire uma captura da tela final de pendências.

## 40. Exportar o PDF oficial completo

1. Salve a declaração.
2. Abra **Imprimir**.
3. Escolha **Declaração** ou **Declaração completa**, nunca somente recibo/resumo.
4. Marque **todas as fichas**, inclusive as sem movimento, se essa opção existir.
5. Inclua o recibo apenas como documento adicional; não use o recibo no lugar da declaração.
6. Escolha impressora PDF ou **Salvar como PDF**.
7. Nomeie exatamente: `AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`.
8. Salve também, se disponível, um PDF separado do recibo: `AJU-01-RECIBO-NAO-TRANSMITIDO.pdf`.
9. Não transmita.

### Conferência do PDF antes de entregar

- [ ] O arquivo abre sem senha.
- [ ] O título identifica IRPF 2026 e declaração completa.
- [ ] Há texto selecionável; não é somente imagem.
- [ ] A primeira página contém `AUDITORIA PDF TEC AJUSTE`.
- [ ] A busca do leitor encontra `AJU PES DEPENDENTE UM`.
- [ ] A busca encontra `AJU RRA TITULAR EXCLUSIVA`.
- [ ] A busca encontra `AJU BEM IMOVEL`.
- [ ] A busca encontra `AJU RUR FAZENDA`.
- [ ] A busca encontra `AJU RUE FARM`, se a ficha foi impressa.
- [ ] Existem páginas de renda variável e FII/Fiagro.
- [ ] Existem páginas do resumo e evolução patrimonial.
- [ ] Nenhuma página foi cortada ou ficou em branco por falha de impressão.

---

# PARTE B — Casos que exigem declarações separadas

Não tente misturar estas modalidades no `AJU-01`. Se o objetivo for realmente mapear **cada ficha oficial**, produza mais dois PDFs.

## 41. `ESP-01` — Declaração Final de Espólio

Crie outra declaração, escolhendo a modalidade final de espólio. Use somente identificadores sintéticos aceitos pelo PGD e preencha:

| Campo | Sentinela |
|---|---|
| Nome | `AUDITORIA PDF TEC ESPOLIO` |
| Inventariante | `ESP INVENTARIANTE SENTINELA` |
| CPF do inventariante | um CPF sintético aceito, diferente dos anteriores |
| Tipo de encerramento | Decisão judicial ou escritura, conforme a opção que habilitar mais campos |
| Processo | `ESP-PROC-4101` |
| Vara | `41 VARA SENTINELA` |
| Comarca | `SAO PAULO` |
| Cartório | `ESP CARTORIO SENTINELA` |
| Livro/folhas | `L41` / `F42` |
| Data da decisão/escritura | `22/12/2025` |
| Data do trânsito em julgado, se aplicável | `23/12/2025` |

Cadastre dois herdeiros com percentuais `60,00%` e `40,00%`, nomes `ESP HERDEIRO UM` e `ESP HERDEIRO DOIS`. Inclua pelo menos um bem com discriminação `ESP BEM PARTILHA SENTINELA`, valor `123.401,41`, e distribua as parcelas conforme o PGD. Exporte como `ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf`.

Se a modalidade exigir dados jurídicos impossíveis de sintetizar ou validar localmente, pare nessa tela, fotografe todos os campos e registre a restrição; não use processo real.

## 42. `SAI-01` — Declaração de Saída Definitiva do País

Crie outra declaração na modalidade de saída definitiva:

| Campo | Sentinela |
|---|---|
| Nome | `AUDITORIA PDF TEC SAIDA` |
| Data da caracterização da não residência/saída | `24/12/2025` |
| País de destino | `249 - Estados Unidos` |
| Procurador | `SAI PROCURADOR SENTINELA` |
| CPF do procurador | um CPF sintético aceito, diferente dos anteriores |
| Endereço no exterior | `4201 AUDIT EXIT AVENUE` |
| Cidade/estado | `MIAMI / FL` |
| Código postal | `33101` |
| Telefone | `+1 305 555 4202` se aceito |
| E-mail | `sai.auditoria@example.invalid` |

Inclua uma fonte pagadora, um bem no Brasil e um bem no exterior com prefixo `SAI`. Exporte como `SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf`. Não transmita.

---

# Lista de ocorrências a entregar junto com o PDF

Copie e preencha este quadro:

| Nº | Ficha | Campo | Ocorrência | Valor efetivamente usado |
|---:|---|---|---|---|
| 1 |  |  | `NÃO EXIBIDO`, `RECUSADO`, `CALCULADO`, `VALOR AJUSTADO` ou mensagem do PGD |  |
| 2 |  |  |  |  |
| 3 |  |  |  |  |

## Pacote mínimo a entregar

1. `AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf` — obrigatório.
2. Lista de ocorrências preenchida — obrigatória se qualquer valor foi alterado ou recusado.
3. Captura da tela de pendências — recomendada.
4. `ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf` — necessário para mapear espólio.
5. `SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf` — necessário para mapear saída definitiva.
6. PDF/relatório do GCAP 2025, se os ganhos de capital não forem impressos integralmente dentro do PDF IRPF — recomendado.

## Critério de conclusão

O preenchimento manual estará concluído quando o PDF completo abrir, contiver texto pesquisável, mostrar os sentinelas das fichas preenchidas e vier acompanhado de todas as exceções encontradas. A auditoria do importador continuará separadamente: cada campo do PDF será confrontado com o valor deste roteiro antes de qualquer implementação do importador.
