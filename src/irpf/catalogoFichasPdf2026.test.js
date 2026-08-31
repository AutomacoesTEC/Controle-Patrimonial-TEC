import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CATALOGO_FICHAS_PDF_2026,
  FICHAS_PDF_2026_POR_PARAMETRO_JRXML,
  encontrarFichaPdf2026,
} from './catalogoFichasPdf2026';

describe('catálogo oficial de fichas do PDF IRPF 2026', () => {
  it('tem ids únicos e cobertura separada para variantes que não podem ser misturadas', () => {
    const ids = CATALOGO_FICHAS_PDF_2026.map(ficha => ficha.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'rendimentos-pj-titular', 'rendimentos-pj-dependentes',
      'rural-brasil-receitas-despesas', 'rural-exterior-receitas-despesas',
      'ganho-capital-imoveis', 'ganho-capital-moveis', 'ganho-capital-participacao', 'ganho-capital-moeda',
      'renda-variavel-titular', 'renda-variavel-dependentes',
      'fii-fiagro-titular', 'fii-fiagro-dependentes',
    ]));
  });

  it('reconhece título quebrado de exigibilidade suspensa e não confunde dependentes comuns', () => {
    expect(encontrarFichaPdf2026('RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE SUSPENSA)')?.id)
      .toBe('rendimentos-exigibilidade-dependentes');
    expect(encontrarFichaPdf2026('DEPENDENTES')?.id).toBe('dependentes');
  });

  it('não confunde palavra curta dentro da discriminação de um bem com uma ficha', () => {
    expect(encontrarFichaPdf2026('TRANSPORTES E LOGISTICA LTDA CNPJ: 05.438.223/0001-59')).toBeNull();
    expect(encontrarFichaPdf2026('TRANSPORTES')?.id).toBe('transportes');
  });

  it('reconhece o título oficial da modalidade espólio', () => {
    expect(encontrarFichaPdf2026('ESPÓLIO')?.id).toBe('inventariante');
  });

  // Três fichas que o matcher devolvia null porque o texto impresso é mais
  // longo que o padrão curto (< limiar de 24 chars) ou porque o cabeçalho real
  // é outro. Auditoria de DETECÇÃO (AUDITORIA-INDEPENDENTE-MATCHER-PDF.md).
  it('reconhece HERDEIROS / MEEIRO, que é o texto realmente impresso', () => {
    expect(encontrarFichaPdf2026('HERDEIROS / MEEIRO')?.id).toBe('herdeiros');
    // O padrão curto continua valendo se vier sozinho.
    expect(encontrarFichaPdf2026('HERDEIROS')?.id).toBe('herdeiros');
  });

  it('reconhece INFORMAÇÕES DO CÔNJUGE OU COMPANHEIRO(A), o texto impresso', () => {
    expect(encontrarFichaPdf2026('INFORMAÇÕES DO CÔNJUGE OU COMPANHEIRO(A)')?.id).toBe('conjuge');
    expect(encontrarFichaPdf2026('INFORMAÇÕES DO CÔNJUGE')?.id).toBe('conjuge');
  });

  it('reconhece o cabeçalho SAÍDA da declaração de saída definitiva', () => {
    // O cabeçalho da ficha é "SAÍDA" (5 chars); o banner do documento
    // ("DECLARAÇÃO DE SAÍDA DEFINITIVA DO PAÍS") é SUFIXO do padrão e NÃO pode
    // ser confundido com a ficha.
    expect(encontrarFichaPdf2026('SAÍDA')?.id).toBe('saida-definitiva');
    expect(encontrarFichaPdf2026('DECLARAÇÃO DE SAÍDA DEFINITIVA DO PAÍS')).toBeNull();
  });
});

// O relatório oficial de impressão (DIRPF2026.jasper, dentro do
// irpf-impressao.jar do programa da Receita) fica fora do repositório por ser
// artefato proprietário, no mesmo lugar das declarações de referência. Este
// cross-check é o que denuncia DERIVA do catálogo contra a fonte oficial: ficha
// nova ou renomeada pela Receita quebra aqui, e a falha é achado, não defeito
// do teste.
//
// Sem o arquivo, o bloco pula, como os testes que dependem das declarações
// reais. IRPF_JRXML_DIR permite apontá-lo para outro lugar.
const PASTA_JRXML_PADRAO = fileURLToPath(new URL('../../../impressao-irpf2026/jrxml/', import.meta.url));
const diretorioJrxml = process.env.IRPF_JRXML_DIR || PASTA_JRXML_PADRAO;
describe.skipIf(!diretorioJrxml || !existsSync(join(diretorioJrxml, 'DIRPF2026.jrxml')))(
  'catálogo confrontado com o relatório oficial DIRPF2026.jrxml',
  () => {
    it('mapeia todos os parâmetros de ficha declarados pelo relatório principal', () => {
      const xml = readFileSync(join(diretorioJrxml, 'DIRPF2026.jrxml'), 'utf8');
      const parametrosOficiais = [...xml.matchAll(/<parameter name="(ficha[^"]+)"/g)]
        .map(resultado => resultado[1])
        .sort();
      expect(Object.keys(FICHAS_PDF_2026_POR_PARAMETRO_JRXML).sort()).toEqual(parametrosOficiais);

      const idsCatalogados = new Set(CATALOGO_FICHAS_PDF_2026.map(item => item.id));
      const idsMapeados = Object.values(FICHAS_PDF_2026_POR_PARAMETRO_JRXML).flat();
      expect(idsMapeados.filter(id => !idsCatalogados.has(id))).toEqual([]);
    });
  },
);
