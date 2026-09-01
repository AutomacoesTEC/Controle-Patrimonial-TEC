# Handoff da sessão de 31/08/2026: das telas ao build, e um incidente no PGD

Escrito a pedido, para encerrar a sessão com tudo registrado. Duas partes: o
INCIDENTE no programa da Receita, que é o mais urgente de ler, e o registro do
trabalho.

## 1. INCIDENTE: o IRPF 2026 parou de abrir, por minha causa. Já resolvido.

### O que aconteceu

Ao criar a declaração sintética RUR-01, editei
`aplicacao/dados/iddeclaracoes.xml` À MÃO, com um script Python, para
acrescentar o item da declaração nova. O programa passou a não abrir.

### A causa, lida no log e não suposta

`IRPF2026.log`:

```
serpro.ppgd.persistenciagenerica.HashInvalidoException:
Hash lido [14A5EB0522C7B5D7D60F71378E2C680DBA7EF652] não bate com hash
calculado [D05BA109226D8393CA5FEFDDE4EA9077B8588892].
Arquivo: .../aplicacao/dados/iddeclaracoes.xml
    at RepositorioXMLDefault.validarHashXML(RepositorioXMLDefault.java:258)
    at RepositorioXML.carregaIdDeclaracoes(RepositorioXML.java:108)
    at IRPFPGD.main(IRPFPGD.java:90)
```

Cada XML do PGD tem um `.conf` ao lado com um hash de integridade do conteúdo.
Editar o XML sem regravar pela API do próprio programa invalida o par, e a
verificação roda na ABERTURA: o programa morre antes da janela aparecer, com
NullPointerException em cima, porque a rotina que mostraria o erro recebe
mensagem nula.

### O que fiz para resolver

1. Restaurei `iddeclaracoes.xml` e `iddeclaracoes.conf` do backup que tinha
   feito ANTES de qualquer alteração, em
   `output/backup-irpf-sintetico/2026-08-31-rur01-antes/`.
2. Tirei a pasta da declaração nova (`dados/77700011109/`) de dentro do
   programa, guardada em
   `output/backup-irpf-sintetico/2026-08-31-rur01-declaracao/`.
3. Guardei a versão quebrada do cadastro, para exame, em
   `output/backup-irpf-sintetico/2026-08-31-rur01-DEPOIS-quebrado.xml`.
4. Provei que voltou: rodando pelo JRE do próprio programa,
   `RepositorioXMLDefault.validarHashXML` devolve OK no arquivo restaurado, e
   `RepositorioXMLIRPF.getListaIdDeclaracoes()`, que é EXATAMENTE o caminho da
   pilha do erro, carrega o cadastro sem exceção.

Estado final: 13 declarações, as mesmas de antes, nenhuma tocada. A RUR-01
não está mais registrada.

### A lição, para nunca repetir

- Os XML do PGD NÃO podem ser editados por fora. Qualquer gravação tem que
  passar por `RepositorioXMLDefault.salvar(...)`, que regrava o `.conf` junto.
  Foi assim que a própria declaração RUR-01 foi criada, e ela ficou íntegra: o
  que quebrou foi só o cadastro, que editei com Python.
- Registrar uma declaração nova em `iddeclaracoes.xml` precisa ser feito pela
  API (carregar a `ColecaoIdDeclaracao`, acrescentar o `IdentificadorDeclaracao`
  e salvar pelo repositório), nunca por substituição de texto.
- O script `registrar-sai-01-em-iddeclaracoes.py`, desta mesma pasta, tem o
  mesmo defeito de origem e provavelmente causou o mesmo estrago na época.
  NÃO usar como modelo.

### O que fica pendente da RUR-01

A declaração está preenchida e guardada fora do programa, com o par que
interessa ao teste:

```
<item estrangeiro="0" indice="00001" ni="121.314.151-68" nome="RUR PARTICIPANTE BRASILEIRO"/>
<item estrangeiro="1" indice="00002" ni=""               nome="RUR PARTICIPANTE ESTRANGEIRO"/>
```

Para retomar com segurança: reescrever a etapa de registro usando a API do
repositório, restaurar a pasta da declaração, abrir o programa, conferir a
ficha e exportar o PDF para
`output/pdf/RUR-01-PARTICIPANTE-ESTRANGEIRO-IRPF-2026.pdf`. Só então dá para
fechar a extração do participante estrangeiro com teste.

