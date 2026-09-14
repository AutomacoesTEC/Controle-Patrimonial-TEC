# Handoff, redesign visual do CP-TEC — tela de entrada, 14/09/2026

## Onde o trabalho está

- **Worktree:** `~/.claude-worktrees/controle-patrimonial-fonte-1564771472/a2c763fd`
- **Branch:** `AutomacoesTEC/redesign-visual-a2c763fd`
- **Escopo desta aplicação:** tela de seleção de perfil e vitrine inicial;
  nenhuma tela de trabalho, cálculo ou importação foi alterada.
- **Commit:** `Substitui a barra por mensagens na entrada` nesta branch; o hash
  final é informado no encerramento da aplicação.

## O que mudou

- O rodapé que repetia a informação de armazenamento local foi retirado da
  tela de entrada, conforme a revisão visual. A persistência, o isolamento de
  perfis e todas as ações do lançador permanecem iguais.
- A lista estática de funcionalidades da vitrine virou uma sequência horizontal
  de mensagens: cada etapa entra pela esquerda, permanece 3,5 segundos e sai
  antes da próxima etapa chegar.
- A tela de perfis agora oferece "Importar declaração" como ação principal de
  primeiro nível, sem exigir o clique em "Cadastrar novo titular". O seletor
  reutiliza o mesmo parser e a mesma revisão já existentes; o cartão de criação
  só abre depois que um arquivo foi escolhido.
- As três etapas continuam visíveis no DOM e na ordem semântica. O movimento
  usa somente CSS, pausa ao apontar a vitrine e é desativado para
  `prefers-reduced-motion`. Não foi introduzido efeito 3D ou dependência nova.

## Estado da verificação

- Visual QA no app renderizado com Playwright/CUA em **1513x912**, tema claro e
  escuro: rodapé ausente, ciclo completo visível e mensagem alinhada na faixa.
- A ação "Importar declaração" ficou visível na tela com perfil existente, com
  ícone de arquivo e hierarquia de botão principal; "Cadastrar novo titular" e
  "Restaurar um perfil salvo" continuam disponíveis.
- A progressão temporal horizontal foi observada em execução; as mensagens 1,
  2 e 3 entraram e saíram na ordem, sem barra móvel.
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
