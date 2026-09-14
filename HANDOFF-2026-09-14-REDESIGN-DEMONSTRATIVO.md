# Handoff, redesign visual do CP-TEC — Demonstrativo, 14/09/2026

## Onde o trabalho está

- **Worktree:** `~/.claude-worktrees/controle-patrimonial-fonte-1564771472/a2c763fd`
- **Branch:** `AutomacoesTEC/redesign-visual-a2c763fd`
- **Escopo desta rodada:** tela de Demonstrativo; as telas seguintes da fila
  não foram alteradas.
- **Commit:** `Redesenha o Demonstrativo como peça de conferência` (hash no
  `git log -1` desta branch).

## O que mudou

- A marca CP-TEC nova passou a ser usada na navegação e o favicon web passou a
  usar `public/cp-tec.ico`, mantendo o mesmo ativo do empacotamento desktop.
- Seções abertas agora têm regra lateral navy, cabeçalho separado e fechamento
  visual próprio. A faixa de posições e o detalhe de caixa usam linhas contínuas
  e colunas que se recompõem em 6, 3, 2 ou 1 item conforme a largura.
- Rendimentos termina no Total Geral dos Rendimentos; Renda Variável ficou em
  bloco complementar separado, com indicação explícita de que não compõe o
  total.
- O Demonstrativo agora abre com um ledger de fechamento patrimonial: patrimônio
  inicial, final, variação e resultado da conciliação aparecem antes dos filtros.
- A antiga fileira de indicadores iguais foi substituída por uma âncora única,
  com hierarquia tipográfica e regras horizontais.
- Rendimentos, ganhos, pagamentos e variação patrimonial usam linhas e tabelas
  sem a sequência de cartões aninhados; totais neutros deixaram de usar verde.
- Exportar e imprimir ficaram neutros; gráficos usam uma escala monocromática de
  navy e verde/vermelho ficaram reservados a significado semântico.
- O menu recolhe abaixo de 1000px e mantém os ícones. Tabelas do Demonstrativo
  recompõem sua largura quando a janela muda, sem overflow horizontal da página.
- Ajuda contextual ficou tipográfica e próxima da linha. Datas receberam rótulos
  explícitos, tabelas receberam cabeçalhos/captions semânticos e as linhas de
  variação conservam Enter e Espaço como ações de teclado.
- `.design/DESIGN_MEMORY.md` foi criado com as decisões permanentes desta
  linguagem visual.

## Estado da verificação

- Na rodada de correção foram verificados 1513, 1000, 900, 600 e 390px: não
  houve rolagem vertical interna nas tabelas, overflow horizontal da página ou
  desalinhamento na faixa de caixa; o gráfico móvel manteve as cinco barras
  visíveis com eixo de categorias refluído.
- O favicon respondeu `200` como `image/x-icon`; os 16 destinos da navegação
  renderizaram SVG específico, sem ícone circular de fallback.
- Visual QA com Playwright no app renderizado, usando o perfil de teste local do
  PDF AJU-01 autorizado no handoff anterior.
- Verificados temas claro e escuro, abertura e fechamento da composição,
  restauração de foco, Enter/Espaço nas linhas, ajuda contextual, filtro de
  titularidade, calendário, histórico, gráficos e resize entre 929, 900, 600 e
  390px.
- Em todos os breakpoints verificados, `documentElement.scrollWidth` não passou
  da largura do viewport e o rail compacto apareceu abaixo de 1000px.
- Console do navegador: sem erros ou avisos durante a inspeção.
- `npm test`: **1014 passando, 0 falhas, 113 pulados**.
- `npm run build`: passou com Vite 8.2.1.

## O que ficou pendente

- O evento de download do botão `Exportar .xlsx` não foi automatizado nesta
  rodada; a ação permanece com texto, comportamento e lógica existentes.
- Próxima tela da fila: **Importar declaração**, somente após aprovação da
  usuária. Os comentários sobre retirar o rodapé de armazenamento local e
  explorar uma faixa vertical animada/3D ficam para essa rodada posterior.
- A prévia gráfica de impressão e a recompilação do executável PyInstaller não
  foram executadas nesta rodada; o CSS de impressão foi revisado e mantido
  alinhado à peça de tela.
- O teste usou o perfil e a fixture locais; isso não substitui validação com
  declarações reais fora do repositório.
