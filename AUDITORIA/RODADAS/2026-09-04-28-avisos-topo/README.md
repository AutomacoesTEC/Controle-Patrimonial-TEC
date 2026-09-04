# Rodada 28 — Avisos persistentes em um único bloco

## 1. Falha nomeada

Depois de fechar a janela obrigatória de ciência, os avisos persistentes do
Dashboard ficam espalhados: avisos de período dentro do card do filtro e
avisos de importação/cobertura junto ao cabeçalho do demonstrativo. Não há um
local único para voltar e conferir tudo que limita a leitura dos números.

Trajetória: persistir o perfil AJU-01, abrir o Dashboard, fechar a janela de
ciência e medir os rótulos das ressalvas estruturais, suas regiões hospedeiras
e a presença/posição de um bloco consolidado.

## 2. Previsão escrita antes da mudança

- Blocos `.dashboard-avisos` passarão de 0 para 1.
- Todos os rótulos estruturais encontrados no antes serão preservados.
- O número de regiões hospedeiras persistentes cairá para 1.
- O bloco consolidado ficará inteiro no primeiro viewport de 768 px sem
  rolagem.
- A janela obrigatória de ciência continuará aparecendo antes de ser fechada.

## 3. Tarefa congelada

- Fixture de dados: `src/store/__fixtures__/perfil-aju01-atual.json`, com a
  cópia de 2026 deslocada para 2027 e 2026 removido para plantar uma lacuna;
  acionamento de `Todo o histórico`
- Verificador: `verificar-avisos.py`
- Viewport: 1366 × 768, tema escuro, área de conteúdo sem rolagem
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `5779318`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto visual: localização persistente de avisos já calculados.
Detecção, texto, janela obrigatória, cálculos, filtros e navegação permanecem
intocados.

## 5. Decisão

**MANTER.** O bloco consolidado passou de 0 para 1 e ficou entre `top=298` e
`bottom=367`, inteiro no viewport de 768 px com `scrollTop=0`. Os três rótulos
foram preservados caractere a caractere e suas regiões persistentes caíram de
2 para 1. A janela obrigatória continuou visível na abertura.

Evidência bruta pareada: `antes.txt` e `depois.txt`. O primeiro fixture,
descartado antes de qualquer edição do produto por não reproduzir a falha,
está documentado em `erro-fixture-inicial.txt`.

Verificação adicional:

- `npm run build`: passou.
- `npm test -- --run --reporter=dot`: 41 arquivos e 885 testes passaram.
