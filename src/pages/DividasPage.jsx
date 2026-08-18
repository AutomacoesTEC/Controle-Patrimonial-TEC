import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';

const FORM_VAZIO = { codigo: '13', discriminacao: '', situacao_anterior: '', situacao_atual: '', valor_pago: '' };

export default function DividasPage() {
  const { state, dispatch, addToast } = useData();
  const { dividas, anoCalendario } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const abrirEdicao = (d) => {
    setEditingId(d.id);
    setForm({ codigo: d.codigo, discriminacao: d.discriminacao || '', situacao_anterior: d.situacao_anterior, situacao_atual: d.situacao_atual, valor_pago: d.valor_pago || '' });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form, situacao_anterior: parseFloat(form.situacao_anterior) || 0, situacao_atual: parseFloat(form.situacao_atual) || 0, valor_pago: parseFloat(form.valor_pago) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_DIVIDA', payload: { ...payload, id: editingId } });
      addToast('Dívida atualizada!', 'success');
    } else {
      dispatch({ type: 'ADD_DIVIDA', payload });
      addToast('Dívida cadastrada!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = (d) => {
    const nome = (d.discriminacao || 'esta dívida').substring(0, 60);
    if (confirm(`Excluir a dívida "${nome}"?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_DIVIDA', payload: d.id });
      addToast('Dívida excluída', 'info');
    }
  };

  const totalAnterior = dividas.reduce((s, d) => s + (parseFloat(d.situacao_anterior) || 0), 0);
  const totalAtual = dividas.reduce((s, d) => s + (parseFloat(d.situacao_atual) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dívidas e Ônus Reais</h2>
          <p>{dividas.length} itens, total em 31/12/{anoCalendario}: {formatCurrency(totalAtual)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={abrirNovo}>＋ Nova Dívida</button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="table-container">
          <table>
            <thead><tr><th>Cód.</th><th style={{ minWidth: '300px' }}>Discriminação</th><th style={{ textAlign: 'right' }}>31/12/{anoCalendario - 1}</th><th style={{ textAlign: 'right' }}>31/12/{anoCalendario}</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th>Ações</th></tr></thead>
            <tbody>
              {dividas.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma dívida cadastrada.</td></tr>
              ) : dividas.map(d => (
                <tr key={d.id}>
                  <td><span className="badge badge-red">{d.codigo}</span></td>
                  <td>{(d.discriminacao || '').substring(0, 100)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.situacao_anterior)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.situacao_atual)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.valor_pago)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(d)}>✏️ Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d)}>🗑️ Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {dividas.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={2} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAIS</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalAnterior)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalAtual)}</td>
                  <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                  <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>{editingId ? 'Editar Dívida' : 'Nova Dívida'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Código</label><input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} placeholder="Ex: 11, 12, 13" /></div>
                </div>
                <div className="form-group"><label>Discriminação</label><textarea className="form-control" value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Situação 31/12 Anterior</label><input className="form-control" type="number" step="0.01" value={form.situacao_anterior} onChange={e => upd('situacao_anterior', e.target.value)} /></div>
                  <div className="form-group"><label>Situação 31/12 Atual</label><input className="form-control" type="number" step="0.01" value={form.situacao_atual} onChange={e => upd('situacao_atual', e.target.value)} /></div>
                  <div className="form-group"><label>Valor Pago no Ano</label><input className="form-control" type="number" step="0.01" value={form.valor_pago} onChange={e => upd('valor_pago', e.target.value)} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">💾 Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
