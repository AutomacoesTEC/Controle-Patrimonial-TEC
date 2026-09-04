# Rodada 52 — Guarda de cobertura do histórico

## Falha e previsão

O reducer tem 66 `case`: 62 têm descrição de histórico e quatro são ações de
infraestrutura/UI deliberadamente excluídas. Apesar da cobertura atual estar
completa, não existe teste que percorra essa lista; um novo mutador fiscal pode
ser adicionado sem histórico e a suíte continuará verde.

Previsão: a quantidade de guardas automáticas passa de zero para uma. O teste
extrai todos os `case` do reducer e falha se qualquer ação fora da lista
explícita de infraestrutura não estiver coberta por `descreverAcao`; no estado
atual, valida 66/66 classificações (62 registradas + 4 excluídas).

Fixture `reducer.historicoCobertura.test.js`, o próprio `reducer.js`, sem seeds
ou relógio, modelo Codex baseado em GPT-5 (identificador exato não exposto),
commit-base `d0ba124`; saídas `antes.txt`/`depois.txt`. Camada causal única:
verificação automatizada da cobertura da trilha.

## Decisão

**MANTER.** O novo teste percorreu as 66 ações e aprovou a partição exata de
62 ações registradas mais quatro ações exclusivamente de persistência/toast.
Qualquer `case` futuro nasce sem classificação e quebra a suíte até receber
histórico ou uma exclusão explícita e revisável. Evidência bruta em
`antes.txt`/`depois.txt`.

Verificação final: regressão com 46 arquivos e 895 testes aprovados. Não houve
mudança de produto nesta rodada de verificação, portanto o build já validado no
commit-base permanece aplicável.
