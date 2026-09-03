import { describe, it, expect } from 'vitest';
import { calcularMesComuns, calcularMesFii, sugerirCarry } from './calculoRendaVariavelMes';
import { formatarAliquotaFicha } from '../utils/formatters';

describe('calcularMesComuns', () => {
  it('mês com lucro, sem prejuízo anterior: base = resultado, imposto a 15%', () => {
    const linha = calcularMesComuns({ mes: 3, resultadoComuns: 1000, resultadoDayTrade: 0 });
    expect(linha.comuns.baseCalculoImposto).toBeCloseTo(1000, 2);
    expect(linha.comuns.impostoDevido).toBeCloseTo(150, 2); // 1000 * 15%
    expect(linha.comuns.prejuizoCompensar).toBe(0);
    expect(linha.consolidacao.totalImpostoDevido).toBeCloseTo(150, 2);
  });

  it('mês com prejuízo: base zero, prejuízo vira saldo a compensar (magnitude positiva)', () => {
    const linha = calcularMesComuns({ mes: 3, resultadoComuns: -500, resultadoDayTrade: 0 });
    expect(linha.comuns.baseCalculoImposto).toBe(0);
    expect(linha.comuns.prejuizoCompensar).toBeCloseTo(500, 2);
    expect(linha.comuns.impostoDevido).toBe(0);
  });

  it('mês seguinte consome o prejuízo PARCIALMENTE quando o resultado do mês é menor que o carry', () => {
    const linha = calcularMesComuns({ mes: 4, resultadoComuns: 300, resultadoDayTrade: 0, negAnteriorComuns: 500 });
    expect(linha.comuns.baseCalculoImposto).toBe(0); // 300 - 500 < 0
    expect(linha.comuns.prejuizoCompensar).toBeCloseTo(200, 2); // sobra 500 - 300
    expect(linha.comuns.impostoDevido).toBe(0);
  });

  it('mês seguinte consome o prejuízo TOTALMENTE e tributa o excedente', () => {
    const linha = calcularMesComuns({ mes: 4, resultadoComuns: 800, resultadoDayTrade: 0, negAnteriorComuns: 500 });
    expect(linha.comuns.baseCalculoImposto).toBeCloseTo(300, 2); // 800 - 500
    expect(linha.comuns.prejuizoCompensar).toBe(0);
    expect(linha.comuns.impostoDevido).toBeCloseTo(45, 2); // 300 * 15%
  });

  it('prejuízo de day-trade NÃO abate a base de operações comuns (art. 64: só compensa a mesma espécie)', () => {
    const linha = calcularMesComuns({ mes: 5, resultadoComuns: 1000, resultadoDayTrade: -300 });
    expect(linha.comuns.baseCalculoImposto).toBeCloseTo(1000, 2);
    expect(linha.comuns.impostoDevido).toBeCloseTo(150, 2);
    expect(linha.daytrade.baseCalculoImposto).toBe(0);
    expect(linha.daytrade.prejuizoCompensar).toBeCloseTo(300, 2);
    expect(linha.daytrade.impostoDevido).toBe(0);
    expect(linha.consolidacao.totalImpostoDevido).toBeCloseTo(150, 2); // só comuns
  });

  it('day-trade tributa a 20% sobre o resultado positivo do mês', () => {
    const linha = calcularMesComuns({ mes: 5, resultadoComuns: 0, resultadoDayTrade: 1000 });
    expect(linha.daytrade.baseCalculoImposto).toBeCloseTo(1000, 2);
    expect(linha.daytrade.impostoDevido).toBeCloseTo(200, 2); // 1000 * 20%
  });

  it('IRRF de operações comuns e de day-trade abatem SÓ o imposto devido da própria espécie (segregado, não do total)', () => {
    const linha = calcularMesComuns({
      mes: 6, resultadoComuns: 2000, resultadoDayTrade: 1000,
      irrfComuns11033: 100, irrfDayTrade: 250,
    });
    // comuns: devido 300 (2000*15%), retido 100 -> paga 200, nada sobra
    expect(linha.comuns.impostoDevido).toBeCloseTo(300, 2);
    expect(linha.consolidacao.irFonteLei11033Mes).toBeCloseTo(100, 2);
    expect(linha.consolidacao.irFonteLei11033Compensar).toBe(0);
    // day-trade: devido 200 (1000*20%), retido 250 -> paga 0, sobra 50 pra compensar
    expect(linha.daytrade.impostoDevido).toBeCloseTo(200, 2);
    expect(linha.consolidacao.irFonteDayTradeMes).toBeCloseTo(250, 2);
    expect(linha.consolidacao.irFonteDayTradeCompensar).toBeCloseTo(50, 2);
    // total a pagar = (300-100) + (200-200) = 200; nunca usa o excedente de
    // uma espécie para abater a outra (se abatesse do total, o IRRF de
    // day-trade sobrando (50) reduziria o total a pagar de comuns).
    expect(linha.consolidacao.totalImpostoDevido).toBeCloseTo(500, 2);
    expect(linha.consolidacao.impostoPagar).toBeCloseTo(200, 2);
    expect(linha.consolidacao.impostoPago).toBeCloseTo(300, 2); // 100 + 200 efetivamente abatidos
  });

  it('IRRF de meses anteriores entra na conta de disponível, antes do retido no próprio mês', () => {
    const linha = calcularMesComuns({
      mes: 7, resultadoComuns: 1000, resultadoDayTrade: 0,
      irrfComuns11033: 0, irrf11033Anteriores: 200,
    });
    expect(linha.comuns.impostoDevido).toBeCloseTo(150, 2);
    expect(linha.consolidacao.irFonteLei11033MesesAnteriores).toBeCloseTo(200, 2);
    expect(linha.consolidacao.impostoPagar).toBe(0); // 150 cabe dentro dos 200 disponíveis
    expect(linha.consolidacao.irFonteLei11033Compensar).toBeCloseTo(50, 2); // sobra 200-150
  });

  it('os 13 campos de mercado ficam null em comuns e em day-trade (lançamento manual não abre por modalidade)', () => {
    const linha = calcularMesComuns({ mes: 1, resultadoComuns: 100, resultadoDayTrade: 50 });
    expect(linha.comuns.vistaAcoes).toBeNull();
    expect(linha.comuns.futuroDolar).toBeNull();
    expect(linha.daytrade.termoOutros).toBeNull();
  });

  it('marca origem manual e preserva mês/beneficiário', () => {
    const linha = calcularMesComuns({ mes: 9, titular: false, cpfDependente: '11122233344', resultadoComuns: 0, resultadoDayTrade: 0 });
    expect(linha.origem).toBe('manual');
    expect(linha.mes).toBe(9);
    expect(linha.titular).toBe(false);
    expect(linha.cpfDependente).toBe('11122233344');
  });
});

