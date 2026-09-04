# Rodada 11 — alças das colunas fixas dentro do viewport

## 1. Falha nomeada

Em tabelas largas, as colunas finais críticas ficaram fixas e visíveis, mas
suas alças de redimensionamento continuam nas coordenadas originais da tabela.
Com a rolagem no início, a pessoa vê a coluna, porém não consegue alcançar a
divisória para ajustar sua largura. O achado ocorre em Titular e Dependentes,
Rendimentos, Pagamentos e Renda Variável.

Trajetória: importar AJU-01, abrir cada tela em 1280x720 e comparar o centro
das alças com a borda esquerda de cada coluna fixa, no início e no fim da
rolagem horizontal, nos temas claro e escuro.

## 2. Previsão escrita antes da mudança

- Cada borda esquerda das colunas fixas terá uma alça coincidente e visível
  nas 16 combinações (4 telas × 2 posições × 2 temas).
- A sobra horizontal de cada tabela permanecerá exatamente igual ao baseline.
- Larguras, conteúdo, cálculos e comportamento das colunas não mudarão.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Telas/colunas fixas: Titular e Dependentes (1), Rendimentos (3),
  Pagamentos (4), Renda Variável (4)
- Viewport: 1280x720; temas escuro e claro; `scrollLeft` inicial e final
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `c5d3ff9f951ad943ec35c56b497147f0d2290b39`
- Medidor: `medir-alcas.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente posicionamento das alças que delimitam colunas fixas no componente
`TabelaRedimensionavel`. Dados, larguras iniciais e células ficam fora.

## 5. Decisão

**MANTER.** No início da rolagem, nenhuma das oito combinações tela/tema
tinha uma alça coincidente com todas as bordas fixas; no fim, as oito tinham.
Depois, as 16/16 combinações de tela, tema e posição mantêm todas as alças
coincidentes e visíveis.

O overflow permaneceu exatamente 351 px em Titular, 322 px em Rendimentos,
318 px em Pagamentos e 577 px em Renda Variável, nos dois temas e posições.
Logo, nenhuma coluna foi comprimida. A mudança separa apenas as divisórias
das colunas fixas numa camada presa ao viewport; as demais continuam no fluxo
horizontal normal. Evidência bruta: `antes.json` e `depois.json`.

Verificações de regressão:

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
