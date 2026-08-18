import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, MOVIMENTACAO_DIVIDA_TIPOS } from '../utils/formatters';
import Modal from '../components/Modal';
import MovimentacaoBemForm from '../components/MovimentacaoBemForm';

const FORM_VAZIO = { codigo: '13', discriminacao: '', situacao_anterior: '', situacao_atual: '', valor_pago: '' };

export default function DividasPage() {
  const { state, dispatch, addToast } = useData();
  const { dividas, anoCalendario } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // O saldo atual muda por movimentação, não pelo formulário — sempre ler do
  // estado vivo (mesmo motivo do BemModal), senão salvar depois de uma
  // amortização registrada no modal desfaria o efeito dela.
  const liveDivida = editingId ? state.dividas.find(d => d.id === editingId) : null;

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
      // Em edição, saldo atual e movimentações vêm do estado vivo: mudança de
      // saldo se faz por movimentação registrada (abaixo no modal), não
      // editando o número direto.
      dispatch({ type: 'UPDATE_DIVIDA', payload: { ...payload, id: editingId, situacao_anterior: liveDivida.situacao_anterior, situacao_atual: liveDivida.situacao_atual, movimentacoes: liveDivida.movimentacoes } });
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
          <p>{dividas.length} itens{anoCalendario != null ? `, total em 31/12/${anoCalendario}` : ''}: {formatCurrency(totalAtual)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={abrirNovo}>＋ Nova Dívida</button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="table-container">
          <table>
            <thead><tr><th>Cód.</th><th style={{ minWidth: '300px' }}>Discriminação</th><th style={{ textAlign: 'right' }}>{anoCalendario != null ? `31/12/${anoCalendario - 1}` : 'Saldo anterior'}</th><th style={{ textAlign: 'right' }}>{anoCalendario != null ? `31/12/${anoCalendario}` : 'Saldo atual'}</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th>Ações</th></tr></thead>
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
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(d)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d)}>Excluir</button>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Dívida' : 'Nova Dívida'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label>Código</label><input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} placeholder="Ex: 11, 12, 13" /></div>
                </div>
                <div className="form-group"><label>Discriminação</label><textarea className="form-control" value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)} /></div>
                {editingId && liveDivida ? (
                  <>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Saldo em 31/12 Anterior (não editável aqui)</label>
                        <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveDivida.situacao_anterior)}</div>
                      </div>
                      <div className="form-group">
                        <label>Saldo atual (muda por movimentação)</label>
                        <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveDivida.situacao_atual)}</div>
                      </div>
                      <div className="form-group"><label>Valor Pago no Ano</label><input className="form-control" type="number" step="0.01" value={form.valor_pago} onChange={e => upd('valor_pago', e.target.value)} /></div>
                    </div>
                    <MovimentacaoBemForm
                      bem={liveDivida}
                      actionType="REGISTRAR_MOVIMENTACAO_DIVIDA"
                      tipos={MOVIMENTACAO_DIVIDA_TIPOS}
                      tipoInicial="amortizacao"
                      textoIntro="Contratou, amortizou, quitou? Registre aqui com a data: o saldo devedor é recalculado a partir da movimentação, e o demonstrativo consegue reconstruir quanto se devia em qualquer data do ano."
                    />
                  </>
                ) : (
                <div className="form-row">
                  <div className="form-group"><label>Situação 31/12 Anterior</label><input className="form-control" type="number" step="0.01" value={form.situacao_anterior} onChange={e => upd('situacao_anterior', e.target.value)} /></div>
                  <div className="form-group"><label>Situação 31/12 Atual</label><input className="form-control" type="number" step="0.01" value={form.situacao_atual} onChange={e => upd('situacao_atual', e.target.value)} /></div>
                  <div className="form-group"><label>Valor Pago no Ano</label><input className="form-control" type="number" step="0.01" value={form.valor_pago} onChange={e => upd('valor_pago', e.target.value)} /></div>
                </div>
                )}
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
    </>
  );
}
