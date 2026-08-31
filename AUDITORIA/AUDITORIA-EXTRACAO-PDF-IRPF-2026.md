# Auditoria independente da fase de EXTRACAO do importador de PDF IRPF 2026

Data: 31/08/2026.
Alvo: `src/pages/importParsers.js`, funcao `parsePDF` (linha 3327; laco de paginas a partir da 3600) e `src/irpf/catalogoFichasPdf2026.js`.
Gabarito: os tres PDFs oficiais em `output/pdf/` (AJU-01, 41 paginas; ESP-01, 8 paginas; SAI-01, 9 paginas).

## 1. Metodo e artefatos de prova

Esta auditoria nao simulou o parser: executou o parser real.

| Artefato | O que e | Gerador |
|---|---|---|
| `AUDITORIA/rows-pdfjs/*.rows.txt` | as linhas visuais EXATAS que o parser enxerga, extraidas com o mesmo `pdfjs-dist` do app e agrupadas com `buildRows`/`TOLERANCIA_LINHA` copiados verbatim de `importParsers.js:2416,2425-2434` | `src/irpf/dumpRowsPdfjs.audit.test.js` |
| `AUDITORIA/saida-parsepdf/*.json` | o valor de retorno REAL de `parsePDF` sobre os tres PDFs, mais os logs emitidos | `src/irpf/dumpParsePdf.audit.test.js` |

Os dois rodam com `npx vitest run <arquivo>`. Nenhum arquivo pre-existente do projeto foi alterado.

Isso resolve a ressalva do dump `pypdf`: a segmentacao de itens deixou de ser aproximada. Todo achado abaixo cita a row real que o parser recebeu e o campo real que ele devolveu.

Regra aplicada: comentario de codigo nao e prova de comportamento. Varios comentarios do arquivo afirmam garantias que a execucao desmente (o caso mais grave esta em 5.2).

## 2. Reconfirmacao dos tres bugs de deteccao

A regra de casamento real, `catalogoFichasPdf2026.js:85`:

```js
if (normalizado === p || (p.length >= 24 && normalizado.startsWith(p))) {
```

Sem `includes`, sem sufixo, sem regex. `normalizar` (linha 72) so colapsa espaco, faz `trim` e `toUpperCase`: nao remove acento nem pontuacao. E o matcher recebe o texto de CADA cell isoladamente (`importParsers.js:3620-3622`), nunca a linha inteira.

| Alegacao | Veredito | Prova |
|---|---|---|
| 1. `saida-definitiva` | PARCIAL: conclusao verdadeira, causa declarada incompleta | O padrao `SAÍDA DEFINITIVA DO PAÍS` (24 chars) e sufixo do banner `DECLARAÇÃO DE SAÍDA DEFINITIVA DO PAÍS` (`SAI-01.rows.txt:4`), e `startsWith` reprova. Mas o CABECALHO DA FICHA nao e o banner: e `p1 r20 [x=17.0]SAÍDA`, 5 caracteres, que nenhum dos dois bracos da linha 85 alcanca. Trocar `startsWith` por `includes` casaria a row errada (o banner da pagina 1). |
| 2. `herdeiros` | VERDADEIRA, exatamente como enunciada | `catalogoFichasPdf2026.js:20` traz `['HERDEIROS']`, 9 chars, abaixo do limiar 24, logo so igualdade exata. O PDF imprime `ESP-01.rows.txt:44` = `p2 r3 [x=17.0]HERDEIROS / MEEIRO`, com dois herdeiros nominados logo abaixo. |
| 3. `conjuge` | VERDADEIRA | `catalogoFichasPdf2026.js:41` traz dois padroes de 22 chars. `INFORMAÇÕES DO CÔNJUGE` e prefixo exato de `INFORMAÇÕES DO CÔNJUGE OU COMPANHEIRO(A)` (`ESP-01.rows.txt:31`): so o limiar 22 < 24 reprova. |

Prova de execucao das tres: `fichasPdfObservadas` traz 41 chaves no AJU-01 e 39 no ESP-01 e SAI-01, contra `totalFichasPdfCatalogadas: 51`, e nenhuma das tres fichas aparece.

### 2.1 Tres falhas de matcher ADICIONAIS, nao alegadas antes

Todas por quebra do titulo em duas rows, e todas com um agravante: alem de nao registrarem a ficha certa, elas atribuem a row a uma ficha GENERICA errada e movem `fichaPdfAtual` (`importParsers.js:3627`).

1. `rendimentos-exigibilidade-titular`. `AJU-01.rows.txt:207-208` imprime o titulo em duas rows, quebrando em `(IMPOSTO COM` / `EXIGIBILIDADE SUSPENSA)`. A cell truncada tem como prefixo o padrao da ficha comum, e o matcher devolve `rendimentos-pj-titular`. Dados presentes e perdidos: `AJU EXI FONTE TITULAR ... 17.701,91 ... 7.702,92`.
2. `rendimentos-exigibilidade-dependentes`. Aqui ha um segundo defeito, independente do layout: o padrao do catalogo esta TRUNCADO em `catalogoFichasPdf2026.js:29`, terminando em `(IMPOSTO COM EXIGIBILIDADE`, sem ` SUSPENSA)`. O impresso vira prefixo do padrao, direcao que a linha 85 nao cobre.
3. `rra-dependentes`. `AJU-01.rows.txt:240-241` quebra em `...RECEBIDOS ACUMULADAMENTE PELOS` / `DEPENDENTES`. A cell de continuacao, `DEPENDENTES`, casa por igualdade exata com a ficha `dependentes` (`catalogoFichasPdf2026.js:18`), redirecionando `fichaPdfAtual` no meio da tabela de RRA.

Contraprova de que a causa e o layout e nao a declaracao: no SAI-01 essas mesmas fichas cabem numa row so (`SAI-01.rows.txt:55` e `:62`) e sao reconhecidas.

Total: 6 fichas com falha de reconhecimento provada em execucao.

## 3. Achados criticos da extracao, verificados em execucao

Ordem por gravidade pratica.

### 3.1 FII e Fiagro: ficha preenchida, extracao vazia (AJU-01)

Severidade ALTA. Provado por execucao instrumentada.

O AJU-01 imprime a ficha com movimento real (`AJU-01.rows.txt`, p37 e p38): maio com resultado liquido 1.801,81, aliquota 20,00, imposto devido 360,36, imposto pago 361,83, prejuizo a compensar 902,84.

A saida real traz `fiiFiagroMensalOficial: []` e `fiiFiagroAnualOficial: null`. Nada foi importado.

Duas causas independentes, ambas confirmadas rodando o parser com log:

1. `importParsers.js:4881`. O rotulo `RESULTADO LÍQUIDO DO MÊS` e impresso em TRES rows (`p37 r6` = `RESULTADO LÍQUIDO DO`, `r7` = os valores, `r8` = `MÊS`). A row orfa com a unica cell `MÊS` satisfaz `textos.some(t => /^MÊS$/.test(t))`, entra no ramo de cabecalho e ZERA `fiiMesesColuna` (nenhum nome de mes naquela row). A partir dai, `if (fiiMesesColuna.length === 0) continue` (linha 4886) descarta TODAS as linhas restantes do quadro. Log da execucao instrumentada:

   ```
   DBG HEADER-MES p37 r5 cells=MÊS|Janeiro|Fevereiro|Março|Abril|Maio|Junho
   DBG HEADER-MES p37 r8 cells=MÊS
   DBG mesesColuna p37 r15 len=0     <- PREJUÍZO A COMPENSAR, com 902,84
   DBG mesesColuna p37 r17 len=0     <- IMPOSTO DEVIDO, com 360,36
   ```
   O mesmo ocorre no segundo quadro (`r25` monta, `r28` zera) e nas duas paginas.

2. `importParsers.js:4889-4891`. Mesmo corrigindo a causa 1, as linhas cujo rotulo foi quebrado continuam perdidas: a row que carrega os valores nao tem texto de rotulo, `rotulo` sai vazio e `FII_LINHAS_MAP.get('')` e `undefined`. Atinge `RESULTADO LÍQUIDO DO MÊS`, `RESULTADO NEGATIVO ATÉ O MÊS ANTERIOR`, `BASE DE CÁLCULO DO IMPOSTO` e `IMPOSTO RETIDO MESES ANTERIORES`.

A perda nao gera aviso. A ficha nao esta em `FICHAS_NAO_LIDAS`, entao nao cai na rede de seguranca. O unico rastro e `estadoFichas['pdf:fii-fiagro-titular'].estado === 'erro'`, que o `Dashboard.jsx:208-222` agrega num contador anonimo de erros, sem nomear a ficha nem o valor.

### 3.2 Rendimentos com exigibilidade suspensa e RRA dos dependentes: perdidos sem aviso

Severidade ALTA. Provado.

Teste de presenca dos valores impressos dentro da saida real do AJU-01:

| Valor impresso | Ficha | Na saida? | Avisado? |
|---|---|---|---|
| 17.701,91 / 7.702,92 | Exigibilidade suspensa, titular | ausente | NAO |
| 8.711,96 / 3.712,97 | Exigibilidade suspensa, dependentes | ausente | NAO |
| 9.811,06 | RRA dependentes | ausente | NAO |
| 31.801,01 | RRA titular | ausente | sim |
| 4.322,52 / 2.411,65 | PF e exterior, carne-leao | ausente | sim |

O mecanismo e o mesmo do item 2.1. `nomeDaFichaNaoLida` (`importParsers.js:3096-3104`) exige que o titulo INTEIRO esteja numa unica cell. Quando o titulo quebra em duas rows, nao casa, e o fechamento generico de `importParsers.js:3927` (`/^(RENDIMENTOS|DEMONSTRATIVO|...)/`) fecha a secao e descarta o conteudo em silencio. `RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR` cabe numa row e por isso e o unico RRA avisado. A versao DEPENDENTES da ficha de exigibilidade suspensa sequer consta de `FICHAS_NAO_LIDAS`.

Carne-leao (PF e exterior) e RRA titular sao limitacao DECLARADA, com aviso ao usuario. Exigibilidade suspensa (titular e dependentes) e RRA dependentes sao perda SILENCIOSA. A diferenca importa: no primeiro caso a pessoa e mandada conferir, no segundo nao.

### 3.3 Imovel rural sem CIB descarta a ficha inteira e orfana o participante

Severidade ALTA. Provado.

`importParsers.js:4217`: `if (/^\d{2}$/.test(cells[0].t) && cib)`. O AJU-01 imprime o imovel SEM CIB (`p11 r7`: codigo 11, participacao 75,00, condicao 2, `AJU RUR FAZENDA BRASIL SENTINELA`, area 123,4, coluna CIB vazia). A linha inteira e descartada.

Saida real: `imoveisRurais: []`, e o participante sobrevive orfao:

```json
{"nome": "AJU RUR PARTICIPANTE UM", "cpf": "22233344405",
 "imovelId": null, "imovelCib": "", "imovelNome": "", "imovelChaveImportacao": ""}
```

Agravante de metodo: o comentario de `importParsers.js:4208-4211` afirma que este e o ponto em que o PDF entrega o que o `.DBK` nao tem, o VINCULO entre participante e imovel. Na unica declaracao de referencia com atividade rural, esse vinculo nunca e produzido.

### 3.4 Ganho de capital: quatro defeitos que corrompem ou perdem campo

Severidade ALTA. Todos provados contra `apuracaoGanhoCapital` no AJU-01.

1. Participacao societaria, operacao 3: `valorAlienacao: 0` e `custoCorretagem: 70622.48`. O valor da alienacao foi gravado no campo de corretagem, e o campo de alienacao ficou zerado. O sub-objeto `apuracao` tem os valores certos (`valorAlienacao: 70622.48`, `custoCorretagem: 2623.49`), mas `flushGc` (`importParsers.js:3509-3521`) so normaliza `ganhoCapital`, `impostoDevido` e `impostoPago` a partir dele. Os campos PLANOS, que o proprio comentario diz serem os que o resto do app consome, ficam errados.
2. Bem imovel, operacao 1: `bem: ""` e nenhum `endereco`. O rotulo impresso e `Especificação e endereço`, e nem `Especificação` (linha 4342) nem `Endereço` (linha 4377) casam por `rowHasCell`, que exige igualdade exata.
3. Bem imovel, operacao 1: `dataAquisicao: ""` e `custoAquisicao: 0`. A operacao 2 (bem movel) traz os dois corretamente, o que isola o defeito ao layout do quadro de imovel.
4. Moeda estrangeira em especie: a alienacao real e perdida. O AJU-01 p22 imprime a operacao (21/11/2025, quantidade 1.234,56, valor 8.632,51, custo medio 5,371549, custo 6.631,49, ganho 2.001,02). `importParsers.js:4523` exige uma cell igual a `ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE` para ligar o bloco. `grep -c` dessa string nos rows dos tres arquivos devolve 0. Saida: `ganhosCapitalOficial.moedaEspecie.operacoes: []`, com 12 linhas mensais zeradas importadas no lugar.

Nota, nao e achado de parser: a TOTALIZACAO impressa nessa mesma pagina esta zerada enquanto a alienacao acima dela tem ganho de 2.001,02. Isso e inconsistencia do preenchimento sintetico no PGD, nao do parser.

### 3.5 Bens: titularidade, pais e bloco de herdeiros

Severidade ALTA. Provado.

1. `importParsers.js:4000` crava `beneficiario: 'Titular'`. O AJU-01 imprime `p9 r33 [x=18.0]Bem ou direito pertencente ao: [x=134.0]Dependente [x=219.0]CPF: [x=239.0]333.444.555-08`, e a saida traz o bem `AJU BEM NUMERARIO DEPENDENTE` com `beneficiario: "Titular"`. O caminho `.DBK` le isso certo (`importParsers.js:705-706`), entao os dois caminhos de importacao divergem no mesmo dado.
2. `importParsers.js:3999` crava `localizacao: '105'` (Brasil). O SAI-01 imprime `p3 r20 [x=17.0]249 - ESTADOS UNIDOS DA AMÉRICA` e a saida traz `localizacao: "105"` para a conta no exterior.
3. ESP-01: o bloco de herdeiros do bem partilhado e simultaneamente perdido e corrompido. O PDF imprime:

   ```
   p3 r8  | [x=45.0]Nome [x=323.2]CPF/CNPJ [x=417.3]Percentual de participação (%)
   p3 r9  | [x=45.0]ESP HERDEIRO UM [x=315.0]777.888.999-41 [x=465.5]60,00
   p3 r10 | [x=45.0]ESP HERDEIRO DOIS [x=315.0]888.999.000-78 [x=465.5]40,00
   ```

   A saida real traz um unico bem com

   ```
   "discriminacao": "ESP BEM PARTILHA SENTINELA CPF/CNPJ 777.888.999-41 888.999.000-78"
   ```

   Mecanismo, em `textoDaColunaDisc` (`importParsers.js:2481-2500`): a faixa estendida vai de `anchors.disc` (101) ate `anchors.val1` (389). O cabecalho `CPF/CNPJ` (x=323.2) e os dois CPFs (x=315) caem dentro dela e sao colados na discriminacao; os NOMES (x=45, fora a esquerda) e os PERCENTUAIS (x=465.5, alem de val1) sao descartados. Resultado: nome e percentual de cada herdeiro perdidos, e o texto do bem poluido com um cabecalho de coluna e dois CPFs.
4. Ainda no ESP-01, as colunas impressas sao `SITUAÇÃO NA DATA DA PARTILHA` e `VALOR DE TRANSFERÊNCIA`, e sao gravadas em `situacao_anterior` e `situacao_atual`, que significam outra coisa. Alem disso, como o cabecalho do espolio nao tem celulas de data, `val1` e `val2` caem nos defaults 389 e 498 (`importParsers.js:3979-3980`); nesta declaracao os valores por coincidencia estao exatamente nesses x.

### 3.6 Dividas: valor abaixo de R$ 1.000,00 cai na coluna errada

Severidade ALTA. Nao exercitado pelos tres arquivos; provado por aritmetica sobre as coordenadas reais.

Ancoras montadas em `importParsers.js:4060-4066` a partir do cabecalho real do AJU-01 (`p10 r4`, `p10 r5`): `codigo` 23, `disc` 114.8, `val1` 300.5, `val2` 384.6, `pago` 518.8. `makeColumnPicker` (linha 2446) usa o ponto medio entre ancoras vizinhas como fronteira, logo:

- fronteira `val1`/`val2` = 342.55
- fronteira `val2`/`pago` = 451.70

Os numeros sao impressos alinhados a DIREITA. Duas medidas reais na coluna `val2`: `72.802,72` (9 glifos) em x=446.4 e `6.805,75` (8 glifos) em x=450.9, ou seja 4.5 por glifo e borda direita em 486.9 (a linha TOTAL, `102.606,45`, 10 glifos em x=329.0 na coluna `val1`, confirma a mesma metrica). Entao:

- `1.000,00` (8 glifos) sai em x=450.9, ainda dentro de `val2`. Ultimo caso seguro.
- `999,99` (6 glifos) sai em x=459.9, alem de 451.70, e e bucketado em `pago`.

Consequencia: um saldo em 31/12 do ano corrente menor que mil reais zera `situacao_atual` e contamina `valor_pago`, que passa a receber a concatenacao de dois numeros. `textInColumn` e chamado com `joinChar` vazio (`importParsers.js:4082`), entao `parseMoneyBR("999,993.998,99")` devolve 999.99: um numero plausivel e errado, sem nenhum sinal de erro.

O mesmo raciocinio vale para `val1` (borda direita 373.9, fronteira 342.55): um saldo do ano ANTERIOR abaixo de mil reais migra para `situacao_atual` e zera `situacao_anterior`.

Contraprova de que nao e generico: na ficha de Bens a coluna `val1` tem borda direita em 409.2 contra fronteira em 443.5, com folga. O defeito e especifico da ficha de Dividas, onde a ancora `VALOR PAGO` (x=518.8) empurra a fronteira para dentro do campo numerico de `val2`.

### 3.7 Doacoes: tres das quatro fichas nunca sao lidas

Severidade ALTA. Reportado por dois auditores independentes e confirmado pelo cetico de existencia literal.

`isDoacaoHeaderRow` (`importParsers.js:2609`) exige uma cell igual a `CÓD.` e outra casando `NOME DO BENEFICIÁRIO`. Os cabecalhos reais sao outros:

- Doacoes a partidos e candidatos: `NOME | CNPJ | VALOR` (`AJU-01.rows.txt`, `p10 r11`).
- Doacoes diretamente na declaracao, ECA e Pessoa Idosa: `TIPO DE FUNDO | FUNDO | CNPJ | VALOR`.

Sem cabecalho reconhecido, `processDoacaoRow` nunca monta ancoras e nenhuma linha e lida. No AJU-01 ha doacao eleitoral real impressa (`p10 r12`: `AJU ELEITORAL SENTINELA | 55.566.677/0001-83 | 1.201,44`) e a saida traz `doacoesPartidosOficial: []`.

Agravante: o unico aviso emitido sobre doacoes diz o contrario do que ocorre. `avisosImportacao` traz "As doacoes lidas deste PDF usam um layout de tabela extrapolado", quando na pratica tres das quatro fichas nao sao lidas de forma alguma.

### 3.8 Identificacao do contribuinte: endereco no exterior e blocos de espolio e saida

Severidade ALTA. Provado. Esta area nao estava nas oito do escopo e foi coberta na passagem de completude.

`preencherIdentificacaoPdf` (`importParsers.js:3289-3325`) crava os rotulos do endereco DOMESTICO. O SAI-01, que e justamente a declaracao de quem saiu do pais, imprime a variante estrangeira:

```
p1 r11 | Complemento: SUITE 42   Bairro/Distrito: DOWNTOWN
p1 r12 | Cidade: SAO PAULO       Cód. Ext.: 294
p1 r13 | País: 249 - ESTADOS UNIDOS DA AMÉRICA
p1 r14 | Código Postal: 33101    DDI/Telefone: (1) 3055554202
p1 r15 | E-mail: SAI.AUDITORIA@EXAMPLE.INVALID
```

Saida real do SAI-01: `bairro: ""`, `municipio: ""`, `uf: ""`, `cep: ""`, `telefone: ""`, `email: ""`. As regex exigem `Município:`, `UF:`, `CEP:`, `DDD/Telefone:`; o e-mail se perde porque a regex da linha 3313 exige o delimitador `DDD/Celular:`, que nao existe na variante estrangeira. E `País:` nao tem campo nenhum no modelo, embora seja o dado central de uma saida definitiva.

Dois blocos inteiros tambem nao tem parser no caminho PDF, confirmado por busca (`grep -n "inventariante\|procurador\|Comarca\|vara cível\|País de destino"` em `importParsers.js` devolve apenas `cpfProcurador` na linha 621, que pertence a `parseDBK`):

- ESP-01, bloco ESPOLIO: ano do obito 2025, ainda ha bens a inventariar, processo `ESP-PROC-4101`, comarca, vara `41 V`, data da decisao 22/12/2025, transito em julgado 23/12/2025, inventariante CPF 666.777.888-30.
- SAI-01, bloco SAIDA: CPF e nome do procurador, endereco do procurador, data da caracterizacao da condicao de nao residente 24/12/2025, pais de destino.

### 3.9 Resumo e calculo: campo estruturalmente inalcancavel e rotulos descartados

Severidade ALTA para o primeiro item, MEDIA para os demais. Provado.

`IMPOSTO A RESTITUIR` nunca pode ser lido. O rotulo e o valor sao impressos em rows DIFERENTES, com diferenca de 3 unidades, acima de `TOLERANCIA_LINHA = 2` (`importParsers.js:2416`):

```
p7 r27 y=456 | [x=15.0]IMPOSTO DEVIDO [x=323.0]IMPOSTO A RESTITUIR
p7 r28 y=453 | [x=552.4]0,00
```

