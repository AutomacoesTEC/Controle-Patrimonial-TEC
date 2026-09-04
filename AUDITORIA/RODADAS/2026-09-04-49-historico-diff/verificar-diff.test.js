import { expect, test } from 'vitest';
import { initialState, reducerComHistorico } from '../../../src/store/reducer.js';

test('imprime a entrada congelada', () => {
  const state = {
    ...initialState,
    anoCalendario: 2025,
    bens: [{ id: 1, discriminacao: 'Apto', situacao_atual: 100, origem: 'manual' }],
  };
  const novo = reducerComHistorico(state, {
    type: 'UPDATE_BEM',
    payload: { id: 1, discriminacao: 'Apto reformado', situacao_atual: 120 },
  });
  const entrada = novo.alteracoes[0];
  console.log(`EVIDENCIA=${JSON.stringify({ descricao: entrada.descricao, mudancas: entrada.mudancas || null })}`);
  expect(entrada.descricao).toBe('Editou bem: Apto reformado');
});
