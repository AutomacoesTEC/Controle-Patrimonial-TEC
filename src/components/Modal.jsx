import { createContext, useContext, useEffect, useRef, useState } from 'react';

const EXIT_DURATION = 150; // bate com --transition-fast em index.css

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
  const [shouldRender, setShouldRender] = useState(open);
  const [closing, setClosing] = useState(false);
  const dirtyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

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

  const fecharComGuarda = () => {
    if (dirtyRef.current && !confirm('Você tem alterações não salvas nesta tela. Tem certeza que quer fechar sem salvar?')) return;
    onCloseRef.current();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') fecharComGuarda();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!shouldRender) return null;

  return (
    <div className={`modal-overlay${closing ? ' closing' : ''}`} onClick={fecharComGuarda}>
      <div
        className="modal" style={style}
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
