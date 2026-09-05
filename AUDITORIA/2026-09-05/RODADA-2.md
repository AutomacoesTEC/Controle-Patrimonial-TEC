# Formulários datados

Base: `2343250`. Fixture: verificar-interface.py, Chromium instalado (1234),
1366x768, perfil sintético isolado, sem seed aleatória; modelo da mesma sessão.
Antes: interface-antes.json. Falha: seleção redundante de ano em cinco
cadastros; edições dos fluxos ignoram ano da data. Previsão: zero seletores de
ano nos oito formulários, todos os novos registros com data; alteração da data
de um fluxo grava no ano correspondente, com confirmação e sem cópia residual.
Camada: formulários (conectados à persistência já corrigida na rodada 1).
Datas históricas de aquisição de bens importados permanecem cadastrais:
editar o texto desses bens não os remove da posição patrimonial do ano ativo.

Decisão: **MANTER**. O mesmo navegador verificou oito formulários: zero
seletores de ano e pelo menos uma data em cada um (rodada-2-depois.json).
Build de produção passou, gerado em diretório temporário para não sobrescrever
o executável existente. A medição espera o botão da ficha antes de ler a tela;
isso evita medir a ficha anterior durante o carregamento sob demanda.
