# Mapa oficial e auditável do PDF IRPF 2026

Atualização: 30/08/2026  
Escopo: declaração impressa pelo programa IRPF 2026, exercício 2026, ano-calendário 2025.  
Situação global: **aberta**. Este documento não autoriza afirmar cobertura integral.

## Fontes e regra de verdade

1. O inventário da impressão vem do `DIRPF2026.jrxml` e de seus sub-relatórios, extraídos do módulo oficial de impressão da Receita.
2. O arquivo `../MAPA_PDF_IRPF2026.txt` contém o inventário de campos, expressões, títulos e XPath de cada relatório oficial. Ele é a referência de campo a campo para o fechamento das fichas.
3. `src/irpf/catalogoFichasPdf2026.js` é o catálogo executável que reconhece as fichas no PDF.
4. Cada ficha permanece aberta enquanto não houver amostra real preenchida, conferência visual de todos os campos e veredito independente `Aprovada`.
5. Uma ficha impressa com `Sem Informações` é `vazia`. Uma ficha que não aparece no documento é `ausente`. Esses estados não são equivalentes.
6. Uma consolidação calculada a partir de meses é `derivada`, nunca uma ficha anual integralmente importada.

## Identidade e proveniência do documento

| Prova | Tratamento atual | Situação |
|---|---|---|
| Arquivo selecionado | Nome, tamanho, tipo MIME, data de modificação e SHA-256 dos bytes originais | Implementado e testado |
| Conteúdo textual | Texto extraído integralmente, separado por página | Implementado |
| Origem de item estruturado | Formato, página e linha reconstruída | Implementado nas coleções estruturadas; auditoria por campo ainda aberta |
| PDF somente imagem | Recusado, sem criar importação vazia | Implementado e testado |
| Documento textual que não é declaração IRPF | Recusado pela assinatura estrutural da declaração | Implementado e testado |
| Bytes originais imutáveis | O hash prova a identidade, mas os bytes completos não são gravados no `localStorage` | Aberto; decisão deliberada para evitar exceder a capacidade local |

## Evidência real observada

Os nomes dos titulares são omitidos nesta matriz. Os arquivos permanecem no diretório pai como fixtures locais.

| Fixture | Páginas | Fichas reconhecidas | Conteúdo relevante |
|---|---:|---:|---|
| A | 59 | 41 | 172 bens, atividade rural Brasil preenchida, três ganhos de capital, Lei 14.754 e resumo |
| B | 50 | 40 | 74 bens, atividade rural Brasil, dois ganhos de capital, renda variável do titular e resumo |

Um falso positivo real foi removido: o texto `TRANSPORTES E LOGISTICA LTDA`, dentro da discriminação de um bem, não pode abrir a ficha curta `Transportes`.

## Matriz das 51 fichas e variantes oficiais

Legenda de suporte:

- `Estruturada`: existe saída própria no estado, mas o gate de todos os campos continua aberto.
- `Parcial`: somente parte comprovada do relatório é estruturada.
- `Não suportada`: presença e texto são detectados, mas os campos não entram em modelo próprio.
- `A/B vazia`: a ficha foi impressa com `Sem Informações` na fixture indicada.
- `A/B pág.`: página inicial observada com conteúdo ou presença indeterminada.

### Pessoas e identificação

