import { describe, it, expect, vi } from 'vitest';
import { reducer, reducerComHistorico, initialState, blankYear, hasWorkingData, snapshotHasData, novoId } from './reducer';

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

  it('ADD/UPDATE/DELETE das 3 fichas de Doações (cadastro manual, pedido da usuária: "e se eu precisar incluir?")', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_DOACAO_EFETUADA', payload: { codigo: '40', nome_beneficiario: 'Instituto X', valor: 1000 } });
    state = reducer(state, { type: 'ADD_DOACAO_PARTIDO', payload: { codigo: '90', nome_beneficiario: 'Partido Y', valor: 500 } });
    state = reducer(state, { type: 'ADD_DOACAO_ECA_IDOSO', payload: { codigo: '81', nome_beneficiario: 'Fundo Z', valor: 200, categoria: 'eca' } });
    expect(state.doacoesEfetuadasOficial).toHaveLength(1);
    expect(state.doacoesPartidosOficial).toHaveLength(1);
    expect(state.doacoesEcaIdosoOficial).toHaveLength(1);
    expect(state.doacoesEfetuadasOficial[0].origem).toBe('manual');

    const idEf = state.doacoesEfetuadasOficial[0].id;
    state = reducer(state, { type: 'UPDATE_DOACAO_EFETUADA', payload: { id: idEf, valor: 1500 } });
    expect(state.doacoesEfetuadasOficial[0].valor).toBe(1500);

    state = reducer(state, { type: 'DELETE_DOACAO_EFETUADA', payload: idEf });
    state = reducer(state, { type: 'DELETE_DOACAO_PARTIDO', payload: state.doacoesPartidosOficial[0].id });
    state = reducer(state, { type: 'DELETE_DOACAO_ECA_IDOSO', payload: state.doacoesEcaIdosoOficial[0].id });
    expect(state.doacoesEfetuadasOficial).toHaveLength(0);
    expect(state.doacoesPartidosOficial).toHaveLength(0);
    expect(state.doacoesEcaIdosoOficial).toHaveLength(0);
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

describe('DELETE_MOVIMENTACAO_BEM (corrigir um lançamento errado sem excluir o bem inteiro)', () => {
  const registrar = (state, tipo, valor, data = '2026-05-01') =>
    reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM', payload: { bemId: 1, movimentacao: { tipo, valor, data, descricao: 'teste' } } });
  const excluir = (state, movId) =>
    reducer(state, { type: 'DELETE_MOVIMENTACAO_BEM', payload: { bemId: 1, movId } });

  it('excluir a única movimentação recalcula preservando o salto sem data (bemBase já tem 100000->130000 sem nenhuma movimentação)', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'compra', 10000);
    expect(state.bens[0].situacao_atual).toBe(140000);
    const movId = state.bens[0].movimentacoes[0].id;
    state = excluir(state, movId);
    expect(state.bens[0].movimentacoes).toHaveLength(0);
    // Bug real que essa correção evita: recalcular do zero a partir de
    // situacao_anterior (sem o salto) devolveria 100000, apagando de quebra
    // os 30000 que já vinham do cadastro/import, antes de qualquer
    // movimentação existir.
    expect(state.bens[0].situacao_atual).toBe(130000);
  });

  it('excluir uma entre duas movimentações mantém só o efeito da que ficou', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = registrar(state, 'compra', 10000, '2026-03-01');
    state = registrar(state, 'benfeitoria', 5000, '2026-06-01');
    expect(state.bens[0].situacao_atual).toBe(145000);
    const idCompra = state.bens[0].movimentacoes.find(m => m.tipo === 'compra').id;
    state = excluir(state, idCompra);
    expect(state.bens[0].movimentacoes).toHaveLength(1);
    expect(state.bens[0].movimentacoes[0].tipo).toBe('benfeitoria');
    expect(state.bens[0].situacao_atual).toBe(135000); // 130000 (salto) + 5000 (benfeitoria que sobrou)
  });

  it('excluir não mexe em outro bem', () => {
    let state = { ...initialState, bens: [{ ...bemBase }, { ...bemBase, id: 2, situacao_atual: 5000 }] };
    state = registrar(state, 'compra', 10000);
    const movId = state.bens[0].movimentacoes[0].id;
    state = excluir(state, movId);
    expect(state.bens[1].situacao_atual).toBe(5000);
    expect(state.bens[1].movimentacoes || []).toHaveLength(0);
  });
});

