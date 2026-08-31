// Itens 18 e 19 do roteiro: Doacoes Diretamente na Declaracao, ECA e Pessoa Idosa.
// Autorizado pela usuaria em 30/08/2026, sob o compromisso de nunca abrir
// Declaracao > Imprimir > Darf. Preencher a ficha nao emite DARF: o proprio texto
// oficial do PGD situa a emissao naquele item de menu separado.
import serpro.ppgd.irpf.negocio.*
import serpro.ppgd.irpf.negocio.doacaodeclaracao.EstatutoCriancaAdolescente
import serpro.ppgd.irpf.negocio.doacaodeclaracao.EstatutoIdoso
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
def novo(Class k, colecao) {
  for (args in [[colecao] as Object[], [] as Object[]]) {
    for (ct in k.declaredConstructors) {
      if (ct.parameterCount != args.length) continue
      try { ct.accessible = true; return ct.newInstance(args) } catch (Throwable ignored) {}
    }
  }
  throw new IllegalStateException("sem construtor utilizavel para ${k.name}")
}

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao('111.444.777-35', '0000000000')
def path = id.getPathArquivo().replaceFirst('^/', '')
def dec = new DeclaracaoIRPF(id)
repo.preencheObjeto(dec, path, false)
def ident = dec.getIdentificadorDeclaracao()

def ci = dec.getResumo().getCalculoImposto()
println "antes: impostoDevido=${slot(ci, 'impostoDevido').get(ci)} deducaoIncentivo=${slot(ci, 'deducaoIncentivo').get(ci)}"

// Item 18: ECA, esfera Municipal, SP / SAO PAULO.
// CNPJ vindo da tabela oficial eca.xml do proprio PGD.
def eca = novo(EstatutoCriancaAdolescente, dec.getColecaoEstatutoCriancaAdolescente())
[tipoFundo: 'M', uf: 'SP', municipio: '7107', nomeMunicipio: 'SAO PAULO',
 cnpjFundo: '97.537.776/0001-87', valor: '301,45'].each { k, v -> setC(eca, k, v) }
dec.getColecaoEstatutoCriancaAdolescente().add(eca)

// Item 19: Pessoa Idosa, esfera Estadual, SP. CNPJ vindo de eidoso.xml.
def idoso = novo(EstatutoIdoso, dec.getColecaoEstatutoIdoso())
[tipoFundo: 'E', uf: 'SP', cnpjFundo: '17.087.890/0001-13', valor: '302,46'].each { k, v -> setC(idoso, k, v) }
dec.getColecaoEstatutoIdoso().add(idoso)

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO_AVISO|${t.class.simpleName}: ${t.message}" }

repo.salvar(dec, path)
new File(path.replace('.xml', '.BKP')).bytes = new File(path).bytes

def colEca = dec.getColecaoEstatutoCriancaAdolescente()
def colIdo = dec.getColecaoEstatutoIdoso()
println "ECA itens=${colEca.itens().size()} bruto=${slot(colEca, 'totalDeducaoIncentivoBruto').get(colEca)} liquido=${slot(colEca, 'totalDeducaoIncentivoLiquido').get(colEca)}"
println "IDOSO itens=${colIdo.itens().size()} bruto=${slot(colIdo, 'totalDeducaoIncentivoBruto').get(colIdo)} liquido=${slot(colIdo, 'totalDeducaoIncentivoLiquido').get(colIdo)}"
println "depois: impostoDevido=${slot(ci, 'impostoDevido').get(ci)} deducaoIncentivo=${slot(ci, 'deducaoIncentivo').get(ci)} saldoPagar=${slot(ci, 'saldoImpostoPagar').get(ci)}"
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