| ID | Ficha | Suporte | Campos estruturados ou que precisam ser fechados | Evidência |
|---|---|---|---|---|
| `identificacao-contribuinte` | Identificação do contribuinte | Estruturada | nome, CPF, nascimento, título eleitoral, endereço completo, telefone, e-mail, ocupação, natureza da ocupação, cônjuge, tipo de declaração, recibo e indicadores cadastrais impressos | A/B pág. 1 |
| `inventariante` | Inventariante e partilha/sobrepartilha | Estruturada | modalidade, ano do óbito, bens a inventariar, processo, vara, comarca, UF, data da decisão e do trânsito em julgado, CPF e nome do inventariante, três respostas do quadro do cônjuge | ESP-01 pág. 1, linhas 19 a 32 |
| `saida-definitiva` | Saída definitiva do país | Estruturada | CPF, nome e endereço do procurador, data da caracterização da condição de não residente e país de destino | SAI-01 pág. 1, linhas 21 a 25 |
| `dependentes` | Dependentes | Estruturada | tipo, nome, CPF, nascimento, raça/cor, telefone, e-mail e mora com titular | A/B pág. 1 |
| `alimentandos` | Alimentandos | Não suportada | nome, CPF, nascimento, residência, processo ou escritura e parcelas vinculadas | A/B vazia, pág. 1 |
| `herdeiros` | Herdeiros | Estruturada | CPF/CNPJ e nome de cada herdeiro do espólio; o percentual por BEM já vinha em bens[].herdeiros | ESP-01 pág. 2, linhas 5 e 6 |
| `conjuge` | Informações do cônjuge ou companheiro | Não suportada | identificação e bases/totais próprios impressos | Sem amostra real preenchida |

### Rendimentos e imposto

| ID | Ficha | Suporte | Campos estruturados ou que precisam ser fechados | Evidência |
|---|---|---|---|---|
| `rendimentos-pj-titular` | Rendimentos tributáveis de PJ do titular | Estruturada | CNPJ, fonte, rendimento, previdência oficial, pensão alimentícia, IRRF e 13º | A/B pág. 1 |
| `rendimentos-pj-dependentes` | Rendimentos tributáveis de PJ dos dependentes | Estruturada | beneficiário, CPF, CNPJ, fonte e os seis valores da linha | A vazia pág. 2; B preenchida pág. 2 |
| `rendimentos-pf-exterior-titular` | PF e exterior do titular | Não suportada | mês, CPF ou país, rendimento, livro-caixa, pensão, Carnê-Leão, DARF, imposto exterior e conversões | A/B vazia pág. 2 |
| `rendimentos-pf-exterior-dependentes` | PF e exterior dos dependentes | Não suportada | dependente e todos os campos mensais equivalentes | A/B vazia pág. 2 |
| `rendimentos-isentos` | Isentos e não tributáveis | Estruturada | código, beneficiário, CPF, CNPJ/CPF da fonte, nome da fonte, descrição e valor; agregado e detalhe ficam reconciliados | A pág. 2; B pág. 2 |
| `rendimentos-tributacao-exclusiva` | Tributação exclusiva ou definitiva | Estruturada | código, beneficiário, CPF, fonte, descrição, rendimento e IR relacionado quando impresso | A pág. 3; B pág. 2 |
| `rendimentos-exigibilidade-titular` | PJ com exigibilidade suspensa do titular | Não suportada | fonte, rendimento, depósito judicial, previdência, pensão e IRRF | AJU-01 reauditoria visual pág. 6: fonte, rendimento e depósito comprovados; o formulário oficial não expõe previdência, pensão ou IRRF |
| `rendimentos-exigibilidade-dependentes` | PJ com exigibilidade suspensa dos dependentes | Não suportada | beneficiário e todos os valores equivalentes | AJU-01 reauditoria visual pág. 6: beneficiário, fonte, rendimento e depósito comprovados; o formulário oficial não expõe previdência, pensão ou IRRF |
| `rra-titular` | RRA do titular | Não suportada | fonte, meses, opção tributária, rendimento, previdência, pensão, despesas, IRRF e imposto | AJU-01 reauditoria visual pág. 6: opção Exclusiva, mês Dez., 11 meses, valores e imposto devido comprovados; o formulário não expõe despesa judicial |
| `rra-dependentes` | RRA dos dependentes | Não suportada | dependente e todos os campos equivalentes | AJU-01 reauditoria visual pág. 7: opção Ajuste, mês Dez. e valores comprovados; essa opção não expõe número de meses nem despesa judicial |
| `demais-rendimentos-titular` | Demais rendimentos do titular | Não suportada | tipos e valores específicos do quadro oficial | Sem amostra real preenchida |
| `demais-rendimentos-dependentes` | Demais rendimentos dos dependentes | Não suportada | dependente, tipos e valores específicos | Sem amostra real preenchida |
| `transportes` | Rendimentos de transportes | Não suportada | parcelas isentas e tributáveis, transporte de carga/passageiros e alienações associadas | Sem amostra real preenchida |
| `imposto-pago-retido` | Imposto pago ou retido | Parcial | imposto complementar, Carnê-Leão, imposto exterior, IRRF do titular/dependentes, Lei 11.033 e limites | A pág. 5; B pág. 4 |

