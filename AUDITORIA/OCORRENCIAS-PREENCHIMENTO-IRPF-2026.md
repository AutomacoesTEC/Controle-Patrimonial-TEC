# Ocorrências do preenchimento manual/sintético IRPF 2026

Declaração sintética: `AJU-01` / `AUDITORIA PDF TEC AJUSTE` / CPF `111.444.777-35`.

Data da execução: `2026-08-29`.

## Validação final no PGD

- `Total de Erros: 0`.
- `Total de Avisos: 2`.
- Aviso 1: `Bens e Direitos` — o campo indicativo `Banco` não foi informado no item nº 3. O roteiro traz `AJU BANCO SENTINELA`, mas o campo oficial é codificado e não aceitou banco sintético textual.
- Aviso 2: `Dados e Identificação do Imóvel Rural - BRASIL` — o campo indicativo `CIB` não foi informado no item nº 1. O roteiro determina preencher somente se o programa aceitar identificador sintético; foi mantido em branco e anotado.

## Ajustes aplicados para zerar erros

- `Alimentandos`: a confirmação dos requisitos legais foi gravada com o valor oficial `S`, pois `1` não era reconhecido pelo PGD.
- `Pagamentos Efetuados`: os vínculos dos itens de dependente/alimentando foram ajustados para os nomes cadastrados (`AJU PES DEPENDENTE UM` e `AJU PES ALIMENTANDO UM`), não apenas CPF.
- `RRA`: preenchido o quadro auxiliar de pensão alimentícia para titular e dependente, vinculando `AJU PES ALIMENTANDO UM`.
- `Bens e Direitos`: o RENAVAM textual `AJU220022` foi recusado; usado RENAVAM sintético numérico validado pelo PGD: `26262603903`.
- `Atividade Rural Brasil`: a condição de exploração foi ajustada para `Condomínio` para compatibilizar participação `75,00%` do titular com participante de `25,00%`; a opção `Propriedade única ou Posse` exige `100%` no PGD.
- `Rendimentos Isentos`: a linha de parcela isenta de aposentadoria 65+ (`10.501,71`) não foi lançada, pois o titular sintético nasceu em `11/01/1980` e o PGD acusa erro para beneficiário menor de 65 anos.

## Itens não preenchidos ou absorvidos por limitação da ficha oficial

- `Atividade Rural Brasil`: despesas e investimentos mensais foram somados no campo único oficial `despesaCusteioInvestimento`.
- `Atividade Rural Brasil`: perdas de rebanho não foram lançadas; o objeto oficial exposto possui consumo, vendas e estoque, sem campo próprio de perdas.
- `Atividade Rural Exterior`: receitas/despesas foram consolidadas por país, pois a estrutura oficial exposta não separa mês a mês nessa ficha.
- `Rendimentos PJ com exigibilidade suspensa`: os campos de previdência, pensão e IRRF não ficaram expostos na estrutura oficial usada; foram mantidos fora e anotados.
- `RRA`: despesas com ação judicial não tiveram campo próprio exposto no objeto oficial; não foram improvisadas.
- `Doações diretamente na declaração ECA/Idoso`: não foram criadas para evitar qualquer geração de DARF ou fluxo de pagamento.
- `GCAP 2025`: não foi importado, pois exigiria execução/importação específica do GCAP; os itens foram anotados como não preenchidos.
- `Demais rendimentos e transportes`: os valores principais foram lançados na ficha de Rendimentos de PF/Exterior conforme estrutura disponível.

## Geração do PDF textual - 2026-08-30

- Declaração confirmada visualmente no PGD: `AJU-01` / `AUDITORIA PDF TEC AJUSTE` / CPF `111.444.777-35`, tipo `Original`, declaração de ajuste anual.
- Estado salvo confirmado no PGD antes da impressão: rodapé exibiu `Informações salvas às 09:16:15`.
- Método usado: janela oficial `Impressão` do IRPF 2026, opção `Toda a declaração` com `Visualizar`, seguida do botão de salvar da própria prévia `Declaração`. Não foi usada a impressora `Microsoft Print to PDF`.
- Arquivo gerado primeiro em pasta temporária local e copiado para `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`.
- Validação independente com `pypdf`: arquivo abriu sem senha, possui `33` páginas, `33` páginas com texto extraível e `46.964` caracteres extraídos.
- Validação visual: a página 1 foi renderizada com `pdftoppm` em `tmp/pdfs/AJU-01-final-page-01.png` e conferida como legível, sem corte ou página em branco.
- Sentinelas encontrados na camada de texto: `AUDITORIA PDF TEC AJUSTE`, `AJU PES DEPENDENTE UM`, `AJU RRA TITULAR EXCLUSIVA`, `AJU BEM IMOVEL`, `AJU RUR FAZENDA`, `AJU RUE FARM`.
- Seções textuais encontradas: `RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - TITULAR`, `RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - DEPENDENTES`, `FUNDOS DE INVESTIMENTO IMOBILIÁRIO OU NAS CADEIAS PRODUTIVAS AGROINDUSTRIAIS - TITULAR` e `FUNDOS DE INVESTIMENTO IMOBILIÁRIO OU NAS CADEIAS PRODUTIVAS AGROINDUSTRIAIS - DEPENDENTES`.
- Proibições preservadas: não houve transmissão, acesso ao gov.br, geração/emissão de DARF, pagamento ou alteração de declarações reais. O aplicativo IRPF permaneceu aberto.

## Reauditoria visual - Exigibilidade Suspensa e RRA - 2026-08-30

