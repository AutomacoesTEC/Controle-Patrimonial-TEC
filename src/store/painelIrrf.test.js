import { describe, expect, it } from 'vitest';
import { montarPainelIrrf } from './painelIrrf';

describe('painel anual de IRRF', () => {
  const dados = {
    rendimentos: [
      { tipo: 'tributavel_pj', nome_fonte: 'Empresa A', beneficiario: 'Titular', irrf: 60 },
      { tipo: 'tributavel_pj', nome_fonte: 'Empresa B', beneficiario: 'Dependente', irrf: 39 },
      { tipo: 'exclusivo_0001', nome_fonte: 'Empresa A', beneficiario: 'Titular', irrf: 20 },
    ],
    impostoDevido: { impostoPagoTotal: 100, impostoDevidoTotal: 150, saldoPagar: 50 },
  };

  it('separa retenção do ajuste de tributação exclusiva e detecta R$ 1 a menor', () => {
    const painel = montarPainelIrrf(dados);
    expect(painel.linhas).toHaveLength(3);
    expect(painel.linhas.find(linha => linha.tipo === 'Tributação exclusiva').compoeAjuste).toBe(false);
    expect(painel).toMatchObject({ totalPainel: 99, totalResumo: 100, diferenca: -1, confere: false });
  });

  it('fecha quando o detalhe alcança o total oficial', () => {
    const painel = montarPainelIrrf({
      ...dados,
      rendimentos: [...dados.rendimentos, { tipo: 'tributavel_pj', nome_fonte: 'Empresa C', beneficiario: 'Titular', irrf: 1 }],
    });
    expect(painel).toMatchObject({ totalPainel: 100, totalResumo: 100, diferenca: 0, confere: true });
  });
});