### Pagamentos, doações e patrimônio

| ID | Ficha | Suporte | Campos estruturados ou que precisam ser fechados | Evidência |
|---|---|---|---|---|
| `pagamentos-efetuados` | Pagamentos efetuados | Estruturada | código, titular/dependente/alimentando, CPF/CNPJ, nome, descrição, valor pago e parcela não dedutível | A pág. 5; B pág. 4 |
| `doacoes-efetuadas` | Doações efetuadas | Estruturada | código, beneficiário, CPF/CNPJ, nome e valor | A/B vazia pág. 7/5; falta amostra preenchida |
| `bens-direitos` | Bens e direitos | Estruturada | grupo, código, ordem, discriminação integral, país, titularidade, CPF, CNPJ/CPF relacionado, banco, agência, conta, negociação em bolsa, usufruto e saldos em 31/12 | A pág. 7; B pág. 6 |
| `dividas-onus` | Dívidas e ônus reais | Estruturada | código, discriminação, credor, CPF/CNPJ, saldos anterior/atual e valor pago | A pág. 40; B vazia pág. 19 |
| `doacoes-eleitorais` | Doações a partidos e candidatos | Estruturada | CNPJ, nome, tipo, candidato/partido e valor | A/B vazia pág. 40/20; falta amostra preenchida |
| `doacoes-eca` | Doações diretamente na declaração, ECA | Estruturada | fundo, CNPJ, esfera/UF/município e valor | AJU-01: aba vazia inspecionada; PGD avisa que salvar doação gera DARF, portanto amostra preenchida não criada sob a proibição absoluta de emissão |
| `doacoes-idoso` | Doações diretamente na declaração, pessoa idosa | Estruturada | fundo, CNPJ, esfera/UF/município e valor | AJU-01: aba vazia inspecionada; PGD avisa que salvar doação gera DARF, portanto amostra preenchida não criada sob a proibição absoluta de emissão |

### Atividade rural

| ID | Ficha | Suporte | Campos estruturados ou que precisam ser fechados | Evidência |
|---|---|---|---|---|
| `rural-brasil-identificacao` | Imóveis explorados no Brasil | Estruturada | atividade, participação, condição, nome/localização, área, CIB e aquisição | A pág. 41; B pág. 20 |
| `rural-brasil-participantes` | Participantes | Estruturada | nome, CPF e vínculo inequívoco com a linha do imóvel | A pág. 41; B pág. 20 |
| `rural-brasil-receitas-despesas` | Receitas e despesas | Estruturada | 12 meses, receitas, despesas, investimento, resultado e totais | A pág. 43; B pág. 21 |
| `rural-brasil-apuracao` | Apuração do resultado | Estruturada | resultado, compensação, opção, limite de 20%, prejuízos e saldo | A pág. 43; B pág. 21 |
| `rural-brasil-rebanho` | Movimentação do rebanho | Estruturada | espécie e colunas de estoque, entradas, nascimentos, consumo, perdas, vendas e final | A pág. 43; B pág. 21 |
| `rural-brasil-bens` | Bens rurais | Estruturada | código, discriminação integral e saldos anterior/atual | A pág. 43; B pág. 22 |
| `rural-brasil-dividas` | Dívidas rurais | Estruturada | discriminação integral e saldos anterior/atual | A pág. 48; B vazia pág. 22 |
| `rural-exterior-identificacao` | Imóveis explorados no exterior | Não suportada | país, atividade, participação, condição, localização, área e aquisição | A/B vazia pág. 50/23 |
| `rural-exterior-receitas-despesas` | Receitas e despesas no exterior | Não suportada | país, moeda, 12 meses, receitas, despesas, investimentos e conversões | A/B vazia pág. 50/23 |
| `rural-exterior-apuracao` | Apuração do exterior | Não suportada | resultado por país, compensações, imposto e conversões | A/B vazia pág. 50/23 |
| `rural-exterior-rebanho` | Rebanho no exterior | Não suportada | país, espécie e todas as colunas de movimentação | A/B vazia pág. 50/23 |
| `rural-exterior-bens` | Bens rurais no exterior | Não suportada | país, moeda, código, discriminação e saldos originais/convertidos | A/B vazia pág. 50/23 |
| `rural-exterior-dividas` | Dívidas rurais no exterior | Não suportada | país, moeda, discriminação e saldos originais/convertidos | A/B vazia pág. 50/23 |

