import { describe, expect, it } from 'vitest';
import { payloadImportacaoCompleto, payloadRetificadoraCompleto } from './importacaoDeclaracao';

describe('contrato completo da importação', () => {
  const resultado = {
    anoCalendario: 2025,
    formato: 'pdf',
    dependentes: [{ cpf: '1' }],
    bens: [{ id: 1 }],
    ganhosCapitalOficial: { operacoes: [{ id: 9 }] },
    rendaVariavelAnualOficial: { resultadoLiquido: 10 },
    fiiFiagroMensalOficial: [{ mes: 3 }],
    fiiFiagroAnualOficial: { resultadoLiquido: 20 },
    campoFuturoAindaDesconhecidoPelaTela: { preservado: true },
  };

  it('bug real: encaminha fichas novas e campos futuros sem lista manual', () => {
    const payload = payloadImportacaoCompleto(resultado);
    expect(payload).toEqual(resultado);
    expect(payload.ganhosCapitalOficial.operacoes).toHaveLength(1);
    expect(payload.fiiFiagroMensalOficial).toHaveLength(1);
    expect(payload.campoFuturoAindaDesconhecidoPelaTela.preservado).toBe(true);
  });

  it('permite somente a substituição deliberada de dependentes ao trocar o titular', () => {
    const payload = payloadImportacaoCompleto(resultado, { dependentes: [] });
    expect(payload.dependentes).toEqual([]);
    expect(payload.ganhosCapitalOficial).toBe(resultado.ganhosCapitalOficial);
  });

  it('retificadora preserva todo o resultado e aplica a conciliação por último', () => {
    const payload = payloadRetificadoraCompleto(resultado, { bens: [{ id: 77 }] });
    expect(payload.bens).toEqual([{ id: 77 }]);
    expect(payload.fiiFiagroAnualOficial).toEqual({ resultadoLiquido: 20 });
    expect(payload.campoFuturoAindaDesconhecidoPelaTela.preservado).toBe(true);
  });
});
