---
version: alpha
name: CP-TEC Ardósia
description: Sistema visual do Controle de Variação Patrimonial (CP-TEC) — app plurianual de controle patrimonial para IRPF.
colors:
  primary: "#283453"
  primary-light: "#8991ab"
  primary-hover: "#687187"
  secondary: "#7b818a"
  neutral: "#bfc1c0"
  neutral-dark: "#0a0d15"
  success: "#10b981"
  warning: "#f59e0b"
  danger: "#ef4444"
  info: "#06b6d4"
typography:
  h1:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.2
  h2:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 600
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: 400
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: 600
    letterSpacing: 0.8px
rounded:
  sm: 6px
  md: 10px
  lg: 16px
  xl: 24px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: 9px 18px
  button-secondary:
    backgroundColor: "{colors.neutral-dark}"
    textColor: "{colors.primary-light}"
    rounded: "{rounded.sm}"
  card:
    rounded: "{rounded.lg}"
    padding: 24px
  nav-item-active:
    textColor: "{colors.primary-light}"
    rounded: "{rounded.sm}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  surface-light-theme:
    backgroundColor: "{colors.neutral}"
  currency-positive:
    textColor: "{colors.success}"
  currency-negative:
    textColor: "{colors.danger}"
  stat-card-rule:
    height: 2px
    neutralColor: "{colors.primary}"
    gainColor: "{colors.success}"
    lossColor: "{colors.danger}"
    gradient: false
  toast-warning:
    backgroundColor: "{colors.warning}"
  toast-info:
    backgroundColor: "{colors.info}"
---

## Overview

CP-TEC é uma ferramenta de trabalho de uso diário, não uma vitrine — o
alvo é um contador ou o próprio contribuinte lançando compra, venda e
baixa de bens ao longo do ano. A personalidade é **corporativa e
contida**: nenhum acento quente (dourado, laranja vibrante, gradientes
chamativos), nenhum emoji decorativo, nenhum travessão em texto de
interface. Densidade de informação alta (tabelas, demonstrativos
financeiros) pede clareza tipográfica antes de personalidade visual.

O app roda em dois temas — escuro (padrão) e claro — trocáveis a
qualquer momento pelo ícone fixo no canto superior direito. As duas
leituras usam a mesma paleta de marca, só invertendo o papel de fundo
e texto (ver Cores).

## Colors

A paleta inteira vem de três cores de marca: um navy escuro, um cinza
médio e um cinza claro. Não existe uma quarta cor de destaque
("tertiary") de propósito — o próprio navy É a cor de interação, usada
com moderação (poucos pontos de acento por tela), sem disputar atenção
com o dado financeiro.

