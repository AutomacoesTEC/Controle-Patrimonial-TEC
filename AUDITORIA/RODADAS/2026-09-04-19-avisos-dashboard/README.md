# Rodada 19 — avisos do Dashboard vinculados ao Demonstrativo

## 1. Falha nomeada

Depois de importar a AJU-01 e abrir o Dashboard, as ressalvas "Parte da
declaração não foi importada" e "Cobertura das fichas ainda em auditoria"
ficam em duas linhas independentes entre o card de período e o título do
Demonstrativo. Elas não pertencem visualmente a nenhum contêiner, embora
expliquem justamente a confiabilidade daquele demonstrativo.

Trajetória: importar AJU-01, fechar o aviso inicial, abrir o Dashboard em
1280x720 e 1366x768, nos temas escuro e claro, e medir os controles de ressalva
que ficam entre o card de período e o título do Demonstrativo.

## 2. Previsão escrita antes da mudança

- Os dois controles e seus textos acessíveis permanecerão presentes.
- Ambos passarão a compartilhar com o título um contêiner semântico imediato.
- A faixa vertical conjunta de avisos e título cairá para no máximo 30 px.
- O overflow horizontal da página continuará em zero nas quatro combinações.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Tela: Dashboard
- Viewports: 1280x720 e 1366x768; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `6de99fff841b3103f3835e15e938058c9a915317`
- Medidor: `medir-avisos.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente hierarquia visual/contextual dos avisos do Demonstrativo. Conteúdo,
gatilhos, modal inicial e cálculos ficam fora.

## 5. Decisão

**MANTER.** Nos quatro pares, a faixa vertical ocupada pelo título e pelos
avisos caiu de 79 px para 20 px. Os dois controles preservaram os mesmos
rótulos, passaram de `compartilhamCabecalho: false` para `true` e o overflow
horizontal permaneceu em 0 px. Evidência bruta: `antes.json` e `depois.json`.

## 6. Verificação

- `npm run build`: aprovado.
- `npm test`: 37 arquivos e 872 testes aprovados.
