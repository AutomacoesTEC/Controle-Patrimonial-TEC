# Saldo anterior de aquisição nova

Falha observada na subauditoria: novo bem adquirido em2026 permite saldo anterior100 e saldo atual100; cria patrimônio antes da aquisição e elimina indevidamente a variação anual. A data de aquisição define o ano de nascimento desse registro novo.

Previsão antes da mudança: aquisição nova terá abertura zero; edição de bem existente continuará preservando saldo de abertura e movimentos vivos. Não alterar importação nem fórmulas do Demonstrativo. Dívidas e bens rurais usam data cadastral, que não prova data de aquisição, e ficam fora desta intervenção.

Fixture: src/utils/cadastroBem.test.js, três casos sintéticos, base9d5ac4d, sem seeds aleatórias. Montagem original do payload extraída literalmente de BemModal. Comando pareado: node node_modules/vitest/vitest.mjs run src/utils/cadastroBem.test.js. Camada: normalização de novo cadastro patrimonial.

Decisão: MANTER. nova-aquisicao-antes.txt registra1falha/2controles; nova-aquisicao-depois.txt registra3aprovações. No navegador, importacao-perfis-depois.txt confirma abertura zero somente leitura e rejeição de ano expandido. Nenhum saldo existente foi migrado nem recalculado por esta mudança.
