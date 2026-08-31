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
def id = new IdentificadorDeclaracao('555.666.777-20', '0000000000')
def path = id.getPathArquivo().replaceFirst('^/', '')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, path, false)

def ident = dec.getIdentificadorDeclaracao()
// 1. reverte o nome: o PGD recusa a palavra ESPOLIO no nome do contribuinte
setC(ident, 'nome', 'AUDITORIA PDF TEC HERANCA')
setC(dec.getCopiaIdentificador(), 'nome', 'AUDITORIA PDF TEC HERANCA')
// 2. "Que tipo de declaracao voce deseja fazer?" e "Houve alteracao de dados cadastrais?"
setC(ident, 'declaracaoRetificadora', '0')
setC(ident, 'enderecoDiferente', '1')
setC(dec.getCopiaIdentificador(), 'declaracaoRetificadora', '0')
setC(dec.getCopiaIdentificador(), 'enderecoDiferente', '1')

// 3. Identificacao do Contribuinte do espolio, que estava inteiramente vazia
def c = dec.getContribuinte()
[dataNascimento: '11/01/1980', racaCor: '4', conjuge: '0', deficiente: 'N',
 tipoLogradouro: 'RUA', logradouro: 'SENTINELA ESP PES', numero: '5501', complemento: 'APTO 55',
 bairro: 'BAIRRO SENTINELA', pais: '105', uf: 'SP', municipio: '7107', cidade: 'SAO PAULO',
 cep: '01001-000', ddd: '11', telefone: '34567890',
 email: 'esp.auditoria@example.invalid'].each { k, v -> setC(c, k, v) }

// 4. Bens: indicador de prejuizo acumulado da Lei 14.754/2023
def bens = dec.getBens()
setC(bens, 'existePrejuizoLei14754', '0')
setC(bens, 'prejuizoAnoAnteriorLei14754', '0,00')

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO_AVISO|${t.class.simpleName}: ${t.message}" }

repo.salvar(dec, path)
new File(path.replace('.xml', '.BKP')).bytes = new File(path).bytes
println "ESP-01 salvo: nome=${ident.getNome()} AES=${ident.getTipoDeclaracaoAES()}"
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
