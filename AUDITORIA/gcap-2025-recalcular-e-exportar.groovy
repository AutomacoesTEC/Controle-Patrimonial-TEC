import br.gov.serpro.gcap.entidades.*
import br.gov.serpro.gcap.negocio.GCAPFacade
import br.gov.serpro.gcap.negocio.RepositorioXMLGCAP
import br.gov.serpro.gcap.txt.gravacaorestauracao.GravadorCopiaSeguranca
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  return null
}
def rep = new RepositorioXMLGCAP()
def setC(obj, String name, value) {
  def f = slot(obj, name); f.get(obj).setConteudo(value)
}
def id = new IdDemonstrativoGCAP()
[cpf: '111.444.777-35', nome: 'AUDITORIA PDF TEC AJUSTE', exercicio: '2026',
 dataInicioPermanencia: '01/01/2025', dataFimPermanencia: '31/12/2025',
 paisDeclarante: '105', dddDeclarante: '11', telefoneDeclarante: '34567890',
 territorioParaisoFiscal: '0'].each { k, v -> setC(id, k, v) }
println "  id: cpf=${id.getCpf()} nome=${id.getNome()} path=${id.getPathArquivo()}"

def dem = rep.abreDeclaracaoSemUI(id)
println "aberta: ${dem?.getClass()?.simpleName}"
dem.adicionarObservadoresPosAbertura()
dem.adicionaObservadoresCalculosLate()
dem.recalcularAlienacoes()
dem.atualizarCalculoFaixasImposto()

def bi = dem.getBensImoveis()
def bm = dem.getBensMoveis()
def ps = dem.getParticipacoesSocietarias()
def mo = dem.getMoedasAlienadas()
[imoveis: bi, moveis: bm, psoc: ps, moedas: mo].each { nome, col ->
  def f = slot(col, 'totalImpostoTotal') ?: slot(col, 'impostoDevido') ?: slot(col, 'ganhoCapitalTotal')
  println "  ${nome}: itens=${col.itens().size()} imposto=${f ? f.get(col) : '?'}"
}
def apI = slot(bi.itens()[0], 'apuracao').get(bi.itens()[0])
println "  apuracao imovel ganhoCapital1=${slot(apI, 'ganhoCapital1')?.get(apI)} custoAquisicao=${slot(apI, 'custoAquisicao')?.get(apI)}"
def apP = slot(ps.itens()[0], 'apuracao').get(ps.itens()[0])
println "  apuracao psoc custoAquisicao=${slot(apP, 'custoAquisicao')?.get(apP)} ganhoCapital1=${slot(apP, 'ganhoCapital1')?.get(apP)}"

def path = id.getPathArquivo().replaceFirst('^/', '')
RepositorioXMLDefault.getInstancia().salvar(dem, path)
def destino = new File(args[0])
destino.parentFile?.mkdirs()
new GravadorCopiaSeguranca().exportarParaIRPF(destino, id)
println "DEC: ${destino.exists()} tam=${destino.length()}"
