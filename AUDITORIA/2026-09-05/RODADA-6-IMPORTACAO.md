# Proteção do destino de importação

Falha observada: ImportPage usa uma lista parcial para detectar dados existentes; ano com apenas doações, despesas gerais ou RV pode ser substituído sem o aviso de conteúdo. Histórico armazena origem, mas a detecção de retificadora só lê origemAnoAtual.

Previsão anterior à correção: seis casos atualmente negativos passarão; os dois controles (vazio e patrimônio legado) permanecerão corretos.

Fixture: src/utils/destinoImportacao.test.js, oito cenários sintéticos determinísticos, sem seed aleatória e sem chamadas de modelo. Base 5437be361d9c0f7b321fd9f14e5936ee5df06577 mais alterações de trabalho declaradas no diff. A política original foi extraída literalmente em destinoImportacao.js para reproduzir a decisão sem navegador.

Camada causal: verificação do estado antes de permitir substituição de importação. Não modifica parser, dados ou fórmulas fiscais.

Comando pareado: node node_modules/vitest/vitest.mjs run src/utils/destinoImportacao.test.js

Decisão: MANTER. Antes: seis falhas e dois controles aprovados (importacao-destino-antes.txt). Depois: oito testes aprovados (importacao-destino-depois.txt). ImportPage usa agora a política testada, compartilhando hasWorkingData com o armazenamento e aceitando a origem registrada no histórico.
