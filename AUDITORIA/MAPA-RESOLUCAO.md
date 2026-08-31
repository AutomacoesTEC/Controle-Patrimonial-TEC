# Mapa de resolução — achados da extração PDF IRPF 2026

Legenda de ação: FIX = extrair o dado; AVISO = ficha que o app não modela, transformar perda silenciosa em avisada; DOC = ajustar comentário/teste sem mudar comportamento.
Status: [x] resolvido, [ ] aberto.

## Já resolvidos (rodadas anteriores)
- [x] rv-01, rv-02  FII/Fiagro matriz mês a mês
- [x] rend-01, rend-02  exigibilidade suspensa + RRA dependentes (AVISO por título quebrado)
- [x] rural-01, rural-02  imóvel rural sem CIB + vínculo do participante
- [x] dividas-01, dividas-02  saldo < R$ 1.000 na coluna errada

## Área DOAÇÕES E PAGAMENTOS
- [x] doacoes-01 / pagdoa-01  FIX  Doações a partidos: cabeçalho NOME|CNPJ|VALOR
- [x] doacoes-02 / pagdoa-02a FIX  Doações ECA: cabeçalho TIPO DE FUNDO|FUNDO|CNPJ|VALOR
- [x] doacoes-03 / pagdoa-02b FIX  Doações Pessoa Idosa: idem
- [x] doacoes-04 / pagdoa-03  FIX  Doações efetuadas: coluna PARC. NÃO DEDUTÍVEL não ancorada
- [x] doacoes-05             FIX  valor da doação concatenado com a parcela não dedutível
- [x] pagamentos-01 / pagdoa-04 FIX  marcadores Titular/Dependente/Alimentando descartados
- [x] pagdoa-05             AVISO os avisos não nomeiam as doações perdidas
- [x] pagdoa-06             FIX  guard cobre só /^Dependente:/ (risco latente)

## Área BENS E DIREITOS
- [x] bens-01  FIX  titularidade cravada em 'Titular'
- [x] bens-02  FIX  país cravado em '105'
- [x] bens-03  FIX  bloco de herdeiros (ESP-01) perdido e discriminação poluída
- [x] bens-04  FIX  cabeçalho "Lucros e Dividendos (R$)" colado na discriminação
- [x] bens-05  FIX  colunas de partilha (ESP-01) lidas como saldo anterior/atual
- [x] bens-06  FIX  número do item (coluna BEM) descartado
- [x] bens-07  FIX  Inscrição Municipal / Matrícula / RENAVAM não extraídos
- [x] bens-08  FIX  âncoras de valor exigem data pura; caem em x fixos
- [x] bens-09  DOC  isBensMetadataRow é código morto

## Área GANHO DE CAPITAL
- [x] gc-01  FIX  participação: corretagem recebe valor de alienação
- [x] gc-02  FIX  imóvel: "Especificação e endereço" não casa
- [x] gc-03  FIX  imóvel: "Data de Aquisição:" com maiúscula/dois-pontos não casa
- [x] gc-04  FIX  moeda em espécie: alienação detalhada nunca lida
- [x] gc-05  FIX  participação: "CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA"
- [x] gc-06  FIX  imóvel: "Valor da Alienação"/"Valor Líquido da Alienação" (com "da")
- [x] gc-07  FIX  reduções Lei 7.713/Lei 11.196 e os cinco "Resultado" colidindo
- [x] gc-08  FIX  faixas de tributação lidas como bloco mas não extraídas (REABERTO e fechado de novo em 31/08/2026: a leitura estava certa, mas a montagem final de ganhosCapitalOficial cravava faixasTributacao em [] por cima. Verificado no retorno real, não no relato)
- [x] gc-09  FIX  participação: quadro CUSTO DE AQUISIÇÃO sem parser
- [x] gc-10  FIX  participação: "Espécie da participação" consumida pela branch de Natureza
- [x] gc-11  FIX  participação: Município e UF da sociedade perdidos
- [x] gc-12  FIX  a prazo: data da última parcela não gravada

## Área RESUMO E CÁLCULO
- [x] resumo-01  FIX  IMPOSTO A RESTITUIR (row separada, Δy=3)
- [x] resumo-02  FIX  evolução patrimonial de Espólio/Saída (rótulos sem "em dd/mm/aaaa")
- [x] resumo-03  FIX  bloco Rendimentos Tributáveis: 5 de 7 rótulos descartados
- [x] resumo-04  FIX  bloco Deduções: 8 de 10 descartados
- [x] resumo-05  FIX  bloco Imposto Devido: 5 linhas do cálculo descartadas
- [x] resumo-06  FIX  bloco Imposto Pago: 8 componentes descartados
- [x] resumo-07  FIX  Parcelamento/Quota: valor da quota e número de quotas
- [x] resumo-08  FIX  Outras Informações: 12 de 14 descartados
- [x] resumo-09  AVISO/FIX  ficha 'estruturada' sem aviso apesar de 41 valores fora
- [x] resumo-10  DOC  desconto simplificado (não verificável nestes PDFs)

## Área RENDIMENTOS
- [x] rend-03  AVISO  carnê-leão PF/exterior sem parser (já avisado; confirmar)
- [x] rend-04  AVISO  RRA titular sem parser (já avisado; confirmar)
- [x] rend-05  FIX  continuação do cabeçalho ('Pagadora') absorvida na descrição
- [x] rend-06  FIX  Nome da fonte + Descrição concatenados
- [x] rend-07  FIX  CPF/CNPJ do doador (código 14) vai pro nome
- [x] rend-08  FIX  13º dos dependentes com beneficiário 'Titular' fixo

## Área RURAL
- [x] rural-03  FIX  opção pela forma de apuração do resultado
- [x] rural-04  FIX  Apuração "Sem Informações" reportada como preenchida
- [x] rural-05  AVISO  atividade rural no exterior sem parser (já avisado; confirmar)
- [x] rural-06  FIX  nome da espécie do rebanho truncado
- [x] rural-07  FIX  participante rural sem CPF (estrangeiro) descartado

## Área DÍVIDAS
- [x] dividas-03  FIX  discriminação não usa textoDaColunaDisc (risco latente)
