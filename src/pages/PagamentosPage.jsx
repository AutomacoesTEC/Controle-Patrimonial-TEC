import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, formatDate, CODIGOS_PAGAMENTO, describePagamentoCodigo, descreverTitularidade, TITULARIDADE_PAGAMENTO } from '../utils/formatters';
import Modal from '../components/Modal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MoneyInput from '../components/MoneyInput';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';

// titularidade nasce vazia de propósito: o cadastro manual não deve assumir
// que a despesa é do titular. Titular, dependente e alimentando têm regras de
// dedução diferentes, e o campo em branco é honesto ("não informado").
const FORM_VAZIO = { codigo: '21', nome_beneficiario: '', cpf_cnpj: '', valor_pago: '', parcela_nao_dedutivel: '', descricao: '', titularidade: '', titularidadeNome: '', data: new Date().toISOString().slice(0, 10) };

export default function PagamentosPage() {
  const { state, dispatch, addToast, garantirAnoCadastro } = useData();
  const { pagamentos } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [anoCadastro, setAnoCadastro] = useState(state.anoCalendario);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const abrirNovo = (ano = state.anoCalendario) => { setEditingId(null); setForm(FORM_VAZIO); setAnoCadastro(ano); setModalOpen(true); };
  const handleNovoClick = () => {
    if (state.anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (p) => {
    setEditingId(p.id);
    setForm({ codigo: p.codigo, nome_beneficiario: p.nome_beneficiario || '', cpf_cnpj: p.cpf_cnpj || '', valor_pago: p.valor_pago, parcela_nao_dedutivel: p.parcela_nao_dedutivel || '', descricao: p.descricao || '', titularidade: p.titularidade || '', titularidadeNome: p.titularidadeNome || '', data: p.data || new Date().toISOString().slice(0, 10) });
    setModalOpen(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código', form.codigo], ['Nome do Beneficiário', form.nome_beneficiario]])
      || primeiroValorZerado([['Valor Pago', form.valor_pago]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, valor_pago: parseFloat(form.valor_pago) || 0, parcela_nao_dedutivel: parseFloat(form.parcela_nao_dedutivel) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_PAGAMENTO', payload: { ...payload, id: editingId } });
      addToast('Pagamento atualizado!', 'success');
    } else {
      if (!garantirAnoCadastro(anoCadastro)) return;
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

  const handleExport = () => exportListaToXlsx(
    pagamentos,
    [
      ['Código', p => p.codigo || ''],
      ['Descrição do Código', p => describePagamentoCodigo(p.codigo) || ''],
      ['Data', p => formatDate(p.data)],
      ['Nome Beneficiário', p => p.nome_beneficiario || ''],
      ['Titularidade', p => descreverTitularidade(p)],
      ['CPF/CNPJ', p => formatCpfCnpj(p.cpf_cnpj)],
      ['Valor Pago', p => p.valor_pago || 0],
      ['Parcela Não Dedutível', p => p.parcela_nao_dedutivel || 0],
      ['Descrição', p => p.descricao || ''],
    ],
    'Pagamentos', 'pagamentos_efetuados', state.anoCalendario
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Pagamentos Efetuados</h2><p>{pagamentos.length} registros{state.anoCalendario != null ? ` no ano-calendário ${state.anoCalendario}` : ''}, total {formatCurrency(totalPago)}</p></div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Pagamento</button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="table-container">
          <table>
            <thead><tr><th>Cód.</th><th>Data</th><th>Nome Beneficiário</th><th>Titularidade</th><th>CPF/CNPJ</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th style={{ textAlign: 'right' }}>Parcela Não Dedutível</th><th>Descrição</th><th>Ações</th></tr></thead>
            <tbody>
              {pagamentos.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum pagamento cadastrado.</td></tr>
              ) : pagamentos.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge-orange">{p.codigo}</span>
                    {describePagamentoCodigo(p.codigo) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{describePagamentoCodigo(p.codigo)}</div>
                    )}
                  </td>
                  <td>{formatDate(p.data)}</td>
                  <td>{(p.nome_beneficiario || '').substring(0, 40)}</td>
                  <td style={{ fontSize: '12px' }}>
                    {descreverTitularidade(p) || <span style={{ color: 'var(--text-muted)' }}>Não informada</span>}
                  </td>
                  <td>{formatCpfCnpj(p.cpf_cnpj)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.valor_pago)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.parcela_nao_dedutivel)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{(p.descricao || '').substring(0, 40)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(p)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {pagamentos.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={4} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAIS</td>
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
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Pagamento' : 'Novo Pagamento'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {!editingId && (
                  <div className="form-row">
                    <div className="form-group"><label>Ano-calendário</label><input className="form-control" type="number" value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))} /></div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Código</label>
                    <select className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)}>
                      {CODIGOS_PAGAMENTO.map(c => <option key={c.codigo} value={c.codigo}>{c.codigo} - {c.nome}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>CPF/CNPJ Beneficiário</label><input className="form-control" value={form.cpf_cnpj} onChange={e => upd('cpf_cnpj', e.target.value)} /></div>
                </div>
                <div className="form-group"><label>Nome do Beneficiário</label><input className="form-control" value={form.nome_beneficiario} onChange={e => upd('nome_beneficiario', e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Titularidade</label>
                    <select className="form-control" value={form.titularidade} onChange={e => upd('titularidade', e.target.value)}>
                      <option value="">Não informada</option>
                      {Object.entries(TITULARIDADE_PAGAMENTO).map(([valor, rotulo]) => (
                        <option key={valor} value={valor}>{rotulo}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nome do dependente ou alimentando</label>
                    <input
                      className="form-control"
                      value={form.titularidadeNome}
                      onChange={e => upd('titularidadeNome', e.target.value)}
                      disabled={form.titularidade !== 'dependente' && form.titularidade !== 'alimentando'}
                      placeholder={form.titularidade === 'dependente' || form.titularidade === 'alimentando' ? '' : 'Só para dependente ou alimentando'}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Data</label><input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} /></div>
                  <div className="form-group"><label>Valor Pago</label><MoneyInput value={form.valor_pago} onChange={v => upd('valor_pago', v)} /></div>
                  <div className="form-group"><label>Parcela Não Dedutível</label><MoneyInput value={form.parcela_nao_dedutivel} onChange={v => upd('parcela_nao_dedutivel', v)} /></div>
                </div>
                <div className="form-group"><label>Descrição</label><textarea className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
      <AnoCalendarioModal
        open={anoModalOpen}
        onClose={() => setAnoModalOpen(false)}
        onConfirm={anoConfirmado => { setAnoModalOpen(false); pendingActionRef.current?.(anoConfirmado); pendingActionRef.current = null; }}
      />
    </>
  );
}
