// Cálculo do imposto mensal de Renda Variável (item E do
// HANDOFF-2026-09-03.md), para o lançamento manual de um mês que a
// declaração importada não trouxe (ou trouxe errado). Só este módulo
// CALCULA algo em Renda Variável — o resto do app (RendaVariavelPage.jsx)
// é deliberadamente somente leitura, ver o comentário no topo daquele
// arquivo.
//
// Base legal conferida em normas.receita.fazenda.gov.br em 03/09/2026 (IN
// RFB nº 1.585/2015, texto vigente/anotado — idAto 67494):
//
// - Art. 57: ganhos líquidos em operações COMUNS (mercado à vista, opções,
//   termo, futuro) — alíquota de 15%.
// - Art. 65, caput e § 11, I: rendimento de DAY-TRADE — alíquota de 20%
//   sobre o RESULTADO MENSAL (não confundir com o IRRF de 1% do caput, que
//   é retenção na fonte por operação, não o imposto devido sobre o mês).
// - Art. 64, caput: fixa o horizonte de compensação para as perdas dos
//   arts. 27, 58 e 60 a 62 — "no próprio mês ou nos meses subsequentes,
//   INCLUSIVE NOS ANOS-CALENDÁRIO SEGUINTES" — "exceto no caso de perdas em
//   operações de day-trade, que somente serão compensadas com ganhos
//   auferidos em operações da mesma espécie". A exceção de day-trade,
//   dentro do próprio caput que fixa o horizonte plurianual, restringe A
//   CONTRAPARTE do abatimento (só compensa ganho de day-trade), não o
//   PRAZO — são cláusulas diferentes na mesma frase. Parágrafo único:
//   reforça a mesma barreira na direção oposta (perda comum não compensa
//   ganho de day-trade).
// - Art. 65, §§ 10-11: perda de day-trade compensa resultado positivo de
//   day-trade "apurados nos meses subsequentes" — só detalha a apuração
//   MENSAL do resultado; não cria uma regra de horizonte à parte, nem
//   restringe o alcance do art. 64 a um único ano-calendário.
//   Confirmado na Pergunta 711 do Perguntas e Respostas IRPF 2026 (RFB,
//   v1.00, 27/04/2026, "Prejuízo em dezembro - Compensação"): o quadro de
//   atenção estende expressamente aos "períodos seguintes", sem restrição
//   de ano, também para day-trade. sugerirCarry() abaixo compensa prejuízo
//   de day-trade entre anos-calendário com base neste fundamento.
// - Art. 63, § 8º: IRRF de operações comuns (retenção "dedo-duro" da Lei
//   nº 11.033/2004, 0,005% sobre o valor da alienação — não é o que o
//   usuário digita aqui, o usuário digita o VALOR RETIDO) pode ser
//   deduzido do imposto sobre GANHOS LÍQUIDOS apurado no mês, compensado
//   nos meses subsequentes, e só o saldo final vai para a declaração de
//   ajuste anual (não é saldo autônomo transportável ao ano seguinte).
// - Art. 65, § 8º: IRRF de day-trade (1%) segue a MESMA mecânica, mas
//   textualmente restrita ao próprio artigo (day-trade). § 9º: saldo não
//   compensado ao fim do ano é hipótese de RESTITUIÇÃO, não de
//   transporte ao ano seguinte.
// - ABATIMENTO CRUZADO (pergunta do comando): o texto NÃO é ambíguo aqui —
//   cada IRRF abate só o imposto devido DA MESMA ESPÉCIE. O art. 63 § 8º
//   fala em abater "o imposto sobre ganhos líquidos apurados no mês" no
//   contexto do PRÓPRIO artigo (operações comuns, arts. 56 a 62); o
//   art. 65 § 8º fala em abater "o imposto incidente sobre ganhos líquidos
//   apurados no mês" no contexto do PRÓPRIO artigo 65 (day-trade). Nenhum
//   dos dois autoriza usar a retenção de uma espécie para abater o
//   imposto da outra. A estrutura da ficha oficial confirma essa leitura:
//   `consolidacao` tem SEIS linhas de IRRF separadas (3 de day-trade, 3 da
//   Lei 11.033) antes de somar num único "Imposto a pagar" — a soma final
//   é o RESULTADO de duas contas segregadas, não uma dedução do total
//   combinado. calcularMesComuns() implementa a leitura segregada.
// - Art. 37, caput e § 1º, I, "a": ganho de capital/ganho líquido na
//   alienação de cotas de FII por pessoa física EM BOLSA — alíquota de
//   20%, apurado "de acordo com os procedimentos previstos no art. 56"
//   (a mesma Seção que abre o regime mensal dos arts. 57 a 65, inclusive a
//   Subseção VI "Da Compensação de Perdas", art. 64). É essa remissão que
//   sustenta a compensação de prejuízo de FII em meses/anos seguintes —
//   não há, no art. 37, uma frase autônoma dizendo isso; a base é a
//   remissão ao regime geral do art. 56 em diante.
// - Art. 37, § 2º: restringe essa compensação — "as perdas incorridas na
//   alienação de cotas de fundo de investimento imobiliário só podem ser
//   compensadas com ganhos auferidos na alienação de cotas de FUNDO DA
//   MESMA ESPÉCIE" (não é qualquer FII/Fiagro contra qualquer outro).
//   calcularMesFii() não modela "espécie de fundo" (a linha mensal da
//   ficha não distingue isso) — a segregação por espécie, se a usuária
//   precisar dela, fica para uma extensão futura.
// - Alíquota do FII "vem do formulário, default 20%": o caput do art. 37
//   fixa 20% para a hipótese normal (alienação/resgate em bolsa), mas o
//   § 1º, II prevê que ganho de capital de cotas alienadas FORA de bolsa
//   segue "as regras aplicáveis aos ganhos de capital na alienação de bens
//   ou de direitos de qualquer natureza" — outra tabela, não fixa em 20%.
//   É por isso que a alíquota não pode ser fixada no código.

