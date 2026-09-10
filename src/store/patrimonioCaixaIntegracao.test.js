import { describe, it, expect } from 'vitest';
import { initialState, reducer } from './reducer';
import { acompanhamentoVazio } from './acompanhamento';
import { painelFinanceiro, pontePatrimonial } from './auditoriaDemonstrativo';

const base = () => ({ ...initialState, anoCalendario: 2025, historico: {}, acompanhamento: acompanhamentoVazio() });
const registrar = (s, id, comando, dados) => reducer(s, {
  type: 'ACOMPANHAMENTO', payload: { comando, ...dados },
  meta: { id, agora: '2026-09-08T22:00:00Z' },
});
const conta = (s, saldoInicial) => registrar(s, 'conta', 'conta', {
  nome: 'Conta de teste', pessoa: 'titular', disponivel: true,
  dataAbertura: '2024-12-31', saldoInicial,
});
const baixa = (s, id, tipo, valor, categoriaFluxo, data = '2025-06-10') => registrar(s, id, 'lancamento', {
  contaId: 'conta', tipo, valor, categoriaFluxo, data,
  descricao: id, contraparte: 'Contraparte de teste',
});

describe('cadastros manuais e caixa da pessoa física', () => {
  it('compra paga com saldo anterior e empréstimo não duplica a aquisição no caixa', () => {
    let s = conta(base(), 30000);
    s = reducer(s, { type: 'ADD_BEM', payload: {
      id: 'carro', grupo: '02', discriminacao: 'Veículo de teste',
      beneficiario: 'Titular', situacao_anterior: 0, situacao_atual: 80000,
      movimentacoes: [{ id: 'compra', tipo: 'aquisicao', data: '2025-06-10', valor: 80000 }],
    } });
    s = baixa(s, 'emprestimo', 'entrada', 50000, 'nao_renda');
    s = baixa(s, 'pagamento-carro', 'saida', 80000, 'aquisicao');
    const f = painelFinanceiro(s, '2025-01-01', '2025-12-31');
    expect(f).toMatchObject({ inicial: 3000000, entradas: 5000000, saidas: 8000000, final: 0 });
    expect(f.categorias.find(c => c.id === 'renda').valor).toBe(0);
    expect(pontePatrimonial(s, 'bens', '2025-01-01', '2025-12-31')[0].variacao).toBe(80000);
    expect(f.externos).toHaveLength(2);
  });

  it('renda cadastrada e recebimento líquido não somam bruto e retenções outra vez', () => {
    let s = conta(base(), 0);
    s = reducer(s, { type: 'ADD_RENDIMENTO', payload: {
      tipo: 'tributavel_pj', data: '2025-12-31', valor: 150000,
      irrf: 20000, contribuicao_previdenciaria: 15000, nome_fonte: 'Fonte de teste',
    } });
    s = baixa(s, 'salario-liquido', 'entrada', 115000, 'renda', '2025-12-31');
    const fechamento = painelFinanceiro(s, '2025-01-01', '2025-12-31');
    expect(fechamento.entradas).toBe(11500000);
    expect(fechamento.saidas).toBe(0);
    s = reducer(s, { type: 'ROLLOVER_ANO', payload: 2026 });
    s = baixa(s, 'restituicao-recebida', 'entrada', 8000, 'nao_renda', '2026-06-15');
    const seguinte = painelFinanceiro(s, '2026-01-01', '2026-12-31');
    expect(seguinte).toMatchObject({ inicial: 11500000, entradas: 800000, final: 12300000 });
    expect(painelFinanceiro(s, '2025-01-01', '2025-12-31').final).toBe(fechamento.final);
    expect(s.historico[2025].rendimentos).toHaveLength(1);
  });
});
