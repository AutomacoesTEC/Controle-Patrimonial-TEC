// A junção entre a tabela oficial e o demonstrativo por operação.
//
// O risco que estes testes guardam foi levantado olhando a tela: a declaração
// tem dois FIAT UNO, e o que os separa é a placa. Se a junção fosse pelo nome
// do bem, dois carros virariam um. Se fosse por índice, bastaria uma lista vir
// em ordem diferente para o demonstrativo de um carro aparecer sob o outro.
import { describe, it, expect } from 'vitest';
import { linhasApuracaoGanhoCapital, resultadoDaOperacao } from './ganhoCapitalDetalhe';

const UNO_A = { id: 1, tipo: 'movel', bem: 'FIAT UNO MILLE HJT9373', custoAquisicao: 15000, valorAlienacao: 11500, ganhoCapital: 0 };
const UNO_B = { id: 2, tipo: 'movel', bem: 'FIAT/UNO PLACA LPX9E43', custoAquisicao: 21000, valorAlienacao: 18000, ganhoCapital: 0 };
const DET_A = { id: 1, tipo: 'movel', especificacao: 'FIAT UNO MILLE HJT9373', alienacaoAPrazo: true };
const DET_B = { id: 2, tipo: 'movel', especificacao: 'FIAT/UNO PLACA LPX9E43' };

describe('junção por id', () => {
  it('dois bens de nome parecido continuam sendo duas linhas, cada uma com o seu detalhe', () => {
    const linhas = linhasApuracaoGanhoCapital([UNO_A, UNO_B], [DET_A, DET_B]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0].resumo.bem).toBe('FIAT UNO MILLE HJT9373');
    expect(linhas[0].detalhe.alienacaoAPrazo).toBe(true);
    expect(linhas[1].resumo.bem).toBe('FIAT/UNO PLACA LPX9E43');
    expect(linhas[1].detalhe.alienacaoAPrazo).toBeUndefined();
  });

  it('ordem diferente entre as duas listas não troca o detalhe de lugar', () => {
    const linhas = linhasApuracaoGanhoCapital([UNO_A, UNO_B], [DET_B, DET_A]);
    expect(linhas[0].detalhe.especificacao).toBe(UNO_A.bem);
    expect(linhas[1].detalhe.especificacao).toBe(UNO_B.bem);
  });

  it('operação sem nome nenhum, como participação societária, não some', () => {
    const linhas = linhasApuracaoGanhoCapital(
      [{ id: 3, tipo: 'participacao', bem: '', ganhoCapital: 30001.01 }],
      [{ id: 3, tipo: 'participacao', especificacao: '' }],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0].detalhe).toBeTruthy();
  });

  it('operação que só existe numa das listas continua aparecendo', () => {
    const so_resumo = linhasApuracaoGanhoCapital([UNO_A], []);
    expect(so_resumo).toHaveLength(1);
    expect(so_resumo[0].detalhe).toBeNull();
    const so_detalhe = linhasApuracaoGanhoCapital([], [DET_B]);
    expect(so_detalhe).toHaveLength(1);
    expect(so_detalhe[0].resumo).toBeNull();
    const mistura = linhasApuracaoGanhoCapital([UNO_A], [DET_B]);
    expect(mistura).toHaveLength(2);
  });

  it('as chaves de render são únicas, inclusive sem id', () => {
    const linhas = linhasApuracaoGanhoCapital([{ bem: 'X' }, { bem: 'Y' }], [{ especificacao: 'Z' }]);
    expect(new Set(linhas.map(l => l.chave)).size).toBe(linhas.length);
  });

  it('entrada hostil não explode e sempre devolve lista', () => {
    for (const e of [undefined, null, {}, 0, '', 'texto', [null, undefined]]) {
      expect(() => linhasApuracaoGanhoCapital(e, e)).not.toThrow();
      expect(Array.isArray(linhasApuracaoGanhoCapital(e, e))).toBe(true);
    }
  });
});

describe('resultado da operação, sem erro de classificação fiscal', () => {
  it('alienação abaixo do custo é prejuízo', () => {
    expect(resultadoDaOperacao(UNO_A).tipo).toBe('prejuizo');
  });

  it('ganho zero com alienação ACIMA do custo não é prejuízo', () => {
    // É o caso do imóvel: a redução da Lei nº 7.713/1988 e os fatores da Lei
    // nº 11.196/2005 entram entre a alienação e o custo e podem zerar o ganho.
    const imovel = { custoAquisicao: 100601.41, valorAlienacao: 160602.42, ganhoCapital: 0 };
    expect(resultadoDaOperacao(imovel).tipo).toBe('semGanho');
    expect(resultadoDaOperacao(imovel).texto).not.toMatch(/[Pp]rejuízo/);
  });

  it('ganho positivo é ganho', () => {
    expect(resultadoDaOperacao({ ...UNO_A, ganhoCapital: 1500 }).tipo).toBe('ganho');
  });

  it('sem o ganho informado não afirma nada', () => {
    expect(resultadoDaOperacao({ bem: 'X' })).toBeNull();
    expect(resultadoDaOperacao(null)).toBeNull();
    expect(resultadoDaOperacao({ ganhoCapital: 'zero' })).toBeNull();
  });
});