describe('DELETE_MOVIMENTACAO_BEM_RURAL e DELETE_MOVIMENTACAO_DIVIDA (mesma mecânica, outras coleções)', () => {
  it('bem rural: exclui e recalcula preservando o salto sem data', () => {
    let state = { ...initialState, bensRurais: [{ ...bemBase }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM_RURAL', payload: { bemId: 1, movimentacao: { tipo: 'compra', valor: 20000, data: '2026-04-01' } } });
    expect(state.bensRurais[0].situacao_atual).toBe(150000);
    const movId = state.bensRurais[0].movimentacoes[0].id;
    state = reducer(state, { type: 'DELETE_MOVIMENTACAO_BEM_RURAL', payload: { bemId: 1, movId } });
    expect(state.bensRurais[0].movimentacoes).toHaveLength(0);
    expect(state.bensRurais[0].situacao_atual).toBe(130000);
  });

  it('dívida: exclui uma amortização e o saldo devedor volta a subir', () => {
    const dividaBase = { id: 1, discriminacao: 'Financiamento', situacao_anterior: 50000, situacao_atual: 50000 };
    let state = { ...initialState, dividas: [{ ...dividaBase }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_DIVIDA', payload: { bemId: 1, movimentacao: { tipo: 'amortizacao', valor: 15000, data: '2026-07-01' } } });
    expect(state.dividas[0].situacao_atual).toBe(35000);
    const movId = state.dividas[0].movimentacoes[0].id;
    state = reducer(state, { type: 'DELETE_MOVIMENTACAO_DIVIDA', payload: { bemId: 1, movId } });
    expect(state.dividas[0].movimentacoes).toHaveLength(0);
    expect(state.dividas[0].situacao_atual).toBe(50000);
  });
});

describe('UPDATE_MOVIMENTACAO_BEM/_BEM_RURAL/_DIVIDA (corrige um lançamento errado sem excluir e recriar)', () => {
  it('corrige o valor de uma movimentação de bem, mantendo o id e recalculando', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM', payload: { bemId: 1, movimentacao: { tipo: 'compra', valor: 10000, data: '2026-05-01', descricao: 'errado' } } });
    expect(state.bens[0].situacao_atual).toBe(140000);
    const movId = state.bens[0].movimentacoes[0].id;
    state = reducer(state, {
      type: 'UPDATE_MOVIMENTACAO_BEM',
      payload: { bemId: 1, movId, movimentacao: { tipo: 'compra', valor: 25000, data: '2026-05-02', descricao: 'corrigido' } },
    });
    expect(state.bens[0].movimentacoes).toHaveLength(1); // não duplica, edita no lugar
    expect(state.bens[0].movimentacoes[0].id).toBe(movId); // id não muda
    expect(state.bens[0].movimentacoes[0].descricao).toBe('corrigido');
    expect(state.bens[0].situacao_atual).toBe(155000); // 130000 (salto) + 25000 (valor corrigido)
  });

  it('corrigir o valor de venda de uma movimentação já registrada muda o ganho apurado (reflexo direto em Ganhos de Capital)', () => {
    let state = { ...initialState, bens: [{ ...bemBase }] };
    state = reducer(state, {
      type: 'REGISTRAR_MOVIMENTACAO_BEM',
      payload: { bemId: 1, movimentacao: { tipo: 'venda_parcial', valor: 50000, valorVenda: 60000, data: '2026-05-01' } },
    });
    const movId = state.bens[0].movimentacoes[0].id;
    // Ganho antes da correção: 60000 - 50000 = 10000.
    expect(state.bens[0].movimentacoes[0].valorVenda - state.bens[0].movimentacoes[0].valor).toBe(10000);
    // Usuária digitou o valor de venda errado, corrige pra 90000.
    state = reducer(state, {
      type: 'UPDATE_MOVIMENTACAO_BEM',
      payload: { bemId: 1, movId, movimentacao: { tipo: 'venda_parcial', valor: 50000, valorVenda: 90000, data: '2026-05-01' } },
    });
    expect(state.bens[0].movimentacoes[0].valorVenda - state.bens[0].movimentacoes[0].valor).toBe(40000);
    expect(state.bens[0].situacao_atual).toBe(80000); // 130000 (salto) - 50000 (custo baixado, inalterado)
  });

  it('bem rural: UPDATE_MOVIMENTACAO_BEM_RURAL recalcula na coleção certa', () => {
    let state = { ...initialState, bensRurais: [{ ...bemBase }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM_RURAL', payload: { bemId: 1, movimentacao: { tipo: 'compra', valor: 20000, data: '2026-04-01' } } });
    const movId = state.bensRurais[0].movimentacoes[0].id;
    state = reducer(state, { type: 'UPDATE_MOVIMENTACAO_BEM_RURAL', payload: { bemId: 1, movId, movimentacao: { tipo: 'compra', valor: 5000, data: '2026-04-01' } } });
    expect(state.bensRurais[0].situacao_atual).toBe(135000); // 130000 + 5000
  });

  it('dívida: UPDATE_MOVIMENTACAO_DIVIDA recalcula o saldo devedor', () => {
    const dividaBase = { id: 1, discriminacao: 'Financiamento', situacao_anterior: 50000, situacao_atual: 50000 };
    let state = { ...initialState, dividas: [{ ...dividaBase }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_DIVIDA', payload: { bemId: 1, movimentacao: { tipo: 'amortizacao', valor: 15000, data: '2026-07-01' } } });
    const movId = state.dividas[0].movimentacoes[0].id;
    state = reducer(state, { type: 'UPDATE_MOVIMENTACAO_DIVIDA', payload: { bemId: 1, movId, movimentacao: { tipo: 'amortizacao', valor: 40000, data: '2026-07-01' } } });
    expect(state.dividas[0].situacao_atual).toBe(10000); // 50000 - 40000
  });

  it('não mexe em outro bem', () => {
    let state = { ...initialState, bens: [{ ...bemBase }, { ...bemBase, id: 2, situacao_atual: 5000 }] };
    state = reducer(state, { type: 'REGISTRAR_MOVIMENTACAO_BEM', payload: { bemId: 1, movimentacao: { tipo: 'compra', valor: 1000, data: '2026-05-01' } } });
    const movId = state.bens[0].movimentacoes[0].id;
    state = reducer(state, { type: 'UPDATE_MOVIMENTACAO_BEM', payload: { bemId: 1, movId, movimentacao: { tipo: 'compra', valor: 9000, data: '2026-05-01' } } });
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
    let state = { ...initialState, anoCalendario: 2025, bens: [{ ...bemBase }], contribuinte: { nome: 'Fulano' } };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    // durante 2026, vende o bem inteiro
    state = { ...state, bens: state.bens.map(b => ({ ...b, situacao_atual: 0 })) };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2027 });
    expect(state.bens[0].situacao_anterior).toBe(0); // 2027 nasce já refletindo a venda de 2026
    expect(state.historico[2026].bens[0].situacao_atual).toBe(0);

    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2025 });
    expect(state.bens[0].situacao_atual).toBe(130000); // 2025 volta intacto do histórico
  });

  it('bug real: uma venda registrada no ano corrente não pode "reaparecer" no ano novo depois do rollover', () => {
    // Sem isso, uma venda_parcial com valorVenda de 2025 continuava
    // pendurada em bem.movimentacoes depois da virada pra 2026 — a aba
    // Ganhos de Capital (que lê movimentacoes do bem do ano escolhido sem
    // filtrar por data) mostrava a MESMA venda de novo no ano 2026, como se
    // o bem tivesse sido vendido outra vez. dívidas já zeravam
    // movimentacoes no rollover; bens e bensRurais não zeravam.
    let state = {
      ...initialState, anoCalendario: 2025,
      bens: [{ ...bemBase, situacao_atual: 130000, movimentacoes: [
        { id: 1, tipo: 'venda_parcial', valor: 70000, valorVenda: 90000, data: '2025-06-01' },
      ] }],
      bensRurais: [{ id: 1, situacao_anterior: 50000, situacao_atual: 30000, movimentacoes: [
        { id: 2, tipo: 'venda_parcial', valor: 20000, valorVenda: 25000, data: '2025-07-01' },
      ] }],
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.bens[0].movimentacoes).toEqual([]);
    expect(state.bensRurais[0].movimentacoes).toEqual([]);
    // O ano antigo, arquivado no histórico, continua com a venda de verdade
    // (não é pra apagar o registro histórico, só não deixar ele vazar pro
    // ano novo).
    expect(state.historico[2025].bens[0].movimentacoes).toHaveLength(1);
    expect(state.historico[2025].bensRurais[0].movimentacoes).toHaveLength(1);
  });

  it('bug real: campos Oficiais importados (impostoDevido, apuracaoGanhoCapital e os demais demonstrativos/rurais) não podem vazar pro ano novo', () => {
    // A usuária reparou, ao avançar de 2025 (ano importado, com dado real)
    // para 2026 (ano ainda não declarado) via "Avançar para {ano+1}" na
    // sidebar, que cards como "Demonstrativo Lei 14.754/2023" e "Apuração
    // do Ganho de Capital Oficial" continuavam mostrando os mesmos itens de
    // 2025 dentro de 2026 — não fazia sentido, 2026 nem foi declarado
    // ainda. Causa raiz: ROLLOVER_ANO nunca zerava esses campos no branch
    // onde um ano genuinamente novo nasce (sem `existente` no histórico),
    // então eles sobreviviam via spread do estado antigo.
    let state = {
      ...initialState, anoCalendario: 2025,
      contribuinte: { nome: 'x' }, // precisa de hasWorkingData(state) pra arquivar 2025 no histórico
      documentoFonte: { formato: 'pdf', textoIntegral: 'declaração 2025' },
      impostoDevido: { total: 12345 },
      apuracaoGanhoCapital: [{ bem: '1', ganho: 1000 }],
      demonstrativoExteriorOficial: [{ bem: 133, ganhoPrejuizo: 1822059.55 }],
      rendaVariavelMensalOficial: [{ mes: 1 }, { mes: 2 }],
      receitasDespesasRuraisOficial: [{ mes: 1, receitaBruta: 100, despesaCusteioInvestimento: 50 }],
      apuracaoResultadoRuralOficial: { resultado: 50 },
      movimentacaoRebanhoOficial: [{ especieCodigo: '01', estoqueInicial: 125 }],
      participantesRuraisOficial: [{ cpf: '04176006668', nome: 'OSIRES PEREIRA CAMPOS' }],
      doacoesEfetuadasOficial: [{ codigo: '1', nome_beneficiario: 'X', valor: 100 }],
      doacoesPartidosOficial: [{ codigo: '2', nome_beneficiario: 'Y', valor: 200 }],
      doacoesEcaIdosoOficial: [{ codigo: '3', nome_beneficiario: 'Z', valor: 300, categoria: 'eca' }],
    };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });

    expect(state.impostoDevido).toBeNull();
    expect(state.apuracaoGanhoCapital).toEqual([]);
    expect(state.demonstrativoExteriorOficial).toEqual([]);
    expect(state.rendaVariavelMensalOficial).toEqual([]);
    expect(state.receitasDespesasRuraisOficial).toEqual([]);
    expect(state.apuracaoResultadoRuralOficial).toBeNull();
    expect(state.movimentacaoRebanhoOficial).toEqual([]);
    expect(state.participantesRuraisOficial).toEqual([]);
    expect(state.doacoesEfetuadasOficial).toEqual([]);
    expect(state.doacoesPartidosOficial).toEqual([]);
    expect(state.doacoesEcaIdosoOficial).toEqual([]);
    expect(state.documentoFonte).toBeNull();

    // O ano antigo, arquivado no histórico, continua com os dados oficiais
    // intactos (voltar para 2025 tem que mostrar tudo de novo).
    expect(state.historico[2025].impostoDevido).toEqual({ total: 12345 });
    expect(state.historico[2025].apuracaoGanhoCapital).toEqual([{ bem: '1', ganho: 1000 }]);
    expect(state.historico[2025].demonstrativoExteriorOficial).toEqual([{ bem: 133, ganhoPrejuizo: 1822059.55 }]);
    expect(state.historico[2025].documentoFonte.textoIntegral).toBe('declaração 2025');
  });
});

describe('IMPORT_DECLARACAO (import atômico com ano detectado no arquivo)', () => {
  it('troca de ano automaticamente quando o arquivo importado traz um ano diferente do corrente', () => {
    let state = { ...initialState, anoCalendario: 2024, bens: [{ ...bemBase, id: 1 }] };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: { nome: 'Fulano' }, bens: [{ id: 9, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [] },
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

  it('Receitas e Despesas / Apuração do Resultado oficiais (registros 51/52) só o .DBK traz; reimportar por PDF por cima preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      receitasDespesasRuraisOficial: [{ mes: 1, receitaBruta: 100, despesaCusteioInvestimento: 50 }],
      apuracaoResultadoRuralOficial: { resultado: 50 },
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
        receitasDespesasRuraisOficial: [], apuracaoResultadoRuralOficial: undefined,
      },
    });
    expect(state.receitasDespesasRuraisOficial).toHaveLength(1);
    expect(state.apuracaoResultadoRuralOficial.resultado).toBe(50);
  });

  it('Movimentação do Rebanho oficial (registro 53) só o .DBK traz; reimportar por PDF por cima preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      movimentacaoRebanhoOficial: [{ especieCodigo: '01', estoqueInicial: 125 }],
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
        movimentacaoRebanhoOficial: [],
      },
    });
    expect(state.movimentacaoRebanhoOficial).toHaveLength(1);
  });

  it('Participantes dos Imóveis Rurais oficiais (registro 57) só o .DBK traz; reimportar por PDF por cima preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      participantesRuraisOficial: [{ cpf: '04176006668', nome: 'OSIRES PEREIRA CAMPOS' }],
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
        participantesRuraisOficial: [],
      },
    });
    expect(state.participantesRuraisOficial).toHaveLength(1);
  });

  it('Demonstrativo Lei 14.754/2023 por bem (registro 37) só o .DBK traz; reimportar por PDF por cima preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      demonstrativoExteriorOficial: [{ bem: 133, ganhoPrejuizo: 1822059.55 }],
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
        demonstrativoExteriorOficial: [],
      },
    });
    expect(state.demonstrativoExteriorOficial).toHaveLength(1);
  });

  it('Renda Variável mensal oficial (registro 76) só o .DBK traz; reimportar por PDF por cima preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      rendaVariavelMensalOficial: [{ mes: 1 }, { mes: 2 }],
    };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
        rendaVariavelMensalOficial: [],
      },
    });
    expect(state.rendaVariavelMensalOficial).toHaveLength(2);
  });

  it('Doações (Efetuadas/Partidos/ECA-Pessoa Idosa) só o caminho PDF traz; reimportar via .DBK (que não expõe a chave) preserva o que já tinha', () => {
    let state = {
      ...initialState, anoCalendario: 2025,
      doacoesEfetuadasOficial: [{ codigo: '1', nome_beneficiario: 'X', valor: 100 }],
      doacoesPartidosOficial: [{ codigo: '2', nome_beneficiario: 'Y', valor: 200 }],
      doacoesEcaIdosoOficial: [{ codigo: '3', nome_beneficiario: 'Z', valor: 300, categoria: 'eca' }],
    };
    // payload simula o caminho .DBK: as 3 chaves nem chegam a existir no
    // payload (parseDBK nunca as produz) — undefined precisa cair no
    // "preserva o que já tinha", igual aos demais campos deste bloco.
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: {
        anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [],
      },
    });
    expect(state.doacoesEfetuadasOficial).toHaveLength(1);
    expect(state.doacoesPartidosOficial).toHaveLength(1);
    expect(state.doacoesEcaIdosoOficial).toHaveLength(1);
  });
});

