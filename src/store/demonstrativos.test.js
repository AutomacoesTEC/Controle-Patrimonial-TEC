import { describe, test, expect } from 'vitest';
import {
  situacaoBemAteData,
  situacaoDividaAteData,
  situacaoBemAposExclusao,
  situacaoDividaAposExclusao,
  totalBensAteData,
  totaisEvolucaoPatrimonial,
  variacaoPatrimonialTotal,
  totalRendimentos,
  resultadoAtividadeRuralPeriodo,
  ganhosApuradosPeriodo,
  totalPagamentos,
  totalPagamentosDiversos,
  demonstrativoConciliacao,
  diaAnterior,
  bensAlienadosSemValorDeVenda,
  rendaVariavelDoPeriodo,
  bemZeradoSemMovimentacaoNoAno,
  vendaLidaDaDiscriminacao,
  vendasDaDiscriminacaoPeriodo,
  aplicacoesResgatadasSemRendimento,
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
    // ATENÇÃO ao comparar isto com uma declaração importada: a planilha lança
    // em Pagamentos Efetuados o valor JÁ LÍQUIDO do que ela chama de
    // "Reembolso" (141.734,62 pagos menos 27.446,58), enquanto a declaração
    // informa o valor PAGO e a "Parcela não dedutível" em colunas separadas, e
    // é o valor pago que o app soma ao importar. Critério confirmado com a
    // usuária em 21/08/2026: prevalece a declaração. Parcela não dedutível diz
    // que aquela parte não abate o imposto, não que o dinheiro voltou; quando
    // for reembolso de fato, ele entra por Rendimentos. Por isso a fixture
    // usa o número da planilha: aqui o objetivo é provar a FÓRMULA, não o
    // critério de alimentação da linha.
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
    // A fixture preserva um lançamento rural de 169301.505 para provar a
    // fronteira monetária: os totais expostos pelo app fecham no centavo, não
    // carregam o meio centavo para as comparações seguintes.
    expect(d.rendimentos.totalGeral).toBe(1830916.04);
    expect(d.saldoDeCaixaGeral).toBe(877255.35);
    expect(d.saldoDeCaixa).toBe(110980.23);
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

  test('D09: foto anual preserva fechamento sem inventar posição em junho', () => {
    const bemSemMovimentacao = { situacao_anterior: 1000, situacao_atual: 5000, movimentacoes: [] };
    expect(situacaoBemAteData(bemSemMovimentacao, '2025-12-31', 'ate')).toBe(5000);
    expect(situacaoBemAteData(bemSemMovimentacao, '2025-06-01', 'ate')).toBe(1000);
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
  test('D09: salto sem data aparece no fechamento anual, não em março', () => {
    const bemComSaltoEMovimentacao = {
      situacao_anterior: 0,
      situacao_atual: 150000, // 0 -> 100000 (cadastro direto) -> 150000 (+50000 comprado depois)
      movimentacoes: [{ tipo: 'compra', valor: 50000, data: '2025-06-15' }],
    };
    // Abertura conhecida zero; salto sem data não prova posição em março.
    expect(situacaoBemAteData(bemComSaltoEMovimentacao, '2025-03-01', 'ate')).toBe(0);
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

describe('variacaoPatrimonialTotal', () => {
  // Regra confirmada pelo chefe da usuária (áudio 21/08/2026): dividasRurais
  // entra junto com dividas (empréstimo rural não passa pelo livro-caixa da
  // Atividade Rural, é fonte real de caixa), mas bensRurais NÃO entra (o bem
  // rural já passa pelo livro-caixa via despesa de investimento, dedutível
  // integralmente no resultado — contar de novo aqui duplicaria o gasto).
  test('soma dividasRurais junto com dividas, mas NÃO soma bensRurais junto com bens', () => {
    const estado = {
      bens: [{ situacao_anterior: 1000, situacao_atual: 1000, movimentacoes: [] }],
      bensRurais: [{ situacao_anterior: 500, situacao_atual: 900, movimentacoes: [] }],
      dividas: [{ situacao_anterior: 100, situacao_atual: 100 }],
      dividasRurais: [{ situacao_anterior: 200, situacao_atual: 50 }],
    };
    const d = variacaoPatrimonialTotal(estado, null, null);
    expect(d.bensDe).toBe(1000); // só `bens`, ignora os 500 de bensRurais
    expect(d.bensAte).toBe(1000); // só `bens`, ignora os 900 de bensRurais
    expect(d.deltaBens).toBe(0);
    expect(d.dividaDe).toBe(300); // 100 + 200
    expect(d.dividaAte).toBe(150); // 100 + 50 (dívida rural amortizada)
    expect(d.deltaDivida).toBe(-150);
    // total = -(Δbens) + (Δdívida) = -0 + (-150) = -150
    expect(d.total).toBe(-150);
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

  // Bug real (achado auditando o Dashboard contra uma declaração
  // importada): rendimentos vindos do .DBK/PDF (registros 21/23/24) não têm
  // data própria no arquivo (são total anual, não lançamento pontual) — o
  // parser passou a atribuir 31/12/{ano-calendário} pra eles (ver
  // importParsers.js) exatamente pra cair dentro de uma consulta do ano
  // inteiro, que é a visão padrão do Dashboard. Sem ISSO, `noPeriodo`
  // descartava o item inteiro sempre que dataDe/dataAte estavam
  // preenchidos (o caso normal), zerando Rendimentos no Demonstrativo de
  // Conciliação mesmo com dado real importado.
  test('rendimento sem `data` some da consulta assim que um período está ativo (documentação do bug do Dashboard)', () => {
    const rendimentos = [{ tipo: 'tributavel_pj', valor: 1000 }]; // sem `data`, igual sai do import
    const semFiltro = totalRendimentos(rendimentos, 0, null, null);
    expect(semFiltro.tributavelPJ).toBe(1000); // sem filtro, conta (ver noPeriodo)
    const comFiltro = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31');
    expect(comFiltro.tributavelPJ).toBe(0); // com filtro (o caso normal do Dashboard), some
  });

  test('com a data de 31/12 atribuída pelo parser, o mesmo rendimento aparece na consulta do ano inteiro', () => {
    const rendimentos = [{ tipo: 'tributavel_pj', valor: 1000, data: '2025-12-31' }];
    const r = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelPJ).toBe(1000);
  });

  // Correção de 24/08/2026: o tributável de PJ entra líquido das duas
  // retenções da fonte pagadora. Ver o comentário longo em totalRendimentos.
  test('desconta contribuição previdenciária e IRRF do tributável de PJ, e expõe as três parcelas', () => {
    const rendimentos = [
      { tipo: 'tributavel_pj', valor: 100000, contribuicaoPrevidenciaria: 8000, irrf: 15000, data: '2025-12-31' },
      { tipo: 'tributavel_pj', valor: 20000, contribuicaoPrevidenciaria: 2200, irrf: 0, data: '2025-12-31' },
    ];
    const r = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelPjBruto).toBe(120000);
    expect(r.tributavelPjPrevidencia).toBe(10200);
    expect(r.tributavelPjIrrf).toBe(15000);
    expect(r.tributavelPJ).toBe(94800);
    expect(r.totalGeral).toBe(94800);
  });

  test('rendimento de PJ sem os campos de retenção (lançamento manual) continua entrando pelo valor cheio', () => {
    const r = totalRendimentos([{ tipo: 'tributavel_pj', valor: 5000, data: '2025-12-31' }], 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelPjBruto).toBe(5000);
    expect(r.tributavelPjPrevidencia).toBe(0);
    expect(r.tributavelPjIrrf).toBe(0);
    expect(r.tributavelPJ).toBe(5000);
  });

  // O 13º vem em coluna PRÓPRIA da ficha de PJ e é rendimento de tributação
  // exclusiva: o parser cria um lançamento exclusivo_08 separado, com o IRRF
  // do 13º. O desconto do PJ não pode alcançar esse imposto, senão ele sai
  // duas vezes do caixa.
  test('o IRRF do 13º sai só pelo bloco de tributação exclusiva, nunca também pelo de PJ', () => {
    const rendimentos = [
      { tipo: 'tributavel_pj', valor: 57754.33, contribuicaoPrevidenciaria: 0, irrf: 3360.61, data: '2025-12-31' },
      { tipo: 'exclusivo_08', valor: 4556.29, irrf: 274.90, data: '2025-12-31' },
    ];
    const r = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelPJ).toBeCloseTo(54393.72, 2);
    expect(r.exclusivoLiquido).toBeCloseTo(4556.29, 2); // D03: 13º já líquido
    expect(r.totalGeral).toBeCloseTo(58950.01, 2);
  });

  // Números reais da declaração de referência B (exercício 2026): 7 fontes de PJ entre titular e dependente, somando
  // 340.649,47 de bruto, 16.703,17 de INSS e 47.019,50 de IRRF. Antes da
  // correção o demonstrativo somava o bruto, e o Saldo de Caixa Geral vinha
  // 63.722,67 maior do que o dinheiro que de fato entrou.
  test('declaração de referência: as 7 fontes de PJ entram por 276.926,80, não pelo bruto de 340.649,47', () => {
    const fontes = [
      { valor: 18110.00, contribuicaoPrevidenciaria: 0, irrf: 0 },
      { valor: 208955.14, contribuicaoPrevidenciaria: 10726.87, irrf: 43658.89 },
      { valor: 1500.00, contribuicaoPrevidenciaria: 0, irrf: 0 },
      { valor: 18110.00, contribuicaoPrevidenciaria: 1992.10, irrf: 0 },
      { valor: 18110.00, contribuicaoPrevidenciaria: 1992.10, irrf: 0 },
      { valor: 18110.00, contribuicaoPrevidenciaria: 1992.10, irrf: 0 },
      { valor: 57754.33, contribuicaoPrevidenciaria: 0, irrf: 3360.61 },
    ].map(f => ({ ...f, tipo: 'tributavel_pj', data: '2025-12-31' }));
    const r = totalRendimentos(fontes, 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelPjBruto).toBeCloseTo(340649.47, 2);
    expect(r.tributavelPjPrevidencia).toBeCloseTo(16703.17, 2);
    expect(r.tributavelPjIrrf).toBeCloseTo(47019.50, 2);
    expect(r.tributavelPJ).toBeCloseTo(276926.80, 2);
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

// Regressão do bug real achado na auditoria de 21/08/2026: a movimentação era
// contada DUAS VEZES na reconstrução por data sempre que a saída (venda
// parcial / amortização) era maior que a base acumulada até ali. O piso em
// zero, aplicado também na MEDIÇÃO do "explicado pelas movimentações",
// inflava o salto sem data na mesma medida em que o corte engolia, e a
// movimentação era aplicada de novo em cima do salto inflado.
//
// O gatilho é comum: bem ou dívida cadastrado no próprio ano com o valor
// digitado direto no formulário (situação anterior zero) e movimentado
// depois. Registrando a entrada como movimentação de compra/contratação o
// resultado já saía certo antes do fix, e era isso que tornava o erro difícil
// de perceber, então os dois caminhos estão cobertos aqui.
describe('reconstrução por data não conta a movimentação duas vezes', () => {
  test('DÍVIDA cadastrada com saldo no formulário e depois amortizada', () => {
    const divida = {
      situacao_anterior: 0,
      situacao_atual: 600000, // 800.000 digitados no formulário, menos a amortização
      movimentacoes: [{ id: 1, tipo: 'amortizacao', valor: 200000, data: '2026-08-10' }],
    };
    // Antes do fix devolvia 400.000 (amortização descontada duas vezes).
    expect(situacaoDividaAteData(divida, '2026-12-31', 'ate')).toBe(600000);
    // Sem data da contratação, a projeção não inventa ingresso em agosto.
    expect(situacaoDividaAteData(divida, '2026-08-09', 'ate')).toBe(0);
    // Início do período: a dívida ainda não existia.
    expect(situacaoDividaAteData(divida, '2026-01-01', 'de')).toBe(0);
  });

  test('BEM cadastrado com valor no formulário e depois vendido em parte', () => {
    const bem = {
      situacao_anterior: 0,
      situacao_atual: 250000, // 350.000 digitados no formulário, menos a venda parcial
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 100000, data: '2026-08-10' }],
    };
    // Antes do fix devolvia 150.000.
    expect(situacaoBemAteData(bem, '2026-12-31', 'ate')).toBe(250000);
    expect(situacaoBemAteData(bem, '2026-08-09', 'ate')).toBe(0); // aquisição não datada
  });

  test('mesmo caso, mas com a entrada registrada como movimentação: continua certo', () => {
    const divida = {
      situacao_anterior: 0,
      situacao_atual: 600000,
      movimentacoes: [
        { id: 1, tipo: 'contratacao', valor: 800000, data: '2026-03-01' },
        { id: 2, tipo: 'amortizacao', valor: 200000, data: '2026-08-10' },
      ],
    };
    expect(situacaoDividaAteData(divida, '2026-12-31', 'ate')).toBe(600000);
    expect(situacaoDividaAteData(divida, '2026-05-01', 'ate')).toBe(800000);
    expect(situacaoDividaAteData(divida, '2026-02-01', 'ate')).toBe(0);
  });

  test('bem importado, com saldo anterior maior que a venda: comportamento inalterado', () => {
    const bem = {
      situacao_anterior: 100000,
      situacao_atual: 70000,
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 30000, data: '2026-06-15' }],
    };
    expect(situacaoBemAteData(bem, '2026-12-31', 'ate')).toBe(70000);
    expect(situacaoBemAteData(bem, '2026-06-14', 'ate')).toBe(100000);
    expect(situacaoBemAteData(bem, '2026-01-01', 'de')).toBe(100000);
  });

  test('venda total e quitação continuam zerando, com ou sem salto sem data', () => {
    const bem = {
      situacao_anterior: 474674,
      situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 474674, data: '2026-02-20' }],
    };
    expect(situacaoBemAteData(bem, '2026-12-31', 'ate')).toBe(0);
    expect(situacaoBemAteData(bem, '2026-02-19', 'ate')).toBe(474674);

    const divida = {
      situacao_anterior: 0,
      situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'quitacao', valor: 0, data: '2026-08-10' }],
    };
    expect(situacaoDividaAteData(divida, '2026-12-31', 'ate')).toBe(0);
  });

  // Caso degenerado (anterior e atual zerados, mas com uma saída registrada):
  // a reconstrução passa a INFERIR que o bem valia o que foi vendido antes da
  // venda, em vez de responder zero o tempo todo. É a resposta mais fiel ao
  // que a movimentação afirma, e fica documentada aqui porque é a única
  // mudança de comportamento que o fix traz fora do bug.
  test('D09: saída sem aquisição não comprova posição anterior à venda', () => {
    const bem = {
      situacao_anterior: 0,
      situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 100000, data: '2026-06-01' }],
    };
    expect(situacaoBemAteData(bem, '2026-05-31', 'ate')).toBe(0);
    expect(situacaoBemAteData(bem, '2026-12-31', 'ate')).toBe(0);
  });

  test('recálculo após excluir movimentação usa a mesma medição sem piso', () => {
    const divida = {
      situacao_anterior: 0,
      situacao_atual: 600000,
      movimentacoes: [{ id: 1, tipo: 'amortizacao', valor: 200000, data: '2026-08-10' }],
    };
    // Excluindo a única amortização, sobra o que foi contratado.
    expect(situacaoDividaAposExclusao(divida, [])).toBe(800000);

    const bem = {
      situacao_anterior: 0,
      situacao_atual: 250000,
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 100000, data: '2026-08-10' }],
    };
    expect(situacaoBemAposExclusao(bem, [])).toBe(350000);
  });
});

