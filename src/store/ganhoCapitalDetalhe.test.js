// Valores vindos do retorno REAL de parsePDF (AUDITORIA/saida-parsepdf), cada
// um conferido contra a linha impressa citada no comentário
// (AUDITORIA/rows-pdfjs/AJU-01.rows.txt).
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  blocosOperacaoGanhoCapital, parcelasDaOperacao, faixasDaOperacao,
  conferenciasGanhoCapital, NOME_FICHA_GC,
} from './ganhoCapitalDetalhe';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const caminho = `${RAIZ}AUDITORIA/saida-parsepdf/AJU-01.json`;
const aju = existsSync(caminho) ? JSON.parse(readFileSync(caminho, 'utf8')).resultado : null;
const ops = aju?.ganhosCapitalOficial?.operacoes || [];
const doTipo = (t) => ops.find(o => o.tipo === t);

const bloco = (blocos, id) => blocos.find(b => b.id === id);
const valorDe = (bl, rotulo) => bl.linhas.find(l => l.rotulo === rotulo)?.valor;

describe.skipIf(!aju)('demonstrativo de ganho de capital, operação a operação', () => {
  it('imóvel: a cadeia de reduções aparece inteira, do resultado 1 ao 5', () => {
    // É o ponto desta tela. Entre "alienação menos custo" e o ganho tributável
    // entram a redução da Lei 7.713/1988 e os dois fatores da Lei 11.196/2005.
    // AJU-01 p15 r4 a r20.
    const b = bloco(blocosOperacaoGanhoCapital(doTipo('imovel')), 'apuracao');
    expect(valorDe(b, 'Valor de alienação')).toBeCloseTo(160602.42, 2);
    expect(valorDe(b, 'Custo de corretagem')).toBeCloseTo(5603.43, 2);
    expect(valorDe(b, 'Valor líquido da alienação')).toBeCloseTo(154998.99, 2);
    expect(valorDe(b, 'Ganho de capital, resultado 1')).toBeCloseTo(54397.58, 2);
    // Zeradas nesta operação, e mesmo assim exibidas: a declaração as imprime
    // (p15 r10 a r19), e é contra ela que se confere.
    expect(valorDe(b, 'Valor de redução (Lei nº 7.713/1988)')).toBe(0);
    expect(valorDe(b, 'Valor de redução (Lei nº 11.196/2005, FR1)')).toBe(0);
    expect(valorDe(b, 'Valor de redução (Lei nº 11.196/2005, FR2)')).toBe(0);
    expect(valorDe(b, 'Ganho de capital, resultado 5')).toBeCloseTo(54397.58, 2);
    const percentual = b.linhas.find(l => l.rotulo === 'Percentual de redução (Lei nº 7.713/1988)');
    expect(percentual.formato).toBe('percentual');
  });

  it('móvel e participação NÃO recebem a cadeia de reduções', () => {
    // Só o ganho de capital de imóvel tem essas reduções. Exibi-las nas outras
    // famílias sugeriria um benefício que elas não têm.
    for (const tipo of ['movel', 'participacao']) {
      const b = bloco(blocosOperacaoGanhoCapital(doTipo(tipo)), 'apuracao');
      expect(b.linhas.some(l => /Lei nº 7.713/.test(l.rotulo))).toBe(false);
      expect(b.linhas.some(l => /Lei nº 11.196/.test(l.rotulo))).toBe(false);
      expect(valorDe(b, 'Ganho de capital')).toBeGreaterThan(0);
    }
  });

  it('imposto devido e imposto pago ficam no mesmo bloco de cálculo, sem virar um número só', () => {
    // AJU-01 p15 r32 a r35, alienação à vista do imóvel.
    const b = bloco(blocosOperacaoGanhoCapital(doTipo('imovel')), 'calculo');
    expect(b.titulo).toBe('Cálculo do imposto, alienação à vista');
    expect(valorDe(b, 'Ganho de capital total')).toBeCloseTo(54397.58, 2);
    expect(valorDe(b, 'Alíquota média')).toBeCloseTo(15, 2);
    expect(valorDe(b, 'Imposto devido')).toBeCloseTo(8159.63, 2);
    expect(valorDe(b, 'Imposto pago')).toBe(0);
  });

  it('a alienação a prazo é rotulada como tal e traz as parcelas com imposto proporcional', () => {
    const movel = doTipo('movel');
    expect(movel.alienacaoAPrazo).toBe(true);
    expect(bloco(blocosOperacaoGanhoCapital(movel), 'calculo').titulo)
      .toBe('Cálculo do imposto, alienação a prazo');
    const parcelas = parcelasDaOperacao(movel);
    expect(parcelas).toHaveLength(3);
    // No parcelado o imposto é devido conforme o recebimento: cada parcela tem
    // ganho e imposto próprios, e a soma é que fecha o total da operação.
    expect(parcelas[0]).toMatchObject({
      numero: 1, valorRecebido: 13666.33, ganhoCapitalProporcional: 3462.51, impostoDevido: 519.37,
    });
    const somaImposto = parcelas.reduce((s, p) => s + p.impostoDevido, 0);
    expect(somaImposto).toBeCloseTo(movel.calculoImposto.impostoDevido, 1);
  });

  it('a tabela de faixas sai com as quatro alíquotas e a linha TOTAL', () => {
    // AJU-01 p15 r26 a r30.
    const faixas = faixasDaOperacao(doTipo('imovel'));
    expect(faixas).toHaveLength(5);
    expect(faixas[0]).toMatchObject({ aliquota: '15%', total: 54397.58, anterior: 0, atual: 54397.58 });
    expect(faixas[1].aliquota).toBe('17,5%');
    expect(faixas[3].aliquota).toBe('22,5%');
    expect(faixas[4]).toMatchObject({ rotulo: 'TOTAL', ehTotal: true, total: 54397.58 });
  });

  it('identificação traz o que cada família tem, e só isso', () => {
    const imovel = bloco(blocosOperacaoGanhoCapital(doTipo('imovel')), 'identificacao');
    expect(valorDe(imovel, 'Bem')).toBe('AJU GCI IMOVEL URBANO SENTINELA');
    expect(valorDe(imovel, 'Endereço')).toContain('RUA AJU GCI IMOVEL 2901');
    expect(imovel.linhas.some(l => l.rotulo === 'Sociedade')).toBe(false);

    const part = bloco(blocosOperacaoGanhoCapital(doTipo('participacao')), 'identificacao');
    expect(valorDe(part, 'Sociedade')).toBe('AJU GCP EMPRESA SENTINELA');
    expect(valorDe(part, 'Município e UF da sociedade')).toBe('SAO PAULO / SP');
    expect(valorDe(part, 'Espécie')).toBe('QUOTAS');
  });

  it('as contas do demonstrativo fecham, então não há aviso', () => {
    expect(conferenciasGanhoCapital(ops)).toEqual([]);
  });
});

