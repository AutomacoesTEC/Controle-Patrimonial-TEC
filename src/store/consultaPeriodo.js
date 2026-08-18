// Motor de consulta por período livre (podendo cruzar anos). O
// demonstrativoConciliacao de demonstrativos.js opera sobre UM ano de dados
// (state.bens etc. valem para o ano-calendário corrente); aqui a gente
// costura os snapshots anuais do histórico para responder "de 01/03/2024 a
// 30/06/2026" como um período só:
//
// - ESTOQUE (bens/dívidas nas pontas): reconstruído no ano da data de corte,
//   usando o snapshot daquele ano (situacao_anterior + movimentações datadas
//   até a data). O ano corrente usa o estado vivo; anos anteriores usam
//   state.historico[ano].
// - FLUXO (rendimentos/pagamentos/ganhos/rural): somado ano a ano, cada ano
//   contribuindo só com o trecho do período que cai dentro dele.
//
// Ano sem dado nenhum no meio do intervalo NÃO é inventado: entra em
// `anosSemDado` para a UI sinalizar, e contribui zero nos fluxos. Lógica
// pura, sem React, pelo mesmo motivo de demonstrativos.js: testável sem
// montar componente.

import {
  totalBensAteData,
  totalDividas,
  totalRendimentos,
  resultadoAtividadeRuralPeriodo,
  ganhosApuradosPeriodo,
  totalPagamentos,
  totalPagamentosDiversos,
} from './demonstrativos';

const anoDeUmaData = (data) => Number(String(data).slice(0, 4));
const maxData = (a, b) => (a >= b ? a : b);
const minData = (a, b) => (a <= b ? a : b);

// Dados de um ano específico: o estado vivo se for o ano-calendário em
// edição, senão o snapshot arquivado. null quando não existe dado do ano.
export function dadosDoAno(state, ano) {
  if (ano === state.anoCalendario) return state;
  return state.historico?.[ano] || null;
}

// Anos que têm dado real (histórico arquivado + ano corrente, se ele tiver
// qualquer dado de trabalho). Ordenados.
export function anosComDado(state) {
  const anos = new Set(Object.keys(state.historico || {}).map(Number));
  if (state.anoCalendario != null) anos.add(state.anoCalendario);
  return [...anos].sort((a, b) => a - b);
}