// Regressão do achado da auditoria de 21/08/2026: o Relatório para IRPF e o
// Dashboard davam números diferentes para os mesmos rótulos, no mesmo ano,
// sem nenhum aviso. O Relatório somava bensRurais (herança da ATUALIZAÇÃO 9,
// revogada pelas ATUALIZAÇÕES 19 e 22 no mesmo dia) e ignorava dividasRurais.
// Este teste fixa o critério único, para as duas telas não voltarem a
// divergir se alguém mexer num lado só.
describe('totaisEvolucaoPatrimonial: critério único de Bens e Dívidas', () => {
  const dados = {
    bens: [
      { situacao_anterior: 100000, situacao_atual: 130000 },
      { situacao_anterior: 0, situacao_atual: 350000 },
    ],
    bensRurais: [
      { situacao_anterior: 0, situacao_atual: 480000 },
    ],
    dividas: [
      { situacao_anterior: 36000, situacao_atual: 36000 },
      { situacao_anterior: 0, situacao_atual: 600000 },
    ],
    dividasRurais: [
      { situacao_anterior: 0, situacao_atual: 1500000 },
    ],
  };

  test('BENS conta só a ficha Bens e Direitos, nunca o bem da Atividade Rural', () => {
    const t = totaisEvolucaoPatrimonial(dados);
    expect(t.bensAnterior).toBe(100000);
    expect(t.bensAtual).toBe(480000); // 130.000 + 350.000, sem os 480.000 do bem rural
  });

  test('DÍVIDA conta Dívidas e Ônus Reais MAIS a Dívida Rural', () => {
    const t = totaisEvolucaoPatrimonial(dados);
    expect(t.dividaComumAtual).toBe(636000);
    expect(t.dividaRuralAtual).toBe(1500000);
    expect(t.dividasAtual).toBe(2136000);
    expect(t.dividasAnterior).toBe(36000);
  });

  test('patrimônio líquido sai da mesma conta', () => {
    const t = totaisEvolucaoPatrimonial(dados);
    expect(t.patrimonioAnterior).toBe(100000 - 36000);
    expect(t.patrimonioAtual).toBe(480000 - 2136000);
  });

  test('bate com o critério do Dashboard sobre os mesmos dados', () => {
    // variacaoPatrimonialTotal reconstrói por data; sobre o ano inteiro, e sem
    // movimentação registrada, tem que chegar à mesma variação que a foto.
    const t = totaisEvolucaoPatrimonial(dados);
    const v = variacaoPatrimonialTotal(dados, '2026-01-01', '2026-12-31');
    expect(v.bensAte - v.bensDe).toBe(t.bensAtual - t.bensAnterior);
    expect(v.dividaAte - v.dividaDe).toBe(t.dividasAtual - t.dividasAnterior);
  });

  test('sem atividade rural, o resultado é a soma simples das duas fichas', () => {
    const t = totaisEvolucaoPatrimonial({ bens: dados.bens, dividas: dados.dividas });
    expect(t.bensAtual).toBe(480000);
    expect(t.dividasAtual).toBe(636000);
    expect(t.dividaRuralAtual).toBe(0);
  });
});