- Identidade reconfirmada visualmente antes da inspeção: `AUDITORIA PDF TEC AJUSTE`, CPF sintético `111.444.777-35`, declaração de ajuste anual.
- `Exigibilidade Suspensa - titular`: lançamento existente conferido no formulário oficial com fonte `AJU EXI FONTE TITULAR`, CNPJ `55.566.677/0001-83`, rendimento `17.701,91` e depósito judicial `7.702,92`. O formulário não exibe campos de previdência oficial, pensão alimentícia ou IRRF; nenhum valor foi improvisado.
- `Exigibilidade Suspensa - dependente`: lançamento existente conferido com `AJU PES DEPENDENTE UM`, fonte `AJU EXI FONTE DEPENDENTE`, CNPJ `55.566.677/0001-83`, rendimento `8.711,96` e depósito judicial `3.712,97`. O formulário igualmente não exibe previdência, pensão ou IRRF.
- `RRA - titular`: lançamento `AJU RRA TITULAR EXCLUSIVA` conferido em `Exclusiva na Fonte` com rendimento `31.801,01`, previdência `3.802,02`, pensão `1.803,03`, IRRF `4.804,04`, mês de recebimento `Dezembro`, número de meses `11,0` e imposto devido RRA calculado `0,00`. Não há campo próprio de despesas com ação judicial nessa tela.
- `RRA - dependente`: lançamento `AJU RRA DEPENDENTE AJUSTE` conferido em `Ajuste Anual` com rendimento `9.811,06`, previdência `812,07`, pensão `313,08`, IRRF `914,09` e mês de recebimento `Dezembro`. Nessa opção o PGD não exibe número de meses nem despesas judiciais.
- Nenhum lançamento foi criado, duplicado ou alterado: os quatro registros já continham todos os campos efetivamente expostos pelo PGD. A declaração permaneceu salva e o aplicativo continuou aberto.
- PDF textual reexportado para `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`; SHA-256 `bc236570063e28165c2b067896e88436b51121787b8d40fcef9e76100dd73b10`.
- Validação independente da reexportação: `33` páginas, texto extraível nas `33`, `46.964` caracteres, sentinelas das duas fichas e dos dois beneficiários presentes. O texto extraído é idêntico ao PDF anterior; a diferença de hash decorre da nova exportação/metadados do arquivo.
- Inspeção visual: miniaturas das `33` páginas sem páginas vazias ou cortes; páginas `1`, `6` e `7` renderizadas em alta resolução e conferidas. A página 6 comprova Exigibilidade Suspensa de titular/dependente e RRA do titular; a página 7 comprova RRA do dependente.
- O PDF anterior foi preservado em `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026-PRE-RRA-AUDIT-5e71e83a.pdf` (SHA-256 `5e71e83a016c51ae28789f431cbf2a9489b36348b331d8b0b0091dd7a9ec84bb`).
- Proibições preservadas: nenhuma transmissão, acesso a gov.br, emissão/pagamento de DARF ou edição de declaração real; o IRPF 2026 permaneceu aberto na declaração sintética.

## Auditoria ECA e Pessoa Idosa sem emissão de DARF - 2026-08-30

- A ficha `Doações Diretamente na Declaração` foi aberta na declaração sintética e ambas as abas (`Criança e Adolescente` e `Pessoa Idosa`) foram inspecionadas vazias.
- O próprio PGD exibe o aviso: serão gerados DARFs com o CNPJ de cada fundo contemplado nas doações. Assim, salvar qualquer item para obter amostra preenchida causaria exatamente o efeito proibido pelo escopo.
- O botão `Novo` não foi acionado e nenhum fundo, CNPJ ou valor foi selecionado. Resultado: fichas identificadas e fluxo causal confirmado, mas cobertura preenchida continua aberta por incompatibilidade entre a exigência de amostra e a proibição absoluta de emitir DARF.
- Não houve emissão nem pagamento de DARF; a declaração permaneceu aberta e sem novos lançamentos nessas abas.

## Verificação de disponibilidade do GCAP 2025 - 2026-08-30

- O GCAP 2025 não estava aberto e não foi retornado entre os aplicativos instalados pelo Computer Use.
- Busca local nos diretórios de programas, Desktop e Downloads não encontrou executável, instalador ou aplicação GCAP 2025. Foi localizado somente `C:\Arquivos de Programas RFB\IRPF2026\lib-modulos\irpf-gui-gcap.jar`, componente interno de integração/importação do IRPF, que não substitui o aplicativo GCAP.
- Nenhum arquivo de importação foi fabricado e nenhum dado foi improvisado diretamente no IRPF. A criação dos casos sintéticos de imóvel, bem móvel, participação societária e moeda estrangeira permanece bloqueada até existir uma instalação local autorizada do GCAP 2025.
- Não houve download ou acesso a gov.br, conforme proibição expressa; nenhuma importação GCAP foi executada.

## Parte B do roteiro: ESP-01 e SAI-01 - 2026-08-30 (tarde)

Antes de qualquer escrita, o IRPF 2026 foi encerrado pela própria interface e as três declarações sintéticas mais o cadastro `iddeclaracoes.xml` foram copiados para `output/backup-irpf-sintetico/2026-08-30-1620/`.

### ESP-01 - nome alinhado ao roteiro

