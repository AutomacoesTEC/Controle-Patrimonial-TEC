// Saldos que ATRAVESSAM o exercício e Disponibilidades em 31/12.
//
// Base do estudo de variação patrimonial (Lei nº 7.713/1988, art. 3º, § 1º;
// IN RFB nº 1.585/2015, arts. 64, 65 §§ 8º-9º e 37 § 2º): o que a lei deixa
// transportar de um ano para o outro são os PREJUÍZOS compensáveis — nunca o
// IRRF, que se resolve no próprio ajuste anual e, se sobrar, vira restituição.
//
// Este módulo é só LEITURA. Os prejuízos de renda variável vêm da última
// competência de cada ficha mensal, exatamente como a declaração os apurou; o
// prejuízo rural é o saldo acumulado que o app já carrega no rollover de ano
// (state.prejuizoRuralAcompensar). Nada aqui é recalculado — o mesmo princípio
// de "não inventar número" que rege o resto do demonstrativo.

import { totalBensAteData, situacaoBemAteData } from './demonstrativos';
import { linhasComunsDoAno, linhasFiiDoAno } from './rendaVariavelMensal';

// Última competência de cada beneficiário numa ficha mensal, somando o valor
// lido por `ler`. Titular e dependentes são buckets de compensação SEPARADOS
// na lei (o prejuízo de um não abate o ganho do outro); aqui a soma é só para
// a visão de "quanto no total segue para o ano seguinte" — o rótulo diz isso.
function somaUltimaCompetencia(lista, ler) {
  if (!Array.isArray(lista) || lista.length === 0) return 0;
  const porBeneficiario = new Map();
  for (const l of lista) {
    const chave = l.titular ? 'titular' : `dep:${l.cpfDependente || ''}`;
    const atual = porBeneficiario.get(chave);
    if (!atual || (l.mes || 0) > (atual.mes || 0)) porBeneficiario.set(chave, l);
  }
  let total = 0;
  for (const l of porBeneficiario.values()) total += (parseFloat(ler(l)) || 0);
  return total;
}

// Prejuízos compensáveis que seguem para o exercício seguinte, a partir dos
// dados de fim de período (o snapshot do ano da data de corte "até").
// `prejuizoRuralAcompensar` é armazenado como saldo <= 0 no estado; a magnitude
// é a perda a compensar.
export function saldosQueAtravessam(dadosFim) {
  if (!dadosFim) return [];
  const rows = [];

  const oficialRural = dadosFim.apuracaoResultadoRuralOficial?.saldoPrejuizoExercicioSeguinte;
  const usaOficial = oficialRural != null && !dadosFim.prejuizoRuralAjustadoManualmente;
  const rural = usaOficial ? Math.abs(Number(oficialRural) || 0) : Math.abs(Math.min(0, Number(dadosFim.prejuizoRuralAcompensar) || 0));
  if (rural > 0) {
    rows.push({
      chave: 'rural',
      origem: usaOficial ? 'Declaração' : 'Controle manual',
      requerRevisao: usaOficial && (dadosFim.lancamentosRurais || []).length > 0,
      rotulo: 'Prejuízo da atividade rural',
      valor: rural,
      base: 'Regime próprio da atividade rural; compensa resultado rural de anos seguintes.',
    });
  }

  // Mescla oficial+manual (item E) antes de ler a última competência: um
  // mês lançado à mão pode ser justamente o que fecha o ano, e o saldo que
  // atravessa o exercício precisa refletir isso. Ver rendaVariavelMensal.js.
  const rv = linhasComunsDoAno(dadosFim);
  const comuns = somaUltimaCompetencia(rv, l => l.comuns?.prejuizoCompensar);
  if (comuns > 0) {
    rows.push({
      chave: 'rvComuns',
      rotulo: 'Prejuízo em renda variável (operações comuns)',
      valor: comuns,
      base: 'IN RFB nº 1.585/2015, art. 64: compensa ganhos futuros de operações comuns.',
    });
  }
  const dayTrade = somaUltimaCompetencia(rv, l => l.daytrade?.prejuizoCompensar);
  if (dayTrade > 0) {
    rows.push({
      chave: 'rvDayTrade',
      rotulo: 'Prejuízo em day-trade',
      valor: dayTrade,
      base: 'IN RFB nº 1.585/2015, art. 65: compensa apenas ganhos futuros de day-trade.',
    });
  }
  const fii = somaUltimaCompetencia(linhasFiiDoAno(dadosFim), l => l.prejuizoCompensar);
  if (fii > 0) {
    rows.push({
      chave: 'fii',
      rotulo: 'Prejuízo em FII / Fiagro',
      valor: fii,
      base: 'IN RFB nº 1.585/2015, art. 37, § 2º: controle e compensação próprios das cotas.',
    });
  }

  return rows;
}

// Grupos da ficha Bens e Direitos cujo valor declarado JÁ É dinheiro
// disponível (mesmo conjunto de GRUPOS_QUE_JA_SAO_DINHEIRO em demonstrativos.js):
// aplicações e investimentos (04), créditos (05), depósitos à vista e numerário
// (06) e fundos (07).
const GRUPOS_DISPONIBILIDADE = [
  { grupo: '04', nome: 'Aplicações e investimentos' },
  { grupo: '05', nome: 'Créditos' },
  { grupo: '06', nome: 'Depósitos à vista e numerário' },
  { grupo: '07', nome: 'Fundos' },
];

// Disponibilidade financeira na data de corte: quanto do patrimônio já está em
// forma de dinheiro. É a referência de compatibilidade das seções 11-12 do
// estudo — o Saldo de Caixa que fecha a conciliação precisa ser plausível
// diante do que a pessoa efetivamente tem líquido. NÃO altera nenhum cálculo
// do demonstrativo; é leitura ao lado.
export function disponibilidadesEmData(dadosFim, dataAte) {
  const vazio = { total: 0, porGrupo: [] };
  if (!dadosFim || !Array.isArray(dadosFim.bens)) return vazio;
  const porGrupo = GRUPOS_DISPONIBILIDADE.map(({ grupo, nome }) => {
    const bensDoGrupo = dadosFim.bens.filter(b => (b.grupo || '') === grupo);
    const valor = totalBensAteData(bensDoGrupo, dataAte, 'ate');
    return { grupo, nome, valor };
  }).filter(g => g.valor !== 0);
  const total = porGrupo.reduce((s, g) => s + g.valor, 0);
  return { total, porGrupo };
}

// Exportado só para teste: soma um bem na data (fina do período).
export const _situacaoBemAteData = situacaoBemAteData;
