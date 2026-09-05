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
  test('memória aritmética independente dos totais alterados por D03 a D11', () => {
    const anual = atual['ano-2025'].demonstrativo;
    // Valores das fichas sintéticas de origem, não copiados do motor.
    const rendaLiquida = (51101.11 + 12201.21 - 5102.12 - 1202.22 - 4104.14 - 904.24)
      + 45523.70 + 142197.69 + 21565.66;
    expect(anual.rendimentos.totalGeral).toBeCloseTo(rendaLiquida, 2);
    const gcap = (160602.42 - 100601.41) + (42612.45 - 30611.44) + (70622.48 - 40621.47);
    expect(anual.ganhos.total).toBeCloseTo(gcap - 92162.65, 2);
    // Titular: resultados 6.202,20, tributos 2.174,71; positivos líquidos
    // 5.830,32 já cobertos pelo resumo 5.834,05. Dependente: 3.935,39 - 786,12.
    const ajusteRv = 6202.20 - 2174.71 - 5830.32 + 3935.39 - 786.12;
    expect(anual.rendaVariavelPerda).toBeCloseTo(ajusteRv, 2);
    const doacoes = 16307.26 + 1201.44; // DAA 603,91 sem data de pagamento não presumida
    expect(anual.totalDoacoes).toBeCloseTo(doacoes, 2);
    expect(anual.saldoDeCaixa).toBeCloseTo(-337309.08 - 31996.97 + rendaLiquida + gcap - 92162.65 + ajusteRv - 26137.88 - doacoes, 2);
    const semestre = atual['primeiro-semestre-2025'].demonstrativo;
    // Sem prova de alterações do estoque antes de 31/12; só rural e RV datados.
    expect(semestre.varPatrimonial.total).toBe(0);
    expect(semestre.saldoDeCaixa).toBeCloseTo(21565.66 + 5746.65, 2);
    expect(atual['periodo-2025-2026'].demonstrativo.saldoDeCaixa).toBe(anual.saldoDeCaixa);
  });
  test.each(CASOS)('%s', (nome) => {
    const esperado = lerJson('demonstrativo-aju01.golden.json');
    expect(atual[nome]).toEqual(esperado[nome]);
  });
});
