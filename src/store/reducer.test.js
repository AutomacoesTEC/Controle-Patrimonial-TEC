import { describe, it, expect } from 'vitest';
import { reducer, initialState } from './reducer';

const bemBase = { id: 1, grupo: '01', codigo_bem: '12', discriminacao: 'Casa', situacao_anterior: 100000, situacao_atual: 130000 };

describe('ADD_TOAST / REMOVE_TOAST', () => {
  it('remove exatamente o toast pelo id do payload, não um id gerado à parte', () => {
    // Bug real: addToast() gerava um id, mas o reducer de ADD_TOAST gerava
    // OUTRO id ao adicionar. O REMOVE_TOAST nunca encontrava o toast certo
    // e o aviso ficava preso na tela para sempre. O contrato correto é: o
    // id do payload de ADD_TOAST é o único id que existe para esse toast.
    let state = { ...initialState, toasts: [] };
    const payload = { id: 12345, message: 'oi', type: 'success' };
    state = reducer(state, { type: 'ADD_TOAST', payload });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe(12345);
    state = reducer(state, { type: 'REMOVE_TOAST', payload: 12345 });
    expect(state.toasts).toHaveLength(0);
  });
});

describe('CRUD de bens/dívidas/rendimentos/pagamentos', () => {
  it('ADD/UPDATE/DELETE_BEM', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_BEM', payload: { discriminacao: 'Carro', situacao_atual: 50000 } });
    expect(state.bens).toHaveLength(1);
    const id = state.bens[0].id;
    state = reducer(state, { type: 'UPDATE_BEM', payload: { id, discriminacao: 'Carro novo', situacao_atual: 60000 } });
    expect(state.bens[0].discriminacao).toBe('Carro novo');
    state = reducer(state, { type: 'DELETE_BEM', payload: id });
    expect(state.bens).toHaveLength(0);
  });

  it('ADD/UPDATE/DELETE_DIVIDA, ADD/UPDATE/DELETE_RENDIMENTO, ADD/UPDATE/DELETE_PAGAMENTO seguem o mesmo padrão', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_DIVIDA', payload: { discriminacao: 'Financiamento', situacao_atual: 1000 } });
    state = reducer(state, { type: 'ADD_RENDIMENTO', payload: { tipo: 'tributavel_pj', valor: 500 } });
    state = reducer(state, { type: 'ADD_PAGAMENTO', payload: { codigo: '21', valor_pago: 200 } });
    expect(state.dividas).toHaveLength(1);
    expect(state.rendimentos).toHaveLength(1);
    expect(state.pagamentos).toHaveLength(1);

    state = reducer(state, { type: 'DELETE_DIVIDA', payload: state.dividas[0].id });
    state = reducer(state, { type: 'DELETE_RENDIMENTO', payload: state.rendimentos[0].id });
    state = reducer(state, { type: 'DELETE_PAGAMENTO', payload: state.pagamentos[0].id });
    expect(state.dividas).toHaveLength(0);
    expect(state.rendimentos).toHaveLength(0);
    expect(state.pagamentos).toHaveLength(0);
  });
});

describe('REGISTRAR_MOVIMENTACAO_BEM', () => {
  const registrar = (state, tipo, valor) =>
    reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM', payload: { bemId: 1, movimentacao: { tipo, valor, data: '2026-05-01', descricao: 'teste' } } });

  it('compra e benfeitoria somam ao valor atual', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'compra', 10000);
    expect(state.bens[0].situacao_atual).toBe(140000);
    state = registrar(state, 'benfeitoria', 5000);
    expect(state.bens[0].situacao_atual).toBe(145000);
    expect(state.bens[0].movimentacoes).toHaveLength(2);
  });

  it('venda parcial subtrai sem passar de zero', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'venda_parcial', 200000); // maior que o valor atual (130000)
    expect(state.bens[0].situacao_atual).toBe(0); // nunca negativo
  });

  it('venda total e baixa zeram o valor', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'venda_total', 0);
    expect(state.bens[0].situacao_atual).toBe(0);

    state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'baixa', 0);
    expect(state.bens[0].situacao_atual).toBe(0);
  });

  it('ajuste substitui o valor direto', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'ajuste', 999);
    expect(state.bens[0].situacao_atual).toBe(999);
  });

  it('não mexe em outros bens nem some com o outro bem por engano', () => {
    let state = { ...initialState, bens: [{ ...bemBase }, { ...bemBase, id: 2, situacao_atual: 5000 }] };
    state = registrar(state, 'compra', 1000);
    expect(state.bens[0].situacao_atual).toBe(131000);
    expect(state.bens[1].situacao_atual).toBe(5000);
  });
});

