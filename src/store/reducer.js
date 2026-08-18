// Lógica pura do estado do app: nenhuma dependência de React aqui de
// propósito, para poder testar sem montar componente nenhum (ver
// reducer.test.js). O DataContext.jsx só faz a fiação com useReducer.

export const initialState = {
  anoCalendario: 2025,
  contribuinte: null,
  dependentes: [],
  bens: [],
  dividas: [],
  rendimentos: [],
  pagamentos: [],
  // Atividade Rural: ficha própria da declaração, fora do escopo de
  // bens/dívidas/rendimentos "comuns". imoveisRurais e bensRurais são
  // listas à parte (não entram em Bens e Direitos); lancamentosRurais é o
  // fluxo de receita/despesa do ano (log conforme acontece, como o resto
  // do app); prejuizoRuralAcompensar é um saldo que atravessa anos.
  imoveisRurais: [],
  bensRurais: [],
  lancamentosRurais: [],
  prejuizoRuralAcompensar: 0,
  // Despesas gerais (cartão, seguro, IPVA...) que NÃO são a ficha
  // "Pagamentos Efetuados" da declaração (essa é só o que é dedutível) —
  // fica separada de propósito.
  pagamentosDiversos: [],
  historico: {},
  toasts: [],
};

export const snapshotYear = (state) => ({
  bens: state.bens,
  dividas: state.dividas,
  rendimentos: state.rendimentos,
  pagamentos: state.pagamentos,
  contribuinte: state.contribuinte,
  imoveisRurais: state.imoveisRurais,
  bensRurais: state.bensRurais,
  lancamentosRurais: state.lancamentosRurais,
  prejuizoRuralAcompensar: state.prejuizoRuralAcompensar,
  pagamentosDiversos: state.pagamentosDiversos,
  savedAt: new Date().toISOString(),
});
export const hasWorkingData = (state) =>
  state.bens.length > 0 || state.dividas.length > 0 ||
  state.rendimentos.length > 0 || state.pagamentos.length > 0 ||
  (state.bensRurais || []).length > 0 || (state.pagamentosDiversos || []).length > 0 ||
  !!state.contribuinte;
export const blankYear = {
  bens: [], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null,
  bensRurais: [], lancamentosRurais: [], pagamentosDiversos: [],
  // imoveisRurais e prejuizoRuralAcompensar NÃO entram aqui de propósito:
  // imóveis explorados normalmente continuam os mesmos de um ano pro
  // outro (ver ROLLOVER_ANO) e o prejuízo é um saldo que atravessa anos,
  // não algo que zera ao começar um ano em branco.
};