describe('origemAnoAtual (declaração importada x ano avançado manualmente)', () => {
  it('IMPORT_DECLARACAO marca o ano como importado', () => {
    let state = { ...initialState };
    state = reducer(state, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: { nome: 'x' }, bens: [{ id: 1, situacao_atual: 1 }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(state.origemAnoAtual).toBe('importacao');
  });

  it('ROLLOVER_ANO pra um ano novo (nunca importado) marca como manual', () => {
    let state = { ...initialState, anoCalendario: 2025, origemAnoAtual: 'importacao', bens: [{ ...bemBase }] };
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.origemAnoAtual).toBe('manual');
  });

  it('trocar de ano e voltar restaura a origem de cada ano a partir do que foi arquivado', () => {
    let state = { ...initialState, anoCalendario: 2025, origemAnoAtual: 'importacao', bens: [{ ...bemBase }] };
    // avança pra um ano novo, manual
    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.origemAnoAtual).toBe('manual');
    expect(state.historico[2025].origem).toBe('importacao'); // 2025 arquivado guarda a origem certa
    // volta pro 2025 (que era importado)
    state = reducer(state, { type: 'SWITCH_ANO', payload: 2025 });
    expect(state.origemAnoAtual).toBe('importacao');
    expect(state.historico[2026].origem).toBe('manual'); // 2026 arquivado ao sair, guarda 'manual'
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

  it('excluir o único ano também zera Imóveis Explorados e o prejuízo da atividade rural a compensar', () => {
    // Bug real: blankYear de propósito NÃO zera imoveisRurais/
    // prejuizoRuralAcompensar (persistem de ano pra ano no ROLLOVER_ANO
    // normal), mas excluir o ÚLTIMO ano do histórico reaproveitava o mesmo
    // blankYear — as fazendas cadastradas e o saldo de prejuízo
    // sobreviviam à exclusão, mesmo sem nenhum ano restando.
    let state = {
      ...initialState, anoCalendario: 2026,
      imoveisRurais: [{ id: 1, nomeLocalizacao: 'Fazenda Teste' }],
      prejuizoRuralAcompensar: -5000,
      historico: {},
    };
    state = reducer(state, { type: 'DELETE_HISTORICO_ANO', payload: 2026 });
    expect(state.imoveisRurais).toHaveLength(0);
    expect(state.prejuizoRuralAcompensar).toBe(0);
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

// Infraestrutura do item G do HANDOFF-2026-09-03.md ("gravar em ano
// diferente sem trocar a visão"): envelope genérico que aplica QUALQUER
// ação de coleção (ADD_*, e por extensão UPDATE_*/DELETE_*) sobre o
// snapshot do ano-alvo dentro de `historico`, reaproveitando o próprio
// `reducer()` em vez de duplicar a regra de inserção por coleção. Usado por
// `garantirAnoCadastro`/`despacharEmAno` em DataContext.jsx.
describe('ADD_EM_ANO (grava num ano que pode não ser o ativo, sem trocar a visão)', () => {
  it('com o ano igual ao ativo, se comporta como o ADD_* direto (delega, não duplica lógica)', () => {
    const acaoInterna = { type: 'ADD_PAGAMENTO', payload: { codigo: '21', valor_pago: 200 } };
    const estadoBase = { ...initialState, anoCalendario: 2026 };
    const direto = reducer(estadoBase, acaoInterna);
    const viaEnvelope = reducer(estadoBase, { type: 'ADD_EM_ANO', payload: { ano: 2026, action: acaoInterna } });

    expect(viaEnvelope.anoCalendario).toBe(direto.anoCalendario);
    expect(viaEnvelope.historico).toEqual(direto.historico); // nenhum dos dois arquiva nada
    expect(viaEnvelope.pagamentos).toHaveLength(1);
    // novoId() avança um contador global entre as duas chamadas de reducer()
    // acima, então os ids DIVERGEM por construção — compara todo o resto.
    const { id: _d, ...pagamentoDireto } = direto.pagamentos[0];
    const { id: _e, ...pagamentoEnvelope } = viaEnvelope.pagamentos[0];
    expect(pagamentoEnvelope).toEqual(pagamentoDireto);
  });

  it('com ano diferente e histórico já existente, insere só no ano-alvo; ano ativo e coleções ativas saem intactos', () => {
    const historicoAnoAlvo = { ...blankYear, pagamentos: [{ id: 5, codigo: '10', valor_pago: 999 }], savedAt: 'x' };
    const estadoAntes = {
      ...initialState, anoCalendario: 2026,
      pagamentos: [{ id: 1, codigo: '21', valor_pago: 100 }],
      bens: [{ ...bemBase }],
      historico: { 2025: historicoAnoAlvo },
    };
    const state = reducer(estadoAntes, {
      type: 'ADD_EM_ANO',
      payload: { ano: 2025, action: { type: 'ADD_PAGAMENTO', payload: { codigo: '30', valor_pago: 300 } } },
    });

    expect(state.anoCalendario).toBe(2026);
    expect(state.historico[2025].pagamentos).toHaveLength(2);
    expect(state.historico[2025].pagamentos[0]).toEqual(historicoAnoAlvo.pagamentos[0]);
    expect(state.historico[2025].pagamentos[1].valor_pago).toBe(300);
    // Comparação profunda do resto do estado ativo (fora `historico`): nada
    // muda no ano em exibição, nem os campos que o Demonstrativo/saldos
    // compensáveis leem dele (ver AUDITORIA/ESTUDO-VARIACAO-PATRIMONIAL...).
    const { historico: _h1, ...restoAntes } = estadoAntes;
    const { historico: _h2, ...restoDepois } = state;
    expect(restoDepois).toEqual(restoAntes);
  });

  it('com ano diferente e sem histórico ainda, cria o ano em branco (mesma base do ROLLOVER_ANO/blankYear) e insere só nele', () => {
    const estadoAntes = {
      ...initialState, anoCalendario: 2026,
      pagamentosDiversos: [{ id: 1, descricao: 'Cartão', valor: 100 }],
      imoveisRurais: [{ id: 9, nomeLocalizacao: 'Fazenda X' }],
      prejuizoRuralAcompensar: 500,
      historico: {},
    };
    const state = reducer(estadoAntes, {
      type: 'ADD_EM_ANO',
      payload: { ano: 2027, action: { type: 'ADD_PAGAMENTO_DIVERSO', payload: { descricao: 'Seguro', valor: 50 } } },
    });

    expect(state.anoCalendario).toBe(2026);
    expect(state.pagamentosDiversos).toEqual(estadoAntes.pagamentosDiversos); // ano ativo intocado
    expect(state.historico[2027]).toBeTruthy();
    expect(state.historico[2027].pagamentosDiversos).toHaveLength(1);
    expect(state.historico[2027].pagamentosDiversos[0].descricao).toBe('Seguro');
    // Coleções do ano nascem vazias, mesma base de blankYear usada no ROLLOVER_ANO...
    expect(state.historico[2027].bens).toEqual([]);
    expect(state.historico[2027].contribuinte).toBeNull();
    // ...mas os dois campos que "atravessam anos" (ver comentário de
    // blankYear) entram com o valor corrente do state, mesmo critério do
    // ROLLOVER_ANO/SWITCH_ANO ao visitar um ano genuinamente novo.
    expect(state.historico[2027].imoveisRurais).toEqual(estadoAntes.imoveisRurais);
    expect(state.historico[2027].prejuizoRuralAcompensar).toBe(500);
  });

  it('funciona para coleções diferentes sem lógica duplicada por coleção (pagamentos e despesas gerais no mesmo ano-alvo)', () => {
    let state = { ...initialState, anoCalendario: 2026, historico: {} };
    state = reducer(state, { type: 'ADD_EM_ANO', payload: { ano: 2025, action: { type: 'ADD_PAGAMENTO', payload: { codigo: '21', valor_pago: 100 } } } });
    state = reducer(state, { type: 'ADD_EM_ANO', payload: { ano: 2025, action: { type: 'ADD_PAGAMENTO_DIVERSO', payload: { descricao: 'IPVA', valor: 80 } } } });

    expect(state.anoCalendario).toBe(2026);
    expect(state.historico[2025].pagamentos).toHaveLength(1);
    expect(state.historico[2025].pagamentosDiversos).toHaveLength(1);
    // A 2ª chamada reaproveitou o MESMO snapshot criado pela 1ª (não recriou
    // do zero, o que perderia o pagamento já gravado).
    expect(state.historico[2025].pagamentos[0].valor_pago).toBe(100);
  });

  it('o histórico de alterações (reducerComHistorico) descreve a ação interna, não "ADD_EM_ANO" cru', () => {
    let state = { ...initialState, anoCalendario: 2026, historico: {} };
    state = reducerComHistorico(state, {
      type: 'ADD_EM_ANO',
      payload: { ano: 2025, action: { type: 'ADD_PAGAMENTO_DIVERSO', payload: { descricao: 'IPTU', valor: 400 } } },
    });
    expect(state.alteracoes[0].descricao).toMatch(/despesa geral/i);
    expect(state.alteracoes[0].descricao).toMatch(/2025/);
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

describe('origem por item (manual x importacao) e RECONCILIAR_IMPORTACAO (retificadora)', () => {
  it('ADD_BEM/ADD_DIVIDA/ADD_RENDIMENTO/ADD_PAGAMENTO marcam origem: manual', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_BEM', payload: { discriminacao: 'Carro', situacao_atual: 50000 } });
    state = reducer(state, { type: 'ADD_DIVIDA', payload: { discriminacao: 'Financiamento', situacao_atual: 1000 } });
    state = reducer(state, { type: 'ADD_RENDIMENTO', payload: { tipo: 'tributavel_pj', valor: 500 } });
    state = reducer(state, { type: 'ADD_PAGAMENTO', payload: { codigo: '21', valor_pago: 200 } });
    expect(state.bens[0].origem).toBe('manual');
    expect(state.dividas[0].origem).toBe('manual');
    expect(state.rendimentos[0].origem).toBe('manual');
    expect(state.pagamentos[0].origem).toBe('manual');
  });

  it('cadastros rurais também marcam origem manual e a edição preserva essa origem', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_BEM_RURAL', payload: { codigo: '01', discriminacao: 'Trator' } });
    state = reducer(state, { type: 'ADD_DIVIDA_RURAL', payload: { discriminacao: 'Financiamento' } });
    state = reducer(state, { type: 'ADD_IMOVEL_RURAL', payload: { nomeLocalizacao: 'Fazenda' } });
    const bemId = state.bensRurais[0].id;
    const imovelId = state.imoveisRurais[0].id;
    state = reducer(state, { type: 'UPDATE_BEM_RURAL', payload: { id: bemId, discriminacao: 'Trator corrigido' } });
    state = reducer(state, { type: 'UPDATE_IMOVEL_RURAL', payload: { id: imovelId, area: 10 } });
    expect(state.bensRurais[0].origem).toBe('manual');
    expect(state.dividasRurais[0].origem).toBe('manual');
    expect(state.imoveisRurais[0].origem).toBe('manual');
  });

  it('IMPORT_DECLARACAO marca origem: importacao em cada bem/dívida/rendimento/pagamento importado', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'IMPORT_DECLARACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: [{ id: 1, codigo: '21', discriminacao: 'Apto', situacao_anterior: 100, situacao_atual: 100 }],
      dividas: [], rendimentos: [], pagamentos: [],
    }});
    expect(state.bens[0].origem).toBe('importacao');
  });

  it('UPDATE_BEM mescla em vez de substituir o item inteiro, preservando a origem já gravada', () => {
    let state = { ...initialState, bens: [{ id: 1, codigo: '21', discriminacao: 'Apto', situacao_atual: 100, origem: 'importacao' }] };
    state = reducer(state, { type: 'UPDATE_BEM', payload: { id: 1, discriminacao: 'Apto reformado' } });
    expect(state.bens[0].origem).toBe('importacao');
    expect(state.bens[0].discriminacao).toBe('Apto reformado');
  });

  it('vincula item da retificadora a um bem já importado: atualiza dados declarados, preserva id e movimentações, mantém o delta já movimentado', () => {
    // Bem importado com situação anterior 100.000 e atual 130.000 (uma
    // compra de 30.000 já lançada). A retificadora corrige a situação
    // anterior para 90.000 — o delta de +30.000 da movimentação tem que
    // continuar valendo em cima do novo valor de partida, não sumir.
    const bemAntigo = {
      id: 42, codigo_bem: '21', discriminacao: 'Apartamento', situacao_anterior: 100000, situacao_atual: 130000,
      origem: 'importacao', movimentacoes: [{ id: 1, tipo: 'compra', valor: 30000 }],
    };
    let state = { ...initialState, anoCalendario: 2025, bens: [bemAntigo], dividas: [] };
    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: { vinculados: [{ idAntigo: 42, dados: { codigo_bem: '21', discriminacao: 'Apartamento (corrigido)', situacao_anterior: 90000, situacao_atual: 90000 } }], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.bens).toHaveLength(1);
    expect(state.bens[0].id).toBe(42);
    expect(state.bens[0].discriminacao).toBe('Apartamento (corrigido)');
    expect(state.bens[0].situacao_anterior).toBe(90000);
    expect(state.bens[0].situacao_atual).toBe(120000); // 90.000 + delta de 30.000 preservado
    expect(state.bens[0].movimentacoes).toHaveLength(1);
  });

  it('item novo da retificadora entra como importação; item antigo em removerAntigos some; item manual não mencionado fica intocado', () => {
    const bemManual = { id: 1, codigo_bem: '99', discriminacao: 'Terreno cadastrado à mão', situacao_atual: 5000, origem: 'manual' };
    const bemOrfao = { id: 2, codigo_bem: '21', discriminacao: 'Item que saiu da retificadora', situacao_atual: 1000, origem: 'importacao', movimentacoes: [] };
    let state = { ...initialState, anoCalendario: 2025, bens: [bemManual, bemOrfao] };
    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: {
        vinculados: [],
        novos: [{ codigo_bem: '12', discriminacao: 'Bem novo na retificadora', situacao_anterior: 8000, situacao_atual: 8000 }],
        removerAntigos: [2],
      },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.bens).toHaveLength(2);
    expect(state.bens.find(b => b.id === 1)).toEqual(bemManual);
    expect(state.bens.find(b => b.id === 2)).toBeUndefined();
    const novo = state.bens.find(b => b.codigo_bem === '12');
    expect(novo.origem).toBe('importacao');
    expect(novo.discriminacao).toBe('Bem novo na retificadora');
  });

  it('rendimentos/pagamentos: substitui só os de origem importacao, preserva os manuais', () => {
    const rendManual = { id: 1, tipo: 'isento', valor: 300, origem: 'manual' };
    const rendImportadoAntigo = { id: 2, tipo: 'tributavel_pj', valor: 1000, origem: 'importacao' };
    let state = { ...initialState, anoCalendario: 2025, rendimentos: [rendManual, rendImportadoAntigo] };
    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [{ tipo: 'tributavel_pj', valor: 1200 }],
      pagamentos: [],
    }});
    expect(state.rendimentos).toHaveLength(2);
    expect(state.rendimentos.find(r => r.id === 1)).toEqual(rendManual);
    const novo = state.rendimentos.find(r => r.origem === 'importacao');
    expect(novo.valor).toBe(1200);
  });

  it('bug real: retificadora atualiza todos os quadros oficiais e limpa os removidos no mesmo formato', () => {
    let state = {
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'pdf',
      impostoDevido: { saldoImpostoPagar: 999 },
      ganhosCapitalOficial: { operacoes: [{ bem: 'antigo' }] },
      fiiFiagroMensalOficial: [{ mes: 1 }],
      rendaVariavelMensalOficial: [{ mes: 2 }],
      fichasNaoLidasComConteudo: ['RRA antigo'],
      dependentes: [{ id: 1, nome: 'Dependente antigo' }],
    };
    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      formato: 'pdf',
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      dependentes: [{ id: 2, nome: 'Dependente corrigido' }],
      impostoDevido: { saldoImpostoPagar: 123 },
      ganhosCapitalOficial: { operacoes: [{ bem: 'novo' }] },
      fiiFiagroMensalOficial: [],
      rendaVariavelMensalOficial: [],
      fichasNaoLidasComConteudo: [],
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.impostoDevido.saldoImpostoPagar).toBe(123);
    expect(state.ganhosCapitalOficial.operacoes[0].bem).toBe('novo');
    expect(state.fiiFiagroMensalOficial).toEqual([]);
    expect(state.rendaVariavelMensalOficial).toEqual([]);
    expect(state.fichasNaoLidasComConteudo).toEqual([]);
    expect(state.dependentes).toEqual([{ id: 2, nome: 'Dependente corrigido' }]);
  });

  it('retificadora em outro formato não apaga quadro que o parser novo não cobre', () => {
    let state = {
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'dbk',
      fiiFiagroAnualOficial: { resultadoLiquido: 456 },
    };
    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      formato: 'pdf',
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      fiiFiagroAnualOficial: null,
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.fiiFiagroAnualOficial).toEqual({ resultadoLiquido: 456 });
  });

  it('retificadora rural inclui, altera e remove importados sem tocar cadastros manuais', () => {
    const manualBem = { id: 1, codigo: '99', discriminacao: 'Implemento manual', situacao_atual: 500, origem: 'manual' };
    const manualDivida = { id: 2, discriminacao: 'Crédito manual', situacao_atual: 300, origem: 'manual' };
    const manualImovel = { id: 3, cib: '9999999-9', nomeLocalizacao: 'Sítio manual', origem: 'manual' };
    let state = {
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'dbk',
      bensRurais: [
        manualBem,
        { id: 10, controle: '0000000001', codigo: '01', discriminacao: 'Trator', situacao_anterior: 100, situacao_atual: 130, origem: 'importacao', movimentacoes: [{ id: 101, tipo: 'compra', valor: 30 }] },
        { id: 11, codigo: '02', discriminacao: 'Bem removido', situacao_anterior: 50, situacao_atual: 50, origem: 'importacao', movimentacoes: [] },
      ],
      dividasRurais: [
        manualDivida,
        { id: 20, controle: '0000000020', discriminacao: 'Financiamento rural', situacao_anterior: 100, situacao_atual: 90, origem: 'importacao', movimentacoes: [{ id: 201, tipo: 'amortizacao', valor: 10 }] },
        { id: 21, discriminacao: 'Dívida removida', situacao_anterior: 20, situacao_atual: 20, origem: 'importacao', movimentacoes: [] },
      ],
      imoveisRurais: [
        manualImovel,
        { id: 30, chaveAssociacao: '00001', cib: '1234567-8', nomeLocalizacao: 'Fazenda A', area: 10, origem: 'importacao' },
        { id: 31, chaveAssociacao: '00002', cib: '1234567-8', nomeLocalizacao: 'Fazenda removida', area: 5, origem: 'importacao' },
      ],
    };

    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      formato: 'dbk',
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
      bensRurais: [
        { controle: '0000000001', codigo: '01', discriminacao: 'Trator com descrição retificada', situacao_anterior: 80, situacao_atual: 90, movimentacoes: [] },
        { codigo: '03', discriminacao: 'Colheitadeira nova', situacao_anterior: 0, situacao_atual: 200, movimentacoes: [] },
      ],
      dividasRurais: [
        { controle: '0000000020', discriminacao: 'Financiamento rural corrigido', situacao_anterior: 90, situacao_atual: 80, valor_pago: 20, movimentacoes: [] },
        { discriminacao: 'Custeio novo', situacao_anterior: 0, situacao_atual: 70, valor_pago: 0, movimentacoes: [] },
      ],
      imoveisRurais: [
        { chaveAssociacao: '00001', cib: '1234567-8', nomeLocalizacao: 'Fazenda A', area: 12 },
        { chaveAssociacao: '00003', cib: '7654321-0', nomeLocalizacao: 'Fazenda nova', area: 8 },
      ],
    }});

    expect(state.bensRurais.find(x => x.id === 1)).toEqual(manualBem);
    expect(state.bensRurais.find(x => x.id === 10)).toMatchObject({ situacao_anterior: 80, situacao_atual: 120, origem: 'importacao' });
    expect(state.bensRurais.find(x => x.id === 10).movimentacoes).toHaveLength(1);
    expect(state.bensRurais.find(x => x.id === 11)).toBeUndefined();
    expect(state.bensRurais.find(x => x.discriminacao === 'Colheitadeira nova').origem).toBe('importacao');

    expect(state.dividasRurais.find(x => x.id === 2)).toEqual(manualDivida);
    expect(state.dividasRurais.find(x => x.id === 20)).toMatchObject({ situacao_anterior: 90, situacao_atual: 70, origem: 'importacao' });
    expect(state.dividasRurais.find(x => x.id === 21)).toBeUndefined();
    expect(state.dividasRurais.find(x => x.discriminacao === 'Custeio novo').origem).toBe('importacao');

    expect(state.imoveisRurais.find(x => x.id === 3)).toEqual(manualImovel);
    expect(state.imoveisRurais.find(x => x.id === 30)).toMatchObject({ area: 12, origem: 'importacao' });
    expect(state.imoveisRurais.find(x => x.id === 31)).toBeUndefined();
    expect(state.imoveisRurais.find(x => x.nomeLocalizacao === 'Fazenda nova').origem).toBe('importacao');
  });

  it('retificadora substitui apenas doações importadas e preserva as manuais, inclusive ao limpar a ficha', () => {
    const manual = { id: 1, nome_beneficiario: 'Doação manual', valor: 100, origem: 'manual' };
    let state = {
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'pdf',
      doacoesEfetuadasOficial: [manual, { id: 2, nome_beneficiario: 'Importada antiga', valor: 200, origem: 'importacao' }],
    };
    const basePayload = {
      anoCalendario: 2025, formato: 'pdf', contribuinte: { cpf: '11111111111' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    };

    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      ...basePayload,
      doacoesEfetuadasOficial: [{ nome_beneficiario: 'Importada nova', valor: 300 }],
    }});
    expect(state.doacoesEfetuadasOficial).toHaveLength(2);
    expect(state.doacoesEfetuadasOficial.find(x => x.id === 1)).toEqual(manual);
    expect(state.doacoesEfetuadasOficial.find(x => x.origem === 'importacao')).toMatchObject({ nome_beneficiario: 'Importada nova', valor: 300 });

    state = reducer(state, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      ...basePayload,
      doacoesEfetuadasOficial: [],
    }});
    expect(state.doacoesEfetuadasOficial).toEqual([manual]);
  });

  it('replay parte da situação atual retificada e respeita venda total, baixa, quitação e ajuste', () => {
    const payloadBase = {
      anoCalendario: 2025, formato: 'dbk', contribuinte: { cpf: '11111111111' },
      rendimentos: [], pagamentos: [],
    };
    const casosBem = [
      [[{ tipo: 'compra', valor: 20 }, { tipo: 'venda_parcial', valor: 5 }], 115],
      [[{ tipo: 'venda_total', valor: 0 }], 0],
      [[{ tipo: 'baixa', valor: 0 }], 0],
      [[{ tipo: 'ajuste', valor: 77 }], 77],
    ];
    for (const [movimentacoes, esperado] of casosBem) {
      const state = reducer({
        ...initialState, anoCalendario: 2025, importFormato: 'dbk',
        bens: [{ id: 10, origem: 'importacao', situacao_anterior: 80, situacao_atual: 999, movimentacoes }],
      }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
        ...payloadBase,
        bens: { vinculados: [{ idAntigo: 10, dados: { situacao_anterior: 90, situacao_atual: 100 } }], novos: [], removerAntigos: [] },
        dividas: { vinculados: [], novos: [], removerAntigos: [] },
      }});
      expect(state.bens[0].situacao_atual).toBe(esperado);
    }

    const casosDivida = [
      [[{ tipo: 'contratacao', valor: 20 }, { tipo: 'amortizacao', valor: 5 }], 115],
      [[{ tipo: 'quitacao', valor: 0 }], 0],
      [[{ tipo: 'ajuste', valor: 44 }], 44],
    ];
    for (const [movimentacoes, esperado] of casosDivida) {
      const state = reducer({
        ...initialState, anoCalendario: 2025, importFormato: 'dbk',
        dividas: [{ id: 20, origem: 'importacao', situacao_anterior: 80, situacao_atual: 999, movimentacoes }],
      }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
        ...payloadBase,
        bens: { vinculados: [], novos: [], removerAntigos: [] },
        dividas: { vinculados: [{ idAntigo: 20, dados: { situacao_anterior: 90, situacao_atual: 100 } }], novos: [], removerAntigos: [] },
      }});
      expect(state.dividas[0].situacao_atual).toBe(esperado);
    }
  });

  it('ignora tentativa de payload forjado para remover ou sobrescrever item manual', () => {
    const manual = { id: 7, origem: 'manual', discriminacao: 'Bem manual', situacao_anterior: 10, situacao_atual: 10, movimentacoes: [] };
    const state = reducer({ ...initialState, anoCalendario: 2025, bens: [manual] }, {
      type: 'RECONCILIAR_IMPORTACAO',
      payload: {
        anoCalendario: 2025, formato: 'dbk', contribuinte: { cpf: '1' },
        bens: {
          vinculados: [{ idAntigo: 7, dados: { discriminacao: 'Injetado', situacao_anterior: 0, situacao_atual: 999 } }],
          novos: [], removerAntigos: [7],
        },
        dividas: { vinculados: [], novos: [], removerAntigos: [] },
        rendimentos: [], pagamentos: [],
      },
    });
    expect(state.bens).toEqual([manual]);
  });

  it('consome legado correspondente sem duplicar rendimentos, pagamentos e doações', () => {
    const state = reducer({
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'pdf',
      rendimentos: [{ id: 1, origem: 'origem_legacy', tipo: 'tributavel_pj', cnpj_fonte: '12345678000199', beneficiario: 'Titular', valor: 100 }],
      pagamentos: [{ id: 2, origem: 'origem_legacy', codigo: '21', cpf_cnpj: '11122233344', nome_beneficiario: 'Médico', valor_pago: 50 }],
      doacoesEfetuadasOficial: [{ id: 3, origem: 'origem_legacy', codigo: '40', cpf_cnpj: '99888777000166', nome_beneficiario: 'Instituto', valor: 20 }],
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025, formato: 'pdf', contribuinte: { cpf: '1' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [{ tipo: 'tributavel_pj', cnpj_fonte: '12345678000199', beneficiario: 'Titular', valor: 120 }],
      pagamentos: [{ codigo: '21', cpf_cnpj: '11122233344', nome_beneficiario: 'Médico corrigido', valor_pago: 60 }],
      doacoesEfetuadasOficial: [{ codigo: '40', cpf_cnpj: '99888777000166', nome_beneficiario: 'Instituto corrigido', valor: 30 }],
    }});
    expect(state.rendimentos).toHaveLength(1);
    expect(state.pagamentos).toHaveLength(1);
    expect(state.doacoesEfetuadasOficial).toHaveLength(1);
    expect(state.rendimentos[0]).toMatchObject({ id: 1, origem: 'importacao', valor: 120 });
    expect(state.pagamentos[0]).toMatchObject({ id: 2, origem: 'importacao', valor_pago: 60 });
    expect(state.doacoesEfetuadasOficial[0]).toMatchObject({ id: 3, origem: 'importacao', valor: 30 });
  });

  it('preserva legado sem correspondência em vez de apagá-lo silenciosamente', () => {
    const legado = { id: 1, origem: 'origem_legacy', tipo: 'isento', codigo: '99', nome_fonte: 'Fonte antiga', valor: 10 };
    const state = reducer({ ...initialState, anoCalendario: 2025, importFormato: 'dbk', rendimentos: [legado] }, {
      type: 'RECONCILIAR_IMPORTACAO', payload: {
        anoCalendario: 2025, formato: 'dbk', contribuinte: { cpf: '1' },
        bens: { vinculados: [], novos: [], removerAntigos: [] },
        dividas: { vinculados: [], novos: [], removerAntigos: [] },
        rendimentos: [], pagamentos: [],
      },
    });
    expect(state.rendimentos).toEqual([legado]);
  });
  it('mantém vínculo rural do PDF quando a descrição é corrigida', () => {
    const antigo = {
      id: 10, origem: 'importacao', chaveImportacao: 'pdf:bem-rural:1',
      codigo: '01', discriminacao: 'Descrição antiga', situacao_atual: 100,
      movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 20 }],
    };
    const state = reducer({
      ...initialState, anoCalendario: 2025, importFormato: 'pdf', bensRurais: [antigo],
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025, formato: 'pdf', contribuinte: { cpf: '1' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
      bensRurais: [{
        chaveImportacao: 'pdf:bem-rural:1', codigo: '01',
        discriminacao: 'Descrição corrigida', situacao_atual: 100,
      }],
    }});
    expect(state.bensRurais).toHaveLength(1);
    expect(state.bensRurais[0]).toMatchObject({
      id: 10, discriminacao: 'Descrição corrigida', situacao_atual: 80,
    });
    expect(state.bensRurais[0].movimentacoes).toEqual(antigo.movimentacoes);
  });

  it('usa o vínculo revisado para preservar movimento rural mesmo quando texto e chave mudam', () => {
    const antigo = {
      id: 10,
      origem: 'importacao',
      chaveImportacao: 'pdf:bem-rural:chave-antiga',
      codigo: '01',
      discriminacao: 'Trator descrição antiga',
      situacao_atual: 100,
      movimentacoes: [{ id: 1, tipo: 'benfeitoria', valor: 25 }],
    };
    const state = reducer({
      ...initialState, anoCalendario: 2025, importFormato: 'pdf', bensRurais: [antigo],
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      formato: 'pdf',
      contribuinte: { cpf: '1' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [],
      pagamentos: [],
      bensRurais: {
        vinculados: [{ idAntigo: 10, dados: {
          chaveImportacao: 'pdf:bem-rural:chave-nova',
          codigo: '01',
          discriminacao: 'Trator com descrição corrigida',
          situacao_atual: 120,
        }}],
        novos: [],
        removerAntigos: [],
      },
    }});

    expect(state.bensRurais).toHaveLength(1);
    expect(state.bensRurais[0]).toMatchObject({
      id: 10,
      chaveImportacao: 'pdf:bem-rural:chave-nova',
      discriminacao: 'Trator com descrição corrigida',
      situacao_atual: 145,
      origem: 'importacao',
    });
    expect(state.bensRurais[0].movimentacoes).toEqual(antigo.movimentacoes);
  });

  it('não colide bens rurais do PDF com o mesmo código', () => {
    const antigos = [
      { id: 10, origem: 'importacao', chaveImportacao: 'pdf:bem-rural:1:01:100.00', codigo: '01', situacao_atual: 100, movimentacoes: [{ id: 1, tipo: 'venda_parcial', valor: 10 }] },
      { id: 20, origem: 'importacao', chaveImportacao: 'pdf:bem-rural:2:01:200.00', codigo: '01', situacao_atual: 200, movimentacoes: [{ id: 2, tipo: 'benfeitoria', valor: 15 }] },
    ];
    const state = reducer({
      ...initialState, anoCalendario: 2025, importFormato: 'pdf', bensRurais: antigos,
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025, formato: 'pdf', contribuinte: { cpf: '1' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
      bensRurais: [
        { chaveImportacao: 'pdf:bem-rural:2:01:200.00', codigo: '01', discriminacao: 'Segundo corrigido', situacao_atual: 200 },
        { chaveImportacao: 'pdf:bem-rural:1:01:100.00', codigo: '01', discriminacao: 'Primeiro corrigido', situacao_atual: 100 },
      ],
    }});
    expect(state.bensRurais.map(item => [item.id, item.discriminacao, item.situacao_atual])).toEqual([
      [20, 'Segundo corrigido', 215],
      [10, 'Primeiro corrigido', 90],
    ]);
  });

  it('refaz o vínculo dos participantes rurais para o id definitivo do imóvel', () => {
    const state = reducer({
      ...initialState,
      anoCalendario: 2025,
      importFormato: 'pdf',
      imoveisRurais: [{
        id: 900,
        origem: 'importacao',
        chaveImportacao: 'pdf:imovel-rural:chave-antiga',
        cib: '123',
      }],
      participantesRuraisOficial: [{ cpf: '11122233344', imovelId: 900 }],
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025,
      formato: 'pdf',
      contribuinte: { cpf: '1' },
      bens: { vinculados: [], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [],
      pagamentos: [],
      imoveisRurais: {
        vinculados: [{ idAntigo: 900, dados: {
          chaveImportacao: 'pdf:imovel-rural:chave-nova',
          cib: '123',
          nomeLocalizacao: 'Nome corrigido',
        }}],
        novos: [],
        removerAntigos: [],
      },
      participantesRuraisOficial: [{
        cpf: '11122233344',
        imovelId: 1,
        imovelChaveImportacao: 'pdf:imovel-rural:chave-nova',
      }],
    }});

    expect(state.imoveisRurais[0].id).toBe(900);
    expect(state.participantesRuraisOficial[0]).toMatchObject({
      cpf: '11122233344',
      imovelId: 900,
      imovelChaveImportacao: 'pdf:imovel-rural:chave-nova',
    });
  });

  it('reaplica movimentações com piso zero sobre a situação atual retificada', () => {
    const state = reducer({
      ...initialState, anoCalendario: 2025, importFormato: 'dbk',
      bens: [{ id: 1, origem: 'importacao', situacao_atual: 10, movimentacoes: [{ tipo: 'venda_parcial', valor: 50 }] }],
      dividas: [{ id: 2, origem: 'importacao', situacao_atual: 10, movimentacoes: [{ tipo: 'amortizacao', valor: 50 }] }],
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025, formato: 'dbk', contribuinte: { cpf: '1' },
      bens: { vinculados: [{ idAntigo: 1, dados: { situacao_atual: 10 } }], novos: [], removerAntigos: [] },
      dividas: { vinculados: [{ idAntigo: 2, dados: { situacao_atual: 10 } }], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.bens[0].situacao_atual).toBe(0);
    expect(state.dividas[0].situacao_atual).toBe(0);
  });

  it('aplica retificadora a ano histórico e substitui o documento-fonte', () => {
    const fonteAntiga = { formato: 'dbk', textoIntegral: 'antigo' };
    const fonteNova = { formato: 'dbk', textoIntegral: 'retificado' };
    const state = reducer({
      ...initialState,
      anoCalendario: 2026,
      contribuinte: { cpf: '1' },
      bens: [{ id: 99, origem: 'manual', situacao_atual: 1 }],
      historico: {
        2025: {
          ...blankYear,
          origem: 'importacao',
          importFormato: 'dbk',
          documentoFonte: fonteAntiga,
          contribuinte: { cpf: '1' },
          bens: [{ id: 5, origem: 'importacao', situacao_atual: 100, movimentacoes: [] }],
        },
      },
    }, { type: 'RECONCILIAR_IMPORTACAO', payload: {
      anoCalendario: 2025, formato: 'dbk', documentoFonte: fonteNova,
      contribuinte: { cpf: '1' },
      bens: { vinculados: [{ idAntigo: 5, dados: { situacao_atual: 120 } }], novos: [], removerAntigos: [] },
      dividas: { vinculados: [], novos: [], removerAntigos: [] },
      rendimentos: [], pagamentos: [],
    }});
    expect(state.anoCalendario).toBe(2025);
    expect(state.bens[0]).toMatchObject({ id: 5, situacao_atual: 120 });
    expect(state.documentoFonte).toEqual(fonteNova);
    expect(state.historico[2026].bens[0].id).toBe(99);
  });

});