describe('ROLLOVER_ANO (virada de ano, é o propósito central do app)', () => {
  it('traz situacao_atual do ano corrente como situacao_anterior do ano novo', () => {
    let state = { ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }], contribuinte: { nome: 'x' } };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.anoCalendario).toBe(2026);
    expect(state.bens[0].situacao_anterior).toBe(130000);
    expect(state.bens[0].situacao_atual).toBe(130000); // começa igual, até uma movimentação real
    expect(state.historico[2025].bens[0].situacao_atual).toBe(130000); // ano antigo arquivado intacto
  });

  it('rendimentos e pagamentos zeram no ano novo (são fluxo do período, não saldo)', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      bens: [{ ...bemBase }], rendimentos: [{ id: 1, tipo: 'tributavel_pj', valor: 100 }], pagamentos: [{ id: 1, valor_pago: 50 }],
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.rendimentos).toHaveLength(0);
    expect(state.pagamentos).toHaveLength(0);
  });

  it('rolar para um ano que já tem histórico salvo carrega o histórico, não sobrescreve com rollover', () => {
    let state = {
      ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }],
      historico: { 2026: { bens: [{ id: 77, situacao_atual: 999 }], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null, savedAt: 'x' } },
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.bens[0].id).toBe(77);
    expect(state.bens[0].situacao_atual).toBe(999);
  });

  it('ciclo completo ida e volta não perde nem contamina dado (2025 -> 2026 -> edição -> 2027 -> volta a 2025)', () => {
    let state = { ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }], contribuinte: { nome: 'declarante 1' } };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    // durante 2026, vende o bem inteiro
    state = { ...state, bens: state.bens.map(b => ({ ...b, situacao_atual: 0 })) };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2027 });
    expect(state.bens[0].situacao_anterior).toBe(0); // 2027 nasce já refletindo a venda de 2026
    expect(state.historico[2026].bens[0].situacao_atual).toBe(0);

    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2025 });
    expect(state.bens[0].situacao_atual).toBe(130000); // 2025 volta intacto do histórico
  });
});

