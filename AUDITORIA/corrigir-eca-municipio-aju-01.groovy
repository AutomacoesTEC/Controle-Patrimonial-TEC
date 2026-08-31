// O campo municipio da ficha Doacoes Diretamente na Declaracao - ECA nao usa o
// codigo IBGE do municipio: a chave do dominio e' o CNPJ do fundo municipal.
// Sao Paulo = 97.537.776/0001-87, vindo da tabela oficial eca.xml.
import serpro.ppgd.irpf.negocio.*
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

logs = []
def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  return null
}
def setC(obj, String name, value) {
  def s = slot(obj, name)
  if (s == null) { logs << "SEM CAMPO ${obj.getClass().simpleName}.${name}"; return }
  try { s.get(obj).setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO ${obj.getClass().simpleName}.${name}=${value}: ${e.message}" }
}

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao('111.444.777-35', '0000000000')
def path = id.getPathArquivo().replaceFirst('^/', '')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, path, false)

def item = dec.getColecaoEstatutoCriancaAdolescente().itens()[0]
setC(item, 'municipio', '97.537.776/0001-87')
setC(item, 'nomeMunicipio', 'SAO PAULO')
setC(item, 'cnpjFundo', '97.537.776/0001-87')

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO ${t.class.simpleName}: ${t.message}" }

repo.salvar(dec, path)
new File(path.replace('.xml', '.BKP')).bytes = new File(path).bytes

// confere relendo do disco, porque valor recusado so aparece depois de gravar
def dec2 = new DeclaracaoIRPF(new IdentificadorDeclaracao('111.444.777-35', '0000000000'))
repo.preencheObjeto(dec2, path, false)
def it2 = dec2.getColecaoEstatutoCriancaAdolescente().itens()[0]
println "apos gravar e reler:"
['tipoFundo', 'uf', 'municipio', 'nomeMunicipio', 'cnpjFundo', 'valor', 'dvNumeroReferencia'].each {
  println "   ${it} = '${slot(it2, it).get(it2)}'"
}
def ido = dec2.getColecaoEstatutoIdoso().itens()[0]
println "idoso: uf='${slot(ido, 'uf').get(ido)}' cnpj='${slot(ido, 'cnpjFundo').get(ido)}' valor='${slot(ido, 'valor').get(ido)}'"
def ci = dec2.getResumo().getCalculoImposto()
println "deducaoIncentivo=${slot(ci, 'deducaoIncentivo').get(ci)} saldoPagar=${slot(ci, 'saldoImpostoPagar').get(ci)}"
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