describe('conferências do demonstrativo', () => {
  it('avisa quando o valor líquido não é a alienação menos a corretagem', () => {
    const avisos = conferenciasGanhoCapital([
      { tipo: 'movel', especificacao: 'CARRO X', apuracao: { valorAlienacao: 100, custoCorretagem: 10, valorLiquido: 95 } },
    ]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('CARRO X');
  });

  it('avisa quando o fim da cadeia de reduções não fecha com o ganho, só no imóvel', () => {
    const base = { especificacao: 'IMOVEL Y', apuracao: { valorAlienacao: 100, custoCorretagem: 0, valorLiquido: 100, resultado5: 80, ganhoCapital: 50 } };
    expect(conferenciasGanhoCapital([{ ...base, tipo: 'imovel' }])).toHaveLength(1);
    // Móvel não tem cadeia de reduções: cobrar resultado5 dele seria inventar
    // uma regra que a ficha não tem.
    expect(conferenciasGanhoCapital([{ ...base, tipo: 'movel' }])).toEqual([]);
  });

  it('avisa quando as parcelas não somam o total informado', () => {
    const avisos = conferenciasGanhoCapital([{
      tipo: 'movel', especificacao: 'MOTO Z',
      parcelas: [{ valorRecebido: 100 }, { valorRecebido: 100 }],
      calculoImposto: { totalRecebidoParcelas: 500 },
    }]);
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toContain('200.00');
  });

  it('sem operação nenhuma, nada a montar e nada a avisar', () => {
    expect(blocosOperacaoGanhoCapital(null)).toEqual([]);
    expect(parcelasDaOperacao(null)).toEqual([]);
    expect(faixasDaOperacao(null)).toEqual([]);
    expect(conferenciasGanhoCapital([])).toEqual([]);
    expect(NOME_FICHA_GC.imovel).toBe('Bens imóveis');
  });
});
