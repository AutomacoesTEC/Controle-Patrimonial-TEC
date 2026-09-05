import { expect, it } from 'vitest';
import { pendenciasRetificadora } from './pendenciasRetificadora';
it('expõe conflitos de todas as fichas reconciliadas sem perder valores zero', () => {
  const estado = Object.fromEntries(['rendimentos','pagamentos','doacoesEfetuadasOficial','doacoesPartidosOficial','doacoesEcaIdosoOficial'].map(campo => [campo,[{id:1,nome_fonte:'Sintético',ajustesLocaisRetificadora:[{campo:'valor',valorLocal:0,valorDeclarado:100}]}]]));
  expect(pendenciasRetificadora(estado)).toHaveLength(5);
  expect(pendenciasRetificadora(estado)[0]).toEqual({ficha:'Rendimentos',registro:'Sintético',campo:'valor',valorLocal:0,valorDeclarado:100});
});
it('não inventa pendências em declaração sem conflito', () => {
  expect(pendenciasRetificadora({rendimentos:[{valor:100}]})).toEqual([]);
});
