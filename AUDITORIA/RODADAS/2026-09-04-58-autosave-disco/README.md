# Rodada 58 — Autosave com disco como fonte durável

## Falha e previsão

Mesmo com a ponte capaz de persistir arquivos, a trajetória
`saveToStorage -> persistirDadosPerfil` grava somente no `localStorage`: numa
execução com a API desktop presente, a fixture observa zero chamadas ao disco
e duas escritas no armazenamento do WebView.

Previsão: no mesmo salvamento, a chamada ao disco passa de 0 para 2 (estado do
perfil e índice atualizado), ocorre antes das duas atualizações do cache e
recebe exatamente os mesmos textos JSON. Sem API desktop, continuam ocorrendo
duas escritas no `localStorage`, sem erro nem mudança de resultado.

Fixture Vitest fixa em `verificar-persistencia.test.js`, sem seeds, modelo
Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`f1d2b56`; saídas brutas em `antes.txt` e `depois.txt`. Camada causal única:
estado/persistência do perfil aberto no `DataContext`. Criação, exclusão,
restauração e hidratação inicial ficam fora desta rodada.

## Decisão

**MANTER.** A fixture passou de zero para duas chamadas ao disco, na ordem
`perfil -> índice -> cache do perfil -> cache do índice`. Os textos dos dois
destinos foram idênticos. A execução sem API continuou coberta pela regressão
existente, e os 11 testes dirigidos do `DataContext` passaram. Evidência bruta
em `antes.txt`/`depois.txt`.
