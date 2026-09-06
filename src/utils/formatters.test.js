import { describe, it, expect } from 'vitest';
import { formatCurrency, resumirMeses, formatCPF, formatCNPJ, formatCpfCnpj, mascaraCpf, mascaraCnpj, mascaraCpfCnpj, formatDate, formatDateTime, describeRendimentoTipo, categoriaRendimento, describePagamentoCodigo, descreverTitularidade, marcadoresDoBem, bemNoExterior, describeRelacaoDependencia, textoOficialRelacaoDependencia, descreverOrigemDocumento, descreverDocumentoParticipante, codigosDoRendimento, nomeCurtoBem, CODIGOS_DIVIDA, describeDividaCodigo, CODIGOS_DEPENDENCIA, normalizarBusca, opcoesSeletorBem, filtrarOpcoesBem, decidirReaberturaAposNovoBem } from './formatters';

describe('formatCpfCnpj', () => {
  it('formata 11 dígitos como CPF', () => {
    expect(formatCpfCnpj('11144477735')).toBe('111.444.777-35');
  });
  it('formata 14 dígitos como CNPJ', () => {
    expect(formatCpfCnpj('22908713000190')).toBe('22.908.713/0001-90');
  });
  it('já formatado (com pontuação) continua reconhecendo pela contagem de dígitos', () => {
    expect(formatCpfCnpj('123.456.789-09')).toBe('123.456.789-09');
  });
  it('tamanho que não é nem CPF nem CNPJ devolve como veio, sem tentar adivinhar', () => {
    expect(formatCpfCnpj('123')).toBe('123');
  });
  it('vazio devolve vazio', () => {
    expect(formatCpfCnpj('')).toBe('');
    expect(formatCpfCnpj(null)).toBe('');
  });
});

describe('máscaras progressivas de CPF/CNPJ (digitação)', () => {
  it('mascaraCpf formata conforme os dígitos vão entrando', () => {
    expect(mascaraCpf('123')).toBe('123');
    expect(mascaraCpf('1234')).toBe('123.4');
    expect(mascaraCpf('1234567')).toBe('123.456.7');
    expect(mascaraCpf('12345678909')).toBe('123.456.789-09');
    expect(mascaraCpf('123.456.789-09')).toBe('123.456.789-09');
    // não passa de 11 dígitos
    expect(mascaraCpf('123456789091111')).toBe('123.456.789-09');
  });
  it('mascaraCnpj idem, até 14 dígitos', () => {
    expect(mascaraCnpj('22')).toBe('22');
    expect(mascaraCnpj('229087')).toBe('22.908.7');
    expect(mascaraCnpj('22908713000190')).toBe('22.908.713/0001-90');
    expect(mascaraCnpj('22.908.713/0001-90')).toBe('22.908.713/0001-90');
  });
  it('mascaraCpfCnpj escolhe pelo tamanho: até 11 é CPF, de 12 em diante é CNPJ', () => {
    expect(mascaraCpfCnpj('12345678909')).toBe('123.456.789-09');
    expect(mascaraCpfCnpj('123456789091')).toBe('12.345.678/9091');
    expect(mascaraCpfCnpj('22908713000190')).toBe('22.908.713/0001-90');
    expect(mascaraCpfCnpj('')).toBe('');
  });
  it('o valor mascarado ainda é reconhecido por formatCpfCnpj (que os testes de exibição usam)', () => {
    expect(formatCpfCnpj(mascaraCpf('12345678909'))).toBe('123.456.789-09');
    expect(formatCpfCnpj(mascaraCnpj('22908713000190'))).toBe('22.908.713/0001-90');
  });
});

describe('tabelas de código da Receita para o SeletorCodigo', () => {
  it('CODIGOS_DIVIDA é a tabela oficial tipoDividas.xml (11 a 16)', () => {
    expect(CODIGOS_DIVIDA.map(c => c.codigo)).toEqual(['11', '12', '13', '14', '15', '16']);
    expect(describeDividaCodigo('14')).toBe('Pessoas físicas');
    expect(describeDividaCodigo('16')).toBe('Outras dívidas e ônus reais');
    expect(describeDividaCodigo('99')).toBe('');
  });
  it('CODIGOS_DEPENDENCIA sai de RELACAO_DEPENDENCIA, com a redação curta', () => {
    expect(CODIGOS_DEPENDENCIA.map(c => c.codigo)).toEqual(['11', '21', '22', '23', '24', '25', '26', '31', '41', '51']);
    const c11 = CODIGOS_DEPENDENCIA.find(c => c.codigo === '11');
    expect(c11.nome).toBe(describeRelacaoDependencia('11'));
    expect(c11.nome).toBe('Companheiro(a) ou cônjuge');
  });
});

