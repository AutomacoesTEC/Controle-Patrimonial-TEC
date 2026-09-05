import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportListaToXlsx } from './exportXlsx';
vi.mock('xlsx', async original => ({ ...await original(), writeFile: vi.fn() }));

describe('nomes Excel — regressão do E2E de doações', () => {
  it.each([
    'Doações a Partidos Políticos e Candidatos',
    'Doações Diretamente na Declaração (ECA e Pessoa Idosa)',
    'Renda/Exterior: [Pessoa]? *Fonte* \\ País',
  ])('exporta título legível e válido: %s', titulo => {
    expect(() => exportListaToXlsx([{ valor: 10 }], [['Valor', r => r.valor]], titulo, 'sintetico', 2026)).not.toThrow();
    const wb = XLSX.writeFile.mock.calls.at(-1)[0];
    expect(wb.SheetNames[0].length).toBeLessThanOrEqual(31);
    expect(wb.SheetNames[0]).not.toMatch(/[\\/?*\[\]:]/);
    const relido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(relido.Sheets[relido.SheetNames[0]])).toEqual([{ Valor: 10 }]);
  });
});
