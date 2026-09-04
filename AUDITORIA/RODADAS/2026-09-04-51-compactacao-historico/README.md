# Rodada 51 — Compactação do histórico antigo

## Falha e previsão

Com 300 alterações existentes, duas novas ações mantêm o cap em 300 apenas por
`slice`: três entradas antigas somem sem deixar contagem ou indicação na
trilha. A última linha continua sendo uma alteração individual.

Previsão: o mesmo fixture continua com exatamente 300 entradas, mas a última
passa a ser um resumo determinístico de `3 alterações antigas compactadas`,
com `compactadoQuantidade=3`; uma nova rodada acumula, em vez de criar resumos
independentes.

Fixture `verificar-compactacao.test.js`, 300 entradas, duas ações e relógios
fixos, sem seeds, modelo Codex baseado em GPT-5 (identificador exato não
exposto), commit-base `aaf4219`; saídas `antes.txt`/`depois.txt`. Camada causal
única: persistência/limite da trilha de alterações.

## Decisão

**MANTER.** O tamanho permaneceu em 300 e a última entrada passou de uma
alteração individual sem contexto para o resumo previsto, com contagem 3.
A segunda ação incorporou o resumo anterior, confirmando acumulação. Evidência
bruta em `antes.txt`/`depois.txt`.

Verificações finais: fixture direcionado aprovado; regressão com 45 arquivos e
894 testes aprovados; build de produção aprovado com 663 módulos transformados.
