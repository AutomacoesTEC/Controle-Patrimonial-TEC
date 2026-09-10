import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { aplicarAcompanhamento, acompanhamentoDo, caixaPeriodo, conciliarConta, fechamentoAtual, centavos, formularioInicial, ajusteDoTipoDeBaixa } from './acompanhamento';
import { reducer, initialState, snapshotYear } from './reducer';

const agora = '2026-09-05T22:00:00.000Z';
const executar = (s, id, comando, p) => aplicarAcompanhamento(s, { comando, ...p }, { id, agora });
function fixture() {
  let s = { ...initialState, anoCalendario: 2025, origemAnoAtual: 'manual' };
  s = executar(s, 'banco', 'conta', { nome: 'Banco', pessoa: 'titular', dataAbertura: '2026-01-01', saldoInicial: 110000, disponivel: true });
  s = executar(s, 'dep', 'conta', { nome: 'Banco dependente', pessoa: 'dep1', dataAbertura: '2026-01-01', saldoInicial: 0, disponivel: true });
  s = executar(s, 'venda', 'operacao', { descricao: 'Venda parcelada', pessoa: 'titular', dataEconomica: '2026-01-03', tipo: 'venda' });
  s = executar(s, 'p1', 'parcela', { operacaoId: 'venda', vencimento: '2026-01-31', sentido: 'entrada', principal: 1000, juros: 10, taxas: 0, imposto: 0 });
  return s;
}
describe('razão financeiro independente da foto fiscal', () => {
  it('contrato/projeção não são recebimento; transferência própria não é renda nem despesa', () => {
    let s = fixture();
    s = executar(s, 't1', 'lancamento', { contaId: 'banco', destinoId: 'dep', tipo: 'transferencia', data: '2026-01-05', valor: 10000, descricao: 'Transferência própria' });
    expect(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31')).toMatchObject({ final: 11000000, entradas: 0, saidas: 0, transferencias: 0, projetado: 101000 });
    expect(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31', 'titular')).toMatchObject({ final: 10000000, transferencias: -1000000 });
    expect(s.anoCalendario).toBe(2025);
    expect(s.bens).toEqual([]);
  });
  it('baixa entra uma vez pela data financeira, sem duplicar a parcela', () => {
    let s = fixture();
    s = executar(s, 'l1', 'lancamento', { contaId: 'banco', tipo: 'entrada', data: '2026-02-03', valor: 1010, descricao: 'Parcela 1', contraparte: 'Comprador', parcelaId: 'p1' });
    const a = acompanhamentoDo(s);
    expect(caixaPeriodo(a, '2026-01-01', '2026-01-31').entradas).toBe(0);
    expect(caixaPeriodo(a, '2026-02-01', '2026-02-28').entradas).toBe(101000);
    expect(caixaPeriodo(a, '2026-01-01', '2026-02-28').entradas).toBe(101000);
    expect(() => executar(s, 'l2', 'lancamento', { contaId: 'banco', tipo: 'entrada', data: '2026-02-04', valor: 1010, descricao: 'Duplicada', contraparte: 'Comprador', parcelaId: 'p1' })).toThrow('já liquidada');
    s = executar(s, 'c1', 'cancelarLancamento', { id: 'l1', motivo: 'Data incorreta' });
    expect(acompanhamentoDo(s).lancamentos[0].canceladoEm).toBe(agora);
    expect(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31').projetado).toBe(101000);
  });
  it('extrato ausente é desconhecido; diferença real não vira zero', () => {
    let s = fixture();
    expect(conciliarConta(acompanhamentoDo(s), 'banco', '2026-01').diferenca).toBeNull();
    s = executar(s, 'e1', 'extrato', { contaId: 'banco', mes: '2026-01', saldo: 109999, referencia: 'Extrato janeiro' });
    expect(conciliarConta(acompanhamentoDo(s), 'banco', '2026-01').diferenca).toBe(100);
  });
  it('bloqueia mês aprovado e meses anteriores; reabertura conserva versão e exige motivo', () => {
    let s = fixture();
    for (const [id, saldo] of [['banco', 110000], ['dep', 0]]) s = executar(s, `e-${id}`, 'extrato', { contaId: id, mes: '2026-02', saldo, referencia: 'Extrato fevereiro' });
    s = executar(s, 'f1', 'fechar', { mes: '2026-02', responsavel: 'Revisor', observacoes: 'Parcela ainda não recebida, cobrada.', checklist: Object.fromEntries(['contas', 'bens', 'dividas', 'rendimentos', 'impostos', 'titularidade', 'documentos'].map(k => [k, true])) });
    const snapshot = JSON.stringify(acompanhamentoDo(s).fechamentos[0]);
    expect(() => executar(s, 'e2', 'extrato', { contaId: 'banco', mes: '2026-01', saldo: 1, referencia: 'Outra' })).toThrow('fechado');
    expect(() => executar(s, 'r1', 'reabrir', { mes: '2026-02', responsavel: 'Revisor', motivo: '' })).toThrow('motivo');
    s = executar(s, 'r1', 'reabrir', { mes: '2026-02', responsavel: 'Revisor', motivo: 'Rever extrato' });
    expect(fechamentoAtual(acompanhamentoDo(s), '2026-02').status).toBe('reaberto');
    expect(JSON.stringify(acompanhamentoDo(s).fechamentos[0])).toBe(snapshot);
  });
  it('contas/mercado são globais e não alteram base fiscal nem entram em snapshots', () => {
    let s = fixture();
    s = executar(s, 'mercado1', 'avaliacao', { chaveBem: 'automovel', descricao: 'Carro', pessoa: 'titular', data: '2026-01-02', valor: 50000, fonte: 'Laudo' });
    const a = s.acompanhamento;
    expect(snapshotYear(s).acompanhamento).toBeUndefined();
    s = reducer(s, { type: 'SWITCH_ANO', payload: 2026 });
    expect(s.acompanhamento).toEqual(a);
    expect(s.bens).toEqual([]);
  });
  it('valida conta, titularidade, data, valor e componentes', () => {
    const s = fixture();
    for (const valor of ['', NaN, Infinity, 'abc']) expect(() => centavos(valor)).toThrow();
    expect(() => executar(s, 'p2', 'parcela', { operacaoId: 'venda', vencimento: '2026-02-30', principal: 1, sentido: 'entrada' })).toThrow('data');
    expect(() => executar(s, 'p2', 'parcela', { operacaoId: 'venda', vencimento: '2026-02-28', principal: -1, sentido: 'entrada' })).toThrow('Componentes');
    expect(() => executar(s, 'l1', 'lancamento', { contaId: 'dep', tipo: 'entrada', valor: 1010, data: '2026-02-28', descricao: 'Baixa', contraparte: 'Comprador', parcelaId: 'p1' })).toThrow('Titularidade');
  });
});

// Regressão do funcional de 05/09: com uma operação em foco na tela, o botão
// "Transferência entre contas" montava o formulário já com operacaoId, o
// domínio recusava ("Transferência não liquida parcela...") e o modal ficava
// presa aberto. O fechamento do mês falhava em seguida, por falta da
// transferência que conciliava os extratos.
describe('formulário do acompanhamento', () => {
  it('transferência não herda a operação em foco nem a parcela', () => {
    const contexto = { pessoa: 'todos', mes: '2026-01', operacao: 'venda' };
    expect(formularioInicial('lancamento', {}, contexto).operacaoId).toBe('venda');
    const form = formularioInicial('lancamento', { tipo: 'transferencia' }, contexto);
    expect(form).toMatchObject({ tipo: 'transferencia', operacaoId: '', parcelaId: null });
    let s = fixture();
    s = executar(s, 't1', 'lancamento', { ...form, contaId: 'banco', destinoId: 'dep', data: '2026-01-05', valor: 10000, descricao: 'Transferência própria' });
    expect(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31').transferencias).toBe(0);
  });
  it('trocar o tipo para transferência dentro do modal descarta operação e parcela', () => {
    expect(ajusteDoTipoDeBaixa('lancamento', 'transferencia')).toEqual({ operacaoId: '', parcelaId: null });
    expect(ajusteDoTipoDeBaixa('lancamento', 'entrada')).toEqual({});
    expect(ajusteDoTipoDeBaixa('operacao', 'transferencia')).toEqual({});
    const baixa = formularioInicial('lancamento', { parcelaId: 'p1', operacaoId: 'venda', tipo: 'entrada' }, { mes: '2026-01', operacao: 'venda' });
    expect(baixa).toMatchObject({ parcelaId: 'p1', operacaoId: 'venda' });
  });
  it('preserva o recorte de pessoa e o mês da consulta', () => {
    expect(formularioInicial('conta', {}, { pessoa: '33344455508', mes: '2026-03' })).toMatchObject({ pessoa: '33344455508', mes: '2026-03', disponivel: true, saldoInicial: '0' });
    expect(formularioInicial('conta', {}, { pessoa: 'todos', mes: '2026-03' }).pessoa).toBe('titular');
  });

  it('P02: "Classificar depois" — baixa salva sem categoria e classificação posterior não muda os totais', () => {
    let s = fixture();
    // Baixa válida com "Classificar depois" (categoriaFluxo vazio).
    s = executar(s, 'b1', 'lancamento', {
      contaId: 'banco', tipo: 'entrada', data: '2026-01-10', valor: 5000,
      descricao: 'Recebimento', contraparte: 'Cliente', categoriaFluxo: '',
    });
    const l = acompanhamentoDo(s).lancamentos.find(x => x.id === 'b1');
    expect(l).toBeTruthy();
    expect(l.categoriaFluxo).toBe('');
    const totais = c => (({ inicial, aberturas, entradas, saidas, transferencias, final }) =>
      ({ inicial, aberturas, entradas, saidas, transferencias, final }))(c);
    const antes = totais(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31'));
    // Classificação posterior da mesma baixa.
    s = executar(s, 'c1', 'classificarLancamento', { id: 'b1', categoriaFluxo: 'renda' });
    expect(acompanhamentoDo(s).lancamentos.find(x => x.id === 'b1').categoriaFluxo).toBe('renda');
    const depois = totais(caixaPeriodo(acompanhamentoDo(s), '2026-01-01', '2026-01-31'));
    expect(depois).toEqual(antes);
  });

  it('P02: o select de classificação de fontes/aplicações não é required no formulário', () => {
    // Guarda de UI (o domínio já aceita vazio; o bug era o `required` do <select>).
    const fonte = readFileSync(new URL('../pages/AcompanhamentoPage.jsx', import.meta.url), 'utf8');
    expect(fonte).toMatch(/campo\('categoriaFluxo'[^\n]*\], undefined, true\)/);
    expect(fonte).toMatch(/required=\{!opcional\}/);
  });
});