describe('calcularMesFii', () => {
  // aliquota sai como número/string pt-BR CRU (sem "%"), o mesmo formato que
  // fiiFiagroMensalOficial já grava na extração real do PDF (ver
  // telasConsomemExtracao.test.js) -- é formatarAliquotaFicha() quem
  // acrescenta o "%" na exibição, não este módulo.
  it('alíquota padrão de 20%', () => {
    const linha = calcularMesFii({ mes: 3, resultado: 1000 });
    expect(linha.baseCalculoImposto).toBeCloseTo(1000, 2);
    expect(linha.impostoDevido).toBeCloseTo(200, 2);
    expect(formatarAliquotaFicha(linha.aliquota)).toBe('20,00%');
  });

  it('alíquota diferente do padrão, informada no formulário (ficha real pode trazer outra)', () => {
    const linha = calcularMesFii({ mes: 3, resultado: 1000, aliquota: 0.15 });
    expect(linha.impostoDevido).toBeCloseTo(150, 2);
    expect(formatarAliquotaFicha(linha.aliquota)).toBe('15,00%');
  });

  it('prejuízo do mês vira saldo a compensar, mesma fórmula de comuns', () => {
    const linha = calcularMesFii({ mes: 4, resultado: -300, negAnterior: 100 });
    expect(linha.baseCalculoImposto).toBe(0);
    expect(linha.prejuizoCompensar).toBeCloseTo(400, 2); // 100 + 300
  });

  it('IRRF retido abate o imposto devido do próprio mês, sobra fica em impostoACompensar', () => {
    const linha = calcularMesFii({ mes: 5, resultado: 1000, irrfRetido: 300 });
    expect(linha.impostoDevido).toBeCloseTo(200, 2);
    expect(linha.impostoRetidoNoMes).toBeCloseTo(300, 2);
    expect(linha.impostoAPagar).toBe(0);
    expect(linha.impostoACompensar).toBeCloseTo(100, 2); // 300 - 200
  });
});

