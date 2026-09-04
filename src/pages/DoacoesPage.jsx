import { useState, useMemo, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, mascaraCpfCnpj, truncarComReticencias } from '../utils/formatters';
import Modal from '../components/Modal';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MoneyInput from '../components/MoneyInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';

// Cadastro manual das 3 fichas de Doações — nasceram só-leitura (import do
// PDF, ver importParsers.js/RelatorioPage.jsx), a usuária pediu pra dar um
// jeito de incluir à mão (declaração sem PDF pra importar, ou doação que o
// parser não pegou). Mesmo padrão de RendimentosPage/DividasPage: uma aba
// por ficha, tabela + modal de cadastro/edição.
const ABAS = {
  efetuadas: { titulo: 'Doações Efetuadas', colecao: 'doacoesEfetuadasOficial', addAction: 'ADD_DOACAO_EFETUADA', updateAction: 'UPDATE_DOACAO_EFETUADA', deleteAction: 'DELETE_DOACAO_EFETUADA', comCategoria: false },
  partidos: { titulo: 'Doações a Partidos Políticos e Candidatos', colecao: 'doacoesPartidosOficial', addAction: 'ADD_DOACAO_PARTIDO', updateAction: 'UPDATE_DOACAO_PARTIDO', deleteAction: 'DELETE_DOACAO_PARTIDO', comCategoria: false },
  ecaIdoso: { titulo: 'Doações Diretamente na Declaração (ECA e Pessoa Idosa)', colecao: 'doacoesEcaIdosoOficial', addAction: 'ADD_DOACAO_ECA_IDOSO', updateAction: 'UPDATE_DOACAO_ECA_IDOSO', deleteAction: 'DELETE_DOACAO_ECA_IDOSO', comCategoria: true },
};

const FORM_VAZIO = { codigo: '', nome_beneficiario: '', cpf_cnpj: '', valor: '', descricao: '', categoria: 'eca' };

