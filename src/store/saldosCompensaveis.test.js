import { describe, it, expect } from 'vitest';
import { saldosQueAtravessam, disponibilidadesEmData } from './saldosCompensaveis';

describe('saldosQueAtravessam', () => {
  it('sem dados de fim, devolve lista vazia', () => {
    expect(saldosQueAtravessam(null)).toEqual([]);
    expect(saldosQueAtravessam({})).toEqual([]);
  });

  it('prejuízo rural entra pela magnitude (saldo é armazenado negativo)', () => {
    const rows = saldosQueAtravessam({ prejuizoRuralAcompensar: -12345.67 });
    expect(rows).toHaveLength(1);
    expect(rows[0].chave).toBe('rural');
    expect(rows[0].valor).toBeCloseTo(12345.67, 2);
  });

  it('prejuízo rural zero ou positivo não gera linha', () => {
    expect(saldosQueAtravessam({ prejuizoRuralAcompensar: 0 })).toEqual([]);
    expect(saldosQueAtravessam({ prejuizoRuralAcompensar: 500 })).toEqual([]);
  });

  it('renda variável: pega a ÚLTIMA competência de cada ficha, não a soma dos meses', () => {
    const dadosFim = {
      rendaVariavelMensalOficial: [
        { titular: true, mes: 7, comuns: { prejuizoCompensar: 245.4 }, daytrade: { prejuizoCompensar: 0 } },
        { titular: true, mes: 12, comuns: { prejuizoCompensar: 99811.07 }, daytrade: { prejuizoCompensar: 0 } },
      ],
    };
    const rows = saldosQueAtravessam(dadosFim);
    const comuns = rows.find(r => r.chave === 'rvComuns');
    expect(comuns).toBeTruthy();
    // 99.811,07 do mês 12, não 245,40 + 99.811,07.
    expect(comuns.valor).toBeCloseTo(99811.07, 2);
    // Day-trade zerado não aparece.
    expect(rows.find(r => r.chave === 'rvDayTrade')).toBeUndefined();
  });

  it('day-trade tem linha própria, separada das operações comuns', () => {
    const dadosFim = {
      rendaVariavelMensalOficial: [
        { titular: true, mes: 12, comuns: { prejuizoCompensar: 1000 }, daytrade: { prejuizoCompensar: 3000 } },
      ],
    };
    const rows = saldosQueAtravessam(dadosFim);
    expect(rows.find(r => r.chave === 'rvComuns').valor).toBeCloseTo(1000, 2);
    expect(rows.find(r => r.chave === 'rvDayTrade').valor).toBeCloseTo(3000, 2);
  });

  it('soma a última competência de titular e dependente na mesma modalidade', () => {
    const dadosFim = {
      rendaVariavelMensalOficial: [
        { titular: true, mes: 12, comuns: { prejuizoCompensar: 1000 } },
        { titular: false, cpfDependente: '65578791620', mes: 12, comuns: { prejuizoCompensar: 245.4 } },
      ],
    };
    const comuns = saldosQueAtravessam(dadosFim).find(r => r.chave === 'rvComuns');
    expect(comuns.valor).toBeCloseTo(1245.4, 2);
  });

  it('FII/Fiagro entra pela sua própria ficha', () => {
    const dadosFim = {
      fiiFiagroMensalOficial: [
        { titular: true, mes: 6, prejuizoCompensar: 100 },
        { titular: true, mes: 11, prejuizoCompensar: 777.77 },
      ],
    };
    const fii = saldosQueAtravessam(dadosFim).find(r => r.chave === 'fii');
    expect(fii.valor).toBeCloseTo(777.77, 2);
  });
});

describe('disponibilidadesEmData', () => {
  const bem = (grupo, anterior, atual) => ({
    grupo, situacao_anterior: anterior, situacao_atual: atual, movimentacoes: [],
  });

  it('sem bens, total zero', () => {
    expect(disponibilidadesEmData({}, '2025-12-31')).toEqual({ total: 0, porGrupo: [] });
  });

  it('soma só os grupos que já são dinheiro (04/05/06/07), ignora imóveis (01) e móveis (02)', () => {
    const dadosFim = {
      bens: [
        bem('01', 500000, 500000), // imóvel — fora
        bem('02', 80000, 80000),   // veículo — fora
        bem('06', 30000, 30000),   // conta corrente
        bem('04', 120000, 120000), // aplicações
        bem('06', 50000, 50000),   // dinheiro em espécie (mesmo grupo 06)
      ],
    };
    const d = disponibilidadesEmData(dadosFim, '2025-12-31');
    expect(d.total).toBeCloseTo(200000, 2);
    // Um item por grupo com valor; grupo 06 soma seus dois bens.
    const g06 = d.porGrupo.find(g => g.grupo === '06');
    expect(g06.valor).toBeCloseTo(80000, 2);
    expect(d.porGrupo.find(g => g.grupo === '04').valor).toBeCloseTo(120000, 2);
    expect(d.porGrupo.some(g => g.grupo === '01' || g.grupo === '02')).toBe(false);
  });

  it('grupo sem saldo não aparece no detalhamento', () => {
    const dadosFim = { bens: [bem('05', 0, 0)] };
    const d = disponibilidadesEmData(dadosFim, '2025-12-31');
    expect(d.porGrupo).toEqual([]);
    expect(d.total).toBe(0);
  });
});
