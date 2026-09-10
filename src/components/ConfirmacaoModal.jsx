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

const FOCAVEIS = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

// Lógica de teclado da confirmação, extraída para poder ser testada sem DOM.
// Escape, Enter e Tab são SEMPRE consumidos (`stopPropagation`), para não
// vazarem para o <Modal> de trás enquanto a pergunta está aberta (P09/P10 da
// auditoria funcional 2026-09-09): sem isso, um Escape cancelava a confirmação
// E disparava a guarda "Descartar alterações?" do modal subjacente, e o Tab
// movia o foco para os controles daquele modal.
export function tratarTeclaConfirmacao(e, { caixa, ativo, onCancelar, onConfirmar }) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    e.preventDefault();
    onCancelar();
    return;
  }
  if (e.key === 'Enter') {
    e.stopPropagation();
    // Enter num botão já dispara o clique do próprio botão; só acionamos
    // "confirmar" quando o foco não está num controle da confirmação.
    if (!caixa || !caixa.contains(ativo) || ativo === caixa) {
      e.preventDefault();
      onConfirmar();
    }
    return;
  }
  if (e.key === 'Tab') {
    e.stopPropagation();
    const itens = [...(caixa?.querySelectorAll(FOCAVEIS) || [])]
      .filter(el => typeof el.getClientRects !== 'function' || el.getClientRects().length > 0);
    if (itens.length === 0) {
      e.preventDefault();
      caixa?.focus();
      return;
    }
    const primeiro = itens[0];
    const ultimo = itens[itens.length - 1];
    const fora = !caixa || !caixa.contains(ativo);
    if (e.shiftKey && (ativo === primeiro || fora)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && (ativo === ultimo || fora)) {
      e.preventDefault();
      primeiro.focus();
    }
  }
}

export default function ConfirmacaoModal({
  open, titulo = 'Atenção', texto, textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar', perigo = false, onConfirmar, onCancelar,
}) {
  const confirmarRef = useRef(null);
  const caixaRef = useRef(null);
  const focoAnteriorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    focoAnteriorRef.current = document.activeElement;
    confirmarRef.current?.focus();
    // Listener em CAPTURA no document: pega a tecla antes do <Modal> de trás.
    const onKey = (e) => tratarTeclaConfirmacao(e, {
      caixa: caixaRef.current,
      ativo: document.activeElement,
      onCancelar,
      onConfirmar,
    });
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // Devolve o foco a quem o tinha quando a confirmação abriu (um controle
      // do modal de baixo), sem competir com o restore do próprio <Modal>.
      const anterior = focoAnteriorRef.current;
      if (anterior?.isConnected && typeof anterior.focus === 'function') {
        requestAnimationFrame(() => {
          if (anterior.isConnected) anterior.focus();
        });
      }
    };
  }, [open, onCancelar, onConfirmar]);

  if (!open) return null;

  return (
    <div className="confirmacao-overlay" onClick={onCancelar}>
      <div
        ref={caixaRef}
        className="confirmacao-caixa"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
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
