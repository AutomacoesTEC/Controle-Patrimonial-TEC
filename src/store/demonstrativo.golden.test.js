import { describe, expect, test } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { demonstrativoPeriodo } from './consultaPeriodo';
import { carregarEstadoDoPerfil } from './DataContext';


const caminho = (nome) => new URL(`./__fixtures__/${nome}`, import.meta.url);
const lerJson = (nome) => JSON.parse(readFileSync(caminho(nome), 'utf8'));
const PERFIL = carregarEstadoDoPerfil(lerJson('perfil-aju01-atual.json'));
const CASOS = Object.freeze([
  ['ano-2025', '2025-01-01', '2025-12-31'],
  ['primeiro-semestre-2025', '2025-01-01', '2025-06-30'],
  ['periodo-2025-2026', '2025-01-01', '2026-12-31'],
]);

function gerarGolden() {
  return Object.fromEntries(CASOS.map(([nome, de, ate]) => [
    nome,
    { de, ate, demonstrativo: demonstrativoPeriodo(PERFIL, de, ate) },
  ]));
}

const atual = gerarGolden();
const urlGolden = caminho('demonstrativo-aju01.golden.json');

// Atualização é uma operação deliberada e visível. A execução normal
// nunca aceita nem regrava um resultado novo por conta própria.
if (process.env.UPDATE_GOLDEN === '1') {
  writeFileSync(urlGolden, `${JSON.stringify(atual, null, 2)}\n`);
}

describe('golden completo do Demonstrativo AJU-01', () => {
  test.each(CASOS)('%s', (nome) => {
    const esperado = lerJson('demonstrativo-aju01.golden.json');
    expect(atual[nome]).toEqual(esperado[nome]);
  });
});
