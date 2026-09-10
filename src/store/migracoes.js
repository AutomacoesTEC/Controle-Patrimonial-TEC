// Versão de esquema do estado persistido, e a cadeia de migrações que leva
// um arquivo de perfil gravado por uma versão antiga do app até o formato
// que o código de hoje espera. Item A1 de MELHORIAS-PROPOSTAS-2026-09-03.md.
//
// POR QUE ISTO EXISTE. Até 03/09/2026 nada marcava a versão do objeto
// gravado no localStorage do perfil (`controle-patrimonial-data-<id>`, ver
// perfis.js). Ler um arquivo antigo funcionava por sorte: o app usa `|| []`
// em quase todo lugar e o DataContext faz `{...initialState, ...raw}`, o que
// protege o objeto RAIZ contra campo ausente. O que NÃO estava protegido é o
// `historico[ano]`: LOAD_HISTORICO/SWITCH_ANO/ROLLOVER_ANO fazem
// `{...state, ...snapshot}` e um snapshot antigo sem a chave nova deixa
// VAZAR o valor do ano anterior (contaminação silenciosa entre anos), e
// ADD_EM_ANO roda o reducer direto sobre o snapshot, estourando em
// `.map`/`.filter` quando a coleção simplesmente não existe.
//
// ESTE MÓDULO NÃO IMPORTA NADA DE reducer.js DE PROPÓSITO. Uma migração
// precisa descrever o formato da versão de DESTINO congelado no tempo; se
// ela lesse `blankYear`, passaria a descrever o formato de amanhã e deixaria
// de ser uma migração (além de criar ciclo de import, já que reducer.js
// consome VERSAO_ESQUEMA_ATUAL daqui). A ligação entre as duas listas é
// feita por teste (migracoes.test.js), que falha se `blankYear` ganhar campo
// novo sem a versão subir.
//
// COMO ACRESCENTAR UMA VERSÃO:
//   1. suba VERSAO_ESQUEMA_ATUAL;
//   2. escreva `migrarNparaN+1` e registre em MIGRACOES;
//   3. congele a lista de campos do ano dessa versão em
//      CAMPOS_DO_ANO_POR_VERSAO (nunca edite a lista de uma versão já
//      publicada: ela é o retrato daquele formato);
//   4. acrescente um fixture em __fixtures__/ e o teste do salto.

// Versão 1: tudo que foi gravado antes de 03/09/2026, sem marca nenhuma.
// Versão 2: primeira versão marcada; formato do HEAD de 03/09/2026, já com
//           rendaVariavelMensalManual e fiiFiagroMensalManual (item E do
//           HANDOFF-2026-09-03.md).
// Versão 3: acrescenta `prejuizoRuralAjustadoManualmente` (flag por ano — item
//           P01 da auditoria funcional de 09/09/2026). O campo tinha entrado em
//           blankYear/snapshotYear sem subir a versão: um snapshot v1/v2 sem a
//           chave deixava o valor `true` do ano anterior VAZAR pelo
//           `{...state, ...snapshot}` de SWITCH_ANO/LOAD_HISTORICO/ROLLOVER_ANO,
//           e `saldoRuralInformado` passava a ignorar o saldo oficial de
//           prejuízo rural de um ano antigo. A migração completa a chave com
//           `false` na raiz e em cada snapshot.
export const VERSAO_ESQUEMA_ATUAL = 3;

// --- Retrato do formato da versão 2 -----------------------------------------
// Os quatro grupos abaixo são só a forma de escrever o valor vazio de cada
// campo sem repetir 38 literais. Espelham `blankYear` do reducer no momento
// em que a versão 2 foi criada.
const LISTAS_DO_ANO_V2 = [
  'avisosImportacao', 'registrosDbkNaoModelados',
  'bens', 'dividas', 'rendimentos', 'pagamentos',
  'apuracaoGanhoCapital', 'dependentes',
  'bensRurais', 'dividasRurais', 'lancamentosRurais', 'pagamentosDiversos',
  'receitasDespesasRuraisOficial', 'movimentacaoRebanhoOficial',
  'participantesRuraisOficial', 'demonstrativoExteriorOficial',
  'rendaVariavelMensalOficial', 'rendaVariavelMensalManual',
  'fiiFiagroMensalOficial', 'fiiFiagroMensalManual',
  'fichasNaoLidasComConteudo',
  'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial',
];
const OBJETOS_DO_ANO_V2 = ['estadoFichas', 'fichasPdfObservadas'];
const NULOS_DO_ANO_V2 = [
  'importFormato', 'documentoFonte', 'versaoCatalogoFichasPdf',
  'contribuinte', 'impostoDevido', 'espolioOficial', 'saidaDefinitivaOficial',
  'apuracaoResultadoRuralOficial', 'ganhosCapitalOficial',
  'rendaVariavelAnualOficial', 'fiiFiagroAnualOficial',
];
const ZEROS_DO_ANO_V2 = ['totalFichasPdfCatalogadas'];

