import { describe, it, expect } from 'vitest';
import { initialState, reducer, reducerComHistorico, snapshotYear } from '../store/reducer';
import { identificarArquivoFonte } from './importacaoDeclaracao';
import { classificacaoVigente, registrosClassificaveis, valorDoCampo } from './classificacaoImportacao';

const base = () => ({ ...initialState, anoCalendario: 2025, origemAnoAtual: 'importacao',
  documentoFonte: { sha256ArquivoOriginal: 'sintetico', textoIntegral: 'FONTE SINTÉTICA', revisaoManualAberta: true },
  dependentes: [{ id: 10, nome: 'Dependente sintético', cpf: '12345678901', origem: 'importacao' }],
  bens: [{id: 1, origem: 'importacao', grupo: '02', codigo_bem: '01', beneficiario: 'Titular', discriminacao: 'Veículo sintético', renavam: '12345678901', cnpj: '', situacao_atual: 100, origemDocumento: {formato: 'pdf', pagina: 1, linha: 2}}],
  rendimentos: [{ id: 2, origem: 'importacao', tipo: 'exclusivo_0006', valor: 100, irrf: null, cnpj_fonte: '', nome_fonte: 'Fonte sintética' }],
});
const acao = (p = {}) => ({type: 'CLASSIFICAR_CAMPO_IMPORTADO', payload: {anoCalendario: 2025, fonte: 'sintetico', colecao: 'rendimentos', id: 2, campo: 'irrf', estado: 'nao_informado', atualizadoEm: '2026-09-08T12:00:00Z', ...p}});