- **Primary (#283453):** Navy da marca. No tema claro é a cor de
  botões primários, links e estado ativo da navegação. No tema escuro,
  esse papel passa para uma variante mais clara do mesmo navy
  (**Primary Light, #8991ab**) — o navy puro não tem contraste
  suficiente sobre fundo escuro.
- **Secondary (#7b818a):** Cinza-ardósia da marca. Texto secundário,
  bordas, rótulos de coluna, metadados.
- **Neutral (#bfc1c0):** Cinza claro da marca. Base das superfícies no
  tema claro (fundo de página, hover).
- **Neutral Dark (#0a0d15):** Quase-preto derivado do navy (não é
  preto puro) — base das superfícies no tema escuro.
- **Success/Warning/Danger/Info** (#10b981 / #f59e0b / #ef4444 /
  #06b6d4): cores funcionais de status financeiro (ganho/perda,
  alerta, erro) — deliberadamente FORA da paleta de marca. Servem para
  o usuário distinguir "ganhou" de "perdeu" num relatório num olhar
  só; trocar isso pela paleta neutra tornaria o app pior, não mais
  consistente.

### Contraste

O tema claro já foi ajustado por medição real (WCAG): `secondary`
sozinho (#7b818a) não passa em texto pequeno sobre fundo claro — os
tokens de texto efetivos no tema claro são variantes mais escuras
(#5c6168 / #676c74), documentadas como CSS custom properties
`--text-secondary`/`--text-muted` em `src/index.css`, não como token
de cor à parte aqui. Pelo mesmo critério, texto funcional pequeno no
tema claro usa variantes escuras de azul, verde, laranja, roxo e vermelho
(#1d4ed8 / #047857 / #92400e / #6d28d9 / #b91c1c); os fundos de status
continuam os mesmos e o tema escuro conserva os tons claros originais.
No tema escuro, texto apagado usa `#828993` sobre cards. Nos dois temas, o
botão destrutivo usa `#dc2626` (`#b91c1c` no hover), para que texto pequeno e
rótulos de ação também atinjam 4,5:1.

## Typography

Fonte única, **Inter**, do título de página ao rótulo de tabela — sem
fonte de destaque separada (nenhum serifado, nenhuma fonte "de
marca" só para headlines). Hierarquia por peso e tamanho, não por
troca de família.

- `h1` (20px/700): título de página (`.page-header h2`).
- `h2` (16px/600): título de card (`.card-title`).
- `body-md` (14px/400): campos de formulário, corpo padrão.
- `body-sm` (13px/400): tabelas, navegação, texto de UI denso.
- `label-caps` (11px/600, uppercase, +0.8px): cabeçalho de coluna,
  rótulo de seção da sidebar — sempre versalete com letter-spacing,
  nunca peso maior que 600.

## Layout

Espaçamento em múltiplos de 8px (`spacing.sm` a `spacing.xl`). Sidebar
fixa em 260px (68px recolhida); conteúdo principal em `page-header` +
`page-body` com padding lateral de 24–28px. Grids de card usam
`repeat(auto-fit, minmax(...))` — o layout se realinha por
tamanho da tela, não por breakpoint fixo.

## Elevation & Depth

Sombras são discretas e só aparecem em três situações: hover de card
(`--shadow-glow`, um halo de baixa opacidade na cor do acento), modais
(`--shadow-lg`) e o botão de tema fixo no canto (`--shadow-sm`). Não
há sombra decorativa em elementos estáticos — sombra sinaliza
interatividade ou sobreposição (z-index), nunca decoração.

## Shapes

Escala de raio única para o app inteiro (`rounded.sm` a `rounded.xl`):
botões e inputs em `sm` (6px), cards e modais em `lg`/`xl` (16–24px).
Nenhum elemento usa `border-radius` fora dessa escala.

## Components

- **button-primary**: navy sólido (ou o tint claro no tema escuro),
  texto branco, sem gradiente vistoso — só um `box-shadow` sutil na
  cor do próprio botão.
- **button-secondary**: fundo neutro da superfície, texto no tom claro
  do navy, borda de 1px.
- **card**: superfície elevada com borda de 1px translúcida na cor
  `secondary`; hover levanta 2px e acende `--shadow-glow`.
- **stat-card**: linha superior sólida de 2px; `primary` para informação
  neutra, `success` para ganho/resultado positivo e `danger` para
  dívida/despesa/perda. Nunca usa gradiente nem cor sem significado.
- **nav-item-active**: sem preenchimento sólido — uma barra de 3px na
  lateral esquerda + fundo translúcido de 12% na cor `primary-light`.

## Do's and Don'ts

- **Do** manter os quatro tons funcionais (verde/laranja/vermelho/azul
  de status) fora da paleta de marca — eles carregam significado
  financeiro, não identidade visual.
- **Do** usar `primary`/`primary-light` com moderação (poucos pontos
  de acento por tela) — é assim desde a origem da paleta (ver também
  o projeto irmão TERA, mesma filosofia de acento contido).
- **Don't** usar dourado, laranja vibrante ou qualquer acento quente —
  abolido de propósito.
- **Don't** usar travessão (—) em texto visível na interface (log,
  toast, confirm, JSX). Pontuação de interface é direta.
- **Don't** usar emoji decorativo. Exceções: "✕" (fechar modal,
  convenção padrão de UI) e as setas "→"/"«"/"»" já em uso.
- **Don't** introduzir uma quarta família tipográfica ou uma cor de
  acento fora das três cores de marca sem atualizar este arquivo.
