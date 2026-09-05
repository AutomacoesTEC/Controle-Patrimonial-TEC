import { describe, expect, it } from 'vitest';
import { initialState, reducer, reducerComHistorico } from './reducer';

const base = () => ({
  ...structuredClone(initialState), anoCalendario: 2025, origemAnoAtual: 'importacao',
  contribuinte: { nome: 'Titular sintético', cpf: '11144477735' },
  dependentes: [{ id: 9, nome: 'Dependente sintético', cpf: '33344455508' }],
  bens: [{ id: 1, grupo: '01', codigo_bem: '12', discriminacao: 'Casa sintética', situacao_anterior: 80000, situacao_atual: 100000, origem: 'importacao' }],
  dividas: [{ id: 2, codigo: '13', discriminacao: 'Empréstimo sintético', situacao_anterior: 60000, situacao_atual: 50000, origem: 'importacao' }],
});
const emAno = (s, ano, action) => reducer(s, { type: 'ADD_EM_ANO', payload: { ano, action } });
const movimento = (s, data, tipo = 'benfeitoria', valor = 20000) => reducerComHistorico(s, {
  type: 'SALVAR_MOVIMENTACAO_DATADA', payload: { actionType: 'REGISTRAR_MOVIMENTACAO_BEM', bemId: s.bens[0].id,
    movimentacao: { data, tipo, valor } },
});

describe('ciclo anual com fixture 2025 e eventos datados em 2026', () => {
  it('primeiro pagamento em 2026 herda saldos e dependentes, sem repetir fluxos nem trocar a visão', () => {
    const antes = base();
    const s = emAno(antes, 2026, { type: 'ADD_PAGAMENTO', payload: { data: '2026-03-10', valor_pago: 500 } });
    expect(s.anoCalendario).toBe(2025);
    expect(s.bens).toEqual(antes.bens);
    expect(s.historico[2026].bens[0]?.situacao_anterior).toBe(100000);
    expect(s.historico[2026].dividas[0]?.situacao_anterior).toBe(50000);
    expect(s.historico[2026].dependentes).toEqual(antes.dependentes);
    expect(s.historico[2026].pagamentos).toHaveLength(1);
  });
  it('benfeitoria de 2026 deixa 2025 intacto e sobrevive à troca de ano e serialização', () => {
    const antes = base();
    let s = movimento(antes, '2026-04-10');
    expect(s.bens).toEqual(antes.bens);
    expect(s.historico[2026]?.bens[0]?.situacao_atual).toBe(120000);
    s = reducer(JSON.parse(JSON.stringify(s)), { type: 'SWITCH_ANO', payload: 2026 });
    expect(s.bens[0].movimentacoes).toHaveLength(1);
    expect(s.bens[0].situacao_anterior).toBe(100000);
    s = reducer(s, { type: 'SWITCH_ANO', payload: 2025 });
    expect(s.bens).toEqual(antes.bens);
  });
  it('movimenta o bem correspondente quando 2026 já foi criado com outro id', () => {
    let s = reducer(base(), { type: 'ROLLOVER_ANO', payload: 2026 });
    s = reducer(s, { type: 'SWITCH_ANO', payload: 2025 });
    s = movimento(s, '2026-08-01');
    expect(s.historico[2026].bens[0].situacao_atual).toBe(120000);
  });
  it('amortização entra em 2026 sem reduzir o saldo declarado de 2025', () => {
    const s = reducer(base(), { type: 'SALVAR_MOVIMENTACAO_DATADA', payload: {
      actionType: 'REGISTRAR_MOVIMENTACAO_DIVIDA', bemId: 2,
      movimentacao: { data: '2026-03-01', tipo: 'amortizacao', valor: 5000 },
    } });
    expect(s.dividas[0].situacao_atual).toBe(50000);
    expect(s.historico[2026]?.dividas[0]?.situacao_atual).toBe(45000);
  });
  it('editar a data de um pagamento move o registro uma vez para o ano de destino', () => {
    let s = base();
    s.pagamentos = [{ id: 7, data: '2025-08-01', valor_pago: 100, nome_beneficiario: 'Clínica' }];
    s = emAno(s, 2026, { type: 'UPDATE_PAGAMENTO', payload: { id: 7, data: '2026-08-01', valor_pago: 200 } });
    expect(s.pagamentos).toHaveLength(0);
    expect(s.historico[2026].pagamentos).toEqual([expect.objectContaining({ id: 7, valor_pago: 200, nome_beneficiario: 'Clínica' })]);
  });
  it('pular para 2027 preserva os saldos de abertura dos anos intermediários', () => {
    const s = emAno(base(), 2027, { type: 'ADD_RENDIMENTO', payload: { data: '2027-01-05', valor: 300 } });
    expect(s.historico[2026]?.bens[0]?.situacao_anterior).toBe(100000);
    expect(s.historico[2027].bens[0]?.situacao_anterior).toBe(100000);
    expect(s.historico[2027].rendimentos).toHaveLength(1);
  });
});
