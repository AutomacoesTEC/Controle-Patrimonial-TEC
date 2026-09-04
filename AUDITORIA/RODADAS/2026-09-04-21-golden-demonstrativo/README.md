# Rodada 21 — golden do Demonstrativo por período

## 1. Falha nomeada

Os fixtures `perfil-aju01-v1.json` e `perfil-aju01-atual.json` são comparados
entre si, e o backup calcula sua expectativa a partir do próprio fixture. Se o
primeiro bem subir R$ 0,01 nos dois arquivos, a saída do Demonstrativo muda,
mas nenhum teste a compara com uma saída externa congelada.

Trajetória: trocar `situacao_atual` do primeiro bem de `210101.51` para
`210101.52` nos dois fixtures, executar a suíte e restaurar os bytes originais.
Depois, repetir a mesma mutação contra o teste golden.

## 2. Previsão escrita antes da mudança

- Antes, a mutação de R$ 0,01 passará despercebida pela suíte completa.
- Depois, a mesma mutação fará somente o contrato golden falhar, com diff que
  mostre os campos monetários alterados.
- Sem mutação, golden e suíte completa passarão.
- O arquivo esperado só poderá ser regravado com `UPDATE_GOLDEN=1` explícito.

## 3. Tarefa congelada

- Fixtures: `perfil-aju01-v1.json` e `perfil-aju01-atual.json`
- Mutação: primeiro bem, `situacao_atual`, `210101.51` → `210101.52`
- Períodos golden: ano de 2025, primeiro semestre de 2025 e 2025–2026
- Seeds: não aplicável; estados e períodos determinísticos
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `99dbce9`
- Saídas brutas: `antes.txt`, `mutacao-depois.txt` e `depois.txt`

## 4. Camada causal

Somente verificação: contrato golden completo do motor usado pelo Dashboard.
Parser, fixtures de entrada, cálculos e interface ficam fora.

## 5. Decisão

**MANTER.** Antes, a mutação de R$ 0,01 passou com 875/875 testes. Depois,
o contrato golden falhou em dois períodos e mostrou cinco campos derivados
com diferença de um centavo; o período que termina no estoque de 2026 ficou
corretamente inalterado. Restaurados os fixtures, os três casos passam.

O golden tem 365 linhas e guarda a saída completa, não apenas totais
escolhidos. A execução normal apenas lê e compara. Para aceitar
deliberadamente uma nova saída:

```bash
UPDATE_GOLDEN=1 npx vitest run src/store/demonstrativo.golden.test.js
```

Evidência bruta: `antes.txt`, `mutacao-depois.txt` e `depois.txt`.

## 6. Verificação

- Golden sem modo de atualização: 3/3 testes aprovados.
- `npm test`: 39 arquivos e 878 testes aprovados.
- `npm run build`: aprovado.
