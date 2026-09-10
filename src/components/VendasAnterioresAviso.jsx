import { referenciasFiscais, chaveReferencia } from '../store/vinculosOperacoes';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function VendasAnterioresAviso({ pendencias, state, ate, pessoa, onNavigate }) {
  const anteriores = pendencias.filter(p => p.vendaForaDoPeriodo);
  if (!anteriores.length) return null;
  const referencias = referenciasFiscais(state);
  return <details><summary>{anteriores.length} venda(s) de ano anterior: conferir bem e recebimentos</summary>
    <p>A baixa patrimonial não comprova recebimento. Confira o registro e vincule a operação para acompanhar parcelas e baixas financeiras.</p>
    {anteriores.map((p, i) => {
      const candidatos = referencias.filter(r => r.ref.campo === 'bens' && r.ref.ano === p.ano && r.item.id === p.id && r.ref.movimentacaoId == null);
      const referencia = candidatos.length === 1 ? candidatos[0] : null;
      const operacoes = referencia ? (state.acompanhamento?.operacoes || []).filter(o => (o.vinculos || []).some(v => chaveReferencia({ ...v.ref, movimentacaoId: undefined }) === chaveReferencia(referencia.ref))) : [];
      const abrir = operacao => onNavigate?.('acompanhamento', { aba: 'operacoes', mes: ate.slice(0, 7), pessoa: operacao?.pessoa || pessoa, operacao: operacao?.id || '', referenciaOrigem: referencia?.ref });
      return <section className="venda-anterior-item" key={p.ano + ':' + p.id + ':' + i}><strong>{p.discriminacao || 'Bem sem descrição'}</strong><p>Ano do cadastro: {p.ano}. Venda informada em {formatDate(p.vendaForaDoPeriodo)}. Redução patrimonial no período: {formatCurrency(p.reducao)}.</p>
        {operacoes.length ? operacoes.map(o => <button type="button" key={o.id} className="btn btn-secondary btn-sm" onClick={() => abrir(o)}>Abrir operação: {o.descricao}</button>) : referencia ? <><p>Este registro ainda não está vinculado a uma operação financeira.</p><button type="button" className="btn btn-secondary btn-sm" onClick={() => abrir(null)}>Vincular este bem a uma operação</button></> : <p>Referência não encontrada ou ambígua. Confira o cadastro antes de vincular.</p>}
      </section>;
    })}
  </details>;
}
