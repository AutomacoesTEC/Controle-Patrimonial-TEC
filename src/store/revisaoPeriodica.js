import { acompanhamentoDo, conciliarConta, limitesMes, valorParcela, fechamentoAtual, assinaturaFiscalFechamento } from './acompanhamento';
import { anosFiscais, referenciasFiscais, chaveReferencia, resolverReferencia } from './vinculosOperacoes';
import { pessoaDoRegistro } from './titularidade';
import { anoDaDataCadastro } from '../utils/dataCadastro';

export const ESTOQUES = { bens: 'BEM', dividas: 'DIVIDA', bensRurais: 'BEM_RURAL', dividasRurais: 'DIVIDA_RURAL' };
const fichaView = campo => /(?:Variavel|Fiagro)Mensal/.test(campo) ? 'rendaVariavel' : ({ doacoesEfetuadasOficial: 'doacoes', doacoesPartidosOficial: 'doacoes', doacoesEcaIdosoOficial: 'doacoes', apuracaoGanhoCapital: 'ganhosCapital', bensRurais: 'atividadeRural', dividasRurais: 'atividadeRural', lancamentosRurais: 'atividadeRural' }[campo] || campo);
const chaveContinuidade = r => r.chaveContinuidade || r.chaveImportacao || r.controle || r.id;
export function previaDatasLegadas(state) {
  return referenciasFiscais(state).flatMap(({ ref, item, rotulo }) => {
    if (ref.movimentacaoId == null && ESTOQUES[ref.campo]) return [];
    if (ref.campo === 'doacoesEcaIdosoOficial' || ref.campo === 'apuracaoGanhoCapital') return [];
    const alvoAno = anoDaDataCadastro(item.data);
    if (!alvoAno || alvoAno === ref.ano) return [];
    const origem = resolverReferencia(state, ref);
    const destino = alvoAno === state.anoCalendario ? state : state.historico?.[alvoAno];
    let alvoId = null, impedimento = '';
    if (ref.movimentacaoId == null) impedimento = 'Revise na ficha de origem; alteração de ficha fiscal requer decisão individual.';
    else {
      const chave = chaveContinuidade(origem.pai);
      const candidatos = (destino?.[ref.campo] || []).filter(r => chaveContinuidade(r) === chave);
      if (!destino) impedimento = 'Abra o ano de destino antes de migrar, para conferir a abertura.';
      else if ((destino.origemAnoAtual || destino.origem) === 'importacao') impedimento = 'Destino é declaração importada: revisão manual obrigatória, sem migração automática.';
      else if (candidatos.length !== 1) impedimento = 'Vínculo de continuidade ausente ou ambíguo. Selecione o bem na ficha de destino; não será comparada a descrição.';
      else { alvoId = candidatos[0].id; if (candidatos[0].movimentacoes?.some(m => m.id === item.id)) impedimento = 'Movimento já existe no destino: revisar duplicidade.'; }
    }
    return [{ origem: chaveReferencia(ref), ref, rotulo, data: item.data, anoOrigem: ref.ano, anoDestino: alvoAno, alvoId, impedimento, antes: JSON.stringify(item), anosFuturos: anosFiscais(state).filter(([ano]) => Number(ano) > Math.min(ref.ano, alvoAno)).map(([ano, dados]) => ({ ano: Number(ano), tratamento: (dados.origemAnoAtual || dados.origem) === 'importacao' ? 'Declaração preservada; conferir divergência' : 'Abertura manual pode ser recomposta' })) }];
  });
}