// Regressão do achado da auditoria de 21/08/2026, confirmado na fonte oficial
// e decidido com o chefe da usuária: a venda de bem da Atividade Rural NÃO é
// ganho de capital, é receita bruta da atividade rural (IN SRF 83/2001,
// art. 5º, § 2º, III; Decreto nº 9.580/2018, art. 54, § 1º, III). Contá-la em
// Ganhos Apurados somava a mesma entrada de caixa duas vezes: uma pelo
// resultado do livro-caixa (demaisTributaveis) e outra aqui.
describe('venda de bem rural fora dos Ganhos Apurados', () => {
  const vendaRural = {
    discriminacao: 'TRATOR JOHN DEERE 6110J',
    movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 480000, valorVenda: 500000, irrfVenda: 0, data: '2026-05-10' }],
  };
  const vendaComum = {
    discriminacao: 'AUTOMOVEL',
    movimentacoes: [{ id: 2, tipo: 'venda_total', valor: 474674, valorVenda: 500000, irrfVenda: 3800.10, data: '2026-02-20' }],
  };

  test('bem rural não entra, nem na lista nem no total', () => {
    const g = ganhosApuradosPeriodo({ bens: [], bensRurais: [vendaRural] }, null, null);
    expect(g.vendas).toEqual([]);
    expect(g.total).toBe(0);
  });

  test('bem da ficha Bens e Direitos continua entrando, líquido de IRRF', () => {
    const g = ganhosApuradosPeriodo({ bens: [vendaComum], bensRurais: [vendaRural] }, null, null);
    expect(g.vendas).toHaveLength(1);
    expect(g.vendas[0].bem).toBe('AUTOMOVEL');
    expect(g.total).toBeCloseTo(21525.90, 2);
  });

  test('a terra nua, única exceção legal, continua apurada como ganho de capital', () => {
    // Imóvel rural é declarado em Bens e Direitos (grupo 01, código 14), não
    // em bensRurais, então nenhum tratamento especial é necessário: basta ele
    // estar em `bens` para a exceção do art. 9º, § 2º da IN SRF 83/2001
    // continuar valendo.
    const terraNua = {
      grupo: '01', codigo_bem: '14', discriminacao: 'TERRENO RURAL COM 122,89 HA',
      movimentacoes: [{ id: 3, tipo: 'venda_total', valor: 200000, valorVenda: 350000, irrfVenda: 0, data: '2026-09-01' }],
    };
    const g = ganhosApuradosPeriodo({ bens: [terraNua], bensRurais: [] }, null, null);
    expect(g.vendas).toHaveLength(1);
    expect(g.total).toBe(150000);
  });
});

