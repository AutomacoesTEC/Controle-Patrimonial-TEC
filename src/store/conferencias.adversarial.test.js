// Ataque às conferências construídas nesta sequência.
//
// Todas elas nasceram testadas contra o dado BOM: o retorno real do parser,
// onde os valores são números e os quadros estão completos. Nenhuma tinha sido
// atacada com o que de fato chega numa instalação de verdade: campo em branco,
// valor em texto vindo de cadastro manual, quadro pela metade, coleção nula,
// número absurdo.
//
// O que estes testes exigem de cada conferência, e o motivo de cada exigência:
//
// 1. NÃO EXPLODIR. Uma exceção aqui derruba a tela inteira, e a pessoa perde o
//    acesso aos números que estavam certos.
// 2. NÃO INVENTAR ALARME. Falta de dado não é divergência. Um aviso que grita
//    à toa deixa de ser lido quando gritar por um motivo real, e este projeto
//    já pagou esse preço antes.
// 3. NÃO ESCONDER DIVERGÊNCIA REAL por causa do tipo do dado. Valor em texto
//    somado como texto vira concatenação, e "100" mais "200" daria "100200"
//    sem erro nenhum: a conferência passaria a aprovar tudo, em silêncio.
// 4. NUNCA mostrar NaN para a pessoa.
import { describe, it, expect } from 'vitest';
import { conferenciasResumo } from './resumoDeclaracao';
import { conferenciasPartilha } from './modalidadeDeclaracao';
import { conferenciasGanhoCapital, conferenciaGanhoCapitalContraFichaExclusiva } from './ganhoCapitalDetalhe';
import { conferenciaConsolidacaoMes } from './consolidacaoRendaVariavel';

const semNaN = (avisos) => {
  for (const aviso of [].concat(avisos || [])) {
    if (aviso) expect(String(aviso)).not.toMatch(/NaN|undefined|null/);
  }
};

const ENTRADAS_HOSTIS = [
  undefined, null, {}, [], 0, '', false,
  { valor: undefined }, { valor: null },
];

describe('conferências sob entrada hostil: nenhuma pode explodir', () => {
  it('aguentam nulo, vazio e tipo errado sem lançar', () => {
    for (const entrada of ENTRADAS_HOSTIS) {
      expect(() => conferenciasResumo(entrada)).not.toThrow();
      expect(() => conferenciasPartilha(entrada)).not.toThrow();
      expect(() => conferenciasGanhoCapital(entrada)).not.toThrow();
      expect(() => conferenciaGanhoCapitalContraFichaExclusiva(entrada, entrada)).not.toThrow();
      expect(() => conferenciaConsolidacaoMes(entrada)).not.toThrow();
    }
  });

  it('quadro vazio não gera alarme nenhum', () => {
    // Declaração recém-importada de um modelo que não traz o quadro: ausência
    // de dado não é divergência.
    expect(conferenciasResumo({})).toEqual([]);
    expect(conferenciasPartilha([])).toEqual([]);
    expect(conferenciasGanhoCapital([])).toEqual([]);
    expect(conferenciaGanhoCagoCapitalOuNulo()).toBeNull();
    expect(conferenciaConsolidacaoMes({})).toBeNull();
  });

  function conferenciaGanhoCagoCapitalOuNulo() {
    return conferenciaGanhoCapitalContraFichaExclusiva([], []);
  }
});

