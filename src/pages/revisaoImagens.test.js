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
  it('imagem 3: residual identificado sem tolerância configurável', () => {
    const fonte = ler('./Dashboard.jsx');
    expect(fonte).toContain('id="saldo-hero-titulo">Diferença de conciliação');
    expect(fonte).not.toContain('Tolerância para “fecha”');
    expect(fonte).toContain('Não representa saldo bancário disponível.');
  });
});