// Regressão do achado da auditoria de 21/08/2026, na rodada do .DBK: a
// apuração da Atividade Rural importada era guardada e exibida, mas nunca
// somada. Um ano recém-importado mostrava "Resultado da Atividade Rural
// R$ 0,00" com a declaração apurando milhões, e isso quebrava a premissa em
// que o resto do critério se apoia: o bem rural fica FORA de Bens porque o
// resultado do livro-caixa já o cobre, e a dívida rural ENTRA como origem de
// caixa (IN SRF 83/2001, art. 5º, § 2º, III e art. 8º, III). Com o resultado
// zerado, tirava-se o bem e contava-se a dívida, sem a contrapartida.
describe('resultado da Atividade Rural: livro-caixa manual ou apuração importada', () => {
  // Os 12 meses do registro 51 da declaração real do exercício 2026.
  const mesesReais = [
    { mes: 1, receitaBruta: 571165.26, despesaCusteioInvestimento: 986223.47 },
    { mes: 2, receitaBruta: 607676.54, despesaCusteioInvestimento: 758276.87 },
    { mes: 3, receitaBruta: 637054.13, despesaCusteioInvestimento: 868548.58 },
    { mes: 4, receitaBruta: 618132.77, despesaCusteioInvestimento: 1006263.21 },
    { mes: 5, receitaBruta: 641699.39, despesaCusteioInvestimento: 1862029.63 },
    { mes: 6, receitaBruta: 1149555.81, despesaCusteioInvestimento: 914216.75 },
    { mes: 7, receitaBruta: 1710820.97, despesaCusteioInvestimento: 1273250.37 },
    { mes: 8, receitaBruta: 2718404.37, despesaCusteioInvestimento: 739757.15 },
    { mes: 9, receitaBruta: 859575.69, despesaCusteioInvestimento: 1696918.84 },
    { mes: 10, receitaBruta: 2174790.12, despesaCusteioInvestimento: 1359604.33 },
    { mes: 11, receitaBruta: 317369.60, despesaCusteioInvestimento: 822965.00 },
    { mes: 12, receitaBruta: 14940.39, despesaCusteioInvestimento: 1295200.83 },
  ];

  test('sem lançamento manual, usa a apuração importada e bate com o resultado da declaração', () => {
    const r = resultadoAtividadeRuralPeriodo([], '2025-01-01', '2025-12-31', { meses: mesesReais, ano: 2025 });
    // Página "APURAÇÃO DO RESULTADO - BRASIL": 12.021.185,04 menos
    // 13.583.255,03 dá -1.562.069,99.
    expect(r).toBeCloseTo(-1562069.99, 2);
  });

  test('a figura é o RESULTADO de caixa, não o resultado tributável da declaração', () => {
    // A declaração informa resultado tributável de 2.404.237,00, que já vem
    // depois da compensação de prejuízo de anos anteriores (Lei 8.023/1990,
    // art. 14). Compensar prejuízo antigo não movimenta dinheiro no ano, e o
    // demonstrativo é reconciliação de CAIXA (Lei 8.023/1990, art. 4º:
    // receitas RECEBIDAS menos despesas PAGAS).
    const r = resultadoAtividadeRuralPeriodo([], '2025-01-01', '2025-12-31', { meses: mesesReais, ano: 2025 });
    expect(r).not.toBeCloseTo(2404237.00, 2);
  });

  // ACHADO 03 da auditoria de 24/08/2026. Este teste afirmava que UM
  // lançamento manual bastava para descartar os DOZE meses importados. Era o
  // bug: reproduzido clicando na tela, uma despesa de R$ 100,00 levava o
  // resultado de -460.078,43 para -100,00 e movia o Saldo de Caixa Geral em
  // R$ 459.978,43 (nesta declaração de referência, R$ 1.562.069,99).
  // A precedência agora é POR MÊS: só o mês corrigido à mão deixa de valer.
  test('substituição EXPLÍCITA troca só o mês; demais meses continuam valendo', () => {
    const manuais = [
      { tipo: 'receita', valor: 8000000, data: '2025-07-30', tratamentoMes: 'substituir' },
      { tipo: 'despesa', valor: 3100000, data: '2025-04-12', tratamentoMes: 'substituir' },
    ];
    const r = resultadoAtividadeRuralPeriodo(manuais, '2025-01-01', '2025-12-31', { meses: mesesReais, ano: 2025 });
    const oficialSemAbrilEJulho = mesesReais
      .filter(m => m.mes !== 4 && m.mes !== 7)
      .reduce((s, m) => s + m.receitaBruta - m.despesaCusteioInvestimento, 0);
    expect(r).toBeCloseTo(4900000 + oficialSemAbrilEJulho, 2);
    // E o resultado NÃO é só o manual, que era o comportamento antigo.
    expect(r).not.toBeCloseTo(4900000, 2);
  });

  test('um único lançamento manual não apaga o ano inteiro importado', () => {
    const soUm = [{ tipo: 'despesa', valor: 100, data: '2025-06-15' }];
    const r = resultadoAtividadeRuralPeriodo(soUm, '2025-01-01', '2025-12-31', { meses: mesesReais, ano: 2025 });
    const junho = mesesReais.find(m => m.mes === 6);
    const semJunho = mesesReais
      .filter(m => m.mes !== 6)
      .reduce((s, m) => s + m.receitaBruta - m.despesaCusteioInvestimento, 0);
    expect(r).toBeCloseTo(semJunho + junho.receitaBruta - junho.despesaCusteioInvestimento - 100, 2);
    expect(r).not.toBe(-100);
    expect(junho).toBeTruthy();
  });

  test('D07: lançamento sem data não apaga a apuração importada', () => {
    // Dado gravado antes de a data existir no formulário: não dá para saber
    // qual mês ele corrige, e somar os dois lados contaria a mesma receita
    // duas vezes. Sem filtro de período, `noPeriodo` aceita o item sem data.
    const semData = [{ tipo: 'receita', valor: 1234 }];
    const r = resultadoAtividadeRuralPeriodo(semData, null, null, { meses: mesesReais, ano: 2025 });
    expect(r).toBeCloseTo(1234 + mesesReais.reduce((s,m) => s + m.receitaBruta - m.despesaCusteioInvestimento, 0), 2);
  });

  test('a apuração importada respeita o recorte do período, mês a mês', () => {
    // Só o primeiro semestre: soma de janeiro a junho.
    const r = resultadoAtividadeRuralPeriodo([], '2025-01-01', '2025-06-30', { meses: mesesReais, ano: 2025 });
    const esperado = mesesReais.slice(0, 6)
      .reduce((s, m) => s + m.receitaBruta - m.despesaCusteioInvestimento, 0);
    expect(r).toBeCloseTo(esperado, 2);
  });

  test('sem o ano do chamador, o mês não é situado no tempo e fica de fora do filtro', () => {
    // Melhor devolver zero do que chutar um ano e somar num período errado.
    const r = resultadoAtividadeRuralPeriodo([], '2025-01-01', '2025-12-31', { meses: mesesReais });
    expect(r).toBe(0);
  });

  test('sem nenhuma das duas fontes, é zero', () => {
    expect(resultadoAtividadeRuralPeriodo([], '2025-01-01', '2025-12-31', undefined)).toBe(0);
    expect(resultadoAtividadeRuralPeriodo(null, null, null, { meses: [], ano: 2025 })).toBe(0);
  });
});

