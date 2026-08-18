import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';
import MovimentacaoBemForm from './MovimentacaoBemForm';

// Mesma lógica do BemModal (Bens e Direitos), mas para a lista separada
// de Bens da Atividade Rural: não tem grupo/imóvel/veículo (a declaração
// real só pede um código numérico + discriminação pra esses bens), e a
// movimentação usa a coleção `bensRurais` em vez de `bens`.
export default function BemRuralModal({ bem, onSave, onClose }) {
  const { state } = useData();
  const isEditing = !!bem;
  const liveBem = isEditing ? (state.bensRurais.find(b => b.id === bem.id) || bem) : null;

  const [form, setForm] = useState(bem || {
    codigo: '',
    discriminacao: '',
    situacao_anterior: '',
    situacao_atual: '',
  });
  const upd = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      situacao_anterior: isEditing ? liveBem.situacao_anterior : (parseFloat(form.situacao_anterior) || 0),
      situacao_atual: isEditing ? liveBem.situacao_atual : (parseFloat(form.situacao_atual) || 0),
      movimentacoes: isEditing ? liveBem.movimentacoes : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h3>{bem ? 'Editar Bem da Atividade Rural' : 'Novo Bem da Atividade Rural'}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            {isEditing ? (
              <div className="form-row">
                <div className="form-group">
                  <label>Situação anterior (não editável aqui)</label>
                  <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>{formatCurrency(liveBem.situacao_anterior)}</div>
                </div>
                <div className="form-group">
                  <label>Situação atual (não editável aqui)</label>
                  <div className="form-control" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontWeight: 700 }}>{formatCurrency(liveBem.situacao_atual)}</div>
                </div>
              </div>
            ) : (
              <div className="form-row">
                <div className="form-group">
                  <label>Situação em 31/12 (Ano Anterior)</label>
                  <input className="form-control" type="number" step="0.01" value={form.situacao_anterior} onChange={e => upd('situacao_anterior', e.target.value)} placeholder="0,00" />
                </div>
                <div className="form-group">
                  <label>Situação em 31/12 (Ano Atual)</label>
                  <input className="form-control" type="number" step="0.01" value={form.situacao_atual} onChange={e => upd('situacao_atual', e.target.value)} placeholder="0,00" />
                </div>
              </div>
            )}

            {isEditing && <MovimentacaoBemForm bem={liveBem} actionType="REGISTRAR_MOVIMENTACAO_BEM_RURAL" />}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">💾 Salvar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
