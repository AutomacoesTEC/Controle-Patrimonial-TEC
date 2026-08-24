import { describe, test, expect } from 'vitest';
import { demonstrativoConciliacao } from './demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, anosComDado, movimentacoesNoPeriodo } from './consultaPeriodo';

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

  // Dentro de um ano só (o caso comum, já que o Dashboard abre no
  // ano-calendário selecionado): granularidade mensal, senão o período
  // inteiro virava 1 ponto só (sempre em "Até", ignorando "De") e o gráfico
  // parecia não acompanhar as datas escolhidas.
  test('dentro do mesmo ano, um ponto por mês entre De e Até', () => {
    const s = estadoDoisAnos();
    const pontos = serieEvolucao(s, '2025-01-01', '2025-12-31');
    expect(pontos.length).toBe(13); // 01/01 + 12 fins de mês
    expect(pontos[0].data).toBe('2025-01-01');
    expect(pontos[0].bens).toBe(100000);
    expect(pontos[0].dividas).toBe(50000);
    expect(pontos[pontos.length - 1].data).toBe('2025-12-31');
    expect(pontos[pontos.length - 1].bens).toBe(130000);
    expect(pontos[pontos.length - 1].dividas).toBe(35000);
  });

  test('respeita De/Até exatos, não só fins de mês, e reflete movimentação no meio', () => {
    const s = estadoDoisAnos();
    // benfeitoria em 10/04 soma 30000 ao bem; amortização em 01/03 tira 10000
    // da dívida — período pega os dois.
    const pontos = serieEvolucao(s, '2025-03-15', '2025-04-20');
    expect(pontos[0].data).toBe('2025-03-15');
    expect(pontos[0].bens).toBe(100000);
    expect(pontos[0].dividas).toBe(40000); // já passou a amortização de 01/03
    const ultimo = pontos[pontos.length - 1];
    expect(ultimo.data).toBe('2025-04-20');
    expect(ultimo.bens).toBe(130000); // já passou a benfeitoria de 10/04
    expect(ultimo.dividas).toBe(40000);
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

describe('demonstrativoPeriodo — dívida comum separada de dívida rural (Dashboard exibe as duas em linhas próprias)', () => {
  function estadoComDividaRural() {
    const s = estadoDoisAnos();
    s.dividasRurais = [
      { discriminacao: 'financiamento rural', situacao_anterior: 20000, situacao_atual: 28000, movimentacoes: [] },
    ];
    return s;
  }

  test('separa dividaComum de dividaRural, mas o total combinado continua igual à soma das duas', () => {
    const s = estadoComDividaRural();
    const d = demonstrativoPeriodo(s, '2025-01-01', '2025-12-31');
    expect(d.varPatrimonial.dividaComumDe).toBe(50000);
    expect(d.varPatrimonial.dividaComumAte).toBe(35000);
    expect(d.varPatrimonial.dividaRuralDe).toBe(20000);
    expect(d.varPatrimonial.dividaRuralAte).toBe(28000);
    expect(d.varPatrimonial.dividaDe).toBe(70000); // 50000 + 20000
    expect(d.varPatrimonial.dividaAte).toBe(63000); // 35000 + 28000
    expect(d.varPatrimonial.deltaDivida).toBe(-7000);
  });
});

describe('demonstrativoPeriodo — Doações reduzem o Saldo de Caixa; Renda Variável só sinaliza (sem valor)', () => {
  function estadoComDoacoesERendaVariavel() {
    const s = estadoDoisAnos();
    s.doacoesEfetuadasOficial = [{ id: 1, valor: 1000 }];
    s.doacoesPartidosOficial = [{ id: 1, valor: 500 }];
    s.doacoesEcaIdosoOficial = [{ id: 1, valor: 200 }];
    s.rendaVariavelMensalOficial = [{ mes: 3 }, { mes: 7 }];
    return s;
  }

  test('soma as 3 fichas de doação e reduz o Saldo de Caixa pelo total', () => {
    const semDoacoes = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    const comDoacoes = demonstrativoPeriodo(estadoComDoacoesERendaVariavel(), '2025-01-01', '2025-12-31');
    expect(comDoacoes.totalDoacoes).toBe(1700); // 1000 + 500 + 200
    expect(comDoacoes.saldoDeCaixa).toBe(semDoacoes.saldoDeCaixa - 1700);
  });

  test('lista os meses de Renda Variável sem inventar valor nenhum', () => {
    const d = demonstrativoPeriodo(estadoComDoacoesERendaVariavel(), '2025-01-01', '2025-12-31');
    expect(d.rendaVariavelMeses).toEqual([{ ano: 2025, mes: 3 }, { ano: 2025, mes: 7 }]);
    // Fichas vindas do .DBK não têm valor: o agregado não pode ser exibido
    // como zero, senão a tela afirma "não houve ganho" onde o certo é "não foi
    // possível ler o valor".
    expect(d.rendaVariavelComValor).toBe(false);
    expect(d.rendaVariavelResultado).toBe(0);
  });

  test('sem doações/renda variável no estado, os campos ficam zerados/vazios', () => {
    const d = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    expect(d.totalDoacoes).toBe(0);
    expect(d.rendaVariavelMeses).toEqual([]);
    expect(d.rendaVariavelComValor).toBe(false);
  });
});

// Fichas vindas do PDF trazem os valores. Titular e dependentes são fichas
// SEPARADAS na declaração e podem cobrir o mesmo mês: o mês não pode ser
// listado duas vezes, mas os resultados dos dois somam.
describe('demonstrativoPeriodo — Renda Variável importada por PDF, com valores', () => {
  const ficha = (mes, titular, resultadoComuns, resultadoDay = 0, imposto = 0) => ({
    mes,
    titular,
    cpfDependente: titular ? null : '65578791620',
    comuns: { resultadoLiquidoMes: resultadoComuns, prejuizoCompensar: 0, aliquota: '15%' },
    daytrade: { resultadoLiquidoMes: resultadoDay, prejuizoCompensar: 0, aliquota: '20%' },
    consolidacao: { totalImpostoDevido: imposto },
    origem: 'pdf',
  });

  function estadoComPdf() {
    const s = estadoDoisAnos();
    s.rendaVariavelMensalOficial = [
      ficha(7, true, 1000, 500, 275),
      ficha(7, false, -245.4),
      ficha(8, true, 0),
    ];
    return s;
  }

  test('soma o resultado das duas colunas e das duas fichas do mesmo mês', () => {
    const d = demonstrativoPeriodo(estadoComPdf(), '2025-01-01', '2025-12-31');
    expect(d.rendaVariavelComValor).toBe(true);
    // 1000 + 500 (titular, comuns + day-trade) - 245,40 (dependente).
    expect(d.rendaVariavelResultado).toBeCloseTo(1254.6, 2);
    expect(d.rendaVariavelImposto).toBeCloseTo(275, 2);
  });

  test('o mês coberto por titular e dependente aparece uma vez só na lista', () => {
    const d = demonstrativoPeriodo(estadoComPdf(), '2025-01-01', '2025-12-31');
    expect(d.rendaVariavelMeses).toEqual([{ ano: 2025, mes: 7 }, { ano: 2025, mes: 8 }]);
  });

  test('nada disso entra no Saldo de Caixa nem na Variação Patrimonial (tributação exclusiva)', () => {
    const sem = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    const com = demonstrativoPeriodo(estadoComPdf(), '2025-01-01', '2025-12-31');
    expect(com.saldoDeCaixa).toBe(sem.saldoDeCaixa);
    expect(com.varPatrimonial.total).toBe(sem.varPatrimonial.total);
    expect(com.rendimentos.totalGeral).toBe(sem.rendimentos.totalGeral);
  });
});

describe('movimentacoesNoPeriodo', () => {
  test('lista movimentações de bens dentro do período, com a discriminação do bem', () => {
    const s = estadoDoisAnos();
    const movs = movimentacoesNoPeriodo(s, 'bens', '2025-01-01', '2025-12-31');
    expect(movs).toHaveLength(1);
    expect(movs[0]).toMatchObject({ tipo: 'benfeitoria', valor: 30000, data: '2025-04-10', discriminacao: 'apartamento' });
  });

  test('lista movimentações de dívidas cruzando período mais estreito que o ano inteiro', () => {
    const s = estadoDoisAnos();
    const movs = movimentacoesNoPeriodo(s, 'dividas', '2025-01-01', '2025-06-30');
    expect(movs).toHaveLength(1); // só a amortização de 01/03, a de 01/09 fica de fora
    expect(movs[0].valor).toBe(10000);
  });

  test('sem data de/até, devolve lista vazia em vez de adivinhar', () => {
    expect(movimentacoesNoPeriodo(estadoDoisAnos(), 'bens', '', '')).toEqual([]);
  });
});

// Regressão do achado da auditoria de 21/08/2026, feito com a declaração de um
// segundo contribuinte: a ressalva "layout não confirmado contra dado real"
// aparecia também para doação cadastrada À MÃO, mandando a pessoa conferir na
// declaração original um valor que ela mesma tinha acabado de digitar. A
// ressalva existe porque as 4 fichas de Doações só vêm pelo PDF e o layout
// nunca foi visto com dado real, o que não diz nada sobre cadastro manual.
describe('temDoacaoImportada: a ressalva de layout é só para doação vinda do arquivo', () => {
  const comDoacoes = (lista) => {
    const s = estadoDoisAnos();
    s.doacoesEfetuadasOficial = lista;
    return s;
  };

  test('doação cadastrada à mão não liga a ressalva, mas entra no total', () => {
    const d = demonstrativoPeriodo(comDoacoes([{ valor: 15000, origem: 'manual' }]), '2025-01-01', '2025-12-31');
    expect(d.totalDoacoes).toBe(15000);
    expect(d.temDoacaoImportada).toBe(false);
  });

  test('doação vinda do import liga a ressalva', () => {
    // O import grava a lista sem carimbar `origem`, então ausência de marca
    // conta como importada.
    const d = demonstrativoPeriodo(comDoacoes([{ valor: 15000 }]), '2025-01-01', '2025-12-31');
    expect(d.temDoacaoImportada).toBe(true);
  });

  test('misturando as duas, a ressalva aparece', () => {
    const d = demonstrativoPeriodo(comDoacoes([{ valor: 1000, origem: 'manual' }, { valor: 2000 }]), '2025-01-01', '2025-12-31');
    expect(d.totalDoacoes).toBe(3000);
    expect(d.temDoacaoImportada).toBe(true);
  });

  test('sem doação nenhuma, nada de ressalva', () => {
    const d = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    expect(d.totalDoacoes).toBe(0);
    expect(d.temDoacaoImportada).toBe(false);
  });
});


// A ressalva de "layout não confirmado" das doações vale só para o que veio do
// PDF. Desde 24/08/2026 o `.DBK` também lê essas fichas (registros 34/90/91/92),
// com posições oficiais, e essas não devem carregar a ressalva.
describe('demonstrativoPeriodo — ressalva de layout só para doação vinda do PDF', () => {
  const comDoacao = (extra) => {
    const s = estadoDoisAnos();
    s.doacoesEfetuadasOficial = [{ id: 1, valor: 1000, ...extra }];
    return s;
  };

  test('doação do PDF (sem layoutOficial) marca a ressalva', () => {
    const d = demonstrativoPeriodo(comDoacao({}), '2025-01-01', '2025-12-31');
    expect(d.temDoacaoImportada).toBe(true);
  });

  test('doação do .DBK (layoutOficial) NÃO marca a ressalva', () => {
    const d = demonstrativoPeriodo(comDoacao({ layoutOficial: true }), '2025-01-01', '2025-12-31');
    expect(d.temDoacaoImportada).toBe(false);
    // Mas continua entrando na conta, que é o que importa para o Saldo de Caixa.
    expect(d.totalDoacoes).toBe(1000);
  });

  test('doação cadastrada à mão nunca marca a ressalva', () => {
    const d = demonstrativoPeriodo(comDoacao({ origem: 'manual' }), '2025-01-01', '2025-12-31');
    expect(d.temDoacaoImportada).toBe(false);
  });
});

// Rendimentos Recebidos Acumuladamente entram no demonstrativo porque o
// dinheiro ENTROU no período — que é o que este demonstrativo mede. A opção de
// tributação do contribuinte (na fonte ou no ajuste) muda o cálculo do imposto,
// não o fato de a renda ter sido recebida.
describe('demonstrativoPeriodo — RRA soma nos rendimentos', () => {
  const comRra = () => {
    const s = estadoDoisAnos();
    s.rendimentos = [
      ...s.rendimentos,
      { tipo: 'tributavel_rra', valor: 100000, irrf: 9000, data: '2025-06-15' },
    ];
    return s;
  };

  test('entra em linha própria e soma no total geral', () => {
    const sem = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    const com = demonstrativoPeriodo(comRra(), '2025-01-01', '2025-12-31');
    expect(com.rendimentos.tributavelRra).toBe(100000);
    expect(com.rendimentos.totalGeral).toBe(sem.rendimentos.totalGeral + 100000);
    // E NÃO se mistura com os rendimentos de pessoa jurídica.
    expect(com.rendimentos.tributavelPJ).toBe(sem.rendimentos.tributavelPJ);
  });

  test('respeita o período, como qualquer outro rendimento', () => {
    const d = demonstrativoPeriodo(comRra(), '2025-01-01', '2025-05-31');
    expect(d.rendimentos.tributavelRra).toBe(0);
  });

  test('sem RRA no estado, a linha fica zerada', () => {
    const d = demonstrativoPeriodo(estadoDoisAnos(), '2025-01-01', '2025-12-31');
    expect(d.rendimentos.tributavelRra).toBe(0);
  });
});
