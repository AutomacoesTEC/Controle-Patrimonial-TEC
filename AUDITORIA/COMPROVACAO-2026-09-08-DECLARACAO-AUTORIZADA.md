# Conferência da declaração autorizada — 08/09/2026

## Escopo e autorização

O usuário autorizou expressamente a leitura da declaração real em uso e solicitou comprovação de cada registro. Foi lido somente o PDF correspondente à tela, de 50 páginas. A investigação não autoriza conclusão sobre outros PDFs ou DBKs. Original preservado: SHA-256 antes/depois idêntico. Dados reais e scripts de conferência estão no diretório local ../auditoria-local-2026-09-08, fora do Git.

## PROVADO PELO ARQUIVO

180 registros possuem página e linha de origem corroboradas por extração independente com pdfplumber; a extração do aplicativo usa PDF.js. Linhas repetidas foram associadas pela ordem de ocorrência na página, não por coincidência isolada de valor.

- 74 bens: grupo, código, saldos anterior/atual e descrições completas conferidos. A reconstrução independente da descrição utiliza o início do item até a linha do país, excluindo as colunas de saldo.
- 26 rendimentos: valores conferidos por coluna; tributáveis incluem contribuição previdenciária, IRRF, décimo terceiro e IRRF correspondente.
- 20 pagamentos: valores pago/não dedutível, identificação do beneficiário e titularidade conferidos no bloco correspondente.
- 12 meses rurais: mês, receita, despesa e proveniência conferidos.
- 13 imóveis rurais: código da atividade, participação, condição de exploração, área e CIB conferidos nos campos existentes. Ausência de CIB foi registrada como tal.
- 2 bens rurais: código e saldos conferidos.
- 8 participantes: nome, CPF e opção estrangeiro conferidos.
- 4 espécies do rebanho: nome e seis quantidades conferidos após correção.
- 18 fichas de renda variável: mês/beneficiário, duas colunas dos mercados/apuração e consolidação conferidos por rótulos.
- 2 operações de ganho de capital: valores básicos, 10 parcelas detalhadas, faixas e campos de fechamento conferidos.

A matriz possui 2.229 campos com comprovação direta, 180 provas de origem e duas contagens de parcelas (2.411 verificações diretas). Os 36 campos sem dado impresso foram investigados individualmente e classificados como ausências documentais conferidas; não restam campos com conferência pendente nesta matriz. Os 54 campos de titularidade/CPF dos 27 bens sem rótulo seguem a regra expressamente definida pelo usuário: considerar do Titular, além de identificadores internos, datas convencionais e transformações explicitamente identificadas. Esses números não representam aprovação integral de 180 registros.

Oito conciliações entre os registros e o resumo importado fecham em centavos: bens/dívidas dos dois anos; tributáveis PJ do titular/dependentes; isentos e exclusivos. Como o resumo veio do mesmo arquivo, esses totais não substituem comprovação independente campo a campo.

## PROVADO PELO CÓDIGO E PELO TESTE

1. Os 12 registros mensais rurais não guardavam origemDocumento. Adicionada a proveniência com página e linha ao criar o registro. O teste sintético exige que essa linha contenha o mês e ambos os valores corretos.
2. A continuação do nome da espécie aceitava qualquer próxima linha sem valores. No arquivo autorizado, o rodapé foi incorporado a Outros. A regra agora aceita apenas a continuação legítima e muares da espécie Asininos, equinos.

Regressão sintética: antes da segunda correção, os cenários de rodapé e título seguinte falhavam com o texto indevido no nome; a continuação legítima passava. Depois da correção, os três passaram. As primeiras execuções do teste novo tiveram erros de construção da amostra (argumento da API e mínimo de texto); não foram tratadas como bugs do produto.

