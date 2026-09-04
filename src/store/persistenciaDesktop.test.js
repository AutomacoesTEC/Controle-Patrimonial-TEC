import { describe, expect, it, vi } from 'vitest';
import {
  excluirPerfilDuravel, salvarIndiceDuravel, salvarPerfilDuravel, selecionarBackupDesktop,
} from './persistenciaDesktop';

describe('persistência durável do desktop', () => {
  it('confirma o disco antes de atualizar o cache', async () => {
    const eventos = [];
    const storage = {
      setItem: (chave) => eventos.push(`cache:set:${chave}`),
      removeItem: (chave) => eventos.push(`cache:remove:${chave}`),
    };
    const desktopApi = {
      salvar_perfil: vi.fn(async () => { eventos.push('disco:perfil'); return { salvo: true }; }),
      salvar_indice_perfis: vi.fn(async () => { eventos.push('disco:indice'); return { salvo: true }; }),
      excluir_perfil: vi.fn(async () => { eventos.push('disco:excluir'); return { excluido: true }; }),
    };

    await salvarPerfilDuravel({ storage, desktopApi, perfilId: 'p1', conteudo: { valor: 1 } });
    await salvarIndiceDuravel({ storage, desktopApi, perfis: [{ id: 'p1' }] });
    await excluirPerfilDuravel({ storage, desktopApi, perfilId: 'p1' });

    expect(eventos).toEqual([
      'disco:perfil', 'cache:set:controle-patrimonial-data-p1',
      'disco:indice', 'cache:set:controle-patrimonial-perfis',
      'disco:excluir', 'cache:remove:controle-patrimonial-data-p1',
    ]);
  });

  it('preserva o modo navegador sem API', async () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn() };
    await salvarPerfilDuravel({ storage, desktopApi: null, perfilId: 'p1', conteudo: '{}' });
    await salvarIndiceDuravel({ storage, desktopApi: null, perfis: '[]' });
    await excluirPerfilDuravel({ storage, desktopApi: null, perfilId: 'p1' });
    expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).toHaveBeenCalledOnce();
  });

  it('usa o seletor nativo no desktop e preserva o fallback do navegador', async () => {
    const desktopApi = {
      selecionar_backup: vi.fn(async () => ({ nomeArquivo: 'perfil.cptec.json', conteudo: '{"ok":true}' })),
    };
    await expect(selecionarBackupDesktop({ desktopApi })).resolves.toEqual({
      disponivel: true,
      arquivo: { nomeArquivo: 'perfil.cptec.json', conteudo: '{"ok":true}' },
    });
    await expect(selecionarBackupDesktop({ desktopApi: null })).resolves.toEqual({
      disponivel: false, arquivo: null,
    });
    desktopApi.selecionar_backup.mockResolvedValueOnce(null);
    await expect(selecionarBackupDesktop({ desktopApi })).resolves.toEqual({
      disponivel: true, arquivo: null,
    });
  });
});
