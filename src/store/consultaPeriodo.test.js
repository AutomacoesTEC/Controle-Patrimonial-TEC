import { describe, test, expect } from 'vitest';
import { demonstrativoConciliacao } from './demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, anosComDado } from './consultaPeriodo';

// Motor multi-ano (consultaPeriodo): período livre costurando snapshots do
// histórico. Fixtures pequenas e datadas, para conferir cada número na mão.

function estadoDoisAnos() {
  return {
    anoCalendario: 2025,
    bens: [
      {
        discriminacao: 'apartamento',
        situacao_anterior: 100000, situacao_atual: 130000,
        movimentacoes: [{ tipo: 'benfeitoria', valor: 30000, data: '2025-04-10' }],
      },
    ],
    bensRurais: [],
    dividas: [
      {
        discriminacao: 'financiamento',
        situacao_anterior: 50000, situacao_atual: 35000,
        movimentacoes: [
          { tipo: 'amortizacao', valor: 10000, data: '2025-03-01' },
          { tipo: 'amortizacao', valor: 5000, data: '2025-09-01' },
        ],
      },
    ],
    rendimentos: [
      { tipo: 'tributavel_pj', valor: 12000, irrf: 0, data: '2025-02-15' },
      { tipo: 'isento_09', valor: 3000, irrf: 0, data: '2025-11-15' },
    ],
    lancamentosRurais: [],
    pagamentos: [{ valor_pago: 4000, data: '2025-05-20' }],
    pagamentosDiversos: [{ valor: 1500, data: '2025-06-10' }],
    historico: {
      2024: {
        bens: [{ discriminacao: 'apartamento', situacao_anterior: 90000, situacao_atual: 100000, movimentacoes: [] }],
        bensRurais: [],
        dividas: [{ discriminacao: 'financiamento', situacao_anterior: 60000, situacao_atual: 50000, movimentacoes: [] }],
        rendimentos: [{ tipo: 'tributavel_pj', valor: 10000, irrf: 0, data: '2024-03-01' }],
        lancamentosRurais: [],
        pagamentos: [{ valor_pago: 2000, data: '2024-04-01' }],
        pagamentosDiversos: [],
      },
    },
  };
}

describe('demonstrativoPeriodo — período dentro de um único ano', () => {
  test('bate 1:1 com demonstrativoConciliacao no mesmo recorte', () => {
    const s = estadoDoisAnos();
    const de = '2025-03-01';
    const ate = '2025-06-30';
    const esperado = demonstrativoConciliacao(s, de, ate);
    const d = demonstrativoPeriodo(s, de, ate);
    expect(d.varPatrimonial.bensDe).toBe(esperado.varPatrimonial.bensDe);
    expect(d.varPatrimonial.bensAte).toBe(esperado.varPatrimonial.bensAte);
    expect(d.varPatrimonial.dividaDe).toBe(esperado.varPatrimonial.dividaDe);
    expect(d.varPatrimonial.dividaAte).toBe(esperado.varPatrimonial.dividaAte);
    expect(d.rendimentos.totalGeral).toBe(esperado.rendimentos.totalGeral);
    expect(d.saldoDeCaixa).toBe(esperado.saldoDeCaixa);
    expect(d.anosSemDado).toEqual([]);
    expect(d.anosCobertos).toEqual([2025]);
  });
});

