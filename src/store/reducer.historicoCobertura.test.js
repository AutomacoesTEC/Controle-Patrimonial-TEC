import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const fonte = readFileSync(new URL('./reducer.js', import.meta.url), 'utf8');

function nomesDosCases(bloco) {
  return [...bloco.matchAll(/case '([^']+)'/g)].map(resultado => resultado[1]);
}

describe('cobertura estrutural do histórico de alterações', () => {
  it('classifica todo case novo como registrado ou infraestrutura sem histórico', () => {
    const blocoReducer = fonte.slice(
      fonte.indexOf('export function reducer('),
      fonte.indexOf('const CAMPO_DESCRICAO_POR_COLECAO'),
    );
    const blocoDescricoes = fonte.slice(
      fonte.indexOf('function descreverAcao('),
      fonte.indexOf('// Reducer "de verdade"'),
    );
    const acoesDoReducer = nomesDosCases(blocoReducer);
    const acoesComHistorico = new Set(nomesDosCases(blocoDescricoes));
    const infraestruturaSemHistorico = [
      'SUBSTITUIR_ESTADO_PERSISTIDO',
      'ADD_TOAST',
      'CLOSE_TOAST',
      'REMOVE_TOAST',
    ];

    const semClassificacao = acoesDoReducer.filter(acao =>
      !acoesComHistorico.has(acao) && !infraestruturaSemHistorico.includes(acao)
    );
    const exclusoesObsoletas = infraestruturaSemHistorico.filter(acao =>
      !acoesDoReducer.includes(acao) || acoesComHistorico.has(acao)
    );

    expect(semClassificacao, 'todo novo mutador deve entrar no histórico ou na exclusão explícita').toEqual([]);
    expect(exclusoesObsoletas, 'a lista de exclusão não pode esconder ação removida ou já registrada').toEqual([]);
    expect(acoesComHistorico.size + infraestruturaSemHistorico.length).toBe(acoesDoReducer.length);
  });
});
