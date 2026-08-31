import java.lang.reflect.Modifier

import serpro.ppgd.irpf.negocio.DeclaracaoIRPF
import serpro.ppgd.irpf.negocio.IdentificadorDeclaracao
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

def sourcePath = 'C:\\Arquivos de Programas RFB\\IRPF2026\\aplicacao\\dados\\11144477735\\11144477735-0000000000.xml'
def outputPath = sourcePath
def cpfTitular = '111.444.777-35'
def cpfConjuge = '222.333.444-05'
def cpfDep = '333.444.555-08'
def cpfAlim = '444.555.666-19'
def cnpjPadrao = '55.566.677/0001-83'
def spMunicipio = '7107'
def uberabaMunicipio = '5401'
def logs = []

def fieldSlot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try {
      def f = c.getDeclaredField(name)
      f.accessible = true
      return f
    } catch (NoSuchFieldException ignored) {
      c = c.superclass
    }
  }
  throw new IllegalArgumentException("Campo nao encontrado: ${obj.getClass().name}.${name}")
}

def fieldValue(obj, String name) {
  fieldSlot(obj, name).get(obj)
}

def setRaw(obj, String name, value) {
  def slot = fieldSlot(obj, name)
  slot.set(obj, value)
}

def setContent(obj, String name, value) {
  if (value == null) return
  def target = fieldValue(obj, name)
  if (target == null) return
  try {
    target.setConteudo(value.toString())
  } catch (Throwable t) {
    throw new RuntimeException("Falha ao preencher ${obj.getClass().simpleName}.${name} com ${value}: ${t.message}", t)
  }
}

def trySetContent(obj, String name, value) {
  try {
    setContent(obj, name, value)
    return true
  } catch (Throwable t) {
    logs << "NAO_EXIBIDO_OU_RECUSADO|${obj.getClass().simpleName}.${name}|${t.message}|${value}"
    return false
  }
}

def clearCollection(col) {
  if (col == null) return
  def items = col.itens()
  while (items.size() > 0) {
    try {
      col.remove(0)
    } catch (Throwable ignored) {
      items.remove(0)
    }
  }
}

def addIndexed(col, item) {
  def idx = col.itens().size() + 1
  trySetContent(item, 'indice', String.format('%05d', idx))
  col.add(item)
  item
}

def newItem(String className, Object... args) {
  def cls = Class.forName(className)
  def ctor = cls.declaredConstructors.find { it.parameterTypes.size() == args.size() }
  if (ctor == null) throw new IllegalArgumentException("Construtor nao encontrado: ${className}/${args.size()}")
  ctor.accessible = true
  ctor.newInstance(args)
}

def setMonthRendPF(rendPF, String month, Map values) {
  def mes = fieldValue(rendPF, month)
  values.each { k, v -> setContent(mes, k, v) }
}

def setRVMonth(rv, String month, String comum, String day, String irrfComum, String irrfDay, String impostoPago) {
  def mes = fieldValue(rv, month)
  def comumObj = fieldValue(mes, 'operacoesComuns')
  def dayObj = fieldValue(mes, 'operacoesDayTrade')
  def comumVal = new BigDecimal(comum.replace('.', '').replace(',', '.'))
  def dayVal = new BigDecimal(day.replace('.', '').replace(',', '.'))
  def opt = new BigDecimal('101.01')
  setContent(comumObj, 'mercadoVistaAcoes', (comumVal - opt).setScale(2).toString().replace('.', ','))
  setContent(comumObj, 'mercadoOpcoesAcoes', '101,01')
  setContent(dayObj, 'mercadoVistaAcoes', (dayVal - opt).setScale(2).toString().replace('.', ','))
  setContent(dayObj, 'mercadoOpcoesAcoes', '101,01')
  setContent(mes, 'impostoRetidoFonteLei11033', irrfComum)
  setContent(mes, 'irFonteDayTradeMesAtual', irrfDay)
  setContent(mes, 'impostoPago', impostoPago)
}

def addRendPJTitular(dec, id, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendpj.RendPJTitular(id)
  m.each { k, v -> setContent(item, k, v) }
  dec.getColecaoRendPJTitular().add(item)
}

def addRendPJDependente(dec, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendpj.RendPJDependente(dec)
  m.each { k, v -> setContent(item, k, v) }
  dec.getColecaoRendPJDependente().add(item)
}

def addRendExigTitular(dec, id, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendpjexigibilidade.RendPJComExigibilidadeTitular(id)
  m.each { k, v -> setContent(item, k, v) }
  dec.getColecaoRendPJComExigibilidadeTitular().add(item)
}

def addRendExigDependente(dec, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendpjexigibilidade.RendPJComExigibilidadeDependente(dec)
  m.each { k, v -> setContent(item, k, v) }
  dec.getColecaoRendPJComExigibilidadeDependente().add(item)
}

