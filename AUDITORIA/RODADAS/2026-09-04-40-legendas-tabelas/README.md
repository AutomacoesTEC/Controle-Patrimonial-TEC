# Rodada 40 — Legendas acessíveis das tabelas

## Falha e previsão

Na trajetória `Dashboard → Demonstrativo de Conciliação Patrimonial`, as
tabelas são separadas visualmente por cards, mas nenhuma contém `<caption>`;
quem navega por tabelas com leitor de tela perde o nome de cada conjunto.
O mesmo padrão aparece nas 47 declarações `<table>` do código-fonte.

Previsão: no Dashboard, a quantidade de tabelas permanece igual e todas
ganham caption não vazia e visualmente oculta; inserções dinâmicas recebem a
mesma regra. Nenhum texto da caption ocupa área visual.

Fixture `verificar-legendas.py`, perfil AJU-01, viewport 1366 × 768, sem seeds,
modelo Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`87a346d`; saídas `antes.txt`/`depois.txt`. Camada causal única: nome
programático de tabelas por caption.

## Decisão

**MANTER.** As cinco tabelas permaneceram presentes e passaram de zero a cinco
captions, todas com nomes distintos e não vazios. Cada caption mede 1 × 1px,
usa posição absoluta e recorte total, portanto não ocupa a apresentação
visual. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 660 módulos; regressão com 41 arquivos e
885 testes aprovados.
