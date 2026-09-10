import { describe, it, expect } from 'vitest';
import { initialState, reducer, snapshotYear } from './reducer';
import { acompanhamentoDo, aplicarAcompanhamento, caixaPeriodo, resultadoEconomicoOperacoes } from './acompanhamento';
import { vincularOperacao, desvincularOperacao, aplicarVinculosNoAno, referenciasFiscais, resolverReferencia } from './vinculosOperacoes';
import { ganhosApuradosPeriodo, demonstrativoConciliacao } from './demonstrativos';
import { previaDatasLegadas, pendenciasPeriodicas } from './revisaoPeriodica';
import { montarArquivoBackup, textoDoArquivoBackup } from './backupPerfil';
import { ensaiarBackup } from './ensaioBackup';
import { gerarSaltBase64, derivarChave, criptografarObjeto } from '../utils/crypto';
import { abasRelatorioCompleto } from '../utils/relatorioCompleto';

const meta = id => ({ id, agora: '2026-09-05T22:30:00.000Z' });
const data = '2026-04-12', de = '2026-01-01', ate = '2026-12-31';
function base() {
  return aplicarAcompanhamento({ ...structuredClone(initialState), anoCalendario: 2026, origemAnoAtual: 'manual', bens: [{ id: 1, beneficiario: 'Titular', discriminacao: 'Carro', movimentacoes: [{ id: 2, tipo: 'venda_total', data, valorVenda: 1200, valor: 1000, irrfVenda: 50 }], situacao_anterior: 1000, situacao_atual: 0 }] }, { comando: 'operacao', tipo: 'venda', descricao: 'Venda do carro', pessoa: 'titular', dataEconomica: data, precoContrato: 1200, custoBaixado: 1000, despesasVenda: 20 }, meta('venda'));
}
const vincular = (s, campo, id, extra = {}) => vincularOperacao(s, { operacaoId: 'venda', ref: { ano: 2026, campo, id, ...extra } }, meta(`v-${campo}-${id}-${extra.movimentacaoId || ''}`));