const arredondar = (n) => Math.round((Number(n) || 0) * 100) / 100;

// MERCADOS de comuns/day-trade (breakdown por modalidade, ver RV_MERCADOS/
// MERCADOS em RendaVariavelPage.jsx): o lançamento manual não abre por
// mercado, só o resultado consolidado do mês — os 13 campos ficam null,
// igual pedido no comando. `Valor`/`MERCADOS` na tela já tratam null como
// "sem dado" (não confundir com zero).
const MERCADOS_NULOS = {
  vistaAcoes: null, vistaOuro: null, vistaOuroForaBolsa: null,
  opcoesAcoes: null, opcoesOuro: null, opcoesForaBolsa: null, opcoesOutros: null,
  futuroDolar: null, futuroIndices: null, futuroJuros: null, futuroOutros: null,
  termoAcoesOuro: null, termoOutros: null,
};

const ALIQUOTA_COMUNS = 0.15; // art. 57
const ALIQUOTA_DAYTRADE = 0.20; // art. 65, § 11, I

// Um lado (comuns OU day-trade) da apuração do mês: base, prejuízo a
// compensar e imposto devido, pela mesma fórmula em ambos (a diferença
// entre as duas espécies está só na alíquota e em quem pode compensar
// contra quem, tratado em calcularMesComuns).
function apurarLado(resultado, negAnterior, aliquota) {
  const res = Number(resultado) || 0;
  const negAnt = Math.abs(Number(negAnterior) || 0);
  const baseCalculoImposto = arredondar(Math.max(0, res - negAnt));
  const prejuizoCompensar = arredondar(Math.max(0, negAnt - res));
  const impostoDevido = arredondar(baseCalculoImposto * aliquota);
  return { resultadoLiquidoMes: arredondar(res), resultadoNegativoMesAnterior: arredondar(negAnt), baseCalculoImposto, prejuizoCompensar, impostoDevido };
}

