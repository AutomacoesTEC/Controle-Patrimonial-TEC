---
name: CP-TEC
description: Sistema visual do Controle de Variação Patrimonial, ferramenta de consultoria tributária para acompanhar patrimônio de clientes ano a ano.
colors:
  navy-tec: "#283453"
  navy-noite: "#1e273e"
  navy-bruma: "#8991ab"
  grafite: "#687187"
  ardosia: "#7b818a"
  fundo-escuro: "#0a0d15"
  painel-escuro: "#101521"
  cartao-escuro: "#161d2e"
  cartao-escuro-hover: "#1c243a"
  campo-escuro: "#080b12"
  fundo-claro: "#f5f6f6"
  painel-claro: "#eff0ef"
  cartao-claro: "#ffffff"
  campo-claro: "#ffffff"
  texto-escuro-forte: "#eef0f2"
  texto-escuro-medio: "#959aa1"
  texto-escuro-fraco: "#828993"
  texto-claro-forte: "#1e273e"
  texto-claro-medio: "#5c6168"
  texto-claro-fraco: "#676c74"
  borda-escura: "rgba(123, 129, 138, 0.15)"
  borda-clara: "rgba(123, 129, 138, 0.25)"
  sucesso: "#10b981"
  sucesso-sobre-escuro: "#34d399"
  sucesso-sobre-claro: "#047857"
  alerta: "#f59e0b"
  alerta-sobre-escuro: "#fbbf24"
  alerta-sobre-claro: "#92400e"
  perigo: "#ef4444"
  perigo-sobre-escuro: "#f87171"
  perigo-sobre-claro: "#b91c1c"
  perigo-acao: "#dc2626"
  perigo-acao-hover: "#b91c1c"
  info: "#3b82f6"
  info-sobre-escuro: "#60a5fa"
  info-sobre-claro: "#1d4ed8"
  categoria: "#8b5cf6"
  categoria-sobre-escuro: "#a78bfa"
  categoria-sobre-claro: "#6d28d9"
  grafico-escuro-1: "#3987e5"
  grafico-escuro-2: "#d95926"
  grafico-escuro-3: "#199e70"
  grafico-escuro-4: "#c98500"
  grafico-escuro-5: "#d55181"
  grafico-escuro-6: "#008300"
  grafico-escuro-7: "#9085e9"
  grafico-escuro-8: "#e66767"
  grafico-claro-1: "#2a78d6"
  grafico-claro-2: "#eb6834"
  grafico-claro-3: "#1baf7a"
  grafico-claro-4: "#eda100"
  grafico-claro-5: "#e87ba4"
  grafico-claro-6: "#008300"
  grafico-claro-7: "#4a3aa7"
  grafico-claro-8: "#e34948"
typography:
  titulo-pagina:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "1.3"
  titulo-modal:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "1.5"
  titulo-card:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "1.4"
  corpo:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "1.5"
  corpo-denso:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "1.5"
  valor-destaque:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    fontFeature: "tnum, ss01"
  valor-kpi:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    fontFeature: "tnum, ss01"
  valor-tabela:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    fontFeature: "tnum, ss01"
  rotulo-tabela:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "1.5"
    letterSpacing: "0.4px"
  rotulo-campo:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "14px"
    letterSpacing: "0.5px"
  rotulo-secao:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: "1.5"
    letterSpacing: "1.2px"
rounded:
  sm: "6px"
  md: "10px"
  lg: "16px"
  xl: "24px"
  pilula: "20px"
  circulo: "50%"