def addRRA(dec, col, String className, Map m) {
  def item = newItem(className, dec, col)
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
  item
}

def addRRAPensao(rraItem, String alimentando, String valor) {
  def item = new serpro.ppgd.irpf.negocio.rendIsentos.ItemQuadroPensaoAlimenticia()
  setContent(item, 'alimentando', alimentando)
  setContent(item, 'valor', valor)
  rraItem.getPensaoAlimenticiaQuadroAuxiliar().add(item)
  item
}

def addIsentoTransporte(dec, col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendIsentos.ItemQuadroTransporteDetalhado(dec)
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
}

def addIsentoOutros(dec, col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendIsentos.ItemQuadroOutrosRendimentos(dec)
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
}

def addTransferencia(dec, col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendIsentos.ItemQuadroTransferenciaPatrimonial(dec)
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
}

def addPremio(dec, col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.rendIsentos.ItemQuadroGanhosLotericasRendimentos(dec)
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
}

def addPagamento(dec, Map m) {
  def item = new serpro.ppgd.irpf.negocio.pagamentos.Pagamento(dec)
  m.each { k, v -> setContent(item, k, v) }
  addIndexed(dec.getPagamentos(), item)
}

def addDoacao(dec, Map m) {
  def item = new serpro.ppgd.irpf.negocio.doacoes.Doacao(dec)
  m.each { k, v -> setContent(item, k, v) }
  addIndexed(dec.getDoacoes(), item)
}

def addBem(dec, id, Map m) {
  def item = new serpro.ppgd.irpf.negocio.bens.Bem(id, dec)
  m.each { k, v -> setContent(item, k, v) }
  addIndexed(dec.getBens(), item)
}

def addDivida(dec, Map m) {
  def item = new serpro.ppgd.irpf.negocio.dividas.Divida()
  m.each { k, v -> setContent(item, k, v) }
  addIndexed(dec.getDividas(), item)
}

def addRuralBem(col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.atividaderural.BemAR()
  m.each { k, v -> setContent(item, k, v) }
  addIndexed(col, item)
}

def addRuralDivida(col, Map m) {
  def item = new serpro.ppgd.irpf.negocio.atividaderural.DividaAR()
  m.each { k, v -> setContent(item, k, v) }
  col.add(item)
}

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao(cpfTitular, '0000000000')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, sourcePath, false)

[dec.getDependentes(), dec.getAlimentandos(), dec.getColecaoRendPJTitular(), dec.getColecaoRendPJDependente(),
 dec.getColecaoRendPJComExigibilidadeTitular(), dec.getColecaoRendPJComExigibilidadeDependente(),
 dec.getColecaoRendAcmTitular(), dec.getColecaoRendAcmDependente(), dec.getRendPFDependente(),
 dec.getPagamentos(), dec.getDoacoes(), dec.getBens(), dec.getDividas(), dec.getDoacoesEleitorais(),
 dec.getRendaVariavelDependente(), dec.getFundosInvestimentosDependente(), dec.getColecaoEstatutoCriancaAdolescente(),
 dec.getColecaoEstatutoIdoso()].each { clearCollection(it) }

def ri = dec.getRendIsentos()
['bolsaEstudosQuadroAuxiliar','indenizacoesQuadroAuxiliar','lucroRecebidoQuadroAuxiliar','parcIsentaAposentadoriaQuadroAuxiliar',
 'poupancaQuadroAuxiliar','rendSocioQuadroAuxiliar','transferenciasQuadroAuxiliar','impostoRendasAnterioresCompensadoJudicialmenteQuadroAuxiliar',
 'rendAssalariadoMoedaEstrangeiraQuadroAuxiliar','incorporacaoReservaCapitalQuadroAuxiliar','medicosResidentesQuadroAuxiliar',
 'voluntariosCopaQuadroAuxiliar','meacaoDissolucaoQuadroAuxiliar','ganhosLiquidosAcoesQuadroAuxiliar','ganhosCapitalOuroQuadroAuxiliar',
 'pensaoAlimenticiaQuadroAuxiliar','outrosQuadroAuxiliar'].each { clearCollection(fieldValue(ri, it)) }

def rte = dec.getRendTributacaoExclusiva()
['rendAplicacoesQuadroAuxiliar','outrosQuadroAuxiliar','jurosCapitalProprioQuadroAuxiliar','participacaoLucrosResultadosQuadroAuxiliar',
 'ganhosLotericaQuadroAuxiliar'].each { clearCollection(fieldValue(rte, it)) }

