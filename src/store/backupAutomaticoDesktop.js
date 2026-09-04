import { montarArquivoBackup, nomeArquivoBackup, textoDoArquivoBackup } from './backupPerfil';
import { PERFIS_STORAGE_KEY } from './perfis';
import { versaoDoEstado } from './migracoes';
import { criptografarObjeto } from '../utils/crypto';

export const INTERVALO_BACKUP_AUTOMATICO_MS = 15 * 60 * 1000;

export async function salvarBackupAutomaticoDesktop({
  api,
  storage,
  perfilId,
  estado,
  chave,
  agora = new Date(),
  criptografar = criptografarObjeto,
}) {
  if (typeof api?.salvar_backup_automatico !== 'function') {
    return { salvo: false, motivo: 'fora_desktop' };
  }
  const perfis = JSON.parse(storage.getItem(PERFIS_STORAGE_KEY) || '[]');
  const perfil = perfis.find(item => item?.id === perfilId);
  if (!perfil) return { salvo: false, motivo: 'perfil_removido' };

  const { toasts: _toasts, ...dados } = estado;
  const arquivo = await montarArquivoBackup({
    perfil,
    conteudo: chave ? await criptografar(chave, dados) : dados,
    protegido: !!chave,
    salt: chave ? perfil.salt || null : null,
    versaoEsquema: versaoDoEstado(dados),
    agora,
  });
  const nome = nomeArquivoBackup(perfil, agora);
  const resultado = await api.salvar_backup_automatico(nome, textoDoArquivoBackup(arquivo));
  if (!resultado?.salvo) throw new Error('O ambiente desktop recusou o backup automático.');
  return { salvo: true, nome: resultado.nome || nome };
}

export function agendarBackupAutomaticoDesktop({
  api,
  executar,
  onErro = () => {},
  intervalo = INTERVALO_BACKUP_AUTOMATICO_MS,
  agendar = setInterval,
  cancelar = clearInterval,
}) {
  if (typeof api?.salvar_backup_automatico !== 'function') return null;
  const rodar = () => Promise.resolve(executar(api)).catch(onErro);
  void rodar();
  const timer = agendar(rodar, intervalo);
  return () => cancelar(timer);
}
