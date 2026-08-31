# Handoff das correções da extração PDF IRPF 2026

Data da pausa: 31/08/2026. Retomar a partir de "PRÓXIMO PASSO EXATO" no fim.

## Arquivos que importam
- Código sob correção: `src/pages/importParsers.js`
- Testes de regressão novos: `src/pages/importParsersPdfSintetico.test.js` (55 casos, todos verdes)
- Relatório da auditoria: `AUDITORIA/AUDITORIA-EXTRACAO-PDF-IRPF-2026.md`
- Mapa de resolução com status por achado: `AUDITORIA/MAPA-RESOLUCAO.md`
- Dumps de prova (regeráveis por vitest):
  - `AUDITORIA/rows-pdfjs/*.rows.txt`  (gerador: `src/irpf/dumpRowsPdfjs.audit.test.js`)
  - `AUDITORIA/saida-parsepdf/*.json`  (gerador: `src/irpf/dumpParsePdf.audit.test.js`)

## Método fixo (não mudar)
Toda correção é validada por REVERSÃO: depois de corrigir, reverte-se a mudança e
confirma-se que algum teste falha. Só conta como coberta se a reversão quebra teste.
Rodar `npx vitest run src/irpf/dumpParsePdf.audit.test.js` regenera os JSON de saída
real do parser; rodar `npx vitest run` roda a suíte inteira.

## Estado da suíte agora
530 passam, 1 pulado, 2 FALHAM. As 2 falhas são PRÉ-EXISTENTES (anteriores a esta
frente) em `src/irpf/pdfSinteticoAju01.audit.test.js`: ele fixa o hash e as 33 páginas
de uma versão ANTIGA do AJU-01, e o arquivo atual tem 41 páginas. Precisa ser
reancorado no arquivo atual — tarefa à parte, não é regressão.

## RESOLVIDO nesta frente (com teste real e prova por reversão)

### Rodadas anteriores (Parte II do relatório)
- FII/Fiagro matriz mês a mês (rv-01, rv-02) — 3 defeitos, incl. bucket de coluna.
- Título de ficha quebrado em duas linhas (rend-01, rend-02): exigibilidade suspensa
  e RRA dependentes viram AVISO nominal. Emenda de título de 2 linhas no catálogo
  (`ehPrefixoDeFichaPdf2026`) e na rede de segurança (`rabosDeTitulo`).
- Imóvel rural sem CIB (rural-01, rural-02): ficha lida e participante vinculado.
- Dívidas com saldo < R$ 1.000 na coluna errada (dividas-01, dividas-02):
  `valoresDaLinhaDeDivida`, leitura por ORDEM.

### Área DOAÇÕES (todos resolvidos)
- doacoes-01/pagdoa-01, doacoes-02/03/pagdoa-02: três layouts de cabeçalho distintos
  (Efetuadas CÓD.|NOME|CPF/CNPJ|VALOR PAGO|PARC.NÃO DEDUTÍVEL; Partidos NOME|CNPJ|VALOR;
  ECA/Idoso TIPO DE FUNDO|FUNDO|CNPJ|VALOR). `processDoacaoRow` reescrito com
  `st.layouts`. Corrigido também `makeColumnPicker` para ignorar âncoras não numéricas
  (a chave `tipoLayout` string corrompia o bucketing).
- doacoes-04/pagdoa-03: coluna PARC. NÃO DEDUTÍVEL ancorada em Efetuadas.
- doacoes-05: valor deixou de ser concatenado com a parcela.
- pagamentos-01/pagdoa-04: titularidade dos pagamentos (Titular/Dependente/Alimentando),
  incl. o marcador que atravessa a virada de página (não zerar na reimpressão do título).
- pagdoa-05: removido o aviso enganoso "layout extrapolado".
- pagdoa-06: guard de marcador cobre Dependente/Alimentando/Titular.
- Nota: fixture `doacoes-apos-anexo-rural.pdf` usa o layout ANTIGO (irreal); a ficha
  ECA/Idoso aceita os dois layouts (`layouts: ['fundo','efetuadas']`), cabeçalhos disjuntos.

