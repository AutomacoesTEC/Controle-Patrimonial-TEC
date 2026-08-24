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
    // Antes da amortização, o saldo é o total contratado.
    expect(situacaoDividaAteData(divida, '2026-08-09', 'ate')).toBe(800000);
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
    expect(situacaoBemAteData(bem, '2026-08-09', 'ate')).toBe(350000);
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
  test('anterior e atual zerados com venda registrada: infere o valor antes da venda', () => {
    const bem = {
      situacao_anterior: 0,
      situacao_atual: 0,
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 100000, data: '2026-06-01' }],
    };
    expect(situacaoBemAteData(bem, '2026-05-31', 'ate')).toBe(100000);
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

  test('lançamento manual tem precedência sobre a apuração importada, sem somar os dois', () => {
    const manuais = [
      { tipo: 'receita', valor: 8000000, data: '2025-07-30' },
      { tipo: 'despesa', valor: 3100000, data: '2025-04-12' },
    ];
    const r = resultadoAtividadeRuralPeriodo(manuais, '2025-01-01', '2025-12-31', { meses: mesesReais, ano: 2025 });
    expect(r).toBe(4900000);
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

  test('venda lançada como movimentação tem precedência, sem somar as duas', () => {
    const bens = [{
      discriminacao: 'AUTOMOVEL',
      movimentacoes: [{ id: 1, tipo: 'venda_total', valor: 100000, valorVenda: 150000, irrfVenda: 7500, data: '2025-05-10' }],
    }];
    const g = ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital: apuracaoReal }, '2025-01-01', '2025-12-31');
    expect(g.vendas).toHaveLength(1);
    expect(g.total).toBe(42500);
    expect(g.daDeclaracao).toBe(false);
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
