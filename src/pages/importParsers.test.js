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
import { parseDBK, parsePDF, normalizarCpfCnpj, isBensMetadataRow } from './importParsers';

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

// Sintéticos (não dependem dos arquivos reais) — cobrem os dois bugs
// achados numa auditoria item a item contra a declaração real acima.
describe('normalizarCpfCnpj (bug real: CPF/CNPJ do beneficiário no .DBK)', () => {
  it('reconstrói um CPF de 11 dígitos a partir do campo zero-padded do registro 26, mesmo quando o próprio CPF começa com zero', () => {
    // Campo bruto real: 5 caracteres de preenchimento (não necessariamente
    // zeros) + 11 dígitos do CPF, largura total 16.
    expect(normalizarCpfCnpj('0000009096353668')).toBe('09096353668');
  });

  it('reconstrói um CNPJ de 14 dígitos — bug real: tirar "zeros à esquerda" cortava um dígito de verdade quando o preenchimento não era só zeros', () => {
    // "00001" + "22908713000190": stripar "zeros à esquerda" na unha para
    // nesse "1" e devolve 15 dígitos errados — o certo é sempre pegar os
    // ÚLTIMOS 14 caracteres, não inferir pelo conteúdo do preenchimento.
    expect(normalizarCpfCnpj('0000122908713000190')).toBe('22908713000190');
  });

  it('campo vazio devolve string vazia', () => {
    expect(normalizarCpfCnpj('')).toBe('');
    expect(normalizarCpfCnpj('   ')).toBe('');
  });
});

describe('isBensMetadataRow (bug real: campos do formulário — endereço, cartório, veículo, CNPJ do titular — grudando na discriminação)', () => {
  const linha = (texto) => ({ cells: [{ text: texto, x: 0 }] });

  it('reconhece rótulos de campo isolados', () => {
    expect(isBensMetadataRow(linha('Bem com usufruto: Não'))).toBe(true);
    expect(isBensMetadataRow(linha('Logradouro: RUA RIO DE JANEIRO'))).toBe(true);
    expect(isBensMetadataRow(linha('Registrado no Cartório: Sim'))).toBe(true);
    expect(isBensMetadataRow(linha('CHASSI: 9BD341ACXNY761745'))).toBe(true);
  });

  it('reconhece o rótulo mesmo grudado a um pedaço de boilerplate antes dele (achado real)', () => {
    expect(isBensMetadataRow(linha('105 - BRASIL Bem com usufruto: Não'))).toBe(true);
    expect(isBensMetadataRow(linha('105 - BRASIL Titular CNPJ: 59.844.109/0001-58'))).toBe(true);
  });

  it('reconhece a pergunta fixa sobre perdas a compensar', () => {
    expect(isBensMetadataRow(linha('Possui perdas a compensar de acordo com a Lei nº 14.754, de 2023 (art. 9º)?'))).toBe(true);
  });

  it('NÃO trata texto descritivo real do bem como metadado, mesmo mencionando CNPJ sem ser um rótulo', () => {
    expect(isBensMetadataRow(linha('GALPAO URBANO'))).toBe(false);
    expect(isBensMetadataRow(linha('CONSTITUIDO EM 2023 CNPJ 34.368.882'))).toBe(false);
    expect(isBensMetadataRow(linha('APARTAMENTO SITUADO A RUA SANTA CATARINA NUMERO 1466'))).toBe(false);
  });
});
