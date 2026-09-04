# Rodada 29 — Folha limpa para impressão do demonstrativo

## 1. Falha nomeada

Ao imprimir o Dashboard pelo navegador, a mídia `print` herda a interface de
tela: sidebar, alternador de tema, ações, filtros e gráficos abertos continuam
presentes; o app mantém `height: 100vh` e `overflow: hidden/auto`; não existem
cabeçalho de identificação, rodapé de geração nem proteção de quebra dos
cards.

Trajetória: persistir o perfil AJU-01, abrir os gráficos, alternar o Chromium
para mídia `print` e medir estilos computados, elementos visíveis e metadados
de impressão.

## 2. Previsão escrita antes da mudança

- Sidebar, alternador de tema, ações do cabeçalho, controles de período e
  gráficos abertos passarão de visíveis para `display: none`.
- A altura de `.app-layout` deixará de ser 768 px e o overflow de `.page-body`
  passará de `auto` para `visible`.
- O fundo principal passará do tema escuro para branco.
- Cabeçalho `.print-header` e rodapé `.print-footer` passarão de 0 para 1 e
  conterão titular, CPF formatado, ano/período, geração e versão.
- O primeiro card do demonstrativo passará de `break-inside: auto` para
  `avoid`.

## 3. Tarefa congelada

- Fixture de dados: `src/store/__fixtures__/perfil-aju01-atual.json`
- Verificador: `verificar-impressao.py`
- Viewport: 1366 × 768, tema escuro; `Gráficos de apoio` aberto antes de
  emular mídia `print`
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `131f5e0`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto visual de impressão: elementos auxiliares, fluxo paginado e
metadados impressos. A interface de tela, cálculos, dados e ações permanecem
intocados.

## 5. Decisão

**MANTER.** Sidebar, tema, ações, filtros e gráficos passaram a `display:
none`; controles visíveis caíram de 36 para 0. O layout deixou os 768 px
fixos e passou a 2.588,5 px de conteúdo, com overflow visível no layout e no
corpo. O fundo passou de `rgb(10, 13, 21)` para branco, o card passou de
`break-inside: auto` para `avoid`, e cabeçalho/rodapé passaram de 0 para 1,
contendo os metadados previstos.

Evidência bruta pareada: `antes.txt` e `depois.txt`. As duas medições
intermediárias preservadas mostram o ajuste estrito até cumprir toda a
previsão; a cor intermediária vinha da transição de tema ainda em curso.

Verificação adicional:

- `npm run build`: passou.
- `npm test -- --run --reporter=dot`: 41 arquivos e 885 testes passaram.
