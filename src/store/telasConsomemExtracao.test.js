// O que a EXTRAÇÃO entrega e a INTERFACE precisa consumir, provado ponta a
// ponta contra as três declarações sintéticas de `output/pdf/`.
//
// Diferente de importParsersPdfSintetico.test.js, que prova que o parser LÊ o
// valor impresso, aqui se prova o elo seguinte: que o módulo que a tela chama
// devolve aquele valor. Foi esse elo que quebrou em silêncio mais de uma vez
// nesta base (faixasTributacao, custosAquisicao e ampliacoesReformas eram
// lidos do PDF e descartados na montagem final do ganho de capital).
//
// Cada asserção cita a página e a linha visual do dump AUDITORIA/rows-pdfjs/.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePDF } from '../pages/importParsers';
import { blocosOperacaoGanhoCapital } from './ganhoCapitalDetalhe';
import { colunasDaFontePagadora, descreverTipoDemonstrativoExterior, formatarAliquotaFicha } from '../utils/formatters';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PDFS = {
  AJU: `${RAIZ}output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`,
  ESP: `${RAIZ}output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf`,
  SAI: `${RAIZ}output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf`,
};
const temPdfs = Object.values(PDFS).every(existsSync);

if (process.env.IRPF_FIXTURES_REQUIRED === '1' && !temPdfs) {
  throw new Error('IRPF_FIXTURES_REQUIRED=1 mas os PDFs sintéticos de output/pdf/ não foram encontrados');
}

const cache = new Map();
async function extrair(chave) {
  if (cache.has(chave)) return cache.get(chave);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(PDFS[chave]));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const resultado = await parsePDF(pdf, () => {}, () => {}, { validarDocumento: false });
  cache.set(chave, resultado);
  return resultado;
}

const porChave = (colunas) => Object.fromEntries(colunas.map(c => [c.chave, c]));

describe.skipIf(!temPdfs)('Rendimentos: as cinco colunas da ficha de pessoa jurídica', () => {
  let aju; let sai;
  beforeAll(async () => { aju = await extrair('AJU'); sai = await extrair('SAI'); });

  // AJU-01 p2 r7: "AJU RPJ FONTE TITULAR 51.101,11 | 5.102,12 | 4.104,14 |
  // 5.105,15 | 505,16", nas colunas do cabeçalho de p2 r5/r6.
  it('entrega à tela a previdência oficial, o 13º e o IRRF do 13º do titular', () => {
    const titular = aju.rendimentos.find(r => r.nome_fonte === 'AJU RPJ FONTE TITULAR');
    const c = porChave(colunasDaFontePagadora(titular));
    expect(c.previdencia.valor).toBe(5102.12);
    expect(c.decimoTerceiro.valor).toBe(5105.15);
    expect(c.irrfDecimoTerceiro.valor).toBe(505.16);
  });

  // AJU-01 p2 r13, ficha dos DEPENDENTES: 12.201,21 | 1.202,22 | 904,24 |
  // 1.205,25 | 105,26.
  it('entrega as mesmas três colunas na ficha dos dependentes', () => {
    const dep = aju.rendimentos.find(r => r.nome_fonte === 'AJU RPJ FONTE DEPENDENTE');
    const c = porChave(colunasDaFontePagadora(dep));
    expect(c.previdencia.valor).toBe(1202.22);
    expect(c.decimoTerceiro.valor).toBe(1205.25);
    expect(c.irrfDecimoTerceiro.valor).toBe(105.26);
  });

  // SAI-01 p1 r33: 43.201,11 | 4.202,12 | 3.203,13 | 3.604,14 | 304,15.
  it('vale também na declaração de saída definitiva', () => {
    const titular = sai.rendimentos.find(r => r.nome_fonte === 'SAI RPJ FONTE TITULAR');
    const c = porChave(colunasDaFontePagadora(titular));
    expect(c.previdencia.valor).toBe(4202.12);
    expect(c.decimoTerceiro.valor).toBe(3604.14);
    expect(c.irrfDecimoTerceiro.valor).toBe(304.15);
  });

  // RIGOR FISCAL: o 13º é tributação exclusiva, não entra na base do ajuste.
  // O valor da linha de PJ tem que continuar sendo só o rendimento recebido, e
  // o 13º tem que estar lançado À PARTE, no código 01 da ficha de tributação
  // exclusiva (AJU-01 p6 r7). Se algum dia a montagem somar os dois, o
  // rendimento tributável do ajuste anual sai inflado.
  it('mantém o 13º fora do valor tributável e o encontra inteiro na ficha exclusiva', () => {
    const titular = aju.rendimentos.find(r => r.nome_fonte === 'AJU RPJ FONTE TITULAR');
    expect(titular.valor).toBe(51101.11);
    const decimoExclusivo = aju.rendimentos.find(r => r.tipo === 'exclusivo_0001');
    expect(decimoExclusivo.valor).toBe(5105.15);
    expect(decimoExclusivo.irrf).toBe(505.16);
  });

  // Rendimento que não é de pessoa jurídica não tem estas colunas: inventar
  // linha zerada em rendimento isento poluiria a tabela inteira.
  it('não produz coluna nenhuma fora da ficha de pessoa jurídica', () => {
    const isento = aju.rendimentos.find(r => r.tipo === 'isento_0012');
    expect(colunasDaFontePagadora(isento)).toEqual([]);
  });
});