def ar = dec.getAtividadeRural()
def arBrasil = fieldValue(ar, 'brasil')
def arExterior = fieldValue(ar, 'exterior')
clearCollection(fieldValue(arBrasil, 'identificacaoImovel'))
clearCollection(fieldValue(arBrasil, 'dividas'))
clearCollection(fieldValue(arExterior, 'identificacaoImovel'))
clearCollection(fieldValue(arExterior, 'receitasDespesas'))
clearCollection(fieldValue(arExterior, 'dividas'))
clearCollection(fieldValue(ar, 'bens'))

def ident = dec.getIdentificadorDeclaracao()
setContent(ident, 'nome', 'AUDITORIA PDF TEC AJUSTE')
setContent(ident, 'tipoDeclaracao', '0')
setContent(ident, 'tipoDeclaracaoAES', 'A')
setContent(ident, 'declaracaoRetificadora', '0')
setContent(ident, 'transmitida', '0')
setContent(ident, 'enderecoDiferente', '1')
setContent(ident, 'prepreenchida', '0')
setContent(ident, 'inUtilizouPGD', '1')
setContent(ident, 'inNovaDeclaracao', '0')
setContent(dec.getCopiaIdentificador(), 'nome', 'AUDITORIA PDF TEC AJUSTE')
setContent(dec.getCopiaIdentificador(), 'enderecoDiferente', '1')

def c = dec.getContribuinte()
[
  dataNascimento: '11/01/1980', tituloEleitor: '111122223333', racaCor: '4',
  conjuge: '1', cpfConjuge: cpfConjuge, exterior: '0', retornoPais: '0',
  tipoLogradouro: 'RUA', logradouro: 'SENTINELA AJU PES', numero: '1101', complemento: 'APTO 11',
  bairro: 'BAIRRO SENTINELA', pais: '105', uf: 'SP', municipio: spMunicipio, cidade: 'SAO PAULO',
  cep: '01001-000', ddd: '11', telefone: '34567890', dddCelular: '11', celular: '998765432',
  email: 'auditoria.pdf.aju@example.invalid', naturezaOcupacao: '12', ocupacaoPrincipal: '391', deficiente: 'N'
].each { k, v -> setContent(c, k, v) }

def dep = new serpro.ppgd.irpf.negocio.dependentes.Dependente(dec)
[codigo: '21', cpfDependente: cpfDep, nome: 'AJU PES DEPENDENTE UM', dataNascimento: '12/02/2015',
 racaCor: '4', email: 'aju.pes.dep1@example.invalid', ddd: '11', telefone: '997654321', indMoraComTitular: '0'].each { k, v -> setContent(dep, k, v) }
dec.getDependentes().add(dep)

def alim = new serpro.ppgd.irpf.negocio.alimentandos.Alimentando(dec)
[residente: '0', cpf: cpfAlim, nome: 'AJU PES ALIMENTANDO UM', dtNascimento: '13/03/2010',
 cpfResponsavel: cpfTitular, tipoProcesso: 'C'].each { k, v -> setContent(alim, k, v) }
def esc = fieldValue(alim, 'escrituraPublica')
[cnpjCartorio: cnpjPadrao, nome: 'CARTORIO AJU PES SENTINELA', livro: 'L11', folhas: 'F22',
 uf: 'SP', municipio: spMunicipio, dataLavratura: '14/04/2025'].each { k, v -> setContent(esc, k, v) }
dec.getAlimentandos().add(alim)
setContent(dec.getAlimentandos(), 'confirmacao', 'S')

addRendPJTitular(dec, ident, [NIFontePagadora: cnpjPadrao, nomeFontePagadora: 'AJU RPJ FONTE TITULAR', rendRecebidoPJ: '51.101,11',
  contribuicaoPrevOficial: '5.102,12', impostoRetidoFonte: '4.104,14', decimoTerceiro: '5.105,15', IRRFDecimoTerceiro: '505,16'])
addRendPJDependente(dec, [cpfDependente: cpfDep, nomeDependente: 'AJU PES DEPENDENTE UM', NIFontePagadora: cnpjPadrao,
  nomeFontePagadora: 'AJU RPJ FONTE DEPENDENTE', rendRecebidoPJ: '12.201,21', contribuicaoPrevOficial: '1.202,22',
  impostoRetidoFonte: '904,24', decimoTerceiro: '1.205,25', IRRFDecimoTerceiro: '105,26'])

setMonthRendPF(dec.getRendPFTitular(), 'janeiro', [pessoaFisica: '6.301,31', alugueis: '2.302,32', outros: '303,33', livroCaixa: '1.304,34', pensao: '305,35', darfPago: '406,36'])
setMonthRendPF(dec.getRendPFTitular(), 'fevereiro', [exterior: '7.311,41', impostoPagoCompensarExterior: '711,42', livroCaixa: '1.312,43', darfPago: '512,44'])
setMonthRendPF(dec.getRendPFTitular(), 'marco', [pessoaFisica: '8.321,51', alugueis: '4.322,52'])

