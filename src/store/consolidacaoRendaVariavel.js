// A CONSOLIDAÇÃO DO MÊS da ficha de renda variável, como a declaração a
// imprime (AJU-01 p23 r25 a r34).
//
// A tela mostrava só dois números do bloco, imposto a pagar e imposto pago. As
// outras sete linhas eram lidas pelo parser e não apareciam, e são justamente
// as que explicam por que o imposto a pagar é menor que o devido.
//
// RIGOR FISCAL, que é o motivo de o bloco existir: o imposto sobre ganho
// líquido em renda variável é apurado e recolhido MÊS A MÊS, e do imposto
// devido se abatem duas retenções na fonte, com origens diferentes:
//
// - IR fonte de DAY-TRADE, retido a 1% sobre o resultado positivo do
//   day-trade;
// - IR fonte da Lei nº 11.033/2004, o chamado "dedo-duro", retido a 0,005%
//   sobre o valor da alienação nas operações comuns.
//
// Cada uma tem três linhas: o retido no próprio mês, o que sobrou de meses
// anteriores e o que continua a compensar depois deste mês. Sem elas, a pessoa
// vê "devido 545,56" e "a pagar 377,29" sem nada que explique a diferença.

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);

// Rótulos IMPRESSOS, na ordem impressa. Não trocar por versões mais curtas: o
// valor desta tela é casar com o papel.
const LINHAS = [
  ['totalImpostoDevido', 'Total do imposto devido'],
  ['irFonteDayTradeMes', 'IR fonte de day-trade do mês'],
  ['irFonteDayTradeMesesAnteriores', 'IR fonte de day-trade dos meses anteriores'],
  ['irFonteDayTradeCompensar', 'IR fonte de day-trade a compensar'],
  ['irFonteLei11033Mes', 'IR fonte (Lei nº 11.033/2004) no mês'],
  ['irFonteLei11033MesesAnteriores', 'IR fonte (Lei nº 11.033/2004) nos meses anteriores'],
  ['irFonteLei11033Compensar', 'IR fonte (Lei nº 11.033/2004) a compensar'],
  ['impostoPagar', 'Imposto a pagar'],
  ['impostoPago', 'Imposto pago'],
];

export function linhasConsolidacaoMes(consolidacao) {
  if (!consolidacao) return [];
  return LINHAS
    .filter(([campo]) => ehNumero(consolidacao[campo]))
    .map(([campo, rotulo]) => ({ campo, rotulo, valor: consolidacao[campo] }));
}

// Conferência que a própria ficha permite: o imposto a pagar do mês é o devido
// menos as retenções aproveitadas no mês. Divergência vira aviso, nunca
// correção: quem decide o número é a declaração.
export function conferenciaConsolidacaoMes(consolidacao) {
  if (!consolidacao) return null;
  const { totalImpostoDevido, irFonteDayTradeMes, irFonteLei11033Mes, impostoPagar } = consolidacao;
  if (![totalImpostoDevido, irFonteDayTradeMes, irFonteLei11033Mes, impostoPagar].every(ehNumero)) return null;
  const esperado = totalImpostoDevido - irFonteDayTradeMes - irFonteLei11033Mes;
  if (Math.abs(esperado - impostoPagar) < 0.02) return null;
  return `O imposto a pagar informado (${impostoPagar.toFixed(2)}) não é o devido menos as retenções do mês (${esperado.toFixed(2)}).`;
}

// Total de IR retido na fonte no mês, das duas origens. É o que foi abatido do
// imposto devido daquele mês, e serve de leitura rápida na linha do mês.
export function retidoNoMes(consolidacao) {
  if (!consolidacao) return 0;
  return (consolidacao.irFonteDayTradeMes || 0) + (consolidacao.irFonteLei11033Mes || 0);
}
