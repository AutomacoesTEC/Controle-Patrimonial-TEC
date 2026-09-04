# Rodada 47 — Preserva o valor declarado na primeira edição

## Falha e previsão

Na trajetória `Bens e Direitos → primeiro item importado → Editar → Salvar`, o
registro mantém `origem=importacao`, mas substitui a discriminação sem guardar
o conteúdo declarado e não mostra selo `Editado`.

Previsão: a primeira edição cria `valorDeclarado` com a discriminação original,
mantém a nova no registro ativo e exibe um selo `Editado`; edições posteriores
preservam o primeiro snapshot. Itens manuais não ganham snapshot.

Fixture `verificar-edicao.py`, primeiro bem da AJU-01, viewport 1366 × 768,
sem seeds, modelo Codex baseado em GPT-5 (identificador exato não exposto),
commit-base `7112a02`; saídas `antes.txt`/`depois.txt`. Camada causal única:
retenção do estado declarado na primeira edição manual.

## Decisão

**MANTER.** A origem e a edição ativa foram preservadas; `valorDeclarado`
passou de ausente a presente com a discriminação original exata, e surgiu um
selo `Editado`. Testes provam que a segunda edição não troca o snapshot e que
item manual não o cria. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 663 módulos; regressão com 42 arquivos e
890 testes aprovados.
