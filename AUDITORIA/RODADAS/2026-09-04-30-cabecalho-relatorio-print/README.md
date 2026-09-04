# Rodada 30 — Cabeçalho do Relatório IRPF na impressão

## 1. Falha nomeada

Ao abrir Relatório IRPF e alternar para mídia `print`, o cabeçalho inteiro é
ocultado pela regra global criada para o Dashboard. A folha começa nos dados
do contribuinte sem dizer qual relatório e ano está sendo impresso.

Trajetória: persistir AJU-01, navegar para Relatório IRPF, emular `print` e
medir o cabeçalho, título e ações.

## 2. Previsão escrita antes da mudança

- O cabeçalho do Relatório passará de `display:none` para `flex`.
- O título `Relatório para IRPF 2026` e o subtítulo do ano-calendário ficarão
  visíveis.
- `.page-header-actions` continuará em `display:none`.
- O cabeçalho de tela específico do Dashboard continuará oculto na impressão.

## 3. Tarefa congelada

- Fixture: AJU-01, Relatório IRPF, viewport 1366 × 768, mídia `print`
- Verificador: `verificar-cabecalho.py`
- Seeds: não aplicável
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `4d83177`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto visual de impressão do cabeçalho. Conteúdo, exportação,
cálculos e ações permanecem intocados.

## 5. Decisão

**MANTER.** O cabeçalho passou de `display:none` para `flex`, e título e
subtítulo ficaram visíveis sem reexibir as ações, que permaneceram em
`display:none`. O cabeçalho de tela do Dashboard recebeu uma classe específica
que continua na lista de elementos ocultos da folha, ao lado do cabeçalho
`print-only` já verificado na rodada 29.

Evidência bruta pareada: `antes.txt` e `depois.txt`. As duas tentativas que não
chegaram a medir o produto estão preservadas nos arquivos `erro-*.txt`.

Verificação adicional: `npm run build` passou; 41 arquivos e 885 testes
passaram em `npm test -- --run --reporter=dot`.
