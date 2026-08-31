// Ataque aos módulos de MONTAGEM, o irmão do ataque às conferências.
//
// São eles que transformam o quadro importado nas linhas que a tela mostra. Se
// um deles lança, a tela inteira some; se um deles descarta uma linha em
// silêncio, a pessoa confere um quadro incompleto sem saber.
//
// Exigências, e o porquê de cada uma:
//
// 1. NÃO EXPLODIR com nulo, tipo errado ou quadro pela metade.
// 2. NÃO SUMIR COM LINHA QUE TEM VALOR. Descartar uma linha porque o valor veio
//    como texto é pior que mostrá-la: o quadro fica menor do que a declaração e
//    nada avisa.
// 3. NÃO INVENTAR LINHA que a declaração não tem.
import { describe, it, expect } from 'vitest';
import { blocosResumoDeclaracao } from './resumoDeclaracao';
import { blocosEspolio, blocosSaida, modalidadeDaDeclaracao, MODALIDADES } from './modalidadeDeclaracao';
import { blocosOperacaoGanhoCapital, parcelasDaOperacao, faixasDaOperacao } from './ganhoCapitalDetalhe';
import { linhasConsolidacaoMes } from './consolidacaoRendaVariavel';
import { linhasAnualRendaVariavel, linhasAnualFiiFiagro } from './anualRendaVariavel';

const HOSTIS = [undefined, null, {}, [], 0, '', false, 'texto', 42, { qualquer: 'coisa' }];

const MONTADORES = [
  ['blocosResumoDeclaracao', blocosResumoDeclaracao],
  ['blocosEspolio', blocosEspolio],
  ['blocosSaida', blocosSaida],
  ['blocosOperacaoGanhoCapital', blocosOperacaoGanhoCapital],
  ['parcelasDaOperacao', parcelasDaOperacao],
  ['faixasDaOperacao', faixasDaOperacao],
  ['linhasConsolidacaoMes', linhasConsolidacaoMes],
  ['linhasAnualRendaVariavel', linhasAnualRendaVariavel],
  ['linhasAnualFiiFiagro', linhasAnualFiiFiagro],
];

describe('montagem sob entrada hostil', () => {
  it('nenhum montador explode', () => {
    for (const [nome, fn] of MONTADORES) {
      for (const entrada of HOSTIS) {
        expect(() => fn(entrada), `${nome} com ${JSON.stringify(entrada)}`).not.toThrow();
      }
    }
  });

  it('todos devolvem lista, sempre, para a tela poder mapear sem checar', () => {
    for (const [nome, fn] of MONTADORES) {
      for (const entrada of HOSTIS) {
        expect(Array.isArray(fn(entrada)), `${nome} com ${JSON.stringify(entrada)}`).toBe(true);
      }
    }
  });

  it('quadro desconhecido não inventa linha nenhuma', () => {
    // Um objeto com chaves que o quadro não tem não pode produzir linha: seria
    // afirmar um dado que a declaração não traz.
    for (const [nome, fn] of MONTADORES) {
      expect(fn({ inexistente: 123, outroCampo: 'x' }), nome).toEqual([]);
    }
  });
});

describe('linha com valor não pode sumir por causa do tipo', () => {
  it('resumo: valor em texto continua aparecendo', () => {
    // Dado legado, gravado antes de o app converter para número. Descartar a
    // linha faria o quadro exibido ficar menor que o da declaração, sem aviso.
    const blocos = blocosResumoDeclaracao({ modeloDeclaracao: 'completa', baseCalculo: '178100.49' });
    const devido = blocos.find(b => b.id === 'devido');
    expect(devido, 'o bloco de imposto devido deveria existir').toBeTruthy();
    const linha = devido.linhas.find(l => l.rotulo === 'Base de cálculo do imposto');
    expect(linha, 'a linha não pode sumir só porque o valor veio como texto').toBeTruthy();
    expect(linha.valor).toBeCloseTo(178100.49, 2);
  });

  it('consolidação do mês: valor em texto continua aparecendo', () => {
    const linhas = linhasConsolidacaoMes({ totalImpostoDevido: '545.56', impostoPago: 501.65 });
    expect(linhas.map(l => l.campo)).toContain('totalImpostoDevido');
    expect(linhas.find(l => l.campo === 'totalImpostoDevido').valor).toBeCloseTo(545.56, 2);
  });

  it('fechamento anual: valor em texto continua aparecendo', () => {
    const linhas = linhasAnualRendaVariavel({ resultadoLiquido: '7426.76' });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].valor).toBeCloseTo(7426.76, 2);
  });

  it('texto que não é número continua fora, porque não há o que exibir', () => {
    // "abc" não é valor: exibir isso como moeda produziria "R$ NaN" na tela.
    expect(blocosResumoDeclaracao({ modeloDeclaracao: 'completa', baseCalculo: 'abc' })).toEqual([]);
    expect(linhasConsolidacaoMes({ totalImpostoDevido: 'abc' })).toEqual([]);
    expect(linhasAnualRendaVariavel({ resultadoLiquido: '' })).toEqual([]);
  });
});

describe('modalidade sob entrada hostil', () => {
  it('nunca lança e sempre devolve uma modalidade conhecida', () => {
    for (const entrada of HOSTIS) {
      expect(() => modalidadeDaDeclaracao(entrada)).not.toThrow();
      expect(Object.values(MODALIDADES)).toContain(modalidadeDaDeclaracao(entrada));
    }
  });
});
