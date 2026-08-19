// Lógica pura do estado do app: nenhuma dependência de React aqui de
// propósito, para poder testar sem montar componente nenhum (ver
// reducer.test.js). O DataContext.jsx só faz a fiação com useReducer.

export const initialState = {
  // null até a primeira importação/cadastro: o app é genérico, não nasce
  // preso a um ano fixo. A Sidebar oferece "começar pelo ano X" e o import
  // define o ano a partir do cabeçalho da declaração.
  anoCalendario: null,
  // Origem do ano ativo: 'importacao' (veio de um arquivo .DBK/.DEC/PDF
  // importado) ou 'manual' (começou por cadastro direto ou virada de ano).
  // Separa o conceito de "declaração importada" (documento atemporal,
  // exibido em Importar > Histórico de Declarações) do conceito de "ano de
  // trabalho ativo" (que muda por virada de ano) — sem essa distinção, um
  // ano que só existia por ter sido avançado manualmente (nunca importado)
  // aparecia como se fosse uma declaração de verdade.
  origemAnoAtual: null,
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
  // Log de alterações (quem mudou o quê, quando) — global, atravessa anos
  // (não faz parte de snapshotYear/blankYear de propósito, ver
  // reducerComHistorico mais abaixo).
  alteracoes: [],
  toasts: [],
};

export const snapshotYear = (state) => ({
  bens: state.bens,
  dividas: state.dividas,
  rendimentos: state.rendimentos,
  pagamentos: state.pagamentos,
  contribuinte: state.contribuinte,
  // dependentes é por ano (como contribuinte) — a declaração de um ano tem
  // sua própria lista de dependentes; faltava aqui (bug real: trocar de ano
  // e voltar perdia os dependentes cadastrados, porque nunca eram
  // arquivados no snapshot).
  dependentes: state.dependentes,
  imoveisRurais: state.imoveisRurais,
  bensRurais: state.bensRurais,
  lancamentosRurais: state.lancamentosRurais,
  prejuizoRuralAcompensar: state.prejuizoRuralAcompensar,
  pagamentosDiversos: state.pagamentosDiversos,
  origem: state.origemAnoAtual,
  savedAt: new Date().toISOString(),
});
export const hasWorkingData = (state) =>
  state.bens.length > 0 || state.dividas.length > 0 ||
  state.rendimentos.length > 0 || state.pagamentos.length > 0 ||
  (state.bensRurais || []).length > 0 || (state.pagamentosDiversos || []).length > 0 ||
  (state.dependentes || []).length > 0 ||
  !!state.contribuinte;
// Mesmo critério para um snapshot do histórico: ano "avançado" por engano
// ou herdado de versão antiga pode existir no histórico completamente vazio
// — e ano vazio NÃO é "ano com dado" (não entra no seletor nem nos gráficos).
export const snapshotHasData = (h) =>
  !!h && hasWorkingData({
    bens: h.bens || [], dividas: h.dividas || [], rendimentos: h.rendimentos || [],
    pagamentos: h.pagamentos || [], bensRurais: h.bensRurais || [],
    pagamentosDiversos: h.pagamentosDiversos || [], dependentes: h.dependentes || [], contribuinte: h.contribuinte || null,
  });
export const blankYear = {
  bens: [], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null, dependentes: [],
  bensRurais: [], lancamentosRurais: [], pagamentosDiversos: [],
  // imoveisRurais e prejuizoRuralAcompensar NÃO entram aqui de propósito:
  // imóveis explorados normalmente continuam os mesmos de um ano pro
  // outro (ver ROLLOVER_ANO) e o prejuízo é um saldo que atravessa anos,
  // não algo que zera ao começar um ano em branco.
};

