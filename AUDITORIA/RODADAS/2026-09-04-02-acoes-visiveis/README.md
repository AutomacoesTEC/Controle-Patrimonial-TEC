# Rodada 02 — coluna Ações visível em tabelas largas

## 1. Falha nomeada

Ao abrir Bens, Titular e Dependentes, Rendimentos, Pagamentos ou Atividade
Rural em laptop, a tabela nasce alinhada à esquerda e sua última coluna,
`Ações`, fica parcial ou totalmente além do limite direito do contêiner. A
pessoa não vê `Editar`/`Excluir` sem descobrir por conta própria a rolagem
horizontal.

Trajetória: importar o AJU-01 em perfil novo, abrir cada uma das cinco telas
e medir a primeira tabela com cabeçalho `Ações`, em 1366x768 e 1280x720, nos
temas claro e escuro, sempre com `scrollLeft = 0`.

## 2. Previsão escrita antes da mudança

- Nas 20 combinações (5 telas × 2 tamanhos × 2 temas), o cabeçalho `Ações` e
  o primeiro botão `Excluir` ficarão integralmente dentro do contêiner.
- A tabela continuará com rolagem horizontal própria para acessar as demais
  colunas.
- Nenhuma largura de coluna, dado, cálculo ou ação dos botões será alterada.

## 3. Tarefa congelada

- Fixture: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`
- Telas: Bens e Direitos, Titular e Dependentes, Rendimentos, Pagamentos e
  Atividade Rural
- Viewports: 1366x768 e 1280x720; temas escuro e claro
- Seeds: não aplicável; trajetória determinística
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `61a79cd3ffd50b546d22f68a4df741854385e12b`
- Medidor: `medir-acoes.py`; saídas: `antes.json` e `depois.json`

## 4. Camada causal

Somente layout da última coluna das tabelas que terminam em ações. A rodada
não altera o componente de rolagem, as larguras redimensionáveis nem tabelas
sem ações.

## 5. Decisão

**MANTER.** Antes, só as duas combinações de Atividade Rural em 1366x768
mantinham o cabeçalho e o botão visíveis; as outras 18 de 20 falhavam. Depois,
as 20 de 20 combinações mantêm ambos integralmente dentro do contêiner.

A sobra horizontal permaneceu idêntica em cada par (0 a 351 px), confirmando
que a tabela continua rolável e que nenhuma largura foi comprimida. A única
mudança é fixar à direita a coluna final das tabelas explicitamente marcadas
como tabelas de ações. Saídas brutas: `antes.json` e `depois.json`.

Verificações adicionais: `npm run build` concluído; `npm test` com 37 arquivos
e 872 testes aprovados.
