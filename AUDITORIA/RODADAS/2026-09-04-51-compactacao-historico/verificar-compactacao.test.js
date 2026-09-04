import { afterEach, describe, expect, it, vi } from 'vitest';
import { initialState, reducerComHistorico } from '../../../src/store/reducer';

describe('fixture congelado: compactação do histórico', () => {
  afterEach(() => vi.useRealTimers());

  it('mantém o cap e resume cumulativamente as entradas removidas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00.000Z'));
    let state = {
      ...initialState,
      anoCalendario: 2025,
      alteracoes: Array.from({ length: 300 }, (_, i) => ({
        id: `h${i}`,
        data: `2026-09-03T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
        anoCalendario: 2025,
        descricao: `Alteração ${i}`,
      })),
    };

    state = reducerComHistorico(state, { type: 'ADD_BEM', payload: { id: 901, discriminacao: 'A' } });
    vi.setSystemTime(new Date('2026-09-04T12:01:00.000Z'));
    state = reducerComHistorico(state, { type: 'ADD_BEM', payload: { id: 902, discriminacao: 'B' } });

    expect(state.alteracoes).toHaveLength(300);
    expect(state.alteracoes.at(-1)).toMatchObject({
      compactadoQuantidade: 3,
      descricao: '3 alterações antigas compactadas',
    });
  });
});