describe('identidade explícita e representações preservadas', () => {
  it('GCAP importado após a venda não altera o resultado econômico; vínculo evita duplicação fiscal', () => {
    let s = vincular(base(), 'bens', 1, { movimentacaoId: 2 });
    const fiscalOriginal = JSON.stringify(s.bens);
    const economico = resultadoEconomicoOperacoes(s.acompanhamento, de, ate);
    expect(economico.total).toBe(18000);
    s = reducer(s, { type: 'IMPORT_DECLARACAO', payload: { anoCalendario: 2026, apuracaoGanhoCapital: [{ id: 3, dataAlienacao: data, custoAquisicao: 1000, valorAlienacao: 1200, bem: 'Carro' }] } });
    expect(resultadoEconomicoOperacoes(s.acompanhamento, de, ate)).toEqual(economico);
    s = vincular(s, 'apuracaoGanhoCapital', 3);
    expect(ganhosApuradosPeriodo(s, de, ate).totalOperacoes).toBe(150);
    expect(JSON.stringify(s.bens)).toBe(fiscalOriginal);
    expect(s.apuracaoGanhoCapital[0].operacaoId).toBeUndefined();
  });
  it('resumo de outra operação não abate venda vinculada', () => {
    let s = base(); s.rendimentos = [{ id: 4, data, tipo: 'exclusivo_02', valor: 150, beneficiario: 'Titular' }];
    s = vincular(s, 'bens', 1, { movimentacaoId: 2 });
    expect(ganhosApuradosPeriodo(s, de, ate).jaNosRendimentos).toBe(0);
    s = vincular(s, 'rendimentos', 4);
    expect(ganhosApuradosPeriodo(s, de, ate)).toMatchObject({ totalOperacoes: 150, jaNosRendimentos: 150, total: 0 });
    s = desvincularOperacao(s, { operacaoId: 'venda', vinculoId: 'v-rendimentos-4-', motivo: 'Registro de outra venda' }, meta('desvinculo'));
    expect(ganhosApuradosPeriodo(s, de, ate).jaNosRendimentos).toBe(0);
    expect(s.acompanhamento.eventos.at(-1).dados.motivo).toBeTruthy();
  });
  it('rejeita vínculo inexistente, ambíguo, repetido e de outra pessoa', () => {
    let s = base();
    expect(() => vincular(s, 'bens', 999)).toThrow('inexistente');
    s.bens.push({ id: 8, beneficiario: 'Dependente', cpf_beneficiario: '33344455508' });
    expect(() => vincular(s, 'bens', 8)).toThrow('titularidades');
    s = vincular(s, 'bens', 1, { movimentacaoId: 2 });
    expect(() => vincular(s, 'bens', 1, { movimentacaoId: 2 })).toThrow('já vinculado');
    expect(resolverReferencia(s, null)).toBeNull();
    expect(referenciasFiscais(s).length).toBe(3);
  });
  it('P08: a ficha mensal do titular não pode ser vinculada à operação de um dependente', () => {
    const s = base(); // operação "venda", pessoa: titular
    s.rendaVariavelMensalManual = [
      { mes: 3, titular: true, comuns: { prejuizoCompensar: 100 } },
      { mes: 4, titular: false, cpfDependente: '33344455508', comuns: { prejuizoCompensar: 50 } },
    ];
    s.acompanhamento = { ...s.acompanhamento, operacoes: [
      ...s.acompanhamento.operacoes,
      { id: 'venda-dep', descricao: 'Venda do dependente', pessoa: '33344455508', tipo: 'venda', anoFiscal: 2026, vinculos: [], criadoEm: '2026-01-01T00:00:00.000Z' },
    ] };
    const vinc = (operacaoId, chaveMensal) => vincularOperacao(
      s, { operacaoId, ref: { ano: 2026, campo: 'rendaVariavelMensalManual', chaveMensal } }, meta(`m-${operacaoId}-${chaveMensal}`),
    );
    // Ficha do titular x operação de dependente: recusa.
    expect(() => vinc('venda-dep', '3|t|')).toThrow('titularidades');
    // Ficha do dependente x operação do titular: recusa.
    expect(() => vinc('venda', '4|d|33344455508')).toThrow('titularidades');
    // Ficha do titular x operação do titular: aceita.
    expect(vinc('venda', '3|t|').acompanhamento.operacoes.find(o => o.id === 'venda').vinculos).toHaveLength(1);
  });
  it('P08: vincular ficha mensal de RV não move nenhuma figura do Demonstrativo (efeito é só rastreabilidade)', () => {
    // Prova de que o `operacaoId` que `aplicarVinculosNoAno` carimba numa ficha
    // mensal de RV é dado inerte para o cálculo: nenhuma função de
    // demonstrativos/consultaPeriodo lê esse campo (só bens/GCAP/rendimentos).
    // Logo P08 é rastreabilidade por beneficiário, não efeito monetário → MÉDIO.
    let s = base();
    s.rendaVariavelMensalOficial = [{
      mes: 6, titular: true,
      comuns: { resultadoLiquidoMes: -1000, prejuizoCompensar: 1000 },
      consolidacao: {},
    }];
    const antes = demonstrativoConciliacao(s, '2026-01-01', '2026-12-31');
    s = vincularOperacao(
      s, { operacaoId: 'venda', ref: { ano: 2026, campo: 'rendaVariavelMensalOficial', chaveMensal: '6|t|' } },
      meta('m-rv'),
    );
    const depois = demonstrativoConciliacao(s, '2026-01-01', '2026-12-31');
    expect(depois.saldoDeCaixaGeral).toBe(antes.saldoDeCaixaGeral);
    expect(depois.saldoDeCaixa).toBe(antes.saldoDeCaixa);
    expect(depois.rendaVariavelPerda).toBe(antes.rendaVariavelPerda);
    expect(depois.ganhos).toEqual(antes.ganhos);
  });
  it('P07: referência de movimento ambígua não é aplicada na projeção anual', () => {
    // Estado deliberadamente inconsistente: pai único, dois movimentos com o
    // mesmo id, e um vínculo já gravado para esse id.
    const dados = {
      bens: [{
        id: 1, discriminacao: 'Carro', chaveContinuidade: 'carro',
        movimentacoes: [
          { id: 2, tipo: 'venda_total', data: '2026-04-01', valorVenda: 100, valor: 90 },
          { id: 2, tipo: 'benfeitoria', data: '2026-06-01', valor: 10 },
        ],
      }],
    };
    const acompanhamento = { operacoes: [
      { id: 'op-x', vinculos: [{ id: 'v1', ref: { ano: 2026, campo: 'bens', id: 1, movimentacaoId: 2 } }] },
    ] };
    // resolverReferencia já recusa (movimento não é único).
    expect(resolverReferencia({ anoCalendario: 2026, ...dados }, { ano: 2026, campo: 'bens', id: 1, movimentacaoId: 2 })).toBeNull();
    // E a projeção não carimba operacaoId em movimento nenhum.
    const projetado = aplicarVinculosNoAno(dados, acompanhamento, 2026);
    expect(projetado.bens[0].movimentacoes.every(m => m.operacaoId === undefined)).toBe(true);
  });
  it('chave de importação exata sobrevive à troca de id e desaparecimento vira pendência', () => {
    let s = base(); s.rendimentos = [{ id: 4, chaveImportacao: 'r:4', beneficiario: 'Titular', data, valor: 150, tipo: 'exclusivo_02' }];
    s = vincular(s, 'rendimentos', 4, { chaveImportacao: 'r:4' });
    s.rendimentos = [{ ...s.rendimentos[0], id: 55 }];
    expect(aplicarVinculosNoAno(s, s.acompanhamento, 2026).rendimentos[0].operacaoId).toBe('venda');
    s.rendimentos = [];
    expect(pendenciasPeriodicas(s, '2026-12').some(p => p.tipo === 'Vínculo perdido')).toBe(true);
  });
});

