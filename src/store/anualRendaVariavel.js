// Fechamento ANUAL da renda variável e do FII/Fiagro.
//
// Ponto que a tela precisa deixar claro e não deixava: pelo caminho PDF, este
// fechamento NÃO é lido de uma ficha anual. A declaração impressa não traz
// bloco anual nenhum para renda variável (conferido: não há "CONSOLIDAÇÃO DO
// ANO" nem equivalente em AUDITORIA/rows-pdfjs/AJU-01.rows.txt). O parser SOMA
// os doze meses e marca o resultado com `derivadoDosMeses: true`, e o próprio
// estadoFichas registra isso como parcial, com o motivo "Consolidação calculada
// a partir dos meses; não equivale a uma ficha anual integral".
//
// Exibir esse número ao lado dos outros, sem dizer que foi o app que somou,
// faria a pessoa procurar no papel um quadro que não existe, ou pior, tratar
// uma conta nossa como valor declarado.

// Valor do quadro. Aceita número e também texto que seja um número inteiro,
// porque descartar uma linha que TEM valor deixa o quadro exibido menor que o
// da declaração, e nada avisa. Texto que não é número continua fora: exibi-lo
// como moeda produziria "R$ NaN" na tela. Ver o mesmo helper em
// resumoDeclaracao.js, achado no ataque de 31/08/2026.
const comoNumero = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const linha = (rotulo, valor) => {
  const n = comoNumero(valor);
  return n === null ? null : { rotulo, valor: n };
};

export const AVISO_DERIVADO = 'Estes totais não vêm de um quadro anual da declaração: a ficha impressa é mensal, e o app somou os doze meses. Confira mês a mês acima.';

export function ehDerivadoDosMeses(anual) {
  return anual?.derivadoDosMeses === true;
}

// Ordem: primeiro a apuração do ano, depois a consolidação, que é onde entram
// as retenções compensáveis. São dois assuntos e não podem virar uma lista só.
export function linhasAnualRendaVariavel(anual) {
  if (!anual) return [];
  return [
    linha('Resultado líquido do ano', anual.resultadoLiquido),
    linha('Resultado negativo de meses anteriores', anual.resultadoNegativoMesesAnteriores),
    linha('Base de cálculo', anual.baseCalculo),
    linha('Prejuízo a compensar', anual.prejuizoACompensar),
    linha('Imposto devido', anual.impostoDevido),
    linha('Total do imposto devido na consolidação', anual.consolidacaoImpostoDevido),
    linha('IR fonte de day-trade de meses anteriores', anual.consolidacaoIrFonteDayTradeMesesAnteriores),
    linha('IR fonte de day-trade a compensar', anual.consolidacaoIrFonteDayTradeACompensar),
    linha('IR fonte (Lei nº 11.033/2004) no ano', anual.irFonteLei11033Ano),
    linha('Imposto a pagar na consolidação', anual.consolidacaoImpostoAPagar),
  ].filter(Boolean);
}

export function linhasAnualFiiFiagro(anual) {
  if (!anual) return [];
  return [
    linha('Resultado líquido do ano', anual.resultadoLiquido),
    linha('Resultado negativo de mês anterior', anual.resultadoNegativoMesAnterior),
    linha('Base de cálculo', anual.baseCalculoImposto),
    linha('Prejuízo a compensar', anual.prejuizoCompensar),
    linha('Imposto devido', anual.impostoDevido),
    linha('IR retido (Lei nº 11.033/2004)', anual.impostoRetidoLei11033),
    linha('Imposto a pagar', anual.impostoAPagar),
  ].filter(Boolean);
}
