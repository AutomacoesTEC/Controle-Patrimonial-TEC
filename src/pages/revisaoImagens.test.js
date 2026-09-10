import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
const ler = nome => readFileSync(new URL(nome, import.meta.url), 'utf8');
describe('Imagens da revisão: contratos de apresentação', () => {
  it('imagem 1: titularidade substitui Item e possui filtro', () => {
    const fonte = ler('./BensPage.jsx');
    expect(fonte).toContain('<th>Titularidade</th>');
    expect(fonte).toContain('aria-label="Filtrar bens por titularidade"');
    expect(fonte).not.toContain('<th>Item</th>');
    expect(fonte).toContain('colSpan={4}');
  });
  it('imagem 2: campos do topo só no cadastro novo', () => {
    const fonte = ler('../components/BemModal.jsx');
    expect(fonte).toContain('{!isEditing && camposIdentificacao}');
    expect(fonte).toContain('{camposIdentificacao}');
  });
  it('imagem 3: resultado da conciliação apresentado sem tolerância configurável (P03)', () => {
    // O bloco "hero" com título e tolerância foi removido por decisão da
    // usuária (auditoria funcional 2026-09-09, P03). O contrato agora protege
    // a APRESENTAÇÃO ATUAL do resultado, não o bloco antigo:
    const fonte = ler('./Dashboard.jsx');
    // O resultado da conciliação continua rotulado e em destaque.
    expect(fonte).toContain('Resultado da conciliação patrimonial');
    expect(fonte).toContain('demonstrativo-destaque demonstrativo-final');
    // Sem tolerância configurável para "fechar" a diferença.
    expect(fonte).not.toMatch(/Toler[âa]ncia para/);
    // A ressalva de que o número não prova saldo bancário permanece.
    expect(fonte).toContain('não comprova saldo bancário disponível');
    // E o bloco hero antigo não voltou só para deixar o teste verde.
    expect(fonte).not.toContain('saldo-hero-titulo');
  });
});
