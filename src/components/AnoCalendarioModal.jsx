import { useState } from 'react';
import { useData } from '../store/DataContext';
import Modal from './Modal';

// Gate que aparece na hora que alguém cria o primeiro registro (bem, dívida,
// rendimento...) sem ainda ter um ano-calendário definido. Substitui a ideia
// de um botão fixo "Começar pelo ano X" na sidebar: o app não é de um
// usuário só, então quem decide o ano de partida é quem está cadastrando,
// ali mesmo, no momento em que faz sentido perguntar.
export default function AnoCalendarioModal({ open, onClose, onConfirm }) {
  const { dispatch, addToast } = useData();
  const [ano, setAno] = useState(() => new Date().getFullYear());

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!ano) return;
    dispatch({ type: 'ROLLOVER_ANO', payload: ano });
    addToast(`Ano-calendário ${ano} iniciado.`, 'success');
    // Passa o ano confirmado pro chamador em vez de deixar ele reler o
    // anoCalendario do estado: logo depois do dispatch acima, o valor "de
    // fora" ainda está desatualizado (React só atualiza no próximo render),
    // então quem recebe esse callback e usa uma referência velha do ano
    // pré-onboarding acaba usando null — foi um bug real, achado testando o
    // formulário de Novo Imóvel Rural logo depois do onboarding.
    onConfirm(ano);
  };

  return (
    <Modal open={open} onClose={onClose} style={{ maxWidth: '400px' }}>
      <div className="modal-header">
        <h3>Qual ano-calendário?</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
            Ainda não há um ano-calendário definido. Este cadastro passa a pertencer
            ao ano que você escolher agora — não precisa ser o ano corrente.
          </p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Ano-calendário</label>
            <input
              type="number"
              className="form-control"
              value={ano}
              onChange={e => setAno(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={!ano}>Continuar</button>
        </div>
      </form>
    </Modal>
  );
}
