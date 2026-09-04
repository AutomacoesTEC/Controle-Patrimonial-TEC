# Rodada 62 — Instalação nova sem declaração de teste

## Falha e previsão

Após instalar o aplicativo, foi relatado que uma declaração usada em teste
aparecia como se fizesse parte do produto. A trajetória crítica é a primeira
abertura no desktop: disco sem índice, `localStorage` vazio e bootstrap antes
do React. O comportamento não tinha um teste que diferenciasse instalação
realmente nova de migração de uma instalação anterior.

Previsão: o fixture congelado deve demonstrar que a primeira abertura cria
somente o índice vazio (`[]`), com zero perfis e zero chaves de declaração. A
suíte permanente passa de zero para um teste específico dessa trajetória, e o
contrato de empacotamento passa a exigir que o PyInstaller leve somente o
`dist/`, nunca fixtures, relatórios ou dados locais.

Fixture fixa em `verificar-instalacao-zerada.test.js`, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `d976c39`.
Camada causal única: verificação do estado inicial e da fronteira do pacote;
nenhuma política de preservação dos dados legítimos de instalações existentes
é alterada.

## Decisão

**MANTER.** O fixture confirmou que uma instalação nova produz zero perfis,
zero chaves de declaração e nenhum salvamento de dados fiscais; somente o
índice durável vazio é criado. A mesma trajetória agora está na suíte
permanente, e o empacotamento recusa qualquer fonte extra além do frontend
compilado. Os três arquivos de teste passaram, 17/17 casos. A inspeção também
mostrou que o computador usado para a captura está atualmente com `_perfis.json`
igual a `[]`; dados de uma instalação anterior continuam preservados por
projeto e não são confundidos com conteúdo trazido pelo instalador.
