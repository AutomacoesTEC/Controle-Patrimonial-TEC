// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// P09 / P10 da auditoria funcional 2026-09-09 — teste DOM ponta a ponta:
// ConfirmacaoModal renderizado POR CIMA de um <Modal> sujo. Uma tecla não pode
// alcançar os dois diálogos.

// O <Modal> depende de useData() (só do campo `confirmar`). Mock mínimo.
const confirmar = vi.fn(() => Promise.resolve(false));
vi.mock('../store/DataContext', () => ({
  useData: () => ({ confirmar }),
}));

const { default: Modal } = await import('./Modal');
const { default: ConfirmacaoModal } = await import('./ConfirmacaoModal');

let container;
let root;

beforeEach(() => {
  confirmar.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function pressionar(key, opts = {}) {
  act(() => {
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {
      key, bubbles: true, cancelable: true, ...opts,
    }));
  });
}

describe('ConfirmacaoModal sobre <Modal> sujo (P09/P10)', () => {
  function montar({ confirmacaoAberta }) {
    const onCloseModal = vi.fn();
    const onCancelar = vi.fn();
    const onConfirmar = vi.fn();
    act(() => {
      root.render(
        <>
          <Modal open onClose={onCloseModal}>
            <div className="modal-header"><h3>Editar Bem</h3></div>
            <input aria-label="campo" defaultValue="" />
            <button type="button">Salvar</button>
          </Modal>
          <ConfirmacaoModal
            open={confirmacaoAberta}
            titulo="Excluir movimentação?"
            texto="Esta ação não pode ser desfeita."
            onConfirmar={onConfirmar}
            onCancelar={onCancelar}
          />
        </>,
      );
    });
    // Suja o <Modal>: o onChange delegado do <Modal> marca dirtyRef. Usa o
    // setter nativo + evento `input` para o React reconhecer a mudança.
    const input = container.querySelector('input[aria-label="campo"]');
    const setValor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    act(() => {
      setValor.call(input, 'x');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return { onCloseModal, onCancelar, onConfirmar };
  }

  it('P09: um Escape só cancela a confirmação — a guarda "Descartar alterações?" do modal de trás não dispara', () => {
    const { onCloseModal, onCancelar } = montar({ confirmacaoAberta: true });
    pressionar('Escape');
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(confirmar).not.toHaveBeenCalled();   // Modal.fecharComGuarda NÃO rodou
    expect(onCloseModal).not.toHaveBeenCalled();
  });

  it('P10: Tab mantém o foco dentro da confirmação, não vai para os controles do modal de trás', () => {
    montar({ confirmacaoAberta: true });
    const caixa = container.querySelector('.confirmacao-caixa');
    expect(caixa.contains(document.activeElement)).toBe(true); // foco entrou na confirmação
    for (let i = 0; i < 6; i += 1) pressionar('Tab');
    expect(caixa.contains(document.activeElement)).toBe(true);
    const inputDeTras = container.querySelector('input[aria-label="campo"]');
    expect(document.activeElement).not.toBe(inputDeTras);
  });

  it('sem a confirmação aberta, o Escape no <Modal> sujo dispara a guarda normalmente', () => {
    const { onCloseModal } = montar({ confirmacaoAberta: false });
    pressionar('Escape');
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar.mock.calls[0][0]).toMatchObject({ titulo: 'Descartar alterações?' });
    expect(onCloseModal).not.toHaveBeenCalled(); // confirmar resolveu false
  });
});
