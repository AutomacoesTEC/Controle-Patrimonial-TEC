# Rodada 26 — Saldo de Caixa visível ao abrir

## 1. Falha nomeada

Ao abrir o Dashboard do perfil AJU-01 em 1366 × 768, no topo da área rolável,
o Saldo de Caixa que fecha a conciliação aparece somente na linha final da
quarta tabela do demonstrativo, fora da área visível. A pessoa precisa rolar
antes de descobrir se falta ou sobra caixa a explicar.

Trajetória: persistir o perfil AJU-01, abrir o Dashboard, fechar o aviso
estrutural sem rolar e medir a posição da linha final e de uma eventual
faixa-resumo.

## 2. Previsão escrita antes da mudança

- A quantidade de faixas `.saldo-hero` passará de 0 para 1.
- A faixa inteira ficará dentro dos 768 px do viewport com o `scrollTop` da
  área de conteúdo em zero.
- O valor da faixa será idêntico ao valor da linha final `Saldo de Caixa`.
- O valor terá 30 px, peso 700 e dígitos tabulares.
- O selo terá uma das três leituras determinadas pelo valor em centavos:
  `Conciliação fecha` para zero, `Sobra a explicar` para positivo e
  `Falta a explicar` para negativo.

## 3. Tarefa congelada

- Fixture de dados: `src/store/__fixtures__/perfil-aju01-atual.json`
- Verificador: `verificar-saldo-heroi.py`
- Viewport: 1366 × 768, tema escuro, área de conteúdo sem rolagem
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `154a760`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto visual: posição e saliência de uma leitura já calculada.
Motor do demonstrativo, persistência, avisos, tabelas e gráficos permanecem
intocados.

## 5. Decisão

**MANTER.** A faixa passou de 0 para 1 ocorrência e ficou inteira no primeiro
viewport (`top=298`, `bottom=387`, viewport de 768 px), com `scrollTop=0`.
Ela repetiu exatamente `-R$ 51.787,27`, o valor da linha final congelada, em
30 px, peso 700 e `tabular-nums`. Como o valor é negativo, o selo exibiu
`Falta a explicar`. A linha original continuou presente, agora em `top=2294`.

Evidência bruta pareada: `antes.txt` e `depois.txt`.

Verificação adicional:

- `npm run build`: passou.
- `npm test -- --run --reporter=dot`: 41 arquivos e 885 testes passaram.
