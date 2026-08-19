import { describe, test, expect } from 'vitest';
import {
  situacaoBemAteData,
  totalBensAteData,
  variacaoPatrimonialTotal,
  totalRendimentos,
  resultadoAtividadeRuralPeriodo,
  ganhosApuradosPeriodo,
  totalPagamentos,
  totalPagamentosDiversos,
  demonstrativoConciliacao,
} from './demonstrativos';

// Fixtures 1:1 com as abas VAR PATRIMONIAL2024 e VAR PATRIMONIAL2025 da
// planilha real da usuária (~/PROJETOS/Planilha Eudúcio/VARIAÇÃO PATRIMONIAL.xls).
// Sem dataDe/dataAte (comparação de ano cheio, sem filtro), os totais têm
// que bater ao centavo com os valores que a planilha calculou. Essa é a
// prova de que o Demonstrativo de Conciliação Patrimonial do Dashboard
// reproduz exatamente a mesma técnica que a usuária já usava.
// GANHOS APURADOS da planilha: só perdas nesses dois anos de exemplo.
// Modeladas como um "bem" auxiliar com situacao_anterior/atual = 0 (não
// mexe no total de Bens) e uma movimentação de venda por transação —
// venda por R$0 de um "custo" igual à perda dá ganhoBruto = −perda.
function bemGanhosApurados(perdas, ganhos) {
  const movimentacoes = [
    ...perdas.map((valor, i) => ({ tipo: 'venda_total', valor, valorVenda: 0, data: `2025-01-0${i + 1}` })),
    ...ganhos.map((g, i) => ({ tipo: 'venda_total', valor: 0, valorVenda: g.bruto, irrfVenda: g.irrf, data: `2025-02-0${i + 1}` })),
  ];
  return { situacao_anterior: 0, situacao_atual: 0, movimentacoes };
}

function estado2025() {
  return {
    bens: [
      { situacao_anterior: 60723823.07, situacao_atual: 71231012.07, movimentacoes: [] },
      bemGanhosApurados([3000, 245.4, 102040.92, 6292.0], []),
    ],
    bensRurais: [],
    dividas: [{ situacao_anterior: 0, situacao_atual: 0 }],
    rendimentos: [
      { tipo: 'tributavel_pj', valor: 254242.41, irrf: 0 },
      { tipo: 'isento_09', valor: 9447988.60, irrf: 0 },
      { tipo: 'exclusivo_10', valor: 2542814.64, irrf: 375000.00 },
    ],
    lancamentosRurais: [
      { tipo: 'receita', valor: 0 },
      { tipo: 'despesa', valor: 460078.41 },
    ],
    pagamentos: [{ valor_pago: 114288.04 }],
    pagamentosDiversos: [{ valor: 412884.77 }],
  };
}

function estado2024() {
  return {
    bens: [
      { situacao_anterior: 60803097.68, situacao_atual: 61450899.89, movimentacoes: [] },
      bemGanhosApurados([38045.0], [{ bruto: 8085.16, irrf: 1212.77 }, { bruto: 7434.0, irrf: 1115.1 }]),
    ],
    bensRurais: [],
    // Δsaldo = Contraídas_total − Pagtº_total da planilha = 250025.00 −
    // (269850.42+261179.35) = −281004.77 (o app não usa colunas
    // Contraídas/Pagtº, só saldo anterior/atual — mas o delta tem que bater).
    dividas: [{ situacao_anterior: 281004.77, situacao_atual: 0 }],
    rendimentos: [
      { tipo: 'tributavel_pj', valor: 250484.48, irrf: 0 },
      { tipo: 'isento_09', valor: 25105.81, irrf: 0 },
      { tipo: 'exclusivo_06', valor: 1611024.24, irrf: 225000.00 },
    ],
    lancamentosRurais: [
      { tipo: 'receita', valor: 169301.505 },
      { tipo: 'despesa', valor: 0 },
    ],
    pagamentos: [{ valor_pago: 72149.23 }],
    pagamentosDiversos: [{ valor: 694125.89 }],
  };
}

describe('demonstrativoConciliacao — regressão contra a planilha real (2025)', () => {
  test('reproduz Variação Patrimonial Total, Rendimentos, Saldo de Caixa Geral e Saldo de Caixa ao centavo', () => {
    const d = demonstrativoConciliacao(estado2025(), null, null);
    expect(d.varPatrimonial.total).toBeCloseTo(-10507189.00, 2);
    expect(d.rendimentos.totalGeral).toBeCloseTo(11409967.24, 2);
    expect(d.saldoDeCaixaGeral).toBeCloseTo(791199.92, 2);
    expect(d.saldoDeCaixa).toBeCloseTo(264027.11, 2);
  });
});

