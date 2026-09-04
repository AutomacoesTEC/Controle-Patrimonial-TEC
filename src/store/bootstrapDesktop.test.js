import { describe, expect, it, vi } from 'vitest';
import { hidratarCacheDesktop, iniciarQuandoPersistenciaPronta } from './bootstrapDesktop';
import { dataStorageKeyFor, PERFIS_STORAGE_KEY } from './perfis';

function storageMemoria(inicial = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    get length() { return dados.size; },
    key: indice => [...dados.keys()][indice] ?? null,
    getItem: chave => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, valor),
    removeItem: chave => dados.delete(chave),
    dados,
  };
}

describe('bootstrap da persistência desktop', () => {
  it('migra o localStorage antigo para o disco e grava o índice por último', async () => {
    const storage = storageMemoria({
      [PERFIS_STORAGE_KEY]: '[{"id":"p1"}]',
      [dataStorageKeyFor('p1')]: '{"valor":1}',
    });
    const ordem = [];
    const api = {
      carregar_cache: vi.fn(async () => ({ indice: null, perfis: {} })),
      salvar_perfil: vi.fn(async () => { ordem.push('perfil'); return { salvo: true }; }),
      salvar_indice_perfis: vi.fn(async () => { ordem.push('indice'); return { salvo: true }; }),
    };
    await expect(hidratarCacheDesktop({ api, storage })).resolves.toEqual({ origem: 'cache_migrado', perfis: 1 });
    expect(ordem).toEqual(['perfil', 'indice']);
  });

  it('substitui cache velho pelo disco e remove dados órfãos', async () => {
    const storage = storageMemoria({
      [PERFIS_STORAGE_KEY]: '[{"id":"velho"}]',
      [dataStorageKeyFor('velho')]: '{"valor":0}',
      [dataStorageKeyFor('p1')]: '{"valor":1}',
    });
    const api = { carregar_cache: vi.fn(async () => ({
      indice: '[{"id":"p1"}]', perfis: { p1: '{"valor":2}' },
    })) };
    await hidratarCacheDesktop({ api, storage });
    expect(storage.getItem(dataStorageKeyFor('p1'))).toBe('{"valor":2}');
    expect(storage.getItem(dataStorageKeyFor('velho'))).toBeNull();
    expect(storage.getItem(PERFIS_STORAGE_KEY)).toBe('[{"id":"p1"}]');
  });

  it('não altera o cache quando o disco contém JSON inválido', async () => {
    const storage = storageMemoria({ [PERFIS_STORAGE_KEY]: '[{"id":"cache"}]' });
    const antes = [...storage.dados];
    const api = { carregar_cache: vi.fn(async () => ({ indice: '[{"id":"p1"}]', perfis: { p1: '{' } })) };
    await expect(hidratarCacheDesktop({ api, storage })).rejects.toThrow('JSON inválido');
    expect([...storage.dados]).toEqual(antes);
  });

  it('inicia imediatamente no navegador e espera pywebviewready no desktop', async () => {
    const iniciarBrowser = vi.fn();
    await iniciarQuandoPersistenciaPronta({
      janela: { location: { hash: '' } }, storage: storageMemoria(), iniciar: iniciarBrowser,
    });
    expect(iniciarBrowser).toHaveBeenCalledOnce();

    let listener;
    const iniciarDesktop = vi.fn();
    const janela = {
      location: { hash: '#desktop' },
      addEventListener: (_evento, callback) => { listener = callback; },
    };
    const promessa = iniciarQuandoPersistenciaPronta({ janela, storage: storageMemoria(), iniciar: iniciarDesktop });
    expect(iniciarDesktop).not.toHaveBeenCalled();
    janela.pywebview = { api: {
      carregar_cache: vi.fn(async () => ({ indice: '[]', perfis: {} })),
    } };
    listener();
    await promessa;
    expect(iniciarDesktop).toHaveBeenCalledOnce();
  });
});
