import { expect, it } from 'vitest';
import { anoCadastroValido, anoDaDataCadastro } from './dataCadastro';

it.each(['', '2026-02-29', '1900-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-01-00', '10000-01-01', '0000-01-01', '2026-1-01', null, undefined])('rejeita data inválida %s', data => {
  expect(anoDaDataCadastro(data)).toBeNull();
});
it.each(['2000-02-29', '2024-02-29', '2026-01-01', '0001-01-01', '9999-12-31'])('aceita data ISO real %s', data => {
  expect(anoDaDataCadastro(data)).toBe(Number(data.substring(0, 4)));
});
it.each([NaN, Infinity, -Infinity, 0, -1, 2026.5, 10000, '2026', null])('rejeita ano inválido %s', ano => {
  expect(anoCadastroValido(ano)).toBe(false);
});