// Item F (HANDOFF-2026-09-03.md): opções/filtro do SeletorBem e a decisão de
// reabertura após cadastrar um bem novo direto da aba Ganhos de Capital.
describe('opcoesSeletorBem / filtrarOpcoesBem (SeletorBem)', () => {
  const bens = [
    {
      id: 1, grupo: '02', codigo_bem: '01', situacao_atual: 50000,
      discriminacao: 'AQUISIÇÃO DE UM VEÍCULO Q3-AUDI, PLACA ABC1234, POR R$ 200.000,00',
      movimentacoes: [],
    },
    {
      id: 2, grupo: '02', codigo_bem: '01', situacao_atual: 0,
      discriminacao: 'AQUISIÇÃO DE UM VEÍCULO GOL, PLACA XYZ9876, POR R$ 60.000,00',
      movimentacoes: [{ tipo: 'venda_total', data: '2026-05-10', valor: 60000, valorVenda: 55000 }],
    },
    {
      id: 3, grupo: '01', codigo_bem: '12', situacao_atual: 300000,
      discriminacao: 'CASA NA RUA DAS FLORES, 123',
      movimentacoes: [],
    },
  ];
  const opcoes = opcoesSeletorBem(bens);

  it('rótulo usa nomeCurtoBem, sem o preço de aquisição', () => {
    expect(opcoes[0].rotulo).toBe('Q3-AUDI');
    expect(opcoes[0].rotulo).not.toMatch(/R\$/);
  });

  it('marca "(baixado)" quando situacao_atual é 0 e há venda_total/baixa', () => {
    expect(opcoes[1].rotulo).toBe('GOL (baixado)');
    expect(opcoes[1].baixado).toBe(true);
    expect(opcoes[0].baixado).toBe(false);
  });

  it('detalhe traz grupo/código do bem e a discriminação completa', () => {
    expect(opcoes[0].detalhe).toContain('02/01');
    expect(opcoes[0].detalhe).toContain('PLACA ABC1234');
  });

  it('filtra por trecho do nome curto (rótulo), sem acento nem caixa', () => {
    const achou = filtrarOpcoesBem(opcoes, 'gol');
    expect(achou.map(o => o.id)).toEqual([2]);
  });

  it('filtra por trecho da discriminação completa (não só do rótulo)', () => {
    const achou = filtrarOpcoesBem(opcoes, 'rua das flores');
    expect(achou.map(o => o.id)).toEqual([3]);
  });

  it('filtro sem acento/caixa casa "flôres" digitado sem acento e em maiúscula', () => {
    const achou = filtrarOpcoesBem(opcoes, 'FLORES');
    expect(achou.map(o => o.id)).toEqual([3]);
  });

  it('sem termo, devolve todas as opções (não filtra)', () => {
    expect(filtrarOpcoesBem(opcoes, '')).toHaveLength(3);
  });

  it('normalizarBusca tira acento e caixa', () => {
    expect(normalizarBusca('AÇÃO')).toBe('acao');
  });
});

