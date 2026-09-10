```comando
O QUÊ: Levantar o desenho aprovado do item F (gerir bem direto na aba Ganhos de Capital, sem mostrar a lista inteira de Bens) e o estado atual dessa aba — sem editar nada.
ONDE: HANDOFF-2026-09-03.md; página/componentes de Ganhos de Capital (localizar por grep: ganhosCapital, GanhoCapital, alienacao); src/components/BemModal.jsx, BemRuralModal.jsx, MovimentacaoBemForm.jsx; src/store/reducer.js; src/store/DataContext.jsx
COMO:
  1. Transcrever do handoff a seção do item F tal como aprovada: problema, comportamento desejado, o que "gerir bem" abrange (criar, editar, alienar, movimentar?), o que fica fora, critérios de aceite e a dependência declarada em G.
  2. Descrever a aba Ganhos de Capital hoje: arquivo, o que ela lista, de que coleções lê (bens, movimentações, ganhos oficiais importados), como identifica um bem alienado e como calcula ou exibe o ganho — com caminhos e nomes reais.
  3. Descrever como Bens é gerido hoje: ações do reducer (ADD/UPDATE/REMOVE de bem e de movimentação), contrato de BemModal/BemRuralModal (props, onSave, o que já passa por garantirAnoCadastro/despacharEmAno após G) e o que MovimentacaoBemForm faz com data de ano diferente (o precedente citado no handoff).
  4. Identificar o que da lógica de Bens é reaproveitável na aba de Ganhos sem duplicar: se BemModal pode ser aberto de outra página com um bem pré-selecionado, e se a movimentação de alienação já grava tudo que a ficha de Ganhos de Capital precisa (data, valor de alienação, custo, ganho).
  5. Apontar as regras do estudo fiscal que F precisa respeitar (ganho de capital no Demonstrativo, alienação em ano diferente do ativo, o que atravessa exercício) e qualquer trecho de demonstrativos.js que leia alienações.
  6. Sobrescrever RELATORIO-FABLE.md com o resultado.
PRONTO QUANDO: Relatório com os cinco pontos preenchidos a partir dos arquivos, com caminhos e nomes reais de funções/ações, sem alteração em arquivo rastreado.
```