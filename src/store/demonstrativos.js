// Demonstrativo de Conciliação Patrimonial: a mesma técnica de "evolução
// patrimonial a descoberto" que a planilha original (VARIAÇÃO PATRIMONIAL.xls)
// já usava — Bens/Dívidas são ESTOQUE (situação num ponto no tempo, De/Até);
// Rendimentos/Pagamentos/Ganhos são FLUXO (soma do que aconteceu no período).
// Fórmulas conferidas ao centavo contra as abas VAR PATRIMONIAL2024 e
// VAR PATRIMONIAL2025 da planilha real da usuária (ver
// ~/PROJETOS/Planilha Eudúcio/VARIAÇÃO PATRIMONIAL.xls) — ver
// demonstrativos.test.js, que reproduz os dois anos como regressão.
//
// Lógica pura, sem React, pelo mesmo motivo do reducer.js: testável sem
// montar componente.

const emDataOuAntes = (data, corte) => !!data && (!corte || data <= corte);
// Sem filtro ativo (dataDe e dataAte ambos vazios), conta o item mesmo sem
// `data` — registros de rendimento/pagamento cadastrados antes desse campo
// existir não podem sumir do total só porque não tinha onde informar a
// data. Com filtro ativo, um item sem data não entra (não dá pra saber se
// cai dentro do período escolhido).
const noPeriodo = (data, dataDe, dataAte) => {
  if (!dataDe && !dataAte) return true;
  if (!data) return false;
  return (!dataDe || data >= dataDe) && (!dataAte || data <= dataAte);
};

// Reconstrói a situação de um bem numa data de corte, a partir da
// situacao_anterior + movimentações até aquela data (inclusive).
//
// Um bem sem NENHUMA movimentação registrada (comum: acabou de ser
// importado, ainda não foi editado neste ano) não tem como ser
// reconstruído numa data do meio do caminho — o salto de anterior pra
// atual não tem data nenhuma associada. Nesse caso a resposta depende do
// lado da comparação: "de" (início do período) assume, na falta de outra
// informação, que a mudança AINDA NÃO tinha acontecido (usa a situação
// anterior); "ate" (fim do período) assume que ela JÁ tinha acontecido
// (usa a situação atual). Essa convenção fecha certo no caso mais comum —
// o ano inteiro, De=01/01 a Até=hoje/31-12 — e é conservadora nos casos de
// sub-período em que a data exata da mudança é mesmo desconhecida.
export function situacaoBemAteData(bem, dataCorte, lado = 'ate') {
  const semMovimentacao = !(bem.movimentacoes || []).length;
  if (!dataCorte || semMovimentacao) {
    return lado === 'de' ? bem.situacao_anterior : bem.situacao_atual;
  }
  const movs = (bem.movimentacoes || [])
    .filter(m => emDataOuAntes(m.data, dataCorte))
    .sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.id || 0) - (b.id || 0));
  let situacao = bem.situacao_anterior;
  for (const m of movs) {
    if (m.tipo === 'compra' || m.tipo === 'benfeitoria') situacao += m.valor;
    else if (m.tipo === 'venda_parcial') situacao = Math.max(0, situacao - m.valor);
    else if (m.tipo === 'venda_total' || m.tipo === 'baixa') situacao = 0;
    else if (m.tipo === 'ajuste') situacao = m.valor;
  }
  return situacao;
}

export function totalBensAteData(listaBens, dataCorte, lado = 'ate') {
  return (listaBens || []).reduce((s, b) => s + situacaoBemAteData(b, dataCorte, lado), 0);
}

// Dívidas não têm movimentação com data granular (só o saldo em 31/12
// anterior/atual, igual à ficha oficial) — não dá pra reconstruir "quanto
// devia numa data X do meio do ano". Por isso, ao contrário dos bens, o
// filtro de data não se aplica aqui: "De" sempre usa a situação anterior
// (início do ano) e "Até" sempre usa a situação atual (a mais recente
// lançada), qualquer que seja a data escolhida.
export function totalDividas(dividas, ponto) {
  const campo = ponto === 'de' ? 'situacao_anterior' : 'situacao_atual';
  return (dividas || []).reduce((s, d) => s + (parseFloat(d[campo]) || 0), 0);
}

// Variação Patrimonial Total = -(Δ Bens) + (Δ Dívida). Negativo quando o
// patrimônio líquido cresceu (dinheiro "saiu" pra virar bem ou pagar
// dívida); positivo quando encolheu (bem vendido/dívida contraída "liberou"
// caixa). Mesma fórmula por trás da planilha, verificada a centavo.
export function variacaoPatrimonialTotal({ bens, bensRurais, dividas }, dataDe, dataAte) {
  const bensDe = totalBensAteData(bens, dataDe, 'de') + totalBensAteData(bensRurais, dataDe, 'de');
  const bensAte = totalBensAteData(bens, dataAte, 'ate') + totalBensAteData(bensRurais, dataAte, 'ate');
  const dividaDe = totalDividas(dividas, 'de');
  const dividaAte = totalDividas(dividas, 'ate');
  return {
    bensDe, bensAte, deltaBens: bensAte - bensDe,
    dividaDe, dividaAte, deltaDivida: dividaAte - dividaDe,
    total: -(bensAte - bensDe) + (dividaAte - dividaDe),
  };
}

