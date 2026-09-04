# Rodada 49 — Diferenças por campo no histórico

## Falha e previsão

Ao editar um bem de `Apto`/R$100 para `Apto reformado`/R$120, o histórico cria
a frase “Editou bem”, mas não guarda quais campos mudaram nem os valores antes
e depois. A tela não permite auditar a correção.

Previsão: a mesma ação mantém a descrição e passa de `mudancas=null` para duas
entradas determinísticas (`discriminacao` e `situacao_atual`), cada uma com
`antes` e `depois`. Metadados técnicos não entram no diff.

Fixture `verificar-diff.test.js`, estado sintético e ação fixa, sem seeds, modelo
Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`26f2c1f`; saídas `antes.txt`/`depois.txt`. Camada causal única: conteúdo de
verificação das entradas de histórico.

## Decisão

**MANTER.** A descrição permaneceu idêntica e `mudancas` passou de nulo às
duas diferenças previstas, sem metadados técnicos. A tela apresenta esses
pares abaixo da descrição. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações finais: fixture direcionado aprovado; regressão com 43 arquivos e
892 testes aprovados; build de produção aprovado com 663 módulos transformados.
