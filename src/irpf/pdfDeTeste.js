import { fileURLToPath } from 'node:url';

// Abertura de PDF para os testes que leem um arquivo real (build legacy do
// pdf.js, que roda em Node).
//
// `standardFontDataUrl` aponta para as fontes-padrão que vêm no pacote. Sem
// ele, cada `getTextContent()` emite
//   "Ensure that the standardFontDataUrl API parameter is provided"
// e, sob o paralelismo do Vitest, o carregamento de fonte às vezes estoura
// com STACK_TRACE_ERROR — os dois testes de PDF sintético falhavam de forma
// intermitente na suíte completa e passavam quando rodados isolados (OBS-T1
// da auditoria funcional 2026-09-09). `disableFontFace` + `isEvalSupported:
// false` mantêm a leitura inteiramente em Node, sem depender de DOM.
const STANDARD_FONT_DATA_URL = fileURLToPath(
  new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url),
);

export async function abrirPdfDeTeste(data) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({
    data,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    disableFontFace: true,
    isEvalSupported: false,
  }).promise;
}