Validação anterior desta investigação: 121 testes aprovados, nenhum ignorado, nos quatro arquivos abaixo; build aprovado com 683 módulos. O arquivo importacaoProducao contém sete testes: três PDFs completos e quatro regressões específicas. A biblioteca emite aviso de standardFontDataUrl, sem falha nesses testes.

Comando em WSL, na raiz do aplicativo:

```sh
npm test -- src/pages/importacaoProducao.test.js src/pages/importParsersPdfSintetico.test.js src/utils/importacaoDeclaracao.integridade.test.js src/utils/importacaoDeclaracao.test.js
npm run build
```

3. O cabeçalho repetido da ficha de imóveis rurais zerava o imóvel corrente em quebra de página. Um participante do arquivo real ficava órfão. A continuação agora preserva o contexto; oito de oito participantes têm vínculo com a linha de imóvel anterior, conferida pela ordem independente do PDF. Teste de duas páginas falhava antes e passou após a correção. Na amostra real mudaram somente o ID, o nome e a chave de importação do imóvel no participante afetado; o CIB continuou vazio, como no imóvel de origem.

## NÃO DETERMINADO

Todos os campos dos 180 registros foram classificados na matriz: comprovação direta, transformação/derivação/vínculo conferido, ausência, campo interno, data convencional ou limite de evidência. Os campos sem prova direta não equivalem a erros de extração: ausências documentais e a regra de titularidade do usuário têm classificações próprias. Os oito vínculos rurais foram conferidos. Não foi demonstrada cobertura integral dos quadros complementares/cadastro. Eles estão inventariados separadamente. A matriz não presume que um campo ausente seja zero. Datas anuais convencionais não são tratadas como datas reais de pagamento/recebimento. O fechamento anual de renda variável permanece identificado como derivado dos meses.

Não foi executado test:full, pois sua coleta inclui outros arquivos reais fora do conjunto escolhido para esta investigação. Não há declaração de cobertura universal ou certificação fiscal. O estado parcial/Em auditoria não foi removido nem promovido automaticamente. A nova extração foi conferida em contexto isolado; os dados já persistidos no navegador do usuário não foram substituídos.

## Artefatos locais

- matriz-registros.html e .json: 180 registros, campos, critérios, trechos independentes e pendências.
- conferencia-contextual.json: verificações detalhadas por campo.
- integridade-e-totais.json: preservação do original e oito conciliações.
- quadros-complementares.json: inventário explicitamente não aprovado de cadastro e resumos.
- resultado-parser.json e extracao-independente.json: duas saídas para reprodução.
- conferir_contexto.py, conferir_quadros.py, conferir_metadados.py, conferir_fechamentos.py, conferir_vinculos.py, conferir_classificacao.py, conferir_campos_finais.py, documentar_ausencias.py, conferir_descricoes_finais.py, conferir_36_campos.py, gerar_relatorio.py: verificadores locais. Executar nessa ordem para regenerar as evidências, após obter novamente a saída do parser se houver mudanças.

## FONTES OFICIAIS CONSULTADAS

A pesquisa normativa serve de contexto, não prova que o arquivo foi extraído corretamente. Foram consultadas as orientações da Receita sobre informações de dependentes e o Perguntas e Respostas IRPF 2026:

- https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/perguntas-frequentes/imposto-de-renda/dirpf/deducoes/29-despesa-com-dependente
- https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-00-2026-04-23.pdf

## Correção do critério de CNPJ após observação do usuário

A ausência de CNPJ em campo próprio não é falha nem pendência de importação: o identificador pode ser RENAVAM, outro campo aplicável ou não ser informado. Foram reclassificados os 43 CNPJs vazios como ausência conferida. Os 31 CNPJs impressos e os 16 RENAVAMs permanecem comprovados em seus respectivos campos. A contagem de campos sem prova direta passou de 133 para 90; não houve alteração nos valores dos bens.

