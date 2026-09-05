import { describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { exportListaToXlsx } from './exportXlsx';
import { abasRelatorioCompleto, FICHAS_RELATORIO } from './relatorioCompleto';
vi.mock('xlsx', async importOriginal => ({ ...await importOriginal(), writeFile: vi.fn() }));

describe('relatório anual completo — fixture sintético fixo', () => {
  it('todas as fichas registradas geram abas válidas e nomes únicos no Excel', () => {
    const abas = abasRelatorioCompleto(Object.fromEntries(FICHAS_RELATORIO.map(([campo]) => [campo, [{ valor: 0 }]])));
    expect(abas).toHaveLength(33);
    expect(new Set(abas.map(a => a.nome)).size).toBe(abas.length);
    for (const aba of abas) {
      expect(aba.nome.length).toBeLessThanOrEqual(31);
      expect(aba.linhas).toEqual([{ Valor: 0 }]);
    }
    expect(abasRelatorioCompleto({ bens: [], impostoDevido: null, contribuinte: {} })).toEqual([]);
  });
  it('exporta dados de cada ficha preenchida e preserva bens e histórico', () => {
    const dados = {
      contribuinte: { nome: 'Titular sintético' }, dependentes: [{ nome: 'Dependente sintético', cpf: '00000000000' }],
      bens: [{ id: 1, beneficiario: 'Dependente', data_aquisicao: '2026-02-01', cpf_beneficiario: '00000000000', situacao_atual: 100, movimentacoes: [{ data: '2026-03-01', tipo: 'benfeitoria', valor: 20 }] }],
      dividas: [{ discriminacao: 'Dívida sintética', situacao_atual: 40 }],
      rendimentos: [{ data: '2026-01-01', valor: 100, previdencia_oficial: 10, pensao_alimenticia: 5 }],
      pagamentos: [{ valor_pago: 30, beneficiario: 'Dependente' }], pagamentosDiversos: [{ valor: 10 }],
      doacoesEfetuadasOficial: [{ valor: 2 }], doacoesPartidosOficial: [{ valor: 3 }], doacoesEcaIdosoOficial: [{ valor: 4 }],
      imoveisRurais: [{ nomeImovel: 'Rural sintético' }], bensRurais: [{ situacao_atual: 10 }], dividasRurais: [{ situacao_atual: 5 }],
      lancamentosRurais: [{ data: '2026-06-01', tipo: 'receita', valor: 8 }],
      rendaVariavelMensalManual: [{ mes: 1, consolidacao: { impostoDevido: 7 } }],
      ganhosCapitalOficial: { imoveis: [{ ganho: 80 }] }, impostoDevido: { imposto: 22 },
    };
    exportListaToXlsx(dados.bens, [['Saldo', b => b.situacao_atual]], 'Relatório IRPF 2026', 'fixture', 2026,
      { historico: [], dadosRelatorio: dados });
    const wb = XLSX.writeFile.mock.calls.at(-1)[0];
    expect(wb.SheetNames).toEqual(expect.arrayContaining(['Relatório IRPF 2026', 'Histórico de Alterações', 'Titular', 'Dependentes', 'Bens - dados completos', 'Dívidas', 'Rendimentos', 'Pagamentos', 'Despesas Gerais', 'Doações Efetuadas', 'Doações Partidos', 'Doações ECA e Idoso', 'Imóveis Rurais', 'Bens Rurais', 'Dívidas Rurais', 'Livro-caixa Rural', 'RV Manual', 'Ganhos Capital Oficial', 'Resumo Importado']));
    const texto = JSON.stringify(wb.Sheets);
    for (const valor of ['2026-02-01', '00000000000', '2026-03-01', 'benfeitoria', 'Previdência oficial', 'Pensão alimentícia']) expect(texto).toContain(valor);
    // Confere o arquivo serializado: células numéricas continuam números.
    const relido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
    expect(XLSX.utils.sheet_to_json(relido.Sheets['Relatório IRPF 2026'])[0].Saldo).toBe(100);
  });
});