describe('demonstrativoPeriodo — período cruzando dois anos', () => {
  test('estoque nas pontas vem do ano certo; fluxos somam os dois anos', () => {
    const s = estadoDoisAnos();
    const d = demonstrativoPeriodo(s, '2024-06-01', '2025-06-30');

    // Bens em 01/06/2024: snapshot 2024, sem movimentação, lado "de" → anterior 90000.
    // Bens em 30/06/2025: 100000 + benfeitoria de 10/04 = 130000.
    expect(d.varPatrimonial.bensDe).toBe(90000);
    expect(d.varPatrimonial.bensAte).toBe(130000);

    // Dívida em 01/06/2024 (lado "de", sem movimentação): anterior 60000.
    // Dívida em 30/06/2025: 50000 − amortização de 01/03 (10000) = 40000
    // (a de 01/09 ainda não aconteceu).
    expect(d.varPatrimonial.dividaDe).toBe(60000);
    expect(d.varPatrimonial.dividaAte).toBe(40000);

    // Rendimentos: 10000 (2024-03-01 está FORA, antes de 01/06/2024) → 0 em
    // 2024; 12000 em 2025 (o isento de 15/11 está fora do trecho). 
    expect(d.rendimentos.tributavelPJ).toBe(12000);

    // Pagamentos: 0 em 2024 (01/04 fora do trecho) + 4000 em 2025.
    expect(d.pagamentosEfetuados).toBe(4000);
    expect(d.pagamentosDiversos).toBe(1500);

    expect(d.anosCobertos).toEqual([2024, 2025]);
    expect(d.anosSemDado).toEqual([]);
  });

  test('ano cheio cruzando 2024→2025 inclui todos os fluxos dos dois anos', () => {
    const s = estadoDoisAnos();
    const d = demonstrativoPeriodo(s, '2024-01-01', '2025-12-31');
    expect(d.rendimentos.tributavelPJ).toBe(22000); // 10000 + 12000
    expect(d.rendimentos.isentoValor).toBe(3000);
    expect(d.pagamentosEfetuados).toBe(6000); // 2000 + 4000
    expect(d.varPatrimonial.bensDe).toBe(90000);
    expect(d.varPatrimonial.bensAte).toBe(130000);
    // Dívida com as duas amortizações: 50000 − 10000 − 5000 = 35000.
    expect(d.varPatrimonial.dividaAte).toBe(35000);
  });
});

describe('demonstrativoPeriodo — ano intermediário sem dado', () => {
  test('não inventa o ano: sinaliza em anosSemDado e não soma nada por ele', () => {
    const s = estadoDoisAnos();
    const d = demonstrativoPeriodo(s, '2023-01-01', '2025-12-31');
    expect(d.anosSemDado).toEqual([2023]);
    expect(d.anosCobertos).toEqual([2024, 2025]);
    // O estoque "de" não tem ano para reconstruir (2023 sem dado) → 0, e os
    // fluxos são só de 2024+2025.
    expect(d.varPatrimonial.bensDe).toBe(0);
    expect(d.rendimentos.tributavelPJ).toBe(22000);
  });

  test('período inteiro sem dado nenhum', () => {
    const s = estadoDoisAnos();
    const d = demonstrativoPeriodo(s, '2020-01-01', '2020-12-31');
    expect(d.anosSemDado).toEqual([2020]);
    expect(d.saldoDeCaixa).toBe(0);
    expect(d.varPatrimonial.total).toBe(0);
  });

  test('datas invertidas ou ausentes retornam demonstrativo zerado', () => {
    const s = estadoDoisAnos();
    expect(demonstrativoPeriodo(s, '2025-12-31', '2025-01-01').saldoDeCaixa).toBe(0);
    expect(demonstrativoPeriodo(s, null, null).saldoDeCaixa).toBe(0);
  });
});

describe('serieEvolucao — gráfico só com anos reais', () => {
  test('pula ano sem dado em vez de plotar zero inventado', () => {
    const s = estadoDoisAnos();
    const pontos = serieEvolucao(s, '2023-01-01', '2025-12-31');
    expect(pontos.map(p => p.ano)).toEqual([2024, 2025]);
    expect(pontos[0].liquido).toBe(100000 - 50000);
    expect(pontos[1].liquido).toBe(130000 - 35000);
  });
});

describe('totaisNaData / anosComDado', () => {
  test('totais na data de corte, reconstruídos no ano certo', () => {
    const s = estadoDoisAnos();
    expect(totaisNaData(s, '2025-06-30').totalDividas).toBe(40000);
    expect(totaisNaData(s, '2025-12-31').totalDividas).toBe(35000);
    expect(totaisNaData(s, '2024-12-31').totalBens).toBe(100000);
    expect(totaisNaData(s, '2019-12-31')).toBeNull(); // ano sem dado
  });

  test('anosComDado lista histórico + ano corrente, ordenado', () => {
    expect(anosComDado(estadoDoisAnos())).toEqual([2024, 2025]);
  });
});
