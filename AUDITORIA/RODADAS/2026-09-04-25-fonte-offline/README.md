# Rodada 25 — Inter disponível sem rede

## 1. Falha nomeada

Ao abrir o app com `fonts.googleapis.com` e `fonts.gstatic.com` indisponíveis,
o CSS tenta buscar a Inter fora do computador e não registra nenhuma face da
família no navegador. O texto cai na fonte do sistema. Além disso,
`.stat-value` e `td.numero` não recebem dígitos tabulares, embora sejam classes
de valor.

Trajetória: abrir o build local bloqueando somente os dois domínios de fonte,
aguardar `document.fonts.ready` e medir faces Inter, requisições externas e
`font-variant-numeric` nas três classes de valor.

## 2. Previsão escrita antes da mudança

- Requisições aos domínios do Google cairão de pelo menos uma para zero.
- O número de faces Inter disponíveis offline passará de zero para pelo menos
  quatro, cobrindo pesos 400, 500, 600 e 700.
- `.currency`, `td.numero` e `.stat-value` terão `tabular-nums` no estilo
  computado; hoje somente `.currency` tem.
- A largura do conteúdo e o texto da tela de perfis não mudarão.

## 3. Tarefa congelada

- Fixture: `verificar-fonte-offline.py`
- Viewport: 1366 × 768, tema escuro
- Rede: apenas `fonts.googleapis.com`/`fonts.gstatic.com` bloqueados
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `9533ad1`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente recursos tipográficos: origem dos arquivos da Inter e regra comum de
dígitos. Layout, componentes, estado e cálculos permanecem intocados.

## 5. Decisão

**MANTER.** No mesmo fixture, as requisições aos domínios do Google caíram de
1 para 0 e as faces Inter disponíveis offline passaram de 0 para 4, cobrindo
os pesos 400, 500, 600 e 700. Os estilos computados de `.currency`,
`td.numero` e `.stat-value` passaram a `tabular-nums` com `"tnum", "ss01"`.
O título permaneceu `Controle Patrimonial TEC` e a largura permaneceu 560 px.

Evidência bruta pareada: `antes.txt` e `depois.txt`.

Verificação adicional:

- `npm run build`: passou; oito arquivos locais de fonte (WOFF2/WOFF) foram
  emitidos para os quatro pesos, sem referência ao Google.
- `npm test -- --run --reporter=dot`: 41 arquivos e 885 testes passaram.
