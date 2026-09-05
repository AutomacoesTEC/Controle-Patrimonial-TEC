import { describe, it, expect } from 'vitest';
import { prepararRendimentoParaSalvar } from './camposRendimento';
import { totalRendimentos } from '../store/demonstrativos';

describe('reclassificação de rendimento importado', () => {
  const original = { id: 7, tipo: 'tributavel_rra', naoSomar: true, valor: 1000, irrf: 0, origem: 'importacao', documento: { registro: '45' } };
  it('trocar RRA duplicado para PJ remove a exclusão derivada do tipo anterior', () => {
    const payload = prepararRendimentoParaSalvar({ ...original, tipo: 'tributavel_pj' }, original);
    expect(payload.naoSomar).toBe(false);
    expect(totalRendimentos([payload], 0).totalGeral).toBe(1000);
    expect(payload.origem).toBe('importacao');
    expect(payload.documento).toEqual(original.documento);
  });
  it('editar apenas descrição do mesmo RRA mantém a proteção de duplicidade', () => {
    const payload = prepararRendimentoParaSalvar({ ...original, nome_fonte: 'Fonte sintética' }, original);
    expect(payload.naoSomar).toBe(true);
    expect(totalRendimentos([payload], 0).totalGeral).toBe(0);
  });
  it('novo rendimento e alterações comuns mantêm normalização numérica', () => {
    expect(prepararRendimentoParaSalvar({ tipo: 'tributavel_pj', valor: '1000', contribuicaoPrevidenciaria: '100' })).toMatchObject({ valor: 1000, contribuicaoPrevidenciaria: 100, irrf: 0 });
  });
});
