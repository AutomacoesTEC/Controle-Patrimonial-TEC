# Rodada 18 — altura adaptativa para tabelas curtas

## 1. Falha nomeada

Tabelas que são filhas diretas de `.page-body` recebem `flex: 1` e ocupam todo
o espaço vertical restante mesmo com poucas linhas. Em Doações, Dívidas,
Despesas Gerais e Atividade Rural, isso deixa centenas de pixels vazios sob a
tabela, como se faltasse conteúdo.

Trajetória: importar AJU-01, abrir as quatro telas em 1366x768 nos dois temas e
medir altura do contêiner, altura da tabela e espaço interno não utilizado.

## 2. Previsão escrita antes da mudança

- Nas oito combinações, o espaço vazio cairá para no máximo 2 px.
- Quantidade de linhas e overflow horizontal permanecerão iguais.
- Contêineres continuarão podendo encolher e rolar quando a tabela for maior
  que o espaço disponível.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Telas: Doações, Dívidas e Ônus Reais, Despesas Gerais e Atividade Rural
- Viewport: 1366x768; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `16d1fea153405576f126c0e6288dc0ca6ae62112`
- Medidor: `medir-altura.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente comportamento flexível de altura nas tabelas explicitamente marcadas
como adaptativas. Dados, colunas, páginas e tabelas longas não marcadas ficam
fora.

## 5. Decisão

**MANTER.** Nas oito combinações, o espaço vazio caiu para 0 px:

| Tela | Antes (cada tema) | Depois (cada tema) |
|---|---:|---:|
| Doações | 335 px | 0 px |
| Dívidas e Ônus Reais | 417 px | 0 px |
| Despesas Gerais | 510 px | 0 px |
| Atividade Rural | 376 px | 0 px |

Quantidade de linhas e overflow horizontal ficaram idênticos em todos os
pares. A regra mantém `flex-shrink: 1`, `min-height: 0` e `overflow: auto`, de
modo que uma tabela maior ainda pode encolher dentro do espaço disponível e
rolar internamente. Evidência bruta: `antes.json` e `depois.json`.

O primeiro disparo do medidor não produziu dados porque o nome da página e o
nome acessível do botão de Dívidas diferem. `erro-fixture-inicial.txt` preserva
a falha; apenas o seletor da trajetória foi corrigido antes de medir o produto.

## 6. Verificação

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
