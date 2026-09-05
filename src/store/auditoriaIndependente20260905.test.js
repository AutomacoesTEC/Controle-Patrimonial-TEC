import { describe, expect, it } from 'vitest';
import { initialState, reducer, estadoNoAno } from './reducer';
import { montarArquivoBackup, lerArquivoBackup, restaurarBackup } from './backupPerfil';

const base = () => ({ ...structuredClone(initialState), anoCalendario: 2025, origemAnoAtual: 'manual',
  contribuinte: { nome: 'Pessoa sintética' },
  bens: [{ id: 1, discriminacao: 'Imóvel sintético', grupo: '01', codigo_bem: '12', situacao_anterior: 100, situacao_atual: 100, movimentacoes: [] }],
});
const mover = (s, movimentacao, movId) => reducer(s, { type: 'SALVAR_MOVIMENTACAO_DATADA', payload: {
  actionType: 'REGISTRAR_MOVIMENTACAO_BEM', bemId: s.bens[0].id, movimentacao, movId,
} });
const mudar = (s, ano) => reducer(s, { type: 'SWITCH_ANO', payload: ano });

describe('auditoria independente 2026-09-05 — contratos de continuidade, sem UI', () => {
  it('controle: transportar benfeitoria para ano ainda inexistente não duplica o custo', () => {
    let s = mover(base(), { data: '2025-03-01', tipo: 'benfeitoria', valor: 20 });
    s = mover(s, { data: '2026-03-01', tipo: 'benfeitoria', valor: 20 }, s.bens[0].movimentacoes[0].id);
    expect(s.bens[0].situacao_atual).toBe(100);
    expect(estadoNoAno(s, 2026).bens[0].situacao_atual).toBe(120);
  });
  it('D01: transportar a mesma benfeitoria para ano já aberto deve manter custo final 120', () => {
    let s = mover(base(), { data: '2025-03-01', tipo: 'benfeitoria', valor: 20 });
    s = mudar(reducer(s, { type: 'ROLLOVER_ANO', payload: 2026 }), 2025);
    s = mover(s, { data: '2026-03-01', tipo: 'benfeitoria', valor: 20 }, s.bens[0].movimentacoes[0].id);
    expect(s.bens[0].situacao_atual).toBe(100);
    expect(estadoNoAno(s, 2026).bens[0].situacao_anterior).toBe(100);
    expect(estadoNoAno(s, 2026).bens[0].situacao_atual).toBe(120);
  });
  it('D02: corrigir saldo anterior deve atualizar a abertura do ano manual já criado', () => {
    let s = mudar(reducer(base(), { type: 'ROLLOVER_ANO', payload: 2026 }), 2025);
    s = mover(s, { data: '2025-07-01', tipo: 'benfeitoria', valor: 30 });
    expect(estadoNoAno(s, 2026).bens[0].situacao_anterior).toBe(s.bens[0].situacao_atual);
  });
  it('D03: retificadora deve preservar dado manual de rendimento importado ou explicitar conflito', () => {
    let s = base();
    s.importFormato = 'dbk';
    s.rendimentos = [{ id: 2, origem: 'importacao', controle: 'R1', tipo: 'tributavel_pj', valor: 500, nome_fonte: 'Fonte sintética' }];
    s = reducer(s, { type: 'UPDATE_RENDIMENTO', payload: { id: 2, data: '2025-05-01', descricao: 'Conferido com comprovante sintético' } });
    s = reducer(s, { type: 'RECONCILIAR_IMPORTACAO', payload: { anoCalendario: 2025, formato: 'dbk', rendimentos: [{ controle: 'R1', tipo: 'tributavel_pj', valor: 550, nome_fonte: 'Fonte sintética' }], pagamentos: [] } });
    expect(s.rendimentos[0].data).toBe('2025-05-01');
    expect(s.rendimentos[0].descricao).toBe('Conferido com comprovante sintético');
  });
  it.each([
    ['bens', 'REGISTRAR_MOVIMENTACAO_BEM', 'benfeitoria', 130, 150],
    ['bensRurais', 'REGISTRAR_MOVIMENTACAO_BEM_RURAL', 'benfeitoria', 130, 150],
    ['dividas', 'REGISTRAR_MOVIMENTACAO_DIVIDA', 'amortizacao', 70, 50],
    ['dividasRurais', 'REGISTRAR_MOVIMENTACAO_DIVIDA_RURAL', 'amortizacao', 70, 50],
  ])('D02: %s preserva eventos próprios de 2026 ao corrigir 2025, propagando a 2027', (campo, actionType, tipo, abertura, fechamento) => {
    let s = base();
    s[campo] = [{ ...s.bens[0] }];
    s = reducer(s, { type: 'ROLLOVER_ANO', payload: 2026 });
    s = reducer(s, { type: actionType, payload: { bemId: s[campo][0].id, movimentacao: { data: '2026-06-01', tipo, valor: 20 } } });
    const movimentoProprio = s[campo][0].movimentacoes[0];
    s = reducer(s, { type: 'ROLLOVER_ANO', payload: 2027 });
    s = mudar(s, 2025);
    s = reducer(s, { type: actionType, payload: { bemId: s[campo][0].id, movimentacao: { data: '2025-06-01', tipo, valor: 30 } } });
    expect(estadoNoAno(s, 2026)[campo][0].situacao_anterior).toBe(abertura);
    expect(estadoNoAno(s, 2026)[campo][0].situacao_atual).toBe(fechamento);
    expect(estadoNoAno(s, 2026)[campo][0].movimentacoes).toEqual([movimentoProprio]);
    expect(estadoNoAno(s, 2027)[campo][0].situacao_anterior).toBe(fechamento);
  });
  it('D02: snapshot importado de 2026 interrompe propagação automática', () => {
    let s = reducer(base(), { type: 'ROLLOVER_ANO', payload: 2026 });
    s.origemAnoAtual = 'importacao';
    s = reducer(s, { type: 'ROLLOVER_ANO', payload: 2027 });
    s = mudar(s, 2025);
    const declarado = structuredClone(s.historico[2026]);
    s = mover(s, { data: '2025-04-01', tipo: 'benfeitoria', valor: 30 });
    expect(s.historico[2026]).toEqual(declarado);
    expect(estadoNoAno(s, 2027).bens[0].situacao_anterior).toBe(100);
  });
  it('D02: cadastro tardio de bem propaga saldo e titularidade sem copiar movimentos de aquisição', () => {
    let s = mudar(reducer(base(), { type: 'ROLLOVER_ANO', payload: 2026 }), 2025);
    s = reducer(s, { type: 'ADD_BEM', payload: { discriminacao: 'Segundo bem', data_aquisicao: '2025-01-01', beneficiario: 'Dependente', cpf_beneficiario: '00000000000', situacao_anterior: 0, situacao_atual: 40, movimentacoes: [{ tipo: 'compra', data: '2025-01-01', valor: 40 }] } });
    const herdado = estadoNoAno(s, 2026).bens.find(b => b.discriminacao === 'Segundo bem');
    expect(herdado).toMatchObject({ situacao_anterior: 40, situacao_atual: 40, beneficiario: 'Dependente', cpf_beneficiario: '00000000000', movimentacoes: [] });
  });
  it('D02: retificar 2025 enquanto 2026 está ativo atualiza sua abertura e mantém evento próprio', () => {
    let s = base();
    s.bens[0].origem = 'importacao';
    s = reducer(s, { type: 'ROLLOVER_ANO', payload: 2026 });
    s = mover(s, { data: '2026-05-01', tipo: 'benfeitoria', valor: 20 });
    s = reducer(s, { type: 'RECONCILIAR_IMPORTACAO', payload: { anoCalendario: 2025, bens: { vinculados: [{ idAntigo: 1, dados: { situacao_atual: 150 } }] }, rendimentos: [], pagamentos: [] } });
    expect(estadoNoAno(s, 2026).bens[0]).toMatchObject({ situacao_anterior: 150, situacao_atual: 170 });
  });
  it.each([
    ['rendimentos', 'UPDATE_RENDIMENTO'], ['pagamentos', 'UPDATE_PAGAMENTO'],
    ['doacoesEfetuadasOficial', 'UPDATE_DOACAO_EFETUADA'], ['doacoesPartidosOficial', 'UPDATE_DOACAO_PARTIDO'],
    ['doacoesEcaIdosoOficial', 'UPDATE_DOACAO_ECA_IDOSO'],
  ])('D03: %s conserva complemento e registra conflito sem bloquear novo valor declarado', (campo, tipo) => {
    let s = base();
    s.importFormato = 'dbk';
    s[campo] = [{ id: 2, controle: 'FIXO', origem: 'importacao', valor: 100 }];
    s = reducer(s, { type: tipo, payload: { id: 2, data: '2025-04-01', valor: 900 } });
    s = reducer(s, { type: 'RECONCILIAR_IMPORTACAO', payload: { anoCalendario: 2025, formato: 'dbk', [campo]: [{ controle: 'FIXO', valor: 150 }] } });
    expect(s[campo][0]).toMatchObject({ id: 2, data: '2025-04-01', valor: 150, valorDeclarado: { valor: 150 }, ajustesLocaisRetificadora: [{ campo: 'valor', valorLocal: 900, valorDeclarado: 150 }] });
  });
  it('D03: lançamento editado sem correspondência ou ambíguo recusa perda silenciosa', () => {
    let s = base();
    s.rendimentos = [{ id: 2, origem: 'importacao', controle: 'FIXO', valor: 100 }];
    s = reducer(s, { type: 'UPDATE_RENDIMENTO', payload: { id: 2, data: '2025-04-01' } });
    const congelado = structuredClone(s);
    for (const rendimentos of [[], [{ controle: 'FIXO', valor: 200 }, { controle: 'FIXO', valor: 300 }]]) {
      expect(() => reducer(s, { type: 'RECONCILIAR_IMPORTACAO', payload: { anoCalendario: 2025, rendimentos } })).toThrow(/alterações manuais/);
      expect(s).toEqual(congelado);
    }
  });
  it('controle: backup completo preserva lançamento em ano não ativo, titularidade e metadados', async () => {
    const s = reducer(base(), { type: 'ADD_EM_ANO', payload: { ano: 2026, action: { type: 'ADD_PAGAMENTO', payload: {
      data: '2026-04-02', valor_pago: 50, beneficiario: 'Dependente', cpf_beneficiario: '00000000000', documentoComprovante: 'sintetico',
    } } } });
    const dados = new Map();
    const storage = { getItem: k => dados.get(k) || null, setItem: (k, v) => dados.set(k, v), removeItem: k => dados.delete(k) };
    const arquivo = await lerArquivoBackup(JSON.stringify(await montarArquivoBackup({ perfil: { nome: 'Sintético' }, conteudo: s })));
    const resultado = await restaurarBackup({ storage, desktopApi: null, arquivo });
    expect(resultado.estado.historico[2026].pagamentos).toEqual(s.historico[2026].pagamentos);
    expect(resultado.estado.bens).toEqual(s.bens);
  });
});