describe.skipIf(!temPdfs)('Ganho de capital: o quadro de cálculo do imposto inteiro', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  const bloco = (op, id) => blocosOperacaoGanhoCapital(op).find(b => b.id === id);
  const valorDe = (bl, rotulo) => bl.linhas.find(l => l.rotulo === rotulo)?.valor;

  // AJU-01 p20 r38 a r44: o quadro "CÁLCULO DO IMPOSTO - ALIENAÇÃO À VISTA"
  // da participação societária tem SEIS linhas, e a tela mostrava quatro.
  // Faltavam justamente as duas da compensação.
  it('mostra o IR na fonte da Lei 11.033/2004 e o imposto devido após compensação', () => {
    const participacao = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'participacao');
    const calculo = bloco(participacao, 'calculo');
    expect(valorDe(calculo, 'Imposto devido')).toBe(4106.62);
    expect(valorDe(calculo, 'IR na fonte (Lei nº 11.033/2004)')).toBe(0);
    expect(valorDe(calculo, 'Imposto devido após compensação')).toBe(4106.62);
    expect(valorDe(calculo, 'Imposto pago')).toBe(0);
  });

  // AJU-01 p18 r8, linha TOTAL da alienação a prazo: 40.998,99 recebido,
  // 0,00 de corretagem, 40.998,99 líquido, 30.611,46 de custo.
  it('mostra a corretagem e o líquido das parcelas na alienação a prazo', () => {
    const movel = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'movel');
    const calculo = bloco(movel, 'calculo');
    expect(calculo.titulo).toBe('Cálculo do imposto, alienação a prazo');
    expect(valorDe(calculo, 'Total recebido nas parcelas')).toBe(40998.99);
    expect(valorDe(calculo, 'Total da corretagem das parcelas')).toBe(0);
    expect(valorDe(calculo, 'Total líquido das parcelas')).toBe(40998.99);
    expect(valorDe(calculo, 'Total do custo de aquisição das parcelas')).toBe(30611.46);
  });

  // A operação de imóvel é à vista e a ficha dela NÃO imprime linha de
  // parcelas nem de compensação (AJU-01 p15 r31 a r35): inventar linha zerada
  // ali afirmaria um quadro que a declaração não tem.
  it('não inventa linha que a ficha do imóvel não imprime', () => {
    const imovel = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'imovel');
    const rotulos = bloco(imovel, 'calculo').linhas.map(l => l.rotulo);
    expect(rotulos).toEqual([
      'Ganho de capital total', 'Alíquota média', 'Imposto devido', 'Imposto pago',
    ]);
  });
});