// imoveisRurais e prejuizoRuralAcompensar ficam FORA de `blankYear` de
// propósito (o imóvel explorado continua o mesmo de um ano para o outro e o
// prejuízo é saldo que atravessa anos, Lei 8.023/1990 art. 14), mas ESTÃO em
// `snapshotYear`: são arquivados por ano. Um snapshot antigo sem essas duas
// chaves é justamente o caso de contaminação descrito no topo, então a
// migração também as completa.
const CAMPOS_QUE_ATRAVESSAM_ANOS_V2 = ['imoveisRurais', 'prejuizoRuralAcompensar'];

// Campos do ANO na versão 2 (o mesmo conjunto de `blankYear`). Congelado:
// não muda mais, nem quando `blankYear` mudar.
export const CAMPOS_DO_ANO_V2 = Object.freeze(
  [...LISTAS_DO_ANO_V2, ...OBJETOS_DO_ANO_V2, ...NULOS_DO_ANO_V2, ...ZEROS_DO_ANO_V2].sort()
);

// Tudo que um snapshot de `historico[ano]` guarda de DADO (os metadados
// `origem`, `savedAt` e `versaoEsquema` são tratados à parte).
export const CAMPOS_DO_SNAPSHOT_V2 = Object.freeze(
  [...CAMPOS_DO_ANO_V2, ...CAMPOS_QUE_ATRAVESSAM_ANOS_V2].sort()
);

// --- Retrato do formato da versão 3 -----------------------------------------
// Só um campo novo em relação à versão 2: a flag booleana de ajuste manual do
// prejuízo rural. Default `false`. A lista da versão 2 continua congelada.
const BOOLEANOS_FALSE_DO_ANO_V3 = ['prejuizoRuralAjustadoManualmente'];

export const CAMPOS_DO_ANO_V3 = Object.freeze(
  [...CAMPOS_DO_ANO_V2, ...BOOLEANOS_FALSE_DO_ANO_V3].sort()
);

export const CAMPOS_DO_SNAPSHOT_V3 = Object.freeze(
  [...CAMPOS_DO_ANO_V3, ...CAMPOS_QUE_ATRAVESSAM_ANOS_V2].sort()
);

// Retrato por versão, para o teste de contrato conferir contra `blankYear`.
export const CAMPOS_DO_ANO_POR_VERSAO = Object.freeze({
  2: CAMPOS_DO_ANO_V2,
  3: CAMPOS_DO_ANO_V3,
});

// Fábricas, não valores: dois anos do histórico nunca podem compartilhar o
// MESMO array vazio, senão um push num ano apareceria no outro.
const PADROES_V2 = Object.freeze(Object.fromEntries([
  ...LISTAS_DO_ANO_V2.map(c => [c, () => []]),
  ...OBJETOS_DO_ANO_V2.map(c => [c, () => ({})]),
  ...NULOS_DO_ANO_V2.map(c => [c, () => null]),
  ...ZEROS_DO_ANO_V2.map(c => [c, () => 0]),
  ['imoveisRurais', () => []],
  ['prejuizoRuralAcompensar', () => 0],
]));

// --- Cadeia ------------------------------------------------------------------

// Estado sem marca nenhuma é versão 1 por definição. Valor inválido (texto,
// zero, negativo, fracionário) também: é mais seguro migrar de novo, porque
// toda migração daqui é idempotente, do que confiar numa marca corrompida.
export function versaoDoEstado(estado) {
  const v = estado?.versaoEsquema;
  return Number.isInteger(v) && v >= 1 ? v : 1;
}