(ESP-01; identico em `SAI-01` p8 e `AJU-01` p40.) A row do rotulo nao tem valor e a row do valor nao tem rotulo. `impostoDevido` nao tem a chave `impostoRestituir` em nenhum dos tres arquivos. Nas tres declaracoes de referencia o valor e 0,00, entao o dano so aparece numa declaracao com restituicao de verdade, mas o campo e inalcancavel por construcao.

Alem disso, a maior parte dos rotulos impressos nao tem campo de destino. Conferido linha a linha contra `p7` do ESP-01: no bloco RENDIMENTOS TRIBUTAVEIS, 5 dos 7 rotulos sao descartados; em DEDUCOES, 7 dos 10; no bloco IMPOSTO DEVIDO, 5 das 7 linhas do calculo (imposto devido, deducao de incentivo, imposto devido I, imposto devido RRA, aliquota efetiva); em IMPOSTO PAGO, os 8 componentes; em OUTRAS INFORMACOES da Evolucao Patrimonial, 12 dos 14. `QUOTA ÚNICA / Valor da quota` tambem nao e lido.

Como o catalogo declara a ficha do Resumo como `estruturada`, nenhum aviso e emitido.

## 4. O que foi verificado e esta CORRETO

Registrado porque resultado negativo tambem e resultado, e porque dois destes eram leads que pareciam defeito.

1. Renda variavel mensal, operacoes comuns e day-trade: correta campo a campo. Confronto integral de janeiro do titular (AJU-01 `p23 r5` a `r34`) contra `rendaVariavelMensalOficial[0]`: os 13 mercados, resultado liquido, base de calculo, prejuizo, aliquota (`15%` comuns, `20%` day-trade), imposto devido e os 9 campos da consolidacao do mes, todos batem, nas duas colunas.
2. As 13 entradas de `rendaVariavelMensalOficial` do AJU-01 estao CERTAS, e nao erradas: sao 12 meses do titular mais abril do dependente. Os outros 11 meses do dependente imprimem `Sem Informações` (`p35 r5,r7,r9,r42,r44` e `p36 r4,r6,r8,r10,r12,r14`) e corretamente nao viram lancamento.
3. Dividas do AJU-01: os dois lancamentos, incluindo a continuacao de discriminacao quebrada em duas rows (`SENTINELA` na row seguinte), foram extraidos corretos.
4. Bens do AJU-01: 7 bens extraidos, com a discriminacao de multiplas linhas remontada corretamente.
5. Dependentes e demonstrativo da Lei 14.754/2023: extraidos com todos os campos nos tres arquivos.
6. Ganho de capital de bem movel (operacao 2 do AJU-01), incluindo o detalhe de parcelas da alienacao a prazo: correto.

## 5. Ressalvas e limites desta auditoria

1. Divergencia entre o PDF AJU-01 e o XML da declaracao NAO foi tratada como defeito, conforme instruido. Nenhum achado deste relatorio compara PDF com XML.
2. Cobertura de refutacao desigual, e isso precisa ficar explicito. O painel de tres ceticos independentes so chegou a rodar sobre duas das oito areas (Bens, com 9 de 9 achados nao refutados, e Doacoes/Pagamentos, com 6 de 6 nao refutados), na lente de existencia literal. As demais areas foram reverificadas por mim, sessao unica, contra codigo e saida real. Os achados das secoes 3.1 a 3.9 acima sao os que reverifiquei pessoalmente na fonte; o apendice traz os demais no estado em que o auditor de area os deixou.
3. `AUDITORIA/rows-pdfjs/` reproduz `buildRows` por copia verbatim, nao por importacao: se `importParsers.js:2416,2425-2434` mudar, o dump precisa ser regerado.
4. Os tres PDFs sao dados sinteticos. Um layout que eles nao contenham nao foi exercitado, e esta marcado como tal em cada achado.

## Apendice. Todos os achados reportados pelos auditores de area

Estado da refutacao por achado. "cetico literal: nao refutado" significa que o painel de existencia literal
rodou e manteve o achado. "sem painel" significa que a rodada de refutacao nao chegou a rodar para aquela
area, por corte de limite de uso; nesses casos vale a reverificacao pessoal indicada nas secoes 3.x, quando houver.


### Bens e Direitos

Leitura do parser pelo auditor: Faixa executável: src/pages/importParsers.js linhas 3960-4056, dentro do laço de páginas de parsePDF (páginas a partir de 3600). Fluxo real, row por row: (1) 3961 — se a row tem as células exatas 'GRUPO' e 'DISCRIMINAÇÃO', monta bensAnchors (3968-3980) com findCellX de 'BEM', 'GRUPO', 'CÓDIGO' (default 95) e 'DISCRIMINAÇÃO'; val1/val2 vêm de células com formato dd/mm/aaaa na row SEGUINTE (3966), com defaults fixos 389/498 — e `continue`. (2) 3983 — sem âncoras, pula tudo. (3) 3984-3987 — row com célula exata 'TOTAL' fecha o bem corrente. (4) 3988-3989 — makeColumnPicker (2446) bucketa x por ponto médio entre âncoras; textInColumn (2459) concatena o texto de cada coluna. (5) 3990-4003 — se o texto da coluna 'grupo' casa /^\d{2}$/, abre um bem novo: grupo, codigo_bem, discriminacao via textoDaColunaDisc (2471, que estende a faixa até val1 aceitando o que não é valor monetário nem começa com rótulo), situacao_anterior=val1, situacao_atual=val2, e três constantes cravadas — localizacao '105', beneficiario 'Titular', cnpj ''. (6) 4004-4027 — qualquer outra row vira continuação da discriminação, salvo se linhaTemRotuloAEsquerdaDaDisc (2511) ou valorDeCampoNaColunaDisc (2564, lista fechada de 4 casos) barrarem. (7) 4033-4053 — CNPJ do bem só nas células com x menor que a âncora de DISCRIMINAÇÃO, via BEM_CNPJ (3257) e cnpjDoBem (3259). O fechamento final é 4932. isBensMetadataRow (2578) NÃO é chamada em nenhum ponto do fluxo.

**[bens-01] Titularidade (Titular/Dependente) é cravada como 'Titular' — o campo "Bem ou direito pertencente ao:" impresso no PDF nunca é lido**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:4000`
- Trecho: `localizacao: '105',             beneficiario: 'Titular',             cnpj: '',`
- Prova no PDF: AJU-01 — p9 r33 y=208 | [x=18.0]Bem ou direito pertencente ao: [x=134.0]Dependente [x=219.0]CPF: [x=239.0]333.444.555-08   (linha de metadados do bem "AJU BEM NUMERARIO DEPENDENTE", aberto em p9 r31 y=241 | [x=30.8]6 [x=65.5]06 [x=107.5]10 [x=137.0]AJU BEM NUMERARIO DEPENDENTE [x=393.4]1.609,59 [x=502.4]2.610,60). Busca de cobertura: `grep -n "pertencente" src/pages/importParsers.js` devolve APENA
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json, bens[6]: {"id":7,"grupo":"06","codigo_bem":"10","discriminacao":"AJU BEM NUMERARIO DEPENDENTE",...,"beneficiario":"Titular","cnpj":""} — e a chave cpf_beneficiario nem existe no objeto
- Saida esperada: bem id 7 (AJU BEM NUMERARIO DEPENDENTE) com beneficiario: "Dependente" e cpf_beneficiario: "33344455508"
- Consequencia: Bem de dependente é atribuído ao titular. O caminho .DBK lê isso corretamente (importParsers.js:705-706 `beneficiario: tipoBenefic === 'D' ? 'Dependente' : 'Titular'` e `cpf_beneficiario`), então importar por PDF e por .DBK a mesma declaração produz patrimônio com titularidade diferente. Em src/utils/exportXlsx.js:22-25 as colunas 'Beneficiário' e 'CPF do Beneficiário' saem sempre "Titular" e em branco, e o comentário do próprio exportXlsx diz que sem o CPF "a coluna Beneficiário não diz DE QUAL dependente se trata (achado 14)".

**[bens-02] País do bem cravado em '105' (Brasil) — a linha "249 - ESTADOS UNIDOS DA AMÉRICA" é ignorada e bem no exterior vira bem no Brasil**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:3999`
- Trecho: `situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),             localizacao: '105',             beneficiario: 'Titular',`
- Prova no PDF: AJU-01 — p9 r20 y=435 | [x=17.0]249 - ESTADOS UNIDOS DA AMÉRICA [x=399.0]Bem com usufruto: Não  (metadado do bem aberto em p9 r19 y=451 | [x=30.8]7 [x=65.5]04 [x=107.5]02 [x=137.0]AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA [x=391.2]11.711,61 [x=500.2]22.712,62). SAI-01 — p3 r20 y=501 | [x=17.0]249 - ESTADOS UNIDOS DA AMÉRICA [x=399.0]Bem com usufruto: Não (bem aberto em p3 r19). Busca de cobertura
- Saida observada: AJU-01.json bens[4]: {"discriminacao":"AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA ...","localizacao":"105"}; SAI-01.json bens[1]: {"discriminacao":"SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD ...","localizacao":"105"}
- Saida esperada: AJU bem "AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA" e SAI bem "SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD" com localizacao "249"
- Consequencia: Todo bem no exterior é importado como bem no Brasil. A coluna 'Localização' do exportXlsx (src/utils/exportXlsx.js:20 e 137) sai "105" para conta em dólar nos EUA, e qualquer segregação Brasil/exterior feita a partir desse campo fica errada — inclusive para a Lei 14.754/2023, cuja ficha o mesmo PDF traz.

**[bens-03] ESP-01: bloco de HERDEIROS do bem partilhado — nomes e percentuais (60,00 / 40,00) são perdidos em silêncio, e os CPFs mais o cabeçalho "CPF/CNPJ" contaminam a discriminação do bem**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:4023`
- Trecho: `const extra = linhaTemRotuloAEsquerdaDaDisc(row, pick) ? '' : textoDaColunaDisc(row, pick, bensAnchors);           if (extra && !valorDeCampoNaColunaDisc(extra)) {             currentBem.discriminacao = normSpace(currentBem.discriminacao + ' ' + extra).substring(0, 512);           }`
- Prova no PDF: ESP-01 — p3 r8 y=654 | [x=45.0]Nome [x=323.2]CPF/CNPJ [x=417.3]Percentual de participação (%) ESP-01 — p3 r9 y=639 | [x=45.0]ESP HERDEIRO UM [x=315.0]777.888.999-41 [x=465.5]60,00 ESP-01 — p3 r10 y=622 | [x=45.0]ESP HERDEIRO DOIS [x=315.0]888.999.000-78 [x=465.5]40,00 Âncoras montadas em p3 r4 (GRUPO x=17.0, CÓDIGO x=59.0, DISCRIMINAÇÃO x=101.0, sem coluna BEM; val1/val2 caem no default 389/498). 
- Saida observada: ESP-01.json bens[0].discriminacao = "ESP BEM PARTILHA SENTINELA CPF/CNPJ 777.888.999-41 888.999.000-78". Os nomes dos herdeiros e os percentuais 60,00/40,00 não aparecem em lugar nenhum do resultado. Os logs de ESP-01 trazem apenas "[undefined] Identificados 1 bens e direitos" — nenhum warning sobre
- Saida esperada: O bem "ESP BEM PARTILHA SENTINELA" com discriminacao limpa e os herdeiros preservados (ESP HERDEIRO UM 777.888.999-41 60,00%; ESP HERDEIRO DOIS 888.999.000-78 40,00%), ou, no mínimo, um aviso de ficha não lida como o que o parser emite para as fichas
- Consequencia: Numa declaração final de espólio a partilha é o dado central: quem recebe cada bem e em que percentual. Isso é perdido sem qualquer aviso, e o que sobra é uma discriminação suja com dois CPFs soltos e a palavra "CPF/CNPJ", que vai para a planilha e para a tela do bem. Como não há warning, o usuário não tem como saber que precisa conferir na declaração original.

**[bens-04] Cabeçalho do quadro de bens no exterior ("Lucros e Dividendos (R$)") é colado no fim da discriminação do bem**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2471`
- Trecho: `const textoDaColunaDisc = (row, pick, anchors) => {   const inicioDisc = anchors?.disc;   const limiteValores = anchors?.val1;   const partes = row.cells.filter(c => {     if (pick(c.x) === 'disc') return true;`
- Prova no PDF: AJU-01 — p9 r22 y=397 | [x=17.0]Aplicação Financeira (R$) [x=187.0]Lucros e Dividendos (R$) SAI-01 — p3 r22 y=463 | [x=17.0]Aplicação Financeira (R$) [x=187.0]Lucros e Dividendos (R$) Com âncoras disc=137 e val1=389 (defaults), a fronteira disc/val1 fica em 263: x=17 cai na coluna 'bem' e é descartado, x=187 cai em 'disc' e entra. Nenhuma das duas barreiras pega: linhaTemRotuloAEsquerdaDaDisc (251
- Saida observada: AJU-01.json bens[4].discriminacao = "AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA Lucros e Dividendos (R$)"; SAI-01.json bens[1].discriminacao = "SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD Lucros e Dividendos (R$)"
- Saida esperada: discriminacao = "AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA" (AJU) e "SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD" (SAI)
- Consequencia: Todo bem no exterior sai com um pedaço de cabeçalho de formulário grudado na descrição. Além do texto errado na planilha e na tela, isso muda o fingerprint do texto usado para reconciliar itens entre anos (fingerprintTextoPdf, importParsers.js:3264), fazendo o mesmo bem parecer outro se a versão do formulário mudar o rótulo.

**[bens-05] ESP-01: as colunas "SITUAÇÃO NA DATA DA PARTILHA" e "VALOR DE TRANSFERÊNCIA" são gravadas como saldo anterior e saldo atual**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:3997`
- Trecho: `situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),             situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),`
- Prova no PDF: ESP-01 — p3 r4 y=734 | [x=17.0]GRUPO [x=59.0]CÓDIGO [x=101.0]DISCRIMINAÇÃO [x=367.9]SITUAÇÃO NA DATA DA [x=523.5]VALOR DE ESP-01 — p3 r5 y=722 | [x=419.9]PARTILHA [x=496.4]TRANSFERÊNCIA ESP-01 — p3 r6 y=700 | [x=30.6]99 [x=72.5]99 [x=102.0]ESP BEM PARTILHA SENTINELA [x=389.0]123.401,41 [x=498.0]123.401,41 O cabeçalho do quadro na declaração final de espólio NÃO tem coluna "situação em 31/12 do ano
- Saida observada: ESP-01.json bens[0]: {"situacao_anterior":123401.41,"situacao_atual":123401.41}
- Saida esperada: O valor 123.401,41 identificado pelo que ele é (situação na data da partilha / valor de transferência), ou pelo menos um aviso de que a declaração final de espólio usa um quadro de colunas diferente
- Consequencia: O app passa a exibir um "saldo do ano anterior" de R$ 123.401,41 que a declaração não afirma, e a coluna 'Variação' do exportXlsx (src/utils/exportXlsx.js:19) calcula atual − anterior = 0 para um bem que na verdade é uma transferência por partilha. Numa declaração final de espólio, o quadro de bens é justamente a base da partilha; rotular a coluna errada corrompe a leitura patrimonial do exercício.

**[bens-06] O número do item (coluna BEM do quadro) é descartado — o id gerado não bate com o número que outras fichas do MESMO PDF usam para referenciar o bem**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:3993`
- Trecho: `currentBem = {             id: bemId++,             grupo: grupoTxt,             codigo_bem: textInColumn(row, pick, 'codigo'),`
- Prova no PDF: AJU-01 — p9 r19 y=451 | [x=30.8]7 [x=65.5]04 [x=107.5]02 [x=137.0]AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA [x=391.2]11.711,61 [x=500.2]22.712,62  (a primeira célula, x=30.8, é a coluna BEM ancorada em p9 r4 y=734 | [x=23.3]BEM ...; a ordem impressa em AJU-01 é 1, 2, 5, 4, 7, 3, 6). A âncora 'bem' é criada na linha 3975 (`bem: findCellX(row, 'BEM'),`) mas serve só para bucketar coluna: nenhum tex
- Saida observada: AJU-01.json bens[4] = {"id":5,"discriminacao":"AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA Lucros e Dividendos (R$)"}, enquanto AJU-01.json demonstrativoExteriorOficial = [{"bem":7,"tipo":"AF",...},{"bem":7,"tipo":"LD",...}]
- Saida esperada: O bem "AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA" preservando o número de item 7 do quadro, para casar com demonstrativoExteriorOficial
- Consequencia: O Demonstrativo da Lei 14.754/2023 lido do mesmo PDF aponta para "bem 7" e é exibido assim ao usuário (src/pages/RelatorioPage.jsx:282), mas na lista de bens esse bem tem id 5 e não existe nenhum bem 7. O cruzamento entre a ficha do exterior e o bem correspondente fica impossível de fazer automaticamente, e visualmente induz o usuário ao bem errado.

