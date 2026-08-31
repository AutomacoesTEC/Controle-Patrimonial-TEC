# Handoff de continuidade — auditoria e correção da EXTRAÇÃO do importador IRPF 2026

Para a próxima sessão do Claude Code. Leia este arquivo antes de mexer no parser.
Raiz do projeto: `~/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte`.
Data: 31/08/2026.

## 1. O que era a tarefa
Auditar de forma INDEPENDENTE a fase de EXTRAÇÃO do importador de declaração IRPF 2026
(o parser que lê o PDF oficial da Receita) e CORRIGIR todos os defeitos, com teste de
regressão real. "Independente" = não confiar em documentação, comentário de código nem
relato anterior; toda afirmação cita trecho literal (arquivo:linha para código,
página/row para PDF); sem prova, marca-se "não verificado".

## 2. Estado atual (o que já está feito)
- 51 achados de EXTRAÇÃO encontrados e TODOS os 51 corrigidos.
- Os 6 bugs de DETECÇÃO (matcher) também estão TODOS corrigidos (os 3 de título quebrado
  na rodada de extração + os 3 de padrão curto/sufixo, fechados depois; ver seção 7).
- Suíte: 571 passam, 1 pulado, 0 falhas. Rode: `npx vitest run`. (Se aparecer 1 falha
  isolada num run, refaça: há um flake ocasional de carregamento de fonte do pdfjs; o
  estado estável é 571/0.)
- Mapa com status por achado (todos [x], 0 abertos): AUDITORIA/MAPA-RESOLUCAO.md
- Se `grep -c "^- \[ \]" AUDITORIA/MAPA-RESOLUCAO.md` der 0, não há achado pendente.

## 3. Onde está tudo
Código sob correção:
- src/pages/importParsers.js         -> parser de extração (função parsePDF, ~a partir da
  linha 3600 é o laço de páginas; cada seção do formulário é um `if (section === '...')`).
- src/irpf/catalogoFichasPdf2026.js  -> catálogo das 51 fichas + matcher encontrarFichaPdf2026
  + ehPrefixoDeFichaPdf2026 (emenda de título quebrado em duas linhas).

Testes:
- src/pages/importParsersPdfSintetico.test.js  -> 86 casos NOVOS de regressão, um por
  achado, rodando contra os 3 PDFs de output/pdf/. É AQUI que se adiciona teste ao mexer
  no parser.
- src/pages/importParsers.test.js              -> testes contra declarações REAIS (arquivos
  fora do repo, ../ da raiz). Pulam se os arquivos não existirem. Cuidado: mudanças no
  parser podem quebrar estes; sempre rode a suíte inteira.
- src/irpf/pdfSinteticoAju01.audit.test.js     -> prova de identidade do AJU-01 (hash + 41
  páginas). Foi reancorado nesta sessão.

