import { useState, useRef } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, MOVIMENTACAO_DIVIDA_TIPOS, descreverOrigemDocumento, truncarComReticencias, CODIGOS_DIVIDA, describeDividaCodigo } from '../utils/formatters';
import Modal from '../components/Modal';
import SeletorCodigo from '../components/SeletorCodigo';
import AnoCalendarioModal from '../components/AnoCalendarioModal';
import MovimentacaoBemForm from '../components/MovimentacaoBemForm';
import MoneyInput from '../components/MoneyInput';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { exportListaToXlsx, resumoMovimentacoes } from '../utils/exportXlsx';
import { primeiroCampoVazio, mensagemObrigatorio } from '../utils/validacao';

const FORM_VAZIO = { codigo: '13', discriminacao: '', situacao_anterior: '', situacao_atual: '', valor_pago: '' };

export default function DividasPage({ onVoltar } = {}) {
  const { state, dispatch, addToast, garantirAnoCadastro, despacharEmAno, confirmar } = useData();
  const { dividas, anoCalendario } = state;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [anoCadastro, setAnoCadastro] = useState(anoCalendario);
  const [anoModalOpen, setAnoModalOpen] = useState(false);
  const pendingActionRef = useRef(null);

  const upd = (f, v) => setForm(p => ({ ...p, [f]: v }));

  // O saldo atual muda por movimentação, não pelo formulário — sempre ler do
  // estado vivo (mesmo motivo do BemModal), senão salvar depois de uma
  // amortização registrada no modal desfaria o efeito dela.
  const liveDivida = editingId ? state.dividas.find(d => d.id === editingId) : null;

  const abrirNovo = (ano = anoCalendario) => { setEditingId(null); setForm(FORM_VAZIO); setAnoCadastro(ano); setModalOpen(true); };
  // Sem ano-calendário ainda, o primeiro registro é quem pergunta qual ano
  // (ver AnoCalendarioModal); a ação real só roda depois de confirmado, com
  // o ano que acabou de ser escolhido — não com `anoCalendario` capturado
  // aqui, que nesse instante ainda é null (React só atualiza no próximo
  // render, depois do dispatch do ROLLOVER_ANO).
  const handleNovoClick = () => {
    if (anoCalendario == null) { pendingActionRef.current = abrirNovo; setAnoModalOpen(true); return; }
    abrirNovo();
  };
  const abrirEdicao = (d) => {
    setEditingId(d.id);
    setForm({ codigo: d.codigo, discriminacao: d.discriminacao || '', situacao_anterior: d.situacao_anterior, situacao_atual: d.situacao_atual, valor_pago: d.valor_pago || '' });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código', form.codigo], ['Discriminação', form.discriminacao]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    const payload = { ...form, situacao_anterior: parseFloat(form.situacao_anterior) || 0, situacao_atual: parseFloat(form.situacao_atual) || 0, valor_pago: parseFloat(form.valor_pago) || 0 };
    if (editingId) {
      // Em edição, saldo atual e movimentações vêm do estado vivo: mudança de
      // saldo se faz por movimentação registrada (abaixo no modal), não
      // editando o número direto.
      dispatch({ type: 'UPDATE_DIVIDA', payload: { ...payload, id: editingId, situacao_anterior: liveDivida.situacao_anterior, situacao_atual: liveDivida.situacao_atual, movimentacoes: liveDivida.movimentacoes } });
      addToast('Dívida atualizada!', 'success');
    } else {
      const anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
      despacharEmAno(anoAlvo, { type: 'ADD_DIVIDA', payload });
      addToast('Dívida cadastrada!', 'success');
    }
    setModalOpen(false);
  };

  const handleDelete = async (d) => {
    const nome = (d.discriminacao || 'esta dívida').substring(0, 60);
    if (await confirmar({ titulo: 'Excluir esta dívida?', textoConfirmar: 'Excluir', perigo: true, texto: `A dívida "${nome}" será removida.\n\nEssa ação não pode ser desfeita.` })) {
      dispatch({ type: 'DELETE_DIVIDA', payload: d.id });
      addToast('Dívida excluída', 'info');
    }
  };

  const totalAnterior = dividas.reduce((s, d) => s + (parseFloat(d.situacao_anterior) || 0), 0);
  const totalAtual = dividas.reduce((s, d) => s + (parseFloat(d.situacao_atual) || 0), 0);

  const handleExport = () => exportListaToXlsx(
    dividas,
    [
      ['Código', d => d.codigo || ''],
      ['Discriminação', d => d.discriminacao || ''],
      ['Situação 31/12 Anterior', d => d.situacao_anterior || 0],
      ['Situação 31/12 Atual', d => d.situacao_atual || 0],
      ['Variação', d => (d.situacao_atual || 0) - (d.situacao_anterior || 0)],
      ['Valor Pago no Ano', d => d.valor_pago || 0],
      ['Movimentações no Ano', d => resumoMovimentacoes(d)],
    ],
    'Dívidas e Ônus', 'dividas_onus', anoCalendario
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          {onVoltar && <button type="button" className="btn-voltar-dashboard" onClick={onVoltar}>← Voltar ao Dashboard</button>}
          <h2>Dívidas e Ônus Reais</h2>
          <p>{dividas.length} {dividas.length === 1 ? 'item' : 'itens'}{anoCalendario != null ? `, total em 31/12/${anoCalendario}` : ''}: {formatCurrency(totalAtual)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>
          <button className="btn btn-primary" onClick={handleNovoClick}>＋ Nova Dívida</button>
        </div>
      </div>
      <div className="page-body animate-in">
        <TabelaRedimensionavel>
          <table>
            <thead><tr><th>Cód.</th><th style={{ minWidth: '300px' }}>Discriminação</th><th style={{ textAlign: 'right' }}>{anoCalendario != null ? `31/12/${anoCalendario - 1}` : 'Saldo anterior'}</th><th style={{ textAlign: 'right' }}>{anoCalendario != null ? `31/12/${anoCalendario}` : 'Saldo atual'}</th><th style={{ textAlign: 'right' }}>Valor Pago</th><th>Ações</th></tr></thead>
            <tbody>
              {dividas.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma dívida cadastrada.</td></tr>
              ) : dividas.map(d => (
                <tr key={d.id}>
                  <td>
                    <span className="badge badge-red" title={describeDividaCodigo(d.codigo) || undefined}>{d.codigo}</span>
                    {describeDividaCodigo(d.codigo) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{describeDividaCodigo(d.codigo)}</div>
                    )}
                  </td>
                  <td title={d.discriminacao || ''}>
                    {truncarComReticencias(d.discriminacao, 100)}
                    {/* Página e linha da declaração impressa, mesmo tratamento
                        que Bens, Rendimentos e Pagamentos já tinham. */}
                    {descreverOrigemDocumento(d) && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(d)}</div>
                    )}
                  </td>
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
        </TabelaRedimensionavel>
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
            <div className="modal-header"><h3>{editingId ? 'Editar Dívida' : 'Nova Dívida'}</h3><button className="modal-close" onClick={() => setModalOpen(false)}>✕</button></div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                {!editingId && (
                  <div className="form-row">
                    <div className="form-group"><label>Ano-calendário</label><input className="form-control" type="number" value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))} /></div>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group"><label>Código do credor</label><SeletorCodigo opcoes={CODIGOS_DIVIDA} value={form.codigo} onChange={v => upd('codigo', v)} placeholder="Selecione ou digite o código" /></div>
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
                      <div className="form-group"><label>Valor Pago no Ano</label><MoneyInput value={form.valor_pago} onChange={v => upd('valor_pago', v)} /></div>
                    </div>
                    <MovimentacaoBemForm
                      bem={liveDivida}
                      actionType="REGISTRAR_MOVIMENTACAO_DIVIDA"
                      tipos={MOVIMENTACAO_DIVIDA_TIPOS}
                      tipoInicial="amortizacao"
                      anoCalendario={anoCalendario}
                    />
                  </>
                ) : (
                <div className="form-row">
                  <div className="form-group"><label>Situação 31/12 Anterior</label><MoneyInput value={form.situacao_anterior} onChange={v => upd('situacao_anterior', v)} /></div>
                  <div className="form-group"><label>Situação 31/12 Atual</label><MoneyInput value={form.situacao_atual} onChange={v => upd('situacao_atual', v)} /></div>
                  <div className="form-group"><label>Valor Pago no Ano</label><MoneyInput value={form.valor_pago} onChange={v => upd('valor_pago', v)} /></div>
                </div>
                )}
              </div>
              {/* Mesmo raciocínio de BemModal.jsx: editando, "Registrar
                  movimentação" já é uma ação independente que grava na
                  hora, então "Salvar" sozinho aqui embaixo confundia com
                  aquele. */}
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancelar</button><button type="submit" className="btn btn-primary">{editingId ? 'Salvar Dados da Dívida' : 'Salvar'}</button></div>
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
