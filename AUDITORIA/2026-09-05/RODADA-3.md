# Tabelas e abas

Base `7f21c3b`. Fixture congelado: verificar-interface.py; antes em
rodada-2-depois.json (apenas datas mudaram desde interface-antes.json).
Falhas: tabelas rurais sem alças, botão Compacto desnecessário, quatro colunas
fixas em Pagamentos e largura da célula Ações insuficiente para seus botões.
Previsão: zero botões Compacto; todas as tabelas de colunas inspecionadas com
alças; só Ações fixa em Pagamentos; abas com overflow vertical desativado.
Camada: componente de tabelas e sua integração visual. Cálculos inalterados.

Decisão: **MANTER**. rodada-3-depois.json registra zero botões Compacto,
alças nos quadros rurais e uma coluna fixa em Pagamentos. Build passou.
O wrapper também cobre quadros de relatório, modalidade e detalhes, incluindo
tabelas sem thead; a medição dessas usa a primeira linha disponível.
