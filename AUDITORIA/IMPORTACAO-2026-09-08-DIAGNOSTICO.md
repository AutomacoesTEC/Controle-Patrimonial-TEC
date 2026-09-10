# Diagnóstico da importação — 2026-09-08

Pedido: resolver falhas de importação. A validação integral continua pendente;
esta investigação não autoriza remover estados parciais ou atestar cobertura.

FALHA: nenhuma falha funcional reproduzida nos três PDFs sintéticos selecionados.
Identificada lacuna de teste: a suíte PDF existente chama o parser com
`validarDocumento: false`, diferente da tela de importação.

TRAJETÓRIA: parser com validação padrão nos PDFs AJU-01, ESP-01 e SAI-01;
importação real do AJU-01 via seletor da tela, confirmação, gravação e recarga.

IMPACTO: testes anteriores de extração não comprovavam a aceitação pela guarda
de reconhecimento do documento usada na interface.

CAMADA CAUSAL: teste. Código de produção não modificado nesta etapa.

CLASSIFICAÇÃO DAS EVIDÊNCIAS: PROVADO PELO CÓDIGO, flag em
`importParsersPdfSintetico.test.js`; PROVADO POR TESTE, três PDFs passam na guarda
padrão e nenhum retorna ficha em estado `erro`. Isso não comprova integralidade
de extração, pois existem fichas com suporte parcial ou não suportadas.

PREVISÃO REGISTRADA: verificar se documentos aceitos na suíte com a guarda
desativada seriam recusados no caminho real. Resultado: não foram recusados.

BASELINE CONGELADA: branch `fix/auditoria-2026-08-24`, HEAD
`b9feb222a06dfa67129ead8b1c6c2611f86f69e7`; alterações das voltas anteriores
preservadas (API, teste Python, CSS, Bens, Rendimentos, Titular, relatórios).
Node 24.18.0, Vitest 4.1.10, PDF.js 6.2.108 no WSL. Interface via Chromium
Windows isolado, viewport 1513x912, dados sintéticos sem sessão do usuário.

FONTES FISCAIS: nenhuma regra fiscal alterada. Evidência dos testes não equivale
a validação fiscal oficial.

ARQUIVOS E FIXTURES UTILIZADOS: os três PDFs sintéticos em `output/pdf/`, nomes
com prefixos AJU-01, ESP-01 e SAI-01. Nenhuma declaração real ou manifesto lido.

ALTERAÇÃO / ARQUIVOS MODIFICADOS: novo `src/pages/importacaoProducao.test.js`
com três testes da validação padrão; este relatório. Sem alteração do parser.

TESTES EXECUTADOS:
```bash
npm test -- src/pages/importParsersPdfSintetico.test.js src/utils/importacaoDeclaracao.test.js src/utils/importacaoDeclaracao.integridade.test.js
npm test -- src/pages/importacaoProducao.test.js
git diff --check
```

SAÍDA BRUTA ANTES: baseline 3 arquivos, 114 testes aprovados, 0 falhos, 0 ignorados.
SAÍDA BRUTA DEPOIS: suíte nova 1 arquivo, 3 testes aprovados, 0 falhos, 0 ignorados.
Aviso PDF.js `Ensure that the standardFontDataUrl API parameter is provided`.
A primeira execução da suíte nova tinha erro no cleanup do próprio teste
(`pdf.destroy is not a function`), corrigido para `pdf.cleanup()` antes de tirar
conclusões sobre o parser. Não foi falha do aplicativo.

VALIDAÇÃO VISUAL/INTEGRADA: AJU-01 chegou à revisão e à confirmação na tela.
Depois de confirmar a troca do titular sintético: ano 2025, 7 bens, 18 rendimentos,
8 pagamentos, 1 dependente; contagens idênticas após recarregar. Contexto encerrado.
Revisão mostrou 33 estados parciais, 7 ausentes e 13 não estruturados;
a importação com sucesso não significa suporte completo a essas fichas.

VALIDAÇÃO DE BUILD: não repetida nesta etapa, mudança apenas em teste/documentação.
REGRESSÕES: nenhuma alteração de produção introduzida.
RISCOS REMANESCENTES: declaração real ainda não auditada; testes eletrônicos DBK
não executados; codificação de entrada eletrônica requer investigação específica
(`file.text()` na interface versus `latin1` nos testes históricos).

DECISÃO: MANTER a cobertura adicional de testes. Diagnóstico do documento real
BLOQUEADO até autorização explícita para teste com dados reais, exigida no prompt.
COMMIT: não realizado, não autorizado.
PRÓXIMA FALHA CANDIDATA: divergência de extração/integração no documento usado pelo
usuário, ainda NÃO DETERMINADA. Não ocultar avisos para simular correção.
