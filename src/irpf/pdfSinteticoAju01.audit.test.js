import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PDF_AJU_01 = process.env.IRPF_AJU01_PDF
  || fileURLToPath(new URL('../../output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf', import.meta.url));

const temPdf = existsSync(PDF_AJU_01);

async function extrairPaginas() {
  const bytes = await readFile(PDF_AJU_01);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const paginas = [];

  for (let numero = 1; numero <= pdf.numPages; numero += 1) {
    const pagina = await pdf.getPage(numero);
    const conteudo = await pagina.getTextContent();
    paginas.push(conteudo.items.map(item => item.str).join(' ').replace(/\s+/g, ' ').trim());
  }

  return { bytes, paginas };
}

describe.skipIf(!temPdf)('prova de cobertura do PDF sintético AJU-01', () => {
  it('fixa a identidade do documento oficial textual auditado', async () => {
    const { bytes, paginas } = await extrairPaginas();
    const hash = createHash('sha256').update(bytes).digest('hex');

    // Reancorado em 31/08/2026: o documento foi reimpresso com as fichas de
    // Ganho de Capital, doações ECA/Pessoa Idosa e demais casos preenchidos,
    // passando de 33 para 41 páginas.
    expect(hash).toBe('d2e3062006249919a8db43c52443e72e85f61ac4b07690c2ebff4611c246ce31');
    expect(paginas).toHaveLength(41);
    expect(paginas.every(texto => texto.length > 100)).toBe(true);
    expect(paginas.join(' ')).toContain('AUDITORIA PDF TEC AJUSTE');
  });

  it('prova os campos efetivamente impressos de exigibilidade suspensa', async () => {
    const { paginas } = await extrairPaginas();
    const pagina6 = paginas[5];

    for (const sentinela of [
      'AJU EXI FONTE TITULAR', '55.566.677/0001-83', '17.701,91', '7.702,92',
      'AJU EXI FONTE DEPENDENTE', '8.711,96', '3.712,97', '333.444.555-08',
    ]) {
      expect(pagina6).toContain(sentinela);
    }

    // O relatório oficial desta ficha só imprimiu rendimento e depósito.
    // Esses valores do roteiro não podem ser alegados como cobertos pelo PDF.
    for (const campoNaoImpresso of ['1.703,93', '704,94', '1.705,95', '713,98', '314,99', '615,09']) {
      expect(pagina6).not.toContain(campoNaoImpresso);
    }
  });

  it('prova os campos impressos de RRA e preserva as lacunas', async () => {
    const { paginas } = await extrairPaginas();
    const pagina6 = paginas[5];
    const pagina7 = paginas[6];

    for (const sentinela of [
      'AJU RRA TITULAR EXCLUSIVA', '31.801,01', '3.802,02', '1.803,03',
      '4.804,04', 'OPÇÃO DE TRIBUTAÇÃO: Exclusiva', 'NÚM. MESES: 11,0',
    ]) {
      expect(pagina6).toContain(sentinela);
    }

    for (const sentinela of [
      'AJU RRA DEPENDENTE AJUSTE', '9.811,06', '812,07', '313,08', '914,09',
      'OPÇÃO DE TRIBUTAÇÃO: Ajuste', '333.444.555-08',
    ]) {
      expect(pagina7).toContain(sentinela);
    }

    expect(pagina6).not.toContain('2.805,05');
    expect(pagina7).not.toContain('515,10');
  });

  it('cobre ECA, pessoa idosa e Ganho de Capital no documento reimpresso', async () => {
    // Reancorado em 31/08/2026. A versão anterior deste teste afirmava que
    // ECA/Pessoa Idosa vinham "Sem Informações" e que não havia Ganho de
    // Capital — o documento reimpresso PREENCHEU esses casos, e a extração
    // deles passou a ser testada em importParsersPdfSintetico.test.js.
    const { paginas } = await extrairPaginas();
    const texto = paginas.join(' ');

    // ECA e Pessoa Idosa agora vêm PREENCHIDAS (fundo, CNPJ e valor).
    expect(texto).toContain('DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - ECA');
    expect(texto).toContain('DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - PESSOA IDOSA');
    expect(texto).not.toMatch(/DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - ECA Sem Informações/i);
    // O Demonstrativo da Apuração do Ganho de Capital agora está presente.
    expect(texto).toContain('Demonstrativo da Apuração do Ganho de Capital');
    // Espólio e Saída Definitiva continuam sendo DECLARAÇÕES à parte (ESP-01 e
    // SAI-01), não fichas deste ajuste anual.
    expect(texto).not.toContain('DECLARAÇÃO FINAL DE ESPÓLIO');
    expect(texto).not.toContain('DECLARAÇÃO DE SAÍDA DEFINITIVA DO PAÍS');
  });
});