describe('prévia de migração sem adivinhar identidade', () => {
  function legado() {
    const anterior = { ...structuredClone(initialState), anoCalendario: 2025, origemAnoAtual: 'manual', bens: [{ id: 1, discriminacao: 'Casa', situacao_anterior: 1000, situacao_atual: 1200, chaveContinuidade: 'casa', movimentacoes: [{ id: 8, data: '2026-03-01', tipo: 'benfeitoria', valor: 200 }] }] };
    return { ...structuredClone(initialState), anoCalendario: 2026, origemAnoAtual: 'manual', bens: [{ id: 3, discriminacao: 'Casa', situacao_anterior: 1200, situacao_atual: 1200, chaveContinuidade: 'casa', movimentacoes: [] }], historico: { 2025: snapshotYear(anterior) } };
  }
  it('prévia é imutável; aplicação preserva cópia e registra no destino exato', () => {
    const s = legado(), original = JSON.stringify(s);
    const plano = previaDatasLegadas(s)[0];
    expect(plano).toMatchObject({ anoOrigem: 2025, anoDestino: 2026, alvoId: 3, impedimento: '' });
    expect(JSON.stringify(s)).toBe(original);
    const next = reducer(s, { type: 'MIGRAR_DATA_LEGADA', payload: { origem: plano.origem, antes: plano.antes, responsavel: 'Revisor', backupConfirmado: true } });
    expect(next.historico[2025].bens[0].movimentacoes).toHaveLength(0);
    expect(next.bens[0].movimentacoes).toHaveLength(1);
    expect(next.bens[0]).toMatchObject({ situacao_anterior: 1000, situacao_atual: 1200 });
    expect(next.migracoesDados[0].copiaAnterior.origem.bens[0].movimentacoes).toHaveLength(1);
    expect(previaDatasLegadas(next)).toHaveLength(0);
  });
  it('impede aplicar prévia velha, sem backup, sobre declaração ou sem vínculo exato', () => {
    const s = legado(), plano = previaDatasLegadas(s)[0];
    expect(() => reducer(s, { type: 'MIGRAR_DATA_LEGADA', payload: { origem: plano.origem } })).toThrow('backup');
    expect(() => reducer(s, { type: 'MIGRAR_DATA_LEGADA', payload: { origem: plano.origem, antes: 'mudou', responsavel: 'R', backupConfirmado: true } })).toThrow('prévia mudou');
    expect(previaDatasLegadas({ ...s, origemAnoAtual: 'importacao' })[0].impedimento).toContain('importada');
    expect(previaDatasLegadas({ ...s, bens: s.bens.map(b => ({ ...b, chaveContinuidade: 'outra' })) })[0].impedimento).toContain('ambíguo');
  });
  it('DAA de outro ano fiscal não é erro de data', () => {
    const s = legado(); s.doacoesEcaIdosoOficial = [{ id: 77, data: '2027-04-30', valor: 100 }];
    expect(previaDatasLegadas(s).some(p => p.ref.campo === 'doacoesEcaIdosoOficial')).toBe(false);
  });
});