describe('metadados auditáveis da importação', () => {
  it('persiste estados e avisos compactos no ano e no histórico', () => {
    const estadoFichas = {
      'dbk:IR': { estado: 'parcial', formato: 'dbk', presenca: 'preenchida', suporte: 'parcial', derivado: false, completudeAuditada: false },
    };
    let state = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: {
      anoCalendario: 2025, formato: 'dbk', contribuinte: { cpf: '1' },
      bens: [], dividas: [], rendimentos: [], pagamentos: [],
      estadoFichas,
      avisosImportacao: [{ codigo: 'DBK_FICHA_NAO_SUPORTADA', tipoRegistro: '58' }],
      registrosDbkNaoModelados: [{ tipoRegistro: '58', ocorrencias: 1 }],
    }});
    expect(state.estadoFichas).toEqual(estadoFichas);
    expect(state.avisosImportacao).toHaveLength(1);
    expect(state.registrosDbkNaoModelados).toHaveLength(1);

    state = reducer(state, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(state.estadoFichas).toEqual({});
    expect(state.historico[2025].estadoFichas).toEqual(estadoFichas);
    expect(state.historico[2025].registrosDbkNaoModelados).toHaveLength(1);
  });
});

describe('novoId sem colisão', () => {
  it('continua monotônico com mais de mil ids no mesmo milissegundo', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const ids = Array.from({ length: 2500 }, () => novoId());
    spy.mockRestore();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id, i) => i === 0 || id > ids[i - 1])).toBe(true);
  });
});

