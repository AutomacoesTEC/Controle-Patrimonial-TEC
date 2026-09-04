# Rodada 60 — Hidratação desktop antes do React

## Falha e previsão

Na trajetória de abertura, `main.jsx` monta o React imediatamente. Mesmo que
`DesktopApi.carregar_cache()` tenha arquivos mais novos, eles nunca são lidos;
o app abre a cópia possivelmente antiga do `localStorage`. A inspeção congelada
encontra 0/3 sinais necessários: janela desktop identificada, bootstrap antes
do render e chamada de carga do disco.

Previsão: a mesma inspeção passa a 3/3. Em fixture dinâmica, uma instalação
antiga sem índice no disco migra perfil e índice do cache (índice por último);
uma instalação já migrada substitui cache velho por disco e remove chave órfã;
JSON inválido não altera o cache e produz erro; navegador comum monta sem
esperar evento. O React só monta depois da Promise de hidratação no desktop.

Fixture estática fixa em `verificar-bootstrap.py`, sem seeds, modelo Codex
baseado em GPT-5 (identificador exato não exposto), commit-base `5d3375c`;
saídas brutas em `antes.txt`/`depois.txt`. Camada causal única: contexto
inicial observado pelo app (bootstrap disco -> cache antes do React).

## Decisão

**MANTER.** A fixture passou de 0/3 para 3/3 sinais. Os testes demonstraram
migração inicial com índice por último, disco sobrescrevendo cache velho,
remoção de chave órfã, recusa íntegra de JSON inválido e inicialização web
imediata. O executável usa entrada própria e espera o evento oficial
`pywebviewready`; falha de carga produz uma tela explícita e não abre dados
antigos silenciosamente. Evidência bruta em `antes.txt`/`depois.txt` e a
falha intermediária preservada em `verificacao-intermediaria.txt`.

Verificação final: 53 arquivos e 913 testes Vitest, dois testes Python, build
com 669 módulos e as duas entradas geradas, além do smoke Chromium aprovado.
