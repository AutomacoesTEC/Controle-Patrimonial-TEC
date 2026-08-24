import { useState, useEffect, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCpfCnpj, formatDate } from '../utils/formatters';
import Modal from '../components/Modal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import DateInput from '../components/DateInput';
import { primeiroCampoVazio, mensagemObrigatorio } from '../utils/validacao';

const FORM_DEPENDENTE_VAZIO = { nome: '', cpf: '', dataNascimento: '', parentesco: '' };

// Titular e dependentes são por ano-calendário (como o resto da
// declaração): mudar de ano na sidebar troca de titular/dependentes junto
// (ver snapshotYear/blankYear no reducer). Import continua sendo o jeito
// mais rápido de preencher isso, mas nem toda situação começa por um
// arquivo — daí esta tela para cadastrar ou corrigir à mão.
export default function TitularPage() {
  const { state, dispatch, addToast, garantirAnoCadastro } = useData();
  const { contribuinte, dependentes, anoCalendario } = state;

  const [formTitular, setFormTitular] = useState({ nome: contribuinte?.nome || '', cpf: contribuinte?.cpf || '' });
  useEffect(() => {
    setFormTitular({ nome: contribuinte?.nome || '', cpf: contribuinte?.cpf || '' });
  }, [contribuinte, anoCalendario]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formDependente, setFormDependente] = useState(FORM_DEPENDENTE_VAZIO);
  const [anoCadastro, setAnoCadastro] = useState(anoCalendario);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const updDependente = (f, v) => setFormDependente(p => ({ ...p, [f]: v }));

  const salvarTitular = (ano = anoCalendario) => {
    // Sem esta guarda, salvar o formulário vazio disparava SET_CONTRIBUINTE
    // com nome e CPF em branco e APAGAVA o titular que a importação tinha
    // preenchido.
    const falta = primeiroCampoVazio([['Nome Completo', formTitular.nome]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    if (!garantirAnoCadastro(ano)) return;
    dispatch({ type: 'SET_CONTRIBUINTE', payload: { nome: formTitular.nome.trim(), cpf: formTitular.cpf.replace(/\D/g, '') } });
    addToast('Titular atualizado!', 'success');
  };
  const handleSalvarTitular = (e) => {
    e.preventDefault();
    if (anoCalendario == null) { pendingActionRef.current = salvarTitular; setAnoModalOpen(true); return; }
    salvarTitular();
  };

  const abrirNovoDependente = (ano = anoCalendario) => { setEditingId(null); setFormDependente(FORM_DEPENDENTE_VAZIO); setAnoCadastro(ano); setModalOpen(true); };
  const handleNovoDependenteClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovoDependente; setAnoModalOpen(true); return; }
    abrirNovoDependente();
  };
  const abrirEdicaoDependente = (d) => {
    setEditingId(d.id);
    setFormDependente({ nome: d.nome || '', cpf: d.cpf || '', dataNascimento: d.dataNascimento || '', parentesco: d.parentesco || '' });
    setModalOpen(true);
  };

  const handleSalvarDependente = (e) => {
    e.preventDefault();
    // Achado na auditoria de 21/08/2026: sem validação, o dependente entrava
    // com nome vazio e o Histórico registrava "Cadastrou dependente: (sem
    // descrição)".
    const falta = primeiroCampoVazio([['Nome Completo', formDependente.nome]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    if (editingId) {
      dispatch({ type: 'UPDATE_DEPENDENTE', payload: { ...formDependente, id: editingId } });
      addToast('Dependente atualizado!', 'success');
    } else {
      if (!garantirAnoCadastro(anoCadastro)) return;
      dispatch({ type: 'ADD_DEPENDENTE', payload: formDependente });
      addToast('Dependente cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleExcluirDependente = (d) => {
    if (confirm(`Excluir o dependente "${d.nome || 'sem nome'}"?\n\nEssa ação não pode ser desfeita.`)) {
      dispatch({ type: 'DELETE_DEPENDENTE', payload: d.id });
      addToast('Dependente excluído', 'info');
    }
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Titular e Dependentes</h2>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Titular</h3></div>
          <form onSubmit={handleSalvarTitular}>
            <div className="form-row" style={{ padding: '0 16px' }}>
              <div className="form-group">
                <label>Nome Completo</label>
                <input className="form-control" value={formTitular.nome} onChange={e => setFormTitular(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do titular" />
              </div>
              <div className="form-group">
                <label>CPF</label>
                <input className="form-control" value={formTitular.cpf} onChange={e => setFormTitular(p => ({ ...p, cpf: e.target.value }))} placeholder="Só números" />
              </div>
            </div>
            <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary">Salvar Titular</button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Dependentes</h3>
            <button className="btn btn-primary" onClick={handleNovoDependenteClick}>＋ Novo Dependente</button>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Nome</th><th>CPF</th><th>Data de Nascimento</th><th>Relação de Dependência</th><th>Ações</th></tr></thead>
              <tbody>
                {dependentes.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhum dependente cadastrado.</td></tr>
                ) : dependentes.map(d => (
                  <tr key={d.id}>
                    <td>{d.nome}</td>
                    <td>{formatCpfCnpj(d.cpf)}</td>
                    <td>{formatDate(d.dataNascimento)}</td>
                    <td>{d.parentesco}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicaoDependente(d)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleExcluirDependente(d)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="modal-header"><h3>{editingId ? 'Editar Dependente' : 'Novo Dependente'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
        <form onSubmit={handleSalvarDependente}>
          <div className="modal-body">
            {!editingId && (
              <div className="form-row">
                <div className="form-group"><label>Ano-calendário</label><input className="form-control" type="number" value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))} /></div>
              </div>
            )}
            <div className="form-group"><label>Nome Completo</label><input className="form-control" value={formDependente.nome} onChange={e => updDependente('nome', e.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label>CPF</label><input className="form-control" value={formDependente.cpf} onChange={e => updDependente('cpf', e.target.value)} placeholder="Se tiver" /></div>
              <div className="form-group"><label>Data de Nascimento</label><DateInput value={formDependente.dataNascimento} onChange={v => updDependente('dataNascimento', v)} /></div>
            </div>
            <div className="form-group">
              <label>Relação de Dependência</label>
              <input className="form-control" value={formDependente.parentesco} onChange={e => updDependente('parentesco', e.target.value)} placeholder="Código conforme a tabela da declaração" />
            </div>
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
