import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';
import MovimentacaoBemForm from './MovimentacaoBemForm';
import Modal from './Modal';
import MoneyInput from './MoneyInput';
import { primeiroCampoVazio, mensagemObrigatorio } from '../utils/validacao';

// Mesma lógica do BemModal (Bens e Direitos), mas para a lista separada
// de Bens da Atividade Rural: não tem grupo/imóvel/veículo (a declaração
// real só pede um código numérico + discriminação pra esses bens), e a
// movimentação usa a coleção `bensRurais` em vez de `bens`.
const FORM_VAZIO = {
  codigo: '',
  discriminacao: '',
  situacao_anterior: '',
  situacao_atual: '',
};

export default function BemRuralModal({ open, bem, onSave, onClose }) {
  const { state, addToast, garantirAnoCadastro } = useData();
  const isEditing = !!bem;
  const liveBem = isEditing ? (state.bensRurais.find(b => b.id === bem.id) || bem) : null;

  const [form, setForm] = useState(bem || FORM_VAZIO);
  // Ressincroniza a cada abertura — o modal fica montado o tempo todo, só
  // alterna `open` — senão o formulário guardava o que ficou do
  // cadastro/edição anterior (ver mesma correção no BemModal).
  useEffect(() => {
    if (open) setForm(bem || FORM_VAZIO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bem]);
  const [anoCadastro, setAnoCadastro] = useState(() => state.anoCalendario);
  useEffect(() => {
    if (open && !isEditing) setAnoCadastro(state.anoCalendario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Mesmo colapsável do BemModal (ver comentário lá): Bloco 1 "Dados do Bem"
  // começa COLAPSADO na edição (03/09/2026) — quem abre veio pela movimentação.
  const [bloco1Expandido, setBloco1Expandido] = useState(false);
  useEffect(() => {
    if (open) setBloco1Expandido(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const upd = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const falta = primeiroCampoVazio([['Código', form.codigo], ['Discriminação', form.discriminacao]]);
    if (falta) { addToast(mensagemObrigatorio(falta), 'error'); return; }
    // Em edição não há ano-alvo (a movimentação/UPDATE não muda de ano); em
    // cadastro novo, o pai (BensRuraisSection) precisa do ano confirmado
    // aqui para gravar com despacharEmAno em vez de dispatch direto — ver
    // item G do HANDOFF-2026-09-03.md.
    let anoAlvo = null;
    if (!isEditing) {
      anoAlvo = await garantirAnoCadastro(anoCadastro);
      if (!anoAlvo) return;
    }
    onSave({
      ...form,
      situacao_anterior: isEditing ? liveBem.situacao_anterior : (parseFloat(form.situacao_anterior) || 0),
      situacao_atual: isEditing ? liveBem.situacao_atual : (parseFloat(form.situacao_atual) || 0),
      movimentacoes: isEditing ? liveBem.movimentacoes : undefined,
    }, anoAlvo);
  };

  return (
    <Modal open={open} onClose={onClose} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>{bem ? 'Editar Bem da Atividade Rural' : 'Novo Bem da Atividade Rural'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {!isEditing && (
              <div className="form-row">
                <div className="form-group">
                  <label>Ano-calendário</label>
                  <input
                    className="form-control" type="number"
                    value={anoCadastro} onChange={e => setAnoCadastro(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
            )}
            {isEditing ? (
              // Bloco 1 "Dados do Bem" (mesmo critério do BemModal, versão
              // mais simples aqui: sem grupo/imóvel/veículo, só Código +
              // Discriminação + Situação). Colapsável: fechado, mostra só
              // Discriminação e Situação Atual, o resto some visualmente
              // (`display:none`) sem perder o que já foi digitado.
              <div style={{ background: 'rgba(var(--accent-primary-rgb),0.06)', border: '1px solid rgba(var(--accent-primary-rgb),0.18)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Dados do Bem
                  </div>
                  <button
                    type="button" className="btn btn-sm btn-secondary"
                    onClick={() => setBloco1Expandido(v => !v)}
                  >
                    {bloco1Expandido ? 'Mostrar menos' : 'Mostrar mais'}
                  </button>
                </div>

                <div style={{ display: bloco1Expandido ? undefined : 'none' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Código</label>
                      <input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} placeholder="Código do bem conforme a declaração" />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Discriminação</label>
                  <textarea className="form-control" rows={3} value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)} placeholder="Descrição do bem (trator, roçadeira, benfeitoria...)" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Situação atual (não editável aqui)</label>
                    <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveBem.situacao_atual)}</div>
                  </div>
                </div>

                <div style={{ display: bloco1Expandido ? undefined : 'none' }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Situação anterior (não editável aqui)</label>
                      <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveBem.situacao_anterior)}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Código</label>
                    <input className="form-control" value={form.codigo} onChange={e => upd('codigo', e.target.value)} placeholder="Código do bem conforme a declaração" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Discriminação</label>
                  <textarea className="form-control" rows={3} value={form.discriminacao} onChange={e => upd('discriminacao', e.target.value)} placeholder="Descrição do bem (trator, roçadeira, benfeitoria...)" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Situação em 31/12 (Ano Anterior)</label>
                    <MoneyInput value={form.situacao_anterior} onChange={v => upd('situacao_anterior', v)} />
                  </div>
                  <div className="form-group">
                    <label>Situação em 31/12 (Ano Atual)</label>
                    <MoneyInput value={form.situacao_atual} onChange={v => upd('situacao_atual', v)} />
                  </div>
                </div>
              </>
            )}

            {isEditing && <MovimentacaoBemForm bem={liveBem} actionType="REGISTRAR_MOVIMENTACAO_BEM_RURAL" anoCalendario={state.anoCalendario} />}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            {/* Mesmo raciocínio de BemModal.jsx: editando, "Registrar
                movimentação" já é uma ação independente que grava na hora,
                então "Salvar" sozinho aqui embaixo confundia com aquele. */}
            <button type="submit" className="btn btn-primary">{isEditing ? 'Salvar Dados do Bem' : 'Salvar'}</button>
          </div>
        </form>
    </Modal>
  );
}
