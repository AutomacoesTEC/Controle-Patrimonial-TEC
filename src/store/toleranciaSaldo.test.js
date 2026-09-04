import { describe, expect, it } from 'vitest';
import { initialState, reducerComHistorico } from './reducer';
import { avaliarSaldoComTolerancia } from './toleranciaSaldo';

describe('tolerância configurável do Saldo de Caixa', () => {
  it('aplica valor fixo até o centavo do limite', () => {
    expect(avaliarSaldoComTolerancia(1, { tipo: 'fixa', valor: 1 }).fecha).toBe(true);
    expect(avaliarSaldoComTolerancia(-1, { tipo: 'fixa', valor: 1 }).fecha).toBe(true);
    expect(avaliarSaldoComTolerancia(1.01, { tipo: 'fixa', valor: 1 }).fecha).toBe(false);
  });

  it('calcula percentual sobre o patrimônio líquido absoluto', () => {
    const noLimite = avaliarSaldoComTolerancia(-1000, { tipo: 'percentual', valor: 0.5 }, 200000);
    expect(noLimite).toMatchObject({ fecha: true, limite: 1000 });
    expect(avaliarSaldoComTolerancia(1000.01, { tipo: 'percentual', valor: 0.5 }, 200000).fecha).toBe(false);
  });

  it('persiste a escolha no estado do perfil e registra a alteração', () => {
    const novo = reducerComHistorico(
      initialState,
      { type: 'SET_TOLERANCIA_SALDO', payload: { tipo: 'percentual', valor: 0.5 } },
    );
    expect(novo.toleranciaSaldo).toEqual({ tipo: 'percentual', valor: 0.5 });
    expect(novo.alteracoes[0].descricao).toContain('0,5%');
  });
});