describe('decidirReaberturaAposNovoBem (item F, encadeia com item G)', () => {
  it('mesmo ano ativo: reabre em edição do bem recém-criado', () => {
    const bemCriado = { id: 123, discriminacao: 'BEM X' };
    const d = decidirReaberturaAposNovoBem(2026, 2026, bemCriado);
    expect(d.reabrirEdicao).toBe(true);
    expect(d.bemParaEditar).toBe(bemCriado);
    expect(d.mensagemToast).toBeNull();
  });

  it('ano diferente do ativo (ADD_EM_ANO): não reabre, avisa onde foi gravado', () => {
    const bemCriado = { id: 456, discriminacao: 'BEM Y' };
    const d = decidirReaberturaAposNovoBem(2027, 2026, bemCriado);
    expect(d.reabrirEdicao).toBe(false);
    expect(d.bemParaEditar).toBeNull();
    expect(d.mensagemToast).toMatch(/gravado no ano 2027/);
    expect(d.mensagemToast).toMatch(/continua mostrando 2026/);
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

describe('descreverDocumentoParticipante', () => {
  it('participante brasileiro aparece pelo CPF formatado', () => {
    // AJU-01: o único participante do imóvel rural, CPF 222.333.444-05.
    expect(descreverDocumentoParticipante({ cpf: '22233344405', estrangeiro: false }))
      .toEqual({ estrangeiro: false, texto: '222.333.444-05' });
  });

  it('participante estrangeiro é marcado, e não deixa a célula vazia', () => {
    // Nenhum dos três PDFs sintéticos tem participante sem CPF, então este é o
    // caminho que só o teste exercita. Célula vazia pareceria dado perdido na
    // importação, quando é o documento que não existe.
    expect(descreverDocumentoParticipante({ cpf: '', estrangeiro: true }))
      .toEqual({ estrangeiro: true, texto: 'Estrangeiro, sem CPF' });
  });

  it('a marca de estrangeiro vence um CPF que tenha sobrado no item', () => {
    expect(descreverDocumentoParticipante({ cpf: '22233344405', estrangeiro: true }).estrangeiro).toBe(true);
  });

  it('brasileiro sem CPF informado não vira estrangeiro', () => {
    expect(descreverDocumentoParticipante({ cpf: '', estrangeiro: false }))
      .toEqual({ estrangeiro: false, texto: '-' });
  });
});

describe('codigosDoRendimento', () => {
  it('zero à esquerda não é divergência', () => {
    // "0009" no arquivo e "09" na ficha são a mesma linha. Tratar isso como
    // divergência marcaria todo rendimento da declaração.
    const c = codigosDoRendimento({ codigo_rendimento: '0009', codigo_impresso: '09' });
    expect(c.divergem).toBe(false);
    expect(c.naFichaImpressa).toBe('09');
  });

  it('marca a renumeração da Lei 14.754/2023, que é divergência de verdade', () => {
    // AJU-01: o arquivo grava 0013 e a ficha imprime a linha 12.
    const lei14754 = codigosDoRendimento({ codigo_rendimento: '0013', codigo_impresso: '12' });
    expect(lei14754.divergem).toBe(true);
    expect(lei14754.naFichaImpressa).toBe('12');
    // E os prêmios de loteria, que herdaram a linha 13.
    const premios = codigosDoRendimento({ codigo_rendimento: '0014', codigo_impresso: '13' });
    expect(premios.divergem).toBe(true);
  });

  it('o código "Outros" também é renumerado na ficha', () => {
    // Interno 0026 nos isentos e 0012 nos exclusivos, ambos impressos como 99.
    expect(codigosDoRendimento({ codigo_rendimento: '0026', codigo_impresso: '99' }).divergem).toBe(true);
    expect(codigosDoRendimento({ codigo_rendimento: '0012', codigo_impresso: '99' }).divergem).toBe(true);
  });

  it('sem código impresso, o interno é o que se procura, e não há divergência', () => {
    const c = codigosDoRendimento({ codigo_rendimento: '0009' });
    expect(c.naFichaImpressa).toBe('0009');
    expect(c.divergem).toBe(false);
  });

  it('rendimento sem código nenhum não produz nada', () => {
    // Tributável de PJ não tem código de ficha: a linha é a fonte pagadora.
    expect(codigosDoRendimento({ tipo: 'tributavel_pj' })).toBeNull();
    expect(codigosDoRendimento(null)).toBeNull();
  });
});

describe('nomeCurtoBem', () => {
  // Discriminações REAIS de veículos importados (perfil da usuária), com o
  // texto de aquisição e às vezes o preço de compra logo na frente. O rótulo
  // "PERDA APURADA NA VENDA DE <isto>" ficava sem sentido e o preço de COMPRA
  // parecia o da venda. Ver o comentário da função.
  it('tira "AQUISIÇÃO DE UM VEÍCULO" e o preço de compra, sobra a identificação', () => {
    expect(nomeCurtoBem('AQUISICAO DE UM VEICULO Q3-AUDI, 2023/2024, PRETO, POR R$ 353.690,00, DE SALVACAR COM DE VEICULOS LTDA, 10.476.080/0001-00, EM 11/04/2024. VENDIDO EM 27/11/2025 POR R$ 226.200,00'))
      .toBe('Q3-AUDI');
    expect(nomeCurtoBem('AQUISICAO DE UM VEICULO RAMPAGE TDD2H22, DE FCA FIAT CHRYSLER AUTOMOVEIS, EM 28/11/2024, MAIS ACESSORIOS. VENDIDA EM 15/12/2025 POR R$ 220.000,00'))
      .toBe('RAMPAGE TDD2H22');
  });

  it('mantém marca, modelo e placa quando vêm juntos antes da primeira vírgula', () => {
    expect(nomeCurtoBem('AQUISICAO DE UM VEICULO FIAT/UNO PLACA LPX9E43, 2011/2012, AZUL, DE ANTONIO VIEIRA ROCHA 359.441.968-15, EM 16/10/23. VENDIDO EM 01/03/2025'))
      .toBe('FIAT/UNO PLACA LPX9E43');
    expect(nomeCurtoBem('AQUISICAO DE UM VEICULO FIAT UNO MILLE WAY HJT-9373, EM 16/09/2014 DE DALVA AP MACHADO'))
      .toBe('FIAT UNO MILLE WAY HJT-9373');
  });

  it('lida com a variante "AQUISIÇÃO EM dd/mm/aaaa, DE UM VEÍCULO ..."', () => {
    expect(nomeCurtoBem('AQUISICAO EM 30/06/2023, DE UM VEICULO BYD YUAN PLUS GL 310EV, 2023/2024, BRANCO, PLACA SIF6C72'))
      .toBe('BYD YUAN PLUS GL 310EV');
    expect(nomeCurtoBem('AQUISICAO EM 25/11/2025 DE UM VEICULO VOLVO XC60 T8PLUS 2025/2026, PELO VR R$ 419.950,00'))
      .toBe('VOLVO XC60 T8PLUS 2025/2026');
  });

  it('tira o prefixo de co-propriedade "NN% -" junto com o de aquisição', () => {
    expect(nomeCurtoBem('50% - AQUISICAO DE UM VEICULO CAMINHAO/C. FECHADA , VW, PLACA GTR6988, 1995/1996, BRANCO'))
      .toBe('CAMINHAO/C. FECHADA');
  });

  it('sem o padrão de veículo, corta no primeiro separador de detalhe', () => {
    expect(nomeCurtoBem('APARTAMENTO 101, EDIFICIO CENTRAL, RUA DAS FLORES 50, CENTRO')).toBe('APARTAMENTO 101');
    // Resumo curto que já vem da Apuração do Ganho de Capital passa intacto.
    expect(nomeCurtoBem('FIAT UNO MILLE HJT9373')).toBe('FIAT UNO MILLE HJT9373');
  });

  it('não estoura o tamanho, e vazio devolve vazio', () => {
    expect(nomeCurtoBem('').length).toBe(0);
    expect(nomeCurtoBem(null)).toBe('');
    expect(nomeCurtoBem('X'.repeat(200)).length).toBeLessThanOrEqual(51);
  });
});

// Regressão de 06/09/2026: as tabelas do acompanhamento mostravam o carimbo
// ISO cru ("2026-09-06T14:29:26.130Z") na coluna de data.
describe('formatDateTime', () => {
  it('mostra data brasileira com hora e nunca devolve o ISO cru', () => {
    const saida = formatDateTime('2026-09-06T14:29:26.130Z');
    expect(saida).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
    expect(saida).not.toContain('T');
    expect(saida.slice(0, 10)).toBe(new Date('2026-09-06T14:29:26.130Z').toLocaleDateString('pt-BR'));
  });
  it('data sem hora não anda um dia para trás', () => {
    expect(formatDateTime('2026-03-15')).toBe('15/03/2026');
  });
  it('vazio e texto inválido não viram Invalid Date', () => {
    expect(formatDateTime('')).toBe('');
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('sem data')).toBe('sem data');
  });
});