// Retenção de uma espécie: quanto abate do imposto devido DAQUELA espécie
// no mês (nunca mais que o devido, art. 63 § 8º/art. 65 § 8º) e quanto
// sobra para compensar o mês seguinte (mesma espécie).
function abaterRetencao(impostoDevido, retidoNoMes, retidoAnteriores) {
  const disponivel = (Number(retidoNoMes) || 0) + Math.abs(Number(retidoAnteriores) || 0);
  const usado = Math.min(impostoDevido, disponivel);
  return {
    mes: arredondar(Number(retidoNoMes) || 0),
    mesesAnteriores: arredondar(Math.abs(Number(retidoAnteriores) || 0)),
    compensar: arredondar(disponivel - usado),
    aPagar: arredondar(impostoDevido - usado),
    pago: arredondar(usado), // ver ressalva no relatório: sem campo próprio de "pago", presume-se recolhido o apurado.
  };
}

// Linha mensal de operações COMUNS + DAY-TRADE, no formato exato de
// rendaVariavelMensalOficial/Manual (comuns/daytrade/consolidacao).
// day-trade preenche os MESMOS campos de apuração que comuns (base,
// prejuízo a compensar, imposto devido) porque saldosCompensaveis.js
// (somaUltimaCompetencia) e a tabela mensal (LINHAS_APURACAO) leem
// daytrade.prejuizoCompensar do mesmo jeito que leem comuns.prejuizoCompensar.
export function calcularMesComuns({
  mes, titular = true, cpfDependente = null,
  resultadoComuns, resultadoDayTrade,
  irrfComuns11033 = 0, irrfDayTrade = 0,
  negAnteriorComuns = 0, negAnteriorDayTrade = 0,
  irrf11033Anteriores = 0, irrfDTAnteriores = 0,
}) {
  const comunsApurado = apurarLado(resultadoComuns, negAnteriorComuns, ALIQUOTA_COMUNS);
  const dayTradeApurado = apurarLado(resultadoDayTrade, negAnteriorDayTrade, ALIQUOTA_DAYTRADE);

  const totalImpostoDevido = arredondar(comunsApurado.impostoDevido + dayTradeApurado.impostoDevido);

  // Abatimento SEGREGADO por espécie (ver nota de base legal no topo do
  // arquivo): a retenção da Lei 11.033/2004 só abate o imposto devido de
  // operações comuns; a retenção de day-trade só abate o imposto devido
  // de day-trade. impostoPagar final é a SOMA dos dois restos, não uma
  // dedução do total combinado.
  const lei11033 = abaterRetencao(comunsApurado.impostoDevido, irrfComuns11033, irrf11033Anteriores);
  const dayTradeRetencao = abaterRetencao(dayTradeApurado.impostoDevido, irrfDayTrade, irrfDTAnteriores);

  const impostoPagar = arredondar(lei11033.aPagar + dayTradeRetencao.aPagar);
  const impostoPago = arredondar(lei11033.pago + dayTradeRetencao.pago);

  return {
    mes, titular, cpfDependente, origem: 'manual',
    comuns: { ...comunsApurado, ...MERCADOS_NULOS },
    daytrade: { ...dayTradeApurado, ...MERCADOS_NULOS },
    consolidacao: {
      totalImpostoDevido,
      irFonteDayTradeMes: dayTradeRetencao.mes,
      irFonteDayTradeMesesAnteriores: dayTradeRetencao.mesesAnteriores,
      irFonteDayTradeCompensar: dayTradeRetencao.compensar,
      irFonteLei11033Mes: lei11033.mes,
      irFonteLei11033MesesAnteriores: lei11033.mesesAnteriores,
      irFonteLei11033Compensar: lei11033.compensar,
      impostoPagar,
      impostoPago,
    },
  };
}

