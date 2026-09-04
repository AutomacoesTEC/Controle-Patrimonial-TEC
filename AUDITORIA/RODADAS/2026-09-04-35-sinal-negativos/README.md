# Rodada 35 — Sinal dos valores negativos

## Falha, previsão e congelamento

B3 ainda afirma que ganho/perda se distinguem somente por cor. A primeira
medição mostrou que os valores realmente negativos já têm sinal, mas uma
linha de valor zero recebe `.negative` e portanto semântica visual de perda.

Previsão: células negativas não zero sem sinal permanecerão em 0; zeros com
classe negativa cairão de 1 para 0 em tela e `print`; textos monetários ficarão
idênticos e o cabeçalho B3 passará a concluído.

Fixture `verificar-sinais.py`, 1366 × 768, sem seeds, modelo Codex baseado em
GPT-5 (identificador exato não exposto), commit-base `4a6fc56`; saídas
`antes.txt`/`depois.txt`. Camada causal: semântica visual de sinal, sem mudar
formatação nem cálculo.

## Decisão

**MANTER.** Dez valores negativos não zero preservaram sinal em tela e
impressão; negativos sem sinal permaneceram em 0. O zero de Pagamentos
Diversos deixou a classe negativa (1→0), sem alterar o texto monetário, e B3
passou a concluído. Evidência bruta em `antes.txt`/`depois.txt`.

Verificação adicional: build aprovado; 41 arquivos e 885 testes passaram.