export default function DoacoesPage() {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const [subView, setSubView] = useState('efetuadas');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [anoCadastro, setAnoCadastro] = useState(state.anoCalendario);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const aba = ABAS[subView];
  const itens = state[aba.colecao] || [];
  const total = useMemo(() => itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0), [itens]);

  const abrirNovo = (ano = state.anoCalendario) => { setEditingId(null); setForm(FORM_VAZIO); setAnoCadastro(ano); setModalOpen(true); };
  const handleNovoClick = () => {
    if (state.anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (d) => {
    setEditingId(d.id);
    setForm({ codigo: d.codigo || '', nome_beneficiario: d.nome_beneficiario || '', cpf_cnpj: d.cpf_cnpj || '', valor: d.valor ?? '', descricao: d.descricao || '', categoria: d.categoria || 'eca' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código', form.codigo], ['Beneficiário', form.nome_beneficiario]])
      || primeiroValorZerado([['Valor', form.valor]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = {
      codigo: form.codigo,
      nome_beneficiario: form.nome_beneficiario,
      cpf_cnpj: (form.cpf_cnpj || '').replace(/\D/g, ''),
      valor: parseFloat(form.valor) || 0,
      descricao: form.descricao,
      ...(aba.comCategoria ? { categoria: form.categoria } : {}),
    };
    if (editingId) {
      dispatch({ type: aba.updateAction, payload: { ...payload, id: editingId } });
      addToast('Doação atualizada!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: aba.addAction, payload });
      addToast('Doação cadastrada!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = async (d) => {
    const nome = d.nome_beneficiario || 'esta doação';
    if (await confirmar({ titulo: 'Excluir esta doação?', textoConfirmar: 'Excluir', perigo: true, texto: `A doação para "${nome}" (${formatCurrency(d.valor)}) será removida.\n\nEssa ação não pode ser desfeita.` })) {
      dispatch({ type: aba.deleteAction, payload: d.id });
      addToast('Doação excluída', 'info');
    }
  };

  const handleExport = () => exportListaToXlsx(
    itens,
    [
      ['Código', d => d.codigo || ''],
      ...(aba.comCategoria ? [['Categoria', d => d.categoria === 'idoso' ? 'Pessoa Idosa' : 'ECA']] : []),
      ['Beneficiário', d => d.nome_beneficiario || ''],
      ['CPF/CNPJ', d => formatCpfCnpj(d.cpf_cnpj)],
      ['Valor', d => d.valor || 0],
      ['Descrição', d => d.descricao || ''],
    ],
    aba.titulo, 'doacoes', state.anoCalendario
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Doações</h2>
          <p>{itens.length} registro(s) em "{aba.titulo}"{state.anoCalendario != null ? `, ano-calendário ${state.anoCalendario}` : ''}: {formatCurrency(total)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Nova Doação</button>
        </div>
      </div>
      <div className="page-body animate-in altura-tabelas-adaptativa">
        <div className="tabs" style={{ marginBottom: '20px' }}>
          {Object.entries(ABAS).map(([key, meta]) => (
            <button key={key} className={`tab ${subView === key ? 'active' : ''}`} onClick={() => setSubView(key)}>{meta.titulo}</button>
          ))}
        </div>

        <TabelaRedimensionavel>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                {aba.comCategoria && <th>Categoria</th>}
                <th style={{ minWidth: '260px' }}>Beneficiário</th>
                <th>CPF/CNPJ</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Descrição</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {itens.length === 0 ? (
                <tr><td colSpan={aba.comCategoria ? 7 : 6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma doação cadastrada nesta ficha. Clique em "Nova Doação" ou importe uma declaração com esse dado.
                </td></tr>
              ) : itens.map(d => (
                <tr key={d.id}>
                  <td>{d.codigo}</td>
                  {aba.comCategoria && <td>{d.categoria === 'idoso' ? 'Pessoa Idosa' : 'ECA'}</td>}
                  <td title={d.nome_beneficiario || ''}>{truncarComReticencias(d.nome_beneficiario, 80)}</td>
                  <td>{formatCpfCnpj(d.cpf_cnpj)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.valor)}</td>
                  <td title={d.descricao || ''}>{truncarComReticencias(d.descricao, 60)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => abrirEdicao(d)}>Editar</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(d)}>Excluir</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {itens.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={aba.comCategoria ? 4 : 3} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className="currency">{formatCurrency(total)}</td>
                  <td colSpan={2} style={{ borderTop: '2px solid var(--border-color)' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </TabelaRedimensionavel>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="modal-header"><h3>{editingId ? 'Editar Doação' : 'Nova Doação'}: {aba.titulo}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
        <form onSubmit={handleSave}>
          <div className="modal-body">
            {!editingId && (
              <div className="form-row">
                <div className="form-group"><label>Ano-calendário</label><input className="form-control" type="number" value={anoCadastro ?? ''} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))} /></div>
              </div>
            )}
            <div className="form-row">
              <div className="form-group"><label>Código</label><input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} /></div>
              {aba.comCategoria && (
                <div className="form-group"><label>Categoria</label>
                  <select className="form-control" value={form.categoria} onChange={e => upd('categoria', e.target.value)}>
                    <option value="eca">ECA (Fundo da Criança e do Adolescente)</option>
                    <option value="idoso">Pessoa Idosa</option>
                  </select>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group"><label>Beneficiário</label><input className="form-control" value={form.nome_beneficiario} onChange={e => upd('nome_beneficiario', e.target.value)} /></div>
              <div className="form-group"><label>CPF/CNPJ</label><input className="form-control" inputMode="numeric" placeholder="000.000.000-00 ou 00.000.000/0000-00" value={mascaraCpfCnpj(form.cpf_cnpj)} onChange={e => upd('cpf_cnpj', mascaraCpfCnpj(e.target.value))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Valor</label><MoneyInput value={form.valor} onChange={v => upd('valor', v)} /></div>
            </div>
            <div className="form-group"><label>Descrição</label><input className="form-control" value={form.descricao} onChange={e => upd('descricao', e.target.value)} /></div>
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
