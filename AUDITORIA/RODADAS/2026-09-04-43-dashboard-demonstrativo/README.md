# Rodada 43 — “Dashboard” passa a “Demonstrativo”

## Falha e previsão

Na abertura do perfil, a navegação e o título principal dizem `Dashboard`,
único nome de tela em inglês entre destinos fiscais em português. A trajetória
também mostra `Voltar ao Dashboard` ao entrar num detalhe pelo demonstrativo.

Previsão: na abertura, ocorrências visíveis exatas de `Dashboard` caem de duas
a zero e `Demonstrativo` sobe de zero a duas; o destino interno `dashboard`
permanece intacto. Nos retornos contextuais, o texto passa a `Voltar ao
Demonstrativo` sem alterar navegação.

Fixture `verificar-nome.py`, perfil AJU-01, viewport 1366 × 768, sem seeds,
modelo Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`90e2857`; saídas `antes.txt`/`depois.txt`. Camada causal única: nomenclatura
visível da tela.

## Decisão

**MANTER.** As duas ocorrências visíveis exatas de `Dashboard` caíram a zero e
as duas de `Demonstrativo` subiram a duas. O item ativo e o destino interno
permaneceram presentes. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 661 módulos; regressão com 41 arquivos e
885 testes aprovados.