describe('detecção de ano com quadros oficiais', () => {
  it.each([
    ['imposto devido', { impostoDevido: { saldoImpostoPagar: 0 } }],
    ['ganhos de capital', { ganhosCapitalOficial: { operacoes: [] } }],
    ['renda variável anual', { rendaVariavelAnualOficial: { resultadoLiquido: 0 } }],
    ['FII/Fiagro anual', { fiiFiagroAnualOficial: { resultadoLiquido: 0 } }],
    ['apuração rural', { apuracaoResultadoRuralOficial: { resultadoTributavel: 0 } }],
    ['imóveis rurais', { imoveisRurais: [{ id: 1 }] }],
    ['dívidas rurais', { dividasRurais: [{ id: 1 }] }],
    ['doações', { doacoesEfetuadasOficial: [{ id: 1 }] }],
    ['fichas não modeladas', { fichasNaoLidasComConteudo: ['Registro 99'] }],
  ])('reconhece ano composto somente por %s', (_nome, dados) => {
    const estado = { ...initialState, ...dados };
    expect(hasWorkingData(estado)).toBe(true);
    expect(snapshotHasData(dados)).toBe(true);
  });

  it('não considera objetos oficiais vazios como dado', () => {
    expect(hasWorkingData({ ...initialState, impostoDevido: {}, ganhosCapitalOficial: {} })).toBe(false);
  });
});