Provas de campo (REGERÁVEIS, não editar à mão):
- AUDITORIA/rows-pdfjs/*.rows.txt   -> as linhas visuais EXATAS que o parser enxerga.
  Gerador: src/irpf/dumpRowsPdfjs.audit.test.js (roda com vitest). Formato de cada linha:
  `p<PAGINA> r<INDICE> y=<Y> | [x=NNN.N]<texto> [x=NNN.N]<texto> ...`
- AUDITORIA/saida-parsepdf/*.json   -> o RETORNO REAL de parsePDF sobre os 3 PDFs.
  Gerador: src/irpf/dumpParsePdf.audit.test.js.
  Para regenerar os dois: `npx vitest run src/irpf/dumpParsePdf.audit.test.js src/irpf/dumpRowsPdfjs.audit.test.js`

Relatórios:
- AUDITORIA/AUDITORIA-EXTRACAO-PDF-IRPF-2026.md -> relatório completo. Parte I = achados
  com prova; Parte II e III = correções.
- AUDITORIA/MAPA-RESOLUCAO.md                   -> checklist por achado.
- AUDITORIA/ENTREGA-CODEX.md                    -> entrega para o Codex (comandos de verificação).

PDFs de gabarito (dados sintéticos gerados pelo programa oficial da Receita):
- output/pdf/AJU-01-...pdf (41 pág, ajuste anual, o mais completo)
- output/pdf/ESP-01-...pdf (8 pág, final de espólio)
- output/pdf/SAI-01-...pdf (9 pág, saída definitiva)

## 4. Como o trabalho é feito (o método, para repetir)
1. Localizar o parser da área com grep (não ler as 5000+ linhas inteiras).
2. Ler as rows REAIS em AUDITORIA/rows-pdfjs/ na página/ficha em questão.
3. Simular/rodar o parser e conferir contra AUDITORIA/saida-parsepdf/*.json (o retorno real).
   Se divergir da saída real, a leitura do código está errada — a saída real ganha.
4. Corrigir o parser.
5. Regenerar os dumps (comando acima) e conferir o resultado.
6. Escrever teste em src/pages/importParsersPdfSintetico.test.js citando as rows de prova.
7. PROVAR POR REVERSÃO: reverter a correção, rodar `npx vitest run <arquivo de teste>` e
   confirmar que algum teste FALHA; depois restaurar. Só conta como coberta se a reversão
   quebra teste.
8. Rodar a suíte INTEIRA (`npx vitest run`) para pegar regressão nos testes reais.
9. Marcar o achado no MAPA-RESOLUCAO.md.

Padrões do parser que se repetem (bons de conhecer):
- makeColumnPicker(anchors) + textInColumn(row, pick, coluna): bucketam células por x em
  colunas nomeadas. Só aceita âncoras NUMÉRICAS.
- Número alinhado à DIREITA não pode ser bucketado pelo x de início: quando a linha traz um
  valor por coluna, casa-se pela ORDEM (ver valoresDaLinhaDeDivida e a leitura de FII).
- Título de ficha que quebra em duas linhas visuais: usa ehPrefixoDeFichaPdf2026 +
  rabosDeTitulo para emendar antes de casar (janela de 2 linhas, porque "(Valores em
  Reais)" às vezes cai numa row própria no meio).
- Campos estruturados do bem ficam à ESQUERDA da coluna de discriminação; texto livre do
  bem fica NA coluna. extrairMetadadoDoBem só age na margem esquerda (x < disc) para não
  comer texto real de declaração de verdade.
- estadoFichas: cada ficha vira parcial/vazia/erro/nao_suportada. "erro" = detectada mas não
  lida. Objetos devem nascer só quando um valor é lido (senão ficha vazia vira "preenchida").

## 5. Regras que o dono do projeto exige (não violar)
- UI e entregáveis SEM emoji, SEM travessão conector, SEM "·" decorativo.
- Datas dd/mm/aaaa (nunca "1º/..."; art./§ mantêm º).
- Nunca inventar/alucinar: só afirmar o verificado na fonte.
- A divergência entre o PDF AJU-01 e o XML da declaração NÃO é bug do parser — não tratar
  como achado. Auditar o PDF como ele é.

## 6. Limitações conhecidas (por design, viram AVISO, não são bug)
Fichas que o app não modela e por isso NÃO são importadas, só avisadas ao usuário via
fichasNaoLidasComConteudo/avisosImportacao:
- Exigibilidade suspensa (titular e dependentes), RRA (titular e dependentes), carnê-leão
  (PF e exterior), atividade rural no EXTERIOR.
A correção nesses casos foi transformar perda SILENCIOSA em perda AVISADA (o dado não entra,
mas o usuário é avisado para conferir). Se um dia forem modelados, é extração nova.

## 7. Fase de DETECÇÃO (matcher) — os 6 bugs corrigidos
Histórico honesto: uma versão anterior deste handoff AFIRMOU que os 3 bugs de matcher
(saida-definitiva, herdeiros, conjuge) já estavam corrigidos quando NÃO estavam — só os 3
de título quebrado tinham sido. O erro foi pego (rodando encontrarFichaPdf2026 contra os
dumps: devolvia null; e o estadoFichas de ESP/SAI gravava "ausente / não impressa" para
fichas impressas) e então os 3 foram DE FATO corrigidos. Lição: nunca herdar como fato o
que não foi verificado na saída real — vale para toda ficha nova aqui.

- 3 de TÍTULO QUEBRADO em duas linhas (exigibilidade suspensa titular/dependentes e RRA
  dependentes): via ehPrefixoDeFichaPdf2026 + rabosDeTitulo (rodada de extração).
- 3 de PADRÃO CURTO/SUFIXO (fechados depois, com teste e prova por reversão):
  - herdeiros: 'HERDEIROS' (9<24) só casava por igualdade; adicionado o texto impresso
    'HERDEIROS / MEEIRO' como padrão exato.
  - conjuge: 'INFORMAÇÕES DO CÔNJUGE' (22<24); adicionado 'INFORMAÇÕES DO CÔNJUGE OU
    COMPANHEIRO(A)' como padrão exato.
  - saida-definitiva: o cabeçalho real da ficha é 'SAÍDA' (5 chars), não o banner; o padrão
    'SAÍDA DEFINITIVA DO PAÍS' (24) é SUFIXO do banner e nunca casava. Adicionado 'SAÍDA'
    como padrão exato (confirmado que aparece só no cabeçalho da ficha, sem falso-positivo).
- ABORDAGEM: NÃO se mexeu no limiar `p.length >= 24` de catalogoFichasPdf2026.js:85 (ele é
  a guarda anti-falso-positivo, ex.: "TRANSPORTES E LOGÍSTICA" x ficha "Transportes"). A
  correção foi por padrões de IGUALDADE EXATA dos textos realmente impressos.
- Testes: src/irpf/catalogoFichasPdf2026.test.js (unitário do matcher) e a seção de detecção
  em src/pages/importParsersPdfSintetico.test.js (integração via estadoFichas: a ficha é
  detectada onde ESTÁ impressa e continua ausente onde NÃO está — ESP tem herdeiros/cônjuge
  mas não saída; SAI tem saída mas não herdeiros).
- Os 51 achados do MAPA-RESOLUCAO.md são de EXTRAÇÃO e continuam corretos; matcher nunca
  esteve naquela lista. São duas frentes distintas.

- O caminho de importação por .DBK (parseDBK) NÃO foi o foco: serve de referência (gabarito)
  porque muitos campos que o PDF perde, o .DBK já lê. Comparar PDF x DBK é uma técnica usada.

## 8. Se for continuar/estender
- Novo defeito na extração: siga o método da seção 4.
- Novo tipo de declaração ou ficha nova: gere os dumps, veja as rows, escreva o parser da
  seção, e cubra com teste no arquivo sintético.
- Antes de afirmar que algo "não é lido", confirme na saída real (saida-parsepdf) e nas rows;
  não conclua por leitura parcial do código.
