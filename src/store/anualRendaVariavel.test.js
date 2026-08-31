// Valores do retorno REAL de parsePDF sobre o AJU-01.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  linhasAnualRendaVariavel, linhasAnualFiiFiagro, ehDerivadoDosMeses, AVISO_DERIVADO,
} from './anualRendaVariavel';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const caminho = `${RAIZ}AUDITORIA/saida-parsepdf/AJU-01.json`;
const aju = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).resultado : null;

const valorDe = (linhas, rotulo) => linhas.find(l => l.rotulo === rotulo)?.valor;

describe.skipIf(!aju)('fechamento anual da renda variável (AJU-01)', () => {
  const linhas = linhasAnualRendaVariavel(aju.rendaVariavelAnualOficial);

  it('é DERIVADO dos meses, e o app sabe disso', () => {
    // A declaração impressa não traz bloco anual de renda variável: o parser
    // soma os doze meses. A tela precisa dizer isso, senão a pessoa procura no
    // papel um quadro que não existe.
    expect(ehDerivadoDosMeses(aju.rendaVariavelAnualOficial)).toBe(true);
    expect(AVISO_DERIVADO).toContain('somou os doze meses');
  });

  it('traz as dez linhas, incluindo as quatro que a tela não mostrava', () => {
    expect(valorDe(linhas, 'Resultado líquido do ano')).toBeCloseTo(7426.76, 2);
    expect(valorDe(linhas, 'Base de cálculo')).toBeCloseTo(8330.48, 2);
    expect(valorDe(linhas, 'Imposto devido')).toBeCloseTo(1345.35, 2);
    // As quatro que estavam sendo extraídas e não apareciam.
    expect(valorDe(linhas, 'Total do imposto devido na consolidação')).toBeCloseTo(1345.35, 2);
    expect(valorDe(linhas, 'IR fonte de day-trade de meses anteriores')).toBe(0);
    expect(valorDe(linhas, 'IR fonte de day-trade a compensar')).toBe(0);
    expect(valorDe(linhas, 'IR fonte (Lei nº 11.033/2004) no ano')).toBeCloseTo(100.82, 2);
    expect(valorDe(linhas, 'Imposto a pagar na consolidação')).toBeCloseTo(769.67, 2);
  });

  it('o total anual do dedo-duro é a soma do que os meses retiveram', () => {
    // Conferência independente: somando irFonteLei11033Mes dos doze meses dá o
    // mesmo valor que o fechamento anual apresenta.
    const somaDosMeses = aju.rendaVariavelMensalOficial
      .reduce((s, m) => s + (m.consolidacao?.irFonteLei11033Mes || 0), 0);
    expect(somaDosMeses).toBeCloseTo(valorDe(linhas, 'IR fonte (Lei nº 11.033/2004) no ano'), 2);
  });

  it('FII e Fiagro têm fechamento próprio, também derivado', () => {
    const fii = linhasAnualFiiFiagro(aju.fiiFiagroAnualOficial);
    expect(ehDerivadoDosMeses(aju.fiiFiagroAnualOficial)).toBe(true);
    expect(valorDe(fii, 'Base de cálculo')).toBeCloseTo(1801.81, 2);
    expect(valorDe(fii, 'Imposto devido')).toBeCloseTo(360.36, 2);
    expect(valorDe(fii, 'IR retido (Lei nº 11.033/2004)')).toBeCloseTo(47.54, 2);
    expect(valorDe(fii, 'Imposto a pagar')).toBeCloseTo(341.54, 2);
  });
});

describe('regras do fechamento anual', () => {
  it('sem fechamento, nenhuma linha', () => {
    expect(linhasAnualRendaVariavel(null)).toEqual([]);
    expect(linhasAnualFiiFiagro(undefined)).toEqual([]);
    expect(ehDerivadoDosMeses(null)).toBe(false);
  });

  it('fechamento vindo de ficha anual de verdade não é marcado como derivado', () => {
    // O caminho .DBK lê a ficha anual do arquivo. Marcar aquilo como "somado
    // pelo app" seria mentir na direção oposta.
    expect(ehDerivadoDosMeses({ resultadoLiquido: 10, origem: 'dbk' })).toBe(false);
  });

  it('campo ausente não vira zero na lista', () => {
    const linhas = linhasAnualRendaVariavel({ resultadoLiquido: 10, impostoDevido: 3 });
    expect(linhas.map(l => l.rotulo)).toEqual(['Resultado líquido do ano', 'Imposto devido']);
  });
});
