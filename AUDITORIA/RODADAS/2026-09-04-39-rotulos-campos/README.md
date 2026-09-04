# Rodada 39 — Nome acessível dos campos

## Falha e previsão

Na trajetória `Bens e Direitos → Novo Bem`, rótulos aparecem visualmente antes
dos campos, mas não os envolvem nem usam `htmlFor`; ao focar, tecnologia
assistiva encontra inputs, selects e textareas sem nome programático.

Previsão: no conjunto renderizado da tela e do modal, a quantidade de campos
sem `labels` e sem `aria-label` cai a zero, preservando quantidade, tipos e
valores. Campos inseridos depois da montagem recebem o mesmo tratamento.

Fixture `verificar-rotulos.py`, perfil AJU-01, viewport 1366 × 768, sem seeds,
modelo Codex baseado em GPT-5 (identificador exato não exposto), commit-base
`64b0a93`; saídas `antes.txt`/`depois.txt`. Camada causal única: nome acessível
de controles de formulário.

## Decisão

**MANTER.** Os 22 campos renderizados passaram de 22 sem nome a zero sem
nome; quantidade, sequência de tipos e valores permaneceram idênticas. O
modal, inserido depois da montagem, comprova que o observador cobre conteúdo
dinâmico. Evidência bruta em `antes.txt`/`depois.txt`.

Verificações: build de produção com 659 módulos; regressão com 41 arquivos e
885 testes aprovados.