describe('segurança e rotina', () => {
  it('relatório inclui operações, referências externas e valores em reais, não centavos', () => {
    let s = base();
    s = aplicarAcompanhamento(s, { comando: 'documento', operacaoId: 'venda', descricao: 'Contrato', referencia: 'documentos/contrato.pdf' }, meta('doc'));
    const abas = abasRelatorioCompleto(s);
    expect(abas.find(a => a.nome === 'Operações globais').linhas[0]['precoContrato (R$)']).toBe(1200);
    expect(abas.find(a => a.nome === 'Documentos externos').linhas[0].externo).toBe(true);
    expect(pendenciasPeriodicas(s, '2026-12').some(p => p.tipo === 'Comprovante')).toBe(false);
  });
  it('ensaio restaura dados financeiros e relê sem tocar storage real', async () => {
    const s = base();
    const arquivo = await montarArquivoBackup({ perfil: { nome: 'Sintético' }, conteudo: s });
    expect(arquivo.documentos.incluiArquivosExternos).toBe(false);
    const resultado = await ensaiarBackup(textoDoArquivoBackup(arquivo));
    expect(resultado).toMatchObject({ hash: arquivo.hash, protegido: false, contas: 0 });
    await expect(ensaiarBackup(JSON.stringify({ ...arquivo, conteudo: { ...s, bens: [] } }))).rejects.toThrow('integridade');
  });
  it('ensaio protegido exige senha correta e relê o envelope restaurado', async () => {
    const salt = gerarSaltBase64(), chave = await derivarChave('senha-teste', salt);
    const arquivo = await montarArquivoBackup({ perfil: { nome: 'Sintético' }, conteudo: await criptografarObjeto(chave, base()), protegido: true, salt });
    await expect(ensaiarBackup(textoDoArquivoBackup(arquivo), 'errada')).rejects.toThrow('Senha incorreta');
    expect((await ensaiarBackup(textoDoArquivoBackup(arquivo), 'senha-teste')).protegido).toBe(true);
  });
  it.each(['RENDA_VARIAVEL', 'FII'])('remoção de ajuste %s não apaga dado oficial nem outra pessoa', ficha => {
    const campo = ficha === 'FII' ? 'fiiFiagroMensalManual' : 'rendaVariavelMensalManual';
    const oficial = ficha === 'FII' ? 'fiiFiagroMensalOficial' : 'rendaVariavelMensalOficial';
    const s = { ...base(), [campo]: [{ mes: 1, titular: true }, { mes: 1, titular: false, cpfDependente: '123' }], [oficial]: [{ mes: 1, titular: true, valor: 200 }] };
    const n = reducer(s, { type: `REMOVER_${ficha}_MES_MANUAL`, payload: { mes: 1, titular: true } });
    expect(n[campo]).toEqual([{ mes: 1, titular: false, cpfDependente: '123' }]);
    expect(n[oficial]).toEqual(s[oficial]);
  });
  it('recebimento posterior não apaga pendência histórica da parcela', () => {
    let s = base();
    s = aplicarAcompanhamento(s, { comando: 'conta', nome: 'Banco', pessoa: 'titular', dataAbertura: de, saldoInicial: 0, disponivel: true }, meta('banco'));
    s = aplicarAcompanhamento(s, { comando: 'parcela', operacaoId: 'venda', vencimento: '2026-05-01', principal: 100, sentido: 'entrada' }, meta('p1'));
    s = aplicarAcompanhamento(s, { comando: 'lancamento', contaId: 'banco', tipo: 'entrada', data: '2026-06-01', valor: 100, descricao: 'Parcela', contraparte: 'Comprador', parcelaId: 'p1' }, meta('l1'));
    expect(caixaPeriodo(acompanhamentoDo(s), '2026-05-01', '2026-05-31').projetado).toBe(10000);
    expect(pendenciasPeriodicas(s, '2026-05').some(p => p.tipo === 'Parcela')).toBe(true);
    expect(pendenciasPeriodicas(s, '2026-06').some(p => p.tipo === 'Parcela')).toBe(false);
  });
});