// Mesmo achado do resultado rural, agora nos Ganhos Apurados: a Apuração do
// Ganho de Capital que vem na declaração era só exibida, nunca somada, e o
// Dashboard mostrava "0 venda(s), R$ 0,00" num ano importado com vendas
// apuradas de verdade. Auditoria de 21/08/2026.
describe('Ganhos Apurados: movimentação lançada ou apuração da declaração', () => {
  // As 3 operações reais da declaração de referência, todas com prejuízo.
  const apuracaoReal = [
    { bem: 'JEEP COMANDER', custoAquisicao: 269655.86, valorAlienacao: 199000, ganhoCapital: 0, dataAlienacao: '2025-02-07' },
    { bem: 'FORD RANGER', custoAquisicao: 341890, valorAlienacao: 270000, ganhoCapital: 0, dataAlienacao: '2025-07-30' },
    { bem: 'BMW X3', custoAquisicao: 399234, valorAlienacao: 300000, ganhoCapital: 0, dataAlienacao: '2025-12-17' },
  ];

  test('sem venda lançada, usa a apuração da declaração e a PERDA entra negativa', () => {
    const g = ganhosApuradosPeriodo({ bens: [], apuracaoGanhoCapital: apuracaoReal }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(3);
    // -70.655,86 -71.890,00 -99.234,00
    expect(g.total).toBeCloseTo(-241779.86, 2);
    expect(g.daDeclaracao).toBe(true);
  });

  test('NÃO usa o campo ganhoCapital da declaração, que zera o prejuízo', () => {
    // A declaração informa 0,00 nas três, porque prejuízo não gera imposto.
    // Somar esse campo daria zero e esconderia 241.779,86 que não voltaram
    // para o caixa.
    const g = ganhosApuradosPeriodo({ bens: [], apuracaoGanhoCapital: apuracaoReal }, null, null);
    expect(g.total).not.toBe(0);
  });

  // ACHADO 02 da auditoria de 24/08/2026, o mais grave de todos. Este teste
  // afirmava que UMA venda lançada à mão, em QUALQUER bem, tinha precedência
  // sobre a apuração inteira da declaração. Era o bug: reproduzido clicando na
  // tela, uma venda parcial de R$ 1.000,00 num saldo de conta bancária fazia
  // as três perdas de veículo desta mesma apuração (-241.779,86) sumirem do
  // demonstrativo e o Saldo de Caixa Geral subir R$ 241.979,86.
  // Agora a precedência é POR OPERAÇÃO: só some da apuração o que a usuária
  // de fato relançou (mesma data de alienação E mesmo valor de alienação).
  test('venda de OUTRO bem não apaga as operações da declaração', () => {
    const bens = [{
      discriminacao: 'AUTOMOVEL',
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 100000, valorVenda: 150000, irrfVenda: 7500, data: '2025-05-10' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: apuracaoReal }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(4); // a manual + as 3 da declaração
    expect(g.total).toBeCloseTo(42500 - 241779.86, 2);
    expect(g.daDeclaracao).toBe(false);
    expect(g.possiveisDuplicidades).toHaveLength(0);
  });

  test('a MESMA venda relançada à mão não é contada duas vezes', () => {
    // Mesma data de alienação e mesmo valor da 1ª operação da declaração
    // (07/02/2025, R$ 199.000,00): é a mesma venda, agora com o IRRF que a
    // apuração não traz. Vale a movimentação, e a operação oficial sai.
    const bens = [{
      discriminacao: 'JEEP COMANDER OVERLAND PLACA RUP 6A678',
      movimentacoes: [{ id: 1, apuracaoGanhoCapitalId: 'venda-jeep', tipo: 'venda_total', valor: 269655.86, valorVenda: 199000, data: '2025-02-07' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: apuracaoReal.map((g,i) => i === 0 ? {...g,id:'venda-jeep'} : g) }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(3); // vínculo explícito, não só preço/data
    expect(g.vendas.filter(v => v.daDeclaracao)).toHaveLength(2);
    expect(g.total).toBeCloseTo(-241779.86, 2);
    expect(g.possiveisDuplicidades).toHaveLength(0);
  });

  test('venda no mesmo dia por valor diferente não é suprimida, mas é sinalizada para conferência', () => {
    const bens = [{
      discriminacao: 'OUTRO BEM VENDIDO NO MESMO DIA',
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 1000, valorVenda: 1500, data: '2025-02-07' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: apuracaoReal }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(4);
    expect(g.possiveisDuplicidades).toHaveLength(1);
    expect(g.possiveisDuplicidades[0]).toMatchObject({ data: '2025-02-07', valorAlienacao: 199000 });
  });

  test('a apuração da declaração respeita o recorte do período, pela data de alienação', () => {
    const g = ganhosApuradosPeriodo({ bens: [], apuracaoGanhoCapital: apuracaoReal }, '2025-01-01', '2025-06-30');
    expect(g.vendas).toHaveLength(1);
    expect(g.total).toBeCloseTo(-70655.86, 2);
  });

  test('operação com GANHO vinda da declaração entra pelo bruto e sinaliza o IRRF ausente', () => {
    const comGanho = [{ bem: 'X', custoAquisicao: 100000, valorAlienacao: 150000, ganhoCapital: 50000, dataAlienacao: '2025-03-01' }];
    const g = ganhosApuradosPeriodo({ bens: [], apuracaoGanhoCapital: comGanho }, null, null);
    expect(g.total).toBe(50000);
    expect(g.semIrrfCount).toBe(1);
  });

  test('sem nenhuma das duas fontes, é zero', () => {
    const g = ganhosApuradosPeriodo({ bens: [], apuracaoGanhoCapital: [] }, null, null);
    expect(g.vendas).toEqual([]);
    expect(g.total).toBe(0);
    expect(g.daDeclaracao).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Regressões da auditoria independente de 24/08/2026. Cada bloco reproduz o
// cenário exato em que o defeito foi observado, para que ele não volte.
// ---------------------------------------------------------------------------

describe('achado 13: diaAnterior não pode depender do fuso da máquina', () => {
  // O app roda na máquina do usuário final, e o fuso não é escolha nossa. A
  // versão antiga misturava construção em horário LOCAL com saída em UTC, e
  // errava um dia a mais em qualquer fuso a leste de Greenwich.
  test('devolve a véspera correta, e a conta não passa por horário local', () => {
    expect(diaAnterior('2025-01-01')).toBe('2024-12-31');
    expect(diaAnterior('2025-03-01')).toBe('2025-02-28');
    expect(diaAnterior('2024-03-01')).toBe('2024-02-29'); // ano bissexto
    expect(diaAnterior('2025-12-31')).toBe('2025-12-30');
  });
});

describe('achado 01: custo baixado numa venda total de bem já zerado', () => {
  // O formulário passou a gravar como custo a situação NA VÉSPERA da venda, e
  // não a situação atual. Este teste prova a peça do motor de que ele depende.
  test('situacaoBemAteData no lado "de" devolve o valor que o bem tinha antes da baixa', () => {
    const bem = { situacao_anterior: 21000, situacao_atual: 0, movimentacoes: [] };
    expect(situacaoBemAteData(bem, '2025-03-01', 'de')).toBe(21000);
  });

  test('com o custo certo, a venda do Uno da declaração de referência dá PERDA', () => {
    const bens = [{
      discriminacao: 'FIAT/UNO PLACA LPX9E43',
      situacao_anterior: 21000,
      situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 21000, valorVenda: 18000, data: '2025-03-01' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31');
    expect(g.total).toBe(-3000);
  });

  test('o custo ZERO que o bug gravava produzia ganho igual ao preço inteiro', () => {
    // Guarda-chuva: se alguém voltar a gravar valor 0 numa venda total, este
    // teste continua verde mas o de cima falha — os dois juntos dizem que o
    // problema estava no valor gravado, não na fórmula do ganho.
    const bens = [{
      discriminacao: 'FIAT/UNO PLACA LPX9E43',
      situacao_anterior: 21000, situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 0, valorVenda: 18000, data: '2025-03-01' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31');
    expect(g.total).toBe(18000);
  });
});

describe('achado 04: bens que encolheram sem valor de venda informado', () => {
  const bemVendido = {
    id: 1, grupo: '02', discriminacao: 'AUDI Q3', situacao_anterior: 328240.92, situacao_atual: 0, movimentacoes: [],
  };
  test('aponta o bem zerado no ano que não tem venda lançada nem operação na GCAP', () => {
    const p = bensAlienadosSemValorDeVenda({ bens: [bemVendido], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31');
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ discriminacao: 'AUDI Q3', reducao: 328240.92 });
  });
  test('não aponta quando a venda foi lançada com o preço recebido', () => {
    const bem = { ...bemVendido, movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 328240.92, valorVenda: 226200, data: '2025-11-27' }] };
    expect(bensAlienadosSemValorDeVenda({ bens: [bem], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });
  test('não aponta quando a operação está na Apuração do Ganho de Capital', () => {
    const apur = [{ bem: 'AUDI Q3', dataAlienacao: '2025-11-27', custoAquisicao: 328240.92, valorAlienacao: 226200 }];
    expect(bensAlienadosSemValorDeVenda({ bens: [bemVendido], apuracaoGanhoCapital: apur }, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });
  test('resgate de aplicação não é alienação: o valor declarado já é dinheiro', () => {
    // Grupos 04/05/06/07 ficam de fora — sem isso o aviso disparava 18 vezes
    // na declaração de referência para 3 casos reais.
    const cdb = { id: 2, grupo: '04', discriminacao: 'BB CDB DI', situacao_anterior: 147500, situacao_atual: 79000, movimentacoes: [] };
    const conta = { id: 3, grupo: '06', discriminacao: 'BB CONTA CORRENTE', situacao_anterior: 15017.62, situacao_atual: 0, movimentacoes: [] };
    expect(bensAlienadosSemValorDeVenda({ bens: [cdb, conta], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });

  test('redução PARCIAL de bem não financeiro não é apontada; só a saída total', () => {
    const meioImovel = { id: 4, grupo: '01', discriminacao: 'IMOVEL', situacao_anterior: 400000, situacao_atual: 200000, movimentacoes: [] };
    expect(bensAlienadosSemValorDeVenda({ bens: [meioImovel], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });

  test('baixa por perda ou doação não é venda de valor desconhecido', () => {
    const bem = { ...bemVendido, movimentacoes: [{ id: 1, tipo: 'baixa', valor: 328240.92, data: '2025-06-01' }] };
    expect(bensAlienadosSemValorDeVenda({ bens: [bem], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });
});

describe('achado 09: os dois motores fecham pela mesma fórmula', () => {
  test('demonstrativoConciliacao passa a descontar as doações, como a tela sempre fez', () => {
    const base = {
      anoCalendario: 2025,
      bens: [{ situacao_anterior: 0, situacao_atual: 0, movimentacoes: [] }],
      dividas: [], bensRurais: [], dividasRurais: [],
      rendimentos: [{ tipo: 'isento_09', valor: 100000, data: '2025-12-31' }],
      pagamentos: [], pagamentosDiversos: [], lancamentosRurais: [],
      receitasDespesasRuraisOficial: [], apuracaoGanhoCapital: [],
      doacoesEfetuadasOficial: [{ id: 1, valor: 50000 }],
      doacoesPartidosOficial: [], doacoesEcaIdosoOficial: [],
    };
    const d = demonstrativoConciliacao(base, '2025-01-01', '2025-12-31');
    expect(d.totalDoacoes).toBe(50000);
    expect(d.saldoDeCaixa).toBe(50000);
  });
});

describe('achado 05: RRA que a declaração informa duas vezes', () => {
  test('o lançamento marcado como naoSomar fica na lista mas não entra no total', () => {
    const rendimentos = [
      { tipo: 'tributavel_rra', valor: 105000, data: '2025-12-31', naoSomar: true },
      { tipo: 'exclusivo_0007', valor: 105000, irrf: 0, data: '2025-12-31' },
    ];
    const r = totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31');
    expect(r.tributavelRra).toBe(0);
    expect(r.exclusivoLiquido).toBe(105000);
    expect(r.totalGeral).toBe(105000);
  });
  test('sem a marca, os dois somam — que era o defeito', () => {
    const rendimentos = [
      { tipo: 'tributavel_rra', valor: 105000, data: '2025-12-31' },
      { tipo: 'exclusivo_0007', valor: 105000, irrf: 0, data: '2025-12-31' },
    ];
    expect(totalRendimentos(rendimentos, 0, '2025-01-01', '2025-12-31').totalGeral).toBe(210000);
  });
});

describe('achado 12: perda em renda variável entra no caixa, ganho não', () => {
  const ficha = (mes, comuns) => ({ mes, comuns: { resultadoLiquidoMes: comuns }, daytrade: { resultadoLiquidoMes: 0 }, consolidacao: {} });
  test('só a parte negativa vira saída de caixa', () => {
    const rv = rendaVariavelDoPeriodo([ficha(7, -245.4), ficha(8, 1000)], 2025, '2025-01-01', '2025-12-31');
    expect(rv.resultado).toBeCloseTo(754.6, 2);
    expect(rv.perda).toBeCloseTo(-245.4, 2);
  });
  test('respeita o recorte do período', () => {
    const rv = rendaVariavelDoPeriodo([ficha(7, -245.4), ficha(12, -1000)], 2025, '2025-01-01', '2025-08-31');
    expect(rv.perda).toBeCloseTo(-245.4, 2);
  });

  // Item E: demonstrativoConciliacao(state, ...) passou a ler renda
  // variável via linhasComunsDoAno(state) (mesclagem oficial+manual, ver
  // rendaVariavelMensal.js), não mais direto de state.rendaVariavelMensalOficial.
  test('mês lançado à mão (fora da declaração) também entra no Saldo de Caixa como perda', () => {
    const stateBase = {
      bens: [], dividas: [], dividasRurais: [], rendimentos: [], pagamentos: [], pagamentosDiversos: [],
      lancamentosRurais: [], receitasDespesasRuraisOficial: [], anoCalendario: 2025,
      doacoesEfetuadasOficial: [], doacoesPartidosOficial: [], doacoesEcaIdosoOficial: [],
    };
    const semManual = demonstrativoConciliacao(
      { ...stateBase, rendaVariavelMensalOficial: [] },
      '2025-01-01', '2025-12-31',
    );
    const comManual = demonstrativoConciliacao(
      {
        ...stateBase,
        rendaVariavelMensalOficial: [],
        rendaVariavelMensalManual: [ficha(9, -500)],
      },
      '2025-01-01', '2025-12-31',
    );
    expect(semManual.rendaVariavelPerda).toBe(0);
    expect(comManual.rendaVariavelPerda).toBeCloseTo(-500, 2);
    expect(comManual.saldoDeCaixa).toBeCloseTo(semManual.saldoDeCaixa - 500, 2);
  });

  test('mês manual no MESMO mês do oficial substitui (mesclagem), nunca soma os dois — sem duplicar a perda', () => {
    const stateBase = {
      bens: [], dividas: [], dividasRurais: [], rendimentos: [], pagamentos: [], pagamentosDiversos: [],
      lancamentosRurais: [], receitasDespesasRuraisOficial: [], anoCalendario: 2025,
      doacoesEfetuadasOficial: [], doacoesPartidosOficial: [], doacoesEcaIdosoOficial: [],
      rendaVariavelMensalOficial: [ficha(9, -100)], // oficial: perda de 100
      rendaVariavelMensalManual: [ficha(9, -500)], // manual corrige pra 500
    };
    const demo = demonstrativoConciliacao(stateBase, '2025-01-01', '2025-12-31');
    expect(demo.rendaVariavelPerda).toBeCloseTo(-500, 2); // só o manual, não -600
  });
});

describe('achado 15: contagem de bens usa o mesmo critério da tela de Bens', () => {
  test('bem zerado sem movimentação não conta', () => {
    expect(bemZeradoSemMovimentacaoNoAno({ situacao_anterior: 0, situacao_atual: 0, movimentacoes: [] })).toBe(true);
    expect(bemZeradoSemMovimentacaoNoAno({ situacao_anterior: 0, situacao_atual: 0, movimentacoes: [{ tipo: 'venda_total' }] })).toBe(false);
    expect(bemZeradoSemMovimentacaoNoAno({ situacao_anterior: 100, situacao_atual: 0, movimentacoes: [] })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// VENDA LIDA DA DISCRIMINAÇÃO DO BEM.
//
// Os textos daqui reproduzem a declaração de referência B (exercício 2026),
// incluindo a pontuação estranha ("102.040,92.*ATE A DATA") que é justamente o
// que o parser precisa aguentar. Nome e CPF das contrapartes foram trocados
// por sentinelas: são pessoas reais que não têm relação com este projeto, e
// nenhuma asserção depende deles. NÃO reponha os originais.
// São eles que valem R$ 108.332,92 na aba VAR PATRIMONIAL2025 da planilha da
// usuária e que o app não conseguia enxergar.
describe('venda escrita na discriminação do bem', () => {
  const AUDI = 'AQUISICAO DE UM VEICULO Q3-AUDI, 2023/2024, PRETO, POR R$ 353.690,00, DE CONCESSIONARIA SENTINELA LTDA, '
    + '55.566.677/0001-83, EM 11/04/2024, SENDO R$ 161.955,00 + 50.259,00 A VISTA E O RESTANTE FINANCIADO EM 24X. '
    + 'VENDIDO EM 27/11/2025 POR R$ 226.200,00 COM APURACAO DE PERDA DE R$ 102.040,92.*ATE A DATA DA VENDA, FOI PAGO O MONTANTE DE 328.240,92.';
  const RAM = 'AQUISICAO DE UM VEICULO RAMPAGE TDD2H22, DE FCA FIAT CHRYSLER AUTOMOVEIS, EM 28/11/2024, MAIS ACESSORIOS. '
    + 'VENDIDA EM 15/12/2025 POR R$ 220.000,00 PARA COMPRADOR RAM SENTINELA 111.444.777-35, COM APURACAO DE PERDA DE 6.292,00.';
  const UNO = 'AQUISICAO DE UM VEICULO FIAT/UNO PLACA LPX9E43, 2011/2012, AZUL, DE VENDEDOR UNO SENTINELA 222.333.444-05, '
    + 'EM 16/10/23. VENDIDO EM 01/03/2025 A COMPRADOR UNO SENTINELA 333.444.555-08 PELO VALOR R$ 18.000,00. PARCELADO DE 9X DE R$ 2.000,00.';
  const MILLE = 'AQUISICAO DE UM VEICULO FIAT UNO MILLE WAY HJT-9373, EM 16/09/2014 DE VENDEDORA MILLE SENTINELA 444.555.666-19. '
    + 'VENDIDO EM 08/02/2024 A COMPRADOR MILLE SENTINELA, 555.666.777-20, POR 11.500,00 DIVIDIDO DE 22X, SENDO A 1A PARC DE R$1.000,00 '
    + 'E AS DEMAIS DE RR$ 500,00. FINALIZOU O PAGAMENTO EM 21/05/2025';

  test('lê data, preço e a perda que o próprio contribuinte apurou', () => {
    expect(vendaLidaDaDiscriminacao(AUDI, 261067.44)).toEqual({
      data: '2025-11-27', valorVenda: 226200, ganho: -102040.92, custo: 328240.92, baseCusto: 'perda declarada no texto',
    });
    expect(vendaLidaDaDiscriminacao(RAM, 226292)).toMatchObject({ data: '2025-12-15', valorVenda: 220000, ganho: -6292 });
  });

  test('a perda declarada vence a conta pela situação do início do ano', () => {
    // Esta é a razão de ler o texto em vez de subtrair: o Audi foi financiado
    // em 24x, e a conta "preço menos situação em 31/12/2024" daria
    // -34.867,44, não os -102.040,92 reais (o custo inclui as parcelas pagas
    // em 2025). Errar aqui seria errar R$ 67 mil no Saldo de Caixa.
    const lido = vendaLidaDaDiscriminacao(AUDI, 261067.44);
    expect(lido.ganho).toBeCloseTo(-102040.92, 2);
    expect(226200 - 261067.44).toBeCloseTo(-34867.44, 2);
  });

  test('"PARCELADO DE 9X DE R$ 2.000,00" não vira o preço da venda', () => {
    expect(vendaLidaDaDiscriminacao(UNO, 21000)).toMatchObject({ valorVenda: 18000, ganho: -3000 });
  });

  test('o valor de AQUISIÇÃO citado antes da venda não é lido como preço', () => {
    // O texto do Audi começa com "POR R$ 353.690,00" (a compra). O preço só
    // pode ser procurado DEPOIS do "VENDIDO EM".
    expect(vendaLidaDaDiscriminacao(AUDI, 261067.44).valorVenda).toBe(226200);
  });

  test('sem data de venda, ou sem preço, não lê nada', () => {
    expect(vendaLidaDaDiscriminacao('AQUISICAO DE UM VEICULO X POR R$ 50.000,00 EM 11/04/2024', 50000)).toBeNull();
    expect(vendaLidaDaDiscriminacao('VENDIDO EM 27/11/2025 PARA FULANO DE TAL', 50000)).toBeNull();
    expect(vendaLidaDaDiscriminacao('', 0)).toBeNull();
    expect(vendaLidaDaDiscriminacao(null, 0)).toBeNull();
  });

  test('sem perda nem montante no texto, cai para o custo do início do período', () => {
    const lido = vendaLidaDaDiscriminacao('VENDIDO EM 10/05/2025 POR R$ 30.000,00', 50000);
    expect(lido).toMatchObject({ ganho: -20000, baseCusto: 'custo declarado no início do período' });
  });

  const bemComTexto = (discriminacao, situacao_anterior) => ({
    id: 1, grupo: '02', discriminacao, situacao_anterior, situacao_atual: 0, movimentacoes: [],
  });

  test('entra no demonstrativo e some da lista de pendências', () => {
    const dados = { bens: [bemComTexto(AUDI, 261067.44), bemComTexto(RAM, 226292)], apuracaoGanhoCapital: [] };
    const g = ganhosApuradosPeriodo(dados, '2025-01-01', '2025-12-31');
    expect(g.total).toBeCloseTo(-108332.92, 2);
    expect(g.vendas.every(v => v.daDiscriminacao)).toBe(true);
    expect(bensAlienadosSemValorDeVenda(dados, '2025-01-01', '2025-12-31')).toHaveLength(0);
  });

  test('venda de outro ano não entra no período, e a pendência explica por quê', () => {
    // O Mille foi vendido em 08/02/2024 e só quitou em 2025: o bem sai do
    // patrimônio agora, mas o ganho pertence ao ano da alienação.
    const dados = { bens: [bemComTexto(MILLE, 7826.15)], apuracaoGanhoCapital: [] };
    expect(vendasDaDiscriminacaoPeriodo(dados, '2025-01-01', '2025-12-31')).toEqual([]);
    const p = bensAlienadosSemValorDeVenda(dados, '2025-01-01', '2025-12-31');
    expect(p).toHaveLength(1);
    expect(p[0].vendaForaDoPeriodo).toBe('2024-02-08');
    expect(p[0].valorVendaForaDoPeriodo).toBe(11500);
  });

  test('não duplica o que já veio na Apuração do Ganho de Capital', () => {
    const dados = {
      bens: [bemComTexto(UNO, 21000)],
      apuracaoGanhoCapital: [{ bem: 'FIAT/UNO PLACA LPX9E43', dataAlienacao: '2025-03-01', custoAquisicao: 21000, valorAlienacao: 18000 }],
    };
    const g = ganhosApuradosPeriodo(dados, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(1);
    expect(g.total).toBeCloseTo(-3000, 2);
  });

  test('não duplica o que a usuária já lançou à mão', () => {
    const bem = { ...bemComTexto(AUDI, 261067.44), movimentacoes: [{ id: 9, tipo: 'venda_total', valor: 328240.92, valorVenda: 226200, data: '2025-11-27' }] };
    const g = ganhosApuradosPeriodo({ bens: [bem], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(1);
    expect(g.vendas[0].daDiscriminacao).toBeUndefined();
    expect(g.total).toBeCloseTo(-102040.92, 2);
  });

  test('resgate de aplicação não é lido como venda, mesmo com texto parecido', () => {
    // Grupos 04 a 07 já são dinheiro: uma redução ali é saque, não venda de
    // bem por preço. O filtro que existia para o aviso vale também aqui.
    const conta = { id: 2, grupo: '06', discriminacao: 'CONTA CORRENTE. VENDIDO EM 10/05/2025 POR R$ 1.000,00', situacao_anterior: 5000, situacao_atual: 0, movimentacoes: [] };
    expect(vendasDaDiscriminacaoPeriodo({ bens: [conta], apuracaoGanhoCapital: [] }, '2025-01-01', '2025-12-31')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Conferência criada em 24/08/2026 depois que a conciliação de um ano real
// mostrou 97.706,33 de rendimento de LCI declarado no código de lucros e
// dividendos, e outros 4.488,60 lançados a menor na planilha da usuária.
describe('aplicacoesResgatadasSemRendimento', () => {
  const lci = (extra = {}) => ({
    id: 1, grupo: '04', codigo_bem: '03', cnpj: '02335109000105',
    discriminacao: 'SICOOB LCI - CONTA 243914',
    situacao_anterior: 483154.01, situacao_atual: 0, movimentacoes: [], ...extra,
  });
  const periodo = ['2025-01-01', '2025-12-31'];

  test('acusa a LCI resgatada sem rendimento do código 12, e mostra o que a mesma fonte pagou em outra ficha', () => {
    const dados = {
      bens: [lci()],
      rendimentos: [
        { tipo: 'isento_0009', cnpj_fonte: '02335109000105', nome_fonte: 'COOP DE CREDITO', valor: 102194.93, data: '2025-12-31' },
        { tipo: 'isento_0012', cnpj_fonte: '00360305000104', nome_fonte: 'CAIXA', valor: 1474.24, data: '2025-12-31' },
      ],
    };
    const r = aplicacoesResgatadasSemRendimento(dados, ...periodo);
    expect(r).toHaveLength(1);
    expect(r[0].valorResgatado).toBeCloseTo(483154.01, 2);
    expect(r[0].cnpj).toBe('02335109000105');
    expect(r[0].onde).toMatch(/código 12/);
    expect(r[0].outrosDaMesmaFonte).toEqual([
      { tipo: 'isento_0009', nome: 'COOP DE CREDITO', valor: 102194.93 },
    ]);
  });

  test('cala quando o rendimento da própria fonte está na ficha certa', () => {
    const dados = {
      bens: [lci()],
      rendimentos: [{ tipo: 'isento_0012', cnpj_fonte: '02335109000105', valor: 60000, data: '2025-12-31' }],
    };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('o código do tipo vale pelo número, com duas ou com quatro casas', () => {
    const dados = {
      bens: [lci()],
      rendimentos: [{ tipo: 'isento_12', cnpj_fonte: '02335109000105', valor: 60000, data: '2025-12-31' }],
    };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('título tributado (código 02 do bem) espera a ficha de tributação exclusiva, não a de isentos', () => {
    const cdb = lci({ codigo_bem: '02', discriminacao: 'CDB BANCO X' });
    const comIsento = { bens: [cdb], rendimentos: [{ tipo: 'isento_0012', cnpj_fonte: '02335109000105', valor: 900, data: '2025-12-31' }] };
    expect(aplicacoesResgatadasSemRendimento(comIsento, ...periodo)).toHaveLength(1);
    const comExclusivo = { bens: [cdb], rendimentos: [{ tipo: 'exclusivo_0006', cnpj_fonte: '02335109000105', valor: 900, data: '2025-12-31' }] };
    expect(aplicacoesResgatadasSemRendimento(comExclusivo, ...periodo)).toEqual([]);
  });

  test('não acusa resgate parcial: só o bem que zerou', () => {
    const dados = { bens: [lci({ situacao_atual: 200000 })], rendimentos: [] };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('não acusa valor abaixo do piso de materialidade', () => {
    const dados = { bens: [lci({ situacao_anterior: 122.08 })], rendimentos: [] };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('bem sem CNPJ fica de fora: sem a fonte não há cruzamento', () => {
    const dados = { bens: [lci({ cnpj: '' })], rendimentos: [] };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('ação e ouro ficam de fora: o resultado deles é ganho de renda variável, não rendimento', () => {
    for (const codigo of ['04', '05']) {
      const dados = { bens: [lci({ codigo_bem: codigo })], rendimentos: [] };
      expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
    }
  });

  test('fundo (grupo 07) fica de fora: come-cotas e cota que cai dariam falso positivo', () => {
    const dados = { bens: [lci({ grupo: '07', codigo_bem: '01' })], rendimentos: [] };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toEqual([]);
  });

  test('rendimento de outro período não conta como o rendimento do resgate', () => {
    const dados = {
      bens: [lci()],
      rendimentos: [{ tipo: 'isento_0012', cnpj_fonte: '02335109000105', valor: 60000, data: '2024-12-31' }],
    };
    expect(aplicacoesResgatadasSemRendimento(dados, ...periodo)).toHaveLength(1);
  });
});
