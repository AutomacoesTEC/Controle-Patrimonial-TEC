// Corrige as pendencias do demonstrativo sintetico GCAP 2025 e reverifica
// pelo proprio verificador do programa (verificarPendencias).
import br.gov.serpro.gcap.entidades.IdDemonstrativoGCAP
import br.gov.serpro.gcap.entidades.alienacao.ParcelaAlienacaoBem
import br.gov.serpro.gcap.negocio.RepositorioXMLGCAP
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

logs = []
def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  return null
}
def fv(obj, String name) { slot(obj, name)?.get(obj) }
def setC(obj, String name, value) {
  def s = slot(obj, name)
  if (s == null) { logs << "SEM CAMPO ${obj.getClass().simpleName}.${name}"; return }
  def t = s.get(obj)
  if (t == null) { logs << "NULO ${obj.getClass().simpleName}.${name}"; return }
  try { t.setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO ${obj.getClass().simpleName}.${name}=${value}: ${e.message}" }
}

def id = new IdDemonstrativoGCAP()
[cpf: '111.444.777-35', nome: 'AUDITORIA PDF TEC AJUSTE', exercicio: '2026',
 dataInicioPermanencia: '01/01/2025', dataFimPermanencia: '31/12/2025',
 paisDeclarante: '105', dddDeclarante: '11', telefoneDeclarante: '34567890',
 territorioParaisoFiscal: '0'].each { k, v -> setC(id, k, v) }
def rep = new RepositorioXMLGCAP()
def dem = rep.abreDeclaracaoSemUI(id)
dem.adicionarObservadoresPosAbertura()
dem.adicionaObservadoresCalculosLate()

// ---- imovel
def imovel = dem.getBensImoveis().itens()[0]
def aq = fv(fv(imovel, 'bemImovel'), 'aquisicao')
setC(aq, 'houveReforma', '0')
setC(aq, 'houveReformaAux', '0')
setC(aq, 'bemAtualizado', '0')
// o custo de aquisicao do imovel e' composto por parcelas; sem a parcela o
// programa nao transporta o custo para a ficha Apuracao
def parcAq = fv(aq, 'parcelasAquisicao')
while (parcAq.itens().size() > 0) { try { parcAq.remove(0) } catch (Throwable t) { parcAq.itens().remove(0) } }
def pa = new br.gov.serpro.gcap.entidades.aquisicao.ParcelaAquisicao()
setC(pa, 'data', '18/08/2018')
setC(pa, 'custoAquisicao', '100.601,41')
parcAq.add(pa)

// ---- movel: parcelas somam o valor LIQUIDO (bruto menos corretagem), nao o bruto
def movel = dem.getBensMoveis().itens()[0]
setC(movel, 'temUltimaParcela', '1')
def parcelas = fv(movel, 'colecaoParcelaAlienacao')
while (parcelas.itens().size() > 0) { try { parcelas.remove(0) } catch (Throwable t) { parcelas.itens().remove(0) } }
[['19/09/2025', '0'], ['19/10/2025', '0'], ['19/11/2025', '1']].each { d, ultima ->
  def pc = new ParcelaAlienacaoBem()
  setC(pc, 'dataRecebimento', d)
  setC(pc, 'valorRecebido', '13.666,33')
  setC(pc, 'valorRecebidoReal', '13.666,33')
  setC(pc, 'ultimaParcela', ultima)
  parcelas.add(pc)
}

// ---- participacao societaria
// a natureza da participacao societaria tem dominio proprio: 14 = Alienacoes,
// resgates e outras transferencias. O codigo 1 (Venda) e' do imovel/movel e o
// PGD descartava silenciosamente.
def psoc = dem.getParticipacoesSocietarias().itens()[0]
setC(psoc, 'natureza', '14')
// nao houve alienacao anterior desta participacao, entao a pergunta de alienacao
// parcial e' respondida Nao; o percentual do roteiro esta na quantidade de quotas
setC(psoc, 'alienacaoParcial', '0')
setC(psoc, 'ganhoCapitalAlienacaoAnterior', '0,00')
def pAq = fv(psoc, 'colecaoParcelaAquisicaoParticipacaoSocietaria').itens()[0]
// dominio proprio, derivado da especie da participacao: 3 = Quota.
// O codigo Q, valido em ParticipacaoSocietaria.especie, era descartado em silencio.
setC(pAq, 'especieAquisicao', '3')
// custo medio ajustado para que 1.234 quotas fechem exatamente os 40.621,47 do roteiro
setC(pAq, 'custoMedio', '32,918534')

// ---- moeda em especie: tipo de operacao e' codigo, 1 compra e 2 venda
def moeda = dem.getMoedasAlienadas().itens()[0]
def op = fv(moeda, 'operacoesEspecie').itens()[0]
setC(op, 'tipo', '2')
// o roteiro nao fornece cotacao; usada a taxa implicita nos proprios valores dele:
// 8.632,51 / 1.234,56 USD
setC(op, 'cotacaoDolar', '6,9923779')

try {
  dem.recalcularAlienacoes()
  dem.atualizarCalculoFaixasImposto()
} catch (Throwable t) { logs << "RECALCULO ${t.class.simpleName}: ${t.message}" }

def path = id.getPathArquivo().replaceFirst('^/', '')
RepositorioXMLDefault.getInstancia().salvar(dem, path)
println "salvo: ${path}"
logs.each { println "  LOG ${it}" }

// ---- reverificacao pelo verificador oficial
int total = 0
[imovel: dem.getBensImoveis(), movel: dem.getBensMoveis(),
 psoc: dem.getParticipacoesSocietarias(), moeda: dem.getMoedasAlienadas()].each { rot, col ->
  col.itens().each { al ->
    def vistos = [] as Set
    (al.verificarPendencias(0) ?: []).each { p ->
      def msg = p.getMsg()
      def chave = "${msg}"
      if (vistos.add(chave)) {
        total++
        def det = msg?.trim() ? msg : "[sem texto] aba=${p.getNomeAba()} descr=${p.getDescricaoCampo()} valor='${p.getCampoInformacao()}'"
        println "  PENDENCIA ${rot}: ${det}"
      }
    }
  }
}
println "TOTAL PENDENCIAS = ${total}"

// conferencia dos calculos
def mostra = { rot, al ->
  def ap = fv(al, 'apuracao')
  println "  ${rot}: custoAquisicao=${fv(ap, 'custoAquisicao')} valorAlienacao=${fv(ap, 'valorAlienacao')} " +
          "corretagem=${fv(ap, 'custoCorretagem')} ganhoCapital1=${fv(ap, 'ganhoCapital1')}"
}
println "\n== apuracoes"
mostra('imovel', dem.getBensImoveis().itens()[0])
mostra('movel', dem.getBensMoveis().itens()[0])
mostra('psoc', dem.getParticipacoesSocietarias().itens()[0])
def mo = dem.getMoedasAlienadas()
println "  moeda: ganhoCapitalTotal=${fv(mo, 'ganhoCapitalTotal')} impostoDevido=${fv(mo, 'impostoDevido')}"
