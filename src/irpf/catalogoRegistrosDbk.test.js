import { describe, expect, it } from 'vitest';
import {
  CATALOGO_REGISTROS_DBK,
  CATALOGO_REGISTROS_DBK_POR_TIPO,
  MODULOS_IRPF,
  SEPARADORES_CHAVE_ESTAVEL,
  SITUACOES_REGISTRO,
  obterRegistroDbk,
} from './catalogoRegistrosDbk.js';
import layoutDbk2026 from './layoutDbk2026.js';

const TIPOS_OFICIAIS = [
  ...Array.from({ length: 28 }, (_, indice) => String(indice + 16)),
  ...Array.from({ length: 34 }, (_, indice) => String(indice + 45)),
  ...Array.from({ length: 20 }, (_, indice) => String(indice + 80)),
  'DR', 'FR', 'HC', 'HR', 'IR', 'MC', 'NC', 'R9', 'RC', 'T9', 'TC', 'VC',
];

describe('catálogo oficial de registros DIRPF 2026', () => {
  it('contém exatamente os 94 tipos únicos documentados no layout', () => {
    const tipos = CATALOGO_REGISTROS_DBK.map(({ tipo }) => tipo);

    expect(tipos).toHaveLength(94);
    expect(new Set(tipos).size).toBe(94);
    expect([...tipos].sort()).toEqual([...TIPOS_OFICIAIS].sort());
    expect(Object.keys(CATALOGO_REGISTROS_DBK_POR_TIPO)).toHaveLength(94);
  });

  it('expõe todos os contratos obrigatórios em cada tipo', () => {
    const modulosValidos = new Set(Object.values(MODULOS_IRPF));
    const situacoesValidas = new Set(Object.values(SITUACOES_REGISTRO));

    for (const registro of CATALOGO_REGISTROS_DBK) {
      expect(registro.tipo).toMatch(/^(?:\d{2}|[A-Z][A-Z0-9])$/);
      expect(registro.ficha.length).toBeGreaterThan(0);
      expect(modulosValidos.has(registro.modulo)).toBe(true);
      expect(registro.formatos.documentadosNoLayout).toEqual(['DBK', 'DEC', 'F2B']);
      expect(Array.isArray(registro.formatos.importacaoEstruturadaAtual)).toBe(true);
      expect(registro.campos.quantidade).toBeGreaterThan(0);
      expect(registro.campos.largura).toBeGreaterThan(1);
      expect(registro.campos.posicaoInicial).toBe(1);
      expect(registro.campos.posicaoFinal).toBe(registro.campos.largura);
      expect(registro.campos.fonte).toBe('LAYOUT-DBK-OFICIAL.md');
      expect(registro.campos.secao).toBe(`Registro ${registro.tipo}`);
      expect(registro.cardinalidade.length).toBeGreaterThan(0);
      expect(registro.chaveEstavel.length).toBeGreaterThan(0);
      expect(registro.efeitoFiscal.length).toBeGreaterThan(0);
      expect(registro.politicaRetificacao.length).toBeGreaterThan(0);
      expect(registro.exportacao.formatosEletronicosDoLayout).toEqual(['DBK', 'DEC', 'F2B']);
      expect(registro.exportacao.situacaoAtual).toBe('nao_auditada');
      expect(situacoesValidas.has(registro.situacaoAtual)).toBe(true);
    }
  });

  it('mantém estrutura e chaves estáveis aderentes aos campos oficiais gerados', () => {
    const layoutPorTipo = new Map(
      layoutDbk2026.registros.map((registro) => [registro.tipo, registro]),
    );
    const separadoresEscapados = SEPARADORES_CHAVE_ESTAVEL
      .map((separador) => separador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('');
    const expressaoChave = new RegExp(
      `^[A-Z0-9_]+(?:[${separadoresEscapados}][A-Z0-9_]+)*$`,
    );
    const separarChave = new RegExp(`[${separadoresEscapados}]`);

    expect(SEPARADORES_CHAVE_ESTAVEL).toEqual(['+']);
    expect(layoutPorTipo.size).toBe(94);

    for (const registro of CATALOGO_REGISTROS_DBK) {
      const registroLayout = layoutPorTipo.get(registro.tipo);
      const nomesCampos = new Set(registroLayout.campos.map(({ nome }) => nome));

      expect(registroLayout).toBeDefined();
      expect(registro.campos.quantidade).toBe(registroLayout.quantidadeCamposDeclarada);
      expect(registro.campos.largura).toBe(registroLayout.larguraDeclarada);
      expect(registro.chaveEstavel).toMatch(expressaoChave);
      for (const campo of registro.chaveEstavel.split(separarChave)) {
        expect(nomesCampos.has(campo), `${registro.tipo}: campo de chave ${campo}`).toBe(true);
      }
    }
  });

  it('não promove cobertura parcial ou preservada a ficha completa', () => {
    expect(obterRegistroDbk('16').situacaoAtual).toBe(SITUACOES_REGISTRO.PARCIAL);
    expect(obterRegistroDbk('19').situacaoAtual)
      .toBe(SITUACOES_REGISTRO.PRESERVADO_SEM_MODELAGEM);
    expect(obterRegistroDbk('17').situacaoAtual)
      .toBe(SITUACOES_REGISTRO.NAO_IMPLEMENTADO);
    expect(obterRegistroDbk('T9').formatos.importacaoEstruturadaAtual).toEqual([]);
    expect(obterRegistroDbk('inexistente')).toBeNull();
  });

  it('classifica corretamente os registros apontados pela auditoria', () => {
    expect(obterRegistroDbk('42').chaveEstavel).toContain('NR_CPF_DEPEN');
    expect(obterRegistroDbk('49')).toMatchObject({
      ficha: 'Rendimentos de trabalho não assalariado de PF',
      modulo: MODULOS_IRPF.RENDIMENTOS,
      efeitoFiscal: 'entrada_caixa',
    });
    expect(obterRegistroDbk('NC').chaveEstavel).toBe('NR_DISTRIBUICAO+DT_VENCIMENTO');
    expect(obterRegistroDbk('31').ficha)
      .toBe('Pensão e proventos de aposentadoria ou reforma por moléstia grave ou acidente');
    expect(obterRegistroDbk('56').ficha)
      .toBe('Receitas, despesas e resultado rural no exterior por país');
  });

  it('evita colisão do registro 49 quando muda o titular do pagamento', () => {
    const registro = obterRegistroDbk('49');
    const [primeiro, segundo] = registro.auditoriaContrato.fixtureColisaoEvitada;
    const chave = (campos, item) => campos.map((campo) => item[campo]).join('|');
    const chaveSemTitularPagamento = [
      'NR_CPF_DEPENDENTE', 'NR_MES', 'NR_CPF_BENEFIC',
    ];
    const chaveOficial = registro.chaveEstavel.split('+');

    expect(chave(primeiro && chaveSemTitularPagamento, primeiro))
      .toBe(chave(chaveSemTitularPagamento, segundo));
    expect(chave(chaveOficial, primeiro)).not.toBe(chave(chaveOficial, segundo));
    expect(chaveOficial).toContain('NR_CPF_TITULAR_PAGAMENTO');
  });

  it('documenta e valida decisões críticas de chave e cardinalidade', () => {
    const layoutPorTipo = new Map(
      layoutDbk2026.registros.map((registro) => [registro.tipo, registro]),
    );
    const tiposComContratoCritico = ['16', '22', '27', '42', '49', '54', 'IR', 'T9'];

    for (const tipo of tiposComContratoCritico) {
      const registro = obterRegistroDbk(tipo);
      const auditoria = registro.auditoriaContrato;
      const camposOficiais = new Set(
        layoutPorTipo.get(tipo).campos.map(({ nome }) => nome),
      );

      expect(auditoria).not.toBeNull();
      expect(
        Boolean(auditoria.justificativaChave || auditoria.justificativaCardinalidade),
      ).toBe(true);
      for (const campo of auditoria.camposDiscriminadores || []) {
        expect(camposOficiais.has(campo), `${tipo}: discriminador ${campo}`).toBe(true);
        expect(registro.chaveEstavel.split('+')).toContain(campo);
      }
    }
  });

  it('mantém metadados imutáveis para uso como contrato central', () => {
    const registro = obterRegistroDbk('27');

    expect(Object.isFrozen(CATALOGO_REGISTROS_DBK)).toBe(true);
    expect(Object.isFrozen(registro)).toBe(true);
    expect(Object.isFrozen(registro.campos)).toBe(true);
    expect(Object.isFrozen(registro.formatos)).toBe(true);
    expect(Object.isFrozen(registro.exportacao)).toBe(true);
  });
});
