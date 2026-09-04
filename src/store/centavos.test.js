import { describe, expect, test } from 'vitest';
import { demonstrativoConciliacao, fecharDemonstrativo } from './demonstrativos';
import { initialState, reducer } from './reducer';


const estruturaMinima = () => ({
  ...initialState,
  bens: [],
  bensRurais: [],
  dividas: [],
  dividasRurais: [],
  rendimentos: [],
  lancamentosRurais: [],
  receitasDespesasRuraisOficial: [],
  pagamentos: [],
  pagamentosDiversos: [],
  doacoesEfetuadasOficial: [],
  doacoesPartidosOficial: [],
  doacoesEcaIdosoOficial: [],
  apuracaoGanhoCapital: [],
  rendaVariavelMensalOficial: [],
  rendaVariavelMensalManual: [],
  fiiFiagroMensalOficial: [],
  fiiFiagroMensalManual: [],
});

describe('fronteira monetária em centavos', () => {
  test('movimentações sucessivas não gravam centavos binários no saldo', () => {
    let state = { ...estruturaMinima(), bens: [{ id: 1, situacao_anterior: 0, situacao_atual: 0, movimentacoes: [] }] };
    for (const valor of [0.1, 0.2]) {
      state = reducer(state, {
        type: 'REGISTRAR_MOVIMENTACAO_BEM',
        payload: { bemId: 1, movimentacao: { tipo: 'compra', valor, data: '2025-01-01' } },
      });
    }
    expect(state.bens[0].situacao_atual).toBe(0.3);
  });

  test('fechamento elimina saldo fantasma inferior a um centavo', () => {
    const fechado = fecharDemonstrativo({
      varPatrimonial: { total: 0.1 },
      rendimentos: { totalGeral: 0.2 },
      ganhos: { total: 0 },
      pagamentosEfetuados: 0.3,
    });
    expect(fechado.saldoDeCaixaGeral).toBe(0.3);
    expect(fechado.saldoDeCaixa).toBe(0);
  });

  test('25 sequências determinísticas fecham pelo mesmo total em centavos inteiros', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      let x = seed;
      const valores = [];
      let totalCentavos = 0;
      for (let i = 0; i < 200; i += 1) {
        x = (1664525 * x + 1013904223) >>> 0;
        const centavos = (x % 100000) + 1;
        totalCentavos += centavos;
        valores.push(centavos / 100);
      }
      const state = {
        ...estruturaMinima(),
        pagamentosDiversos: valores.map((valor, id) => ({ id, valor })),
      };
      const demonstrativo = demonstrativoConciliacao(state, null, null);
      expect(demonstrativo.pagamentosDiversos, `seed ${seed}`).toBe(totalCentavos / 100);
      expect(demonstrativo.saldoDeCaixa, `seed ${seed}`).toBe(-totalCentavos / 100);
    }
  });
});