spacing:
  xxs: "2px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.navy-tec}"
    textColor: "#ffffff"
    typography: "{typography.corpo-denso}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-primary-hover:
    backgroundColor: "{colors.navy-noite}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.cartao-claro}"
    textColor: "{colors.texto-claro-forte}"
    typography: "{typography.corpo-denso}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-secondary-hover:
    backgroundColor: "{colors.painel-claro}"
    textColor: "{colors.texto-claro-forte}"
  button-danger:
    backgroundColor: "{colors.perigo-acao}"
    textColor: "#ffffff"
    typography: "{typography.corpo-denso}"
    rounded: "{rounded.sm}"
    padding: "9px 18px"
  button-danger-hover:
    backgroundColor: "{colors.perigo-acao-hover}"
    textColor: "#ffffff"
  button-sm:
    typography: "{typography.rotulo-tabela}"
    rounded: "{rounded.sm}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.cartao-claro}"
    textColor: "{colors.texto-claro-forte}"
    rounded: "{rounded.lg}"
    padding: "24px"
  stat-card:
    backgroundColor: "{colors.cartao-claro}"
    textColor: "{colors.texto-claro-forte}"
    rounded: "{rounded.lg}"
    padding: "20px"
  input:
    backgroundColor: "{colors.campo-claro}"
    textColor: "{colors.texto-claro-forte}"
    typography: "{typography.corpo}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.texto-claro-medio}"
    typography: "{typography.corpo-denso}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  nav-item-active:
    textColor: "{colors.navy-tec}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.texto-claro-medio}"
    typography: "{typography.corpo-denso}"
    padding: "9px 14px 11px"
  tab-active:
    textColor: "{colors.navy-tec}"
    padding: "9px 14px 11px"
  table-header:
    backgroundColor: "{colors.painel-claro}"
    textColor: "{colors.texto-claro-medio}"
    typography: "{typography.rotulo-tabela}"
    padding: "12px 16px"
  table-cell:
    textColor: "{colors.texto-claro-forte}"
    typography: "{typography.corpo-denso}"
    padding: "12px 16px"
  badge:
    typography: "{typography.rotulo-secao}"
    rounded: "{rounded.pilula}"
    padding: "3px 10px"
  modal:
    backgroundColor: "{colors.painel-claro}"
    textColor: "{colors.texto-claro-forte}"
    rounded: "{rounded.xl}"
    width: "min(90%, 700px)"
  toast:
    textColor: "#ffffff"
    typography: "{typography.corpo-denso}"
    rounded: "{rounded.md}"
    padding: "12px 20px"
---

# Design System: CP-TEC

## Overview

**Creative North Star: "A Sala de Conferência"**

O CP-TEC é o lugar onde uma consultora senta com o patrimônio de um cliente e confere, linha a linha, se a conta fecha. A sala é silenciosa de propósito: ninguém disputa atenção com o número. A interface é calma, clara e confiável, três palavras que resolvem qualquer dúvida de decisão futura. Quando estiver em dúvida entre impressionar e deixar ler, deixe ler.

A densidade é alta e assumida. Tabelas com dez colunas, demonstrativos de trinta linhas e fichas fiscais com rótulo oficial são o conteúdo normal de uma tela, não uma exceção a esconder atrás de abas. O que organiza essa densidade é tipografia e espaçamento, nunca cor decorativa nem moldura: o app tem uma família tipográfica só, uma escala de raio só, e três cores de marca. A cor entra quando carrega significado financeiro, que é ganho, perda, alerta e informação.

O app nasce em tema escuro e troca para claro a qualquer momento pelo botão fixo no canto superior direito. Os dois temas são o mesmo sistema: cada token de cor existe nos dois, e nenhum é o tema principal. O claro não é um modo secundário, é o que a cliente vê quando a tela é apresentada numa reunião e o que o relatório impresso reproduz.

**Key Characteristics:**
- Acento contido: o navy da marca é a única cor de interação, em poucos pontos por tela.
- Número antes de tudo: algarismos tabulares, alinhamento à direita, nada que atrapalhe comparar duas linhas.
- Dois temas no mesmo nível, mais uma terceira leitura para impressão em A4.
- Superfície plana em repouso; sombra só quando o elemento reage ou flutua.
- Sem emoji, sem travessão, sem ornamento: o texto de interface é direto.

## Colors

Três cores de marca (navy, ardósia e os cinzas derivados) sustentam a interface inteira, e um conjunto funcional separado carrega o significado financeiro.

### Primary

