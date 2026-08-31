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
