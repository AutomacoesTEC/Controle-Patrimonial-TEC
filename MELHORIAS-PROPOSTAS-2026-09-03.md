# Melhorias propostas para o CP-TEC, 03/09/2026

Levantamento feito por leitura do código (não por teste no navegador) com dois
olhares: engenharia de dados aplicada ao IRPF/IRRF e desenho de interface.
Cada item traz a evidência no código, o que muda para quem usa, e o critério de
pronto. Nada aqui foi construído. A ordem dentro de cada bloco é a ordem
sugerida de execução. Antes de iniciar qualquer item de mérito fiscal, reler
`AUDITORIA/ESTUDO-VARIACAO-PATRIMONIAL-E-SALDOS-COMPENSAVEIS.md`.

Legenda de prioridade: P1 protege dado ou decisão fiscal; P2 evita erro de
leitura ou retrabalho; P3 acabamento.

## A. Dados e cálculo (engenharia aplicada ao IRPF/IRRF)

### A1. Versão de esquema do estado persistido, com migração — CONCLUÍDO (P1)

Commit `bdb6203`, 03/09/2026. `src/store/migracoes.js` (`VERSAO_ESQUEMA_ATUAL`,
`migrarEstadoPersistido`), campo `versaoEsquema` na raiz e em cada snapshot de
`historico[ano]` (`src/store/reducer.js`), fixtures reais de perfil em
`src/store/__fixtures__/` (versão 1 e atual, gerados a partir da importação do
AJU-01). A migração só preenche campo AUSENTE (nunca sobrescreve valor
existente), é idempotente por construção, e nunca rebaixa um estado de versão
maior que a do app. Validado por mim (leitura do diff e do módulo inteiro,
independente da suíte): `demonstrativos.js`/`consultaPeriodo.js`/
`resumoDeclaracao.js` ficaram intocados neste commit. 872/872 testes, build
limpo.

### A2. Backup e restauração do perfil em arquivo — CONCLUÍDO (P1)

Commit `cf08e18`, 03/09/2026. `src/store/backupPerfil.js` (formato
`.cptec.json`, hash SHA-256 do envelope inteiro menos o próprio hash,
serialização canônica para o hash não depender de ordem de chave),
`src/utils/baixarArquivo.js` (Blob + âncora, funciona nos dois modos porque o
app desktop é pywebview sem ponte de IPC, não Electron — achado do
levantamento, corrige a suposição original deste item). Restaurar cria
perfil NOVO por padrão; sobrescrever exige `substituirPerfilId` explícito e
passa pelo `ConfirmacaoModal`. Perfil protegido exporta cifrado com a chave
já existente (`src/utils/crypto.js`, PBKDF2 210k + AES-GCM, pré-existente);
senha e chave derivada nunca entram no arquivo, só o salt (já público no
registro do perfil). Validado por mim: senha/chave ausentes do arquivo,
ciphertext corrompido é pego pelo hash antes de pedir senha, versão de
esquema futura é recusada, e os 55 testes de `backupPerfil.test.js` cobrem
ida e volta completa (perfil comum e protegido) com demonstrativo idêntico.
872/872 testes, build limpo.

Pendente deste item: backup automático periódico no app desktop (a proposta
original citava Electron; como o app é pywebview, o mecanismo seria outro —
não desenhado ainda).

### A3. Proveniência por registro, não só por ano (P1)

Evidência: a origem fica no ano (`importFormato`, `origem` do snapshot) e,
para Renda Variável, em arrays separados (`...Oficial` e `...Manual`). Bens,
dívidas, rendimentos e pagamentos não dizem se vieram do `.DBK`, do PDF ou
foram digitados. Quando a pessoa corrige um bem importado, some a informação
de qual era o valor declarado.

Proposta:
- Todo registro ganha `origem: 'dbk' | 'pdf' | 'manual'` e, quando importado,
  `fonte: { registro, linha }` apontando para o registro do `.DBK`
  (`src/irpf/leitorRegistrosDbk.js` já sabe a posição).
- Registro importado e depois editado guarda `valorDeclarado` (cópia do
  original no momento da primeira edição) e mostra na tela um selo "editado"
  com tooltip do valor original.
- Badge "Manual" já existe na tabela de RV; reaproveitar o mesmo componente.