describe.skipIf(!temPdfs)('Demonstrativo da Lei 14.754/2023: a coluna Tipo', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // AJU-01 p39 r14 e r15: as DUAS linhas são do bem 7, e só a coluna Tipo as
  // separa. A tabela do app não a mostrava, e as duas apareciam como "7".
  // A legenda da própria ficha está em p39 r18 a r20.
  it('separa a aplicação financeira do lucro de entidade controlada', () => {
    const linhas = aju.demonstrativoExteriorOficial;
    expect(linhas.map(l => l.bem)).toEqual([7, 7]);
    const tipos = linhas.map(l => descreverTipoDemonstrativoExterior(l.tipo));
    expect(tipos[0]).toEqual({ sigla: 'AF', descricao: 'Aplicação financeira' });
    expect(tipos[1]).toEqual({ sigla: 'LD', descricao: 'Lucros e dividendos' });
  });

  // Linha sem tipo não ganha sigla inventada: declaração antiga e o caminho
  // .DBK podem não trazer a coluna.
  it('não inventa sigla quando a linha não traz tipo', () => {
    expect(descreverTipoDemonstrativoExterior('')).toBeNull();
    expect(descreverTipoDemonstrativoExterior(undefined)).toBeNull();
  });
});

describe.skipIf(!temPdfs)('Doações efetuadas: a coluna de parcela não dedutível', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // AJU-01 p8 r15/r16 imprimem "PARC. NÃO DEDUTÍVEL" como quinta coluna, e
  // p8 r17 a r19 trazem o valor de cada doação. O campo chegava ao estado e
  // nenhuma tela o mostrava.
  it('entrega a parcela não dedutível de cada doação efetuada', () => {
    const doacoes = aju.doacoesEfetuadasOficial;
    expect(doacoes.map(d => d.codigo)).toEqual(['80', '81', '40']);
    for (const d of doacoes) expect(typeof d.parcela_nao_dedutivel).toBe('number');
    expect(doacoes.map(d => d.parcela_nao_dedutivel)).toEqual([0, 0, 0]);
  });

  // As outras duas fichas de doação NÃO têm essa coluna impressa (partidos em
  // p10 r11; ECA e pessoa idosa em p38 r47 e p39 r4), e é por isso que a
  // coluna da tela é ligada só na de doações efetuadas.
  it('as fichas de partidos e de ECA e pessoa idosa não têm esse campo', () => {
    for (const d of aju.doacoesPartidosOficial) expect(d.parcela_nao_dedutivel).toBeUndefined();
    for (const d of aju.doacoesEcaIdosoOficial) expect(d.parcela_nao_dedutivel).toBeUndefined();
  });
});

describe.skipIf(!temPdfs)('Identificação: as duas perguntas que a tela não mostrava', () => {
  let aju; let esp; let sai;
  beforeAll(async () => {
    aju = await extrair('AJU'); esp = await extrair('ESP'); sai = await extrair('SAI');
  });

  // AJU-01 p1 r9: "Houve alteração de dados cadastrais? Sim". A pergunta da
  // residência tem resposta "Não" na mesma ficha, e o parser a grava como
  // false — diferente de não informada, que fica null.
  it('lê a condição de residência e a alteração cadastral do ajuste anual', () => {
    expect(aju.contribuinte.retornoPais).toBe(false);
    expect(aju.contribuinte.alteracaoDadosCadastrais).toBe(true);
  });

  // Nas outras duas modalidades a pergunta da residência não é impressa, e o
  // valor fica NULO. A tela mostra "-" nesse caso: dizer "Não" seria afirmar
  // uma resposta que a declaração não deu.
  it('deixa a residência sem resposta onde a ficha não a imprime', () => {
    expect(esp.contribuinte.retornoPais).toBeNull();
    expect(sai.contribuinte.retornoPais).toBeNull();
    expect(esp.contribuinte.alteracaoDadosCadastrais).toBe(true);
    expect(sai.contribuinte.alteracaoDadosCadastrais).toBe(true);
  });
});

