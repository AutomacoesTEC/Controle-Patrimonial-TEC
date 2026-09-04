import { describe, expect, test } from 'vitest';
import { conferirContinuidade } from './continuidade';


const bem = (discriminacao, anterior, atual, extra = {}) => ({
  grupo: '01', codigo_bem: '11', discriminacao, situacao_anterior: anterior,
  situacao_atual: atual, movimentacoes: [], ...extra,
});
const divida = (discriminacao, anterior, atual) => ({
  codigo: '11', discriminacao, situacao_anterior: anterior,
  situacao_atual: atual, movimentacoes: [],
});
const estado = (ano2025, ano2026) => ({
  anoCalendario: 2026,
  historico: { 2025: ano2025 },
  ...ano2026,
});

describe('conferirContinuidade', () => {
  test('dois anos coerentes fecham sem divergência, inclusive com um centavo de tolerância', () => {
    const r = conferirContinuidade(estado(
      { bens: [bem('Casa A', 0, 100)], dividas: [divida('Banco A', 0, 300)] },
      { bens: [bem('Casa A', 100.01, 110)], dividas: [divida('Banco A', 300, 250)] },
    ), 2025);
    expect(r.disponivel).toBe(true);
    expect(r.divergencias).toEqual([]);
  });

  test('detecta exatamente saldo divergente, item desaparecido e item surgido com saldo', () => {
    const r = conferirContinuidade(estado(
      {
        bens: [bem('Casa A', 0, 100), bem('Casa B', 0, 200)],
        dividas: [divida('Banco A', 0, 300)],
      },
      {
        bens: [bem('Casa A', 90, 110)],
        dividas: [divida('Banco A', 300, 250), divida('Banco B', 50, 40)],
      },
    ), 2025);
    expect(r.divergencias).toHaveLength(3);
    expect(r.divergencias.map(x => x.tipo).sort()).toEqual([
      'apareceu_com_saldo', 'saldo_divergente', 'sumiu_com_saldo',
    ]);
  });

  test('sem os dois anos declara indisponível em vez de aprovar', () => {
    const r = conferirContinuidade({ anoCalendario: 2026, historico: {}, bens: [], dividas: [] }, 2025);
    expect(r).toMatchObject({ disponivel: false, divergencias: [] });
  });

  test('descrição exata impede que CNPJ repetido troque dois bens de ordem', () => {
    const cnpj = { cnpj: '11.222.333/0001-44' };
    const r = conferirContinuidade(estado(
      { bens: [bem('Conta A', 0, 10, cnpj), bem('Conta B', 0, 20, cnpj)], dividas: [] },
      { bens: [bem('Conta B', 20, 20, cnpj), bem('Conta A', 10, 10, cnpj)], dividas: [] },
    ), 2025);
    expect(r.divergencias).toEqual([]);
  });
});
