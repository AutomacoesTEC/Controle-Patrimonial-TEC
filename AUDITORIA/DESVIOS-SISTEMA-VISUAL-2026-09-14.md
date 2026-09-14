# Desvios do sistema visual, 14/09/2026

Levantado na regeração do `DESIGN.md` (modo scan da impeccable), a partir do código e de estilos medidos no app rodando. O `DESIGN.md` descreve o sistema; este arquivo lista onde o código não o cumpre. Cada item tem evidência em arquivo:linha e serve de entrada para o redesign.

Método: 6 levantamentos automatizados (tokens e efeitos, cores literais, tipografia, espaçamento e forma, receita de componentes, estilos computados no navegador) com verificação por segunda leitura nos tokens. Contagens vêm de grep ou script, não de estimativa.

## 1. CSS morto (classe existe, nenhum JSX usa)

| Classe | Linhas | Observação |
|---|---|---|
| `.saldo-hero` e filhos | `src/index.css:173-190` | Faixa de decisão do Demonstrativo com valor de 30px. Substituída pela linha `.demonstrativo-destaque.demonstrativo-final`. `src/pages/revisaoImagens.test.js:30` exige que não volte. |
| `.stat-icon` | `src/index.css:224-227` | Paleta de 5 cores sem uso. |
| `.stat-comparativo` | `src/index.css:234-236` | |
| `.dashboard-avisos` | `src/index.css:168-172` | |
| `.btn-lg` | `src/index.css:301` | Única variante de botão grande. |
| `.tabela-densidade` | `src/index.css:325` | O modo compacto de tabela não existe, apesar de a classe estar escrita. |
| `.stat-value` | `src/index.css:636` (seletor) | Sem uso; o efeito tabular vem de `.currency`. |

## 2. Conflitos de cascata (o declarado não é o que renderiza)

O bloco "Escala tipográfica comum" (`src/index.css:858-866`) fica no fim do arquivo e vence regras anteriores de mesma especificidade:

- `.stat-info h3` declara 22px/700 e renderiza 16px/600 (`src/index.css:228` contra `:861`).
- `.empty-state h3` declara 18px e renderiza 16px (`:586` contra `:861`).
- `thead th` declara 11px com 0.8px de espaçamento e renderiza 12px com 0.4px dentro de `.page-body` (`:346` contra `:866`). Confirmado no navegador.
- `summary` de `.dashboard-graficos` 14px vira 13px; de `.continuidade-detalhes` 12px vira 13px.
- `h4` de `.saldo-checklist` e de `.import-review-warnings` 13px vira 14px.
- Entrelinhas 1.5 e 1.6 de `.estado-vazio p`, `.acomp-page p` e `.demo-visao p` viram 1.55.

## 3. Estados que não existem

- **Desabilitado**: não há regra `:disabled` para `.btn`, `.form-control`, `.money-input` nem `.search-box`. Há 34 atributos `disabled={` no JSX, 19 deles em botões. Medido no app: o botão primário desabilitado tem `opacity: 1` e `cursor: pointer`, idêntico ao habilitado. Só `.tab` e `.date-picker-day` tratam desabilitado (`src/index.css:506`, `:630`).
- **Linha de tabela selecionada** e **cartão selecionado**: não existem.
- **Hover**: falta em `.btn-success` (`src/index.css:293`), nos itens do `SeletorCodigo` e nos badges.

## 4. Foco de teclado com quatro lógicas diferentes

- Global: `outline: 2px solid var(--accent-primary)` com 2px de afastamento (`src/index.css:712`).
- `.form-control` e `.money-input`: anel de 3px no `:focus` (não `:focus-visible`), somado ao outline global (`:434`, `:607`).
- `.search-box input`: muda só a borda, sem anel (`:602`).
- `.year-selector select`: `outline: none` com especificidade maior que a regra global, então **não há indicação visível de foco** (`src/index.css:136`).
- `.ajuda-marca`: troca o outline por mudança de cor (`:391`).

## 5. Dois padrões de estado vazio

O componente `EstadoVazio` (14 usos) convive com o legado `.empty-state` (5 usos: `src/pages/Dashboard.jsx:337`, `:863`, `:894`; `src/pages/ImportPage.jsx:436`; `src/pages/PerfilLauncherPage.jsx:704`). No Demonstrativo o título é um `p` de 16px em cor secundária com estilo inline (`src/pages/Dashboard.jsx:338`); em Importar é um `h3` de 16px em cor primária. A mesma situação aparece de dois jeitos.

## 6. Classes usadas sem regra CSS

`.table-wrapper` aparece em 7 tabelas e não tem nenhuma regra: essas tabelas ficam sem contêiner de rolagem, sem raio de 10px e sem cabeçalho fixo (`src/components/ResumoDemonstrativo.jsx:23`, `:34`, `:38`, `:42`, `:47`; `src/components/PontosAtencaoImportacao.jsx:27`; `src/pages/Dashboard.jsx:936`). Também `.badge-origem` e `.badge-editado`.

## 7. Campo fora do sistema

`src/components/BemModal.jsx:103`: o select de "Classe financeira" não tem `className="form-control"`. Medido no app: preto sobre `rgb(233,233,237)`, borda `2px inset`, raio 0, nos dois temas. É o estilo nativo do navegador dentro de um modal escuro.