Pronto quando: em qualquer tabela dá para filtrar "só o que eu digitei" e
"só o que veio da declaração", e a exportação `.xlsx` traz a coluna Origem.

### A4. Trilha de alterações: completar o que já existe (P2)

Evidência: já existe `state.alteracoes` e a tela "Histórico de Alterações"
(`src/pages/HistoricoPage.jsx`, filtro por data real da alteração). Antes de
propor qualquer coisa, ler o reducer para ver quais ações alimentam a lista e
com que detalhe (se guarda valor anterior e novo por campo, ou só "editou").

Proposta, condicionada a esse levantamento:
- Garantir cobertura de TODAS as ações que mudam dado fiscal, inclusive as
  novas de 03/09 (`ADD_EM_ANO`, RV manual, `ADD_BEM` com id pronto).
- Entrada com valor anterior e novo por campo, quando ainda não houver.
- Exportação do histórico junto com o `.xlsx` do relatório.
- Cap de tamanho com compactação das mais antigas, para não estourar o
  `localStorage`.

Pronto quando: um teste percorre a lista de `case` do reducer e falha se uma
ação que altera coleção fiscal não gera entrada no histórico.

### A5. Dinheiro em centavos inteiros, ou arredondamento nas fronteiras — CONCLUÍDO (P1)

Implementada a alternativa menos invasiva: helper único
`arredondarCentavos(x)` em `src/utils/formatters.js`, aplicado aos saldos que
movimentações gravam no estado e aos totais expostos por
`fecharDemonstrativo`. O fixture reproduziu `0.1 + 0.2` tanto no saldo do bem
quanto no fechamento; 25 sequências determinísticas de 200 valores validam a
soma contra centavos inteiros. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-20-fronteira-centavos/`.

Permanece como evolução de longo prazo guardar centavos inteiros no estado,
com migração via A1. A fronteira atual remove o resíduo observável sem impor
essa migração aos perfis existentes.

### A6. Conferência de continuidade entre anos — CONCLUÍDO (P1)

`src/store/continuidade.js` compara o fechamento de bens, dívidas e seus
equivalentes rurais com a abertura do ano seguinte. O casamento prioriza
documento/identificador e usa descrição semelhante somente dentro do mesmo
código; o resultado apenas aponta, nunca corrige saldo. Detecta saldo
divergente, item que sumiu com saldo e item que apareceu trazendo saldo.

O Dashboard mostra o card "Continuidade com o ano anterior", selo verde quando
fecha e lista expansível quando há divergências. Fixture sintético confirmou 0
no par coerente e exatamente 3 falhas plantadas; o perfil AJU-01 2025–2026 foi
verificado no navegador. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-22-continuidade-anos/`.

### A7. Painel de IRRF por fonte e por beneficiário (P2)

Evidência: `irrf` existe por rendimento, `irrfVenda` na movimentação de venda,
IRRF de operações comuns e day-trade na ficha mensal de RV, e o total só
aparece somado em `totalRendimentos`. Não há visão consolidada "quanto de
imposto foi retido em 2025, por quem, para quem" nem cruzamento com o imposto
devido e a restituição do resumo (`src/store/resumoDeclaracao.js`).

Proposta:
- Tela ou card "IRRF do ano": tabela fonte pagadora × beneficiário × tipo
  (tributável PJ, carnê-leão, exclusivo, RV comuns, RV day-trade, ganho de
  capital), com o total batendo com o campo de imposto retido do resumo
  importado. Divergência entre os dois vira aviso discreto (mesmo componente
  `Ajuda` com `tom="ressalva"`).
- Alerta "retenção abaixo do esperado": para rendimento tributável PJ
  mensal, comparar o IRRF informado com o calculado pela tabela progressiva
  mensal do ano (Lei 15.270/2025 para 2026, com o redutor sobre o bruto, ver
  memória `irpf-2026-redutor-base-bruta`), respeitando dependentes e
  previdência informados. Só sinalizar, nunca corrigir.
- Respeitar a seção 3 do estudo: IRRF não é origem de recurso; o painel é de
  conferência, não entra no Saldo de Caixa.

Pronto quando: para o `.DBK` real do perfil PAULO ROBERTO o total do painel
é igual ao imposto retido do resumo, e um fixture com retenção a menor
plantada dispara o alerta.

