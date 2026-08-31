import { describe, expect, it } from 'vitest';
import { identificarArquivoFonte, resumirImportacao, sha256Arquivo } from './importacaoDeclaracao';

describe('identidade e revisão do arquivo importado', () => {
  it('calcula SHA-256 sobre os bytes originais do arquivo', async () => {
    const bytes = new TextEncoder().encode('abc').buffer;
    expect(await sha256Arquivo(bytes)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('anexa somente metadados compactos, sem persistir o arquivo binário', async () => {
    const bytes = new TextEncoder().encode('pdf de teste').buffer;
    const resultado = { documentoFonte: { formato: 'pdf', textoIntegral: 'texto' } };
    const identificado = await identificarArquivoFonte(resultado, {
      name: 'declaracao.pdf', size: bytes.byteLength, type: 'application/pdf', lastModified: 123,
    }, bytes);

    expect(identificado).not.toBe(resultado);
    expect(identificado.documentoFonte).toEqual(expect.objectContaining({
      nomeArquivo: 'declaracao.pdf',
      tamanhoBytes: bytes.byteLength,
      mimeType: 'application/pdf',
      ultimaModificacao: 123,
      arquivoOriginalPersistido: false,
    }));
    expect(identificado.documentoFonte.sha256ArquivoOriginal).toMatch(/^[a-f0-9]{64}$/);
    expect(identificado.documentoFonte.arrayBuffer).toBeUndefined();
    expect(identificado.documentoFonte.bytes).toBeUndefined();
  });

  it('recusa arquivo não vazio quando o buffer original foi destacado pelo leitor PDF', async () => {
    await expect(identificarArquivoFonte(
      { documentoFonte: { formato: 'pdf' } },
      { name: 'declaracao.pdf', size: 100, type: 'application/pdf' },
      new ArrayBuffer(0),
    )).rejects.toThrow('preservar os bytes originais');
  });

  it('resume coleções e estados sem transformar ficha parcial em completa', () => {
    const resumo = resumirImportacao({
      bens: [{ id: 1 }, { id: 2 }],
      pagamentos: [{ id: 1 }],
      apuracaoGanhoCapital: [{ id: 3 }],
      ganhosCapitalOficial: { operacoes: [{ id: 4 }] },
      impostoDevido: { impostoRestituir: 100 },
      estadoFichas: {
        'pdf:bens-e-direitos': { estado: 'parcial', motivo: 'Auditoria pendente' },
        'pdf:dependentes': { estado: 'vazia' },
        'pdf:carne-leao': { estado: 'nao_suportada' },
      },
    });

    expect(resumo.porEstado).toEqual({ parcial: 1, vazia: 1, nao_suportada: 1 });
    expect(resumo.colecoes).toEqual(expect.arrayContaining([
      expect.objectContaining({ campo: 'bens', quantidade: 2 }),
      expect.objectContaining({ campo: 'pagamentos', quantidade: 1 }),
      expect.objectContaining({ campo: 'apuracaoGanhoCapital', quantidade: 1 }),
    ]));
    expect(resumo.quadros).toEqual(expect.arrayContaining([
      { campo: 'ganhosCapitalOficial', rotulo: 'Demonstrativo de ganho de capital' },
      { campo: 'impostoDevido', rotulo: 'Resumo e cálculo do imposto' },
    ]));
    expect(resumo.alertas).toHaveLength(2);
    expect(resumo.temBloqueio).toBe(false);
  });
});
