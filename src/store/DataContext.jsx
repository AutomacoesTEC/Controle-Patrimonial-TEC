import { createContext, useContext, useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { reducerComHistorico, initialState, snapshotHasData, hasWorkingData } from './reducer';
import { dataStorageKeyFor, PERFIS_STORAGE_KEY, sincronizarPerfilComContribuinte } from './perfis';
import { migrarEstadoPersistido } from './migracoes';
import { criptografarObjeto } from '../utils/crypto';
import ConfirmacaoModal from '../components/ConfirmacaoModal';

const DataContext = createContext(null);

const COLECOES_COM_ORIGEM = [
  'bens', 'dividas', 'rendimentos', 'pagamentos',
  'imoveisRurais', 'bensRurais', 'dividasRurais',
  'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial',
];

function migrarItensSemOrigem(dados) {
  let mudou = false;
  const next = { ...dados };
  for (const campo of COLECOES_COM_ORIGEM) {
    if (!Array.isArray(dados?.[campo])) continue;
    const lista = dados[campo].map((item, index) => {
      if (!item) return item;
      const prefixoRural = {
        bensRurais: 'bem-rural',
        dividasRurais: 'divida-rural',
        imoveisRurais: 'imovel-rural',
      }[campo];
      const precisaOrigem = item.origem === undefined;
      const precisaChave = prefixoRural && !item.controle && !item.chaveAssociacao && !item.chaveImportacao;
      if (!precisaOrigem && !precisaChave) return item;
      mudou = true;
      return {
        ...item,
        ...(precisaOrigem ? { origem: 'origem_legacy' } : {}),
        ...(precisaChave ? { chaveImportacao: (() => {
          const ordem = item.ordemDeclaracao || index + 1;
          if (campo === 'bensRurais') {
            return `pdf:${prefixoRural}:${ordem}:${item.codigo || item.codigo_bem || ''}:${Number(item.situacao_anterior || 0).toFixed(2)}`;
          }
          if (campo === 'dividasRurais') {
            return `pdf:${prefixoRural}:${ordem}:${Number(item.situacao_anterior || 0).toFixed(2)}`;
          }
          return `pdf:${prefixoRural}:${ordem}:${String(item.cib || '').replace(/\D/g, '')}:${item.codigoAtividade || ''}`;
        })() } : {}),
      };
    });
    if (mudou) next[campo] = lista;
  }
  return mudou ? next : dados;
}

// Dados salvos por uma versão do app anterior à existência de
// origemAnoAtual/origem não têm essa chave no JSON bruto (distinto de tê-la
// como null, que É um valor válido — "avançado manualmente"). Sem migrar,
// uma declaração de verdade já importada some da tela Importar > Histórico
// de Declarações, embora bens/dívidas continuem intactos — foi um bug real,
// reportado pela usuária vendo dados no app mas "Nenhuma declaração salva no
// histórico". Como importar era, na prática, a única forma de o app ganhar
// dados reais antes dessa distinção existir, ano com dado e sem a chave é
// tratado como 'importacao'; ano sem dado nenhum não vira declaração (segue
// null, mesmo critério de sempre).
export function migrarOrigemLegado(merged, raw) {
  let next = migrarItensSemOrigem(merged);
  if (raw.origemAnoAtual === undefined && hasWorkingData(merged)) {
    next = { ...next, origemAnoAtual: 'importacao' };
  }
  if (raw.historico) {
    let mudou = false;
    const historico = { ...next.historico };
    for (const ano of Object.keys(raw.historico)) {
      const h = raw.historico[ano];
      const hComItensMigrados = h ? migrarItensSemOrigem(h) : h;
      if (hComItensMigrados !== h) {
        historico[ano] = hComItensMigrados;
        mudou = true;
      }
      if (hComItensMigrados && hComItensMigrados.origem === undefined && snapshotHasData(hComItensMigrados)) {
        historico[ano] = { ...hComItensMigrados, origem: 'importacao' };
        mudou = true;
      }
    }
    if (mudou) next = { ...next, historico };
  }
  return next;
}

// Carga do estado de um perfil, em UM lugar só (os dois caminhos do
// useReducer abaixo passam por aqui: perfil em texto puro lido do
// localStorage e perfil protegido já decriptado por DesbloquearPerfilPage).
//
// Ordem, e o porquê dela:
//   1. `migrarEstadoPersistido` roda a cadeia de versão de esquema (item A1,
//      ver migracoes.js) sobre o objeto CRU, antes de qualquer merge — é o
//      único passo que enxerga o que o arquivo realmente tinha e o único que
//      alcança o interior de `historico[ano]`, que nenhum merge com
//      initialState cobre;
//   2. o merge com `initialState` completa o que é só da raiz (ano ativo,
//      alterações, histórico);
//   3. `migrarOrigemLegado` fecha a migração de CONTEÚDO que já existia antes
//      da versão de esquema (origem do ano e marca de origem por item). Ela
//      recebe o objeto JÁ migrado como "raw" de propósito: nenhum salto de
//      versão cria `origemAnoAtual` nem `origem`, então a distinção entre
//      "chave ausente" e "null explícito" que ela usa continua valendo.
//
// A migração não é regravada na hora: o autosave só dispara na primeira
// alteração de verdade (ver o useEffect adiante), e até lá o perfil continua
// no disco no formato antigo. Não é problema — a cadeia é idempotente e roda
// a cada carga —, mas explica por que a marca de versão só aparece no
// localStorage depois do primeiro lançamento.
export function carregarEstadoDoPerfil(raw) {
  const migrado = migrarEstadoPersistido(raw);
  return migrarOrigemLegado({ ...initialState, ...migrado }, migrado);
}

export async function persistirDadosPerfil({ storage, perfilId, chave, estado, criptografar = criptografarObjeto }) {
  let perfisSalvos = JSON.parse(storage.getItem(PERFIS_STORAGE_KEY) || '[]');
  if (!perfisSalvos.some(p => p.id === perfilId)) return { salvo: false, motivo: 'perfil_removido' };

  const { toasts, ...dados } = estado;
  const conteudo = chave ? await criptografar(chave, dados) : dados;
  // A criptografia é assíncrona. O perfil pode ter sido excluído enquanto ela
  // estava em andamento; reconferir evita que um autosave atrasado o recrie.
  perfisSalvos = JSON.parse(storage.getItem(PERFIS_STORAGE_KEY) || '[]');
  if (!perfisSalvos.some(p => p.id === perfilId)) return { salvo: false, motivo: 'perfil_removido' };
  storage.setItem(dataStorageKeyFor(perfilId), JSON.stringify(conteudo));

  if (estado.contribuinte) {
    const perfisAtualizados = sincronizarPerfilComContribuinte(perfisSalvos, perfilId, estado.contribuinte);
    if (perfisAtualizados !== perfisSalvos) {
      storage.setItem(PERFIS_STORAGE_KEY, JSON.stringify(perfisAtualizados));
    }
  }
  return { salvo: true };
}

// Serializa gravações, inclusive quando a criptografia é assíncrona. Sem a
// fila, um autosave antigo podia terminar depois da importação confirmada e
// sobrescrever o estado mais novo no armazenamento.
export function enfileirarPersistencia(filaRef, tarefa) {
  const execucao = filaRef.current.then(tarefa, tarefa);
  filaRef.current = execucao.then(() => undefined, () => undefined);
  return execucao;
}

// perfilId identifica QUAL titular está sendo editado — cada perfil grava
// num par de chaves de localStorage isoladas (uma por perfilId, via
// dataStorageKeyFor). O chamador (App.jsx) monta este provider com
// `key={perfilId}`: trocar de perfil força um useReducer NOVO lendo a
// chave nova, em vez de mutar o estado de um perfil em cima do outro — é
// isso que garante não misturar titulares/dependentes entre perfis.
// `chave` (CryptoKey) só existe quando o perfil é protegido por senha —
// nesse caso quem já leu e decriptou o dado UMA VEZ (a tela de
// desbloqueio, ver DesbloquearPerfilPage) passa o resultado pronto em
// `initialData`, porque o Web Crypto é assíncrono e o useReducer precisa
// de um valor inicial síncrono. Sem `chave`, o comportamento é o de
// sempre: lê/grava texto puro em localStorage.
export function DataProvider({ perfilId, chave, initialData, children }) {
  const [state, dispatch] = useReducer(reducerComHistorico, initialState, () => {
    if (initialData) {
      return carregarEstadoDoPerfil(initialData);
    }
    try {
      const saved = localStorage.getItem(dataStorageKeyFor(perfilId));
      if (saved) {
        return carregarEstadoDoPerfil(JSON.parse(saved));
      }
    } catch {}
    return initialState;
  });
  const [persistencia, setPersistencia] = useState({ estado: 'ociosa', erro: null });
  const filaPersistencia = useRef(Promise.resolve());
  const numeroPersistencia = useRef(0);

  const saveToStorage = useCallback((estadoParaSalvar = state) => {
    const numero = ++numeroPersistencia.current;
    setPersistencia({ estado: 'salvando', erro: null });
    return enfileirarPersistencia(filaPersistencia, async () => {
      try {
        // A função de persistência reconfere a existência do perfil antes e
        // depois da criptografia e propaga falhas de quota/gravação.
        const resultado = await persistirDadosPerfil({ storage: localStorage, perfilId, chave, estado: estadoParaSalvar });
        if (!resultado.salvo) return false;
        if (numero === numeroPersistencia.current) setPersistencia({ estado: 'salva', erro: null });
        return true;
      } catch (erro) {
        if (numero === numeroPersistencia.current) {
          setPersistencia({ estado: 'erro', erro: erro?.message || 'Falha ao salvar os dados localmente' });
        }
        return false;
      }
    });
  }, [state, perfilId, chave]);

  const dispatchPersistido = useCallback(async (action) => {
    const proximoEstado = reducerComHistorico(state, action);
    const salvo = await saveToStorage(proximoEstado);
    if (!salvo) {
      throw new Error('A declaração foi analisada, mas não pôde ser salva neste computador. Libere espaço ou verifique o armazenamento do navegador e tente novamente.');
    }
    dispatch({ type: 'SUBSTITUIR_ESTADO_PERSISTIDO', payload: proximoEstado });
    return proximoEstado;
  }, [state, saveToStorage]);

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
    // Fecha em duas etapas: marca "closing" para tocar a animação de saída
    // (150ms, ver --transition-fast em index.css) e só então tira do estado.
    setTimeout(() => {
      dispatch({ type: 'CLOSE_TOAST', payload: id });
      setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 150);
    }, 4000);
  }, []);

  // O ano-calendário ativo NÃO trava o que pode ser cadastrado — ele é só o
  // contexto que "Novo X" assume por padrão. Se a pessoa escolher um ano
  // diferente do ativo no campo de ano (ou a data) do próprio formulário de
  // cadastro, o registro é gravado no ano dela, mas a TELA CONTINUA
  // mostrando o ano ativo (pedido da usuária em 03/09/2026, item G do
  // HANDOFF-2026-09-03.md — antes disparava SWITCH_ANO/ROLLOVER_ANO e a tela
  // pulava de ano). Quem chama precisa despachar a gravação com
  // `despacharEmAno` (não com `dispatch` direto), que é o que realmente leva
  // o item ao ano certo sem tocar no ano em exibição — ver ADD_EM_ANO no
  // reducer. Recusar o aviso cancela o cadastro.
  //
  // Exceção: sem NENHUM ano-calendário ativo ainda (`state.anoCalendario ==
  // null`, onboarding — primeiro titular/bem/dependente de um perfil novo),
  // não há "visão" nenhuma para preservar, então este é o único caso em que
  // `garantirAnoCadastro` ainda troca de verdade (SWITCH_ANO/ROLLOVER_ANO),
  // exatamente como sempre fez — é o que estabelece o ano ativo pela 1ª vez.
  // Confirmação própria (modal "Atenção"), no lugar do confirm() nativo.
  // `confirmar(opcoes)` devolve Promise<boolean>. Ver ConfirmacaoModal.jsx.
  const [confirmState, setConfirmState] = useState(null);
  const resolverConfirmRef = useRef(null);
  const confirmar = useCallback((opcoes = {}) => new Promise((resolve) => {
    resolverConfirmRef.current = resolve;
    setConfirmState({ ...opcoes });
  }), []);
  const responderConfirm = useCallback((ok) => {
    setConfirmState(null);
    const r = resolverConfirmRef.current;
    resolverConfirmRef.current = null;
    r?.(ok);
  }, []);

  // Devolve o ano-alvo (truthy, para gravar com despacharEmAno) ou `null`
  // se a pessoa cancelou o aviso. Deixou de devolver um boolean "trocou de
  // ano" porque, fora do onboarding, não troca mais nada.
  const garantirAnoCadastro = useCallback(async (anoEscolhido) => {
    if (anoEscolhido === state.anoCalendario) return anoEscolhido;
    const semAnoAtivo = state.anoCalendario == null;
    const ok = await confirmar({
      titulo: 'Gravar em outro ano-calendário?',
      texto: semAnoAtivo
        ? `Você ainda não tem nenhum ano-calendário ativo. Os dados serão gravados em ${anoEscolhido} e o app passa a exibir esse ano. Confirma?`
        : `O ano-calendário ativo é ${state.anoCalendario} e o que você está cadastrando é de ${anoEscolhido}. Será gravado em ${anoEscolhido}; a tela continua mostrando ${state.anoCalendario}. Confirma?`,
      textoConfirmar: `Gravar em ${anoEscolhido}`,
    });
    if (!ok) return null;
    if (semAnoAtivo) {
      const existe = snapshotHasData(state.historico[anoEscolhido]);
      dispatch({ type: existe ? 'SWITCH_ANO' : 'ROLLOVER_ANO', payload: anoEscolhido });
    }
    return anoEscolhido;
  }, [state, confirmar]);

  // Sempre envolve em ADD_EM_ANO, mesmo quando `ano` já é o ativo: o reducer
  // trata os dois casos de forma idêntica a um dispatch direto (ver
  // reducer.test.js), então quem chama não precisa comparar com
  // state.anoCalendario — inclusive porque, num handler que já disparou
  // outro dispatch antes (ex.: o SWITCH_ANO do onboarding acima), o `state`
  // capturado neste closure já estaria desatualizado para essa comparação;
  // o reducer sempre roda contra o estado real no momento do processamento.
  const despacharEmAno = useCallback((ano, acao) => {
    dispatch({ type: 'ADD_EM_ANO', payload: { ano, action: acao } });
  }, [dispatch]);

  return (
    <DataContext.Provider value={{
      state,
      dispatch,
      dispatchPersistido,
      saveToStorage,
      persistencia,
      addToast,
      garantirAnoCadastro,
      despacharEmAno,
      confirmar,
      perfilProtegido: !!chave,
    }}>
      {children}
      <ConfirmacaoModal
        open={!!confirmState}
        {...confirmState}
        onConfirmar={() => responderConfirm(true)}
        onCancelar={() => responderConfirm(false)}
      />
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