**[bens-07] Inscrição Municipal (IPTU), Matrícula e RENAVAM estão impressos no quadro de bens, o modelo do app tem os campos, e o parser de PDF não extrai nenhum deles**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:3992`
- Trecho: `currentBem = {             id: bemId++,             grupo: grupoTxt,             codigo_bem: textInColumn(row, pick, 'codigo'),             discriminacao: textoDaColunaDisc(row, pick, bensAnchors).substring(0, 512),             situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),   `
- Prova no PDF: AJU-01 — p8 r29 y=270 | [x=17.0]Inscrição Municipal (IPTU): AJU-IPTU-2101 AJU-01 — p8 r36 y=189 | [x=17.0]Matrícula: 11001 AJU-01 — p9 r10 y=643 | [x=17.0]RENAVAM: 26262603903 Busca de cobertura: `grep -n "matricula\|renavam\|inscricao_municipal" src/pages/importParsers.js` → RESULTADO VAZIO (0 linhas). Os mesmos nomes aparecem em src/components/BemModal.jsx:17,27,31 (campos do formulário do bem) 
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json — nenhum objeto de bens tem as chaves matricula, renavam ou inscricao_municipal; as únicas chaves são id, grupo, codigo_bem, discriminacao, situacao_anterior, situacao_atual, localizacao, beneficiario, cnpj, origemDocumento
- Saida esperada: bens[0] com matricula "11001" e inscricao_municipal "AJU-IPTU-2101"; bens[1] com renavam "26262603903"
- Consequencia: As colunas 'Inscrição Municipal', 'Matrícula' e 'RENAVAM' do exportXlsx saem sempre em branco quando a importação foi por PDF, e o usuário precisa redigitar à mão dado que estava impresso e já foi lido pelo pdf.js. Para imóvel e veículo é justamente o identificador único do bem entre exercícios.

**[bens-08] A detecção das âncoras das colunas de valor exige uma célula com data pura (dd/mm/aaaa) na linha seguinte ao cabeçalho — em ESP-01 e SAI-01 ela nunca casa e o parser cai nos x fixos 389/498**
- Severidade baixa, confianca do auditor: plausivel. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:3966`
- Trecho: `const dateCells = (nextRow ? nextRow.cells.filter(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.text.trim())) : [])             .sort((a, b) => a.x - b.x);`
- Prova no PDF: SAI-01 — p3 r4 y=734 | [x=23.3]BEM [x=53.0]GRUPO [x=95.0]CÓDIGO [x=137.0]DISCRIMINAÇÃO [x=361.6]SITUAÇÃO EM 31/12/2024 [x=472.9]SITUAÇÃO NA DATA DA SAI-01 — p3 r5 y=722 | [x=476.9]CARACTERIZAÇÃO DA   (nextRow: nenhuma célula bate /^\d{2}\/\d{2}\/\d{4}$/ — a data está EMBUTIDA na célula "SITUAÇÃO EM 31/12/2024" da própria linha do cabeçalho) ESP-01 — p3 r5 y=722 | [x=419.9]PARTILHA [x=496.4]TRANSFE
- Saida observada: Em ESP-01 e SAI-01 o parser usa val1=389 e val2=498 (defaults da linha 3978-3979). Nestes dois PDFs os números caíram do lado certo por coincidência — SAI-01 p3 r8 tem 0,00 em x=401.2 e 144.401,41 em x=498.0, ambos corretamente bucketados pela fronteira 443.5 —, então a saída real (situacao_anterior
- Saida esperada: val1/val2 ancorados nos x reais das colunas do documento (em SAI-01, 361.6 e 472.9)
- Consequencia: Nas duas declarações fora do ajuste anual o mapeamento das colunas de valor não é lido do documento: é adivinhado. Basta o quadro deslocar as colunas (formulário de outro exercício, página com coluna BEM ausente, valor mais largo alinhado à direita) para os dois saldos caírem no mesmo bucket ou trocarem de lado, sem nenhum sinal de erro. Não consegui produzir a troca com os três PDFs disponíveis, por isso a consequência fica como risco demonstrado, não como erro observado.

**[bens-09] isBensMetadataRow é código morto no caminho de produção, apesar do comentário do próprio bloco de bens afirmar que ela "continua como segunda barreira"**
- Severidade baixa, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:4020`
- Trecho: `// `isBensMetadataRow` continua como segunda barreira, para o caso           // em que o valor de um campo cai DENTRO da coluna de discriminação           // (o "Titular"/"Dependente" da coluna Beneficiário, já documentado           // lá), mas aplicado só ao texto dessa coluna.           const extr`
- Prova no PDF: Busca de cobertura: `grep -rn "isBensMetadataRow" src/` → src/pages/importParsers.js:2578 (a própria definição, `export const isBensMetadataRow = (row) => {`) e, fora dela, SOMENTE ocorrências em src/pages/importParsers.test.js (linhas 14, 1108, 1268, 1272-1275, 1289-1290, 1294-1296, 1300, 1304-1306, 1310-1311, 1314). Nenhuma chamada dentro de parsePDF. A barreira que de fato roda é valorDeCampoNa
- Saida observada: Nas três saídas em AUDITORIA/saida-parsepdf a discriminação foi filtrada exclusivamente por linhaTemRotuloAEsquerdaDaDisc + valorDeCampoNaColunaDisc; o resíduo "Lucros e Dividendos (R$)" (ver bens-04) e o "CPF/CNPJ 777.888.999-41 888.999.000-78" (ver bens-03) passaram porque nenhuma delas cobre esse
- Saida esperada: Ou a função é chamada no fluxo de bens, ou o comentário não deveria afirmar que ela é a segunda barreira ativa
- Consequencia: 14 asserções do arquivo de teste (importParsers.test.js:1268-1314) exercitam uma função que o parser nunca executa, criando confiança falsa de que a discriminação está protegida contra rótulos de formulário. Quem for corrigir bens-03/bens-04 tende a mexer em isBensMetadataRow, ver os testes passarem e não mudar nada no comportamento real.


### Dividas e Onus Reais

Leitura do parser pelo auditor: A ficha entra pelo gatilho da linha 3665 ("if (!pastRuralAnnex && rowHasCell(row, 'DÍVIDAS E ÔNUS REAIS'))"), que faz flush do currentDivida e seta section='dividas'. O bloco de extracao e 4058-4093. Em 4059-4069, ao ver uma row com as celulas exatas 'CÓDIGO' e 'DISCRIMINAÇÃO', monta dividasAnchors com 5 colunas: codigo=x de 'CÓDIGO' (23.0), disc=x de 'DISCRIMINAÇÃO' (114.8), val1=x da celula so-data na row SEGUINTE (300.5), val2=x da celula que casa /SITUAÇÃO EM \d{2}\/\d{2}\/\d{4}$/ na PROPRIA row de cabecalho (384.6) e pago=x de 'VALOR PAGO' (518.8). Todas as 5 colunas que o PDF imprime nesta ficha estao ancoradas — nao ha coluna impressa e nao ancorada, e nao ha coluna 'credor' no PDF (o credor vem dentro da DISCRIMINAÇÃO, e o modelo do app tambem nao tem campo credor: grep por 'credor' em src/ volta vazio). Em 4070 sai fora enquanto nao houver ancoras; em 4071-4074 a row 'TOTAL' fecha a divida corrente e os totais sao descartados. Em 4075-4088, makeColumnPicker bucketa cada celula pelo ponto medio entre ancoras vizinhas; se o texto da coluna codigo casar /^\d{1,3}$/ abre uma divida nova (codigo, discriminacao, situacao_anterior=val1, situacao_atual=val2, valor_pago=pago, todos os tres valores com joinChar=''), senao (4089-4092) concatena a row INTEIRA na discriminacao da divida corrente. Simulei o bloco com o codigo copiado verbatim e as rows reais do AJU-01 p10 r4-r9 e reproduzi exatamente a saida de AUDITORIA/saida-parsepdf/AJU-01.json (2 dividas, origem p10 linhas 7 e 9); ESP-01 e SAI-01 imprimem 'Sem Informações' e a saida real traz [] nos dois, corretamente. O defeito estrutural esta nas ancoras de valor: elas sao a borda ESQUERDA de rotulos largos, enquanto os numeros sao alinhados a direita dezenas de pontos mais a direita — a folga real medida no PDF e de 0,8pt (valor 6.805,75 em x=450.9 contra a fronteira val2|pago em 451.7).

**[dividas-01] Saldo em 31/12 do ano corrente abaixo de R$ 1.000,00 cai na coluna VALOR PAGO: situacao_atual vira 0 e valor_pago vira lixo**
- Severidade alta, confianca do auditor: plausivel. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4066`
- Trecho: `val2: findCellXRegex(row, /SITUAÇÃO EM \d{2}\/\d{2}\/\d{4}$/) ?? 385,             pago: findCellX(row, 'VALOR PAGO') ?? (nextRow && findCellXRegex(nextRow, /^EM \d{4}$/)) ?? 520, ... (4082-4083)             situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),             valor_pago: pa`
- Prova no PDF: ANCORAS (cabecalho real): p10 r4 y=752 | [x=23.0]CÓDIGO [x=114.8]DISCRIMINAÇÃO [x=292.9]SITUAÇÃO EM [x=384.6]SITUAÇÃO EM 31/12/2025 [x=518.8]VALOR PAGO  ||  MARGEM REAL DE 0,8pt: p10 r8 y=671 | [x=23.0]14 [x=72.0]CPF 222.333.444-05 - AJU DIV EMPRESTIMO PESSOAL [x=333.4]10.804,74 [x=450.9]6.805,75 [x=537.9]3.998,99  (fronteira val2|pago = (384.6+518.8)/2 = 451.7; o valor esta em x=450.9)  ||  METRI
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json traz dividas[0] situacao_atual=72802.72 / valor_pago=19003.73 e dividas[1] situacao_atual=6805.75 / valor_pago=3998.99 — corretos, porque nenhum valor desta ficha e menor que R$ 1.000,00. Simulando o codigo VERBATIM (makeColumnPicker/textInColumn/parseMoneyBR cop
- Saida esperada: Nas duas dividas do AJU-01 os valores sao todos >= R$ 1.000,00 e o PDF os imprime em x=446.4/450.9 (coluna SITUAÇÃO EM 31/12/2025) e x=533.4/537.9 (VALOR PAGO). Para uma divida quitada no ano o PDF imprimiria "0,00" em x≈466.4 na coluna de 31/12/2025
- Consequencia: Toda divida com saldo em 31/12 do ano corrente abaixo de R$ 1.000,00 — inclusive o caso mais comum de todos, a divida QUITADA no ano (0,00) — entra no app com situacao_atual=0 (por acaso certo no caso do 0,00, errado nos demais) e com valor_pago corrompido para um numero da ordem de milesimos. A coluna 'Valor Pago no Ano' da DividasPage e o cotejo pago x variacao de saldo (que e o teste de consistencia patrimonial do IRPF) ficam inutilizados, sem nenhum aviso ao usuario. Causa raiz: a ancora val2 e a borda ESQUERDA do rotulo largo 'SITUAÇÃO EM 31/12/2025' (x=384.6), a ~66pt de onde os numeros realmente comecam a ser impressos (x=446-451), enquanto a ancora val1 usa a celula so-data (x=300.5) e a de bens usa a data (x=498.0, p8 r24) — so a coluna val2 das dividas herda essa fronteira torta.

**[dividas-02] Saldo em 31/12 do ano anterior abaixo de R$ 1.000,00 cai na coluna do ano corrente: situacao_anterior vira 0 e situacao_atual recebe os dois valores concatenados**
- Severidade alta, confianca do auditor: plausivel. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4065`
- Trecho: `val1: (nextRow && findCellXRegex(nextRow, /^\d{2}\/\d{2}\/\d{4}$/)) ?? 300, ... (4081-4082)             situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),             situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),`
- Prova no PDF: ANCORAS: p10 r4 y=752 | [x=23.0]CÓDIGO [x=114.8]DISCRIMINAÇÃO [x=292.9]SITUAÇÃO EM [x=384.6]SITUAÇÃO EM 31/12/2025 [x=518.8]VALOR PAGO  +  p10 r5 y=741 | [x=300.5]31/12/2024 [x=529.0]EM 2025  (fronteira val1|val2 = (300.5+384.6)/2 = 342.55)  ||  VALORES REAIS DA COLUNA val1: p10 r6 y=697 | ... [x=333.4]91.801,71 ...  e  p10 r8 y=671 | ... [x=333.4]10.804,74 ...  e  p10 r9 y=652 | [x=23.0]TOTAL [x=
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json traz situacao_anterior=91801.71 e 10804.74 — corretos, porque os dois valores tem 9 glifos e caem em x=333.4, a 9,15pt a esquerda da fronteira 342.55. Na simulacao com o codigo VERBATIM e as ancoras reais, uma linha com "999,99" em x≈344.4 (val1) e "499,99" em x≈
- Saida esperada: Para uma divida contraida DENTRO do ano-calendario (saldo anterior 0,00) ou de valor pequeno, o PDF imprime "0,00" em x≈353.4 na coluna 31/12/2024, e o parser deveria devolver situacao_anterior=0 e situacao_atual com o valor da coluna seguinte.
- Consequencia: Divida nova no ano (saldo anterior 0,00) ou de saldo anterior inferior a R$ 1.000,00 e importada com situacao_anterior=0 e situacao_atual contaminada pela concatenacao das duas celulas (joinChar='' na linha 4082), produzindo um saldo atual inventado. Como a variacao patrimonial do app e calculada como situacao_atual - situacao_anterior (DividasPage.jsx:83), a variacao do passivo sai errada e contamina o demonstrativo do ano inteiro. Mesma causa raiz do dividas-01: as ancoras de valor sao bordas esquerdas de rotulo, nao a posicao real dos numeros alinhados a direita.

**[dividas-03] A ficha de Dividas nao usa o resgate de discriminacao justificada (textoDaColunaDisc) que a ficha de Bens usa: texto empurrado para alem de x=207.65 e descartado**
- Severidade media, confianca do auditor: nao-verificado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4080`
- Trecho: `discriminacao: textInColumn(row, pick, 'disc').substring(0, 512),`
- Prova no PDF: p10 r4 y=752 | [x=23.0]CÓDIGO [x=114.8]DISCRIMINAÇÃO [x=292.9]SITUAÇÃO EM [x=384.6]SITUAÇÃO EM 31/12/2025 [x=518.8]VALOR PAGO  ||  p10 r6 y=697 | [x=23.0]13 [x=72.0]CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO [x=333.4]91.801,71 [x=446.4]72.802,72 [x=533.4]19.003,73  — a coluna DISCRIMINAÇÃO comeca em x=72.0 e o texto pode ocupar visualmente ate ~x=290 (onde comeca o rotulo 'SITUAÇÃO EM'), mas 
- Saida observada: Nos tres PDFs auditados o defeito NAO se manifesta: as duas discriminacoes do AJU-01 vem numa celula unica em x=72.0, e a saida real traz 'CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO SENTINELA' e 'CPF 222.333.444-05 - AJU DIV EMPRESTIMO PESSOAL', ambas completas. ESP-01 e SAI-01 imprimem 'Sem In
- Saida esperada: Qualquer fragmento de texto da discriminacao que o pdf.js entregue como celula propria com x >= 207.65 deveria continuar na discriminacao. O proprio codigo reconhece esse defeito e o corrige na ficha de Bens: linha 3996 'discriminacao: textoDaColunaD
- Consequencia: Numa declaracao real com discriminacao longa e linha justificada (o cenario que o comentario das linhas 2471-2482 diz ter sido medido em Bens contra 172 bens reais, com a palavra 'PREMIOS' caindo em x≈304), o pedaco de texto que passa de x=207.65 e removido da discriminacao e jogado na coluna val1, onde vai ser concatenado (joinChar='') com o valor monetario antes do parseMoneyBR — que so descarta letras, nao digitos: um fragmento com numeros (numero de contrato, matricula) somado ao valor produziria um situacao_anterior de ordem de grandeza absurda. Nao consegui reproduzir a quebra de celula em nenhum dos tres PDFs sinteticos, entao marco como nao verificado; o que esta provado e literal e a assimetria de codigo entre 3996/4023 e 4080.


### Rendimentos

Leitura do parser pelo auditor: A area "rendimentos" no caminho PDF tem SO DOIS parsers, ambos dentro do laco de rows de parsePDF. (1) section 'rendimentosPJ' (gatilho 3834-3840 via RPJ_TITULO, corpo 4749-4804): reconhece a linha de item exigindo EXATAMENTE 5 valores monetarios (4779), mapeia posicionalmente por RPJ_COLUNAS (2817) = valor/previdencia/irrf/13o/irrf-13o, junta continuacao de nome sem valor (4788-4790), e a linha "CNPJ/CPF:" (4757-4771) fecha o item usando a posicao x do rotulo "CPF DO DEPENDENTE:" para separar o doc da fonte do doc do dependente; flushRpj na 3522. Funciona corretamente nos tres PDFs. (2) section 'rendimentosIsentosExclusiva' (gatilhos 3818 e 3824, corpo 4658-4747): linha agregada por RIE_AGREGADA (3244), linhas de detalhe iniciadas por "Titular"/"Dependente" (4671), layout alternativo com rotulo "Valor:"/"13º Salário:" (4716), e um ramo generico de continuacao (4739-4744); flushRie (3529-3580) grava um rendimento por detalhe, ou um so pelo agregado quando nao ha sub-tabela. Os valores saem certos (soma bate 45.523,70 dos isentos e 142.197,69 da exclusiva), mas os campos de TEXTO se corrompem. Fora disso: exigibilidade suspensa, RRA e PF/exterior (carne-leao) NAO tem parser nenhum — sao apenas capturados pela rede FICHAS_NAO_LIDAS (3053-3104), que compara titulo por igualdade exata e falha quando o pdfjs quebra o titulo em duas rows; nesse caso a linha cai no fechador generico /^(RENDIMENTOS|.../ da 3940, que zera a secao, e o conteudo se perde sem aviso. aplicarIrrfDecimoTerceiro (174-187) e chamada na 4995 e transporta o IRRF do 13o da ficha de PJ para os codigos exclusivos 0001/0008.

**[rend-01] Exigibilidade suspensa (titular e dependentes): valores caem fora, sem parser e sem aviso, porque o titulo quebra em duas linhas e a lista FICHAS_NAO_LIDAS usa igualdade exata**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3073`
- Trecho: `const FICHAS_NAO_LIDAS = [   ...   'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM EXIGIBILIDADE SUSPENSA)', ... const FICHAS_NAO_LIDAS_PREFIXO = [   'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE', ]; const nomeDaFi`
- Prova no PDF: p6 r5 y=702 | [x=17.0]RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM p6 r6 y=691 | [x=17.0]EXIGIBILIDADE SUSPENSA) [x=499.5](Valores em Reais) p6 r12 y=588 | [x=16.0]AJU EXI FONTE TITULAR [x=302.0]55.566.677/0001-83 [x=444.4]17.701,91 [x=531.9]7.702,92 p6 r14 y=539 | [x=17.0]RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM p6 r22 y
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: nenhum dos valores aparece (checagem: '17701.91' False, '7702.92' False, '8711.96' False, '3712.97' False em resultado.rendimentos); resultado.fichasNaoLidasComConteudo NAO contem as duas fichas; resultado.avisosImportacao NAO tem aviso algum sobre elas; e resul
- Saida esperada: Ou os rendimentos de exigibilidade suspensa (17.701,91 do titular e 8.711,96 do dependente, com depositos judiciais de 7.702,92 e 3.712,97) importados, ou — no minimo — a ficha listada em fichasNaoLidasComConteudo com o aviso 'tem informação nesta de
- Consequencia: O usuario perde silenciosamente 26.413,87 de rendimentos com imposto em discussao judicial e 11.415,89 de depositos judiciais, e ainda recebe a informacao FALSA de que a ficha 'não foi impressa no documento'. Como o app avisa no caminho .DBK e nao avisa no PDF, quem importar o PDF nao tem como suspeitar da falta.

