import { describe, it, expect } from 'vitest';
import { enfileirarPersistencia, migrarOrigemLegado, persistirDadosPerfil } from './DataContext';
import { initialState } from './reducer';
import { PERFIS_STORAGE_KEY, dataStorageKeyFor } from './perfis';

// Bug real: usuária importou uma declaração antes de origemAnoAtual existir
// no reducer; depois da feature entrar, "Histórico de Declarações" passou a
// filtrar por origem === 'importacao' e a declaração de verdade (com dados)
// sumiu da tela, embora bens/dívidas continuassem intactos no app.
describe('migrarOrigemLegado (dado salvo por versão anterior a origemAnoAtual)', () => {
  it('marca como importacao o ano ativo com dado real e sem a chave origemAnoAtual no JSON bruto', () => {
    const raw = { anoCalendario: 2025, bens: [{ id: 1, codigo: '11', situacao_atual: 100 }], dividas: [], historico: {} };
    const merged = { ...initialState, ...raw };
    const migrado = migrarOrigemLegado(merged, raw);
    expect(migrado.origemAnoAtual).toBe('importacao');
  });

  it('não mexe em ano ativo sem dado nenhum, mesmo sem a chave no JSON bruto', () => {
    const raw = { anoCalendario: 2025, bens: [], dividas: [], historico: {} };
    const merged = { ...initialState, ...raw };
    const migrado = migrarOrigemLegado(merged, raw);
    expect(migrado.origemAnoAtual).toBe(null);
  });

  it('não sobrescreve origemAnoAtual quando a chave já está presente no JSON bruto (dado já migrado)', () => {
    const raw = { anoCalendario: 2025, bens: [{ id: 1 }], dividas: [], origemAnoAtual: 'manual', historico: {} };
    const merged = { ...initialState, ...raw };
    const migrado = migrarOrigemLegado(merged, raw);
    expect(migrado.origemAnoAtual).toBe('manual');
  });

  it('marca como importacao entradas do historico com dado real e sem origem definida', () => {
    const raw = {
      anoCalendario: null,
      historico: {
        2024: { bens: [{ id: 1 }], dividas: [] },
        2023: { bens: [], dividas: [] },
      },
    };
    const merged = { ...initialState, ...raw };
    const migrado = migrarOrigemLegado(merged, raw);
    expect(migrado.historico['2024'].origem).toBe('importacao');
    expect(migrado.historico['2023'].origem).toBeUndefined();
  });

  it('marca itens antigos sem origem como origem_legacy no ano ativo e no histórico', () => {
    const raw = {
      anoCalendario: 2025,
      bens: [{ id: 1 }],
      rendimentos: [{ id: 2 }],
      pagamentos: [{ id: 3 }],
      doacoesEfetuadasOficial: [{ id: 4 }],
      historico: {
        2024: { bensRurais: [{ id: 5, codigo: '01', situacao_anterior: 100 }], dividasRurais: [{ id: 6, situacao_anterior: 50 }], origem: 'importacao' },
      },
    };
    const migrado = migrarOrigemLegado({ ...initialState, ...raw }, raw);
    expect(migrado.bens[0].origem).toBe('origem_legacy');
    expect(migrado.rendimentos[0].origem).toBe('origem_legacy');
    expect(migrado.pagamentos[0].origem).toBe('origem_legacy');
    expect(migrado.doacoesEfetuadasOficial[0].origem).toBe('origem_legacy');
    expect(migrado.historico['2024'].bensRurais[0].origem).toBe('origem_legacy');
    expect(migrado.historico['2024'].dividasRurais[0].origem).toBe('origem_legacy');
    expect(migrado.historico['2024'].bensRurais[0].chaveImportacao).toBe('pdf:bem-rural:1:01:100.00');
    expect(migrado.historico['2024'].dividasRurais[0].chaveImportacao).toBe('pdf:divida-rural:1:50.00');
  });

  it('completa a chave rural em item já migrado para origem_legacy', () => {
    const raw = {
      anoCalendario: 2025,
      bensRurais: [{ id: 7, origem: 'origem_legacy', codigo: '02', situacao_anterior: 25 }],
      historico: {},
    };
    const migrado = migrarOrigemLegado({ ...initialState, ...raw }, raw);
    expect(migrado.bensRurais[0].origem).toBe('origem_legacy');
    expect(migrado.bensRurais[0].chaveImportacao).toBe('pdf:bem-rural:1:02:25.00');
  });
  it('não altera origens já classificadas', () => {
    const raw = {
      anoCalendario: 2025,
      bens: [{ id: 1, origem: 'manual' }, { id: 2, origem: 'importacao' }],
      historico: {},
    };
    const migrado = migrarOrigemLegado({ ...initialState, ...raw }, raw);
    expect(migrado.bens.map(x => x.origem)).toEqual(['manual', 'importacao']);
  });
});

describe('persistirDadosPerfil', () => {
  const criarStorage = (falhar = false) => {
    const dados = new Map([[PERFIS_STORAGE_KEY, JSON.stringify([{ id: 'perfil-1', nome: 'Anterior' }])]]);
    return {
      getItem: chave => dados.get(chave) ?? null,
      setItem: (chave, valor) => {
        if (falhar && chave === dataStorageKeyFor('perfil-1')) throw new Error('QuotaExceededError');
        dados.set(chave, valor);
      },
      dados,
    };
  };

  it('propaga falha de quota em vez de informar sucesso silencioso', async () => {
    await expect(persistirDadosPerfil({
      storage: criarStorage(true), perfilId: 'perfil-1', chave: null,
      estado: { contribuinte: { nome: 'Titular' }, bens: [], toasts: [] },
    })).rejects.toThrow('QuotaExceededError');
  });

  it('aguarda a criptografia e só então confirma a gravação', async () => {
    const memoria = criarStorage();
    let criptografou = false;
    const resultado = await persistirDadosPerfil({
      storage: memoria, perfilId: 'perfil-1', chave: {},
      estado: { contribuinte: { nome: 'Titular' }, bens: [{ id: 1 }], toasts: [{ id: 1 }] },
      criptografar: async (_chave, dados) => { criptografou = true; return { cifrado: dados.bens.length }; },
    });
    expect(criptografou).toBe(true);
    expect(resultado.salvo).toBe(true);
    expect(JSON.parse(memoria.dados.get(dataStorageKeyFor('perfil-1')))).toEqual({ cifrado: 1 });
  });
});

describe('enfileirarPersistencia', () => {
  it('não permite que uma gravação antiga termine depois da mais nova', async () => {
    const fila = { current: Promise.resolve() };
    const ordem = [];
    let liberarPrimeira;
    const primeira = enfileirarPersistencia(fila, async () => {
      ordem.push('inicio-antiga');
      await new Promise(resolve => { liberarPrimeira = resolve; });
      ordem.push('fim-antiga');
    });
    const segunda = enfileirarPersistencia(fila, async () => {
      ordem.push('inicio-nova');
      ordem.push('fim-nova');
    });

    await Promise.resolve();
    expect(ordem).toEqual(['inicio-antiga']);
    liberarPrimeira();
    await Promise.all([primeira, segunda]);
    expect(ordem).toEqual(['inicio-antiga', 'fim-antiga', 'inicio-nova', 'fim-nova']);
  });
});