- O agente anterior gravou `AUDITORIA PDF TEC HERANCA`; o item 41 do roteiro determina `AUDITORIA PDF TEC ESPOLIO`. O nome foi alterado para o valor do roteiro e a alteração se mostrou ERRADA na verificação de pendências do próprio PGD.
- `RECUSADO|Identificacao do Contribuinte|Nome|O PGD acusa erro "Deve ser informado o nome sem a palavra ESPOLIO"; o valor do item 41 do roteiro e' incompativel com a validacao oficial|AUDITORIA PDF TEC ESPOLIO revertido para AUDITORIA PDF TEC HERANCA`.
- Conclusão: o valor `AUDITORIA PDF TEC ESPOLIO` do roteiro não pode ser usado. O nome escolhido pelo agente anterior, sem a palavra vedada, era o correto. Os sentinelas de busca da declaração de espólio continuam sendo `ESP HERDEIRO UM`, `ESP HERDEIRO DOIS`, `ESP INVENTARIANTE SENTINELA` e `ESP BEM PARTILHA SENTINELA`, nenhum deles dependente do nome do titular.
- Método: script `corrigir-nome-esp-01.groovy`, que carrega a declaração pelo modelo oficial (`DeclaracaoIRPF` + `RepositorioXMLDefault`) e grava por `repo.salvar`, de modo que o hash `.conf` é regerado pelo próprio repositório do PGD.
- O restante da ESP-01 já estava conforme o roteiro e não foi tocado: inventariante `ESP INVENTARIANTE SENTINELA` CPF `666.777.888-30`, decisão judicial `ESP-PROC-4101`, vara `41 V`, comarca `SAO PAULO`, decisão `22/12/2025`, trânsito `23/12/2025`, herdeiros `ESP HERDEIRO UM` `60,00%` e `ESP HERDEIRO DOIS` `40,00%`, bem `ESP BEM PARTILHA SENTINELA` `123.401,41`.
- `NAO_APLICAVEL|Espolio|Cartorio/Livro/Folhas|O PGD expõe partilha por decisão judicial OU por escritura pública, nunca as duas; foi mantida a decisão judicial, que habilita mais campos, conforme o roteiro|ESP CARTORIO SENTINELA, L41, F42 não lançados`.

### SAI-01 - declaração de saída definitiva criada

- Script `preencher-sai-01-sintetico.groovy`, mesma técnica do preenchimento da AJU-01: construção do objeto `DeclaracaoIRPF` pelas classes oficiais do PGD e gravação por `repo.salvar`.
- CPF sintético `999.000.111-12`, validado pelo dígito verificador e diferente de todos os anteriores. Procurador `101.202.303-64`, também sintético e inédito.
- `tipoDeclaracaoAES` = `S`, confirmado por `isSaida() = true` no próprio modelo oficial.

| Campo do roteiro | Valor gravado |
|---|---|
| Nome | `AUDITORIA PDF TEC SAIDA` |
| Data da caracterização da não residência | `24/12/2025` |
| País de destino | `249` (Estados Unidos da América) |
| Procurador | `SAI PROCURADOR SENTINELA` |
| CPF do procurador | `101.202.303-64` |
| Endereço no exterior | `AUDIT EXIT AVENUE`, nº `4201`, `SUITE 42` |
| Cidade/estado | `MIAMI / FL` (campo oficial `codigoExterior`) |
| Código postal | `33101` (campo oficial `cepExt`) |
| Telefone | DDI `1` + `3055554202` (campo oficial `telefoneExt`) |
| E-mail | `sai.auditoria@example.invalid` |
| Fonte pagadora | `SAI RPJ FONTE TITULAR`, CNPJ `55.566.677/0001-83`, rendimentos `43.201,11`, previdência `4.202,12`, IRRF `3.203,13`, 13º `3.604,14`, IRRF 13º `304,15` |
| Bem no Brasil | `SAI BEM IMOVEL BRASIL SENTINELA`, grupo `01` código `11`, matrícula `44001`, área `44,4`, aquisição `25/05/2025`, `0,00` → `144.401,41` |
| Bem no exterior | `SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD`, grupo `04` código `02`, país `249`, `24.402,42` → `35.403,43`, rendimento `2.404,44`, imposto pago `404,45` |

- Nenhum campo foi recusado pelo modelo oficial: o script terminou com `0` ocorrências de `RECUSADO` ou `NAO_EXIBIDO`.
- `AJUSTADO|Saida|Endereço no exterior|A ficha oficial Saída expõe apenas procurador, CPF, endereço do procurador, data de não residência e país; o endereço no exterior do contribuinte foi gravado nos campos `logradouroExt`/`numeroExt`/`complementoExt`/`bairroExt`/`cepExt`/`codigoExterior` da Identificação do Contribuinte, com `exterior = 1`|4201 AUDIT EXIT AVENUE, SUITE 42, MIAMI/FL, 33101`.

### Reparo do cadastro de declarações

- Ao reabrir o IRPF com a pasta `99900011112` ainda não cadastrada, o programa reconstruiu `iddeclaracoes.xml` e produziu um registro defeituoso: CPF em branco e `tipoDeclaracaoAES` = `A` para a SAI-01. Na mesma reconstrução ele zerou `dataCriacao` e `dataUltimoAcesso` de TODAS as declarações do cadastro, inclusive as reais.
- Correção aplicada com o programa fechado, por `registrar-sai-01-em-iddeclaracoes.py`: restauração do cadastro a partir do backup das `16:20` (o que devolveu as datas originais das declarações reais), aplicação do nome `AUDITORIA PDF TEC ESPOLIO` e inserção do item da SAI-01 espelhado no item do espólio, com CPF, `tipoDeclaracaoAES = S` e datas corretos.
- O hash `.conf` do cadastro foi regravado pelo método oficial `RepositorioXMLDefault.salvarHash`, não por cálculo próprio.
- Verificação após reabrir o programa: `13` itens, `0` com CPF em branco, `0` com `dataCriacao` em branco, e a SAI-01 listada como `999.000.111-12 | AUDITORIA PDF TEC SAIDA | AES=S`. O IRPF regravou o arquivo e aceitou o conteúdo.

### Limites técnicos encontrados nesta etapa