## 2. O que foi entregue nesta sessão

Vinte e três commits, de `7cd9764` a `b494adf`. Suíte final: 657 aprovados, 0
pulados, 0 falhas. Build de produção limpo. Working tree limpo.

### Higiene do repositório (P0)

Nada estava commitado desde 24/08/2026. Saíram 159 binários de build do
versionamento; entraram o dossiê da auditoria, os gabaritos sintéticos, os
scripts e todo o código. O Electron foi abandonado no `package.json` e o xlsx
passou a vir do tarball da SheetJS, fechando o CVE do SEC-001.

Dado pessoal de terceiros (nome, CPF e e-mail de adquirentes, participantes e
dependentes) saiu dos testes para um manifesto local, fora do repositório.

### Telas ligadas ao que a extração já entregava

- Relatório IRPF: o RESUMO inteiro, sete blocos, 61 campos, com as conferências
  de soma. Antes eram cinco números.
- Ganho de capital: demonstrativo por operação, com a cadeia de reduções do
  imóvel (Lei 7.713/1988 e Lei 11.196/2005), cálculo do imposto, parcelas com
  imposto proporcional, faixas de tributação e consolidação do bem.
- Espólio e saída definitiva: tela própria por modalidade, com partilha,
  herdeiros, inventariante, procurador e condição de não residente.
- Pagamentos: titularidade (titular, dependente, alimentando).
- Bens: número do item, bem de dependente e bem no exterior.
- Dependentes: relação de dependência pela tabela oficial, raça/cor, contato.
- Atividade rural: opção de apuração, nome da espécie, participante estrangeiro.
- Renda variável: consolidação do mês, com as duas retenções compensáveis.
- Rastreabilidade: cada item mostra a página e a linha de onde veio.

### Defeitos achados e corrigidos no caminho

- `faixasTributacao`, `custosAquisicao` e `ampliacoesReformas` eram lidos e
  DESCARTADOS na montagem final do ganho de capital. O gc-08 constava como
  resolvido no mapa e o retorno real vinha vazio.
- `lendoHerdeiros`, estado de rascunho do parser, vazava para o bem e daí para
  o estado, o localStorage e o histórico.
- Rendimentos isentos e exclusivos não carregavam origem no documento.
- O separador "·" aparecia em quatro textos de interface, contra a convenção.
- O build podia sair da cópia antiga do projeto, de 18/08/2026, versão 0.0.0.

### Build Windows

Contratos do empacotamento travados por teste (versão, executável, pasta do
Vite, ícone, privilégio, persistência fora do `_MEIPASS`), etapa de assinatura
digital no `build-windows.ps1` e guarda contra build da cópia antiga. A
importação de PDF foi conferida no BUILD DE PRODUÇÃO, não só no dev.

### Continua aberto

- Exportar o PDF da RUR-01, depois de refazer o registro pela API.
- Gerar o instalador no Windows, com ou sem certificado de assinatura de código.
- Decidir sobre os dois handoffs antigos que citam nome de titular no histórico
  do git.
- Fila de campos extraídos ainda sem tela, por peso fiscal: consolidação ANUAL
  da renda variável; `rendimentoIsento` e `rendimentoExclusivo` da consolidação
  do bem no ganho de capital; `codigo_impresso` dos rendimentos.

### Nota de ferramenta

O vitest deste projeto engole `console.log` e `console.error`, inclusive os do
arquivo de teste. Para depurar, grave em arquivo de dentro do teste.

## Ataque aos módulos de montagem (commit 6e8bd0b)

Depois do ataque às conferências (a02dc49), o mesmo tratamento nos nove
montadores: `blocosResumoDeclaracao`, `blocosEspolio`, `blocosSaida`,
`blocosOperacaoGanhoCapital`, `parcelasDaOperacao`, `faixasDaOperacao`,
`linhasConsolidacaoMes`, `linhasAnualRendaVariavel`, `linhasAnualFiiFiagro`.
Arquivo: `src/store/montagem.adversarial.test.js`.

