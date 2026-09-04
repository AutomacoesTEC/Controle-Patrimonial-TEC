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

### A1. Versão de esquema do estado persistido, com migração (P1)

Evidência: `src/store/reducer.js` `blankYear` ganhou campos novos em 03/09
(`rendaVariavelMensalManual`, `fiiFiagroMensalManual`) e nada registra a versão
do objeto gravado no `localStorage` por perfil (`src/App.jsx`,
`src/store/perfis.js`). Um perfil salvo por uma versão antiga do app é lido pela
nova sem nenhum passo de adaptação; hoje isso funciona porque o código usa
`|| []` em quase todo lugar, mas é sorte, não contrato.

Proposta:
- Campo `versaoEsquema` no objeto raiz do estado e em cada snapshot de
  `historico[ano]`.
- Módulo `src/store/migracoes.js` com uma função por salto de versão (1 para 2,
  2 para 3), aplicadas em cadeia na carga do perfil, antes de
  `SUBSTITUIR_ESTADO_PERSISTIDO`.
- Teste de regressão que carrega fixtures de estado antigo (gravar hoje um
  JSON real de perfil como fixture) e prova que a carga não perde nenhum
  campo.

Pronto quando: mudar a forma de um campo passa a exigir uma migração com
teste, e a suíte falha se `blankYear` mudar sem a versão subir.

### A2. Backup e restauração do perfil em arquivo (P1)

Evidência: o único caminho de saída é o `.xlsx` do relatório
(`src/utils/exportXlsx.js`), que não é reimportável. O dado vive só no
`localStorage` do navegador ou do Electron; limpar dados do site, trocar de
máquina ou reinstalar o app apaga anos de trabalho. A memória
`feedback-cp-tec-entrega-sem-declaracao` registra exatamente esse efeito
colateral (dado "sumindo" ou "aparecendo" conforme a origem da porta).

Proposta:
- "Exportar perfil (.cptec.json)" e "Restaurar perfil" na tela de perfis e no
  menu do perfil ativo. Conteúdo: estado inteiro, `versaoEsquema`, data, nome
  do perfil, e um hash simples do conteúdo para detectar arquivo corrompido.
- Perfil protegido por senha exporta cifrado com a mesma chave
  (`src/store/crypto.js` já existe).
- No Electron, oferecer pasta de backup automático a cada gravação (arquivo
  por data, mantendo os últimos N), escrito de forma atômica (gravar em
  temporário e renomear).

Pronto quando: exportar, apagar o perfil, restaurar e obter Dashboard
idêntico byte a byte (mesmo teste de baseline usado no relatório do item E).

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

### A5. Dinheiro em centavos inteiros, ou arredondamento nas fronteiras (P1)

Evidência: todo valor é `parseFloat` somado em ponto flutuante
(`src/store/demonstrativos.js`, `reducer.js` `REGISTRAR_MOVIMENTACAO_BEM`,
`situacao_atual` recalculado por soma e subtração). Há apenas dez pontos com
`toFixed(2)` ou `Math.round(x*100)` na pasta `store`. Com 73 bens e dezenas de
movimentações, o Saldo de Caixa pode sair com centavos fantasmas (0,01 ou
0,02), e o critério "perto de zero" do demonstrativo fica sujo.

Proposta (a menos invasiva primeiro):
- Helper único `arredondarCentavos(x)` em `src/utils/formatters.js`, aplicado
  em todo resultado de soma que vira estado (`situacao_atual`, saldos de
  dívida) e em todo total exibido (`fecharDemonstrativo`).
- Teste de propriedade: somar N valores aleatórios com duas casas e conferir
  que o resultado tem no máximo duas casas.
- Longo prazo: guardar centavos inteiros no estado (migração via A1).

Pronto quando: nenhum total na tela ou no `.xlsx` tem terceira casa decimal e a
conciliação de referência (planilha da usuária) continua batendo.

### A6. Conferência de continuidade entre anos (P1, alto valor fiscal)

Evidência: `ROLLOVER_ANO` copia `situacao_atual` para `situacao_anterior` do
ano seguinte. Mas quando a pessoa importa dois anos consecutivos (dois `.DBK`),
nada compara o "31/12 do ano anterior" declarado no ano N+1 com o "31/12" do
ano N que o app tem. Essa é exatamente a batida que a Receita faz na malha de
variação patrimonial.

Proposta:
- Função pura `conferirContinuidade(historico, anoN)` em `src/store/`:
  para cada bem e dívida casado entre os dois anos (por chave: grupo, código,
  CNPJ ou identificação extraída da discriminação, com fallback por
  similaridade de texto), comparar `situacao_atual` de N com
  `situacao_anterior` de N+1; listar divergências, bens que sumiram sem baixa
  e bens que apareceram sem aquisição.
