import { lerArquivoBackup, restaurarBackup, serializarCanonico } from './backupPerfil';
import { dataStorageKeyFor } from './perfis';
import { derivarChave, descriptografarObjeto } from '../utils/crypto';

// Usa o MESMO restaurador do app, com storage descartável injetado e sem ponte
// desktop. Lê de volta o conteúdo gravado; não confia apenas no valor retornado.
// Nunca recebe localStorage, perfil-alvo nem permissão para substituição.
export async function ensaiarBackup(texto, senha = '') {
  const arquivo = await lerArquivoBackup(texto);
  const mapa = new Map();
  const storage = { getItem: k => mapa.get(k) ?? null, setItem: (k, v) => mapa.set(k, String(v)), removeItem: k => mapa.delete(k) };
  const resultado = await restaurarBackup({ storage, desktopApi: null, arquivo, senha });
  const salvo = JSON.parse(storage.getItem(dataStorageKeyFor(resultado.perfil.id)));
  const relido = arquivo.protegido ? await descriptografarObjeto(await derivarChave(senha, arquivo.salt), salvo) : salvo;
  if (serializarCanonico(relido) !== serializarCanonico(resultado.estado)) throw new Error('O conteúdo relido difere do conteúdo restaurado.');
  return { hash: arquivo.hash, protegido: arquivo.protegido, exportadoEm: arquivo.exportadoEm, versaoEsquema: relido.versaoEsquema, anos: [...new Set([...Object.keys(relido.historico || {}), ...(relido.anoCalendario ? [String(relido.anoCalendario)] : [])])], contas: relido.acompanhamento?.contas?.length || 0, lancamentos: relido.acompanhamento?.lancamentos?.length || 0, documentosExternos: relido.acompanhamento?.documentos?.length || 0, verificadoEm: new Date().toISOString(), metodo: 'Integridade, senha (se protegida), restauração em perfil de memória e releitura; sem teste físico de disco.' };
}
