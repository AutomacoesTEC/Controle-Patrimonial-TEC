# Titularidade na tabela de bens — 2026-09-08

FALHA: linhas de dependentes exibiam titularidade na coluna própria e um selo
duplicado na Discriminação.

TRAJETÓRIA: abrir Bens e Direitos com bens de dependente, observar as duas colunas.

IMPACTO: informação repetida e ruído visual.

CAMADA CAUSAL: apresentação, somente `src/pages/BensPage.jsx`.

CLASSIFICAÇÃO DAS EVIDÊNCIAS: PROVADO PELO CÓDIGO, `rotuloTitularidade` na primeira
célula e `marcadoresDoBem` na quarta; PROVADO POR TESTE, renderização da aplicação
real em Chromium isolado com fixture sintética e verificações DOM.

PREVISÃO REGISTRADA: duas indicações passam a uma por linha de dependente;
zero alteração de descrição, valores e demais marcadores. Registrada antes da edição.

BASELINE CONGELADA: branch `fix/auditoria-2026-08-24`, HEAD
`b9feb222a06dfa67129ead8b1c6c2611f86f69e7`. Modificações anteriores em
`desktop_api.py`, `test_desktop_api.py`, relatório/evidências de backup preservadas,
assim como `AGENTS.md`, `COMANDO-FABLE.md`, `RELATORIO-FABLE.md` não rastreados.
Vite 8.2.1, Node WSL 24.18.0. Navegador Chromium Windows headless isolado,
viewport pareado 1513x912, tema claro. Fixture de três bens: dois de dependente
(um no exterior) e um do titular. Sem documentos reais.

FONTES FISCAIS: não aplicáveis; nenhuma regra fiscal alterada.

ARQUIVOS E FIXTURES UTILIZADOS: `BensPage.jsx`, `formatters.js`, `titularidade.js`,
`BadgeOrigem.jsx`, `perfis.js`, `App.jsx`, `DataContext.jsx`, `DESIGN.md`.
Fixture e resultados em `evidencias-2026-09-08-titularidade/verificacao.json`.

ALTERAÇÃO: filtrar somente o marcador `dependente` na célula Discriminação.
A função compartilhada de marcadores continua intacta para outros consumidores.

ARQUIVOS MODIFICADOS: `src/pages/BensPage.jsx`; adicionados este relatório,
JSON de evidências e screenshots sintéticos. Build regenerou `dist/`.

TESTES EXECUTADOS: cinco verificações de browser, todas aprovadas: titularidade
única, exterior preservado, descrição preservada, filtro de dependente e filtro
de titular. Nenhum teste Vitest adicionado/executado para esta mudança visual.

SAÍDA BRUTA ANTES: `verificacao.json`, campo `antes`: cada linha de dependente
contém duas ocorrências de `Dependente:`.

SAÍDA BRUTA DEPOIS: `verificacao.json`, campo `depois`: uma ocorrência em cada
linha de dependente; exterior, descrições, valores e linhas mantidos.

VALIDAÇÃO VISUAL: capturas reais `antes.png`, `depois.png`, `depois-escuro.png`.
Inspeção da captura depois em 1513x912 claro; captura adicional em 1280x800 escuro.
Não foram validados WebView2 nativo, escala Windows 125%/150%, janela mínima,
todos os estados, contraste medido ou navegação completa por teclado.

VALIDAÇÃO DE BUILD: `npm run build` no WSL, código 0, 683 módulos, entradas web
e desktop geradas; aviso informativo `PLUGIN_TIMINGS`. `git diff --check` sem erros.

REGRESSÕES: nenhuma identificada nas verificações realizadas.

RISCOS REMANESCENTES: frases de titularidade pertencentes ao texto original da
discriminação permanecem; esta alteração remove apenas o selo gerado pela tela.
Não se declara validação integral de acessibilidade ou do desktop instalado.

DECISÃO: MANTER. Critério da duplicação atendido.

COMMIT: não realizado, não autorizado.

PRÓXIMA FALHA CANDIDATA: nenhuma nova falha investigada nesta volta.
