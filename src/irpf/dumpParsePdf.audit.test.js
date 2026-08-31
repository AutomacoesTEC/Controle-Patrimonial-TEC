import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { parsePDF } from '../pages/importParsers';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const ARQS = {
  'AJU-01': 'output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf',
  'ESP-01': 'output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf',
  'SAI-01': 'output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf',
};

describe('dump da extracao real do parsePDF', () => {
  it('roda parsePDF nos tres PDFs e grava o JSON', async () => {
    const destino = `${RAIZ}AUDITORIA/saida-parsepdf`;
    await mkdir(destino, { recursive: true });
    for (const [nome, rel] of Object.entries(ARQS)) {
      const bytes = await readFile(RAIZ + rel);
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const logs = [];
      let res = null, erro = null;
      try {
        res = await parsePDF(pdf, (m, t) => logs.push(`[${t}] ${m}`), () => {}, { validarDocumento: false });
      } catch (e) { erro = String((e && e.stack) || e); }
      await writeFile(`${destino}/${nome}.json`,
        JSON.stringify({ erro, logs, resultado: res }, (k, v) => (k === 'documentoFonte' ? '[omitido]' : v), 2));
      console.log(nome, erro ? 'ERRO ' + erro.split('\n')[0] : 'ok');
    }
  }, 300000);
});
