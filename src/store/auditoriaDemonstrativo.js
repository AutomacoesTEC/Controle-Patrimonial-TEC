import { dadosDoAno, anosComDado } from './consultaPeriodo';
import { situacaoBemAteData, totalDividas, diaAnterior } from './demonstrativos';
import { acompanhamentoDo, caixaPeriodo, conciliarConta, limitesMes } from './acompanhamento';

import { CLASSES_FINANCEIRAS, CATEGORIAS_FLUXO } from './classificacoesFinanceiras';
export { CLASSES_FINANCEIRAS, CATEGORIAS_FLUXO } from './classificacoesFinanceiras';
const valor = n => Number(n) || 0;
const cent = n => Math.round(valor(n) * 100);
const origem = r => r.origemDocumento ? 'Declaração' : 'Manual';
export function classeFinanceira(bem) {
  if (bem.classeFinanceira && CLASSES_FINANCEIRAS.some(([c]) => c === bem.classeFinanceira)) return { classe: bem.classeFinanceira, base: 'Classificação manual' };
  const grupo = String(bem.grupo || '');
  if (['04', '07'].includes(grupo)) return { classe: 'investimento', base: 'Grupo fiscal' };
  if (grupo === '06') return { classe: 'caixa', base: 'Grupo fiscal' };
  if (grupo === '05') return { classe: 'credito', base: 'Grupo fiscal' };
  // Indicação literal é exibida como sugestão revisável; nunca altera a ficha.
  const texto = String(bem.discriminacao || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (grupo === '99' && /A RECEBER|CHEQUES?/.test(texto)) return { classe: 'credito', base: 'Indicação na descrição; conferir' };
  if (grupo === '99' && /PRE.?PAGO/.test(texto)) return { classe: 'caixa', base: 'Indicação na descrição; conferir' };
  if (grupo === '99' && /DEPOSITO JUDICIAL|BLOQUEAD/.test(texto)) return { classe: 'restrito', base: 'Indicação na descrição; conferir' };
  return { classe: 'outro', base: grupo === '99' ? 'Classificação pendente' : 'Grupo fiscal' };
}
export function posicoesFinanceiras(dados, ate) {
  const itens = (dados?.bens || []).map(b => ({ ...classeFinanceira(b), id: b.id, descricao: b.discriminacao, valor: situacaoBemAteData(b, ate), origemDocumento: b.origemDocumento }));
  return { itens, grupos: CLASSES_FINANCEIRAS.filter(([c]) => c).map(([classe, nome]) => ({ classe, nome, valor: itens.filter(i => i.classe === classe).reduce((s, i) => s + cent(i.valor), 0) / 100 })) };
}
export function pontePatrimonial(state, colecao, de, ate) {
  if (!de || !ate || de > ate) return [];
  const resultado = [];
  for (const ano of anosComDado(state).filter(a => a >= Number(de.slice(0, 4)) && a <= Number(ate.slice(0, 4)))) {
    const dados = dadosDoAno(state, ano);
    const inicio = de > ano + '-01-01' ? de : ano + '-01-01';
    const fim = ate < ano + '-12-31' ? ate : ano + '-12-31';
    for (const item of dados?.[colecao] || []) {
      const saldo = (data, lado) => colecao === 'bens' ? situacaoBemAteData(item, data, lado) : totalDividas([item], lado, data);
      const inicial = saldo(inicio, 'de'), final = saldo(fim, 'ate');
      const movimentos = (item.movimentacoes || []).filter(m => m.data >= inicio && m.data <= fim);
      if (cent(inicial) === cent(final) && !movimentos.length) continue;
      resultado.push({ ano, id: item.id, colecao, descricao: item.discriminacao || 'Registro sem descrição', grupo: item.grupo || '', inicial, final, variacao: (cent(final) - cent(inicial)) / 100, movimentos, origem: origem(item), origemDocumento: item.origemDocumento, data: item.data_aquisicao || null });
    }
  }
  return resultado;
}
export function coberturaTemporal(state, de, ate) {
  const itens = [];
  for (const ano of anosComDado(state).filter(a => a >= Number(de.slice(0, 4)) && a <= Number(ate.slice(0, 4)))) {
    const d = dadosDoAno(state, ano);
    for (const campo of ['bens', 'dividas', 'dividasRurais']) for (const r of d?.[campo] || []) {
      // Uma diferença entre o saldo projetado em30/12 e o fechamento é
      // parcela não alocada, não movimento ocorrido obrigatoriamente em31/12.
      const ler = data => campo === 'bens' ? situacaoBemAteData(r, data) : totalDividas([r], 'ate', data);
      const movimentosFim = (r.movimentacoes || []).some(m => m.data === ano + '-12-31');
      if (!movimentosFim && cent(ler(ano + '-12-30')) !== cent(ler(ano + '-12-31'))) itens.push({ ano, campo, id: r.id, descricao: r.discriminacao, motivo: 'Posição anual sem movimento completo datado' });
    }
    for (const campo of ['rendimentos', 'pagamentos', 'pagamentosDiversos']) for (const r of d?.[campo] || []) {
      if (!r.data || (r.origemDocumento && r.data === ano + '-12-31' && !r.dataEfetivaConfirmada && r.periodicidade !== 'mensal')) itens.push({ ano, campo, id: r.id, descricao: r.nome_fonte || r.nome_beneficiario || r.descricao, motivo: 'Data anual ou não confirmada; informar a data efetiva' });
    }
  }
  return { itens, completa: itens.length === 0 };
}
export function painelFinanceiro(state, de, ate, pessoa = 'todos') {
  const a = acompanhamentoDo(state);
  if (!de || !ate || de > ate) return null;
  const caixa = caixaPeriodo(a, de, ate, pessoa);
  const contas = a.contas.filter(c => c.disponivel && c.dataAbertura <= ate && (pessoa === 'todos' || c.pessoa === pessoa));
  const operacoes = new Map(a.operacoes.map(o => [o.id, o]));
  const externos = caixa.movimentos.filter(l => l.tipo !== 'transferencia').map(l => {
    const op = operacoes.get(l.operacaoId);
    const categoria = CATEGORIAS_FLUXO.find(([c, , sentido]) => c === l.categoriaFluxo && sentido === l.tipo);
    const documentos = a.documentos.filter(d => d.operacaoId && d.operacaoId === l.operacaoId);
    return { ...l, categoria: categoria?.[0] || 'pendente', rotuloCategoria: categoria?.[1] || 'Classificar', operacao: op?.descricao || 'Sem vínculo', documentos: documentos.length, referencia: documentos.map(d => d.referencia).join('; ') };
  });
  const categorias = CATEGORIAS_FLUXO.map(([id, nome, sentido]) => ({ id, nome, sentido, valor: externos.filter(l => l.categoria === id).reduce((s, l) => s + l.valor, 0) }));
  const meses = []; let mes = de.slice(0, 7);
  while (mes <= ate.slice(0, 7)) { meses.push(mes); const [y, m] = mes.split('-').map(Number); mes = m === 12 ? (y + 1) + '-01' : y + '-' + String(m + 1).padStart(2, '0'); }
  const conciliacoes = meses.flatMap(m => contas.filter(c => c.dataAbertura <= limitesMes(m)[1]).map(c => conciliarConta(a, c.id, m)));
  const fimMes = ate === limitesMes(ate.slice(0, 7))[1];
  const extratosCompletos = contas.length > 0 && fimMes && conciliacoes.every(c => c.diferenca === 0);
  const total = externos.reduce((s, l) => s + l.valor, 0);
  const documentado = externos.filter(l => l.documentos > 0).reduce((s, l) => s + l.valor, 0);
  const finalExtrato = fimMes && contas.length && contas.every(c => a.extratos.some(e => e.contaId === c.id && e.mes === ate.slice(0, 7))) ? contas.reduce((s, c) => s + a.extratos.find(e => e.contaId === c.id && e.mes === ate.slice(0, 7)).saldo, 0) : null;
  const diferenca = finalExtrato == null ? null : finalExtrato - caixa.final;
  return { ...caixa, contas: contas.length, externos, categorias, conciliacoes, extratosCompletos, finalExtrato, diferenca, semClassificacao: externos.filter(l => l.categoria === 'pendente'), semDocumento: externos.filter(l => !l.documentos), coberturaDocumental: total ? documentado / total * 100 : null,
    // O GAP abaixo é apenas do perímetro de contas, não aprovação fiscal.
    gapContas: finalExtrato == null ? null : caixa.saidas + finalExtrato - caixa.inicial - caixa.aberturas - caixa.entradas - caixa.transferencias,
  };
}
export function parcelasDeclaradas(state, de, ate) {
  const resultado = [];
  for (const ano of anosComDado(state)) for (const g of dadosDoAno(state, ano)?.apuracaoGanhoCapital || []) {
    const parcelas = (g.parcelas || []).filter(p => p.data >= de && p.data <= ate);
    if (!parcelas.length) continue;
    const recebido = parcelas.reduce((s, p) => s + cent(p.valorRecebido), 0) / 100;
    const recebidoAte = (g.parcelas || []).filter(p => p.data <= ate).reduce((s, p) => s + cent(p.valorRecebido), 0) / 100;
    const op = state.acompanhamento?.operacoes?.find(o => o.id === g.operacaoId);
    const baixas = (state.acompanhamento?.lancamentos || []).filter(l => !l.canceladoEm && l.tipo === 'entrada' && l.operacaoId === op?.id && op && l.data >= de && l.data <= ate);
    resultado.push({ ano, id: g.id, bem: g.bem, operacaoId: op?.id, contrato: valor(g.valorAlienacao), recebidoDeclarado: recebido, diferencaContratoParcelas: (cent(g.valorAlienacao) - cent(recebidoAte)) / 100, baixas: baixas.reduce((s, l) => s + l.valor, 0) / 100, vinculado: !!op, parcelas });
  }
  return resultado;
}