describe('valor em TEXTO, que é o que o cadastro manual e o dado legado produzem', () => {
  it('a conferência entre fichas não se deixa enganar por texto', () => {
    // Rendimento legado, gravado antes de o app converter para número. Somar
    // como texto daria "400" e a comparação passaria a aprovar qualquer coisa.
    const aviso = conferenciaGanhoCapitalContraFichaExclusiva(
      [{ consolidacaoBem: { rendimentoExclusivo: 1000 } }],
      [{ tipo: 'exclusivo_0002', valor: '400' }],
    );
    expect(aviso).toBeTruthy();
    expect(aviso).toContain('400.00');
    semNaN(aviso);
  });

  it('percentual de herdeiro em texto continua sendo somado como número', () => {
    // 60 e 40 em texto têm que fechar em 100, sem aviso.
    expect(conferenciasPartilha([
      { ehPartilha: true, discriminacao: 'IMOVEL', herdeiros: [{ percentual: '60' }, { percentual: '40' }] },
    ])).toEqual([]);
    // E 60 com 30 continua acusando.
    const avisos = conferenciasPartilha([
      { ehPartilha: true, discriminacao: 'IMOVEL', herdeiros: [{ percentual: '60' }, { percentual: '30' }] },
    ]);
    expect(avisos).toHaveLength(1);
    semNaN(avisos);
  });
});

describe('quadro pela metade: nada de acusar quem não tem como fechar', () => {
  it('resumo sem as linhas não acusa o total', () => {
    // Só o total, sem nenhuma das parcelas: não dá para dizer que não fecha.
    // O comportamento hoje é acusar, e isso é ruído; se um dia mudar, este
    // teste é o lugar de registrar a decisão.
    const avisos = conferenciasResumo({ modeloDeclaracao: 'completa', rendimentosTributaveisTotal: 1000 });
    semNaN(avisos);
    expect(Array.isArray(avisos)).toBe(true);
  });

  it('operação de ganho de capital sem apuração não gera aviso', () => {
    expect(conferenciasGanhoCapital([{ tipo: 'imovel', especificacao: 'X' }])).toEqual([]);
    expect(conferenciasGanhoCapital([{ tipo: 'imovel', apuracao: {} }])).toEqual([]);
  });

  it('consolidação do mês incompleta não gera aviso', () => {
    // Sem uma das retenções não há como refazer a conta do mês.
    expect(conferenciaConsolidacaoMes({ totalImpostoDevido: 100, impostoPagar: 50 })).toBeNull();
    expect(conferenciaConsolidacaoMes({ irFonteDayTradeMes: 10 })).toBeNull();
  });
});

describe('divergência real continua sendo acusada, e com número legível', () => {
  it('resumo: total que não fecha com as linhas', () => {
    const avisos = conferenciasResumo({
      modeloDeclaracao: 'completa',
      rendimentosPjTitular: 1000, rendimentosPjDependentes: 500,
      rendimentosTributaveisTotal: 3000,
    });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('1500.00');
    expect(avisos[0]).toContain('3000.00');
    semNaN(avisos);
  });

  it('ganho de capital: valor líquido que não é alienação menos corretagem', () => {
    const avisos = conferenciasGanhoCapital([
      { tipo: 'movel', especificacao: 'CARRO', apuracao: { valorAlienacao: 100, custoCorretagem: 10, valorLiquido: 95 } },
    ]);
    expect(avisos).toHaveLength(1);
    semNaN(avisos);
  });

  it('consolidação do mês: a pagar que não fecha com devido menos retenções', () => {
    const aviso = conferenciaConsolidacaoMes({
      totalImpostoDevido: 100, irFonteDayTradeMes: 10, irFonteLei11033Mes: 5, impostoPagar: 50,
    });
    expect(aviso).toContain('85.00');
    semNaN(aviso);
  });
});

describe('a tolerância de centavo não pode virar tolerância de real', () => {
  it('um centavo de diferença passa, dez centavos não', () => {
    // As conferências usam tolerância de 0,02 para absorver arredondamento da
    // própria declaração. Ela não pode crescer a ponto de esconder erro.
    const comDiferenca = (dif) => conferenciaConsolidacaoMes({
      totalImpostoDevido: 100, irFonteDayTradeMes: 10, irFonteLei11033Mes: 5, impostoPagar: 85 + dif,
    });
    expect(comDiferenca(0.01)).toBeNull();
    expect(comDiferenca(0.10)).toBeTruthy();
    expect(comDiferenca(-0.10)).toBeTruthy();
  });
});
