import { describe, it, expect } from 'vitest';
import { formatCurrency, resumirMeses, formatCPF, formatCNPJ, formatCpfCnpj, formatDate, describeRendimentoTipo, categoriaRendimento, describePagamentoCodigo } from './formatters';

describe('formatCpfCnpj', () => {
  it('formata 11 dígitos como CPF', () => {
    expect(formatCpfCnpj('11144477735')).toBe('111.444.777-35');
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

  // Rendimento IMPORTADO chega com o código em 4 dígitos, que é como o .DBK o
  // grava e como os dois parsers o produzem; só o cadastro manual da tela usa
  // as chaves de 2 dígitos da tabela. Sem normalizar, TODO rendimento vindo de
  // arquivo caía no fallback genérico e a tabela de rótulos só valia para o
  // que fosse digitado à mão. Defeito antigo, visível desde que o caminho PDF
  // passou a importar as fichas de isentos e de tributação exclusiva.
  it('código de 4 dígitos, como vem do arquivo importado, acha o mesmo rótulo do de 2', () => {
    expect(describeRendimentoTipo('isento_0009')).toBe(describeRendimentoTipo('isento_09'));
    expect(describeRendimentoTipo('isento_0009')).toMatch(/lucros e dividendos/i);
    expect(describeRendimentoTipo('exclusivo_0006')).toMatch(/aplicações financeiras/i);
    // 0013 é o código INTERNO da Lei 14.754/2023; a ficha impressa numera essa
    // mesma linha como "12." Ver a tabela de-para em importParsers.js.
    expect(describeRendimentoTipo('exclusivo_0013')).toMatch(/14\.754/);
    expect(describeRendimentoTipo('exclusivo_0014')).toMatch(/14\.790|loteria/i);
    expect(describeRendimentoTipo('exclusivo_0012')).toMatch(/outros/i);
    expect(describeRendimentoTipo('isento_0010')).toMatch(/65 anos ou mais/i);
    // Nenhum dos dois formatos pode cair no texto genérico quando o código é
    // conhecido.
    expect(describeRendimentoTipo('isento_0009')).not.toMatch(/confira este código/);
    // E código desconhecido continua honesto nos dois formatos.
    expect(describeRendimentoTipo('isento_0077')).toMatch(/código 0077/);
    expect(categoriaRendimento('exclusivo_0013')).toBe('exclusivo');
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

// Regressão do achado B5 da auditoria de 21/08/2026: o Dashboard exibia
// "-R$ 0,00" na Variação Patrimonial Total de um período sem variação,
// porque aquela linha inverte o sinal para exibição e o Intl formata -0 com
// o sinal.
describe('formatCurrency não produz zero negativo', () => {
  it('zero negativo sai como zero', () => {
    expect(formatCurrency(-0)).toBe(formatCurrency(0));
    expect(formatCurrency(-0)).not.toContain('-');
  });

  it('inverter o sinal de um total zerado continua sem sinal', () => {
    const total = 0;
    expect(formatCurrency(-total)).not.toContain('-');
  });

  it('valor negativo de verdade continua com sinal', () => {
    expect(formatCurrency(-1904674)).toContain('-');
  });
});

// A tela listava os 12 meses um a um ("01/2025, 02/2025, ... 12/2025") para
// dizer "todos", gastando três linhas de um painel de números. Achado pela
// usuária em 21/08/2026, com captura de tela: "isso aqui é ridículo ter".
describe('resumirMeses', () => {
  const doAno = (meses, ano = 2025) => meses.map(mes => ({ mes, ano }));

  it('o ano completo vira uma expressão só', () => {
    expect(resumirMeses(doAno([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBe('o ano inteiro de 2025');
  });

  it('meses seguidos viram uma faixa', () => {
    expect(resumirMeses(doAno([1, 2, 3, 4, 5, 6]))).toBe('01 a 06/2025');
  });

  it('mês solto aparece sozinho', () => {
    expect(resumirMeses(doAno([3]))).toBe('03/2025');
  });

  it('faixas e meses soltos convivem, com "e" antes do último', () => {
    expect(resumirMeses(doAno([1, 2, 3, 7, 11]))).toBe('01 a 03, 07 e 11/2025');
  });

  it('fora de ordem e com repetição, o resumo é o mesmo', () => {
    expect(resumirMeses(doAno([3, 1, 2, 2]))).toBe('01 a 03/2025');
  });

  it('mais de um ano, cada um com seu resumo', () => {
    const lista = [...doAno([11, 12], 2024), ...doAno([1, 2], 2025)];
    expect(resumirMeses(lista)).toBe('11 a 12/2024 e 01 a 02/2025');
  });

  it('lista vazia ou com item incompleto devolve string vazia', () => {
    // Sem guarda, devolvia " e undefined": achado por este próprio teste.
    expect(resumirMeses([])).toBe('');
    expect(resumirMeses(null)).toBe('');
    expect(resumirMeses([{ mes: 3 }])).toBe('');
  });
});