describe('classificação manual da declaração', () => {
  it('oferece a janela após identificar e importar um documento novo', async () => {
    const documento = await identificarArquivoFonte({documentoFonte: {}, anoCalendario: 2025, bens: []}, {name: 'sintetico.pdf', size: 3}, new Uint8Array([1,2,3]).buffer);
    const s = reducer(initialState, {type: 'IMPORT_DECLARACAO', payload: documento});
    expect(s.documentoFonte.revisaoManualAberta).toBe(true);
  });
  it('pular fecha a janela sem classificar nem alterar valores e permite retomar após recarga', () => {
    const s = base();
    const pulado = JSON.parse(JSON.stringify(reducer(s, {type: 'ABRIR_CLASSIFICACAO_IMPORTACAO', payload: false})));
    expect(pulado.bens).toEqual(s.bens);
    expect(pulado.rendimentos).toEqual(s.rendimentos);
    expect(registrosClassificaveis(pulado).map(r => r.pendentes)).toEqual(registrosClassificaveis(s).map(r => r.pendentes));
    expect(reducer(pulado, {type: 'ABRIR_CLASSIFICACAO_IMPORTACAO', payload: true}).documentoFonte.revisaoManualAberta).toBe(true);
  });
  it('confirma ausência sem fabricar zero e preserva fonte, origem e histórico', () => {
    const s = base(); const novo = reducerComHistorico(s, acao());
    expect(novo.rendimentos[0].irrf).toBeNull();
    expect(novo.rendimentos[0].valorDeclarado).toEqual(s.rendimentos[0]);
    expect(novo.documentoFonte).toEqual(s.documentoFonte);
    expect(classificacaoVigente(novo, novo.rendimentos[0], 'irrf').estado).toBe('nao_informado');
    expect(novo.alteracoes[0].descricao).toContain('Não informado');
    expect(snapshotYear(novo).rendimentos[0].classificacaoManual.irrf).toBeDefined();
  });
  it('distingue zero informado de ausência e não perde a escolha ao editar outro campo', () => {
    let s = reducer(base(), acao({estado: 'informado', valor: 0}));
    s = reducer(s, {type: 'UPDATE_RENDIMENTO', payload: {id: 2, nome_fonte: 'Fonte corrigida'}});
    expect(s.rendimentos[0].irrf).toBe(0);
    expect(classificacaoVigente(s, s.rendimentos[0], 'irrf').estado).toBe('informado');
    s = reducer(s, {type: 'UPDATE_RENDIMENTO', payload: {id: 2, irrf: 10}});
    expect(classificacaoVigente(s, s.rendimentos[0], 'irrf')).toBeNull();
  });
  it('sem código é uma escolha explícita e não apaga o RENAVAM ou outros dados', () => {
    const s = reducer(base(), acao({colecao: 'bens', id: 1, campo: 'codigo_bem', estado: 'sem_codigo'}));
    expect(s.bens[0].codigo_bem).toBe('');
    expect(s.bens[0].renavam).toBe('12345678901');
    expect(s.bens[0].valorDeclarado.codigo_bem).toBe('01');
    expect(classificacaoVigente(s, s.bens[0], 'codigo_bem').estado).toBe('sem_codigo');
  });
  it('seleciona dependente pelo cadastro e limpa seus vínculos ao mudar para titular', () => {
    let s = reducer(base(), acao({colecao: 'bens', id: 1, campo: 'beneficiario', estado: 'informado', valor: 'Dependente', dependenteId: 10}));
    expect(s.bens[0]).toMatchObject({ beneficiario: 'Dependente', dependenteId: 10, cpf_beneficiario: '12345678901', cnpj: '' });
    s = reducer(s, acao({colecao: 'bens', id: 1, campo: 'beneficiario', estado: 'informado', valor: 'Titular'}));
    expect(s.bens[0]).toMatchObject({ beneficiario: 'Titular', cpf_beneficiario: '', dependenteId: null });
    expect(() => reducer(s, acao({colecao: 'bens', id: 1, campo: 'beneficiario', estado: 'informado', valor: 'Dependente', dependenteId: 99}))).toThrow('dependente cadastrado');
  });
  it('reconhece a titularidade importada do pagamento sem confundir com seu recebedor', () => {
    expect(valorDoCampo({titularidade: 'titular', nome_beneficiario: 'Prestador'}, 'beneficiario')).toBe('Titular');
    const s = {...base(), pagamentos: [{id: 3, origem: 'importacao', titularidade: 'titular', nome_beneficiario: 'Prestador', cpf_cnpj: '12345678000199'}]};
    const n = reducer(s, acao({colecao: 'pagamentos', id: 3, campo: 'beneficiario', estado: 'informado', valor: 'Dependente', dependenteId: 10}));
    expect(n.pagamentos[0].cpf_cnpj).toBe('12345678000199');
    expect(n.pagamentos[0].nome_beneficiario).toBe('Prestador');
  });
  it('reclassificar o tipo de RRA não herda a exclusão do agregado importado', () => {
    const s = base(); s.rendimentos[0] = {...s.rendimentos[0], tipo: 'tributavel_rra', naoSomar: true};
    const n = reducer(s, acao({campo: 'tipo', estado: 'informado', valor: 'tributavel_pj'}));
    expect(n.rendimentos[0].naoSomar).toBe(false);
    expect(n.rendimentos[0].valorDeclarado.naoSomar).toBe(true);
    expect(n.rendimentos[0].irrf).toBeNull();
  });
  it('recusa campos internos, documentos inválidos, ano ou fonte diferentes', () => {
    for (const p of [{campo: '__proto__'}, {campo: 'id'}, {anoCalendario: 2026}, {fonte: 'outro'}, {campo: 'cnpj_fonte', estado: 'informado', valor: '123'}, {campo: 'irrf', estado: 'sem_codigo'}, {campo: 'irrf', estado: 'informado', valor: Infinity}]) expect(() => reducer(base(), acao(p))).toThrow();
  });
  it('recusa código incompatível e alteração direta de saldo com movimentações', () => {
    expect(() => reducer(base(), acao({colecao: 'bens', id: 1, campo: 'codigo_bem', estado: 'informado', valor: '12'}))).toThrow('compatível');
    const s = base(); s.bens[0].movimentacoes = [{tipo: 'compra', valor: 100}];
    expect(() => reducer(s, acao({colecao: 'bens', id: 1, campo: 'situacao_atual', estado: 'informado', valor: 1}))).toThrow('movimentações');
  });
  it('não carrega a revisão de um ano para outro nem aceita a prova manual de outra fonte', () => {
    let s = reducer(base(), acao());
    const n = reducer(s, {type: 'SWITCH_ANO', payload: 2026});
    expect(n.documentoFonte?.revisaoManualAberta).not.toBe(true);
    s = {...s, documentoFonte: {sha256ArquivoOriginal: 'retificadora'}};
    expect(classificacaoVigente(s, s.rendimentos[0], 'irrf')).toBeNull();
  });
});
