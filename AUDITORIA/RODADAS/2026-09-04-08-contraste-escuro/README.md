# Rodada 08 — contraste de ações e metadados no tema escuro

## 1. Falha nomeada

No tema escuro, o texto branco do botão destrutivo usa o vermelho funcional
`#ef4444`, e metadados pequenos usam `--text-muted: #7b818a`. Em superfícies
reais do app, ambos ficam abaixo da razão WCAG AA de 4,5:1 para texto pequeno.

Trajetória: abrir o app, montar dentro de um card um botão `.btn-danger` e um
texto de origem a 11 px com `color: var(--text-muted)`, e calcular a razão
entre as cores computadas do texto e do fundo efetivo nos dois temas.

## 2. Previsão escrita antes da mudança

- No tema escuro, os dois exemplares passarão para razão maior ou igual a
  4,5:1.
- No tema claro, os dois exemplares manterão exatamente as cores e razões do
  baseline.
- Conteúdo, dimensões, estrutura e demais cores funcionais não mudarão.

## 3. Tarefa congelada

- Fixture: botão destrutivo e metadado sintéticos com estilos reais, injetados
  somente no navegador pelo `medir-contraste.py`
- Viewport: 1366x768; temas escuro e claro
- Seeds: não aplicável; cálculo determinístico WCAG 2.x
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `018195f67e0ce26dc018205ee81f9c9b942b293f`
- Medidor: `medir-contraste.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente cores de primeiro plano/superfície dos dois usos insuficientes no tema
escuro. Tema claro, tipografia, dimensões e conteúdo ficam fora desta rodada.

## 5. Decisão

**MANTER.** No tema escuro, o botão destrutivo passou de 3,76:1 para
4,83:1 e o metadado passou de 4,28:1 para 4,76:1. Ambos superam o mínimo
previsto de 4,5:1. No tema claro, as cores computadas e razões dos dois
exemplares permaneceram exatamente iguais ao baseline.

Evidência bruta pareada: `antes.json` e `depois.json`, produzidos pelo mesmo
`medir-contraste.py`. A implementação altera o token escuro `--text-muted` e
restringe a nova superfície do botão a `:root[data-theme="dark"]`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: segunda execução aprovada, com 37 arquivos e 872 testes.
  A primeira execução teve 1 falha não relacionada em
  `backupPerfil.test.js`: o teste tentou adulterar um ciphertext trocando o
  primeiro caractere por `A`, mas o valor aleatório já começava com `A`; a
  promessa resolveu porque não houve adulteração. A repetição integral passou
  e essa fragilidade fica isolada para uma rodada causal própria.
