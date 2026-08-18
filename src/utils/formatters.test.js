import { describe, it, expect } from 'vitest';
import { formatCurrency, formatCPF, formatCNPJ, formatCpfCnpj, formatDate, describeRendimentoTipo, categoriaRendimento, describePagamentoCodigo } from './formatters';

describe('formatCpfCnpj', () => {
  it('formata 11 dígitos como CPF', () => {
    expect(formatCpfCnpj('CPF-DO-DECLARANTE-1')).toBe('CPF-DO-DECLARANTE-1');
  });
  it('formata 14 dígitos como CNPJ', () => {
    expect(formatCpfCnpj('22908713000190')).toBe('22.908.713/0001-90');
  });
  it('já formatado (com pontuação) continua reconhecendo pela contagem de dígitos', () => {
    expect(formatCpfCnpj('CPF-DO-DECLARANTE-1')).toBe('CPF-DO-DECLARANTE-1');
  });
  it('tamanho que não é nem CPF nem CNPJ devolve como veio, sem tentar adivinhar', () => {
    expect(formatCpfCnpj('123')).toBe('123');
  });
  it('vazio devolve vazio', () => {
    expect(formatCpfCnpj('')).toBe('');
    expect(formatCpfCnpj(null)).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formata em Real brasileiro', () => {
    expect(formatCurrency(1234.5)).toBe('R$ 1.234,50');
  });
  it('null/undefined/NaN viram R$ 0,00', () => {
    expect(formatCurrency(null)).toBe('R$ 0,00');
    expect(formatCurrency(undefined)).toBe('R$ 0,00');
    expect(formatCurrency(NaN)).toBe('R$ 0,00');
  });
});

describe('formatDate', () => {
  it('data ISO (YYYY-MM-DD) vira dd/mm/aaaa sem deslocar por fuso horário', () => {
    // Bug clássico: new Date('2026-03-15') é 00:00 UTC, que em horário de
    // Brasília (UTC-3) formatava como 14/03. formatDate evita isso tratando
    // string, sem passar por Date.
    expect(formatDate('2026-03-15')).toBe('15/03/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
  });
  it('vazio devolve vazio', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
  });
});

describe('describeRendimentoTipo / categoriaRendimento', () => {
  it('código conhecido tem rótulo oficial', () => {
    expect(describeRendimentoTipo('isento_09')).toMatch(/lucros e dividendos/i);
    expect(categoriaRendimento('isento_09')).toBe('isento');
  });
  it('código isento/exclusivo desconhecido cai no fallback com o número do código, não inventa rótulo', () => {
    expect(describeRendimentoTipo('isento_77')).toMatch(/código 77/);
    expect(describeRendimentoTipo('exclusivo_50')).toMatch(/código 50/);
  });
});

describe('describePagamentoCodigo', () => {
  it('código conhecido tem nome oficial', () => {
    expect(describePagamentoCodigo('10')).toBe('Médicos no Brasil');
    expect(describePagamentoCodigo('76')).toBe('Arrendamento rural');
  });
  it('código não catalogado devolve string vazia, não quebra', () => {
    expect(describePagamentoCodigo('00')).toBe('');
  });
});