### A8. Classificação assistida das sobras do Saldo de Caixa — PARCIAL (P2)

Evidência: o Saldo de Caixa final é "o número de validação", mas a tela só
mostra o valor. A seção 2 do estudo lista as origens que justificam variação
(empréstimo, restituição recebida, doação recebida, resgate). Hoje a pessoa
precisa lembrar de checar cada uma.

Proposta:
- Abaixo do Saldo de Caixa, um checklist gerado a partir do estado: "Há
  dívida nova sem contrapartida em bem?", "Há restituição de IRPF recebida
  neste ano?" (rendimento isento do código correspondente), "Há resgate de
  aplicação sem rendimento informado?" (`aplicacoesResgatadasSemRendimento`
  já existe), "Há bem alienado sem valor de venda?"
  (`bensAlienadosSemValorDeVenda` já existe). Cada linha diz o valor que
  explicaria e leva para a tela certa.
- Tolerância explícita e configurável por perfil (por exemplo 0,5% do
  patrimônio ou valor fixo) para o selo "fecha" do demonstrativo.

Pronto quando: um fixture com restituição recebida e sem lançar mostra a
linha do checklist com o valor exato da diferença.

Checklist concluído na rodada 23. `src/store/classificacaoSaldo.js` reúne as
perguntas de dívida nova sem contrapartida em bem, restituição anterior ainda
sem código 25, alienação sem preço e aplicação resgatada sem rendimento. O
Dashboard exibe valor e atalho para a tela correspondente sem mudar o Saldo de
Caixa. Fixture e navegador confirmaram a restituição de R$ 2.032,33; evidência
em `AUDITORIA/RODADAS/2026-09-04-23-checklist-saldo/`.

Pendente em rodada própria: tolerância explícita e configurável por perfil
para o selo "fecha".

### A9. Importação mais leve e separada do resto do app — CONCLUÍDO (P2)

Evidência: `dist/assets` tem `index` com 851 KB, `pdf` com 431 KB e o worker
do pdfjs com 1,27 MB. `src/irpf/layoutArquivosIrpf2026.js` tem 33 mil linhas
e `layoutDbk2026.js` 13 mil. As páginas já são `lazy` em `App.jsx`, mas os
layouts entram no chunk principal se qualquer módulo compartilhado os importa.

Proposta:
- Confirmar com `npx vite build --mode analyze` (ou `rollup-plugin-visualizer`)
  quem puxa os layouts para o chunk `index`.
- Layouts e parsers só por `import()` dentro de `ImportPage` e do
  `RevisaoImportacaoModal`.
- Fixar `manualChunks` para `recharts`, `xlsx` e `pdfjs`.

Pronto quando: o chunk inicial cai abaixo de 400 KB e a tela de perfis abre
sem carregar pdfjs.

Concluído na rodada 24. Os imports estáticos de `importParsers` e
`leitorRegistrosDbk` na tela de perfis passaram para o handler que recebe o
arquivo. O entry caiu de 837.798 para 235.097 bytes (−71,9%); seu fechamento
estático caiu para 326.349 bytes. O navegador confirmou parser/layout ausentes
na abertura e requisitados após escolher arquivo, com PDF chegando à revisão.

Não foi necessário fixar `manualChunks`: as fronteiras lazy/dinâmicas já
produzem chunks separados para Dashboard/Recharts, `exportXlsx`, pdfjs,
parser e layout. Configurar nomes manualmente não reduziria a carga inicial e
seria uma segunda mudança sem ganho demonstrado. Evidência em
`AUDITORIA/RODADAS/2026-09-04-24-parser-sob-demanda/`.

### A10. Suíte: golden files do demonstrativo por fixture — CONCLUÍDO (P2)

O perfil canônico produzido pela importação da AJU-01 agora tem
`demonstrativo-aju01.golden.json`, com a saída integral do motor usado pelo
Dashboard no ano de 2025, no primeiro semestre e no período 2025–2026. O teste
normal apenas compara; regravar exige `UPDATE_GOLDEN=1` explícito.