- `LIMITE|Impressão headless|Relatorio.gerarPDF|As classes oficiais de impressão (`Relatorio`, `PreenchedorFichasImpressao`) são acessíveis fora da interface, mas o preenchimento do relatório depende de um XML intermediário gerado por `ConversorMidas`, que exige a janela principal do PGD ativa. Reconstruir esse caminho produziria um PDF que não é o artefato oficial. A impressão continua sendo feita pela janela Impressão do programa|Não usado`.
- `LIMITE|Verificar pendências headless|DeclaracaoIRPF.verificarPendencias|Fora da interface o método devolve lista vazia inclusive para a AJU-01, que na tela do PGD acusa 2 avisos. A verificação de pendências só é confiável dentro do programa e não deve ser substituída pela chamada headless|Resultado headless descartado`.

## Correção das pendências e desbloqueio do ECA/Pessoa Idosa - 2026-08-30 (noite)

Base de tudo o que segue: a verificação de pendências foi feita na tela do PGD pela usuária, porque a chamada headless de `verificarPendencias` se mostrou inútil (devolve lista vazia até para a AJU-01, que na tela acusa 2 avisos).

### Achado que corrige uma decisão anterior desta auditoria

- `RECUSADO|Identificacao do Contribuinte|Nome|"Deve ser informado o nome sem a palavra ESPOLIO"|AUDITORIA PDF TEC ESPOLIO`. O valor prescrito pelo item 41 do roteiro viola uma validação do próprio PGD. O nome voltou a ser `AUDITORIA PDF TEC HERANCA`. **O roteiro está errado nesse ponto e precisa ser corrigido na origem.**

### ESP-01: 11 erros zerados

| Erro apontado pelo PGD | Campo oficial | Valor gravado |
|---|---|---|
| Nome com a palavra ESPÓLIO | `identificadorDeclaracao.nome` | `AUDITORIA PDF TEC HERANCA` |
| "Que tipo de declaração você deseja fazer?" | `identificadorDeclaracao.declaracaoRetificadora` | `0` (Original) |
| "Houve alteração de dados cadastrais?" | `identificadorDeclaracao.enderecoDiferente` | `1` |
| "Data de Nascimento" | `contribuinte.dataNascimento` | `11/01/1980` |
| "Possui cônjuge ou companheiro(a)?" | `contribuinte.conjuge` | `0` (Não) |
| "Tipo de logradouro" | `contribuinte.tipoLogradouro` | `RUA` |
| "Logradouro" | `contribuinte.logradouro` | `SENTINELA ESP PES` |
| "UF" | `contribuinte.uf` | `SP` |
| "Município" | `contribuinte.municipio` | `7107` |
| "CEP" | `contribuinte.cep` | `01001-000` |
| "Prejuízo acumulado relativo à Lei 14.754/2023" | `bens.existePrejuizoLei14754` | `0` |

Complementos gravados junto, para dar cobertura de impressão à Identificação do espólio: número `5501`, complemento `APTO 55`, bairro `BAIRRO SENTINELA`, cidade `SAO PAULO`, DDD `11`, telefone `34567890`, e-mail `esp.auditoria@example.invalid`, raça/cor `4`.

### SAI-01: 3 erros e 1 aviso, todos originados no preenchimento headless

| Pendência | Causa real | Correção |
|---|---|---|
| "Possui cônjuge ou companheiro(a)?" não informado | gravei `conjuge = 2`, fora do domínio | `conjuge = 0` |
| "Código do Exterior" não informado | gravei texto livre `MIAMI / FL`; o campo é `Codigo` com domínio de 198 repartições consulares brasileiras, e o layout oficial o define como `CD_EX`, C3 | `294` = Miami, Estados Unidos da América, Consulado do Brasil |
| "Informações bancárias não preenchidas" | a SAI-01 apurou imposto a restituir de `2.032,33`, e o PGD passa a exigir conta de crédito | banco `001`, agência `2303`, conta `240024-5` |
| Aviso: "Data de Comunicação da Condição de Não Residente à Fonte Pagadora" | campo `dataComunicacaoSaida` do item de rendimentos PJ, não preenchido | `24/12/2025` |

### Itens 18 e 19: ECA e Pessoa Idosa preenchidos na AJU-01

A premissa do bloqueio anterior estava errada. O texto oficial do PGD (`darf` em `Mensagens-IRPF2026.properties`) situa a emissão do DARF no item de menu `Declaração > Imprimir > Darf > Doações Diretamente na Declaração - ECA`. Preencher e salvar a ficha não emite nem paga nada. A usuária autorizou o preenchimento em `30/08/2026`, sob o compromisso de nunca abrir aquele item de menu.

| Ficha | Esfera | UF/Município | CNPJ do fundo (tabela oficial do PGD) | Valor |
|---|---|---|---|---:|
| ECA | Municipal | SP / SAO PAULO (`7107`) | `97.537.776/0001-87`, de `eca.xml` | `301,45` |
| Pessoa Idosa | Estadual | SP | `17.087.890/0001-13`, de `eidoso.xml` | `302,46` |

- Nenhum CNPJ foi inventado: ambos vieram das tabelas `eca.xml` (4.619 fundos) e `eidoso.xml` (2.459 fundos) que acompanham a instalação.
- O `dvNumeroReferencia` (`46` para o ECA e `28` para a Pessoa Idosa) foi calculado pelo próprio modelo oficial, não por conta própria.
- Os dois valores couberam no limite: imposto devido de `37.020,42` dava teto de `1.110,61` por ficha.
- Efeito no cálculo, conferido: imposto devido `37.020,42` → `36.416,51`; dedução de incentivo `1.103,43` → `1.707,34` (exatamente `301,45 + 302,46`); saldo a pagar `23.511,76` → `22.907,85`.
- Verificação de que nada foi emitido: nenhum arquivo com `darf` no nome foi criado sob `aplicacao/` do IRPF ou no perfil do usuário após as alterações.
- **Consequência obrigatória**: o PDF `AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf` está desatualizado. A auditoria campo a campo precisa ser refeita sobre o PDF reexportado, porque os valores do Resumo mudaram. A cópia anterior à alteração está em `output/backup-irpf-sintetico/2026-08-30-1810-antes-eca-idoso/`.

