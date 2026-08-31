// Lógica pura do estado do app: nenhuma dependência de React aqui de
// propósito, para poder testar sem montar componente nenhum (ver
// reducer.test.js). O DataContext.jsx só faz a fiação com useReducer.

// demonstrativos.js também é lógica pura (sem React) — reaproveita aqui o
// recálculo de situação após excluir uma movimentação (mesma técnica do
// "salto sem data" usada nas consultas por período), em vez de duplicar a
// lógica de dobra das movimentações.
import {
  situacaoBemAposExclusao,
  situacaoDividaAposExclusao,
  reaplicarMovimentacoesBem,
  reaplicarMovimentacoesDivida,
} from './demonstrativos';

// Identificador de item novo. Era `Date.now()` puro, e dois cadastros no mesmo
// milissegundo recebiam o MESMO id — a partir daí, editar um editava os dois,
// porque todo UPDATE/DELETE casa por id. Improvável clicando, certo em teste
// automatizado e possível em importação seguida de cadastro. Achado 20 da
// auditoria de 24/08/2026.
//
// O relógio continua na frente do número (os ids seguem crescentes, o que
// mantém a ordenação por id usada em várias telas), com um contador que
// garante unicidade dentro do mesmo milissegundo.
let ultimoId = 0;
export const novoId = () => {
  const baseRelogio = Date.now() * 1000;
  ultimoId = Math.max(baseRelogio, ultimoId + 1);
  return ultimoId;
};

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
  // Resumo/Imposto Devido: só existe quando o ano veio de uma declaração
  // de verdade importada (.DBK) — nunca é cadastrado à mão, é puramente
  // informativo (ver importParsers.js, registro 20). null = nenhuma
  // declaração importada ainda pra este ano, ou importou por PDF (que não
  // lê essa ficha).
  impostoDevido: null,
  // Apuração do Ganho de Capital OFICIAL (resumo por operação, de qualquer
  // uma das quatro fichas: imóvel, móvel, participação societária e moeda em
  // espécie — já apurada
  // na própria declaração importada) — puramente informativa, igual
  // impostoDevido; diferente da aba Ganhos de Capital, que CALCULA a
  // partir de movimentações lançadas manualmente depois da importação.
  apuracaoGanhoCapital: [],
  // Demonstrativo COMPLETO de Ganhos de Capital, como a declaração o traz:
  // as quatro fichas do menu do programa da Receita (Bens Imóveis,
  // Direitos/Bens Móveis, Participações Societárias e Moedas em Espécie),
  // com apuração, cálculo do imposto, consolidação, faixas de tributação e
  // parcelas. `apuracaoGanhoCapital` acima continua sendo o RESUMO por
  // operação que as telas já consomem; este é o detalhe por trás dele.
  ganhosCapitalOficial: null,
  // Renda Variável: fechamento anual das operações comuns/day-trade e a ficha
  // de Operações em FII ou Fiagro (mês a mês e totais do ano). O mês a mês das
  // operações comuns continua em `rendaVariavelMensalOficial`.
  rendaVariavelAnualOficial: null,
  fiiFiagroMensalOficial: [],
  fiiFiagroAnualOficial: null,
  // Quadros das duas modalidades que não são ajuste anual, lidos da própria
  // declaração: espólio (partilha, decisão judicial, inventariante e
  // herdeiros) e saída definitiva (procurador, país de destino e a data que
  // caracteriza a condição de não residente). null = a declaração importada
  // não é dessa modalidade.
  espolioOficial: null,
  saidaDefinitivaOficial: null,
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
  dividasRurais: [],
  lancamentosRurais: [],
  prejuizoRuralAcompensar: 0,
  // Receitas e Despesas mensais (registro 51) e Apuração do Resultado
  // (registro 52) OFICIAIS, lidas da própria declaração importada —
  // puramente informativas, mesmo padrão de impostoDevido/
  // apuracaoGanhoCapital: não substituem lancamentosRurais/
  // prejuizoRuralAcompensar (lançamento manual do app).
  receitasDespesasRuraisOficial: [],
  apuracaoResultadoRuralOficial: null,
  // Movimentação do Rebanho (registro 53) — mesmo padrão, puramente
  // informativa, um item por espécie com movimento na declaração.
  movimentacaoRebanhoOficial: [],
  // Participantes dos Imóveis Rurais (registro 57) — lista solta de
  // nome+CPF, sem vínculo a um imóvel específico (o .DBK não expõe uma
  // chave confiável pra isso, ver importParsers.js).
  participantesRuraisOficial: [],
  // Demonstrativo de Apuração Lei 14.754/2023 por bem (registro 37) —
  // detalhamento do agregado que já vem em impostoDevido.lei14754Ganho/
  // lei14754Imposto; mesmo padrão puramente informativo.
  demonstrativoExteriorOficial: [],
  // Ganhos Líquidos em Renda Variável mês a mês. O conteúdo de cada entrada
  // depende do caminho de importação, e quem consome precisa aguentar os dois:
  // pelo .DBK (registro 76) vem SÓ o mês, porque nenhum campo de valor pôde ser
  // decifrado com confiança; pelo PDF vem o mês mais as duas colunas
  // (comuns/day-trade), a consolidação e o CPF do dependente, quando é a ficha
  // dos dependentes. Puramente informativo: renda variável é de tributação
  // exclusiva e não entra em nenhum total do demonstrativo. Ver
  // importParsers.js.
  rendaVariavelMensalOficial: [],
  // Doações (Efetuadas / a Partidos Políticos / diretamente na declaração
  // ECA-Pessoa Idosa) — diferente de todos os campos "Oficial" acima, o
  // .DBK de referência NÃO TEM nenhum registro para essas 4 fichas (nem
  // "sem informação" — o tipo de registro não existe), então só o caminho
  // PDF as produz (ver parsePDF); parseDBK nunca preenche estas chaves.
  // Puramente informativo, mesmo padrão dos demais.
  doacoesEfetuadasOficial: [],
  doacoesPartidosOficial: [],
  doacoesEcaIdosoOficial: [],
  // Despesas gerais (cartão, seguro, IPVA...) que NÃO são a ficha
  // "Pagamentos Efetuados" da declaração (essa é só o que é dedutível) —
  // fica separada de propósito.
  pagamentosDiversos: [],
  historico: {},
  // Log de alterações (quem mudou o quê, quando) — global, atravessa anos
  // (não faz parte de snapshotYear/blankYear de propósito, ver
  // reducerComHistorico mais abaixo).
  importFormato: null,
  // Cópia textual integral do arquivo importado, com hash SHA-256 do texto.
  // Permite auditar e reprocessar fichas ainda não modeladas sem perda
  // silenciosa. Fica somente no armazenamento local do perfil.
  documentoFonte: null,
  estadoFichas: {},
  fichasPdfObservadas: {},
  totalFichasPdfCatalogadas: 0,
  versaoCatalogoFichasPdf: null,
  avisosImportacao: [],
  registrosDbkNaoModelados: [],
  alteracoes: [],
  toasts: [],
};