describe('titular e dependentes (cadastro manual)', () => {
  it('SET_CONTRIBUINTE substitui o titular', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'SET_CONTRIBUINTE', payload: { nome: 'Fulano', cpf: '11111111111' } });
    expect(state.contribuinte).toEqual({ nome: 'Fulano', cpf: '11111111111' });
  });

  it('SET_CONTRIBUINTE preserva dados cadastrais importados ao editar nome e CPF', () => {
    let state = { ...initialState, contribuinte: { nome: 'Fulano', cpf: '1', municipio: 'Cidade Exemplo', ocupacaoCodigo: '120' } };
    state = reducer(state, { type: 'SET_CONTRIBUINTE', payload: { nome: 'Fulano Corrigido', cpf: '2' } });
    expect(state.contribuinte).toEqual({ nome: 'Fulano Corrigido', cpf: '2', municipio: 'Cidade Exemplo', ocupacaoCodigo: '120' });
  });

  it('ADD/UPDATE/DELETE_DEPENDENTE seguem o mesmo padrão de bens/dívidas', () => {
    let state = { ...initialState };
    state = reducer(state, { type: 'ADD_DEPENDENTE', payload: { nome: 'Filho', cpf: '', dataNascimento: '2015-01-01', parentesco: '21' } });
    expect(state.dependentes).toHaveLength(1);
    const id = state.dependentes[0].id;
    state = reducer(state, { type: 'UPDATE_DEPENDENTE', payload: { id, nome: 'Filho Corrigido' } });
    expect(state.dependentes[0].nome).toBe('Filho Corrigido');
    state = reducer(state, { type: 'DELETE_DEPENDENTE', payload: id });
    expect(state.dependentes).toHaveLength(0);
  });

  it('bug real: dependentes precisam estar no snapshot do ano, senão trocar de ano e voltar perde a lista', () => {
    let state = { ...initialState, anoCalendario: 2025, dependentes: [{ id: 1, nome: 'Filho 2025' }] };
    state = reducer(state, { type: 'SWITCH_ANO', payload: 2026 });
    expect(state.dependentes).toEqual([]); // ano novo, em branco
    state = reducer(state, { type: 'ADD_DEPENDENTE', payload: { nome: 'Filho 2026' } });
    state = reducer(state, { type: 'SWITCH_ANO', payload: 2025 });
    expect(state.dependentes).toEqual([{ id: 1, nome: 'Filho 2025' }]); // volta pro 2025, com o dependente de 2025 intacto
  });

  it('bug real: IMPORT_DECLARACAO de um titular DIFERENTE não pode deixar o dependente do titular anterior grudado', () => {
    let state = { ...initialState, anoCalendario: 2025, contribuinte: { cpf: '11111111111', nome: 'Fulano' }, dependentes: [{ id: 1, nome: 'Filho de Fulano' }] };
    state = reducer(state, { type: 'IMPORT_DECLARACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '99999999999', nome: 'Cicrano' },
      dependentes: [], // ImportPage manda vazio explicitamente quando detecta titular diferente
      bens: [], dividas: [], rendimentos: [], pagamentos: [],
    }});
    expect(state.contribuinte).toEqual({ cpf: '99999999999', nome: 'Cicrano' });
    expect(state.dependentes).toEqual([]);
  });

  it('IMPORT_DECLARACAO preserva os dependentes já cadastrados no ano de destino (import não traz dependentes)', () => {
    let state = { ...initialState, anoCalendario: 2025, dependentes: [{ id: 1, nome: 'Filho' }] };
    state = reducer(state, { type: 'IMPORT_DECLARACAO', payload: {
      anoCalendario: 2025,
      contribuinte: { cpf: '11111111111', nome: 'Fulano' },
      bens: [{ id: 1, codigo_bem: '21', situacao_anterior: 100, situacao_atual: 100 }],
      dividas: [], rendimentos: [], pagamentos: [],
    }});
    expect(state.dependentes).toEqual([{ id: 1, nome: 'Filho' }]);
  });
});