### Área BENS (todos resolvidos)
- bens-01: titularidade + CPF do beneficiário (linha "Bem ou direito pertencente ao:").
  Removido 'CPF:' de BOILERPLATE (o cabeçalho de página já é pego por 'IMPOSTO SOBRE A
  RENDA - PESSOA FÍSICA'); antes a linha de titularidade era descartada inteira.
- bens-02: país do bem (linha "NNN - PAÍS"); default 105 só se não vier.
- bens-03: bloco de herdeiros do bem partilhado (nome, CPF, percentual).
- bens-04: cabeçalho "(R$)" do subquadro do exterior não gruda na discriminação.
- bens-05: colunas de partilha do espólio nomeadas (situacaoDataPartilha,
  valorTransferencia, ehPartilha).
- bens-06: numeroItem (coluna BEM), casa com Demonstrativo Lei 14.754.
- bens-07: Inscrição Municipal / Matrícula / RENAVAM.
- bens-08: âncoras de valor derivadas do cabeçalho quando não há linha de datas puras.
- bens-09: `isBensMetadataRow` é código morto — comentário corrigido (ligá-la quebra
  declarações reais, provado). Toda a extração de metadados em `extrairMetadadoDoBem`,
  restrita à margem esquerda (x < disc) para não comer texto livre da discriminação.

## EM ANDAMENTO — Área GANHO DE CAPITAL (gc-01 a gc-12), NÃO terminada

JÁ FEITO (só constantes e estado; inertes, suíte verde):
- GC_BLOCOS: adicionados `/^CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA$/` (gc-05) e
  `/^CUSTO DE AQUISIÇÃO$/ -> 'custoAquisicaoParticipacao'` (gc-09).
- GC_ROTULOS.apuracao: adicionadas as variantes "da Alienação" (gc-06) e os cinco
  "Resultado" + as reduções Lei 7.713 / Lei 11.196 FR1/FR2 / Outro Imóvel (gc-07).
- Estado novo `let gcEspecEstado = 0;` (perto de `gcBloco`), zerado ao abrir bloco.

FALTA FAZER (os handlers que consomem o que foi adicionado):
- gc-02: "Especificação e endereço" (multi-linha) — usar gcEspecEstado: 1 = próxima
  linha é `currentGc.bem`, 2 = linhas de `endereco` até o próximo bloco. Rows de prova:
  AJU-01 p14 r15/r16/r17/r18.
- gc-03: no bloco 'custoAquisicao', ler "Data de Aquisição:" e "Custo de aquisição (R$):"
  como rótulo:valor NA MESMA linha (AJU-01 p14 r31/r32). Hoje o handler exige
  'Data de aquisição' (minúscula) e lê da linha de baixo.
- gc-01: participação — o handler de "Data de Alienação" (AJU-01 p20 r10/r11) tem TRÊS
  colunas (data | valor alienação | corretagem). Hoje grava valoresDe(proxima)[0] em
  custoCorretagem (é o valor de alienação). Quando o cabeçalho tiver "Valor de alienação",
  ler valorAlienacao=v[0] e custoCorretagem=v[1].
- gc-10: no branch de "Natureza", capturar também "Espécie da participação" por posição
  (AJU-01 p20 r12/r13: naturezaOperacao='ALIENAÇÕES...', especie='QUOTAS').
- gc-11: município e UF da sociedade por coluna (AJU-01 p20 r8/r9). Hoje o par-linha-
  seguinte usa `.find(Boolean)` e pega só o primeiro (CNPJ).
- gc-09: parser do quadro 'custoAquisicaoParticipacao' (AJU-01 p20 r19/r20/r21):
  especie 'Quota', quantidade 1234, custoMedio 32.918534, custoTotal 40621.47, e
  setar currentGc.custoAquisicao.
- gc-08: tabela de faixas (gcBloco==='faixas'), AJU-01 p15 r25-30 e p20 r32-37:
  { faixa, aliquota, total, anterior, atual } em currentGc.faixasTributacao.
- gc-12: "Data de Recebimento da Última Parcela" (AJU-01 p18 r9) -> dataUltimaParcela e
  marcar a última parcela.
- gc-04: MOEDA EM ESPÉCIE — a alienação detalhada nunca é lida. O handler exige o
  cabeçalho 'ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE' que NÃO existe no PDF; o layout
  real está em AJU-01 p22 r6-r11 (CPF/CNPJ do Adquirente / Nome; Data da Alienação /
  Quantidade / Valor da Alienação; Custo Médio / Custo de Aquisição / Ganho de Capital).
  Ver seção `section === 'ganhoCapitalMoeda'`.

Depois de cada correção GC: reexecutar dumpParsePdf, conferir `apuracaoGanhoCapital` e
`ganhosCapitalOficial` no AJU-01, escrever testes no arquivo sintético, provar por
reversão, e rodar a suíte inteira (a regressão a vigiar é a dos testes reais de GC em
`src/pages/importParsers.test.js`, que usam a declaração real fora do repo).

## AINDA ABERTAS (não começadas) — ver MAPA-RESOLUCAO.md
- RESUMO E CÁLCULO: resumo-01 a resumo-10 (imposto a restituir, evolução de espólio/
  saída, blocos de rendimentos/deduções/imposto devido/imposto pago/outras informações,
  parcelamento/quota, aviso de ficha 'estruturada' com valores fora).
- RENDIMENTOS: rend-05 (cabeçalho 'Pagadora' na descrição), rend-06 (nome+descrição
  concatenados), rend-07 (CPF do doador no nome), rend-08 (13º dependentes = Titular).
  rend-03/rend-04 são AVISO (carnê-leão e RRA titular) — confirmar que já avisam.
- RURAL: rural-03 (opção de apuração), rural-04 (apuração "Sem Informações" reportada
  como preenchida), rural-05 (rural exterior — AVISO, confirmar), rural-06 (nome de
  espécie truncado), rural-07 (participante sem CPF/estrangeiro).
- DÍVIDAS: dividas-03 (discriminação não usa textoDaColunaDisc — risco latente).

## PRÓXIMO PASSO EXATO
Retomar em GANHO DE CAPITAL, escrevendo os handlers listados em "FALTA FAZER".
Começar por gc-02/gc-03 (imóvel), depois gc-01/gc-10/gc-11/gc-09 (participação),
depois gc-08 (faixas), gc-12 (parcela) e gc-04 (moeda). As constantes já estão no lugar.