- Card no Dashboard "Continuidade com o ano anterior" com contagem e link para
  a lista; selo verde quando fecha.
- Regras do estudo: só saldo compensável atravessa ano; bem e dívida
  atravessam por posição em 31/12; ganho de capital não atravessa.

Pronto quando: fixture com dois anos sintéticos (um coerente, outro com três
divergências plantadas) passa no teste, e o Dashboard mostra as três.

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

### A8. Classificação assistida das sobras do Saldo de Caixa (P2)

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

### A9. Importação mais leve e separada do resto do app (P2)

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

### A10. Suíte: golden files do demonstrativo por fixture (P2)

Evidência: 804 testes, muito bons em unidade. A conciliação inteira contra a
planilha da usuária existe para os arquivos de referência. Vale generalizar.

Proposta:
- Para cada fixture (`output/pdf/AJU-01...`, `.DBK` do perfil real quando
  disponível localmente, sintéticos da `MATRIZ-CASOS-SINTETICOS`), um arquivo
  `*.golden.json` com o `demonstrativoConciliacao` completo por período. O
  teste importa, calcula e compara. Atualização do golden só por comando
  explícito (`UPDATE_GOLDEN=1`), nunca automática.

Pronto quando: qualquer mudança em `demonstrativos.js` que altere um centavo
em qualquer fixture falha a suíte com diff legível.

### A11. Persistência em disco no Electron (P2)

Evidência: `build-app/` e `build-windows.ps1` existem; o app desktop continua
gravando no `localStorage` do Chromium embutido (limite prático de alguns MB e
apagável pelo sistema).

Proposta: no Electron, `DataContext` grava por IPC em
`%APPDATA%/ControlePatrimonial/perfis/<id>.json` com escrita atômica; o
`localStorage` vira só cache. Depende de A1 e A2.

## B. Interface e desenho

Base: `DESIGN.md` (paleta Ardósia, Inter, acento contido, sem travessão, sem
emoji). Tudo abaixo respeita esse sistema; nada muda paleta.

### B1. Fonte auto-hospedada, tabular e coerente com o app offline (P1)

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

### B2. Dashboard: um número herói e o resto em segundo plano (P1)

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

### B4. Impressão e PDF do demonstrativo (P1)

Evidência: zero `@media print` em `index.css`; `RelatorioPage.jsx` exporta só
`.xlsx`. O contador entrega o demonstrativo ao cliente e hoje não tem como
gerar um PDF limpo do app.

Proposta:
- Folha `@media print`: esconder sidebar, botões, gráficos interativos; forçar
  tema claro; cabeçalho com perfil, CPF mascarado, ano e período; rodapé com
  data de geração e versão do app; quebras de página por card.
- Botão "Imprimir demonstrativo" no Dashboard e no Relatório, que só chama
  `window.print()`.
- No Electron, "Salvar em PDF" via `webContents.printToPDF`.

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

### B9. Laptop 1366x768 e tela cheia 2880 (P3)

Evidência: um único `@media (max-width: 700px)`; sidebar fixa de 260 px; grids
`auto-fit` cuidam do resto. A usuária trabalha com dois monitores (memória
`dell-7472-dois-monitores`), então os dois extremos importam.

Proposta: sessão de verificação com Playwright em 1366x768, 1920x1080 a 150%
(equivale a 1280x720 CSS) e 2880x1620; capturar as onze telas nos dois temas;
corrigir o que quebrar (provável: cards de estatística do Dashboard em 1280
de largura útil e o quadro de 12 meses de RV).

### B10. Auditoria visual com capturas (primeiro passo de B)

Este documento foi escrito lendo o código. Antes de executar B2 e B3, rodar a
verificação de B9 e anexar as capturas em `AUDITORIA/telas-2026-09/`, para
que as decisões de hierarquia sejam tomadas sobre a tela real, com a
declaração de referência importada. O `AUDITORIA/verificar-telas-no-app.py`
precisa antes aprender a fechar o modal de avisos estruturais (registrado no
handoff de 03/09).

## Ordem sugerida

1. B10 e B9 (capturas e verificação de resolução): meio dia, sem risco.
2. A1 e A2 (versão de esquema e backup): protegem tudo o que vem depois.
3. A5 (centavos) e A10 (golden files): travam o cálculo antes de mexer nele.
4. A6 (continuidade entre anos) e A8 (checklist do Saldo de Caixa): maior
   valor fiscal por hora investida.
5. B1, B4, B2 (fonte, impressão, hierarquia do Dashboard).
6. A3, A4, A7 (proveniência, trilha, painel de IRRF).
7. B3, B5, B6, B7, B8, A9, A11.

Cada item deve nascer com teste de regressão e verificação no app real, e
entrar num commit próprio com o trailer padrão do projeto.
