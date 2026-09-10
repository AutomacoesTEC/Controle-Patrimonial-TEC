import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parsePDF } from './importParsers';
import { abrirPdfDeTeste } from '../irpf/pdfDeTeste';

describe('PDF sintético com a validação usada na importação real', () => {
  for (const nome of ['AJU-01-DECLARACAO-COMPLETA', 'ESP-01-DECLARACAO-FINAL-ESPOLIO', 'SAI-01-DECLARACAO-SAIDA-DEFINITIVA']) {
    it(nome, async () => {
      const data = new Uint8Array(await readFile(new URL(`../../output/pdf/${nome}-IRPF-2026.pdf`, import.meta.url)));
      const pdf = await abrirPdfDeTeste(data);
      try {
        const result = await parsePDF(pdf);
        expect(result.anoCalendario).toBe(2025);
        if (nome.startsWith('AJU')) {
          expect(result.receitasDespesasRuraisOficial).toHaveLength(12);
          for (const mes of result.receitasDespesasRuraisOficial) {
            expect(mes.origemDocumento).toEqual(expect.objectContaining({
              formato: 'pdf', pagina: expect.any(Number), linha: expect.any(Number),
            }));
            const pagina = result.documentoFonte.paginas.find(p => p.numero === mes.origemDocumento.pagina);
            const linha = pagina.texto.split('\n')[mes.origemDocumento.linha - 1];
            const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            expect(linha.startsWith(meses[mes.mes - 1] + ' ')).toBe(true);
            const valores = [...linha.matchAll(/-?[\d.]+,\d{2}/g)].map(([v]) => Number(v.replaceAll('.', '').replace(',', '.')));
            expect(valores).toEqual([mes.receitaBruta, mes.despesaCusteioInvestimento]);
          }
        }
        expect(Object.entries(result.estadoFichas).filter(([, f]) => f.estado === 'erro').map(([id]) => id)).toEqual([]);
      } finally {
        await pdf.cleanup();
      }
    });
  }
});

function pdfDeLinhas(linhas) {
  linhas = [['IMPOSTO SOBRE A RENDA - PESSOA FÍSICA'], ['DECLARAÇÃO DE AJUSTE ANUAL'], ['EXERCÍCIO 2026', 'ANO-CALENDÁRIO 2025'], ...linhas];
  return { numPages: 1, getPage: async () => ({
    getTextContent: async () => ({items: linhas.flatMap((linha, i) =>
      linha.map((str, j) => ({str, transform: [1, 0, 0, 1, 20 + j * 80, 800 - i * 20]}))) }),
  }) };
}

describe('Rastreabilidade rural: limites da continuação da espécie', () => {
  it.each(['Página 1 de 1', 'RECEITAS E DESPESAS - BRASIL'])('não incorpora %s ao nome', async (seguinte) => {
    const result = await parsePDF(pdfDeLinhas([
      ['MOVIMENTAÇÃO DO REBANHO - BRASIL'],
      ['Outros', '1,00', '2,00', '3,00', '1,00', '1,00', '4,00'],
      [seguinte],
    ]), undefined, undefined, { validarDocumento: false });
    expect(result.movimentacaoRebanhoOficial).toHaveLength(1);
    expect(result.movimentacaoRebanhoOficial[0]).toMatchObject({
      especieCodigo: '05', especieNome: 'Outros', estoqueInicial: 1, aquisicoes: 2,
      nascimentos: 3, consumoPerdas: 1, vendas: 1, estoqueFinal: 4,
    });
  });
  it('preserva a continuação impressa de asininos, equinos e muares', async () => {
    const result = await parsePDF(pdfDeLinhas([
      ['MOVIMENTAÇÃO DO REBANHO - BRASIL'],
      ['Asininos, equinos', '1,00', '0,00', '0,00', '0,00', '0,00', '1,00'],
      ['e muares'],
    ]), undefined, undefined, { validarDocumento: false });
    expect(result.movimentacaoRebanhoOficial[0]?.especieNome).toBe('Asininos, equinos e muares');
  });
});

describe('Participante rural na continuação de página', () => {
  it('mantém o imóvel quando o cabeçalho da mesma ficha se repete', async () => {
    const paginas = [
      pdfDeLinhas([
        ['DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - BRASIL'],
        ['11', '50,00', '1', 'IMÓVEL SINTÉTICO', '10,0', '1234567-8'],
        ['Página 1 de 2'],
      ]),
      pdfDeLinhas([
        ['DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - BRASIL'],
        ['PARTICIPANTE(S)'],
        ['PARTICIPANTE SINTÉTICO (111.444.777-35)', 'Estrangeiro: Não'],
      ]),
    ];
    const result = await parsePDF({numPages: 2, getPage: n => paginas[n - 1].getPage()}, undefined, undefined, {validarDocumento: false});
    expect(result.imoveisRurais).toHaveLength(1);
    expect(result.participantesRuraisOficial).toHaveLength(1);
    const imovel = result.imoveisRurais[0];
    expect(imovel.nomeLocalizacao).toBe('IMÓVEL SINTÉTICO');
    expect(result.participantesRuraisOficial[0]).toMatchObject({
      imovelId: imovel.id, imovelNome: imovel.nomeLocalizacao, imovelCib: imovel.cib,
      imovelChaveImportacao: imovel.chaveImportacao,
      origemDocumento: {formato: 'pdf', pagina: 2, linha: 6},
    });
  });
});

describe('Ausência de IRRF na ficha impressa', () => {
  it('mantém IRRF não informado nos detalhes e totais de isentos/exclusivos', async () => {
    const result = await parsePDF(pdfDeLinhas([
      ['RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS'],
      ['09. Lucros e dividendos recebidos', '100,00'],
      ['Beneficiário', 'CPF', 'CNPJ da Fonte', 'Nome da Fonte', 'Valor'],
      ['Titular', '111.444.777-35', '11.222.333/0001-81', 'FONTE SINTÉTICA', '100,00'],
      ['TOTAL', '100,00'],
      ['RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA / DEFINITIVA'],
      ['08. 13º salário recebido pelos dependentes', '200,00'],
      ['TOTAL', '200,00'],
    ]), undefined, undefined, {validarDocumento: false});
    expect(result.rendimentos).toHaveLength(2);
    expect(result.rendimentos.map(r => r.irrf)).toEqual([null, null]);
    expect(result.rendimentos.map(r => r.valor)).toEqual([100, 200]);
  });
});
