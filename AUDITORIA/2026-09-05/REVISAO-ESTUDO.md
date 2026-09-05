# Nova rodada: estudo e correções solicitadas

Base congelada: b82fc46. Estudo lido integralmente: `D:\Download DATA\deep-research-report (2).md`, 70.883 bytes. O documento é externo, não um artefato selado deste repositório. Seus marcadores internos de citação não são fontes verificadas; regras tributárias necessárias às correções serão confrontadas com fontes oficiais.

Diretriz adotada: separar patrimônio fiscal, fluxo financeiro e diferença de conciliação. Não implementar automaticamente todas as funcionalidades propostas no estudo. Primeiro as imagens, depois D01 a D12, e por último a revisão das recomendações.

## Imagem 1: titularidade e identificação

Falha observada: titularidade escondida sob a discriminação; inexistência de filtro de pessoa; item vazio quando a fonte não fornece numeroItem; totalizador com uma célula a menos que o cabeçalho.

Previsão antes da mudança: coluna própria, filtro geral/titular/dependente individual com totais e exportação no mesmo recorte; os três identificadores centralizados; ausência do número oficial mostrada explicitamente, sem inventar número da declaração; totalizador alinhado. Fixture sem aleatoriedade: revisaoImagens.test.js, mesma execução antes/depois. Camada: apresentação da ficha Bens.

## Imagem 2: cabeçalho redundante na edição

Atualização expressa do usuário durante a rodada: substituir Item por Titularidade, sem coluna de item vazio. A fixture da imagem 1 foi ajustada por mudança do requisito; o antes original não é evidência pareada desse novo requisito. NumeroItem permanece armazenado, sem migração/destruição.

Falha observada: campos de identificação ocupam o topo de Editar Bem mesmo com o bloco Dados do Bem recolhido. Previsão: campos destacados somente no topo do novo cadastro; na edição, disponíveis dentro de Mostrar mais. Valores preservados. Camada: organização do formulário, sem alteração da persistência.

## Imagem 3: significado da caixa

Falha observada: residual patrimonial é rotulado como saldo de caixa e permite configurar fechamento com diferença. Previsão: informar Diferença de conciliação e esclarecer que não é saldo bancário; remover ajuste de tolerância da interface e avaliar fechamento em centavos, sem utilizar preferências antigas para esconder divergências. Camada: apresentação e classificação do residual, sem alterar ainda o motor de composição D01–D12.

## Verificação das imagens

MANTER. Contratos e filtro puro: 8 testes aprovados (`imagens-revisao-depois.txt`). Navegador Chromium com dados sintéticos: coluna/filtro/totais, três alinhamentos, edição recolhida, cadastro visível e residual identificado, sem erros JavaScript (`imagens-revisao-navegador-reteste.txt`). O primeiro ensaio do navegador consultava a contagem antes da renderização; passou após usar espera explícita, sem alterar o produto para satisfazer o teste. O localhost precisou ser reiniciado porque o servidor anterior deixou de responder. Nenhuma base real foi utilizada.
