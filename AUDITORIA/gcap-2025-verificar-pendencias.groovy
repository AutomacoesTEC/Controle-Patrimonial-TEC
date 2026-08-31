import br.gov.serpro.gcap.entidades.IdDemonstrativoGCAP
import br.gov.serpro.gcap.negocio.RepositorioXMLGCAP

def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  return null
}
def id = new IdDemonstrativoGCAP()
[cpf: '111.444.777-35', nome: 'AUDITORIA PDF TEC AJUSTE', exercicio: '2026',
 dataInicioPermanencia: '01/01/2025', dataFimPermanencia: '31/12/2025',
 paisDeclarante: '105', dddDeclarante: '11', telefoneDeclarante: '34567890',
 territorioParaisoFiscal: '0'].each { k, v -> slot(id, k).get(id).setConteudo(v) }

def rep = new RepositorioXMLGCAP()
def dem = rep.abreDeclaracaoSemUI(id)
dem.adicionarObservadoresPosAbertura()
dem.adicionaObservadoresCalculosLate()
dem.recalcularAlienacoes()

int erros = 0, avisos = 0, sev0 = 0
[imovel: dem.getBensImoveis(), movel: dem.getBensMoveis(),
 psoc: dem.getParticipacoesSocietarias(), moeda: dem.getMoedasAlienadas()].each { rot, col ->
  col.itens().each { al ->
    def vistos = [] as Set
    (al.verificarPendencias(0) ?: []).each { p ->
      def msg = p.getMsg()
      if (!vistos.add("${msg}")) return
      def sev = p.getSeveridade()
      if (sev == 0) { sev0++ } else if (p.isErro()) { erros++ } else { avisos++ }
      println "  ${rot}: severidade=${sev} erro=${p.isErro()} msg='${msg?.trim() ? msg : '(sem texto)'}'"
    }
  }
}
println "\nERROS=${erros}  AVISOS=${avisos}  SEVERIDADE_ZERO=${sev0}"
