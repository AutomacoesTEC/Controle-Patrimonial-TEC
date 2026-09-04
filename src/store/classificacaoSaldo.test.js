import { describe, expect, test } from 'vitest';
import { classificarPendenciasSaldo } from './classificacaoSaldo';

const base = (rendimentos = []) => ({
  anoCalendario: 2025,
  historico: { 2024: { impostoDevido: { impostoRestituir: 2032.33 } } },
  rendimentos,
});
const demo = {
  saldoDeCaixa: -10000,
  varPatrimonial: { deltaBens: 0, deltaDivida: 0 },
  pendenciasAlienacao: [],
  aplicacoesSemRendimento: [],
};

describe('classificarPendenciasSaldo', () => {
  test('aponta a restituição anterior ausente pelo valor exato e sem mudar o saldo', () => {
    const antes = demo.saldoDeCaixa;
    const itens = classificarPendenciasSaldo(base(), demo, '2025-01-01', '2025-12-31');
    expect(itens).toContainEqual(expect.objectContaining({
      tipo: 'restituicao_a_conferir', valor: 2032.33, destino: 'rendimentos',
    }));
    expect(demo.saldoDeCaixa).toBe(antes);
  });

  test('não alerta quando o código 25 já cobre a restituição', () => {
    const itens = classificarPendenciasSaldo(base([
      { tipo: 'isento_25', valor: 2032.33, data: '2025-06-01' },
    ]), demo, '2025-01-01', '2025-12-31');
    expect(itens.some(x => x.tipo === 'restituicao_a_conferir')).toBe(false);
  });

  test('reúne dívida sem contrapartida, alienação e aplicação já diagnosticadas', () => {
    const itens = classificarPendenciasSaldo(base(), {
      ...demo,
      varPatrimonial: { deltaBens: 100, deltaDivida: 350 },
      pendenciasAlienacao: [{ reducao: 400, discriminacao: 'Veículo' }],
      aplicacoesSemRendimento: [{ valorResgatado: 500, discriminacao: 'LCI' }],
    }, '2025-01-01', '2025-12-31');
    expect(itens.map(x => [x.tipo, x.valor])).toEqual([
      ['divida_sem_contrapartida', 250],
      ['restituicao_a_conferir', 2032.33],
      ['alienacao_sem_preco', 400],
      ['aplicacao_sem_rendimento', 500],
    ]);
  });
});