export const snapshotYear = (state) => ({
  importFormato: state.importFormato ?? null,
  documentoFonte: state.documentoFonte ?? null,
  estadoFichas: state.estadoFichas ?? {},
  fichasPdfObservadas: state.fichasPdfObservadas ?? {},
  totalFichasPdfCatalogadas: state.totalFichasPdfCatalogadas ?? 0,
  versaoCatalogoFichasPdf: state.versaoCatalogoFichasPdf ?? null,
  avisosImportacao: state.avisosImportacao ?? [],
  registrosDbkNaoModelados: state.registrosDbkNaoModelados ?? [],
  bens: state.bens,
  dividas: state.dividas,
  rendimentos: state.rendimentos,
  pagamentos: state.pagamentos,
  contribuinte: state.contribuinte,
  impostoDevido: state.impostoDevido,
  apuracaoGanhoCapital: state.apuracaoGanhoCapital,
  ganhosCapitalOficial: state.ganhosCapitalOficial,
  rendaVariavelAnualOficial: state.rendaVariavelAnualOficial,
  fiiFiagroMensalOficial: state.fiiFiagroMensalOficial,
  fiiFiagroAnualOficial: state.fiiFiagroAnualOficial,
  // dependentes é por ano (como contribuinte) — a declaração de um ano tem
  // sua própria lista de dependentes; faltava aqui (bug real: trocar de ano
  // e voltar perdia os dependentes cadastrados, porque nunca eram
  // arquivados no snapshot).
  dependentes: state.dependentes,
  espolioOficial: state.espolioOficial,
  saidaDefinitivaOficial: state.saidaDefinitivaOficial,
  imoveisRurais: state.imoveisRurais,
  bensRurais: state.bensRurais,
  dividasRurais: state.dividasRurais,
  lancamentosRurais: state.lancamentosRurais,
  prejuizoRuralAcompensar: state.prejuizoRuralAcompensar,
  receitasDespesasRuraisOficial: state.receitasDespesasRuraisOficial,
  apuracaoResultadoRuralOficial: state.apuracaoResultadoRuralOficial,
  movimentacaoRebanhoOficial: state.movimentacaoRebanhoOficial,
  participantesRuraisOficial: state.participantesRuraisOficial,
  demonstrativoExteriorOficial: state.demonstrativoExteriorOficial,
  rendaVariavelMensalOficial: state.rendaVariavelMensalOficial,
  fichasNaoLidasComConteudo: state.fichasNaoLidasComConteudo,
  doacoesEfetuadasOficial: state.doacoesEfetuadasOficial,
  doacoesPartidosOficial: state.doacoesPartidosOficial,
  doacoesEcaIdosoOficial: state.doacoesEcaIdosoOficial,
  pagamentosDiversos: state.pagamentosDiversos,
  origem: state.origemAnoAtual,
  savedAt: new Date().toISOString(),
});
const temItens = (valor) => Array.isArray(valor) && valor.length > 0;
const temQuadro = (valor) => valor != null && (
  typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).length > 0
);

// Um ano deve ser reconhecido mesmo quando contém somente uma ficha oficial
// informativa. O critério anterior olhava apenas as coleções mais antigas e
// fazia anos com, por exemplo, resumo do imposto, renda variável, doações ou
// atividade rural desaparecerem do seletor e do histórico.
export const hasWorkingData = (state = {}) =>
  [
    'bens', 'dividas', 'rendimentos', 'pagamentos', 'dependentes',
    'imoveisRurais', 'bensRurais', 'dividasRurais', 'lancamentosRurais',
    'receitasDespesasRuraisOficial', 'movimentacaoRebanhoOficial',
    'participantesRuraisOficial', 'demonstrativoExteriorOficial',
    'apuracaoGanhoCapital', 'rendaVariavelMensalOficial',
    'fiiFiagroMensalOficial', 'doacoesEfetuadasOficial',
    'doacoesPartidosOficial', 'doacoesEcaIdosoOficial',
    'pagamentosDiversos', 'fichasNaoLidasComConteudo',
  ].some(campo => temItens(state[campo])) ||
  [
    'impostoDevido', 'ganhosCapitalOficial', 'rendaVariavelAnualOficial',
    'fiiFiagroAnualOficial', 'apuracaoResultadoRuralOficial',
    'espolioOficial', 'saidaDefinitivaOficial',
  ].some(campo => temQuadro(state[campo])) ||
  Number(state.prejuizoRuralAcompensar || 0) !== 0 ||
  !!state.contribuinte;
// Mesmo critério para um snapshot do histórico: ano "avançado" por engano
// ou herdado de versão antiga pode existir no histórico completamente vazio
// — e ano vazio NÃO é "ano com dado" (não entra no seletor nem nos gráficos).
export const snapshotHasData = (h) =>
  !!h && hasWorkingData(h);
export const blankYear = {
  // 'pdf' | 'dbk' | null — de qual arquivo veio a importação deste ano. É o
  // que permite ao Dashboard avisar que uma importação por PDF é PARCIAL
  // (não traz os rendimentos recebidos de pessoa física e do exterior) em vez
  // de exibir
  // zero como se fosse a realidade da pessoa. Ano em branco não tem arquivo
  // por trás, então nasce null.
  importFormato: null,
  documentoFonte: null,
  estadoFichas: {}, fichasPdfObservadas: {}, totalFichasPdfCatalogadas: 0,
  versaoCatalogoFichasPdf: null, avisosImportacao: [], registrosDbkNaoModelados: [],
  bens: [], dividas: [], rendimentos: [], pagamentos: [], contribuinte: null, impostoDevido: null, apuracaoGanhoCapital: [], dependentes: [],
  espolioOficial: null, saidaDefinitivaOficial: null,
  bensRurais: [], dividasRurais: [], lancamentosRurais: [], pagamentosDiversos: [],
  receitasDespesasRuraisOficial: [], apuracaoResultadoRuralOficial: null,
  movimentacaoRebanhoOficial: [], participantesRuraisOficial: [], demonstrativoExteriorOficial: [],
  rendaVariavelMensalOficial: [],
  ganhosCapitalOficial: null, rendaVariavelAnualOficial: null,
  fiiFiagroMensalOficial: [], fiiFiagroAnualOficial: null,
  // Fichas que a declaração importada TEM preenchidas e que o app não lê. Fica
  // no ano, e não só no log da importação, porque é informação que a pessoa
  // precisa ter à vista sempre que olhar os números — o log some quando ela sai
  // da tela de importar. Ver FICHAS_NAO_LIDAS em importParsers.js.
  fichasNaoLidasComConteudo: [],
  doacoesEfetuadasOficial: [], doacoesPartidosOficial: [], doacoesEcaIdosoOficial: [],
  // imoveisRurais e prejuizoRuralAcompensar NÃO entram aqui de propósito:
  // imóveis explorados normalmente continuam os mesmos de um ano pro
  // outro (ver ROLLOVER_ANO) e o prejuízo é um saldo que atravessa anos,
  // não algo que zera ao começar um ano em branco.
};