// Rendimentos: tributavel = "Tributáveis Recebidos de P.J." (ficha própria);
// demaisTributaveis = Resultado da Atividade Rural (vem da ficha própria,
// não do cadastro de rendimentos — por isso entra como parâmetro à parte);
// isento e exclusivo somam por categoria. Exclusiva usa o valor LÍQUIDO de
// IRRF (é o que efetivamente veio de caixa; o IRRF retido não sobra pra
// gastar) — conferido contra a planilha, que faz exatamente essa conta.
export function totalRendimentos(rendimentos, resultadoAtividadeRural, dataDe, dataAte) {
  const doPeriodo = (rendimentos || []).filter(r => noPeriodo(r.data, dataDe, dataAte));
  const somaPorPrefixo = (prefixo) => doPeriodo.filter(r => r.tipo?.startsWith(prefixo))
    .reduce((acc, r) => ({ valor: acc.valor + (parseFloat(r.valor) || 0), irrf: acc.irrf + (parseFloat(r.irrf) || 0) }), { valor: 0, irrf: 0 });

  const tributavelPJ = doPeriodo.filter(r => r.tipo === 'tributavel_pj').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const isento = somaPorPrefixo('isento');
  const exclusivo = somaPorPrefixo('exclusivo');
  const exclusivoLiquido = exclusivo.valor - exclusivo.irrf;
  const demaisTributaveis = resultadoAtividadeRural || 0;

  const totalGeral = tributavelPJ + demaisTributaveis + isento.valor + exclusivoLiquido;

  return {
    tributavelPJ,
    demaisTributaveis,
    isentoValor: isento.valor,
    exclusivoBruto: exclusivo.valor,
    exclusivoIrrf: exclusivo.irrf,
    exclusivoLiquido,
    totalGeral,
  };
}

// Resultado da Atividade Rural no período (receita - despesa dos
// lançamentos com data dentro do intervalo) — é o que a planilha chama de
// "DEMAIS REND. TRIBUTÁVEIS".
export function resultadoAtividadeRuralPeriodo(lancamentosRurais, dataDe, dataAte) {
  return (lancamentosRurais || [])
    .filter(l => noPeriodo(l.data, dataDe, dataAte))
    .reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0);
}

// Ganhos Apurados: soma o ganho/perda de cada venda com valorVenda
// preenchido, no período. Ganho entra líquido de IRRF (quando a movimentação
// informou o IRRF pago); perda entra pelo valor cheio. Sem IRRF informado
// numa venda com ganho, usa o ganho bruto (mais otimista que a planilha
// real, que sempre desconta) e o flag correspondente sinaliza a diferença
// em vez de estimar uma alíquota que pode estar errada.
export function ganhosApuradosPeriodo({ bens, bensRurais }, dataDe, dataAte) {
  const vendas = [];
  for (const b of [...(bens || []), ...(bensRurais || [])]) {
    for (const m of (b.movimentacoes || [])) {
      if ((m.tipo !== 'venda_parcial' && m.tipo !== 'venda_total') || m.valorVenda == null) continue;
      if (!noPeriodo(m.data, dataDe, dataAte)) continue;
      const ganhoBruto = m.valorVenda - m.valor;
      const irrf = ganhoBruto > 0 ? (m.irrfVenda || 0) : 0;
      vendas.push({ bem: b.discriminacao, data: m.data, ganhoBruto, irrf, ganhoLiquido: ganhoBruto - irrf, semIrrf: ganhoBruto > 0 && m.irrfVenda == null });
    }
  }
  return {
    vendas,
    total: vendas.reduce((s, v) => s + v.ganhoLiquido, 0),
    semIrrfCount: vendas.filter(v => v.semIrrf).length,
  };
}

export function totalPagamentos(pagamentos, dataDe, dataAte) {
  return (pagamentos || []).filter(p => noPeriodo(p.data, dataDe, dataAte)).reduce((s, p) => s + (parseFloat(p.valor_pago) || 0), 0);
}

export function totalPagamentosDiversos(pagamentosDiversos, dataDe, dataAte) {
  return (pagamentosDiversos || []).filter(p => noPeriodo(p.data, dataDe, dataAte)).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
}

// Monta o demonstrativo inteiro, na mesma ordem da planilha original:
// Bens/Dívidas → Variação Patrimonial Total → Rendimentos → Ganhos Apurados
// → Saldo de Caixa Geral → Pagamentos (Efetuados e Diversos) → Saldo de
// Caixa. Esse último é o número de validação: perto de zero (ou de um saldo
// de caixa/cofre conhecido) indica que a declaração fecha; um valor grande
// sinaliza rendimento ou bem não lançado.
export function demonstrativoConciliacao(state, dataDe, dataAte) {
  const varPatrimonial = variacaoPatrimonialTotal(state, dataDe, dataAte);
  const resultadoRural = resultadoAtividadeRuralPeriodo(state.lancamentosRurais, dataDe, dataAte);
  const rendimentos = totalRendimentos(state.rendimentos, resultadoRural, dataDe, dataAte);
  const ganhos = ganhosApuradosPeriodo(state, dataDe, dataAte);
  const saldoDeCaixaGeral = varPatrimonial.total + rendimentos.totalGeral + ganhos.total;
  const pagamentosEfetuados = totalPagamentos(state.pagamentos, dataDe, dataAte);
  const pagamentosDiversos = totalPagamentosDiversos(state.pagamentosDiversos, dataDe, dataAte);
  const saldoDeCaixa = saldoDeCaixaGeral - pagamentosEfetuados - pagamentosDiversos;

  return {
    varPatrimonial,
    rendimentos,
    ganhos,
    saldoDeCaixaGeral,
    pagamentosEfetuados,
    pagamentosDiversos,
    saldoDeCaixa,
  };
}