- **Navy TEC** (#283453): a cor da marca e da interação no tema claro. Pinta botão primário, item de navegação ativo, aba ativa, links de seção do demonstrativo e a borda de foco. No tema escuro esse papel passa para o Navy Bruma, porque o navy puro não separa do fundo quase preto.
- **Navy Bruma** (#8991ab): o mesmo navy clareado, cor de interação no tema escuro. É também a base de toda transparência de acento, usada como `rgba(137, 145, 171, a)` em fundo de item ativo (12%), anel de foco (10%) e halo de hover (15%).
- **Navy Noite** (#1e273e): fecho do gradiente da marca e texto forte do tema claro.
- **Grafite** (#687187): abertura do gradiente da marca no tema escuro.

### Secondary

- **Ardósia** (#7b818a): o cinza da marca. Não aparece sozinho como texto; vive nas bordas, sempre em transparência, 15% no tema escuro e 25% no claro. É o que separa cartão, campo, cabeçalho e tabela sem desenhar uma linha dura.

### Neutral

- **Superfícies do tema escuro**: página #0a0d15, painel lateral e cabeçalho #101521, cartão #161d2e, hover de cartão #1c243a, campo #080b12. O campo é mais escuro que o cartão de propósito, para parecer um encaixe e não um bloco solto.
- **Superfícies do tema claro**: página #f5f6f6, painel lateral e cabeçalho #eff0ef, cartão e campo #ffffff. A hierarquia inverte: no claro o branco puro é o que está na frente.
- **Texto**: no escuro #eef0f2 forte, #959aa1 médio, #828993 fraco. No claro #1e273e forte, #5c6168 médio, #676c74 fraco. Os tons médios e fracos do tema claro já foram escurecidos por medição de contraste e não devem voltar ao cinza de marca puro.

### Tertiary

Cores funcionais, deliberadamente fora da paleta de marca, porque carregam leitura financeira e não identidade:

- **Sucesso** (#10b981): ganho, resultado positivo, integridade confirmada. Como texto, #34d399 sobre fundo escuro e #047857 sobre fundo claro.
- **Alerta** (#f59e0b): ressalva, pendência, conferência que falta. Texto #fbbf24 no escuro e #92400e no claro.
- **Perigo** (#ef4444): perda, erro, exclusão. Texto #f87171 no escuro e #b91c1c no claro. A ação destrutiva tem tom próprio, mais fechado: #dc2626 em repouso e #b91c1c no hover, igual nos dois temas.
- **Informação** (#3b82f6): caixa explicativa, registro de origem importada, aviso neutro. Texto #60a5fa no escuro e #1d4ed8 no claro.
- **Categoria** (#8b5cf6): classificação sem juízo de valor, quando nem sucesso nem alerta se aplicam. Texto #a78bfa no escuro e #6d28d9 no claro.

Fundo de qualquer cor funcional é a própria cor a 15% quando ela vira etiqueta ou pílula, e a 10% quando vira painel de texto dentro da página.

### Gráficos

Oito cores categóricas por tema, usadas em sequência para distinguir séries e fatias. No escuro: #3987e5, #d95926, #199e70, #c98500, #d55181, #008300, #9085e9, #e66767. No claro: #2a78d6, #eb6834, #1baf7a, #eda100, #e87ba4, #008300, #4a3aa7, #e34948. Elas existem para separar categorias que não têm significado de ganho ou perda; quando o gráfico mostra resultado, ele volta para sucesso e perigo.

### Named Rules

**A Regra do Acento Escasso.** O navy aparece em no máximo três pontos por tela. Se um quarto elemento pede acento, ele não é importante o bastante.

**A Regra do Par.** Todo token de cor existe nos dois temas. Uma cor que só funciona no escuro é um defeito, não um estilo.

**A Regra do Significado.** Cor funcional só entra quando o usuário precisa distinguir ganho, perda, alerta, informação ou categoria. Cor sem significado é ruído sobre um número.

## Typography

**Fonte única:** Inter, empacotada localmente com o aplicativo pelo `@fontsource/inter`, nos pesos 400, 500, 600 e 700, com fallback -apple-system, BlinkMacSystemFont, Segoe UI e sans-serif. Não há fonte de display, nem serifada, nem monoespaçada de sistema (a única exceção é o log técnico da importação).

**Caráter:** neutra e legível em corpo pequeno, que é onde o app vive. A hierarquia vem de tamanho e peso, nunca de troca de família.

### Hierarquia

- **Título de página** (700, 20px, 1.3): nome da tela no cabeçalho fixo.
- **Título de modal** (700, 18px, 1.5): cabeçalho de qualquer diálogo.
- **Título de card e de seção** (600, 16px, 1.4): título de cartão, h3 de corpo e título de estado vazio.
- **Corpo** (400, 14px, 1.5): base da página, texto de campo e de parágrafo dentro de modal.
- **Corpo denso** (400, 13px, 1.5): tabela, botão, item de navegação, aba, subtítulo de página, toast. É o tamanho mais presente da interface.
- **Valor de destaque** (700, 20px, tabular): o número que a pessoa veio ver, um por bloco.
- **Valor de KPI** (700, 18px, tabular): indicadores em grade, três a seis por tela.
- **Valor de tabela** (400, 13px, tabular): toda célula monetária, alinhada à direita e sem quebra de linha.
- **Rótulo de tabela** (600, 12px, maiúsculas, +0.4px): cabeçalho de coluna dentro do corpo da página.
- **Rótulo de campo** (600, 12px, maiúsculas, +0.5px, entrelinha fixa de 14px e altura mínima de 28px): o rótulo reserva duas linhas para que campos vizinhos fiquem alinhados mesmo com nomes de tamanhos diferentes.
- **Rótulo de seção** (700, 11px, maiúsculas, +1.2px): divisória da navegação lateral e seção do demonstrativo.

### Named Rules

**A Regra do Algarismo Alinhado.** Todo número comparável usa algarismos tabulares (`font-variant-numeric: tabular-nums` e `font-feature-settings: "tnum", "ss01"`). Uma coluna de valores tem que poder ser lida na vertical.

**A Regra da Maiúscula com Trilho.** Texto em maiúsculas nunca vai sem espaçamento entre letras, e o espaçamento acompanha o tamanho: 0.4px na tabela, 0.5px no campo, 1.2px na seção.

**A Regra dos Quatro Pesos.** Só existem 400, 500, 600 e 700. Nenhum elemento pede 800, porque essa face não é empacotada e o navegador entrega o 700 disfarçado.

## Layout

A tela é dividida em navegação lateral fixa de 260px (68px quando recolhida pelo botão, nunca por largura de janela) e área principal com cabeçalho de página e corpo rolável. O cabeçalho usa `20px 76px 16px 28px`, e os 76px da direita são a reserva do botão fixo de tema. O corpo usa `24px 28px` e, a partir de 1800px de largura, fica centralizado e limitado a 1600px, para que rótulo e valor continuem na mesma área de leitura.

O espaçamento anda de 4 em 4: 4, 8, 12, 16, 20 e 24 são a grade, com meios-passos de 6, 10, 14 e 18 reservados ao interior de controles (botão 9px 18px, campo 10px 14px, item de navegação 10px 14px, célula do demonstrativo 9px 14px). Grades de cartão usam `repeat(auto-fit, minmax(...))` e se reorganizam por espaço disponível, não por breakpoint.

Os pontos de quebra existentes são 600px, 640px, 700px, 800px, 1100px e 1600px para baixo, 1800px para cima, e uma consulta de contêiner entre 752px e 1007px que transforma a grade de quatro indicadores em duas colunas. A tabela rola dentro do próprio cartão, com altura máxima de `min(62vh, 640px)` e cabeçalho preso no topo.

A impressão é a terceira leitura do sistema: A4 com margem de 14mm, tokens trocados para tinta sobre papel branco, navegação e controles fora da folha, e cartões que não quebram no meio.

**A Regra do Passo de Quatro.** Qualquer medida nova nasce múltipla de 4. Meio-passo só dentro de controle, nunca entre blocos.

## Elevation & Depth

O sistema é plano em repouso. A separação entre superfícies vem de tom e de borda de 1px em ardósia transparente, não de sombra. A sombra existe para dizer duas coisas: este elemento está reagindo a você, ou este elemento flutua sobre a página.

### Shadow Vocabulary

- **Reação** (`box-shadow: 0 0 20px rgba(137, 145, 171, 0.15)` no escuro e `rgba(40, 52, 83, 0.12)` no claro): halo que acende no hover de cartão.
- **Apoio** (`0 1px 3px`): botão fixo de tema, o único elemento permanentemente destacado da página.
- **Camada média** (`0 4px 12px`): lista suspensa que nasce de um campo, como o seletor de código.
- **Sobreposição** (`0 8px 32px`): o que cobre a página, como diálogo de confirmação, calendário, toast e painel de ajuda.
- **Ação primária**: o botão primário carrega sombra na própria cor, `0 2px 8px` em repouso e `0 4px 16px` no hover, sempre em `rgba` do acento.

No tema escuro as sombras são pretas (30%, 40%, 50%); no claro são navy (8%, 10%, 14%), porque preto sobre papel claro vira sujeira.

**A Regra da Sombra Reativa.** Superfície parada não tem sombra. Se um elemento ganhou sombra sem ter reagido nem flutuado, a sombra está decorando.

## Shapes

Quatro raios, e nada fora deles: 6px em botão, campo, item de navegação e etiqueta interna; 10px em contêiner de tabela, lista suspensa, toast e painel de ajuda; 16px em cartão, cartão de indicador, caixa de confirmação e zona de importação; 24px só no diálogo grande. A pílula (20px) fica reservada a badge e variação percentual, e o círculo (50%) a avatar, botão de tema e marca de ajuda.

As bordas são de 1px em quase tudo. 2px marca hierarquia dentro do demonstrativo (linha de seção e linha final) e a aba ativa. Tracejado significa área que recebe algo: 1.5px no cartão de novo perfil, 2px na zona de importar arquivo.

A marca aparece em gradiente de 135 graus (grafite para navy no escuro, navy para navy noite no claro) em três lugares apenas: o quadrado do logo, o avatar do perfil e o botão primário.

**A Regra dos Quatro Raios.** Um valor de raio novo precisa substituir um dos quatro, não se somar a eles.

## Components

### Buttons

- **Forma:** cantos suaves (6px), altura definida pelo padding `9px 18px`, texto de 13px em peso 600, ícone de 16px com 8px de distância.
- **Primário:** gradiente da marca com texto branco e sombra na cor do acento. Hover sobe 1px e adensa a sombra; clique afunda para 97% da escala.
- **Secundário:** superfície de cartão com borda de 1px. Hover troca o fundo pelo tom de hover e acende a borda no acento. É a variante mais usada do app.
- **Perigo:** vermelho fechado (#dc2626), hover #b91c1c, com sombra própria. Usado em excluir e no confirmar de diálogo destrutivo.
- **Pequeno:** `6px 12px` e 12px de texto, para ações dentro de linha de tabela e da barra lateral.
- **Botão de texto:** sem caixa, 12px em peso 600 na cor do acento, sublinhado no hover. Serve para voltar e para atalhos dentro de uma seção.
- **Foco:** contorno sólido de 2px no acento, afastado 2px, igual em todos os controles.

### Cards / Containers

- **Canto:** 16px. **Fundo:** superfície de cartão. **Borda:** 1px em ardósia transparente. **Padding:** 24px.
- **Cabeçalho:** título de 16px em peso 600 à esquerda, ações à direita, 16px abaixo.
- **Hover:** borda acende no acento a 20% e o halo de reação aparece. Cartão que não é clicável não deveria reagir.
- **Cartão de indicador:** padding de 20px e uma faixa sólida de 2px no topo, que diz o tipo do número: acento para neutro, sucesso para ganho, perigo para dívida ou perda. Nunca gradiente, nunca cor sem significado.

### Inputs / Fields

- **Estilo:** fundo de campo, borda de 1px, 6px de raio, padding `10px 14px`, texto de 14px.
- **Foco:** a borda vai para o acento a 50% e um anel de 3px do acento a 10% aparece em volta.
- **Inválido:** borda em perigo; no foco, o anel vira vermelho a 12%.
- **Rótulo:** acima do campo, maiúsculo de 12px com altura reservada para duas linhas.
- **Campo de valor:** prefixo "R$" fixo à esquerda, dentro do campo, em 13px peso 600 no tom fraco, e o conteúdo em algarismos tabulares.
- **Campo de data:** ícone de calendário à direita abre um painel de 264px com dias quadrados de 6px de raio; o dia de hoje vem em peso 700 no acento e o selecionado em fundo de acento com texto branco.
- **Busca:** mesmo desenho do campo, com ícone à esquerda e recuo de 38px no texto.

### Navigation

- **Barra lateral:** 260px, fundo de painel, borda à direita, cabeçalho com a marca e rodapé com o seletor de ano-calendário. Recolhe para 68px mostrando só ícones, e a escolha fica guardada.
- **Item:** 13px em peso 500, padding `10px 14px`, 6px de raio, cor de texto médio. Hover troca o fundo para a superfície de cartão e clareia o texto.
- **Item ativo:** fundo do acento a 12%, texto no acento e uma barra de 3px colada na borda esquerda. Não existe preenchimento sólido.
- **Divisória de seção:** rótulo maiúsculo de 11px com 1.2px de espaçamento, que some quando a barra está recolhida.
- **Abas:** sublinhado, não pílula. Inativa em peso 500 com borda inferior transparente; ativa em peso 600 no acento com borda inferior de 2px na mesma cor.

### Tables

- **Contêiner:** raio de 10px, borda de 1px, rolagem própria, altura máxima de `min(62vh, 640px)` dentro de um cartão.
- **Cabeçalho:** preso no topo, fundo de painel, rótulo maiúsculo de 12px com 0.4px de espaçamento, padding `12px 16px`.
- **Célula:** 13px, padding `12px 16px`, borda inferior de 1px, texto forte; valores monetários à direita, tabulares e sem quebra.
- **Zebra:** linhas pares recebem 40% do tom de hover misturado ao fundo do cartão. O hover continua prevalecendo sobre a zebra.
- **Rodapé de totais:** padding `14px 16px` e fundo no tom de hover.
- **Colunas redimensionáveis:** alça de 11px entre colunas que acende no acento ao passar; duplo clique volta ao padrão. Colunas fixas à esquerda e à direita ganham sombra lateral para mostrar que o conteúdo continua.

### Dialogs

- **Modal:** cobertura preta a 70% com desfoque de 4px, caixa em superfície de painel, raio de 24px, largura de 90% até 700px, altura máxima de 85vh. Cabeçalho `20px 24px` com título de 18px, corpo de 24px, rodapé `16px 24px` com as ações à direita. Entra subindo 20px em 320ms e sai descendo 8px em 150ms.
- **Confirmação:** menor e mais dura. Cobertura a 55% com desfoque de 3px, caixa em superfície de cartão, raio de 16px, largura máxima de 440px, título de 16px em peso 700, texto de 13.5px. Confirmar recebe o foco inicial e vira botão de perigo quando a ação é destrutiva.

### Feedback

- **Badge:** pílula de `3px 10px`, 11px em peso 600, fundo da cor funcional a 15% e texto na variante legível do tema. Marca a origem do registro: informação para cadastro manual, sucesso para importado, alerta para editado depois da importação.
- **Toast:** canto inferior direito, raio de 10px, 13px em peso 500, texto branco sobre a cor funcional a 90%, sombra de sobreposição, quatro segundos na tela.
- **Estado vazio:** centralizado, altura mínima de 180px, título de 16px, uma frase de contexto de 13px com largura máxima de 520px e, quando fizer sentido, uma única ação primária. Sem ilustração e sem emoji.
- **Esqueleto de carregamento:** blocos de 6px de raio com brilho deslizante de 1.5s, usados enquanto a tela carrega.
- **Ajuda:** círculo de 15px com "?" ao lado do rótulo, ou "!" no alerta quando existe ressalva. Abre no clique um balão de até 340px, com título em peso 700 e texto de 12.5px.

### Motion

Uma curva só, `cubic-bezier(0.16, 1, 0.3, 1)`, e três durações: 150ms para resposta de controle, 220ms para transição de superfície, 320ms para entrada de diálogo. Hover levanta 1px em botão e 2px em cartão; o clique afunda para 97%. Com `prefers-reduced-motion`, tudo cai para 0.01ms e nada mais se move.

## Do's and Don'ts

### Do:

- **Do** usar o acento em no máximo três pontos por tela e deixar o número ser o mais forte.
- **Do** declarar toda cor nova nos dois temas, com a variante legível de texto em cada um.
- **Do** aplicar algarismos tabulares em qualquer valor que entre numa coluna ou numa comparação.
- **Do** manter maiúsculas sempre com espaçamento entre letras (0.4px, 0.5px ou 1.2px, conforme o papel).
- **Do** reservar a sombra para o que reage ou flutua, e usar preto no tema escuro e navy no claro.
- **Do** escrever medidas múltiplas de 4, deixando 6, 10, 14 e 18 só para o interior de controles.
- **Do** dar a toda ação destrutiva o vermelho fechado #dc2626 e um diálogo de confirmação com foco inicial em Confirmar.

### Don't:

- **Don't** usar dourado, laranja vibrante ou qualquer acento quente.
- **Don't** usar emoji decorativo. As exceções que já existem são o "✕" de fechar e as setas.
- **Don't** usar travessão em texto de interface, seja rótulo, aviso, log ou confirmação.
- **Don't** introduzir uma segunda família tipográfica, um quinto raio ou uma cor de marca além do navy e da ardósia.
- **Don't** pedir peso 800 ou itálico: essas faces não são empacotadas e o navegador improvisa.
- **Don't** espalhar gradiente: ele pertence ao logo, ao avatar e ao botão primário, e a mais nada.
- **Don't** escrever cor em hexadecimal solto no componente quando existe token; transparência de acento sai de `rgba(var(--accent-primary-rgb), a)`.
