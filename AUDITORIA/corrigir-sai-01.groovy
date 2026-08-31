import serpro.ppgd.irpf.negocio.*
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

def logs = []
def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  throw new IllegalArgumentException("Campo nao encontrado: ${obj.getClass().name}.${name}")
}
def setC(obj, String name, value) {
  def t = slot(obj, name).get(obj)
  if (t == null) { logs << "NULO|${obj.getClass().simpleName}.${name}"; return }
  try { t.setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO|${obj.getClass().simpleName}.${name}|${e.message}|${value}" }
}

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao('999.000.111-12', '0000000000')
def path = id.getPathArquivo().replaceFirst('^/', '')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, path, false)

// 1. Possui conjuge: o valor 2 estava fora do dominio aceito
def c = dec.getContribuinte()
setC(c, 'conjuge', '0')
// 2. Codigo do Exterior: e' o codigo da reparticao consular, nao texto livre.
//    294 = Miami, Estados Unidos da America - Consulado do Brasil
setC(c, 'codigoExterior', '294')

// 3. Data de comunicacao da condicao de nao residente a fonte pagadora
def rpj = dec.getColecaoRendPJTitular().itens()[0]
setC(rpj, 'dataComunicacaoSaida', '24/12/2025')

// 4. Informacoes bancarias: a SAI-01 apurou imposto a restituir
def ci = dec.getResumo().getCalculoImposto()
[banco: '001', agencia: '2303', contaCredito: '240024', dvContaCredito: '5'].each { k, v -> setC(ci, k, v) }

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO_AVISO|${t.class.simpleName}: ${t.message}" }

repo.salvar(dec, path)
new File(path.replace('.xml', '.BKP')).bytes = new File(path).bytes
println "SAI-01 salvo"
println "  conjuge=${slot(c, 'conjuge').get(c)} codigoExterior=${slot(c, 'codigoExterior').get(c)}"
println "  dataComunicacaoSaida=${slot(rpj, 'dataComunicacaoSaida').get(rpj)}"
println "  banco=${slot(ci, 'banco').get(ci)} ag=${slot(ci, 'agencia').get(ci)} conta=${slot(ci, 'contaCredito').get(ci)}-${slot(ci, 'dvContaCredito').get(ci)}"
println "  impostoRestituir=${slot(ci, 'impostoRestituir').get(ci)}"
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
