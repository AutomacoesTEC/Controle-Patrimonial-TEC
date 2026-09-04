# Rodada 65 — Textos sem formato não comprovado

## Falha e previsão

A tela inicial promete preenchimento automático por `.F2B`, embora esse fluxo
não esteja comprovado com arquivo real, e apresenta a extensão técnica
`.cptec.json` na chamada principal de restauração. Para uma pessoa leiga, o
primeiro texto promete uma capacidade não demonstrada e o segundo expõe um
detalhe técnico desnecessário antes da escolha do arquivo.

Previsão: menções visíveis a `.F2B` nas telas caem de 4 para 0 e a extensão na
chamada de restauração cai de 1 para 0. O suporte interno não é alterado nesta
rodada; somente o que a interface promete ao usuário.

Fixture estática fixa em `verificar-textos.py`, sem seeds, modelo Codex baseado
em GPT-5 (identificador exato não exposto), commit-base `6e1df35`. Camada causal
única: contexto textual da interface.

## Decisão

**MANTER.** As menções visíveis a `.F2B` caíram de 4 para 0 e a extensão
técnica desapareceu da chamada de restauração. A tela agora promete apenas
PDF, `.DEC` e `.DBK`, e orienta simplesmente “Restaure aqui um perfil salvo
anteriormente”. Doze testes e o build de 669 módulos passaram. Evidência bruta
em `antes.txt` e `depois.txt`.
