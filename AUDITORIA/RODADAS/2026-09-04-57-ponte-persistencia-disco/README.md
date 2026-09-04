# Rodada 57 — Ponte confinada para persistência em disco

## Falha e previsão

O `DesktopApi` exposto ao WebView só possui a operação de backup periódico.
Na trajetória `React -> window.pywebview.api -> disco`, não existe operação
para salvar o estado corrente de um perfil, salvar o índice de perfis, ler o
cache persistido ou excluir um perfil. Assim, o disco ainda não pode ser a
fonte durável do aplicativo.

Previsão: a mesma fixture passa de 0/4 para 4/4 capacidades disponíveis; salva
o índice e dois perfis em `perfis/`, lê de volta exatamente os textos UTF-8,
substitui atomicamente um perfil sem deixar `.tmp`, exclui somente o alvo e
rejeita `../escape`. O backup automático existente continua passando.

Fixture Python fixa em `verificar_ponte.py`, sem seeds, modelo Codex baseado em
GPT-5 (identificador exato não exposto), commit-base `8952f53`; saídas brutas
em `antes.txt` e `depois.txt`. Camada causal única: ferramentas disponíveis na
ponte Python. A hidratação e o espelhamento do React ficam para rodada própria.

## Decisão

**MANTER.** A fixture passou de 0/4 para 4/4 capacidades. O índice e os dois
perfis retornaram exatamente, a segunda gravação substituiu o valor anterior,
nenhum `.tmp` restou, a exclusão removeu apenas `perfil-2` e `../escape` foi
rejeitado sem criar arquivo fora de `perfis/`. Os dois testes Python, inclusive
o backup preexistente, passaram. Evidência bruta em `antes.txt`/`depois.txt`.
