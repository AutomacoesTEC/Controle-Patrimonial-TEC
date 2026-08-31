# Auditoria independente do reconhecimento de fichas no PDF

Data: `30/08/2026`. Método: prova direta sobre os artefatos, sem apoio em histórico
de conversa ou documentação anterior.

## Como foi feito

O importador chama `encontrarFichaPdf2026(c.text)` para **cada célula de texto** de
cada linha (`importParsers.js:3620`), não para a linha inteira. A comparação normaliza
com `replace(/\s+/g,' ').trim().toUpperCase()` e aceita **igualdade exata**, ou
`startsWith` **apenas quando o padrão tem 24 ou mais caracteres** (`catalogoFichasPdf2026.js:72-85`).

O script `auditar-matcher-fichas-pdf.py` porta essa função para Python e a executa
sobre os `24.788` itens de texto reais extraídos dos três PDFs, com `visitor_text`
do `pypdf` para preservar a granularidade de célula.

Resultado: `45` das `51` fichas do catálogo são reconhecidas; `6` não são.

## Correção de uma análise errada minha, feita no início desta auditoria

Um primeiro teste comparou os padrões de forma **sensível a caixa** e contra a
**página inteira concatenada**. Ele acusou quatro falsos positivos nas fichas de
ganho de capital, alegando que os padrões `DEMONSTRATIVO DA APURAÇÃO DO GANHO DE
CAPITAL - ...` não casariam porque o PDF imprime `Demonstrativo da Apuração do Ganho
de Capital - BENS IMÓVEIS` em caixa mista.

**Isso estava errado.** O matcher aplica `toUpperCase()` antes de comparar, então a
caixa mista casa normalmente. As quatro fichas de ganho de capital são reconhecidas.
O erro foi meu por auditar contra uma reconstrução do comportamento em vez do
comportamento real do código.

## Defeitos comprovados

### 1. Ficha de saída definitiva nunca é reconhecida. Severidade alta

| | |
|---|---|
| ficha | `saida-definitiva` |
| padrão do catálogo | `'SAÍDA DEFINITIVA DO PAÍS'`, 24 caracteres |
| impresso no PDF | `'DECLARAÇÃO DE SAÍDA DEFINITIVA DO PAÍS'` |
| onde | `SAI-01`, nas **nove** páginas, é o cabeçalho do documento |
| por que falha | o padrão tem 24 caracteres, então `startsWith` é permitido, mas o texto real **começa** por `DECLARAÇÃO DE `. O padrão é sufixo, não prefixo |

Consequência: ao importar a declaração de saída definitiva, o app grava
`presenca: 'ausente'` com a mensagem `Esta ficha não foi impressa no documento
selecionado` (`importParsers.js:5161-5165`) para a ficha de saída definitiva,
**dentro da própria declaração de saída definitiva**. É afirmação falsa sobre o
documento, não apenas ausência de extração.

### 2. Ficha de herdeiros nunca é reconhecida. Severidade alta

| | |
|---|---|
| ficha | `herdeiros` |
| padrão do catálogo | `'HERDEIROS'`, 9 caracteres |
| impresso no PDF | `'HERDEIROS / MEEIRO'` |
| onde | `ESP-01` página 2 |
| por que falha | com menos de 24 caracteres o matcher exige igualdade exata, e `HERDEIROS / MEEIRO` não é igual a `HERDEIROS` |

Mesma consequência: a declaração final de espólio informa que a ficha de herdeiros
não foi impressa, quando ela está impressa com dois herdeiros e percentuais.

### 3. Ficha do cônjuge nunca é reconhecida. Severidade média

| | |
|---|---|
| ficha | `conjuge` |
| padrões | `'INFORMAÇÕES DO CÔNJUGE'` e `'CÔNJUGE OU COMPANHEIRO'`, ambos 22 caracteres |
| impresso no PDF | `'INFORMAÇÕES DO CÔNJUGE OU COMPANHEIRO(A)'` |
| onde | `ESP-01` página 1 |
| por que falha | o primeiro padrão **é** prefixo exato do texto real, mas o limiar `p.length >= 24` o bloqueia por dois caracteres |

Este caso merece atenção porque o limiar de 24 foi introduzido para conter um falso
positivo real, documentado em comentário no próprio catálogo: `TRANSPORTES E LOGÍSTICA
LTDA` dentro da discriminação de um bem era reconhecido como a ficha `Transportes`.
A defesa contra falso positivo passou a produzir falso negativo em um padrão legítimo.
O limiar por comprimento é a heurística errada para esse problema.

### 4. Três fichas do catálogo não existem no IRPF 2026. Severidade informativo

`transportes`, `demais-rendimentos-titular` e `demais-rendimentos-dependentes` não
aparecem em nenhum dos três PDFs, nem sob outro título: a busca por `TRANSPORTE` e
`DEMAIS RENDIMENTO` em todos os itens de texto do `AJU-01` não retorna nada.

Não é defeito do matcher. É catálogo com entradas sem lastro no exercício 2026,
possivelmente herdadas de layout anterior. Enquanto existirem, o app sempre reportará
essas três como ausentes, o que é verdade, mas por motivo diferente do que a mensagem
sugere.

## O que esta auditoria ainda não cobriu

A fase de **extração** não foi executada. Ela auditaria, ficha por ficha, se os parsers
de `importParsers.js` leem corretamente os valores presentes nos PDFs: regex contra
layout real, colunas trocadas, conversão numérica, itens perdidos em quebra de página.

A execução multiagente dessa fase foi interrompida por limite de sessão, com os treze
agentes encerrados antes de produzir resultado. **Nenhum achado de extração foi
produzido, e a ausência de achados nessa área não significa ausência de defeitos.**

## Ressalva de método

O porte da função para Python usa `pypdf` para obter os itens de texto, enquanto o app
usa `pdfjs` no navegador. A segmentação de itens pode divergir entre as duas bibliotecas.
Os três defeitos acima não dependem dessa segmentação, porque os títulos aparecem como
item único e íntegro nos dois casos, mas uma reprodução dentro do próprio app é o passo
que fecharia a prova sem ressalva.
