import { describe, expect, it } from 'vitest';
import { correspondeFiltroOrigem, rotuloOrigemRegistro } from './origemRegistro';

describe('proveniência exibida dos registros', () => {
  it('distingue cadastro manual de declaração importada', () => {
    expect(rotuloOrigemRegistro({ origem: 'manual' })).toBe('Manual');
    expect(rotuloOrigemRegistro({ origem: 'importacao', origemDocumento: { formato: 'pdf' } })).toBe('Declaração PDF');
    expect(rotuloOrigemRegistro({ origem: 'importacao', origemDocumento: { formato: 'dbk' } })).toBe('Declaração DBK');
  });

  it('trata registro legado como declaração, sem inventar o formato', () => {
    expect(rotuloOrigemRegistro({ origem: 'origem_legacy' })).toBe('Declaração legada');
  });

  it('filtra manual e importado sem perder legado', () => {
    expect(correspondeFiltroOrigem({ origem: 'manual' }, 'manual')).toBe(true);
    expect(correspondeFiltroOrigem({ origem: 'importacao' }, 'importacao')).toBe(true);
    expect(correspondeFiltroOrigem({ origem: 'origem_legacy' }, 'importacao')).toBe(true);
  });
});
