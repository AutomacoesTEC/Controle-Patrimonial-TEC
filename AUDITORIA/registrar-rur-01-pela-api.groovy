// Registra a declaração RUR-01 no cadastro do IRPF 2026 PELA API do programa.
//
// POR QUE ESTE SCRIPT EXISTE. Em 31/08/2026 eu registrei a RUR-01 editando o
// iddeclaracoes.xml com um script de texto. Cada XML do PGD tem um `.conf` ao
// lado com um hash de integridade, validado na ABERTURA do programa: o par
// ficou inconsistente e o IRPF 2026 parou de abrir, com HashInvalidoException
// e sem mensagem na tela. Ver HANDOFF-2026-08-31-SESSAO-TELAS.md, seção 1.
//
// A forma correta é a que este script usa: carregar a ColecaoIdDeclaracao pelo
// repositório, acrescentar o IdentificadorDeclaracao e salvar por
// RepositorioXMLDefault.salvar, que regrava o hash junto.
//
// PRÉ-REQUISITO: o IRPF 2026 tem que estar FECHADO. Com o programa aberto, ele
// mantém o cadastro em memória e pode regravá-lo ao sair, desfazendo isto.
//
// ESTE SCRIPT NÃO FUNCIONA COMO ESTÁ. NÃO RODAR.
//
// Tentativa de 31/08/2026, 16h41: ele APAGOU as treze declarações do cadastro.
// Causa: `new RepositorioXMLIRPF().getListaIdDeclaracoes()` devolveu uma coleção
// VAZIA (tamanho 0), e não a coleção carregada do disco. O `salvar` gravou essa
// coleção vazia mais o item novo por cima do arquivo bom.
//
// O erro de método foi meu, e vale registrar: numa verificação anterior eu
// chamei exatamente essa mesma sequência, ela não lançou exceção, e eu concluí
// que o cadastro "carregava". Não lançar exceção não é o mesmo que carregar os
// itens. A conferência certa seria ter contado os itens, e o `.size()` que eu
// tentei falhou por não existir na classe, o que deixou a contagem sem prova.
//
// O que falta descobrir antes de tentar de novo: qual é o caminho que o próprio
// programa usa para POPULAR a ColecaoIdDeclaracao (provavelmente
// RepositorioXMLDefault.preencheObjeto sobre o arquivo, ou o IRPFFacade), e
// como salvar preservando o que já existe. Qualquer nova tentativa tem que
// CONTAR os itens carregados antes de salvar, e abortar se vier zero.
//
// Uso, no PowerShell do Windows:
//   $rfb = "C:\Arquivos de Programas RFB\IRPF2026"
//   & "$rfb\jre\bin\java.exe" -cp "$rfb\lib\*;$rfb\lib-modulos\*;$rfb\irpf.jar" `
//       groovy.ui.GroovyMain registrar-rur-01-pela-api.groovy

import serpro.ppgd.irpf.negocio.*
import serpro.ppgd.persistenciagenerica.RepositorioXMLDefault

def CPF = '777.000.111-09'
def NOME = 'AUDITORIA PDF TEC RURAL'
def DADOS = 'C:/Arquivos de Programas RFB/IRPF2026/aplicacao/dados'
def CADASTRO = DADOS + '/iddeclaracoes.xml'

def repoDefault = RepositorioXMLDefault.getInstancia()

def slot(obj, String name) {
  Class c = obj.getClass()
  while (c != null && c.name != 'java.lang.Object') {
    try { def f = c.getDeclaredField(name); f.accessible = true; return f } catch (NoSuchFieldException e) { c = c.superclass }
  }
  throw new IllegalArgumentException("Campo nao encontrado: ${obj.getClass().name}.${name}")
}
def setC(obj, String name, value) {
  def t = slot(obj, name).get(obj)
  if (t == null) { println "  aviso: campo nulo ${name}"; return }
  t.setConteudo(value.toString())
}

println '== 1. Estado antes =='
def repo = new serpro.ppgd.irpf.negocio.RepositorioXMLIRPF()
def colecao = repo.getListaIdDeclaracoes()
println "   itens no cadastro: ${colecao.tamanho}"
def jaExiste = colecao.getIdentificadorDeclaracao(CPF)
if (jaExiste != null) {
  println "   RUR-01 JA registrada. Nada a fazer."
  return
}

println '== 2. Acrescentando o identificador pela API =='
def id = new IdentificadorDeclaracao(CPF, '0000000000')
[nome: NOME, exercicio: '2026', tipoDeclaracao: '0', tipoDeclaracaoAES: 'A',
 declaracaoRetificadora: '0', transmitida: '0', numReciboTransmitido: '',
 prepreenchida: '0', inUtilizouPGD: '1', inNovaDeclaracao: '1',
 tpIniciada: '01', versaoBeta: 'N'].each { k, v -> setC(id, k, v) }
colecao.add(id)
println "   itens depois de acrescentar: ${colecao.tamanho}"

println '== 3. Salvando pelo repositorio (regrava o hash junto) =='
repoDefault.salvar(colecao, CADASTRO)
println '   salvo'

println '== 4. TESTE: o hash confere? =='
try {
  repoDefault.validarHashXML(CADASTRO)
  println '   OK: hash valido'
} catch (Throwable t) {
  println '   FALHOU: ' + t.message
  return
}

println '== 5. TESTE: o cadastro recarrega, e a RUR-01 esta la? =='
def repo2 = new serpro.ppgd.irpf.negocio.RepositorioXMLIRPF()
def colecao2 = repo2.getListaIdDeclaracoes()
println "   itens relidos: ${colecao2.tamanho}"
def achada = colecao2.getIdentificadorDeclaracao(CPF)
println "   RUR-01 encontrada: ${achada != null}"
if (achada != null) println "   nome: ${slot(achada, 'nome').get(achada).conteudo}"
