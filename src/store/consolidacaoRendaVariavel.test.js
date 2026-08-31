// Valores vindos do retorno REAL de parsePDF, conferidos contra as linhas
// impressas citadas (AUDITORIA/rows-pdfjs/AJU-01.rows.txt, página 23).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { linhasConsolidacaoMes, conferenciaConsolidacaoMes, retidoNoMes } from './consolidacaoRendaVariavel';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const caminho = `${RAIZ}AUDITORIA/saida-parsepdf/AJU-01.json`;
const aju = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).resultado : null;
const janeiro = aju?.rendaVariavelMensalOficial?.find(m => m.mes === 1 && m.titular);

describe.skipIf(!janeiro)('consolidação do mês na renda variável (AJU-01, janeiro do titular)', () => {
  const linhas = linhasConsolidacaoMes(janeiro.consolidacao);
  const valorDe = (rotulo) => linhas.find(l => l.rotulo === rotulo)?.valor;

  it('traz as nove linhas do bloco, na ordem impressa (p23 r26 a r34)', () => {
    expect(linhas.map(l => l.rotulo)).toEqual([
      'Total do imposto devido',
      'IR fonte de day-trade do mês',
      'IR fonte de day-trade dos meses anteriores',
      'IR fonte de day-trade a compensar',
      'IR fonte (Lei nº 11.033/2004) no mês',
      'IR fonte (Lei nº 11.033/2004) nos meses anteriores',
      'IR fonte (Lei nº 11.033/2004) a compensar',
      'Imposto a pagar',
      'Imposto pago',
    ]);
  });

  it('os valores batem com o impresso', () => {
    expect(valorDe('Total do imposto devido')).toBeCloseTo(545.56, 2);   // p23 r26
    expect(valorDe('IR fonte de day-trade do mês')).toBeCloseTo(140.64, 2); // p23 r27
    expect(valorDe('IR fonte (Lei nº 11.033/2004) no mês')).toBeCloseTo(27.63, 2); // p23 r30
    expect(valorDe('Imposto a pagar')).toBeCloseTo(377.29, 2);           // p23 r33
    expect(valorDe('Imposto pago')).toBeCloseTo(501.65, 2);              // p23 r34
    // Zeros impressos continuam aparecendo: p23 r28, r29, r31 e r32.
    expect(valorDe('IR fonte de day-trade a compensar')).toBe(0);
    expect(valorDe('IR fonte (Lei nº 11.033/2004) a compensar')).toBe(0);
  });

  it('a conta do mês fecha: devido menos as duas retenções é o imposto a pagar', () => {
    // 545,56 menos 140,64 de day-trade menos 27,63 do dedo-duro dá 377,29.
    // É a conferência que explica por que o a pagar é menor que o devido.
    expect(conferenciaConsolidacaoMes(janeiro.consolidacao)).toBeNull();
    expect(retidoNoMes(janeiro.consolidacao)).toBeCloseTo(168.27, 2);
    expect(545.56 - 168.27).toBeCloseTo(377.29, 2);
  });
});

describe('regras da consolidação que não dependem de arquivo', () => {
  it('avisa quando o imposto a pagar não fecha com o devido menos as retenções', () => {
    const aviso = conferenciaConsolidacaoMes({
      totalImpostoDevido: 100, irFonteDayTradeMes: 10, irFonteLei11033Mes: 5, impostoPagar: 50,
    });
    expect(aviso).toContain('85.00');
  });

  it('não avisa quando falta dado para a conta', () => {
    // Mês sem consolidação, ou com o bloco incompleto, não pode gerar alarme:
    // a ausência do dado não é divergência.
    expect(conferenciaConsolidacaoMes(null)).toBeNull();
    expect(conferenciaConsolidacaoMes({ totalImpostoDevido: 100 })).toBeNull();
  });

  it('mês sem consolidação não produz linha nenhuma', () => {
    // Pelo caminho .DBK o mês vem só com o número, sem o bloco. Inventar
    // linhas zeradas ali afirmaria uma apuração que a declaração não traz.
    expect(linhasConsolidacaoMes(null)).toEqual([]);
    expect(linhasConsolidacaoMes(undefined)).toEqual([]);
    expect(retidoNoMes(null)).toBe(0);
  });

  it('linha ausente do bloco não vira zero', () => {
    const linhas = linhasConsolidacaoMes({ totalImpostoDevido: 10, impostoPago: 3 });
    expect(linhas.map(l => l.campo)).toEqual(['totalImpostoDevido', 'impostoPago']);
  });
});
