import { describe, it, expect, vi } from 'vitest';
import { tratarTeclaConfirmacao } from './ConfirmacaoModal';

// P09 / P10 da auditoria funcional 2026-09-09. A confirmação abre POR CIMA de
// outro <Modal>; enquanto ela está aberta, Escape/Enter/Tab não podem alcançar
// o modal de trás. `tratarTeclaConfirmacao` é a lógica de teclado extraída do
// componente para poder ser testada sem DOM.

const evento = (over = {}) => ({
  key: 'Escape',
  shiftKey: false,
  stopPropagation: vi.fn(),
  preventDefault: vi.fn(),
  ...over,
});

// Elemento focável de mentira.
function foco(nome) {
  return { nome, focus: vi.fn(), getClientRects: () => [{}] };
}

// "Caixa" de mentira com uma lista de focáveis.
function caixaCom(...itens) {
  const set = new Set(itens);
  return {
    focus: vi.fn(),
    contains: (el) => set.has(el),
    querySelectorAll: () => itens,
  };
}

describe('tratarTeclaConfirmacao (P09/P10)', () => {
  it('P09: Escape consome o evento (stopPropagation + preventDefault) e cancela', () => {
    const onCancelar = vi.fn();
    const e = evento({ key: 'Escape' });
    tratarTeclaConfirmacao(e, { caixa: caixaCom(), ativo: null, onCancelar, onConfirmar: vi.fn() });
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(e.preventDefault).toHaveBeenCalled();
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('P10: Tab consome o evento e confina o foco na confirmação', () => {
    const primeiro = foco('cancelar');
    const ultimo = foco('confirmar');
    const caixa = caixaCom(primeiro, ultimo);
    // Foco no último -> Tab volta para o primeiro.
    const e1 = evento({ key: 'Tab' });
    tratarTeclaConfirmacao(e1, { caixa, ativo: ultimo, onCancelar: vi.fn(), onConfirmar: vi.fn() });
    expect(e1.stopPropagation).toHaveBeenCalled();
    expect(e1.preventDefault).toHaveBeenCalled();
    expect(primeiro.focus).toHaveBeenCalled();
    // Shift+Tab no primeiro -> vai para o último.
    const e2 = evento({ key: 'Tab', shiftKey: true });
    tratarTeclaConfirmacao(e2, { caixa, ativo: primeiro, onCancelar: vi.fn(), onConfirmar: vi.fn() });
    expect(ultimo.focus).toHaveBeenCalled();
    // Foco fora da caixa (num controle do modal de trás) -> Tab traz de volta.
    const e3 = evento({ key: 'Tab' });
    tratarTeclaConfirmacao(e3, { caixa, ativo: foco('do-modal-de-tras'), onCancelar: vi.fn(), onConfirmar: vi.fn() });
    expect(e3.preventDefault).toHaveBeenCalled();
  });

  it('Tab sempre chama stopPropagation, mesmo sem focáveis', () => {
    const caixa = caixaCom();
    const e = evento({ key: 'Tab' });
    tratarTeclaConfirmacao(e, { caixa, ativo: null, onCancelar: vi.fn(), onConfirmar: vi.fn() });
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(caixa.focus).toHaveBeenCalled();
  });

  it('Enter fora de um controle da confirmação confirma; sobre um botão, deixa o clique do botão agir', () => {
    const botao = foco('confirmar');
    const caixa = caixaCom(botao);
    const onConfirmarA = vi.fn();
    tratarTeclaConfirmacao(evento({ key: 'Enter' }), { caixa, ativo: caixa, onCancelar: vi.fn(), onConfirmar: onConfirmarA });
    expect(onConfirmarA).toHaveBeenCalledTimes(1);
    const onConfirmarB = vi.fn();
    const e = evento({ key: 'Enter' });
    tratarTeclaConfirmacao(e, { caixa, ativo: botao, onCancelar: vi.fn(), onConfirmar: onConfirmarB });
    expect(e.stopPropagation).toHaveBeenCalled();
    expect(onConfirmarB).not.toHaveBeenCalled();
  });

  it('teclas comuns não são consumidas', () => {
    const e = evento({ key: 'a' });
    tratarTeclaConfirmacao(e, { caixa: caixaCom(), ativo: null, onCancelar: vi.fn(), onConfirmar: vi.fn() });
    expect(e.stopPropagation).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});