A prova adversarial alterou R$ 0,01 igualmente nos perfis v1 e atual: os 875
testes anteriores passaram, enquanto o novo golden mostrou diff legível em
cinco totais derivados. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-21-golden-demonstrativo/`. Novos fixtures
canônicos devem entrar na mesma tabela de casos quando forem adicionados ao
repositório.

### A11. Persistência em disco no app desktop (P2, corrigido em 03/09)

Evidência corrigida pelo levantamento do backup (A2): o app desktop NÃO é
Electron, é pywebview (WebView2/Edge dirigido por Python, ver
`build-windows.ps1` e `main.py`) e não tem ponte de IPC nenhuma hoje — é por
isso que A2 saiu só com API de navegador (Blob + âncora), que funciona nos
dois modos sem depender dessa ponte. `DataContext` continua gravando só no
`localStorage` do WebView2 (mesmo limite prático de alguns MB, apagável pelo
sistema).

Proposta, revista: criar uma ponte Python-JavaScript no pywebview
(`window.expose` ou equivalente) para o app escrever em
`%APPDATA%/ControlePatrimonial/perfis/<id>.json` com escrita atômica; o
`localStorage` vira só cache. Depende de A1 e A2 (prontos). Sem essa ponte,
a exportação/restauração manual de A2 já é o caminho de proteção disponível
hoje no desktop.

## B. Interface e desenho

Base: `DESIGN.md` (paleta Ardósia, Inter, acento contido, sem travessão, sem
emoji). Tudo abaixo respeita esse sistema; nada muda paleta.

### B1. Fonte auto-hospedada, tabular e coerente com o app offline — CONCLUÍDO (P1)

Evidência: `src/index.css` linha 1 importa a Inter do Google Fonts. No Electron
sem internet, ou em rede corporativa que bloqueia o domínio, o app cai na
fonte do sistema e as tabelas mudam de largura. `tabular-nums` aparece em 11
regras, mas não é global para colunas de valor.

Proposta:
- Colocar os `.woff2` da Inter (400, 500, 600, 700) em `public/fonts/` com
  `@font-face` e `font-display: swap`. Remover o `@import` externo.
- Regra global `.currency, td.numero, .stat-value { font-variant-numeric:
  tabular-nums; font-feature-settings: "tnum", "ss01" }` (o `ss01` da Inter
  deixa os dígitos mais abertos, útil em tabela densa).
- Decisão tomada em 03/09/2026: a usuária avaliou IBM Plex Sans, Source
  Sans 3, Public Sans e Atkinson Hyperlegible Next numa prova visual e
  escolheu MANTER a Inter. Não reabrir; o item se limita a auto-hospedar a
  Inter e aplicar os dígitos tabulares.

Pronto quando: o app abre com a mesma fonte com a rede desligada e todas as
colunas de valor alinham dígito sobre dígito.

Concluído em 04/09/2026. A Inter 400/500/600/700 passou a ser empacotada por
`@fontsource/inter`, o import externo foi removido e a regra comum de dígitos
foi aplicada. No fixture com os domínios do Google bloqueados, as requisições
externas caíram de 1 para 0, as faces Inter disponíveis passaram de 0 para 4 e
os três seletores previstos passaram a `tabular-nums`, sem alterar a largura
de controle de 560 px. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-25-fonte-offline/`; suíte em 885/885.

### B2. Dashboard: um número herói e o resto em segundo plano — CONCLUÍDO (P1)

Evidência: `src/pages/Dashboard.jsx` tem 1.044 linhas e uns dez cards no
mesmo nível visual (período, variação, rendimentos, ganhos, pagamentos,
saldos que atravessam, três gráficos, avisos). O número que decide tudo, o
Saldo de Caixa, está no fim do demonstrativo, com o mesmo peso das linhas.

Proposta:
- Faixa superior com o Saldo de Caixa em destaque (tamanho 28 a 32 px, peso
  700, tabular), selo de estado com três leituras: fecha, sobra a explicar,
  falta a explicar; e uma frase de uma linha dizendo o que o valor significa.
- Demonstrativo na coluna principal, gráficos numa coluna lateral ou numa aba
  "Gráficos", recolhidos por padrão. A distribuição por categoria e a
  evolução do patrimônio são leitura de apoio, não de decisão.
- Avisos (fichas não lidas, importação parcial, pendências) num único bloco
  no topo, não espalhados.