describe.skipIf(!temPdfs)('FII e Fiagro: a alíquota do imposto', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // AJU-01 p37 r16, "ALÍQUOTA DO IMPOSTO": 20,00 em maio e em junho do
  // titular. A linha era extraída e a tabela do app não a mostrava, então o
  // imposto devido (p37 r17, 360,36 em maio) aparecia sem a alíquota que o
  // produz sobre a base de 1.801,81 (p37 r13).
  it('entrega a alíquota do mês e ela formata como a ficha imprime', () => {
    const maio = aju.fiiFiagroMensalOficial.find(m => m.titular && m.mes === 5);
    expect(formatarAliquotaFicha(maio.aliquota)).toBe('20,00%');
    expect(maio.baseCalculoImposto).toBe(1801.81);
    expect(maio.impostoDevido).toBe(360.36);
    // A conta que a alíquota permite conferir, e que era invisível na tela.
    expect(Math.round(maio.baseCalculoImposto * 0.2 * 100) / 100).toBe(maio.impostoDevido);
  });

  it('não escreve alíquota onde a declaração não informou nenhuma', () => {
    expect(formatarAliquotaFicha(undefined)).toBe('');
    expect(formatarAliquotaFicha('')).toBe('');
    expect(formatarAliquotaFicha('nao é numero')).toBe('');
    // Zero impresso continua sendo zero impresso.
    expect(formatarAliquotaFicha('0,00')).toBe('0,00%');
    expect(formatarAliquotaFicha(20)).toBe('20,00%');
  });
});

describe.skipIf(!temPdfs)('Ganho de capital: as perguntas impressas na ficha', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  const perguntas = (op) => {
    const bl = blocosOperacaoGanhoCapital(op).find(b => b.id === 'perguntas');
    return Object.fromEntries((bl?.linhas || []).map(l => [l.rotulo, l.valor]));
  };

  // AJU-01 p14 r25, r26 e r33 e p15 r21. A pergunta da Lei nº 14.973/2024 é a
  // que mais pesa: respondida "Sim", o custo de aquisição do imóvel passa a
  // ser o valor atualizado com tributação definitiva, e o ganho apurado nos
  // outros blocos sai de outra conta. Nenhuma delas aparecia na tela.
  it('mostra as quatro perguntas da ficha de imóvel, inclusive a da Lei 14.973/2024', () => {
    const imovel = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'imovel');
    expect(perguntas(imovel)).toEqual({
      'A alienação foi a prazo/prestação?': 'Não',
      'Houve no imóvel alienado edificação, ampliação, reforma ou trata-se de imóvel adquirido em partes e em datas diferentes?': 'Não',
      'Bem atualizado de acordo com a Lei 14.973/2024?': 'Não',
      'Já houve alienação parcial desse bem?': 'Não',
    });
  });

  // AJU-01 p17 r15/r16/r26 e p18 r9: o bem móvel é o único a prazo, e a ficha
  // dele pergunta se a parcela final foi recebida no ano.
  it('mostra as perguntas próprias da alienação a prazo do bem móvel', () => {
    const movel = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'movel');
    expect(perguntas(movel)).toEqual({
      'Sujeito a Registro Público?': 'Não',
      'A alienação foi a prazo/prestação?': 'Sim',
      'Já houve alienação parcial desse bem?': 'Não',
      'A prestação/parcela final foi recebida em 2025?': 'Sim',
    });
  });

  // Sem perguntas impressas (é o caso do caminho .DBK), a linha da alienação
  // parcial continua no bloco de alienações anteriores, para o dado não sumir.
  it('preserva a alienação parcial anterior quando não há perguntas impressas', () => {
    const semPerguntas = { tipo: 'movel', houveAlienacaoParcialAnterior: false, ganhoAlienacoesAnteriores: 0 };
    const blocos = blocosOperacaoGanhoCapital(semPerguntas);
    expect(blocos.find(b => b.id === 'perguntas')).toBeUndefined();
    const anteriores = blocos.find(b => b.id === 'anteriores');
    expect(anteriores.linhas.find(l => l.rotulo === 'Já houve alienação parcial deste bem').valor).toBe('Não');
  });

  // E com perguntas impressas ela NÃO é repetida: a mesma pergunta em dois
  // blocos da mesma tela é ruído.
  it('não repete a alienação parcial quando a ficha já a imprimiu', () => {
    const imovel = aju.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'imovel');
    const anteriores = blocosOperacaoGanhoCapital(imovel).find(b => b.id === 'anteriores');
    expect(anteriores.linhas.map(l => l.rotulo)).toEqual(['Soma dos ganhos de alienações anteriores']);
  });
});
