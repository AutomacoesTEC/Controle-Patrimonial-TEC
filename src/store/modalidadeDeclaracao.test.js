// Valores vindos do retorno REAL de parsePDF (AUDITORIA/saida-parsepdf), cada
// um conferido contra a linha impressa citada no comentário
// (AUDITORIA/rows-pdfjs/ESP-01.rows.txt e SAI-01.rows.txt).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  MODALIDADES, NOME_MODALIDADE, modalidadeDaDeclaracao,
  blocosEspolio, blocosSaida, bensDaPartilha, conferenciasPartilha,
} from './modalidadeDeclaracao';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const saida = (caso) => {
  const caminho = `${RAIZ}AUDITORIA/saida-parsepdf/${caso}.json`;
  return existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).resultado : null;
};
const aju = saida('AJU-01');
const esp = saida('ESP-01');
const sai = saida('SAI-01');

const bloco = (blocos, id) => blocos.find(b => b.id === id);
const valorDe = (bl, rotulo) => bl.linhas.find(l => l.rotulo === rotulo)?.valor;

describe.skipIf(!aju || !esp || !sai)('modalidade da declaração importada', () => {
  it('reconhece as três modalidades dos arquivos reais', () => {
    expect(modalidadeDaDeclaracao(aju)).toBe(MODALIDADES.AJUSTE);
    expect(modalidadeDaDeclaracao(esp)).toBe(MODALIDADES.ESPOLIO);
    expect(modalidadeDaDeclaracao(sai)).toBe(MODALIDADES.SAIDA);
    expect(NOME_MODALIDADE[modalidadeDaDeclaracao(esp)]).toBe('Declaração Final de Espólio');
  });

  it('o quadro vence o tipo impresso quando os dois discordam', () => {
    // Um arquivo cujo "Tipo de declaração" diga ajuste anual, mas que traga o
    // quadro de espólio impresso, É espólio: o quadro só existe se a ficha foi
    // impressa. O contrário faria a tela ler a partilha como patrimônio comum.
    const hibrido = {
      contribuinte: { tipoDeclaracao: 'Declaração de Ajuste Anual Original' },
      espolioOficial: esp.espolioOficial,
    };
    expect(modalidadeDaDeclaracao(hibrido)).toBe(MODALIDADES.ESPOLIO);
  });

  it('sem quadro e sem tipo, é ajuste anual', () => {
    expect(modalidadeDaDeclaracao({})).toBe(MODALIDADES.AJUSTE);
    expect(modalidadeDaDeclaracao(null)).toBe(MODALIDADES.AJUSTE);
  });
});

describe.skipIf(!esp)('quadro do espólio na tela (ESP-01)', () => {
  const blocos = blocosEspolio(esp.espolioOficial);

  it('monta os quatro blocos do quadro impresso', () => {
    expect(blocos.map(b => b.id)).toEqual(['situacao', 'decisao', 'inventariante', 'conjuge']);
  });

  it('situação, decisão judicial e inventariante (p1 r19 a r28)', () => {
    expect(valorDe(bloco(blocos, 'situacao'), 'Modalidade')).toBe('Partilha');
    expect(valorDe(bloco(blocos, 'situacao'), 'Ano do óbito')).toBe('2025');
    expect(valorDe(bloco(blocos, 'decisao'), 'Número do processo judicial')).toBe('ESP-PROC-4101');
    expect(valorDe(bloco(blocos, 'decisao'), 'Data da decisão judicial da partilha')).toBe('22/12/2025');
    expect(valorDe(bloco(blocos, 'decisao'), 'Data do trânsito em julgado')).toBe('23/12/2025');
    expect(valorDe(bloco(blocos, 'inventariante'), 'Nome')).toBe('ESP INVENTARIANTE SENTINELA');
  });

  it('os bens da partilha saem separados, com o rateio por herdeiro', () => {
    const partilhados = bensDaPartilha(esp.bens);
    expect(partilhados).toHaveLength(1);
    expect(partilhados[0].valorTransferencia).toBeCloseTo(123401.41, 2);
    // Rateio 60/40, conferido em bens[].herdeiros. É diferente da lista de
    // herdeiros do espólio inteiro, que vem no quadro.
    expect(partilhados[0].herdeiros.map(h => h.percentual)).toEqual([60, 40]);
    expect(esp.espolioOficial.herdeiros).toHaveLength(2);
  });

  it('o rateio de 60 e 40 fecha em 100, então não há aviso', () => {
    expect(conferenciasPartilha(esp.bens)).toEqual([]);
  });
});

describe.skipIf(!sai)('quadro da saída definitiva na tela (SAI-01)', () => {
  const blocos = blocosSaida(sai.saidaDefinitivaOficial);

  it('monta os dois blocos do quadro impresso (p1 r21 a r25)', () => {
    expect(blocos.map(b => b.id)).toEqual(['condicao', 'procurador']);
    expect(valorDe(bloco(blocos, 'condicao'), 'Data da caracterização da condição de não residente')).toBe('24/12/2025');
    expect(valorDe(bloco(blocos, 'condicao'), 'País de destino')).toBe('249 - ESTADOS UNIDOS DA AMÉRICA');
    expect(valorDe(bloco(blocos, 'procurador'), 'Nome')).toBe('SAI PROCURADOR SENTINELA');
  });

  it('não afirma retorno à condição de residente quando a declaração não informa', () => {
    // p1 r24 vem em branco. A linha simplesmente não aparece: exibi-la vazia
    // sugeriria que houve retorno, o oposto do que a declaração diz.
    const condicao = bloco(blocos, 'condicao');
    expect(condicao.linhas.some(l => l.rotulo === 'Data da caracterização da condição de residente no país')).toBe(false);
  });
});

describe('conferência do rateio da partilha', () => {
  it('avisa quando os percentuais dos herdeiros não fecham em 100', () => {
    const avisos = conferenciasPartilha([
      { ehPartilha: true, discriminacao: 'IMOVEL X', herdeiros: [{ percentual: 60 }, { percentual: 30 }] },
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('90.00%');
    expect(avisos[0]).toContain('IMOVEL X');
  });

  it('bem sem partilha e bem sem herdeiro não geram aviso', () => {
    expect(conferenciasPartilha([
      { ehPartilha: false, herdeiros: [{ percentual: 10 }] },
      { ehPartilha: true, herdeiros: [] },
    ])).toEqual([]);
  });
});
