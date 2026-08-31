// Dump das LINHAS VISUAIS exatamente como parsePDF as monta (pdfjs + buildRows).
// buildRows e TOLERANCIA_LINHA copiados VERBATIM de src/pages/importParsers.js
// (linhas 2416 e 2425-2434 na versao auditada).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

const TOLERANCIA_LINHA = 2;
const buildRows = (items) => {
  const ordenados = items.filter(it => it.text.trim()).sort((a, b) => b.y - a.y);
  const linhas = [];
  for (const it of ordenados) {
    const ultima = linhas[linhas.length - 1];
    if (ultima && Math.abs(ultima.y - it.y) <= TOLERANCIA_LINHA) ultima.cells.push(it);
    else linhas.push({ y: it.y, cells: [it] });
  }
  return linhas.map(l => ({ y: Math.round(l.y), cells: l.cells.sort((a, b) => a.x - b.x) }));
};

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const ARQS = {
  'AJU-01': 'output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf',
  'ESP-01': 'output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf',
  'SAI-01': 'output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf',
};

describe('dump das linhas visuais pdfjs', () => {
  it('grava as rows por pagina', async () => {
    const destino = `${RAIZ}AUDITORIA/rows-pdfjs`;
    await mkdir(destino, { recursive: true });
    for (const [nome, rel] of Object.entries(ARQS)) {
      const bytes = await readFile(RAIZ + rel);
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const linhas = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const items = content.items
          .map(it => ({ text: it.str, x: it.transform[4], y: it.transform[5] }))
          .filter(it => it.text.trim() !== '');
        const rows = buildRows(items);
        linhas.push(`===== PAGINA ${p} ===== (${rows.length} rows)`);
        rows.forEach((row, i) => {
          const cells = row.cells.map(c => `[x=${c.x.toFixed(1)}]${c.text}`).join(' ');
          linhas.push(`p${p} r${i} y=${row.y} | ${cells}`);
        });
      }
      await writeFile(`${destino}/${nome}.rows.txt`, linhas.join('\n') + '\n');
      console.log(nome, pdf.numPages, 'paginas');
    }
  }, 300000);
});