describe('sugerirCarry', () => {
  const comuns5 = { mes: 5, titular: true, comuns: { prejuizoCompensar: 400 }, daytrade: { prejuizoCompensar: 90 }, consolidacao: { irFonteLei11033Compensar: 20, irFonteDayTradeCompensar: 5 } };
  const comuns8 = { mes: 8, titular: true, comuns: { prejuizoCompensar: 700 }, daytrade: { prejuizoCompensar: 0 }, consolidacao: { irFonteLei11033Compensar: 0, irFonteDayTradeCompensar: 0 } };

  it('origem "mes-anterior": pega o mês mais recente ANTERIOR ao lançado, dentro do mesmo ano', () => {
    const r = sugerirCarry({ linhasDoAno: [comuns5, comuns8], mes: 9, titular: true, ficha: 'comuns' });
    expect(r.origem).toBe('mes-anterior');
    expect(r.negAnteriorComuns).toBeCloseTo(700, 2); // do mês 8, não do mês 5
    expect(r.negAnteriorDayTrade).toBe(0);
    expect(r.irrf11033Anteriores).toBe(0);
  });

  it('day-trade e comuns são lidos de campos separados na mesma linha (segregados)', () => {
    const r = sugerirCarry({ linhasDoAno: [comuns5], mes: 6, titular: true, ficha: 'comuns' });
    expect(r.negAnteriorComuns).toBeCloseTo(400, 2);
    expect(r.negAnteriorDayTrade).toBeCloseTo(90, 2);
    expect(r.irrf11033Anteriores).toBeCloseTo(20, 2);
    expect(r.irrfDTAnteriores).toBeCloseTo(5, 2);
  });

  it('origem "ano-anterior": sem mês anterior no ano corrente, busca a última competência do ano anterior; IRRF nunca atravessa ano', () => {
    const dez2025 = { mes: 12, titular: true, comuns: { prejuizoCompensar: 5000 }, daytrade: { prejuizoCompensar: 0 }, consolidacao: { irFonteLei11033Compensar: 999, irFonteDayTradeCompensar: 0 } };
    const r = sugerirCarry({ linhasDoAno: [], linhasAnoAnterior: [dez2025], mes: 2, titular: true, ficha: 'comuns' });
    expect(r.origem).toBe('ano-anterior');
    expect(r.negAnteriorComuns).toBeCloseTo(5000, 2); // prejuízo atravessa
    expect(r.irrf11033Anteriores).toBe(0); // mas o IRRF sobrando de 2025 NUNCA atravessa
  });

  it('origem "nenhum": sem mês anterior no ano nem no ano anterior, tudo zero', () => {
    const r = sugerirCarry({ linhasDoAno: [], linhasAnoAnterior: [], mes: 1, titular: true, ficha: 'comuns' });
    expect(r.origem).toBe('nenhum');
    expect(r.negAnteriorComuns).toBe(0);
    expect(r.negAnteriorDayTrade).toBe(0);
  });

  it('FII usa um único campo de prejuízo (não segregado em comuns/day-trade)', () => {
    const fii5 = { mes: 5, titular: true, prejuizoCompensar: 250, impostoACompensar: 30 };
    const r = sugerirCarry({ linhasDoAno: [fii5], mes: 6, titular: true, ficha: 'fii' });
    expect(r.origem).toBe('mes-anterior');
    expect(r.negAnterior).toBeCloseTo(250, 2);
    expect(r.irrfAnteriores).toBeCloseTo(30, 2);
  });

  it('não mistura o carry de um beneficiário com o de outro (titular x dependente)', () => {
    const doTitular = { mes: 5, titular: true, comuns: { prejuizoCompensar: 1000 }, daytrade: { prejuizoCompensar: 0 }, consolidacao: {} };
    const doDependente = { mes: 5, titular: false, cpfDependente: '99988877766', comuns: { prejuizoCompensar: 50 }, daytrade: { prejuizoCompensar: 0 }, consolidacao: {} };
    const r = sugerirCarry({ linhasDoAno: [doTitular, doDependente], mes: 6, titular: false, cpfDependente: '99988877766', ficha: 'comuns' });
    expect(r.negAnteriorComuns).toBeCloseTo(50, 2); // do dependente, não do titular
  });
});