A busca integral pelos dois extratores encontrou 47 rótulos de pertencimento, correspondentes a todos os bens dos grupos 03 (9), 04 (16), 06 (9) e 99 (13). Os 27 itens sem esse rótulo no arquivo analisado pertencem aos grupos 01 (11) e 02 (16), nas páginas 6 a 12. As imagens fornecidas mostram exemplos do grupo 04, já conferidos entre os 47. Essa constatação se limita ao PDF autorizado, sem generalizar para todas as declarações.

## Regra de titularidade definida pelo usuário

Por instrução expressa do usuário nesta tarefa, quando o bem não informar titular ou dependente, considerar do Titular. O importador PDF já inicializa beneficiario como Titular e somente substitui por Dependente quando essa indicação é explícita. Não foi necessária mudança funcional no parser.

Os 27 bens sem rótulo foram verificados: todos já seguem essa regra. Seus 54 campos de titularidade/CPF passaram de inferência pendente para REGRA DO USUÁRIO APLICADA na matriz. O CPF do titular é referenciado pelo cadastro; não se inventa CPF de dependente. Essa classificação registra a decisão do usuário e não afirma que o dado estava impresso no PDF. Após essa regra, restavam 36 campos para investigar; o resultado dessa investigação está descrito abaixo.

## Investigação dos 36 campos restantes

Conferidos individualmente contra os blocos e cabeçalhos da extração independente do PDF autorizado:

| Campos | Quantidade | Resultado |
| --- | ---: | --- |
| IRRF de rendimentos isentos/exclusivos | 18 | A ficha não imprime coluna de IRRF por rendimento. Corrigido o valor artificial zero para null. |
| Data de aquisição de imóveis rurais | 13 | A tabela de origem não apresenta essa coluna; mantidos sem data. |
| Identificação da fonte pagadora | 3 | Dois campos no agregado de 13º dos dependentes e o CNPJ na linha de prêmios não são individualizados no PDF; mantidos vazios. |
| Saída com declarante e NIT/PIS/PASEP do dependente | 2 | Não impressos no bloco correspondente; mantidos null. |

Esta é a quarta correção funcional identificada na investigação. O IRRF de 13º derivado das fontes PJ foi preservado. Ao reprocessar o PDF, mudaram somente os 18 IRRF antes preenchidos com zero; os demais campos e coleções permaneceram idênticos à extração imediatamente anterior. O original permanece preservado.

A tela mostra Não informado para IRRF ausente e R$ 0,00 para zero conhecido. A edição preserva a ausência, e ambas as exportações XLSX deixam a célula vazia nesses casos. O cartão passou a informar IRRF informado. A regra alterada pertence ao importador PDF, sem alteração no DBK.

Validação atual: 143 testes aprovados, zero falhas e zero ignorados; build aprovado (683 módulos). Os dois novos testes reproduziram as falhas antes da correção e passaram depois. Importação pelo reducer e restauração do estado preservam os 18 null. Em navegador isolado, três registros sintéticos com IRRF null, zero e 12,50 exibiram os três estados corretamente; os arquivos XLSX da aba e da exportação geral conservaram célula vazia, zero e 12,50. Nenhum dado persistido do navegador do usuário foi substituído.

```sh
npm test -- src/pages/importacaoProducao.test.js src/pages/importParsersPdfSintetico.test.js src/utils/importacaoDeclaracao.integridade.test.js src/utils/importacaoDeclaracao.test.js src/utils/camposRendimento.test.js src/store/auditoriaDemonstrativo20260905.test.js
npm run build
```

A matriz atual contém 180 registros, 2.229 campos comprovados diretamente, 36 ausências documentais conferidas e zero campos com conferência pendente dentro desse escopo. investigacao-36-campos.json registra 36 verificações aprovadas e nenhuma divergência. Ausência conferida não significa dado impresso nem aprovação fiscal; os limites dos quadros complementares continuam válidos. O relatório local foi atualizado, sem remover o estado de auditoria global do aplicativo. Dados previamente importados precisam ser reprocessados para receber a correção.
