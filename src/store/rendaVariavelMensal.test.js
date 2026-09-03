import { describe, it, expect } from 'vitest';
import { mesclarMensal, linhasComunsDoAno, linhasFiiDoAno } from './rendaVariavelMensal';

const oficialMes = (mes, extra = {}) => ({ mes, titular: true, origem: 'importacao', valor: 'oficial', ...extra });
const manualMes = (mes, extra = {}) => ({ mes, titular: true, origem: 'manual', valor: 'manual', ...extra });

describe('mesclarMensal', () => {
  it('sem colisão: junta oficial e manual, todos entram', () => {
    const r = mesclarMensal([oficialMes(1)], [manualMes(6)]);
    expect(r).toHaveLength(2);
    expect(r.map(l => l.mes)).toEqual([1, 6]);
  });

  it('colisão de mês+beneficiário: o manual PREVALECE (critério aprovado no handoff)', () => {
    const r = mesclarMensal([oficialMes(3, { resultadoLiquidoMes: 100 })], [manualMes(3, { resultadoLiquidoMes: 999 })]);
    expect(r).toHaveLength(1);
    expect(r[0].origem).toBe('manual');
    expect(r[0].resultadoLiquidoMes).toBe(999);
  });

  it('ordena por mês', () => {
    const r = mesclarMensal([oficialMes(9), oficialMes(2)], [manualMes(5)]);
    expect(r.map(l => l.mes)).toEqual([2, 5, 9]);
  });

  it('beneficiários distintos no mesmo mês não colidem (titular x dependente)', () => {
    const doTitular = oficialMes(4, { titular: true });
    const doDependente = manualMes(4, { titular: false, cpfDependente: '12312312300' });
    const r = mesclarMensal([doTitular], [doDependente]);
    expect(r).toHaveLength(2);
  });

  it('dois dependentes diferentes no mesmo mês também não colidem entre si', () => {
    const dep1 = oficialMes(4, { titular: false, cpfDependente: '11111111111' });
    const dep2 = manualMes(4, { titular: false, cpfDependente: '22222222222' });
    const r = mesclarMensal([dep1], [dep2]);
    expect(r).toHaveLength(2);
  });

  it('sem oficial nem manual, devolve lista vazia', () => {
    expect(mesclarMensal(undefined, undefined)).toEqual([]);
    expect(mesclarMensal(null, null)).toEqual([]);
  });

  it('um lançamento manual com o MAIOR mês do ano fica por último (é o que resumoComuns/somaUltimaCompetencia leem como "última competência")', () => {
    const r = mesclarMensal([oficialMes(3)], [manualMes(11)]);
    expect(r[r.length - 1].mes).toBe(11);
    expect(r[r.length - 1].origem).toBe('manual');
  });
});

describe('linhasComunsDoAno / linhasFiiDoAno', () => {
  it('mescla os campos certos do snapshot (rendaVariavelMensalOficial/Manual, fiiFiagroMensalOficial/Manual)', () => {
    const dados = {
      rendaVariavelMensalOficial: [oficialMes(1)],
      rendaVariavelMensalManual: [manualMes(2)],
      fiiFiagroMensalOficial: [oficialMes(3)],
      fiiFiagroMensalManual: [manualMes(4)],
    };
    expect(linhasComunsDoAno(dados).map(l => l.mes)).toEqual([1, 2]);
    expect(linhasFiiDoAno(dados).map(l => l.mes)).toEqual([3, 4]);
  });

  it('snapshot null/undefined não quebra, devolve lista vazia', () => {
    expect(linhasComunsDoAno(null)).toEqual([]);
    expect(linhasFiiDoAno(undefined)).toEqual([]);
  });
});
