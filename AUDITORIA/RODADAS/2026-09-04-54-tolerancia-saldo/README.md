# Rodada 54 — Tolerância configurável do Saldo de Caixa

## Falha e previsão

O selo do Dashboard usa literalmente `saldoHeroCentavos === 0`: R$ 0,01 já
vira “Sobra a explicar”. Não existe configuração persistida no perfil, nem
critério visível para a pessoa ajustar.

Previsão: a inspeção passa de `zero_centavos` para `configuravel`, com os tipos
`fixa` e `percentual`. No mesmo fixture, R$ 1,00 fixo aceita saldo absoluto até
R$ 1,00 e 0,5% de patrimônio de R$ 200.000 calcula limite de R$ 1.000,00; um
centavo acima de cada limite não fecha. A escolha deve sobreviver no estado do
perfil e aparecer no histórico.

Fixtures de lógica com valores exatos, sem seeds ou relógio, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `b006e77`;
saídas `antes.txt`/`depois.txt`. Camada causal única: estado e critério de
classificação do selo de conciliação.

## Decisão

**MANTER.** Os limites fixo e percentual foram exatamente R$ 1,00 e
R$ 1.000,00, e um centavo acima deixou de fechar. O reducer persistiu 0,5% e
registrou a mudança. No navegador, as duas opções apareceram; R$ 999.999.999
mudou o selo para “Conciliação fecha”, sobreviveu à recarga e não criou
overflow horizontal. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações finais: regressão com 48 arquivos e 900 testes aprovados; build
de produção aprovado com 665 módulos transformados; fixture Chromium aprovado.
