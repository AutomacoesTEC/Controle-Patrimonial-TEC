import * as XLSX from 'xlsx';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import { pontePatrimonial, parcelasDeclaradas } from '../store/auditoriaDemonstrativo';
const dinheiro = n => n == null ? 'Não informado' : Math.round(Number(n) * 100) / 100;
export function planilhasDemonstrativo({state, de, ate, pessoa, demo, financeiro, cobertura, painelIrrf, saldos}) {
  const v = demo.varPatrimonial, r = demo.rendimentos;
  const resumo = [
    ['Bens iniciais',v.bensDe],['Bens finais',v.bensAte],['Variação dos bens',v.deltaBens],['Dívidas iniciais',v.dividaDe],['Dívidas finais',v.dividaAte],['Variação das dívidas',v.deltaDivida],
    ['PJ bruto',r.tributavelPjBruto],['PJ previdência',r.tributavelPjPrevidencia],['PJ IRRF',r.tributavelPjIrrf],['PJ líquido',r.tributavelPJ],['PF / exterior',r.tributavelPfExterior],['RRA',r.tributavelRra],['Demais tributáveis / rural',r.demaisTributaveis],['Isentos',r.isentoValor],['Exclusivos brutos',r.exclusivoBruto],['Exclusivos retenções',r.exclusivoIrrf],['Exclusivos líquidos',r.exclusivoLiquido],['Total rendimentos',r.totalGeral],
    ['Ganhos / perdas',demo.ganhos.total],['Ajuste RV',demo.rendaVariavelPerda],['Antes dos pagamentos',demo.saldoDeCaixaGeral],['Pagamentos efetuados',demo.pagamentosEfetuados],['Despesas gerais',demo.pagamentosDiversos],['Doações',demo.totalDoacoes],['Resultado da conciliação patrimonial',demo.saldoDeCaixa],
  ].map(([Item, Valor]) => ({Item, Valor:dinheiro(Valor)}));
  const folhas = [{nome:'Consulta',linhas:[{De:de,Até:ate,Pessoa:pessoa,Base:'Declaração e lançamentos manuais',Cobertura: cobertura.completa ? 'Movimentos registrados; conferir documentos' : 'Posições anuais / datas pendentes',Observação:'Resultado patrimonial não é saldo de caixa. IRRF e saldos transportáveis referem-se ao ano final.'}]},{nome:'Conciliação patrimonial',linhas:resumo}];
  for (const campo of ['bens','dividas','dividasRurais']) folhas.push({nome:'Ponte '+campo,linhas:pontePatrimonial(state,campo,de,ate).map(p=>({Ano:p.ano,ID:p.id,Descrição:p.descricao,Origem:p.origem,Inicial:dinheiro(p.inicial),Final:dinheiro(p.final),Variação:dinheiro(p.variacao),Página:p.origemDocumento?.pagina || '',Linha:p.origemDocumento?.linha || '',Movimentos:p.movimentos.map(m=>m.data+' '+m.tipo+' '+dinheiro(m.valor)).join('; ')}))});
  for (const campo of ['rendimentos','pagamentos','pagamentosDiversos']) {
    const linhas = anosComDado(state).flatMap(ano => (dadosDoAno(state,ano)?.[campo] || []).filter(i => i.data >= de && i.data <= ate).map(i=>({Ano:ano,ID:i.id,Data:i.data,Descrição:i.nome_fonte || i.nome_beneficiario || i.descricao || '',Tipo:i.tipo || i.codigo || '',Valor:dinheiro(i.valor ?? i.valor_pago),IRRF:dinheiro(i.irrf),Previdência:dinheiro(i.contribuicaoPrevidenciaria),Origem:i.origemDocumento ? 'Declaração' : 'Manual',Página:i.origemDocumento?.pagina || '',Operação:i.operacaoId || ''})));
    folhas.push({nome:campo,linhas});
  }
  folhas.push({nome:'Ganhos e perdas',linhas:demo.ganhos.vendas.map(g=>({Bem:g.bem,Data:g.data,Preço:dinheiro(g.valorVenda),GanhoBruto:dinheiro(g.ganhoBruto),Tributo:dinheiro(g.irrf),Resultado:dinheiro(g.ganhoLiquido)}))});
  folhas.push({nome:'Parcelas declaradas',linhas:parcelasDeclaradas(state,de,ate).flatMap(g=>g.parcelas.map(p=>({Bem:g.bem,Data:p.data,RecebidoNaDeclaração:dinheiro(p.valorRecebido),Operação:g.operacaoId || 'Sem vínculo',Observação:'Não somado como nova baixa financeira'})))});
  folhas.push({nome:'Datas e posições pendentes',linhas:cobertura.itens});
  if (financeiro) {
    folhas.push({nome:'Caixa financeiro',linhas:[{Inicial:financeiro.contas ? financeiro.inicial/100 : 'Não informado',Aberturas:financeiro.aberturas/100,Entradas:financeiro.entradas/100,Saídas:financeiro.saidas/100,Transferências:financeiro.transferencias/100,FinalRegistrado:financeiro.contas ? financeiro.final/100 : 'Não informado',FinalExtrato:financeiro.finalExtrato == null ? 'Não informado' : financeiro.finalExtrato/100,Diferença:financeiro.diferenca == null ? 'Não validável' : financeiro.diferenca/100,Conferência:financeiro.extratosCompletos ? 'Extratos informados conferem' : 'Pendente'}]});
    folhas.push({nome:'Movimentos financeiros',linhas:financeiro.externos.map(l=>({ID:l.id,Data:l.data,Descrição:l.descricao,Contraparte:l.contraparte,Tipo:l.tipo,Classificação:l.rotuloCategoria,Operação:l.operacao,Valor:l.valor/100,Documentos:l.referencia || 'Pendente'}))});
    folhas.push({nome:'Fontes e aplicações',linhas:financeiro.categorias.map(c=>({Categoria:c.nome,Sentido:c.sentido,Valor:c.valor/100}))});
  }
  folhas.push({nome:'IRRF anual',linhas:painelIrrf.linhas.map(l=>({Ano:ate.slice(0,4),Fonte:l.fonte,Beneficiário:l.beneficiario,Tipo:l.tipo,Tratamento:l.compoeAjuste ? 'Compõe ajuste' : 'Informativo',Valor:dinheiro(l.valor)}))});
  folhas.push({nome:'Resumo fiscal anual',linhas:[{Ano:ate.slice(0,4),Imposto:dinheiro(painelIrrf.impostoDevido),SaldoPagar:dinheiro(painelIrrf.saldoPagar),Restituição:dinheiro(painelIrrf.impostoRestituir)}]});
  folhas.push({nome:'Saldos transportáveis',linhas:saldos.map(s=>({Ano:ate.slice(0,4),Saldo:s.rotulo,Valor:dinheiro(s.valor),Origem:s.origem || 'Ficha mensal oficial / manual',Observação:s.requerRevisao ? 'Conferir movimentos manuais' : s.base}))});
  return folhas;
}
export function exportDemonstrativoToXlsx(contexto) {
  const wb = XLSX.utils.book_new();
  for (const {nome,linhas} of planilhasDemonstrativo(contexto)) {
    const ws = XLSX.utils.json_to_sheet(linhas.length ? linhas : [{Informação:'Sem registros neste recorte'}]);
    for (const key of Object.keys(ws)) if (ws[key]?.t === 'n') ws[key].z = '#,##0.00';
    ws['!cols'] = Object.keys(linhas[0] || {}).map(()=>({wch:28}));
    XLSX.utils.book_append_sheet(wb,ws,nome.slice(0,31));
  }
  XLSX.writeFile(wb,'demonstrativo_'+contexto.de+'_'+contexto.ate+'.xlsx');
}
