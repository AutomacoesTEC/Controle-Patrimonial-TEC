import { describe, expect, it } from 'vitest';
import { calcularIrrfMensal2026, montarPainelIrrf } from './painelIrrf';

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

  it('aplica tabela e redutor de 2026 e alerta retenção R$ 34,71 menor', () => {
    const calculo = calcularIrrfMensal2026({ bruto: 6500, previdencia: 650, quantidadeDependentes: 1 });
    expect(calculo).toMatchObject({ deducao: 839.59, base: 5660.41, esperado: 534.71 });
    const painel = montarPainelIrrf({
      rendimentos: [{
        tipo: 'tributavel_pj', data: '2026-03-31', nome_fonte: 'Empresa A',
        valor: 6500, contribuicaoPrevidenciaria: 650, quantidadeDependentes: 1, irrf: 500,
      }],
    });
    expect(painel.alertasRetencao).toHaveLength(1);
    expect(painel.alertasRetencao[0]).toMatchObject({ informado: 500, esperado: 534.71, diferenca: 34.71 });
  });

  it('zera em R$ 5 mil e não infere que um total anual em 31/12 seja mensal', () => {
    expect(calcularIrrfMensal2026({ bruto: 5000 }).esperado).toBe(0);
    const painel = montarPainelIrrf({
      rendimentos: [
        { tipo: 'tributavel_pj', data: '2026-02-28', valor: 5000, irrf: 0 },
        { tipo: 'tributavel_pj', data: '2026-12-31', valor: 78000, irrf: 0 },
      ],
    });
    expect(painel.alertasRetencao).toEqual([]);
  });
});
