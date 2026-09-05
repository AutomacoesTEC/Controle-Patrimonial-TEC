import { describe, expect, it } from 'vitest';
import { estadoNoAno, initialState, reducer } from './reducer';

const base = () => ({ ...structuredClone(initialState), anoCalendario: 2025, origemAnoAtual: 'manual', bens: [{ id: 1, discriminacao: 'Sintético', situacao_anterior: 100, situacao_atual: 100 }] });
describe('limites do estado anual — auditoria independente', () => {
  it.each([0, -1, 10000, 2026.5, NaN, Infinity, '2026'])('recusa ano fora do domínio inteiro: %s', ano => {
    expect(() => estadoNoAno(base(), ano)).toThrow();
    expect(() => reducer(base(), { type: 'ADD_EM_ANO', payload: { ano, action: { type: 'ADD_PAGAMENTO', payload: { valor_pago: 10 } } } })).toThrow();
  });
  it('projeção distante não gera todos os snapshots de anos vazios', () => {
    const s = estadoNoAno(base(), 2050);
    expect(s.anoCalendario).toBe(2050);
    expect(s.bens[0].situacao_anterior).toBe(100);
    expect(Object.keys(s.historico).length).toBeLessThanOrEqual(2);
  });
  it.each(['10000-01-01', '2026-02-30', '2026-13-01', '2026-00-01'])('movimento rejeita data inválida completa: %s', data => {
    expect(() => reducer(base(), { type: 'SALVAR_MOVIMENTACAO_DATADA', payload: { actionType: 'REGISTRAR_MOVIMENTACAO_BEM', bemId: 1, movimentacao: { data, tipo: 'benfeitoria', valor: 10 } } })).toThrow();
  });
});
