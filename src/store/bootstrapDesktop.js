import {
  dataStorageKeyFor, LEGADO_STORAGE_KEY, perfilAPartirDeDadosLegados,
  PERFIS_STORAGE_KEY,
} from './perfis';
import { snapshotHasData } from './reducer';

const PREFIXO_DADOS = dataStorageKeyFor('');
const ID_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function lerJson(texto, descricao) {
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`${descricao} contém JSON inválido.`);
  }
}

function validarLista(texto) {
  const lista = lerJson(texto, 'O índice de perfis');
  if (!Array.isArray(lista) || lista.some(perfil => !perfil || !ID_VALIDO.test(perfil.id))) {
    throw new Error('O índice de perfis em disco é inválido.');
  }
  return lista;
}

export function migrarLegadoParaCache(storage, agora = new Date()) {
  const existente = storage.getItem(PERFIS_STORAGE_KEY);
  if (existente) return existente;
  const dadosLegadoRaw = storage.getItem(LEGADO_STORAGE_KEY);
  if (!dadosLegadoRaw) return null;
  const dadosLegado = lerJson(dadosLegadoRaw, 'O armazenamento legado');
  if (!snapshotHasData(dadosLegado)) return null;
  const perfil = perfilAPartirDeDadosLegados(dadosLegado, agora);
  storage.setItem(dataStorageKeyFor(perfil.id), dadosLegadoRaw);
  const indice = JSON.stringify([perfil]);
  storage.setItem(PERFIS_STORAGE_KEY, indice);
  return indice;
}

async function exigir(api, metodo, ...argumentos) {
  if (typeof api?.[metodo] !== 'function') throw new Error(`A ponte desktop não oferece ${metodo}.`);
  const resultado = await api[metodo](...argumentos);
  const aceito = metodo === 'carregar_cache' ? resultado && typeof resultado === 'object' : resultado?.salvo;
  if (!aceito) throw new Error('O ambiente desktop recusou a persistência em disco.');
  return resultado;
}

function chavesDeDados(storage) {
  const chaves = [];
  for (let indice = 0; indice < Number(storage.length || 0); indice += 1) {
    const chave = storage.key(indice);
    if (chave?.startsWith(PREFIXO_DADOS)) chaves.push(chave);
  }
  return chaves;
}

async function migrarCacheParaDisco({ api, storage }) {
  const indice = migrarLegadoParaCache(storage) || '[]';
  const lista = validarLista(indice);
  let perfis = 0;
  for (const perfil of lista) {
    const texto = storage.getItem(dataStorageKeyFor(perfil.id));
    if (texto === null) continue;
    lerJson(texto, `O perfil ${perfil.id}`);
    const resultado = await exigir(api, 'salvar_perfil', perfil.id, texto);
    if (!resultado.salvo) throw new Error('O ambiente desktop recusou um perfil.');
    perfis += 1;
  }
  // Índice por último: uma migração interrompida é retomada na abertura
  // seguinte, em vez de declarar completa uma coleção parcial.
  await exigir(api, 'salvar_indice_perfis', indice);
  return { origem: 'cache_migrado', perfis };
}

export async function hidratarCacheDesktop({ api, storage }) {
  const cache = await exigir(api, 'carregar_cache');
  if (cache.indice == null) return migrarCacheParaDisco({ api, storage });
  if (!cache.perfis || typeof cache.perfis !== 'object' || Array.isArray(cache.perfis)) {
    throw new Error('A coleção de perfis em disco é inválida.');
  }

  const lista = validarLista(cache.indice);
  const ids = new Set(lista.map(perfil => perfil.id));
  const dadosValidos = new Map();
  for (const [perfilId, texto] of Object.entries(cache.perfis)) {
    if (!ids.has(perfilId)) continue;
    if (typeof texto !== 'string') throw new Error(`O perfil ${perfilId} em disco é inválido.`);
    lerJson(texto, `O perfil ${perfilId}`);
    dadosValidos.set(dataStorageKeyFor(perfilId), texto);
  }

  // Toda validação ocorre antes da primeira mutação. O disco é autoritativo:
  // chaves locais sem arquivo correspondente são removidas.
  for (const [chave, texto] of dadosValidos) storage.setItem(chave, texto);
  for (const chave of chavesDeDados(storage)) {
    if (!dadosValidos.has(chave)) storage.removeItem(chave);
  }
  storage.setItem(PERFIS_STORAGE_KEY, cache.indice);
  return { origem: 'disco', perfis: dadosValidos.size };
}

export function iniciarQuandoPersistenciaPronta({ janela, storage, iniciar }) {
  if (janela.location?.hash !== '#desktop') {
    iniciar();
    return Promise.resolve({ origem: 'navegador' });
  }
  const executar = async () => {
    const resultado = await hidratarCacheDesktop({ api: janela.pywebview?.api, storage });
    iniciar();
    return resultado;
  };
  if (janela.pywebview?.api) return executar();
  return new Promise((resolve, reject) => {
    janela.addEventListener('pywebviewready', () => executar().then(resolve, reject), { once: true });
  });
}
