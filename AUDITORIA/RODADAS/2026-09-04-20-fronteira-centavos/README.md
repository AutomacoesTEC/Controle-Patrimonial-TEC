# Rodada 20 — fronteira monetária em centavos

## 1. Falha nomeada

Uma compra de R$ 0,10 seguida de outra de R$ 0,20 grava
`situacao_atual = 0.30000000000000004`. No fechamento, entradas de R$ 0,10 e
R$ 0,20 contra saída de R$ 0,30 deixam saldo residual diferente de zero. A
interface mascara isso com duas casas, mas o estado e as comparações recebem o
resíduo binário.

Trajetória: executar `centavos.test.js`, que registra as duas movimentações,
fecha o demonstrativo mínimo e repete somas monetárias em 25 sequências
determinísticas.

## 2. Previsão escrita antes da mudança

- A situação atual após R$ 0,10 + R$ 0,20 será exatamente `0.3`.
- O Saldo de Caixa de R$ 0,10 + R$ 0,20 − R$ 0,30 será exatamente zero.
- Os totais das 25 sequências serão iguais à soma inteira dos centavos.
- As regressões de 2024 e 2025 contra a planilha real continuarão batendo ao
  centavo.

## 3. Tarefa congelada

- Fixture principal: `src/store/centavos.test.js`
- Fixtures de não regressão: `estado2024()` e `estado2025()` de
  `src/store/demonstrativos.test.js`
- Seeds: inteiros de 1 a 25; LCG `1664525*x + 1013904223`, módulo 2³²
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `a399bcf`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente fronteira numérica: arredondamento monetário ao persistir saldo de
movimentação e ao fechar os totais do Demonstrativo. Fórmulas, categorias,
precedências e interface ficam fora.

## 5. Decisão

**MANTER.** O fixture passou de 0/3 para 3/3: o saldo persistido passou de
`0.30000000000000004` para `0.3`, o fechamento de R$ 0,10 + R$ 0,20 −
R$ 0,30 passou a zero exato e as 25 seeds fecharam pela soma inteira dos
centavos. Evidência bruta: `antes.txt` e `depois.txt`.

A não regressão de 2024 detectou que sua própria fixture preservava meio
centavo (`169301.505`) e esperava totais com três casas. O input congelado foi
mantido; as expectativas passaram aos valores arredondados exibidos pela
planilha: `1830916.04`, `877255.35` e `110980.23`. A saída bruta e a decisão
estão em `nao-regressao-intermediaria.txt`.

## 6. Verificação

- Fixture pareado: 3/3 testes aprovados.
- `npm test`: 38 arquivos e 875 testes aprovados.
- `npm run build`: aprovado.
