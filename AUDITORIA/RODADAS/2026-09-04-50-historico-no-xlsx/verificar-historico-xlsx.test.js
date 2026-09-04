import { beforeEach, describe, expect, it, vi } from 'vitest';

const captura = vi.hoisted(() => ({ workbook: null }));

vi.mock('xlsx', async (importOriginal) => ({
  ...(await importOriginal()),
  writeFile: vi.fn((workbook) => { captura.workbook = workbook; }),
}));

import { exportListaToXlsx } from '../../../src/utils/exportXlsx';

describe('fixture congelado: histórico no relatório xlsx', () => {
  beforeEach(() => { captura.workbook = null; });

  it('leva a alteração e seus dois campos em aba própria', () => {
    exportListaToXlsx(
      [{ discriminacao: 'Apto reformado' }],
      [['Discriminação', item => item.discriminacao]],
      'Relatório IRPF 2025',
      'relatorio_irpf',
      2025,
      {
        historico: [{
          data: '2026-09-04T12:00:00.000Z',
          anoCalendario: 2025,
          descricao: 'Editou bem: Apto reformado',
          mudancas: [
            { campo: 'discriminacao', antes: 'Apto', depois: 'Apto reformado' },
            { campo: 'situacao_atual', antes: 100, depois: 120 },
          ],
        }],
      },
    );

    expect(captura.workbook.SheetNames).toEqual([
      'Relatório IRPF 2025',
      'Histórico de Alterações',
    ]);
    const linhas = captura.workbook.Sheets['Histórico de Alterações'];
    expect(linhas['D2'].v).toBe('discriminacao');
    expect(linhas['D3'].v).toBe('situacao_atual');
    expect(linhas['E2'].v).toBe('Apto');
    expect(linhas['F3'].v).toBe('120');
  });
});
