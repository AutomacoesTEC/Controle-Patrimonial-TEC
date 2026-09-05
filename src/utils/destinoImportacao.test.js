import { describe, expect, it } from 'vitest';
import { avaliarDestinoImportacao } from './destinoImportacao';

describe('proteção antes de substituir ano de importação', () => {
  it('perfil inicial somente com nome não é declaração anterior, mesmo com origem legada inferida', () => {
    expect(avaliarDestinoImportacao({ origemAnoAtual: 'importacao', contribuinte: { nome: 'Sintético' } }).temImportacaoAnterior).toBe(false);
  });
  for (const campo of ['doacoesEfetuadasOficial', 'pagamentosDiversos', 'rendaVariavelMensalManual', 'fiiFiagroMensalOficial', 'dependentes']) {
    it(`exige confirmação quando só existe ${campo}`, () => {
      expect(avaliarDestinoImportacao({ [campo]: [{ id: 1, valor: 100 }] }).temDadosNoDestino).toBe(true);
    });
  }
  it('reconhece importação anterior no snapshot histórico sem patrimônio', () => {
    expect(avaliarDestinoImportacao({ origem: 'importacao', rendimentos: [{ valor: 100 }] }).temImportacaoAnterior).toBe(true);
  });
  it('ano vazio não tem dados nem importação anterior', () => {
    expect(avaliarDestinoImportacao({})).toEqual({ temDadosNoDestino: false, temImportacaoAnterior: false, origemConfiavelPorItem: true });
  });
  it('patrimônio legado sem origem não permite conciliação automática', () => {
    expect(avaliarDestinoImportacao({ bens: [{ id: 1 }] }).origemConfiavelPorItem).toBe(false);
  });
});