export function reducer(state, action) {
  switch (action.type) {
    // Titular e dependentes cadastrados/corrigidos à mão (nem sempre vêm de
    // uma importação — ver TitularPage). São por ano, como o resto da
    // declaração: mudar de ano-calendário troca de titular/dependentes
    // junto (ver snapshotYear/blankYear).
    case 'SET_CONTRIBUINTE':
      return { ...state, contribuinte: action.payload };
    case 'ADD_DEPENDENTE':
      return { ...state, dependentes: [...state.dependentes, { ...action.payload, id: Date.now() }] };
    case 'UPDATE_DEPENDENTE':
      return { ...state, dependentes: state.dependentes.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DEPENDENTE':
      return { ...state, dependentes: state.dependentes.filter(d => d.id !== action.payload) };
    // origem: 'manual' marca que o item nasceu de um cadastro direto (não de
    // um arquivo importado) — é o que permite, numa reimportação de
    // retificadora, distinguir o que é seguro sobrescrever do que tem que
    // ficar intocado (ver RECONCILIAR_IMPORTACAO mais abaixo).
    case 'ADD_BEM':
      return { ...state, bens: [...state.bens, { ...action.payload, id: Date.now(), origem: 'manual' }] };
    case 'UPDATE_BEM':
      return { ...state, bens: state.bens.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b) };
    case 'DELETE_BEM':
      return { ...state, bens: state.bens.filter(b => b.id !== action.payload) };
    case 'ADD_DIVIDA':
      return { ...state, dividas: [...state.dividas, { ...action.payload, id: Date.now(), origem: 'manual' }] };
    case 'UPDATE_DIVIDA':
      return { ...state, dividas: state.dividas.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DIVIDA':
      return { ...state, dividas: state.dividas.filter(d => d.id !== action.payload) };
    case 'ADD_RENDIMENTO':
      return { ...state, rendimentos: [...state.rendimentos, { ...action.payload, id: Date.now(), origem: 'manual' }] };
    case 'UPDATE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r) };
    case 'DELETE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.filter(r => r.id !== action.payload) };
    case 'ADD_PAGAMENTO':
      return { ...state, pagamentos: [...state.pagamentos, { ...action.payload, id: Date.now(), origem: 'manual' }] };
    case 'UPDATE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'DELETE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.filter(p => p.id !== action.payload) };
    case 'SAVE_HISTORICO': {
      // Sem ano definido (antes da 1ª importação) não há o que arquivar.
      if (state.anoCalendario == null) return state;
      const ano = state.anoCalendario;
      return { ...state, historico: { ...state.historico, [ano]: snapshotYear(state) } };
    }
    case 'LOAD_HISTORICO': {
      const targetAno = action.payload;
      const h = state.historico[targetAno];
      if (!h) return state;
      // Arquiva o ano corrente antes de trocar, senão dados não salvos no
      // histórico seriam sobrescritos silenciosamente pelo ano carregado.
      const historico = hasWorkingData(state) && state.anoCalendario != null
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      return { ...state, ...h, historico, anoCalendario: targetAno, origemAnoAtual: h.origem ?? null };
    }
    // Troca o ano-calendário de trabalho (seletor da sidebar): arquiva o ano
    // corrente no histórico e carrega o ano de destino (ou começa em branco,
    // se ainda não houver histórico salvo para ele). Sem isso, trocar o ano
    // só re-rotulava os dados do ano anterior, misturando exercícios.
    case 'SWITCH_ANO': {
      const novoAno = action.payload;
      if (novoAno === state.anoCalendario) return state;
      const historico = hasWorkingData(state) && state.anoCalendario != null
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      const destino = historico[novoAno] || blankYear;
      return { ...state, ...destino, historico, anoCalendario: novoAno, origemAnoAtual: destino.origem ?? null };
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
      const historico = hasWorkingData(state) && state.anoCalendario != null
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      // Sem ano definido (antes da 1ª importação): se o ano de destino tem
      // histórico, carrega; senão, o que foi cadastrado manualmente pertence
      // ao ano que está sendo iniciado agora.
      if (state.anoCalendario == null) {
        const existente = historico[novoAno];
        if (existente) return { ...state, ...existente, historico, anoCalendario: novoAno, origemAnoAtual: existente.origem ?? null };
        return { ...state, historico, anoCalendario: novoAno, origemAnoAtual: 'manual' };
      }
      const existente = historico[novoAno];
      if (existente) return { ...state, ...existente, historico, anoCalendario: novoAno, origemAnoAtual: existente.origem ?? null };
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
        origemAnoAtual: 'manual',
        bens: state.bens.map(b => ({ ...b, id: seq++, situacao_anterior: b.situacao_atual })),
        dividas: state.dividas.map(d => ({ ...d, id: seq++, situacao_anterior: d.situacao_atual, valor_pago: 0, movimentacoes: [] })),
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
      const { anoCalendario, contribuinte, dependentes, bens, dividas, rendimentos, pagamentos } = action.payload;
      const ano = anoCalendario || state.anoCalendario || new Date().getFullYear();
      const mesmoAno = ano === state.anoCalendario;
      const historico = !mesmoAno && hasWorkingData(state) && state.anoCalendario != null
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      // Antes da 1ª importação (anoCalendario null), dados cadastrados à mão
      // pertencem ao ano da declaração que está entrando — mescla em vez de
      // zerar.
      const base = (mesmoAno || state.anoCalendario == null) ? state : blankYear;
      // origem: 'importacao' em cada item (não só no ano) é o que permite
      // uma reimportação futura (retificadora) saber quais itens vieram do
      // arquivo e quais foram incluídos à mão por cima — ver
      // RECONCILIAR_IMPORTACAO.
      const marcarImportacao = (lista) => (lista || []).map(item => ({ ...item, origem: 'importacao' }));
      return {
        ...state,
        historico,
        anoCalendario: ano,
        // Este ano passa a ter um arquivo de declaração de verdade por
        // trás — é o que diferencia de um ano que só existia por ter sido
        // avançado manualmente (ver Importar > Histórico de Declarações).
        origemAnoAtual: 'importacao',
        contribuinte: contribuinte || base.contribuinte,
        bens: (bens && bens.length > 0) ? marcarImportacao(bens) : base.bens,
        dividas: (dividas && dividas.length > 0) ? marcarImportacao(dividas) : base.dividas,
        rendimentos: (rendimentos && rendimentos.length > 0) ? marcarImportacao(rendimentos) : base.rendimentos,
        pagamentos: (pagamentos && pagamentos.length > 0) ? marcarImportacao(pagamentos) : base.pagamentos,
        // O import não traz nada de atividade rural (fora do escopo dos
        // parsers) nem de despesas gerais — ao trocar de ano, essas listas
        // têm que zerar como as demais, senão o ano novo nasceria com bens
        // rurais/despesas de um ano completamente diferente coladas nele.
        // imoveisRurais e prejuizoRuralAcompensar continuam como estão
        // (mesmo raciocínio do ROLLOVER_ANO/SWITCH_ANO: são coisas que
        // atravessam anos, não um fluxo do período).
        // O import não traz dependentes (fora do escopo dos parsers): por
        // padrão, quem já estava cadastrado no ano de destino continua —
        // MAS quando o titular importado é outro (ver ImportPage), o
        // chamador passa `dependentes: []` explicitamente pra não deixar
        // dependente do titular antigo grudado no novo. `undefined` (chave
        // ausente no payload) é o sinal de "mantenha o que já tem".
        dependentes: dependentes !== undefined ? dependentes : base.dependentes,
        bensRurais: base.bensRurais,
        lancamentosRurais: base.lancamentosRurais,
        pagamentosDiversos: base.pagamentosDiversos,
      };
    }
    // Reimportação de uma declaração retificadora (mesmo ano-calendário,
    // mesmo titular): diferente de IMPORT_DECLARACAO, que troca a lista
    // inteira, aqui a usuária já revisou e confirmou a vinculação item a
    // item na tela de conciliação (ver ReconciliacaoRetificadoraModal) —
    // o reducer só aplica a decisão. Itens vinculados atualizam os campos
    // declarados mas preservam id e movimentações já lançadas (a correção
    // da declaração anterior não pode apagar uma venda/amortização já
    // registrada); itens novos entram como importação; itens antigos sem
    // vínculo são removidos ou mantidos conforme a escolha da usuária.
    // Bens/dívidas fora dessa reconciliação (origem 'manual', ou não
    // mencionados) e rendimentos/pagamentos manuais nunca são tocados.
    case 'RECONCILIAR_IMPORTACAO': {
      const { anoCalendario: anoAlvo, contribuinte, bens, dividas, rendimentos, pagamentos } = action.payload;
      const mesmoAno = anoAlvo === state.anoCalendario;
      const historico = !mesmoAno && hasWorkingData(state) && state.anoCalendario != null
        ? { ...state.historico, [state.anoCalendario]: snapshotYear(state) }
        : state.historico;
      const base = mesmoAno ? state : (historico[anoAlvo] || blankYear);

      const reconciliarColecao = (listaBase, decisao) => {
        if (!decisao) return listaBase;
        const { vinculados = [], novos = [], removerAntigos = [] } = decisao;
        const vinculoPorId = new Map(vinculados.map(v => [v.idAntigo, v.dados]));
        const removerSet = new Set(removerAntigos);
        let seq = Date.now();
        const atualizados = (listaBase || [])
          .filter(item => !removerSet.has(item.id))
          .map(item => {
            const dados = vinculoPorId.get(item.id);
            if (!dados) return item;
            // A correção troca o valor declarado; se já havia movimentação
            // (delta entre situacao_atual e situacao_anterior originais),
            // esse delta é preservado por cima do novo valor de partida —
            // senão uma venda parcial já lançada seria apagada em silêncio.
            const deltaMovimentado = (item.situacao_atual ?? 0) - (item.situacao_anterior ?? 0);
            // `dados` é espalhado por cima em vez de campo a campo: bens
            // guardam o código em codigo_bem e dívidas em codigo, então quem
            // monta `dados` (a tela de conciliação) já sabe o nome certo —
            // o reducer não precisa (nem deve) supor qual é.
            return {
              ...item,
              ...dados,
              situacao_atual: dados.situacao_anterior + deltaMovimentado,
              origem: 'importacao',
            };
          });
        const novosComId = novos.map(n => ({ ...n, id: seq++, origem: 'importacao' }));
        return [...atualizados, ...novosComId];
      };

      // Rendimentos e pagamentos não têm o conceito de movimentação em cima
      // deles (são lançamentos do período, não saldo) — a reconciliação é
      // mais simples: tira só os que vieram de importação e ainda estão
      // marcados como tal, entra a lista nova por cima, e o que foi
      // cadastrado à mão (origem 'manual', ou sem marca por ser de uma
      // versão anterior a essa distinção) não é tocado.
      const substituirImportados = (listaBase, novaLista) => [
        ...(listaBase || []).filter(item => item.origem !== 'importacao'),
        ...(novaLista || []).map(item => ({ ...item, id: Date.now() + Math.random(), origem: 'importacao' })),
      ];

      return {
        ...state,
        historico,
        anoCalendario: anoAlvo,
        origemAnoAtual: 'importacao',
        contribuinte: contribuinte || base.contribuinte,
        dependentes: base.dependentes,
        bens: reconciliarColecao(base.bens, bens),
        dividas: reconciliarColecao(base.dividas, dividas),
        rendimentos: substituirImportados(base.rendimentos, rendimentos),
        pagamentos: substituirImportados(base.pagamentos, pagamentos),
        bensRurais: base.bensRurais,
        imoveisRurais: base.imoveisRurais,
        lancamentosRurais: base.lancamentosRurais,
        prejuizoRuralAcompensar: base.prejuizoRuralAcompensar,
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
    // Mesma mecânica do REGISTRAR_MOVIMENTACAO_BEM acima, mas para dívidas:
    // contratação soma ao saldo, amortização subtrai (sem passar de zero),
    // quitação zera, ajuste substitui. Sem isso, o filtro por data do
    // demonstrativo não tem como reconstruir o saldo de uma dívida no meio
    // do ano (só existiam os saldos de 31/12 anterior/atual). O payload
    // reaproveita a chave `bemId` do MovimentacaoBemForm (o form é genérico).
    case 'REGISTRAR_MOVIMENTACAO_DIVIDA': {
      const { bemId: dividaId, movimentacao } = action.payload;
      return {
        ...state,
        dividas: state.dividas.map(d => {
          if (d.id !== dividaId) return d;
          const mov = { ...movimentacao, id: Date.now() };
          let situacao_atual = d.situacao_atual;
          if (mov.tipo === 'contratacao') situacao_atual += mov.valor;
          else if (mov.tipo === 'amortizacao') situacao_atual = Math.max(0, situacao_atual - mov.valor);
          else if (mov.tipo === 'quitacao') situacao_atual = 0;
          else if (mov.tipo === 'ajuste') situacao_atual = mov.valor;
          return { ...d, situacao_atual, movimentacoes: [...(d.movimentacoes || []), mov] };
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
        // Sem ano fantasma: se sobrou outro ano com dado, passa a exibir o
        // mais recente dele; se não sobrou nenhum, volta ao estado inicial
        // sem ano (onboarding), em vez de um ano sem registro nenhum.
        const restantes = Object.keys(historico).map(Number).sort((a, b) => b - a);
        if (restantes.length > 0) {
          const destino = historico[restantes[0]];
          return { ...state, ...destino, historico, anoCalendario: restantes[0], origemAnoAtual: destino.origem ?? null };
        }
        return { ...state, ...blankYear, historico, anoCalendario: null, origemAnoAtual: null };
      }
      return { ...state, historico };
    }
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.payload] };
    case 'CLOSE_TOAST':
      return { ...state, toasts: state.toasts.map(t => t.id === action.payload ? { ...t, closing: true } : t) };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
    default:
      return state;
  }
}

const CAMPO_DESCRICAO_POR_COLECAO = {
  bens: 'discriminacao', dividas: 'discriminacao', rendimentos: 'nome_fonte',
  pagamentos: 'nome_beneficiario', bensRurais: 'discriminacao', imoveisRurais: 'nomeLocalizacao',
  lancamentosRurais: 'descricao', pagamentosDiversos: 'descricao', dependentes: 'nome',
};

function itemLabel(colecao, item) {
  if (!item) return '';
  const campo = CAMPO_DESCRICAO_POR_COLECAO[colecao];
  const bruto = (item[campo] || '').toString().trim().substring(0, 60);
  return bruto || '(sem descrição)';
}

function buscar(state, colecao, id) {
  return (state[colecao] || []).find(i => i.id === id);
}

// Frase legível pro histórico de alterações, a partir da ação já aplicada.
// Roda sobre o estado ANTES da mutação de propósito: é onde ainda dá pra
// achar a descrição de um item que acabou de ser excluído (no estado novo
// ele já não existe mais).
function descreverAcao(state, action) {
  const p = action.payload;
  switch (action.type) {
    case 'ADD_BEM': return `Cadastrou bem: ${itemLabel('bens', p)}`;
    case 'UPDATE_BEM': return `Editou bem: ${itemLabel('bens', p)}`;
    case 'DELETE_BEM': return `Excluiu bem: ${itemLabel('bens', buscar(state, 'bens', p))}`;
    case 'ADD_DIVIDA': return `Cadastrou dívida: ${itemLabel('dividas', p)}`;
    case 'UPDATE_DIVIDA': return `Editou dívida: ${itemLabel('dividas', p)}`;
    case 'DELETE_DIVIDA': return `Excluiu dívida: ${itemLabel('dividas', buscar(state, 'dividas', p))}`;
    case 'ADD_RENDIMENTO': return `Cadastrou rendimento: ${itemLabel('rendimentos', p)}`;
    case 'UPDATE_RENDIMENTO': return `Editou rendimento: ${itemLabel('rendimentos', p)}`;
    case 'DELETE_RENDIMENTO': return `Excluiu rendimento: ${itemLabel('rendimentos', buscar(state, 'rendimentos', p))}`;
    case 'ADD_PAGAMENTO': return `Cadastrou pagamento: ${itemLabel('pagamentos', p)}`;
    case 'UPDATE_PAGAMENTO': return `Editou pagamento: ${itemLabel('pagamentos', p)}`;
    case 'DELETE_PAGAMENTO': return `Excluiu pagamento: ${itemLabel('pagamentos', buscar(state, 'pagamentos', p))}`;
    case 'ADD_BEM_RURAL': return `Cadastrou bem rural: ${itemLabel('bensRurais', p)}`;
    case 'UPDATE_BEM_RURAL': return `Editou bem rural: ${itemLabel('bensRurais', p)}`;
    case 'DELETE_BEM_RURAL': return `Excluiu bem rural: ${itemLabel('bensRurais', buscar(state, 'bensRurais', p))}`;
    case 'ADD_IMOVEL_RURAL': return `Cadastrou imóvel rural: ${itemLabel('imoveisRurais', p)}`;
    case 'UPDATE_IMOVEL_RURAL': return `Editou imóvel rural: ${itemLabel('imoveisRurais', p)}`;
    case 'DELETE_IMOVEL_RURAL': return `Excluiu imóvel rural: ${itemLabel('imoveisRurais', buscar(state, 'imoveisRurais', p))}`;
    case 'ADD_LANCAMENTO_RURAL': return `Cadastrou lançamento rural: ${itemLabel('lancamentosRurais', p)}`;
    case 'UPDATE_LANCAMENTO_RURAL': return `Editou lançamento rural: ${itemLabel('lancamentosRurais', p)}`;
    case 'DELETE_LANCAMENTO_RURAL': return `Excluiu lançamento rural: ${itemLabel('lancamentosRurais', buscar(state, 'lancamentosRurais', p))}`;
    case 'ADD_PAGAMENTO_DIVERSO': return `Cadastrou despesa geral: ${itemLabel('pagamentosDiversos', p)}`;
    case 'UPDATE_PAGAMENTO_DIVERSO': return `Editou despesa geral: ${itemLabel('pagamentosDiversos', p)}`;
    case 'DELETE_PAGAMENTO_DIVERSO': return `Excluiu despesa geral: ${itemLabel('pagamentosDiversos', buscar(state, 'pagamentosDiversos', p))}`;
    case 'REGISTRAR_MOVIMENTACAO_BEM': return `Registrou movimentação (${p.movimentacao?.tipo || ''}) no bem: ${itemLabel('bens', buscar(state, 'bens', p.bemId))}`;
    case 'REGISTRAR_MOVIMENTACAO_BEM_RURAL': return `Registrou movimentação (${p.movimentacao?.tipo || ''}) no bem rural: ${itemLabel('bensRurais', buscar(state, 'bensRurais', p.bemId))}`;
    case 'REGISTRAR_MOVIMENTACAO_DIVIDA': return `Registrou movimentação (${p.movimentacao?.tipo || ''}) na dívida: ${itemLabel('dividas', buscar(state, 'dividas', p.bemId))}`;
    case 'AJUSTAR_PREJUIZO_RURAL': return `Ajustou o prejuízo da atividade rural a compensar`;
    case 'IMPORT_DECLARACAO': return `Importou declaração${p.anoCalendario ? ` do ano-calendário ${p.anoCalendario}` : ''}`;
    case 'RECONCILIAR_IMPORTACAO': return `Reimportou declaração retificadora do ano-calendário ${p.anoCalendario}, com conciliação item a item`;
    case 'ROLLOVER_ANO': return `Avançou o ano-calendário para ${p}`;
    case 'SWITCH_ANO': return `Trocou o ano-calendário para ${p}`;
    case 'SAVE_HISTORICO': return `Salvou o ano ${state.anoCalendario} no histórico de declarações`;
    case 'LOAD_HISTORICO': return `Carregou o ano ${p} do histórico de declarações`;
    case 'DELETE_HISTORICO_ANO': return `Excluiu o ano ${p} do histórico de declarações`;
    case 'SET_CONTRIBUINTE': return `Atualizou os dados do titular`;
    case 'ADD_DEPENDENTE': return `Cadastrou dependente: ${itemLabel('dependentes', p)}`;
    case 'UPDATE_DEPENDENTE': return `Editou dependente: ${itemLabel('dependentes', p)}`;
    case 'DELETE_DEPENDENTE': return `Excluiu dependente: ${itemLabel('dependentes', buscar(state, 'dependentes', p))}`;
    default: return null;
  }
}

// Reducer "de verdade" (puro, testado em reducer.test.js) fica intocado
// acima. Esse wrapper só acrescenta a entrada no histórico de alterações
// por cima do resultado, sem duplicar a lógica de cada case do switch —
// é o que o DataContext usa de fato; os testes continuam contra `reducer`.
export function reducerComHistorico(state, action) {
  const novoEstado = reducer(state, action);
  if (novoEstado === state) return novoEstado;
  const descricao = descreverAcao(state, action);
  if (!descricao) return novoEstado;
  const entrada = {
    id: Date.now() + Math.random(),
    data: new Date().toISOString(),
    anoCalendario: novoEstado.anoCalendario,
    descricao,
  };
  return { ...novoEstado, alteracoes: [entrada, ...(novoEstado.alteracoes || [])].slice(0, 300) };
}