## Itens 29 a 32: GCAP 2025 - 2026-08-30 (noite)

O GCAP 2025 versão 1.6 foi instalado pela usuária, o que desbloqueou a família de ganhos de capital. Instalador oficial `GCAP2025Win64v1.6.exe`, localizado a partir da própria tabela `links.xml` do IRPF, que aponta para o serviço oficial, e de lá para a página de download da Receita Federal, aberta no Firefox.

### Demonstrativo sintético criado

O GCAP usa o mesmo framework PPGD do IRPF, então valeu a mesma técnica: construção pelas classes oficiais (`DemonstrativoGCAP`, `AlienacaoBemImovel`, `AlienacaoBemMovel`, `AlienacaoParticipacaoSocietaria`, `MoedaAlienada`) e gravação por `RepositorioXMLDefault.salvar`. Script em `gcap-2025-sintetico.groovy`.

- Demonstrativo: CPF `111.444.777-35`, `AUDITORIA PDF TEC AJUSTE`, período de permanência `01/01/2025` a `31/12/2025`.
- Arquivo: `aplicacao/dados/11144477735/11144477735-0101-3112-GCAP-2025.xml`.
- Nenhum campo foi recusado pelo modelo oficial nos quatro lançamentos.

| Item | Ficha | Sentinelas gravados |
|---|---|---|
| 29 | Alienação de bem imóvel | `AJU GCI IMOVEL URBANO SENTINELA`, natureza Venda, aquisição `18/08/2018` por `100.601,41`, alienação `18/08/2025` por `160.602,42`, corretagem `5.603,43`, adquirente `AJU GCI ADQUIRENTE` |
| 30 | Alienação de bem móvel | `AJU GCM VEICULO SENTINELA`, aquisição `19/09/2022` por `30.611,44`, alienação `19/09/2025` por `42.612,45`, corretagem `1.613,46`, a prazo em 3 parcelas de `14.204,15` |
| 31 | Participação societária | `AJU GCP EMPRESA SENTINELA`, CNPJ `55.566.677/0001-83`, espécie Quotas, aquisição `20/10/2019` por `40.621,47`, alienação `20/10/2025` por `70.622,48`, corretagem `2.623,49` |
| 32 | Moeda estrangeira em espécie | moeda `USA`, estoque de abertura `1.234,56` USD custando `6.631,50`, alienação `21/11/2025` por `8.632,51`, adquirente `AJU GCE ADQUIRENTE` |

Decisão de mérito registrada: o roteiro traz a aquisição da moeda em `21/11/2024`. Como o demonstrativo cobre o ano-calendário 2025, essa aquisição não é operação do exercício; foi lançada como estoque de abertura (`estoqueInicial`, `saldoInicial`, `custoMedioInicial`), que é o tratamento correto e o que o próprio GCAP espera.

### Limite técnico: a apuração não fecha fora da interface

- `LIMITE|GCAP|Cadeia de calculo da apuracao|Os valores de entrada gravam corretamente, mas os observadores que transportam o custo de aquisicao para a ficha Apuracao nao disparam fora da interface. Reabrir o demonstrativo por `abreDeclaracaoSemUI` e chamar `recalcularAlienacoes` recupera parte do calculo, mas nao todo|Ver evidencia abaixo`.

Evidência medida após reabrir e recalcular sem interface:

| Ficha | Estado |
|---|---|
| Bem imóvel | `aquisicao.custoAquisicao = 100.601,41` gravado, mas `apuracao.custoAquisicao = 0,00`; o ganho saiu `154.998,99`, que é a alienação menos só a corretagem |
| Bem móvel | calculou, imposto `1.558,13` |
| Participação societária | `apuracao.custoAquisicao = 0,00`; ganho saiu `67.998,99` em vez de descontar os `40.621,47` |
| Moeda em espécie | ganho e imposto zerados, totalização mensal zerada |

**Por isso o `.DEC` NÃO foi importado no IRPF.** Importá-lo colocaria ganho de capital e imposto inflados dentro da declaração que serve de gabarito da auditoria, ou seja, número inventado por falha de ferramenta apresentado como resultado do programa oficial. O arquivo `11144477735-0101-3112-GCAP-2025.DEC` fica retido até que o próprio GCAP feche a apuração.

### O que fecha esse item

Abrir o demonstrativo no GCAP 2025, percorrer as fichas de cada uma das quatro operações até a Apuração e o Cálculo do Imposto, salvar, e então exportar por `Ferramentas > Exportar para IRPF`. Depois disso o `.DEC` pode ser importado na AJU-01 por `Declaração > Importações > Ganhos de Capital`, e a conferência campo a campo dos itens 29 a 32 passa a ser possível sobre o PDF reexportado.

## GCAP 2025: apuração fechada sem a interface - 2026-08-30 (noite, continuação)

Encontrei o verificador de pendências do próprio GCAP (`AlienacaoBemImovel.verificarPendencias(int)` e equivalentes nas demais entidades). Chamando-o fora da interface, ele devolve exatamente as mesmas `11` pendências que a tela do programa mostrava, o que permitiu corrigir tudo em ciclo fechado, sem depender de conferência visual. Script em `gcap-2025-verificar-pendencias.groovy`.

Observação metodológica: isso é o oposto do que acontece no IRPF, onde `verificarPendencias` headless devolve lista vazia e não serve. No GCAP o verificador é confiável fora da interface, e a conferência contra a tela confirmou a equivalência.