describe('IMPORT_DECLARACAO (import atômico com ano detectado no arquivo)', () => {
  it('troca de ano automaticamente quando o arquivo importado traz um ano diferente do corrente', () => {
    let state = { ...initialState, anoCalendario: 2024, bens: [{ ...bemBase, id: 1 }] };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: { nome: 'declarante 1' }, bens: [{ id: 9, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(state.anoCalendario).toBe(2025);
    expect(state.bens[0].id).toBe(9);
    expect(state.historico[2024].bens[0].id).toBe(1); // 2024 foi arquivado, não perdido
  });

  it('categoria vazia no import não apaga o que já existia no MESMO ano (ex.: PDF sem rendimentos)', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      bens: [{ ...bemBase }], rendimentos: [{ id: 1, tipo: 'tributavel_pj', valor: 100 }],
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: null, bens: [{ id: 2, situacao_atual: 2 }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(state.bens[0].id).toBe(2); // bens substituídos, o import trouxe bens
    expect(state.rendimentos).toHaveLength(1); // rendimentos preservados, o import não trouxe nenhum
  });

  it('sem ano-calendário detectado no arquivo, mantém o ano corrente', () => {
    let state = { ...initialState, anoCalendario: 2025, bens: [] };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: null, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(state.anoCalendario).toBe(2025);
  });

  it('trocar de ano pelo import zera bens rurais/despesas gerais do ano antigo (o import não cobre isso, não pode vazar pro ano novo)', () => {
    let state = {
      ...initialState, anoCalendario: 2024,
      bensRurais: [{ id: 1, discriminacao: 'Trator 2024' }],
      pagamentosDiversos: [{ id: 1, descricao: 'Cartão 2024' }],
      imoveisRurais: [{ id: 1, nomeLocalizacao: 'Fazenda X' }],
      prejuizoRuralAcompensar: -500,
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 9, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(state.bensRurais).toHaveLength(0);
    expect(state.pagamentosDiversos).toHaveLength(0);
    // imóveis explorados e prejuízo a compensar atravessam anos, esses continuam
    expect(state.imoveisRurais).toHaveLength(1);
    expect(state.prejuizoRuralAcompensar).toBe(-500);
  });
});

describe('DELETE_HISTORICO_ANO (excluir declaração importada/salva)', () => {
  it('remove um ano arquivado que não é o corrente, sem afetar a tela', () => {
    let state = {
      ...initialState, anoCalendario: 2026, bens: [{ ...bemBase }],
      historico: { 2025: { bens: [], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null, savedAt: 'x' } },
    };
    state = reducer(state, { type: 'DELETE_HISTORICO_ANO', payload: 2025 });
    expect(state.historico[2025]).toBeUndefined();
    expect(state.bens).toHaveLength(1); // ano corrente intocado
  });

  it('excluir o ano corrente também limpa a tela, senão fica um ano fantasma', () => {
    let state = { ...initialState, anoCalendario: 2026, bens: [{ ...bemBase }], historico: {} };
    state = reducer(state, { type: 'DELETE_HISTORICO_ANO', payload: 2026 });
    expect(state.bens).toHaveLength(0);
  });
});

describe('SWITCH_ANO (seletor de ano da sidebar)', () => {
  it('arquiva o ano corrente antes de trocar para um ano sem histórico (começa em branco)', () => {
    let state = { ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }] };
    state = reducer(state, { type: 'SWITCH_ANO', payload: 2026 });
    expect(state.anoCalendario).toBe(2026);
    expect(state.bens).toHaveLength(0);
    expect(state.historico[2025].bens[0].id).toBe(1);
  });

  it('trocar para o mesmo ano não faz nada', () => {
    const state = { ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }] };
    const result = reducer(state, { type: 'SWITCH_ANO', payload: 2025 });
    expect(result).toBe(state); // mesma referência: reducer não gerou um novo objeto à toa
  });
});

describe('Ganhos de Capital: valorVenda na movimentação de bem', () => {
  it('venda parcial/total guarda valorVenda junto da movimentação, sem afetar o cálculo de situacao_atual', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = reducer(state, {
      type: 'REGISTRAR_MOVIMENTACAO_BEM',
      payload: { bemId: 1, movimentacao: { tipo: 'venda_parcial', valor: 30000, valorVenda: 45000, data: '2025-06-01', descricao: 'venda 1/4' } },
    });
    // situacao_atual só reage ao `valor` (parcela do custo), não ao valorVenda
    expect(state.bens[0].situacao_atual).toBe(100000);
    expect(state.bens[0].movimentacoes[0].valorVenda).toBe(45000);
  });
});