// Demonstrativo de Conciliação para um período livre, cruzando quantos anos
// forem necessários. Mesmo formato de retorno de demonstrativoConciliacao,
// mais `anosSemDado`/`anosCobertos` para a UI ser honesta sobre lacunas.
export function demonstrativoPeriodo(state, dataDe, dataAte) {
  const vazio = {
    varPatrimonial: { bensDe: 0, bensAte: 0, deltaBens: 0, dividaDe: 0, dividaAte: 0, deltaDivida: 0, total: 0 },
    rendimentos: { tributavelPJ: 0, demaisTributaveis: 0, isentoValor: 0, exclusivoBruto: 0, exclusivoIrrf: 0, exclusivoLiquido: 0, totalGeral: 0 },
    ganhos: { vendas: [], total: 0, semIrrfCount: 0 },
    saldoDeCaixaGeral: 0,
    pagamentosEfetuados: 0,
    pagamentosDiversos: 0,
    saldoDeCaixa: 0,
    anosSemDado: [],
    anosCobertos: [],
  };
  if (!dataDe || !dataAte || dataDe > dataAte) return vazio;

  const anoIni = anoDeUmaData(dataDe);
  const anoFim = anoDeUmaData(dataAte);

  // Estoque nas pontas: reconstruído no ano da respectiva data de corte.
  const dadosIni = dadosDoAno(state, anoIni);
  const dadosFim = anoFim === anoIni ? dadosIni : dadosDoAno(state, anoFim);
  const anosSemDado = [];
  if (!dadosIni) anosSemDado.push(anoIni);
  if (!dadosFim && anoFim !== anoIni) anosSemDado.push(anoFim);

  const bensDe = dadosIni
    ? totalBensAteData(dadosIni.bens, dataDe, 'de') + totalBensAteData(dadosIni.bensRurais, dataDe, 'de')
    : 0;
  const bensAte = dadosFim
    ? totalBensAteData(dadosFim.bens, dataAte, 'ate') + totalBensAteData(dadosFim.bensRurais, dataAte, 'ate')
    : 0;
  const dividaDe = dadosIni ? totalDividas(dadosIni.dividas, 'de', dataDe) : 0;
  const dividaAte = dadosFim ? totalDividas(dadosFim.dividas, 'ate', dataAte) : 0;
  const varPatrimonial = {
    bensDe, bensAte, deltaBens: bensAte - bensDe,
    dividaDe, dividaAte, deltaDivida: dividaAte - dividaDe,
    total: -(bensAte - bensDe) + (dividaAte - dividaDe),
  };

  // Fluxos: cada ano do intervalo contribui com o trecho que lhe cabe.
  const rend = { tributavelPJ: 0, demaisTributaveis: 0, isentoValor: 0, exclusivoBruto: 0, exclusivoIrrf: 0, exclusivoLiquido: 0, totalGeral: 0 };
  const vendas = [];
  let semIrrfCount = 0;
  let pagamentosEfetuados = 0;
  let pagamentosDiversos = 0;
  const anosCobertos = [];

  for (let ano = anoIni; ano <= anoFim; ano++) {
    const dados = dadosDoAno(state, ano);
    if (!dados) {
      if (!anosSemDado.includes(ano)) anosSemDado.push(ano);
      continue;
    }
    anosCobertos.push(ano);
    const trechoDe = maxData(dataDe, `${ano}-01-01`);
    const trechoAte = minData(dataAte, `${ano}-12-31`);

    const rural = resultadoAtividadeRuralPeriodo(dados.lancamentosRurais, trechoDe, trechoAte);
    const r = totalRendimentos(dados.rendimentos, rural, trechoDe, trechoAte);
    for (const k of Object.keys(rend)) rend[k] += r[k];

    const g = ganhosApuradosPeriodo(dados, trechoDe, trechoAte);
    vendas.push(...g.vendas);
    semIrrfCount += g.semIrrfCount;

    pagamentosEfetuados += totalPagamentos(dados.pagamentos, trechoDe, trechoAte);
    pagamentosDiversos += totalPagamentosDiversos(dados.pagamentosDiversos, trechoDe, trechoAte);
  }

  const rendimentos = rend;
  const ganhos = { vendas, total: vendas.reduce((s, v) => s + v.ganhoLiquido, 0), semIrrfCount };
  const saldoDeCaixaGeral = varPatrimonial.total + rendimentos.totalGeral + ganhos.total;
  const saldoDeCaixa = saldoDeCaixaGeral - pagamentosEfetuados - pagamentosDiversos;

  return {
    varPatrimonial,
    rendimentos,
    ganhos,
    saldoDeCaixaGeral,
    pagamentosEfetuados,
    pagamentosDiversos,
    saldoDeCaixa,
    anosSemDado: anosSemDado.sort((a, b) => a - b),
    anosCobertos,
  };
}

// Série temporal da evolução patrimonial dentro do período: um ponto por ano
// COM dado (na data de corte daquele ano dentro do período). Anos sem dado
// não entram — o gráfico nunca inventa ano intermediário zerado.
export function serieEvolucao(state, dataDe, dataAte) {
  if (!dataDe || !dataAte || dataDe > dataAte) return [];
  const pontos = [];
  for (let ano = anoDeUmaData(dataDe); ano <= anoDeUmaData(dataAte); ano++) {
    const dados = dadosDoAno(state, ano);
    if (!dados) continue;
    const corte = minData(dataAte, `${ano}-12-31`);
    const bens = totalBensAteData(dados.bens, corte, 'ate') + totalBensAteData(dados.bensRurais, corte, 'ate');
    const dividas = totalDividas(dados.dividas, 'ate', corte);
    pontos.push({ ano, data: corte, bens, dividas, liquido: bens - dividas });
  }
  return pontos;
}

// Totais de estoque numa data de corte qualquer (cards do Dashboard): bens,
// dívidas, líquido e contagens — reconstruídos no ano da data.
export function totaisNaData(state, dataCorte, lado = 'ate') {
  if (!dataCorte) return null;
  const dados = dadosDoAno(state, anoDeUmaData(dataCorte));
  if (!dados) return null;
  const totalBens = totalBensAteData(dados.bens, dataCorte, lado) + totalBensAteData(dados.bensRurais, dataCorte, lado);
  const totalDividas_ = totalDividas(dados.dividas, lado, dataCorte);
  return {
    totalBens,
    totalDividas: totalDividas_,
    liquido: totalBens - totalDividas_,
    qtdBens: (dados.bens || []).length + (dados.bensRurais || []).length,
    qtdDividas: (dados.dividas || []).length,
  };
}
