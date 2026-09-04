import { createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useData } from '../store/DataContext';

const EXIT_DURATION = 150; // bate com --transition-fast em index.css
const FOCAVEIS = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

// Pra filhos que mudam de valor sem passar por um onChange nativo de
// verdade (ex.: DateInput escolhido pelo calendário, que chama o onChange
// de fora diretamente em JS) — dispatchEvent num <input> controlado pelo
// React não funciona pra isso: o React rastreia o valor internamente e
// engole o evento simulado quando o setter nativo não foi usado de
// verdade (achado real, testando escolher data pelo calendário dentro de
// um modal: Esc fechava direto, sem avisar). useMarcarModalSujo() dá o
// caminho direto, sem depender de simular DOM.
const DirtyContext = createContext(() => {});
export const useMarcarModalSujo = () => useContext(DirtyContext);

/**
 * Overlay + moldura do modal com animação de saída real: ao fechar, adia o
 * desmonte até a transição CSS (.closing) terminar, em vez de sumir na hora.
 *
 * Esc e clique fora fecham o modal — mas se algo foi digitado/alterado
 * nessa abertura (dirtyRef, marcado por um onChange delegado, pega
 * qualquer input/select/textarea/MoneyInput dos filhos sem precisar que
 * cada tela avise, mais o DirtyContext acima pra quem muda por fora do
 * DOM), pergunta antes de descartar. Só esses dois caminhos "acidentais"
 * pedem confirmação — os botões "✕"/"Cancelar" de cada tela já são um
 * clique deliberado, perguntar de novo ali seria confirmar a confirmação.
 * dirtyRef zera sempre que o modal abre (de novo ou pra outro item), nunca
 * carrega sujeira de uma abertura anterior.
 */
export default function Modal({ open, onClose, children, style }) {
  const { confirmar } = useData();
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const dirtyRef = useRef(false);
  const modalRef = useRef(null);
  const focoAnteriorRef = useRef(null);
  const tituloId = `modal-titulo-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Trava reentrância: enquanto o ConfirmacaoModal (assíncrono) está
  // aberto perguntando, um segundo Esc/clique não pode abrir outra
  // pergunta em cima nem fechar o modal antes da resposta chegar.
  const perguntandoRef = useRef(false);

  useEffect(() => {
    if (open) {
      setShouldRender(true);
      setClosing(false);
      dirtyRef.current = false;
    } else if (shouldRender) {
      setClosing(true);
      const t = setTimeout(() => setShouldRender(false), EXIT_DURATION);
      return () => clearTimeout(t);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !shouldRender || !modalRef.current) return undefined;
    focoAnteriorRef.current = document.activeElement;
    const modal = modalRef.current;
    const titulo = modal?.querySelector('.modal-header h3, .modal-header h2');
    if (titulo && !titulo.id) titulo.id = tituloId;
    const frame = requestAnimationFrame(() => {
      const primeiro = modal?.querySelector(FOCAVEIS);
      (primeiro || modal)?.focus();
    });
    return () => {
      cancelAnimationFrame(frame);
      const anterior = focoAnteriorRef.current;
      requestAnimationFrame(() => {
        if (anterior?.isConnected && typeof anterior.focus === 'function') anterior.focus();
      });
    };
  }, [open, shouldRender, tituloId]);

  const fecharComGuarda = async () => {
    if (perguntandoRef.current) return;
    if (dirtyRef.current) {
      perguntandoRef.current = true;
      const ok = await confirmar({
        titulo: 'Descartar alterações?',
        texto: 'Você tem alterações não salvas nesta tela.',
        textoConfirmar: 'Descartar',
        perigo: true,
      });
      perguntandoRef.current = false;
      if (!ok) return;
    }
    onCloseRef.current();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') fecharComGuarda();
      if (e.key === 'Tab') {
        const itens = [...(modalRef.current?.querySelectorAll(FOCAVEIS) || [])]
          .filter(item => item.getClientRects().length > 0);
        if (itens.length === 0) {
          e.preventDefault();
          modalRef.current?.focus();
          return;
        }
        const primeiro = itens[0];
        const ultimo = itens[itens.length - 1];
        if (e.shiftKey && (document.activeElement === primeiro || !modalRef.current?.contains(document.activeElement))) {
          e.preventDefault();
          ultimo.focus();
        } else if (!e.shiftKey && (document.activeElement === ultimo || !modalRef.current?.contains(document.activeElement))) {
          e.preventDefault();
          primeiro.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={fecharComGuarda}>
      <div
        ref={modalRef}
        className="modal" style={style}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onChange={() => { dirtyRef.current = true; }}
      >
        <DirtyContext.Provider value={() => { dirtyRef.current = true; }}>
          {children}
        </DirtyContext.Provider>
      </div>
    </div>
  );
}
