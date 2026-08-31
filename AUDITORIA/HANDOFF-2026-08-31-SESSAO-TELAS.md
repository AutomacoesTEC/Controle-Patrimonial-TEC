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

Vinte e três commits, de `bc6a711` a `ad2a1b8`. Suíte final: 657 aprovados, 0
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

### O que falta, em ordem

1. **Segunda passada de `filter-branch`** (PAUSADA a pedido da usuária).
   Resíduo: a palavra `imoveisMesmoCib`, em MINÚSCULA, ainda está em 40 commits do
   histórico, como nome de variável em `importParsers.test.js`. O regex da
   primeira passada cobria `Pantaninho` e `PANTANINHO` e não a forma minúscula.
   No HEAD já foi renomeada para `imoveisMesmoCib`. Fechar isso renumera os
   hashes outra vez, por isso depende de autorização.
2. **Citações de hash quebradas.** A reescrita mudou todos os hashes. Os
   handoffs de 31/08 citam `a02dc49`, `6e8bd0b`, `ad2a1b8`, `bc6a711` e
   `4ba2c5d`, que não existem mais. Corrigir junto com o item 1, senão o
   trabalho é refeito.
3. **Cinco PDFs de gabarito superados**: decidir se ficam versionados. Não
   foram abertos ainda.
4. **Instalador Windows**: depende da decisão sobre certificado de assinatura.
5. **Participante rural estrangeiro (RUR-01)**: segue sem PDF que exercite a
   extração. O caminho seguro é preencher a declaração à mão na interface do
   programa da Receita. NÃO mexer no cadastro do PGD por script: duas
   tentativas quebraram o IRPF 2026 (ver seção 1 deste documento).

### Backup do repositório antes da reescrita

`~/backups-cp-tec/cp-tec-antes-da-limpeza-2026-08-31.bundle`,
`git-dir-antes-da-limpeza-2026-08-31.tar.gz` e `manifesto-antes.json`.
O HEAD anterior à reescrita era `1fdcdf5`.