Primeira parte concluída em 04/09/2026: a faixa superior repete o Saldo de
Caixa já calculado, traz as três leituras textuais e fica inteira no primeiro
viewport de 1366 × 768. No perfil AJU-01, o valor final antes aparecia apenas
em `top=2186`; a faixa passou a aparecer entre `top=298` e `bottom=387`, sem
rolagem, com o mesmo `-R$ 51.787,27`. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-26-saldo-heroi/`.

Segunda parte concluída em 04/09/2026: os três gráficos foram agrupados em
`Gráficos de apoio`, recolhido por padrão. A ocupação inicial caiu de 1.088
para 54 px e os gráficos expostos de 3 para 0; uma abertura restaura os três
com títulos idênticos. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-27-graficos-recolhidos/`.

Terceira parte concluída em 04/09/2026: três avisos plantados que ocupavam
duas regiões persistentes passaram a um único bloco no topo, entre 298 e 367
px do primeiro viewport, sem perder nenhum título; a janela obrigatória foi
preservada. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-28-avisos-topo/`.

Pronto quando: a pessoa abre o Dashboard e em três segundos sabe se a
declaração fecha, sem rolar.

### B3. Tabelas densas: modo compacto, zebra e sinal além da cor (P2)

Evidência: `tbody td { padding: 12px 16px }` em todas as tabelas; Bens com 73
linhas ocupa mais de duas telas. Ganho e perda se distinguem só por cor
(`.positive`/`.negative`), o que falha para daltonismo e em impressão em preto
e branco.

Proposta:
- Alternância "Compacto" (8px 12px) por tabela, lembrada em `localStorage`
  junto com a largura das colunas (a memória
  `cp-tec-tabelas-redimensionaveis` registra que a largura hoje não persiste;
  resolver as duas no mesmo passo).
- Zebra sutil com `--bg-card-hover` a 40%.
- Valor negativo sempre com sinal explícito e, opcionalmente, com um traço
  fino à esquerda da célula (borda de 2px em `--accent-danger`), para que a
  leitura não dependa só da cor.

### B4. Impressão e PDF do demonstrativo — CONCLUÍDO (P1)

Evidência: zero `@media print` em `index.css`; `RelatorioPage.jsx` exporta só
`.xlsx`. O contador entrega o demonstrativo ao cliente e hoje não tem como
gerar um PDF limpo do app.

Proposta:
- Folha `@media print`: esconder sidebar, botões, gráficos interativos; forçar
  tema claro; cabeçalho com perfil, CPF mascarado, ano e período; rodapé com
  data de geração e versão do app; quebras de página por card.
- Botão "Imprimir demonstrativo" no Dashboard e no Relatório, que só chama
  `window.print()`.
- No desktop pywebview/WebView2, usar o mesmo `window.print()` para abrir o
  diálogo do host; salvar em PDF depende da opção instalada no Windows. Não
  trocar o runtime nem prometer exportação silenciosa sem uma ponte suportada
  pela arquitetura atual; `empacotamento.test.js` aplica esse limite.

Primeira parte concluída em 04/09/2026: a mídia `print` agora produz folha A4
clara, libera todo o fluxo vertical, protege a quebra interna de cards, oculta
36 controles e todo o cromo/gráficos, e inclui cabeçalho e rodapé com os
metadados previstos. No fixture, a altura deixou de ficar presa em 768 px e
passou a representar 2.588,5 px de conteúdo com overflow visível. Evidência
pareada em
`AUDITORIA/RODADAS/2026-09-04-29-folha-impressao/`.

Segunda parte concluída em 04/09/2026: o título e o ano do Relatório IRPF
voltaram a aparecer na mídia de impressão, enquanto seletor e botões continuam
ocultos. O cabeçalho redundante de tela do Dashboard permanece separado da
identificação própria criada na rodada anterior. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-30-cabecalho-relatorio-print/`.

Terceira parte concluída em 04/09/2026: Dashboard e Relatório IRPF ganharam
um botão `Imprimir demonstrativo`; o fixture interceptou uma chamada exata a
`window.print()` por clique em cada tela. No WebView2, essa ação entrega ao
diálogo do host a impressão e as opções de PDF disponíveis no Windows. O
runtime permanece pywebview/WebView2. Evidência pareada em
`AUDITORIA/RODADAS/2026-09-04-31-botoes-impressao/`.

### B5. Acessibilidade de teclado e leitores de tela (P2)

