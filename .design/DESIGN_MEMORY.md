# Memória de design — CP-TEC

Atualização: 14/09/2026

## Norte do produto

O CP-TEC é uma ferramenta de conferência patrimonial para consultoria
tributária. A interface deve parecer uma peça de trabalho que pode ser
revisada com o cliente e rastreada até a declaração, não um dashboard SaaS
genérico. O conceito vigente é **A Sala de Conferência**: dados legíveis,
trilha de evidência e decisões explícitas.

## Direção aprovada

- A tela deve nascer do trabalho contábil específico do produto: resposta
  primeiro, instrumento de consulta depois.
- Uma âncora por tela. No Demonstrativo, a âncora é o fechamento patrimonial
  em formato de ledger, com patrimônio inicial, final, variação e resultado da
  conciliação no mesmo bloco.
- A hierarquia vem de tipografia, alinhamento e regras horizontais. Cartões
  são exceção; tabelas e linhas têm precedência para preservar a leitura de
  papel.
- Navy é o acento estrutural e interativo. Verde e vermelho só aparecem
  quando expressam ganho/perda, positivo/negativo ou uma ressalva real. Ações
  como exportar e imprimir usam tratamento neutro.
- Os temas claro e escuro têm o mesmo nível de importância e a mesma
  linguagem. Gráficos usam escala monocromática de navy; não usar arco-íris
  decorativo.
- A tela e o papel devem ser a mesma peça: cabeçalho de impressão, regras,
  tabelas e valores precisam manter a hierarquia sem depender de sombras ou
  efeitos de tela.

## Demonstrativo — decisões desta rodada

- O fechamento foi movido para antes dos filtros e da exploração detalhada.
- A antiga fileira de KPIs iguais foi substituída por um ledger único.
- Rendimentos, ganhos, pagamentos e variação patrimonial foram achatados em
  blocos de linhas, removendo a caixa dentro da caixa.
- Ajuda contextual permanece junto da linha como marca tipográfica pequena;
  não usar bolinhas soltas nem repetir cor para chamar atenção.
- A navegação compacta recolhe a barra abaixo de 1000px e preserva os ícones;
  a tela não cria overflow horizontal quando a janela é estreitada.
- Tabelas do Demonstrativo se recompõem quando o contêiner muda de largura;
  em telas estreitas os valores continuam acessíveis no mesmo quadro.
- A assinatura da marca no menu é fixa como “Controle Patrimonial”; o nome do
  perfil continua sendo dado do cadastro e não deve ocupar o lugar da marca.
- Cabeçalhos de valor ficam alinhados à direita com a coluna numérica abaixo,
  preservando a leitura vertical de cada demonstrativo.
- Seções expansíveis ganham uma regra lateral navy, cabeçalho separado por
  linha e fechamento próprio; a expansão não introduz uma segunda rolagem
  vertical dentro da peça.
- A faixa de posições e os indicadores do caixa usam linhas contínuas, sem
  caixas individuais: seis colunas no desktop e recomposição em três, duas ou
  uma coluna nas janelas estreitas.
- Rendimentos termina no Total Geral dos Rendimentos. Renda Variável aparece
  em um bloco complementar próprio, explicitamente fora desse total, para
  evitar que o fechamento e o ajuste sejam lidos como a mesma grandeza.
- O símbolo CP-TEC novo é a marca da navegação e do favicon web; o arquivo
  `.ico` público acompanha o mesmo ativo usado no empacotamento desktop. O
  mapa de navegação deve manter um ícone específico por destino.
- Gráficos mantêm a escala monocromática e refluem o eixo de categorias em
  janelas estreitas, sem cortar barras nem criar overflow da página.
- Foco visível, rótulos explícitos para datas, cabeçalhos/captions semânticos
  e suporte a teclado fazem parte do acabamento, não são camada posterior.

## Tela de entrada — aplicação complementar

- A seleção de perfil é a primeira ação da entrada; o rodapé sobre armazenamento
  local foi retirado para não competir com esse trabalho nem repetir uma
  explicação fora de contexto. A persistência e o isolamento entre perfis não
  foram alterados.
- A vitrine mantém o ciclo real do CP-TEC em três etapas: importar a declaração,
  registrar os movimentos do ano e fechar 31/12. A lista permanece completa e
  legível, com uma faixa horizontal que desloca um único marcador entre as etapas.
- O movimento é uma assinatura de produto, não uma decoração 3D: ele traduz a
  conferência linha a linha e não cria perspectiva, brilho ou dependência de
  biblioteca. A linha ativa ganha contraste, o trilho pausa ao ser apontado e a
  preferência de redução de movimento deixa a sequência estática.
- A animação usa somente transform e cor, sem alterar dimensões ou fluxo do
  layout. As três etapas seguem lado a lado no DOM e na ordem semântica para
  teclado e leitor de tela.

## Evitar

- Grade de três cartões de KPI sem conteúdo proporcional.
- Botão de exportação verde ou qualquer cor de status usada como decoração.
- Gradientes, brilhos e sombras como substitutos de hierarquia.
- Texto de marketing, linguagem de painel genérico ou composição bento sem
  relação com a conferência patrimonial.
- Alterar cálculo, importação, proveniência ou texto coberto por contrato para
  obter uma aparência mais limpa.

## Próxima aplicação

Aplicar este norte uma tela por vez, mantendo as funções e os textos
contratados. A próxima tela da fila é **Importar declaração**. A entrada já
recebeu o tratamento complementar desta rodada; a animação do ciclo não deve
ser replicada como padrão automático nas demais telas.
