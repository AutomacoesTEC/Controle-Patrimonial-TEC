// RUR-01: declaração sintética mínima criada para fechar A ÚNICA lacuna de
// extração que sobrou: o participante de imóvel rural ESTRANGEIRO, que não tem
// CPF. Nenhum dos três PDFs de gabarito (AJU-01, ESP-01, SAI-01) tem um, então
// o ramo `estrangeiro = true` do parser nunca foi exercitado contra documento
// oficial impresso.
//
// POR QUE UMA DECLARAÇÃO NOVA, e não um participante a mais na AJU-01:
// acrescentar uma linha na ficha rural da AJU-01 empurra o conteúdo das
// páginas seguintes, e dezenas de testes citam página e linha exatas dela
// (p7 r30, p11 r46, p40 r29 e por aí). Um caso próprio e pequeno não mexe em
// gabarito nenhum.
//
// O QUE ESTE SCRIPT FAZ (sem interface, mesma técnica dos demais desta pasta):
// cria a declaração no PGD com identificação mínima e UM imóvel rural em
// condomínio com DOIS participantes, um brasileiro com CPF e um estrangeiro
// sem CPF, que é o par que prova a distinção.
//
// O QUE ELE NÃO FAZ, e não tem como: gerar o PDF. Ver
// OCORRENCIAS-PREENCHIMENTO-IRPF-2026.md, seção "Por que importação e
// impressão exigem a interface do IRPF": no IRPF dá para preencher e calcular
// sem janela, mas abrir e imprimir exigem a interface. Depois de rodar isto, o
// PDF precisa ser exportado pela janela Impressão do próprio programa.
//
// Uso, no PowerShell do Windows, com o IRPF 2026 FECHADO:
//   $rfb = "C:\Arquivos de Programas RFB\IRPF2026"
//   & "$rfb\jre\bin\java.exe" -cp "$rfb\lib\*;$rfb\lib-modulos\*;$rfb\irpf.jar" `
//       groovy.ui.GroovyMain preencher-rur-01-estrangeiro.groovy

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
def addIndexed(colecao, item) { colecao.add(item) }

// CPF sintético novo, com dígitos verificadores válidos, sem colisão com os
// casos já existentes. Existe só para satisfazer a validação local do PGD.
def cpfTitular = '777.000.111-09'
def cpfParticipanteBr = '121.314.151-68'
def uberabaMunicipio = '5401'

def repo = RepositorioXMLDefault.getInstancia()
def id = new IdentificadorDeclaracao(cpfTitular, '0000000000')
def path = id.getPathArquivo().replaceFirst('^/','')
new File(path).parentFile.mkdirs()
def dec = new DeclaracaoIRPF(id)

def ident = dec.getIdentificadorDeclaracao()
[nome: 'AUDITORIA PDF TEC RURAL', exercicio: '2026', tipoDeclaracao: '0', tipoDeclaracaoAES: 'A',
 declaracaoRetificadora: '0', transmitida: '0', numReciboTransmitido: '0000000000',
 prepreenchida: '0', inUtilizouPGD: '1', inNovaDeclaracao: '1',
 tpIniciada: '01', versaoBeta: 'N'].each { k, v -> setC(ident, k, v) }
setC(dec.getCopiaIdentificador(), 'nome', 'AUDITORIA PDF TEC RURAL')

def c = dec.getContribuinte()
[dataNascimento: '11/01/1980', racaCor: '4', conjuge: '0', deficiente: 'N',
 naturezaOcupacao: '12', ocupacaoPrincipal: '391',
 logradouro: 'ESTRADA RUR SENTINELA', numero: '7701', bairro: 'ZONA RURAL',
 municipio: uberabaMunicipio, uf: 'MG', cep: '38000-000',
 email: 'rur.auditoria@example.invalid'].each { k, v -> setC(c, k, v) }

// Atividade rural no Brasil: um imóvel em CONDOMÍNIO, que é a condição que
// justifica ter participantes, com o par que interessa ao teste.
def arBrasil = fv(dec, 'atividadeRuralBrasil')
def imBr = new serpro.ppgd.irpf.negocio.atividaderural.brasil.ImovelARBrasil()
[codigo: '11', nome: 'RUR FAZENDA SENTINELA', localizacao: 'ESTRADA RUR SENTINELA KM 77 - UBERABA/MG - CEP 38000-000',
 area: '200,00', participacao: '50,00', condicaoExploracao: '2', cib: '1234567-8'].each { k, v -> setC(imBr, k, v) }

// Participante 1: brasileiro, COM CPF.
def partBr = new serpro.ppgd.irpf.negocio.atividaderural.ParticipanteImovelAR()
[ni: cpfParticipanteBr, nome: 'RUR PARTICIPANTE BRASILEIRO', estrangeiro: '0', indice: '00001']
  .each { k, v -> setC(partBr, k, v) }
fv(imBr, 'participantesImovelAR').add(partBr)

// Participante 2: ESTRANGEIRO, SEM CPF. É esta linha que o parser precisa
// aprender a ler, e que hoje nenhum PDF de gabarito tem.
def partEx = new serpro.ppgd.irpf.negocio.atividaderural.ParticipanteImovelAR()
[ni: '', nome: 'RUR PARTICIPANTE ESTRANGEIRO', estrangeiro: '1', indice: '00002']
  .each { k, v -> setC(partEx, k, v) }
fv(imBr, 'participantesImovelAR').add(partEx)

addIndexed(fv(arBrasil, 'identificacaoImovel'), imBr)

// Receita e despesa mínimas, só para a ficha não sair "Sem Informações" e o
// anexo rural ser efetivamente impresso.
def recBr = fv(arBrasil, 'receitasDespesas')
setC(fv(recBr, 'janeiro'), 'receitaBrutaMensal', '77.001,01')
setC(fv(recBr, 'janeiro'), 'despesaCusteioInvestimento', '11.002,02')

dec.calcular()
repo.grava(dec)

println "RUR-01 gravada em: ${path}"
if (logs) { println 'OCORRENCIAS:'; logs.each { println '  ' + it } }
else { println 'Sem ocorrencias de campo recusado ou nao exibido.' }
println ''
println 'PROXIMO PASSO, que exige a interface do IRPF 2026:'
println '  1. Abrir o programa e localizar a declaracao AUDITORIA PDF TEC RURAL.'
println '  2. Conferir a ficha Atividade Rural, imovel em condominio, dois participantes.'
println '  3. Imprimir/exportar o PDF e salvar em output/pdf/RUR-01-PARTICIPANTE-ESTRANGEIRO-IRPF-2026.pdf'
