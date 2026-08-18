import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';

const DataContext = createContext(null);

const initialState = {
  anoCalendario: 2025,
  contribuinte: null,
  dependentes: [],
  bens: [],
  dividas: [],
  rendimentos: [],
  pagamentos: [],
  atividadeRural: null,
  historico: {},
  toasts: [],
};

const snapshotYear = (state) => ({
  bens: state.bens,
  dividas: state.dividas,
  rendimentos: state.rendimentos,
  pagamentos: state.pagamentos,
  contribuinte: state.contribuinte,
  savedAt: new Date().toISOString(),
});
const hasWorkingData = (state) =>
  state.bens.length > 0 || state.dividas.length > 0 ||
  state.rendimentos.length > 0 || state.pagamentos.length > 0 || !!state.contribuinte;
const blankYear = { bens: [], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null };

function reducer(state, action) {
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
    // do app — importar a base uma vez e ir lançando compra/venda/baixa ao
    // longo do ano seguinte — não tem como funcionar: cada novo ano nascia
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
      return {
        ...state,
        historico,
        anoCalendario: novoAno,
        bens: state.bens.map(b => ({ ...b, id: seq++, situacao_anterior: b.situacao_atual })),
        dividas: state.dividas.map(d => ({ ...d, id: seq++, situacao_anterior: d.situacao_atual, valor_pago: 0 })),
        rendimentos: [],
        pagamentos: [],
      };
    }
    // Import atômico de uma declaração já parseada (.DBK/.DEC ou PDF). Se o
    // arquivo trouxe o ano-calendário (lido do cabeçalho), troca para esse
    // ano arquivando o corrente antes — assim a declaração cai no exercício
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
      };
    }
    // Registra uma movimentação (venda total/parcial, compra, benfeitoria,
    // baixa, ajuste) num bem existente: guarda a movimentação no histórico
    // do próprio bem (rastreável, não é uma sobrescrita muda) e recalcula a
    // situação atual a partir dela.
    case 'REGISTRAR_MOVIMENTACAO_BEM': {
      const { bemId, movimentacao } = action.payload;
      return {
        ...state,
        bens: state.bens.map(b => {
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
    // Exclui um ano inteiro do histórico (declaração importada/salva). Se for
    // o ano corrente sendo exibido, limpa também a tela — senão ficaria um
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

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => {
    try {
      const saved = localStorage.getItem('controle-patrimonial-data');
      if (saved) return { ...initialState, ...JSON.parse(saved) };
    } catch {}
    return initialState;
  });

  const saveToStorage = useCallback(() => {
    try {
      const { toasts, ...data } = state;
      localStorage.setItem('controle-patrimonial-data', JSON.stringify(data));
    } catch {}
  }, [state]);

  // Autosave: evita perder dados de quem esquecer de clicar em "Salvar Dados".
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveToStorage();
  }, [state, saveToStorage]);

  const addToast = useCallback((message, type = 'info') => {
    // O id tem que ser o MESMO usado depois no REMOVE_TOAST — o reducer não
    // pode gerar um id novo aqui, senão o aviso nunca é removido (bug real:
    // o toast ficava preso na tela para sempre).
    const id = Date.now() + Math.random();
    dispatch({ type: 'ADD_TOAST', payload: { id, message, type } });
    setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
  }, []);

  return (
    <DataContext.Provider value={{ state, dispatch, saveToStorage, addToast }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}