## 8. Cor fora de token

167 ocorrências literais em 79 valores distintos (107 no `src/index.css`, 31 em estilo inline, 29 nos gráficos).

- **Azul #3b82f6**, 21 usos, sem token: caixas de destaque inline (fundo a 10% com borda a 20%), `.badge-blue`, `.stat-icon.blue` e `.toast-info`. O token `--accent-info` (#06b6d4) existe e nunca é usado.
- **Cinza-azulado #94a3b8**, fora da paleta: hover e total do demonstrativo (`src/index.css:664`, `:668`, `:670`) e a cromia dos gráficos.
- **Falta a versão `-rgb`** de sucesso, alerta e perigo: toda transparência dessas cores é escrita à mão, em 13 opacidades diferentes (0.05, 0.06, 0.1, 0.12, 0.14, 0.15, 0.2, 0.25, 0.28, 0.3, 0.35, 0.5, 0.9).
- **Cores de texto de status** (#34d399, #f87171, #60a5fa, #fbbf24, #a78bfa e as versões escuras) não têm token.
- **Impressão**: as réguas de `.page-header` e `.print-header` usam #283453 fixo, enquanto o token de acento na impressão é #1d4ed8 (`src/index.css:737`, `:739` contra `:730`).

## 9. Variante de tema claro faltando

- `.stat-icon` e `.stat-change` continuam com texto #34d399 e #f87171 no tema claro; só os badges ganharam variante escura (`src/index.css:477-481`).
- Os toasts não têm variante clara.
- A sombra da coluna de ações fixa é preta a 75% nos dois temas (`src/index.css:348`), enquanto as sombras do tema claro são navy.
- `.btn-danger`: a regra base com `var(--accent-danger)` nunca aparece, porque `:296` e `:298` forçam #dc2626 nos dois temas.

## 10. Estilo inline em vez de classe

642 ocorrências de `style={{` (AtividadeRural 120, GanhosCapital 92, Relatório 75, PerfilLauncher 40, RendaVariável 34). Padrões que se repetem sem virar componente:

- Caixa informativa: fundo a 10% com borda a 20% mais raio de 6px e padding de 16px, repetida 6 vezes em azul, 4 em verde e 5 em vermelho.
- 29 valores de KPI em `18px/700` ou `20px/700` **sem** `.currency`, ou seja, sem algarismos tabulares. Ficam lado a lado numa grade e não alinham.
- 32 `borderTop: 2px solid` inline nas linhas de total, uma por célula.
- Espaçamento vertical entre blocos feito com `marginBottom` inline (50 ocorrências de 20px), não com `gap` do contêiner.

## 11. Escala inconsistente

- **Espaçamento**: dos 645 valores em px, 33,3% não são múltiplos de 4. A fuga se concentra no CSS global (43,6%), não no inline (20,9%). Os fora de grade mais comuns: 10px (50), 6px (32), 14px (32), 18px (22).
- **Raio**: a pílula é escrita de três formas (20px, 999px, 50%) e o valor 10px aparece literal 5 vezes em vez do token.
- **Largura de modal**: 10 valores distintos definidos por tela (400, 440, 520, 700, 800, 860, 900, 1000, 1100, 1200), sem escala nomeada.
- **Grade**: `minmax(320px)`, `minmax(330px)` e `minmax(340px)` fazem a mesma coisa em três telas.
- **Ponto de quebra**: 600px, 640px e 700px ficam a 40 e 60px um do outro.

## 12. Fonte

- Peso 800 pedido no logo (`src/index.css:102`, `:245`) e itálico em `.rv-mes-vazio` (`:381`) sem que essas faces sejam empacotadas: o navegador entrega 700 e um itálico sintético.
- Não verificado: se o subconjunto latino do `@fontsource/inter` traz a feature `ss01` pedida em `src/index.css:187` e `:636`.

## 13. Profundidade contraditória

Medido no app: `.modal` renderiza **sem sombra**, enquanto `.confirmacao-caixa`, o calendário, o toast e o painel de ajuda usam `--shadow-lg`. O elemento que mais flutua é o único sem sombra.

## 14. Ambiente

A worktree precisa de `fs.allow` para servir a fonte, porque `node_modules` é um link para o checkout principal. Sem isso o Vite responde 403 e a interface cai na fonte do sistema, o que falseia qualquer medição de layout. Resolvido nesta sessão com `vite.live.config.mjs` (arquivo local, não versionado). No checkout principal o problema não existe.

## Ordem sugerida de ataque no redesign

1. Tokens que faltam (`-rgb` de status, cores de texto de status, azul de informação, overlay) e remoção do CSS morto.
2. Estados ausentes: desabilitado, foco unificado, linha selecionada.
3. Cascata: resolver o bloco final do `index.css` para que o declarado seja o que renderiza.
4. Extrair as caixas inline repetidas para classes e aplicar tabular nos 29 KPIs.
5. Padronizar escala: espaçamento, raio de pílula, largura de modal, pontos de quebra.
6. Unificar estado vazio e dar regra ao `.table-wrapper`.

Atenção ao mexer em texto de tela: rótulos e mensagens estão travados por teste (`src/pages/*.test.js`, `src/App.test.js`). Mudança de texto exige atualizar o teste no mesmo commit.
