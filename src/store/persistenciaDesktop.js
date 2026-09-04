import { dataStorageKeyFor, PERFIS_STORAGE_KEY } from './perfis';

export function apiDesktopAtual(desktopApi) {
  if (desktopApi !== undefined) return desktopApi;
  return typeof window !== 'undefined' ? window.pywebview?.api : null;
}

async function chamarApi(api, metodo, argumentos, aceitar) {
  if (!api) return false;
  if (typeof api[metodo] !== 'function') throw new Error(`A ponte desktop não oferece ${metodo}.`);
  const resultado = await api[metodo](...argumentos);
  if (!aceitar(resultado)) throw new Error('O ambiente desktop recusou a persistência em disco.');
  return true;
}

export async function salvarPerfilDuravel({ storage, desktopApi, perfilId, conteudo }) {
  const texto = typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo);
  await chamarApi(apiDesktopAtual(desktopApi), 'salvar_perfil', [perfilId, texto], resultado => resultado?.salvo);
  storage.setItem(dataStorageKeyFor(perfilId), texto);
  return texto;
}

export async function salvarIndiceDuravel({ storage, desktopApi, perfis }) {
  const texto = typeof perfis === 'string' ? perfis : JSON.stringify(perfis);
  await chamarApi(apiDesktopAtual(desktopApi), 'salvar_indice_perfis', [texto], resultado => resultado?.salvo);
  storage.setItem(PERFIS_STORAGE_KEY, texto);
  return texto;
}

export async function excluirPerfilDuravel({ storage, desktopApi, perfilId }) {
  await chamarApi(apiDesktopAtual(desktopApi), 'excluir_perfil', [perfilId], resultado =>
    resultado?.excluido === true || resultado?.excluido === false,
  );
  storage.removeItem(dataStorageKeyFor(perfilId));
}

export async function selecionarBackupDesktop({ desktopApi } = {}) {
  const api = apiDesktopAtual(desktopApi);
  if (typeof api?.selecionar_backup !== 'function') {
    return { disponivel: false, arquivo: null };
  }
  const arquivo = await api.selecionar_backup();
  if (arquivo === null) return { disponivel: true, arquivo: null };
  if (typeof arquivo?.nomeArquivo !== 'string' || typeof arquivo?.conteudo !== 'string') {
    throw new Error('O seletor de arquivos devolveu um resultado inválido.');
  }
  return { disponivel: true, arquivo };
}
