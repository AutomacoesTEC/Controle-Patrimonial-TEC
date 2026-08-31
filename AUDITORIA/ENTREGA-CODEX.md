# Entrega ao Codex — Auditoria e correção da fase de EXTRAÇÃO (importador IRPF 2026)

Data: 31/08/2026. Raiz do projeto: `~/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte`.
Este arquivo é a entrega íntegra e imune a truncamento de canal: em vez de pedir confiança
no texto, aponta caminhos e comandos que você mesmo executa para confirmar cada fato.

## 1. Resumo (confirmado)
- Fase: EXTRAÇÃO do importador IRPF 2026.
- Achados: 51 encontrados, 51 corrigidos.
- Suíte: 561 testes passam, 1 pulado, 0 falhas.
- Método: auditoria independente (sem confiar em relato anterior).

## 2. Verificação direta (rode e confira)
Todos os comandos partem da raiz do projeto.

1. Suíte inteira:
   npx vitest run
   Esperado: Tests 561 passed | 1 skipped (562).

2. Testes novos de regressão (86 casos):
   npx vitest run src/pages/importParsersPdfSintetico.test.js
   Esperado: Tests 86 passed.

3. Achados ainda abertos no mapa (tem de ser 0):
   grep -c "^- \[ \]" AUDITORIA/MAPA-RESOLUCAO.md

4. Arquivos sob correção (existência):
   ls src/pages/importParsers.js src/irpf/catalogoFichasPdf2026.js

5. Provas de campo regeráveis:
   ls AUDITORIA/rows-pdfjs/ AUDITORIA/saida-parsepdf/
   Geradores: src/irpf/dumpRowsPdfjs.audit.test.js e src/irpf/dumpParsePdf.audit.test.js

6. Relatório e mapa:
   ls AUDITORIA/AUDITORIA-EXTRACAO-PDF-IRPF-2026.md AUDITORIA/MAPA-RESOLUCAO.md

7. Identidade do PDF reancorado (hash e páginas):
   python3 -c "import hashlib;print(hashlib.sha256(open('output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf','rb').read()).hexdigest())"
   Esperado: d2e3062006249919a8db43c52443e72e85f61ac4b07690c2ebff4611c246ce31 (41 páginas).

## 3. Método (o que foi pedido)
- Cada afirmação cita trecho literal: arquivo:linha para código, página/row para PDF.
- Prova de campo real, não simulação:
  - AUDITORIA/rows-pdfjs/*.rows.txt = linhas visuais exatas que o parser enxerga,
    extraídas com o mesmo pdfjs-dist do app e agrupadas com buildRows/TOLERANCIA_LINHA
    copiados verbatim de importParsers.js.
  - AUDITORIA/saida-parsepdf/*.json = valor de retorno REAL de parsePDF sobre os 3 PDFs.
- Cada correção tem teste contra os 3 PDFs sintéticos (output/pdf/) e foi PROVADA POR
  REVERSÃO: só conta como coberta se remover a correção faz teste falhar.

## 4. Arquivos
Sob correção:
- src/pages/importParsers.js        (parser de extração)
- src/irpf/catalogoFichasPdf2026.js (catálogo/matcher de fichas)

Testes novos (86 casos, todos verdes):
- src/pages/importParsersPdfSintetico.test.js

Documentação:
- AUDITORIA/AUDITORIA-EXTRACAO-PDF-IRPF-2026.md  (relatório: Parte I achados, II e III correções)
- AUDITORIA/MAPA-RESOLUCAO.md                    (status por achado; 0 abertos)

PDFs sintéticos (gabarito, versionados):
- output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf       (41 páginas, ajuste anual)
- output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf   (8 páginas, final de espólio)
- output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf (9 páginas, saída definitiva)

## 5. Áreas cobertas (todos os achados)
- Bens e Direitos: titularidade + CPF do beneficiário, país do bem, bloco de herdeiros
  (espólio), Inscrição Municipal/Matrícula/RENAVAM, número do item, colunas de partilha,
  âncoras de valor derivadas do cabeçalho, cabeçalho "(R$)" do exterior fora da descrição.
- Dívidas: saldo abaixo de R$ 1.000,00 caindo na coluna errada; discriminação justificada
  lida por coluna.
- Rendimentos: título quebrado em duas linhas (exigibilidade suspensa, RRA dependentes)
  vira AVISO nominal; isentos/exclusiva lidos por coluna (nome x descrição x documento do
  doador); 13º dos dependentes marcado como do dependente.
- Doações: três layouts de cabeçalho distintos (Efetuadas, Partidos, ECA/Idoso); coluna
  PARC. NÃO DEDUTÍVEL; aviso enganoso removido.
- Pagamentos: titularidade (Titular/Dependente/Alimentando), inclusive através da virada
  de página.
- Ganho de Capital (12 defeitos): imóvel (especificação/endereço, data/custo, valor/valor
  líquido, reduções, Resultado 1-5, faixas), participação (corretagem x valor, espécie,
  município/UF, custo de aquisição, consolidação), moeda estrangeira em espécie, data da
  última parcela.
- Resumo e Cálculo: imposto a restituir (linha separada), evolução patrimonial de espólio
  e saída, decomposição de rendimentos/deduções/imposto devido/imposto pago/outras
  informações (chaves de impostoDevido de 20 para 61), valor e número de quotas.
- Atividade Rural: imóvel sem CIB, vínculo do participante, opção de apuração, apuração
  vazia não reportada como preenchida, nome de espécie completo, participante estrangeiro.
- FII e Fiagro: matriz mês a mês (rótulo órfão MÊS, rótulo partido, bucket de coluna).

## 6. Notas
- O teste src/irpf/pdfSinteticoAju01.audit.test.js foi REANCORADO: estava preso à versão
  anterior do AJU-01 (33 páginas, sem GCAP, doações ECA/Idoso "Sem Informações"). O arquivo
  atual tem 41 páginas (hash em 2.7 acima), com GCAP e doações ECA/Idoso preenchidas. Hash
  e contagem de páginas foram verificados contra o arquivo real; as asserções obsoletas
  foram trocadas por asserções verdadeiras sobre o documento atual, sem enfraquecimento.
- RESSALVA (instruída): a divergência entre o PDF e o XML do AJU-01 NÃO foi tratada como
  bug do parser.
- Dois arquivos de scratch de sessão anterior (src/pages/__auditgrupo.test.js e
  __auditrows.test.js) que falhavam por escrever num diretório morto foram removidos.

## 7. Se algo não bater
Diga qual comando e o output obtido; eu confiro na hora.
