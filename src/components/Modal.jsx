import { useEffect, useState } from 'react';

const EXIT_DURATION = 150; // bate com --transition-fast em index.css

/**
 * Overlay + moldura do modal com animação de saída real: ao fechar, adia o
 * desmonte até a transição CSS (.closing) terminar, em vez de sumir na hora.
 */
export default function Modal({ open, onClose, children, style }) {
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setClosing(false);
    } else if (shouldRender) {
      setClosing(true);
      const t = setTimeout(() => setShouldRender(false), EXIT_DURATION);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={style}>
        {children}
      </div>
    </div>
  );
}
