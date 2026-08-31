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
def fv(obj, String name) { slot(obj, name).get(obj) }
def setC(obj, String name, value) {
  if (value == null) return
  def t = fv(obj, name)
  if (t == null) { logs << "NAO_EXIBIDO|${obj.getClass().simpleName}.${name}|campo nulo||${value}"; return }
  try { t.setConteudo(value.toString()) }
  catch (Throwable e) { logs << "RECUSADO|${obj.getClass().simpleName}.${name}|${e.message}||${value}" }
}

def cpfSai   = '999.000.111-12'
def cpfProc  = '101.202.303-64'
def cnpj     = '55.566.677/0001-83'
def spMun    = '7107'

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao(cpfSai, '0000000000')
def path = id.getPathArquivo().replaceFirst('^/','')
new File(path).parentFile.mkdirs()
def dec = new DeclaracaoIRPF(id)

def ident = dec.getIdentificadorDeclaracao()
[nome: 'AUDITORIA PDF TEC SAIDA', exercicio: '2026', tipoDeclaracao: '0', tipoDeclaracaoAES: 'S',
 declaracaoRetificadora: '0', transmitida: '0', numReciboTransmitido: '0000000000',
 enderecoDiferente: '1', prepreenchida: '0', inUtilizouPGD: '1', inNovaDeclaracao: '1',
 tpIniciada: '01', versaoBeta: 'N'].each { k, v -> setC(ident, k, v) }
setC(dec.getCopiaIdentificador(), 'nome', 'AUDITORIA PDF TEC SAIDA')
setC(dec.getCopiaIdentificador(), 'enderecoDiferente', '1')

// 1. Identificacao do contribuinte, com endereco no exterior
def c = dec.getContribuinte()
[dataNascimento: '11/01/1980', racaCor: '4', conjuge: '2', deficiente: 'N',
 naturezaOcupacao: '12', ocupacaoPrincipal: '391',
 exterior: '1', pais: '249',
 logradouroExt: 'AUDIT EXIT AVENUE', numeroExt: '4201', complementoExt: 'SUITE 42',
 bairroExt: 'DOWNTOWN', cepExt: '33101', codigoExterior: 'MIAMI / FL',
 ddi: '1', telefoneExt: '3055554202',
 email: 'sai.auditoria@example.invalid',
 tipoLogradouro: 'RUA', logradouro: 'SENTINELA SAI', numero: '4202',
 bairro: 'BAIRRO SENTINELA', uf: 'SP', municipio: spMun, cidade: 'SAO PAULO', cep: '01001-000',
 ddd: '11', telefone: '34567890'].each { k, v -> setC(c, k, v) }

// 2. Ficha Saida Definitiva do Pais
def s = dec.getSaida()
[dtCondicaoNaoResidente: '24/12/2025', paisResidencia: '249',
 nomeProcurador: 'SAI PROCURADOR SENTINELA', cpfProcurador: cpfProc,
 endProcurador: '4201 AUDIT EXIT AVENUE, SUITE 42, MIAMI/FL, 33101'].each { k, v -> setC(s, k, v) }

// 3. Uma fonte pagadora
def rpj = new serpro.ppgd.irpf.negocio.rendpj.RendPJTitular(ident)
[NIFontePagadora: cnpj, nomeFontePagadora: 'SAI RPJ FONTE TITULAR', rendRecebidoPJ: '43.201,11',
 contribuicaoPrevOficial: '4.202,12', impostoRetidoFonte: '3.203,13',
 decimoTerceiro: '3.604,14', IRRFDecimoTerceiro: '304,15'].each { k, v -> setC(rpj, k, v) }

dec.getColecaoRendPJTitular().add(rpj)

// 4. Um bem no Brasil e um bem no exterior
def bens = dec.getBens()
def bemBR = new serpro.ppgd.irpf.negocio.bens.Bem(ident, dec)
[grupo: '01', codigo: '11', pais: '105', tipo: 'T', registrado: '1',
 discriminacao: 'SAI BEM IMOVEL BRASIL SENTINELA, adquirido em 25/05/2025, matricula 44001.',
 logradouro: 'SAI BEM IMOVEL', numero: '4401', complemento: 'APTO 44', bairro: 'BAIRRO SENTINELA',
 cep: '01001-000', uf: 'SP', municipio: spMun, matricula: '44001', registroBem: 'SAI-IPTU-4401',
 areaTotal: '44,4', dataAquisicao: '25/05/2025',
 valorExercicioAnterior: '0,00', valorExercicioAtual: '144.401,41'].each { k, v -> setC(bemBR, k, v) }
setC(bemBR, 'indice', '00001')
bens.add(bemBR)

def bemEX = new serpro.ppgd.irpf.negocio.bens.Bem(ident, dec)
[grupo: '04', codigo: '02', pais: '249', tipo: 'T', registrado: '2', unidade: '2',
 discriminacao: 'SAI BEM EXTERIOR CONTA SENTINELA MOEDA USD',
 valorExercicioAnterior: '24.402,42', valorExercicioAtual: '35.403,43',
 lucroPrejuizo: '2.404,44', impostoPagoExterior: '404,45'].each { k, v -> setC(bemEX, k, v) }
setC(bemEX, 'indice', '00002')
bens.add(bemEX)

try {
  dec.adicionaObservadoresCalculos(); dec.adicionaObservadoresCalculosLate()
  dec.adicionaValidadoresEspeciais(); dec.recalcularDeclaracao()
} catch (Throwable t) { logs << "RECALCULO_AVISO|Declaracao|recalcularDeclaracao|${t.class.simpleName}: ${t.message}|salvo assim mesmo" }

repo.salvar(dec, path)
new File(path.replace('.xml','.BKP')).bytes = new File(path).bytes

println "XML salvo: ${path}"
println "nome=${ident.getNome()} AES=${ident.getTipoDeclaracaoAES()} isSaida=${ident.isSaida()}"
println "RendPJ titular=${dec.getColecaoRendPJTitular().itens().size()} Bens=${bens.itens().size()}"
println "saida vazia? " + dec.getSaida().isVazio()
println "--- ocorrencias (${logs.size()})"
logs.each { println "  ${it}" }
