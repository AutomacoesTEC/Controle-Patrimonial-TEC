# Rodada 59 — Ciclo de vida dos perfis no disco

## Falha e previsão

As trajetórias de criar, renomear, proteger, excluir e restaurar perfil ainda
contornam a ponte: `PerfilLauncherPage.jsx` e `backupPerfil.js` contêm sete
chamadas diretas de mutação do armazenamento recebido/local, todas limitadas
ao cache do WebView.

Previsão: a mesma inspeção cai de 7 para 0 mutações diretas nesses dois
arquivos. As operações duráveis compartilhadas confirmam o disco antes do
cache; criar/restaurar gravam perfil e índice, renomear grava o índice,
proteger grava envelope e índice, e excluir grava primeiro o índice sem o
perfil e depois remove seu arquivo. No navegador sem ponte, os testes atuais
continuam inalterados.

Fixture estática fixa em `verificar-ciclo.py`, complementada por testes
dinâmicos do adaptador, sem seeds, modelo Codex baseado em GPT-5 (identificador
exato não exposto), commit-base `c44a2a6`; saídas brutas em
`antes.txt`/`depois.txt`. Camada causal única: estado persistido nas operações
de ciclo de vida dos perfis. A carga inicial disco -> cache fica para a rodada
seguinte.

## Decisão

**MANTER.** A inspeção caiu de 7 para 0 mutações diretas. O adaptador confirmou
em teste a ordem disco -> cache nas três primitivas e preservou o modo
navegador sem API. Os 33 testes existentes de backup/restauração e os dois
novos testes do adaptador passaram. Evidência bruta em
`antes.txt`/`depois.txt`.
