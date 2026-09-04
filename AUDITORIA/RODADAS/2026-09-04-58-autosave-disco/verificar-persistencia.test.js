import { test, vi } from 'vitest';
import { persistirDadosPerfil } from '../../../src/store/DataContext';
import { dataStorageKeyFor, PERFIS_STORAGE_KEY } from '../../../src/store/perfis';

test('mede a trajetória do autosave com a API desktop presente', async () => {
  const eventos = [];
  const dados = new Map([[PERFIS_STORAGE_KEY, JSON.stringify([{ id: 'perfil-1', nome: 'Antes' }])]]);
  const storage = {
    getItem: chave => dados.get(chave) ?? null,
    setItem: (chave, valor) => { eventos.push(`cache:${chave}`); dados.set(chave, valor); },
  };
  const desktopApi = {
    salvar_perfil: vi.fn(async (id, texto) => { eventos.push(`disco:${id}`); return { salvo: true, texto }; }),
    salvar_indice_perfis: vi.fn(async texto => { eventos.push('disco:indice'); return { salvo: true, texto }; }),
  };

  const resultado = await persistirDadosPerfil({
    storage,
    desktopApi,
    perfilId: 'perfil-1',
    chave: null,
    estado: { contribuinte: { nome: 'Depois' }, bens: [{ id: 1 }], toasts: [{ id: 9 }] },
  });

  console.log(JSON.stringify({
    salvo: resultado.salvo,
    chamadasDisco: desktopApi.salvar_perfil.mock.calls.length + desktopApi.salvar_indice_perfis.mock.calls.length,
    escritasCache: eventos.filter(item => item.startsWith('cache:')).length,
    eventos,
    perfilIgual: desktopApi.salvar_perfil.mock.calls[0]?.[1] === dados.get(dataStorageKeyFor('perfil-1')),
    indiceIgual: desktopApi.salvar_indice_perfis.mock.calls[0]?.[0] === dados.get(PERFIS_STORAGE_KEY),
  }));
});