export function reducer(state, action) {
  switch (action.type) {
    // Estado já calculado e gravado com sucesso pelo DataContext. Esta ação
    // não recalcula ids nem histórico: persistência e memória recebem o mesmo
    // objeto produzido uma única vez por reducerComHistorico.
    case 'SUBSTITUIR_ESTADO_PERSISTIDO':
      return action.payload;
    // Titular e dependentes cadastrados/corrigidos à mão (nem sempre vêm de
    // uma importação — ver TitularPage). São por ano, como o resto da
    // declaração: mudar de ano-calendário troca de titular/dependentes
    // junto (ver snapshotYear/blankYear).
    case 'SET_CONTRIBUINTE':
      // Editar nome/CPF na tela não pode apagar endereço, ocupação e demais
      // dados cadastrais que vieram da declaração.
      return { ...state, contribuinte: { ...(state.contribuinte || {}), ...action.payload } };
    case 'ADD_DEPENDENTE':
      return { ...state, dependentes: [...state.dependentes, { ...action.payload, id: novoId() }] };
    case 'UPDATE_DEPENDENTE':
      return { ...state, dependentes: state.dependentes.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DEPENDENTE':
      return { ...state, dependentes: state.dependentes.filter(d => d.id !== action.payload) };
    // origem: 'manual' marca que o item nasceu de um cadastro direto (não de
    // um arquivo importado) — é o que permite, numa reimportação de
    // retificadora, distinguir o que é seguro sobrescrever do que tem que
    // ficar intocado (ver RECONCILIAR_IMPORTACAO mais abaixo).
    case 'ADD_BEM':
      return { ...state, bens: [...state.bens, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_BEM':
      return { ...state, bens: state.bens.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b) };
    case 'DELETE_BEM':
      return { ...state, bens: state.bens.filter(b => b.id !== action.payload) };
    case 'ADD_DIVIDA':
      return { ...state, dividas: [...state.dividas, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_DIVIDA':
      return { ...state, dividas: state.dividas.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DIVIDA':
      return { ...state, dividas: state.dividas.filter(d => d.id !== action.payload) };
    case 'ADD_RENDIMENTO':
      return { ...state, rendimentos: [...state.rendimentos, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.map(r => r.id === action.payload.id ? { ...r, ...action.payload } : r) };
    case 'DELETE_RENDIMENTO':
      return { ...state, rendimentos: state.rendimentos.filter(r => r.id !== action.payload) };
    case 'ADD_PAGAMENTO':
      return { ...state, pagamentos: [...state.pagamentos, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p) };
    case 'DELETE_PAGAMENTO':
      return { ...state, pagamentos: state.pagamentos.filter(p => p.id !== action.payload) };
    // As 3 fichas de Doações nasceram só-leitura (import do PDF, ver
    // importParsers.js) — a usuária pediu pra dar um jeito de incluir à mão
    // quando a declaração não tiver PDF pra importar, ou tiver doação que o
    // parser não pegou. Mesmo padrão de ADD/UPDATE/DELETE_RENDIMENTO acima;
    // o "Oficial" no nome do campo virou só um resquício histórico (igual
    // `bens`/`rendimentos` também misturam item importado com manual, via
    // `origem`).
    case 'ADD_DOACAO_EFETUADA':
      return { ...state, doacoesEfetuadasOficial: [...state.doacoesEfetuadasOficial, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_DOACAO_EFETUADA':
      return { ...state, doacoesEfetuadasOficial: state.doacoesEfetuadasOficial.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DOACAO_EFETUADA':
      return { ...state, doacoesEfetuadasOficial: state.doacoesEfetuadasOficial.filter(d => d.id !== action.payload) };
    case 'ADD_DOACAO_PARTIDO':
      return { ...state, doacoesPartidosOficial: [...state.doacoesPartidosOficial, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_DOACAO_PARTIDO':
      return { ...state, doacoesPartidosOficial: state.doacoesPartidosOficial.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DOACAO_PARTIDO':
      return { ...state, doacoesPartidosOficial: state.doacoesPartidosOficial.filter(d => d.id !== action.payload) };
    case 'ADD_DOACAO_ECA_IDOSO':
      return { ...state, doacoesEcaIdosoOficial: [...state.doacoesEcaIdosoOficial, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_DOACAO_ECA_IDOSO':
      return { ...state, doacoesEcaIdosoOficial: state.doacoesEcaIdosoOficial.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DOACAO_ECA_IDOSO':
      return { ...state, doacoesEcaIdosoOficial: state.doacoesEcaIdosoOficial.filter(d => d.id !== action.payload) };
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
        return { ...state, historico, anoCalendario: novoAno, origemAnoAtual: 'manual', importFormato: null };
      }
      const existente = historico[novoAno];
      if (existente) return { ...state, ...existente, historico, anoCalendario: novoAno, origemAnoAtual: existente.origem ?? null };
      // Se a atividade rural deu prejuízo no ano que está fechando, esse
      // prejuízo se soma ao saldo a compensar (regra real: prejuízo de
      // atividade rural pode ser compensado nos anos seguintes). Se deu
      // lucro, o saldo a compensar não muda sozinho — quanto compensar
      // desse lucro é escolha da usuária (ver AJUSTAR_PREJUIZO_RURAL).
      // Mesmas duas fontes de `resultadoAtividadeRuralPeriodo`, na mesma
      // ordem: o livro-caixa manual manda; sem nenhum lançamento, vale a
      // apuração que veio na declaração importada (registro 51). Sem a
      // segunda fonte, fechar um ano importado com prejuízo rural não
      // acumulava nada para compensar nos anos seguintes, embora a
      // declaração apurasse o prejuízo (Lei 8.023/1990, art. 14, permite a
      // compensação nos anos-base posteriores). Achado na auditoria de
      // 21/08/2026, ao fechar 2025 vindo de um .DBK completo.
      const manuaisDoAno = state.lancamentosRurais || [];
      const resultadoRuralDoAno = manuaisDoAno.length > 0
        ? manuaisDoAno.reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0)
        : (state.receitasDespesasRuraisOficial || []).reduce(
            (s, m) => s + (m.receitaBruta || 0) - (m.despesaCusteioInvestimento || 0), 0
          );
      const prejuizoRuralAcompensar = state.prejuizoRuralAcompensar + Math.min(0, resultadoRuralDoAno);
      return {
        ...state,
        historico,
        anoCalendario: novoAno,
        origemAnoAtual: 'manual',
        // Ano avançado à mão não tem arquivo de declaração por trás: o
        // formato do ano anterior não pode vazar pelo spread de `...state`,
        // senão o aviso de importação parcial reapareceria num ano que nunca
        // foi importado (mesmo raciocínio dos campos Oficiais logo abaixo).
        importFormato: null,
        documentoFonte: null,
        estadoFichas: blankYear.estadoFichas,
        fichasPdfObservadas: blankYear.fichasPdfObservadas,
        totalFichasPdfCatalogadas: blankYear.totalFichasPdfCatalogadas,
        versaoCatalogoFichasPdf: blankYear.versaoCatalogoFichasPdf,
        avisosImportacao: blankYear.avisosImportacao,
        registrosDbkNaoModelados: blankYear.registrosDbkNaoModelados,
        // Campos "Oficiais" importados da declaração (impostoDevido,
        // apuracaoGanhoCapital e os 9 outros de demonstrativos/rurais
        // detalhados) só fazem sentido PRO ANO em que a declaração foi
        // importada — sem zerar aqui, um ano genuinamente novo (que nunca
        // foi importado, `existente` é falsy) herdava esses campos por
        // cima do spread de `...state` acima, e continuavam aparecendo
        // (ex.: "Demonstrativo Lei 14.754/2023" e "Apuração do Ganho de
        // Capital Oficial" repetindo os mesmos itens do ano anterior mesmo
        // depois de avançar para um ano ainda não declarado). Bug real
        // reportado pela usuária. Reaproveita os valores vazios de
        // `blankYear` (mesmo objeto usado em SWITCH_ANO/IMPORT_DECLARACAO)
        // em vez de reescrever `null`/`[]` na mão, para nunca ficar
        // dessincronizado se um campo Oficial novo for adicionado no
        // futuro. NÃO se aplica ao branch de `existente` (linha acima):
        // carregar um ano JÁ arquivado deve continuar trazendo o que
        // estava salvo naquele ano.
        impostoDevido: blankYear.impostoDevido,
        apuracaoGanhoCapital: blankYear.apuracaoGanhoCapital,
        ganhosCapitalOficial: blankYear.ganhosCapitalOficial,
        rendaVariavelAnualOficial: blankYear.rendaVariavelAnualOficial,
        fiiFiagroMensalOficial: blankYear.fiiFiagroMensalOficial,
        fiiFiagroAnualOficial: blankYear.fiiFiagroAnualOficial,
        demonstrativoExteriorOficial: blankYear.demonstrativoExteriorOficial,
        rendaVariavelMensalOficial: blankYear.rendaVariavelMensalOficial,
        fichasNaoLidasComConteudo: blankYear.fichasNaoLidasComConteudo,
        receitasDespesasRuraisOficial: blankYear.receitasDespesasRuraisOficial,
        apuracaoResultadoRuralOficial: blankYear.apuracaoResultadoRuralOficial,
        movimentacaoRebanhoOficial: blankYear.movimentacaoRebanhoOficial,
        participantesRuraisOficial: blankYear.participantesRuraisOficial,
        doacoesEfetuadasOficial: blankYear.doacoesEfetuadasOficial,
        doacoesPartidosOficial: blankYear.doacoesPartidosOficial,
        doacoesEcaIdosoOficial: blankYear.doacoesEcaIdosoOficial,
        // movimentacoes: [] (não só id/situacao_anterior) — igual já era
        // feito em dívidas, mas faltava aqui: sem isso, uma venda registrada
        // em 2025 continuava pendurada no bem depois da virada pra 2026 e
        // reaparecia como se tivesse sido vendida DE NOVO em 2026 — tanto na
        // reconstrução por data (situacaoBemAteData) quanto na aba Ganhos de
        // Capital, que lê `movimentacoes` do bem do ano escolhido sem
        // filtrar por data (bug real, achado auditando o motor de Ganhos de
        // Capital; confirmado rodando o reducer de verdade, ver
        // reducer.test.js).
        bens: state.bens.map(b => ({ ...b, id: novoId(), situacao_anterior: b.situacao_atual, movimentacoes: [] })),
        dividas: state.dividas.map(d => ({ ...d, id: novoId(), situacao_anterior: d.situacao_atual, valor_pago: 0, movimentacoes: [] })),
        bensRurais: state.bensRurais.map(b => ({ ...b, id: novoId(), situacao_anterior: b.situacao_atual, movimentacoes: [] })),
        dividasRurais: state.dividasRurais.map(d => ({ ...d, id: novoId(), situacao_anterior: d.situacao_atual, valor_pago: 0, movimentacoes: [] })),
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
    // vazio numa categoria (ex.: PDF não lê atividade rural) só é gravado como
    // vazio ao entrar num ano novo; no mesmo ano, preserva o que já existe
    // ali para não apagar uma categoria que o import não cobriu.
    case 'IMPORT_DECLARACAO': {
      const { anoCalendario, contribuinte, dependentes, bens, dividas, rendimentos, pagamentos, imoveisRurais, bensRurais, dividasRurais } = action.payload;
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
      const mesclarImportados = (listaBase, novaLista) => [
        ...(listaBase || []).filter(item => item.origem !== 'importacao'),
        ...marcarImportacao(novaLista),
      ];
      return {
        ...state,
        historico,
        anoCalendario: ano,
        // Este ano passa a ter um arquivo de declaração de verdade por
        // trás — é o que diferencia de um ano que só existia por ter sido
        // avançado manualmente (ver Importar > Histórico de Declarações).
        origemAnoAtual: 'importacao',
        // Formato do arquivo desta importação (ver blankYear). `undefined`
        // (payload de uma versão anterior a este campo) preserva o que já
        // estava, mesmo critério dos campos Oficiais logo abaixo.
        importFormato: action.payload.formato !== undefined ? action.payload.formato : base.importFormato,
        documentoFonte: action.payload.documentoFonte !== undefined ? action.payload.documentoFonte : base.documentoFonte,
        estadoFichas: action.payload.estadoFichas !== undefined ? action.payload.estadoFichas : base.estadoFichas,
        fichasPdfObservadas: action.payload.fichasPdfObservadas !== undefined
          ? action.payload.fichasPdfObservadas : base.fichasPdfObservadas,
        totalFichasPdfCatalogadas: action.payload.totalFichasPdfCatalogadas !== undefined
          ? action.payload.totalFichasPdfCatalogadas : base.totalFichasPdfCatalogadas,
        versaoCatalogoFichasPdf: action.payload.versaoCatalogoFichasPdf !== undefined
          ? action.payload.versaoCatalogoFichasPdf : base.versaoCatalogoFichasPdf,
        avisosImportacao: action.payload.avisosImportacao !== undefined ? action.payload.avisosImportacao : base.avisosImportacao,
        registrosDbkNaoModelados: action.payload.registrosDbkNaoModelados !== undefined
          ? action.payload.registrosDbkNaoModelados : base.registrosDbkNaoModelados,
        contribuinte: contribuinte || base.contribuinte,
        // impostoDevido: só o .DBK traz (o PDF não lê essa ficha) — sem
        // isso, reimportar pelo caminho PDF por cima de um .DBK já
        // importado apagaria o resumo em silêncio.
        impostoDevido: action.payload.impostoDevido !== undefined ? action.payload.impostoDevido : base.impostoDevido,
        apuracaoGanhoCapital: (action.payload.apuracaoGanhoCapital && action.payload.apuracaoGanhoCapital.length > 0)
          ? action.payload.apuracaoGanhoCapital : base.apuracaoGanhoCapital,
        // Ganhos de Capital detalhado e as duas fichas de Renda Variável:
        // mesmo critério dos demais campos Oficiais — resultado vazio não
        // apaga o que já estava, para reimportar por um caminho que não leu a
        // ficha não zerar em silêncio o que o outro tinha trazido.
        ganhosCapitalOficial: action.payload.ganhosCapitalOficial
          ? action.payload.ganhosCapitalOficial : base.ganhosCapitalOficial,
        // Quadros de modalidade: só o caminho PDF os produz hoje, e uma
        // declaração de ajuste anual devolve null nos dois. Mesmo critério dos
        // demais quadros: valor novo manda, ausente preserva o que havia.
        espolioOficial: action.payload.espolioOficial
          ? action.payload.espolioOficial : base.espolioOficial,
        saidaDefinitivaOficial: action.payload.saidaDefinitivaOficial
          ? action.payload.saidaDefinitivaOficial : base.saidaDefinitivaOficial,
        rendaVariavelAnualOficial: action.payload.rendaVariavelAnualOficial
          ? action.payload.rendaVariavelAnualOficial : base.rendaVariavelAnualOficial,
        fiiFiagroMensalOficial: (action.payload.fiiFiagroMensalOficial && action.payload.fiiFiagroMensalOficial.length > 0)
          ? action.payload.fiiFiagroMensalOficial : base.fiiFiagroMensalOficial,
        fiiFiagroAnualOficial: action.payload.fiiFiagroAnualOficial
          ? action.payload.fiiFiagroAnualOficial : base.fiiFiagroAnualOficial,
        // Receitas/Despesas mensais e Apuração do Resultado da Atividade
        // Rural (registros 51/52): mesmo critério de impostoDevido/
        // apuracaoGanhoCapital — só o .DBK traz, então reimportar por PDF
        // por cima de um .DBK já importado preserva o que já tinha.
        receitasDespesasRuraisOficial: (action.payload.receitasDespesasRuraisOficial && action.payload.receitasDespesasRuraisOficial.length > 0)
          ? action.payload.receitasDespesasRuraisOficial : base.receitasDespesasRuraisOficial,
        apuracaoResultadoRuralOficial: action.payload.apuracaoResultadoRuralOficial !== undefined
          ? action.payload.apuracaoResultadoRuralOficial : base.apuracaoResultadoRuralOficial,
        movimentacaoRebanhoOficial: (action.payload.movimentacaoRebanhoOficial && action.payload.movimentacaoRebanhoOficial.length > 0)
          ? action.payload.movimentacaoRebanhoOficial : base.movimentacaoRebanhoOficial,
        participantesRuraisOficial: (action.payload.participantesRuraisOficial && action.payload.participantesRuraisOficial.length > 0)
          ? action.payload.participantesRuraisOficial : base.participantesRuraisOficial,
        demonstrativoExteriorOficial: (action.payload.demonstrativoExteriorOficial && action.payload.demonstrativoExteriorOficial.length > 0)
          ? action.payload.demonstrativoExteriorOficial : base.demonstrativoExteriorOficial,
        rendaVariavelMensalOficial: (action.payload.rendaVariavelMensalOficial && action.payload.rendaVariavelMensalOficial.length > 0)
          ? action.payload.rendaVariavelMensalOficial : base.rendaVariavelMensalOficial,
        // Diferente dos demais: substitui SEMPRE, inclusive por lista vazia.
        // Lista vazia aqui não é "não veio no arquivo", é "esta importação
        // conferiu e não achou ficha preenchida que ficasse de fora" — manter
        // o aviso de uma importação anterior seria mentir sobre o arquivo novo.
        fichasNaoLidasComConteudo: action.payload.fichasNaoLidasComConteudo || [],
        // Doações: só o caminho PDF traz (o .DBK não tem registro pra
        // nenhuma das 4 fichas, ver importParsers.js) — mesmo critério
        // informativo dos campos acima, `undefined` (import .DBK, que nunca
        // preenche esta chave) cai no `base` e preserva o que já existia.
        doacoesEfetuadasOficial: (action.payload.doacoesEfetuadasOficial && action.payload.doacoesEfetuadasOficial.length > 0)
          ? mesclarImportados(base.doacoesEfetuadasOficial, action.payload.doacoesEfetuadasOficial) : base.doacoesEfetuadasOficial,
        doacoesPartidosOficial: (action.payload.doacoesPartidosOficial && action.payload.doacoesPartidosOficial.length > 0)
          ? mesclarImportados(base.doacoesPartidosOficial, action.payload.doacoesPartidosOficial) : base.doacoesPartidosOficial,
        doacoesEcaIdosoOficial: (action.payload.doacoesEcaIdosoOficial && action.payload.doacoesEcaIdosoOficial.length > 0)
          ? mesclarImportados(base.doacoesEcaIdosoOficial, action.payload.doacoesEcaIdosoOficial) : base.doacoesEcaIdosoOficial,
        bens: (bens && bens.length > 0) ? marcarImportacao(bens) : base.bens,
        dividas: (dividas && dividas.length > 0) ? marcarImportacao(dividas) : base.dividas,
        rendimentos: (rendimentos && rendimentos.length > 0) ? marcarImportacao(rendimentos) : base.rendimentos,
        pagamentos: (pagamentos && pagamentos.length > 0) ? marcarImportacao(pagamentos) : base.pagamentos,
        // Atividade Rural (imóveis explorados e bens rurais): só o .DBK
        // traz (registros 50/54, ver importParsers.js) — o PDF não lê essa
        // ficha ainda. Mesmo critério de bens/dívidas: só troca a lista se
        // o import trouxe algo, senão preserva o que já tinha (retificadora
        // ou reimport de PDF por cima de um .DBK já importado não apaga).
        // O import não traz despesas gerais — ao trocar de ano, essa lista
        // tem que zerar como bens/dívidas/rendimentos, senão o ano novo
        // nasceria com despesas de um ano completamente diferente coladas
        // nele. prejuizoRuralAcompensar continua como está (mesmo
        // raciocínio do ROLLOVER_ANO/SWITCH_ANO: atravessa anos, não é um
        // fluxo do período).
        // O import não traz dependentes (fora do escopo dos parsers): por
        // padrão, quem já estava cadastrado no ano de destino continua —
        // MAS quando o titular importado é outro (ver ImportPage), o
        // chamador passa `dependentes: []` explicitamente pra não deixar
        // dependente do titular antigo grudado no novo. `undefined` (chave
        // ausente no payload) é o sinal de "mantenha o que já tem".
        dependentes: dependentes !== undefined ? dependentes : base.dependentes,
        // state.imoveisRurais (não base.imoveisRurais): imóveis explorados
        // atravessam anos, igual prejuizoRuralAcompensar — blankYear nem
        // tem essa chave de propósito (achado real: usar base aqui zerava
        // os imóveis ao importar uma declaração de OUTRO ano-calendário).
        imoveisRurais: (imoveisRurais && imoveisRurais.length > 0) ? marcarImportacao(imoveisRurais) : state.imoveisRurais,
        bensRurais: (bensRurais && bensRurais.length > 0) ? marcarImportacao(bensRurais) : base.bensRurais,
        dividasRurais: (dividasRurais && dividasRurais.length > 0) ? marcarImportacao(dividasRurais) : base.dividasRurais,
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

      const reconciliarColecao = (listaBase, decisao, ehDivida = false) => {
        if (!decisao) return listaBase;
        const { vinculados = [], novos = [], removerAntigos = [] } = decisao;
        const vinculoPorId = new Map(vinculados.map(v => [v.idAntigo, v.dados]));
        const removerSet = new Set(removerAntigos);
        const atualizados = (listaBase || [])
          // Defesa em profundidade: a tela já não oferece itens manuais, mas
          // um payload forjado também não pode removê-los.
          .filter(item => item.origem === 'manual' || !removerSet.has(item.id))
          .map(item => {
            const dados = vinculoPorId.get(item.id);
            if (!dados || item.origem === 'manual') return item;
            const movimentacoes = item.movimentacoes || [];
            const saldoDeclarado = dados.situacao_atual ?? dados.situacao_anterior ?? 0;
            return {
              ...item,
              ...dados,
              id: item.id,
              movimentacoes,
              situacao_atual: ehDivida
                ? reaplicarMovimentacoesDivida(saldoDeclarado, movimentacoes)
                : reaplicarMovimentacoesBem(saldoDeclarado, movimentacoes),
              origem: 'importacao',
            };
          });
        const novosComId = novos.map(n => ({ ...n, id: novoId(), origem: 'importacao' }));
        return [...atualizados, ...novosComId];
      };

      // Rendimentos e pagamentos não têm o conceito de movimentação em cima
      // deles (são lançamentos do período, não saldo) — a reconciliação é
      // mais simples: tira só os que vieram de importação e ainda estão
      // marcados como tal, entra a lista nova por cima, e o que foi
      // cadastrado à mão (origem 'manual', ou sem marca por ser de uma
      // versão anterior a essa distinção) não é tocado.
      const textoChave = (valor) => String(valor || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const documentoChave = (item) => String(
        item.cpf_cnpj || item.cpfCnpj || item.cnpj_fonte || item.cnpj ||
        item.cpf_beneficiario || item.cpf_dependente || '',
      ).replace(/\D/g, '');
      const chaveLancamento = (campo, item) => {
        if (item.controle) return `controle:${item.controle}`;
        const documento = documentoChave(item);
        if (campo === 'rendimentos') {
          return [item.tipo, item.codigo, item.beneficiario, item.cpf_dependente, documento || textoChave(item.nome_fonte), item.mes].join('|');
        }
        return [item.codigo, item.beneficiario, item.cpf_beneficiario, documento || textoChave(item.nome_beneficiario)].join('|');
      };
      const substituirImportados = (listaBase, novaLista, campo) => {
        const preservados = (listaBase || []).filter(item => item.origem === 'manual');
        const legados = (listaBase || []).filter(item => item.origem === 'origem_legacy');
        const legadosPorChave = new Map();
        for (const item of legados) {
          const chave = chaveLancamento(campo, item);
          if (!legadosPorChave.has(chave)) legadosPorChave.set(chave, []);
          legadosPorChave.get(chave).push(item);
        }
        const consumidos = new Set();
        const importados = (novaLista || []).map(item => {
          const candidatos = legadosPorChave.get(chaveLancamento(campo, item)) || [];
          const legado = candidatos.shift();
          if (legado) consumidos.add(legado);
          return { ...item, id: legado?.id ?? novoId(), origem: 'importacao' };
        });
        return [...preservados, ...legados.filter(item => !consumidos.has(item)), ...importados];
      };

      // Coleções rurais antigas ainda podem chegar no formato automático de
      // versões anteriores. O fluxo atual usa a decisão item a item logo
      // abaixo; este caminho permanece apenas para compatibilidade de dados e
      // payloads legados.
      const chaveRural = (campo, item) => {
        if (item.controle) return `controle:${item.controle}`;
        if (item.chaveImportacao) return `importacao:${item.chaveImportacao}`;
        if (campo === 'bensRurais') return `${item.codigo || item.codigo_bem || ''}|${textoChave(item.discriminacao)}`;
        if (campo === 'dividasRurais') return textoChave(item.discriminacao);
        if (item.chaveAssociacao) return `chave:${item.chaveAssociacao}`;
        return `${String(item.cib || '').replace(/\D/g, '')}|${textoChave(item.nomeLocalizacao || `${item.nomeImovel || ''} ${item.localizacao || ''}`)}`;
      };
      const reconciliarRural = (campo) => {
        if (!Object.prototype.hasOwnProperty.call(action.payload, campo)) return base[campo];
        const recebido = action.payload[campo] || [];

        // Caminho auditável da tela de retificadora: o vínculo foi revisado
        // item a item. A identidade não depende de descrição, saldo ou ordem
        // do PDF; a decisão explícita aponta para o id importado anterior.
        if (!Array.isArray(recebido)) {
          const antigos = base[campo] || [];
          const antigosImportadosPorId = new Map(
            antigos
              .filter(item => item.origem === 'importacao' || item.origem === 'origem_legacy')
              .map(item => [item.id, item]),
          );
          const idsConsumidos = new Set();
          const idsRemovidos = new Set(
            (recebido.removerAntigos || []).filter(id => antigosImportadosPorId.has(id)),
          );
          const vinculados = (recebido.vinculados || []).flatMap(vinculo => {
            const antigo = antigosImportadosPorId.get(vinculo.idAntigo);
            if (!antigo || idsConsumidos.has(antigo.id)) return [];
            idsConsumidos.add(antigo.id);
            const movimentos = antigo.movimentacoes || [];
            const atualizado = { ...antigo, ...vinculo.dados, id: antigo.id, origem: 'importacao' };
            if (campo === 'bensRurais') {
              atualizado.movimentacoes = movimentos;
              atualizado.situacao_atual = reaplicarMovimentacoesBem(vinculo.dados.situacao_atual, movimentos);
            } else if (campo === 'dividasRurais') {
              atualizado.movimentacoes = movimentos;
              atualizado.situacao_atual = reaplicarMovimentacoesDivida(vinculo.dados.situacao_atual, movimentos);
            }
            return [atualizado];
          });
          const preservados = antigos.filter(item => {
            if (item.origem === 'manual') return true;
            return !idsConsumidos.has(item.id) && !idsRemovidos.has(item.id);
          });
          const novos = (recebido.novos || []).map(item => ({ ...item, id: novoId(), origem: 'importacao' }));
          return [...preservados, ...vinculados, ...novos];
        }

        const novaLista = recebido;
        if (!mesmoFormato && novaLista.length === 0) return base[campo];

        const antigosPorChave = new Map();
        for (const item of (base[campo] || []).filter(x => x.origem === 'importacao' || x.origem === 'origem_legacy')) {
          const chave = chaveRural(campo, item);
          if (!antigosPorChave.has(chave)) antigosPorChave.set(chave, []);
          antigosPorChave.get(chave).push(item);
        }
        const manuais = (base[campo] || []).filter(item => item.origem === 'manual');
        const legadosConsumidos = new Set();
        const importados = novaLista.map(novo => {
          const correspondentes = antigosPorChave.get(chaveRural(campo, novo)) || [];
          const antigo = correspondentes.shift();
          if (!antigo) return { ...novo, id: novoId(), origem: 'importacao' };
          if (antigo.origem === 'origem_legacy') legadosConsumidos.add(antigo);
          const movimentos = antigo.movimentacoes || [];
          const atualizado = { ...antigo, ...novo, id: antigo.id, origem: 'importacao' };
          if (campo === 'bensRurais') {
            atualizado.movimentacoes = movimentos;
            atualizado.situacao_atual = reaplicarMovimentacoesBem(novo.situacao_atual, movimentos);
          } else if (campo === 'dividasRurais') {
            atualizado.movimentacoes = movimentos;
            atualizado.situacao_atual = reaplicarMovimentacoesDivida(novo.situacao_atual, movimentos);
          }
          return atualizado;
        });
        const legadosSemCorrespondencia = (base[campo] || []).filter(
          item => item.origem === 'origem_legacy' && !legadosConsumidos.has(item),
        );
        return [...manuais, ...legadosSemCorrespondencia, ...importados];
      };

      // Uma retificadora precisa atualizar também os quadros anuais que não
      // passam pela conciliação item a item. Se a origem é a mesma, até um
      // valor vazio é autoritativo (a ficha pode ter sido removida na
      // retificadora). Ao trocar de formato, vazio pode significar apenas que
      // aquele parser não cobre a ficha; nesse caso preservamos o dado já
      // confirmado pelo outro formato.
      const mesmoFormato = action.payload.formato !== undefined && action.payload.formato === base.importFormato;
      const quadroRetificado = (campo) => {
        if (!Object.prototype.hasOwnProperty.call(action.payload, campo)) return base[campo];
        const valor = action.payload[campo];
        const temConteudo = Array.isArray(valor) ? valor.length > 0 : valor != null;
        return (mesmoFormato || temConteudo) ? valor : base[campo];
      };

      const imoveisRuraisReconciliados = reconciliarRural('imoveisRurais') || [];
      const bensRuraisReconciliados = reconciliarRural('bensRurais') || [];
      const dividasRuraisReconciliadas = reconciliarRural('dividasRurais') || [];
      const participantesRuraisRecebidos = quadroRetificado('participantesRuraisOficial');
      const imoveisRecebidos = Array.isArray(action.payload.imoveisRurais)
        ? (action.payload.imoveisRurais || [])
        : [
          ...(action.payload.imoveisRurais?.vinculados || []).map(item => item.dados),
          ...(action.payload.imoveisRurais?.novos || []),
        ];
      const chaveImovelPorIdTemporario = new Map(
        imoveisRecebidos
          .filter(item => item?.id != null && item?.chaveImportacao)
          .map(item => [item.id, item.chaveImportacao]),
      );
      const idFinalPorChaveImovel = new Map(
        imoveisRuraisReconciliados
          .filter(item => item?.chaveImportacao)
          .map(item => [item.chaveImportacao, item.id]),
      );
      const participantesRuraisReconciliados = Array.isArray(participantesRuraisRecebidos)
        ? participantesRuraisRecebidos.map(participante => {
          const chaveImovel = participante.imovelChaveImportacao
            || chaveImovelPorIdTemporario.get(participante.imovelId);
          if (!chaveImovel || !idFinalPorChaveImovel.has(chaveImovel)) return participante;
          return {
            ...participante,
            imovelChaveImportacao: chaveImovel,
            imovelId: idFinalPorChaveImovel.get(chaveImovel),
          };
        })
        : participantesRuraisRecebidos;

      return {
        ...state,
        historico,
        anoCalendario: anoAlvo,
        origemAnoAtual: 'importacao',
        // A retificadora também é uma importação de verdade: o formato dela
        // é que passa a valer para os avisos de importação parcial.
        importFormato: action.payload.formato !== undefined ? action.payload.formato : state.importFormato,
        documentoFonte: quadroRetificado('documentoFonte'),
        estadoFichas: quadroRetificado('estadoFichas'),
        fichasPdfObservadas: quadroRetificado('fichasPdfObservadas'),
        totalFichasPdfCatalogadas: quadroRetificado('totalFichasPdfCatalogadas'),
        versaoCatalogoFichasPdf: quadroRetificado('versaoCatalogoFichasPdf'),
        avisosImportacao: quadroRetificado('avisosImportacao'),
        registrosDbkNaoModelados: quadroRetificado('registrosDbkNaoModelados'),
        contribuinte: contribuinte || base.contribuinte,
        dependentes: action.payload.dependentes !== undefined ? action.payload.dependentes : base.dependentes,
        impostoDevido: quadroRetificado('impostoDevido'),
        apuracaoGanhoCapital: quadroRetificado('apuracaoGanhoCapital'),
        ganhosCapitalOficial: quadroRetificado('ganhosCapitalOficial'),
        rendaVariavelAnualOficial: quadroRetificado('rendaVariavelAnualOficial'),
        fiiFiagroMensalOficial: quadroRetificado('fiiFiagroMensalOficial'),
        fiiFiagroAnualOficial: quadroRetificado('fiiFiagroAnualOficial'),
        receitasDespesasRuraisOficial: quadroRetificado('receitasDespesasRuraisOficial'),
        apuracaoResultadoRuralOficial: quadroRetificado('apuracaoResultadoRuralOficial'),
        movimentacaoRebanhoOficial: quadroRetificado('movimentacaoRebanhoOficial'),
        participantesRuraisOficial: participantesRuraisReconciliados,
        demonstrativoExteriorOficial: quadroRetificado('demonstrativoExteriorOficial'),
        rendaVariavelMensalOficial: quadroRetificado('rendaVariavelMensalOficial'),
        doacoesEfetuadasOficial: Object.prototype.hasOwnProperty.call(action.payload, 'doacoesEfetuadasOficial')
          && (mesmoFormato || action.payload.doacoesEfetuadasOficial?.length > 0)
          ? substituirImportados(base.doacoesEfetuadasOficial, action.payload.doacoesEfetuadasOficial, 'doacoesEfetuadasOficial')
          : base.doacoesEfetuadasOficial,
        doacoesPartidosOficial: Object.prototype.hasOwnProperty.call(action.payload, 'doacoesPartidosOficial')
          && (mesmoFormato || action.payload.doacoesPartidosOficial?.length > 0)
          ? substituirImportados(base.doacoesPartidosOficial, action.payload.doacoesPartidosOficial, 'doacoesPartidosOficial')
          : base.doacoesPartidosOficial,
        doacoesEcaIdosoOficial: Object.prototype.hasOwnProperty.call(action.payload, 'doacoesEcaIdosoOficial')
          && (mesmoFormato || action.payload.doacoesEcaIdosoOficial?.length > 0)
          ? substituirImportados(base.doacoesEcaIdosoOficial, action.payload.doacoesEcaIdosoOficial, 'doacoesEcaIdosoOficial')
          : base.doacoesEcaIdosoOficial,
        // Este campo é uma conclusão da varredura do arquivo, não uma ficha
        // parcial: a lista nova sempre substitui a antiga, inclusive vazia.
        fichasNaoLidasComConteudo: action.payload.fichasNaoLidasComConteudo || [],
        bens: reconciliarColecao(base.bens, bens),
        dividas: reconciliarColecao(base.dividas, dividas, true),
        rendimentos: substituirImportados(base.rendimentos, rendimentos, 'rendimentos'),
        pagamentos: substituirImportados(base.pagamentos, pagamentos, 'pagamentos'),
        bensRurais: bensRuraisReconciliados,
        dividasRurais: dividasRuraisReconciliadas,
        imoveisRurais: imoveisRuraisReconciliados,
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
          // Date.now()+Math.random() (não só Date.now()) porque agora dá
          // pra excluir uma movimentação por id (DELETE_MOVIMENTACAO_BEM):
          // duas movimentações registradas no mesmo milissegundo colidiam e
          // excluir uma apagava as duas de uma vez (achado real, testando
          // duas REGISTRAR_MOVIMENTACAO_BEM em sequência sem esperar).
          const mov = { ...movimentacao, id: novoId() };
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
          // Date.now()+Math.random() (não só Date.now()) porque agora dá
          // pra excluir uma movimentação por id (DELETE_MOVIMENTACAO_BEM):
          // duas movimentações registradas no mesmo milissegundo colidiam e
          // excluir uma apagava as duas de uma vez (achado real, testando
          // duas REGISTRAR_MOVIMENTACAO_BEM em sequência sem esperar).
          const mov = { ...movimentacao, id: novoId() };
          let situacao_atual = d.situacao_atual;
          if (mov.tipo === 'contratacao') situacao_atual += mov.valor;
          else if (mov.tipo === 'amortizacao') situacao_atual = Math.max(0, situacao_atual - mov.valor);
          else if (mov.tipo === 'quitacao') situacao_atual = 0;
          else if (mov.tipo === 'ajuste') situacao_atual = mov.valor;
          return { ...d, situacao_atual, movimentacoes: [...(d.movimentacoes || []), mov] };
        }),
      };
    }
    // Exclui uma movimentação registrada por engano (valor errado, tipo
    // errado, data errada etc.) e recalcula a situação atual a partir do
    // que sobrou — sem isso, corrigir um lançamento errado exigia excluir o
    // bem/dívida inteiro e recadastrar tudo do zero. situacaoBemAposExclusao
    // (demonstrativos.js) preserva o "salto sem data" que já existia antes
    // de qualquer movimentação (bem importado ou editado manualmente).
    case 'DELETE_MOVIMENTACAO_BEM':
    case 'DELETE_MOVIMENTACAO_BEM_RURAL': {
      const { bemId, movId } = action.payload;
      const colecao = action.type === 'DELETE_MOVIMENTACAO_BEM_RURAL' ? 'bensRurais' : 'bens';
      return {
        ...state,
        [colecao]: state[colecao].map(b => {
          if (b.id !== bemId) return b;
          const movimentacoes = (b.movimentacoes || []).filter(m => m.id !== movId);
          return { ...b, movimentacoes, situacao_atual: situacaoBemAposExclusao(b, movimentacoes) };
        }),
      };
    }
    // Mesma mecânica de DELETE_MOVIMENTACAO_BEM, para dívidas.
    case 'DELETE_MOVIMENTACAO_DIVIDA': {
      const { bemId: dividaId, movId } = action.payload;
      return {
        ...state,
        dividas: state.dividas.map(d => {
          if (d.id !== dividaId) return d;
          const movimentacoes = (d.movimentacoes || []).filter(m => m.id !== movId);
          return { ...d, movimentacoes, situacao_atual: situacaoDividaAposExclusao(d, movimentacoes) };
        }),
      };
    }
    // Corrige uma movimentação já registrada (valor, data, tipo, valor de
    // venda/IRRF errados) sem precisar excluir e recriar — o que perdia o
    // controle de quantas vendas já foram corrigidas e arriscava a pessoa
    // esquecer de digitar de novo um campo que só existia na 1ª tentativa
    // (achado real auditando o impacto do cadastro de bens sobre a aba
    // Ganhos de Capital: um "Valor de venda" errado só dava pra corrigir
    // apagando a movimentação inteira). Reaproveita a mesma função de
    // recálculo de DELETE (situacaoBemAposExclusao/situacaoDividaAposExclusao
    // funcionam para qualquer array novo de movimentações, não só uma
    // exclusão) — o id da movimentação nunca muda, só os campos.
    case 'UPDATE_MOVIMENTACAO_BEM':
    case 'UPDATE_MOVIMENTACAO_BEM_RURAL': {
      const { bemId, movId, movimentacao } = action.payload;
      const colecao = action.type === 'UPDATE_MOVIMENTACAO_BEM_RURAL' ? 'bensRurais' : 'bens';
      return {
        ...state,
        [colecao]: state[colecao].map(b => {
          if (b.id !== bemId) return b;
          const movimentacoes = (b.movimentacoes || []).map(m => m.id === movId ? { ...movimentacao, id: movId } : m);
          return { ...b, movimentacoes, situacao_atual: situacaoBemAposExclusao(b, movimentacoes) };
        }),
      };
    }
    case 'UPDATE_MOVIMENTACAO_DIVIDA': {
      const { bemId: dividaId, movId, movimentacao } = action.payload;
      return {
        ...state,
        dividas: state.dividas.map(d => {
          if (d.id !== dividaId) return d;
          const movimentacoes = (d.movimentacoes || []).map(m => m.id === movId ? { ...movimentacao, id: movId } : m);
          return { ...d, movimentacoes, situacao_atual: situacaoDividaAposExclusao(d, movimentacoes) };
        }),
      };
    }
    case 'ADD_BEM_RURAL':
      return { ...state, bensRurais: [...state.bensRurais, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_BEM_RURAL':
      return { ...state, bensRurais: state.bensRurais.map(b => b.id === action.payload.id ? { ...b, ...action.payload } : b) };
    case 'DELETE_BEM_RURAL':
      return { ...state, bensRurais: state.bensRurais.filter(b => b.id !== action.payload) };

    case 'ADD_DIVIDA_RURAL':
      return { ...state, dividasRurais: [...state.dividasRurais, { ...action.payload, id: novoId(), movimentacoes: [], origem: 'manual' }] };
    case 'UPDATE_DIVIDA_RURAL':
      return { ...state, dividasRurais: state.dividasRurais.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d) };
    case 'DELETE_DIVIDA_RURAL':
      return { ...state, dividasRurais: state.dividasRurais.filter(d => d.id !== action.payload) };
    // Mesma mecânica de REGISTRAR_MOVIMENTACAO_DIVIDA, só que na coleção de
    // dívidas da atividade rural.
    case 'REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL': {
      const { bemId: dividaId, movimentacao } = action.payload;
      return {
        ...state,
        dividasRurais: state.dividasRurais.map(d => {
          if (d.id !== dividaId) return d;
          const mov = { ...movimentacao, id: novoId() };
          let situacao_atual = d.situacao_atual;
          if (mov.tipo === 'contratacao') situacao_atual += mov.valor;
          else if (mov.tipo === 'amortizacao') situacao_atual = Math.max(0, situacao_atual - mov.valor);
          else if (mov.tipo === 'quitacao') situacao_atual = 0;
          else if (mov.tipo === 'ajuste') situacao_atual = mov.valor;
          return { ...d, situacao_atual, movimentacoes: [...(d.movimentacoes || []), mov] };
        }),
      };
    }
    case 'DELETE_MOVIMENTACAO_DIVIDA_RURAL': {
      const { bemId: dividaId, movId } = action.payload;
      return {
        ...state,
        dividasRurais: state.dividasRurais.map(d => {
          if (d.id !== dividaId) return d;
          const movimentacoes = (d.movimentacoes || []).filter(m => m.id !== movId);
          return { ...d, movimentacoes, situacao_atual: situacaoDividaAposExclusao(d, movimentacoes) };
        }),
      };
    }
    case 'UPDATE_MOVIMENTACAO_DIVIDA_RURAL': {
      const { bemId: dividaId, movId, movimentacao } = action.payload;
      return {
        ...state,
        dividasRurais: state.dividasRurais.map(d => {
          if (d.id !== dividaId) return d;
          const movimentacoes = (d.movimentacoes || []).map(m => m.id === movId ? { ...movimentacao, id: movId } : m);
          return { ...d, movimentacoes, situacao_atual: situacaoDividaAposExclusao(d, movimentacoes) };
        }),
      };
    }

    case 'ADD_IMOVEL_RURAL':
      return { ...state, imoveisRurais: [...state.imoveisRurais, { ...action.payload, id: novoId(), origem: 'manual' }] };
    case 'UPDATE_IMOVEL_RURAL':
      return { ...state, imoveisRurais: state.imoveisRurais.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) };
    case 'DELETE_IMOVEL_RURAL':
      return { ...state, imoveisRurais: state.imoveisRurais.filter(i => i.id !== action.payload) };

    // Receita/despesa da atividade rural, lançada conforme acontece (como
    // o resto do app) em vez de preencher um formulário anual de uma vez.
    case 'ADD_LANCAMENTO_RURAL':
      return { ...state, lancamentosRurais: [...state.lancamentosRurais, { ...action.payload, id: novoId() }] };
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
      return { ...state, pagamentosDiversos: [...state.pagamentosDiversos, { ...action.payload, id: novoId() }] };
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
        // blankYear de propósito NÃO zera imoveisRurais/prejuizoRuralAcompensar
        // (ver comentário na definição dele): esses dois persistem de ano pra
        // ano no fluxo normal de ROLLOVER_ANO. Mas aqui não é um novo ano
        // nascendo por cima do anterior — é o ÚLTIMO ano-calendário sendo
        // excluído, sem nenhum outro restando no histórico. Sem zerar os dois
        // também, "Excluir" deixava as fazendas de Atividade Rural e o saldo
        // de prejuízo acumulado sobrevivendo à exclusão (achado real,
        // reportado pela usuária: excluiu a declaração e os dados
        // continuaram aparecendo).
        return { ...state, ...blankYear, imoveisRurais: [], prejuizoRuralAcompensar: 0, historico, anoCalendario: null, origemAnoAtual: null };
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
  pagamentos: 'nome_beneficiario', bensRurais: 'discriminacao', dividasRurais: 'discriminacao', imoveisRurais: 'nomeLocalizacao',
  lancamentosRurais: 'descricao', pagamentosDiversos: 'descricao', dependentes: 'nome',
  doacoesEfetuadasOficial: 'nome_beneficiario', doacoesPartidosOficial: 'nome_beneficiario', doacoesEcaIdosoOficial: 'nome_beneficiario',
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
    case 'ADD_DOACAO_EFETUADA': return `Cadastrou doação efetuada: ${itemLabel('doacoesEfetuadasOficial', p)}`;
    case 'UPDATE_DOACAO_EFETUADA': return `Editou doação efetuada: ${itemLabel('doacoesEfetuadasOficial', p)}`;
    case 'DELETE_DOACAO_EFETUADA': return `Excluiu doação efetuada: ${itemLabel('doacoesEfetuadasOficial', buscar(state, 'doacoesEfetuadasOficial', p))}`;
    case 'ADD_DOACAO_PARTIDO': return `Cadastrou doação a partido/candidato: ${itemLabel('doacoesPartidosOficial', p)}`;
    case 'UPDATE_DOACAO_PARTIDO': return `Editou doação a partido/candidato: ${itemLabel('doacoesPartidosOficial', p)}`;
    case 'DELETE_DOACAO_PARTIDO': return `Excluiu doação a partido/candidato: ${itemLabel('doacoesPartidosOficial', buscar(state, 'doacoesPartidosOficial', p))}`;
    case 'ADD_DOACAO_ECA_IDOSO': return `Cadastrou doação ECA/Pessoa Idosa: ${itemLabel('doacoesEcaIdosoOficial', p)}`;
    case 'UPDATE_DOACAO_ECA_IDOSO': return `Editou doação ECA/Pessoa Idosa: ${itemLabel('doacoesEcaIdosoOficial', p)}`;
    case 'DELETE_DOACAO_ECA_IDOSO': return `Excluiu doação ECA/Pessoa Idosa: ${itemLabel('doacoesEcaIdosoOficial', buscar(state, 'doacoesEcaIdosoOficial', p))}`;
    case 'ADD_PAGAMENTO': return `Cadastrou pagamento: ${itemLabel('pagamentos', p)}`;
    case 'UPDATE_PAGAMENTO': return `Editou pagamento: ${itemLabel('pagamentos', p)}`;
    case 'DELETE_PAGAMENTO': return `Excluiu pagamento: ${itemLabel('pagamentos', buscar(state, 'pagamentos', p))}`;
    case 'ADD_BEM_RURAL': return `Cadastrou bem rural: ${itemLabel('bensRurais', p)}`;
    case 'UPDATE_BEM_RURAL': return `Editou bem rural: ${itemLabel('bensRurais', p)}`;
    case 'DELETE_BEM_RURAL': return `Excluiu bem rural: ${itemLabel('bensRurais', buscar(state, 'bensRurais', p))}`;
    case 'ADD_DIVIDA_RURAL': return `Cadastrou dívida rural: ${itemLabel('dividasRurais', p)}`;
    case 'UPDATE_DIVIDA_RURAL': return `Editou dívida rural: ${itemLabel('dividasRurais', p)}`;
    case 'DELETE_DIVIDA_RURAL': return `Excluiu dívida rural: ${itemLabel('dividasRurais', buscar(state, 'dividasRurais', p))}`;
    case 'REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL': return `Registrou movimentação (${p.movimentacao?.tipo || ''}) na dívida rural: ${itemLabel('dividasRurais', buscar(state, 'dividasRurais', p.bemId))}`;
    case 'DELETE_MOVIMENTACAO_DIVIDA_RURAL': return `Excluiu movimentação na dívida rural: ${itemLabel('dividasRurais', buscar(state, 'dividasRurais', p.bemId))}`;
    case 'UPDATE_MOVIMENTACAO_DIVIDA_RURAL': return `Editou movimentação na dívida rural: ${itemLabel('dividasRurais', buscar(state, 'dividasRurais', p.bemId))}`;
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
    case 'DELETE_MOVIMENTACAO_BEM': return `Excluiu movimentação no bem: ${itemLabel('bens', buscar(state, 'bens', p.bemId))}`;
    case 'DELETE_MOVIMENTACAO_BEM_RURAL': return `Excluiu movimentação no bem rural: ${itemLabel('bensRurais', buscar(state, 'bensRurais', p.bemId))}`;
    case 'DELETE_MOVIMENTACAO_DIVIDA': return `Excluiu movimentação na dívida: ${itemLabel('dividas', buscar(state, 'dividas', p.bemId))}`;
    case 'UPDATE_MOVIMENTACAO_BEM': return `Editou movimentação no bem: ${itemLabel('bens', buscar(state, 'bens', p.bemId))}`;
    case 'UPDATE_MOVIMENTACAO_BEM_RURAL': return `Editou movimentação no bem rural: ${itemLabel('bensRurais', buscar(state, 'bensRurais', p.bemId))}`;
    case 'UPDATE_MOVIMENTACAO_DIVIDA': return `Editou movimentação na dívida: ${itemLabel('dividas', buscar(state, 'dividas', p.bemId))}`;
    case 'AJUSTAR_PREJUIZO_RURAL': return `Ajustou o prejuízo da atividade rural a compensar`;
    case 'IMPORT_DECLARACAO': return `Importou declaração${p.anoCalendario ? ` do ano-calendário ${p.anoCalendario}` : ''}`;
    case 'RECONCILIAR_IMPORTACAO': return `Reimportou declaração retificadora do ano-calendário ${p.anoCalendario}, com conciliação item a item`;
    case 'ROLLOVER_ANO': return `Avançou o ano-calendário para ${p}`;
    case 'SWITCH_ANO': return `Trocou o ano-calendário para ${p}`;
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
    id: novoId(),
    data: new Date().toISOString(),
    anoCalendario: novoEstado.anoCalendario,
    descricao,
  };
  return { ...novoEstado, alteracoes: [entrada, ...(novoEstado.alteracoes || [])].slice(0, 300) };
}