// Linha mensal de FII/Fiagro, no formato exato de fiiFiagroMensalOficial/
// Manual. Uma retenção só (não há segregação comuns/day-trade aqui).
export function calcularMesFii({
  mes, titular = true, cpfDependente = null,
  resultado, irrfRetido = 0, aliquota = 0.20,
  negAnterior = 0, retidoAnteriores = 0,
}) {
  const apurado = apurarLado(resultado, negAnterior, Number(aliquota));
  const retencao = abaterRetencao(apurado.impostoDevido, irrfRetido, retidoAnteriores);
  return {
    mes, titular, cpfDependente, origem: 'manual',
    resultadoLiquidoMes: apurado.resultadoLiquidoMes,
    resultadoNegativoMesAnterior: apurado.resultadoNegativoMesAnterior,
    baseCalculoImposto: apurado.baseCalculoImposto,
    prejuizoCompensar: apurado.prejuizoCompensar,
    // Sem "%": fiiFiagroMensalOficial já grava um número/string pt-BR cru
    // (extração real do PDF, ver telasConsomemExtracao.test.js), e é
    // formatarAliquotaFicha() quem acrescenta o "%" na exibição.
    aliquota: (Math.round(Number(aliquota) * 10000) / 100).toString().replace('.', ','),
    impostoDevido: apurado.impostoDevido,
    impostoRetidoNoMes: retencao.mes,
    impostoRetidoMesesAnteriores: retencao.mesesAnteriores,
    impostoACompensar: retencao.compensar,
    impostoAPagar: retencao.aPagar,
    impostoPago: retencao.pago,
  };
}

const mesmoBeneficiario = (l, titular, cpfDependente) =>
  titular ? !!l.titular : (!l.titular && String(l.cpfDependente || '') === String(cpfDependente || ''));

// Sugere o carry-forward (prejuízo acumulado + saldo de IRRF a compensar)
// para um novo lançamento de `mes`, beneficiário e ficha ('comuns' | 'fii').
// Prioridade: (1) mês mais recente ANTERIOR a `mes` dentro do MESMO ano
// para o mesmo beneficiário; (2) última competência do ANO ANTERIOR
// (`linhasAnoAnterior`), só para o prejuízo — IRRF nunca atravessa
// ano-calendário (art. 63 § 8º, III; art. 65 § 9º: vira ajuste
// anual/restituição, nunca saldo autônomo do ano seguinte); (3) zeros.
export function sugerirCarry({ linhasDoAno = [], linhasAnoAnterior = [], mes, titular = true, cpfDependente = null, ficha }) {
  const doBeneficiario = (lista) => lista.filter(l => mesmoBeneficiario(l, titular, cpfDependente));
  const anteriorNoAno = doBeneficiario(linhasDoAno)
    .filter(l => l.mes < mes)
    .sort((a, b) => b.mes - a.mes)[0];

  if (anteriorNoAno) {
    if (ficha === 'fii') {
      return {
        negAnterior: anteriorNoAno.prejuizoCompensar || 0,
        irrfAnteriores: anteriorNoAno.impostoACompensar || 0,
        origem: 'mes-anterior',
      };
    }
    return {
      negAnteriorComuns: anteriorNoAno.comuns?.prejuizoCompensar || 0,
      negAnteriorDayTrade: anteriorNoAno.daytrade?.prejuizoCompensar || 0,
      irrf11033Anteriores: anteriorNoAno.consolidacao?.irFonteLei11033Compensar || 0,
      irrfDTAnteriores: anteriorNoAno.consolidacao?.irFonteDayTradeCompensar || 0,
      origem: 'mes-anterior',
    };
  }

  const ultimaDoAnoAnterior = doBeneficiario(linhasAnoAnterior).sort((a, b) => b.mes - a.mes)[0];
  if (ultimaDoAnoAnterior) {
    if (ficha === 'fii') {
      return { negAnterior: ultimaDoAnoAnterior.prejuizoCompensar || 0, irrfAnteriores: 0, origem: 'ano-anterior' };
    }
    return {
      negAnteriorComuns: ultimaDoAnoAnterior.comuns?.prejuizoCompensar || 0,
      negAnteriorDayTrade: ultimaDoAnoAnterior.daytrade?.prejuizoCompensar || 0,
      irrf11033Anteriores: 0,
      irrfDTAnteriores: 0,
      origem: 'ano-anterior',
    };
  }

  return ficha === 'fii'
    ? { negAnterior: 0, irrfAnteriores: 0, origem: 'nenhum' }
    : { negAnteriorComuns: 0, negAnteriorDayTrade: 0, irrf11033Anteriores: 0, irrfDTAnteriores: 0, origem: 'nenhum' };
}
