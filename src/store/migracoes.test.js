import { describe, expect, it, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  CAMPOS_DO_ANO_POR_VERSAO,
  CAMPOS_DO_SNAPSHOT_V2,
  CAMPOS_DO_SNAPSHOT_V3,
  MIGRACOES,
  VERSAO_ESQUEMA_ATUAL,
  migrarEstadoPersistido,
  versaoDoEstado,
} from './migracoes';
import { blankYear, initialState, reducer, snapshotYear } from './reducer';
import { carregarEstadoDoPerfil } from './DataContext';
import { demonstrativoConciliacao } from './demonstrativos';
import { saldoRuralInformado } from './saldoRural';

const lerFixture = (nome) => JSON.parse(
  readFileSync(new URL(`./__fixtures__/${nome}`, import.meta.url), 'utf8')
);

// Perfil real: estado produzido pela importação do PDF sintético AJU-01,
// com virada de ano, gravado por src/store/__fixtures__/
// gerar-fixtures-perfil.mjs. O `-v1` é o MESMO perfil como uma versão
// anterior do app o teria salvo (sem marca de versão e sem as chaves que
// aquela versão ainda não conhecia).
const PERFIL_ATUAL = lerFixture('perfil-aju01-atual.json');
const PERFIL_V1 = lerFixture('perfil-aju01-v1.json');
const ANO = PERFIL_ATUAL.anoCalendario;