describe('Atividade Rural', () => {
  it('ADD/UPDATE/DELETE_IMOVEL_RURAL', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_IMOVEL_RURAL', payload: { nomeLocalizacao: 'Fazenda X', area: 100, participacao: 100 } });
    expect(state.imoveisRurais).toHaveLength(1);
    const id = state.imoveisRurais[0].id;
    state = reducer(state, { type: 'UPDATE_IMOVEL_RURAL', payload: { id, nomeLocalizacao: 'Fazenda X Y', area: 100, participacao: 100 } });
    expect(state.imoveisRurais[0].nomeLocalizacao).toBe('Fazenda X Y');
    state = reducer(state, { type: 'DELETE_IMOVEL_RURAL', payload: id });
    expect(state.imoveisRurais).toHaveLength(0);
  });

  it('ADD/UPDATE/DELETE_BEM_RURAL e REGISTRAR_MOVIMENTACAO_BEM_RURAL reaproveitam a mesma lógica de bens comuns', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_BEM_RURAL', payload: { discriminacao: 'Trator', situacao_anterior: 30000, situacao_atual: 30000 } });
    const id = state.bensRurais[0].id;
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM_RURAL', payload: { bemId: id, movimentacao: { tipo: 'benfeitoria', valor: 5000, data: '2025-03-01', descricao: 'reforma' } } });
    expect(state.bensRurais[0].situacao_atual).toBe(35000);
    state = reducer(state, { type: 'DELETE_BEM_RURAL', payload: id });
    expect(state.bensRurais).toHaveLength(0);
  });

  it('ADD/UPDATE/DELETE_LANCAMENTO_RURAL', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_LANCAMENTO_RURAL', payload: { tipo: 'receita', valor: 1000, data: '2025-01-10', descricao: 'venda de milho' } });
    expect(state.lancamentosRurais).toHaveLength(1);
    const id = state.lancamentosRurais[0].id;
    state = reducer(state, { type: 'DELETE_LANCAMENTO_RURAL', payload: id });
    expect(state.lancamentosRurais).toHaveLength(0);
  });

  it('AJUSTAR_PREJUIZO_RURAL soma (prejuízo, negativo) ou subtrai (compensação, positivo) o saldo', () => {
    let state = { ...initialState, prejuizoRuralAcompensar: -1000 };
    state = reducer(state, { type: 'AJUSTAR_PREJUIZO_RURAL', payload: -500 }); // mais prejuízo
    expect(state.prejuizoRuralAcompensar).toBe(-1500);
    state = reducer(state, { type: 'AJUSTAR_PREJUIZO_RURAL', payload: 1500 }); // compensou tudo
    expect(state.prejuizoRuralAcompensar).toBe(0);
  });

  it('ROLLOVER_ANO: resultado rural negativo do ano vira prejuízo a compensar; positivo não mexe no saldo sozinho', () => {
    let state = {
      ...initialState, anoCalendario: 2025, prejuizoRuralAcompensar: -1000,
      lancamentosRurais: [{ id: 1, tipo: 'receita', valor: 1000 }, { id: 2, tipo: 'despesa', valor: 4000 }], // resultado = -3000
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.prejuizoRuralAcompensar).toBe(-4000); // -1000 + (-3000)
    expect(state.lancamentosRurais).toHaveLength(0); // fluxo do ano zera

    let state2 = {
      ...initialState, anoCalendario: 2025, prejuizoRuralAcompensar: -1000,
      lancamentosRurais: [{ id: 1, tipo: 'receita', valor: 5000 }, { id: 2, tipo: 'despesa', valor: 1000 }], // resultado = +4000 (lucro)
    };
    state2 = reducer(state2, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state2.prejuizoRuralAcompensar).toBe(-1000); // lucro não abate sozinho, precisa de AJUSTAR_PREJUIZO_RURAL
  });

  it('ROLLOVER_ANO: bens rurais viram situação anterior igual ao resto do app; imóveis explorados continuam os mesmos', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      bensRurais: [{ id: 1, discriminacao: 'Trator', situacao_anterior: 30000, situacao_atual: 35000 }],
      imoveisRurais: [{ id: 1, nomeLocalizacao: 'Fazenda X' }],
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.bensRurais[0].situacao_anterior).toBe(35000);
    expect(state.bensRurais[0].situacao_atual).toBe(35000);
    expect(state.imoveisRurais).toHaveLength(1); // não reseta: continua explorando a mesma fazenda
  });
});

describe('Pagamentos Diversos (não é ficha da declaração, é controle de gasto geral)', () => {
  it('ADD/UPDATE/DELETE_PAGAMENTO_DIVERSO', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_PAGAMENTO_DIVERSO', payload: { descricao: 'Cartão de crédito', valor: 1000 } });
    expect(state.pagamentosDiversos).toHaveLength(1);
    const id = state.pagamentosDiversos[0].id;
    state = reducer(state, { type: 'UPDATE_PAGAMENTO_DIVERSO', payload: { id, descricao: 'Cartão de crédito Nubank', valor: 1000 } });
    expect(state.pagamentosDiversos[0].descricao).toBe('Cartão de crédito Nubank');
    state = reducer(state, { type: 'DELETE_PAGAMENTO_DIVERSO', payload: id });
    expect(state.pagamentosDiversos).toHaveLength(0);
  });

  it('ROLLOVER_ANO zera pagamentos diversos (é fluxo do ano, não saldo)', () => {
    let state = { ...initialState, anoCalendario: 2025, pagamentosDiversos: [{ id: 1, descricao: 'x', valor: 100 }] };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.pagamentosDiversos).toHaveLength(0);
  });
});
