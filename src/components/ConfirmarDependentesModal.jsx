import { useState, useEffect } from 'react';
import Modal from './Modal';
import { formatDate } from '../utils/formatters';

// Aparece só ao "Avançar para {ano+1}" (seletor da sidebar) quando o ano
// corrente tem dependentes cadastrados — pedido real da usuária: um
// dependente pode deixar de sê-lo de um ano pro outro (filho que fez 21
// anos, separação etc.), e o app hoje levava todo mundo adiante em
// silêncio via ROLLOVER_ANO (spread do estado, nunca mexia em
// `dependentes`). Cada dependente vem marcado "continua" por padrão (é o
// caso mais comum); desmarcar um aqui não mexe no ano anterior (ele
// continua lá, já arquivado) — só tira do ano novo, via DELETE_DEPENDENTE
// despachado depois do ROLLOVER_ANO (ver Sidebar.jsx).
export default function ConfirmarDependentesModal({ open, dependentes, proximoAno, onClose, onConfirmar }) {
  const [continuam, setContinuam] = useState(() => new Set(dependentes.map(d => d.id)));
  useEffect(() => {
    if (open) setContinuam(new Set(dependentes.map(d => d.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const alternar = (id) => setContinuam(prev => {
    const novo = new Set(prev);
    if (novo.has(id)) novo.delete(id); else novo.add(id);
    return novo;
  });

  const confirmar = () => {
    const idsQueSaem = dependentes.filter(d => !continuam.has(d.id)).map(d => d.id);
    onConfirmar(idsQueSaem);
  };

  return (
    <Modal open={open} onClose={onClose} style={{ maxWidth: '520px' }}>
      <div className="modal-header">
        <h3>Dependentes em {proximoAno}</h3>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>
      <div className="modal-body">
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          Confirme quais dependentes continuam em {proximoAno}. Desmarcar um aqui não apaga o
          histórico dele em anos anteriores, só tira da lista do ano novo.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {dependentes.map(d => (
            <label
              key={d.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              }}
            >
              <input type="checkbox" checked={continuam.has(d.id)} onChange={() => alternar(d.id)} />
              <div>
                <div style={{ fontWeight: 600 }}>{d.nome || '(sem nome)'}</div>
                {d.dataNascimento && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Nascimento: {formatDate(d.dataNascimento)}
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="button" className="btn btn-primary" onClick={confirmar}>Confirmar e avançar</button>
      </div>
    </Modal>
  );
}
