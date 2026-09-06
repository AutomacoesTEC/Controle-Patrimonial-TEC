// Vínculos são enriquecimentos locais, fora do documento importado. Referência
// resolve por chave de importação exata ou ID exato; nunca por texto/valor.
import { pessoaDoRegistro } from './titularidade';
export const FICHAS_VINCULAVEIS = ['bens', 'dividas', 'rendimentos', 'pagamentos', 'pagamentosDiversos', 'apuracaoGanhoCapital', 'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial', 'lancamentosRurais', 'bensRurais', 'dividasRurais', 'rendaVariavelMensalOficial', 'rendaVariavelMensalManual', 'fiiFiagroMensalOficial', 'fiiFiagroMensalManual'];
export const anosFiscais = state => Object.entries({ ...state.historico, ...(state.anoCalendario != null ? { [state.anoCalendario]: state } : {}) });
export const chaveReferencia = ref => JSON.stringify([Number(ref.ano), ref.campo, ref.chaveMensal || ref.chaveImportacao || ref.id, ref.movimentacaoId ?? null]);
const identidadeMensal = r => `${r.mes}|${r.titular ? 't' : 'd'}|${String(r.cpfDependente || '').replace(/\D/g, '')}`;
const mesmoItem = (r, ref) => ref.chaveMensal ? identidadeMensal(r) === ref.chaveMensal : ref.chaveImportacao ? r.chaveImportacao === ref.chaveImportacao : r.id === ref.id;
export function resolverReferencia(state, ref) {
  if (!ref || !FICHAS_VINCULAVEIS.includes(ref.campo)) return null;
  const ano = Number(ref.ano) === state.anoCalendario ? state : state.historico?.[ref.ano];
  const candidatos = (ano?.[ref.campo] || []).filter(r => mesmoItem(r, ref));
  if (candidatos.length !== 1) return null;
  const item = candidatos[0];
  if (ref.movimentacaoId != null) {
    const movimentos = (item.movimentacoes || []).filter(m => m.id === ref.movimentacaoId);
    return movimentos.length === 1 ? { item: movimentos[0], pai: item, ano } : null;
  }
  return { item, ano };
}
export function referenciasFiscais(state) {
  return anosFiscais(state).flatMap(([ano, dados]) => FICHAS_VINCULAVEIS.flatMap(campo => (dados[campo] || []).flatMap(item => {
    const mensal = /Mensal/.test(campo) && item.mes != null;
    if (item.id == null && !item.chaveImportacao && !mensal) return [];
    const ref = { ano: Number(ano), campo, id: item.id, ...(mensal ? { chaveMensal: identidadeMensal(item) } : item.chaveImportacao ? { chaveImportacao: item.chaveImportacao } : {}) };
    const nome = item.discriminacao || item.descricao || item.nome_fonte || item.nome_beneficiario || item.bem || (mensal ? `Mês ${item.mes} / ${item.titular ? 'Titular' : item.cpfDependente || 'Titularidade não identificada'}` : String(item.id));
    return [{ ref, rotulo: `${ano} / ${campo} / ${item.codigo_bem || item.codigo || item.tipo || ''} / ${nome}`, item }, ...(item.movimentacoes || []).filter(m => m.id != null).map(m => ({ ref: { ...ref, movimentacaoId: m.id }, item: m, rotulo: `${ano} / ${campo} / ${nome} / ${m.tipo} ${m.data}` }))];
  })));
}
export function vincularOperacao(state, p, meta) {
  const a = state.acompanhamento;
  const operacao = a?.operacoes.find(o => o.id === p.operacaoId);
  if (!operacao) throw new Error('Operação não encontrada.');
  const alvo = resolverReferencia(state, p.ref);
  if (!alvo) throw new Error('Referência inexistente ou ambígua. Selecione novamente após a importação.');
  const pessoa = pessoaDoRegistro(alvo.pai || alvo.item, alvo.ano.dependentes || []);
  if (!['nao-informada', 'dependente-sem-identificacao'].includes(pessoa) && pessoa !== operacao.pessoa) throw new Error('As titularidades da operação e da ficha não coincidem.');
  const chave = chaveReferencia(p.ref);
  if (a.operacoes.some(o => (o.vinculos || []).some(v => chaveReferencia(v.ref) === chave))) throw new Error('Registro já vinculado. Remova o vínculo anterior antes de trocar.');
  const vinculo = { id: meta.id, ref: { ...p.ref }, registradoEm: meta.agora, origem: 'vinculo_local', papel: p.ref.movimentacaoId != null ? 'movimento' : p.ref.campo };
  return { ...state, acompanhamento: { ...a, operacoes: a.operacoes.map(o => o.id === operacao.id ? { ...o, vinculos: [...(o.vinculos || []), vinculo] } : o), eventos: [...a.eventos, { id: meta.id, comando: 'vincular', registradoEm: meta.agora, dados: p }] } };
}
export function desvincularOperacao(state, p, meta) {
  if (!p.motivo?.trim()) throw new Error('Informe o motivo da remoção do vínculo.');
  const a = state.acompanhamento;
  if (!a?.operacoes.some(o => o.id === p.operacaoId && o.vinculos.some(v => v.id === p.vinculoId))) throw new Error('Vínculo não encontrado.');
  return { ...state, acompanhamento: { ...a, operacoes: a.operacoes.map(o => o.id === p.operacaoId ? { ...o, vinculos: o.vinculos.filter(v => v.id !== p.vinculoId) } : o), eventos: [...a.eventos, { id: meta.id, comando: 'desvincular', registradoEm: meta.agora, dados: p }] } };
}
export function aplicarVinculosNoAno(dados, acompanhamento, ano) {
  if (!dados || !acompanhamento?.operacoes?.some(o => o.vinculos?.length)) return dados;
  let next = dados;
  for (const o of acompanhamento.operacoes) for (const v of o.vinculos || []) {
    if (Number(v.ref.ano) !== Number(ano)) continue;
    const lista = next[v.ref.campo] || [];
    if (lista.filter(r => mesmoItem(r, v.ref)).length !== 1) continue;
    next = { ...next, [v.ref.campo]: lista.map(r => !mesmoItem(r, v.ref) ? r : v.ref.movimentacaoId != null
      ? { ...r, movimentacoes: (r.movimentacoes || []).map(m => m.id === v.ref.movimentacaoId ? { ...m, operacaoId: o.id } : m) }
      : { ...r, operacaoId: o.id }) };
  }
  return next;
}
