# Handoff, redesign visual do CP-TEC — tela de entrada, 14/09/2026

## Onde o trabalho está

- **Worktree:** `~/.claude-worktrees/controle-patrimonial-fonte-1564771472/a2c763fd`
- **Branch:** `AutomacoesTEC/redesign-visual-a2c763fd`
- **Escopo desta aplicação:** tela de seleção de perfil e vitrine inicial;
  nenhuma tela de trabalho, cálculo ou importação foi alterada.
- **Commit:** `Refina a tela de entrada com ciclo patrimonial animado` nesta
  branch; o hash final é informado no encerramento da aplicação.

## O que mudou

- O rodapé que repetia a informação de armazenamento local foi retirado da
  tela de entrada, conforme a revisão visual. A persistência, o isolamento de
  perfis e todas as ações do lançador permanecem iguais.
- A lista estática de funcionalidades da vitrine virou uma sequência vertical
  de conferência: um marcador percorre as três etapas reais do CP-TEC e o
  texto da etapa correspondente ganha contraste.
- As três etapas continuam visíveis no DOM e na ordem semântica. O movimento
  usa somente CSS, pausa ao apontar a vitrine e é desativado para
  `prefers-reduced-motion`. Não foi introduzido efeito 3D ou dependência nova.

## Estado da verificação

- Visual QA no app renderizado com Playwright/CUA em **1513x912**, tema claro e
  escuro: rodapé ausente, ciclo completo visível, trilho e marcador alinhados.
- A progressão temporal foi observada em execução; o marcador e o realce
  tipográfico ficaram sincronizados nas etapas 1, 2 e 3.
- Em **1000x800** e **390x844**, a vitrine recolheu conforme o breakpoint já
  existente, a coluna ocupou a janela e `documentElement.scrollWidth` ficou
  igual à largura do viewport.
- A árvore de acessibilidade manteve o nome da marca, a seleção de perfil, as
  ações existentes e as três etapas da vitrine. O console do navegador não
  apresentou erros ou avisos.
- A regra de redução de movimento foi revisada no CSS. A emulação dinâmica de
  `prefers-reduced-motion` não está disponível no driver desta sessão.
- A tentativa de `npm test`/`npm run build` nesta sessão foi bloqueada pelo
  ambiente: o WSL não tem Node Linux disponível, o `node_modules` da worktree
  é um link para a raiz do projeto e o Node Windows não encontrou o binding
  opcional do Rolldown ao ser executado pelo caminho UNC. A baseline anterior
  em `c2d6362` permanece registrada como **1.014 passando, 0 falhas, 113
  pulados** e o live Vite carregou esta alteração sem erro de runtime.

## O que ficou pendente

- Próxima tela da fila: **Importar declaração**, somente após aprovação da
  usuária.
- A prévia gráfica de impressão e a recompilação do executável PyInstaller
  continuam fora desta aplicação.
- A validação com declarações reais fora do repositório continua pendente.