export function pendenciasPeriodicas(state, mes) {
  const a = acompanhamentoDo(state), [, ate] = limitesMes(mes);
  const linhas = [];
  const add = (id, tipo, descricao, acao, detalhes = {}) => linhas.push({ id, tipo, descricao, acao, ...detalhes });
  for (const f of a.fechamentos.filter(f => f.status === 'fechado' && fechamentoAtual(a, f.mes)?.id === f.id)) {
    if (JSON.stringify(f.snapshot?.fiscal) !== JSON.stringify(assinaturaFiscalFechamento(state, f.mes.slice(0, 4)))) add(`fechamento:${f.id}`, 'Revisão fiscal desatualizada', `Fechamento ${f.mes}, versão ${f.versao}: os dados fiscais mudaram após a aprovação. Reabra e revise antes de fechar novamente; a versão anterior permanece preservada.`, 'acompanhamento');
  }
  for (const c of a.contas.filter(c => c.dataAbertura <= ate)) {
    const r = conciliarConta(a, c.id, mes);
    if (r.diferenca !== 0) add(`extrato:${c.id}:${mes}`, 'Extrato', `${c.nome}: ${r.extrato ? `diferença de R$ ${(r.diferenca / 100).toFixed(2)}` : 'saldo de extrato ausente'}`, 'acompanhamento');
  }
  for (const o of a.operacoes.filter(o => o.dataEconomica <= ate)) {
    if (!a.documentos.some(d => d.operacaoId === o.id)) add(`documento:${o.id}`, 'Comprovante', `${o.descricao}: documento não referenciado`, 'acompanhamento');
    if (!(o.vinculos || []).length) add(`vinculo:${o.id}`, 'Vínculo fiscal', `${o.descricao}: nenhuma ficha vinculada (pode ser não declarável; registrar parecer)`, 'acompanhamento');
    if (o.tipo === 'imposto' && !a.lancamentos.some(l => l.operacaoId === o.id && l.tipo === 'saida' && !l.canceladoEm && l.data <= ate)) add(`imposto:${o.id}`, 'Imposto', `${o.descricao}: sem quitação financeira até o fim do mês`, 'acompanhamento');
    for (const v of o.vinculos || []) if (!resolverReferencia(state, v.ref)) add(`orfao:${v.id}`, 'Vínculo perdido', `${o.descricao}: referência fiscal não encontrada após alteração/importação`, 'acompanhamento');
  }
  for (const p of a.parcelas.filter(p => !p.canceladoEm && p.vencimento <= ate && !a.lancamentos.some(l => l.parcelaId === p.id && !l.canceladoEm && l.data <= ate))) add(`parcela:${p.id}`, 'Parcela', `${a.operacoes.find(o => o.id === p.operacaoId)?.descricao}: ${p.vencimento}, R$ ${(valorParcela(p) / 100).toFixed(2)} sem baixa até ${ate}`, 'acompanhamento');
  for (const l of a.lancamentos.filter(l => !l.canceladoEm && l.tipo !== 'transferencia' && !l.operacaoId && l.data <= ate)) add(`baixa:${l.id}`, 'Origem da baixa', `${l.data}: ${l.descricao} sem operação vinculada. Cancele e refaça com vínculo após conferir.`, 'acompanhamento');
  for (const { ref, item, rotulo } of referenciasFiscais(state)) {
    if (ref.ano > Number(mes.slice(0, 4))) continue;
    const dados = resolverReferencia(state, ref);
    if (!dados) { add(`ambiguo:${chaveReferencia(ref)}`, 'Identidade ambígua', `${rotulo}: há mais de um registro com a mesma chave. Revisão individual obrigatória.`, fichaView(ref.campo)); continue; }
    const pessoa = /Mensal/.test(ref.campo) && item.titular === true ? 'titular' : pessoaDoRegistro(dados.pai || item, dados.ano.dependentes || []);
    const id = chaveReferencia(ref);
    if (ref.movimentacaoId == null && ['dependente-sem-identificacao', 'nao-informada'].includes(pessoa)) add(`pessoa:${id}`, 'Titularidade', `${rotulo}: ${pessoa === 'nao-informada' ? 'não informada' : 'dependente não identificado'}`, fichaView(ref.campo), { ref });
    if (ref.campo === 'doacoesEcaIdosoOficial' && !item.data) add(`data:${id}`, 'Data financeira', `${rotulo}: DAA sem data efetiva de pagamento`, 'doacoes', { ref });
    if (ref.campo === 'rendimentos' && item.irrf && /^tributavel_(pf|exterior)/.test(item.tipo || '')) add(`carne:${id}`, 'Data de imposto legado', `${rotulo}: conferir data efetiva do imposto no acompanhamento; não presumir a data do rendimento`, 'acompanhamento', { ref });
    if (/Mensal/.test(ref.campo) && Number(item.impostoPago || item.consolidacao?.impostoPago || item.consolidacao?.totalImpostoDevido || 0) > 0) {
      const operacoes = a.operacoes.filter(o => o.vinculos?.some(v => chaveReferencia(v.ref) === id));
      if (!a.lancamentos.some(l => !l.canceladoEm && l.tipo === 'saida' && l.data <= ate && operacoes.some(o => o.id === l.operacaoId))) add(`imposto-mensal:${id}`, 'Data de imposto mensal', `${rotulo}: apuração mensal não comprova o dia bancário. Vincule a operação de imposto e sua baixa financeira.`, 'acompanhamento', { ref });
    }
    if ((item.ajustesLocaisRetificadora || []).length) add(`retificadora:${id}`, 'Retificadora', `${rotulo}: há enriquecimentos locais divergentes da declaração`, fichaView(ref.campo), { ref, comparacao: { atual: item, ajustes: item.ajustesLocaisRetificadora } });
  }
  for (const p of previaDatasLegadas(state)) add(`migracao:${p.origem}`, 'Data fora do ano', `${p.rotulo}: data ${p.data}, destino ${p.anoDestino}. ${p.impedimento || 'Prévia disponível para migração individual.'}`, fichaView(p.ref.campo), { migracao: p, ref: p.ref });
  // Continuidade para revisão usa APENAS identidade exata, não a similaridade
  // textual da antiga visualização. Ausência de vínculo não prova divergência.
  for (const [ano, dados] of anosFiscais(state)) {
    const futuro = Number(ano) + 1 === state.anoCalendario ? state : state.historico?.[Number(ano) + 1];
    if (!futuro) continue;
    for (const campo of Object.keys(ESTOQUES)) for (const item of dados[campo] || []) {
      const pares = (futuro[campo] || []).filter(r => chaveContinuidade(r) === chaveContinuidade(item));
      if (pares.length === 1 && Math.abs(Number(item.situacao_atual || 0) - Number(pares[0].situacao_anterior || 0)) > .009) add(`continuidade:${ano}:${campo}:${item.id}`, 'Continuidade', `${ano} → ${Number(ano) + 1}: ${item.discriminacao || item.id}, fechamento ${item.situacao_atual} / abertura ${pares[0].situacao_anterior}. ${(futuro.origemAnoAtual || futuro.origem) === 'importacao' ? 'Declaração importada preservada.' : 'Rever abertura manual.'}`, fichaView(campo));
    }
  }
  return linhas.map(l => ({ ...l, pareceres: a.revisoes.filter(r => r.origem === l.id) }));
}
