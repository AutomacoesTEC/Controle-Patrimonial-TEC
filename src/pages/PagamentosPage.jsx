import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj, mascaraCpfCnpj, formatDate, CODIGOS_PAGAMENTO, describePagamentoCodigo, descreverTitularidade, TITULARIDADE_PAGAMENTO, descreverOrigemDocumento, truncarComReticencias} from '../utils/formatters';
import Modal from '../components/Modal';
import SeletorCodigo from '../components/SeletorCodigo';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MoneyInput from '../components/MoneyInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from '../utils/validacao';
import EstadoVazio from '../components/EstadoVazio';

// titularidade nasce vazia de propósito: o cadastro manual não deve assumir
// que a despesa é do titular. Titular, dependente e alimentando têm regras de
// dedução diferentes, e o campo em branco é honesto ("não informado").
// Data vazia por padrão: o ano-calendário sai dela; pré-preencher "hoje"
// forçaria trocar de ano ao salvar num exercício de trabalho diferente.
const FORM_VAZIO = { codigo: '21', nome_beneficiario: '', cpf_cnpj: '', valor_pago: '', parcela_nao_dedutivel: '', descricao: '', titularidade: '', titularidadeNome: '', data: '' };

export default function PagamentosPage() {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const { pagamentos } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);
  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // Ano-calendário = ano da DATA do pagamento (a usuária tirou o campo separado
  // em 03/09/2026). Lê os 4 primeiros caracteres do <input type="date">.
  const anoCadastro = /^\d{4}-\d{2}-\d{2}$/.test(form.data || '') ? Number(form.data.slice(0, 4)) : state.anoCalendario;

  const abrirNovo = () => { setEditingId(null); setForm(FORM_VAZIO); setModalOpen(true); };
  const handleNovoClick = () => {
    if (state.anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (p) => {
    setEditingId(p.id);
    setForm({ codigo: p.codigo, nome_beneficiario: p.nome_beneficiario || '', cpf_cnpj: p.cpf_cnpj || '', valor_pago: p.valor_pago, parcela_nao_dedutivel: p.parcela_nao_dedutivel || '', descricao: p.descricao || '', titularidade: p.titularidade || '', titularidadeNome: p.titularidadeNome || '', data: p.data || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código', form.codigo], ['Nome do Beneficiário', form.nome_beneficiario]])
      || primeiroValorZerado([['Valor Pago', form.valor_pago]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, valor_pago: parseFloat(form.valor_pago) || 0, parcela_nao_dedutivel: parseFloat(form.parcela_nao_dedutivel) || 0 };
    if (editingId) {
      dispatch({ type: 'UPDATE_PAGAMENTO', payload: { ...payload, id: editingId } });
      addToast('Pagamento atualizado!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_PAGAMENTO', payload });
      addToast('Pagamento cadastrado!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = async (p) => {
    if (await confirmar({ titulo: 'Excluir este pagamento?', textoConfirmar: 'Excluir', perigo: true, texto: `O pagamento para "${p.nome_beneficiario || 'este beneficiário'}" (${formatCurrency(p.valor_pago)}) será removido.\n\nEssa ação não pode ser desfeita.` })) {
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
        <div className="page-header-left"><h2>Pagamentos Efetuados</h2><p>{pagamentos.length} registro(s){state.anoCalendario != null ? ` no ano-calendário ${state.anoCalendario}` : ''}, total {formatCurrency(totalPago)}</p></div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Novo Pagamento</button>
        </div>
      </div>
      <div className="page-body animate-in">
        <TabelaRedimensionavel persistKey="pagamentos" stickyRightColumns={4}>
          <table className="tabela-acoes-fixas">
            <thead><tr><th style={{ minWidth: '180px' }}>Cód.</th><th>Data</th><th>Nome Beneficiário</th><th>Titularidade</th><th>CPF/CNPJ</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th style={{ textAlign: 'right' }}>Parcela Não Dedutível</th><th>Descrição</th><th>Ações</th></tr></thead>
            <tbody>
              {pagamentos.length === 0 ? (
                <EstadoVazio colSpan={9} titulo="Nenhum pagamento cadastrado" contexto="Registre o primeiro pagamento efetuado para montar a ficha deste ano." acao="Cadastrar primeiro pagamento" onAcao={handleNovoClick} />
              ) : pagamentos.map(p => (
                <tr key={p.id}>
                  <td>
                    <span className="badge badge-orange">{p.codigo}</span>
                    {describePagamentoCodigo(p.codigo) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{describePagamentoCodigo(p.codigo)}</div>
                    )}
                  </td>
                  <td>{formatDate(p.data)}</td>
                  <td title={p.nome_beneficiario || ''}>
                    {truncarComReticencias(p.nome_beneficiario, 40)}
                    {descreverOrigemDocumento(p) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(p)}</div>
                    )}
                  </td>
                  <td style={{ fontSize: '12px' }}>
                    {descreverTitularidade(p) || <span style={{ color: 'var(--text-muted)' }}>Não informada</span>}
                  </td>
                  <td>{formatCpfCnpj(p.cpf_cnpj)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.valor_pago)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(p.parcela_nao_dedutivel)}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '12px' }} title={p.descricao || ''}>{truncarComReticencias(p.descricao, 40)}</td>
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
        </TabelaRedimensionavel>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Pagamento' : 'Novo Pagamento'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Código</label>
                    <SeletorCodigo opcoes={CODIGOS_PAGAMENTO} value={form.codigo} onChange={v => upd('codigo', v)} placeholder="Selecione ou digite o código" />
                  </div>
                  <div className="form-group"><label>CPF/CNPJ Beneficiário</label><input className="form-control" inputMode="numeric" placeholder="000.000.000-00 ou 00.000.000/0000-00" value={mascaraCpfCnpj(form.cpf_cnpj)} onChange={e => upd('cpf_cnpj', mascaraCpfCnpj(e.target.value))} /></div>
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
                  <div className="form-group">
                    <label>Data</label>
                    <input className="form-control" type="date" value={form.data} onChange={e => upd('data', e.target.value)} />
                  </div>
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
