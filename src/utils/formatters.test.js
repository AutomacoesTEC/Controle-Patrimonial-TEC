import { describe, it, expect } from 'vitest';
import { formatCurrency, resumirMeses, formatCPF, formatCNPJ, formatCpfCnpj, formatDate, describeRendimentoTipo, categoriaRendimento, describePagamentoCodigo, descreverTitularidade, marcadoresDoBem, bemNoExterior, describeRelacaoDependencia, textoOficialRelacaoDependencia, descreverOrigemDocumento } from './formatters';

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

describe('descreverTitularidade', () => {
  it('nomeia o dependente e o alimentando, e o titular sozinho', () => {
    expect(descreverTitularidade({ titularidade: 'titular' })).toBe('Titular');
    expect(descreverTitularidade({ titularidade: 'dependente', titularidadeNome: 'AJU PES DEPENDENTE UM' }))
      .toBe('Dependente: AJU PES DEPENDENTE UM');
    expect(descreverTitularidade({ titularidade: 'alimentando', titularidadeNome: 'AJU PES ALIMENTANDO UM' }))
      .toBe('Alimentando: AJU PES ALIMENTANDO UM');
  });

  it('sem titularidade informada não afirma que o pagamento é do titular', () => {
    // Pagamento cadastrado à mão antes deste campo existir não tem o dado.
    // Assumir "Titular" mudaria a leitura fiscal de uma despesa que pode ser
    // de dependente ou de alimentando.
    expect(descreverTitularidade({})).toBe('');
    expect(descreverTitularidade({ titularidade: '' })).toBe('');
    expect(descreverTitularidade(null)).toBe('');
  });

  it('titularidade conhecida sem nome mostra só o tipo', () => {
    expect(descreverTitularidade({ titularidade: 'dependente', titularidadeNome: '  ' })).toBe('Dependente');
  });
});

describe('marcadoresDoBem', () => {
  it('marca bem do dependente com o CPF de quem é o dono', () => {
    // AJU-01, item 6: bem do dependente, CPF 333.444.555-08.
    expect(marcadoresDoBem({ beneficiario: 'Dependente', cpf_beneficiario: '33344455508', localizacao: '105' }))
      .toEqual([{ tipo: 'dependente', texto: 'Dependente: 333.444.555-08' }]);
  });

  it('marca bem no exterior pelo código do país', () => {
    // AJU-01, item 7: aplicação nos Estados Unidos, país 249.
    expect(marcadoresDoBem({ beneficiario: 'Titular', localizacao: '249', paisNome: 'ESTADOS UNIDOS DA AMÉRICA' }))
      .toEqual([{ tipo: 'exterior', texto: 'Exterior: ESTADOS UNIDOS DA AMÉRICA' }]);
  });

  it('bem do titular no Brasil não recebe marcador nenhum', () => {
    expect(marcadoresDoBem({ beneficiario: 'Titular', localizacao: '105', paisNome: 'BRASIL' })).toEqual([]);
  });

  it('bem sem país informado não é tratado como exterior', () => {
    // Bem cadastrado à mão, ou vindo de declaração antiga, não tem o campo.
    // Marcar tudo como exterior seria pior que não marcar.
    expect(bemNoExterior({})).toBe(false);
    expect(bemNoExterior({ localizacao: '', paisNome: '' })).toBe(false);
    expect(marcadoresDoBem({ beneficiario: 'Titular' })).toEqual([]);
  });

  it('acumula os dois marcadores quando o bem é do dependente e fica no exterior', () => {
    const marcas = marcadoresDoBem({ beneficiario: 'Dependente', cpf_beneficiario: '33344455508', localizacao: '249', paisNome: 'PORTUGAL' });
    expect(marcas.map(m => m.tipo)).toEqual(['dependente', 'exterior']);
  });
});

describe('describeRelacaoDependencia', () => {
  it('traduz o código cru da relação de dependência pela tabela oficial', () => {
    // Tabela oficial do programa da Receita (tabelas-irpf2026/dependencias.xml).
    // O AJU-01 usa o código 21.
    expect(describeRelacaoDependencia('21')).toBe('Filho(a) ou enteado(a) até 21 (vinte e um) anos.');
    expect(describeRelacaoDependencia('22')).toBe('Filho(a) ou enteado(a) cursando nível superior, até 24 anos');
    expect(describeRelacaoDependencia('31')).toBe('Pais, avós e bisavós com ou sem rend. até  R$ 28.467,20.');
    expect(describeRelacaoDependencia('51')).toBe('Tutor ou Curador de pessoa absolutamente incapaz');
  });

  it('guarda o texto legal completo, que é diferente do rótulo de tela', () => {
    expect(textoOficialRelacaoDependencia('23'))
      .toContain('em qualquer idade, quando a sua remuneração não exceder as deduções autorizadas por lei');
    expect(textoOficialRelacaoDependencia('23')).not.toBe(describeRelacaoDependencia('23'));
  });

  it('código desconhecido não inventa relação', () => {
    // Um exercício futuro pode acrescentar código. Devolver texto de outro
    // código mudaria a relação de dependência declarada.
    expect(describeRelacaoDependencia('99')).toBe('');
    expect(describeRelacaoDependencia('')).toBe('');
    expect(describeRelacaoDependencia(null)).toBe('');
  });
});

describe('descreverOrigemDocumento', () => {
  it('descreve a origem de um item vindo do PDF', () => {
    // AJU-01: o primeiro pagamento sai da página 7, linha 31.
    expect(descreverOrigemDocumento({ origemDocumento: { formato: 'pdf', pagina: 7, linha: 31 } }))
      .toBe('PDF, página 7, linha 31');
  });

  it('aguenta origem parcial sem inventar o que falta', () => {
    expect(descreverOrigemDocumento({ origemDocumento: { formato: 'pdf', pagina: 7 } })).toBe('PDF, página 7');
    expect(descreverOrigemDocumento({ origemDocumento: { formato: 'pdf' } })).toBe('PDF da declaração');
  });

  it('item sem origem não mostra origem nenhuma', () => {
    // Cadastro manual e itens vindos do .DBK, que ainda não marcam origem.
    // Uma origem inventada aponta a pessoa para a página errada do documento.
    expect(descreverOrigemDocumento({})).toBe('');
    expect(descreverOrigemDocumento(null)).toBe('');
    expect(descreverOrigemDocumento({ origemDocumento: { formato: 'xml' } })).toBe('');
  });

  it('já entende o formato do arquivo eletrônico, para quando ele marcar origem', () => {
    expect(descreverOrigemDocumento({ origemDocumento: { formato: 'dbk', registro: 27 } }))
      .toBe('Arquivo da declaração, registro 27');
  });
});