// Regressão do achado A1 da auditoria de 21/08/2026: importando só o PDF, o
// Dashboard fechava com "Total Geral dos Rendimentos R$ 0,00" e um Saldo de
// Caixa muito negativo, sem nenhum sinal de que faltava metade da declaração.
// O formato do arquivo passou a ficar guardado no ano para as telas de resumo
// poderem avisar.
describe('importFormato: o ano guarda de qual arquivo veio a importação', () => {
  const payloadPdf = {
    anoCalendario: 2025,
    formato: 'pdf',
    contribuinte: { nome: 'FULANO', cpf: '11111111111' },
    bens: [{ ...bemBase }],
    dividas: [],
    rendimentos: [],
    pagamentos: [],
    documentoFonte: { formato: 'pdf', textoIntegral: 'fonte integral', sha256TextoExtraido: 'abc' },
  };

  it('grava o formato na importação', () => {
    const s = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadPdf });
    expect(s.importFormato).toBe('pdf');
    expect(s.origemAnoAtual).toBe('importacao');
    expect(s.documentoFonte.textoIntegral).toBe('fonte integral');
  });

  it('reimportar o .DBK por cima do PDF atualiza o formato', () => {
    const comPdf = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadPdf });
    const comDbk = reducer(comPdf, {
      type: 'IMPORT_DECLARACAO',
      payload: { ...payloadPdf, formato: 'dbk', rendimentos: [{ id: 9, tipo: 'tributavel_pj', valor: 1000 }] },
    });
    expect(comDbk.importFormato).toBe('dbk');
    expect(comDbk.rendimentos).toHaveLength(1);
  });

  it('payload sem a chave formato preserva o que já estava', () => {
    const comPdf = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadPdf });
    const { formato, ...semFormato } = payloadPdf;
    const depois = reducer(comPdf, { type: 'IMPORT_DECLARACAO', payload: semFormato });
    expect(depois.importFormato).toBe('pdf');
  });

  it('avançar o ano zera o formato: ano novo não tem declaração por trás', () => {
    const comPdf = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadPdf });
    const proximo = reducer(comPdf, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(proximo.anoCalendario).toBe(2026);
    expect(proximo.origemAnoAtual).toBe('manual');
    expect(proximo.importFormato).toBeNull();
    // e o ano arquivado mantém o formato dele
    expect(proximo.historico[2025].importFormato).toBe('pdf');
  });

  it('voltar para o ano arquivado traz o formato de volta', () => {
    const comPdf = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadPdf });
    const proximo = reducer(comPdf, { type: 'ROLLOVER_ANO', payload: 2026 });
    const voltou = reducer(proximo, { type: 'LOAD_HISTORICO', payload: 2025 });
    expect(voltou.importFormato).toBe('pdf');
  });
});

