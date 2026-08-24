import { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import { reducerComHistorico, initialState, snapshotHasData, hasWorkingData } from './reducer';
import { dataStorageKeyFor, PERFIS_STORAGE_KEY, sincronizarPerfilComContribuinte } from './perfis';
import { criptografarObjeto } from '../utils/crypto';

const DataContext = createContext(null);

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
  let next = merged;
  if (raw.origemAnoAtual === undefined && hasWorkingData(merged)) {
    next = { ...next, origemAnoAtual: 'importacao' };
  }
  if (raw.historico) {
    let mudou = false;
    const historico = { ...next.historico };
    for (const ano of Object.keys(raw.historico)) {
      const h = raw.historico[ano];
      if (h && h.origem === undefined && snapshotHasData(h)) {
        historico[ano] = { ...h, origem: 'importacao' };
        mudou = true;
      }
    }
    if (mudou) next = { ...next, historico };
  }
  return next;
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
      return migrarOrigemLegado({ ...initialState, ...initialData }, initialData);
    }
    try {
      const saved = localStorage.getItem(dataStorageKeyFor(perfilId));
      if (saved) {
        const raw = JSON.parse(saved);
        return migrarOrigemLegado({ ...initialState, ...raw }, raw);
      }
    } catch {}
    return initialState;
  });

  const saveToStorage = useCallback(() => {
    try {
      // Achado real: excluir um perfil (PerfilLauncherPage remove a chave
      // de dados e tira o perfil da lista) e o dado "voltar" sozinho —
      // causa era um autosave em voo escrevendo por cima DEPOIS da
      // exclusão, sobretudo pelo caminho assíncrono do Web Crypto abaixo
      // (a criptografia pode resolver alguns milissegundos depois do clique
      // em "Excluir"). Reconferir aqui, e de novo dentro do `.then()`
      // assíncrono, é o que fecha a corrida: se o perfil já não existe mais
      // na lista, não há o que salvar.
      // Em caso de falha ao ler/parsear a lista (não deveria acontecer),
      // assume que o perfil existe: o objetivo aqui é só barrar a escrita
      // quando dá pra CONFIRMAR a exclusão, nunca arriscar perder um
      // autosave legítimo por causa de uma leitura que deu errado.
      const perfilAindaExiste = () => {
        try {
          const perfisSalvos = JSON.parse(localStorage.getItem(PERFIS_STORAGE_KEY) || '[]');
          return perfisSalvos.some(p => p.id === perfilId);
        } catch {
          return true;
        }
      };
      if (!perfilAindaExiste()) return;
      const { toasts, ...data } = state;
      if (chave) {
        // Assíncrono de propósito (Web Crypto): dispara e não espera — o
        // autosave já roda a cada mudança de estado, então um atraso de
        // poucos milissegundos na escrita não é perceptível, e nunca é o
        // caminho crítico de nenhuma ação da usuária.
        criptografarObjeto(chave, data)
          .then(envelope => {
            if (!perfilAindaExiste()) return;
            localStorage.setItem(dataStorageKeyFor(perfilId), JSON.stringify(envelope));
          })
          .catch(() => {});
      } else {
        localStorage.setItem(dataStorageKeyFor(perfilId), JSON.stringify(data));
      }
      // Mantém o card do perfil (tela de seleção) mostrando o titular atual,
      // não o nome/CPF de quando o perfil foi criado.
      if (state.contribuinte) {
        const perfisSalvos = JSON.parse(localStorage.getItem(PERFIS_STORAGE_KEY) || '[]');
        const perfisAtualizados = sincronizarPerfilComContribuinte(perfisSalvos, perfilId, state.contribuinte);
        if (perfisAtualizados !== perfisSalvos) {
          localStorage.setItem(PERFIS_STORAGE_KEY, JSON.stringify(perfisAtualizados));
        }
      }
    } catch {}
  }, [state, perfilId, chave]);

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
  // diferente do ativo no campo de ano do próprio modal de cadastro, isso
  // troca (ou inicia, se for um ano novo) o ano ativo antes de gravar o
  // registro ali — mesma mecânica testada de SWITCH_ANO/ROLLOVER_ANO, só que
  // disparada a partir do formulário de cadastro em vez de um botão à parte
  // na sidebar. Recusar o aviso cancela a troca (e o cadastro).
  const garantirAnoCadastro = useCallback((anoEscolhido) => {
    if (anoEscolhido === state.anoCalendario) return true;
    const confirmado = confirm(
      `Isso vai trocar o ano-calendário ativo de ${state.anoCalendario} para ${anoEscolhido} antes de salvar. Continuar?`
    );
    if (!confirmado) return false;
    const existe = snapshotHasData(state.historico[anoEscolhido]);
    dispatch({ type: existe ? 'SWITCH_ANO' : 'ROLLOVER_ANO', payload: anoEscolhido });
    return true;
  }, [state]);

  return (
    <DataContext.Provider value={{ state, dispatch, saveToStorage, addToast, garantirAnoCadastro }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}