Achado 1, de mérito fiscal. Quadro que não informa saldo a pagar nem imposto a
restituir produzia a linha "Saldo de imposto a pagar R$ 0,00". A tela afirmava
um resultado que a declaração não tem. Corrigido: o bloco de resultado exige
que ao menos um dos dois campos tenha sido informado.

Achado 2. Valor que chegasse como texto sumia em silêncio nos três módulos que
montam linha por linha, deixando o quadro exibido menor que o da declaração sem
aviso. Passaram a aceitar texto que seja número; texto que não é número segue
fora, para não pôr "R$ NaN" na tela. Defesa, não bug observado: o parser hoje
devolve número em todos esses campos.

Ambos provados por reversão. Suíte em 693 passando, 0 puladas, 0 falhas.

Aviso de método, para quem continuar: durante a prova por reversão eu usei
`git checkout` num arquivo para desfazer a reversão, e isso apagou junto a
correção ainda não commitada do mesmo arquivo. Reaplicada e conferida por
`grep`. Ao provar por reversão, guarde a cópia boa fora do git e restaure dela.

## Ponto de retomada (31/08/2026, 18h10)

Estado: HEAD limpo, suíte em 703 passando, `npx vite build` limpo.
Branch `fix/auditoria-2026-08-24`.

### Concluído nesta rodada

1. Ataque aos nove módulos de montagem. Dois defeitos corrigidos: quadro sem
   saldo e sem restituição produzia a linha inventada "Saldo de imposto a pagar
   R$ 0,00"; valor que chegasse como texto sumia em silêncio em três módulos.
   Provados por reversão.
2. Ganhos de Capital virou uma tela só: a tabela é o índice e o demonstrativo
   abre dentro da linha, fechado por padrão. A junção é por `id`, nunca pelo
   nome do bem (a declaração real tem dois FIAT UNO que só se distinguem pela
   placa, e a operação de participação societária chega sem nome).
   `ganhoCapitalJuncao.test.js`, 10 casos. Verificado no navegador com a
   declaração real importada pelo próprio fluxo do app: 13 asserções.
3. Limpeza de dado pessoal do repositório e de todo o histórico. Os valores
   esperados dos testes foram para `declaracoes-reais.local.json`, fora do
   repositório, pelo `esperaPessoal` que o arquivo já usava.

### Auditoria final de interface — CONCLUÍDA (01/09/2026, 02h05)

Pedido da usuária: nada estranho na interface. Workflow em segundo plano
(task `wdnr0snlo`, run `wf_49997bc2-536`) revisou as 29 telas React em 8
grupos paralelos contra as regras 8 (emoji/travessão/"·") e mais texto
quebrado em geral, com verificação adversarial de cada achado (17 agentes,
9 achados brutos, 9 confirmados `real=true`, 0 falsos positivos). Nenhuma
violação das regras 8 propriamente ditas (emoji/travessão/"·"/data errada)
foi encontrada — os achados foram todos de concordância gramatical e de
truncamento de texto sem indicação, que também tornam a interface estranha.

**Concordância número/verbal quebrada (plural fixo em substantivo irregular
ou verbo não flexionado), 6 achados do workflow + 4 achados extras pelo
mesmo padrão, achados por grep em busca de todo caso igual (regra 2: tratar
TODOS os casos, não só os amostrados):**
- `RevisaoImportacaoModal.jsx`: "1 itens" (linha 87), "1 fichas classificadas"
  (119), "ficha(s) exigem" sem o singular "exige" (127), "registro(s)
  preservados" sem o singular "preservado(s)" (78).
- `ReconciliacaoRetificadoraModal.jsx`: "1 rendimentos"/"1 pagamentos" (106).
- `DividasPage.jsx`, `BensPage.jsx`, `RelatorioPage.jsx`,
  `AtividadeRuralPage.jsx` (2x): mesmo "1 itens" fixo em cinco cabeçalhos de
  página/badge que o workflow não cobriu (arquivos revisados em lotes
  diferentes) — achados por `grep` do mesmo padrão em todo o `src/pages`.
- `PagamentosPage.jsx`, `RendimentosPage.jsx`, `ImportPage.jsx`: "registros"
  fixo (sem "(s)") em três cabeçalhos/mensagens de log, mesmo padrão.

