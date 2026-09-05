import { describe, it, expect } from 'vitest';
import { initialState } from './reducer';
import { demonstrativoPeriodo } from './consultaPeriodo';
import { totalRendimentos, ganhosApuradosPeriodo, resultadoAtividadeRuralPeriodo, situacaoBemAteData } from './demonstrativos';
import { aplicarIrrfDecimoTerceiro } from '../pages/importParsers';

// Auditoria independente: fixtures sintéticas, sem dados de contribuintes.
// it.fails preserva os defeitos ainda pendentes; cada correção autorizada
// converte seu cenário em teste normal, sem enfraquecer a expectativa.
// Reproduzir: node node_modules/vitest/vitest.mjs run src/store/auditoriaDemonstrativo20260905.test.js
const estado = extra => ({ ...structuredClone(initialState), anoCalendario: 2026, ...extra });
const ano = s => demonstrativoPeriodo(s, '2026-01-01', '2026-12-31');
const renda = (tipo, valor, extra = {}) => ({ tipo, valor, data: '2026-06-10', ...extra });
const bem = (anterior, atual, movimentacoes = []) => ({ id: 1, grupo: '02', codigo: '01', discriminacao: 'Bem sintético', situacao_anterior: anterior, situacao_atual: atual, movimentacoes });

describe('auditoria independente do Demonstrativo — oráculos de caixa', () => {
  it('PJ: bruto 120 mil menos INSS 10 mil e IRRF 15 mil disponibiliza 95 mil', () => {
    expect(ano(estado({ rendimentos: [renda('tributavel_pj', 120000, { contribuicaoPrevidenciaria: 10000, irrf: 15000 })] })).saldoDeCaixa).toBe(95000);
  });
  it('compra financiada de 80 mil com empréstimo de 60 mil consome 20 mil', () => {
    expect(ano(estado({ bens: [bem(0, 80000)], dividas: [{ situacao_anterior: 0, situacao_atual: 60000 }] })).saldoDeCaixa).toBe(-20000);
  });
  it('venda à vista por 70 mil de bem que custou 100 mil libera 70 mil', () => {
    expect(ano(estado({ bens: [bem(100000, 0, [{ tipo: 'venda_total', data: '2026-06-10', valor: 100000, valorVenda: 70000 }])] })).saldoDeCaixa).toBe(70000);
  });
  it('saldo de banco declarado absorve recursos: conciliação zero não significa banco zero', () => {
    const s = estado({ bens: [{ ...bem(10000, 110000), grupo: '06' }], rendimentos: [renda('isento_09', 100000)] });
    expect(ano(s).saldoDeCaixa).toBe(0);
    expect(ano(s).varPatrimonial.bensAte).toBe(110000);
  });
  it('D01: carnê-leão pago de 2 mil reduz recebimentos de 10 mil para 8 mil', () => {
    expect(totalRendimentos([renda('tributavel_pf_exterior', 10000, { irrf: 2000 })], 0).totalGeral).toBe(8000);
  });
  it('D02: RRA tributável de 20 mil com IRRF de 3 mil disponibiliza 17 mil', () => {
    expect(totalRendimentos([renda('tributavel_rra', 20000, { irrf: 3000 })], 0).totalGeral).toBe(17000);
  });
  it('D03: 13º importado já líquido de 8 mil não sofre nova retenção de mil', () => {
    const rs = aplicarIrrfDecimoTerceiro([
      renda('tributavel_pj', 0, { beneficiario: 'Titular', irrfDecimoTerceiro: 1000 }),
      renda('exclusivo_0001', 8000),
    ]);
    expect(totalRendimentos(rs, 0).totalGeral).toBe(8000);
  });
  it('D04: RV mensal positiva de 10 mil gera recursos sem redigitar exclusivo', () => {
    const s = estado({ rendaVariavelMensalManual: [{ mes: 6, titular: true, comuns: { resultadoLiquidoMes: 10000 }, consolidacao: { totalImpostoDevido: 1500 } }] });
    // Imposto devido não prova pagamento; nesta fixture não houve pagamento.
    expect(ano(s).saldoDeCaixa).toBe(10000);
  });
  it('D04 controle: RV já resumida em exclusivos não duplica e outra pessoa não é compensada', () => {
    const mensal = { mes: 6, titular: true, comuns: { resultadoLiquidoMes: 10000 } };
    expect(ano(estado({ rendaVariavelMensalManual: [mensal], rendimentos: [renda('exclusivo_05', 10000, { beneficiario: 'Titular' })] })).saldoDeCaixa).toBe(10000);
    expect(ano(estado({ rendaVariavelMensalManual: [mensal], rendimentos: [renda('exclusivo_05', 10000, { beneficiario: 'Dependente', cpfDependente: '123' })] })).saldoDeCaixa).toBe(20000);
  });
  it('D05: perda FII de 4 mil reduz recursos em 4 mil', () => {
    const s = estado({ fiiFiagroMensalManual: [{ mes: 6, titular: true, resultadoLiquidoMes: -4000 }] });
    expect(ano(s).saldoDeCaixa).toBe(-4000);
  });
  it('D06: doação datada em dezembro não pode sair do caixa de janeiro', () => {
    const s = estado({ doacoesEfetuadasOficial: [{ data: '2026-12-10', valor: 1000, origem: 'manual' }] });
    expect(demonstrativoPeriodo(s, '2026-01-01', '2026-01-31').totalDoacoes).toBe(0);
  });
  it('D07: uma despesa rural adicional não substitui receita importada do mesmo mês', () => {
    const oficial = { ano: 2026, meses: [{ mes: 6, receitaBruta: 10000, despesaCusteioInvestimento: 2000 }] };
    expect(resultadoAtividadeRuralPeriodo([{ data: '2026-06-10', tipo: 'despesa', valor: 100 }], '2026-01-01', '2026-12-31', oficial)).toBe(7900);
  });
  it.fails('D08: operações diferentes com mesma data e preço não são duplicatas', () => {
    const s = estado({
      bens: [bem(10000, 0, [{ tipo: 'venda_total', data: '2026-06-10', valor: 10000, valorVenda: 15000 }])],
      apuracaoGanhoCapital: [{ bem: 'Outro bem sintético', dataAlienacao: '2026-06-10', custoAquisicao: 12000, valorAlienacao: 15000 }],
    });
    expect(ganhosApuradosPeriodo(s, '2026-01-01', '2026-12-31').total).toBe(8000);
  });
  it.fails('D09: foto anual sem data da alteração não pode inventar variação em todos os meses', () => {
    const b = bem(10000, 20000);
    const variacoes = [1, 2].map(m => situacaoBemAteData(b, `2026-0${m}-28`, 'ate') - situacaoBemAteData(b, `2026-0${m}-01`, 'de'));
    // Um único acréscimo anual não pode ser contado duas vezes em meses disjuntos.
    expect(variacoes.reduce((s, v) => s + v, 0)).toBeLessThanOrEqual(10000);
  });
  it('continuidade: estoques nas pontas e fluxos de dois anos se conciliam', () => {
    const anterior = estado({ anoCalendario: 2025, bens: [bem(0, 10000)], rendimentos: [{ ...renda('isento_09', 10000), data: '2025-06-10' }] });
    const s = estado({ historico: { 2025: anterior }, bens: [bem(10000, 15000)], rendimentos: [renda('isento_09', 5000)] });
    expect(demonstrativoPeriodo(s, '2025-01-01', '2026-12-31').saldoDeCaixa).toBe(0);
  });
  it.fails('D10: ganho de capital importado em exclusivos e operação não pode somar duas vezes', () => {
    const s = estado({
      bens: [bem(10000, 0)],
      rendimentos: [renda('exclusivo_0002', 5000)],
      apuracaoGanhoCapital: [{ bem: 'Bem sintético', dataAlienacao: '2026-06-10', custoAquisicao: 10000, valorAlienacao: 15000 }],
    });
    // Sem imposto pago: recebimento efetivo da venda é 15 mil.
    expect(ano(s).saldoDeCaixa).toBe(15000);
  });
  it.fails('D11: doação diretamente na declaração de 2025 paga em 2026 não sai do caixa 2025', () => {
    const s = estado({ anoCalendario: 2025, doacoesEcaIdosoOficial: [{ data: '2026-05-10', valor: 1000 }] });
    expect(demonstrativoPeriodo(s, '2025-01-01', '2025-12-31').totalDoacoes).toBe(0);
  });
});