describe('demonstrativoConciliacao — regressão contra a planilha real (2024, dívida com contraídas/pagto)', () => {
  test('a dívida modelada como saldo (anterior/atual) chega no mesmo delta que Contraídas−Pagtº da planilha', () => {
    const d = demonstrativoConciliacao(estado2024(), null, null);
    // Δdívida da planilha (Contraídas−Pagtº) = 250025.00−531029.77 = −281004.77
    expect(d.varPatrimonial.deltaDivida).toBeCloseTo(-281004.77, 2);
    expect(d.varPatrimonial.total).toBeCloseTo(-928806.98, 2);
    expect(d.rendimentos.totalGeral).toBeCloseTo(1830916.035, 2);
    expect(d.saldoDeCaixaGeral).toBeCloseTo(877255.345, 2);
    expect(d.saldoDeCaixa).toBeCloseTo(110980.225, 2);
  });
});

describe('situacaoBemAteData — reconstrução de bem por data', () => {
  const bem = {
    situacao_anterior: 1000,
    situacao_atual: 1800,
    movimentacoes: [
      { tipo: 'compra', valor: 500, data: '2025-03-10' },
      { tipo: 'compra', valor: 300, data: '2025-08-20' },
    ],
  };

  test('sem data de corte, retorna a situação atual', () => {
    expect(situacaoBemAteData(bem, null)).toBe(1800);
  });

  test('bug real: bem sem NENHUMA movimentação (recém-importado) não trava na situação anterior do lado "até"', () => {
    const bemSemMovimentacao = { situacao_anterior: 1000, situacao_atual: 5000, movimentacoes: [] };
    expect(situacaoBemAteData(bemSemMovimentacao, '2025-12-31', 'ate')).toBe(5000);
    expect(situacaoBemAteData(bemSemMovimentacao, '2025-06-01', 'ate')).toBe(5000);
    // do lado "de", sem informação melhor, assume que ainda não mudou
    expect(situacaoBemAteData(bemSemMovimentacao, '2025-01-01', 'de')).toBe(1000);
  });

  test('corte antes de qualquer movimentação, retorna a situação anterior', () => {
    expect(situacaoBemAteData(bem, '2025-01-01')).toBe(1000);
  });

  test('corte entre as duas movimentações, aplica só a primeira', () => {
    expect(situacaoBemAteData(bem, '2025-06-01')).toBe(1500);
  });

  test('corte na data exata de uma movimentação, inclui essa movimentação', () => {
    expect(situacaoBemAteData(bem, '2025-03-10')).toBe(1500);
  });

  test('corte depois de todas as movimentações, bate com a situação atual', () => {
    expect(situacaoBemAteData(bem, '2025-12-31')).toBe(1800);
  });

  test('venda_total zera o bem a partir da data da venda', () => {
    const bemVendido = {
      situacao_anterior: 1000,
      situacao_atual: 0,
      movimentacoes: [{ tipo: 'venda_total', valor: 1000, data: '2025-05-15', valorVenda: 1200 }],
    };
    expect(situacaoBemAteData(bemVendido, '2025-05-14')).toBe(1000);
    expect(situacaoBemAteData(bemVendido, '2025-05-15')).toBe(0);
  });

  // Bug real (achado testando o Dashboard com dado de verdade): um bem
  // cadastrado direto com anterior≠atual (ex.: veio de importação, ou
  // digitou o valor final na hora de cadastrar) e que DEPOIS recebe uma
  // movimentação datada — a reconstrução esquecia esse salto inicial sem
  // data assim que existia QUALQUER movimentação, porque só olhava as
  // movimentações registradas partindo de situacao_anterior.
  test('bug real: salto inicial sem data não some quando o bem também tem movimentação depois', () => {
    const bemComSaltoEMovimentacao = {
      situacao_anterior: 0,
      situacao_atual: 150000, // 0 -> 100000 (cadastro direto) -> 150000 (+50000 comprado depois)
      movimentacoes: [{ tipo: 'compra', valor: 50000, data: '2025-06-15' }],
    };
    // "ate" antes da movimentação: já conta o salto sem data (100000), a
    // compra de 15/06 ainda não entra.
    expect(situacaoBemAteData(bemComSaltoEMovimentacao, '2025-03-01', 'ate')).toBe(100000);
    // "ate" depois da movimentação: bate com o valor real, 150000.
    expect(situacaoBemAteData(bemComSaltoEMovimentacao, '2025-12-31', 'ate')).toBe(150000);
    // "de": convenção conservadora de sempre, nem o salto nem a compra
    // ainda aconteceram.
    expect(situacaoBemAteData(bemComSaltoEMovimentacao, '2025-01-01', 'de')).toBe(0);
  });

  // Bug real (reportado pela usuária): selecionar De=01/01/2026 e cadastrar
  // algo NAQUELE mesmo dia não pode sumir dentro do "saldo anterior" — senão
  // a variação do período fica menor que a de verdade, escondendo um
  // lançamento que devia contar. "De" precisa ler como a véspera (a real
  // fronteira do período), não o próprio dia.
  test('bug real: movimentação datada exatamente em "De" conta como variação, não como saldo anterior', () => {
    const bem = {
      situacao_anterior: 100000,
      situacao_atual: 130000,
      movimentacoes: [{ tipo: 'compra', valor: 30000, data: '2026-01-01' }],
    };
    expect(situacaoBemAteData(bem, '2026-01-01', 'de')).toBe(100000); // véspera: a compra ainda não entra
    expect(situacaoBemAteData(bem, '2026-01-01', 'ate')).toBe(130000); // "ate" no mesmo dia já inclui
    expect(situacaoBemAteData(bem, '2026-08-19', 'ate')).toBe(130000);
  });
});