### Causas reais das 11 pendências

| Pendência | Causa | Correção |
|---|---|---|
| "Houve edificação, ampliação, reforma..." | não preenchido | `aquisicao.houveReforma = 0` |
| "Bem atualizado de acordo com a Lei 14.973/2024?" | não preenchido | `aquisicao.bemAtualizado = 0` |
| Parcelas do bem móvel excedem o valor líquido | erro do roteiro, ver abaixo | 3 parcelas de `13.666,33` |
| "Esta é a Última Parcela?" (3 vezes) | não preenchido | `ultimaParcela` = `0`, `0`, `1` |
| "Espécie de Participação Societária" | não preenchido | `especieAquisicao = Q` |
| "Custo Médio Ponderado Unitário em Reais" | não preenchido | `32,918534` |
| "Natureza" | **o código estava sendo descartado em silêncio**, ver abaixo | `natureza = 14` |
| "Ganho de Capital de Alienação anterior" | exigido por `alienacaoParcial = 1` | `alienacaoParcial = 0` |
| Moedas em Espécie, item 1 | `tipo` de operação gravado como `L` | `tipo = 2` (venda) |

### Dois achados que valem registro

1. `RECUSADO_SILENCIOSO|Participacao Societaria|natureza|O dominio de natureza da participacao societaria e' proprio e nao coincide com o de bem imovel/movel: 14 Alienacoes resgates e outras transferencias, 12 Transmissao Causa Mortis, 13 Doacao em Adiantamento da Legitima, 11 Dissolucao da Sociedade Conjugal. O codigo 1 (Venda), valido para imovel e movel, foi aceito pelo setter e apagado depois, sem erro|1 trocado por 14`.

2. `ERRO_NO_ROTEIRO|Item 30|Parcelas do bem movel|O roteiro manda 3 parcelas de 14.204,15, que somam 42.612,45, o valor BRUTO. O GCAP compara a soma das parcelas com o valor LIQUIDO, que e' 42.612,45 menos a corretagem de 1.613,46, ou seja 40.998,99. O proprio roteiro preve "ajustando centavos se o GCAP exigir soma exata"|3 parcelas de 13.666,33`.

3. `DERIVADO|Item 32|Cotacao do dolar na alienacao|O roteiro nao fornece cotacao e o GCAP a exige. Usada a taxa implicita nos proprios valores do roteiro: 8.632,51 dividido por 1.234,56 USD|6,9923779`.

4. `AJUSTADO|Item 31|Custo medio da quota|Para que 1.234 quotas fechem exatamente os 40.621,47 do roteiro, o custo medio unitario ficou 32,918534; com 32,918533 o programa recalculava o custo total para 40.621,46|32,918534`.

### Correção de uma análise errada desta auditoria

Em versão anterior deste documento eu registrei que restavam `3` pendências impossíveis de resolver, atribuídas aos campos `valorRecebidoAnosAnteriores` e `corretagemAnosAnteriores` por causa de `ValorPositivo.isVazio()` devolver verdadeiro para zero. **Estava errado em dois pontos**, e a checagem que desfez o engano foi ler a severidade de cada pendência em vez de apenas contá-las.

1. As três entradas sem texto **não são pendências**: têm `severidade = 0` e `isErro() = false`. São entradas de navegação da aba Cálculo do Imposto, com `campoInformacao` apontando para um `Alfa` vazio que sequer pertence ao grafo do demonstrativo. Os contadores `Total de Erros` e `Total de Avisos` do programa não as somam. Nada há a corrigir nelas.
2. A associação com `valorRecebidoAnosAnteriores` e `corretagemAnosAnteriores` veio de eu confundir a lista devolvida por `recuperarListaCamposPendenciaAbaCalculo()` com o campo que a pendência de fato aponta. São coisas distintas.

Ao medir por severidade, apareceu uma pendência real que eu havia dado como resolvida: `Espécie de Participação Societária`, severidade `3`. Ela sumia da contagem em memória e voltava ao reabrir o arquivo, porque o valor não persistia.

3. `RECUSADO_SILENCIOSO|Participacao Societaria|especieAquisicao|Terceiro caso do mesmo padrao. O dominio desse campo e' derivado da especie da participacao e, para Quotas, tem uma unica opcao: o codigo 3 (Quota). O codigo Q, que e' valido em ParticipacaoSocietaria.especie, foi aceito pelo setter, passou na verificacao em memoria e desapareceu na gravacao, sem erro|Q trocado por 3`.

### Estado final do demonstrativo

Conferido **depois de reabrir o arquivo do disco**, e não apenas em memória: `Total de Erros = 0`, `Total de Avisos = 0`. Restam as `3` entradas de severidade zero, que o programa não contabiliza.

### Lição de método registrada

Contar pendências não basta: é preciso ler `getSeveridade()`. Uma verificação feita só em memória também não basta, porque valores recusados em silêncio só aparecem depois de gravar e reabrir. Os três campos que sofreram recusa silenciosa nesta sessão (`natureza`, `especieAquisicao` e o `tipo` da operação de moeda) compartilham a mesma assinatura: código válido em outro campo de nome parecido, aceito pelo setter, descartado na gravação, sem qualquer mensagem. É uma classe de falha que o importador em auditoria precisa detectar.

### Apuração conferida

| Ficha | Alienação | Corretagem | Custo | Ganho | Imposto (15%) |
|---|---:|---:|---:|---:|---:|
| Bem imóvel | `160.602,42` | `5.603,43` | `100.601,41` | `54.397,58` | `8.159,63` |
| Bem móvel | `42.612,45` | `1.613,46` | `30.611,44` | `10.387,55` | `1.558,13` |
| Participação societária | `70.622,48` | `2.623,49` | `40.621,47` | `27.377,52` | `4.106,62` |
| Moeda em espécie | `8.632,51` | | `6.631,49` | `2.001,02` | `300,15` |