**Truncamento de texto sem indicação nenhuma de corte (usuário via a frase
interrompida sem saber que faltava texto e sem como ver o valor completo),
3 achados do workflow + 6 achados extras pelo mesmo padrão:**
- `ReconciliacaoRetificadoraModal.jsx` (199, 248), `RendimentosPage.jsx`
  (189): achados pelo workflow.
- `Dashboard.jsx` (2x), `PagamentosPage.jsx` (2x), `DoacoesPage.jsx` (2x),
  `RelatorioPage.jsx`, `GanhosCapitalPage.jsx`, `AtividadeRuralPage.jsx`
  (2x), `BensPage.jsx`: mesmo padrão achado por `grep '.substring(0,'` em
  todo `src/pages` e `src/components`, comparado achado a achado contra o
  que já tinha `title=` e o que não tinha.
- **Corrigido com um helper novo**, `truncarComReticencias(texto, max)` em
  `src/utils/formatters.js`: corta e acrescenta "..." quando corta, sempre
  combinado com `title={textoCompleto}` no elemento que envolve, para o
  texto integral aparecer ao passar o mouse.
- **Fora do escopo, de propósito**: truncamento em `confirm()` de exclusão
  (`BensPage.jsx:95`, `AtividadeRuralPage.jsx:325/437`, `DividasPage.jsx:66`),
  numa frase de aviso já concatenada com `.join('; ')`
  (`GanhosCapitalPage.jsx:561`) e dentro de `<option>` de `<select>` nativo
  (`ReconciliacaoRetificadoraModal.jsx:214`) — contextos onde reticências/
  `title` não fazem sentido do mesmo jeito (diálogo nativo do navegador,
  mensagem já concatenada, option sem tooltip confiável entre navegadores).

**Verificação:** `npx vitest run` 735/735 (uma falha isolada num run é o
flake conhecido de fonte do pdfjs já documentado; rerun deu 735/735 limpo).
`npx vite build` limpo. `verificar-telas-no-app.py` contra o build de
produção: 33 de 33, sem erro de JavaScript.

### O que falta, em ordem

1. ~~Segunda passada de `filter-branch`~~ **CONCLUÍDA em 31/08/2026, 21h53,
   autorizada pela usuária.** A palavra `pantaninho`, em minúscula, estava em
   50 commits do histórico (contagem real por `git grep` árvore a árvore, não
   os 40 estimados aqui antes). Reescrita com `git filter-branch
   --tree-filter` substituindo por `imoveisMesmoCib` nas duas branches
   (`master` e `fix/auditoria-2026-08-24`), seguida de exclusão das refs de
   backup (`refs/original/*`) e `git gc --prune=now --aggressive` — sem isso a
   string continua recuperável no banco de objetos. Verificado por `git grep`
   objeto a objeto em toda a árvore acessível: zero ocorrências restantes.
   Suíte rodada de novo depois da reescrita: 733 passando, 0 falhas — sem
   regressão de conteúdo. Backup fresco antes de rodar, em
   `~/backups-cp-tec/cp-tec-antes-filterbranch2-2026-08-31.bundle` e
   `git-dir-antes-filterbranch2-2026-08-31/` (o backup anterior, de 17h31, era
   de ANTES dos últimos 4 commits do dia e não bastava mais).
