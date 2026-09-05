import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import Modal from '../components/Modal';
import MoneyInput from '../components/MoneyInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';
import EstadoVazio from '../components/EstadoVazio';

// Data começa vazia: o ano-calendário do lançamento sai dela, e pré-preencher
// "hoje" forçaria trocar de ano ao salvar quando o exercício de trabalho é
// outro. Enquanto vazia, o lançamento entra no ano-calendário ativo.
const FORM_VAZIO = { descricao: '', categoria: '', valor: '', data: '' };

export default function PagamentosDiversosPage() {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const { pagamentosDiversos } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // O ano-calendário do lançamento é o ANO DA DATA informada — a usuária pediu
  // (03/09/2026) para tirar o campo "Ano-calendário" separado, que só duplicava
  // o que a data já diz e podia divergir dela. Lê os 4 primeiros caracteres do
  // <input type="date"> (sempre YYYY-MM-DD) em vez de new Date().getFullYear(),
  // que num fuso negativo joga 01/01 para o ano anterior.
  const anoCadastro = /^\d{4}-\d{2}-\d{2}$/.test(form.data || '') ? Number(form.data.slice(0, 4)) : state.anoCalendario;

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const handleNovoClick = () => {
    abrirNovo();
  };
  const abrirEdicao = (p) => {
    setEditingId(p.id);
    setForm({ descricao: p.descricao || '', categoria: p.categoria || '', valor: p.valor, data: p.data || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Descrição', form.descricao]])
      || primeiroValorZerado([['Valor', form.valor]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, valor: parseFloat(form.valor) || 0 };
    if (editingId) {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'UPDATE_PAGAMENTO_DIVERSO', payload: { ...payload, id: editingId } });
      addToast('Despesa atualizada!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_PAGAMENTO_DIVERSO', payload });
      addToast('Despesa cadastrada!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = async (p) => {
    if (await confirmar({ titulo: 'Excluir esta despesa?', textoConfirmar: 'Excluir', perigo: true, texto: `A despesa "${p.descricao || 'sem descrição'}" (${formatCurrency(p.valor)}) será removida.\n\nEssa ação não pode ser desfeita.` })) {
      dispatch({ type: 'DELETE_PAGAMENTO_DIVERSO', payload: p.id });
      addToast('Despesa excluída', 'info');
    }
  };

  const total = pagamentosDiversos.reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

  const handleExport = () => exportListaToXlsx(
    pagamentosDiversos,
    [
      ['Descrição', p => p.descricao || ''],
      ['Categoria', p => p.categoria || ''],
      ['Data', p => formatDate(p.data)],
      ['Valor', p => p.valor || 0],
    ],
    'Despesas Gerais', 'despesas_gerais', state.anoCalendario
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Despesas Gerais</h2>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Nova Despesa</button>
        </div>
      </div>
      <div className="page-body animate-in altura-tabelas-adaptativa">
        <TabelaRedimensionavel persistKey="pagamentos-diversos">
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Data</th><th style={{ textAlign: 'right' }}>Valor</th><th>Ações</th></tr></thead>
            <tbody>
              {pagamentosDiversos.length === 0 ? (
                <EstadoVazio colSpan={5} titulo="Nenhuma despesa cadastrada" contexto="Registre a primeira despesa geral para incluí-la na conciliação de caixa." acao="Cadastrar primeira despesa" onAcao={handleNovoClick} />
              ) : pagamentosDiversos.map(p => (
                <tr key={p.id}>
                  <td>{p.descricao}</td>
                  <td>{p.categoria}</td>
                  <td>{p.data ? new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR') : ''}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.valor)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(p)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {pagamentosDiversos.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={3} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(total)}</td>
                  <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </TabelaRedimensionavel>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group"><label>Descrição</label><input className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} placeholder="Ex: Cartão de crédito Nubank" /></div>
                <div className="form-row">
                  <div className="form-group"><label>Categoria</label><input className="form-control" value={form.categoria} onChange={e => upd('categoria', e.target.value)} placeholder="Ex: Cartão, Seguro, IPVA, Condomínio..." /></div>
                  <div className="form-group">
                    <label>Data</label>
                    <input className="form-control" type="date" required={!editingId || !!form.data} value={form.data} onChange={e => upd('data', e.target.value)} />
                  </div>
                  <div className="form-group"><label>Valor</label><MoneyInput value={form.valor} onChange={v => upd('valor', v)} /></div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">Salvar</button></div>
            </form>
      </Modal>
    </>
  );
}
