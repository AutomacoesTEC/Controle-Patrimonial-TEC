import { describe, it, expect } from 'vitest';
import { migrarOrigemLegado } from './DataContext';
import { initialState } from './reducer';

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
});
