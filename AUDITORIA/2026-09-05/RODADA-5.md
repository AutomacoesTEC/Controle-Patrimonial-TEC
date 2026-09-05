# Campos específicos dos rendimentos

Base `5437be3`. Falha observada na imagem 5 e no formulário: todas as
naturezas pedem somente fonte, valor e IRRF. Não se pode cadastrar previdência
de PJ, detalhamento do RRA ou deduções de PF/exterior, embora sejam importados.
Previsão: PJ exibe previdência e 13º; PF/exterior exibe previdência, pensão e
livro-caixa; RRA exibe bruto, deduções, juros e número de meses; isentos mostram
descrição e não exigem fonte quando a natureza é uma operação de ganho.
Camada: formulário e exportação de seus campos, sem alterar fórmulas fiscais.
Baseline: código do commit-base e imagem 5 fornecida pela usuária.

Fontes consultadas em 05/09/2026: ajuda oficial local AjudaIRPF-new.txt,
linhas 360–435 (PJ, 13º líquido e transporte), 804–855 (PF/exterior);
[manual da Receita sobre rendimentos do trabalho](https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/preenchimento/manual-mir/rendimentos/rendimentos-do-trabalho)
(RRA, meses, forma de tributação e deduções).
O 13º informado no comprovante é líquido: não confundir seu IRRF informativo
com uma segunda dedução do mesmo valor. A integração dos campos no cálculo do
Demonstrativo será avaliada no relatório solicitado antes de correções.

Decisão: MANTER. O teste real auditar-uso.py confirmou campos diferentes para quatro naturezas e cadastro de PJ com previdência e dependente no ano da data. Evidência bruta: uso-segunda-execucao.txt. A primeira execução tinha seletores incorretos e espera insuficiente de fechamento, preservados em uso-primeira-execucao.txt; não são atribuídos ao produto. O teste funcional ainda não certifica apuração tributária desses campos.
