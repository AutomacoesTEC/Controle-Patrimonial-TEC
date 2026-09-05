# Titularidade e recorte individual

Falha: há cadastros sem identificação da pessoa, seleção de Dependente sem
vínculo e Demonstrativo sem recorte. Previsão: bens, dívidas, rendimentos,
pagamentos, despesas e doações permitem selecionar a pessoa; o recorte usa
CPF/id, nunca atribui dado sem titularidade ao titular por suposição e mantém
visão geral idêntica. Fixture titularidade.test.js, sem aleatoriedade, mesma
sessão/modelo, base da rodada de tabelas registrada no Git.
Camada: identificação e seleção de dados; fórmulas do Demonstrativo preservadas.

Decisão: **MANTER**. 5/5 testes do recorte; o baseline não oferecia o módulo
nem a funcionalidade (falha de importação preservada em rodada-4-antes.txt).
O teste do navegador voltou a abrir as oito fichas após a integração
(rodada-4-interface.json), e o build passou. Os testes não afirmam que
dados sem titularidade possam ser atribuídos individualmente: são excluídos
do recorte com aviso explícito na tela, mantendo-se na visão geral.