def rpfDep = new serpro.ppgd.irpf.negocio.rendpf.ItemRendPFDependente()
setContent(rpfDep, 'cpf', cpfDep)
def rpfDepRend = fieldValue(rpfDep, 'rendimentos')
setMonthRendPF(rpfDepRend, 'abril', [pessoaFisica: '3.401,61', alugueis: '1.402,62', livroCaixa: '403,63', darfPago: '204,64'])
setMonthRendPF(rpfDepRend, 'maio', [exterior: '2.411,65', impostoPagoCompensarExterior: '211,66'])
dec.getRendPFDependente().add(rpfDep)

addIsentoTransporte(dec, fieldValue(ri, 'lucroRecebidoQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU ISE DIVIDENDOS', valor: '20.502,72'])
addIsentoTransporte(dec, fieldValue(ri, 'poupancaQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU ISE APLICACAO', valor: '3.503,73'])
addTransferencia(dec, fieldValue(ri, 'transferenciasQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, niDoadorEspolio: cpfConjuge, nomeDoadorEspolio: 'AJU ISE DOACAO RECEBIDA', valor: '14.504,74'])
addIsentoOutros(dec, fieldValue(ri, 'outrosQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU ISE GANHO ISENTO', descricaoRendimento: 'AJU ISE GANHO ISENTO', valor: '5.505,75'])
addIsentoOutros(dec, fieldValue(ri, 'outrosQuadroAuxiliar'),
  [tipoBeneficiario: 'Dependente', cpfBeneficiario: cpfDep, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU ISE DEPENDENTE DETALHE', descricaoRendimento: 'AJU ISE DEPENDENTE DETALHE', valor: '1.506,76'])

addIsentoTransporte(dec, fieldValue(rte, 'rendAplicacoesQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU EXC APLICACAO', valor: '6.601,81'])
addIsentoTransporte(dec, fieldValue(rte, 'jurosCapitalProprioQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU EXC JCP', valor: '2.602,82'])
addPremio(dec, fieldValue(rte, 'ganhosLotericaQuadroAuxiliar'),
  [tipoBeneficiario: 'Titular', cpfBeneficiario: cpfTitular, descricaoRendimento: 'AJU EXC PREMIO', codeTipoRendimento: '13', valor: '1.603,83'])
addIsentoOutros(dec, fieldValue(rte, 'outrosQuadroAuxiliar'),
  [tipoBeneficiario: 'Dependente', cpfBeneficiario: cpfDep, cnpjEmpresa: cnpjPadrao, nomeFonte: 'AJU EXC DEPENDENTE', descricaoRendimento: 'AJU EXC DEPENDENTE', valor: '604,84'])

addRendExigTitular(dec, ident, [NIFontePagadora: cnpjPadrao, nomeFontePagadora: 'AJU EXI FONTE TITULAR', rendExigSuspensa: '17.701,91', depositoJudicial: '7.702,92'])
addRendExigDependente(dec, [cpfDependente: cpfDep, NIFontePagadora: cnpjPadrao, nomeFontePagadora: 'AJU EXI FONTE DEPENDENTE', rendExigSuspensa: '8.711,96', depositoJudicial: '3.712,97'])

def rraTit = addRRA(dec, dec.getColecaoRendAcmTitular(), 'serpro.ppgd.irpf.negocio.rendacm.RendAcmTitular',
  [opcaoTributacao: 'E', niFontePagadora: cnpjPadrao, nomeFontePagadora: 'AJU RRA TITULAR EXCLUSIVA',
   rendRecebidosInformado: '31.801,01', rendRecebidos: '31.801,01', contribuicaoPrevOficial: '3.802,02',
   pensaoAlimenticia: '1.803,03', impostoRetidoFonte: '4.804,04', numMeses: '11,00', mesRecebimento: '12', valorJuros: '0,00'])
addRRAPensao(rraTit, 'AJU PES ALIMENTANDO UM', '1.803,03')
def rraDep = addRRA(dec, dec.getColecaoRendAcmDependente(), 'serpro.ppgd.irpf.negocio.rendacm.RendAcmDependente',
  [cpfDependente: cpfDep, opcaoTributacao: 'A', niFontePagadora: cnpjPadrao, nomeFontePagadora: 'AJU RRA DEPENDENTE AJUSTE',
   rendRecebidosInformado: '9.811,06', rendRecebidos: '9.811,06', contribuicaoPrevOficial: '812,07',
   pensaoAlimenticia: '313,08', impostoRetidoFonte: '914,09', numMeses: '7,00', mesRecebimento: '12', valorJuros: '0,00'])
addRRAPensao(rraDep, 'AJU PES ALIMENTANDO UM', '313,08')

setContent(dec.getImpostoPago(), 'impostoComplementar', '1.901,11')

addPagamento(dec, [codigo: '10', tipo: 'T', niBeneficiario: cpfAlim, nomeBeneficiario: 'AJU PAG MEDICO', valorPago: '2.001,21', parcelaNaoDedutivel: '101,22', descricao: 'AJU PAG MEDICO'])
addPagamento(dec, [codigo: '11', tipo: 'D', cpfDependente: cpfDep, dependenteOuAlimentando: 'AJU PES DEPENDENTE UM', niBeneficiario: cpfAlim, nomeBeneficiario: 'AJU PAG DENTISTA DEP', valorPago: '1.502,23', parcelaNaoDedutivel: '102,24', descricao: 'AJU PAG DENTISTA DEP'])
addPagamento(dec, [codigo: '21', tipo: 'T', niBeneficiario: cnpjPadrao, nomeBeneficiario: 'AJU PAG HOSPITAL', valorPago: '3.003,25', parcelaNaoDedutivel: '0,00', descricao: 'AJU PAG HOSPITAL'])
addPagamento(dec, [codigo: '01', tipo: 'D', cpfDependente: cpfDep, dependenteOuAlimentando: 'AJU PES DEPENDENTE UM', niBeneficiario: cnpjPadrao, nomeBeneficiario: 'AJU PAG ESCOLA DEP', valorPago: '4.504,26', parcelaNaoDedutivel: '504,27', descricao: 'AJU PAG ESCOLA DEP'])
addPagamento(dec, [codigo: '60', tipo: 'T', niBeneficiario: cpfAlim, nomeBeneficiario: 'AJU PAG ADVOGADO RRA', valorPago: '2.805,05', parcelaNaoDedutivel: '0,00', descricao: 'AJU PAG ADVOGADO RRA'])
addPagamento(dec, [codigo: '30', tipo: 'A', cpfAlimentando: cpfAlim, dependenteOuAlimentando: 'AJU PES ALIMENTANDO UM', niBeneficiario: cpfAlim, nomeBeneficiario: 'AJU PES ALIMENTANDO UM', valorPago: '6.006,28', parcelaNaoDedutivel: '0,00', descricao: 'AJU PES ALIMENTANDO UM'])
addPagamento(dec, [codigo: '36', tipo: 'T', niBeneficiario: cnpjPadrao, nomeBeneficiario: 'AJU PAG PREVIDENCIA', valorPago: '5.507,29', parcelaNaoDedutivel: '507,30', descricao: 'AJU PAG PREVIDENCIA'])
addPagamento(dec, [codigo: '99', tipo: 'T', niBeneficiario: cpfAlim, nomeBeneficiario: 'AJU PAG OUTROS DETALHE', valorPago: '808,31', parcelaNaoDedutivel: '108,32', descricao: 'AJU PAG OUTROS DETALHE'])

addDoacao(dec, [codigo: '80', niBeneficiario: cpfConjuge, nomeBeneficiario: 'AJU DOA PESSOA FISICA', valorPago: '7.101,41'])
addDoacao(dec, [codigo: '81', niBeneficiario: cpfDep, nomeBeneficiario: 'AJU DOA BEM DEPENDENTE', valorPago: '8.102,42'])
addDoacao(dec, [codigo: '40', niBeneficiario: cnpjPadrao, nomeBeneficiario: 'AJU DOA INCENTIVO', valorPago: '1.103,43'])

def de = new serpro.ppgd.irpf.negocio.eleicoes.DoacaoEleitoral()
[cnpj: cnpjPadrao, nome: 'AJU ELEITORAL SENTINELA', valor: '1.201,44'].each { k, v -> setContent(de, k, v) }
dec.getDoacoesEleitorais().add(de)

addBem(dec, ident, [grupo: '01', codigo: '11', pais: '105', nomePais: '105 - Brasil', tipo: 'T',
  discriminacao: 'AJU BEM IMOVEL APARTAMENTO SENTINELA, adquirido em 15/05/2025, matricula 11001, cartorio AJU, 50% do titular.',
  logradouro: 'AJU BEM IMOVEL', numero: '2101', complemento: 'APTO 21', bairro: 'BAIRRO SENTINELA',
  uf: 'SP', municipio: spMunicipio, nomeMunicipio: 'SAO PAULO', cep: '01001-000', registroBem: 'AJU-IPTU-2101',
  registrado: '1', matricula: '11001', areaTotal: '71,21', unidade: '0', nomeCartorio: 'AJU CARTORIO', dataAquisicao: '15/05/2025',
  valorExercicioAnterior: '0,00', valorExercicioAtual: '210.101,51', indicadorBemInventariar: '0', indicadorBemComUsufruto: '0'])
addBem(dec, ident, [grupo: '02', codigo: '01', pais: '105', nomePais: '105 - Brasil', tipo: 'T',
  registroBem: '26262603903', discriminacao: 'AJU BEM VEICULO MODELO SENTINELA ANO 2025 COR AZUL; RENAVAM sintetico 26262603903 usado porque o campo recusou texto.',
  valorExercicioAnterior: '0,00', valorExercicioAtual: '82.202,52', indicadorBemInventariar: '0'])
addBem(dec, ident, [grupo: '06', codigo: '01', pais: '105', nomePais: '105 - Brasil', tipo: 'T',
  niEmpresa: cnpjPadrao, agencia: '2303', conta: '240024', dvConta: '5', discriminacao: 'AJU BEM CONTA BANCARIA TITULAR AJU BANCO SENTINELA',
  valorExercicioAnterior: '12.303,53', valorExercicioAtual: '23.304,54', indicadorContaPagamento: '0', indicadorBemInventariar: '0'])
addBem(dec, ident, [grupo: '04', codigo: '02', pais: '105', nomePais: '105 - Brasil', tipo: 'T',
  niEmpresa: cnpjPadrao, discriminacao: 'AJU BEM APLICACAO RENDA FIXA SENTINELA',
  valorExercicioAnterior: '31.405,55', valorExercicioAtual: '42.406,56', indicadorBemInventariar: '0'])
addBem(dec, ident, [grupo: '03', codigo: '02', pais: '105', nomePais: '105 - Brasil', tipo: 'T',
  niEmpresa: cnpjPadrao, discriminacao: 'AJU BEM PARTICIPACAO SOCIETARIA 1234 QUOTAS',
  valorExercicioAnterior: '50.507,57', valorExercicioAtual: '61.508,58', indicadorBemInventariar: '0'])
addBem(dec, ident, [grupo: '06', codigo: '10', pais: '105', nomePais: '105 - Brasil', tipo: 'D', cpfBeneficiario: cpfDep,
  discriminacao: 'AJU BEM NUMERARIO DEPENDENTE', valorExercicioAnterior: '1.609,59', valorExercicioAtual: '2.610,60', indicadorBemInventariar: '0'])
addBem(dec, ident, [grupo: '04', codigo: '02', pais: '249', nomePais: '249 - Estados Unidos', tipo: 'T',
  discriminacao: 'AJU BEM EXTERIOR LEI 14754 CONTA SENTINELA', valorExercicioAnterior: '11.711,61',
  valorExercicioAtual: '22.712,62', lucroPrejuizo: '3.713,63', impostoPagoExterior: '314,64', impostoPagoExteriorIRRF: '314,64',
  indicadorBemInventariar: '0', indicadorAutoCustodiante: '0'])

addDivida(dec, [codigo: '13', discriminacao: 'CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO SENTINELA',
  valorExercicioAnterior: '91.801,71', valorExercicioAtual: '72.802,72', valorPgtoAnual: '19.003,73'])
addDivida(dec, [codigo: '14', discriminacao: 'CPF 222.333.444-05 - AJU DIV EMPRESTIMO PESSOAL',
  valorExercicioAnterior: '10.804,74', valorExercicioAtual: '6.805,75', valorPgtoAnual: '3.998,99'])

def imBr = new serpro.ppgd.irpf.negocio.atividaderural.brasil.ImovelARBrasil()
[codigo: '11', nome: 'AJU RUR FAZENDA BRASIL SENTINELA', localizacao: 'ESTRADA AJU RURAL KM 22 - UBERABA/MG - CEP 38000-000',
 area: '123,45', participacao: '75,00', condicaoExploracao: '2', cib: ''].each { k, v -> setContent(imBr, k, v) }
def part = new serpro.ppgd.irpf.negocio.atividaderural.ParticipanteImovelAR()
[ni: cpfConjuge, nome: 'AJU RUR PARTICIPANTE UM', estrangeiro: '0', indice: '00001'].each { k, v -> setContent(part, k, v) }
fieldValue(imBr, 'participantesImovelAR').add(part)
addIndexed(fieldValue(arBrasil, 'identificacaoImovel'), imBr)

def recBr = fieldValue(arBrasil, 'receitasDespesas')
setContent(fieldValue(recBr, 'janeiro'), 'receitaBrutaMensal', '18.101,01')
setContent(fieldValue(recBr, 'janeiro'), 'despesaCusteioInvestimento', '11.205,05')
setContent(fieldValue(recBr, 'fevereiro'), 'receitaBrutaMensal', '19.104,04')
setContent(fieldValue(recBr, 'fevereiro'), 'despesaCusteioInvestimento', '13.211,11')
setContent(fieldValue(recBr, 'marco'), 'receitaBrutaMensal', '20.107,07')
setContent(fieldValue(recBr, 'marco'), 'despesaCusteioInvestimento', '15.217,17')
setContent(fieldValue(recBr, 'abril'), 'receitaBrutaMensal', '21.110,10')
setContent(fieldValue(recBr, 'abril'), 'despesaCusteioInvestimento', '17.223,23')
def apBr = fieldValue(arBrasil, 'apuracaoResultado')
[prejuizoExercicioAnterior: '7.201,13', opcaoFormaApuracao: '2'].each { k, v -> setContent(apBr, k, v) }
def rebBr = fieldValue(arBrasil, 'movimentacaoRebanho')
def bovBr = fieldValue(rebBr, 'bovinos')
[estoqueInicial: '101', aquisicoesAno: '22', nascidosAno: '13', consumo: '4', vendas: '26', estoqueFinal: '101'].each { k, v -> setContent(bovBr, k, v) }
addRuralBem(fieldValue(ar, 'bens'), [codigo: '16', pais: '105', nomePais: '105 - Brasil', discriminacao: 'AJU RUR BEM TRATOR SENTINELA SERIE 2601',
  valorExercicioAnterior: '81.301,14', valorExercicioAtual: '92.302,15'])
addRuralDivida(fieldValue(arBrasil, 'dividas'), [discriminacao: 'CNPJ 55.566.677/0001-83 - AJU RUR DIVIDA CUSTEIO SENTINELA',
  contraidasAteExercicioAnterior: '41.401,16', contraidasAteExercicioAtual: '32.402,17', valorPagamentoAnual: '0,00'])

def imEx = new serpro.ppgd.irpf.negocio.atividaderural.ImovelAR()
[codigo: '11', nome: 'AJU RUE FARM EXTERIOR SENTINELA', localizacao: '249 - Estados Unidos - 2801 AUDIT FARM ROAD',
 area: '234,56', participacao: '100,00', condicaoExploracao: '1'].each { k, v -> setContent(imEx, k, v) }
addIndexed(fieldValue(arExterior, 'identificacaoImovel'), imEx)
def rdEx = new serpro.ppgd.irpf.negocio.atividaderural.exterior.ReceitaDespesa()
[pais: '249', descricaoPais: 'Estados Unidos', receitaBruta: '58.005,45', despesaCusteio: '40.017,96',
 resultadoIMoedaOriginal: '17.987,49', resultadoI_EmDolar: '17.987,49'].each { k, v -> setContent(rdEx, k, v) }
fieldValue(arExterior, 'receitasDespesas').add(rdEx)
def apEx = fieldValue(arExterior, 'apuracaoResultado')
[prejuizoExercicioAnterior: '8.507,27', opcaoFormaApuracao: '2'].each { k, v -> setContent(apEx, k, v) }
def bovEx = fieldValue(fieldValue(arExterior, 'movimentacaoRebanho'), 'bovinos')
[estoqueInicial: '51', aquisicoesAno: '12', nascidosAno: '8', consumo: '2', vendas: '16', estoqueFinal: '50'].each { k, v -> setContent(bovEx, k, v) }
addRuralBem(fieldValue(ar, 'bens'), [codigo: '16', pais: '249', nomePais: '249 - Estados Unidos', discriminacao: 'AJU RUE BEM MAQUINA SENTINELA',
  valorExercicioAnterior: '51.508,28', valorExercicioAtual: '62.509,29'])
addRuralDivida(fieldValue(arExterior, 'dividas'), [discriminacao: 'AJU RUE DIVIDA EXTERIOR SENTINELA',
  contraidasAteExercicioAnterior: '31.510,30', contraidasAteExercicioAtual: '24.511,31', valorPagamentoAnual: '0,00'])

setRVMonth(dec.getRendaVariavel(), 'janeiro', '2.701,61', '701,62', '27,63', '140,64', '501,65')
setRVMonth(dec.getRendaVariavel(), 'fevereiro', '-1.702,66', '802,67', '17,68', '160,69', '202,70')
setRVMonth(dec.getRendaVariavel(), 'marco', '3.703,71', '-903,72', '37,73', '90,74', '604,75')

def rvDep = new serpro.ppgd.irpf.negocio.rendavariavel.ItemRendaVariavelDependente(dec)
setContent(rvDep, 'cpf', cpfDep)
setRVMonth(fieldValue(rvDep, 'rendaVariavel'), 'abril', '1.711,76', '411,77', '17,78', '82,79', '303,80')
dec.getRendaVariavelDependente().add(rvDep)

def fii = dec.getFundosInvestimentos()
def mai = fieldValue(fii, 'mai')
setContent(mai, 'resultLiquidoMes', '1.801,81')
setContent(mai, 'impostoRetidoFonte', '18,82')
setContent(mai, 'impostoPago', '361,83')
def jun = fieldValue(fii, 'jun')
setContent(jun, 'resultLiquidoMes', '-902,84')
setContent(jun, 'impostoRetidoFonte', '9,85')
setContent(jun, 'impostoPago', '0,00')

def fiiDep = new serpro.ppgd.irpf.negocio.rendavariavel.ItemFundosInvestimentosDependente(dec)
setContent(fiiDep, 'cpf', cpfDep)
def fiiDepRv = fieldValue(fiiDep, 'fundosInvestimentos')
def julFii = fieldValue(fiiDepRv, 'jul')
setContent(julFii, 'resultLiquidoMes', '1.811,86')
setContent(julFii, 'impostoRetidoFonte', '18,87')
setContent(julFii, 'impostoPago', '362,88')
dec.getFundosInvestimentosDependente().add(fiiDep)

logs << 'AJUSTADO|Atividade Rural Brasil|Despesas e investimentos mensais|O XML oficial tem campo unico despesaCusteioInvestimento; usado despesa+investimento por mes|Jan 11.205,05; Fev 13.211,11; Mar 15.217,17; Abr 17.223,23'
logs << 'NAO_EXIBIDO|Atividade Rural Brasil|Perdas de rebanho|Objeto oficial exposto possui consumo/vendas/estoque, sem campo perdas|5 nao lancado'
logs << 'AJUSTADO|Atividade Rural Exterior|Receitas/despesas mensais|Objeto oficial exposto consolida por pais; usado total Jan+Fev|Receita 58.005,45; despesa+investimento 40.017,96'
logs << 'NAO_EXIBIDO|Rendimentos PJ exigibilidade suspensa|Previdencia/pensao/IRRF|Objeto oficial exposto possui apenas rendExigSuspensa e depositoJudicial|Campos nao lancados'
logs << 'NAO_EXIBIDO|RRA|Despesas com acao judicial|Objeto oficial exposto nao trouxe campo proprio; valorJuros mantido zero|2.805,05/515,10 nao lancados'
logs << 'NAO_PREENCHIDO|Doacoes diretamente na declaracao ECA/Idoso|Fundo/CNPJ/DARF|Nao criado para evitar qualquer geracao de DARF ou pagamento|Valores 301,45 e 302,46 nao lancados'
logs << 'NAO_PREENCHIDO|GCAP 2025|Ganho de capital|Roteiro exige GCAP/importacao quando nao houver preenchimento direto no IRPF; nao foi importado GCAP|Itens 29 a 32 nao lancados'
logs << 'ABSORVIDO_NA_FICHA_RPF|Demais rendimentos e transportes|Transporte de carga/passageiros|Valores principais foram lancados em Rendimentos PF/Exterior conforme roteiro|Mar 8.321,51 e 4.322,52'
logs << 'NAO_PREENCHIDO|Rendimentos Isentos|Parcela isenta de aposentadoria 65+|Titular sintetico nasceu em 11/01/1980; o PGD acusa erro para beneficiario menor de 65 anos|Valor 10.501,71 nao lancado'
logs << 'AJUSTADO|Bens e Direitos|RENAVAM do veiculo|Campo oficial recusou texto AJU220022; usado RENAVAM sintetico numerico validado pelo PGD|26262603903'
logs << 'AJUSTADO|Atividade Rural Brasil|Condicao de exploracao|Roteiro traz 75% e participante de 25%; PGD exige 100% em Propriedade unica/Posse, entao usada condicao Condominio|codigo 2'

try {
  dec.adicionaObservadoresCalculos()
  dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais()
  dec.recalcularDeclaracao()
} catch (Throwable t) {
  logs << "RECALCULO_AVISO|Declaracao|recalcularDeclaracao|${t.class.simpleName}: ${t.message}|XML salvo mesmo assim"
}

repo.salvar(dec, outputPath)
new File(outputPath.replace('.xml', '.BKP')).bytes = new File(outputPath).bytes

def auditLog = new File('C:\\Users\\tectr_u0xxepj\\AppData\\Local\\Temp\\irpf-fill-ocorrencias.tsv')
auditLog.parentFile.mkdirs()
auditLog.text = logs.join(System.lineSeparator()) + System.lineSeparator()

println "XML salvo: ${outputPath}"
println "Ocorrencias registradas: ${logs.size()}"
println "Dependentes: ${dec.getDependentes().itens().size()}"
println "Alimentandos: ${dec.getAlimentandos().itens().size()}"
println "Bens: ${dec.getBens().itens().size()}"
println "Pagamentos: ${dec.getPagamentos().itens().size()}"
println "RendPJ titular/dependente: ${dec.getColecaoRendPJTitular().itens().size()}/${dec.getColecaoRendPJDependente().itens().size()}"
