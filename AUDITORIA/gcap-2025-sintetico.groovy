// Itens 29 a 32 do roteiro: cria o demonstrativo sintetico no GCAP 2025 pelas
// classes oficiais do proprio programa e exporta o .DEC para importacao no IRPF.
// Nenhum valor e' inventado fora dos sentinelas do roteiro; nenhum DARF e' emitido.
import br.gov.serpro.gcap.entidades.*
import br.gov.serpro.gcap.entidades.adquirente.Adquirente
import br.gov.serpro.gcap.entidades.alienacao.*
import br.gov.serpro.gcap.entidades.especie.*
import br.gov.serpro.gcap.entidades.psocietarias.*
import br.gov.serpro.gcap.negocio.GCAPFacade
import br.gov.serpro.gcap.txt.gravacaorestauracao.GravadorCopiaSeguranca
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

def logs = []
def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  throw new IllegalArgumentException("Campo nao encontrado: ${obj.getClass().name}.${name}")
}
def fv(obj, String name) { slot(obj, name).get(obj) }
def setC(obj, String name, value) {
  if (value == null) return
  def t = fv(obj, name)
  if (t == null) { logs << "NULO|${obj.getClass().simpleName}.${name}"; return }
  try { t.setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO|${obj.getClass().simpleName}.${name}|${e.message}|${value}" }
}
def preencher(obj, Map m) { m.each { k, v -> setC(obj, k, v) }; obj }
// alguns campos sao redeclarados na subclasse; este setter mira a classe declarante
def setCEm(obj, Class declarante, String name, value) {
  def f = declarante.getDeclaredField(name); f.accessible = true
  f.get(obj).setConteudo(value.toString())
}

def CPF_TITULAR = '111.444.777-35'
def CPF_CONJUGE = '222.333.444-05'
def CNPJ = '55.566.677/0001-83'

def id = new IdDemonstrativoGCAP()
// dataInicioPermanencia e dataFimPermanencia definem o trecho 0101-3112 do nome do .DEC
preencher(id, [cpf: CPF_TITULAR, nome: 'AUDITORIA PDF TEC AJUSTE', exercicio: '2026',
               dataInicioPermanencia: '01/01/2025', dataFimPermanencia: '31/12/2025',
               paisDeclarante: '105', dddDeclarante: '11', telefoneDeclarante: '34567890',
               territorioParaisoFiscal: '0'])
def dem = new DemonstrativoGCAP(id)
GCAPFacade.abreDeclaracao(dem)
dem.adicionarObservadoresPosAbertura()
dem.adicionaObservadoresCalculosLate()

// ---- Item 29: alienacao de bem imovel
def gci = new AlienacaoBemImovel()
preencher(gci, [natureza: '1', dataAlienacao: '18/08/2025', valorAlienacao: '160.602,42',
                custoCorretagem: '5.603,43', alienacaoAPrazo: '0', alienacaoParcial: '0',
                residenteBrasil: '1', numeroItem: '1'])
def imovel = fv(gci, 'bemImovel')
preencher(imovel, [especificacao: 'AJU GCI IMOVEL URBANO SENTINELA', bemAdquiridoNoBrasil: '1'])
preencher(fv(imovel, 'endereco'),
          [tipoLogradouro: 'RUA', logradouro: 'AJU GCI IMOVEL', numero: '2901',
           complemento: 'APTO 29', bairro: 'BAIRRO SENTINELA', uf: 'SP', municipio: '7107',
           cep: '01001-000'])
preencher(fv(imovel, 'aquisicao'), [dataAquisicao: '18/08/2018', custoAquisicao: '100.601,41'])
preencher(fv(gci, 'perguntas'),
          [imovelResidencial: '0', imovelResidencialAux: '0',
           propriedadeOutroImovel: '1', propriedadeOutroImovelAux: '1',
           outraAlienacao: '1', outraAlienacaoAux: '1'])
fv(imovel, 'adquirentes').add(preencher(new Adquirente(), [nome: 'AJU GCI ADQUIRENTE', cpfCnpj: CPF_CONJUGE]))
dem.getBensImoveis().add(gci)

// ---- Item 30: alienacao de bem movel, a prazo em 3 parcelas
def gcm = new AlienacaoBemMovel()
preencher(gcm, [natureza: '1', dataAlienacao: '19/09/2025', valorAlienacao: '42.612,45',
                custoCorretagem: '1.613,46', alienacaoAPrazo: '1', alienacaoParcial: '0',
                residenteBrasil: '1', numeroItem: '1'])
def movel = fv(gcm, 'bemMovel')
preencher(movel, [especificacao: 'AJU GCM VEICULO SENTINELA', bemAdquiridoNoBrasil: '1',
                  sujeitoRegistroPublico: '1', sujeitoRegistroPublicoAux: '1'])
preencher(fv(movel, 'aquisicao'), [dataAquisicao: '19/09/2022', custoAquisicao: '30.611,44'])
fv(movel, 'adquirentes').add(preencher(new Adquirente(), [nome: 'AJU GCM ADQUIRENTE', cpfCnpj: CPF_CONJUGE]))
def parcelas = fv(gcm, 'colecaoParcelaAlienacao')
['19/09/2025', '19/10/2025', '19/11/2025'].each { d ->
  def pc = new ParcelaAlienacaoBem()
  preencher(pc, [dataRecebimento: d, valorRecebido: '14.204,15', valorRecebidoReal: '14.204,15'])
  parcelas.add(pc)
}
dem.getBensMoveis().add(gcm)

// ---- Item 31: alienacao de participacao societaria
def gcp = new AlienacaoParticipacaoSocietaria()
preencher(gcp, [natureza: '1', dataAlienacao: '20/10/2025', valorAlienacao: '70.622,48',
                custoCorretagem: '2.623,49', alienacaoAPrazo: '0', alienacaoParcial: '1',
                residenteBrasil: '1', numeroItem: '1'])
preencher(fv(gcp, 'participacaoSocietaria'),
          [nome: 'AJU GCP EMPRESA SENTINELA', cnpj: CNPJ, especie: 'Q', uf: 'SP', municipio: '7107'])
fv(gcp, 'adquirentes').add(preencher(new Adquirente(), [nome: 'AJU GCP ADQUIRENTE', cpfCnpj: CPF_CONJUGE]))
def opsPS = fv(gcp, 'colecaoParcelaAquisicaoParticipacaoSocietaria')
def pAq = preencher(new ParcelaAquisicaoParticipacaoSocietaria(),
                    [data: '20/10/2019', quantidadeQuotas: '1234'])
setCEm(pAq, br.gov.serpro.gcap.entidades.aquisicao.ParcelaAquisicao, 'custoAquisicao', '40.621,47')
setCEm(pAq, ParcelaAquisicaoParticipacaoSocietaria, 'custoAquisicao', '40.621,47')
opsPS.add(pAq)
dem.getParticipacoesSocietarias().add(gcp)

// ---- Item 32: moeda estrangeira em especie
def ma = new MoedaAlienada()
preencher(ma, [moeda: 'USA', estoqueInicial: '1.234,56', saldoInicial: '6.631,50',
               custoMedioInicial: '5,3714', numeroItem: '1'])
def ops = fv(ma, 'operacoesEspecie')
ops.add(preencher(new OperacaoEspecie(),
                  [tipo: 'L', data: '21/11/2025', quantidade: '1.234,56', valor: '8.632,51',
                   niAdquirente: CPF_CONJUGE, nomeAdquirente: 'AJU GCE ADQUIRENTE']))
dem.getMoedasAlienadas().add(ma)

try {
  dem.recalcularAlienacoes()
  dem.atualizarCalculoFaixasImposto()
} catch (Throwable t) { logs << "RECALCULO_AVISO|${t.class.simpleName}: ${t.message}" }

GCAPFacade.criarDeclaracao(dem)
def pathDem = id.getPathArquivo().replaceFirst('^/', '')
new File(pathDem).parentFile?.mkdirs()
RepositorioXMLDefault.getInstancia().salvar(dem, pathDem)
println "demonstrativo salvo: ${pathDem} tam=${new File(pathDem).length()}"

println "imoveis=${dem.getBensImoveis().itens().size()} moveis=${dem.getBensMoveis().itens().size()} psoc=${dem.getParticipacoesSocietarias().itens().size()} moedas=${dem.getMoedasAlienadas().itens().size()}"

// ---- exportacao para o IRPF, pelo mesmo metodo do menu Exportar para IRPF
def destino = new File(args[0])
destino.parentFile?.mkdirs()
new GravadorCopiaSeguranca().exportarParaIRPF(destino, id)
println "DEC gerado: ${destino} existe=${destino.exists()} tam=${destino.exists() ? destino.length() : 0}"
destino.parentFile.listFiles().each { println "   ${it.name} ${it.length()}" }
println "ocorrencias=${logs.size()}"
logs.each { println "  ${it}" }