Evidência: 16 atributos `aria-` em todo `src/`; `Modal.jsx` não declara
`role="dialog"` nem `aria-modal`, sem armadilha de foco; `focus-visible` só
existe para a marca de ajuda.

Proposta:
- `Modal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no título,
  foco no primeiro campo ao abrir, foco de volta no gatilho ao fechar, ciclo
  de Tab dentro do modal.
- Estilo global `:focus-visible { outline: 2px solid var(--accent-primary);
  outline-offset: 2px }` para botões, links e células clicáveis do
  demonstrativo (`.demonstrativo-total-clicavel` hoje só responde a mouse).
- Toda `<input>` com `<label htmlFor>` ou `aria-label`; tabelas com
  `<caption>` visualmente oculta.

### B6. Estados vazios e primeiro uso por tela (P2)

Evidência: perfil novo abre vazio (comportamento correto, ver memória
`feedback-cp-tec-entrega-sem-declaracao`), mas cada tela vazia mostra só a
tabela sem linhas.

Proposta: componente `EstadoVazio` com uma frase de contexto e uma ação
principal por tela ("Importar declaração" ou "Cadastrar primeiro bem"),
reutilizado nas onze telas. Sem ilustração, sem emoji.

### B7. Barras em gradiente quente nos cards de estatística (P2)

Evidência: `index.css` linhas 161 a 164: `.stat-card.orange::after` usa
`--gradient-warm` (laranja para vermelho) e `.stat-card.purple::after` usa um
roxo para rosa fixo. Na tela de Ganhos de Capital o card "Ganho apurado no
ano" aparece com essa barra roxo-rosa no topo (captura
`tmp/f-verificacao/14-apos-fechar.png`). Contraria o "sem acento quente, sem
gradiente chamativo" do `DESIGN.md` e a regra de no máximo três pontos de
acento por tela.

Proposta: a barra do stat card passa a ser uma linha de 2px sólida no token
semântico do valor (`--accent-success` para ganho, `--accent-danger` para
perda, `--accent-primary` para neutro), sem gradiente. Remover
`--gradient-success`, `--gradient-warm` e a variante `purple`; manter só
`--gradient-primary` para logo e avatar. Registrar no `DESIGN.md`.

### B8. Nomenclatura em português na navegação (P3)

Evidência: item "Dashboard" na sidebar e nos títulos, com todo o resto em
português ("Bens e Direitos", "Ganhos de Capital").

Proposta: "Painel" ou "Demonstrativo" (o segundo descreve melhor o que a tela
é). Trocar em `Sidebar.jsx`, `Dashboard.jsx` e testes que procuram o texto.

### B9/B10. Laptop 1366x768 e tela cheia 2880: capturas feitas, 13 defeitos achados — CAPTURA CONCLUÍDA, CORREÇÃO PENDENTE (P1/P2)

Commit `a39ec6e`, 03/09/2026. `AUDITORIA/verificar-telas-no-app.py` destravado
(fechava o modal de avisos estruturais e travava; 30/33 conferências passam
agora, 3 falhas são de conteúdo de Renda Variável não atualizado, não da
trava). `AUDITORIA/capturar-telas-baseline.py` novo: 84 capturas em
`AUDITORIA/telas-2026-09/<tamanho>/<tema>/<tela>.png` (14 telas × 3 tamanhos
× 2 temas), mais `medicoes.json` com overflow medido por JavaScript.
Nenhuma correção de layout foi feita — é só o inventário, como planejado.

Achados, por ordem de gravidade (P1 = usuário perde acesso a dado ou não
consegue ler um valor; P2 = layout ruim mas contornável):

1. **P1 — barra de abas de Bens e Direitos estoura e rola a página inteira
   na horizontal**, 1366x768 e 1280x720. `div.tabs` em `BensPage.jsx`; sobra
   até 360 px. "Criptoativos" e "Fundos" ficam fora da vista.
2. **P1 — coluna AÇÕES cortada, botão Excluir pela metade**, em Bens,
   Titular e Dependentes, Rendimentos, Pagamentos, Atividade Rural, nos dois
   tamanhos menores. Rola dentro de `div.table-container`, mas sem nenhuma
   pista visual de que há rolagem.
3. **P1 — tabela mensal de Renda Variável estoura até 577 px**, escondendo
   "RESULTADO DAY-TRADE", "IMPOSTO A PAGAR", "IMPOSTO PAGO" e o botão
   "Mercados" de cada mês, sem indicação de rolagem. Era a suspeita já
   registrada abaixo antes da captura.
4. **P1 — valores monetários truncados sem reticências**, em Rendimentos,
   Pagamentos, Ganhos de Capital, 1280x720: número cortado no meio é o pior
   caso possível numa tela fiscal.
5. **P1 — navegação lateral esconde 3 itens em telas de 720/768 px de
   altura** ("Ganhos de Capital", "Renda Variável", "Histórico de
   Alterações" só aparecem após rolar a sidebar, sem indicador).
6. **P2 — contraste insuficiente no tema claro**: badges laranja (1,54:1),
   verde (1,78 a 1,92:1), azul (2,35 a 2,54:1), roxo e vermelho (~2,5:1), e
   valor positivo/negativo em `td.currency` (2,34 a 3,76:1) — todos abaixo
   do mínimo AA de 4,5:1 para texto pequeno. Tons 400/500 pensados só para o
   tema escuro, sem variante `[data-theme="light"]`.
7. **P2 — contraste marginal no tema escuro**: botão Excluir (3,76:1), texto
   secundário "PDF, página X, linha Y" (4,28:1).
8. **P2 — última coluna redimensionável fora da área visível**, em Titular,
   Rendimentos, Pagamentos, Renda Variável.
9. **P2 — grade de cards quebra 3+1**, deixando um card sozinho na segunda
   linha, em Rendimentos e Relatório IRPF.
10. **P2 — coluna BEM espremida em 4 linhas** em Ganhos de Capital, enquanto
    colunas de data ficam largas.
11. **P2 — conteúdo esticado em 2880x1620** sem `max-width`: rótulo e valor
    do Demonstrativo separados por ~1.700 px. Sem estouro nesse tamanho, é
    proporção e legibilidade, não corte.
12. **P3 — área morta sob tabelas curtas** (Doações, Dívidas, Despesas
    Gerais, Atividade Rural): 300 a 400 px de fundo vazio porque
    `table-container` mantém altura reservada.
13. **P3 — avisos do Dashboard soltos fora de card**, sem contêiner nem
    respiro antes do título do Demonstrativo.

Zero rolagem horizontal na página em si, zero card sobreposto, zero erro de
JavaScript nas 84 capturas.

Próximo passo: corrigir 1 a 5 antes de B2 (hierarquia do Dashboard) e B3
(tabelas), porque são os que escondem dado ou dígito, não só desalinham
layout. 6 e 7 alimentam diretamente o B7 (que já mexe nas cores dos
cards) e merecem entrar junto. 8 a 13 podem esperar a rodada de B3/B5.

## Ordem sugerida

Concluído em 03/09/2026: **B10/B9** (capturas, commit `a39ec6e`), **A1**
(versão de esquema, commit `bdb6203`), **A2** (backup e restauração, commit
`cf08e18`). Suíte em 872/872, build limpo, verificação adversarial em três
lentes (perda de dado, regressão de cálculo, perfil protegido) feita por
leitura direta do diff e dos módulos — nenhum achado.

Ordem do que falta:

1. Os cinco defeitos P1 do inventário de B9/B10 (abas que rolam a página
   inteira, coluna Ações cortada, tabela de RV que estoura, valor monetário
   truncado, itens da sidebar escondidos): corrigir antes de B2 e B3, porque
   escondem dado, não só desalinham.
2. B7 já reformulado (barra de gradiente quente) mais os achados 6 e 7 do
   inventário (contraste de badge e de botão Excluir), no mesmo passo.
3. A5 (centavos) e A10 (golden files): travam o cálculo antes de mexer nele.
4. A6 (continuidade entre anos) e A8 (checklist do Saldo de Caixa): maior
   valor fiscal por hora investida.
5. B1, B4, B2 (fonte, impressão, hierarquia do Dashboard) e os achados 8 a
   13 do inventário (coluna redimensionável, grade de cards, largura em
   2880, área morta, avisos soltos).
6. A3, A4, A7 (proveniência, trilha, painel de IRRF).
7. B3, B5, B6, B8, A9, A11.

Cada item nasce com teste de regressão e verificação no app real, e entra
num commit próprio com o trailer padrão do projeto.
