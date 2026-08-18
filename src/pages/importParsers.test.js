// Testa os parsers contra os arquivos REAIS de exemplo (declaração de
// declarante 1, exercício 2026/ano-calendário 2025),
// não contra dado sintético — é o que teria pego a regressão do ano
// cravado no código (ver commit da correção). Os arquivos moram fora do
// repositório de propósito: têm CPF e dado financeiro de uma pessoa real,
// e não fazem sentido entrar no histórico do git.
//
// Se os arquivos de exemplo não existirem (outra máquina, outra pasta),
// os testes deste arquivo pulam em vez de falhar — ver `describe.skipIf`.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { parseDBK, parsePDF } from './importParsers';

const DIR = '/home/automacaotec/PROJETOS/Planilha Eudúcio';
const DBK_PATH = `${DIR}/CPF-DO-DECLARANTE-1-IRPF-A-2026-2025-ORIGI.DBK`;
const PDF_PATH = `${DIR}/CPF-DO-DECLARANTE-1-IRPF-2026-2025-origi-imagem-declaracao.pdf`;

const temArquivos = existsSync(DBK_PATH) && existsSync(PDF_PATH);

describe.skipIf(!temArquivos)('parseDBK (arquivo real)', () => {
  it('bate os totais e a contagem contra o registro-resumo interno do próprio .DBK', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);

    expect(r.anoCalendario).toBe(2025);
    expect(r.contribuinte.cpf).toBe('CPF-DO-DECLARANTE-1');
    expect(r.bens).toHaveLength(172);
    expect(r.dividas).toHaveLength(1);
    expect(r.pagamentos).toHaveLength(24);

    const somaAnt = r.bens.reduce((s, b) => s + b.situacao_anterior, 0);
    const somaAtu = r.bens.reduce((s, b) => s + b.situacao_atual, 0);
    expect(somaAnt).toBeCloseTo(79550353.28, 2);
    expect(somaAtu).toBeCloseTo(137977220.38, 2);
  });
});

describe.skipIf(!temArquivos)('parsePDF (arquivo real, o mesmo declarante do .DBK)', () => {
  it('bate DÍGITO A DÍGITO com o .DBK — os dois caminhos de import têm que produzir o mesmo resultado', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const r = await parsePDF(pdf);

    expect(r.anoCalendario).toBe(2025);
    expect(r.contribuinte.cpf).toBe('CPF-DO-DECLARANTE-1');
    expect(r.bens).toHaveLength(172);
    expect(r.dividas).toHaveLength(1);
    expect(r.pagamentos).toHaveLength(24);

    const somaAnt = r.bens.reduce((s, b) => s + b.situacao_anterior, 0);
    const somaAtu = r.bens.reduce((s, b) => s + b.situacao_atual, 0);
    expect(somaAnt).toBeCloseTo(79550353.28, 2);
    expect(somaAtu).toBeCloseTo(137977220.38, 2);

    const somaDivAnt = r.dividas.reduce((s, d) => s + d.situacao_anterior, 0);
    const somaDivAtu = r.dividas.reduce((s, d) => s + d.situacao_atual, 0);
    expect(somaDivAnt).toBeCloseTo(36000, 2);
    expect(somaDivAtu).toBeCloseTo(36000, 2);

    const somaPag = r.pagamentos.reduce((s, p) => s + p.valor_pago, 0);
    expect(somaPag).toBeCloseTo(270991.20, 2);
  }, 30000); // PDF de 59 páginas: dá tempo do pdfjs processar
});