export function reducer(state, action) {
  switch (action.type) {
    case 'SET_DEPENDENTES':
      return { ...state, dependentes: action.payload };
    case 'ADD_BEM':
      return { ...state, bens: [...state.bens, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_BEM':
      return { ...state, bens: state.bens.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BEM':
      return { ...state, bens: state.bens.filter(b => b.id !== action.payload) };
    case 'ADD_DIVIDA':
      return { ...state, dividas: [...state.dividas, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_DIVIDA':
      return { ...state, dividas: state.dividas.map(d => d.id === action.payload.id ? action.payload : d) };
    case 'DELETE_DIVIDA':
      return { ...state, dividas: state.dividas.filter(d => d.id !== action.payload) };
    case 'ADD_RENDIMENTO':
      return { ...state, rendimentos: [...state.rendimentos, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.map(r => r.id === action.payload.id ? action.payload : r) };
    case 'DELETE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.filter(r => r.id !== action.payload) };
    case 'ADD_PAGAMENTO':
      return { ...state, pagamentos: [...state.pagamentos, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.filter(p => p.id !== action.payload) };
    case 'SAVE_HISTORICO': {
      const ano = state.anoCalendario;
      return { ...state, historico: { ...state.historico, [ano]: snapshotYear(state) } };
    }
    case 'LOAD_HISTORICO': {
      const targetAno = action.payload;
      const h = state.historico[targetAno];
      if (!h) return state;
      // Arquiva o ano corrente antes de trocar, senão dados não salvos no
      // histórico seriam sobrescritos silenciosamente pelo ano carregado.
      const historico = hasWorkingData(state)
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      return { ...state, ...h, historico, anoCalendario: targetAno };
    }
    // Troca o ano-calendário de trabalho (seletor da sidebar): arquiva o ano
    // corrente no histórico e carrega o ano de destino (ou começa em branco,
    // se ainda não houver histórico salvo para ele). Sem isso, trocar o ano
    // só re-rotulava os dados do ano anterior, misturando exercícios.
    case 'SWITCH_ANO': {
      const novoAno = action.payload;
      if (novoAno === state.anoCalendario) return state;
      const historico = hasWorkingData(state)
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      const destino = historico[novoAno] || blankYear;
      return { ...state, ...destino, historico, anoCalendario: novoAno };
    }
    // Vira o ano de trabalho trazendo o saldo final do ano corrente como
    // situação inicial do próximo (situacao_atual de cada bem/dívida vira a
    // situacao_anterior do novo ano; situacao_atual começa igual, até a
    // usuária lançar uma movimentação real). Sem isso, o propósito central
    // do app, importar a base uma vez e ir lançando compra/venda/baixa ao
    // longo do ano seguinte, não tem como funcionar: cada novo ano nascia
    // vazio e a usuária teria que recadastrar tudo à mão.
    // Rendimentos e pagamentos são fluxos do período, não saldo: começam
    // zerados no novo ano.
    case 'ROLLOVER_ANO': {
      const novoAno = action.payload;
      if (novoAno === state.anoCalendario) return state;
      const historico = hasWorkingData(state)
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      const existente = historico[novoAno];
      if (existente) return { ...state, ...existente, historico, anoCalendario: novoAno };
      let seq = Date.now();
      // Se a atividade rural deu prejuízo no ano que está fechando, esse
      // prejuízo se soma ao saldo a compensar (regra real: prejuízo de
      // atividade rural pode ser compensado nos anos seguintes). Se deu
      // lucro, o saldo a compensar não muda sozinho — quanto compensar
      // desse lucro é escolha da usuária (ver AJUSTAR_PREJUIZO_RURAL).
      const resultadoRuralDoAno = (state.lancamentosRurais || []).reduce(
        (s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0
      );
      const prejuizoRuralAcompensar = state.prejuizoRuralAcompensar + Math.min(0, resultadoRuralDoAno);
      return {
        ...state,
        historico,
        anoCalendario: novoAno,
        bens: state.bens.map(b => ({ ...b, id: seq++, situacao_anterior: b.situacao_atual })),
        dividas: state.dividas.map(d => ({ ...d, id: seq++, situacao_anterior: d.situacao_atual, valor_pago: 0 })),
        bensRurais: state.bensRurais.map(b => ({ ...b, id: seq++, situacao_anterior: b.situacao_atual })),
        rendimentos: [],
        pagamentos: [],
        lancamentosRurais: [],
        pagamentosDiversos: [],
        prejuizoRuralAcompensar,
      };
    }
    // Import atômico de uma declaração já parseada (.DBK/.DEC ou PDF). Se o
    // arquivo trouxe o ano-calendário (lido do cabeçalho), troca para esse
    // ano arquivando o corrente antes, assim a declaração cai no exercício
    // certo mesmo que a tela estivesse mostrando outro ano. Um resultado
    // vazio numa categoria (ex.: PDF não lê rendimentos) só é gravado como
    // vazio ao entrar num ano novo; no mesmo ano, preserva o que já existe
    // ali para não apagar uma categoria que o import não cobriu.
    case 'IMPORT_DECLARACAO': {
      const { anoCalendario, contribuinte, bens, dividas, rendimentos, pagamentos } = action.payload;
      const ano = anoCalendario || state.anoCalendario;
      const mesmoAno = ano === state.anoCalendario;
      const historico = !mesmoAno && hasWorkingData(state)
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      const base = mesmoAno ? state : blankYear;
      return {
        ...state,
        historico,
        anoCalendario: ano,
        contribuinte: contribuinte || base.contribuinte,
        bens: (bens && bens.length > 0) ? bens : base.bens,
        dividas: (dividas && dividas.length > 0) ? dividas : base.dividas,
        rendimentos: (rendimentos && rendimentos.length > 0) ? rendimentos : base.rendimentos,
        pagamentos: (pagamentos && pagamentos.length > 0) ? pagamentos : base.pagamentos,
        // O import não traz nada de atividade rural (fora do escopo dos
        // parsers) nem de despesas gerais — ao trocar de ano, essas listas
        // têm que zerar como as demais, senão o ano novo nasceria com bens
        // rurais/despesas de um ano completamente diferente coladas nele.
        // imoveisRurais e prejuizoRuralAcompensar continuam como estão
        // (mesmo raciocínio do ROLLOVER_ANO/SWITCH_ANO: são coisas que
        // atravessam anos, não um fluxo do período).
        bensRurais: base.bensRurais,
        lancamentosRurais: base.lancamentosRurais,
        pagamentosDiversos: base.pagamentosDiversos,
      };
    }
    // Registra uma movimentação (venda total/parcial, compra, benfeitoria,
    // baixa, ajuste) num bem existente: guarda a movimentação no histórico
    // do próprio bem (rastreável, não é uma sobrescrita muda) e recalcula a
    // situação atual a partir dela. `colecao` deixa reaproveitar a mesma
    // lógica para os bens da atividade rural (ver REGISTRAR_MOVIMENTACAO_BEM_RURAL).
    // Vendas podem trazer `valorVenda` (preço recebido, diferente do
    // `valor` = parcela do custo que sai) — é o dado que a aba Ganhos de
    // Capital usa pra calcular ganho/perda automaticamente.
    case 'REGISTRAR_MOVIMENTACAO_BEM':
    case 'REGISTRAR_MOVIMENTACAO_BEM_RURAL': {
      const { bemId, movimentacao } = action.payload;
      const colecao = action.type === 'REGISTRAR_MOVIMENTACAO_BEM_RURAL' ? 'bensRurais' : 'bens';
      return {
        ...state,
        [colecao]: state[colecao].map(b => {
          if (b.id !== bemId) return b;
          const mov = { ...movimentacao, id: Date.now() };
          let situacao_atual = b.situacao_atual;
          if (mov.tipo === 'compra' || mov.tipo === 'benfeitoria') situacao_atual += mov.valor;
          else if (mov.tipo === 'venda_parcial') situacao_atual = Math.max(0, situacao_atual - mov.valor);
          else if (mov.tipo === 'venda_total' || mov.tipo === 'baixa') situacao_atual = 0;
          else if (mov.tipo === 'ajuste') situacao_atual = mov.valor;
          return { ...b, situacao_atual, movimentacoes: [...(b.movimentacoes || []), mov] };
        }),
      };
    }
    case 'ADD_BEM_RURAL':
      return { ...state, bensRurais: [...state.bensRurais, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_BEM_RURAL':
      return { ...state, bensRurais: state.bensRurais.map(b => b.id === action.payload.id ? action.payload : b) };
    case 'DELETE_BEM_RURAL':
      return { ...state, bensRurais: state.bensRurais.filter(b => b.id !== action.payload) };

    case 'ADD_IMOVEL_RURAL':
      return { ...state, imoveisRurais: [...state.imoveisRurais, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_IMOVEL_RURAL':
      return { ...state, imoveisRurais: state.imoveisRurais.map(i => i.id === action.payload.id ? action.payload : i) };
    case 'DELETE_IMOVEL_RURAL':
      return { ...state, imoveisRurais: state.imoveisRurais.filter(i => i.id !== action.payload) };

    // Receita/despesa da atividade rural, lançada conforme acontece (como
    // o resto do app) em vez de preencher um formulário anual de uma vez.
    case 'ADD_LANCAMENTO_RURAL':
      return { ...state, lancamentosRurais: [...state.lancamentosRurais, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_LANCAMENTO_RURAL':
      return { ...state, lancamentosRurais: state.lancamentosRurais.map(l => l.id === action.payload.id ? action.payload : l) };
    case 'DELETE_LANCAMENTO_RURAL':
      return { ...state, lancamentosRurais: state.lancamentosRurais.filter(l => l.id !== action.payload) };

    // Ajusta o saldo de prejuízo da atividade rural a compensar (soma ou
    // subtrai o valor informado). Fica como ação explícita porque quanto
    // compensar num ano de lucro é uma escolha da usuária, não uma conta
    // automática — não temos confirmação da regra atual de limite de
    // compensação para aplicar isso sozinho.
    case 'AJUSTAR_PREJUIZO_RURAL':
      return { ...state, prejuizoRuralAcompensar: state.prejuizoRuralAcompensar + action.payload };

    case 'ADD_PAGAMENTO_DIVERSO':
      return { ...state, pagamentosDiversos: [...state.pagamentosDiversos, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_PAGAMENTO_DIVERSO':
      return { ...state, pagamentosDiversos: state.pagamentosDiversos.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'DELETE_PAGAMENTO_DIVERSO':
      return { ...state, pagamentosDiversos: state.pagamentosDiversos.filter(p => p.id !== action.payload) };
    // Exclui um ano inteiro do histórico (declaração importada/salva). Se for
    // o ano corrente sendo exibido, limpa também a tela, senão ficaria um
    // ano "fantasma" sem registro nenhum no histórico.
    case 'DELETE_HISTORICO_ANO': {
      const ano = action.payload;
      const historico = { ...state.historico };
      delete historico[ano];
      if (ano === state.anoCalendario) {
        return { ...state, historico, ...blankYear };
      }
      return { ...state, historico };
    }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    default:
      return state;
  }
}
