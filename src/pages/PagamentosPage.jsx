import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';

const FORM_VAZIO = { codigo: '21', nome_beneficiario: '', cpf_cnpj: '', valor_pago: '', parcela_nao_dedutivel: '', descricao: '' };

export default function PagamentosPage() {
  const { state, dispatch, addToast } = useData();
  const { pagamentos } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const abrirEdicao = (p) => {
    setEditingId(p.id);
    setForm({ codigo: p.codigo, nome_beneficiario: p.nome_beneficiario || '', cpf_cnpj: p.cpf_cnpj || '', valor_pago: p.valor_pago, parcela_nao_dedutivel: p.parcela_nao_dedutivel || '', descricao: p.descricao || '' });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const payload = { ...form, valor_pago: parseFloat(form.valor_pago) || 0, parcela_nao_dedutivel: parseFloat(form.parcela_nao_dedutivel) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_PAGAMENTO', payload: { ...payload, id: editingId } });
      addToast('Pagamento atualizado!', 'success');
    } else {
      dispatch({ type: 'ADD_PAGAMENTO', payload });
      addToast('Pagamento cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = (p) => {
    if (confirm(`Excluir o pagamento para "${p.nome_beneficiario || 'este beneficiário'}" (${formatCurrency(p.valor_pago)})?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_PAGAMENTO', payload: p.id });
      addToast('Pagamento excluído', 'info');
    }
  };

  const totalPago = pagamentos.reduce((s, p) => s + (parseFloat(p.valor_pago) || 0), 0);
  const totalNaoDedutivel = pagamentos.reduce((s, p) => s + (parseFloat(p.parcela_nao_dedutivel) || 0), 0);

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Pagamentos Efetuados</h2><p>{pagamentos.length} registros no ano-calendário {state.anoCalendario}, total {formatCurrency(totalPago)}</p></div>
        <div className="page-header-actions"><button className="btn btn-primary" onClick={abrirNovo}>＋ Novo Pagamento</button></div>
      </div>
      <div className="page-body animate-in">
        <div className="table-container">
          <table>
            <thead><tr><th>Cód.</th><th>Nome Beneficiário</th><th>CPF/CNPJ</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th style={{ textAlign: 'right' }}>Parcela Não Dedutível</th><th>Descrição</th><th>Ações</th></tr></thead>
            <tbody>
              {pagamentos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum pagamento cadastrado.</td></tr>
              ) : pagamentos.map(p => (
                <tr key={p.id}>
                  <td><span className="badge badge-orange">{p.codigo}</span></td>
                  <td>{(p.nome_beneficiario || '').substring(0, 40)}</td>
                  <td>{p.cpf_cnpj}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.valor_pago)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.parcela_nao_dedutivel)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{(p.descricao || '').substring(0, 40)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(p)}>✏️ Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>🗑️ Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {pagamentos.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={3} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAIS</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalPago)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(totalNaoDedutivel)}</td>
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
            <div className="modal-header"><h3>{editingId ? 'Editar Pagamento' : 'Novo Pagamento'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Código</label><input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} placeholder="10, 21, 26, 36, 76..." /></div>
                  <div className="form-group"><label>CPF/CNPJ Beneficiário</label><input className="form-control" value={form.cpf_cnpj} onChange={e => upd('cpf_cnpj', e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Nome do Beneficiário</label><input className="form-control" value={form.nome_beneficiario} onChange={e => upd('nome_beneficiario', e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group"><label>Valor Pago</label><input className="form-control" type="number" step="0.01" value={form.valor_pago} onChange={e => upd('valor_pago', e.target.value)} /></div>
                  <div className="form-group"><label>Parcela Não Dedutível</label><input className="form-control" type="number" step="0.01" value={form.parcela_nao_dedutivel} onChange={e => upd('parcela_nao_dedutivel', e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Descrição</label><textarea className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">💾 Salvar</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
