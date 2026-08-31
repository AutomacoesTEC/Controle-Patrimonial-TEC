// O campo pessoaFisica de cada mes da ficha Rendimentos de PF/Exterior nao e'
// editavel: e' calculado pela soma do quadro auxiliar contasAno, que detalha o
// rendimento por pagador. Escrever direto nele e' desfeito pelo recalculo.
// Item 6 do roteiro ja previa o pagador AJU RPF PAGADOR JANEIRO.
import serpro.ppgd.irpf.negocio.*
import serpro.ppgd.irpf.negocio.rendpf.Conta
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

logs = []
def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  return null
}
def fv(obj, String n) { slot(obj, n)?.get(obj) }
def setC(obj, String name, value) {
  def s = slot(obj, name)
  if (s == null) { logs << "SEM CAMPO ${obj.getClass().simpleName}.${name}"; return }
  try { s.get(obj).setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO ${obj.getClass().simpleName}.${name}=${value}: ${e.message}" }
}

def CPF_TITULAR = '111.444.777-35'
def CPF_DEP = '333.444.555-08'
def CPF_PAGADOR = '444.555.666-19'

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao(CPF_TITULAR, '0000000000')
def path = id.getPathArquivo().replaceFirst('^/', '')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, path, false)

// idempotente: limpa o mes antes de inserir, para reexecucao nao duplicar
def novaConta = { colMes, String mesNum, String mesAno, String valor, String nomePagador, String cpfBenef ->
  while (colMes.itens().size() > 0) {
    try { colMes.remove(0) } catch (Throwable t) { colMes.itens().remove(0) }
  }
  def c = new Conta()
  // dataMesAno vazio trava a geracao do PDF; e' obrigatorio na impressao
  [dataMesAno: mesAno, nomeMes: mesNum, valor: valor, cpfTitularPagamento: CPF_PAGADOR,
   indTitularEhBeneficiario: '0', cpfBeneficiarioServico: cpfBenef,
   indBeneficiarioNaoPossuiCPF: '0', cpfContribuinte: CPF_TITULAR,
   cpfDeclaranteIRPF: CPF_TITULAR].each { k, v -> setC(c, k, v) }
  colMes.add(c)
  c
}

// titular: janeiro 6.301,31 (trabalho nao assalariado) e marco 8.321,51 (transporte de carga)
def contasTit = fv(dec.getRendPFTitular(), 'contasAno')
novaConta(fv(contasTit, 'janeiro'), '1', '01/2025', '6.301,31', 'AJU RPF PAGADOR JANEIRO', CPF_TITULAR)
novaConta(fv(contasTit, 'marco'), '3', '03/2025', '8.321,51', 'AJU RPF PAGADOR MARCO', CPF_TITULAR)

// dependente: abril 3.401,61
// no dependente os meses ficam sob o objeto rendimentos, nao no item
def itemDep = dec.getRendPFDependente().itens()[0]
def contasDep = fv(fv(itemDep, 'rendimentos'), 'contasAno')
if (contasDep == null) {
  logs << 'SEM contasAno no item de dependente'
} else {
  novaConta(fv(contasDep, 'abril'), '4', '04/2025', '3.401,61', 'AJU RPF PAGADOR ABRIL DEP', CPF_DEP)
}

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO ${t.class.simpleName}: ${t.message}" }

repo.salvar(dec, path)
new File(path.replace('.xml', '.BKP')).bytes = new File(path).bytes

// confere relendo do disco
def d2 = new DeclaracaoIRPF(new IdentificadorDeclaracao(CPF_TITULAR, '0000000000'))
repo.preencheObjeto(d2, path, false)
def rt = d2.getRendPFTitular()
['janeiro', 'marco'].each { m ->
  def mes = fv(rt, m)
  println "titular ${m}: pessoaFisica='${fv(mes, 'pessoaFisica')}'"
}
def dp = d2.getRendPFDependente().itens()[0]
println "dependente abril: pessoaFisica='${fv(fv(fv(dp, 'rendimentos'), 'abril'), 'pessoaFisica')}'"
println "totalPessoaFisica titular = ${fv(rt, 'totalPessoaFisica')}"
def ci = d2.getResumo().getCalculoImposto()
println "saldoPagar=${fv(ci, 'saldoImpostoPagar')} baseCalculo=${fv(ci, 'baseCalculo')}"
def checarContas = { rot, colAno ->
  ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'].each { m ->
    fv(colAno, m)?.itens()?.each { c ->
      def vazios = (c.recuperarListaCamposPendencia() ?: []).findAll { it.isVazio() }
      println "  ${rot} ${m}: dataMesAno='${fv(c,'dataMesAno')}' valor='${fv(c,'valor')}' pendentes=${vazios.size()}"
    }
  }
}
checarContas('titular', fv(rt, 'contasAno'))
checarContas('dependente', fv(fv(dp, 'rendimentos'), 'contasAno'))
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
