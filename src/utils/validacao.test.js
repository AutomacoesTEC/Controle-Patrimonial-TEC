import { describe, it, expect } from 'vitest';
import { primeiroCampoVazio, primeiroValorZerado, mensagemObrigatorio } from './validacao';

describe('primeiroCampoVazio', () => {
  it('devolve o rótulo do primeiro campo vazio, na ordem da tela', () => {
    expect(primeiroCampoVazio([['Código', '13'], ['Discriminação', '']])).toBe('Discriminação');
    expect(primeiroCampoVazio([['Código', ''], ['Discriminação', '']])).toBe('Código');
  });

  it('espaço em branco não conta como preenchido', () => {
    expect(primeiroCampoVazio([['Discriminação', '   ']])).toBe('Discriminação');
  });

  it('null e undefined contam como vazio', () => {
    expect(primeiroCampoVazio([['Nome', null]])).toBe('Nome');
    expect(primeiroCampoVazio([['Nome', undefined]])).toBe('Nome');
  });

  it('devolve null quando está tudo preenchido', () => {
    expect(primeiroCampoVazio([['Código', '13'], ['Discriminação', 'Casa']])).toBeNull();
  });

  it('zero é um valor legítimo aqui, quem trata dinheiro é primeiroValorZerado', () => {
    expect(primeiroCampoVazio([['Situação anterior', 0]])).toBeNull();
  });
});

describe('primeiroValorZerado', () => {
  it('trata zero, vazio e texto inválido como não preenchido', () => {
    expect(primeiroValorZerado([['Valor', 0]])).toBe('Valor');
    expect(primeiroValorZerado([['Valor', '']])).toBe('Valor');
    expect(primeiroValorZerado([['Valor', 'abc']])).toBe('Valor');
  });

  it('aceita número e texto numérico', () => {
    expect(primeiroValorZerado([['Valor', 1500]])).toBeNull();
    expect(primeiroValorZerado([['Valor', '1500']])).toBeNull();
  });

  it('valor negativo é preenchido, não vazio', () => {
    expect(primeiroValorZerado([['Valor', -50]])).toBeNull();
  });
});

describe('mensagemObrigatorio', () => {
  it('monta uma frase direta com o nome do campo', () => {
    expect(mensagemObrigatorio('Discriminação')).toBe('Preencha o campo Discriminação antes de salvar.');
  });
});
