import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import arquivoLayouts from './layoutArquivosIrpf2026.js';
import {
  ErroIntegridadeArquivoIrpf,
  converterCampoDbk,
  estruturarRegistrosDbk,
  obterLayoutDbk,
  validarIntegridadeArquivoIrpf,
} from './leitorRegistrosDbk.js';

function linhaVazia(tipo) {
  const registro = obterLayoutDbk(tipo);
  const chars = Array(registro.largura).fill(' ');
  if (tipo === 'IR') '    IRPF'.split('').forEach((char, i) => { chars[i] = char; });
  else tipo.split('').forEach((char, i) => { chars[i] = char; });
  return chars;
}

function preencher(chars, campo, valor) {
  const texto = String(valor).padStart(campo.tamanho, '0').slice(-campo.tamanho);
  texto.split('').forEach((char, i) => { chars[campo.posicao - 1 + i] = char; });
}

describe('layout físico dos arquivos eletrônicos', () => {
  it('mantém os layouts distintos de declaração, ano anterior e recibo', () => {
    expect(arquivoLayouts.layouts.ARQ_IRPF).toHaveLength(86);
    expect(arquivoLayouts.layouts.ARQ_IRPFANOANTERIOR).toHaveLength(85);
    expect(arquivoLayouts.layouts.ARQ_COMPLRECIBO).toHaveLength(6);
    for (const registro of Object.values(arquivoLayouts.layouts).flat()) {
      const fim = Math.max(...registro.campos.map(campo => campo.posicao + campo.tamanho - 1));
      expect(fim).toBe(registro.largura);
    }
  });

  it('converte números com decimal implícito sem perder o valor original', () => {
    expect(converterCampoDbk('0000000012345', 'N13.2')).toBe('123.45');
    expect(converterCampoDbk('             ', 'N13.2')).toBeNull();
    expect(converterCampoDbk('TEXTO   ', 'C8')).toBe('TEXTO');
  });

  it('preserva valor e posição de origem de cada campo', () => {
    const chars = linhaVazia('16');
    const cpf = obterLayoutDbk('16').campos.find(campo => campo.nome === 'NR_CPF');
    '12345678901'.split('').forEach((char, i) => { chars[cpf.posicao - 1 + i] = char; });
    const resultado = estruturarRegistrosDbk(chars.join(''));
    const campo = resultado.registros[0].campos.NR_CPF;
    expect(campo.valorOriginal).toBe('12345678901');
    expect(campo.valorConvertido).toBe('12345678901');
    expect(campo.origem).toEqual({
      formato: 'DBK', linha: 1, tipoRegistro: '16',
      posicaoInicial: cpf.posicao, posicaoFinal: cpf.posicao + cpf.tamanho - 1,
    });
    expect(resultado.problemas.some(p => p.codigo === 'trailer_t9_ausente')).toBe(true);
  });

  it('bloqueia largura, tipo desconhecido, trailer ausente e contagens divergentes', () => {
    const r16 = linhaVazia('16').join('').slice(0, -1);
    const desconhecido = `ZZ${' '.repeat(20)}`;
    const t9 = linhaVazia('T9');
    const qt16 = obterLayoutDbk('T9').campos.find(campo => campo.nome === 'QT_R16');
    const qtTotal = obterLayoutDbk('T9').campos.find(campo => campo.nome === 'QT_TOTAL');
    preencher(t9, qt16, 2);
    preencher(t9, qtTotal, 99);
    const resultado = estruturarRegistrosDbk([r16, desconhecido, t9.join('')].join('\r\n'));
    expect(resultado.integro).toBe(false);
    expect(resultado.problemas.map(p => p.codigo)).toEqual(expect.arrayContaining([
      'largura_invalida', 'tipo_desconhecido', 'contagem_t9_divergente', 'total_t9_divergente',
    ]));
  });

  const pastaAmostras = process.env.IRPF_FIXTURES_DIR
    || fileURLToPath(new URL('../../../', import.meta.url));
  // Nome do arquivo real vem do manifesto local (fora do repositório), pelo
  // mesmo motivo de importParsers.test.js: identifica uma pessoa.
  const manifestoPath = `${pastaAmostras}/declaracoes-reais.local.json`;
  const manifesto = existsSync(manifestoPath) ? JSON.parse(readFileSync(manifestoPath, 'utf8')) : null;
  const arquivoReal = manifesto?.arquivos?.dbk ? `${pastaAmostras}/${manifesto.arquivos.dbk}` : null;

  it.skipIf(!arquivoReal || !existsSync(arquivoReal))('fecha largura e trailer do DBK real emitido pelo PGD 2026', () => {
    const texto = readFileSync(arquivoReal, 'latin1');
    const resultado = validarIntegridadeArquivoIrpf(texto, 'dbk');
    expect(resultado.problemas).toEqual([]);
    expect(resultado.integro).toBe(true);
    expect(resultado.registros).toHaveLength(432);
    expect(resultado.contagens['27']).toBe(172);
  });

  it('recusa arquivo truncado com erro tipado e problemas auditáveis', () => {
    const chars = linhaVazia('16');
    expect(() => validarIntegridadeArquivoIrpf(chars.join('').slice(0, -3), 'dbk'))
      .toThrow(ErroIntegridadeArquivoIrpf);
    try {
      validarIntegridadeArquivoIrpf(chars.join('').slice(0, -3), 'dbk');
    } catch (erro) {
      expect(erro.problemas.map(p => p.codigo)).toEqual(expect.arrayContaining([
        'largura_invalida', 'trailer_t9_ausente',
      ]));
    }
  });
});