describe('contrato entre blankYear e a versão de esquema', () => {
  // ESTE É O TESTE QUE TRAVA A MUDANÇA DE FORMATO. Acrescentar (ou tirar) um
  // campo de `blankYear` sem subir VERSAO_ESQUEMA_ATUAL, sem escrever a
  // migração do salto novo e sem congelar a lista da versão nova em
  // CAMPOS_DO_ANO_POR_VERSAO faz este teste falhar. É de propósito: um perfil
  // já gravado no computador da usuária não se adapta sozinho ao campo novo,
  // e é dentro de `historico[ano]` que a falta dele contamina outro ano.
  test('a lista de campos do ano da versão atual descreve exatamente blankYear', () => {
    const camposCongelados = CAMPOS_DO_ANO_POR_VERSAO[VERSAO_ESQUEMA_ATUAL];
    expect(
      camposCongelados,
      `Não há retrato dos campos do ano para a versão ${VERSAO_ESQUEMA_ATUAL} em CAMPOS_DO_ANO_POR_VERSAO (src/store/migracoes.js).`
    ).toBeDefined();
    expect(
      Object.keys(blankYear).sort(),
      'blankYear mudou: suba VERSAO_ESQUEMA_ATUAL, escreva a migração do salto novo em src/store/migracoes.js e congele a lista da versão nova em CAMPOS_DO_ANO_POR_VERSAO.'
    ).toEqual([...camposCongelados]);
  });

  test('existe uma migração registrada para cada salto até a versão atual', () => {
    for (let versao = 1; versao < VERSAO_ESQUEMA_ATUAL; versao += 1) {
      expect(typeof MIGRACOES[versao], `falta a migração da versão ${versao} para a ${versao + 1}`).toBe('function');
    }
    expect(Object.keys(MIGRACOES).map(Number).sort((a, b) => a - b))
      .toEqual(Array.from({ length: VERSAO_ESQUEMA_ATUAL - 1 }, (_, i) => i + 1));
  });

  test('estado novo e snapshot novo nascem carimbados com a versão atual', () => {
    expect(initialState.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    expect(snapshotYear({ ...initialState, anoCalendario: 2025 }).versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
  });

  test('a versão da raiz é a do arquivo e a de cada snapshot é a marca do ano', () => {
    const importado = reducer(
      { ...initialState, anoCalendario: 2025, contribuinte: { nome: 'X' } },
      { type: 'ROLLOVER_ANO', payload: 2026 },
    );
    expect(importado.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    expect(importado.historico[2025].versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
  });
});

describe('versaoDoEstado', () => {
  test('estado sem marca é versão 1', () => {
    expect(versaoDoEstado({})).toBe(1);
    expect(versaoDoEstado({ versaoEsquema: undefined })).toBe(1);
  });
  test('marca inválida cai para a versão 1, porque migrar de novo é inócuo', () => {
    for (const marca of ['2', 0, -3, 1.5, null, NaN]) {
      expect(versaoDoEstado({ versaoEsquema: marca })).toBe(1);
    }
  });
  test('marca válida é respeitada', () => {
    expect(versaoDoEstado({ versaoEsquema: 2 })).toBe(2);
    expect(versaoDoEstado({ versaoEsquema: 99 })).toBe(99);
  });
});

describe('cadeia de migração sobre o perfil real do AJU-01', () => {
  test('o fixture antigo é mesmo um estado da versão 1, com campos faltando', () => {
    expect(PERFIL_V1.versaoEsquema).toBeUndefined();
    expect(versaoDoEstado(PERFIL_V1)).toBe(1);
    // Os dois campos nascidos em 03/09/2026 (item E do handoff) precisam
    // estar ausentes, senão o fixture não prova nada.
    expect(PERFIL_V1.rendaVariavelMensalManual).toBeUndefined();
    expect(PERFIL_V1.fiiFiagroMensalManual).toBeUndefined();
    expect(PERFIL_V1.historico[ANO].rendaVariavelMensalManual).toBeUndefined();
    expect(PERFIL_V1.historico[ANO].fiiFiagroMensalManual).toBeUndefined();
    expect(Object.keys(PERFIL_V1.historico).length).toBeGreaterThan(1);
  });

  test('a carga do perfil antigo não perde nenhum campo do perfil atual', () => {
    const carregado = carregarEstadoDoPerfil(PERFIL_V1);
    for (const [campo, valor] of Object.entries(PERFIL_ATUAL)) {
      if (campo === 'historico') continue;
      expect(carregado[campo], `campo perdido na raiz: ${campo}`).toEqual(valor);
    }
    for (const [ano, snapshot] of Object.entries(PERFIL_ATUAL.historico)) {
      for (const [campo, valor] of Object.entries(snapshot)) {
        expect(carregado.historico[ano][campo], `campo perdido em historico[${ano}]: ${campo}`).toEqual(valor);
      }
    }
  });

  test('todo campo do formato fica DEFINIDO na raiz e em cada ano do histórico', () => {
    const carregado = carregarEstadoDoPerfil(PERFIL_V1);
    for (const campo of CAMPOS_DO_SNAPSHOT_V3) {
      expect(carregado[campo], `campo indefinido na raiz: ${campo}`).toBeDefined();
      for (const ano of Object.keys(carregado.historico)) {
        expect(carregado.historico[ano][campo], `campo indefinido em historico[${ano}]: ${campo}`).toBeDefined();
      }
    }
    expect(carregado.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    for (const ano of Object.keys(carregado.historico)) {
      expect(carregado.historico[ano].versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    }
  });

  test('perfil antigo e perfil atual carregam no MESMO estado', () => {
    expect(carregarEstadoDoPerfil(PERFIL_V1)).toEqual(carregarEstadoDoPerfil(PERFIL_ATUAL));
  });

  test('o demonstrativo do perfil antigo é idêntico ao do perfil atual', () => {
    const deDe = `${ANO}-01-01`;
    const ate = `${ANO}-12-31`;
    const doAntigo = demonstrativoConciliacao(carregarEstadoDoPerfil(PERFIL_V1), deDe, ate);
    const doAtual = demonstrativoConciliacao(carregarEstadoDoPerfil(PERFIL_ATUAL), deDe, ate);
    expect(doAntigo).toEqual(doAtual);
    // Prova que o demonstrativo comparado não é um objeto vazio: o perfil de
    // referência tem patrimônio, rendimento e pagamento de verdade.
    expect(doAtual.rendimentos.totalGeral).toBeGreaterThan(0);
    expect(doAtual.pagamentosEfetuados).toBeGreaterThan(0);
    expect(Number.isFinite(doAtual.saldoDeCaixa)).toBe(true);
  });

  test('a cadeia é idempotente: migrar duas vezes dá o mesmo resultado', () => {
    const umaVez = migrarEstadoPersistido(PERFIL_V1);
    const duasVezes = migrarEstadoPersistido(umaVez);
    expect(duasVezes).toEqual(umaVez);
    // Estado já na versão atual sai pela identidade, sem clonar nada.
    expect(duasVezes).toBe(umaVez);
    expect(carregarEstadoDoPerfil(PERFIL_V1)).toEqual(
      carregarEstadoDoPerfil(migrarEstadoPersistido(PERFIL_V1))
    );
  });

  test('a migração não altera o objeto lido do armazenamento', () => {
    const copia = JSON.parse(JSON.stringify(PERFIL_V1));
    migrarEstadoPersistido(PERFIL_V1);
    expect(PERFIL_V1).toEqual(copia);
  });
});

describe('o que a migração protege de verdade: o interior do histórico', () => {
  // O merge `{...initialState, ...raw}` do DataContext sempre protegeu a
  // RAIZ. O buraco era o snapshot: LOAD_HISTORICO faz `{...state,
  // ...snapshot}`, então um ano antigo sem a chave nova herdava o valor do
  // ano que estava na tela. Bug de contaminação silenciosa entre anos.
  const perfilAntigoComDoisAnos = () => ({
    anoCalendario: 2025,
    origemAnoAtual: 'importacao',
    contribuinte: { nome: 'FULANO', cpf: '11144477735' },
    bens: [], dividas: [], rendimentos: [], pagamentos: [], dependentes: [],
    rendaVariavelMensalManual: [{ mes: 3, titular: true, resultado: -1000 }],
    fiiFiagroMensalManual: [{ mes: 7, titular: true, resultado: -500 }],
    historico: {
      2024: {
        // Snapshot gravado por uma versão do app que ainda não tinha os dois
        // campos manuais de Renda Variável.
        bens: [], dividas: [], rendimentos: [], pagamentos: [],
        contribuinte: { nome: 'FULANO', cpf: '11144477735' },
        origem: 'importacao',
        savedAt: '2026-09-01T10:00:00.000Z',
      },
    },
  });

  test('carregar um ano antigo não herda o lançamento manual do ano de hoje', () => {
    const carregado = carregarEstadoDoPerfil(perfilAntigoComDoisAnos());
    const em2024 = reducer(carregado, { type: 'LOAD_HISTORICO', payload: 2024 });
    expect(em2024.anoCalendario).toBe(2024);
    expect(em2024.rendaVariavelMensalManual).toEqual([]);
    expect(em2024.fiiFiagroMensalManual).toEqual([]);
    // E o ano de 2025 continua com o que era dele.
    const de2025 = reducer(em2024, { type: 'LOAD_HISTORICO', payload: 2025 });
    expect(de2025.rendaVariavelMensalManual).toHaveLength(1);
    expect(de2025.fiiFiagroMensalManual).toHaveLength(1);
  });

  // P01 (auditoria funcional 09/09/2026). A flag de ajuste manual do prejuízo
  // rural é POR ANO. Um snapshot gravado antes da versão 3 não tem a chave;
  // sem a migração, o `{...state, ...snapshot}` de LOAD_HISTORICO deixava o
  // `true` do ano da tela vazar para o ano antigo, e `saldoRuralInformado`
  // passava a ignorar o saldo oficial de prejuízo rural daquele ano.
  test('carregar um ano antigo não herda a flag de ajuste manual do prejuízo rural', () => {
    const perfil = {
      anoCalendario: 2025,
      origemAnoAtual: 'manual',
      contribuinte: { nome: 'FULANO', cpf: '11144477735' },
      bens: [], dividas: [], rendimentos: [], pagamentos: [], dependentes: [],
      // No ano de hoje a usuária sobrepôs o prejuízo rural à mão.
      prejuizoRuralAjustadoManualmente: true,
      prejuizoRuralAcompensar: -2000,
      historico: {
        2024: {
          // Snapshot de uma versão anterior à 3: SEM a chave, e com a apuração
          // oficial informando -10.000 de prejuízo a transportar.
          bens: [], dividas: [], rendimentos: [], pagamentos: [],
          contribuinte: { nome: 'FULANO', cpf: '11144477735' },
          apuracaoResultadoRuralOficial: { saldoPrejuizoExercicioSeguinte: -10000 },
          prejuizoRuralAcompensar: 0,
          origem: 'importacao',
          savedAt: '2026-09-01T10:00:00.000Z',
        },
      },
    };
    const carregado = carregarEstadoDoPerfil(perfil);
    const em2024 = reducer(carregado, { type: 'LOAD_HISTORICO', payload: 2024 });
    expect(em2024.anoCalendario).toBe(2024);
    // A flag do ano antigo é dele — false —, não a herdada de 2025.
    expect(em2024.prejuizoRuralAjustadoManualmente).toBe(false);
    // Logo o saldo rural informado de 2024 é o oficial (-10.000), não o
    // `prejuizoRuralAcompensar` de 0 que o caminho manual devolveria.
    expect(saldoRuralInformado(em2024)).toBe(-10000);
    // E 2025 continua com o ajuste manual que era dele.
    const de2025 = reducer(em2024, { type: 'LOAD_HISTORICO', payload: 2025 });
    expect(de2025.prejuizoRuralAjustadoManualmente).toBe(true);
    expect(saldoRuralInformado(de2025)).toBe(-2000);
  });

  test('gravar num ano antigo do histórico não estoura por coleção ausente', () => {
    const carregado = carregarEstadoDoPerfil(perfilAntigoComDoisAnos());
    const gravado = reducer(carregado, {
      type: 'ADD_EM_ANO',
      payload: { ano: 2024, action: { type: 'ADD_PAGAMENTO_DIVERSO', payload: { descricao: 'IPVA', valor: 1200, data: '2024-02-10' } } },
    });
    expect(gravado.historico[2024].pagamentosDiversos).toHaveLength(1);
  });

  test('cada ano recebe a sua própria coleção vazia, não uma compartilhada', () => {
    const perfil = perfilAntigoComDoisAnos();
    perfil.historico[2023] = { bens: [], contribuinte: { nome: 'FULANO' }, origem: 'manual', savedAt: '2026-09-01T10:00:00.000Z' };
    const carregado = carregarEstadoDoPerfil(perfil);
    expect(carregado.historico[2024].pagamentosDiversos).not.toBe(carregado.historico[2023].pagamentosDiversos);
    expect(carregado.historico[2024].estadoFichas).not.toBe(carregado.historico[2023].estadoFichas);
  });

  test('valor null gravado de propósito sobrevive à migração', () => {
    const migrado = migrarEstadoPersistido({
      contribuinte: null,
      impostoDevido: null,
      historico: { 2024: { impostoDevido: null, origem: null, savedAt: 'x' } },
    });
    expect(migrado.impostoDevido).toBeNull();
    expect(migrado.historico[2024].impostoDevido).toBeNull();
    expect(migrado.historico[2024].origem).toBeNull();
  });
});

describe('bordas da cadeia', () => {
  it('estado nulo ou não-objeto passa intacto (o DataContext cai no initialState)', () => {
    expect(migrarEstadoPersistido(null)).toBeNull();
    expect(migrarEstadoPersistido(undefined)).toBeUndefined();
    expect(migrarEstadoPersistido('lixo')).toBe('lixo');
    expect(migrarEstadoPersistido([1, 2])).toEqual([1, 2]);
  });

  it('perfil gravado por uma versão FUTURA do app é devolvido intacto, sem rebaixar formato', () => {
    const doFuturo = { versaoEsquema: VERSAO_ESQUEMA_ATUAL + 5, bens: [{ id: 1 }], campoQueAindaNaoExiste: 'x' };
    expect(migrarEstadoPersistido(doFuturo)).toBe(doFuturo);
  });

  it('estado vazio vira um esqueleto completo da versão atual', () => {
    const migrado = migrarEstadoPersistido({});
    expect(migrado.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    for (const campo of CAMPOS_DO_SNAPSHOT_V3) {
      expect(migrado[campo], `campo ausente: ${campo}`).toBeDefined();
    }
    expect(migrado.historico).toBeUndefined();
  });

  it('histórico com entrada corrompida não derruba a carga', () => {
    const migrado = migrarEstadoPersistido({ historico: { 2024: null, 2025: 'lixo' } });
    expect(migrado.historico[2024]).toBeNull();
    expect(migrado.historico[2025]).toBe('lixo');
  });
});
