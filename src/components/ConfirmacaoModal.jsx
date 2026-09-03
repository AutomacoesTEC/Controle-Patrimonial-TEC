import { useEffect, useRef } from 'react';

// Modal de confirmação próprio, no lugar do confirm() nativo (que aparece como
// "localhost:4173 diz" e não estiliza). Pedido da usuária em 03/09/2026:
// "troque o sinalizado por ATENÇÃO". Renderizado uma única vez pelo DataProvider
// e acionado por `confirmar()` do useData(), que devolve uma Promise<boolean>.
//
// Overlay próprio (z-index alto) em vez do <Modal> comum: a confirmação costuma
// abrir POR CIMA de outro modal (ex.: excluir uma movimentação de dentro de
// "Editar Bem"), e o <Modal> traz a guarda de "alterações não salvas" que aqui
// só atrapalharia.
export default function ConfirmacaoModal({
  open, titulo = 'Atenção', texto, textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar', perigo = false, onConfirmar, onCancelar,
}) {
  const confirmarRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    confirmarRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onCancelar();
      else if (e.key === 'Enter') onConfirmar();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onCancelar, onConfirmar]);

  if (!open) return null;

  return (
    <div className="confirmacao-overlay" onClick={onCancelar}>
      <div
        className="confirmacao-caixa"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="confirmacao-titulo">{titulo}</h3>
        <p className="confirmacao-texto">{texto}</p>
        <div className="confirmacao-acoes">
          <button type="button" className="btn btn-secondary" onClick={onCancelar}>{textoCancelar}</button>
          <button
            type="button"
            ref={confirmarRef}
            className={`btn ${perigo ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirmar}
          >
            {textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