// Regressão do achado A5: importar pela tela de criação de perfil não deixava
// rastro no Histórico de Alterações, porque aquele caminho chamava `reducer`
// direto em vez de `reducerComHistorico`.
describe('importação registrada no Histórico de Alterações', () => {
  it('IMPORT_DECLARACAO gera entrada no histórico', () => {
    const s = reducerComHistorico(initialState, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, formato: 'dbk', contribuinte: { nome: 'FULANO', cpf: '11111111111' }, bens: [{ ...bemBase }], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(s.alteracoes).toHaveLength(1);
    expect(s.alteracoes[0].descricao).toContain('Importou declaração');
    expect(s.alteracoes[0].anoCalendario).toBe(2025);
  });
});

// Regressão do mesmo achado, do lado do fechamento do ano: com a apuração da
// Atividade Rural vindo só da declaração importada, fechar um ano com
// prejuízo rural não acumulava nada para compensar nos anos seguintes, apesar
// de a Lei 8.023/1990, art. 14, permitir a compensação nos anos-base
// posteriores.
describe('prejuízo rural a compensar acumula também com a apuração importada', () => {
  const anoImportado = (extras = {}) => ({
    ...initialState,
    anoCalendario: 2025,
    origemAnoAtual: 'importacao',
    contribuinte: { nome: 'FULANO', cpf: '11111111111' },
    bens: [{ ...bemBase }],
    receitasDespesasRuraisOficial: [
      { mes: 1, receitaBruta: 100000, despesaCusteioInvestimento: 400000 },
      { mes: 2, receitaBruta: 200000, despesaCusteioInvestimento: 300000 },
    ],
    ...extras,
  });

  it('ano importado com prejuízo acumula o prejuízo ao virar o ano', () => {
    const s = reducer(anoImportado(), { type: 'ROLLOVER_ANO', payload: 2026 });
    // (100.000 - 400.000) + (200.000 - 300.000) = -400.000
    expect(s.prejuizoRuralAcompensar).toBe(-400000);
  });

  it('ano importado com lucro não muda o saldo a compensar sozinho', () => {
    const comLucro = anoImportado({
      receitasDespesasRuraisOficial: [{ mes: 1, receitaBruta: 900000, despesaCusteioInvestimento: 100000 }],
    });
    const s = reducer(comLucro, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(s.prejuizoRuralAcompensar).toBe(0);
  });

  it('lançamento manual tem precedência: a apuração importada não soma junto', () => {
    const comManual = anoImportado({
      lancamentosRurais: [{ id: 1, tipo: 'despesa', valor: 50000, data: '2025-05-01' }],
    });
    const s = reducer(comManual, { type: 'ROLLOVER_ANO', payload: 2026 });
    // Só os -50.000 do lançamento manual, não os -400.000 da apuração.
    expect(s.prejuizoRuralAcompensar).toBe(-50000);
  });
});

// Aviso de ficha não importada: diferente dos demais campos "Oficial", este
// substitui SEMPRE, inclusive por lista vazia. Manter o aviso de uma
// importação anterior seria mentir sobre o arquivo novo.
describe('fichasNaoLidasComConteudo', () => {
  const importar = (estado, fichas) => reducer(estado, {
    type: 'IMPORT_DECLARACAO',
    payload: { anoCalendario: 2025, contribuinte: { cpf: '1', nome: 'X' }, bens: [], dividas: [], rendimentos: [], pagamentos: [], fichasNaoLidasComConteudo: fichas },
  });

  it('guarda as fichas reportadas pela importação', () => {
    const s = importar(initialState, ['MOVIMENTAÇÃO DO REBANHO - EXTERIOR']);
    expect(s.fichasNaoLidasComConteudo).toEqual(['MOVIMENTAÇÃO DO REBANHO - EXTERIOR']);
  });

  it('uma importação nova sem fichas pendentes APAGA o aviso da anterior', () => {
    const comAviso = importar(initialState, ['BENS DA ATIVIDADE RURAL - EXTERIOR']);
    expect(comAviso.fichasNaoLidasComConteudo).toHaveLength(1);
    // Reimportar a declaração corrigida (ou o .DBK, que não reporta nada) tem
    // que limpar o alerta, senão ele fica na tela para sempre.
    const semAviso = importar(comAviso, []);
    expect(semAviso.fichasNaoLidasComConteudo).toEqual([]);
  });

  it('payload sem o campo não quebra e resulta em lista vazia', () => {
    const s = reducer(initialState, {
      type: 'IMPORT_DECLARACAO',
      payload: { anoCalendario: 2025, contribuinte: { cpf: '1', nome: 'X' }, bens: [], dividas: [], rendimentos: [], pagamentos: [] },
    });
    expect(s.fichasNaoLidasComConteudo).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Ganhos de Capital detalhado e Renda Variável (FII/Fiagro e fechamentos
// anuais) precisam sobreviver ao ciclo completo do estado: entrar na
// importação, ir para o snapshot ao trocar de ano e NÃO vazar para o ano novo
// (o ganho de capital de 2025 não é ganho de 2026).
describe('IMPORT_DECLARACAO: Ganhos de Capital e Renda Variável', () => {
  const payloadBase = {
    anoCalendario: 2025,
    contribuinte: { cpf: '11144477735', nome: 'FULANO' },
    bens: [{ id: 1, discriminacao: 'CASA', situacao_anterior: 100, situacao_atual: 100 }],
    dividas: [], rendimentos: [], pagamentos: [],
    ganhosCapitalOficial: {
      consolidacao: { periodoInicio: '2025-01-01', periodoFim: '2025-12-31', pais: 'BRASIL' },
      operacoes: [{ id: 1, tipo: 'imovel', especificacao: 'APARTAMENTO', valorAlienacao: 800000 }],
      moedaEspecie: { operacoes: [], mensal: [{ mes: 1, ganhoCapital: 0 }] },
      origem: 'dbk',
    },
    apuracaoGanhoCapital: [{ id: 1, tipo: 'imovel', bem: 'APARTAMENTO', ganhoCapital: 476000 }],
    rendaVariavelAnualOficial: { resultadoLiquido: 9000 },
    fiiFiagroMensalOficial: [{ mes: 3, titular: true, resultadoLiquidoMes: 2500 }],
    fiiFiagroAnualOficial: { resultadoLiquido: 30000 },
  };

  it('guarda as quatro fichas de Ganhos de Capital e as duas de Renda Variável', () => {
    const s = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadBase });
    expect(s.ganhosCapitalOficial.operacoes[0].tipo).toBe('imovel');
    expect(s.ganhosCapitalOficial.moedaEspecie.mensal).toHaveLength(1);
    expect(s.fiiFiagroMensalOficial[0].resultadoLiquidoMes).toBe(2500);
    expect(s.rendaVariavelAnualOficial.resultadoLiquido).toBe(9000);
    expect(s.fiiFiagroAnualOficial.resultadoLiquido).toBe(30000);
  });

  it('reimportar por um caminho que não leu a ficha NÃO apaga o que já estava', () => {
    const comGc = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadBase });
    // Mesmo ano, payload sem nenhuma das fichas novas (o caminho PDF de uma
    // declaração sem ganho de capital, por exemplo).
    const semGc = reducer(comGc, {
      type: 'IMPORT_DECLARACAO',
      payload: { ...payloadBase, ganhosCapitalOficial: null, fiiFiagroMensalOficial: [], rendaVariavelAnualOficial: null, fiiFiagroAnualOficial: null },
    });
    expect(semGc.ganhosCapitalOficial).not.toBeNull();
    expect(semGc.fiiFiagroMensalOficial).toHaveLength(1);
    expect(semGc.rendaVariavelAnualOficial).not.toBeNull();
  });

  it('ao avançar o ano, vai para o histórico e o ano novo nasce sem elas', () => {
    const s2025 = reducer(initialState, { type: 'IMPORT_DECLARACAO', payload: payloadBase });
    const s2026 = reducer(s2025, { type: 'ROLLOVER_ANO', payload: 2026 });
    expect(s2026.anoCalendario).toBe(2026);
    expect(s2026.ganhosCapitalOficial).toBeNull();
    expect(s2026.fiiFiagroMensalOficial).toEqual([]);
    expect(s2026.rendaVariavelAnualOficial).toBeNull();
    expect(s2026.historico[2025].ganhosCapitalOficial.operacoes[0].especificacao).toBe('APARTAMENTO');
    expect(s2026.historico[2025].fiiFiagroMensalOficial).toHaveLength(1);
  });
});