describe('totalBensAteData', () => {
  test('soma situacaoBemAteData de vários bens', () => {
    const bens = [
      { situacao_anterior: 100, situacao_atual: 150, movimentacoes: [{ tipo: 'compra', valor: 50, data: '2025-06-01' }] },
      { situacao_anterior: 200, situacao_atual: 200, movimentacoes: [] },
    ];
    expect(totalBensAteData(bens, '2025-03-01')).toBe(300); // só o segundo bem, primeiro ainda não comprou
    expect(totalBensAteData(bens, '2025-12-31')).toBe(350);
  });
});

describe('totalRendimentos', () => {
  test('separa por categoria e usa exclusiva líquida de IRRF', () => {
    const rendimentos = [
      { tipo: 'tributavel_pj', valor: 1000, data: '2025-02-01' },
      { tipo: 'isento_09', valor: 5000, data: '2025-03-01' },
      { tipo: 'exclusivo_10', valor: 2000, irrf: 300, data: '2025-04-01' },
    ];
    const r = totalRendimentos(rendimentos, 500, null, null);
    expect(r.tributavelPJ).toBe(1000);
    expect(r.demaisTributaveis).toBe(500);
    expect(r.isentoValor).toBe(5000);
    expect(r.exclusivoLiquido).toBe(1700);
    expect(r.totalGeral).toBe(1000 + 500 + 5000 + 1700);
  });

  test('filtra por período de data', () => {
    const rendimentos = [
      { tipo: 'tributavel_pj', valor: 1000, data: '2025-01-15' },
      { tipo: 'tributavel_pj', valor: 2000, data: '2025-07-15' },
    ];
    const r = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-06-30');
    expect(r.tributavelPJ).toBe(1000);
  });
});

describe('ganhosApuradosPeriodo', () => {
  test('ganho líquido de IRRF quando informado; perda pelo valor cheio', () => {
    const bens = [{
      discriminacao: 'ação X',
      movimentacoes: [
        { tipo: 'venda_total', valor: 1000, valorVenda: 1200, irrfVenda: 30, data: '2025-05-01' }, // ganho líquido 170
        { tipo: 'venda_total', valor: 500, valorVenda: 400, data: '2025-06-01' }, // perda 100
      ],
    }];
    const g = ganhosApuradosPeriodo({ bens, bensRurais: [] }, null, null);
    expect(g.total).toBeCloseTo(70, 2); // 170 - 100
    expect(g.semIrrfCount).toBe(0);
  });

  test('sinaliza ganho sem IRRF informado', () => {
    const bens = [{ discriminacao: 'x', movimentacoes: [{ tipo: 'venda_total', valor: 100, valorVenda: 150, data: '2025-01-01' }] }];
    const g = ganhosApuradosPeriodo({ bens, bensRurais: [] }, null, null);
    expect(g.semIrrfCount).toBe(1);
    expect(g.total).toBe(50); // sem IRRF informado, usa o bruto
  });
});

describe('totalPagamentos / totalPagamentosDiversos', () => {
  test('filtram por data quando informado', () => {
    const pagamentos = [{ valor_pago: 100, data: '2025-01-10' }, { valor_pago: 200, data: '2025-08-10' }];
    expect(totalPagamentos(pagamentos, null, null)).toBe(300);
    expect(totalPagamentos(pagamentos, '2025-01-01', '2025-06-30')).toBe(100);

    const diversos = [{ valor: 50, data: '2025-02-01' }, { valor: 70, data: '2025-09-01' }];
    expect(totalPagamentosDiversos(diversos, null, null)).toBe(120);
    expect(totalPagamentosDiversos(diversos, '2025-06-01', null)).toBe(70);
  });
});