Detalhe que destravou o imóvel: o custo de aquisição só chega à ficha Apuração por meio da coleção `parcelasAquisicao`. Sem uma `ParcelaAquisicao`, o custo fica gravado em `aquisicao.custoAquisicao` mas a apuração usa zero, e o ganho sai inflado. As demais famílias não dependem disso.

### Arquivo gerado e limite da importação

- `.DEC` exportado pelo método oficial `GravadorCopiaSeguranca.exportarParaIRPF`: `output/gcap/11144477735-0101-3112-GCAP-2025.DEC`, SHA-256 `5a37e4d3ee0b4dbd26ca0af58a66c542228277b4add2a6557b51c1889c78073c`.
- `LIMITE|IRPF|Importacao do GCAP|`ProcessoImportacaoGCAP.importar` chama `verificarVersaoDemonstrativo`, que exige conexao verificada com o servidor da Receita e falha fora do programa mesmo com internet disponivel na maquina. A importacao tem de ser feita pelo menu Declaracao > Importacoes > Ganhos de Capital|Importacao pendente de execucao na interface`.

## Por que importação e impressão exigem a interface do IRPF - 2026-08-30

Investigado a fundo, e não por suposição.

### Importação do GCAP

- `ProcessoImportacaoGCAP.verificarVersaoDemonstrativo` compara o `pgd_version` gravado no `config.properties` de dentro do `.DEC` com o mínimo publicado pela Receita, obtido por `IRPFUpdateProperties.getUltimaVersaoGCAP()`.
- Fora do programa esse objeto vem com todos os campos nulos, e `IRPFUpdater.verificarUltimaVersaoOnline()` devolve nulos sem lançar erro: o updater depende de configuração que só a aplicação monta na inicialização.
- **A verificação passaria pelo mérito.** O endpoint oficial `https://downloadirpf.receita.fazenda.gov.br/irpf/2026/irpf/update/latest.xml` responde `200` com `ultimaVersaoGCAP:"1.4"`, e o mesmo valor já está gravado localmente em `aplicacao/dados/release_properties.xml`, buscado pelo próprio IRPF às `17:44` de hoje. O `.DEC` gerado declara `pgd_version = 1.6`, acima do mínimo.
- Optei por **não** injetar esse valor no objeto de propriedades para fazer a checagem passar fora do programa. É uma rotina de verificação de integridade, e alimentá-la por fora descaracterizaria o teste, ainda que o resultado fosse o mesmo. A importação fica para a interface.

### Impressão e verificação de pendências

- O GCAP expõe `RepositorioXMLGCAP.abreDeclaracaoSemUI`, e foi isso que permitiu fechar a apuração e as pendências dele sem interface.
- O `RepositorioXMLIRPF` **não tem equivalente**. A abertura de declaração no IRPF passa por `RepositorioXML.abreDeclaracao`, que instancia `DialogoOcupado` e exige a janela principal. Sem abrir a declaração não há como gerar o XML intermediário que alimenta o relatório Jasper, então a impressão depende da interface.
- `DeclaracaoIRPF.verificarPendencias` fora da interface devolve lista vazia até para a AJU-01, que na tela acusa avisos. No IRPF a verificação de pendências só vale dentro do programa.

Resumo da assimetria, que vale para o planejamento de qualquer automação futura sobre esses dois PGD: no GCAP dá para fazer tudo sem interface, menos a impressão; no IRPF dá para preencher e calcular sem interface, mas abrir, importar, verificar pendências e imprimir exigem a janela.

## Importação do GCAP concluída e quarto caso de recusa silenciosa - 2026-08-30 (20h)

### Importação

Feita na interface, por `Declaração > Importações > Ganhos de Capital`. A ficha `Importação GCAP 2025` passou a existir na AJU-01 e as quatro famílias de ganho de capital foram para o PDF.

O PDF da AJU-01 saiu de `33` para `41` páginas. Cobertura dos itens 29 a 32 do roteiro, conferida na camada de texto:

| Item | Ficha | Páginas | Ganho | Imposto |
|---|---|---|---:|---:|
| 29 | `AJU GCI IMOVEL URBANO SENTINELA` | 14 a 16 | `54.397,58` | `8.159,63` |
| 30 | `AJU GCM VEICULO SENTINELA` | 17 a 19 | `10.387,55` | `1.558,13` |
| 31 | `AJU GCP EMPRESA SENTINELA` | 20 e 21 | `27.377,52` | `4.106,62` |
| 32 | Moeda em espécie, dólar | 22 e 25 | `2.001,02` | `300,15` |

### Quarto caso de recusa silenciosa

- `RECUSADO_SILENCIOSO|Doacoes Diretamente na Declaracao ECA|municipio|O campo nao usa o codigo IBGE do municipio: a chave do dominio e' o CNPJ do fundo municipal, com 558 opcoes so para SP. Gravei 7107, que e' o codigo de endereco, e o PGD apagou o municipio e junto o CNPJ do fundo, sem mensagem|7107 trocado por 97.537.776/0001-87`.
- Sintoma na tela: erro `O campo indicativo "Municipio" nao foi informado - Item nº 1`. No PDF de 41 páginas, o CNPJ do fundo do ECA está ausente enquanto o da Pessoa Idosa aparece na página 39, porque o fundo estadual não depende de município.
- Corrigido por `corrigir-eca-municipio-aju-01.groovy`, com conferência feita depois de gravar e reler o arquivo: `municipio` e `cnpjFundo` persistiram, `dvNumeroReferencia` recalculado pelo modelo oficial para `46`, dedução de incentivo mantida em `1.707,34` e saldo a pagar em `22.907,85`.