### Ganhos, mercados e resumo

| ID | Ficha | Suporte | Campos estruturados ou que precisam ser fechados | Evidência |
|---|---|---|---|---|
| `ganho-capital-imoveis` | Ganho de capital, imóveis | Estruturada | identificação, aquisição, alienação, adquirente, custo, despesas, reduções, ganho, imposto, isenções e parcelas | Sem amostra desta família |
| `ganho-capital-moveis` | Ganho de capital, móveis | Estruturada | mesmos blocos aplicáveis à família e parcelas a prazo | A pág. 50; B pág. 23 |
| `ganho-capital-participacao` | Ganho de capital, participação societária | Estruturada | empresa, participação, aquisição, alienação, adquirente, custo, ganho, imposto e parcelas | Sem amostra desta família |
| `ganho-capital-moeda` | Ganho de capital, moeda em espécie | Parcial | moeda, país, aquisição, alienação, custo, ganho e imposto | Sem amostra real preenchida |
| `renda-variavel-titular` | Operações comuns e day trade do titular | Estruturada | 12 meses, mercados, resultado comum/day trade, prejuízo, base, imposto, IRRF e imposto a pagar | A vazia pág. 56; B preenchida pág. 30 |
| `renda-variavel-dependentes` | Operações comuns e day trade dos dependentes | Estruturada | dependente e os mesmos campos mensais | A/B vazia pág. 56/42 |
| `fii-fiagro-titular` | FII e Fiagro do titular | Parcial | 12 meses, resultado, prejuízo, base, imposto e IRRF | A/B vazia pág. 56/48; falta amostra preenchida |
| `fii-fiagro-dependentes` | FII e Fiagro dos dependentes | Parcial | dependente e os mesmos campos mensais | A/B vazia pág. 56/48; falta amostra preenchida |
| `lei-14754` | Aplicações financeiras no exterior | Estruturada | bem, país, moeda, opção, rendimento, prejuízo, compensação, base e imposto | A pág. 57; ausente em B |
| `resumo` | Resumo e evolução patrimonial | Estruturada | rendimentos, deduções, bases, imposto, restituição/saldo, pagamentos, bens, dívidas e evolução patrimonial | A pág. 58; B pág. 49 |

## Gates ainda abertos

1. Criar no PGD oficial, sem transmissão, amostras preenchidas para as fichas sem evidência real.
2. Conferir cada campo do `MAPA_PDF_IRPF2026.txt` contra PDF, estado importado e tela.
3. Verificar visualmente quebras de página e continuação de tabelas para zero, um e muitos itens.
4. Provar retificação com inclusão, alteração, exclusão, reordenação e preservação de ajustes manuais em cada coleção.
5. Guardar ajustes do usuário em camada separada do valor original. Hoje há preservação de origem e movimentos, mas o contrato completo de original/ajuste ainda não está fechado para todos os campos.
6. Emitir dossiê e obter veredito independente `Aprovada` para cada ficha.

## Regra de apresentação no app

A pré-importação deve mostrar, antes de qualquer alteração no perfil:

- identidade e hash do arquivo;
- titular e ano identificados;
- fichas encontradas e páginas;
- fichas oficialmente vazias;
- fichas preenchidas sem suporte próprio;
- avisos persistentes;
- contagens por coleção;
- confirmação explícita de gravação;
- erro visível quando o armazenamento local falhar.

Nenhum estado `parcial`, `não suportada`, `erro`, `ausente` ou `derivada` pode ser apresentado como cobertura integral.