**[rend-02] RRA dos dependentes: perdido em silencio quando o titulo quebra em duas linhas (a irma do titular, que nao quebra, e avisada)**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3075`
- Trecho: `'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR',   'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS DEPENDENTES',`
- Prova no PDF: p6 r37 y=136 | [x=17.0]RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS [x=493.5](Valores em Reais) p6 r38 y=122 | [x=17.0]DEPENDENTES p7 r3 y=768 | [x=17.0]RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS [x=493.5](Valores em Reais) p7 r7 y=702 | [x=16.0]AJU RRA DEPENDENTE AJUSTE [x=172.7]55.566.677/0001-83 [x=306.9]9.811,06 [x=386.5]812,07 [x=458
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: '9811.06' nao aparece em resultado.rendimentos; fichasNaoLidasComConteudo lista SO 'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR'; avisosImportacao idem; e estadoFichas['pdf:rra-dependentes'] = {estado:'ausente', motivo:'Esta 
- Saida esperada: A ficha do dependente deveria aparecer em fichasNaoLidasComConteudo e gerar aviso, exatamente como a do titular (cujo titulo cabe numa celula so: p6 r25 y=355 | [x=17.0]RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR)
- Consequencia: O RRA do dependente (9.811,06 tributavel, 812,07 de previdencia, 313,08 de pensao e 914,09 de IRRF) some sem rastro e o app declara que a ficha nao foi impressa. A mesma quebra de titulo pode atingir a ficha do titular em outro layout, e ai a perda vira total.

**[rend-03] Carne-leao (PF e do exterior, titular e dependentes) nao tem parser algum no caminho PDF**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3076`
- Trecho: `'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELO TITULAR',   'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELOS DEPENDENTES',`
- Prova no PDF: p3 r33 y=468 | [x=19.0]TOTAL [x=123.4]0,00 [x=245.9]6.624,84 [x=523.9]7.311,41 p3 r34 y=466 | [x=394.5]303,33 p3 r51 y=183 | [x=19.0]TOTAL [x=115.4]0,00 [x=327.5]305,35 [x=425.9]2.616,77 [x=535.5]918,80 p4 r38 y=182 | [x=20.0]TOTAL [x=122.4]0,00 [x=343.4]0,00 [x=436.5]403,63 [x=535.5]204,64 Prova de cobertura (grep vazio): grep -n "CARNÊ-LEÃO|Carnê-Leão|carneLeao|carne_leao" src/pages/importParser
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: '6624.84' False, '7311.41' False, '303.33' False, '918.8' False em resultado.rendimentos; as duas fichas ficam em fichasNaoLidasComConteudo com aviso; so o agregado chega, via pagina RESUMO, em impostoDevido.rendimentosPfExteriorTitular=14239.58 e rendimentosPfE
- Saida esperada: Os rendimentos mes a mes de PF/exterior do titular (alugueis 6.624,84, outros 303,33, exterior 7.311,41) e do dependente, com as deducoes (pensao 305,35, livro caixa 2.616,77) e o carne-leao pago por DARF 0190 (918,80 do titular e 204,64 do dependent
- Consequencia: A tela de Rendimentos fica sem nenhum lancamento de carne-leao, e o app nao guarda mes, natureza (trabalho nao assalariado / alugueis / outros / exterior) nem o DARF pago. Importar a MESMA declaracao por .DBK produz esses rendimentos; importar por PDF nao. O aviso existe, entao a perda e visivel, mas o dado nao e recuperavel dentro do app.

**[rend-04] RRA do titular impresso com todo o detalhe (fonte, pensao, opcao de tributacao, numero de meses) e nada e extraido**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3074`
- Trecho: `'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR',`
- Prova no PDF: p6 r29 y=290 | [x=16.0]AJU RRA TITULAR EXCLUSIVA [x=172.7]55.566.677/0001-83 [x=302.4]31.801,01 [x=380.9]3.802,02 [x=452.9]1.803,03 [x=537.9]4.804,04 p6 r33 y=203 | [x=17.0]OPÇÃO DE TRIBUTAÇÃO: [x=126.0]Exclusiva [x=180.0]MÊS [x=262.0]Dez. [x=333.0]Valor Recebido [x=407.0]0,00 [x=489.0]NÚM. MESES: [x=547.0]11,0 Prova de cobertura (grep vazio): grep -n "ACUMULADAMENTE|acumuladamente" src/pages/impo
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: '31801.01' nao aparece em resultado.rendimentos; nenhum registro com tipo 'tributavel_rra'. So o total da linha 07 da ficha de exclusiva entra (exclusivo_0007, valor 21.391,92, id 13), sem fonte pagadora e sem numero de meses.
- Saida esperada: Um rendimento tipo 'tributavel_rra' com nome_fonte 'AJU RRA TITULAR EXCLUSIVA', CNPJ 55.566.677/0001-83, valor 31.801,01, previdencia 3.802,02, pensao 1.803,03 e IRRF 4.804,04 — que e exatamente o que o caminho .DBK produz (importParsers.js:819 tipo:
- Consequencia: O RRA fica sem fonte pagadora, sem CNPJ, sem contribuicao previdenciaria, sem pensao, sem IRRF e sem o numero de meses — dados que sao justamente os que permitem conferir a tributacao propria do RRA. Ha aviso, mas o import por PDF entrega menos que o import por .DBK da mesma declaracao.

**[rend-05] Continuacao do CABECALHO da sub-tabela ('Pagadora' / 'Pagadora') e absorvida como continuacao da DESCRICAO do codigo**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4743`
- Trecho: `if (valores.length === 0 && rieGrupo) {           const texto = normSpace(cells.map(c => c.t).join(' '));           if (!texto) continue;           const ultimo = rieGrupo.detalhes[rieGrupo.detalhes.length - 1];           if (ultimo) ultimo.nome = normSpace(`${ultimo.nome} ${texto}`);           else`
- Prova no PDF: p5 r10 y=600 | [x=17.0]99. Outros [x=537.9]7.012,51 p5 r11 y=582 | [x=42.1]Beneficiário [x=137.5]CPF [x=188.5]CPF/CNPJ da Fonte [x=294.9]Nome da Fonte [x=397.2]Descrição [x=508.3]Valor p5 r12 y=571 | [x=207.7]Pagadora [x=305.2]Pagadora
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json, ids 6, 7 e 18: "descricao_ficha": "Outros Pagadora Pagadora".
- Saida esperada: descricao_ficha = "Outros". A linha r11 e barrada pela guarda da 4662 (rowHasCell 'Beneficiário' && rowHasCell 'Valor'), mas a SEGUNDA linha do mesmo cabecalho (r12) nao tem nem 'Beneficiário' nem 'Valor' e escapa da guarda.
- Consequencia: Todo rendimento do codigo 99 (isento e exclusiva) fica rotulado 'Outros Pagadora Pagadora' na tela e em qualquer relatorio/exportacao. O valor esta certo, o rotulo e lixo, e o mesmo mecanismo poluiria a descricao de qualquer codigo cujo cabecalho de sub-tabela quebre em duas linhas.

**[rend-06] Colunas 'Nome da Fonte Pagadora' e 'Descricao' sao concatenadas num campo so, e a quebra de linha intercala os pedacos**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4678`
- Trecho: `const nome = normSpace(cells             .filter(c => c !== cells[0] && c !== cpf && c !== cnpj && c !== ultimoValor)             .map(c => c.t).join(' '));`
- Prova no PDF: p5 r13 y=553 | [x=48.4]Titular [x=119.5]111.444.777-35 [x=192.7]55.566.677/0001-83 [x=290.1]AJU ISE GANHO [x=384.1]AJU ISE GANHO [x=495.9]5.505,75 p5 r14 y=542 | [x=306.1]ISENTO [x=400.1]ISENTO p5 r40 y=54 | [x=40.7]Dependente [x=122.5]333.444.555-08 [x=195.7]55.566.677/0001-83 [x=307.1]AJU EXC [x=401.1]AJU EXC [x=505.5]604,84 p6 r3 y=771 | [x=296.7]DEPENDENTE [x=390.7]DEPENDENTE
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json id 6: "nome_fonte": "AJU ISE GANHO AJU ISE GANHO ISENTO ISENTO"; id 7: "AJU ISE AJU ISE DEPENDENTE DEPENDENTE DETALHE DETALHE"; id 18: "AJU EXC AJU EXC DEPENDENTE DEPENDENTE".
- Saida esperada: nome_fonte = "AJU ISE GANHO ISENTO" (coluna Nome da Fonte Pagadora, x~290-306) e um campo separado descricao = "AJU ISE GANHO ISENTO" (coluna Descrição, x~384-400). O parser tem findCellX/makeColumnPicker disponiveis (2437-2438) mas nao usa ancora de
- Consequencia: O nome da fonte pagadora fica ilegivel e duplicado sempre que o codigo 99 (unico com coluna 'Descrição') tem nome longo, e a descricao do rendimento — que e o que identifica o item para a Receita — nao existe como campo. Nao da para casar a fonte por CNPJ+nome nem exibir a origem corretamente.

**[rend-07] CPF/CNPJ do doador (codigo 14) vai para dentro do nome, e cnpj_fonte fica vazio, porque o parser so procura o PRIMEIRO CPF da linha**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4672`
- Trecho: `const cpf = cells.find(c => RIE_CPF.test(c.t));           const cnpj = cells.find(c => RIE_CNPJ.test(c.t));`
- Prova no PDF: p5 r8 y=662 | [x=45.1]Beneficiário [x=140.5]CPF [x=192.4]CPF/CNPJ do Doador/Espólio [x=335.8]Nome do Doador/Espólio [x=506.2]Valor p5 r9 y=636 | [x=51.4]Titular [x=122.5]111.444.777-35 [x=213.5]222.333.444-05 [x=312.9]AJU ISE DOACAO RECEBIDA [x=495.4]14.504,74
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json id 5: "cnpj_fonte": "", "nome_fonte": "222.333.444-05 AJU ISE DOACAO RECEBIDA".
- Saida esperada: cpf do beneficiario = 111.444.777-35 (coluna 'CPF', x=122.5), documento do doador = 222.333.444-05 (coluna 'CPF/CNPJ do Doador/Espólio', x=213.5) num campo proprio, e nome_fonte = "AJU ISE DOACAO RECEBIDA".
- Consequencia: O CPF de quem doou fica colado no nome, sem campo consultavel, e o documento da fonte fica vazio. Numa linha de DEPENDENTE nessa mesma ficha o efeito e pior: cells.find pegaria um dos dois CPFs pela ordem de x, e o outro cairia no nome (nao verificavel nestes tres PDFs, que nao trazem esse caso).

**[rend-08] 13o salario RECEBIDO PELOS DEPENDENTES (codigo 08) e gravado com beneficiario 'Titular' fixo**
- Severidade baixa, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3574`
- Trecho: `if (g.valorAgregado !== 0) {       rendimentos.push({         ...base,         id: rendId++,         cnpj_fonte: '',         nome_fonte: '',         beneficiario: 'Titular',         cpf_dependente: null,         valor: g.valorAgregado,       });`
- Prova no PDF: p5 r29 y=258 | [x=17.0]08. 13º salário recebido pelos dependentes [x=525.9]1.205,25
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json id 14: {"tipo":"exclusivo_0008","descricao_ficha":"13º salário recebido pelos dependentes","beneficiario":"Titular","cpf_dependente":null,"valor":1205.25,"irrf":105.26}.
- Saida esperada: Um rendimento exclusivo_0008 com beneficiario 'Dependente' (a propria descricao impressa diz 'recebido pelos dependentes'), ligado ao dependente cujo 13o foi 1.205,25 (o mesmo valor do campo '13º SALÁRIO' da ficha de PJ dos dependentes: p2 r12 y=607 
- Consequencia: Qualquer separacao por beneficiario (tela de Rendimentos, filtro por dependente, relatorio por pessoa) soma no titular 1.205,25 que sao do dependente. O log da 4973 ('X do titular ... e Y de dependentes') herda o mesmo erro. O valor total nao muda; a atribuicao por pessoa, sim.


### Pagamentos e Doacoes (auditor A)

Leitura do parser pelo auditor: Pagamentos Efetuados (linhas 4095-4143 de src/pages/importParsers.js): o titulo 'PAGAMENTOS EFETUADOS' (gatilho 3670) abre section='pagamentos'; a row de cabecalho ('CÓD.' + /NOME DO BENEFICIÁRIO/) monta pagAnchors com 5 colunas via findCellX/findCellXRegex (4101-4105); enquanto pagAnchors for null tudo e descartado (4106). Depois: row com 'TOTAL' fecha o item; row com 'Descrição:' concatena a descricao; row com /^Dependente:/ e pulada (4118); nas demais, makeColumnPicker bucketa cada celula pela coluna mais proxima e, se a coluna 'codigo' casar /^\\d{1,3}$/ e houver valor, cria o pagamento (4123-4136); senao, o texto da coluna 'nome' e concatenado ao nome do item corrente. Nos 3 PDFs isso produziu exatamente os 8 pagamentos do AJU-01, com codigo, nome, cpf/cnpj, valor pago, parcela nao dedutivel e descricao todos corretos, e 0 em ESP-01/SAI-01 ('Sem Informações', sem cabecalho, pagAnchors null). As 4 fichas de Doacao usam processDoacaoRow (2621-2654), copia do bloco acima com UMA coluna de valor so, e dependem de isDoacaoHeaderRow (2609), que exige 'CÓD.' + 'NOME DO BENEFICIÁRIO' — condicao que so o cabecalho de DOACOES EFETUADAS satisfaz; as outras tres fichas ficam sem ancora e perdem tudo (2623). O despacho por secao esta em 4911-4913.

**[pagdoa-01] Ficha "Doações a partidos políticos e candidatos" é perdida por inteiro: o cabeçalho real (NOME | CNPJ | VALOR) não casa com isDoacaoHeaderRow, que exige "CÓD." + "NOME DO BENEFICIÁRIO"**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:2609`
- Trecho: `const isDoacaoHeaderRow = (row) => rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text)); const buildDoacaoAnchors = (row) => ({   codigo: findCellX(row, 'CÓD.'),   nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,   cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?`
- Prova no PDF: p10 r10 y=631 | [x=17.0]DOAÇÕES A PARTIDOS POLÍTICOS E CANDIDATOS A CARGOS ELETIVOS [x=493.5](Valores em Reais) p10 r11 y=613 | [x=18.0]NOME [x=272.0]CNPJ [x=538.9]VALOR p10 r12 y=594 | [x=18.0]AJU ELEITORAL SENTINELA [x=272.0]55.566.677/0001-83 [x=534.9]1.201,44 p10 r13 y=573 | [x=21.0]TOTAL [x=534.9]1.201,44
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "doacoesPartidosOficial": []  e log "[undefined] Identificadas 0 doações a partidos políticos e candidatos". estadoFichas["pdf:doacoes-eleitorais"] = {"estado":"erro","motivo":"A ficha foi localizada no PDF, mas o parser não comprovou que estava vazia nem estrut
- Saida esperada: 1 doação a partido/candidato: nome "AJU ELEITORAL SENTINELA", CNPJ 55.566.677/0001-83, valor 1201,44 (total confere: 1.201,44)
- Consequencia: A detecção acerta (a ficha é registrada em fichasPdfObservadas na p.10) e a seção é aberta pelo gatilho da linha 3686, mas a linha de cabeçalho real desta ficha é "NOME | CNPJ | VALOR" — sem célula "CÓD." e sem "NOME DO BENEFICIÁRIO". isDoacaoHeaderRow retorna false, st.anchors continua null e a linha 2623 (`if (!st.anchors) return;`) descarta a linha do item. O contribuinte perde silenciosamente a doação eleitoral inteira na importação por PDF.

**[pagdoa-02] Fichas "Doações diretamente na declaração - ECA" e "- Pessoa Idosa" também são perdidas por inteiro: cabeçalho real é TIPO DE FUNDO | FUNDO | CNPJ | VALOR**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:2623`
- Trecho: `const isDoacaoHeaderRow = (row) => rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text)); ...   if (isDoacaoHeaderRow(row)) { st.anchors = buildDoacaoAnchors(row); return; }   if (!st.anchors) return;`
- Prova no PDF: p38 r46 y=133 | [x=17.0]DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - ECA [x=493.5](Valores em Reais) p38 r47 y=113 | [x=16.0]TIPO DE FUNDO [x=97.0]FUNDO [x=408.8]CNPJ [x=535.7]VALOR p38 r48 y=90 | [x=37.0]Municipal [x=97.0]SP - SÃO PAULO - SAO PAULO [x=380.2]97.537.776/0001-87 [x=542.5]301,45 p39 r3 y=768 | [x=17.0]DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - PESSOA IDOSA [x=493.5](Valores em Reais) p39 r4 y=748 | 
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "doacoesEcaIdosoOficial": [] e log "[undefined] Identificadas 0 doações diretamente na declaração (ECA/pessoa idosa)". estadoFichas["pdf:doacoes-eca"] e ["pdf:doacoes-idoso"] = estado "erro" (paginaInicio 38/39).
- Saida esperada: 2 doações: ECA {categoria:'eca', esferaFundo:'Municipal', uf/municipio 'SP - SÃO PAULO - SAO PAULO', cpf_cnpj 97537776000187, valor 301,45} e Pessoa Idosa {categoria:'idoso', esferaFundo:'Estadual', 'SP - SÃO PAULO', cpf_cnpj 17087890000113, valor 30
- Consequencia: O layout dessas duas fichas não tem coluna de código nem "NOME DO BENEFICIÁRIO" (o beneficiário é um FUNDO, identificado por esfera/UF/município), então processDoacaoRow nunca ancora as colunas e descarta todas as linhas. Perde-se a doação incentivada, que é dedução direta do imposto devido; ainda por cima o parser não tem nenhum campo para TIPO DE FUNDO / FUNDO, que o PDF imprime.

**[pagdoa-03] Em "Doações efetuadas" a coluna PARC. NÃO DEDUTÍVEL não é ancorada: o valor dela cai dentro da coluna 'valor' e é concatenado ao valor doado**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:2610`
- Trecho: `const buildDoacaoAnchors = (row) => ({   codigo: findCellX(row, 'CÓD.'),   nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,   cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?? 254,   valor: findCellXRegex(row, /^VALOR/) ?? 431, }); ...   const valorTxt = textInColumn(row, pick, 'valor', ''); .`
- Prova no PDF: p8 r15 y=522 | [x=17.0]CÓD. [x=57.5]NOME DO BENEFICIÁRIO [x=318.5]CPF/CNPJ DO [x=425.0]VALOR PAGO [x=505.3]PARC. NÃO p8 r16 y=510 | [x=316.7]BENEFICIÁRIO [x=504.8]DEDUTÍVEL p8 r17 y=489 | [x=17.0]80 [x=55.0]AJU DOA PESSOA FISICA [x=316.0]222.333.444-05 [x=447.0]7.101,41 [x=537.5]0,00
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: {"id":1,"codigo":"80","nome_beneficiario":"AJU DOA PESSOA FISICA","cpf_cnpj":"22233344405","valor":7101.41,"descricao":""} — sem nenhum campo parcela_nao_dedutivel. Simulação com os helpers copiados verbatim (normSpace/findCellX/findCellXRegex/makeColumnPicker/t
- Saida esperada: {codigo:'80', valor: 7101.41, parcela_nao_dedutivel: 0} — mesmo formato que o caminho .DBK produz (importParsers.js:1048 grava parcela_nao_dedutivel para a doação tipo 90).
- Consequencia: Dois defeitos na mesma linha: (a) a parcela não dedutível/valor reembolsado das doações é jogada fora, ainda que o modelo já tenha o campo pelo .DBK; (b) o valor doado só sai certo por acidente aritmético — em qualquer declaração em que a coluna PARC. NÃO DEDUTÍVEL não seja 0,00, o valor da doação sai corrompido (7101.41101 em vez de 7101.41), sem nenhum erro visível.

**[pagdoa-04] Em Pagamentos Efetuados o parser descarta os marcadores de titularidade "Titular" / "Dependente: <nome>" / "Alimentando: <nome>", perdendo a quem cada pagamento pertence**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:4118`
- Trecho: `if (row.cells.some(c => /^Dependente:/.test(c.text.trim()))) continue;         const pick = makeColumnPicker(pagAnchors);         const codigoTxt = textInColumn(row, pick, 'codigo');`
- Prova no PDF: p7 r29 y=298 | [x=16.0]Titular p7 r40 y=84 | [x=16.0]Dependente: AJU PES DEPENDENTE UM p8 r10 y=626 | [x=16.0]Alimentando: AJU PES ALIMENTANDO UM p8 r11 y=610 | [x=17.0]30 [x=53.0]AJU PES ALIMENTANDO UM [x=254.0]444.555.666-19 [x=452.0]6.006,28 [x=549.5]0,00
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: os 8 objetos de pagamentos têm exatamente as chaves id, codigo, nome_beneficiario, cpf_cnpj, valor_pago, parcela_nao_dedutivel, descricao, data, origemDocumento. Nenhum campo de titular/dependente/alimentando. Ex.: {"id":7,"codigo":"01","nome_beneficiario":"AJU 
- Saida esperada: Cada pagamento deveria carregar a titularidade impressa no PDF: itens 10/21/60/36/99 = Titular; itens 11 e 01 = Dependente AJU PES DEPENDENTE UM; item 30 = Alimentando AJU PES ALIMENTANDO UM.
- Consequencia: A linha 4118 pula a row de agrupamento com `continue` e a de "Alimentando:" nem guard tem (cai no ramo genérico e é ignorada por estar na faixa da coluna 'codigo'). Sem essa marcação não dá para aplicar o limite anual de instrução por dependente, nem separar pensão alimentícia judicial por alimentando, nem conferir a dedução de dependente — o usuário tem de voltar ao PDF para saber de quem é cada despesa.

**[pagdoa-05] A perda das 3 fichas de doação é silenciosa: nenhum aviso é gerado, e o único aviso emitido diz o contrário do que aconteceu**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:5118`
- Trecho: `if (doacoesEfetuadas.length > 0 || doacoesPartidos.length > 0 || doacoesEcaIdoso.length > 0) {     const aviso = 'As doações lidas deste PDF usam um layout de tabela extrapolado, que nunca pôde ser conferido contra uma declaração com doação real. Pelo arquivo .DBK essas fichas têm layout oficial: im`
- Prova no PDF: p10 r12 y=594 | [x=18.0]AJU ELEITORAL SENTINELA [x=272.0]55.566.677/0001-83 [x=534.9]1.201,44 p38 r48 y=90 | [x=37.0]Municipal [x=97.0]SP - SÃO PAULO - SAO PAULO [x=380.2]97.537.776/0001-87 [x=542.5]301,45 p39 r5 y=725 | [x=38.5]Estadual [x=97.0]SP - SÃO PAULO [x=380.2]17.087.890/0001-13 [x=542.5]302,46
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "fichasNaoLidasComConteudo" lista só as 9 fichas de rendimentos PF/exterior e do anexo rural — nenhuma das 3 fichas de doação perdidas. "avisosImportacao" traz esses 9 avisos mais, no fim, o texto 'As doações lidas deste PDF usam um layout de tabela extrapolado.
- Saida esperada: avisosImportacao deveria nomear as 3 fichas de doação que estavam preenchidas no PDF e saíram vazias (1.201,44 + 301,45 + 302,46), como já é feito no loop de fichasNaoLidasComConteudo (linhas 4997-4999).
- Consequencia: O único aviso relacionado a doações sugere que as doações FORAM lidas e só precisariam de conferência, quando na verdade 3 das 4 fichas não trouxeram nada. Pior: o `if` só dispara porque doacoesEfetuadas tem 3 itens — numa declaração que só tenha doação eleitoral e/ou ECA/idoso, os três arrays ficam vazios e nem esse aviso sai: importação silenciosamente incompleta.

**[pagdoa-06] O guard de linha de agrupamento cobre só /^Dependente:/; "Alimentando:" e "Titular" caem no ramo genérico de continuação de nome**
- Severidade baixa, confianca do auditor: nao-verificado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:4118`
- Trecho: `if (row.cells.some(c => /^Dependente:/.test(c.text.trim()))) continue;         ...         } else if (currentPag) {           const extra = textInColumn(row, pick, 'nome');           if (extra) currentPag.nome_beneficiario = normSpace(currentPag.nome_beneficiario + ' ' + extra);         }`
- Prova no PDF: p8 r10 y=626 | [x=16.0]Alimentando: AJU PES ALIMENTANDO UM
- Saida observada: Neste PDF o dano não ocorre: a row tem uma única célula em x=16.0, e com pagAnchors {codigo:17, nome:57.5, ...} a fronteira codigo/nome é 37.25, então x=16 cai em 'codigo' e textInColumn(...,'nome') volta ''. A saída real confirma: item id 7 fica "AJU PAG ESCOLA DEP", sem sufixo. Não consegui provar
- Saida esperada: A linha de agrupamento não deveria alcançar o ramo `else if (currentPag)` que concatena texto no nome do beneficiário anterior.
- Consequencia: Risco latente: se em outra declaração o rótulo "Alimentando:" e o nome vierem em células separadas (como já acontece com "NOME:"/"CPF:" no cabeçalho de página), o nome do alimentando seria concatenado ao nome do beneficiário do pagamento anterior. Reportado como não verificado por não haver row de prova nos PDFs auditados.


### Pagamentos e Doacoes (auditor B)

Leitura do parser pelo auditor: Pagamentos (linhas 4095-4143, dentro do laço de rows iniciado em 3600): o título "PAGAMENTOS EFETUADOS" (gatilho 3670-3674) liga section='pagamentos'. A linha de cabeçalho é reconhecida em 4096 (célula exata 'CÓD.' + regex /NOME DO BENEFICIÁRIO/) e monta pagAnchors com 5 âncoras x (codigo, nome, cpfcnpj, valorPago via /^VALOR PAGO$/, parcNao via /^PARC\. NÃO$/). Sem âncora, tudo é descartado (4106) — é assim que ESP-01 e SAI-01, que só imprimem "Sem Informações" (ESP p2 r31, SAI p2 r33), voltam com 0 pagamentos. Depois: 'TOTAL' fecha o item (4107), 'Descrição:' concatena a descrição no item aberto (4111), linhas que começam com "Dependente:" são puladas (4118), e a linha de item é aceita quando a coluna codigo casa /^\d{1,3}$/ e há texto na coluna valorPago (4122). makeColumnPicker (2446-2458) bucketa cada célula pela âncora mais próxima à esquerda, com fronteiras no ponto médio. Isso reproduz exatamente os 8 pagamentos do AJU-01 (5 na p7, 3 na p8), com valor e parcela não dedutível corretos. Doações (2601-2654, despacho 4911-4913): processDoacaoRow usa o MESMO formato de cabeçalho de Pagamentos, com só 4 âncoras (sem parcNao) e valor por /^VALOR/. Isso funciona para DOAÇÕES EFETUADAS (p8 r15, mesmo layout CÓD./NOME DO BENEFICIÁRIO), mas as outras três fichas de doação do AJU-01 têm layout diferente (NOME/CNPJ/VALOR nas eleitorais; TIPO DE FUNDO/FUNDO/CNPJ/VALOR no ECA e Pessoa Idosa), o cabeçalho não casa, st.anchors fica null e o `return` da linha 2623 descarta todas as linhas dessas fichas.

**[doacoes-01] Ficha "Doações a partidos políticos e candidatos" é disparada mas nunca lida: o cabeçalho real é NOME/CNPJ/VALOR e isDoacaoHeaderRow exige 'CÓD.' + 'NOME DO BENEFICIÁRIO'**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2609`
- Trecho: `const isDoacaoHeaderRow = (row) => rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text)); ... const processDoacaoRow = (st, row) => {   if (isDoacaoHeaderRow(row)) { st.anchors = buildDoacaoAnchors(row); return; }   if (!st.anchors) return;`
- Prova no PDF: p10 r11 y=613 | [x=18.0]NOME [x=272.0]CNPJ [x=538.9]VALOR  ||  p10 r12 y=594 | [x=18.0]AJU ELEITORAL SENTINELA [x=272.0]55.566.677/0001-83 [x=534.9]1.201,44  ||  p10 r13 y=573 | [x=21.0]TOTAL [x=534.9]1.201,44
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json -> resultado.doacoesPartidosOficial = []  e log "Identificadas 0 doações a partidos políticos e candidatos". estadoFichas['pdf:doacoes-eleitorais'] = {"estado":"erro","presenca":"indeterminada","motivo":"A ficha foi localizada no PDF, mas o parser não comprovou q
- Saida esperada: doacoesPartidosOficial com 1 item: nome "AJU ELEITORAL SENTINELA", CNPJ 55566677000183, valor 1201.44 (total impresso 1.201,44).
- Consequencia: A doação eleitoral de R$ 1.201,44 some por completo na importação por PDF. Nenhum aviso em avisosImportacao aponta essa perda (a lista de avisos tem 10 itens e nenhum cita as doações eleitorais); o usuário só veria o estado "erro" da ficha. Além do cabeçalho, o modelo de item (codigo/nome/cpf_cnpj/valor) não cabe nesta ficha, que não tem coluna CÓD.

**[doacoes-02] Ficha "Doações diretamente na declaração - ECA" nunca é lida: cabeçalho real é TIPO DE FUNDO/FUNDO/CNPJ/VALOR e a linha de item não tem código numérico**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2622`
- Trecho: `if (isDoacaoHeaderRow(row)) { st.anchors = buildDoacaoAnchors(row); return; }   if (!st.anchors) return; ...   const codigoTxt = textInColumn(row, pick, 'codigo');   const valorTxt = textInColumn(row, pick, 'valor', '');   if (/^\d{1,3}$/.test(codigoTxt) && valorTxt) {`
- Prova no PDF: p38 r47 y=113 | [x=16.0]TIPO DE FUNDO [x=97.0]FUNDO [x=408.8]CNPJ [x=535.7]VALOR  ||  p38 r48 y=90 | [x=37.0]Municipal [x=97.0]SP - SÃO PAULO - SAO PAULO [x=380.2]97.537.776/0001-87 [x=542.5]301,45  ||  p38 r49 y=69 | [x=21.0]TOTAL [x=545.5]301,45
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json -> resultado.doacoesEcaIdosoOficial = []  e log "Identificadas 0 doações diretamente na declaração (ECA/pessoa idosa)". estadoFichas['pdf:doacoes-eca'] = {"estado":"erro","presenca":"indeterminada"}.
- Saida esperada: doacoesEcaIdosoOficial com 1 item categoria 'eca': fundo "SP - SÃO PAULO - SAO PAULO", tipo "Municipal", CNPJ 97537776000187, valor 301.45.
- Consequencia: Perde-se uma doação DEDUTÍVEL (ECA, dedução direta no imposto devido) de R$ 301,45. Falha dupla: o cabeçalho não casa (sem 'CÓD.'/'NOME DO BENEFICIÁRIO') e, mesmo que casasse, a coluna 1 traz "Municipal", que não passa em /^\d{1,3}$/. Nenhum aviso em avisosImportacao cita a perda.

**[doacoes-03] Ficha "Doações diretamente na declaração - Pessoa Idosa" nunca é lida: mesmo cabeçalho TIPO DE FUNDO/FUNDO/CNPJ/VALOR**
- Severidade alta, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2623`
- Trecho: `if (!st.anchors) return;`
- Prova no PDF: p39 r4 y=748 | [x=16.0]TIPO DE FUNDO [x=97.0]FUNDO [x=408.8]CNPJ [x=535.7]VALOR  ||  p39 r5 y=725 | [x=38.5]Estadual [x=97.0]SP - SÃO PAULO [x=380.2]17.087.890/0001-13 [x=542.5]302,46  ||  p39 r6 y=704 | [x=21.0]TOTAL [x=545.5]302,46
- Saida observada: resultado.doacoesEcaIdosoOficial = [] (mesmo array vazio do achado doacoes-02). estadoFichas['pdf:doacoes-idoso'] = {"estado":"erro","presenca":"indeterminada"}.
- Saida esperada: doacoesEcaIdosoOficial com 1 item categoria 'idoso': tipo "Estadual", fundo "SP - SÃO PAULO", CNPJ 17087890000113, valor 302.46.
- Consequencia: Perde-se a doação DEDUTÍVEL ao Fundo da Pessoa Idosa de R$ 302,46. Somada ao ECA, a importação por PDF deixa de trazer R$ 603,91 de dedução direta do imposto devido.

**[doacoes-04] Em Doações Efetuadas a coluna "PARC. NÃO DEDUTÍVEL" existe no PDF, não tem âncora em buildDoacaoAnchors e não é gravada em lugar nenhum**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2610`
- Trecho: `const buildDoacaoAnchors = (row) => ({   codigo: findCellX(row, 'CÓD.'),   nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,   cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?? 254,   valor: findCellXRegex(row, /^VALOR/) ?? 431, });`
- Prova no PDF: p8 r15 y=522 | [x=17.0]CÓD. [x=57.5]NOME DO BENEFICIÁRIO [x=318.5]CPF/CNPJ DO [x=425.0]VALOR PAGO [x=505.3]PARC. NÃO  ||  p8 r16 y=510 | [x=316.7]BENEFICIÁRIO [x=504.8]DEDUTÍVEL  ||  p8 r17 y=489 | [x=17.0]80 [x=55.0]AJU DOA PESSOA FISICA [x=316.0]222.333.444-05 [x=447.0]7.101,41 [x=537.5]0,00
- Saida observada: resultado.doacoesEfetuadasOficial[0] = {"id":1,"codigo":"80","nome_beneficiario":"AJU DOA PESSOA FISICA","cpf_cnpj":"22233344405","valor":7101.41,"descricao":""} — não existe campo de parcela não dedutível em nenhum dos 3 itens.
- Saida esperada: Cada doação efetuada deveria trazer também a parcela não dedutível impressa (0,00 nas três), do mesmo jeito que a ficha Pagamentos Efetuados grava parcela_nao_dedutivel.
- Consequencia: O dado impresso na declaração é descartado. Como não há âncora 'parcNao', o balde 'valor' é o último de makeColumnPicker (lo=(318.5+425)/2=371.75, hi=+Infinity) e engole também a célula x=537.5 — a informação não fica só faltando, ela é misturada ao valor (ver doacoes-05).

**[doacoes-05] O valor da doação efetuada é montado concatenando a coluna VALOR PAGO com a coluna PARC. NÃO DEDUTÍVEL; só não corrompe o número aqui porque todas as parcelas são 0,00**
- Severidade media, confianca do auditor: plausivel. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:2638`
- Trecho: `const valorTxt = textInColumn(row, pick, 'valor', ''); ...       valor: parseMoneyBR(valorTxt),`
- Prova no PDF: p8 r17 y=489 | [x=17.0]80 [x=55.0]AJU DOA PESSOA FISICA [x=316.0]222.333.444-05 [x=447.0]7.101,41 [x=537.5]0,00  (x=447.0 e x=537.5 caem os dois no balde 'valor', cuja fronteira inferior é 371.75 e a superior +Infinity)
- Saida observada: valor = 7101.41 na saída real — mas por acidente: valorTxt é a string concatenada '7.101,410,00' e parseMoneyBR('7.101,410,00') devolve 7101.41 porque parseFloat para na 2ª vírgula. Testado em node com a implementação literal de parseMoneyBR (linhas 2405-2410): '7.101,41'+'123,45' -> 7101.41123; '80
- Saida esperada: valor = parseMoneyBR('7.101,41') = 7101.41 lendo só a célula da coluna VALOR PAGO.
- Consequencia: Qualquer declaração real com doação efetuada que tenha parcela não dedutível diferente de 0,00 grava um valor de doação errado (dígitos da parcela colados na fração), sem erro nem aviso. Neste PDF as três parcelas são 0,00, então a saída atual está certa e o defeito fica latente.

**[pagamentos-01] Pagamentos Efetuados: os marcadores "Dependente: <nome>" e "Alimentando: <nome>" são descartados, e nenhum pagamento guarda a quem se refere**
- Severidade media, confianca do auditor: provado. Refutacao: cetico literal: nao refutado.
- Codigo: `src/pages/importParsers.js:4118`
- Trecho: `if (row.cells.some(c => /^Dependente:/.test(c.text.trim()))) continue;`
- Prova no PDF: p7 r29 y=298 | [x=16.0]Titular  ||  p7 r40 y=84 | [x=16.0]Dependente: AJU PES DEPENDENTE UM  ||  p8 r10 y=626 | [x=16.0]Alimentando: AJU PES ALIMENTANDO UM
- Saida observada: Os 8 objetos de resultado.pagamentos têm exatamente as chaves id, codigo, nome_beneficiario, cpf_cnpj, valor_pago, parcela_nao_dedutivel, descricao, data, origemDocumento — nenhum campo de titular/dependente/alimentando. Os ids 6, 7 e 8 são indistinguíveis dos 1..5, que são do titular.
- Saida esperada: Os pagamentos ids 6 e 7 (AJU PAG DENTISTA DEP, AJU PAG ESCOLA DEP), que vêm depois de "Dependente: AJU PES DEPENDENTE UM", deveriam ficar vinculados a esse dependente; o id 8 (código 30, pensão alimentícia, R$ 6.006,28), que vem depois de "Alimentand
- Consequencia: Some a informação de por conta de quem cada despesa foi paga. Um gasto médico do dependente vira gasto do titular, e a pensão do código 30 perde a identificação do alimentando — dado que a própria Receita exige na ficha. O modelo de item, além disso, não tem onde guardar isso (não há chave equivalente ao cpf_dependente usado em rendimentos, linhas 3559/4787). Nota: a linha "Alimentando:" nem sequer é reconhecida pelo regex /^Dependente:/ da linha 4118; ela cai no ramo genérico (4138-4141) e só não polui o nome do beneficiário porque x=16.0 cai no balde 'codigo' e textInColumn(row, pick, 'nome') volta vazio.


### Ganhos de Capital

Leitura do parser pelo auditor: Duas secoes distintas. (1) `ganhoCapital` (linhas 4322-4518): aberta pelo gatilho de titulo em 3741-3761, que casa GC_TITULO (3106) e cria `currentGc` com o tipo vindo de GC_TIPO_POR_TITULO; fechada por `flushGc` (3509-3520), que copia apuracao.ganhoCapital -> ganhoCapital e calculoImposto.impostoDevido/impostoPago para os campos planos. Dentro da secao o fluxo e: troca de bloco por GC_BLOCOS (3147-3166, regex ancorados ^...$ sobre o cabecalho do quadro); depois branches fixas por `rowHasCell` exato (4342-4388: Especificacao, Data de aquisicao, Natureza, Data de Alienacao, pares linha-seguinte de GC_PARES_LINHA_SEGUINTE, Endereco, CPF/CNPJ+Nome); depois perguntas (qualquer celula terminada em '?', 4392-4425); depois a tabela de parcelas e a linha Total (4429-4470, exige >= 8 numeros); depois o casamento por rotulo POR POSICAO X dentro de GC_ROTULOS[gcBloco] (4488-4515), com fallback por prefixo em 4497. GC_ROTULOS so tem tabela para 6 blocos (apuracao, calculoVista, consolidacao, impostoPagoBloco, isentos, definitiva, calculoPrazo); os blocos dadosBem, aquisicao, operacao, perguntas, custoAquisicao, parcelasDetalhe, faixas e adquirente ficam com `tabela = {}` e nada e lido neles. (2) `ganhoCapitalMoeda` (4520-4560): depende de um cabecalho `^ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE$` para ligar o bloco 'alienacoes' e de `^TOTALIZAÇÃO$` para o mensal. A consolidacao final (5002-5060) mapeia cada operacao para `ganhosCapitalOficial.operacoes`, com faixasTributacao/ampliacoesReformas/custosAquisicao FIXOS em [] (5054-5056). ESP-01 e SAI-01 nao tem ficha de GCAP no PDF (grep vazio), entao apuracaoGanhoCapital 0 esta correto neles.

**[gc-01] Participação societária: Custo de Corretagem recebe o Valor de Alienação e valorAlienacao fica 0**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4357`
- Trecho: `if (rowHasCell(row, 'Data de Alienação')) {           currentGc.dataAlienacao = dataDDMMAAAAparaIso((primeiraData(proxima) || '').replace(/\D/g, ''));           currentGc.custoCorretagem = parseMoneyBR(valoresDe(proxima)[0] || '0');           continue;         }`
- Prova no PDF: p20 r10 y=666 | [x=27.0]Data de Alienação [x=277.9]Valor de alienação - (R$) [x=420.0]Custo de Corretagem - (R$) p20 r11 y=653 | [x=27.0]20/10/2025 [x=337.4]70.622,48 [x=492.9]2.623,49
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json, apuracaoGanhoCapital[2] (tipo "participacao"): "valorAlienacao": 0, "custoCorretagem": 70622.48. O mesmo em ganhosCapitalOficial.operacoes[2]. A branch pega valoresDe(proxima)[0], que na linha de 3 colunas é o VALOR DE ALIENAÇÃO, não a corretagem; e a branch de 
- Saida esperada: valorAlienacao = 70622.48 e custoCorretagem = 2623.49 (o quadro da participação tem TRÊS colunas na mesma linha: data, valor de alienação e corretagem)
- Consequencia: A operação de participação societária entra no app com valor de alienação zerado e uma corretagem de R$ 70.622,48 (28x o real). Qualquer tela, soma ou conferência que use os campos planos valorAlienacao/custoCorretagem (que é o formato compartilhado com a leitura do .DBK) mostra número inventado e ganho impossível de reconciliar.

**[gc-02] Bem imóvel: rótulo é "Especificação e endereço", e nem 'Especificação' nem 'Endereço' casam — descrição e endereço do imóvel são perdidos**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4342`
- Trecho: `if (rowHasCell(row, 'Especificação')) {           currentGc.bem = normSpace(cells.filter(t => t !== 'Especificação').join(' '));           continue;         } ...         if (rowHasCell(row, 'Endereço') && currentGc.tipo === 'imovel') {`
- Prova no PDF: p14 r15 y=558 | [x=29.0]Especificação e endereço p14 r16 y=544 | [x=29.0]AJU GCI IMOVEL URBANO SENTINELA p14 r17 y=532 | [x=29.0]RUA [x=54.8]AJU GCI IMOVEL [x=127.7]2901, [x=156.6]APTO 29 [x=198.4]BAIRRO SENTINELA p14 r18 y=520 | [x=29.0]SAO PAULO [x=108.6]SP [x=152.6]01001000
- Saida observada: apuracaoGanhoCapital[0]: "bem": "" e nenhuma chave "endereco"; em ganhosCapitalOficial.operacoes[0]: "especificacao": "", "endereco" ausente. rowHasCell é igualdade exata (linha 2436: `row.cells.some(c => c.text.trim() === exact)`) e a célula impressa é "Especificação e endereço", diferente de 'Espe
- Saida esperada: bem = "AJU GCI IMOVEL URBANO SENTINELA" e endereco = "RUA AJU GCI IMOVEL 2901, APTO 29 BAIRRO SENTINELA SAO PAULO SP 01001000"
- Consequencia: A operação de ganho de capital de bem imóvel chega ao app sem NENHUMA identificação do bem: não dá para saber qual imóvel foi vendido, nem casar a operação com o bem da ficha de Bens e Direitos. Só o tipo imóvel e os valores sobrevivem. Repare que na ficha de BENS MÓVEIS o rótulo é 'Especificação' puro (p17 r6) e ali funciona — a falha é específica do imóvel.

**[gc-03] Bem imóvel: o bloco "APURAÇÃO DO CUSTO DE AQUISIÇÃO" não tem tabela de rótulos — data e custo de aquisição do imóvel são perdidos**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4346`
- Trecho: `if (rowHasCell(row, 'Data de aquisição')) {           currentGc.dataAquisicao = dataDDMMAAAAparaIso((primeiraData(proxima) || '').replace(/\D/g, ''));           currentGc.custoAquisicao = parseMoneyBR(valoresDe(proxima)[0] || '0');           continue;         }`
- Prova no PDF: p14 r30 y=303 | [x=24.0]APURAÇÃO DO CUSTO DE AQUISIÇÃO p14 r31 y=287 | [x=38.0]Data de Aquisição: [x=115.0]18/08/2018 p14 r32 y=272 | [x=38.0]Custo de aquisição (R$): [x=515.0]100.601,41
- Saida observada: apuracaoGanhoCapital[0]: "dataAquisicao": "", "custoAquisicao": 0. Motivo: (a) rowHasCell exige 'Data de aquisição' e o PDF imprime 'Data de Aquisição:' (A maiúsculo + dois-pontos), e o valor vem na MESMA linha, não na de baixo; (b) o bloco casado em GC_BLOCOS linha 3153 (`[/^APURAÇÃO DO CUSTO DE AQ
- Saida esperada: dataAquisicao = "2018-08-18" e custoAquisicao = 100601.41
- Consequencia: A data de aquisição do imóvel some por completo do resultado (não existe em nenhum outro campo), e o campo plano custoAquisicao — que é o que o resto do app e a leitura do .DBK consomem — fica 0. Cálculo de prazo de posse, redução por tempo e conferência de custo ficam sem base.

**[gc-04] Moeda estrangeira em espécie: a alienação detalhada nunca é lida — o cabeçalho que a habilita não existe no PDF**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4523`
- Trecho: `if (cells.some(t => /^ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE$/.test(t))) { gcMoedaBloco = 'alienacoes'; continue; }         if (cells.some(t => /^TOTALIZAÇÃO$/.test(t))) { gcMoedaBloco = 'totalizacao'; continue; } ...         if (gcMoedaBloco === 'alienacoes' && numeros.length >= 3) {`
- Prova no PDF: p22 r8 y=647 | [x=62.0]Data da Alienação [x=252.0]Quantidade [x=426.3]Valor da Alienação (R$) p22 r9 y=632 | [x=68.0]21/11/2025 [x=257.4]1.234,56 [x=458.9]8.632,51 p22 r10 y=616 | [x=67.6]Custo Médio (R$) [x=231.0]Custo de Aquisição (R$) [x=426.7]Ganho de Capital (R$) p22 r11 y=603 | [x=90.6]5,371549 [x=266.9]6.631,49 [x=465.9]2.001,02 (prova de cobertura: `grep -n "ALIENAÇÃO DE MOEDA" AUDITORIA/r
- Saida observada: ganhosCapitalOficial.moedaEspecie.operacoes = [] e o log emitido é `Ganhos de Capital: ficha de moedas em espécie importada (0 alienação(ões), 12 mês(es) na totalização)`. Como o cabeçalho 'ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE' não existe no PDF, gcMoedaBloco continua null de p22 r3 até p22 r12
- Saida esperada: moedaEspecie.operacoes com 1 alienação: data 2025-11-21, adquirente 22233344405 (AJU GCE ADQUIRENTE), moeda DÓLAR (ESTADOS UNIDOS), quantidade 1.234,56, valor de alienação R$ 8.632,51, custo médio 5,371549, custo de aquisição R$ 6.631,49, ganho de ca
- Consequencia: A única alienação de moeda estrangeira em espécie da declaração desaparece na importação: some o adquirente, a data, a quantidade em dólar, o valor de alienação, o custo e o ganho de R$ 2.001,02. Só sobra a totalização mensal, que neste PDF é toda zerada — ou seja, o app importa a ficha como se não tivesse havido operação nenhuma.

**[gc-05] Participação societária: o quadro de consolidação é "CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA" e não casa com o regex de "CONSOLIDAÇÃO DO BEM" — todo o imposto a pagar da consolidação é perdido**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3159`
- Trecho: `[/^CONSOLIDAÇÃO DO BEM$/, 'consolidacao'],`
- Prova no PDF: p21 r3 y=752 | [x=27.0]CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA p21 r5 y=712 | [x=39.0]Diferido de anos anteriores [x=438.0](R$) [x=538.4]0,00 p21 r6 y=697 | [x=39.0]Referente à alienação em 2025 [x=438.0](R$) [x=522.9]4.106,62 p21 r7 y=683 | [x=39.0]Total [x=438.0](R$) [x=522.9]4.106,62 p21 r9 y=653 | [x=39.0]Devido em 2025 [x=438.0](R$) [x=522.9]4.106,62
- Saida observada: apuracaoGanhoCapital[2].consolidacaoBem = {"impostoPago": 0, "rendimentoIsento": 0, "rendimentoExclusivo": 27377.52} — faltam os SEIS campos do quadro IMPOSTO A PAGAR. Como o título de p21 r3 não casa nenhum item de GC_BLOCOS, gcBloco continua 'calculoVista' (setado em p20 r38) e nenhum dos rótulos 
- Saida esperada: consolidacaoBem da operação 3 com impostoDiferidoAnosAnteriores 0, impostoDoExercicio 4106.62, impostoTotal 4106.62, irFonteLei11033 0, impostoDevidoNoExercicio 4106.62, impostoDiferidoAnosPosteriores 0 (exatamente como a operação 1 recebe de p16 e a
- Consequencia: A participação societária perde a consolidação do imposto: não se sabe quanto foi diferido, quanto é do exercício, quanto de IR na fonte compensado. As operações de imóvel e de móvel trazem esses campos e a de participação não, então qualquer soma de imposto diferido/consolidado por operação sai incompleta e silenciosamente.

**[gc-06] Bem imóvel: "Valor da Alienação" e "Valor Líquido da Alienação" (com "da") não constam de GC_ROTULOS.apuracao (que só tem "de")**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3170`
- Trecho: `'Valor de alienação': 'apuracao.valorAlienacao', ...     'Valor líquido de alienação': 'apuracao.valorLiquido',     'Valor Líquido de Alienação': 'apuracao.valorLiquido', ...     'Valor de Alienação': 'apuracao.valorAlienacao',`
- Prova no PDF: p15 r4 y=742 | [x=40.0]Valor da Alienação [x=400.0](R$) [x=515.0]160.602,42 p15 r6 y=715 | [x=40.0]Valor Líquido da Alienação [x=400.0](R$) [x=515.0]154.998,99
- Saida observada: apuracaoGanhoCapital[0].apuracao = {"custoCorretagem": 5603.43, "custoAquisicao": 100601.41, "ganhoCapital": 54397.58} — sem valorAlienacao e sem valorLiquido. Nem o casamento exato nem o por prefixo (linha 4497) salvam: 'Valor da Alienação' não começa por 'Valor de alienação' nem por 'Valor de Alie
- Saida esperada: apuracao.valorAlienacao = 160602.42 e apuracao.valorLiquido = 154998.99 na operação 1 (imóvel), como acontece na 2 (móvel, p17 r21/r23 'Valor de alienação'/'Valor líquido de alienação') e na 3 (participação, p20 r23/r25 'Valor de Alienação'/'Valor Lí
- Consequencia: O quadro APURAÇÃO DOS GANHOS DE CAPITAL do imóvel é importado pela metade: o valor líquido de alienação (R$ 154.998,99) some, e o valor de alienação só sobrevive no campo plano porque veio de outra linha (p14 r21). Uma tela que reproduza o quadro de apuração do imóvel mostra linhas em branco onde a declaração tem números, e o imóvel fica inconsistente com o móvel e a participação.

**[gc-07] Reduções da Lei 7.713/1988 e da Lei 11.196/2005 (FR1/FR2) e a redução por aplicação em outro imóvel não têm parser; os cinco "Resultado" colidem no mesmo campo por casamento de prefixo**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4497`
- Trecho: `const destino = tabela[rotulo]               || tabela[Object.keys(tabela).find(k => rotulo.startsWith(k)) || ''];`
- Prova no PDF: p15 r9 y=669 | [x=40.0]Percentual de Redução (Lei n. 7.713, de 1988) [x=402.6](%) [x=521.6]0,000000 p15 r10 y=654 | [x=40.0]Valor de Redução (Lei n. 7.713, de 1988) [x=399.0](R$) [x=539.4]0,00 p15 r12 y=625 | [x=40.0]Percentual de Redução (Lei n. 11.196, de 2005 - FR1) [x=403.6](%) [x=521.6]0,000000 p15 r15 y=581 | [x=40.0]Percentual de Redução (Lei n. 11.196, de 2005 - FR2) [x=403.6](%) [x=521.6]
- Saida observada: apuracaoGanhoCapital[0].apuracao tem exatamente três chaves (custoCorretagem, custoAquisicao, ganhoCapital): nenhuma redução foi gravada. Além disso, 'Ganho de Capital - Resultado 1' (p15 r8), 'Ganho de Capital - Resultado 2' (r11), 'Ganhos de Capital - Resultado 3' (r14), '... Resultado 4' (r17), '
- Saida esperada: os oito campos de redução do imóvel (percentual e valor de cada uma das quatro reduções) e, idealmente, os Resultados 1 a 5 distintos em apuracao
- Consequencia: Numa declaração com redução efetiva (imóvel adquirido até 1988, ou FR1/FR2 da Lei 11.196/2005, ou aplicação do produto da venda em outro imóvel), a isenção/redução aplicada não é importada em lugar nenhum — o app não consegue explicar por que o ganho tributável é menor que a diferença entre alienação e custo. E, como os cinco Resultados e a 'alienação atual' disputam o mesmo campo, o ganho gravado passa a depender da ordem de impressão, não do significado do campo.

**[gc-08] Tabela de faixas de tributação (15% / 17,5% / 20% / 22,5%) é lida como bloco mas não é extraída: faixasTributacao sai sempre vazio**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:5054`
- Trecho: `faixasTributacao: [],         ampliacoesReformas: [],         custosAquisicao: [],`
- Prova no PDF: p15 r25 y=407 | [x=58.5]Faixa de Ganho de Capital [x=203.2]Alíquota - (%) [x=297.2]TOTAL [x=390.4]Anterior [x=495.0]Atual p15 r26 y=393 | [x=29.0]Até R$ 5.000.000,00 [x=217.0]15 [x=318.4]54.397,58 [x=435.4]0,00 [x=518.4]54.397,58 p15 r27 y=378 | [x=29.0]De R$ 5.000.000,01 Até R$ 10.000.000,00 [x=217.0]17,5 [x=338.4]0,00 [x=435.4]0,00 [x=538.4]0,00 p15 r30 y=330 | [x=165.3]TOTAL [x=318.4]54.397,58 
- Saida observada: ganhosCapitalOficial.operacoes[0..2].faixasTributacao = [] nos três casos. GC_BLOCOS linha 3164 (`[/^Faixa de Ganho de Capital$/, 'faixas']`) troca o bloco para 'faixas', mas GC_ROTULOS não tem chave 'faixas', então `tabela` fica {} e nenhuma linha do quadro é lida; e o mapeamento final na linha 505
- Saida esperada: faixasTributacao com as quatro faixas (alíquota, ganho distribuído total, anterior e atual), como a leitura do .DBK monta no registro 75 (linha 1847: `gcOperacao(tipoBem, field(line, 33, 4)).faixasTributacao.push({...})`)
- Consequencia: A distribuição do ganho pelas faixas progressivas da Lei 13.259/2016 e o rateio entre alienação anterior e atual não chegam ao app quando a origem é PDF, embora cheguem quando a origem é .DBK. Em ganho acima de R$ 5 milhões (várias faixas e alíquota média diferente de 15%) o app perde a memória de cálculo e as duas origens de importação passam a divergir para a mesma declaração.

**[gc-09] Participação societária: o quadro "CUSTO DE AQUISIÇÃO" (espécie, quantidade de quotas, custo médio, custo total) não tem parser**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3153`
- Trecho: `[/^APURAÇÃO DO CUSTO DE AQUISIÇÃO$/, 'custoAquisicao'],`
- Prova no PDF: p20 r18 y=528 | [x=25.0]CUSTO DE AQUISIÇÃO p20 r19 y=515 | [x=43.0]Espécie de Participação Societária [x=227.7]Quantidade de [x=353.3]Custo médio [x=476.1]Custo total p20 r21 y=490 | [x=27.0]Quota [x=298.0]1.234 [x=396.2]32,918534 [x=521.4]40.621,47 (prova de cobertura: `grep -n "\^CUSTO DE AQUISIÇÃO\|Custo médio\|Quantidade de" src/pages/importParsers.js` retorna VAZIO)
- Saida observada: apuracaoGanhoCapital[2]: "custoAquisicao": 0 e, em ganhosCapitalOficial.operacoes[2], "custosAquisicao": []. O cabeçalho impresso é 'CUSTO DE AQUISIÇÃO', que NÃO casa o regex ancorado /^APURAÇÃO DO CUSTO DE AQUISIÇÃO$/; gcBloco fica em 'adquirente' (p20 r15) e a linha de dados p20 r21 não tem rótulo
- Saida esperada: custosAquisicao com { especie: 'Quota', quantidade: 1234, custoMedio: 32.918534, custoTotal: 40621.47 } e custoAquisicao = 40621.47
- Consequencia: Quantidade de quotas alienadas e custo médio ponderado — os dois números que sustentam o custo de aquisição da participação — não são importados, e o campo plano custoAquisicao da operação fica 0. Só resta o 40.621,47 replicado em apuracao.custoAquisicao (lido de p20 r26), sem a memória de como foi obtido.

**[gc-10] Participação societária: "Espécie da participação" nunca é lida porque a branch de 'Natureza' consome a linha antes**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4351`
- Trecho: `if (rowHasCell(row, 'Natureza da operação') || rowHasCell(row, 'Natureza')) {           currentGc.naturezaOperacao = proxima.find(t => !RV_VALOR.test(t) && !GC_DATA.test(t)) || currentGc.naturezaOperacao;           const v = valoresDe(proxima);           if (v.length > 0) currentGc.valorAlienacao = `
- Prova no PDF: p20 r12 y=635 | [x=29.0]Natureza [x=253.0]Espécie da participação p20 r13 y=623 | [x=29.0]ALIENAÇÕES, RESGATES E OUTRAS TRANSFERÊNCIAS [x=253.0]QUOTAS
- Saida observada: apuracaoGanhoCapital[2] não tem chave "especie"; ganhosCapitalOficial.operacoes[2].especie é undefined (some do JSON). A branch de 'Natureza' (4351) roda ANTES do bloco de pares linha-seguinte (4365) e faz `continue`, e ainda por cima grava em naturezaOperacao o PRIMEIRO texto não-valor da linha de 
- Saida esperada: especie = "QUOTAS" (GC_PARES_LINHA_SEGUINTE linha 3218 declara `'Espécie da participação': 'especie'`)
- Consequencia: A espécie da participação alienada (quotas x ações) não é importada, apesar de estar mapeada no código. É o dado que distingue quota de Ltda. de ação de S.A., relevante para a tributação e para casar a operação com o bem declarado.

**[gc-11] Participação societária: Município e UF da sociedade são perdidos porque só o PRIMEIRO par rótulo/valor da linha é processado**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4365`
- Trecho: `const parLinhaSeguinte = cells.map(t => GC_PARES_LINHA_SEGUINTE[gcNormalizaRotulo(t)]).find(Boolean);           if (parLinhaSeguinte && proxima.length > 0) {             const texto = normSpace(proxima.filter(t => !RV_VALOR.test(t)).join(' '));             if (texto) {               gcSet(currentGc,`
- Prova no PDF: p20 r8 y=694 | [x=30.0]CNPJ da sociedade [x=180.0]Município [x=523.0]UF p20 r9 y=681 | [x=29.0]55.566.677/0001-83 [x=180.0]SAO PAULO [x=524.0]SP
- Saida observada: apuracaoGanhoCapital[2].sociedade = {"nome": "AJU GCP EMPRESA SENTINELA", "cnpj": "55566677000183"} — sem municipio e sem uf. `.find(Boolean)` devolve só o primeiro destino ('sociedade.cnpj'), o `texto` é a linha inteira de baixo ("55.566.677/0001-83 SAO PAULO SP") e o `continue` encerra a linha. O 
- Saida esperada: sociedade = { nome: 'AJU GCP EMPRESA SENTINELA', cnpj: '55566677000183', municipio: 'SAO PAULO', uf: 'SP' } — os três rótulos estão mapeados em GC_PARES_LINHA_SEGUINTE (linhas 3215-3218)
- Consequencia: Município e UF da sociedade cujas quotas foram alienadas não são importados, embora o código declare o mapeamento. Além da perda, o acerto do CNPJ é acidental: qualquer município com dígito no nome (por exemplo 'SAO JOSE DO RIO PRETO 2' ou um CEP impresso na mesma linha) contaminaria o CNPJ gravado.

**[gc-12] Alienação a prazo: o quadro DETALHE DAS PARCELAS não tem tabela de rótulos e a data da última parcela não é gravada**
- Severidade baixa, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:4491`
- Trecho: `const tabela = GC_ROTULOS[gcBloco] || {};`
- Prova no PDF: p18 r9 y=701 | [x=26.0]A prestação/parcela final foi recebida em 2025? [x=223.0]Sim ( X ) [x=270.5]Não ( [x=300.0]) [x=322.0]Data de Recebimento da Última Parcela [x=489.0]19/11/2025 p18 r11 y=657 | [x=29.0]Data de Recebimento da Parcela: [x=159.0]19/09/2025 [x=227.0]Última Parcela? [x=291.0]Sim ( [x=316.3]) [x=330.1]Não ( X ) p18 r29 y=377 | [x=29.0]Data de Recebimento da Parcela: [x=159.0]19/11/
- Saida observada: apuracaoGanhoCapital[1] não tem nenhum campo de data da última parcela; cada item de parcelas tem só 8 campos (data, valorRecebido, custoCorretagem, valorLiquido, custoAquisicaoProporcional, ganhoCapitalProporcional, aliquotaMedia, impostoDevido, impostoPago) e nenhum flag de última parcela. GC_BLOC
- Saida esperada: dataUltimaParcela = "2025-11-19" na operação, e um marcador ultimaParcela=true no terceiro item de parcelas
- Consequencia: A data de recebimento da última parcela e a marcação de qual parcela é a final não são importadas. São os dados que determinam se a tributação do ganho a prazo se encerra no ano-calendário ou continua no seguinte; sem eles o app não consegue projetar as parcelas remanescentes de uma alienação a prazo ainda em curso.


### Resumo e Calculo do Imposto

Leitura do parser pelo auditor: A área resumo-calculo tem UM gatilho e UM handler. Gatilho (importParsers.js:3771-3783): qualquer row com célula exatamente igual a 'RESUMO' ou 'EVOLUÇÃO PATRIMONIAL' (rowHasCell é comparação EXATA de célula, linha 2436) faz flushAllCurrent(), section='resumo', cria impostoDevido={origem:'pdf'} e, na mesma row, decide modeloDeclaracao por /DEDUÇÕES LEGAIS/i vs /DESCONTO SIMPLIFICADO/i (3779-3780). Handler (4580-4603): as rows 'RENDIMENTOS TRIBUTÁVEIS' e 'DEDUÇÕES' só ligam a flag resumoBloco; para cada outra row chama paresRotuloValor(row) (2924-2937), que percorre as células ordenadas por x e casa cada valor (RV_VALOR = /^-?[\d.]*\d,\d{2}$/, linha 2716) com o RÓTULO imediatamente à esquerda dele, dentro da MESMA row — `rotulo` é reiniciado a cada row, então valor sem rótulo à esquerda na própria row é descartado. Cada par então passa por três testes, nesta ordem: 'TOTAL' desempatado por resumoBloco (4587-4592); RESUMO_CAMPOS, dicionário de 11 rótulos EXATOS (2941-2953); e RESUMO_EVOLUCAO, 2 regex ancoradas em ^...$ que exigem 'em dd/mm/aaaa' (2958-2961), com o contador resumoEvolucaoVistos decidindo anterior vs atual pela ORDEM de aparição. Rótulo que não casa nenhum dos três é silenciosamente ignorado — não há else, não há log. Depois, fora do laço, 4986-4991 preenche lei14754Ganho (e lei14754Imposto se ainda for null) somando demonstrativoExteriorOficial. Na prática, nas páginas 40 e 41 do AJU-01 são impressos 58 pares rótulo+valor e apenas 17 viram campo.

**[resumo-01] "IMPOSTO A RESTITUIR" nunca é lido: o valor fica numa row sozinha (Δy=3 > TOLERANCIA_LINHA=2) e o rótulo não existe em RESUMO_CAMPOS**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2931`
- Trecho: `const paresRotuloValor = (row) => {   const pares = [];   let rotulo = null;   for (const c of row.cells) {     const t = c.text.trim();     if (!t) continue;     if (RV_VALOR.test(t)) {       if (rotulo) pares.push({ rotulo, valor: parseMoneyBR(t) });`
- Prova no PDF: SAI-01: "p8 r27 y=456 | [x=15.0]IMPOSTO DEVIDO [x=323.0]IMPOSTO A RESTITUIR" seguida de "p8 r28 y=453 | [x=536.9]2.032,33" (AJU-01 traz o mesmo par em "p40 r27 y=456" / "p40 r28 y=453 | [x=552.4]0,00"; ESP-01 em "p7 r27 y=456" / "p7 r28 y=453 | [x=552.4]0,00")
- Saida observada: AUDITORIA/saida-parsepdf/SAI-01.json: impostoDevido = {origem, modeloDeclaracao, rendimentosPfExteriorTitular:0, rendimentosPfExteriorDependentes:0, rendimentosTributaveisTotal:43201.11, dependentes:0, despesasMedicas:0, totalDeducoes:4202.12, baseCalculo:38998.99, saldoPagar:0, impostoDevidoTotal:1
- Saida esperada: impostoDevido.impostoRestituir = 2032.33 no SAI-01 (o PDF imprime R$ 2.032,33 sob o título IMPOSTO A RESTITUIR)
- Consequencia: A restituição é o resultado final da declaração para quem tem imposto a receber. Como o valor é descartado e RelatorioPage.jsx:245-246 só renderiza o tile "Saldo a Pagar" com impostoDevido.saldoPagar, o SAI-01 aparece no app como "Saldo a Pagar R$ 0,00" quando a declaração na verdade tem R$ 2.032,33 a restituir. O usuário lê zero onde há crédito. Duas causas somadas: buildRows separa rótulo (y=456) e valor (y=453) porque TOLERANCIA_LINHA=2 (linha 2415) e a diferença é 3; e mesmo que estivessem juntos, 'IMPOSTO A RESTITUIR' não está em RESUMO_CAMPOS (2941-2953) — a string só existe num COMENTÁRIO, linha 2915.

**[resumo-02] Evolução Patrimonial: as regex exigem "em dd/mm/aaaa" e perdem os rótulos de Declaração Final de Espólio e de Saída Definitiva**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2959`
- Trecho: `const RESUMO_EVOLUCAO = [   [/^Bens e direitos em \d{2}\/\d{2}\/\d{4}$/, ['bensAnteriorOficial', 'bensAtualOficial']],   [/^Dívidas e ônus reais em \d{2}\/\d{2}\/\d{4}$/, ['dividasAnteriorOficial', 'dividasAtualOficial']], ];`
- Prova no PDF: ESP-01: "p8 r4 y=755 | [x=20.0]Bens e direitos - situação na data da partilha [x=528.0]123.401,41" e "p8 r5 y=743 | [x=20.0]Bens e direitos - valor da transferência [x=528.0]123.401,41" e "p8 r7 y=719 | [x=20.0]Dívidas e ônus reais na data da partilha [x=552.4]0,00". SAI-01: "p9 r5 y=743 | [x=20.0]Bens e direitos - situação na data da caracterização da condição de não residente [x=528.0]179.804,84
- Saida observada: ESP-01.json impostoDevido NÃO tem bensAnteriorOficial nem bensAtualOficial nem dividasAtualOficial (só dividasAnteriorOficial:0, vindo de "p8 r6 | Dívidas e ônus reais em 31/12/2024"). SAI-01.json tem bensAnteriorOficial:24402.42 (de "p9 r4 | Bens e direitos em 31/12/2024") e NÃO tem bensAtualOficia
- Saida esperada: ESP-01: bensAnteriorOficial e bensAtualOficial = 123401.41, dividasAtualOficial = 0. SAI-01: bensAtualOficial = 179804.84, dividasAtualOficial = 0. (No AJU-01, cujos rótulos são "Bens e direitos em 31/12/2024" e "em 31/12/2025", os quatro campos saem
- Consequencia: Nas declarações de Espólio e de Saída Definitiva o patrimônio FINAL oficial — o número que o programa da Receita calculou e que serve de gabarito para conferir a soma dos bens importados — some por completo. O caminho .DBK (registro 20, linhas 2028-2031) preenche os quatro campos sempre; o caminho PDF só preenche nesses dois tipos de declaração pela metade ou nada, criando divergência entre importar o .DBK e importar o PDF da MESMA declaração. E como bensAtualOficial fica undefined, qualquer conferência 'oficial x somatório' fica impossível justamente nas duas declarações em que o patrimônio final é o dado mais crítico (partilha e saída do país).

**[resumo-03] Bloco RENDIMENTOS TRIBUTÁVEIS: 5 dos 7 rótulos impressos não têm campo em RESUMO_CAMPOS e o valor é descartado**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2941`
- Trecho: `const RESUMO_CAMPOS = {   'Recebidos de Pessoa Física/Exterior pelo titular': 'rendimentosPfExteriorTitular',   'Recebidos de Pessoa Física/Exterior pelos dependentes': 'rendimentosPfExteriorDependentes',   'Dependentes': 'dependentes',   'Despesas médicas': 'despesasMedicas',   'Base de cálculo do `
- Prova no PDF: AJU-01: "p40 r5 y=739 | [x=20.0]Recebidos de Pessoa Jurídica pelo titular [x=532.4]51.101,11", "p40 r6 y=727 | [x=20.0]Recebidos de Pessoa Jurídica pelos dependentes [x=532.4]12.201,21", "p40 r9 y=691 | [x=20.0]Recebidos acumuladamente pelo titular [x=552.4]0,00", "p40 r10 y=679 | [x=20.0]Recebidos acumuladamente pelos dependentes [x=536.9]9.811,06", "p40 r11 y=667 | [x=20.0]Resultado tributável d
- Saida observada: AJU-01.json impostoDevido só tem, deste bloco, rendimentosPfExteriorTitular:14239.58, rendimentosPfExteriorDependentes:3814.27 e rendimentosTributaveisTotal:211696.46. As strings "120529.23" e "9811.06" não aparecem em nenhum lugar do resultado.
- Saida esperada: impostoDevido com a decomposição oficial do rendimento tributável: rendimentosPjTitular=51101.11, rendimentosPjDependentes=12201.21, rendimentosAcumuladosTitular=0, rendimentosAcumuladosDependentes=9811.06, resultadoAtividadeRural=120529.23 (a soma d
- Consequencia: Fica-se com o total oficial (211.696,46) sem nenhuma das parcelas oficiais que o compõem, exceto as duas de PF/Exterior. O resultado tributável da Atividade Rural (120.529,23 — mais da metade do total) e os rendimentos recebidos acumuladamente dos dependentes (9.811,06) desaparecem do objeto oficial, então não há como conferir contra as fichas detalhadas importadas nem detectar ficha faltante: qualquer diferença aparece só no total agregado, sem dizer de onde veio.

**[resumo-04] Bloco DEDUÇÕES: 8 dos 10 rótulos impressos são descartados; só "Dependentes", "Despesas médicas" e o TOTAL sobrevivem**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2944`
- Trecho: `'Dependentes': 'dependentes',   'Despesas médicas': 'despesasMedicas',`
- Prova no PDF: AJU-01: "p40 r14 y=623 | [x=20.0]Contribuições às previdências oficial e complementar aberta ou fechada de que trata o § 15 do art. 40 da CF/1988 (até o limite [x=536.9]6.304,34", "p40 r16 y=599 | [x=20.0]Contribuição à previdência oficial (Rendimentos recebidos acumuladamente) [x=543.5]812,07", "p40 r17 y=587 | [x=20.0]Contribuição à prev. complementar, inclusive o valor para as fechadas de que t
- Saida observada: AJU-01.json impostoDevido: dependentes:2275.08, despesasMedicas:6303.23, totalDeducoes:33595.97 e nada mais. As strings "3020.4", "3561.5" não aparecem em nenhum lugar do resultado; "6006.28" só aparece porque a ficha detalhada de pagamentos a traz, não como campo do resumo.
- Saida esperada: impostoDevido com as 8 deduções oficiais restantes (previdência 6304.34; previdência RRA 812.07; previdência complementar 4999.99; instrução 3561.50; pensão judicial 6006.28; pensão por escritura 0; pensão judicial RRA 313.08; livro caixa 3020.40), c
- Consequencia: A composição oficial das deduções, que é justamente o que a Receita conferiu e o que motiva malha fina (instrução, pensão alimentícia, livro caixa, previdência complementar), não entra no app. Sobra o total 33.595,97 sem rastreabilidade: o app não consegue mostrar nem checar por que a base de cálculo caiu 33.595,97, nem confrontar as deduções oficiais com os pagamentos importados.

**[resumo-05] Bloco IMPOSTO DEVIDO: as 5 linhas intermediárias do cálculo (imposto devido bruto, dedução de incentivo, imposto devido I, imposto devido RRA, alíquota efetiva) são descartadas**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2947`
- Trecho: `'Total do imposto devido': 'impostoDevidoTotal',`
- Prova no PDF: AJU-01: "p40 r30 y=430 | [x=20.0]Imposto devido [x=256.4]38.123,85", "p40 r31 y=419 | [x=20.0]Dedução de incentivo [x=260.9]1.707,34 [x=323.0]PARCELAMENTO", "p40 r32 y=407 | [x=20.0]Imposto devido I [x=256.4]36.416,51", "p40 r34 y=394 | [x=20.0]Imposto devido RRA [x=276.4]0,00 [x=327.0]Número de Quotas [x=563.5]1", "p40 r36 y=370 | [x=20.0]Aliquota efetiva (%) [x=272.0]17,20". Cobertura: grep -Fc 
- Saida observada: AJU-01.json impostoDevido traz apenas impostoDevidoTotal:36658.91 e lei14754Imposto:242.4. As strings "38123.85", "1707.34", "36416.51" e "17.2" não aparecem em NENHUM lugar do resultado.
- Saida esperada: impostoDevido.impostoDevidoBruto=38123.85, deducaoIncentivo=1707.34, impostoDevidoI=36416.51, impostoDevidoRRA=0, aliquotaEfetiva=17.20 (38.123,85 - 1.707,34 = 36.416,51; + 242,40 da Lei 14.754 = 36.658,91 = o impostoDevidoTotal lido)
- Consequencia: A dedução de incentivo (1.707,34) é o único registro no app de que houve doação incentivada abatida do imposto, e a alíquota efetiva (17,20%) é o indicador que o contribuinte usa para comparar exercícios; ambos somem. Sem "Imposto devido" e "Imposto devido I" também não há como reconstruir a conta do imposto: fica só o total, sem as etapas, impedindo qualquer conferência do cálculo importado.

**[resumo-06] Bloco IMPOSTO PAGO: os 8 componentes impressos (IRRF titular/dependentes, carnê-leão, complementar, exterior, Lei 11.033, RRA) são descartados; só o total é lido**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2948`
- Trecho: `'Total do imposto pago': 'impostoPagoTotal',`
- Prova no PDF: AJU-01: "p40 r41 y=298 | [x=20.0]Imposto retido na fonte do titular [x=259.9]4.104,14", "p40 r42 y=286 | [x=20.0]Imp. retido na fonte dos dependentes [x=259.9]1.818,33", "p40 r44 y=274 | [x=20.0]Carnê-Leão do titular [x=266.5]918,80", "p40 r46 y=262 | [x=20.0]Carnê-Leão dos dependentes [x=266.5]204,64", "p40 r48 y=250 | [x=20.0]Imposto complementar [x=259.9]1.901,11", "p40 r49 y=238 | [x=20.0]Impo
- Saida observada: AJU-01.json impostoDevido traz só impostoPagoTotal:13751.06. As strings "4804.04", "1901.11", "918.8" e "1818.33" não aparecem em nenhum lugar do resultado; "4104.14" só aparece por vir da ficha detalhada de rendimentos, não do resumo.
- Saida esperada: impostoDevido com os 8 componentes oficiais do imposto pago (4104.14 + 1818.33 + 918.80 + 204.64 + 1901.11 + 0 + 0 + 4804.04 = 13.751,06 = o impostoPagoTotal lido)
- Consequencia: O imposto retido RRA (4.804,04) e o imposto complementar (1.901,11) — 6.705,15 de 13.751,06, quase metade do imposto pago — não existem em lugar nenhum do resultado. Como não há campo oficial por componente, o app não consegue confrontar o retido oficial com o retido somado das fichas de rendimentos, que é o teste mais direto para achar informe de rendimentos faltando.

**[resumo-07] Bloco PARCELAMENTO/QUOTA ÚNICA: "Valor da quota" e "Número de Quotas" não são lidos, e o número de quotas nem passaria por RV_VALOR**
- Severidade baixa, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2716`
- Trecho: `const RV_VALOR = /^-?[\d.]*\d,\d{2}$/;`
- Prova no PDF: AJU-01: "p40 r33 y=404 | [x=327.0]Valor da quota [x=532.4]22.907,85" e "p40 r34 y=394 | [x=20.0]Imposto devido RRA [x=276.4]0,00 [x=327.0]Número de Quotas [x=563.5]1". Cobertura: grep -Fc 'Valor da quota' src/pages/importParsers.js -> 0
- Saida observada: AJU-01.json impostoDevido não tem nenhuma chave de quota/parcelamento.
- Saida esperada: impostoDevido.valorQuota=22907.85 e numeroQuotas=1 (o PDF informa o parcelamento do saldo de 22.907,85 em 1 quota)
- Consequencia: O app não sabe se o saldo a pagar de 22.907,85 foi parcelado nem em quantas quotas, informação que muda o calendário de DARF do contribuinte. Note ainda que, mesmo que 'Número de Quotas' fosse mapeado, o texto "1" não casa RV_VALOR (que exige vírgula e 2 decimais), então o parser trataria "1" como se fosse um novo RÓTULO (linha 2933) e não como valor.

**[resumo-08] Bloco OUTRAS INFORMAÇÕES da Evolução Patrimonial: 12 dos 14 rótulos impressos são descartados**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:2951`
- Trecho: `'Rendimentos isentos e não tributáveis': 'rendimentosIsentosOficial',   'Rendimentos sujeitos à tributação exclusiva/definitiva': 'rendimentosExclusivoOficial',`
- Prova no PDF: AJU-01: "p41 r11 y=666 | [x=20.0]Rendimentos tributáveis - imposto com exigibilidade suspensa [x=532.4]26.413,87", "p41 r12 y=655 | [x=20.0]Depósitos judiciais do imposto [x=532.4]11.415,89", "p41 r15 y=622 | [x=20.0]Total do imposto retido na fonte (Lei nº11.033/2004), conforme dados informados pelo contribuinte [x=543.5]111,71", "p41 r16 y=610 | [x=20.0]Imposto pago sobre Renda Variável [x=536.9
- Saida observada: AJU-01.json impostoDevido traz, desta página, apenas rendimentosIsentosOficial:45523.7, rendimentosExclusivoOficial:142197.69 e os 4 campos de evolução patrimonial. As strings "26413.87", "11415.89", "13824.36", "862.82", "1670.93", "1201.44" e "111.71" não aparecem em NENHUM lugar do resultado do A
- Saida esperada: impostoDevido com os demais totais oficiais da página, em especial rendimentosExigibilidadeSuspensa=26413.87, depositosJudiciais=11415.89, impostoDevidoGanhosCapital=13824.36, impostoDevidoRendaVariavel=862.82, impostoPagoRendaVariavel=1670.93, irrf1
- Consequencia: Os 26.413,87 de rendimentos com exigibilidade suspensa e os 11.415,89 de depósitos judiciais não têm outra fonte no documento: são exclusivos desta página e somem por inteiro. Os 13.824,36 de imposto devido sobre Ganhos de Capital e os 862,82 de Renda Variável são o gabarito oficial contra o qual as fichas detalhadas de GC e RV deveriam ser conferidas, e sem eles nenhuma conferência é possível — inclusive porque esse imposto NÃO está dentro do impostoDevidoTotal (36.658,91) que o app exibe, então o app subdeclara o imposto total da declaração sem sinalizar.

**[resumo-09] O catálogo declara a ficha do Resumo como 'estruturada', então nenhum aviso é emitido apesar de 41 dos 58 valores impressos serem descartados**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `src/irpf/catalogoFichasPdf2026.js:69`
- Trecho: `ficha('resumo', 'Resumo da declaração e evolução patrimonial', 'estruturada', ['RESUMO', 'EVOLUÇÃO PATRIMONIAL']),`
- Prova no PDF: Contagem sobre AUDITORIA/rows-pdfjs/AJU-01.rows.txt, páginas 40 e 41: 58 pares rótulo+valor impressos; 17 viram campo (p40 r7, r8, r12, r19, r21, r26, r29 dois valores, r35, r37, r52; p41 r4, r5, r6, r7, r9, r10). Exemplo de descarte silencioso: "p40 r11 y=667 | [x=20.0]Resultado tributável da Atividade Rural [x=528.0]120.529,23"
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json estadoFichas['pdf:resumo'] = {"estado":"parcial","suporte":"estruturada","presenca":"preenchida",...} e AJU-01.json avisosImportacao não contém nenhum aviso sobre o Resumo. Compare com estadoFichas['pdf:imposto-pago-retido'], que declara "suporte":"parcial".
- Saida esperada: Ou a ficha lê todos os valores, ou o suporte é declarado 'parcial' e o app avisa o usuário, como faz o mecanismo de fichasNaoLidasComConteudo (importParsers.js:4997-5001: 'A ficha X tem informação nesta declaração e NÃO foi importada')
- Consequencia: O usuário recebe a ficha do Resumo marcada como totalmente estruturada e não é avisado de que 41 valores oficiais impressos (incluindo o imposto a restituir, a atividade rural, o imposto sobre ganhos de capital e todas as deduções detalhadas) ficaram de fora. É a diferença entre um dado que se sabe faltar e um dado que se supõe presente — este segundo é o que leva a decidir com número errado.

**[resumo-10] Modelo simplificado: o ramo /DESCONTO SIMPLIFICADO/ e o campo descontoSimplificado do caminho .DBK não têm equivalente no caminho PDF**
- Severidade baixa, confianca do auditor: nao-verificado. Refutacao: sem painel.
- Codigo: `src/pages/importParsers.js:3780`
- Trecho: `if (row.cells.some(c => /DEDUÇÕES LEGAIS/i.test(c.text))) impostoDevido.modeloDeclaracao = 'completa';         else if (row.cells.some(c => /DESCONTO SIMPLIFICADO/i.test(c.text))) impostoDevido.modeloDeclaracao = 'simplificada';`
- Prova no PDF: Os três PDFs disponíveis são todos completa: "p40 r3 y=769 | [x=17.0]RESUMO [x=171.5]TRIBUTAÇÃO UTILIZANDO AS DEDUÇÕES LEGAIS" (AJU-01), idem "p7 r3" no ESP-01 e "p8 r3" no SAI-01. Nenhum PDF simplificado disponível para conferir o texto real do cabeçalho nem o layout do bloco DEDUÇÕES da simplificada. Cobertura: grep -n 'descontoSimplificado' src/pages/importParsers.js -> só linha 1988, dentro do
- Saida observada: Os três JSONs de saída trazem modeloDeclaracao:'completa'; o ramo 'simplificada' nunca é exercitado por estes artefatos.
- Saida esperada: Não verificável com os artefatos desta auditoria. Se o PDF simplificado imprimir um rótulo próprio (do tipo 'Desconto simplificado') no lugar da lista de deduções, ele não está em RESUMO_CAMPOS (2941-2953) e o campo descontoSimplificado, que o .DBK p
- Consequencia: Risco de assimetria entre importar o .DBK e importar o PDF de uma declaração simplificada: o .DBK cria descontoSimplificado, o PDF não tem nenhum rótulo mapeado para isso. Não é possível provar nem descartar com os três PDFs entregues — fica registrado como não verificado, e a verificação exige um PDF de declaração simplificada.


### Atividade Rural

Leitura do parser pelo auditor: A extração rural do PDF é uma máquina de estados por linha visual dentro do laço de páginas de parsePDF (3600-4950). O título "DEMONSTRATIVO DE ATIVIDADE RURAL - BRASIL" (3655) só liga a trava `pastRuralAnnex`, que impede BENS/DÍVIDAS/PAGAMENTOS comuns de reabrirem depois do anexo. Cada subficha tem gatilho próprio por igualdade EXATA via rowHasCell (2436, comparação `=== exact`): 3706 'BENS DA ATIVIDADE RURAL - BRASIL' -> section 'bensRurais'; 3711 'DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - BRASIL' -> 'imoveisRurais'; 3722 'MOVIMENTAÇÃO DO REBANHO - BRASIL' -> 'rebanho'; 3727 'RECEITAS E DESPESAS - BRASIL' -> 'receitasDespesasRurais'; 3732 'APURAÇÃO DO RESULTADO - BRASIL' -> 'apuracaoRural' (e já cria o objeto de saída); 3802 'DÍVIDAS VINCULADAS À ATIVIDADE RURAL - BRASIL' -> 'dividasRurais'. Os handlers ficam em 4145-4202 (bens/dívidas: item novo exige primeira célula numérica mais 2 ou 3 valores RV_VALOR; 'TOTAL' fecha a seção; linha sem valor concatena discriminação, inclusive atravessando página), 4203-4271 (imóveis: exige `/^\\d{2}$/` na célula 0 E uma célula casando AR_CIB `/^\\d{7}-\\d$/`; 'PARTICIPANTE(S)' liga o modo participantes; participante casa AR_PARTICIPANTE, que exige CPF entre parênteses no fim), 4272-4288 (rebanho: casa a espécie por prefixo em AR_ESPECIES e mapeia os 6 valores POSICIONALMENTE em AR_REBANHO_COLUNAS, descartando espécie toda zerada), 4289-4309 (receitas/despesas: mês por AR_MESES.indexOf, 2 primeiros valores; 'TOTAL' fecha) e 4310-4321 (apuração: paresRotuloValor liga cada valor ao rótulo imediatamente à esquerda e mapeia por AR_APURACAO_CAMPOS, mais os dois regex de adiantamento). Não existe nenhum gatilho, seção ou coleção para a versão "- EXTERIOR": os seis títulos do exterior só aparecem em FICHAS_NAO_LIDAS (3057-3063), que fecha a seção corrente e emite aviso. Simulei o parser row a row sobre AJU-01 p11-p14 e ESP-01/SAI-01 p4-p5, e a simulação bate com AUDITORIA/saida-parsepdf em todos os pontos, incluindo os quatro defeitos reportados.

**[rural-01] Imóvel rural explorado só é reconhecido se a linha tiver CIB; sem CIB a ficha inteira é descartada**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:4217`
- Trecho: `const cib = cells.find(c => AR_CIB.test(c.t));         // Linha de imóvel: código da atividade na primeira célula e CIB na         // última. Exigir o CIB evita confundir com linha de participante.         if (/^\d{2}$/.test(cells[0].t) && cib) {`
- Prova no PDF: p11 r7 y=703 | [x=32.5]11 [x=87.5]75,00 [x=189.3]2 [x=262.6]AJU RUR FAZENDA BRASIL SENTINELA, [x=449.0]123,4   (a coluna CIB existe no cabeçalho — p11 r5 y=732 | ... [x=521.8]CIB — mas vem VAZIA; `grep -nE "[0-9]{7}-[0-9]" AUDITORIA/rows-pdfjs/AJU-01.rows.txt` não retorna nada em todo o PDF)
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "imoveisRurais": [] ; log "[success] Atividade Rural: 0 imóvel(is) explorado(s), 1 bem(ns), 1 dívida(s) vinculada(s), 1 participante(s) e 1 espécie(s) no rebanho" ; estadoFichas "pdf:rural-brasil-identificacao" = {"estado":"erro","presenca":"indeterminada","moti
- Saida esperada: 1 imóvel explorado: codigoAtividade '11', participacao 75, condicaoExploracao '2', nomeLocalizacao 'AJU RUR FAZENDA BRASIL SENTINELA, ESTRADA AJU RURAL KM 22 - UBERABA/MG - CEP 38000-000', area 123,4, cib vazio
- Consequencia: Toda a ficha "Dados e identificação do imóvel explorado - Brasil" é perdida (código da atividade, percentual de participação, condição de exploração, nome/localização e área) sempre que o CIB não estiver impresso — situação corriqueira, já que o CIB não é preenchido em toda declaração e as linhas de continuação do nome (p11 r8 e r9) também caem fora por dependerem de `ultimoImovelRural`. O usuário fica sem nenhum imóvel rural importado e sem aviso de importação (a lista avisosImportacao do AJU-01 não menciona esta ficha), só com um estado interno 'erro'.

**[rural-02] Participante rural é gravado sem vínculo ao imóvel (imovelId/imovelCib/imovelNome nulos ou vazios)**
- Severidade alta, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:4256`
- Trecho: `imovelId: ultimoImovelRural ? ultimoImovelRural.id : null,               imovelCib: ultimoImovelRural ? ultimoImovelRural.cib : '',               imovelNome: ultimoImovelRural ? ultimoImovelRural.nomeLocalizacao : '',               imovelChaveImportacao: ultimoImovelRural ? ultimoImovelRural.chaveIm`
- Prova no PDF: p11 r10 y=662 | [x=143.0]PARTICIPANTE(S) p11 r11 y=644 | [x=143.0]AJU RUR PARTICIPANTE UM (222.333.444-05) [x=457.0]Estrangeiro: Não
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "participantesRuraisOficial": [{"nome": "AJU RUR PARTICIPANTE UM", "cpf": "22233344405", "imovelId": null, "imovelCib": "", "imovelNome": "", "imovelChaveImportacao": "", ...}]
- Saida esperada: participante 'AJU RUR PARTICIPANTE UM' vinculado ao imóvel impresso logo acima (p11 r7), com imovelId=1 e imovelNome='AJU RUR FAZENDA BRASIL SENTINELA, ...'
- Consequencia: O ÚNICO dado que o PDF entrega e o .DBK não (o vínculo participante→imóvel, como o próprio comentário do código em 4247-4255 declara ser o objetivo) é perdido em silêncio: fica um participante órfão, sem indicação de a qual imóvel ele pertence, e sem aviso. Causa raiz é o rural-01 (o imóvel nunca é criado porque falta CIB), mas o efeito é independente: o código grava o registro com o vínculo nulo em vez de sinalizar a inconsistência.

**[rural-03] "Opção pela forma de apuração do resultado tributável" é impressa no PDF e ignorada pelo parser, embora o parser de .DBK a leia**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:2984`
- Trecho: `const AR_APURACAO_CAMPOS = {   'Saldo de prejuízo(s) a compensar de exercício(s) anterior(es)': 'saldoPrejuizoExercicioAnterior',   'Receita bruta total': 'receitaBrutaTotal',   'Despesa de custeio e investimento total': 'despesaTotal',   'Resultado': 'resultado',   'Limite de 20% sobre a receita br`
- Prova no PDF: p11 r35 y=254 | [x=16.0]Opção pela forma de apuração do resultado tributável [x=516.9]Pelo resultado
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: "apuracaoResultadoRuralOficial": {"origem":"pdf","saldoPrejuizoExercicioAnterior":7201.13,"receitaBrutaTotal":78422.22,"despesaTotal":56856.56,"resultado":21565.66,"limite20PctReceitaBruta":15684.44,"compensacaoPrejuizoAnterior":0,"resultadoTributavel":21565.66,
- Saida esperada: apuracaoResultadoRuralOficial deveria trazer a opção de apuração ('Pelo resultado'), simetricamente ao parseDBK, que grava `opcaoApuracaoResultadoTributavel: field(line, 171, 1)` (importParsers.js:1275) e cujo comentário em 1270-1274 diz textualmente
- Consequencia: O campo que decide COMO o resultado tributável foi apurado (pelo resultado efetivo ou pelo arbitramento de 20% da receita bruta) não é importado pelo caminho PDF, que é justamente o caminho onde ele vem por extenso e legível. Quem importa por PDF perde a informação; quem importa por .DBK recebe o código cru '2'. Inverte a lógica que o próprio código diz seguir ("aqui cada valor vem com o RÓTULO impresso ao lado, o que torna este o caminho confiável para nomear os campos", linhas 2979-2981). Observação de implementação: mesmo que o rótulo entrasse em AR_APURACAO_CAMPOS, `paresRotuloValor` (2924-2936) só forma par quando o texto casa RV_VALOR = /^-?[\d.]*\d,\d{2}$/, e 'Pelo resultado' não casa — a leitura exigiria tratamento próprio.

**[rural-04] Ficha "Apuração do Resultado - Brasil" impressa como "Sem Informações" é reportada como preenchida, porque o objeto é criado pelo simples título**
- Severidade media, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:3735`
- Trecho: `if (rowHasCell(row, 'APURAÇÃO DO RESULTADO - BRASIL')) {         flushAllCurrent();         section = 'apuracaoRural';         if (!apuracaoResultadoRuralOficial) apuracaoResultadoRuralOficial = { origem: 'pdf' };         continue;       }`
- Prova no PDF: ESP-01: p4 r8 y=670 | [x=17.0]APURAÇÃO DO RESULTADO - BRASIL ESP-01: p4 r9 y=651 | [x=18.0]Sem Informações (idem SAI-01: p4 r8 y=670 APURAÇÃO DO RESULTADO - BRASIL / p4 r9 y=651 Sem Informações)
- Saida observada: AUDITORIA/saida-parsepdf/ESP-01.json e SAI-01.json: "apuracaoResultadoRuralOficial": {"origem": "pdf"} (objeto sem um único campo) e estadoFichas "pdf:rural-brasil-apuracao" = {"estado":"parcial","presenca":"preenchida","motivo":"Dados estruturados, mas a ficha ainda não concluiu o gate de auditoria
- Saida esperada: apuracaoResultadoRuralOficial deveria permanecer null (nenhum par rótulo/valor foi extraído) e estadoFichas['pdf:rural-brasil-apuracao'] deveria ser {"estado":"vazia","presenca":"vazia"}, como acontece com as seis fichas rurais irmãs da mesma página
- Consequencia: Em declaração SEM atividade rural (ESP-01 e SAI-01, que imprimem "Sem Informações" nas seis fichas rurais), o app afirma que a Apuração do Resultado Rural tem dados estruturados. O objeto vazio e truthy propaga por `'rural-brasil-apuracao': Boolean(apuracaoResultadoRuralOficial)` (linha 5142), que em 5172 força `observada.presenca = 'preenchida'`, sobrescrevendo o "Sem Informações" que a fase de detecção já tinha reconhecido corretamente. Resultado: falso positivo no inventário de fichas — exatamente o risco que o comentário em 3614-3618 diz que o inventário existe para evitar — e um registro fantasma de apuração rural (todos os campos undefined) entregue ao app.

**[rural-05] Atividade Rural no EXTERIOR não tem parser algum (cobertura) — dados reais do AJU-01 ficam de fora**
- Severidade baixa, confianca do auditor: provado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:3057`
- Trecho: `const FICHAS_NAO_LIDAS = [   // Atividade Rural no EXTERIOR: cada subparte tem a irmã "- BRASIL", que é   // lida. As do exterior estão "Sem Informações" nos dois arquivos, e sem elas   // aqui o conteúdo cairia na seção rural brasileira aberta logo antes.   'DEMONSTRATIVO DE ATIVIDADE RURAL - EXTER`
- Prova no PDF: Busca vazia (prova de cobertura): `grep -n "section = 'imoveisRuraisExterior'\|section = 'rebanhoExterior'\|section = 'apuracaoRuralExterior'\|RuralExterior\|ruralExterior" src/pages/importParsers.js` -> grep-exit=1, nenhuma linha. Os únicos hits de "- EXTERIOR" (linhas 3058-3063) são a lista de ignorados, não gatilhos. Dados reais que ficam de fora, no AJU-01: p13 r7 y=705 | [x=32.5]11 [x=85.3]10
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: nenhuma coleção de rural exterior existe no retorno; estadoFichas "pdf:rural-exterior-*" = {"estado":"nao_suportada","presenca":"indeterminada","motivo":"Ficha impressa preservada no documento-fonte, mas ainda sem extração estruturada integral"} para as seis. A 
- Saida esperada: O escopo da área inclui "Brasil e exterior". As seis subfichas do exterior do AJU-01 têm conteúdo e deveriam ser extraídas (ou, no mínimo, o comentário do código deveria deixar de afirmar que estão "Sem Informações").
- Consequencia: Perda total dos números da atividade rural no exterior (receita 58.005,45, despesa 40.017,96, resultado tributável R$ 98.963,57, bem de 62.509,29, dívida de 24.511,31, rebanho de 50 cabeças). Lacuna DECLARADA e AVISADA — catálogo marca 'nao_suportada' e avisosImportacao alerta ficha a ficha — por isso é baixa e não alta: não há contaminação silenciosa dos números do Brasil. Fica ressalvado que o comentário das linhas 3055-3056 ("As do exterior estão 'Sem Informações' nos dois arquivos") está desatualizado: no AJU-01 elas têm conteúdo.

**[rural-06] Nome da espécie do rebanho é truncado quando o rótulo quebra em duas linhas visuais**
- Severidade baixa, confianca do auditor: plausivel. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:4280`
- Trecho: `const especie = AR_ESPECIES.find(([re]) => re.test(cells[0]));         if (!especie) continue;         const valores = cells.filter(t => RV_VALOR.test(t));         if (valores.length < AR_REBANHO_COLUNAS.length) continue;         const item = { especieCodigo: especie[1], especieNome: cells[0] };`
- Prova no PDF: p12 r5 y=738 | [x=15.0]Asininos, equinos [x=135.4]0,00 [x=224.4]0,00 [x=305.4]0,00 [x=393.4]0,00 [x=462.4]0,00 [x=533.4]0,00 p12 r6 y=727 | [x=15.0]e muares (mesma quebra no exterior: p13 r39 y=175 | [x=15.0]Asininos, equinos ... / p13 r40 y=164 | [x=15.0]e muares)
- Saida observada: Não observável nos três PDFs: em AJU-01 a espécie 04 está inteiramente zerada e o filtro da linha 4285 (`if (AR_REBANHO_COLUNAS.some(c => item[c] !== 0))`) a descarta; movimentacaoRebanhoOficial traz apenas {"especieCodigo":"01","especieNome":"Bovinos e bufalinos", ...}, cujo rótulo cabe em uma linh
- Saida esperada: especieNome 'Asininos, equinos e muares' (o rótulo impresso completo da espécie 04)
- Consequencia: Numa declaração com asininos/equinos/muares em movimento, o registro é gravado com o nome cortado ('Asininos, equinos'), e a linha de continuação 'e muares' cai no `if (!especie) continue;` da linha 4277. O código da espécie ('04') sai correto, então o impacto é de rótulo exibido, não de valor. Não classificado como provado porque nenhum dos três PDFs tem essa espécie com movimento.

**[rural-07] Participante rural sem CPF (estrangeiro) é descartado em silêncio, e o campo "Estrangeiro" impresso é ignorado**
- Severidade baixa, confianca do auditor: nao-verificado. Refutacao: sem painel.
- Codigo: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/src/pages/importParsers.js:3015`
- Trecho: `const AR_PARTICIPANTE = /^(.+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)$/;`
- Prova no PDF: p11 r11 y=644 | [x=143.0]AJU RUR PARTICIPANTE UM (222.333.444-05) [x=457.0]Estrangeiro: Não
- Saida observada: AUDITORIA/saida-parsepdf/AJU-01.json: {"nome":"AJU RUR PARTICIPANTE UM","cpf":"22233344405","imovelId":null,"imovelCib":"","imovelNome":"","imovelChaveImportacao":"","origemDocumento":{...}} — nenhum campo de estrangeiro
- Saida esperada: O parser deveria registrar também a marca de estrangeiro impressa na própria linha, e não depender do CPF entre parênteses para reconhecer o participante
- Consequencia: A ficha imprime o indicador "Estrangeiro" justamente porque existe participante sem CPF brasileiro. Para esse caso, `AR_PARTICIPANTE.exec` não casa, o `if (m)` da linha 4245 não entra e a linha vira `continue` na 4263: o participante desaparece do resultado sem nenhum aviso e sem entrar em nenhum contador. Não verificado: os três PDFs só têm participante com CPF ('Estrangeiro: Não'), então não há como observar a variante estrangeira na saída real.


### Renda Variavel, FII e Fiagro

Esta area nao chegou a ter auditor de workflow (corte de limite de uso) e foi auditada diretamente, com
execucao instrumentada do parser. Os dois achados estao na secao 3.1, e o que foi verificado como correto
esta nos itens 1 e 2 da secao 4. Resumo:

**[rv-01] Row orfa com a cell `MÊS` zera `fiiMesesColuna` e desliga o resto do quadro**
- Severidade alta, confianca provado. Reverificado pessoalmente com log de execucao.
- Codigo: `src/pages/importParsers.js:4881`
- Consequencia: da row orfa em diante, todo o quadro de FII/Fiagro e descartado.

**[rv-02] Linha de valores sem rotulo, porque o rotulo foi quebrado em duas rows**
- Severidade alta, confianca provado. Reverificado pessoalmente.
- Codigo: `src/pages/importParsers.js:4889-4891`
- Consequencia: mesmo corrigido o rv-01, `RESULTADO LÍQUIDO DO MÊS`, `RESULTADO NEGATIVO ATÉ O MÊS ANTERIOR`,
  `BASE DE CÁLCULO DO IMPOSTO` e `IMPOSTO RETIDO MESES ANTERIORES` continuam perdidos.

**[rv-03] A perda nao gera aviso**
- Severidade media, confianca provado.
- A ficha nao esta em `FICHAS_NAO_LIDAS`, entao nao cai na rede de seguranca de `importParsers.js:3893-3922`.
  O unico rastro e `estadoFichas['pdf:fii-fiagro-titular'].estado === 'erro'`, agregado num contador anonimo
  em `src/pages/Dashboard.jsx:208-222`.

## Nota sobre a suite de testes

`npx vitest run` em 31/08/2026: 475 passaram, 1 pulado, **2 falharam**. As duas falhas sao PRE-EXISTENTES e
independentes desta auditoria, ambas em `src/irpf/pdfSinteticoAju01.audit.test.js`, que fixa a identidade de
uma versao ANTERIOR do AJU-01:

- `expect(hash).toBe('5e71e83a…')` recebe `d2e30620…`;
- `expect(paginas).toHaveLength(33)` contra as 41 paginas do arquivo atual.

Ou seja, o teste ficou preso ao PDF anterior a reimpressao. Ele precisa ser reancorado no arquivo atual antes
de voltar a servir como prova de cobertura. Os dois arquivos criados por esta auditoria
(`src/irpf/dumpRowsPdfjs.audit.test.js` e `src/irpf/dumpParsePdf.audit.test.js`) passam.

---

# Parte II. Correção dos quatro achados mais graves

Data: 31/08/2026. Tratados um a um, cada um com teste de regressão que roda contra os PDFs sintéticos
versionados. Testes novos em `src/pages/importParsersPdfSintetico.test.js`, 33 casos.

Método de prova adotado em todos: depois de corrigir, a correção foi REVERTIDA e a suíte rodada de novo.
Uma correção só conta como coberta se a reversão dela faz teste falhar. Os números abaixo são desse
experimento.

## II.1 FII e Fiagro (era a secao 3.1)

Eram TRES defeitos no mesmo bloco, e nao dois. O terceiro so apareceu ao corrigir os dois primeiros: se
tivessem sido corrigidos sozinhos, a ficha passaria a extrair dado ERRADO em vez de dado nenhum, o que e
pior. Registrado aqui porque contraria o que a Parte I dizia.

| Defeito | Onde | Correção |
|---|---|---|
| a. Row órfã com a única cell `MÊS` (rabo do rótulo `RESULTADO LÍQUIDO DO MÊS`) era aceita como cabeçalho de quadro e zerava `fiiMesesColuna`, desligando todo o resto | `importParsers.js`, gatilho de cabeçalho da seção `fiiFiagro` | a troca só acontece quando a linha realmente traz nome de mês |
| b. Rótulo quebrado em três linhas visuais deixava a linha de valores sem rótulo | mesmo bloco | acumula os pedaços de rótulo e segura a linha de valores até o rótulo fechar |
| c. NOVO, não estava na Parte I: o bucket por coordenada (`col.x <= celula.x + 40`) atribuía o valor de JANEIRO a FEVEREIRO | mesmo bloco | quando a linha traz um valor por coluna, o casamento é pela ORDEM; o bucket por x fica de reserva |

Prova do defeito (c), com os x reais de AJU-01 p37: valor de janeiro em x=189,4 e âncora de fevereiro em
x=229,1, dentro da tolerância de 40. Janeiro ia para fevereiro e era sobrescrito pelo valor de fevereiro
logo em seguida.

Resultado: `fiiFiagroMensalOficial` sai de 0 para 9 meses (8 do titular, 1 do dependente), conferidos campo
a campo contra p37 e p38, e `fiiFiagroAnualOficial` deixa de ser null. `estadoFichas['pdf:fii-fiagro-titular']`
sai de `erro` para `parcial`.

Incluído junto, por ser o mesmo registro: o CPF impresso no subtítulo da ficha dos dependentes passa a ser
gravado. Sem ele, dois dependentes diferentes cairiam na mesma chave em `ultimosPorBeneficiario`.

Cobertura: revertendo (a), 7 de 10 testes falham; revertendo (b), 6; revertendo (c), 1.

## II.2 Título de ficha quebrado em duas linhas (era a secao 3.2)

Correção de causa raiz, e não da ficha uma a uma: o formulário quebra o título quando ele não cabe na
largura da ficha, e o PONTO DO CORTE muda de declaração para declaração. A mesma ficha de exigibilidade
suspensa dos dependentes sai cortada em `(IMPOSTO COM` no AJU-01 e em `(IMPOSTO COM EXIGIBILIDADE` no
ESP-01 e no SAI-01.

Correção da Parte I: o padrão de `rendimentos-exigibilidade-dependentes` em `catalogoFichasPdf2026.js`
NÃO é um truncamento por engano, como a secao 2.1 deu a entender. Ele está ajustado ao corte do ESP-01 e
do SAI-01, onde funciona. O que falta é cobrir o outro corte. Pelo mesmo motivo, `FICHAS_NAO_LIDAS_PREFIXO`
já existia para este problema, mas com a comparação na direção errada: a entrada da lista é MAIS LONGA do
que o texto impresso no AJU-01, então `t.startsWith(p)` nunca é verdadeiro ali.

O que foi feito:

1. `ehPrefixoDeFichaPdf2026` no catálogo: responde se um texto é o começo de algum título conhecido.
2. Emenda com as linhas seguintes nos dois pontos que casam título, o do catálogo e o da rede de segurança.
   A janela é de DUAS linhas, não uma: em AJU-01 p6 o `(Valores em Reais)` cai numa row própria ENTRE as
   duas metades do título, porque o formulário o desenha 3 unidades fora da base, acima da tolerância de 2
   de `buildRows`.
3. A linha que fecha o título é marcada como consumida. Sem isso o `DEPENDENTES` que fecha o título de RRA
   dos dependentes casa por igualdade exata com a ficha DEPENDENTES e desvia `fichaPdfAtual` no meio da
   tabela de RRA.
4. A ficha de exigibilidade suspensa dos DEPENDENTES foi acrescentada a `FICHAS_NAO_LIDAS`, onde faltava.

Resultado no AJU-01: fichas reconhecidas sobem de 41 para 44, e as quatro fichas de rendimento que vinham
preenchidas passam a gerar aviso nominal, de 9 para 12 fichas avisadas.

Escopo, explícito: estas fichas são `nao_suportada` no catálogo, ou seja, o app não modela esses
rendimentos. A correção transforma perda SILENCIOSA em perda AVISADA. Ela NÃO importa os valores, e há um
teste que fixa isso para que ninguém leia o aviso como se o dado tivesse entrado.

Cobertura: com a janela de emenda em 0, 6 de 21 testes falham; com a janela em 1, 2 falham.

## II.3 Imóvel rural sem CIB (era a secao 3.3)

O CIB é a inscrição do imóvel no cadastro da Receita e a coluna vem vazia quando não foi preenchida. Ele
deixou de ser obrigatório para reconhecer a linha. O que passou a discriminar a linha de imóvel da linha de
participante é o código de atividade de 2 dígitos sozinho na primeira célula, mais a forma da linha: pelo
menos dois números além do código e pelo menos um texto. A linha de participante começa pelo NOME, então
não colide.

`chaveImportacao` e o campo `cib` passam a aceitar CIB vazio.

Resultado: `imoveisRurais` sai de 0 para 1, com nome e localização remontados das três linhas, e o
participante deixa de ser órfão, ganhando `imovelId`, `imovelNome` e `imovelChaveImportacao`. É o vínculo
que o comentário do próprio arquivo diz ser o que o PDF entrega e o `.DBK` não.

Cobertura: revertendo, 4 de 25 testes falham. O caminho COM CIB continua coberto pelos testes contra as
declarações reais de `importParsers.test.js`, que seguem verdes.

## II.4 Dívidas: valor abaixo de R$ 1.000,00 na coluna errada (era a secao 3.6)

A leitura das três colunas de valor saiu para uma função pura exportada, `valoresDaLinhaDeDivida`, e passou
a ser feita pela ORDEM das células quando a linha traz exatamente três valores monetários à direita da
fronteira entre DISCRIMINAÇÃO e a primeira coluna de valor. Fora desse caso, cai no bucket por coluna, que é
o comportamento antigo.

É a mesma escolha que o arquivo já fazia em `separarRotuloEValores` para a ficha de Renda Variável, e pelo
mesmo motivo: número alinhado à direita não pode ser bucketado pelo x de início.

Como este defeito NÃO é exercitado pelos três PDFs, o teste reconstrói a geometria real. As três bordas
direitas (val1 373,9, val2 486,9, pago 573,9) e a largura de 4,5 por glifo foram derivadas dos seis valores
reais da ficha, e o teste começa provando que essa geometria reproduz os seis x do documento exatamente.
Sobre ela, os casos abaixo de mil reais.

Cobertura: revertendo, 5 de 33 testes falham, incluindo os três casos abaixo de mil reais.

Nota de escopo: a ficha de BENS tem a mesma estrutura de número alinhado à direita, mas foi medida e está
folgada nesta geometria (borda direita da primeira coluna de valor em 409,2 contra fronteira em 443,5, cerca
de 7 glifos de margem). Não foi alterada.

## II.5 O que continua aberto

As correções acima cobrem os quatro achados mais graves. Seguem abertos, entre outros do apêndice:

- 3.4, ganho de capital: quatro defeitos, sendo o mais grave o valor de alienação da participação societária
  gravado no campo de corretagem.
- 3.5, bens: titularidade cravada em Titular, país cravado em Brasil, bloco de herdeiros perdido e o texto
  do bem poluído com um cabeçalho de coluna e dois CPFs.
- 3.7, doações: três das quatro fichas nunca são lidas. É o que sobrou como `estado: 'erro'` em
  `estadoFichas` depois destas correções (`doacoes-eleitorais`, `doacoes-eca`, `doacoes-idoso`).
- 3.8, identificação: endereço no exterior perdido no SAI-01, e os blocos de espólio e de saída sem parser.
- 3.9, resumo: `IMPOSTO A RESTITUIR` estruturalmente inalcançável e a maioria dos rótulos sem campo.

## II.6 Estado da suíte

`npx vitest run` depois das quatro correções: **508 passaram, 1 pulado, 2 falharam**. As duas falhas são as
mesmas de antes desta auditoria, em `src/irpf/pdfSinteticoAju01.audit.test.js`, que fixa o hash e as 33
páginas de uma versão anterior do AJU-01 (o arquivo atual tem 41). Nenhuma correção desta Parte II mexeu
nelas, e elas precisam ser reancoradas no arquivo atual.

---

# Parte III. Resolução COMPLETA de todos os achados

Data: 31/08/2026. Todos os 51 achados do relatório foram resolvidos, um a um, com
teste de regressão contra os PDFs sintéticos e prova por reversão. Estado final da
suíte: **561 passam, 1 pulado, 0 falhas**. O teste `pdfSinteticoAju01.audit.test.js`
foi reancorado no arquivo atual (hash e 41 páginas) e suas asserções obsoletas
atualizadas para a realidade do documento reimpresso.

Testes novos: `src/pages/importParsersPdfSintetico.test.js`, 86 casos.
Mapa com status por achado (todos [x]): `AUDITORIA/MAPA-RESOLUCAO.md`.

## Ganho de Capital (gc-01 a gc-12)
- gc-02/gc-03: "Especificação e endereço" (multi-linha) e "Data de Aquisição:"/
  "Custo de aquisição (R$):" (rótulo:valor na mesma linha) do imóvel.
- gc-06: variantes "da Alienação" (com "da") no quadro do imóvel.
- gc-07: os cinco Resultado e as reduções Lei 7.713/Lei 11.196 FR1/FR2/Outro Imóvel,
  cada um em campo próprio (antes colidiam por prefixo).
- gc-08: tabela de faixas de tributação (forma do registro 75 do .DBK).
- gc-01: participação — corretagem deixou de receber o valor de alienação (3 colunas).
- gc-10: espécie da participação (branch de Natureza consumia a linha).
- gc-11: município e UF da sociedade por coluna.
- gc-09: quadro CUSTO DE AQUISIÇÃO da participação (espécie, quantidade, custo médio/total).
- gc-05: bloco "CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA".
- gc-12: data da última parcela na alienação a prazo.
- gc-04: alienação detalhada de moeda estrangeira em espécie (o cabeçalho exigido
  não existe no PDF; layout real lido por blocos rótulo/valor).

## Resumo e Cálculo (resumo-01 a resumo-10)
- resumo-01: IMPOSTO A RESTITUIR (valor na linha seguinte, Δy=3).
- resumo-02: evolução patrimonial de espólio (partilha) e saída (não residente),
  casada por início do rótulo e ordem, sem depender do texto da data.
- resumo-03/04/05/06/08: decomposição de rendimentos, deduções (incl. rótulo em duas
  linhas), cálculo do imposto devido, componentes do imposto pago e outras informações
  — 22 valores conferidos contra o impresso, chaves de impostoDevido de 20 para 61.
- resumo-07: valor da quota e número de quotas (inteiro).
- resumo-09/10: a ficha passou a ser lida integralmente; simplificada não é verificável
  nestes PDFs (documentado).

## Rendimentos (rend-01 a rend-08)
- rend-01/02/03/04: exigibilidade suspensa, RRA e carnê-leão — perda silenciosa virou
  AVISO nominal (Parte II); confirmado que todos avisam.
- rend-05: continuação do cabeçalho ("Pagadora") não polui mais a descrição.
- rend-06: nome da fonte e descrição são campos separados (código 99), lidos por coluna.
- rend-07: documento do doador (código 14) vai para cnpj_fonte, não para o nome.
- rend-08: 13º dos dependentes marcado como do dependente.
- Prêmios de loteria (só coluna Descrição) preservados como nome_fonte.

## Atividade Rural (rural-01 a rural-07)
- rural-01/02: imóvel sem CIB e vínculo do participante (Parte II).
- rural-03: opção pela forma de apuração do resultado (valor de texto).
- rural-04: ESP/SAI sem atividade rural deixam de reportar a Apuração como preenchida
  (objeto nasce só quando um valor é lido).
- rural-05: atividade rural no exterior — AVISO (confirmado).
- rural-06: nome da espécie do rebanho completo (junta a continuação).
- rural-07: participante estrangeiro sem CPF é lido, com a marca de estrangeiro.

## Bens (bens-01 a bens-09) e Doações/Pagamentos e Dívidas
Ver Parte II para Bens, Doações/Pagamentos, FII, título quebrado, imóvel rural e
dívidas < R$ 1.000. Acrescido nesta Parte III:
- dividas-03: a discriminação da dívida passou a ser lida por coluna até a primeira
  coluna de valor, preservando texto justificado empurrado para a direita.

## Método de prova (reafirmado)
Cada correção foi revertida e a suíte rodada de novo; só conta como coberta se a
reversão quebra teste. Regressões pegas e corrigidas no caminho: o teste real de
Isentos/Exclusiva do 2º contribuinte (prêmios de loteria) e a fixture de doações
pós-anexo-rural (layout antigo, agora aceito como fallback).