### O padrão, agora com quatro ocorrências

| # | Ficha | Campo | Valor que eu usei | Valor correto |
|---|---|---|---|---|
| 1 | Participação societária, GCAP | `natureza` | `1`, válido em bem imóvel e móvel | `14` |
| 2 | Participação societária, GCAP | `especieAquisicao` | `Q`, válido em `ParticipacaoSocietaria.especie` | `3` |
| 3 | Moeda em espécie, GCAP | `tipo` da operação | `L` | `2` |
| 4 | ECA, IRPF | `municipio` | `7107`, código IBGE de endereço | CNPJ do fundo |

Assinatura comum: código plausível, válido em outro campo de nome parecido, aceito pelo setter sem exceção, descartado na gravação, sem qualquer mensagem. Só aparece se o arquivo for gravado e relido. **Isto é requisito de teste para o importador em auditoria**: um valor fora do domínio não pode ser aceito em silêncio, e a conferência do importador não pode se basear no estado em memória logo após a escrita.

### Versões de PDF preservadas

- `AJU-01-...-33pag-PRE-ECA-GCAP.pdf`: antes do ECA, da Pessoa Idosa e dos ganhos de capital.
- `AJU-01-...-41pag-ECA-MUNICIPIO-VAZIO.pdf`: com ganhos de capital, mas com o defeito do município do ECA.
- O definitivo será reimpresso após esta correção.

## Auditoria dos três PDFs e quinto achado - 2026-08-30 (20h40)

### Verificação de pendências no PGD, conferida na tela

| Declaração | Resultado |
|---|---|
| `AJU-01` | `2` avisos (`Banco` do item 3 e `CIB` do imóvel rural), `0` erros |
| `ESP-01` | "A declaração não possui Avisos e Erros impeditivos" |
| `SAI-01` | "A declaração não possui Avisos e Erros impeditivos" |

O imposto a restituir da `SAI-01` na tela, `2.032,33`, confere com o valor apurado por script antes de abrir o programa.

### Auditoria campo a campo, por sentinela na camada de texto

| PDF | Páginas | Sentinelas conferidos |
|---|---|---|
| `AJU-01` | `41` | `135` de `142` |
| `ESP-01` | `8` | `19` de `19` |
| `SAI-01` | `9` | `17` de `18` |

Script reexecutável em `auditar-pdfs-sinteticos.py`.

### Sete ausências que são limitação do PGD, não falha de preenchimento

| Sentinela | Constatação |
|---|---|
| `auditoria.pdf.aju@example.invalid` e `sai.auditoria@example.invalid` | Gravados no XML, **o PDF oficial não imprime o e-mail do contribuinte**. Campo não impresso, e não campo faltante |
| `123,45` de área do imóvel rural | O campo aceita **uma casa decimal**; gravado `123,4` |
| `BOVINOS AJU SENTINELA` | A ficha de rebanho é **estruturada por espécie fixa** (`bovinos`, `suinos`, `caprinos`, `asininos` e outras), sem campo de nome livre. Os números do roteiro foram para o nó `<bovinos>` |
| `AJU RUE CATTLE` | Mesma estrutura na atividade rural do exterior |

### Quinto achado: campo calculado que aceita escrita e é sobrescrito

- `CAMPO_CALCULADO|Rendimentos de PF e do Exterior|pessoaFisica de cada mes|O campo nao e' de entrada: e' o total do quadro auxiliar contasAno, que detalha rendimento por pagador. Escrever direto nele passa sem erro e o recalculo zera. Foi assim que 6.301,31, 8.321,51 e 3.401,61 sumiram do XML sem qualquer aviso|Corrigido criando os pagadores no quadro auxiliar`.

Valores recuperados, conferidos depois de gravar e reler:

| Ficha | Valor |
|---|---:|
| Titular, janeiro, trabalho não assalariado | `6.301,31` |
| Titular, março, transporte de carga | `8.321,51` |
| Dependente, abril, trabalho não assalariado | `3.401,61` |

O item 6 do roteiro já antecipava a exigência do pagador (`AJU RPF PAGADOR JANEIRO`, CPF `444.555.666-19`).

Detalhe estrutural registrado: no titular o quadro fica em `RendPF.contasAno`; no dependente fica um nível abaixo, em `ItemRendPFDependente.rendimentos.contasAno`.

O script `corrigir-rendpf-quadro-pagadores.groovy` limpa o mês antes de inserir e é **idempotente**: duas execuções seguidas produzem o mesmo resultado. Isso foi necessário porque a primeira versão duplicou os valores ao ser reexecutada, e a duplicação só apareceu na conferência pós-gravação.

### Efeito no cálculo

Com os três rendimentos recuperados, a base de cálculo foi de `178.100,49` para `196.124,92` e o saldo de imposto a pagar de `22.907,85` para `27.864,57`. **A AJU-01 precisa ser reimpressa**, e a auditoria campo a campo dela refeita sobre o PDF novo.

### As duas classes de falha desta sessão, para o importador em auditoria

1. **Código fora do domínio, descartado em silêncio**, com quatro ocorrências: `natureza` e `especieAquisicao` da participação societária no GCAP, `tipo` da operação de moeda no GCAP, `municipio` do ECA no IRPF.
2. **Campo derivado de coleção que aceita escrita direta e é sobrescrito pelo recálculo**, com três ocorrências, todas no mesmo campo `pessoaFisica`.

Requisito comum: **nenhuma conferência pode se basear no estado em memória logo após a escrita**. Ambas as classes só aparecem gravando e relendo.