2. ~~Citações de hash quebradas~~ **CONCLUÍDA junto com o item 1.** A segunda
   reescrita mudou de novo todos os hashes do repositório. Os dez hashes
   citados nos handoffs (`a02dc49`, `6e8bd0b`, `ad2a1b8`, `bc6a711`, `4ba2c5d`,
   `1fdcdf5`, `c149341`, `74d6bd1`, `87c1f7e` e, no `HANDOFF-2026-08-19.md`,
   `726c00c`) foram resolvidos consultando os bundles de backup de ANTES de
   cada reescrita (que preservam os hashes antigos intactos) e casando pela
   MENSAGEM do commit, que `filter-branch` nunca altera — nunca por
   suposição. As três faixas de commits citadas em texto ("vinte e três
   commits", "cinco commits", "oito commits") foram conferidas por contagem
   real na sequência nova e batem exatamente. Todas as citações trocadas para
   os hashes atuais; conferido que os dez hashes novos existem no repositório.
3. ~~Cinco PDFs de gabarito superados~~ **FECHADA em 31/08/2026, 22h10.** Não
   era decisão em aberto: o `.gitignore` já tem regra específica para cada um
   dos cinco (`output/pdf/*-PRE-*.pdf`, `*-33pag-*.pdf`, `*-41pag-*.pdf`,
   `*.microsoft-print-image-only-*.pdf`), conferido com `git check-ignore -v`
   arquivo por arquivo. Ficam de fora do versionamento (só locais, como prova
   de auditoria citada por SHA-256 em `OCORRENCIAS-PREENCHIMENTO-IRPF-2026.md`
   e `AUDITORIA-EXTRACAO-PDF-IRPF-2026.md`), e nenhum deles está commitado.
4. ~~Instalador Windows~~ **CONCLUÍDO em 01/09/2026, 00h20.** Decisão da
   usuária: gerar sem certificado de assinatura, aceitando o aviso de editor
   desconhecido do SmartScreen. Rodado `build-windows.ps1` de verdade (via
   interop WSL/PowerShell 7, a partir do caminho `\\wsl.localhost\...`, com
   `dist/` recém-gerado incluindo os fixes desta sessão): PyInstaller e Inno
   Setup concluíram sem erro, gerando `installer\ControlePatrimonial_Setup.exe`
   (13.649.575 bytes) e `dist-app\ControlePatrimonial\ControlePatrimonial.exe`
   (5.260.818 bytes). Teste de fumaça real: o executável empacotado foi aberto
   (PID 15400), ficou rodando os 6 segundos observados sem sair sozinho, e foi
   encerrado normalmente — não travou nem crashou na inicialização. Nota de
   ambiente: `powershell.exe` (Windows PowerShell 5.1) corrompe o caminho por
   causa do acento em "Eudúcio" (falta BOM UTF-8 no script), o que fez
   `Test-Path` mentir que o executável não existia; `pwsh.exe` (PowerShell 7)
   não tem esse problema — usar sempre PowerShell 7 quando o caminho tiver
   acento. `Start-Process -WorkingDirectory` também não aceita caminho UNC
   (usar sem esse parâmetro, ou `[System.Diagnostics.Process]::Start`).
   Instalador NÃO assinado, como decidido: quem instalar vai ver o aviso do
   Windows e precisa clicar em "Mais informações" → "Executar assim mesmo".
5. **Participante rural estrangeiro (RUR-01)**: pendente pela terceira vez, e
   por decisão explícita da usuária em 01/09/2026 (perguntado de novo depois
   do incidente registrado na seção 1 deste documento, que já quebrou o
   IRPF2026 duas vezes por intervenção programática): ELA MESMA vai preencher
   a declaração à mão na interface do programa da Receita quando tiver tempo.
   NÃO tentar de novo por script nem por automação de UI sem ela presente e
   sabendo. A declaração já preenchida está guardada fora do programa em
   `output/backup-irpf-sintetico/2026-08-31-rur01-declaracao/`, pronta para
   ela usar quando for a vez dela.

### Backup do repositório antes da reescrita

`~/backups-cp-tec/cp-tec-antes-da-limpeza-2026-08-31.bundle`,
`git-dir-antes-da-limpeza-2026-08-31.tar.gz` e `manifesto-antes.json`.
O HEAD anterior à reescrita era `f90994d`.


## Sessão de 31/08/2026, noite: das telas ao fluxo real

Estado: suíte em 730 passando, 0 falhas. `npx vite build` limpo.
`AUDITORIA/verificar-telas-no-app.py` em 32 asserções, todas verdes, contra o
app de PRODUÇÃO com as três declarações sintéticas importadas pelo próprio
fluxo. Cinco commits, de `b187b5a` a `a706ddc`, na `fix/auditoria-2026-08-24`.

### O achado que muda a leitura do resto

A declaração final de espólio e a de saída definitiva NÃO CONSEGUIAM ENTRAR
NO APP. O botão "Usar esta declaração" da revisão da importação nasce
desabilitado quando alguma ficha ficou em estado de erro, e o ESP-01 tinha
quatro fichas em erro, o SAI-01 duas. Todo o trabalho anterior nas telas de
espólio e de saída definitiva, com partilha, herdeiros, inventariante,
procurador e condição de não residente, estava inalcançável pelo fluxo real.

A suíte estava verde o tempo todo. O defeito só apareceu ao DIRIGIR o app.

Duas causas: as fichas de saída definitiva, de inventariante e de herdeiros
não constavam do mapa de "esta ficha tem dados", embora o parser as estruture
desde sempre; e as fichas de rendimentos isentos e de tributação exclusiva,
quando vazias, imprimem só "TOTAL 0,00", sem a expressão "Sem Informações"
que o detector de ficha vazia procurava. As duas corrigidas e provadas por
reversão. As três declarações entram agora sem nenhuma ficha em erro.

### O que passou a aparecer na tela

Levantamento novo, campo a campo, do que os parsers põem no estado contra o
que a camada de apresentação consome. O que estava desligado e agora está
ligado, em ordem de peso fiscal:

1. As cinco colunas da ficha de rendimentos de pessoa jurídica. Faltavam a
   contribuição previdenciária oficial, o 13º salário e o IRRF sobre o 13º.
   Cada uma com a sua nota: a previdência é dedução da base do ajuste, o 13º é
   tributação exclusiva e já está lançado à parte no código 01 da ficha de
   exclusivos. Um teste fixa que o 13º não pode ser somado ao tributável.
2. Ganho de capital: o IR na fonte da Lei nº 11.033/2004 e o IMPOSTO DEVIDO
   APÓS COMPENSAÇÃO, que é o que a pessoa de fato deve, mais a corretagem e o
   líquido das parcelas na alienação a prazo.
3. As PERGUNTAS IMPRESSAS da ficha de ganho de capital, com destaque para
   "Bem atualizado de acordo com a Lei 14.973/2024?": respondida "Sim", o
   custo de aquisição passa a ser o valor atualizado com tributação
   definitiva, e o ganho sai de outra conta.
4. A coluna Tipo do demonstrativo da Lei 14.754/2023. As duas linhas do AJU-01
   são do mesmo bem 7 e só a sigla as separa: AF é aplicação financeira,
   tributada na realização; LD é lucro de entidade controlada, tributado em
   31 de dezembro.
5. A coluna "parcela não dedutível" das doações efetuadas.
6. "Era residente no exterior e passou a ser residente no Brasil" e "Houve
   alteração de dados cadastrais", na identificação.
7. A alíquota do imposto na ficha de FII e Fiagro, que permite conferir que o
   imposto devido é a base vezes a alíquota.
8. A data da comunicação da condição de não residente à FONTE PAGADORA, que
   não era nem extraída. É dessa data que a fonte deixa de aplicar a tabela do
   residente, e ela é distinta da data de caracterização da condição de não
   residente.
9. Rastreabilidade (página e linha do PDF) em Dívidas, Dependentes, Ganhos de
   Capital, Atividade Rural e Renda Variável, que antes só existia em Bens,
   Rendimentos e Pagamentos.

Dois selos "Da declaração original" diziam que o dado vinha do arquivo .DBK. O
demonstrativo do exterior e as fichas rurais vêm pelos dois caminhos.

### Ferramenta nova, e por que ela precisava existir

`AUDITORIA/verificar-telas-no-app.py`. Os testes deste projeto rodam em Node
puro, sem DOM: provam o módulo que a tela chama, não a tela. Uma ligação
esquecida no .jsx passa verde na suíte inteira, e foi o que aconteceu com a
alíquota do FII na primeira tentativa de prova por reversão. O script sobe o
build de produção, cria três perfis importando AJU-01, SAI-01 e ESP-01 pelo
fluxo do app e confere o texto na tela.

Duas armadilhas registradas nele: o Chromium devolve o texto JÁ com o
text-transform aplicado, então cabeçalho de tabela chega em MAIÚSCULA; e a
moeda em pt-BR usa espaço não separável depois do "R$". E o botão do modal de
revisão nasce desabilitado enquanto o PDF é lido, então esperar só pelo texto
pega o botão ainda inerte.

### Achados que NÃO foram corrigidos, porque a decisão é da usuária

1. **O caminho PDF inventa dois campos do dependente.** `importParsers.js`
   grava `saidaComDeclarante: false` e `nitPisPasep: ''` fixos, e a ficha
   impressa de DEPENDENTES não traz nenhum dos dois (AJU-01 p1 r20 a r25). São
   defaults, não dados lidos. Hoje o dano é nulo, porque nenhuma tela os
   mostra, e foi por isso que não os exibi. O correto seria `null` no caminho
   PDF, e é uma mudança de contrato da extração, que está dada como concluída.

2. **O traço da ficha vira zero.** No demonstrativo da Lei 14.754/2023, a
   linha LD do AJU-01 (p39 r15) imprime "-" em ganho/prejuízo e em imposto
   devido, e o parser grava 0. Traço e zero não são a mesma afirmação. Mexer
   nisso também é mudança de contrato da extração.

### Continua aberto, do que já estava

Itens da segunda passada de `filter-branch`, citações de hash, PDFs de
gabarito superados e instalador Windows: CONCLUÍDOS (31/08 e 01/09/2026),
autorizados pela usuária — ver "O que falta, em ordem" acima. Só resta:

1. Participante rural estrangeiro (RUR-01), sem PDF que exercite a extração.
   Decisão explícita da usuária em 01/09/2026: ELA MESMA preenche à mão na
   interface do programa da Receita quando puder. NÃO tentar de novo por
   script nem por automação de UI sem ela presente.


## Ponto de retomada (31/08/2026, 21h30) — PAUSADO a pedido da usuária

Estado: HEAD limpo em `ba3dec9`, branch `fix/auditoria-2026-08-24`. Suíte em
733 passando, 0 falhas. `npx vite build` limpo.
`AUDITORIA/verificar-telas-no-app.py` em 33 asserções, todas verdes.
Oito commits nesta sessão, de `b187b5a` a `ba3dec9`. O repositório NÃO tem
remoto: não há PR nem nada a sincronizar.

### Como retomar

1. Ler a seção "Sessão de 31/08/2026, noite: das telas ao fluxo real", acima.
   Ela tem o levantamento, o que foi ligado e por quê.
2. Antes de mexer em tela, rodar a prova no app real, que é o que pega ligação
   esquecida no .jsx (a suíte não pega):

       npx vite build
       npx vite preview --port 4173 --strictPort &
       ~/emails-tools/venv/bin/python AUDITORIA/verificar-telas-no-app.py

   Ele cria três perfis, importando AJU-01, SAI-01 e ESP-01 pelo próprio fluxo
   do app. Esperado: "TOTAL 33 de 33".
3. `npx vitest run` a cada passo. Falha isolada pode ser flake de carregamento
   de fonte do pdfjs; o estado estável é verde.

### Fila do que sobrou no levantamento, por peso fiscal

Nenhum destes foi feito. Todos são campos que a extração entrega e a interface
ainda não usa, conferidos em AUDITORIA/saida-parsepdf/ e rows-pdfjs/:

1. `numeroOperacao` do ganho de capital. Vem vazio nas três declarações
   sintéticas, então hoje não há dado que exercite a exibição.
2. `descricao_ficha` dos rendimentos isentos e exclusivos. É a descrição que a
   ficha imprime ("Lucros e dividendos recebidos"), hoje substituída pelo
   rótulo próprio do app. Pode ser redundante: avaliar antes de exibir.
3. `imovelCib` dos participantes rurais. Vazio no AJU-01.
4. `esferaFundo` das doações de ECA e pessoa idosa. NÃO é lacuna real: o
   parser já concatena a esfera no `nome_beneficiario` ("Municipal - SP - SÃO
   PAULO"), e é isso que a tela mostra.
5. `ordemDeclaracao`, `chaveImportacao`, `movimentacoes`, `temDados` e
   `origem`: infraestrutura interna, não são dado da declaração. Ficam fora.

### Achados que continuam esperando decisão sua

Todos os itens que estavam aqui (filter-branch, citações de hash, PDFs de
gabarito, os dois ajustes de contrato da extração e o instalador Windows)
foram CONCLUÍDOS entre 31/08 e 01/09/2026 — ver "O que falta, em ordem",
acima. Só resta:

1. RUR-01, sem PDF que exercite a extração do participante estrangeiro.
   Decisão da usuária em 01/09/2026: ela mesma preenche à mão na interface do
   programa da Receita. NÃO mexer no cadastro do PGD por script nem por
   automação de UI sem ela presente.
