import { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, GRUPOS_BENS } from '../utils/formatters';
import { exportBensToXlsx } from '../utils/exportXlsx';
import BemModal from '../components/BemModal';

export default function BensPage() {
  const { state, dispatch, addToast } = useData();
  const { bens, anoCalendario } = state;
  const [grupoFilter, setGrupoFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBem, setEditingBem] = useState(null);

  const filtered = useMemo(() => {
    return bens.filter(b => {
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

  const handleDelete = (bem) => {
    const nome = (bem.discriminacao || 'este bem').substring(0, 60);
    if (confirm(`EXCLUIR "${nome}"?\n\nEsse bem sai do cadastro por completo, com todo o histórico de movimentações dele. Se o bem só mudou de valor (venda parcial, baixa etc.), use "Editar" em vez de excluir. Essa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_BEM', payload: bem.id });
      addToast('Bem excluído', 'info');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Bens e Direitos</h2>
          <p>{filtered.length} itens, total em 31/12/{anoCalendario}: {formatCurrency(totals.atual)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => exportBensToXlsx(filtered, anoCalendario)}>
            Exportar .xlsx
          </button>
          <button className="btn btn-primary" onClick={() => { setEditingBem(null); setModalOpen(true); }}>
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

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Grupo</th>
                <th>Cód.</th>
                <th style={{ minWidth: '300px' }}>Discriminação</th>
                <th style={{ textAlign: 'right' }}>31/12/{anoCalendario - 1}</th>
                <th style={{ textAlign: 'right' }}>31/12/{anoCalendario}</th>
                <th style={{ textAlign: 'right' }}>Variação</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhum bem cadastrado. Clique em "Novo Bem" ou importe uma declaração.
                </td></tr>
              ) : filtered.map(bem => {
                const vari = (parseFloat(bem.situacao_atual) || 0) - (parseFloat(bem.situacao_anterior) || 0);
                return (
                  <tr key={bem.id}>
                    <td><span className={`badge badge-${GRUPOS_BENS.find(g => g.codigo === bem.grupo)?.cor || 'blue'}`}>{bem.grupo}</span></td>
                    <td>{bem.codigo_bem}</td>
                    <td style={{ maxWidth: '400px' }}>
                      <div style={{ fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(bem.discriminacao || '').substring(0, 80)}
                      </div>
                      {bem.cnpj && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CNPJ: {formatCpfCnpj(bem.cnpj)}</div>}
                      {bem.renavam && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RENAVAM: {bem.renavam}</div>}
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
        </div>
      </div>

      <BemModal
        open={modalOpen}
        bem={editingBem}
        onSave={handleSave}
        onClose={() => { setModalOpen(false); setEditingBem(null); }}
      />
    </>
  );
}