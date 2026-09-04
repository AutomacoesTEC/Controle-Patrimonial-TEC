# Rodada 63 — Hierarquia da tela inicial

## Falha e previsão

Na instalação sem perfis, a restauração aparece como uma frase solta acima do
card (`perfil-link-btn`), parecendo uma mensagem de erro ou instrução estranha.
Dentro do card, a importação é um botão pequeno alinhado à esquerda e não há
separação visual entre importar uma declaração e preencher os dados à mão.
A trajetória está registrada na captura `eeeee.jpg` enviada pelo usuário.

Previsão: no mesmo componente, os quatro sinais de orientação explícita sobem
de 0/4 para 4/4: ação estruturada de restauração, bloco centralizado de
importação, divisor para cadastro manual e placeholder do nome. O texto solto
antigo deixa de existir. A funcionalidade, os handlers e os formatos aceitos
permanecem iguais.

Fixture estática fixa em `verificar-interface.py`, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `8754dc2`.
Camada causal única: contexto visual e hierarquia da tela de entrada.

## Decisão

**MANTER.** Os quatro sinais previstos passaram de 0/4 para 4/4. A restauração
agora é uma ação identificável com explicação; a importação virou uma opção
central e responsiva; o divisor deixa explícito que preencher manualmente é o
outro caminho; e o nome ganhou exemplo dentro do campo. A inspeção Chromium
em 1285x957 e 390x844 confirmou zero overflow horizontal. No celular, uma
correção adicional dentro da mesma hierarquia visual eliminou o corte superior
do logotipo e preservou a rolagem. Build, 917 testes Vitest e dois testes
Python passaram. Evidência bruta em `antes.txt` e `depois.txt`.
