import { useState, useMemo, useRef } from 'react';
import { useData } from '../store/DataContext';
import { bemZeradoSemMovimentacaoNoAno } from '../store/demonstrativos';
import { formatCurrency, formatCpfCnpj, GRUPOS_BENS, marcadoresDoBem, descreverOrigemDocumento, truncarComReticencias} from '../utils/formatters';
import { exportBensToXlsx } from '../utils/exportXlsx';
import BemModal from '../components/BemModal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';

// Um bem que já entrou no ano com as duas situações zeradas (31/12 do ano anterior E 31/12 deste
// ano em R$ 0,00) e nenhuma movimentação registrada NESTE ano não tem mais nada a conferir na
// declaração deste ano -- ele foi vendido/baixado num ano anterior, e o rollover só carregou o
// zero adiante. Por isso deixa de aparecer na listagem (pedido da usuária, 21/08/2026).
// O terceiro critério (sem movimentações) é o que distingue esse caso do bem que está SENDO
// baixado justamente NESTE ano: se há uma movimentação registrada neste ano (ex.: "Venda total
// (zera o valor)"), o bem continua aparecendo -- a movimentação é a prova de que a baixa aconteceu
// neste ano, e a usuária ainda precisa conferir isso na declaração corrente.

export default function BensPage({ onVoltar } = {}) {
  const { state, dispatch, addToast, confirmar } = useData();
  const { bens, anoCalendario } = state;
  const [grupoFilter, setGrupoFilter] = useState('all');
  const [search, setSearch] = useState('');
  // null = ordem original (a da importação/cadastro). Clicar num cabeçalho
  // ordena por ele; clicar de novo no mesmo inverte a direção.
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('asc'); }
  };
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBem, setEditingBem] = useState(null);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const abrirNovo = () => { setEditingBem(null); setModalOpen(true); };
  const handleNovoClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };

  const filtered = useMemo(() => {
    return bens.filter(b => {
      if (bemZeradoSemMovimentacaoNoAno(b)) return false;
      if (grupoFilter !== 'all' && b.grupo !== grupoFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (b.discriminacao || '').toLowerCase().includes(s) ||
               (b.cnpj || '').includes(s) ||
               (b.renavam || '').includes(s);
      }
      return true;
    });
  }, [bens, grupoFilter, search]);

  const SORTERS = {
    grupo: b => b.grupo || '',
    codigo: b => b.codigo_bem || '',
    discriminacao: b => (b.discriminacao || '').toLowerCase(),
    anterior: b => parseFloat(b.situacao_anterior) || 0,
    atual: b => parseFloat(b.situacao_atual) || 0,
    variacao: b => (parseFloat(b.situacao_atual) || 0) - (parseFloat(b.situacao_anterior) || 0),
  };
  const sorted = useMemo(() => {
    if (!sortField) return filtered;
    const get = SORTERS[sortField];
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va < vb) return -mult;
      if (va > vb) return mult;
      return 0;
    });
  }, [filtered, sortField, sortDir]);

  const totals = useMemo(() => {
    const anterior = filtered.reduce((s, b) => s + (parseFloat(b.situacao_anterior) || 0), 0);
    const atual = filtered.reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);
    return { anterior, atual, variacao: atual - anterior };
  }, [filtered]);

  const handleSave = (bem) => {
    if (editingBem) {
      dispatch({ type: 'UPDATE_BEM', payload: bem });
      addToast('Bem atualizado com sucesso!', 'success');
    } else {
      dispatch({ type: 'ADD_BEM', payload: bem });
      addToast('Bem cadastrado com sucesso!', 'success');
    }
    setModalOpen(false);
    setEditingBem(null);
  };

  const handleDelete = async (bem) => {
    const nome = (bem.discriminacao || 'este bem').substring(0, 60);
    const ok = await confirmar({
      titulo: 'Excluir este bem?',
      texto: `O bem "${nome}" sai do cadastro por completo, com todo o histórico de movimentações dele. Se o bem só mudou de valor (venda parcial, baixa etc.), use "Editar" em vez de excluir.\n\nEssa ação não pode ser desfeita.`,
      textoConfirmar: 'Excluir',
      perigo: true,
    });
    if (ok) {
      dispatch({ type: 'DELETE_BEM', payload: bem.id });
      addToast('Bem excluído', 'info');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          {onVoltar && <button type="button" className="btn-voltar-dashboard" onClick={onVoltar}>← Voltar ao Dashboard</button>}
          <h2>Bens e Direitos</h2>
          <p>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}{anoCalendario != null ? `, total em 31/12/${anoCalendario}` : ''}: {formatCurrency(totals.atual)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => exportBensToXlsx(filtered, anoCalendario)}>
            Exportar .xlsx
          </button>
          <button className="btn btn-primary" onClick={handleNovoClick}>
            ＋ Novo Bem
          </button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="toolbar">
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab ${grupoFilter === 'all' ? 'active' : ''}`} onClick={() => setGrupoFilter('all')}>Todos</button>
            {GRUPOS_BENS.map(g => (
              <button key={g.codigo} className={`tab ${grupoFilter === g.codigo ? 'active' : ''}`} onClick={() => setGrupoFilter(g.codigo)}>
                {g.nome}
              </button>
            ))}
          </div>
          <div className="toolbar-spacer" />
          <div className="search-box">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Buscar por descrição, CNPJ, RENAVAM..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <TabelaRedimensionavel>
          <table>
            <thead>
              <tr>
                {/* Número do item impresso na ficha de Bens e Direitos. É por
                    ele que se acha o bem no papel e no Demonstrativo da Lei
                    14.754/2023, que identifica o bem só pelo número. */}
                <th>Item</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('grupo')}>Grupo{sortField === 'grupo' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('codigo')}>Cód.{sortField === 'codigo' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ minWidth: '300px', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('discriminacao')}>Discriminação{sortField === 'discriminacao' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('anterior')}>{anoCalendario != null ? `31/12/${anoCalendario - 1}` : 'Situação anterior'}{sortField === 'anterior' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('atual')}>{anoCalendario != null ? `31/12/${anoCalendario}` : 'Situação atual'}{sortField === 'atual' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('variacao')}>Variação{sortField === 'variacao' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhum bem cadastrado. Clique em "Novo Bem" ou importe uma declaração.
                </td></tr>
              ) : sorted.map(bem => {
                const vari = (parseFloat(bem.situacao_atual) || 0) - (parseFloat(bem.situacao_anterior) || 0);
                return (
                  <tr key={bem.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{bem.numeroItem || ''}</td>
                    <td><span className={`badge badge-${GRUPOS_BENS.find(g => g.codigo === bem.grupo)?.cor || 'blue'}`}>{bem.grupo}</span></td>
                    <td>{bem.codigo_bem}</td>
                    <td style={{ maxWidth: '400px' }}>
                      <div style={{ fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={bem.discriminacao || ''}>
                        {bem.discriminacao || ''}
                      </div>
                      {bem.cnpj && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CNPJ: {formatCpfCnpj(bem.cnpj)}</div>}
                      {bem.renavam && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RENAVAM: {bem.renavam}</div>}
                      {/* De quem o bem é e onde ele está: bem do dependente não é
                          patrimônio do titular, e bem no exterior tem regra
                          própria. Ver marcadoresDoBem. */}
                      {descreverOrigemDocumento(bem) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(bem)}</div>
                      )}
                      {marcadoresDoBem(bem).map(marca => (
                        <span
                          key={marca.tipo}
                          className={`badge ${marca.tipo === 'exterior' ? 'badge-orange' : 'badge-blue'}`}
                          style={{ marginTop: '4px', marginRight: '4px' }}
                        >
                          {marca.texto}
                        </span>
                      ))}
                    </td>
                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(bem.situacao_anterior)}</td>
                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(bem.situacao_atual)}</td>
                    <td style={{ textAlign: 'right' }} className={`currency ${vari >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(vari)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setEditingBem(bem); setModalOpen(true); }}>Editar</button>
                        <button className="btn btn-sm btn-danger" title="Excluir este bem por completo" onClick={() => handleDelete(bem)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={3} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAIS</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totals.anterior)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totals.atual)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className={`currency ${totals.variacao >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(totals.variacao)}</td>
                  <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </TabelaRedimensionavel>
      </div>

      <BemModal
        open={modalOpen}
        bem={editingBem}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditingBem(null); }}
      />
      <AnoCalendarioModal
        open={anoModalOpen}
        onClose={() => setAnoModalOpen(false)}
        onConfirm={() => { setAnoModalOpen(false); pendingActionRef.current?.(); pendingActionRef.current = null; }}
      />
    </>
  );
}