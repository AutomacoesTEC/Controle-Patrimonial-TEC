# Rodada 37 — Linhas clicáveis operáveis por teclado

## Falha e previsão

No Dashboard, a trajetória `Demonstrativo de Conciliação Patrimonial →
Variação dos Bens` só abre o detalhamento com clique: a linha é um `<tr>` sem
papel interativo, fora da ordem de Tab e sem resposta a Enter ou Espaço.

Previsão: nas três linhas `.demonstrativo-total-clicavel`, `role` passa de
ausente a `button`, `tabIndex` de `-1` a `0`; Enter e Espaço passam de não abrir
a abrir o diálogo de movimentações. O clique deve continuar abrindo.

Fixture `verificar-linhas.py`, perfil AJU-01, viewport 1366 × 768, sem seeds,
modelo Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`ed65d4d`; saídas `antes.txt`/`depois.txt`. Camada causal única: semântica e
acionamento por teclado das linhas interativas do demonstrativo.

## Decisão

**MANTER.** As três linhas passaram de `role` ausente e `tabIndex=-1` para
`role=button` e `tabIndex=0`. Enter e Espaço passaram a abrir o detalhamento,
e o clique continuou funcionando. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 658 módulos; regressão com 41 arquivos e
885 testes aprovados.
