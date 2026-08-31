import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { initialState, reducer, snapshotYear } from '../store/reducer';
import { payloadImportacaoCompleto } from './importacaoDeclaracao';

const CASOS = ['AJU-01', 'ESP-01', 'SAI-01'];
const COLECOES_COM_ORIGEM = new Set([
  'bens', 'dividas', 'rendimentos', 'pagamentos',
  'imoveisRurais', 'bensRurais', 'dividasRurais',
  'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial',
]);

function lerResultado(nome) {
  const arquivo = new URL(`../../AUDITORIA/saida-parsepdf/${nome}.json`, import.meta.url);
  const prova = JSON.parse(readFileSync(arquivo, 'utf8'));
  expect(prova.erro).toBeFalsy();
  return prova.resultado;
}

function semMarcaDeOrigem(valor) {
  return Array.isArray(valor)
    ? valor.map(({ origem: _origem, ...item }) => item)
    : valor;
}

function esperarResultadoPreservado(resultado, estado) {
  for (const [campo, esperado] of Object.entries(resultado)) {
    if (campo === 'formato') {
      expect(estado.importFormato, campo).toEqual(esperado);
      continue;
    }
    expect(estado, `campo ausente no estado: ${campo}`).toHaveProperty(campo);
    const observado = COLECOES_COM_ORIGEM.has(campo)
      ? semMarcaDeOrigem(estado[campo])
      : estado[campo];
    expect(observado, campo).toEqual(esperado);
  }
}

describe('pipeline PDF sintético: extração → reducer → histórico', () => {
  for (const nome of CASOS) {
    it(`${nome}: não perde nenhum campo entregue pelo parser`, () => {
      const resultado = lerResultado(nome);
      const importado = reducer(
        { ...initialState },
        { type: 'IMPORT_DECLARACAO', payload: payloadImportacaoCompleto(resultado) },
      );

      esperarResultadoPreservado(resultado, importado);

      const snapshot = snapshotYear(importado);
      esperarResultadoPreservado(resultado, {
        ...snapshot,
        anoCalendario: importado.anoCalendario,
        importFormato: snapshot.importFormato,
      });

      const outroAno = Number(resultado.anoCalendario) + 1;
      const arquivado = reducer(importado, { type: 'SWITCH_ANO', payload: outroAno });
      const restaurado = reducer(arquivado, { type: 'LOAD_HISTORICO', payload: resultado.anoCalendario });
      esperarResultadoPreservado(resultado, restaurado);
    });
  }
});