const ehObjeto = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function completarCampos(alvo, campos) {
  if (!ehObjeto(alvo)) return alvo;
  let proximo = alvo;
  for (const campo of campos) {
    if (proximo[campo] !== undefined) continue;
    if (proximo === alvo) proximo = { ...alvo };
    proximo[campo] = PADROES_V2[campo]();
  }
  return proximo;
}

// Salto 1 para 2: preenche, na RAIZ e em CADA ano do histórico, todo campo
// do formato da versão 2 que possa faltar num arquivo antigo (inclusive
// rendaVariavelMensalManual e fiiFiagroMensalManual, nascidos em 03/09/2026),
// e carimba a marca de versão nos dois níveis. Nenhum valor existente é
// tocado: só chave ausente (`undefined`) recebe padrão — `null` é valor
// legítimo em vários campos e precisa sobreviver.
export function migrar1para2(estado) {
  if (!ehObjeto(estado)) return estado;
  const raiz = completarCampos(estado, CAMPOS_DO_SNAPSHOT_V2);
  let historico = raiz.historico;
  if (ehObjeto(historico)) {
    const migrado = {};
    for (const [ano, snapshot] of Object.entries(historico)) {
      migrado[ano] = ehObjeto(snapshot)
        ? { ...completarCampos(snapshot, CAMPOS_DO_SNAPSHOT_V2), versaoEsquema: 2 }
        : snapshot;
    }
    historico = migrado;
  }
  return { ...raiz, ...(historico === undefined ? {} : { historico }), versaoEsquema: 2 };
}

// Salto 2 para 3: completa `prejuizoRuralAjustadoManualmente` (default `false`)
// na RAIZ e em cada snapshot do histórico que não tenha a chave, e recarimba a
// marca de versão nos dois níveis. Valor já gravado é preservado — inclusive um
// `true` legítimo de um ano em que a usuária ajustou o prejuízo rural à mão
// (AJUSTAR_PREJUIZO_RURAL); só a ausência (`undefined`) recebe `false`. É o que
// impede a flag de um ano de vazar para outro pelo spread de LOAD_HISTORICO.
export function migrar2para3(estado) {
  if (!ehObjeto(estado)) return estado;
  const completar = (alvo) => (
    ehObjeto(alvo) && alvo.prejuizoRuralAjustadoManualmente === undefined
      ? { ...alvo, prejuizoRuralAjustadoManualmente: false }
      : alvo
  );
  const raiz = completar(estado);
  let historico = raiz.historico;
  if (ehObjeto(historico)) {
    const migrado = {};
    for (const [ano, snapshot] of Object.entries(historico)) {
      migrado[ano] = ehObjeto(snapshot)
        ? { ...completar(snapshot), versaoEsquema: 3 }
        : snapshot;
    }
    historico = migrado;
  }
  return { ...raiz, ...(historico === undefined ? {} : { historico }), versaoEsquema: 3 };
}

// Uma função por salto de versão. A chave é a versão de ORIGEM.
export const MIGRACOES = Object.freeze({
  1: migrar1para2,
  2: migrar2para3,
});

// Ponto de entrada da carga do perfil (DataContext.jsx). Aplica os saltos em
// cadeia até VERSAO_ESQUEMA_ATUAL e devolve o estado pronto para o
// `{...initialState, ...}` do useReducer.
//
// Estado já na versão atual sai pela identidade, o que torna a cadeia
// idempotente por construção: migrar duas vezes dá o mesmo resultado.
// Estado marcado com versão MAIOR que a atual (perfil aberto num app mais
// novo e depois num mais antigo) é devolvido intacto: rebaixar formato
// destruiria dado, e o merge com `initialState` já garante que a tela abre.
export function migrarEstadoPersistido(estado) {
  if (!ehObjeto(estado)) return estado;
  let atual = estado;
  let versao = versaoDoEstado(atual);
  while (versao < VERSAO_ESQUEMA_ATUAL) {
    const salto = MIGRACOES[versao];
    if (!salto) {
      throw new Error(`Não há migração registrada da versão ${versao} do estado do perfil para a ${versao + 1}.`);
    }
    atual = salto(atual);
    const proxima = versaoDoEstado(atual);
    if (proxima <= versao) {
      throw new Error(`A migração da versão ${versao} não avançou a marca de versão do estado do perfil.`);
    }
    versao = proxima;
  }
  return atual;
}
