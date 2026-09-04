import { describe, expect, it, vi } from 'vitest';
import { hidratarCacheDesktop } from '../../../src/store/bootstrapDesktop';
import { PERFIS_STORAGE_KEY } from '../../../src/store/perfis';

function storageVazio() {
  const dados = new Map();
  return {
    get length() { return dados.size; },
    key: indice => [...dados.keys()][indice] ?? null,
    getItem: chave => dados.get(chave) ?? null,
    setItem: (chave, valor) => dados.set(chave, valor),
    removeItem: chave => dados.delete(chave),
    dados,
  };
}

describe('fixture congelado: primeira abertura no desktop', () => {
  it('começa sem perfil e sem dados de declaração', async () => {
    const storage = storageVazio();
    const api = {
      carregar_cache: vi.fn(async () => ({ indice: null, perfis: {} })),
      salvar_perfil: vi.fn(async () => ({ salvo: true })),
      salvar_indice_perfis: vi.fn(async () => ({ salvo: true })),
    };

    await expect(hidratarCacheDesktop({ api, storage }))
      .resolves.toEqual({ origem: 'cache_migrado', perfis: 0 });
    expect(storage.getItem(PERFIS_STORAGE_KEY)).toBeNull();
    expect(api.salvar_perfil).not.toHaveBeenCalled();
    expect(api.salvar_indice_perfis).toHaveBeenCalledWith('[]');
    expect([...storage.dados.keys()].filter(chave => chave.startsWith('controle-patrimonial-data-'))).toEqual([]);
  });
});
