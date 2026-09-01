import { CATALOGO_FICHAS_PDF_2026, encontrarFichaPdf2026, ehPrefixoDeFichaPdf2026 } from '../irpf/catalogoFichasPdf2026';

// Parsers puros de .DBK e PDF da declaração de IRPF, extraídos de
// ImportPage.jsx para poder testar contra arquivos reais (ver
// importParsers.test.js) sem precisar montar o componente React.
//
// parsePDF() recebe um documento pdfjs JÁ CARREGADO (PDFDocumentProxy), não
// o arquivo bruto: carregar o PDF depende do ambiente (o app usa o build de
// browser do pdfjs-dist; o teste usa o build "legacy" que roda em Node) —
// só a lógica de reconstrução das linhas/colunas em cima do documento já
// carregado é código compartilhado e testável.
//
// `log`, quando passado, recebe cada linha de progresso que a tela de
// Importar Declaração mostra; nos testes é omitido (vira no-op).

const noop = () => {};

// Além dos campos estruturados, cada importação guarda uma cópia textual
// integral e auditável do arquivo. Assim uma ficha ainda não modelada não é
// descartada: ela pode ser reprocessada por uma versão futura sem o usuário
// precisar digitar ou adivinhar o conteúdo. O limite protege o armazenamento
// local contra arquivos que não sejam uma declaração válida.
const MAX_TEXTO_FONTE = 2_000_000;
const sha256Texto = async (texto) => {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};
const criarDocumentoFonte = async ({ formato, textoIntegral, paginas = null, totalRegistros = null }) => {
  if (textoIntegral.length > MAX_TEXTO_FONTE) {
    throw new Error('A declaração excede o limite seguro de 2 milhões de caracteres para conferência integral.');
  }
  return {
    formato,
    versaoArquivoAuditoria: 1,
    textoIntegral,
    paginas,
    totalPaginas: paginas?.length ?? null,
    totalRegistros,
    caracteresExtraidos: textoIntegral.length,
    sha256TextoExtraido: await sha256Texto(textoIntegral),
    somenteLocal: true,
  };
};

// Layout de colunas (1-based) do .DBK do exercício 2026, conferido contra
// arquivo real e batido com o registro 20 de resumo (total de bens).
const field = (line, start, len) => line.substring(start - 1, start - 1 + len).trim();
// Valores são N13: 13 dígitos = 11 inteiros + 2 decimais implícitas.
const parseValorN13 = (str) => {
  const digits = (str || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};
// Alguns campos N13 (resultado da Apuração do Resultado da Atividade
// Rural, registro 52) admitem valor negativo: o primeiro caractere do
// campo é '-' em vez de um dígito, reduzindo a magnitude útil a 12 dígitos.
// Nunca apareceu um exemplo positivo na declaração de referência pra
// confirmar como fica esse caractere quando positivo — "não começa com
// '-' → positivo" é a hipótese razoável, mas fica sem confirmação real.
const parseValorN13Signed = (str) => {
  const raw = str || '';
  const negativo = raw.trim().startsWith('-');
  const valor = parseValorN13(raw);
  return negativo ? -valor : valor;
};
// Nem todo campo numérico do arquivo tem DUAS decimais implícitas. Os
// registros de Ganho de Capital usam três outras escalas, todas declaradas no
// layout oficial (`mapeamentoTxt.xml`, atributo `Decimais`):
//   N9.6  → alíquota média e percentuais de redução (6 decimais)
//   N13.4 → cotação do dólar da operação (4 decimais)
//   N17.6 → custo médio ponderado de moeda estrangeira (6 decimais)
// Ler qualquer um deles com parseValorN13 dividiria por 100 e devolveria um
// número 10.000 vezes maior (ou menor) que o real. Daí um leitor único
// parametrizado pela quantidade de decimais, em vez de três variações soltas.
const parseDecimais = (str, casas) => {
  const digits = (str || '').replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / Math.pow(10, casas);
};
// Quantidade inteira (N11 do registro 73, quantidade de cotas alienadas).
const parseInteiro = (str) => {
  const digits = (str || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};
// Indicadores de Sim/Não do Ganho de Capital. O arquivo grava "1"/"0", e a
// ficha impressa mostra "Sim"/"Não"; campo em branco (pergunta que não se
// aplica àquela operação) vira null, para a tela poder omitir a linha em vez
// de afirmar "Não" onde a declaração não afirmou nada.
const simNaoOuNulo = (raw) => {
  const v = (raw || '').trim();
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
};
const RACA_COR_POR_CODIGO = {
  '0': 'Não informada', '1': 'Amarela', '2': 'Branca',
  '3': 'Indígena', '4': 'Parda', '5': 'Preta',
};

// O campo de CPF/CNPJ do beneficiário (registro 26) tem largura fixa de 19
// caracteres, com um prefixo de preenchimento de exatamente 5 caracteres
// antes do número real — 11 dígitos de CPF (campo fica com 16 chars
// significativos) ou 14 de CNPJ (19 chars, sem sobra). Conferido contra o
// mesmo pagamento já extraído (corretamente) pelo caminho PDF: o prefixo
// de preenchimento NÃO é necessariamente só zeros (ex.: "00001" antes de
// um CNPJ real), então tirar "zeros à esquerda" na unha cortava um dígito
// de verdade — o certo é sempre pegar os últimos 11 ou 14 caracteres,
// nunca inferir o tamanho do preenchimento pelo conteúdo dele.
//
// ACHADO 19 da auditoria de 24/08/2026: a decisão entre 11 e 14 dígitos era
// tomada DEPOIS do `trim()`, e o campo já chega aparado de `field()`. Um CNPJ
// cujo preenchimento de 5 posições fosse feito de espaços chegaria aqui com 14
// caracteres, cairia no ramo do CPF e perderia os três primeiros dígitos. No
// arquivo de referência o preenchimento é numérico e o caso não aparece — mas
// a decisão passa a ser pelo CONTEÚDO (quantos dígitos existem de fato), que
// não depende de quantos espaços vieram junto.
export const normalizarCpfCnpj = (raw) => {
  const campo = (raw || '').trim();
  if (!campo) return '';
  const digitos = campo.replace(/\D/g, '');
  if (!digitos) return '';
  // A regra principal continua sendo o COMPRIMENTO DO CAMPO aparado, porque é
  // ela que distingue "5 de preenchimento + 11 do CPF" (16) de "5 + 14 do
  // CNPJ" (19) quando o preenchimento é numérico — e é numérico no arquivo de
  // referência. O caso novo é o preenchimento em BRANCO: aí o trim come as 5
  // posições e sobra um campo de exatamente 14 dígitos, que a regra antiga
  // classificava como CPF e cortava em 11, perdendo três dígitos do CNPJ.
  const alvo = (campo.length > 16 || digitos.length === 14) ? 14 : 11;
  return digitos.slice(-alvo).padStart(alvo, '0');
};

// Datas nos registros de Ganho de Capital (62) vêm em DDMMAAAA corrido, sem
// separador — vira ISO (aaaa-mm-dd), mesmo formato usado em todo o resto
// do app.
const dataDDMMAAAAparaIso = (raw) => {
  const d = (raw || '').trim();
  if (!/^\d{8}$/.test(d)) return '';
  return `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`;
};

// Configuração dos SETE registros de detalhe de rendimento isento (83 a 87) e
// de tributação exclusiva (88 e 89). Posições 1-based, do layout oficial.
// `fonte` indica se o registro traz CNPJ e nome da fonte pagadora nas posições
// 30 e 44 — os que não trazem são agregados por código.
const DETALHE_RENDIMENTO = {
  83: { categoria: 'isento', beneficiario: 14, cpf: 15, codigo: 26, fonte: false, valor: 30 },
  84: { categoria: 'isento', beneficiario: 14, cpf: 15, codigo: 26, fonte: true, valor: 104, decimoTerceiro: 117 },
  85: { categoria: 'isento', beneficiario: 14, cpf: 15, codigo: 26, fonte: true, valor: 104, decimoTerceiro: 117, irrf: 130 },
  86: { categoria: 'isento', beneficiario: 14, cpf: 15, codigo: 26, fonte: true, valor: 104, descricao: 117 },
  87: { categoria: 'isento', codigo: 14, fonte: false, valor: 18, valorGanhoCapital: 31 },
  88: { categoria: 'exclusivo', beneficiario: 14, cpf: 15, codigo: 26, fonte: true, valor: 104 },
  89: { categoria: 'exclusivo', beneficiario: 14, cpf: 15, codigo: 26, fonte: true, valor: 104, descricao: 117 },
};

// ACHADO 07 da auditoria de 24/08/2026, compartilhado pelos DOIS caminhos de
// importação (era o tipo de correção que, feita só de um lado, reintroduz a
// divergência que a auditoria cruzada existe para pegar).
//
// O Demonstrativo soma o rendimento de tributação exclusiva LÍQUIDO de IRRF,
// porque o imposto retido não sobra para gastar. Só que nenhum rendimento
// exclusivo importado carregava IRRF: o líquido saía igual ao bruto e a linha
// "Tributação Exclusiva, IRRF retido" mostrava R$ 0,00 em toda declaração.
//
// O 13º salário é o caso com conserto. A Ajuda oficial do IRPF 2026 (ficha
// Rendimentos Sujeitos à Tributação Exclusiva/Definitiva, aba Totais) diz que
// a linha 01 recebe "o valor do campo 13º salário" da ficha de Rendimentos
// Tributáveis Recebidos de PJ, isto é, o BRUTO — diferente da linha 07 (RRA),
// que já vem subtraída do imposto retido. E o IRRF sobre o 13º está em campo
// próprio da mesma ficha de PJ, que os dois parsers já leem e descartavam.
//
// Códigos internos: 0001 é o 13º do titular, 0008 o dos dependentes.
const CODIGO_DECIMO_TERCEIRO = { Titular: '0001', Dependente: '0008' };
export function aplicarIrrfDecimoTerceiro(rendimentos) {
  for (const [quem, codigo] of Object.entries(CODIGO_DECIMO_TERCEIRO)) {
    const irrf = rendimentos
      .filter(r => r.tipo === 'tributavel_pj' && (r.beneficiario || 'Titular') === quem)
      .reduce((s, r) => s + (r.irrfDecimoTerceiro || 0), 0);
    if (!irrf) continue;
    // O IRRF do 13º é um total anual: cabe numa linha só. Esses códigos hoje
    // sempre entram pelo agregado (não têm detalhe por fonte pagadora), mas se
    // um dia tiverem, o total não pode ser repetido em cada linha.
    const alvo = rendimentos.find(r => r.tipo === `exclusivo_${codigo}` && !r.irrf);
    if (alvo) alvo.irrf = irrf;
  }
  return rendimentos;
}

// Fichas que a declaração pode ter e que este app NÃO modela. O nome vem do
// mapa oficial de registros (`ConstantesRepositorio`, ver LAYOUT-DBK-OFICIAL.md)
// e existe para que o aviso de importação diga QUAL ficha ficou de fora, em vez
// de só o número do registro — "esta declaração tem a ficha de Alimentandos"
// é acionável; "tem registro do tipo 35" não é.
//
// Nenhuma delas aparece na declaração de referência, então o aviso nunca dispara
// nela. Levantadas percorrendo o mapa oficial em 24/08/2026.
const FICHAS_NAO_MODELADAS = {
  29: 'Cônjuge ou companheiro(a)',
  30: 'Inventariante',
  31: 'Pensão alimentícia',
  33: 'Lucros e dividendos, detalhe por fonte pagadora',
  34: 'Doações a campanha eleitoral',
  35: 'Alimentandos',
  36: 'Proprietário ou usufrutuário de bem',
  38: 'Declaração final de espólio',
  39: 'Saída definitiva do país',
  58: 'Herdeiros',
  59: 'Percentual de bem por herdeiro',
  61: 'Ganho de capital: identificação do bem',
  63: 'Ganho de capital: operações comuns',
  64: 'Ganho de capital: redução',
  66: 'Ganho de capital: alienação',
  70: 'Ganho de capital em moeda estrangeira: identificação do bem',
  71: 'Ganho de capital em moeda estrangeira: valores em reais',
  72: 'Ganho de capital em moeda estrangeira: parcelas em reais',
  73: 'Ganho de capital em moeda estrangeira: valores em moeda',
  74: 'Ganho de capital em moeda estrangeira: parcelas em moeda',
  77: 'Ganho de capital em moeda estrangeira: espécie',
  78: 'Ganho de capital em moeda estrangeira: consolidado',
};

const ESTADOS_FICHA = new Set(['completa', 'parcial', 'vazia', 'ausente', 'nao_suportada', 'erro']);
const entradaEstadoFicha = (estado, formato, motivo = undefined, detalhes = {}) => {
  if (!ESTADOS_FICHA.has(estado)) throw new Error(`Estado de ficha inválido: ${estado}`);
  const presenca = detalhes.presenca || (
    estado === 'vazia' ? 'vazia' : estado === 'erro' ? 'indeterminada' : 'preenchida'
  );
  const suporte = detalhes.suporte || (
    estado === 'completa' ? 'integral' : estado === 'nao_suportada' ? 'nao_suportada' : 'parcial'
  );
  const derivado = detalhes.derivado === true;
  const completudeAuditada = estado === 'completa' && detalhes.completudeAuditada === true && !derivado;

  if (estado === 'completa' && !completudeAuditada) {
    throw new Error('Ficha não pode ser completa sem auditoria aprovada e sem derivação');
  }

  return {
    estado, formato, presenca, suporte, derivado, completudeAuditada,
    ...(motivo ? { motivo } : {}),
    ...(detalhes.erro ? { erro: String(detalhes.erro) } : {}),
    ...(detalhes.titulo ? { titulo: detalhes.titulo } : {}),
    ...(Number.isInteger(detalhes.paginaInicio) ? { paginaInicio: detalhes.paginaInicio } : {}),
    ...(Number.isInteger(detalhes.linhaInicio) ? { linhaInicio: detalhes.linhaInicio } : {}),
  };
};

// O identificador técnico é estável e independente do nome exibido. O catálogo
// central pode associá-lo à ficha oficial sem obrigar os consumidores atuais a
// trocar de contrato durante a migração.
const idFichaDbk = (tipo) => `dbk:${tipo}`;

export async function parseDBK(text, log = noop) {
  log('Lendo arquivo .DBK...');
  const lines = text.split(/\r\n|\r|\n/);

  const contribuinte = { cpf: '', nome: '' };
  const bens = [];
  const dividas = [];
  const rendimentos = [];
  const pagamentos = [];
  // Dependentes (registro 25, um por dependente) — layout decifrado contra
  // a declaração real (único dependente do exemplo, ANA MARIA BERNARDES DE
  // CASTRO): nome, CPF, data de nascimento e celular batem caractere a
  // caractere com a página "DEPENDENTES" do PDF. `parentesco` guarda o
  // código cru da declaração (field 19,2), não uma tradução — o próprio
  // formulário manual de dependente já pede "Código conforme a tabela da
  // declaração" nesse campo (TitularPage.jsx), então não há nada pra
  // inventar aqui. O flag "mora com o titular" (field 112,1) só tem UM
  // exemplo confirmado ("1" = Sim); nunca visto um caso "Não" pra saber se
  // vira "0" ou fica em branco — guardado mas não exibido na UI ainda por
  // essa incerteza.
  const dependentes = [];
  let anoCalendario = null;
  // Resumo/Imposto Devido (registro 20, único por declaração) — posições
  // conferidas byte a byte contra a página "RESUMO" de uma declaração real
  // (ver HANDOFF/auditoria de 19-20/08/2026): totalizadores de rendimento
  // tributável, deduções, base de cálculo, imposto devido e pago, saldo a
  // pagar, mais bens/dívidas/rendimentos isento-exclusivo oficiais (cruzam
  // com a página "Evolução Patrimonial", usados só como conferência — o
  // app já calcula os próprios totais a partir de bens/dívidas/rendimentos
  // importados) e o resultado da Lei 14.754/2023. Duas posições ambíguas
  // (imposto pago titular/total e dívidas anterior/atual têm o mesmo valor
  // nesta declaração de exemplo): resolvidas pela ORDEM em que aparecem no
  // registro, seguindo a mesma convenção anterior-antes-de-atual já
  // confirmada nos outros campos deste registro.
  let impostoDevido = null;
  // ---------------------------------------------------------------------
  // GANHOS DE CAPITAL (demonstrativo inteiro) e RENDA VARIÁVEL.
  //
  // Até 24/08/2026 este parser lia só três registros (62 = bem móvel,
  // 65 = adquirente, 69 = apuração do móvel) e os casava POR POSIÇÃO no
  // array, porque o campo de vínculo não tinha sido identificado. As quatro
  // fichas do menu "Ganhos de Capital" do programa da Receita (Bens Imóveis,
  // Direitos/Bens Móveis, Participações Societárias e Moedas em Espécie) e as
  // duas de "Renda Variável" (Operações Comuns/Day-Trade e Operações em FII
  // ou Fiagro) passam a ser lidas por inteiro, com o layout oficial extraído
  // do `mapeamentoTxt.xml` do próprio IRPF2026 e conferido campo a campo
  // contra a declaração real de referência.
  //
  // O VÍNCULO ENTRE OS REGISTROS, que faltava: cada operação tem uma chave
  // NR_OPERACAO nas posições 33-36, e os registros satélites repetem essa
  // chave. O registro 65 (adquirentes) ainda traz, na posição 37, o TIPO do
  // bem (1 = imóvel, 2 = móvel, 3 = participação societária) — o dígito que o
  // comentário anterior descrevia como "fixo, não indica CPF x CNPJ". Ele é
  // fixo no arquivo de referência porque as três operações de lá são todas de
  // bem móvel. Com tipo + número de operação a junção deixa de depender da
  // ordem das linhas, que numa declaração com imóvel E móvel colidiria (as
  // duas fichas numeram a partir de 0001).
  //
  // Estrutura de saída: uma lista única `operacoes`, cada item com `tipo`
  // ('imovel' | 'movel' | 'participacao') e os blocos que a ficha impressa
  // mostra (dados do bem, aquisição, operação, perguntas, adquirentes,
  // apuração, cálculo do imposto, consolidação, faixas de tributação e
  // parcelas). Moeda estrangeira em espécie é ficha à parte, com operações
  // (74) e totalização mensal (76).
  const gcOperacoes = new Map();   // chave: `${tipo}#${numeroOperacao}`
  let gcConsolidacao = null;       // registro 60
  const gcMoedaOperacoes = [];     // registro 74
  const gcMoedaMensal = [];        // registro 76
  // Chave estável para os registros satélites. Sem número de operação (campo
  // em branco em arquivo antigo) cai numa chave sequencial própria, para o
  // dado não sumir nem contaminar a operação 0000 de outro tipo.
  const gcChave = (tipo, numero) => `${tipo}#${(numero || '').trim() || '0000'}`;
  // Cria a operação na primeira vez que qualquer registro dela aparece. Os
  // satélites (65, 68 a 73, 75) podem, em tese, vir antes do registro-mãe.
  const gcOperacao = (tipo, numero) => {
    const chave = gcChave(tipo, numero);
    if (!gcOperacoes.has(chave)) {
      gcOperacoes.set(chave, {
        id: gcOperacoes.size + 1,
        tipo,
        numeroOperacao: (numero || '').trim(),
        adquirentes: [],
        ampliacoesReformas: [],
        parcelas: [],
        custosAquisicao: [],
        faixasTributacao: [],
      });
    }
    return gcOperacoes.get(chave);
  };
  const GC_TIPO_POR_INDICADOR = { 1: 'imovel', 2: 'movel', 3: 'participacao' };
  // Natureza da operação (CD_OPERACAO). O arquivo grava o código e também a
  // descrição por extenso, que é o que a ficha imprime — guardamos os dois.
  const gcNatureza = (codigo, descricao) => ({ codigo: (codigo || '').trim(), descricao: (descricao || '').trim() });
  // Atividade Rural: registro 50 = imóveis explorados, registro 54 = bens
  // da atividade rural. Posições conferidas contra uma declaração real com
  // 24 imóveis e 60 bens (área, participação, condição, código atividade e
  // CIB batendo um a um contra o PDF oficial da mesma declaração). ACHADO
  // REAL no registro 54: a ordem situação-anterior/situação-atual é
  // INVERTIDA em relação ao registro 27 (bens comuns) — só foi possível
  // perceber testando itens com valor anterior≠atual (bens comprados só em
  // 2025, saldo anterior zero); itens com anterior=atual não denunciavam o
  // problema. Não confundir a convenção dos dois registros.
  const imoveisRurais = [];
  const bensRurais = [];
  const dividasRurais = [];
  let imovelRuralId = 1, bemRuralId = 1, dividaRuralId = 1;
  // Receitas e Despesas mensais (registro 51, um por mês) e Apuração do
  // Resultado (registro 52, único) — puramente informativos, igual
  // impostoDevido/apuracaoGanhoCapital: mostram o que a PRÓPRIA declaração
  // apurou, não substituem lancamentosRurais (lançamento manual). Posições
  // conferidas contra 12 pares mês-a-mês e o resultado da página
  // "RECEITAS E DESPESAS - BRASIL"/"APURAÇÃO DO RESULTADO - BRASIL" de uma
  // declaração real (ver HANDOFF 20/08/2026).
  const receitasDespesasRuraisOficial = [];
  let apuracaoResultadoRuralOficial = null;
  // Isentos e exclusiva: agregado por código (registros 23/24) e detalhe por
  // fonte pagadora (registros 84/88). Conciliados depois do loop.
  const agregadosRendimento = [];
  const detalhesRendimento = [];
  const exigibilidadeSuspensa = [];
  // Doações, agora pelo `.DBK` também. Até 24/08/2026 este handoff afirmava que
  // o formato não tinha registro para elas, e por isso o único caminho era o
  // PDF, com layout EXTRAPOLADO e marcado na tela como não confirmado. O mapa
  // oficial de registros mostra que existem: REG_DOACOESCAMPANHA (34),
  // REG_DOACAO (90), REG_DOACAO_ECA (91) e REG_DOACAO_IDOSO (92). Só não
  // aparecem no arquivo de referência porque aquele contribuinte não doou.
  const doacoesEfetuadas = [];
  const doacoesPartidos = [];
  const doacoesEcaIdoso = [];
  let doacaoEfId = 1, doacaoPartId = 1, doacaoEcaIdosoId = 1;
  // Movimentação do Rebanho (registro 53, um por espécie com movimento —
  // só a linha de Bovinos e bufalinos existe no arquivo de referência, as
  // demais espécies com tudo zerado nem geram registro, mesmo padrão de
  // bens/dívidas com valor zero). Layout decifrado nesta sessão: código de
  // 2 dígitos da espécie (só "01" = Bovinos e bufalinos foi confirmado;
  // qualquer outro código aparece cru na tela, sem tradução inventada) +
  // 6 campos N10 (8 dígitos + 2 decimais implícitas, mesma lógica de
  // parseValorN13 com largura menor) em ORDEM INVERTIDA à tabela visual do
  // PDF (estoque final, vendas, consumo e perdas, nascimentos, aquisições,
  // estoque inicial) — confirmado pelos 4 valores não-zero do exemplo
  // (125,00/27,00/123,00/29,00 batendo exatos); os dois campos zerados
  // (nascimentos e consumo e perdas) ficam na ordem que essa inversão
  // sugere, mas SEM confirmação com valor não-zero de nenhum dos dois.
  const movimentacaoRebanhoOficial = [];
  // Participantes dos Imóveis Rurais (registro 57, um por participante) —
  // nome + CPF batem exatos contra os 18 "PARTICIPANTE(S)" da declaração
  // real. NÃO dá pra vincular cada participante ao imóvel específico: os
  // 24 registros 50 vêm todos juntos primeiro no arquivo, os 18 registros
  // 57 vêm todos juntos DEPOIS (sem intercalar), e o único campo numérico
  // não identificado no fim de cada linha (15 dígitos no registro 50, 16
  // no registro 57) parece ser um ID interno de registro do software
  // (fica PRÓXIMO entre participantes do mesmo imóvel, mas nunca IGUAL ao
  // do imóvel correspondente) — não é uma chave estrangeira confiável.
  // Arriscar um vínculo por proximidade desses números poderia atribuir um
  // participante ao imóvel errado, então a lista fica solta (não entra em
  // imoveisRurais), com nome + CPF de cada participante.
  const participantesRuraisOficial = [];
  // Demonstrativo de Apuração do Imposto sobre Aplicações Financeiras e
  // Lucros/Dividendos no Exterior, Lei 14.754/2023 (registro 37, um por
  // bem gerador de ganho) — o AGREGADO (ganho total, imposto total) já
  // vinha do registro 20 (lei14754Ganho/lei14754Imposto, ver acima); isto é
  // o DETALHAMENTO por bem, mostrado na página "DEMONSTRATIVO DE APURAÇÃO -
  // LEI 14.754/2023" do PDF. Só existe 1 registro no arquivo de referência
  // (bem 133, tipo AF), batendo exato com a única linha da tabela da
  // declaração real: ganho 1.822.059,55, imposto devido 273.308,93, imposto
  // pago no Brasil/Exterior 0,00 ("-" no PDF), base de cálculo e saldo
  // repetindo o mesmo valor do ganho. Campo "bem" é só o NÚMERO interno
  // impresso na coluna "Bem" do demonstrativo (não um texto de descrição
  // como no registro 62) — o próprio PDF orienta "a identificação do bem
  // pode ser verificada na impressão da ficha de Bens e Direitos", ou seja,
  // não é uma chave que o app já tenha como resolver para um bem cadastrado
  // (mesma cautela do vínculo não confiável do registro 57): fica exibido
  // cru, sem tentar linkar. O campo "Tipo" (AF=Aplicação Financeira /
  // LD=Lucros e Dividendos) da mesma coluna do PDF NÃO foi decifrado: com
  // só 1 exemplo (sempre "AF") não dá pra isolar quais dígitos do trecho
  // não identificado (posições 19-24) codificam o tipo — fica de fora até
  // aparecer uma declaração de referência com um caso "LD". O campo
  // "Prejuízo do ano anterior" (0,00 no exemplo, mostrado uma vez só acima
  // da tabela, não por bem) também não foi localizado: não há âncora nem
  // repetição pra confirmar posição com um valor sempre zerado, e não
  // aparece dentro deste registro repetido por bem — fica como lacuna
  // conhecida, documentada, em vez de posição inventada.
  const demonstrativoExteriorOficial = [];
  // Ganhos Líquidos em Renda Variável mês a mês (registro 76, um por mês).
  // `mes`: field(33,2) — CONFIRMADO nos 12 registros do arquivo de
  // referência, saem exatos "01".."12" em ordem, batendo com JAN..DEZ da
  // página "GANHOS LÍQUIDOS OU PERDAS" do PDF. NENHUM campo de valor
  // monetário foi decifrado: do byte 35 até ~120 os 12 registros têm ZERO
  // em toda a faixa (bate com "Sem Informações" nas 12 páginas do exemplo,
  // porque a Renda Variável está zerada o ano inteiro nesta declaração) —
  // ou seja, não existe NENHUMA âncora (nenhum valor não-zero) para achar
  // a posição de um campo "ganho líquido do mês" com confiança. Há um
  // trecho constante "0000015000" em ~89-98 (igual nos 12 registros, não
  // varia por mês, não parece ser o valor do mês) e um trecho final em
  // ~121-135 que varia por registro mas não é zero-padded como um N13
  // seria numa ficha "Sem Informações" (mesmo padrão de ID interno de
  // registro já visto e documentado nos registros 50/57) — não é um valor
  // financeiro. Por isso só o mês é importado: mostrar um valor de ganho
  // "adivinhado" seria pior que não mostrar nada, numa declaração de
  // imposto de renda de verdade. Decifrar o campo de valor exige uma
  // declaração de referência com ganho REAL (não-zero) em algum mês.
  const rendaVariavelMensalOficial = [];
  // Consolidação ANUAL da Renda Variável (registro 41) e a ficha irmã de
  // Fundos de Investimento Imobiliário / Fiagro (42 = mês a mês, 43 = totais
  // do ano). Nenhuma das duas era lida: a ficha "Operações em FII ou Fiagro"
  // do menu Renda Variável simplesmente não existia neste app, e o
  // fechamento anual das operações comuns/day-trade também não.
  let rendaVariavelAnualOficial = null;
  const fiiFiagroMensalOficial = [];
  let fiiFiagroAnualOficial = null;

  let bemId = 1, dividaId = 1, rendId = 1, pagId = 1, depId = 1;

  // Espelho da rede que o caminho PDF ganhou em 23/08/2026: o arquivo pode
  // conter informação que este parser não lê, e o silêncio é o pior desfecho.
  //
  // A PRIMEIRA versão tentava detectar "registro não tratado COM valor",
  // procurando qualquer sequência de 13 dígitos não-zero na linha. Não funciona
  // e o teste provou na hora: sem conhecer o layout do registro, o regex
  // desliza sobre a linha inteira e casa pedaços de CPF, de tipo e de data
  // (pedaços de CPF, de tipo e de data), acusando valor nos três tipos que estão
  // comprovadamente zerados. Detectar valor em layout desconhecido é adivinhar.
  //
  // O critério honesto é outro: avisar quando aparece um TIPO DE REGISTRO que
  // este parser não conhece. Isso não depende de entender o conteúdo, e é a
  // informação que de fato importa — o arquivo mudou, ou tem ficha que o app
  // ainda não cobre.
  // ATENÇÃO: ao passar a ler um tipo novo, ACRESCENTE-O AQUI. O filtro abaixo
  // corta qualquer tipo que não esteja nesta lista ANTES de chegar aos
  // handlers, então esquecer disso faz o handler novo simplesmente não rodar —
  // aconteceu com o registro 22, e só não passou porque o teste dele falhou na
  // hora.
  const TIPOS_TRATADOS = new Set(['IR', '16', '18', '20', '21', '22', '23', '24', '25', '26', '27', '28', '32',
    '34', '37', '40', '50', '51', '52', '53', '54', '55', '57', '84', '88',
    '45', '47', '80', '81', '83', '85', '86', '87', '89', '90', '91', '92',
    // Ganhos de Capital (as quatro fichas) e Renda Variável (as duas), lidos
    // por inteiro desde 24/08/2026: 60 é o cabeçalho do demonstrativo, 61/62/63
    // são os registros-mãe de imóvel, móvel e participação societária, 65 são
    // os adquirentes, 66/67 as ampliações e reformas, 68/69/70 as apurações,
    // 71/72 as parcelas da alienação a prazo, 73 o custo de aquisição da
    // participação, 74 as moedas em espécie, 75 as faixas de tributação e 76 a
    // totalização mensal das moedas alienadas. 41/42/43 são o fechamento anual
    // da renda variável e a ficha de FII/Fiagro.
    '41', '42', '43',
    '60', '61', '62', '63', '65', '66', '67', '68', '69', '70', '71', '72', '73', '74', '75', '76']);
  // Tipos JÁ investigados que este parser não lê, e que por isso não geram
  // aviso: nas declarações de referência estão todos zerados ou são estrutura.
  //   19 - traz o CNPJ do INSS e o valor do 13º salário, que já entra pelo
  //        registro 24 (código 01) e não pode ser contado duas vezes.
  //   T9 - trailer do arquivo, só contagens de registro.
  // Os registros 60, 74, 75 e 76 SAÍRAM desta lista em 24/08/2026: eram
  // descritos aqui como "estrutura sem valor financeiro" porque vêm zerados na
  // declaração de referência, mas são o cabeçalho do demonstrativo de Ganhos de
  // Capital, as moedas em espécie, as faixas de tributação e a totalização
  // mensal das moedas alienadas. Passaram a ser lidos com o layout oficial.
  // ATENÇÃO: 19, 60 e 75 estão zerados NAS DUAS declarações disponíveis. Se
  // alguma vez aparecerem preenchidos, o dado não entra e não há aviso — é uma
  // limitação conhecida, e o caminho para resolver é decifrar o layout deles
  // contra uma declaração que os traga com conteúdo.
  // O 76 entrou aqui em 24/08/2026: é `REG_GCME_PARCELA_ESPECIE` (ganho de
  // capital em moeda estrangeira, mês a mês), e não renda variável como este
  // parser supunha. O app não modela GCME, então ele deixa de ser lido — e não
  // gera aviso, porque na declaração de referência vem zerado.
  // 46 e 48 são a pensão alimentícia vinculada ao RRA do titular e do
  // dependente; o app não modela pensão como ficha própria.
  //
  // O 33 (`REG_LUCROSDIVIDENDOS`) fica DE FORA de propósito, e não por
  // esquecimento: ele é o detalhe dos lucros e dividendos por fonte pagadora, e
  // esse mesmo valor já entra pelo registro 84 (detalhe do rendimento isento
  // código 09). Lê-lo também duplicaria o rendimento. Como a declaração de
  // referência não tem registro 33, não há como confirmar a relação entre os
  // dois — e diante da dúvida, duplicar renda é o pior desfecho possível.
  const TIPOS_CONHECIDOS_NAO_LIDOS = new Set(['19', '33', '46', '48', 'T9']);
  const TIPOS_RURAIS_COM_FLAG_EXTERIOR = new Set(['50', '51', '52', '53', '54', '55']);
  const rurodoExterior = new Set();
  const tiposDesconhecidos = new Set();
  const contagemTipos = new Map();
  const fichasNaoLidasComConteudo = [];
  const registrosDbkNaoModelados = [];
  const avisosImportacao = [];

  // Número do registro no arquivo, contado a partir de UM, que é a referência
  // útil num arquivo de largura fixa (o equivalente da página e linha do PDF).
  // Permite à interface apontar de onde o item veio, como já faz com o PDF.
  let numeroRegistro = 0;
  const origemDbk = () => ({ formato: 'dbk', registro: numeroRegistro });

  for (const line of lines) {
    numeroRegistro += 1;
    const tipo = line.substring(0, 2);

    // Linha vazia (o arquivo termina com quebra de linha, e pode ter linha em
    // branco no meio) não é registro nenhum. Sem esta guarda o aviso de tipo
    // desconhecido dispara em TODA importação, com um tipo de nome vazio — foi
    // o que o teste flagrou assim que passou a existir.
    if (line.trim() === '') continue;
    contagemTipos.set(tipo, (contagemTipos.get(tipo) || 0) + 1);

    if (!TIPOS_TRATADOS.has(tipo) && !TIPOS_CONHECIDOS_NAO_LIDOS.has(tipo)) {
      tiposDesconhecidos.add(tipo);
      continue;
    }

    // Registro de cabeçalho "IRPF    <exercício><ano-calendário>..." —
    // ex.: "IRPF    20262025" = exercício 2026, ano-calendário 2025.
    if (tipo === 'IR') {
      const ano = field(line, 13, 4);
      if (/^\d{4}$/.test(ano)) anoCalendario = parseInt(ano, 10);
      continue;
    }

    if (tipo === '16') {
      const cpf = field(line, 3, 11);
      const nome = field(line, 14, 60);
      if (/^\d{11}$/.test(cpf)) {
        // O layout XML descreve a variante longa (1.250 posições). O arquivo
        // real para endereço no Brasil usa uma variante compacta de 930:
        // omite NM_PAIS (40), NM_OCUP (150) e NM_NAT_OCUP (130). Os campos
        // seguintes deslocam exatamente 40, 190 e 320 posições. As âncoras
        // data/CPF do cônjuge/códigos de ocupação foram conferidas no arquivo
        // real; descrições ausentes ficam vazias, nunca são inferidas.
        const compacto = line.length < 1100;
        const pos16 = (oficial) => {
          if (!compacto) return oficial;
          if (oficial >= 707) return oficial - 320;
          if (oficial >= 575) return oficial - 190;
          if (oficial >= 425) return null;
          if (oficial >= 276) return oficial - 40;
          if (oficial >= 236) return null;
          return oficial;
        };
        const f16 = (oficial, tamanho) => {
          const pos = pos16(oficial);
          return pos == null ? '' : field(line, pos, tamanho);
        };
        Object.assign(contribuinte, {
          cpf,
          nome,
          tipoLogradouro: field(line, 74, 15),
          logradouro: field(line, 89, 40),
          numero: field(line, 129, 6),
          complemento: field(line, 135, 21),
          bairro: field(line, 156, 19),
          cep: field(line, 175, 9),
          codigoMunicipio: field(line, 184, 4),
          municipio: field(line, 188, 40),
          uf: field(line, 228, 2),
          codigoExterior: field(line, 230, 3),
          codigoPais: field(line, 233, 3),
          pais: f16(236, 40),
          email: f16(276, 90),
          nitPisPasep: f16(366, 11),
          cpfConjuge: f16(377, 11),
          dddTelefone: f16(388, 4),
          dataNascimento: dataDDMMAAAAparaIso(f16(401, 8)),
          ocupacaoCodigo: f16(422, 3),
          ocupacaoDescricao: compacto ? '' : f16(425, 150),
          naturezaOcupacaoCodigo: f16(575, 2),
          naturezaOcupacaoDescricao: compacto ? '' : f16(577, 130),
          numeroQuotas: Number(f16(707, 1) || 0),
          declaracaoCompleta: f16(708, 1) === 'S',
          retificadora: f16(709, 1) === 'S',
          mudancaEndereco: f16(711, 1) === 'S',
          numeroControleOriginal: f16(712, 12),
          banco: f16(724, 3),
          agencia: f16(727, 4),
          doencaDeficiencia: f16(731, 1) === 'S',
          atualizacaoBemLei14973: f16(745, 1) === '1',
          digitoConta: f16(746, 2),
          debitoAutomatico: f16(748, 1) === 'S',
          debitoPrimeiraQuota: f16(749, 1) === '1',
          fontePrincipalCpfCnpj: f16(750, 14),
          reciboUltimaDeclaracao: f16(764, 10),
          tipoDeclaracaoCodigo: f16(774, 1),
          cpfProcurador: f16(775, 11),
          registroProfissional: f16(786, 20),
          dddCelular: f16(806, 2),
          celular: f16(808, 9),
          possuiConjuge: f16(817, 1) === 'S',
          telefone: f16(818, 11),
          tipoConta: f16(829, 1),
          conta: f16(830, 20),
          numeroProcessoDigital: f16(850, 17),
          cpfResponsavel: f16(867, 11),
          retornoPais: f16(1192, 1) === '1',
          dataRetornoPais: dataDDMMAAAAparaIso(f16(1193, 8)),
          processoAtualizacaoBem: f16(1201, 17),
          prejuizoAnteriorLei14754: parseValorN13Signed(f16(1226, 13)),
          racaCorCodigo: f16(1240, 1),
        });
      }
      continue;
    }

    if (tipo === '25') {
      const codigo = field(line, 19, 2);
      const nome = field(line, 21, 60);
      const dataNascimento = dataDDMMAAAAparaIso(field(line, 81, 8));
      const cpf = field(line, 89, 11);
      if (nome) {
        const racaCorCodigo = field(line, 214, 1);
        dependentes.push({
          id: depId++,
          origemDocumento: origemDbk(),
          nome,
          cpf,
          dataNascimento,
          parentesco: codigo,
          saidaComDeclarante: field(line, 100, 1) === '1',
          nitPisPasep: field(line, 101, 11),
          moraComTitular: field(line, 112, 1) === '1',
          email: field(line, 113, 90),
          dddCelular: field(line, 203, 2),
          celular: field(line, 205, 9),
          racaCorCodigo,
          racaCor: RACA_COR_POR_CODIGO[racaCorCodigo] || '',
        });
      }
      continue;
    }

    if (tipo === '27') {
      // Mesmo deslocamento derivado do registro 54 (ver achado 18): o layout
      // oficial tem 1291 posições, com NM_PAIS ocupando 40 delas a partir da
      // 20; a linha real do Brasil tem 1251 e não traz esse campo.
      const off27 = line.length >= 1280 ? 0 : -40;
      const codigo = field(line, 14, 2);
      const discriminacao = field(line, 60 + off27, 512);
      const anterior = parseValorN13(field(line, 572 + off27, 13));
      const atual = parseValorN13(field(line, 585 + off27, 13));
      const grupo = field(line, 1141 + off27, 2);
      // IN_TIPO_BENEFIC (oficial 1129) e NR_CPF_BENEFIC (1130): a quem o bem
      // pertence. ACHADO 14 da auditoria de 24/08/2026 — os dois caminhos de
      // importação cravavam 'Titular' em todo bem, e na declaração de
      // referência SEIS dos 172 bens trazem 'D' com o CPF da dependente. O
      // rótulo errado ia junto para o .xlsx entregue.
      const tipoBenefic = field(line, 1129 + off27, 1).toUpperCase();
      const cpfBenefic = field(line, 1130 + off27, 11);
      // NM_CPFCNPJ (oficial 1042): a instituição ou a empresa a que o bem se
      // refere. É o que permite cruzar um bem com o rendimento pago pela MESMA
      // fonte — ver aplicacoesResgatadasSemRendimento em demonstrativos.js.
      const cnpjBem = normalizarCpfCnpj(field(line, 1082 + off27, 14));
      if (discriminacao || anterior || atual) {
        bens.push({
          origemDocumento: origemDbk(),
          id: bemId++,
          grupo: grupo ? grupo.padStart(2, '0') : '99',
          codigo_bem: codigo,
          // 512, a largura real do campo lido acima, e não 200. O corte em
          // 200 descartava texto de verdade em 26 dos 172 bens da declaração
          // de referência (o maior tem 510 caracteres), e ainda fazia os dois
          // caminhos de importação produzirem textos diferentes para o mesmo
          // bem, já que o parsePDF preservava mais. Achado na auditoria de
          // 21/08/2026.
          discriminacao: discriminacao.substring(0, 512),
          situacao_anterior: anterior,
          situacao_atual: atual,
          localizacao: '105',
          // 'D' = dependente. Campo em branco (44 dos 172 bens do arquivo de
          // referência) segue como Titular, que é o padrão da ficha.
          beneficiario: tipoBenefic === 'D' ? 'Dependente' : 'Titular',
          cpf_beneficiario: tipoBenefic === 'D' ? cpfBenefic : '',
          cnpj: cnpjBem,
        });
      }
      continue;
    }

    if (tipo === '28') {
      const codigo = field(line, 14, 2);
      const discriminacao = field(line, 16, 512);
      const anterior = parseValorN13(field(line, 528, 13));
      const atual = parseValorN13(field(line, 541, 13));
      const valorPago = parseValorN13(field(line, 554, 13));
      if (discriminacao || anterior || atual) {
        dividas.push({
          origemDocumento: origemDbk(),
          id: dividaId++,
          codigo,
          discriminacao: discriminacao.substring(0, 512), // ver registro 27 acima
          situacao_anterior: anterior,
          situacao_atual: atual,
          valor_pago: valorPago,
        });
      }
      continue;
    }

    // Rendimentos tributáveis de PESSOA JURÍDICA. São DOIS registros, um por
    // beneficiário: 21 (`REG_RENDPJ`) para o titular e 32
    // (`REG_RENDPJDEPENDENTE`) para os dependentes. Até 24/08/2026 este parser
    // lia só o 21 — numa declaração em que o dependente tem emprego ou
    // aposentadoria, os rendimentos dele sumiam do `.DBK` inteiro.
    //
    // O gap era invisível na declaração de referência, onde a dependente não
    // tem rendimento de PJ; mas o OUTRO contribuinte, que só tem PDF, tem
    // quatro fontes de dependente somando R$ 112.084,33 — pelo caminho PDF
    // elas entram desde a ATUALIZAÇÃO 40, e pelo `.DBK` não entrariam.
    //
    // Os dois têm os mesmos campos, em posições diferentes porque o 32 carrega
    // o CPF do dependente na frente. Layout oficial em LAYOUT-DBK-OFICIAL.md.
    if (tipo === '21' || tipo === '32') {
      const ehDependente = tipo === '32';
      const base = ehDependente ? 11 : 0;   // o 32 tem o CPF do dependente a mais
      const cnpj = field(line, 14 + base, 14);
      const fonte = field(line, 28 + base, 60);
      const rendimento = parseValorN13(field(line, 88 + base, 13));
      const irrf = parseValorN13(field(line, 127 + base, 13));
      if (fonte || rendimento) {
        rendimentos.push({
          id: rendId++,
          tipo: 'tributavel_pj',
          cnpj_fonte: cnpj,
          nome_fonte: fonte,
          beneficiario: ehDependente ? 'Dependente' : 'Titular',
          cpf_dependente: ehDependente ? field(line, 14, 11) : null,
          valor: rendimento,
          irrf,
          // Os três campos abaixo o caminho PDF já trazia desde a ATUALIZAÇÃO
          // 40, e o `.DBK` deixava de fora sem motivo — a assimetria não
          // aparecia na auditoria cruzada porque ela compara `valor` e `irrf`.
          contribuicaoPrevidenciaria: parseValorN13(field(line, 101 + base, 13)),
          decimoTerceiro: parseValorN13(field(line, 114 + base, 13)),
          irrfDecimoTerceiro: parseValorN13(field(line, 148 + base, 13)),
          // O .DBK não traz data por rendimento (é total anual, não um
          // lançamento pontual) — sem isso, `noPeriodo` (demonstrativos.js)
          // descartava TODO rendimento importado de qualquer consulta com
          // período ativo (o Dashboard sempre tem um), zerando Rendimentos
          // no Demonstrativo de Conciliação mesmo com dado real importado.
          // 31/12 do próprio ano-calendário cai dentro de qualquer consulta
          // que cubra o ano inteiro (o caso normal), sem inventar uma data
          // de verdade que o arquivo não tem.
          data: anoCalendario ? `${anoCalendario}-12-31` : '',
        });
      }
      continue;
    }

    // Registros 23/24: o valor AGREGADO por código dos rendimentos isentos
    // (23) e de tributação exclusiva (24). São guardados, e não emitidos na
    // hora: quando existe detalhe por fonte pagadora (registros 84/88, ver
    // abaixo), é o detalhe que entra, e o agregado vira conferência. Mesma
    // regra do caminho PDF, onde a ficha também imprime os dois.
    // Registro 22: rendimentos recebidos de PESSOA FÍSICA e do EXTERIOR, mês a
    // mês, com as deduções e o imposto pago por carnê-leão. É a ficha que
    // faltava ao app, e a única implementada a partir do LAYOUT OFICIAL
    // (LAYOUT-DBK-OFICIAL.md) sem uma declaração de referência preenchida —
    // as duas disponíveis trazem essa ficha "Sem Informações".
    //
    // A diferença em relação às Doações (ATUALIZAÇÃO 6), que também foram
    // feitas sem dado real e por isso ficaram marcadas na tela como layout não
    // confirmado, é a fonte: lá o layout foi EXTRAPOLADO de outra tabela do
    // PDF; aqui as posições são as que a Receita publica no próprio programa.
    // Não é chute, é leitura de especificação — mas continua sem ter passado
    // por um arquivo real, e isso está dito no aviso do import.
    // Rendimentos Recebidos Acumuladamente (RRA): registros 45 (titular) e 47
    // (dependente). São valores de anos anteriores pagos de uma vez, por
    // decisão judicial ou administrativa, e têm regra própria — o imposto é
    // calculado sobre a média mensal (o número de meses está no próprio
    // registro), e o contribuinte ESCOLHE entre tributar exclusivamente na
    // fonte ou levar ao ajuste anual.
    //
    // Layout dos dois é igual, deslocado em 11 posições no 47, que carrega o
    // CPF do dependente. Os registros 46 e 48 são a pensão alimentícia
    // vinculada a cada um, e não são lidos (o app não modela pensão como ficha
    // própria) — ficam na lista de tipos conhecidos e não lidos.
    if (tipo === '45' || tipo === '47') {
      const ehDependente = tipo === '47';
      const base = ehDependente ? 11 : 0;
      const nome = field(line, 30 + base, 60);
      const tributavel = parseValorN13(field(line, 181 + base, 13));
      const rendimentoTotal = parseValorN13(field(line, 90 + base, 13));
      if (nome || rendimentoTotal) {
        rendimentos.push({
          id: rendId++,
          tipo: 'tributavel_rra',
          cnpj_fonte: field(line, 16 + base, 14),
          nome_fonte: nome,
          beneficiario: ehDependente ? 'Dependente' : 'Titular',
          cpf_dependente: ehDependente ? field(line, 16, 11) : null,
          // O que entra como rendimento é o valor TRIBUTÁVEL, não o bruto: do
          // total recebido saem a contribuição previdenciária, a pensão
          // alimentícia e a parcela isenta de quem tem 65 anos ou mais, e a
          // própria ficha calcula o tributável em campo separado.
          valor: tributavel,
          irrf: parseValorN13(field(line, 129 + base, 13)),
          rendimentoBruto: rendimentoTotal,
          contribuicaoPrevidenciaria: parseValorN13(field(line, 103 + base, 13)),
          pensaoAlimenticia: parseValorN13(field(line, 116 + base, 13)),
          parcelaIsenta65Anos: parseValorN13(field(line, 168 + base, 13)),
          // Os juros do RRA são rendimento ISENTO (código 27 da ficha de
          // isentos), e por isso ficam à parte do valor tributável.
          juros: parseValorN13(field(line, 194 + base, 13)),
          impostoRra: parseValorN13(field(line, 155 + base, 13)),
          numeroMeses: parseInt(field(line, 151 + base, 4), 10) || 0,
          mesRecebimento: parseInt(field(line, 142 + base, 2), 10) || 0,
          // Guardado CRU: o layout não documenta a tabela de valores, e deduzir
          // o "de-para" de um caso só seria chute (mesmo critério do código de
          // parentesco e da opção de apuração rural). É por este campo que se
          // sabe se o RRA foi tributado exclusivamente na fonte ou levado ao
          // ajuste anual.
          opcaoTributacao: field(line, 150 + base, 1),
          data: anoCalendario ? `${anoCalendario}-12-31` : '',
        });
      }
      continue;
    }

    // Rendimentos com EXIGIBILIDADE SUSPENSA (80 titular, 81 dependente): estão
    // em discussão judicial e NÃO foram recebidos em definitivo. Não entram
    // como rendimento — seria afirmar renda que a pessoa pode ter de devolver.
    // São contados só para o aviso no fim da importação.
    if (tipo === '80' || tipo === '81') {
      const valor = parseValorN13(field(line, tipo === '81' ? 99 : 88, 13));
      if (valor > 0) exigibilidadeSuspensa.push(valor);
      continue;
    }

    if (tipo === '22') {
      const mes = parseInt(field(line, 26, 2), 10);
      const recebidos = parseValorN13(field(line, 28, 13));
      const alugueis = parseValorN13(field(line, 41, 13));
      const outros = parseValorN13(field(line, 54, 13));
      const exterior = parseValorN13(field(line, 67, 13));
      const total = recebidos + alugueis + outros + exterior;
      // Mês sem nenhum rendimento não vira lançamento: a ficha existe com os 12
      // meses mesmo quando só alguns têm valor.
      if (mes >= 1 && mes <= 12 && total > 0) {
        const ehDependente = field(line, 14, 1).toUpperCase() === 'S';
        rendimentos.push({
          id: rendId++,
          tipo: 'tributavel_pf_exterior',
          cnpj_fonte: '',
          nome_fonte: '',
          beneficiario: ehDependente ? 'Dependente' : 'Titular',
          cpf_dependente: ehDependente ? field(line, 15, 11) : null,
          valor: total,
          // O que a ficha chama de imposto é o carnê-leão pago no mês, que faz
          // o mesmo papel do IRRF: imposto já recolhido sobre esse rendimento.
          irrf: parseValorN13(field(line, 145, 13)),
          mes,
          recebidosPessoaFisica: recebidos,
          alugueis,
          outrosRendimentos: outros,
          rendimentosExterior: exterior,
          deducaoLivroCaixa: parseValorN13(field(line, 80, 13)),
          deducaoPensaoAlimenticia: parseValorN13(field(line, 93, 13)),
          deducaoDependentes: parseValorN13(field(line, 106, 13)),
          previdenciaPaga: parseValorN13(field(line, 119, 13)),
          baseCalculoCarneLeao: parseValorN13(field(line, 132, 13)),
          // Data convencional, como nos demais rendimentos importados: o mês
          // real está em `mes`, e usar o último dia dele mantém o lançamento
          // dentro de qualquer consulta que cubra o período.
          data: anoCalendario ? `${anoCalendario}-${String(mes).padStart(2, '0')}-28` : '',
        });
      }
      continue;
    }

    if (tipo === '23' || tipo === '24') {
      const codigo = field(line, 14, 4);
      const valor = parseValorN13(field(line, 18, 13));
      if (valor) {
        agregadosRendimento.push({
          categoria: tipo === '23' ? 'isento' : 'exclusivo',
          codigo,
          valor,
        });
      }
      continue;
    }

    // Registros 84/88: o DETALHE por fonte pagadora dos rendimentos isentos
    // (84) e de tributação exclusiva (88). Decifrados em 23/08/2026, ao varrer
    // quais tipos de registro o arquivo tem e quais este parser lia — estes
    // dois estavam sendo ignorados, e com eles o .DBK entrega a MESMA
    // granularidade do PDF (beneficiário, CPF, CNPJ e nome da fonte), que até
    // então eu tinha registrado como exclusiva do PDF.
    //
    // Layout conferido contra os totais dos registros 23/24 e contra o PDF do
    // mesmo declarante:
    //   field(14,1)   'T' titular / 'D' dependente
    //   field(15,11)  CPF de quem recebeu
    //   field(26,4)   código do rendimento (mesmo dos registros 23/24)
    //   field(30,14)  CNPJ da fonte pagadora
    //   field(44,60)  nome da fonte
    //   field(104,13) valor
    //   field(117,13) 13º salário — SÓ no registro 84, e usado pelo código 10
    //     (parcela isenta de aposentadoria de quem tem 65 anos ou mais). Os
    //     22.847,76 do valor mais os 1.903,98 daqui somam os 24.751,74 que a
    //     ficha informa no total do código, e é assim que o PDF também os
    //     apresenta ("Valor:" e "13º Salário:" em linha própria).
    // São SETE registros de detalhe, não dois: cada ficha tem várias variantes
    // de layout, que o programa chama de "tipo de informação". A ATUALIZAÇÃO 50
    // implementou só as duas mais comuns (84 e 88) e o handoff registrou como
    // se fossem as únicas.
    //
    //   83  isento,    sem fonte pagadora
    //   84  isento,    com fonte + 13º salário
    //   85  isento,    com fonte + 13º + IRRF + IRRF sobre 13º
    //   86  isento,    com fonte + descrição + chave do bem
    //   87  isento,    sem fonte, com valor de ganho de capital à parte
    //   88  exclusivo, com fonte
    //   89  exclusivo, com fonte + descrição
    //
    // Ler só 84 e 88 não produzia valor errado — a conciliação usa o AGREGADO
    // quando não há detalhe, então o total continuava certo — mas perdia o
    // detalhamento (fonte pagadora, beneficiário, descrição) de todo código que
    // usasse outra variante. Layout de cada um em LAYOUT-DBK-OFICIAL.md.
    if (DETALHE_RENDIMENTO[tipo]) {
      const cfg = DETALHE_RENDIMENTO[tipo];
      const nome = cfg.fonte ? field(line, 44, 60) : '';
      const valor = parseValorN13(field(line, cfg.valor, 13));
      const decimoTerceiro = cfg.decimoTerceiro ? parseValorN13(field(line, cfg.decimoTerceiro, 13)) : 0;
      const descricao = cfg.descricao ? field(line, cfg.descricao, 60) : '';
      if (nome || valor || descricao) {
        detalhesRendimento.push({
          categoria: cfg.categoria,
          codigo: field(line, cfg.codigo, 4),
          // O registro 87 não tem beneficiário nem CPF: é agregado por código,
          // com o valor de ganho de capital separado.
          beneficiario: cfg.beneficiario && field(line, cfg.beneficiario, 1) === 'D' ? 'Dependente' : 'Titular',
          cpf: cfg.cpf ? field(line, cfg.cpf, 11) : '',
          cnpj_fonte: cfg.fonte ? field(line, 30, 14) : '',
          nome_fonte: nome,
          // O 13º entra somado no valor porque é assim que o agregado da ficha
          // o conta (ver o código 10 dos isentos), e fica também à parte.
          valor: valor + decimoTerceiro,
          decimoTerceiro,
          ...(descricao ? { descricao } : {}),
          ...(cfg.irrf ? { irrfDetalhe: parseValorN13(field(line, cfg.irrf, 13)) } : {}),
          ...(cfg.valorGanhoCapital ? { valorGanhoCapital: parseValorN13(field(line, cfg.valorGanhoCapital, 13)) } : {}),
        });
      }
      continue;
    }

    if (tipo === '26') {
      const codigo = field(line, 14, 2);
      const ni = field(line, 16, 19);
      const beneficiario = field(line, 35, 60);
      const valorPago = parseValorN13(field(line, 106, 13));
      const parcelaNaoDedutivel = parseValorN13(field(line, 119, 13));
      // Descrição do pagamento (o campo "Descrição:" que aparece embaixo de
      // cada linha da ficha Pagamentos Efetuados). Decifrada na auditoria de
      // 21/08/2026: até então só o caminho PDF lia esse texto, e importar
      // pelo .DBK trazia os 24 pagamentos com a descrição vazia.
      //
      // Posição confirmada contra as 18 descrições reais da declaração de
      // referência, todas encontradas na MESMA posição 147. A largura sai da
      // própria estrutura da linha, que tem 671 caracteres fixos: 147 + 512
      // termina em 658, e os 13 caracteres restantes (659 a 671) são o número
      // interno de registro do programa, o mesmo padrão de ID já documentado
      // nos registros 50, 57 e 76. 512 é também a largura do campo de
      // discriminação dos registros 27/28/54, o que reforça a leitura.
      const descricao = field(line, 147, 512);
      if (beneficiario || valorPago) {
        pagamentos.push({
          origemDocumento: origemDbk(),
          id: pagId++,
          codigo,
          nome_beneficiario: beneficiario,
          cpf_cnpj: normalizarCpfCnpj(ni),
          valor_pago: valorPago,
          parcela_nao_dedutivel: parcelaNaoDedutivel,
          descricao,
          // Mesmo motivo do registro 21/23/24 acima: sem data, `noPeriodo`
          // zerava Pagamentos Efetuados no Dashboard sempre que um período
          // estava ativo.
          data: anoCalendario ? `${anoCalendario}-12-31` : '',
        });
      }
      continue;
    }

    // Doações a partidos políticos e candidatos a cargos eletivos.
    if (tipo === '34') {
      const nome = field(line, 28, 60);
      const valor = parseValorN13(field(line, 88, 13));
      if (nome || valor) {
        doacoesPartidos.push({
          id: doacaoPartId++,
          layoutOficial: true,
          codigo: '',
          nome_beneficiario: nome,
          cpf_cnpj: field(line, 14, 14),
          valor,
          descricao: '',
        });
      }
      continue;
    }

    // Doações efetuadas (a ficha com código de dedução por beneficiário).
    if (tipo === '90') {
      const nome = field(line, 30, 60);
      const valor = parseValorN13(field(line, 90, 13));
      if (nome || valor) {
        doacoesEfetuadas.push({
          id: doacaoEfId++,
          layoutOficial: true,
          codigo: field(line, 14, 2),
          nome_beneficiario: nome,
          cpf_cnpj: field(line, 16, 14),
          valor,
          parcela_nao_dedutivel: parseValorN13(field(line, 103, 13)),
          descricao: '',
        });
      }
      continue;
    }

    // Doações diretamente na declaração: ECA (91) e Pessoa Idosa (92). O layout
    // dos dois é idêntico, e o beneficiário não é uma pessoa e sim um FUNDO,
    // identificado por esfera (Nacional, Estadual ou Municipal), UF e
    // município — por isso o nome exibido é montado a partir desses campos, e
    // não lido de um campo único como nas outras duas fichas.
    if (tipo === '91' || tipo === '92') {
      const valor = parseValorN13(field(line, 87, 13));
      const cnpj = field(line, 100, 14);
      if (valor || cnpj) {
        const esfera = { N: 'Nacional', E: 'Estadual', M: 'Municipal' }[field(line, 14, 1).toUpperCase()] || '';
        const uf = field(line, 15, 2);
        const municipio = field(line, 47, 40);
        const partes = [
          `Fundo ${esfera || 'do'}`.trim(),
          municipio || field(line, 17, 30),
          uf,
        ].filter(Boolean);
        doacoesEcaIdoso.push({
          id: doacaoEcaIdosoId++,
          layoutOficial: true,
          codigo: tipo === '91' ? '41' : '42',
          nome_beneficiario: normSpace(partes.join(' - ')),
          cpf_cnpj: cnpj,
          valor,
          descricao: '',
          categoria: tipo === '91' ? 'eca' : 'idoso',
          esferaFundo: esfera,
          uf,
          municipio,
        });
      }
      continue;
    }

    // ATIVIDADE RURAL: os registros 50 a 55 usam o MESMO tipo para o imóvel no
    // BRASIL e no EXTERIOR, distinguidos pelo campo IN_EXTERIOR na posição 14
    // ('0' Brasil, '1' Exterior) — confirmado no layout oficial da Receita, ver
    // LAYOUT-DBK-OFICIAL.md.
    //
    // Até 24/08/2026 este parser IGNORAVA esse campo, então numa declaração com
    // atividade rural no exterior os imóveis, bens, dívidas e o rebanho de lá
    // entrariam somando com os do Brasil, e a apuração do resultado do exterior
    // (registro 52, um por flag) SOBRESCREVERIA a do Brasil. O app modela só a
    // atividade rural no Brasil; o que é do exterior fica de fora e vira aviso,
    // em vez de contaminar em silêncio.
    if (TIPOS_RURAIS_COM_FLAG_EXTERIOR.has(tipo) && field(line, 14, 1) === '1') {
      rurodoExterior.add(tipo);
      continue;
    }

    if (tipo === '50') {
      // NM_IMOVEL (23,60) e NM_LOCAL (83,55) são campos SEPARADOS no layout
      // oficial. A leitura anterior pegava os 114 caracteres de uma vez, o que
      // colava os dois sem pontuação ("NOME DA FAZENDA MUNICIPIO") e fazia o
      // `.DBK` divergir do PDF, que imprime "NOME DA FAZENDA, MUNICIPIO".
      // Lendo separado, os dois caminhos passam a produzir o mesmo texto.
      // O caso concreto está no manifesto local, em `imovelMirandasNomeLocalizacao`.
      const nomeImovel = field(line, 23, 60);
      const localizacao = field(line, 83, 55);
      const nomeLocalizacao = [nomeImovel, localizacao].filter(Boolean).join(', ').replace(/\s+/g, ' ').trim();
      const cibRaw = field(line, 156, 8);
      const cib = /^\d{8}$/.test(cibRaw) ? `${cibRaw.slice(0, 7)}-${cibRaw.slice(7)}` : cibRaw;
      if (nomeLocalizacao) {
        imoveisRurais.push({
          id: imovelRuralId++,
          nomeImovel,
          localizacao,
          nomeLocalizacao,
          area: parseInt(field(line, 138, 10), 10) / 10,
          participacao: parseInt(field(line, 148, 5), 10) / 100,
          condicaoExploracao: field(line, 153, 1),
          codigoAtividade: field(line, 154, 2),
          cib,
          // NR_CHAVE_AR: a chave que associa este imóvel aos seus
          // participantes (registro 57). Ver o comentário lá.
          chaveAssociacao: field(line, 164, 5),
          dataAquisicao: '',
        });
      }
      continue;
    }

    if (tipo === '54') {
      // ACHADO 18 da auditoria de 24/08/2026. As posições deste registro
      // estavam CRAVADAS 40 caracteres à esquerda das oficiais, e davam certo
      // porque o programa não grava o campo NM_PAIS (40 posições) quando o bem
      // é do Brasil: a linha real tem 567 caracteres, e não os 607 do layout.
      // Se um exercício futuro passar a gravar o campo em branco em vez de
      // omiti-lo, os valores dos 60 bens rurais deslocariam todos de uma vez,
      // em silêncio. O deslocamento agora é DERIVADO do comprimento da linha,
      // então os dois formatos são lidos certo.
      //
      // Layout oficial (LAYOUT-DBK-OFICIAL.md): CD_BEMAR 58, TX_BEM 60,
      // VR_BEM (atual) 572, VR_BEM_ANTERIOR 585, NR_CONTROLE 598, largura 607.
      const off = line.length >= 600 ? 0 : -40;
      const discriminacao = field(line, 60 + off, 512);
      // Ordem invertida (ver comentário acima): o primeiro valor é a ATUAL e o
      // segundo a ANTERIOR neste registro — trocado de propósito em relação
      // ao padrão do registro 27, e confirmado no layout oficial.
      const situacaoAtual = parseValorN13(field(line, 572 + off, 13));
      const situacaoAnterior = parseValorN13(field(line, 585 + off, 13));
      if (discriminacao) {
        bensRurais.push({
          id: bemRuralId++,
          codigo: field(line, 58 + off, 2),
          // Chave oficial do registro. Na variante compacta brasileira o
          // NM_PAIS de 40 posições é omitido, por isso usa o mesmo offset
          // calculado para os demais campos do registro 54.
          controle: field(line, 598 + off, 10),
          discriminacao: discriminacao.substring(0, 512), // ver registro 27
          situacao_anterior: situacaoAnterior,
          situacao_atual: situacaoAtual,
          movimentacoes: [],
        });
      }
      continue;
    }

    if (tipo === '55') {
      // TX_DIVIDA tem 512 posições no layout oficial, não 500: a leitura
      // anterior cortava os últimos 12 caracteres da discriminação de toda
      // dívida rural longa.
      const discriminacao = field(line, 15, 512);
      if (discriminacao) {
        dividasRurais.push({
          id: dividaRuralId++,
          controle: field(line, 566, 10),
          discriminacao: discriminacao.substring(0, 512),
          situacao_anterior: parseValorN13(field(line, 527, 13)),
          situacao_atual: parseValorN13(field(line, 540, 13)),
          valor_pago: parseValorN13(field(line, 553, 13)),
          movimentacoes: [],
        });
      }
      continue;
    }

    if (tipo === '51') {
      // NR_MES está na posição 15, com 2 dígitos. A leitura anterior,
      // field(14,3), incluía o IN_EXTERIOR e só dava certo porque ele é '0'
      // no Brasil ("0" + "01" = "001"); num registro do exterior produziria
      // "101", fora do intervalo, e o mês seria descartado em silêncio.
      const mes = parseInt(field(line, 15, 2), 10);
      if (mes >= 1 && mes <= 12) {
        receitasDespesasRuraisOficial.push({
          mes,
          // Campos TROCADOS em relação à ordem "óbvia" (receita antes de
          // despesa) — achado real: a soma dos 12 valores de field(17,13)
          // bate com despesaTotal do registro 52 (13.583.255,03), e a soma
          // de field(30,13) bate com receitaBrutaTotal (12.021.185,04);
          // confirmado também por posição x no PDF (a coluna DESPESAS DE
          // CUSTEIO/INVESTIMENTO fica à direita da página, onde o campo 17
          // efetivamente aponta). Não confundir com a ordem do registro 52
          // (receita antes de despesa lá, correta e não afetada por isso).
          despesaCusteioInvestimento: parseValorN13(field(line, 17, 13)),
          receitaBruta: parseValorN13(field(line, 30, 13)),
        });
      }
      continue;
    }

    if (tipo === '52') {
      // CORREÇÃO DE 23/08/2026, com evidência tripla. Três destes campos
      // estavam com o NOME errado, e um deles aparecia em destaque na tela
      // Atividade Rural mostrando um número que a declaração não tem.
      //
      // O layout foi decifrado em 20/08/2026 casando valores contra o PDF, mas
      // sem os RÓTULOS: os nomes foram deduzidos pela ordem esperada dos
      // campos. Quando o caminho PDF passou a ler esta mesma ficha, com os
      // rótulos impressos ao lado de cada valor, três deduções se mostraram
      // erradas:
      //
      //   field(54) = 3.099.318,03 -> impresso como "Saldo de prejuízo(s) a
      //     compensar de exercício(s) anterior(es)", e não como a COMPENSAÇÃO
      //     do ano (que na mesma declaração é 0,00).
      //   field(80) = 2.404.237,00 -> impresso como "Limite de 20% sobre a
      //     receita bruta total", e não como RESULTADO TRIBUTÁVEL (0,00).
      //     Confirmado pela aritmética: 20% de 12.021.185,04 = 2.404.237,01; e
      //     pela lógica, já que o resultado do ano foi negativo
      //     (-1.562.069,99), o que não pode produzir resultado tributável.
      //   field(106) = 4.661.388,02 -> impresso como "Saldo de prejuízo(s) a
      //     compensar" nas INFORMAÇÕES PARA O EXERCÍCIO SEGUINTE, e não como
      //     adiantamento de venda para entrega futura (que é 0,00).
      //
      // Os campos que continuam com nome deduzido, e não confirmado, são os
      // que estão ZERADOS neste único arquivo de referência: não há como
      // distinguir um zero de outro. Ficam marcados abaixo.
      apuracaoResultadoRuralOficial = {
        receitaBrutaTotal: parseValorN13(field(line, 15, 13)),
        despesaTotal: parseValorN13(field(line, 28, 13)),
        resultado: parseValorN13Signed(field(line, 41, 13)),
        saldoPrejuizoExercicioAnterior: parseValorN13(field(line, 54, 13)),
        // Não confirmado: zero neste arquivo. Pela ordem impressa na ficha,
        // deve ser a compensação de prejuízo do próprio ano.
        compensacaoPrejuizoAnterior: parseValorN13(field(line, 67, 13)),
        limite20PctReceitaBruta: parseValorN13(field(line, 80, 13)),
        // Não confirmado: zero neste arquivo.
        resultadoTributavel: parseValorN13(field(line, 93, 13)),
        saldoPrejuizoExercicioSeguinte: parseValorN13(field(line, 106, 13)),
        adiantamentoVendaFutura: parseValorN13(field(line, 119, 13)),
        // Posições confirmadas no layout oficial (LAYOUT-DBK-OFICIAL.md) em
        // 24/08/2026. Antes disso, `adiantamentoAnosAnteriores` era `null`
        // ("não consegui identificar a posição") e `resultadoNaoTributavel`
        // estava sendo lido de 132, que na verdade é o segundo adiantamento —
        // os dois campos ficavam errados numa declaração que os usasse. O
        // resultado não tributável é o VR_RESNAOTRIBAR, da posição 145.
        adiantamentoAnosAnteriores: parseValorN13(field(line, 132, 13)),
        // Com SINAL, igual ao Resultado I da posição 41: os dois são resultado
        // (receita menos despesa) e podem vir negativos pelo mesmo motivo.
        // Estão zerados no único arquivo de referência, então não há como
        // confirmar o formato do negativo — mas ler com sinal não muda nada
        // quando o valor é positivo, e evita exibir um prejuízo como lucro.
        // Achado 17 da auditoria de 24/08/2026.
        resultadoNaoTributavel: parseValorN13Signed(field(line, 145, 13)),
        // Campos que o layout oficial revelou e que ninguém lia. O primeiro é
        // a opção de apuração do resultado tributável, guardada CRUA: vem '2'
        // nesta declaração, cujo PDF imprime "Pelo resultado", mas o layout não
        // documenta a tabela de valores e deduzir o "de-para" de um caso só
        // seria chute (mesmo critério já usado no código de parentesco dos
        // dependentes). O segundo só tem valor com atividade rural no exterior.
        opcaoApuracaoResultadoTributavel: field(line, 171, 1),
        // Mesmo raciocínio do campo acima: VR_RES1DOLAR é o "Resultado I" da
        // apuração no exterior, e resultado pode ser negativo.
        resultadoExteriorDolar: parseValorN13Signed(field(line, 158, 13)),
        origem: 'dbk',
      };
      continue;
    }

    if (tipo === '53') {
      // CORREÇÃO DE 23/08/2026: as seis colunas estavam sendo lidas na ordem
      // INVERSA, trocando estoque inicial com final e aquisições com vendas.
      //
      // A prova é a equação de movimentação do rebanho, que é o que a ficha
      // existe para demonstrar:
      //
      //   estoque inicial + aquisições + nascimentos - consumo/perdas - vendas
      //     = estoque final
      //
      // Com a ordem impressa no PDF (29 + 123 + 0 - 0 - 27 = 125) a conta
      // fecha. Com os nomes que este parser dava (125 + 27 + 0 - 0 - 123 = 29)
      // ela produz o estoque INICIAL no lugar do final, ou seja, os dois
      // extremos estavam trocados. A ordem correta é a mesma do cabeçalho
      // impresso: ESTOQUE INICIAL, AQUISIÇÕES, NASCIMENTOS, CONSUMO E PERDAS,
      // VENDAS, ESTOQUE FINAL.
      //
      // `nascimentos` e `consumoPerdas` são os dois do meio e estão ZERADOS no
      // único arquivo de referência: a posição deles vem da ordem impressa na
      // ficha, não de um valor conferido.
      movimentacaoRebanhoOficial.push({
        // CD_ESPEC é UM dígito na posição 15 (layout oficial). A leitura
        // anterior, `field(14,2)`, pegava IN_EXTERIOR junto e só dava o
        // resultado certo por acaso, quando o imóvel era no Brasil ('0' + '1'
        // = "01"); no exterior teria produzido "11".
        especieCodigo: field(line, 15, 1).padStart(2, '0'),
        estoqueInicial: parseValorN13(field(line, 16, 10)),
        aquisicoes: parseValorN13(field(line, 26, 10)),
        nascimentos: parseValorN13(field(line, 36, 10)),
        consumoPerdas: parseValorN13(field(line, 46, 10)),
        vendas: parseValorN13(field(line, 56, 10)),
        estoqueFinal: parseValorN13(field(line, 66, 10)),
      });
      continue;
    }

    if (tipo === '57') {
      // NR_CPF_CNPJ_PROPRIETARIO tem 14 posições, não 11: o participante pode
      // ser pessoa JURÍDICA. A leitura anterior, field(14,11), truncava o CNPJ
      // nos 11 primeiros dígitos e só funcionava porque todos os 18
      // participantes desta declaração são pessoas físicas (o CPF vem
      // preenchido com 3 espaços à direita). O nome começa na 28, e era lido
      // da 25 — dava certo só porque o `.trim()` comia os 3 espaços.
      const cpfCnpj = field(line, 14, 14);
      const nome = field(line, 28, 60);
      if (nome) {
        participantesRuraisOficial.push({
          cpf: cpfCnpj,
          nome,
          // NR_CHAVE_AR liga o participante ao imóvel (registro 50, posição
          // 164). A ATUALIZAÇÃO 3 registrou que "não existe vínculo confiável
          // ao imóvel no .DBK" e a 45 repetiu isso — era falso, o campo sempre
          // esteve lá. Conferido contra o PDF da mesma declaração: as chaves
          // reproduzem exatamente o aninhamento que o PDF imprime, inclusive
          // os três participantes da mesma fazenda.
          chaveImovel: field(line, 89, 5),
        });
      }
      continue;
    }

    if (tipo === '37') {
      demonstrativoExteriorOficial.push({
        bem: parseInt(field(line, 14, 5), 10) || 0,
        ganhoPrejuizo: parseValorN13(field(line, 25, 13)),
        impostoDevido: parseValorN13(field(line, 38, 13)),
        impostoPagoBrasilExterior: parseValorN13(field(line, 51, 13)),
        baseCalculo: parseValorN13(field(line, 64, 13)),
        saldo: parseValorN13(field(line, 77, 13)),
      });
      continue;
    }

    // Registro 40: RENDA VARIÁVEL mensal, com as mesmas colunas que a ficha
    // "RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE" imprime no PDF.
    //
    // CORREÇÃO GRAVE DE 24/08/2026. Até aqui este parser lia o registro **76**
    // como se fosse a renda variável mensal, e a ATUALIZAÇÃO 5 registrou isso
    // como fato. O mapa oficial de registros, extraído do próprio programa da
    // Receita, mostra que 76 é `REG_GCME_PARCELA_ESPECIE` — Ganho de Capital em
    // Moeda Estrangeira, parcela em espécie — e que a renda variável é o 40
    // (`REG_RENDAVARRESUMOMENSAL`).
    //
    // O efeito era visível e enganoso: a declaração de referência tem 12
    // registros 76 (todos zerados, só com a alíquota de 15%) e NENHUM registro
    // 40, porque o contribuinte não tem renda variável nenhuma — e mesmo assim
    // o Dashboard anunciava "Renda Variável, ficha registrada em: o ano inteiro
    // de 2025". A ATUALIZAÇÃO 47 chegou a "explicar" o fenômeno dizendo que o
    // registro 76 seria estrutural; a explicação real é que ele é de outra
    // ficha.
    if (tipo === '40') {
      const mes = parseInt(field(line, 14, 2), 10);
      if (mes >= 1 && mes <= 12) {
        // Os 13 mercados vêm em blocos contíguos de 13 posições: as operações
        // comuns a partir da 16, as de day-trade a partir da 185, na MESMA
        // ordem em que o PDF as imprime.
        const coluna = (base, apuracao) => {
          const col = {};
          RV_MERCADOS.forEach(([, chave], k) => { col[chave] = parseValorN13(field(line, base + k * 13, 13)); });
          Object.assign(col, apuracao);
          return col;
        };
        const ehDependente = field(line, 620, 1).toUpperCase() === 'S';
        rendaVariavelMensalOficial.push({
          mes,
          titular: !ehDependente,
          cpfDependente: ehDependente ? field(line, 621, 11) : null,
          comuns: coluna(16, {
            resultadoLiquidoMes: parseValorN13(field(line, 432, 13)),
            resultadoNegativoMesAnterior: parseValorN13(field(line, 393, 13)),
            baseCalculoImposto: parseValorN13(field(line, 458, 13)),
            prejuizoCompensar: parseValorN13(field(line, 484, 13)),
            impostoDevido: parseValorN13(field(line, 516, 13)),
            aliquota: `${parseInt(field(line, 510, 3), 10) || 0}%`,
          }),
          daytrade: coluna(185, {
            resultadoLiquidoMes: parseValorN13(field(line, 445, 13)),
            resultadoNegativoMesAnterior: parseValorN13(field(line, 406, 13)),
            baseCalculoImposto: parseValorN13(field(line, 471, 13)),
            prejuizoCompensar: parseValorN13(field(line, 497, 13)),
            impostoDevido: parseValorN13(field(line, 529, 13)),
            aliquota: `${parseInt(field(line, 513, 3), 10) || 0}%`,
          }),
          consolidacao: {
            totalImpostoDevido: parseValorN13(field(line, 542, 13)),
            irFonteDayTradeMes: parseValorN13(field(line, 354, 13)),
            irFonteDayTradeMesesAnteriores: parseValorN13(field(line, 555, 13)),
            irFonteDayTradeCompensar: parseValorN13(field(line, 568, 13)),
            irFonteLei11033Mes: parseValorN13(field(line, 380, 13)),
            irFonteLei11033MesesAnteriores: parseValorN13(field(line, 594, 13)),
            irFonteLei11033Compensar: parseValorN13(field(line, 607, 13)),
            impostoPagar: parseValorN13(field(line, 581, 13)),
            impostoPago: parseValorN13(field(line, 367, 13)),
          },
          origem: 'dbk',
        });
      }
      continue;
    }

    // -----------------------------------------------------------------
    // GANHOS DE CAPITAL — registro-mãe de cada ficha.
    //
    // 61 = BENS IMÓVEIS, 62 = DIREITOS/BENS MÓVEIS, 63 = PARTICIPAÇÕES
    // SOCIETÁRIAS. Os três têm o mesmo miolo (natureza da operação, datas,
    // valor, corretagem, cálculo do imposto e consolidação do bem), com
    // posições diferentes, e cada um tem o que é seu: o imóvel traz endereço
    // e as perguntas de isenção; a participação traz CNPJ, município e a
    // apuração embutida no próprio registro.
    if (tipo === '61') {
      const op = gcOperacao('imovel', field(line, 33, 4));
      // IN_BRASIL_EXTERIOR: o layout oficial só diz "indicação de brasil
      // exterior", sem a tabela de valores. Nas três operações do arquivo de
      // referência, todas de bem no Brasil (veículos com placa brasileira), o
      // campo vem "1" — ou seja, 1 NÃO é exterior. Só "2" é tratado como
      // exterior aqui; qualquer outro conteúdo fica em "brasil", que é a
      // leitura que o dado real sustenta. Uma declaração com alienação no
      // exterior confirmaria (ou corrigiria) essa segunda metade.
      op.brasilExterior = field(line, 37, 1) === '2' ? 'exterior' : 'brasil';
      op.especificacao = field(line, 38, 152);
      op.endereco = {
        tipoLogradouro: field(line, 190, 15),
        logradouro: field(line, 205, 40),
        numero: field(line, 245, 6),
        complemento: field(line, 251, 21),
        bairro: field(line, 272, 20),
        cep: field(line, 292, 9),
        codigoMunicipio: field(line, 301, 4),
        municipio: field(line, 305, 40),
        uf: field(line, 345, 2),
        codigoPais: field(line, 347, 3),
        pais: field(line, 350, 60),
      };
      op.dataAquisicao = dataDDMMAAAAparaIso(field(line, 410, 8));
      op.custoAquisicao = parseValorN13(field(line, 418, 13));
      // As seis perguntas da ficha de imóvel, na ordem impressa. `pequenoValor`
      // é gravado invertido em relação ao texto da pergunta ("O valor do
      // conjunto ... é superior a R$ 35.000,00?" imprime Sim quando o campo é
      // "0"), exatamente como o relatório oficial faz — por isso a inversão
      // explícita aqui, e não um simNaoOuNulo direto.
      const superiorA35Mil = field(line, 432, 1);
      op.perguntas = {
        houveReformaOuAmpliacao: simNaoOuNulo(field(line, 431, 1)),
        conjuntoSuperiorA35Mil: superiorA35Mil === '0' ? true : (superiorA35Mil === '1' ? false : null),
        possuiOutroImovel: simNaoOuNulo(field(line, 433, 1)),
        outraAlienacaoUltimos5Anos: simNaoOuNulo(field(line, 434, 1)),
        imovelResidencial: simNaoOuNulo(field(line, 435, 1)),
        // 1 = adquiri / 2 = não adquiri / 3 = pretendia adquirir / 4 = não se
        // aplica. Guardado cru: a tela mostra a frase inteira que o formulário
        // imprime, e inventar rótulo para um código sem exemplo real seria
        // adivinhar.
        aplicacaoEmOutroImovel: field(line, 436, 1),
        valorAplicadoEmOutroImovel: parseValorN13(field(line, 437, 13)),
        isencaoUsadaEmMaisDeUmImovel: field(line, 894, 1),
        dataPrimeiraAlienacaoComIsencao: dataDDMMAAAAparaIso(field(line, 886, 8)),
      };
      op.natureza = gcNatureza(field(line, 450, 2), field(line, 452, 70));
      op.decisaoJudicial = simNaoOuNulo(field(line, 522, 1));
      op.dataAlienacao = dataDDMMAAAAparaIso(field(line, 523, 8));
      op.dataDecisaoJudicial = dataDDMMAAAAparaIso(field(line, 531, 8));
      op.dataLavratura = dataDDMMAAAAparaIso(field(line, 539, 8));
      op.dataTransitoJulgado = dataDDMMAAAAparaIso(field(line, 547, 8));
      op.alienacaoAPrazo = simNaoOuNulo(field(line, 555, 1));
      op.valorAlienacao = parseValorN13(field(line, 556, 13));
      op.custoCorretagem = parseValorN13(field(line, 569, 13));
      op.valorTorna = parseValorN13(field(line, 582, 13));
      op.houveAlienacaoParcialAnterior = simNaoOuNulo(field(line, 595, 1));
      op.ganhoAlienacoesAnteriores = parseValorN13(field(line, 596, 13));
      op.calculoImposto = {
        valorBrutoAnosAnteriores: parseValorN13(field(line, 609, 13)),
        corretagemAnosAnteriores: parseValorN13(field(line, 622, 13)),
        liquidoAnosAnteriores: parseValorN13(field(line, 635, 13)),
        ganhoCapitalTotal: parseValorN13(field(line, 648, 13)),
        aliquotaMedia: parseDecimais(field(line, 661, 9), 6),
        impostoDevido: parseValorN13(field(line, 670, 13)),
        impostoPago: parseValorN13(field(line, 683, 13)),
        totalRecebidoParcelas: parseValorN13(field(line, 696, 13)),
        totalCorretagemParcelas: parseValorN13(field(line, 709, 13)),
        totalLiquidoParcelas: parseValorN13(field(line, 722, 13)),
        totalAquisicaoParcelas: parseValorN13(field(line, 735, 13)),
      };
      op.consolidacaoBem = {
        impostoDiferidoAnosAnteriores: parseValorN13(field(line, 748, 13)),
        impostoDoExercicio: parseValorN13(field(line, 761, 13)),
        impostoTotal: parseValorN13(field(line, 774, 13)),
        irFonteLei11033: parseValorN13(field(line, 787, 13)),
        impostoDevidoNoExercicio: parseValorN13(field(line, 800, 13)),
        impostoDiferidoAnosPosteriores: parseValorN13(field(line, 813, 13)),
        impostoPago: parseValorN13(field(line, 826, 13)),
        rendimentoIsento: parseValorN13(field(line, 839, 13)),
        rendimentoExclusivo: parseValorN13(field(line, 852, 13)),
      };
      op.dataVencimentoDarf = dataDDMMAAAAparaIso(field(line, 865, 8));
      op.dataUltimaParcela = dataDDMMAAAAparaIso(field(line, 873, 8));
      op.paraisoFiscal = simNaoOuNulo(field(line, 881, 1));
      op.codigoPaisParaisoFiscal = field(line, 882, 3);
      // Lei 15.265/2025 (atualização do valor do bem). O layout ainda nomeia
      // os campos com a lei anterior, 14.973/2024; o programa da Receita já
      // imprime a pergunta com a lei nova e mantém a funcionalidade
      // DESLIGADA nesta versão 1.5 (`LEI_ATUALIZACAO_BEM_ATIVA = false`).
      // Lido assim mesmo: se a Receita ligar a opção numa versão seguinte, o
      // dado passa a chegar sem precisar mexer aqui.
      op.valorAtualizadoLei15265 = simNaoOuNulo(field(line, 895, 1));
      op.valorAcrescidoAtualizacao = parseValorN13(field(line, 896, 13));
      op.dataDarfAtualizacao = dataDDMMAAAAparaIso(field(line, 909, 8));
      continue;
    }

    if (tipo === '62') {
      const op = gcOperacao('movel', field(line, 33, 4));
      op.brasilExterior = field(line, 37, 1) === '2' ? 'exterior' : 'brasil';
      op.especificacao = field(line, 38, 152);
      op.sujeitoRegistroPublico = simNaoOuNulo(field(line, 190, 1));
      op.dataAquisicao = dataDDMMAAAAparaIso(field(line, 191, 8));
      op.custoAquisicao = parseValorN13(field(line, 199, 13));
      const superiorA35MilMovel = field(line, 212, 1);
      op.perguntas = {
        conjuntoSuperiorA35Mil: superiorA35MilMovel === '0' ? true : (superiorA35MilMovel === '1' ? false : null),
      };
      op.natureza = gcNatureza(field(line, 213, 2), field(line, 215, 70));
      op.decisaoJudicial = simNaoOuNulo(field(line, 285, 1));
      op.dataAlienacao = dataDDMMAAAAparaIso(field(line, 286, 8));
      op.dataDecisaoJudicial = dataDDMMAAAAparaIso(field(line, 294, 8));
      op.dataLavratura = dataDDMMAAAAparaIso(field(line, 302, 8));
      op.dataTransitoJulgado = dataDDMMAAAAparaIso(field(line, 310, 8));
      op.alienacaoAPrazo = simNaoOuNulo(field(line, 318, 1));
      op.valorAlienacao = parseValorN13(field(line, 319, 13));
      op.custoCorretagem = parseValorN13(field(line, 332, 13));
      op.houveAlienacaoParcialAnterior = simNaoOuNulo(field(line, 345, 1));
      op.ganhoAlienacoesAnteriores = parseValorN13(field(line, 346, 13));
      op.calculoImposto = {
        valorBrutoAnosAnteriores: parseValorN13(field(line, 359, 13)),
        corretagemAnosAnteriores: parseValorN13(field(line, 372, 13)),
        liquidoAnosAnteriores: parseValorN13(field(line, 385, 13)),
        ganhoCapitalTotal: parseValorN13(field(line, 398, 13)),
        aliquotaMedia: parseDecimais(field(line, 411, 9), 6),
        impostoDevido: parseValorN13(field(line, 420, 13)),
        impostoPago: parseValorN13(field(line, 433, 13)),
        totalRecebidoParcelas: parseValorN13(field(line, 446, 13)),
        totalCorretagemParcelas: parseValorN13(field(line, 459, 13)),
        totalLiquidoParcelas: parseValorN13(field(line, 472, 13)),
        totalAquisicaoParcelas: parseValorN13(field(line, 485, 13)),
      };
      op.consolidacaoBem = {
        impostoDiferidoAnosAnteriores: parseValorN13(field(line, 498, 13)),
        impostoDoExercicio: parseValorN13(field(line, 511, 13)),
        impostoTotal: parseValorN13(field(line, 524, 13)),
        irFonteLei11033: parseValorN13(field(line, 537, 13)),
        impostoDevidoNoExercicio: parseValorN13(field(line, 550, 13)),
        impostoDiferidoAnosPosteriores: parseValorN13(field(line, 563, 13)),
        impostoPago: parseValorN13(field(line, 576, 13)),
        rendimentoIsento: parseValorN13(field(line, 589, 13)),
        rendimentoExclusivo: parseValorN13(field(line, 602, 13)),
      };
      op.dataVencimentoDarf = dataDDMMAAAAparaIso(field(line, 615, 8));
      op.dataUltimaParcela = dataDDMMAAAAparaIso(field(line, 623, 8));
      op.paraisoFiscal = simNaoOuNulo(field(line, 631, 1));
      op.codigoPaisParaisoFiscal = field(line, 632, 3);
      continue;
    }

    if (tipo === '63') {
      const op = gcOperacao('participacao', field(line, 33, 4));
      op.especificacao = field(line, 37, 152);
      op.sociedade = {
        nome: field(line, 37, 152),
        cnpj: normalizarCpfCnpj(field(line, 189, 14)),
        codigoMunicipio: field(line, 203, 4),
        municipio: field(line, 207, 40),
        uf: field(line, 247, 2),
      };
      op.natureza = gcNatureza(field(line, 249, 2), field(line, 251, 70));
      op.especie = { codigo: field(line, 321, 1), descricao: field(line, 322, 90) };
      op.decisaoJudicial = simNaoOuNulo(field(line, 412, 1));
      op.dataAlienacao = dataDDMMAAAAparaIso(field(line, 413, 8));
      op.dataDecisaoJudicial = dataDDMMAAAAparaIso(field(line, 421, 8));
      op.dataLavratura = dataDDMMAAAAparaIso(field(line, 429, 8));
      op.dataTransitoJulgado = dataDDMMAAAAparaIso(field(line, 437, 8));
      op.alienacaoAPrazo = simNaoOuNulo(field(line, 445, 1));
      op.valorAlienacao = parseValorN13(field(line, 446, 13));
      op.custoCorretagem = parseValorN13(field(line, 459, 13));
      // Aqui o limite da pergunta é R$ 20.000,00 (ações no mercado de balcão),
      // não os R$ 35.000,00 das outras fichas — Lei 9.250/1995, art. 22, I.
      const superiorA20Mil = field(line, 472, 1);
      op.perguntas = {
        conjuntoSuperiorA20Mil: superiorA20Mil === '0' ? true : (superiorA20Mil === '1' ? false : null),
      };
      op.houveAlienacaoParcialAnterior = simNaoOuNulo(field(line, 473, 1));
      op.ganhoAlienacoesAnteriores = parseValorN13(field(line, 474, 13));
      // Diferente de imóvel e móvel, a participação societária traz a APURAÇÃO
      // dentro do próprio registro (não há um 68/69 para ela).
      op.apuracao = {
        valorAlienacao: parseValorN13(field(line, 487, 13)),
        custoCorretagem: parseValorN13(field(line, 500, 13)),
        valorLiquido: parseValorN13(field(line, 513, 13)),
        custoAquisicao: parseValorN13(field(line, 526, 13)),
        ganhoCapital: parseValorN13(field(line, 539, 13)),
      };
      op.custoAquisicao = op.apuracao.custoAquisicao;
      op.calculoImposto = {
        valorBrutoAnosAnteriores: parseValorN13(field(line, 552, 13)),
        corretagemAnosAnteriores: parseValorN13(field(line, 565, 13)),
        liquidoAnosAnteriores: parseValorN13(field(line, 578, 13)),
        ganhoCapitalTotal: parseValorN13(field(line, 591, 13)),
        aliquotaMedia: parseDecimais(field(line, 604, 9), 6),
        impostoDevido: parseValorN13(field(line, 613, 13)),
        irrf: parseValorN13(field(line, 626, 13)),
        impostoDevidoAposCompensacao: parseValorN13(field(line, 639, 13)),
        impostoPago: parseValorN13(field(line, 652, 13)),
        totalRecebidoParcelas: parseValorN13(field(line, 665, 13)),
        totalCorretagemParcelas: parseValorN13(field(line, 678, 13)),
        totalLiquidoParcelas: parseValorN13(field(line, 691, 13)),
        totalAquisicaoParcelas: parseValorN13(field(line, 704, 13)),
      };
      op.consolidacaoBem = {
        impostoDiferidoAnosAnteriores: parseValorN13(field(line, 717, 13)),
        impostoDoExercicio: parseValorN13(field(line, 730, 13)),
        impostoTotal: parseValorN13(field(line, 743, 13)),
        irFonteLei11033: parseValorN13(field(line, 756, 13)),
        impostoDevidoNoExercicio: parseValorN13(field(line, 769, 13)),
        impostoDiferidoAnosPosteriores: parseValorN13(field(line, 782, 13)),
        impostoPago: parseValorN13(field(line, 795, 13)),
        rendimentoIsento: parseValorN13(field(line, 808, 13)),
        rendimentoExclusivo: parseValorN13(field(line, 821, 13)),
      };
      op.custoTotalAquisicaoConsolidado = parseValorN13(field(line, 834, 13));
      op.dataVencimentoDarf = dataDDMMAAAAparaIso(field(line, 847, 8));
      op.dataUltimaParcela = dataDDMMAAAAparaIso(field(line, 855, 8));
      op.paraisoFiscal = simNaoOuNulo(field(line, 863, 1));
      op.codigoPaisParaisoFiscal = field(line, 864, 3);
      continue;
    }

    // Adquirente da operação (65). Uma operação pode ter mais de um: a ficha
    // impressa lista todos no bloco "ADQUIRENTE".
    if (tipo === '65') {
      const tipoBem = GC_TIPO_POR_INDICADOR[field(line, 37, 1)] || 'movel';
      gcOperacao(tipoBem, field(line, 33, 4)).adquirentes.push({
        cpfCnpj: normalizarCpfCnpj(field(line, 38, 14)),
        nome: field(line, 52, 60),
      });
      continue;
    }

    // Edificação, ampliação ou reforma do imóvel alienado (66 no Brasil, 67 no
    // exterior). Entram como parcelas do custo, cada uma com a data e o
    // percentual de redução que lhe cabe.
    if (tipo === '66' || tipo === '67') {
      gcOperacao('imovel', field(line, 33, 4)).ampliacoesReformas.push({
        exterior: tipo === '67',
        data: dataDDMMAAAAparaIso(field(line, 37, 8)),
        valor: parseValorN13(field(line, 45, 13)),
        percentualDoCusto: parseDecimais(field(line, 58, 9), 6),
        valorPassivelReducao: parseValorN13(field(line, 67, 13)),
        percentualReducaoLei7713: parseDecimais(field(line, 80, 9), 6),
        percentualReducaoFR1: parseDecimais(field(line, 89, 9), 6),
        percentualReducaoFR2: parseDecimais(field(line, 98, 9), 6),
      });
      continue;
    }

    // Apuração do ganho: 68 para imóvel (com as reduções da Lei 7.713/1988 e
    // da Lei 11.196/2005) e 69 para móvel (sem reduções). O bloco "APURAÇÃO DO
    // GANHO DE CAPITAL" da ficha impressa é exatamente isto.
    if (tipo === '68' || tipo === '69') {
      const op = gcOperacao(tipo === '68' ? 'imovel' : 'movel', field(line, 33, 4));
      const base = {
        tipoApuracao: field(line, 37, 1),
        valorAlienacao: parseValorN13(field(line, 38, 13)),
        custoCorretagem: parseValorN13(field(line, 51, 13)),
        valorLiquido: parseValorN13(field(line, 64, 13)),
        valorLiquidoDolar: parseValorN13(field(line, 77, 13)),
        custoAquisicao: parseValorN13(field(line, 90, 13)),
        ganhoCapital: parseValorN13(field(line, 103, 13)),
        ganhoCapitalDolar: parseValorN13(field(line, 116, 13)),
      };
      if (tipo === '68') {
        Object.assign(base, {
          cotacaoDolar: parseDecimais(field(line, 313, 13), 4),
          reducoes: {
            percentualLei7713: parseDecimais(field(line, 129, 9), 6),
            valorLei7713: parseValorN13(field(line, 138, 13)),
            ganhoApos7713: parseValorN13(field(line, 151, 13)),
            percentualFR1: parseDecimais(field(line, 164, 9), 6),
            valorFR1: parseValorN13(field(line, 173, 13)),
            ganhoAposFR1: parseValorN13(field(line, 186, 13)),
            percentualFR2: parseDecimais(field(line, 199, 9), 6),
            valorFR2: parseValorN13(field(line, 208, 13)),
            ganhoAposFR2: parseValorN13(field(line, 221, 13)),
            percentualAplicacaoOutroImovel: parseDecimais(field(line, 234, 9), 6),
            valorAplicacaoOutroImovel: parseValorN13(field(line, 243, 13)),
            percentualPequenoValor: parseDecimais(field(line, 256, 9), 6),
            valorPequenoValor: parseValorN13(field(line, 265, 13)),
            percentualUnicoImovel: parseDecimais(field(line, 278, 9), 6),
            valorUnicoImovel: parseValorN13(field(line, 287, 13)),
            ganhoTributavel: parseValorN13(field(line, 300, 13)),
          },
        });
      } else {
        base.cotacaoDolar = parseDecimais(field(line, 129, 13), 4);
      }
      // Uma operação pode ter apuração "normal" e "final" (tipos diferentes no
      // campo 37). A primeira vira `apuracao`; as demais ficam na lista, sem
      // sobrescrever a que já estava.
      if (!op.apuracao) op.apuracao = base;
      else (op.apuracoesAdicionais = op.apuracoesAdicionais || []).push(base);
      continue;
    }

    // Apuração da parcela quando a alienação foi a prazo (70 = comum às duas
    // moedas, 71 = imóvel, 72 = móvel ou participação societária).
    if (tipo === '70' || tipo === '71' || tipo === '72') {
      let tipoBem = 'imovel';
      if (tipo === '72') tipoBem = field(line, 37, 1) === '3' ? 'participacao' : 'movel';
      else if (tipo === '70') tipoBem = field(line, 37, 1) === '2' ? 'movel' : 'imovel';
      const op = gcOperacao(tipoBem, field(line, 33, 4));
      if (tipo === '70') {
        op.parcelas.push({
          origem: 'ambas_moedas',
          data: dataDDMMAAAAparaIso(field(line, 38, 8)),
          valorAlienacao: parseValorN13(field(line, 46, 13)),
          custoCorretagem: parseValorN13(field(line, 59, 13)),
          valorLiquido: parseValorN13(field(line, 72, 13)),
          valorReaplicadoOutroImovel: parseValorN13(field(line, 85, 13)),
          ganhoCapitalTotal: parseValorN13(field(line, 98, 13)),
          impostoDevido: parseValorN13(field(line, 111, 13)),
          impostoPagoExterior: parseValorN13(field(line, 124, 13)),
          impostoDevidoBrasil: parseValorN13(field(line, 137, 13)),
          impostoPagoBrasil: parseValorN13(field(line, 150, 13)),
          totalReducoes: parseValorN13(field(line, 163, 13)),
        });
      } else if (tipo === '71') {
        op.parcelas.push({
          origem: 'imovel',
          tipoParcela: field(line, 37, 1),
          ultimaParcela: simNaoOuNulo(field(line, 38, 1)),
          data: dataDDMMAAAAparaIso(field(line, 39, 8)),
          valorLiquidoAmbasMoedas: parseValorN13(field(line, 47, 13)),
          valorAlienacao: parseValorN13(field(line, 60, 13)),
          custoCorretagem: parseValorN13(field(line, 73, 13)),
          valorLiquido: parseValorN13(field(line, 86, 13)),
          custoAquisicao: parseValorN13(field(line, 112, 13)),
          ganhoCapital: parseValorN13(field(line, 125, 13)),
          totalReducoes: parseValorN13(field(line, 348, 13)),
          ganhoTributavel: parseValorN13(field(line, 335, 13)),
          aliquota: parseDecimais(field(line, 361, 9), 6),
          impostoDevido: parseValorN13(field(line, 370, 13)),
          impostoPagoExterior: parseValorN13(field(line, 383, 13)),
          impostoDevidoBrasil: parseValorN13(field(line, 396, 13)),
          impostoPagoBrasil: parseValorN13(field(line, 409, 13)),
          cotacaoDolar: parseDecimais(field(line, 422, 13), 4),
        });
      } else {
        op.parcelas.push({
          origem: tipoBem,
          tipoParcela: field(line, 38, 1),
          ultimaParcela: simNaoOuNulo(field(line, 39, 1)),
          data: dataDDMMAAAAparaIso(field(line, 40, 8)),
          valorLiquidoAmbasMoedas: parseValorN13(field(line, 48, 13)),
          valorAlienacao: parseValorN13(field(line, 61, 13)),
          custoCorretagem: parseValorN13(field(line, 74, 13)),
          valorLiquido: parseValorN13(field(line, 87, 13)),
          custoAquisicao: parseValorN13(field(line, 113, 13)),
          ganhoCapital: parseValorN13(field(line, 126, 13)),
          aliquota: parseDecimais(field(line, 152, 9), 6),
          impostoDevido: parseValorN13(field(line, 161, 13)),
          impostoPagoExterior: parseValorN13(field(line, 174, 13)),
          impostoDevidoBrasil: parseValorN13(field(line, 187, 13)),
          impostoPagoBrasil: parseValorN13(field(line, 200, 13)),
          cotacaoDolar: parseDecimais(field(line, 213, 13), 4),
        });
      }
      continue;
    }

    // Apuração do custo de aquisição da participação societária (73): uma
    // linha por espécie de participação alienada.
    if (tipo === '73') {
      gcOperacao('participacao', field(line, 33, 4)).custosAquisicao.push({
        item: field(line, 37, 4),
        codigoEspecie: field(line, 41, 1),
        especie: field(line, 42, 60),
        quantidadeAlienada: parseInteiro(field(line, 102, 11)),
        custoMedioPonderado: parseDecimais(field(line, 113, 17), 6),
        custoTotal: parseValorN13(field(line, 130, 13)),
      });
      continue;
    }

    // MOEDAS EM ESPÉCIE (74): uma linha por movimento de moeda estrangeira
    // mantida em espécie — saldo inicial, compra ou venda.
    if (tipo === '74') {
      gcMoedaOperacoes.push({
        item: field(line, 33, 4),
        codigoMoeda: field(line, 37, 7),
        moeda: field(line, 44, 40),
        tipoOperacao: field(line, 84, 1),
        tipoOperacaoDescricao: field(line, 85, 15),
        adquirenteNome: field(line, 100, 60),
        adquirenteCpfCnpj: normalizarCpfCnpj(field(line, 160, 14)),
        data: dataDDMMAAAAparaIso(field(line, 174, 8)),
        valor: parseValorN13(field(line, 182, 13)),
        quantidade: parseValorN13(field(line, 195, 13)),
        custoMedio: parseDecimais(field(line, 208, 17), 6),
        custoTotal: parseValorN13(field(line, 225, 13)),
        ganhoCapital: parseValorN13(field(line, 238, 13)),
        saldoEmReais: parseValorN13(field(line, 251, 13)),
        saldoEmMoeda: parseValorN13(field(line, 264, 13)),
        cotacaoMoedaDolar: parseDecimais(field(line, 277, 13), 4),
      });
      continue;
    }

    // Faixas de tributação do ganho (75). É o quadro "Faixa de Ganho de
    // Capital / Ganho de Capital Distribuído / Alíquota" da ficha impressa,
    // com as quatro faixas da Lei 13.259/2016 (15%, 17,5%, 20% e 22,5%).
    if (tipo === '75') {
      const tipoBem = GC_TIPO_POR_INDICADOR[field(line, 37, 1)] || 'movel';
      const faixa = (total, anterior, atual) => ({
        total: parseValorN13(field(line, total, 13)),
        anterior: parseValorN13(field(line, anterior, 13)),
        atual: parseValorN13(field(line, atual, 13)),
      });
      gcOperacao(tipoBem, field(line, 33, 4)).faixasTributacao.push({
        baseApuracao: field(line, 38, 1),
        faixa1: faixa(39, 52, 65),
        faixa2: faixa(78, 91, 104),
        faixa3: faixa(117, 130, 143),
        faixa4: faixa(156, 169, 182),
        total: faixa(195, 208, 221),
      });
      continue;
    }

    // Totalização mensal das moedas alienadas (76). Uma linha por mês, com a
    // isenção dos US$ 5.000 controlada pela coluna consolidada.
    if (tipo === '76') {
      const mes = parseInt(field(line, 33, 2), 10);
      if (mes >= 1 && mes <= 12) {
        gcMoedaMensal.push({
          mes,
          alienacaoDolar: parseValorN13(field(line, 35, 13)),
          alienacaoConsolidadaDolar: parseValorN13(field(line, 48, 13)),
          ganhoCapital: parseValorN13(field(line, 61, 13)),
          ganhoCapitalTributavel: parseValorN13(field(line, 74, 13)),
          aliquota: parseValorN13(field(line, 87, 13)),
          impostoDevido: parseValorN13(field(line, 100, 13)),
          impostoPago: parseValorN13(field(line, 113, 13)),
        });
      }
      continue;
    }

    // Cabeçalho do demonstrativo de Ganhos de Capital (60): o período, o país
    // de residência e os TRANSPORTES — os valores que a declaração leva
    // automaticamente para as fichas de rendimentos (isento de pequeno valor,
    // de único imóvel, da redução, e o rendimento de tributação exclusiva).
    if (tipo === '60') {
      gcConsolidacao = {
        periodoInicio: dataDDMMAAAAparaIso(field(line, 33, 8)),
        periodoFim: dataDDMMAAAAparaIso(field(line, 41, 8)),
        codigoPais: field(line, 49, 3),
        pais: field(line, 52, 60),
        rendimentoExclusivo: parseValorN13(field(line, 112, 13)),
        isentoPequenoValor: parseValorN13(field(line, 125, 13)),
        isentoUnicoImovel: parseValorN13(field(line, 138, 13)),
        isentoReducao: parseValorN13(field(line, 151, 13)),
        impostoPago: parseValorN13(field(line, 164, 13)),
        impostoDevido: parseValorN13(field(line, 177, 13)),
        isentoTotal: parseValorN13(field(line, 190, 13)),
        impostoDiferidoAnosPosteriores: parseValorN13(field(line, 203, 13)),
        moedaEspecieGanho: parseValorN13(field(line, 216, 13)),
        moedaEspecieImpostoDevido: parseValorN13(field(line, 229, 13)),
        moedaEspecieAliquotaMedia: parseDecimais(field(line, 242, 9), 6),
        exteriorRendimentoExclusivo: parseValorN13(field(line, 251, 13)),
        exteriorImpostoPago: parseValorN13(field(line, 264, 13)),
        exteriorRendimentoIsento: parseValorN13(field(line, 277, 13)),
      };
      continue;
    }

    // RENDA VARIÁVEL — consolidação anual das operações comuns/day-trade (41).
    if (tipo === '41') {
      rendaVariavelAnualOficial = {
        resultadoLiquido: parseValorN13(field(line, 14, 13)),
        resultadoNegativoMesesAnteriores: parseValorN13(field(line, 27, 13)),
        baseCalculo: parseValorN13(field(line, 40, 13)),
        prejuizoACompensar: parseValorN13(field(line, 53, 13)),
        impostoDevido: parseValorN13(field(line, 66, 13)),
        consolidacaoImpostoDevido: parseValorN13(field(line, 79, 13)),
        consolidacaoIrFonteDayTradeMesesAnteriores: parseValorN13(field(line, 92, 13)),
        consolidacaoIrFonteDayTradeACompensar: parseValorN13(field(line, 105, 13)),
        irFonteLei11033Ano: parseValorN13(field(line, 118, 13)),
        consolidacaoImpostoAPagar: parseValorN13(field(line, 131, 13)),
        origem: 'dbk',
      };
      continue;
    }

    // RENDA VARIÁVEL — Operações em FII ou Fiagro, mês a mês (42). Mesma ficha
    // que o menu do programa chama de "Operações em FII ou Fiagro"; a alíquota
    // vem como inteiro de 3 dígitos (20 = 20%), não como valor monetário.
    if (tipo === '42') {
      const mes = parseInt(field(line, 14, 2), 10);
      if (mes >= 1 && mes <= 12) {
        const ehDependente = field(line, 149, 1).toUpperCase() === 'S';
        fiiFiagroMensalOficial.push({
          mes,
          titular: !ehDependente,
          cpfDependente: ehDependente ? field(line, 150, 11) : null,
          resultadoLiquidoMes: parseValorN13(field(line, 16, 13)),
          resultadoNegativoMesAnterior: parseValorN13(field(line, 29, 13)),
          baseCalculoImposto: parseValorN13(field(line, 42, 13)),
          prejuizoCompensar: parseValorN13(field(line, 55, 13)),
          aliquota: `${parseInt(field(line, 68, 3), 10) || 0}%`,
          impostoDevido: parseValorN13(field(line, 71, 13)),
          impostoRetidoMesesAnteriores: parseValorN13(field(line, 84, 13)),
          impostoRetidoNoMes: parseValorN13(field(line, 97, 13)),
          impostoACompensar: parseValorN13(field(line, 110, 13)),
          impostoAPagar: parseValorN13(field(line, 123, 13)),
          impostoPago: parseValorN13(field(line, 136, 13)),
          origem: 'dbk',
        });
      }
      continue;
    }

    // RENDA VARIÁVEL — totais anuais de FII/Fiagro (43).
    if (tipo === '43') {
      fiiFiagroAnualOficial = {
        resultadoLiquido: parseValorN13(field(line, 14, 13)),
        resultadoNegativoMesAnterior: parseValorN13(field(line, 27, 13)),
        baseCalculoImposto: parseValorN13(field(line, 40, 13)),
        prejuizoCompensar: parseValorN13(field(line, 53, 13)),
        impostoDevido: parseValorN13(field(line, 66, 13)),
        impostoAPagar: parseValorN13(field(line, 79, 13)),
        impostoRetidoLei11033: parseValorN13(field(line, 92, 13)),
        origem: 'dbk',
      };
      continue;
    }

    // Registro 18: o RESUMO da declaração feita pelo DESCONTO SIMPLIFICADO
    // (`REG_RESUMOSIMPLES`). O registro 20, logo abaixo, é o resumo da
    // declaração COMPLETA (`REG_RESUMOCOMPLETA`), e era o único que este parser
    // lia — numa declaração simplificada o arquivo traz 17/18 no lugar de
    // 19/20, e o app ficava SEM o Resumo e SEM o Imposto Devido: a tela
    // Relatório IRPF vinha vazia e o Dashboard sem os totais oficiais.
    //
    // Nenhuma das duas declarações de referência é simplificada, então o gap
    // era invisível aqui. Achado ao ler o mapa oficial de registros, em
    // 24/08/2026, e implementado a partir das posições oficiais.
    //
    // Os dois resumos alimentam o MESMO objeto `impostoDevido`, para que o
    // resto do app não precise saber qual modelo a pessoa usou.
    if (tipo === '18') {
      impostoDevido = {
        rendimentosTributaveisTotal: parseValorN13(field(line, 14, 13)),
        // Na simplificada não há dedução por dependente nem despesa médica: o
        // desconto simplificado SUBSTITUI todas as deduções legais, e é ele que
        // ocupa o lugar de "total de deduções".
        dependentes: 0,
        despesasMedicas: 0,
        totalDeducoes: parseValorN13(field(line, 27, 13)),
        descontoSimplificado: parseValorN13(field(line, 27, 13)),
        baseCalculo: parseValorN13(field(line, 40, 13)),
        impostoDevidoTotal: parseValorN13(field(line, 53, 13)),
        // O registro 18 não tem um campo único de "total do imposto pago" como
        // o 20: traz os componentes separados. A soma dos quatro é a definição
        // de imposto pago que a ficha usa — retido na fonte, complementar e
        // pago no exterior, carnê-leão, e o retido da Lei 11.033/2004.
        impostoPagoTotal: parseValorN13(field(line, 66, 13))
          + parseValorN13(field(line, 79, 13))
          + parseValorN13(field(line, 92, 13))
          + parseValorN13(field(line, 105, 13)),
        saldoPagar: parseValorN13(field(line, 131, 13)),
        bensAnteriorOficial: parseValorN13(field(line, 275, 13)),
        bensAtualOficial: parseValorN13(field(line, 288, 13)),
        dividasAnteriorOficial: parseValorN13(field(line, 366, 13)),
        dividasAtualOficial: parseValorN13(field(line, 379, 13)),
        rendimentosIsentosOficial: parseValorN13(field(line, 158, 13)),
        rendimentosExclusivoOficial: parseValorN13(field(line, 171, 13)),
        rendimentosPfExteriorTitular: parseValorN13(field(line, 457, 13)),
        rendimentosPfExteriorDependentes: parseValorN13(field(line, 470, 13)),
        // O registro 18 não traz os campos da Lei 14.754/2023 que o 20 tem.
        // Ficam null, e não 0, para não afirmar "não houve" onde o certo é
        // "este modelo de declaração não informa".
        lei14754Ganho: null,
        lei14754Imposto: null,
        modeloDeclaracao: 'simplificada',
        origem: 'dbk',
      };
      continue;
    }

    if (tipo === '20') {
      impostoDevido = {
        rendimentosTributaveisTotal: parseValorN13(field(line, 14, 13)),
        dependentes: parseValorN13(field(line, 105, 13)),
        despesasMedicas: parseValorN13(field(line, 131, 13)),
        totalDeducoes: parseValorN13(field(line, 183, 13)),
        baseCalculo: parseValorN13(field(line, 196, 13)),
        impostoDevidoTotal: parseValorN13(field(line, 274, 13)),
        impostoPagoTotal: parseValorN13(field(line, 352, 13)),
        saldoPagar: parseValorN13(field(line, 378, 13)),
        bensAnteriorOficial: parseValorN13(field(line, 405, 13)),
        bensAtualOficial: parseValorN13(field(line, 418, 13)),
        dividasAnteriorOficial: parseValorN13(field(line, 431, 13)),
        dividasAtualOficial: parseValorN13(field(line, 444, 13)),
        rendimentosIsentosOficial: parseValorN13(field(line, 470, 13)),
        // VR_RENDPFEXT / VR_RENDPFEXTDEPEN no layout oficial: os totais de
        // rendimentos recebidos de pessoa física, aluguéis, outros e exterior.
        // São o gabarito para conferir o que o registro 22 traz mês a mês.
        rendimentosPfExteriorTitular: parseValorN13(field(line, 27, 13)),
        rendimentosPfExteriorDependentes: parseValorN13(field(line, 40, 13)),
        rendimentosExclusivoOficial: parseValorN13(field(line, 483, 13)),
        lei14754Ganho: parseValorN13(field(line, 891, 13)),
        lei14754Imposto: parseValorN13(field(line, 904, 13)),
        modeloDeclaracao: 'completa',
        origem: 'dbk',
      };
      continue;
    }
  }

  // Resolve o vínculo participante -> imóvel pela NR_CHAVE_AR, deixando o
  // resultado no MESMO formato que o caminho PDF produz (`imovelId`,
  // `imovelCib`, `imovelNome`), para que a tela não precise saber de qual
  // arquivo veio. Ver o comentário do registro 57.
  {
    const porChave = new Map();
    for (const im of imoveisRurais) {
      if (im.chaveAssociacao) porChave.set(im.chaveAssociacao, im);
    }
    for (const p2 of participantesRuraisOficial) {
      const im = porChave.get(p2.chaveImovel);
      p2.imovelId = im ? im.id : null;
      p2.imovelCib = im ? im.cib : '';
      p2.imovelNome = im ? im.nomeLocalizacao : '';
    }
  }

  if (rurodoExterior.size > 0) {
    log('Esta declaração tem Atividade Rural no EXTERIOR, que o app não modela: imóveis, bens, dívidas, receitas e rebanho de fora do Brasil não foram importados. Confira esses valores na declaração original.', 'warning');
  }
  const rra = rendimentos.filter(r => r.tipo === 'tributavel_rra');
  if (rra.length > 0) {
    log(`Identificados ${rra.length} rendimento(s) recebido(s) acumuladamente (RRA)`, 'success');
    log('O RRA tem regra própria de tributação, e o contribuinte escolhe entre tributar na fonte ou no ajuste anual. O app importa o valor tributável informado na ficha; confira a opção escolhida na declaração original.', 'warning');
  }
  if (exigibilidadeSuspensa.length > 0) {
    const total = exigibilidadeSuspensa.reduce((a, b) => a + b, 0)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    log(`Esta declaração tem ${exigibilidadeSuspensa.length} rendimento(s) com IMPOSTO EM EXIGIBILIDADE SUSPENSA, somando R$ ${total}, que NÃO foram importados: estão em discussão judicial e não são renda recebida em definitivo. Confira na declaração original.`, 'warning');
  }

  if (tiposDesconhecidos.size > 0) {
    // Separa o que já se sabe o que é do que é realmente novo: a primeira lista
    // diz à pessoa QUAL ficha ficou de fora; a segunda avisa que o arquivo tem
    // algo que este parser nunca viu.
    const conhecidas = [...tiposDesconhecidos].filter(t => FICHAS_NAO_MODELADAS[t]).sort();
    const novas = [...tiposDesconhecidos].filter(t => !FICHAS_NAO_MODELADAS[t]).sort();
    for (const t of conhecidas) {
      const ficha = FICHAS_NAO_MODELADAS[t];
      const mensagem = `Esta declaração tem a ficha "${ficha}", que o app não importa. Confira esses dados na declaração original.`;
      fichasNaoLidasComConteudo.push(ficha);
      avisosImportacao.push({ codigo: 'DBK_FICHA_NAO_SUPORTADA', tipoRegistro: t, ficha, mensagem });
      log(mensagem, 'warning');
    }
    if (novas.length > 0) {
      const mensagem = `Este arquivo tem registro(s) de tipo ${novas.join(', ')}, que o app não conhece. Alguma informação da declaração pode não ter sido importada; confira na declaração original.`;
      for (const t of novas) {
        const ficha = `Registro DBK tipo ${t}`;
        fichasNaoLidasComConteudo.push(ficha);
        avisosImportacao.push({ codigo: 'DBK_TIPO_DESCONHECIDO', tipoRegistro: t, ficha, mensagem });
      }
      log(mensagem, 'warning');
    }
  }

  for (const [tipo, ocorrencias] of [...contagemTipos.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (TIPOS_TRATADOS.has(tipo) || tipo === 'T9') continue;
    registrosDbkNaoModelados.push({
      tipoRegistro: tipo,
      ficha: FICHAS_NAO_MODELADAS[tipo] || null,
      ocorrencias,
      classificacao: tiposDesconhecidos.has(tipo) ? 'nao_modelado' : 'preservado_sem_modelagem',
    });
  }

  const estadoFichas = {};
  const tiposCatalogadosNesteParser = new Set([
    ...TIPOS_TRATADOS,
    ...TIPOS_CONHECIDOS_NAO_LIDOS,
    ...Object.keys(FICHAS_NAO_MODELADAS),
    ...contagemTipos.keys(),
  ]);
  for (const tipo of [...tiposCatalogadosNesteParser].sort()) {
    const presente = (contagemTipos.get(tipo) || 0) > 0;
    if (!presente) {
      estadoFichas[idFichaDbk(tipo)] = entradaEstadoFicha('vazia', 'dbk');
    } else if (TIPOS_TRATADOS.has(tipo) || tipo === 'T9') {
      estadoFichas[idFichaDbk(tipo)] = entradaEstadoFicha(
        'parcial',
        'dbk',
        'Registro estruturado, mas a ficha ainda não concluiu o gate de auditoria independente',
      );
    } else if (tiposDesconhecidos.has(tipo) && !FICHAS_NAO_MODELADAS[tipo]) {
      estadoFichas[idFichaDbk(tipo)] = entradaEstadoFicha('erro', 'dbk', 'Tipo de registro desconhecido');
    } else {
      estadoFichas[idFichaDbk(tipo)] = entradaEstadoFicha('nao_suportada', 'dbk', FICHAS_NAO_MODELADAS[tipo] || 'Registro preservado sem modelagem estruturada');
    }
  }
  estadoFichas['dbk:atividade-rural-exterior'] = entradaEstadoFicha(
    rurodoExterior.size > 0 ? 'nao_suportada' : 'vazia',
    'dbk',
    rurodoExterior.size > 0 ? 'Registros rurais com indicador de exterior foram preservados, mas não modelados' : undefined,
  );

  // Concilia agregado (23/24) e detalhe (84/88) dos rendimentos isentos e de
  // tributação exclusiva. Mesma regra do caminho PDF, pelo mesmo motivo: os
  // dois existem no arquivo e somar os dois duplicaria o rendimento inteiro.
  //
  // Vale o DETALHE quando ele existe, porque traz beneficiário, CPF, CNPJ e
  // nome da fonte. O agregado entra só para os códigos sem detalhe — é o caso
  // do 13º salário e do rendimento da Lei 14.754/2023, que não têm fonte
  // pagadora listada — e serve de conferência para os demais.
  const divergenciasRendimento = [];
  {
    const porCodigo = new Map();
    for (const d of detalhesRendimento) {
      const chave = `${d.categoria}_${d.codigo}`;
      if (!porCodigo.has(chave)) porCodigo.set(chave, []);
      porCodigo.get(chave).push(d);
    }
    const emitir = (tipoRend, base) => {
      rendimentos.push({
        id: rendId++,
        tipo: tipoRend,
        codigo_rendimento: base.codigo,
        cnpj_fonte: base.cnpj_fonte || '',
        nome_fonte: base.nome_fonte || '',
        beneficiario: base.beneficiario || 'Titular',
        cpf_dependente: base.beneficiario === 'Dependente' ? (base.cpf || '') : null,
        valor: base.valor,
        // O IRRF só existe na variante 85 do detalhe; nas demais é zero. O do
        // 13º salário é preenchido depois, por `aplicarIrrfDecimoTerceiro`,
        // quando toda a lista de rendimentos já existe.
        irrf: base.irrfDetalhe || 0,
        ...(base.decimoTerceiro ? { decimoTerceiro: base.decimoTerceiro } : {}),
        // Campos que só ALGUMAS variantes de detalhe trazem. Sem repassá-los
        // aqui, eles eram lidos do arquivo e descartados na conciliação — foi o
        // que o teste da variante 86 flagrou.
        ...(base.descricao ? { descricao: base.descricao } : {}),
        ...(base.valorGanhoCapital ? { valorGanhoCapital: base.valorGanhoCapital } : {}),
        data: anoCalendario ? `${anoCalendario}-12-31` : '',
      });
    };
    for (const ag of agregadosRendimento) {
      const chave = `${ag.categoria}_${ag.codigo}`;
      const detalhe = porCodigo.get(chave);
      if (detalhe && detalhe.length > 0) {
        const soma = detalhe.reduce((acc, d) => acc + d.valor, 0);
        if (Math.abs(soma - ag.valor) > 0.01) {
          divergenciasRendimento.push({ chave, codigo: ag.codigo, categoria: ag.categoria, soma, agregado: ag.valor });
        }
        for (const d of detalhe) emitir(chave, d);
        porCodigo.delete(chave);
      } else {
        emitir(chave, { codigo: ag.codigo, valor: ag.valor });
      }
    }
    // Detalhe de um código que não tem agregado não pode sumir: entra igual, e
    // o import avisa, porque significa que o arquivo tem algo que este parser
    // ainda não entende sobre a estrutura dele.
    for (const [chave, detalhe] of porCodigo) {
      for (const d of detalhe) emitir(chave, d);
      divergenciasRendimento.push({
        chave, codigo: detalhe[0]?.codigo || '', categoria: detalhe[0]?.categoria || '',
        soma: detalhe.reduce((a, d) => a + d.valor, 0), agregado: 0,
      });
    }
  }

  // ACHADO 08 da auditoria de 24/08/2026: até aqui `divergenciasRendimento`
  // era declarada, preenchida nos dois pontos acima e NUNCA lida — nem
  // logada, nem devolvida. O caminho PDF tem a rede equivalente funcionando
  // (`rieDivergencias`); pelo `.DBK` uma divergência entre o detalhe por fonte
  // pagadora e o total que a própria declaração informa passava em silêncio,
  // que é exatamente a situação para a qual o aviso existe. Provado adulterando
  // um registro 84 do arquivo real: o total de isentos mudava R$ 3.439,49 e a
  // importação não dizia nada.
  for (const d of divergenciasRendimento) {
    const rotulo = d.categoria === 'isento' ? 'rendimento isento' : 'rendimento de tributação exclusiva';
    if (d.agregado === 0) {
      log(`Conferência da ficha de rendimentos: o ${rotulo} de código ${d.codigo} tem detalhe por fonte somando R$ ${d.soma.toFixed(2)}, mas a declaração não traz o total desse código. Confira esse item na declaração original.`, 'warning');
    } else {
      log(`Conferência da ficha de rendimentos: o ${rotulo} de código ${d.codigo} soma R$ ${d.soma.toFixed(2)} no detalhe por fonte, mas a própria declaração informa R$ ${d.agregado.toFixed(2)} no total do código. Confira esse item na declaração original.`, 'warning');
    }
  }

  // IRRF do 13º salário no rendimento exclusivo correspondente (achado 07).
  // Roda aqui, e não na emissão, porque precisa da lista de rendimentos
  // inteira: a ficha de PJ e a de exclusivos são lidas em momentos diferentes.
  aplicarIrrfDecimoTerceiro(rendimentos);

  // ACHADO 05 da auditoria de 24/08/2026: RRA contado duas vezes.
  //
  // Os registros 45/47 eram importados SEMPRE como rendimento tributável, pelo
  // valor tributável, sem olhar a opção de tributação que o próprio parser lê e
  // guarda. Quando o contribuinte optou pela tributação EXCLUSIVA NA FONTE, o
  // programa da Receita também transporta esse rendimento para a linha 07
  // (titular) ou 09 (dependentes) da ficha de exclusivos — que vira registro 24
  // no arquivo e entra aqui como `exclusivo_0007`/`exclusivo_0009`. Os dois
  // somavam, e o mesmo dinheiro aparecia em dobro no Demonstrativo.
  //
  // Não dá para decidir pela opção de tributação: o layout não documenta a
  // tabela de valores desse campo e nenhuma das declarações de referência tem
  // RRA, então deduzir o de-para de zero exemplos seria chute. O que dá para
  // fazer com segurança é comparar os VALORES: quando o tributável do RRA bate
  // com o total do código correspondente na ficha de exclusivos, é o mesmo
  // rendimento visto duas vezes. Nesse caso o RRA fica marcado como
  // `naoSomar` (continua visível na tela de Rendimentos, como detalhe do que
  // já entrou pelos exclusivos) e a importação avisa.
  {
    const codigoExclusivoDoRra = { Titular: '0007', Dependente: '0009' };
    const totalExclusivoPorCodigo = (codigo) => rendimentos
      .filter(r => r.tipo === `exclusivo_${codigo}`)
      .reduce((s, r) => s + (r.valor || 0), 0);
    for (const r of rendimentos.filter(x => x.tipo === 'tributavel_rra')) {
      const codigo = codigoExclusivoDoRra[r.beneficiario] || '0007';
      const totalExclusivo = totalExclusivoPorCodigo(codigo);
      if (totalExclusivo > 0 && Math.abs(totalExclusivo - r.valor) < 0.01) {
        r.naoSomar = true;
        r.motivoNaoSomar = `Já contado na ficha de tributação exclusiva, código ${codigo}`;
        log(`O RRA de ${r.nome_fonte || 'fonte não identificada'} (R$ ${r.valor.toFixed(2)}) tem o mesmo valor do código ${codigo} da ficha de tributação exclusiva: foi tributado na fonte e já entra por lá. Ele aparece na tela de Rendimentos como detalhe, sem somar de novo no Demonstrativo.`, 'warning');
      }
    }
  }

  if (contribuinte.cpf) {
    log(`Contribuinte: ${contribuinte.nome}, CPF: ${contribuinte.cpf}`, 'success');
  } else {
    log('Não foi possível identificar o contribuinte (registro 16 não encontrado).', 'warning');
  }
  if (anoCalendario) {
    log(`Ano-calendário desta declaração: ${anoCalendario}`);
  } else {
    log('Não foi possível identificar o ano-calendário (registro de cabeçalho "IR" não encontrado). Mantendo o ano selecionado na tela.', 'warning');
  }
  log(`Identificados ${bens.length} bens e direitos`);
  log(`Identificadas ${dividas.length} dívidas e ônus reais`);
  log(`Identificados ${rendimentos.length} rendimentos`);
  log(`Identificados ${pagamentos.length} pagamentos efetuados`);
  log(`Identificados ${dependentes.length} dependente(s)`);
  if (impostoDevido) {
    log(`Resumo/Imposto Devido identificado: total devido ${impostoDevido.impostoDevidoTotal}, saldo a pagar ${impostoDevido.saldoPagar}`);
  }

  // Ganhos de Capital: monta a lista final e mantém, além dela, o resumo
  // simplificado que o resto do app já consumia (`apuracaoGanhoCapital`, uma
  // linha por operação com bem, datas, valores e adquirente). Assim a tela de
  // Ganhos de Capital e o Demonstrativo continuam funcionando sem alteração,
  // e quem quiser o detalhe completo usa `ganhosCapitalOficial`.
  //
  // O ganho de cada operação vem da APURAÇÃO da própria declaração quando ela
  // existe (registros 68/69 ou os campos de apuração do 63) e só cai para a
  // conta "alienação − custo" quando não veio apuração nenhuma. É diferença
  // que importa: no imóvel o ganho apurado já está líquido das reduções da Lei
  // 7.713/1988 e da Lei 11.196/2005, que a subtração simples ignoraria.
  const ganhosCapitalOperacoes = Array.from(gcOperacoes.values())
    .sort((a, b) => (a.tipo).localeCompare(b.tipo) || (a.numeroOperacao || '').localeCompare(b.numeroOperacao || ''));
  const ganhosCapitalOficial = (ganhosCapitalOperacoes.length > 0 || gcConsolidacao
    || gcMoedaOperacoes.length > 0 || gcMoedaMensal.some(m => m.ganhoCapital || m.alienacaoDolar))
    ? {
      consolidacao: gcConsolidacao,
      operacoes: ganhosCapitalOperacoes,
      moedaEspecie: {
        operacoes: gcMoedaOperacoes,
        mensal: gcMoedaMensal.sort((a, b) => a.mes - b.mes),
      },
      origem: 'dbk',
    }
    : null;

  const apuracaoGanhoCapital = ganhosCapitalOperacoes.map((op, i) => {
    const valorAlienacao = op.valorAlienacao ?? op.apuracao?.valorAlienacao ?? 0;
    const custoAquisicao = op.custoAquisicao ?? op.apuracao?.custoAquisicao ?? 0;
    const ganhoApurado = op.apuracao?.reducoes?.ganhoTributavel ?? op.apuracao?.ganhoCapital;
    const adquirente = op.adquirentes[0] || {};
    return {
      id: i + 1,
      tipo: op.tipo,
      bem: op.especificacao || '',
      dataAquisicao: op.dataAquisicao || '',
      custoAquisicao,
      dataAlienacao: op.dataAlienacao || '',
      valorAlienacao,
      ganhoCapital: ganhoApurado != null ? ganhoApurado : Math.max(0, valorAlienacao - custoAquisicao),
      impostoDevido: op.calculoImposto?.impostoDevido ?? 0,
      impostoPago: op.calculoImposto?.impostoPago ?? 0,
      adquirenteCpfCnpj: adquirente.cpfCnpj || '',
      adquirenteNome: adquirente.nome || '',
    };
  });
  if (apuracaoGanhoCapital.length > 0) {
    const porTipo = apuracaoGanhoCapital.reduce((acc, o) => { acc[o.tipo] = (acc[o.tipo] || 0) + 1; return acc; }, {});
    const partes = [];
    if (porTipo.imovel) partes.push(`${porTipo.imovel} de bem imóvel`);
    if (porTipo.movel) partes.push(`${porTipo.movel} de direito/bem móvel`);
    if (porTipo.participacao) partes.push(`${porTipo.participacao} de participação societária`);
    log(`Ganhos de Capital: ${apuracaoGanhoCapital.length} operação(ões) importada(s)${partes.length ? ` (${partes.join(', ')})` : ''}`, 'success');
  }
  if (gcMoedaOperacoes.length > 0) {
    log(`Ganhos de Capital: ${gcMoedaOperacoes.length} movimento(s) de moeda estrangeira em espécie importado(s)`, 'success');
  }
  if (imoveisRurais.length > 0 || bensRurais.length > 0 || dividasRurais.length > 0) {
    log(`Atividade Rural: ${imoveisRurais.length} imóveis explorados, ${bensRurais.length} bens, ${dividasRurais.length} dívidas identificadas`);
  }
  receitasDespesasRuraisOficial.sort((a, b) => a.mes - b.mes);
  if (receitasDespesasRuraisOficial.length > 0 || apuracaoResultadoRuralOficial) {
    log(`Atividade Rural: Receitas e Despesas mensais (${receitasDespesasRuraisOficial.length} meses) e Apuração do Resultado identificadas`);
  }
  if (movimentacaoRebanhoOficial.length > 0) {
    log(`Atividade Rural: Movimentação do Rebanho identificada (${movimentacaoRebanhoOficial.length} espécie(s) com movimento)`);
  }
  if (participantesRuraisOficial.length > 0) {
    log(`Atividade Rural: ${participantesRuraisOficial.length} participante(s) de imóveis rurais identificado(s) (sem vínculo automático a um imóvel específico)`);
  }
  if (demonstrativoExteriorOficial.length > 0) {
    log(`Demonstrativo Lei 14.754/2023: ${demonstrativoExteriorOficial.length} bem(ns) com ganho no exterior identificado(s)`);
  }
  // Titular antes dos dependentes e, dentro de cada um, na ordem dos meses —
  // mesma ordenação do caminho PDF, para as duas origens produzirem a mesma
  // sequência na tela.
  rendaVariavelMensalOficial.sort((a, b) => (b.titular - a.titular) || (a.mes - b.mes));
  fiiFiagroMensalOficial.sort((a, b) => (b.titular - a.titular) || (a.mes - b.mes));
  if (rendaVariavelMensalOficial.length > 0) {
    const comOperacao = rendaVariavelMensalOficial.filter(r => (r.comuns?.resultadoLiquidoMes || 0) !== 0 || (r.daytrade?.resultadoLiquidoMes || 0) !== 0).length;
    log(`Renda Variável (operações comuns/day-trade): ${rendaVariavelMensalOficial.length} ficha(s) mensal(is), ${comOperacao} com resultado no mês`, 'success');
  }
  if (fiiFiagroMensalOficial.length > 0) {
    const comOperacao = fiiFiagroMensalOficial.filter(r => (r.resultadoLiquidoMes || 0) !== 0).length;
    log(`Renda Variável (FII/Fiagro): ${fiiFiagroMensalOficial.length} ficha(s) mensal(is), ${comOperacao} com resultado no mês`, 'success');
  }

  const documentoFonte = await criarDocumentoFonte({
    formato: 'dbk',
    textoIntegral: text,
    totalRegistros: lines.filter(line => line.trim() !== '').length,
  });

  return {
    // Qual arquivo originou estes dados. Guardado no estado do ano (ver
    // reducer.js/IMPORT_DECLARACAO) para as telas de resumo poderem avisar
    // que uma importação por PDF é PARCIAL, em vez de mostrar zero em
    // Rendimentos como se a pessoa não tivesse tido renda nenhuma.
    formato: 'dbk',
    contribuinte, bens, dividas, rendimentos, pagamentos, dependentes, anoCalendario, impostoDevido,
    apuracaoGanhoCapital, imoveisRurais, bensRurais, dividasRurais,
    receitasDespesasRuraisOficial, apuracaoResultadoRuralOficial, movimentacaoRebanhoOficial,
    participantesRuraisOficial, demonstrativoExteriorOficial, rendaVariavelMensalOficial,
    ganhosCapitalOficial, rendaVariavelAnualOficial, fiiFiagroMensalOficial, fiiFiagroAnualOficial,
    doacoesEfetuadasOficial: doacoesEfetuadas,
    doacoesPartidosOficial: doacoesPartidos,
    doacoesEcaIdosoOficial: doacoesEcaIdoso,
    fichasNaoLidasComConteudo,
    registrosDbkNaoModelados,
    avisosImportacao,
    estadoFichas,
    documentoFonte,
  };
}

// O PDF da declaração é um formulário tabular: pdf.js entrega os itens de
// texto na ordem do stream interno do PDF, não na ordem visual — por isso
// colar tudo numa string e aplicar regex (abordagem anterior) embaralhava
// grupo/código/valores. Aqui cada item de texto traz sua posição (x,y); a
// reconstrução usa a posição para agrupar em linhas e mapear colunas, do
// mesmo jeito que o .DBK usa offsets fixos de caractere.
const normSpace = (s) => (s || '').replace(/\s+/g, ' ').trim();
const parseMoneyBR = (s) => {
  const cleaned = (s || '').replace(/[^\d,.-]/g, '');
  if (!cleaned) return 0;
  return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
};

// Tolerância, em unidades de PDF, para dois textos serem considerados a MESMA
// linha visual. O espaçamento entre linhas do formulário é de cerca de 11
// unidades, então 2 separa com folga linhas de verdade e ainda junta o que só
// difere por causa de tamanho de fonte diferente na mesma linha.
const TOLERANCIA_LINHA = 2;

// Agrupa os textos em linhas visuais. A versão anterior usava `Math.round(y)`
// como chave EXATA, e isso partia em duas uma linha só sempre que o rótulo e o
// valor eram desenhados com um fio de diferença na base: numa declaração real,
// "Negociados em Bolsa:" saía em y=537 e o "Não" correspondente em y=536, e o
// "Não" órfão, sem rótulo do lado, ia parar no fim da discriminação do bem.
// O mesmo acontecia com o par "Bem ou direito pertencente ao:" / "Dependente".
// Achado ao rodar a auditoria de 21/08/2026 contra a declaração de um segundo
// contribuinte, com layout diferente do primeiro.
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

const rowHasCell = (row, exact) => row.cells.some(c => c.text.trim() === exact);
const findCellX = (row, exact) => (row.cells.find(c => c.text.trim() === exact) || {}).x;
const findCellXRegex = (row, re) => (row.cells.find(c => re.test(c.text.trim())) || {}).x;
const nextCellText = (row, labelExact) => {
  const idx = row.cells.findIndex(c => c.text.trim() === labelExact);
  return idx >= 0 && row.cells[idx + 1] ? row.cells[idx + 1].text.trim() : '';
};

// Bucketa uma coordenada x na coluna cujo anchor está mais próximo à
// esquerda (fronteiras = ponto médio entre anchors vizinhos).
const makeColumnPicker = (anchors) => {
  const sorted = Object.entries(anchors)
    // Só âncoras numéricas viram coluna. Um objeto de âncoras pode carregar
    // metadados de texto (ex.: `tipoLayout` nas doações); incluí-los aqui
    // corromperia a ordenação por x e o bucketing.
    .filter(([, x]) => typeof x === 'number')
    .map(([name, x]) => ({ name, x }))
    .sort((a, b) => a.x - b.x);
  const bounds = sorted.map((a, i) => ({
    name: a.name,
    lo: i === 0 ? -Infinity : (sorted[i - 1].x + a.x) / 2,
    hi: i === sorted.length - 1 ? Infinity : (a.x + sorted[i + 1].x) / 2,
  }));
  return (x) => (bounds.find(b => x >= b.lo && x < b.hi) || {}).name;
};

const textInColumn = (row, pick, colName, joinChar = ' ') =>
  normSpace(row.cells.filter(c => pick(c.x) === colName).map(c => c.text).join(joinChar));

// Junta as células da coluna DISCRIMINAÇÃO respeitando a quebra de palavra do
// PDF: quando um pedaço termina em hífen e o resto veio na célula seguinte
// ("7827/0000501-" + "3", "TE43E-" + "J000060"), colar com espaço no meio
// inventa um espaço que não existe no documento. Um hífen SOZINHO numa célula
// é pontuação de verdade ("AGRONEGOCIO - 7827/...") e mantém os espaços.
// Valor monetário do quadro ("1.752.472,35", "0,00"), usado para separar a
// coluna de valores do texto do bem que invade a faixa dela.
const EH_VALOR_MONETARIO = /^-?[\d.]+,\d{2}$/;

const textoDaColunaDisc = (row, pick, anchors) => {
  // A fronteira que o makeColumnPicker calcula entre DISCRIMINAÇÃO e a
  // primeira coluna de valores é o ponto médio entre as duas âncoras, e o
  // texto do bem passa desse ponto quando a linha é justificada: a palavra
  // "PREMIOS" de um dos bens cai em x≈304 contra uma fronteira em 263, e
  // sumia da discriminação (achado ao medir a correção da auditoria de
  // 21/08/2026 contra os 172 bens reais). As colunas de valor são alinhadas
  // à direita e só contêm número, então o critério aqui é o formato: à
  // direita da discriminação e à esquerda da âncora da primeira coluna de
  // valores, o que NÃO é valor monetário continua sendo texto do bem.
  const inicioDisc = anchors?.disc;
  const limiteValores = anchors?.val1;
  const partes = row.cells.filter(c => {
    if (pick(c.x) === 'disc') return true;
    if (inicioDisc == null || limiteValores == null) return false;
    if (c.x < inicioDisc || c.x >= limiteValores) return false;
    const t = normSpace(c.text);
    if (t === '' || EH_VALOR_MONETARIO.test(t)) return false;
    // Nesta faixa estendida convivem duas coisas: o texto do bem que a
    // justificação empurrou para a direita (entra) e a COLUNA DIREITA de
    // campos do formulário, "Bem com usufruto: Não" e parentes (não entra).
    // A distância entre as duas depende do layout da página, e o layout muda
    // de declaração para declaração: numa, o campo da direita fica em x≈399
    // com a coluna de valores em x≈389, e ele cai fora sozinho; noutra, sem
    // a coluna "BEM" no cabeçalho, a mesma página tem valores em x≈401 e o
    // campo em x≈399, e ele entrava. Por isso o critério aqui é o FORMATO do
    // texto, que não depende de coordenada: campo do formulário começa com
    // "Rótulo:".
    return !ROTULO_METADADO_RE.test(t);
  }).map(c => c.text);
  return normSpace(partes.join(' '));
};

// A linha inteira é um campo do formulário, e não continuação da
// discriminação, quando traz um rótulo NAS COLUNAS À ESQUERDA da
// discriminação. É o caso da linha de dados bancários, que espalha
// "Banco: 422  Agência: 1620  Conta: 006781-7" da margem esquerda até dentro
// da coluna de discriminação: o filtro por coluna sozinho deixaria o
// "Conta: 006781-7" grudar no fim do texto do bem (achado ao medir a
// correção da auditoria de 21/08/2026 contra os 172 bens reais).
const linhaTemRotuloAEsquerdaDaDisc = (row, pick) =>
  row.cells.some(c => {
    const col = pick(c.x);
    if (col !== 'bem' && col !== 'grupo' && col !== 'codigo') return false;
    // O pdf.js entrega a frase inteira numa célula só ("Banco: 422"), então
    // o teste é "COMEÇA com rótulo", não "termina em dois-pontos".
    return ROTULO_METADADO_RE.test(normSpace(c.text));
  });

// Não inclui '(Valores em Reais)': ela vem colada na MESMA linha que os
// títulos de seção ("DECLARAÇÃO DE BENS E DIREITOS (Valores em Reais)"),
// então descartar por ela apagaria a linha que dispara a troca de seção.
// ANO-CALENDÁRIO/EXERCÍCIO variam a cada declaração (o app é plurianual
// por natureza) — nunca cravar o ano aqui, senão o filtro só funciona
// para o ano da declaração de exemplo usada nos testes.
// NÃO inclui 'CPF:'. O cabeçalho de página ("CPF: <cpf> IMPOSTO SOBRE A RENDA -
// PESSOA FÍSICA") já é reconhecido pela âncora forte 'IMPOSTO SOBRE A RENDA -
// PESSOA FÍSICA'. Tratar 'CPF:' como boilerplate por conta própria descartava a
// linha de titularidade do bem ("Bem ou direito pertencente ao: Dependente
// CPF: <cpf>"), que também traz uma célula 'CPF:' — e com ela a titularidade e
// o CPF do dependente do bem (auditoria de 31/08/2026).
const BOILERPLATE = new Set([
  'NOME:', 'DECLARAÇÃO DE AJUSTE ANUAL', 'IMPOSTO SOBRE A RENDA - PESSOA FÍSICA',
]);

// Linhas de continuação de um bem (endereço, texto que estourou a coluna)
// entram na discriminação por padrão — mas o formulário tem uma seção de
// campos estruturados própria por grupo (endereço e cartório para
// imóveis; chassi/RENAVAM/cor para veículos; banco/agência/conta para
// contas; CNPJ/bolsa para participações...), cada um no formato "Rótulo:
// valor", e grudar isso na discriminação vira uma frase só sem sentido
// (achado em auditoria real contra uma declaração de 172 bens: dezenas de
// rótulos diferentes, um por grupo). Em vez de listar cada rótulo (a
// variedade é grande e cresce por grupo), reconhece o FORMATO — uma frase
// curta terminando em ":" — que o texto descritivo de um bem nunca usa.
//
// O rótulo tem que estar no INÍCIO da linha, e não em qualquer posição dela.
// A versão anterior aceitava o rótulo em qualquer lugar e comia texto REAL
// que apenas TERMINA num rótulo, porque o valor quebrou para a linha
// seguinte: "...EMPREENDIMENTOS IMOBILIARIOS SPE LTDA CNPJ:" sumia inteiro e
// o bem ficava sem o nome de quem vendeu. O mesmo acontecia com texto que só
// menciona um rótulo no meio ("...- 7824/0019900-9 QUANTIDADE:
// 330.158,62550000"). Eram 33 dos 172 bens perdendo informação na auditoria
// de 21/08/2026. Quem descarta as linhas onde o rótulo aparece no meio ou no
// fim, mas que são campo de formulário de verdade, é o filtro por COLUNA na
// leitura de bens (ver `section === 'bens'` em parsePDF): campo do formulário
// mora nas colunas da esquerda (x≈17) ou da direita (x≈399), nunca na coluna
// DISCRIMINAÇÃO.
const ROTULO_METADADO_RE = /^[A-ZÀ-Ý][\wÀ-ÿ()°ºª./-]*(\s[A-ZÀ-Üa-zà-ÿ()°ºª./-]{1,20}){0,3}:(\s|$)/;
// Segunda barreira da leitura de bens, aplicada DEPOIS do filtro por coluna:
// os poucos valores de campo do formulário que caem dentro da própria coluna
// de discriminação, e que a posição x portanto não separa.
//
// É uma lista fechada de casos exatos, de propósito. A tentação é reusar o
// ROTULO_METADADO_RE aqui, e foi o que a versão anterior fazia: o problema é
// que a discriminação de verdade usa rótulo o tempo todo ("CHASSI: ...",
// "COMBUSTIVEL: ...", "CPF: ...", "AGENCIA/CONTA: ..."), então qualquer regra
// por formato descarta texto real. Quem separa campo de formulário de
// descrição do bem é a COLUNA; aqui só sobram as exceções conhecidas.
const valorDeCampoNaColunaDisc = (texto) => {
  const t = normSpace(texto);
  // Valor da coluna Beneficiário sem o rótulo na mesma linha: cai na mesma
  // posição x da discriminação (achado real, 12 de 172 bens vinham com
  // " Titular" a mais no fim do texto).
  if (t === 'Titular' || t === 'Dependente') return true;
  // Pergunta fixa do formulário da Lei 14.754.
  if (t === 'Possui perdas a compensar de acordo com a Lei nº 14.754, de 2023 (art. 9º)?') return true;
  // Sobra do par de colunas de valor do quadro de bens no exterior, que vem
  // sem rótulo nenhum na linha ("0,00 0,00").
  if (/^(0,00\s*)+$/.test(t)) return true;
  return false;
};

// Lê de uma linha de metadados do bem os campos que o formulário imprime
// abaixo dele, e grava no bem corrente. Devolve true quando a linha foi
// reconhecida como metadado (e portanto NÃO é continuação da discriminação).
// Todos foram confirmados no AJU-01/ESP-01/SAI-01 (auditoria de 31/08/2026);
// antes disto o país era cravado '105', a titularidade 'Titular', e
// matrícula/RENAVAM/IPTU eram jogados fora mesmo o modelo tendo os campos.
const HERDEIRO_CABECALHO = ['Nome', 'CPF/CNPJ', 'Percentual de participação (%)'];
const extrairMetadadoDoBem = (bem, row, discX) => {
  const cells = row.cells.map(c => ({ x: c.x, t: normSpace(c.text) })).filter(c => c.t);
  if (cells.length === 0) return false;
  const textoLinha = normSpace(cells.map(c => c.t).join(' '));
  // Os campos estruturados do bem (país, titularidade, Inscrição Municipal,
  // Matrícula, RENAVAM) são impressos à ESQUERDA da coluna de discriminação,
  // na margem do formulário. A discriminação de texto livre — que o
  // contribuinte digita e PODE conter "CPF:", "RENAVAM:", "Matrícula:" no meio
  // — vive DENTRO da coluna de discriminação. Sem esta fronteira, uma
  // declaração real com esses termos no texto do bem perderia parte da
  // descrição (regressão pega pelos testes contra a declaração de 172 bens).
  // O bloco de herdeiros e o cabeçalho "(R$)" do exterior têm forma própria e
  // não dependem dela.
  const naMargemEsquerda = discX == null || cells[0].x < discX - 10;

  // País: "249 - ESTADOS UNIDOS DA AMÉRICA". A célula pode vir seguida de
  // "Bem com usufruto: Não" na mesma linha; por isso testa a PRIMEIRA célula.
  const mPais = naMargemEsquerda ? BEM_PAIS.exec(cells[0].t) : null;
  if (mPais) {
    bem.localizacao = mPais[1];
    bem.paisNome = normSpace(mPais[2]);
    return true;
  }

  // "Bem ou direito pertencente ao: Titular|Dependente  CPF: <cpf>"
  if (naMargemEsquerda && /^Bem ou direito pertencente ao:/.test(textoLinha)) {
    if (/\bDependente\b/.test(textoLinha)) {
      bem.beneficiario = 'Dependente';
      const mCpf = /CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/.exec(textoLinha);
      bem.cpf_beneficiario = mCpf ? mCpf[1].replace(/\D/g, '') : '';
    } else {
      bem.beneficiario = 'Titular';
      bem.cpf_beneficiario = '';
    }
    return true;
  }

  // Inscrição Municipal (IPTU), Matrícula, RENAVAM: cada um numa linha própria,
  // na margem esquerda. O `naMargemEsquerda` separa o campo estruturado do
  // mesmo termo digitado dentro da descrição.
  if (naMargemEsquerda) {
    const mIm = BEM_INSCRICAO_MUNICIPAL.exec(textoLinha);
    if (mIm) { bem.inscricao_municipal = normSpace(mIm[1]); return true; }
    const mMat = BEM_MATRICULA.exec(textoLinha);
    if (mMat) { bem.matricula = normSpace(mMat[1]); return true; }
    const mRen = BEM_RENAVAM.exec(textoLinha);
    if (mRen) { bem.renavam = normSpace(mRen[1]); return true; }
  }

  // Cabeçalho do subquadro financeiro do bem no EXTERIOR ("Aplicação Financeira
  // (R$)", "Lucros e Dividendos (R$)"): é rótulo de coluna, não texto do bem.
  // Cai na faixa da coluna de discriminação (x≈187) e grudava no fim da
  // descrição de todo bem no exterior (auditoria de 31/08/2026). Reconhecido
  // pela forma: toda célula termina em "(R$)".
  if (cells.every(c => /\(R\$\)$/.test(c.t))) return true;

  // Bloco de HERDEIROS/MEEIRO do bem partilhado (Declaração Final de Espólio):
  // um cabeçalho "Nome | CPF/CNPJ | Percentual de participação (%)" seguido de
  // uma linha por herdeiro. Sem isto, na auditoria de 31/08/2026, os nomes e os
  // percentuais somiam e os CPFs contaminavam a discriminação do bem.
  if (HERDEIRO_CABECALHO.every(h => cells.some(c => c.t === h))) {
    bem.lendoHerdeiros = true;
    if (!bem.herdeiros) bem.herdeiros = [];
    return true;
  }
  if (bem.lendoHerdeiros) {
    // Linha de herdeiro: nome à esquerda, CPF/CNPJ no meio, percentual à
    // direita. Uma linha sem CPF encerra o bloco.
    const doc = cells.find(c => /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(c.t));
    if (doc) {
      const percentualCell = cells.find(c => /^\d{1,3},\d{2}$/.test(c.t));
      const nome = normSpace(cells.filter(c => c !== doc && c !== percentualCell).map(c => c.t).join(' '));
      bem.herdeiros.push({
        nome,
        cpf_cnpj: doc.t.replace(/\D/g, ''),
        percentual: percentualCell ? parseMoneyBR(percentualCell.t) : 0,
      });
      return true;
    }
    bem.lendoHerdeiros = false;
  }

  return false;
};

export const isBensMetadataRow = (row) => {
  const texto = normSpace(row.cells.map(c => c.text).join(' '));
  if (texto === 'Possui perdas a compensar de acordo com a Lei nº 14.754, de 2023 (art. 9º)?') return true;
  // "Titular"/"Dependente" sozinho na linha: é o VALOR da coluna
  // Beneficiário sem o rótulo "Beneficiário:" na mesma linha (o rótulo
  // fica numa linha, o valor cai na de baixo, na mesma posição x da
  // discriminação) — por isso o ROTULO_METADADO_RE (que exige ":" na
  // própria linha) não pega. Sem esse caso, "Titular" grudava sozinho no
  // fim da discriminação de alguns bens (achado real, auditoria item a
  // item contra a declaração: 12 dos 172 bens vinham com " Titular" a mais
  // no texto — sem perda de valor, só um rótulo de campo indo parar onde
  // não devia).
  if (texto === 'Titular' || texto === 'Dependente') return true;
  // A linha pode trazer o rótulo grudado a um pedacinho de boilerplate do
  // próprio formulário antes dele (ex.: "105 - BRASIL Bem com usufruto:
  // Não") — o rótulo não precisa estar bem no início da linha pra ela
  // inteira ser metadado, não discriminação de verdade.
  return ROTULO_METADADO_RE.test(texto);
};
// As TRÊS colunas de valor da ficha de Dívidas e Ônus Reais, lidas pela ORDEM
// das células e não pela coordenada de início delas.
//
// Por que não dá para bucketar pelo x: os números são impressos alinhados à
// DIREITA, e as âncoras de coluna vêm dos rótulos do cabeçalho, alinhados à
// esquerda. Medido no cabeçalho real do AJU-01 (p10 r4/r5): `disc` 114,8,
// `val1` 300,5, `val2` 384,6 e `pago` 518,8, o que põe a fronteira val2/pago
// em 451,70. Na mesma ficha, "72.802,72" (9 glifos) sai em x=446,4 e
// "6.805,75" (8 glifos) em x=450,9 — 4,5 por glifo, borda direita em 486,9.
// Logo um valor de 6 glifos, "999,99", sai em x=459,9 e cai em `pago`:
// `situacao_atual` zerava e `valor_pago` recebia a concatenação de dois
// números, que `parseMoneyBR` converte para um valor plausível e errado, sem
// sinal nenhum de erro. O mesmo vale para `val1` (borda direita 373,9,
// fronteira 342,55). Ou seja: todo saldo abaixo de R$ 1.000,00 migrava de
// coluna (auditoria de 31/08/2026).
//
// A ficha tem exatamente três colunas de valor, e a linha imprime as três,
// inclusive quando zeradas. Quando o número de valores bate, a ordem é a
// leitura certa e não depende de coordenada nenhuma — a mesma escolha já feita
// em `separarRotuloEValores` para a ficha de Renda Variável. Fora desse caso,
// cai no bucket por coluna, que é o comportamento antigo.
//
// O corte à esquerda é a fronteira entre DISCRIMINAÇÃO e a primeira coluna de
// valor, a única deste cabeçalho que não fica dentro do campo de um número: o
// texto do credor termina bem antes dela e o primeiro valor começa bem depois.
export const valoresDaLinhaDeDivida = (row, anchors) => {
  const pick = makeColumnPicker(anchors);
  const limiteEsquerdo = ((anchors.disc ?? 0) + (anchors.val1 ?? 0)) / 2;
  const monetarias = row.cells
    .filter(c => c.x >= limiteEsquerdo && EH_VALOR_MONETARIO.test(normSpace(c.text)))
    .sort((a, b) => a.x - b.x);
  if (monetarias.length === 3) {
    return {
      situacao_anterior: parseMoneyBR(monetarias[0].text),
      situacao_atual: parseMoneyBR(monetarias[1].text),
      valor_pago: parseMoneyBR(monetarias[2].text),
      lidoPorOrdem: true,
    };
  }
  return {
    situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
    situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
    valor_pago: parseMoneyBR(textInColumn(row, pick, 'pago', '')),
    lidoPorOrdem: false,
  };
};

const isBoilerplateRow = (row) =>
  row.cells.some(c => BOILERPLATE.has(c.text.trim()) || /^(ANO-CALENDÁRIO|EXERCÍCIO) \d{4}$/.test(c.text.trim())) ||
  /^Página \d+ de \d+$/.test(row.cells.map(c => c.text).join(' ').trim());

// Cabeçalho de tabela das 4 fichas de Doações, mesmo formato visual de
// Pagamentos Efetuados (mesmo programa da Receita, mesma família de
// tabela). SEM NENHUM EXEMPLO REAL disponível (o arquivo de referência tem
// as 4 fichas "Sem Informações" — nem uma linha de cabeçalho pra copiar a
// posição exata das colunas), então a coluna de valor é detectada por
// regex tolerante (/^VALOR/, cobre "VALOR PAGO"/"VALOR DOADO" ou variação)
// em vez do texto exato usado em Pagamentos — cravar um texto nunca visto
// seria uma posição inventada, não uma leitura confirmada.
// As quatro fichas de Doações NÃO usam o mesmo cabeçalho, ao contrário do que a
// versão anterior assumia. São três layouts distintos, e assumir só o de
// Doações Efetuadas fazia as outras três serem detectadas e nunca lidas — uma
// doação eleitoral e duas doações DEDUTÍVEIS (ECA e Pessoa Idosa) somiam por
// inteiro (auditoria de 31/08/2026). Os três, confirmados no AJU-01:
//   Efetuadas   (p8 r15/r16): CÓD. | NOME DO BENEFICIÁRIO | CPF/CNPJ DO | VALOR PAGO | PARC. NÃO DEDUTÍVEL
//   Partidos    (p10 r11):    NOME | CNPJ | VALOR
//   ECA/Idoso   (p38 r47):    TIPO DE FUNDO | FUNDO | CNPJ | VALOR
const isDoacaoHeaderEfetuadas = (row) => rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text));
const isDoacaoHeaderPartidos = (row) => rowHasCell(row, 'NOME') && rowHasCell(row, 'CNPJ') && rowHasCell(row, 'VALOR')
  && !row.cells.some(c => /TIPO DE FUNDO/.test(c.text));
const isDoacaoHeaderFundo = (row) => row.cells.some(c => /TIPO DE FUNDO/.test(c.text)) && rowHasCell(row, 'FUNDO');

// A coluna PARC. NÃO DEDUTÍVEL das Doações Efetuadas fica À DIREITA de VALOR
// PAGO. Sem uma âncora própria para ela, o balde de VALOR (o último do
// makeColumnPicker, com hi=+Infinity) engolia as duas células e as concatenava,
// jogando fora a parcela e, numa declaração com parcela != 0, corrompendo o
// valor doado (auditoria de 31/08/2026). O rótulo quebra em duas linhas
// ("PARC. NÃO" / "DEDUTÍVEL"), então a âncora vem do começo, /^PARC/.
const buildDoacaoAnchors = (row, tipoLayout) => {
  if (tipoLayout === 'partidos') {
    return { tipoLayout, nome: findCellX(row, 'NOME') ?? 18, cpfcnpj: findCellX(row, 'CNPJ') ?? 272, valor: findCellX(row, 'VALOR') ?? 538 };
  }
  if (tipoLayout === 'fundo') {
    return {
      tipoLayout,
      tipoFundo: findCellXRegex(row, /TIPO DE FUNDO/) ?? 16,
      fundo: findCellX(row, 'FUNDO') ?? 97,
      cpfcnpj: findCellX(row, 'CNPJ') ?? 408,
      valor: findCellX(row, 'VALOR') ?? 535,
    };
  }
  return {
    tipoLayout: 'efetuadas',
    codigo: findCellX(row, 'CÓD.'),
    nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,
    cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?? 254,
    valor: findCellXRegex(row, /^VALOR/) ?? 425,
    parcNao: findCellXRegex(row, /^PARC/) ?? 505,
  };
};

// Processa uma linha de uma das tabelas de doações. `st` é mutado in-place
// ({anchors, current, items, nextId, categoria?}). `st.layouts` diz quais
// cabeçalhos essa seção pode encontrar (Efetuadas só o dela; ECA/Idoso o de
// fundo; Partidos o de partidos).
const processDoacaoRow = (st, row) => {
  for (const tipoLayout of st.layouts) {
    const ehCabecalho = tipoLayout === 'partidos' ? isDoacaoHeaderPartidos(row)
      : tipoLayout === 'fundo' ? isDoacaoHeaderFundo(row)
      : isDoacaoHeaderEfetuadas(row);
    if (ehCabecalho) { st.anchors = buildDoacaoAnchors(row, tipoLayout); return; }
  }
  if (!st.anchors) return;
  if (rowHasCell(row, 'TOTAL')) {
    if (st.current) { st.items.push(st.current); st.current = null; }
    return;
  }
  const layout = st.anchors.tipoLayout;
  const pick = makeColumnPicker(st.anchors);

  if (layout === 'fundo') {
    // Beneficiário é um FUNDO (esfera + UF/município), não uma pessoa. Uma
    // linha de fundo tem o CNPJ e o valor; o resto é texto.
    const cnpj = textInColumn(row, pick, 'cpfcnpj').replace(/\D/g, '');
    const valorTxt = textInColumn(row, pick, 'valor', '');
    if (cnpj && valorTxt) {
      if (st.current) st.items.push(st.current);
      const esferaFundo = normSpace(textInColumn(row, pick, 'tipoFundo'));
      const fundo = normSpace(textInColumn(row, pick, 'fundo'));
      st.current = {
        id: st.nextId(),
        codigo: st.categoria === 'idoso' ? '42' : '41',
        esferaFundo,
        fundo,
        nome_beneficiario: normSpace([esferaFundo, fundo].filter(Boolean).join(' - ')),
        cpf_cnpj: cnpj,
        valor: parseMoneyBR(valorTxt),
        descricao: '',
        ...(st.categoria ? { categoria: st.categoria } : {}),
      };
    }
    return;
  }

  if (rowHasCell(row, 'Descrição:')) {
    if (st.current) {
      const desc = normSpace(row.cells.filter(c => c.text.trim() !== 'Descrição:').map(c => c.text).join(' '));
      st.current.descricao = normSpace((st.current.descricao + ' ' + desc)).substring(0, 300);
    }
    return;
  }
  if (row.cells.some(c => /^Dependente:/.test(c.text.trim()))) return;

  if (layout === 'partidos') {
    // NOME | CNPJ | VALOR, sem código nem parcela.
    const cnpj = textInColumn(row, pick, 'cpfcnpj').replace(/\D/g, '');
    const valorTxt = textInColumn(row, pick, 'valor', '');
    const nome = textInColumn(row, pick, 'nome');
    if ((cnpj || nome) && valorTxt) {
      if (st.current) st.items.push(st.current);
      st.current = {
        id: st.nextId(),
        codigo: '',
        nome_beneficiario: nome,
        cpf_cnpj: cnpj,
        valor: parseMoneyBR(valorTxt),
        descricao: '',
      };
    } else if (st.current && nome) {
      st.current.nome_beneficiario = normSpace(st.current.nome_beneficiario + ' ' + nome);
    }
    return;
  }

  // Efetuadas: CÓD. | NOME | CPF/CNPJ | VALOR PAGO | PARC. NÃO DEDUTÍVEL.
  const codigoTxt = textInColumn(row, pick, 'codigo');
  const valorTxt = textInColumn(row, pick, 'valor', '');
  if (/^\d{1,3}$/.test(codigoTxt) && valorTxt) {
    if (st.current) st.items.push(st.current);
    st.current = {
      id: st.nextId(),
      codigo: codigoTxt,
      nome_beneficiario: textInColumn(row, pick, 'nome'),
      cpf_cnpj: textInColumn(row, pick, 'cpfcnpj').replace(/\D/g, ''),
      valor: parseMoneyBR(valorTxt),
      parcela_nao_dedutivel: parseMoneyBR(textInColumn(row, pick, 'parcNao', '')),
      descricao: '',
      ...(st.categoria ? { categoria: st.categoria } : {}),
    };
  } else if (st.current) {
    const extra = textInColumn(row, pick, 'nome');
    if (extra) st.current.nome_beneficiario = normSpace(st.current.nome_beneficiario + ' ' + extra);
  }
};

// ---------------------------------------------------------------------------
// Renda Variável ("RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - TITULAR" e
// "- DEPENDENTES"), lida SÓ por este caminho (PDF).
//
// O registro 76 do .DBK identifica que a ficha existe em cada mês, mas o campo
// de valor nunca pôde ser decifrado: nos dois arquivos de referência disponíveis
// os 12 registros estão zerados, e não há como confirmar a posição de um campo
// de valor contra um valor que é zero (ver a nota do registro 76 em parseDBK).
// No PDF os mesmos valores estão legíveis, com rótulo ao lado, então é daqui
// que eles vêm.
//
// Layout da ficha, uma página por mês (confirmado nas duas declarações de
// referência): um marcador "GANHOS LÍQUIDOS OU PERDAS - <MÊS>" abre o mês, as
// 13 linhas de mercado e as 6 de apuração trazem DOIS valores (operações
// comuns e day-trade, nessa ordem), e o bloco "CONSOLIDAÇÃO DO MÊS" traz UM
// valor por linha. Mês sem operação nenhuma imprime só "Sem Informações".
const RV_MERCADOS = [
  ['Mercado à Vista - Ações', 'vistaAcoes'],
  ['Mercado à Vista - Ouro', 'vistaOuro'],
  ['Mercado à Vista - Ouro ativo financeiro fora de bolsa', 'vistaOuroForaBolsa'],
  ['Mercado de Opções - Ações', 'opcoesAcoes'],
  ['Mercado de Opções - Ouro', 'opcoesOuro'],
  ['Mercado de Opções - Fora de bolsa', 'opcoesForaBolsa'],
  ['Mercado de Opções - Outros', 'opcoesOutros'],
  ['Mercado Futuro - Dólar dos EUA', 'futuroDolar'],
  ['Mercado Futuro - Índices', 'futuroIndices'],
  ['Mercado Futuro - Juros', 'futuroJuros'],
  ['Mercado Futuro - Outros', 'futuroOutros'],
  ['Mercado a Termo - Ações/Ouro', 'termoAcoesOuro'],
  ['Mercado a Termo - Outros', 'termoOutros'],
];
// Linhas de apuração, mesmo formato de duas colunas das linhas de mercado.
const RV_APURACAO = [
  ['RESULTADO LÍQUIDO DO MÊS', 'resultadoLiquidoMes'],
  ['Resultado negativo até o mês anterior', 'resultadoNegativoMesAnterior'],
  ['BASE DE CÁLCULO DO IMPOSTO', 'baseCalculoImposto'],
  ['Prejuízo a compensar', 'prejuizoCompensar'],
  ['IMPOSTO DEVIDO', 'impostoDevido'],
];
// Bloco "CONSOLIDAÇÃO DO MÊS": rótulo + um único valor, sem separar comuns de
// day-trade (o próprio formulário consolida as duas colunas aqui).
const RV_CONSOLIDACAO = [
  ['Total do imposto devido', 'totalImpostoDevido'],
  ['IR fonte de day-trade do mês', 'irFonteDayTradeMes'],
  ['IR fonte de day-trade dos meses anteriores', 'irFonteDayTradeMesesAnteriores'],
  ['IR fonte de day-trade a compensar', 'irFonteDayTradeCompensar'],
  ['IR fonte (Lei nº 11.033/2004) no mês', 'irFonteLei11033Mes'],
  ['IR fonte (Lei nº 11.033/2004) nos meses anteriores', 'irFonteLei11033MesesAnteriores'],
  ['IR fonte (Lei nº 11.033/2004) a compensar', 'irFonteLei11033Compensar'],
  ['Imposto a pagar', 'impostoPagar'],
  ['Imposto pago', 'impostoPago'],
];
const RV_MERCADOS_MAP = new Map(RV_MERCADOS);
const RV_APURACAO_MAP = new Map(RV_APURACAO);
const RV_CONSOLIDACAO_MAP = new Map(RV_CONSOLIDACAO);
const RV_MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
// O sufixo "(CPF DEPENDENTE: 000.000.000-00)" só aparece na ficha dos
// dependentes; a do titular traz apenas o mês.
const RV_MARCADOR_MES = /^GANHOS LÍQUIDOS OU PERDAS\s*-\s*([A-ZÇ]{3})\s*(?:\(CPF DEPENDENTE:\s*([\d.-]+)\s*\))?$/;
// Valor monetário como o formulário imprime: "0,00", "99.811,07", "-245,40".
const RV_VALOR = /^-?[\d.]*\d,\d{2}$/;
const RV_ALIQUOTA = /^\d{1,3}%$/;

// Zera as duas colunas de uma ficha mensal. Campo ausente vira 0 e não
// `undefined`, para que somar/comparar mês a mês nunca produza NaN.
const rvColunaVazia = () => {
  const col = {};
  for (const [, chave] of RV_MERCADOS) col[chave] = 0;
  for (const [, chave] of RV_APURACAO) col[chave] = 0;
  col.aliquota = null;
  return col;
};

const somarCampo = (lista, seletor) => lista.reduce((total, item) => total + (seletor(item) || 0), 0);
const ultimosPorBeneficiario = (lista) => {
  const ultimos = new Map();
  for (const item of lista) {
    const chave = item.titular ? 'titular' : `dependente:${item.cpfDependente || ''}`;
    const anterior = ultimos.get(chave);
    if (!anterior || item.mes > anterior.mes) ultimos.set(chave, item);
  }
  return [...ultimos.values()];
};

// O PDF não traz um registro separado equivalente aos 41 e 43 do DBK. O
// fechamento anual é reconstruído somente a partir dos quadros mensais que o
// próprio formulário imprimiu. A marca deixa explícito que se trata de uma
// reconciliação dos meses, sem fingir que veio de uma linha anual autônoma.
const consolidarRendaVariavelAnualPdf = (mensal) => {
  if (mensal.length === 0) return null;
  const ultimos = ultimosPorBeneficiario(mensal);
  return {
    resultadoLiquido: somarCampo(mensal, m => m.comuns?.resultadoLiquidoMes + m.daytrade?.resultadoLiquidoMes),
    resultadoNegativoMesesAnteriores: somarCampo(ultimos, m => m.comuns?.resultadoNegativoMesAnterior + m.daytrade?.resultadoNegativoMesAnterior),
    baseCalculo: somarCampo(mensal, m => m.comuns?.baseCalculoImposto + m.daytrade?.baseCalculoImposto),
    prejuizoACompensar: somarCampo(ultimos, m => m.comuns?.prejuizoCompensar + m.daytrade?.prejuizoCompensar),
    impostoDevido: somarCampo(mensal, m => m.comuns?.impostoDevido + m.daytrade?.impostoDevido),
    consolidacaoImpostoDevido: somarCampo(mensal, m => m.consolidacao?.totalImpostoDevido),
    consolidacaoIrFonteDayTradeMesesAnteriores: somarCampo(ultimos, m => m.consolidacao?.irFonteDayTradeMesesAnteriores),
    consolidacaoIrFonteDayTradeACompensar: somarCampo(ultimos, m => m.consolidacao?.irFonteDayTradeCompensar),
    irFonteLei11033Ano: somarCampo(mensal, m => m.consolidacao?.irFonteLei11033Mes),
    consolidacaoImpostoAPagar: somarCampo(mensal, m => m.consolidacao?.impostoPagar),
    origem: 'pdf',
    derivadoDosMeses: true,
  };
};

const consolidarFiiFiagroAnualPdf = (mensal) => {
  if (mensal.length === 0) return null;
  const ultimos = ultimosPorBeneficiario(mensal);
  return {
    resultadoLiquido: somarCampo(mensal, m => m.resultadoLiquidoMes),
    resultadoNegativoMesAnterior: somarCampo(ultimos, m => m.resultadoNegativoMesAnterior),
    baseCalculoImposto: somarCampo(mensal, m => m.baseCalculoImposto),
    prejuizoCompensar: somarCampo(ultimos, m => m.prejuizoCompensar),
    impostoDevido: somarCampo(mensal, m => m.impostoDevido),
    impostoAPagar: somarCampo(mensal, m => m.impostoAPagar),
    impostoRetidoLei11033: somarCampo(mensal, m => m.impostoRetidoNoMes),
    origem: 'pdf',
    derivadoDosMeses: true,
  };
};

// Divide a linha entre o rótulo (texto à esquerda) e os valores numéricos,
// preservando a ordem: numa linha de duas colunas o primeiro valor é sempre
// "OPERAÇÕES COMUNS" e o segundo "OPERAÇÕES DAY-TRADE".
//
// Deliberadamente NÃO usa makeColumnPicker aqui: nesta ficha os valores são
// impressos alinhados à DIREITA (o x de início muda com a largura do número,
// "0,00" sai em x≈421 e "99.811,07" em x≈401) enquanto os títulos das colunas
// são alinhados à esquerda (x≈348 e x≈468). Bucketar pelo x de início com essas
// âncoras jogaria "0,00" da coluna comum na coluna de day-trade. A ordem das
// células, que buildRows já garante da esquerda para a direita, é estável.
const separarRotuloEValores = (row, extraValorRe = null) => {
  const rotuloPartes = [];
  const valores = [];
  for (const c of row.cells) {
    const t = c.text.trim();
    if (RV_VALOR.test(t) || (extraValorRe && extraValorRe.test(t))) valores.push(t);
    else rotuloPartes.push(t);
  }
  return { rotulo: normSpace(rotuloPartes.join(' ')), valores };
};
const rvSepararLinha = (row) => separarRotuloEValores(row, RV_ALIQUOTA);

// ---------------------------------------------------------------------------
// Rendimentos Tributáveis Recebidos de Pessoa Jurídica (fichas do TITULAR e
// dos DEPENDENTES), lidas só pelo caminho PDF.
//
// Sem essa ficha, importar por PDF deixava "Tributáveis Recebidos de P.J." e o
// "Total Geral dos Rendimentos" zerados no Demonstrativo, mesmo com a
// declaração cheia de rendimento — o app avisava disso, mas o número
// continuava faltando.
//
// Layout (confirmado nas duas declarações de referência, com âncoras de coluna
// diferentes entre elas): uma linha de item com o nome da fonte à esquerda e
// EXATAMENTE 5 valores à direita, na ordem impressa no cabeçalho; o nome pode
// continuar em linhas seguintes; e uma linha "CNPJ/CPF:" fecha o item, trazendo
// o CNPJ da fonte e, na ficha dos dependentes, também o CPF do dependente. A
// tabela atravessa páginas (no segundo contribuinte ela começa na página 1 e
// termina na 2) e fecha em "TOTAL".
const RPJ_COLUNAS = ['valor', 'contribuicaoPrevidenciaria', 'irrf', 'decimoTerceiro', 'irrfDecimoTerceiro'];
// A linha que só existe na declaração de saída definitiva, dentro da ficha de
// rendimentos de pessoa jurídica (SAI-01 p1 r35).
const RPJ_COMUNICACAO_NAO_RESIDENTE = /Data da comunica[çc][ãa]o da condi[çc][ãa]o de n[ãa]o residente [àa] fonte pagadora:\s*(\d{2}\/\d{2}\/\d{4})/i;
const RPJ_TITULO = /^RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOAS? JURÍDICAS? PEL(O TITULAR|OS DEPENDENTES)$/;
const RPJ_CABECALHO = 'NOME DA FONTE PAGADORA';
const RPJ_CPF_DEPENDENTE = /^CPF DO DEPENDENTE:$/;
const RPJ_DOC = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// ---------------------------------------------------------------------------
// Rendimentos Isentos e Não Tributáveis / Sujeitos à Tributação Exclusiva ou
// Definitiva. As duas fichas têm layout idêntico e são tratadas pelo mesmo
// código, mudando só a categoria do `tipo` gerado.
//
// ARMADILHA CENTRAL DESTA FICHA, e a razão de ela ser mais delicada que as
// outras: cada código aparece DUAS vezes. Primeiro como uma linha AGREGADA
// ("09. Lucros e dividendos recebidos ... 9.542.194,93") e logo abaixo como uma
// sub-tabela DETALHADA por fonte pagadora, cujos valores somam exatamente o
// agregado (conferido: 102.194,93 + 3.920.000,00 + 3.920.000,00 + 1.600.000,00
// = 9.542.194,93). Ler as duas duplicaria o rendimento inteiro da declaração.
//
// A escolha aqui é ficar com o DETALHE, que é mais rico (beneficiário, CPF,
// CNPJ e nome da fonte, que o `.DBK` não traz de jeito nenhum), e usar o
// agregado como CONFERÊNCIA: se a soma do detalhe não bater com ele, o import
// avisa em vez de calar. Código que aparece só como agregado, sem sub-tabela
// (é o caso de "08. 13º salário recebido pelos dependentes"), entra pelo
// agregado mesmo, senão o valor se perderia.
//
// O `tipo` gerado é o mesmo do `.DBK` (`isento_0009`, `exclusivo_0006`), com o
// código em 4 dígitos, para que as duas origens sejam somadas pelos mesmos
// filtros em demonstrativos.js.
//
// A DIVERGÊNCIA DE CÓDIGO ENTRE OS DOIS FORMATOS, RESOLVIDA EM 24/08/2026.
//
// O `.DBK` e o PDF usam numerações DIFERENTES para os mesmos rendimentos, e
// nenhum dos dois está errado: o arquivo grava o CÓDIGO INTERNO do rendimento,
// e a ficha impressa numera as LINHAS da tela. As duas coincidem até certo
// ponto e depois divergem, porque rendimentos novos (Lei 14.754/2023 e prêmios
// de loteria da Lei 14.790/2023) foram inseridos e a ficha impressa renumerou.
//
// A tabela de-para está na classe `CadastroTabelasIRPF` do
// `irpf-negocio-declaracao.jar`, onde cada código interno aparece pareado com o
// rótulo da tela: `TIPO_RENDEXCLUSIVO_13` com `TIPO_RENDEXCLUSIVO_LEI14754_TELA`,
// `TIPO_RENDEXCLUSIVO_14` com `TIPO_RENDEXCLUSIVO_PREMIO_LOTERICA_TELA`,
// `TIPO_RENDEXCLUSIVO_12` com `TIPO_RENDEXCLUSIVO_OUTROS_TELA`, e o mesmo para
// `TIPO_RENDISENTO_26` com `TIPO_RENDISENTO_OUTROS_TELA`.
//
// Confirmado no dado real: o `.DBK` grava a Lei 14.754 como 0013, e o PDF da
// MESMA declaração imprime essa linha como "12."
//
// Este parser passa a converter o número IMPRESSO para o CÓDIGO INTERNO, que é
// o que o `.DBK` usa — assim os dois caminhos produzem o mesmo `tipo`, e o
// rótulo exibido deixa de depender de qual arquivo a pessoa importou.
const CODIGO_TELA_PARA_ARQUIVO = {
  exclusivo: { 12: '0013', 13: '0014', 99: '0012' },
  isento: { 99: '0026' },
};
const codigoInterno = (categoria, numeroImpresso) => {
  const n = parseInt(numeroImpresso, 10);
  return (CODIGO_TELA_PARA_ARQUIVO[categoria] || {})[n] || String(numeroImpresso).padStart(4, '0');
};

// (registro histórico) A divergência antes de ser resolvida, confirmada no manual
// oficial (AjudaIRPF-new.pdf, página 79, ficha "Rendimentos Sujeitos à
// Tributação Exclusiva/Definitiva"):
//   12 - Aplicações Financeiras e Lucros e Dividendos no Exterior (Lei 14.754/2023)
//   13 - Prêmios líquidos obtidos em loterias de apostas de quota fixa (Lei 14.790/2023)
// São dois códigos distintos. O PDF imprime o número certo nos dois casos (um
// dos contribuintes de referência tem o 12, o outro tem o 13, e cada um bate
// com o texto do manual). O `.DBK`, porém, grava o rendimento da Lei 14.754
// com código 0013 — conferido no declarante que tem os dois arquivos, onde o
// mesmo valor de 1.822.059,55 sai como `exclusivo_0012` pelo PDF e
// `exclusivo_0013` pelo `.DBK`.
//
// Nada é remapeado aqui de propósito: existe UM caso observado, não dá para
// deduzir a tabela de tradução do `.DBK` inteira a partir dele, e chutar um
// "de-para" produziria classificação errada com cara de certa. O impacto é
// só de RÓTULO: todos os somatórios do app agrupam por `isento`/`exclusivo`
// (ver categoriaRendimento e demonstrativos.js), nunca por código específico,
// então nenhum total muda. Quando aparecer um segundo `.DBK` com prêmios de
// loteria de verdade, dá para fechar a questão.
// ---------------------------------------------------------------------------
// Ficha DEPENDENTES. Mesmo formato de saída do registro 25 do `.DBK`
// (`{nome, cpf, dataNascimento, parentesco}`), com o código de parentesco cru,
// não traduzido, exatamente como o outro caminho já entrega.
//
// O título é a palavra "DEPENDENTES" sozinha numa célula. Isso NÃO colide com
// as várias fichas cujo nome termina em "PELOS DEPENDENTES" (rendimentos de
// PJ, de pessoa física, renda variável), porque a comparação é da célula
// inteira e não de um pedaço dela.
const DEP_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const DEP_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
// Linhas de campo do formulário que aparecem no meio da ficha e não são item.
const DEP_RUIDO = /^(Email\s*:|Celular\s*:|Raça\/Cor:|Dependente mora com o titular)/;

// ---------------------------------------------------------------------------
// Páginas RESUMO e EVOLUÇÃO PATRIMONIAL, que alimentam `impostoDevido` — os
// números OFICIAIS da declaração, calculados pelo próprio programa da Receita.
// Pelo `.DBK` eles vêm do registro 20; aqui vêm das duas últimas páginas.
//
// A página RESUMO tem DUAS COLUNAS lado a lado na metade de baixo (à esquerda
// "IMPOSTO DEVIDO" e "IMPOSTO PAGO", à direita "IMPOSTO A RESTITUIR", "SALDO DE
// IMPOSTO A PAGAR" e "PARCELAMENTO"), e uma mesma linha visual mistura as duas:
//
//   "Base de cálculo do imposto" 19.012,76 "SALDO DE IMPOSTO A PAGAR" 272.534,15
//
// Pegar "o último valor da linha" daria 272.534,15 para a base de cálculo. Por
// isso cada valor é ligado ao rótulo imediatamente à ESQUERDA dele, o que
// resolve as duas colunas e continua valendo para as linhas de largura total
// do topo da página.
const paresRotuloValor = (row) => {
  const pares = [];
  let rotulo = null;
  for (const c of row.cells) {
    const t = c.text.trim();
    if (!t) continue;
    if (RV_VALOR.test(t)) {
      if (rotulo) pares.push({ rotulo, valor: parseMoneyBR(t) });
    } else {
      rotulo = normSpace(rotulo && !/[:?]$/.test(rotulo) && c.x < 40 ? `${rotulo} ${t}` : t);
    }
  }
  return pares;
};
// Rótulo exato -> campo de `impostoDevido`. Só entram rótulos que identificam o
// campo sem ambiguidade; "TOTAL", que aparece uma vez em RENDIMENTOS e outra em
// DEDUÇÕES, é resolvido pelo bloco corrente (ver o handler).
const RESUMO_CAMPOS = {
  // Bloco RENDIMENTOS TRIBUTÁVEIS (resumo-03).
  'Recebidos de Pessoa Jurídica pelo titular': 'rendimentosPjTitular',
  'Recebidos de Pessoa Jurídica pelos dependentes': 'rendimentosPjDependentes',
  'Recebidos de Pessoa Física/Exterior pelo titular': 'rendimentosPfExteriorTitular',
  'Recebidos de Pessoa Física/Exterior pelos dependentes': 'rendimentosPfExteriorDependentes',
  'Recebidos acumuladamente pelo titular': 'rendimentosAcumuladosTitular',
  'Recebidos acumuladamente pelos dependentes': 'rendimentosAcumuladosDependentes',
  'Resultado tributável da Atividade Rural': 'resultadoTributavelRural',
  // Bloco DEDUÇÕES (resumo-04).
  'Contribuição à previdência oficial (Rendimentos recebidos acumuladamente)': 'previdenciaOficialRRA',
  'Dependentes': 'dependentes',
  'Despesas com instrução': 'despesasInstrucao',
  'Despesas médicas': 'despesasMedicas',
  'Pensão alimentícia judicial': 'pensaoJudicial',
  'Pensão alimentícia por escritura pública': 'pensaoEscritura',
  'Pensão alimentícia judicial (Rendimentos recebidos acumuladamente)': 'pensaoJudicialRRA',
  'Livro caixa': 'livroCaixa',
  // Bloco IMPOSTO DEVIDO (resumo-05).
  'Base de cálculo do imposto': 'baseCalculo',
  'Imposto devido': 'impostoDevidoBruto',
  'Dedução de incentivo': 'deducaoIncentivo',
  'Imposto devido I': 'impostoDevidoI',
  'Imposto devido RRA': 'impostoDevidoRRA',
  'Aliquota efetiva (%)': 'aliquotaEfetiva',
  'Total do imposto devido': 'impostoDevidoTotal',
  'SALDO DE IMPOSTO A PAGAR': 'saldoPagar',
  'Imposto Lei 14.754/2023': 'lei14754Imposto',
  'Valor da quota': 'valorQuota',
  // Bloco IMPOSTO PAGO (resumo-06).
  'Imposto retido na fonte do titular': 'irrfTitular',
  'Imp. retido na fonte dos dependentes': 'irrfDependentes',
  'Carnê-Leão do titular': 'carneLeaoTitular',
  'Carnê-Leão dos dependentes': 'carneLeaoDependentes',
  'Imposto complementar': 'impostoComplementar',
  'Imposto pago no exterior': 'impostoPagoExterior',
  'Imposto retido na fonte (Lei nº 11.033/2004)': 'irFonteLei11033Pago',
  'Imposto retido RRA': 'irrfRRA',
  'Total do imposto pago': 'impostoPagoTotal',
  // Bloco OUTRAS INFORMAÇÕES da Evolução Patrimonial (resumo-08).
  'Rendimentos isentos e não tributáveis': 'rendimentosIsentosOficial',
  'Rendimentos sujeitos à tributação exclusiva/definitiva': 'rendimentosExclusivoOficial',
  'Rendimentos tributáveis - imposto com exigibilidade suspensa': 'rendimentosExigibilidadeSuspensa',
  'Depósitos judiciais do imposto': 'depositosJudiciais',
  'Imposto pago sobre Ganhos de Capital': 'impostoPagoGanhosCapital',
  'Imposto pago sobre Renda Variável': 'impostoPagoRendaVariavel',
  'Doações a Partidos Políticos e Candidatos a Cargos Eletivos': 'doacoesPartidosOficial',
  'Imposto diferido dos Ganhos de Capital': 'impostoDiferidoGanhosCapital',
  'Imposto devido sobre Ganhos de Capital': 'impostoDevidoGanhosCapital',
  'Imposto devido sobre ganhos líquidos em Renda Variável': 'impostoDevidoRendaVariavel',
};
// Rótulos que quebram em duas linhas visuais e cuja PRIMEIRA linha é o que
// `paresRotuloValor` entrega. Casados por prefixo. Mantidos fora do mapa exato
// porque não têm forma canônica curta.
const RESUMO_CAMPOS_PREFIXO = [
  ['Contribuições às previdências oficial', 'previdenciaOficialComplementar'],
  ['Contribuição à prev. complementar', 'previdenciaComplementar'],
  ['Imposto pago Ganhos de Capital Moeda Estrangeira', 'impostoPagoGanhosCapitalMoeda'],
  ['Total do imposto retido na fonte (Lei nº11.033/2004)', 'irFonteLei11033Ano'],
  ['Imposto a pagar sobre o Ganho de Capital - Moeda Estrangeira', 'impostoPagarGanhosCapitalMoeda'],
  ['Imposto devido sobre Ganhos de Capital Moeda Estrangeira', 'impostoDevidoGanhosCapitalMoeda'],
];
// Evolução Patrimonial: cada par é anterior/atual, na ordem impressa. O rótulo
// muda conforme o tipo de declaração — "em dd/mm/aaaa" no ajuste anual, "na
// data da partilha"/"valor da transferência" no espólio, "na data da
// caracterização da condição de não residente" na saída definitiva (resumo-02).
// Casar pelo início do rótulo e distinguir anterior/atual pela ORDEM cobre os
// três, sem depender do texto da data.
const RESUMO_EVOLUCAO = [
  [/^Bens e direitos\b/, ['bensAnteriorOficial', 'bensAtualOficial']],
  [/^Dívidas e ônus reais\b/, ['dividasAnteriorOficial', 'dividasAtualOficial']],
];

// ---------------------------------------------------------------------------
// "Demonstrativo da Apuração do Ganho de Capital", uma PÁGINA por operação.
// Mesmo formato de saída dos registros 62/65/69 do `.DBK`.
//
// Esta ficha é diferente de todas as outras do PDF num ponto que muda o
// parsing: na maior parte dela o valor NÃO está na linha do rótulo, e sim na
// linha de baixo, com dois campos por par de rótulos —
//
//   "Data de aquisição"      "Custo de Aquisição R$"
//   "20/07/2023"             "341.890,00"
//
// Só o bloco final, "APURAÇÃO DO GANHO DE CAPITAL", traz rótulo e valor na
// mesma linha. Por isso os rótulos de par olham a linha seguinte (`rows[ri+1]`)
// e os do bloco final olham a própria linha.
// Atividade Rural pelo PDF. As fichas "RECEITAS E DESPESAS - BRASIL" e
// "APURAÇÃO DO RESULTADO - BRASIL" ficam na mesma página, uma embaixo da outra.
//
// Diferente do `.DBK`, aqui cada valor vem com o RÓTULO impresso ao lado, o que
// torna este o caminho confiável para nomear os campos — e foi o que revelou
// três nomes errados no registro 52 (ver o comentário lá).
const AR_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const AR_APURACAO_CAMPOS = {
  'Saldo de prejuízo(s) a compensar de exercício(s) anterior(es)': 'saldoPrejuizoExercicioAnterior',
  'Receita bruta total': 'receitaBrutaTotal',
  'Despesa de custeio e investimento total': 'despesaTotal',
  'Resultado': 'resultado',
  'Limite de 20% sobre a receita bruta total': 'limite20PctReceitaBruta',
  'Compensação de prejuízo(s) de exercício(s) anterior(es)': 'compensacaoPrejuizoAnterior',
  'RESULTADO TRIBUTÁVEL': 'resultadoTributavel',
  'Saldo de prejuízo(s) a compensar': 'saldoPrejuizoExercicioSeguinte',
  'RESULTADO NÃO TRIBUTÁVEL': 'resultadoNaoTributavel',
};
// Rótulos longos demais para casar por igualdade sem risco de quebra de linha.
const AR_ADIANTAMENTO_ANO = /^Adiantamento\(s\) recebido\(s\) em \d{4} por conta de venda para entrega futura$/;
const AR_ADIANTAMENTO_ANTERIOR = /^Adiantamento\(s\) recebido\(s\) até \d{4}/;

// MOVIMENTAÇÃO DO REBANHO: as espécies são fixas e vêm nesta ordem impressa,
// que é a mesma do código do `.DBK` (só o 01, Bovinos, tem valor não-zero no
// arquivo de referência para confirmar o casamento).
const AR_ESPECIES = [
  [/^Bovinos e bufalinos/, '01'],
  [/^Suínos/, '02'],
  [/^Caprinos e ovinos/, '03'],
  [/^Asininos, equinos/, '04'],
  [/^Outros$/, '05'],
];
// Colunas do rebanho, na ordem do cabeçalho impresso. É esta ordem que faz a
// equação da ficha fechar (ver a correção do registro 53 em parseDBK).
const AR_REBANHO_COLUNAS = ['estoqueInicial', 'aquisicoes', 'nascimentos', 'consumoPerdas', 'vendas', 'estoqueFinal'];
// Linha de imóvel explorado: começa com o código da atividade (2 dígitos) e traz
// participação, condição de exploração, nome/localização, área e CIB.
const AR_CIB = /^\d{7}-\d$/;
const AR_PARTICIPANTE = /^(.+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)$/;

// ---------------------------------------------------------------------------
// REDE DE SEGURANÇA CONTRA FICHA DESCONHECIDA.
//
// Os gatilhos deste parser reconhecem as fichas que já foram mapeadas. O risco
// para uma declaração QUALQUER está no que NÃO foi mapeado: uma ficha que este
// código não conhece não abre seção nenhuma, e a seção anterior segue aberta
// engolindo as linhas dela como se fossem suas.
//
// Levantamento de 23/08/2026 sobre as duas declarações de referência: existem
// fichas que hoje não são lidas e que, se tivessem dado, cairiam dentro da
// seção anterior — a Atividade Rural no EXTERIOR inteira (imóveis, bens,
// dívidas, receitas/despesas, apuração e rebanho, cada uma com a irmã
// "- EXTERIOR"), os rendimentos com IMPOSTO COM EXIGIBILIDADE SUSPENSA, os
// RECEBIDOS ACUMULADAMENTE e os de PESSOA FÍSICA E DO EXTERIOR. Nas duas
// declarações disponíveis todas estão "Sem Informações", então o defeito é
// invisível aqui — exatamente como foi o das doações ECA/Pessoa Idosa, que
// passou meses despercebido pelo mesmo motivo.
//
// A proteção é genérica em vez de uma lista de títulos: toda linha que TEM
// CARA DE TÍTULO DE FICHA (uma única célula, encostada na margem esquerda, em
// caixa alta) e que nenhum gatilho reconheceu FECHA a seção corrente. Assim o
// pior caso de uma ficha nova deixa de ser "dado errado no lugar errado" e
// passa a ser "dado não importado", que é honesto e visível.
// A primeira tentativa foi uma heurística visual (célula única, na margem, em
// caixa alta). Ela não serve: as CONTINUAÇÕES de nome de fonte pagadora e de
// discriminação de bem têm exatamente essa forma ("PREVIDENCIA SOCIAL",
// "E COMERCIO LTDA", "INVESTIMENTOS S/A") e fechavam seções legítimas — 13
// testes reais quebraram na hora, o que é a própria prova de que o critério era
// frouxo. Sem informação de fonte ou de estilo, que o extrator de texto não
// entrega, título e continuação são indistinguíveis por forma.
//
// Então a rede é uma LISTA EXPLÍCITA das fichas que existem nas declarações e
// que este parser NÃO lê. Não protege contra uma ficha inventada num exercício
// futuro, mas resolve o risco concreto e verificado de hoje, sem inventar
// comportamento. Levantada varrendo os títulos das duas declarações de
// referência e conferindo um a um contra os gatilhos existentes.
const FICHAS_NAO_LIDAS = [
  // Atividade Rural no EXTERIOR: cada subparte tem a irmã "- BRASIL", que é
  // lida. As do exterior estão "Sem Informações" nos dois arquivos, e sem elas
  // aqui o conteúdo cairia na seção rural brasileira aberta logo antes.
  'DEMONSTRATIVO DE ATIVIDADE RURAL - EXTERIOR',
  'DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - EXTERIOR',
  'BENS DA ATIVIDADE RURAL - EXTERIOR',
  'DÍVIDAS VINCULADAS À ATIVIDADE RURAL - EXTERIOR',
  'RECEITAS E DESPESAS - EXTERIOR',
  'APURAÇÃO DO RESULTADO - EXTERIOR',
  'MOVIMENTAÇÃO DO REBANHO - EXTERIOR',
  // Rendimentos que o app não modela. Estes SÃO redundantes hoje: o bloco de
  // fechamento genérico logo abaixo já casa qualquer título que comece com
  // "RENDIMENTOS" (conferido: removendo esta lista, o teste da ficha com
  // exigibilidade suspensa continua passando). Ficam aqui mesmo assim, por
  // serem explícitos: quem ler esta lista sabe QUAIS fichas de rendimento a
  // declaração tem e o app não lê, sem precisar deduzir de um regex de prefixo.
  // As do bloco acima, da Atividade Rural no exterior, NÃO são redundantes —
  // nenhuma delas começa com uma das palavras daquele regex, e é a lista que
  // as segura (provado pelo teste do rebanho do exterior).
  'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM EXIGIBILIDADE SUSPENSA)',
  // A irmã dos DEPENDENTES faltava aqui: existia só em FICHAS_NAO_LIDAS_PREFIXO,
  // e por isso o título completo (que é como SAI-01 imprime a do titular)
  // nunca casava por igualdade. Achado na auditoria de 31/08/2026.
  'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE SUSPENSA)',
  'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR',
  'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS DEPENDENTES',
  'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELO TITULAR',
  'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELOS DEPENDENTES',
  'RENDIMENTOS SUJEITOS À TRIBUTAÇÃO DEFINITIVA',
  'IMPOSTO PAGO / RETIDO',
];
// Destas, as que NÃO merecem aviso mesmo vindo preenchidas, porque o app já tem
// o conteúdo delas por outro caminho. Avisar aqui mandaria a pessoa conferir um
// dado que está na tela, o que gasta a confiança no aviso: um alerta que grita
// à toa deixa de ser lido quando gritar por um motivo real.
//
// "IMPOSTO PAGO / RETIDO" detalha o imposto retido, pago no exterior e o
// carnê-leão. Todos esses valores entram pela página RESUMO, que é lida
// (`impostoDevido.impostoPagoTotal` e companhia) — conferido nas duas
// declarações de referência.
const FICHAS_NAO_LIDAS_SEM_AVISO = ['IMPOSTO PAGO / RETIDO'];
// O título da ficha de dependentes com exigibilidade suspensa quebra em duas
// linhas no formulário, então o começo dele basta.
const FICHAS_NAO_LIDAS_PREFIXO = [
  'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE',
];
// Quantas linhas visuais adiante procurar o RABO de um título quebrado.
// Precisa ser 2, não 1: em AJU-01 p6 o "(Valores em Reais)" cai numa row
// PRÓPRIA entre as duas metades do título ("...(IMPOSTO COM" em r14,
// "(Valores em Reais)" em r15, "EXIGIBILIDADE SUSPENSA)" em r16), porque o
// formulário o desenha 3 unidades fora da base do título, acima da tolerância
// de 2 de buildRows.
const LINHAS_DE_EMENDA_DE_TITULO = 2;
// Textos que podem fechar um título começado na linha `ri`, cada um com o
// índice da linha de onde veio.
const rabosDeTitulo = (rows, ri) => {
  const candidatos = [];
  for (let salto = 1; salto <= LINHAS_DE_EMENDA_DE_TITULO; salto++) {
    const proxima = rows[ri + salto];
    if (!proxima) break;
    for (const c of proxima.cells) candidatos.push({ texto: c.text, linha: ri + salto });
  }
  return candidatos;
};

const nomeDeFichaNaoLidaExata = (t) => {
  if (FICHAS_NAO_LIDAS.includes(t)) return t;
  return FICHAS_NAO_LIDAS_PREFIXO.find(p => t.startsWith(p)) || null;
};
// `t` é o COMEÇO de um título de ficha não lida que o formulário cortou?
const ehComecoDeFichaNaoLida = (t) => t.length >= 24 && (
  FICHAS_NAO_LIDAS.some(f => f.length > t.length && f.startsWith(t))
  || FICHAS_NAO_LIDAS_PREFIXO.some(p => p.length > t.length && p.startsWith(t))
);
// Segundo argumento: a linha visual SEGUINTE. O formulário quebra o título em
// duas linhas quando ele não cabe, e o ponto do corte muda de declaração para
// declaração — AJU-01 corta a ficha de exigibilidade suspensa dos dependentes
// em "(IMPOSTO COM", ESP-01 e SAI-01 cortam a mesma ficha em "(IMPOSTO COM
// EXIGIBILIDADE". Uma lista de prefixos fixos só cobre um dos cortes; emendar a
// linha seguinte não depende de onde o corte caiu.
//
// Enquanto isto não existia, três fichas de rendimento vinham PREENCHIDAS no
// AJU-01 e sumiam sem aviso nenhum, porque o fechamento genérico logo abaixo
// (`/^RENDIMENTOS/`) matava a seção antes de alguém perceber que havia dado ali
// (auditoria de 31/08/2026).
const nomeDaFichaNaoLida = (row, rabos = []) => {
  for (const c of row.cells) {
    const t = normSpace(c.text);
    const direto = nomeDeFichaNaoLidaExata(t);
    if (direto) return { nome: direto, linhaConsumida: -1 };
    if (ehComecoDeFichaNaoLida(t)) {
      for (const rabo of rabos) {
        const emendado = nomeDeFichaNaoLidaExata(normSpace(`${t} ${rabo.texto}`));
        if (emendado) return { nome: emendado, linhaConsumida: rabo.linha };
      }
    }
  }
  return null;
};

const GC_TITULO = /^Demonstrativo da Apuração do Ganho de Capital(?:\s*-\s*(.+))?$/;
const GC_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const GC_DOC = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
// As QUATRO fichas do menu "Ganhos de Capital" do programa da Receita. Cada
// uma imprime o próprio demonstrativo, com o tipo no título; antes desta
// versão o parser tratava todas como se fossem bem móvel, que é o único caso
// presente nas declarações de referência.
const GC_TIPO_POR_TITULO = {
  'BENS IMÓVEIS': 'imovel',
  'BENS MÓVEIS': 'movel',
  'PARTICIPAÇÃO SOCIETÁRIA': 'participacao',
  'PARTICIPAÇÕES SOCIETÁRIAS': 'participacao',
  'MOEDAS EM ESPÉCIE': 'moeda',
};
// Percentual impresso com 6 casas ("15,000000") — alíquota média e os fatores
// de redução. Fora deste formato o texto não é percentual.
const GC_PERCENTUAL = /^-?[\d.]*\d,\d{6}$/;
// Meses como a totalização de moeda em espécie e a ficha de FII os imprimem.
// Quadros internos do demonstrativo de Ganho de Capital cujo título colide com
// o de uma ficha da declaração.
const GC_QUADROS_INTERNOS = /^(RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS|RENDIMENTOS SUJEITOS À TRIBUTAÇÃO DEFINITIVA)$/;
const GC_MOEDA_MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
// Linhas da ficha de FII/Fiagro, na ordem impressa, com o campo de destino.
const FII_LINHAS = [
  ['RESULTADO LÍQUIDO DO MÊS', 'resultadoLiquidoMes'],
  ['RESULTADO NEGATIVO ATÉ O MÊS ANTERIOR', 'resultadoNegativoMesAnterior'],
  ['BASE DE CÁLCULO DO IMPOSTO', 'baseCalculoImposto'],
  ['PREJUÍZO A COMPENSAR', 'prejuizoCompensar'],
  ['ALÍQUOTA DO IMPOSTO', 'aliquota'],
  ['IMPOSTO DEVIDO', 'impostoDevido'],
  ['IMPOSTO RETIDO MESES ANTERIORES', 'impostoRetidoMesesAnteriores'],
  ['IMPOSTO RETIDO NO MÊS', 'impostoRetidoNoMes'],
  ['IMPOSTO A COMPENSAR', 'impostoACompensar'],
  ['IMPOSTO A PAGAR', 'impostoAPagar'],
  ['IMPOSTO PAGO', 'impostoPago'],
];
const FII_LINHAS_MAP = new Map(FII_LINHAS);
// Cabeçalhos que trocam o bloco corrente dentro da ficha. Sem isso, rótulos
// repetidos entre blocos (o "Total" aparece quatro vezes: consolidação do bem,
// imposto pago, rendimentos isentos e rendimentos de tributação definitiva)
// cairiam todos no mesmo campo, e o último a ser lido venceria.
const GC_BLOCOS = [
  [/^DADOS DO (IM[ÓO]VEL|M[ÓO]VEL)$/, 'dadosBem'],
  [/^DADOS DA PARTICIPAÇÃO SOCIETÁRIA$/, 'dadosBem'],
  [/^DADOS DA AQUISIÇÃO$/, 'aquisicao'],
  [/^DADOS DA OPERAÇÃO$/, 'operacao'],
  [/^PERGUNTAS$/, 'perguntas'],
  [/^APURAÇÃO DO CUSTO DE AQUISIÇÃO$/, 'custoAquisicao'],
  [/^APURAÇÃO D[EO] GANHOS? (DE CAPITAL)?$/, 'apuracao'],
  [/^APURAÇÃO DOS GANHOS DE CAPITAL$/, 'apuracao'],
  [/^CÁLCULO DO IMPOSTO - ALIENAÇÃO À VISTA$/, 'calculoVista'],
  [/^CÁLCULO DO IMPOSTO - ALIENAÇÃO A PRAZO$/, 'calculoPrazo'],
  [/^CÁLCULO DO IMPOSTO - ALIENAÇÃO A PRAZO - DETALHE DAS PARCELAS$/, 'parcelasDetalhe'],
  [/^CONSOLIDAÇÃO DO BEM$/, 'consolidacao'],
  [/^CONSOLIDAÇÃO DA PARTICIPAÇÃO SOCIETÁRIA$/, 'consolidacao'],
  // gc-09: o quadro "CUSTO DE AQUISIÇÃO" da participação (espécie, quantidade,
  // custo médio, custo total). Distinto de "APURAÇÃO DO CUSTO DE AQUISIÇÃO".
  [/^CUSTO DE AQUISIÇÃO$/, 'custoAquisicaoParticipacao'],
  [/^IMPOSTO PAGO$/, 'impostoPagoBloco'],
  [/^RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS$/, 'isentos'],
  [/^RENDIMENTOS SUJEITOS À TRIBUTAÇÃO DEFINITIVA$/, 'definitiva'],
  [/^ADQUIRENTE$/, 'adquirente'],
  [/^Faixa de Ganho de Capital$/, 'faixas'],
];
// Rótulo (já normalizado) -> destino, POR BLOCO. Valor na mesma linha visual do
// rótulo, que é como o formulário imprime estes quadros.
const GC_ROTULOS = {
  apuracao: {
    'Valor de alienação': 'apuracao.valorAlienacao',
    'Custo de corretagem': 'apuracao.custoCorretagem',
    'Custo de Corretagem': 'apuracao.custoCorretagem',
    'Valor líquido de alienação': 'apuracao.valorLiquido',
    'Valor Líquido de Alienação': 'apuracao.valorLiquido',
    'Custo de aquisição': 'apuracao.custoAquisicao',
    'Custo de Aquisição': 'apuracao.custoAquisicao',
    'Ganho de Capital': 'apuracao.ganhoCapital',
    'Ganhos de Capital': 'apuracao.ganhoCapital',
    'Valor de Alienação': 'apuracao.valorAlienacao',
    // gc-06: o quadro do IMÓVEL usa "da Alienação" (com "da"), não "de".
    'Valor da Alienação': 'apuracao.valorAlienacao',
    'Valor Líquido da Alienação': 'apuracao.valorLiquido',
    // gc-07: os cinco "Resultado" e as reduções da Lei 7.713/1988 e da Lei
    // 11.196/2005. Antes colidiam num campo só por casamento de prefixo.
    'Ganho de Capital - Resultado 1': 'apuracao.resultado1',
    'Ganho de Capital - Resultado 2': 'apuracao.resultado2',
    'Ganhos de Capital - Resultado 3': 'apuracao.resultado3',
    'Ganhos de Capital - Resultado 4': 'apuracao.resultado4',
    'Ganhos de Capital - Resultado 5': 'apuracao.resultado5',
    'Percentual de Redução (Lei n. 7.713, de 1988)': 'apuracao.percentualReducao7713',
    'Valor de Redução (Lei n. 7.713, de 1988)': 'apuracao.valorReducao7713',
    'Percentual de Redução (Lei n. 11.196, de 2005 - FR1)': 'apuracao.percentualReducaoFR1',
    'Valor de Redução (Lei n. 11.196, de 2005 - FR1)': 'apuracao.valorReducaoFR1',
    'Percentual de Redução (Lei n. 11.196, de 2005 - FR2)': 'apuracao.percentualReducaoFR2',
    'Valor de Redução (Lei n. 11.196, de 2005 - FR2)': 'apuracao.valorReducaoFR2',
    'Percentual de Redução - Aplicação Outro Imóvel': 'apuracao.percentualReducaoOutroImovel',
    'Valor de Redução - Aplicação Outro Imóvel': 'apuracao.valorReducaoOutroImovel',
  },
  calculoVista: {
    'Ganho de Capital Total': 'calculoImposto.ganhoCapitalTotal',
    'Ganho de Capital': 'calculoImposto.ganhoCapitalTotal',
    'Alíquota Média': 'calculoImposto.aliquotaMedia',
    'Imposto Devido': 'calculoImposto.impostoDevido',
    'Imposto devido': 'calculoImposto.impostoDevido',
    'Imposto Pago': 'calculoImposto.impostoPago',
    'Imposto pago': 'calculoImposto.impostoPago',
    'Imposto de renda na fonte (Lei nº 11.033, de 2004)': 'calculoImposto.irFonteLei11033',
    'Imposto devido após compensação': 'calculoImposto.impostoDevidoAposCompensacao',
  },
  consolidacao: {
    'Diferido de anos anteriores': 'consolidacaoBem.impostoDiferidoAnosAnteriores',
    'Total': 'consolidacaoBem.impostoTotal',
    'Devido em': 'consolidacaoBem.impostoDevidoNoExercicio',
    'Referente à alienação em': 'consolidacaoBem.impostoDoExercicio',
    'Diferido para anos posteriores': 'consolidacaoBem.impostoDiferidoAnosPosteriores',
    'IR na fonte (Lei 11.033/2004)': 'consolidacaoBem.irFonteLei11033',
  },
  impostoPagoBloco: { 'Total': 'consolidacaoBem.impostoPago' },
  isentos: { 'Total': 'consolidacaoBem.rendimentoIsento' },
  definitiva: { 'Total': 'consolidacaoBem.rendimentoExclusivo' },
  // No quadro "ALIENAÇÃO A PRAZO" estes três rótulos aparecem sob o subtítulo
  // "Anos Anteriores": são o que já foi recebido em exercícios passados, não o
  // total das parcelas deste ano (esse vem da linha "Total" da tabela).
  calculoPrazo: {
    'Valor Recebido': 'calculoImposto.valorBrutoAnosAnteriores',
    'Custo de Corretagem': 'calculoImposto.corretagemAnosAnteriores',
    'Valor Líquido Recebido': 'calculoImposto.liquidoAnosAnteriores',
  },
};
// Rótulo -> destino para os pares em que o valor vem na linha DE BAIXO.
const GC_PARES_LINHA_SEGUINTE = {
  'Nome da sociedade': 'sociedade.nome',
  'CNPJ da sociedade': 'sociedade.cnpj',
  'Município': 'sociedade.municipio',
  'UF': 'sociedade.uf',
  'Espécie da participação': 'especie',
};
// Escreve num caminho aninhado ('apuracao.valorAlienacao'), criando o que
// faltar. Mantém o objeto de saída com a MESMA forma da leitura do .DBK, para
// as duas origens caírem nas mesmas telas sem tradução.
const gcSet = (obj, caminho, valor) => {
  const partes = caminho.split('.');
  let alvo = obj;
  for (let i = 0; i < partes.length - 1; i++) {
    if (!alvo[partes[i]]) alvo[partes[i]] = {};
    alvo = alvo[partes[i]];
  }
  alvo[partes[partes.length - 1]] = valor;
};
// "Ganho de Capital -  (R$)" e "Alíquota Média - (%)" são um staticText só na
// ficha de participação societária: tira o sufixo de unidade antes de casar.
const gcNormalizaRotulo = (t) => normSpace(t).replace(/\s*-?\s*\((R\$|%|US\$)\)\s*$/, '').replace(/:$/, '').trim();

// Ficha "DEMONSTRATIVO DE APURAÇÃO - LEI 14.754/2023": uma linha por bem, com
// as colunas Bem | Tipo | Ganho/Prejuízo | Imposto Devido | Imposto Pago
// Brasil/Exterior | Base de Cálculo | Saldo. Mesmo formato de saída do registro
// 37 do `.DBK`. A coluna de imposto pago vem impressa como "-" quando é zero,
// e não como "0,00" — daí o tratamento explícito do hífen.
const EXT_COLUNAS = ['ganhoPrejuizo', 'impostoDevido', 'impostoPagoBrasilExterior', 'baseCalculo', 'saldo'];
const EXT_TIPO = /^(AF|LD)$/;

const RIE_AGREGADA = /^(\d{1,2})\s*[.\-]\s*(.*)$/;
const RIE_BENEFICIARIO = /^(Titular|Dependente)$/;
const RIE_CPF = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
const RIE_CNPJ = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
// "CNPJ:  02.335.109/0001-05" na linha de metadados de um bem. Aceita o CPF
// no mesmo rótulo (bem cuja fonte é pessoa física), porque a ficha usa
// "CNPJ:" para os dois.
// "CNPJ:  02.335.109/0001-05" na coluna esquerda do bloco de um bem. O
// rótulo varia com o tipo: "CNPJ do Fundo:" num fundo de investimento,
// "CPF/CNPJ:" em outros, e é só "CPF:" quando a fonte é pessoa física. O
// número sai formatado ou em dígitos crus ("CNPJ:  00000000000", como a ficha
// imprime o CPF do devedor num empréstimo), por isso a captura é solta e quem
// valida é o comprimento em dígitos: 11 de CPF ou 14 de CNPJ, nada mais.
const BEM_CNPJ = /(?:CPF|CNPJ)[^:\d]{0,15}:\s*([\d./-]{11,20})/;
const BEM_CNPJ_SOLTO = /^([\d./-]{11,20})$/;
// Linha de país do bem: "105 - BRASIL", "249 - ESTADOS UNIDOS DA AMÉRICA".
// O código de 3 dígitos é o mesmo `localizacao` do registro 27 do .DBK.
const BEM_PAIS = /^(\d{3})\s*-\s*(.+)$/;
// Campos de identificação do bem impressos em linhas de metadados.
const BEM_INSCRICAO_MUNICIPAL = /^Inscri[çc][ãa]o Municipal(?:\s*\(IPTU\))?:\s*(.+)$/i;
const BEM_MATRICULA = /^Matr[íi]cula:\s*(.+)$/i;
const BEM_RENAVAM = /^RENAVAM:\s*(.+)$/i;
const cnpjDoBem = (bruto) => {
  const digitos = (bruto || '').replace(/\D/g, '');
  return (digitos.length === 11 || digitos.length === 14) ? digitos : '';
};

const fingerprintTextoPdf = (texto) => {
  const normalizado = normSpace(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalizado.length; i++) {
    hash ^= normalizado.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

// A primeira página do PDF traz a ficha de Identificação inteira. Até aqui o
// app guardava apenas nome e CPF, embora endereço, ocupação, cônjuge e dados
// cadastrais estivessem legíveis. A extração abaixo usa os próprios rótulos do
// formulário; o texto integral continua arquivado em `documentoFonte` como
// rede de segurança para qualquer rótulo futuro.
const simNaoTexto = (valor) => {
  const v = normSpace(valor).toUpperCase();
  if (v === 'SIM') return true;
  if (v === 'NÃO' || v === 'NAO') return false;
  return null;
};
const dataBrParaIso = (valor) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normSpace(valor));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};
const preencherIdentificacaoPdf = (textoPagina, contribuinte) => {
  const texto = normSpace(textoPagina);
  const valor = (re) => normSpace((re.exec(texto) || [])[1] || '');
  const nome = valor(/IDENTIFICAÇÃO DO CONTRIBUINTE\s+Nome:\s*(.*?)\s+CPF:/i);
  const cpf = valor(/IDENTIFICAÇÃO DO CONTRIBUINTE[\s\S]*?CPF:\s*(\d{3}\.\d{3}\.\d{3}-\d{2})/i).replace(/\D/g, '');
  if (nome) contribuinte.nome = nome;
  if (cpf) contribuinte.cpf = cpf;
  contribuinte.dataNascimento = dataBrParaIso(valor(/Data de Nascimento:\s*(\d{2}\/\d{2}\/\d{4})/i));
  contribuinte.racaCor = valor(/Raça\/Cor:\s*(.*?)\s+Possui cônjuge/i);
  contribuinte.possuiConjuge = simNaoTexto(valor(/Possui cônjuge ou companheiro\(a\)\?\s*(Sim|Não)/i));
  contribuinte.cpfConjuge = valor(/CPF do cônjuge ou companheiro\(a\):\s*([\d.-]+)/i).replace(/\D/g, '');
  contribuinte.retornoPais = simNaoTexto(valor(/Era residente no exterior e passou a ser residente no Brasil em \d{4}\?\s*(Sim|Não)/i));
  contribuinte.alteracaoDadosCadastrais = simNaoTexto(valor(/Houve alteração de dados cadastrais\?\s*(Sim|Não)/i));
  contribuinte.doencaDeficiencia = simNaoTexto(valor(/Há declarante ou dependente com doença grave ou deficiência física ou mental\?\s*(Sim|Não)/i));
  contribuinte.logradouro = valor(/Endereço:\s*(.*?)\s+Número:/i);
  contribuinte.numero = valor(/Número:\s*(.*?)\s+Complemento:/i);
  contribuinte.complemento = valor(/Complemento:\s*(.*?)\s+Bairro\/Distrito:/i);
  contribuinte.bairro = valor(/Bairro\/Distrito:\s*(.*?)\s+Município:/i);
  contribuinte.municipio = valor(/Município:\s*(.*?)\s+UF:/i);
  contribuinte.uf = valor(/UF:\s*([A-Z]{2})\s+CEP:/i);
  contribuinte.cep = valor(/CEP:\s*([\d-]+)/i);
  contribuinte.telefone = valor(/DDD\/Telefone:\s*(.*?)\s+E-mail:/i);
  contribuinte.email = valor(/E-mail:\s*(.*?)\s+DDD\/Celular:/i);
  contribuinte.celular = valor(/DDD\/Celular:\s*(.*?)\s+Natureza da Ocupação:/i);
  const natureza = /Natureza da Ocupação:\s*(\d{1,3})\s*-\s*(.*?)\s+Ocupação Principal:/i.exec(texto);
  if (natureza) {
    contribuinte.naturezaOcupacaoCodigo = natureza[1];
    contribuinte.naturezaOcupacaoDescricao = normSpace(natureza[2]);
  }
  const ocupacao = /Ocupação Principal:\s*(\d{1,3})\s*-\s*(.*?)\s+Tipo de declaração:/i.exec(texto);
  if (ocupacao) {
    contribuinte.ocupacaoCodigo = ocupacao[1];
    contribuinte.ocupacaoDescricao = normSpace(ocupacao[2]);
  }
  contribuinte.tipoDeclaracao = valor(/Tipo de declaração:\s*(.*?)\s+N[º°o]\s*do recibo/i);
  contribuinte.reciboUltimaDeclaracao = valor(/N[º°o]\s*do recibo da última declaração entregue do exercício de \d{4}:\s*([\d.-]+)/i).replace(/\D/g, '');
};

// Rótulo de TEXTO (não monetário) e o valor dele, numa linha da ficha. Duas
// formas convivem no mesmo formulário, e as duas aparecem no SAI-01:
//   "CPF do procurador: 101.202.303-64"        (rótulo e valor na MESMA célula)
//   "Nome do procurador:" | "SAI PROCURADOR..." (rótulo numa célula, valor na seguinte)
// paresRotuloValor não serve aqui: ele só aceita valor monetário.
const paresRotuloTexto = (row) => {
  const pares = [];
  const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
  for (let i = 0; i < cells.length; i++) {
    const t = cells[i];
    const corte = t.indexOf(':');
    if (corte === -1) continue;
    const rotulo = normSpace(t.slice(0, corte + 1));
    const naMesma = normSpace(t.slice(corte + 1));
    if (naMesma) { pares.push({ rotulo, valor: naMesma }); continue; }
    const seguinte = cells[i + 1];
    // A célula seguinte só é valor se ela mesma não for outro rótulo.
    if (seguinte && !seguinte.trim().endsWith(':')) { pares.push({ rotulo, valor: normSpace(seguinte) }); i++; }
    else pares.push({ rotulo, valor: '' });
  }
  return pares;
};

// ESPÓLIO (ESP-01 p1 r19 a r32). Rótulos conferidos na impressão oficial.
const ESPOLIO_CAMPOS = {
  'Ainda há bens a inventariar:': 'aindaHaBensAInventariar',
  'Número do processo judicial:': 'numeroProcessoJudicial',
  'Comarca:': 'comarca',
  'Identificação da vara cível:': 'varaCivel',
  'UF:': 'uf',
  'Data da decisão judicial da partilha:': 'dataDecisaoPartilha',
  // O rótulo do trânsito em julgado quebra em duas linhas visuais; o valor cai
  // na segunda, ao lado do pedaço final do rótulo.
  'da decisão judicial da partilha:': 'dataTransitoJulgado',
  'CPF:': 'inventarianteCpf',
  'Nome:': 'inventarianteNome',
  'Trata-se de óbito de ambos os cônjuges ou companheiros(as)?': 'obitoAmbosConjuges',
  'O cônjuge ou companheiro(a) é meeiro(a)?': 'conjugeMeeiro',
  'Trata-se de um inventário conjunto?': 'inventarioConjunto',
};

// SAÍDA DEFINITIVA (SAI-01 p1 r21 a r25).
const SAIDA_CAMPOS = {
  'CPF do procurador:': 'procuradorCpf',
  'Nome do procurador:': 'procuradorNome',
  'Endereço do Procurador:': 'procuradorEndereco',
  'Data da caracterização da condição de não residente:': 'dataNaoResidente',
  'Data da caracterização da condição de residente no país:': 'dataResidente',
  'País de destino:': 'paisDestino',
};

// As perguntas do quadro do cônjuge terminam em "?" e não em ":". O
// paresRotuloTexto casa por ":", então elas entram por este caminho.
const ESPOLIO_PERGUNTAS = [
  ['Trata-se de óbito de ambos os cônjuges ou companheiros(as)?', 'obitoAmbosConjuges'],
  ['O cônjuge ou companheiro(a) é meeiro(a)?', 'conjugeMeeiro'],
  ['Trata-se de um inventário conjunto?', 'inventarioConjunto'],
];

export async function parsePDF(pdf, log = noop, onProgress = noop, options = {}) {
  log(`PDF aberto, ${pdf.numPages} páginas`, 'success');

  const contribuinte = { cpf: '', nome: '' };
  // Quadros das duas modalidades que não são ajuste anual. Nascem null e só
  // viram objeto quando um valor é lido de verdade: ficha vazia não pode
  // aparecer como preenchida (mesmo critério de estadoFichas).
  let espolioOficial = null;
  let saidaDefinitivaOficial = null;
  const paginasTexto = [];
  const bens = [];
  const dividas = [];
  const pagamentos = [];
  const doacoesEfetuadas = [];
  const doacoesPartidos = [];
  const doacoesEcaIdoso = [];
  const fichasPdfObservadas = {};
  const avisosImportacao = [];
  let fichaPdfAtual = null;
  let anoCalendario = null;
  let bemId = 1, dividaId = 1, pagId = 1;
  let doacaoEfId = 1, doacaoPartId = 1, doacaoEcaIdosoId = 1;
  const doacoesEfetuadasState = { anchors: null, current: null, items: doacoesEfetuadas, nextId: () => doacaoEfId++, layouts: ['efetuadas'] };
  const doacoesPartidosState = { anchors: null, current: null, items: doacoesPartidos, nextId: () => doacaoPartId++, layouts: ['partidos'] };
  // categoria começa null e é setada ao entrar em cada uma das duas
  // sub-fichas (ECA / Pessoa Idosa) que dividem esta mesma seção — ver os
  // dois gatilhos de título abaixo.
  // ECA/Idoso: o layout REAL do programa da Receita é o de fundo
  // (TIPO DE FUNDO | FUNDO | CNPJ | VALOR), confirmado no AJU-01. O de código
  // (CÓD. | NOME DO BENEFICIÁRIO | ...) fica como fallback: os dois cabeçalhos
  // são disjuntos (um tem TIPO DE FUNDO, o outro tem CÓD.+NOME DO BENEFICIÁRIO),
  // então nenhum dispara no lugar do outro.
  const doacoesEcaIdosoState = { anchors: null, current: null, items: doacoesEcaIdoso, nextId: () => doacaoEcaIdosoId++, categoria: null, layouts: ['fundo', 'efetuadas'] };

  // 'bens' | 'dividas' | 'pagamentos' | 'doacoesEfetuadas' | 'doacoesPartidos' | 'doacoesEcaIdoso' | null — seção corrente do formulário
  let section = null;
  // Uma vez visto o anexo de Atividade Rural, ignora BENS, DÍVIDAS e
  // PAGAMENTOS adicionais: lá dentro existem sub-tabelas com esses mesmos
  // nomes ("Bens da Atividade Rural", "Dívidas Vinculadas à Atividade
  // Rural"), com layout de colunas diferente e sem os campos que o app
  // modela, e o .DBK também não as cobre.
  //
  // NÃO vale para as fichas de DOAÇÕES: elas são fichas próprias da
  // declaração, não sub-tabelas do anexo rural, e duas delas ("Diretamente na
  // Declaração - ECA" e "- Pessoa Idosa") ficam sempre DEPOIS do anexo. Nas
  // duas declarações de referência o anexo rural começa nas páginas 20 e 41, e
  // essas duas fichas caem nas páginas 48 e 56. Enquanto os gatilhos delas
  // exigiam `!pastRuralAnnex`, elas NUNCA eram lidas, em declaração nenhuma. O
  // defeito passou despercebido porque nos dois arquivos de referência as
  // quatro fichas de doação estão "Sem Informações". Achado em 21/08/2026,
  // depois de a usuária cobrar detalhe na extração do PDF.
  //
  // NOTA de 23/08/2026: desde que "BENS DA ATIVIDADE RURAL - BRASIL" e
  // "DÍVIDAS VINCULADAS À ATIVIDADE RURAL - BRASIL" passaram a ter SEÇÃO
  // PRÓPRIA, esta trava virou uma segunda barreira para bens e dívidas — os
  // títulos são distintos dos das fichas comuns ("DECLARAÇÃO DE BENS E
  // DIREITOS", "DÍVIDAS E ÔNUS REAIS"), então as sub-tabelas do anexo nem
  // chegam mais aos gatilhos delas. Conferido: removendo a trava, a suíte
  // continua verde. Ela FICA de propósito, porque é o que protege se algum dia
  // um gatilho de seção rural deixar de casar (título com grafia diferente num
  // exercício novo, por exemplo) — sem ela, a tabela inteira do anexo cairia
  // dentro de Bens e Direitos e inflaria o patrimônio da pessoa.
  let pastRuralAnnex = false;

  let bensAnchors = null;
  let dividasAnchors = null;
  let pagAnchors = null;

  let currentBem = null;
  let currentDivida = null;
  let currentPag = null;
  // Titularidade corrente da ficha Pagamentos Efetuados. O formulário imprime
  // um marcador de agrupamento ("Titular", "Dependente: <nome>" ou
  // "Alimentando: <nome>") ANTES do bloco de pagamentos daquela pessoa, e ele
  // vale até o próximo marcador. Sem guardá-lo, um gasto médico do dependente
  // vira gasto do titular (auditoria de 31/08/2026).
  let titularidadePagamentoAtual = null;

  // Rendimentos Tributáveis Recebidos de Pessoa Jurídica, das duas fichas
  // (titular e dependentes), no mesmo formato que o .DBK produz pelo registro
  // 21, para que as duas origens caiam no mesmo lugar do app.
  const rendimentos = [];
  let rendId = 1;
  let currentRpj = null;
  let rpjBeneficiario = 'Titular';

  // Imposto Devido: números oficiais das páginas RESUMO e EVOLUÇÃO
  // PATRIMONIAL. Começa null e só vira objeto se a página RESUMO aparecer, para
  // que uma declaração sem ela não produza um objeto de zeros.
  let impostoDevido = null;
  // Bloco corrente da página RESUMO ('rendimentos' | 'deducoes' | null), usado
  // só para desambiguar as duas linhas "TOTAL".
  let resumoBloco = null;
  // Quantas linhas de cada par da Evolução Patrimonial já foram vistas.
  const resumoEvolucaoVistos = {};

  // Fichas que a declaração tem e este parser não lê. Só fechar a seção não
  // basta: se uma delas vier PREENCHIDA, o dado não entra e ninguém fica
  // sabendo. Aqui elas são observadas até o próximo título, e as que tiverem
  // conteúdo de verdade viram aviso no fim da importação — a diferença entre
  // "esta ficha está vazia na sua declaração" e "esta ficha tem dado que o app
  // não importou" é justamente o que a pessoa precisa saber para conferir.
  const fichasNaoLidasComConteudo = [];
  const fichasNaoLidasVazias = [];
  let fichaNaoLidaAtual = null;

  // Bens da Atividade Rural e Dívidas Vinculadas: as duas sub-tabelas que ficam
  // DENTRO do anexo rural e que a trava `pastRuralAnnex` impede de entrar como
  // bens e dívidas comuns. Aqui elas ganham seção própria, com o layout de
  // colunas que é o delas.
  const bensRurais = [];
  const dividasRurais = [];
  let bemRuralId = 1, dividaRuralId = 1;
  let currentBemRural = null;
  let currentDividaRural = null;

  // Atividade Rural: imóveis explorados, com os participantes de cada um, e a
  // movimentação do rebanho.
  const imoveisRurais = [];
  const participantesRuraisOficial = [];
  const movimentacaoRebanhoOficial = [];
  let imovelRuralId = 1;
  let ultimoImovelRural = null;
  let emParticipantes = false;

  // Atividade Rural: receitas e despesas mês a mês, e a apuração do resultado.
  const receitasDespesasRuraisOficial = [];
  let apuracaoResultadoRuralOficial = null;

  // Apuração do Ganho de Capital: uma entrada por operação (uma página cada).
  const apuracaoGanhoCapital = [];
  let gcId = 1;
  let currentGc = null;
  // Bloco corrente dentro do demonstrativo de Ganho de Capital (ver GC_BLOCOS):
  // é ele que desambigua os rótulos repetidos entre quadros.
  let gcBloco = null;
  // Captura multi-linha da "Especificação e endereço" do imóvel: a primeira
  // linha de conteúdo é o bem, as seguintes são o endereço, até o próximo
  // bloco. 0 = não capturando; 1 = próxima linha é o bem; 2 = linhas de endereço.
  let gcEspecEstado = 0;
  // Ficha de MOEDAS EM ESPÉCIE, que tem layout próprio.
  let gcMoedaBloco = null;
  // Operação de moeda estrangeira em espécie em montagem. O formulário imprime
  // a alienação em blocos rótulo-em-cima / valor-embaixo (adquirente; data,
  // quantidade, valor; custo médio, custo de aquisição, ganho), fechados quando
  // chega a TOTALIZAÇÃO ou uma nova moeda.
  let currentGcMoeda = null;
  const gcMoedaOperacoesPdf = [];
  const gcMoedaMensalPdf = [];
  // Operações em FII ou Fiagro: o formulário imprime uma MATRIZ, com os campos
  // nas linhas e os meses nas colunas (janeiro a junho num quadro, julho a
  // dezembro noutro), diferente da ficha de operações comuns/day-trade, que é
  // uma página por mês. Por isso a leitura aqui é por coluna.
  let fiiBloco = null;      // 'titular' | 'dependente'
  let fiiMesesColuna = [];  // meses do quadro corrente, na ordem das colunas
  // O formulário quebra os rótulos longos desta ficha em TRÊS linhas visuais,
  // com a linha de valores no MEIO ("RESULTADO LÍQUIDO DO" / valores / "MÊS").
  // Estes dois guardam os pedaços de rótulo já vistos e a linha de valores que
  // ficou esperando o rótulo fechar.
  let fiiRotuloPartes = [];
  let fiiValoresPendentes = null;
  // CPF impresso no subtítulo da ficha dos dependentes.
  let fiiCpfDependente = null;
  const fiiFiagroMensalOficial = [];

  // Demonstrativo da Lei 14.754/2023, detalhado por bem.
  const demonstrativoExteriorOficial = [];

  // Dependentes: a ficha fica no fim da página 1, antes de qualquer rendimento.
  const dependentes = [];
  let depId = 1;

  // Isentos / Tributação Exclusiva: 'isento' | 'exclusivo', e o grupo do código
  // corrente com seus detalhes por fonte pagadora.
  let rieCategoria = null;
  let rieGrupo = null;
  // Âncoras de coluna da sub-tabela de isentos/exclusiva, montadas do cabeçalho
  // (Beneficiário | CPF | doc | Nome | [Descrição] | Valor). Sem elas, o nome
  // da fonte e a descrição caíam no mesmo campo, e o documento do doador ia
  // para dentro do nome (auditoria de 31/08/2026).
  let rieAnchors = null;
  // true entre o cabeçalho e a primeira linha de detalhe: nesse intervalo, a
  // linha de CONTINUAÇÃO do cabeçalho ("Pagadora"/"Pagadora") não pode ser
  // confundida com continuação da descrição do código.
  let rieAguardandoDetalhe = false;
  const rieDivergencias = [];

  // Renda Variável: uma entrada por ficha mensal COM dado. Mês impresso como
  // "Sem Informações" não vira entrada (é a ausência de operação, não um zero
  // declarado). `titular` separa a ficha do titular da dos dependentes, que
  // são duas fichas distintas na declaração e podem ter meses diferentes.
  const rendaVariavelMensalOficial = [];
  let currentRv = null;
  // true entre o marcador do mês e a primeira linha de conteúdo, para saber se
  // o "Sem Informações" que aparecer se refere a este mês.
  let rvAguardandoConteudo = false;
  let rvTitular = true;

  // Flush defensivo de TODO item em andamento, usado quando um título de
  // seção conhecido aparece (a tabela anterior deveria ter fechado com
  // "TOTAL", mas nunca custa garantir que nenhum item fique preso e se
  // perca ao trocar de seção).
  // Fecha a ficha mensal de Renda Variável em andamento. Só entra na lista se
  // alguma linha de valor chegou a ser lida: o marcador do mês sozinho, sem
  // conteúdo, é o caso "Sem Informações".
  const flushRv = () => {
    if (currentRv && currentRv.temDados) rendaVariavelMensalOficial.push(currentRv);
    currentRv = null;
    rvAguardandoConteudo = false;
  };

  const flushRuralTabelas = () => {
    if (currentBemRural) {
      currentBemRural.chaveImportacao = `pdf:bem-rural:${currentBemRural.codigo}:${fingerprintTextoPdf(currentBemRural.discriminacao)}`;
      bensRurais.push(currentBemRural);
      currentBemRural = null;
    }
    if (currentDividaRural) {
      currentDividaRural.chaveImportacao = `pdf:divida-rural:${fingerprintTextoPdf(currentDividaRural.discriminacao)}`;
      dividasRurais.push(currentDividaRural);
      currentDividaRural = null;
    }
  };

  const flushGc = () => {
    if (!currentGc) return;
    // Fecha a operação normalizando os campos PLANOS que o resto do app
    // consome (e que o caminho .DBK também produz): o ganho vem da apuração
    // impressa, e o imposto do quadro de cálculo. Sem isso os dois caminhos
    // divergiriam no resumo, mesmo lendo a mesma declaração.
    if (currentGc.apuracao?.ganhoCapital != null) currentGc.ganhoCapital = currentGc.apuracao.ganhoCapital;
    currentGc.impostoDevido = currentGc.calculoImposto?.impostoDevido ?? 0;
    currentGc.impostoPago = currentGc.calculoImposto?.impostoPago ?? 0;
    apuracaoGanhoCapital.push(currentGc);
    currentGc = null;
  };

  const flushRpj = () => {
    if (currentRpj) { rendimentos.push(currentRpj); currentRpj = null; }
  };

  // Fecha o código corrente da ficha de isentos/exclusiva. Ver o comentário
  // grande de RIE_AGREGADA: com sub-tabela, valem os detalhes (e o agregado
  // vira conferência); sem sub-tabela, vale o agregado.
  const flushRie = () => {
    const g = rieGrupo;
    rieGrupo = null;
    if (!g) return;
    const codigo = codigoInterno(g.categoria, g.codigo);
    const tipo = `${g.categoria}_${codigo}`;
    const base = {
      tipo,
      codigo_rendimento: codigo,
      // O número como a ficha o imprime, preservado: é por ele que a pessoa
      // acha a linha na declaração em papel.
      codigo_impresso: String(g.codigo).padStart(2, '0'),
      descricao_ficha: g.descricao,
      irrf: 0,
      data: anoCalendario ? `${anoCalendario}-12-31` : '',
    };
    if (g.detalhes.length > 0) {
      const somaDetalhe = g.detalhes.reduce((s, d) => s + d.valor, 0);
      // Conferência contra o agregado impresso logo acima da sub-tabela. Não
      // corrige nada sozinho: só registra, para o import poder avisar.
      if (Math.abs(somaDetalhe - g.valorAgregado) > 0.01) {
        rieDivergencias.push({ tipo, descricao: g.descricao, somaDetalhe, valorAgregado: g.valorAgregado });
      }
      for (const d of g.detalhes) {
        rendimentos.push({
          ...base,
          id: rendId++,
          ...(d.origemDocumento ? { origemDocumento: d.origemDocumento } : {}),
          cnpj_fonte: d.cnpj,
          nome_fonte: d.nome,
          // rend-06: a descrição do rendimento (coluna própria no código 99) é
          // campo separado do nome da fonte, e não mais concatenada nele.
          ...(d.descricao ? { descricao: d.descricao } : {}),
          beneficiario: d.beneficiario,
          cpf_dependente: d.beneficiario === 'Dependente' ? d.cpf : null,
          valor: d.valor,
          ...(d.decimoTerceiro ? { decimoTerceiro: d.decimoTerceiro } : {}),
        });
      }
      return;
    }
    // Código só com a linha agregada (ex.: "08. 13º salário recebido pelos
    // dependentes", que não tem sub-tabela nenhuma). Sem isso, o valor sumiria.
    if (g.valorAgregado !== 0) {
      // rend-08: o código 08 é "13º salário recebido pelos DEPENDENTES". A
      // própria descrição diz de quem é; cravar 'Titular' somava no titular um
      // valor do dependente em qualquer separação por beneficiário.
      const ehDependente = /dependente/i.test(g.descricao || '');
      rendimentos.push({
        ...base,
        id: rendId++,
        ...(g.origemDocumento ? { origemDocumento: g.origemDocumento } : {}),
        cnpj_fonte: '',
        nome_fonte: '',
        beneficiario: ehDependente ? 'Dependente' : 'Titular',
        cpf_dependente: null,
        valor: g.valorAgregado,
      });
    }
  };

  // `lendoHerdeiros` é estado de RASCUNHO do leitor do bloco de herdeiros do
  // bem partilhado, não é dado da declaração. Ele ficava no bem emitido quando
  // o bloco ia até o fim do bem, e daí seguia para o estado, para o
  // localStorage, para o snapshot do ano e para a comparação da retificadora.
  // Achado na varredura campo a campo de 31/08/2026.
  const emitirBem = (bem) => {
    delete bem.lendoHerdeiros;
    bens.push(bem);
  };

  const flushAllCurrent = () => {
    if (currentBem) { emitirBem(currentBem); currentBem = null; }
    if (currentDivida) { dividas.push(currentDivida); currentDivida = null; }
    if (currentPag) { pagamentos.push(currentPag); currentPag = null; }
    flushRv();
    flushRpj();
    flushRie();
    flushGc();
    flushRuralTabelas();
    for (const st of [doacoesEfetuadasState, doacoesPartidosState, doacoesEcaIdosoState]) {
      if (st.current) { st.items.push(st.current); st.current = null; }
    }
  };

  // Referência compacta para localizar cada registro estruturado no texto
  // preservado por página. `linha` é a linha visual reconstruída pelo parser,
  // não uma posição inventada no conteúdo original.
  // Página e linha visual de onde o item saiu, para a interface poder apontar
  // o número de volta na declaração impressa.
  //
  // ATENÇÃO ao comparar com AUDITORIA/rows-pdfjs/*.rows.txt: o dump rotula as
  // linhas a partir de ZERO (p5 r40) e este campo guarda a contagem a partir de
  // UM (linha 41), que é como uma pessoa conta linha numa página. São o mesmo
  // lugar do documento. Não "corrigir" um pelo outro.
  const origemPdf = (pagina, linha) => ({ formato: 'pdf', pagina, linha });

  // Índice da linha visual que já foi consumida como continuação de um título
  // quebrado em duas linhas. Vale só dentro da página corrente.
  let rowDeTituloContinuado = -1;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .map(it => ({ text: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.text.trim() !== '');
    const rows = buildRows(items);
    rowDeTituloContinuado = -1;
    const textoPagina = rows.map(row => normSpace(row.cells.map(c => c.text).join(' '))).filter(Boolean).join('\n');
    paginasTexto.push({ numero: pageNum, texto: textoPagina });
    if (pageNum === 1) preencherIdentificacaoPdf(textoPagina, contribuinte);
    onProgress(pageNum, pdf.numPages);

    for (let ri = 0; ri < rows.length; ri++) {
      // Linha visual já consumida como continuação do título da linha anterior.
      if (ri === rowDeTituloContinuado) continue;
      const row = rows[ri];
      const rabosDoTitulo = rabosDeTitulo(rows, ri);

      // Inventário independente da lógica de extração. Primeiro registramos
      // quais fichas o próprio PDF imprimiu e onde começam; só depois os
      // parsers especializados tentam estruturar os dados. Isso impede que
      // uma coleção vazia por falha de reconhecimento seja confundida com a
      // expressão oficial "Sem Informações".
      // Título quebrado em DUAS linhas visuais: tenta emendar com a seguinte
      // ANTES de aceitar um casamento parcial. Sem isto, a cell truncada
      // "...PELO TITULAR (IMPOSTO COM" casa por prefixo com a ficha COMUM do
      // titular, e a row de uma ficha de exigibilidade suspensa é registrada
      // como se fosse a ficha comum — `fichaPdfAtual` passa a apontar para a
      // ficha errada no meio da tabela (auditoria de 31/08/2026).
      let fichaCatalogada = null;
      for (const c of row.cells) {
        const direto = encontrarFichaPdf2026(c.text);
        if (ehPrefixoDeFichaPdf2026(c.text)) {
          const emenda = rabosDoTitulo
            .map(rabo => ({ ficha: encontrarFichaPdf2026(`${c.text} ${rabo.texto}`), linha: rabo.linha }))
            .find(e => e.ficha && e.ficha !== direto);
          if (emenda) {
            fichaCatalogada = emenda.ficha;
            // A linha do rabo é só o fim do título, não tem dado: consumida
            // aqui, ela não pode ser matched de novo por conta própria. Sem
            // isto, o "DEPENDENTES" que fecha o título de RRA dos dependentes
            // casa por igualdade com a ficha DEPENDENTES e desvia
            // `fichaPdfAtual` no meio da tabela de RRA.
            rowDeTituloContinuado = emenda.linha;
            break;
          }
        }
        if (direto) { fichaCatalogada = direto; break; }
      }
      if (section === 'ganhoCapital' && ['rendimentos-isentos', 'rendimentos-tributacao-exclusiva'].includes(fichaCatalogada?.id)) {
        fichaCatalogada = null;
      }
      if (fichaCatalogada) {
        fichaPdfAtual = fichaCatalogada.id;
        if (!fichasPdfObservadas[fichaCatalogada.id]) {
          fichasPdfObservadas[fichaCatalogada.id] = {
            id: fichaCatalogada.id,
            titulo: fichaCatalogada.titulo,
            paginaInicio: pageNum,
            linhaInicio: ri + 1,
            presenca: 'indeterminada',
          };
        }
      }
      if (fichaPdfAtual && row.cells.some(c => /^Sem Informações$/i.test(c.text.trim()))) {
        fichasPdfObservadas[fichaPdfAtual].presenca = 'vazia';
      }
      // Nem toda ficha vazia imprime "Sem Informações". As de RENDIMENTOS
      // ISENTOS e de TRIBUTAÇÃO EXCLUSIVA, quando não têm nenhum código
      // preenchido, imprimem só a linha "TOTAL 0,00" logo abaixo do título:
      // SAI-01 p2 r7/r8 e ESP-01 p2 r15/r16 e r17/r18.
      //
      // Isso não era acabamento: sem dados estruturados e sem prova de que
      // estava vazia, a ficha era classificada como ERRO, e uma única ficha em
      // erro DESABILITA o botão "Usar esta declaração" na revisão da
      // importação (resumirImportacao.temBloqueio). O efeito era que nenhuma
      // declaração final de espólio e nenhuma de saída definitiva podia ser
      // importada pelo app, e as telas próprias dessas modalidades ficavam
      // inalcançáveis pelo fluxo real.
      //
      // A regra é estreita de propósito: só vale quando o TOTAL é a PRIMEIRA
      // linha depois do título da ficha, na mesma página. Ficha que lista
      // itens antes do total não é tocada, mesmo que o total seja zero, e
      // conteúdo estruturado continua prevalecendo sobre esta marca (ver
      // `if (temDados) observada.presenca = 'preenchida'`).
      const observadaAtual = fichaPdfAtual ? fichasPdfObservadas[fichaPdfAtual] : null;
      if (observadaAtual && observadaAtual.presenca === 'indeterminada'
        && observadaAtual.paginaInicio === pageNum && ri + 1 === observadaAtual.linhaInicio + 1) {
        const textos = row.cells.map(c => normSpace(c.text));
        const ehTotal = textos.some(t => /^TOTAL$/i.test(t));
        const valores = textos.filter(t => RV_VALOR.test(t));
        if (ehTotal && valores.length > 0 && valores.every(t => parseMoneyBR(t) === 0)) {
          observadaAtual.presenca = 'vazia';
        }
      }

      if (!contribuinte.nome && rowHasCell(row, 'NOME:')) {
        contribuinte.nome = nextCellText(row, 'NOME:');
      }
      if (!contribuinte.cpf && rowHasCell(row, 'CPF:')) {
        const v = nextCellText(row, 'CPF:');
        if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(v)) contribuinte.cpf = v.replace(/\D/g, '');
      }
      if (!anoCalendario) {
        const anoCell = row.cells.find(c => /^ANO-CALENDÁRIO \d{4}$/.test(c.text.trim()));
        if (anoCell) anoCalendario = parseInt(anoCell.text.trim().slice(-4), 10);
      }
      if (isBoilerplateRow(row)) continue;

      if (rowHasCell(row, 'DEMONSTRATIVO DE ATIVIDADE RURAL - BRASIL')) {
        pastRuralAnnex = true;
        section = null;
        continue;
      }
      if (!pastRuralAnnex && rowHasCell(row, 'DECLARAÇÃO DE BENS E DIREITOS')) {
        if (currentBem) { emitirBem(currentBem); currentBem = null; }
        section = 'bens';
        continue;
      }
      if (!pastRuralAnnex && rowHasCell(row, 'DÍVIDAS E ÔNUS REAIS')) {
        if (currentDivida) { dividas.push(currentDivida); currentDivida = null; }
        section = 'dividas';
        continue;
      }
      if (!pastRuralAnnex && rowHasCell(row, 'PAGAMENTOS EFETUADOS')) {
        if (currentPag) { pagamentos.push(currentPag); currentPag = null; }
        // Só zera a titularidade ao ENTRAR na ficha de outra seção. O título se
        // reimprime no topo de cada página de continuação (p8 r3 no AJU-01), e
        // zerar ali apagaria o marcador "Dependente:" que veio no fim da página
        // anterior, jogando os pagamentos do dependente para o titular.
        if (section !== 'pagamentos') titularidadePagamentoAtual = null;
        section = 'pagamentos';
        continue;
      }
      // As 4 fichas de Doações: mesmo padrão de PAGAMENTOS EFETUADOS acima
      // (título dispara a seção, uma linha de cabeçalho de tabela mais
      // adiante define as colunas via processDoacaoRow). ECA e Pessoa Idosa
      // dividem a mesma seção/array — só o campo `categoria` no state muda,
      // porque as duas tabelas usam o mesmo layout uma logo após a outra.
      if (rowHasCell(row, 'DOAÇÕES EFETUADAS')) {
        flushAllCurrent();
        section = 'doacoesEfetuadas';
        doacoesEfetuadasState.anchors = null;
        continue;
      }
      if (rowHasCell(row, 'DOAÇÕES A PARTIDOS POLÍTICOS E CANDIDATOS A CARGOS ELETIVOS')) {
        flushAllCurrent();
        section = 'doacoesPartidos';
        doacoesPartidosState.anchors = null;
        continue;
      }
      if (rowHasCell(row, 'DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - ECA')) {
        flushAllCurrent();
        section = 'doacoesEcaIdoso';
        doacoesEcaIdosoState.anchors = null;
        doacoesEcaIdosoState.categoria = 'eca';
        continue;
      }
      if (rowHasCell(row, 'DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - PESSOA IDOSA')) {
        flushAllCurrent();
        section = 'doacoesEcaIdoso';
        doacoesEcaIdosoState.anchors = null;
        doacoesEcaIdosoState.categoria = 'idoso';
        continue;
      }
      if (rowHasCell(row, 'BENS DA ATIVIDADE RURAL - BRASIL')) {
        flushAllCurrent();
        section = 'bensRurais';
        continue;
      }
      if (rowHasCell(row, 'DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - BRASIL')) {
        flushAllCurrent();
        section = 'imoveisRurais';
        ultimoImovelRural = null;
        emParticipantes = false;
        continue;
      }
      // "- BRASIL" é exigido: existe uma ficha irmã "MOVIMENTAÇÃO DO REBANHO
      // - EXTERIOR" nas duas declarações de referência (vazia nelas). Um
      // gatilho por prefixo casaria as duas e somaria o rebanho do exterior
      // junto com o do Brasil, numa declaração que tivesse os dois.
      if (rowHasCell(row, 'MOVIMENTAÇÃO DO REBANHO - BRASIL')) {
        flushAllCurrent();
        section = 'rebanho';
        continue;
      }
      if (rowHasCell(row, 'RECEITAS E DESPESAS - BRASIL')) {
        flushAllCurrent();
        section = 'receitasDespesasRurais';
        continue;
      }
      if (rowHasCell(row, 'APURAÇÃO DO RESULTADO - BRASIL')) {
        flushAllCurrent();
        section = 'apuracaoRural';
        // rural-04: NÃO criar o objeto aqui. Antes, o simples título criava
        // `{origem:'pdf'}`, e uma declaração SEM atividade rural (ESP/SAI, que
        // imprimem "Sem Informações") aparecia com a Apuração do Resultado
        // "preenchida". O objeto passa a nascer só quando um valor é lido.
        continue;
      }
      // Cada página desta ficha é uma operação nova; o título é o separador, e
      // é dele que sai o TIPO (bem imóvel, bem móvel, participação societária
      // ou moedas em espécie). Moeda em espécie tem layout próprio e vai para
      // uma seção separada.
      {
        const tituloGc = row.cells.map(c => GC_TITULO.exec(c.text.trim())).find(Boolean);
        if (tituloGc) {
          flushAllCurrent();
          const rotuloTipo = normSpace(tituloGc[1] || '').toUpperCase();
          const tipoGc = GC_TIPO_POR_TITULO[rotuloTipo] || 'movel';
          if (tipoGc === 'moeda') {
            section = 'ganhoCapitalMoeda';
            continue;
          }
          section = 'ganhoCapital';
          gcBloco = null;
          currentGc = {
            id: gcId++, tipo: tipoGc, bem: '', dataAquisicao: '', custoAquisicao: 0,
            dataAlienacao: '', valorAlienacao: 0, custoCorretagem: 0, naturezaOperacao: '',
            ganhoCapital: 0, adquirenteCpfCnpj: '', adquirenteNome: '',
            adquirentes: [], perguntasImpressas: [], parcelas: [], origem: 'pdf',
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
          continue;
        }
      }
      if (rowHasCell(row, 'DEMONSTRATIVO DE APURAÇÃO - LEI 14.754/2023')) {
        flushAllCurrent();
        section = 'lei14754';
        continue;
      }
      // RESUMO e EVOLUÇÃO PATRIMONIAL são as duas últimas páginas e alimentam
      // o mesmo objeto; a segunda não repete o título da primeira.
      if (rowHasCell(row, 'RESUMO') || rowHasCell(row, 'EVOLUÇÃO PATRIMONIAL')) {
        flushAllCurrent();
        section = 'resumo';
        if (!impostoDevido) impostoDevido = { origem: 'pdf' };
        // A própria página RESUMO diz qual modelo a pessoa usou, no cabeçalho:
        // "TRIBUTAÇÃO UTILIZANDO AS DEDUÇÕES LEGAIS" na declaração completa. É
        // o equivalente, no PDF, do que o `.DBK` distingue por tipo de registro
        // (18 para a simplificada, 20 para a completa).
        if (row.cells.some(c => /DEDUÇÕES LEGAIS/i.test(c.text))) impostoDevido.modeloDeclaracao = 'completa';
        else if (row.cells.some(c => /DESCONTO SIMPLIFICADO/i.test(c.text))) impostoDevido.modeloDeclaracao = 'simplificada';
        resumoBloco = null;
        continue;
      }
      // Modalidades que não são a declaração de ajuste anual. Os quadros ficam
      // na primeira página, logo abaixo da identificação, e simplesmente não
      // existem numa declaração comum. Tratar espólio e saída definitiva como
      // ajuste anual é erro de classificação fiscal: partilha e condição de
      // não residente mudam a leitura do patrimônio.
      if (rowHasCell(row, 'ESPÓLIO')) {
        flushAllCurrent();
        section = 'espolio';
        continue;
      }
      if (rowHasCell(row, 'HERDEIROS / MEEIRO') || rowHasCell(row, 'HERDEIROS')) {
        flushAllCurrent();
        section = 'herdeirosEspolio';
        continue;
      }
      if (rowHasCell(row, 'SAÍDA')) {
        flushAllCurrent();
        section = 'saida';
        continue;
      }
      if (rowHasCell(row, 'DEPENDENTES')) {
        flushAllCurrent();
        section = 'dependentes';
        continue;
      }
      // ALIMENTANDOS vem logo depois de DEPENDENTES e tem layout próprio, que
      // este parser não lê: fechar aqui evita que as linhas dela entrem como
      // dependente (são pessoas diferentes para a legislação, pensão
      // alimentícia não é dedução por dependente).
      if (rowHasCell(row, 'ALIMENTANDOS')) {
        flushAllCurrent();
        section = null;
        continue;
      }
      // Antes esta ficha só FECHAVA a seção corrente, para que as linhas dela
      // não entrassem como dívidas comuns. Agora tem seção própria, com o
      // layout de 3 colunas que é o dela (a de Dívidas e Ônus Reais tem 2 mais
      // o código).
      if (rowHasCell(row, 'DÍVIDAS VINCULADAS À ATIVIDADE RURAL - BRASIL')) {
        flushAllCurrent();
        section = 'dividasRurais';
        continue;
      }
      // Isentos e Tributação Exclusiva: mesmo layout, categorias diferentes.
      //
      // A guarda `section !== 'ganhoCapital'` é o que impede uma COLISÃO REAL
      // de títulos, achada em 24/08/2026 ao ler o demonstrativo de Ganho de
      // Capital: a última página de cada operação tem os quadros
      // "RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS" e "RENDIMENTOS SUJEITOS À
      // TRIBUTAÇÃO DEFINITIVA" — que ali são o TRANSPORTE daquela operação
      // para as fichas de rendimento, não o começo das fichas. Sem a guarda, o
      // parser abandonava a operação no meio (perdendo consolidação e
      // transportes) e abria uma ficha de isentos fantasma dentro do
      // demonstrativo.
      if (section !== 'ganhoCapital' && rowHasCell(row, 'RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS')) {
        flushAllCurrent();
        section = 'rendimentosIsentosExclusiva';
        rieCategoria = 'isento';
        continue;
      }
      if (section !== 'ganhoCapital' && row.cells.some(c => /^RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA\s*\/\s*DEFINITIVA$/.test(c.text.trim()))) {
        flushAllCurrent();
        section = 'rendimentosIsentosExclusiva';
        rieCategoria = 'exclusivo';
        continue;
      }
      // Rendimentos Tributáveis de PJ: duas fichas irmãs, uma do titular e uma
      // dos dependentes, com o mesmo layout. Ficam no começo da declaração,
      // antes do anexo rural, e por isso não esbarram em `pastRuralAnnex`.
      {
        const tituloRpj = row.cells.map(c => RPJ_TITULO.exec(c.text.trim())).find(Boolean);
        if (tituloRpj) {
          flushAllCurrent();
          section = 'rendimentosPJ';
          rpjBeneficiario = tituloRpj[1] === 'O TITULAR' ? 'Titular' : 'Dependente';
          continue;
        }
      }
      // Renda Variável: duas fichas irmãs (titular e dependentes) com o mesmo
      // layout de página. O título só aparece na primeira página de cada uma;
      // as páginas seguintes continuam a mesma ficha, e é por isso que o
      // estado da seção precisa atravessar a virada de página (o marcador
      // "GANHOS LÍQUIDOS OU PERDAS - JUL" da última linha da página 42 abre um
      // mês cujo conteúdo só começa na 43, numa declaração real).
      //
      // Fora da trava `pastRuralAnnex` de propósito: são fichas próprias da
      // declaração e ficam DEPOIS do anexo rural, igual às duas fichas de
      // doação que ficaram anos sem ser lidas por causa dessa mesma trava.
      if (rowHasCell(row, 'RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - TITULAR')) {
        flushAllCurrent();
        section = 'rendaVariavel';
        rvTitular = true;
        continue;
      }
      if (rowHasCell(row, 'RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - DEPENDENTES')) {
        flushAllCurrent();
        section = 'rendaVariavel';
        rvTitular = false;
        continue;
      }
      // "FUNDOS DE INVESTIMENTO IMOBILIÁRIO OU NAS CADEIAS PRODUTIVAS
      // AGROINDUSTRIAIS" (titular e dependentes) é a segunda ficha do menu
      // Renda Variável do programa da Receita, impressa logo depois das
      // operações comuns/day-trade.
      //
      // Ela está "Sem Informações" nas duas declarações de referência, então o
      // layout usado aqui vem do relatório oficial (`relRendaVariavelFundoInvestimentoTitular`,
      // extraído do irpf-impressao.jar): uma MATRIZ com 11 campos nas linhas e
      // os meses nas colunas, em dois quadros (janeiro a junho, julho a
      // dezembro). Por isso a leitura é por coluna, ancorada nos nomes dos
      // meses do cabeçalho — e, se o cabeçalho não aparecer, nada é lido, em
      // vez de casar valor com o mês errado.
      if (row.cells.some(c => /^FUNDOS DE INVESTIMENTO IMOBILIÁRIO/.test(c.text.trim()))) {
        flushAllCurrent();
        section = 'fiiFiagro';
        fiiBloco = /DEPENDENTES$/.test(normSpace(row.cells.map(c => c.text.trim()).join(' '))) ? 'dependente' : 'titular';
        fiiMesesColuna = [];
        fiiRotuloPartes = [];
        fiiValoresPendentes = null;
        fiiCpfDependente = null;
        continue;
      }
      // ANTES do fechamento genérico logo abaixo, de propósito: aquele bloco
      // casa qualquer título começando com "RENDIMENTOS" e faria `continue`,
      // e as fichas de rendimento não lidas nunca chegariam aqui para serem
      // observadas. Fechar a seção elas fechariam de qualquer jeito; o que se
      // perderia é o AVISO de que vieram preenchidas.
      // Também protegida contra a colisão de títulos descrita acima:
      // "RENDIMENTOS SUJEITOS À TRIBUTAÇÃO DEFINITIVA" está na lista de fichas
      // não lidas e, dentro do demonstrativo de Ganho de Capital, é só o
      // rótulo de um quadro de transporte.
      const fichaNaoLida = section === 'ganhoCapital' ? null : nomeDaFichaNaoLida(row, rabosDoTitulo);
      if (fichaNaoLida) {
        flushAllCurrent();
        section = 'fichaNaoLida';
        fichaNaoLidaAtual = { nome: fichaNaoLida.nome, temConteudo: false };
        if (fichaNaoLida.linhaConsumida >= 0) rowDeTituloContinuado = fichaNaoLida.linhaConsumida;
        continue;
      }

      // Observa a ficha não lida só o suficiente para saber se ela tem dado.
      // Nada daqui é importado: o objetivo é poder AVISAR, não adivinhar o
      // layout de uma ficha que nunca foi vista preenchida.
      if (section === 'fichaNaoLida') {
        const textos = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (textos.some(t => t === 'Sem Informações')) {
          if (fichaNaoLidaAtual?.nome && !fichasNaoLidasVazias.includes(fichaNaoLidaAtual.nome)) {
            fichasNaoLidasVazias.push(fichaNaoLidaAtual.nome);
          }
          fichaNaoLidaAtual = null;
          section = null;
          continue;
        }
        // Valor monetário diferente de zero é o sinal de conteúdo. Cabeçalho de
        // coluna e rótulo não têm valor, e ficha vazia zerada não merece aviso.
        if (fichaNaoLidaAtual && !FICHAS_NAO_LIDAS_SEM_AVISO.includes(fichaNaoLidaAtual.nome)
            && textos.some(t => RV_VALOR.test(t) && parseMoneyBR(t) !== 0)) {
          if (!fichasNaoLidasComConteudo.includes(fichaNaoLidaAtual.nome)) {
            fichasNaoLidasComConteudo.push(fichaNaoLidaAtual.nome);
          }
          fichaNaoLidaAtual = null;
          section = null;
        }
        continue;
      }


      if (
        // A guarda `section !== 'resumo'` é o que mantém a leitura das duas
        // últimas páginas viva. Sem ela, a seção do RESUMO morria na SEGUNDA
        // linha da própria página: o subtítulo "RENDIMENTOS TRIBUTÁVEIS" casa
        // o `^RENDIMENTOS` desta lista, e o mesmo acontecia com "OUTRAS
        // INFORMAÇÕES" na página de Evolução Patrimonial, deixando passar só
        // as quatro linhas antes dele. Nenhuma das seções que este bloco
        // fecha (bens, dívidas, pagamentos, doações) pode estar aberta dentro
        // do resumo, então não há o que fechar aqui.
        section !== 'resumo' && (
          // RESUMO entrou na lista junto com a correção das doações ECA/Pessoa
          // Idosa: essas duas fichas ficam na última página antes do RESUMO, e
          // sem ele a seção seguiria aberta por cima da página de resumo.
          row.cells.some(c => /^(RENDIMENTOS|DEMONSTRATIVO|OUTRAS INFORMAÇÕES|EVOLUÇÃO PATRIMONIAL|RESUMO$)/.test(c.text.trim()))
        )
        // Exceção para os dois quadros de TRANSPORTE que o demonstrativo de
        // Ganho de Capital imprime no fim de cada operação e que começam com
        // "RENDIMENTOS": ali eles são parte da operação, não uma ficha nova.
        // Qualquer outro título continua fechando a seção normalmente, senão o
        // demonstrativo ficaria aberto por cima da página seguinte.
        && !(section === 'ganhoCapital' && row.cells.some(c => GC_QUADROS_INTERNOS.test(c.text.trim())))
      ) {
        flushAllCurrent();
        section = null;
        continue;
      }

      // REDE DE SEGURANÇA: ficha que existe na declaração e que este parser
      // não lê. Sem isto, o conteúdo dela cai na seção anterior, que continua
      // aberta — foi assim que as duas fichas de doação ECA/Pessoa Idosa
      // ficaram anos sendo engolidas pelo anexo rural. Ver FICHAS_NAO_LIDAS.
      if (!section) continue;

      if (section === 'bens') {
        if (rowHasCell(row, 'GRUPO') && rowHasCell(row, 'DISCRIMINAÇÃO')) {
          // As datas de referência ("31/12/<ano-1>" e "31/12/<ano>") mudam
          // a cada declaração — nunca cravar o ano no regex; a coluna
          // esquerda é sempre o ano anterior, a direita o ano atual.
          const nextRow = rows[ri + 1];
          const dateCells = (nextRow ? nextRow.cells.filter(c => /^\d{2}\/\d{2}\/\d{4}$/.test(c.text.trim())) : [])
            .sort((a, b) => a.x - b.x);
          const discX = findCellX(row, 'DISCRIMINAÇÃO');
          // Âncoras das colunas de valor. Preferência: as células de data da
          // linha seguinte (ajuste anual). Quando elas não existem — Declaração
          // Final de Espólio ("SITUAÇÃO NA DATA DA PARTILHA" / "VALOR DE
          // TRANSFERÊNCIA") e Saída Definitiva ("SITUAÇÃO EM 31/12/AAAA" /
          // "SITUAÇÃO NA DATA DA") —, deriva das próprias células de cabeçalho à
          // direita da discriminação, em vez de cair em x fixos 389/498 que só
          // funcionavam por coincidência (auditoria de 31/08/2026).
          const colunasValor = dateCells.length >= 2
            ? dateCells
            : row.cells.filter(c => discX != null && c.x > discX + 20).sort((a, b) => a.x - b.x);
          // A ficha de PARTILHA (espólio) não tem "saldo anterior/atual": as
          // duas colunas são "situação na data da partilha" e "valor de
          // transferência". Detecta pelo cabeçalho para poder marcar o bem.
          const ehPartilha = row.cells.some(c => /DATA DA/.test(c.text)) && !row.cells.some(c => /SITUAÇÃO EM/.test(c.text));
          bensAnchors = {
            // Sem `?? 17`: nem toda declaração imprime a coluna "BEM" no
            // cabeçalho, e o padrão antigo colocava a âncora de `bem` no
            // MESMO x da de `GRUPO`, criando uma faixa de largura zero no
            // makeColumnPicker. Ausente é melhor que duplicada: o picker já
            // descarta âncora nula.
            bem: findCellX(row, 'BEM'),
            grupo: findCellX(row, 'GRUPO'),
            codigo: findCellX(row, 'CÓDIGO') ?? 95,
            disc: discX,
            val1: colunasValor[0]?.x ?? 389,
            val2: colunasValor[1]?.x ?? 498,
            ehPartilha,
          };
          continue;
        }
        if (!bensAnchors) continue;
        if (rowHasCell(row, 'TOTAL')) {
          if (currentBem) { emitirBem(currentBem); currentBem = null; }
          continue;
        }
        const pick = makeColumnPicker(bensAnchors);
        const grupoTxt = textInColumn(row, pick, 'grupo');
        if (/^\d{2}$/.test(grupoTxt)) {
          if (currentBem) emitirBem(currentBem);
          const numeroItemTxt = bensAnchors.bem != null ? textInColumn(row, pick, 'bem') : '';
          currentBem = {
            id: bemId++,
            // Número do item impresso na coluna BEM do quadro, quando existe.
            // É por ele que outras fichas do mesmo PDF referenciam o bem (o
            // Demonstrativo da Lei 14.754/2023 aponta "bem 7"), então guardá-lo
            // é o que permite casar as duas leituras. Achado 31/08/2026.
            numeroItem: /^\d+$/.test(numeroItemTxt) ? numeroItemTxt : null,
            grupo: grupoTxt,
            codigo_bem: textInColumn(row, pick, 'codigo'),
            discriminacao: textoDaColunaDisc(row, pick, bensAnchors).substring(0, 512),
            situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
            situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            // País começa null e só vira código quando a linha de metadados
            // "NNN - PAÍS" aparecer. Se nenhuma vier (bem sem a linha), fica
            // '105' (Brasil), que é o default da ficha e o que o .DBK crava.
            localizacao: '105',
            paisNome: '',
            beneficiario: 'Titular',
            cpf_beneficiario: '',
            cnpj: '',
            // Numa Declaração Final de Espólio as duas colunas de valor são
            // "situação na data da partilha" e "valor de transferência", e não
            // saldo anterior/atual. Os campos planos ficam preenchidos para
            // compatibilidade, mas o bem carrega os nomes corretos e a marca
            // `ehPartilha`, para o app não exibir uma "variação" que não existe.
            ...(bensAnchors.ehPartilha ? {
              ehPartilha: true,
              situacaoDataPartilha: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
              valorTransferencia: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            } : {}),
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
        } else if (currentBem) {
          // Antes de tratar a linha como continuação da discriminação, tenta
          // ler dela os CAMPOS de metadados do bem, que o formulário imprime
          // em linhas próprias abaixo do bem. Cada `extrairMetadadoDoBem`
          // devolve true quando consumiu a linha, e aí ela não vira texto.
          if (!extrairMetadadoDoBem(currentBem, row, bensAnchors.disc)) {
            // Só o que cai na COLUNA de discriminação continua o texto do bem.
            // Este é o filtro principal, e resolve dois defeitos de uma vez
            // (auditoria de 21/08/2026, 45 dos 172 bens afetados):
            //
            // 1. Valor de campo do formulário que ficou sozinho numa linha,
            //    sem o rótulo ao lado, e por isso nenhum regex pegava: a
            //    localização ("105 - BRASIL", x≈17), a resposta de "Bem com
            //    usufruto" ("Não", x≈470) e a continuação do nome do cartório
            //    (o nome do município, x≈399) entravam como se fossem descrição
            //    do bem. Nenhum deles mora na coluna de discriminação.
            // 2. Texto REAL que era descartado inteiro por terminar num rótulo
            //    ("... SPE LTDA CNPJ:"), agora preservado, porque a coluna diz
            //    que aquilo é discriminação.
            //
            // NOTA (auditoria 31/08/2026): `isBensMetadataRow` NÃO é chamada
            // aqui, ao contrário do que a versão anterior deste comentário
            // afirmava. Ela é código morto no fluxo de produção — só os testes
            // a exercitam. Ligá-la neste ponto derrubava linhas legítimas de
            // discriminação de declarações reais (texto livre que casa
            // ROTULO_METADADO_RE ou que é exatamente "Titular"/"Dependente"),
            // quebrando o teste das 172 discriminações. A barreira real é a
            // dupla `linhaTemRotuloAEsquerdaDaDisc` + `valorDeCampoNaColunaDisc`
            // logo abaixo, mais o `extrairMetadadoDoBem` acima.
            const extra = linhaTemRotuloAEsquerdaDaDisc(row, pick) ? '' : textoDaColunaDisc(row, pick, bensAnchors);
            if (extra && !valorDeCampoNaColunaDisc(extra)) {
              currentBem.discriminacao = normSpace(currentBem.discriminacao + ' ' + extra).substring(0, 512);
            }
          }
        }
        // CNPJ da instituição ou empresa do bem, para o mesmo cruzamento que o
        // registro 27 do .DBK permite. Vem numa linha de metadados, sempre
        // rotulado, e por isso não se confunde com o CPF do beneficiário (que
        // tem rótulo próprio) nem com um número solto da discriminação. O
        // primeiro encontrado vale: um bem tem uma fonte só.
        if (currentBem && !currentBem.cnpj) {
          // Só a coluna ESQUERDA, antes da discriminação: é ali que a ficha
          // imprime o campo do bem ("CNPJ:  02.335.109/0001-05", x≈17). O
          // mesmo rótulo aparece em outros dois lugares que NÃO servem — o
          // CPF do beneficiário, impresso à direita da discriminação, e um
          // CNPJ que o contribuinte escreveu dentro do próprio texto do bem.
          // Sem esse recorte por posição, 4 dos 172 bens da declaração de
          // referência pegavam o CNPJ errado ou um que o arquivo não tem.
          const limiteDisc = bensAnchors.disc ?? 100;
          const cells = row.cells.filter(c => c.x < limiteDisc);
          for (let ci = 0; ci < cells.length; ci++) {
            const achado = BEM_CNPJ.exec(cells[ci].text);
            const daCelula = achado ? cnpjDoBem(achado[1]) : '';
            if (daCelula) { currentBem.cnpj = daCelula; break; }
            // Rótulo e número em células separadas.
            if (/^CPF(\/CNPJ)?:$|^CNPJ:$/.test(cells[ci].text.trim()) && cells[ci + 1]) {
              const so = BEM_CNPJ_SOLTO.exec(cells[ci + 1].text.trim());
              const daSeguinte = so ? cnpjDoBem(so[1]) : '';
              if (daSeguinte) { currentBem.cnpj = daSeguinte; break; }
            }
          }
        }
        continue;
      }

      if (section === 'dividas') {
        if (rowHasCell(row, 'CÓDIGO') && rowHasCell(row, 'DISCRIMINAÇÃO')) {
          const nextRow = rows[ri + 1];
          dividasAnchors = {
            codigo: findCellX(row, 'CÓDIGO'),
            disc: findCellX(row, 'DISCRIMINAÇÃO'),
            val1: (nextRow && findCellXRegex(nextRow, /^\d{2}\/\d{2}\/\d{4}$/)) ?? 300,
            val2: findCellXRegex(row, /SITUAÇÃO EM \d{2}\/\d{2}\/\d{4}$/) ?? 385,
            pago: findCellX(row, 'VALOR PAGO') ?? (nextRow && findCellXRegex(nextRow, /^EM \d{4}$/)) ?? 520,
          };
          continue;
        }
        if (!dividasAnchors) continue;
        if (rowHasCell(row, 'TOTAL')) {
          if (currentDivida) { dividas.push(currentDivida); currentDivida = null; }
          continue;
        }
        const pick = makeColumnPicker(dividasAnchors);
        const codigoTxt = textInColumn(row, pick, 'codigo');
        if (/^\d{1,3}$/.test(codigoTxt)) {
          if (currentDivida) dividas.push(currentDivida);
          const valores = valoresDaLinhaDeDivida(row, dividasAnchors);
          currentDivida = {
            id: dividaId++,
            codigo: codigoTxt,
            // dividas-03: lê o texto da coluna de discriminação até a primeira
            // coluna de VALOR, e não só a faixa estreita da âncora. A
            // justificação empurra parte do texto do credor para além do ponto
            // médio disc/val1 (x≈207 no AJU-01), e `textInColumn` o descartava.
            // O que NÃO é valor monetário, entre a discriminação e val1, é
            // texto do credor — a mesma regra da ficha de Bens.
            discriminacao: normSpace(row.cells
              .filter(c => {
                if (pick(c.x) === 'disc') return true;
                if (dividasAnchors.disc == null || dividasAnchors.val1 == null) return false;
                if (c.x < dividasAnchors.disc || c.x >= dividasAnchors.val1) return false;
                return !EH_VALOR_MONETARIO.test(normSpace(c.text));
              })
              .map(c => c.text).join(' ')).substring(0, 512),
            situacao_anterior: valores.situacao_anterior,
            situacao_atual: valores.situacao_atual,
            valor_pago: valores.valor_pago,
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
        } else if (currentDivida) {
          const extra = normSpace(row.cells.map(c => c.text).join(' '));
          if (extra) currentDivida.discriminacao = normSpace((currentDivida.discriminacao + ' ' + extra)).substring(0, 512);
        }
        continue;
      }

      if (section === 'pagamentos') {
        if (rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text))) {
          pagAnchors = {
            codigo: findCellX(row, 'CÓD.'),
            nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,
            cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?? 254,
            valorPago: findCellXRegex(row, /^VALOR PAGO$/) ?? 431,
            parcNao: findCellXRegex(row, /^PARC\. NÃO$/) ?? 519,
          };
          continue;
        }
        if (!pagAnchors) continue;
        if (rowHasCell(row, 'TOTAL')) {
          if (currentPag) { pagamentos.push(currentPag); currentPag = null; }
          continue;
        }
        if (rowHasCell(row, 'Descrição:')) {
          if (currentPag) {
            const desc = normSpace(row.cells.filter(c => c.text.trim() !== 'Descrição:').map(c => c.text).join(' '));
            currentPag.descricao = normSpace((currentPag.descricao + ' ' + desc)).substring(0, 300);
          }
          continue;
        }
        // Marcadores de agrupamento por titularidade. Cada um abre o bloco da
        // pessoa e vale até o próximo. Vêm numa linha própria, na coluna mais à
        // esquerda, e NÃO são pagamentos.
        const textoRow = normSpace(row.cells.map(c => c.text).join(' '));
        const mDependente = /^Dependente:\s*(.+)$/.exec(textoRow);
        const mAlimentando = /^Alimentando:\s*(.+)$/.exec(textoRow);
        if (mDependente) { titularidadePagamentoAtual = { tipo: 'dependente', nome: normSpace(mDependente[1]) }; continue; }
        if (mAlimentando) { titularidadePagamentoAtual = { tipo: 'alimentando', nome: normSpace(mAlimentando[1]) }; continue; }
        if (textoRow === 'Titular') { titularidadePagamentoAtual = { tipo: 'titular', nome: '' }; continue; }
        const pick = makeColumnPicker(pagAnchors);
        const codigoTxt = textInColumn(row, pick, 'codigo');
        const valorTxt = textInColumn(row, pick, 'valorPago', '');
        if (/^\d{1,3}$/.test(codigoTxt) && valorTxt) {
          if (currentPag) pagamentos.push(currentPag);
          currentPag = {
            id: pagId++,
            codigo: codigoTxt,
            nome_beneficiario: textInColumn(row, pick, 'nome'),
            cpf_cnpj: textInColumn(row, pick, 'cpfcnpj').replace(/\D/g, ''),
            valor_pago: parseMoneyBR(valorTxt),
            parcela_nao_dedutivel: parseMoneyBR(textInColumn(row, pick, 'parcNao', '')),
            descricao: '',
            // A quem a despesa pertence, do marcador de agrupamento acima.
            titularidade: titularidadePagamentoAtual ? titularidadePagamentoAtual.tipo : null,
            titularidadeNome: titularidadePagamentoAtual ? titularidadePagamentoAtual.nome : '',
            // Mesmo achado do caminho .DBK (ver parseDBK, registro 26): sem
            // data, o Dashboard zerava Pagamentos Efetuados sempre que um
            // período estava ativo.
            data: anoCalendario ? `${anoCalendario}-12-31` : '',
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
        } else if (currentPag) {
          const extra = textInColumn(row, pick, 'nome');
          if (extra) currentPag.nome_beneficiario = normSpace(currentPag.nome_beneficiario + ' ' + extra);
        }
        continue;
      }

      if (section === 'bensRurais' || section === 'dividasRurais') {
        const ehBem = section === 'bensRurais';
        if (rowHasCell(row, 'DISCRIMINAÇÃO')) continue;
        // Linha de datas do cabeçalho ("31/12/2024" / "31/12/2025"): não é item.
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (cells.length > 0 && cells.every(t => /^\d{2}\/\d{2}\/\d{4}$/.test(t))) continue;
        if (cells[0] === 'TOTAL') { flushRuralTabelas(); section = null; continue; }
        if (cells.length === 0) continue;

        const valores = cells.filter(t => RV_VALOR.test(t));
        const esperados = ehBem ? 2 : 3;
        // Item novo: começa com o código (bens) ou o número do item (dívidas) e
        // traz todas as colunas de valor da tabela.
        if (/^\d{1,3}$/.test(cells[0]) && valores.length === esperados) {
          flushRuralTabelas();
          const texto = normSpace(cells.filter(t => t !== cells[0] && !RV_VALOR.test(t)).join(' '));
          if (ehBem) {
            const ordem = bensRurais.length + 1;
            const codigo = cells[0].padStart(2, '0');
            const situacaoAnterior = parseMoneyBR(valores[0]);
            currentBemRural = {
              id: bemRuralId++,
              ordemDeclaracao: ordem,
              codigo,
              discriminacao: texto,
              situacao_anterior: situacaoAnterior,
              situacao_atual: parseMoneyBR(valores[1]),
              movimentacoes: [],
              origemDocumento: origemPdf(pageNum, ri + 1),
            };
          } else {
            const ordem = dividasRurais.length + 1;
            const situacaoAnterior = parseMoneyBR(valores[0]);
            currentDividaRural = {
              id: dividaRuralId++,
              ordemDeclaracao: ordem,
              discriminacao: texto,
              situacao_anterior: situacaoAnterior,
              situacao_atual: parseMoneyBR(valores[1]),
              valor_pago: parseMoneyBR(valores[2]),
              movimentacoes: [],
              origemDocumento: origemPdf(pageNum, ri + 1),
            };
          }
          continue;
        }
        // Continuação da discriminação, que ocupa várias linhas e atravessa
        // páginas.
        if (valores.length === 0) {
          const extra = normSpace(cells.join(' '));
          const alvo = ehBem ? currentBemRural : currentDividaRural;
          if (alvo && extra) {
            alvo.discriminacao = normSpace(`${alvo.discriminacao} ${extra}`).substring(0, ehBem ? 512 : 500);
          }
        }
        continue;
      }

      if (section === 'imoveisRurais') {
        if (rowHasCell(row, 'CÓDIGO') || rowHasCell(row, 'ATIVIDADE')) continue;
        const cells = row.cells.map(c => ({ ...c, t: c.text.trim() })).filter(c => c.t);
        if (cells.length === 0) continue;

        // "PARTICIPANTE(S)" abre a lista de coproprietários do imóvel da linha
        // ACIMA. É aqui que o PDF entrega algo que o .DBK não tem: o VÍNCULO
        // entre o participante e o imóvel (ver ATUALIZAÇÃO 3, que registrou
        // esse vínculo como impossível pelo arquivo .DBK).
        if (cells.some(c => c.t === 'PARTICIPANTE(S)')) { emParticipantes = true; continue; }

        const cib = cells.find(c => AR_CIB.test(c.t));
        // Linha de imóvel: código da atividade (2 dígitos) na primeira célula.
        //
        // O CIB NÃO pode ser exigido. Ele é a inscrição do imóvel no cadastro
        // da Receita e a coluna vem VAZIA quando o contribuinte não a
        // preencheu — é o caso do único imóvel do AJU-01 (p11 r7: código 11,
        // participação 75,00, condição 2, nome, área 123,4, coluna CIB sem
        // célula nenhuma). Enquanto era exigido, a linha inteira era
        // descartada: `imoveisRurais` voltava vazio, a ficha inteira sumia, e
        // o participante ficava órfão, com `imovelId` nulo — justamente o
        // vínculo que o comentário acima diz ser o que o PDF entrega e o .DBK
        // não (auditoria de 31/08/2026).
        //
        // O que substitui o CIB como discriminador contra a linha de
        // participante: o código de 2 dígitos sozinho na primeira célula (a de
        // participante começa pelo NOME, ver AR_PARTICIPANTE) mais a FORMA da
        // linha, que traz pelo menos dois números além do código (participação
        // e área) e pelo menos um texto (nome e localização).
        const outras = cells.filter(c => c !== cells[0] && c !== cib);
        const pareceLinhaDeImovel = cib
          || (outras.filter(c => /^[\d.,]+$/.test(c.t)).length >= 2
              && outras.some(c => !/^[\d.,]+$/.test(c.t)));
        if (/^\d{2}$/.test(cells[0].t) && pareceLinhaDeImovel) {
          const numeros = cells.filter(c => c !== cells[0] && c !== cib && /^[\d.,]+$/.test(c.t));
          const texto = cells.filter(c => c !== cells[0] && c !== cib && !/^[\d.,]+$/.test(c.t));
          // Ordem impressa: PARTICIPAÇÃO (%), CONDIÇÃO EXPLORAÇÃO, NOME E
          // LOCALIZAÇÃO, ÁREA (ha), CIB. Participação e condição vêm antes do
          // nome; a área, depois.
          const participacao = numeros[0] ? parseMoneyBR(numeros[0].t) : 0;
          const condicao = numeros[1] ? numeros[1].t : '';
          const area = numeros[2] ? parseMoneyBR(numeros[2].t) : 0;
          ultimoImovelRural = {
            id: imovelRuralId++,
            chaveImportacao: `pdf:imovel-rural:${cib ? cib.t.replace(/\D/g, '') : ''}:${cells[0].t}:${condicao}:${fingerprintTextoPdf(normSpace(texto.map(c => c.t).join(' ')))}`,
            codigoAtividade: cells[0].t,
            participacao,
            condicaoExploracao: condicao,
            nomeLocalizacao: normSpace(texto.map(c => c.t).join(' ')),
            area,
            cib: cib ? cib.t : '',
            dataAquisicao: '',
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
          imoveisRurais.push(ultimoImovelRural);
          emParticipantes = false;
          continue;
        }

        if (emParticipantes) {
          const textoPart = normSpace(cells.map(c => c.t).join(' '));
          const mEstrangeiro = /Estrangeiro:\s*(Sim|Não)/i.exec(textoPart);
          const estrangeiro = mEstrangeiro ? /Sim/i.test(mEstrangeiro[1]) : false;
          const m = AR_PARTICIPANTE.exec(cells[0].t);
          // rural-07: o participante pode NÃO ter CPF (estrangeiro). Antes,
          // AR_PARTICIPANTE (que exige o CPF entre parênteses) não casava e o
          // participante era descartado em silêncio — justamente o caso que a
          // coluna "Estrangeiro" existe para sinalizar. Aqui o nome é lido com
          // ou sem CPF, e a marca de estrangeiro é preservada.
          let nome = '';
          let cpf = '';
          if (m) { nome = normSpace(m[1]); cpf = m[2].replace(/\D/g, ''); }
          else {
            // Sem CPF: o nome é o texto da primeira célula, sem o campo
            // "Estrangeiro:" que às vezes cai na mesma linha à direita.
            nome = normSpace(cells[0].t.replace(/Estrangeiro:.*$/i, ''));
          }
          if (nome) {
            participantesRuraisOficial.push({
              nome,
              cpf,
              estrangeiro,
              // Vínculo que só o PDF entrega (ver ATUALIZAÇÃO 3, que registrou
              // isso como impossível pelo `.DBK`). A chave é o `id` do imóvel,
              // e NÃO o CIB: numa das declarações de referência dois imóveis
              // diferentes compartilham o CIB 2639188-0 (duas partes da mesma
              // fazenda, uma de 147 ha e outra de 105,3 ha, com condições de
              // exploração diferentes). O CIB identifica o imóvel
              // no cadastro da Receita, não a linha da ficha.
              imovelId: ultimoImovelRural ? ultimoImovelRural.id : null,
              imovelCib: ultimoImovelRural ? ultimoImovelRural.cib : '',
              imovelNome: ultimoImovelRural ? ultimoImovelRural.nomeLocalizacao : '',
              imovelChaveImportacao: ultimoImovelRural ? ultimoImovelRural.chaveImportacao : '',
              origemDocumento: origemPdf(pageNum, ri + 1),
            });
          }
          continue;
        }
        // Continuação do nome/localização do imóvel, quebrado em várias linhas.
        if (ultimoImovelRural && cells.every(c => !/^[\d.,]+$/.test(c.t))) {
          ultimoImovelRural.nomeLocalizacao = normSpace(`${ultimoImovelRural.nomeLocalizacao} ${cells.map(c => c.t).join(' ')}`);
        }
        continue;
      }

      if (section === 'rebanho') {
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        if (rowHasCell(row, 'ESPÉCIE')) continue;
        const especie = AR_ESPECIES.find(([re]) => re.test(cells[0]));
        if (!especie) continue;
        const valores = cells.filter(t => RV_VALOR.test(t));
        if (valores.length < AR_REBANHO_COLUNAS.length) continue;
        // rural-06: o nome da espécie pode quebrar em duas linhas ("Asininos,
        // equinos" / "e muares"). Junta a continuação (linha seguinte só de
        // texto) para não gravar o nome cortado.
        let especieNome = cells[0];
        const contRow = rows[ri + 1];
        if (contRow) {
          const contTextos = contRow.cells.map(c => c.text.trim()).filter(Boolean);
          if (contTextos.length > 0 && !contTextos.some(t => RV_VALOR.test(t)) && !AR_ESPECIES.some(([re]) => re.test(contTextos[0]))) {
            especieNome = normSpace(`${especieNome} ${contTextos.join(' ')}`);
          }
        }
        const item = { especieCodigo: especie[1], especieNome };
        item.origemDocumento = origemPdf(pageNum, ri + 1);
        AR_REBANHO_COLUNAS.forEach((chave, i) => { item[chave] = parseMoneyBR(valores[i]); });
        // Espécie inteiramente zerada não gera registro no .DBK; manter a
        // mesma regra evita cinco linhas vazias em toda declaração.
        if (AR_REBANHO_COLUNAS.some(c => item[c] !== 0)) movimentacaoRebanhoOficial.push(item);
        continue;
      }

      if (section === 'receitasDespesasRurais') {
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        // A linha TOTAL fecha a tabela; o total confere com a ficha de
        // apuração, lida logo abaixo, e não precisa entrar como 13º mês.
        if (cells[0] === 'TOTAL') { section = null; continue; }
        const mes = AR_MESES.indexOf(cells[0]);
        if (mes < 0) continue;
        const valores = cells.filter(t => RV_VALOR.test(t));
        if (valores.length < 2) continue;
        // Ordem das colunas conforme o cabeçalho impresso: RECEITA BRUTA e
        // depois DESPESAS DE CUSTEIO/INVESTIMENTO. Conferido pela soma: a
        // primeira coluna fecha com "Receita bruta total" da apuração, e a
        // segunda com "Despesa de custeio e investimento total".
        receitasDespesasRuraisOficial.push({
          mes: mes + 1,
          receitaBruta: parseMoneyBR(valores[0]),
          despesaCusteioInvestimento: parseMoneyBR(valores[1]),
        });
        continue;
      }

      if (section === 'apuracaoRural') {
        // "MOVIMENTAÇÃO DO REBANHO - BRASIL" vem logo depois e encerra esta.
        if (row.cells.some(c => /^MOVIMENTAÇÃO DO REBANHO/.test(c.text.trim()))) { section = null; continue; }  // aqui o prefixo BASTA: as duas versões encerram a apuração
        // "Sem Informações": ficha vazia, não cria objeto (rural-04).
        if (row.cells.some(c => /^Sem Informações$/.test(c.text.trim()))) { section = null; continue; }
        const garanteApuracao = () => { if (!apuracaoResultadoRuralOficial) apuracaoResultadoRuralOficial = { origem: 'pdf' }; return apuracaoResultadoRuralOficial; };
        // rural-03: "Opção pela forma de apuração do resultado tributável" traz
        // um valor de TEXTO ("Pelo resultado"), que paresRotuloValor não pega.
        // Simétrico ao campo opcaoApuracaoResultadoTributavel do .DBK.
        const cellsAp = row.cells.map(c => c.text.trim());
        const iOpc = cellsAp.findIndex(t => /^Opção pela forma de apuração do resultado tributável$/i.test(t));
        if (iOpc >= 0 && cellsAp[iOpc + 1]) {
          garanteApuracao().opcaoApuracao = normSpace(cellsAp[iOpc + 1]);
          continue;
        }
        for (const { rotulo, valor } of paresRotuloValor(row)) {
          const campo = AR_APURACAO_CAMPOS[rotulo];
          if (campo) { garanteApuracao()[campo] = valor; continue; }
          if (AR_ADIANTAMENTO_ANO.test(rotulo)) garanteApuracao().adiantamentoVendaFutura = valor;
          else if (AR_ADIANTAMENTO_ANTERIOR.test(rotulo)) garanteApuracao().adiantamentoAnosAnteriores = valor;
        }
        continue;
      }

      if (section === 'ganhoCapital') {
        if (!currentGc) continue;
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        const proxima = (rows[ri + 1] ? rows[ri + 1].cells.map(c => c.text.trim()).filter(Boolean) : []);
        const primeiraData = (lista) => lista.find(t => GC_DATA.test(t));
        const valoresDe = (lista) => lista.filter(t => RV_VALOR.test(t));
        const percentuaisDe = (lista) => lista.filter(t => GC_PERCENTUAL.test(t));

        // Troca de bloco dentro da ficha (ver GC_BLOCOS).
        const novoBloco = GC_BLOCOS.find(([re]) => cells.some(t => re.test(t)));
        if (novoBloco) {
          gcBloco = novoBloco[1];
          gcEspecEstado = 0;
          // O cabeçalho do bloco "CÁLCULO DO IMPOSTO - ALIENAÇÃO A PRAZO" já é
          // a informação de que a alienação foi parcelada.
          if (gcBloco === 'calculoPrazo' || gcBloco === 'parcelasDetalhe') currentGc.alienacaoAPrazo = true;
          // O cabeçalho pode trazer valor na mesma linha; segue o fluxo.
        }

        // gc-08: tabela "Faixa de Ganho de Capital / Ganho de Capital
        // Distribuído". Quatro linhas de faixa (15%, 17,5%, 20%, 22,5%) e uma
        // linha TOTAL, cada uma com três valores monetários (TOTAL, Anterior,
        // Atual). A alíquota ("15", "17,5") não é RV_VALOR e sai da conta
        // sozinha. Montada na forma do registro 75 do .DBK (faixa1..4 + total).
        if (gcBloco === 'faixas') {
          const ehFaixa = cells.some(t => /^(Até R\$|De R\$|Acima de R\$)/.test(t));
          const ehTotalFaixa = cells.some(t => /^TOTAL$/.test(t)) && !cells.some(t => /^(Até R\$|De R\$|Acima de R\$)/.test(t));
          if (ehFaixa || ehTotalFaixa) {
            const vs = valoresDe(cells);
            const trio = { total: parseMoneyBR(vs[0] || '0'), anterior: parseMoneyBR(vs[1] || '0'), atual: parseMoneyBR(vs[2] || '0') };
            if (!currentGc._faixasTmp) currentGc._faixasTmp = [];
            if (ehTotalFaixa) {
              const t = currentGc._faixasTmp;
              currentGc.faixasTributacao = [{
                faixa1: t[0] || { total: 0, anterior: 0, atual: 0 },
                faixa2: t[1] || { total: 0, anterior: 0, atual: 0 },
                faixa3: t[2] || { total: 0, anterior: 0, atual: 0 },
                faixa4: t[3] || { total: 0, anterior: 0, atual: 0 },
                total: trio,
              }];
              delete currentGc._faixasTmp;
            } else {
              currentGc._faixasTmp.push(trio);
            }
            continue;
          }
        }

        // gc-09: quadro "CUSTO DE AQUISIÇÃO" da participação societária (espécie
        // de participação, quantidade de quotas/ações, custo médio, custo total).
        // A linha de dados vem depois de dois cabeçalhos. Sem parser, a
        // quantidade e o custo médio somiam e custosAquisicao ficava vazio.
        if (gcBloco === 'custoAquisicaoParticipacao') {
          const nums = cells.filter(t => RV_VALOR.test(t) || GC_PERCENTUAL.test(t) || /^[\d.]+$/.test(t));
          const textos = cells.filter(t => !(RV_VALOR.test(t) || GC_PERCENTUAL.test(t) || /^[\d.]+$/.test(t)));
          const ehCabecalho = cells.some(t => /Esp[ée]cie de Participa|Quantidade de|Custo m[ée]dio|Custo total|quotas\/a[çc][õo]es|pond\.|de aquisi/i.test(t));
          if (!ehCabecalho && textos.length > 0 && nums.length >= 3) {
            if (!currentGc.custosAquisicao) currentGc.custosAquisicao = [];
            const registro = {
              especie: normSpace(textos.join(' ')),
              quantidade: parseMoneyBR(nums[0]),
              custoMedio: parseFloat(nums[1].replace(/\./g, '').replace(',', '.')) || 0,
              custoTotal: parseMoneyBR(nums[2]),
            };
            currentGc.custosAquisicao.push(registro);
            // O campo plano que o resto do app consome.
            if (!currentGc.custoAquisicao) currentGc.custoAquisicao = registro.custoTotal;
            continue;
          }
        }

        // gc-12: "Data de Recebimento da Última Parcela" (alienação a prazo).
        if (cells.some(t => /Data de Recebimento da [ÚU]ltima Parcela/i.test(t))) {
          const d = primeiraData(cells) || primeiraData(proxima);
          if (d) currentGc.dataUltimaParcela = dataDDMMAAAAparaIso(d.replace(/\D/g, ''));
          // segue o fluxo: a linha também traz a pergunta da parcela final.
        }

        // gc-02: o imóvel imprime "Especificação e endereço" como cabeçalho, e o
        // nome do bem e o endereço vêm nas linhas SEGUINTES. A versão anterior
        // exigia a célula exata 'Especificação' (que não existe) e o bem ficava
        // vazio. Capturado por estado: 1 = próxima linha é o bem; 2 = linhas de
        // endereço até o próximo bloco.
        if (cells.some(t => /^Especifica[çc][ãa]o( e endere[çc]o)?$/i.test(t))) {
          // Caso raro em que o valor vem na MESMA linha (móvel: "Especificação
          // <texto>"): preserva o comportamento antigo.
          const naMesma = normSpace(cells.filter(t => !/^Especifica/i.test(t)).join(' '));
          if (naMesma) { currentGc.bem = naMesma; gcEspecEstado = 0; }
          else gcEspecEstado = 1;
          continue;
        }
        if (gcEspecEstado === 1) {
          currentGc.bem = normSpace(cells.join(' '));
          gcEspecEstado = 2;
          continue;
        }
        if (gcEspecEstado === 2) {
          const trecho = normSpace(cells.join(' '));
          if (trecho) currentGc.endereco = normSpace(`${currentGc.endereco || ''} ${trecho}`);
          continue;
        }
        // gc-03: no imóvel, "Data de Aquisição:" e "Custo de aquisição (R$):"
        // vêm com o valor NA MESMA linha (maiúscula e dois-pontos). A versão
        // anterior exigia 'Data de aquisição' (minúscula) e lia da linha de
        // baixo, então a data e o custo do imóvel ficavam vazios.
        if (cells.some(t => /^Data de Aquisi[çc][ãa]o:?$/i.test(t))) {
          const d = primeiraData(cells) || primeiraData(proxima);
          if (d) currentGc.dataAquisicao = dataDDMMAAAAparaIso(d.replace(/\D/g, ''));
          continue;
        }
        if (cells.some(t => /^Custo de aquisi[çc][ãa]o( \(R\$\))?:?$/i.test(t))) {
          const v = valoresDe(cells).concat(valoresDe(proxima));
          if (v.length > 0) currentGc.custoAquisicao = parseMoneyBR(v[0]);
          continue;
        }
        if (rowHasCell(row, 'Natureza da operação') || rowHasCell(row, 'Natureza')) {
          // gc-10: na participação a linha traz DOIS rótulos ("Natureza" e
          // "Espécie da participação") e a de baixo, dois valores por posição
          // ("ALIENAÇÕES..." e "QUOTAS"). Lê os dois por coordenada; a branch
          // consumia a linha e a espécie se perdia. No imóvel/móvel só há
          // "Natureza da operação" + o valor de alienação, tratado como antes.
          const temEspecie = cells.some(t => /Esp[ée]cie da participa[çc][ãa]o/i.test(t));
          if (temEspecie) {
            const celE = row.cells.find(c => /Esp[ée]cie da participa/i.test(c.text));
            const proxCells = (rows[ri + 1] ? rows[ri + 1].cells.map(c => ({ x: c.x, t: c.text.trim() })).filter(c => c.t) : []);
            const naturezaCells = proxCells.filter(c => !RV_VALOR.test(c.t) && !GC_DATA.test(c.t) && (!celE || c.x < celE.x - 10));
            const especieCells = celE ? proxCells.filter(c => !RV_VALOR.test(c.t) && c.x >= celE.x - 10) : [];
            if (naturezaCells.length) currentGc.naturezaOperacao = normSpace(naturezaCells.map(c => c.t).join(' '));
            if (especieCells.length) currentGc.especie = normSpace(especieCells.map(c => c.t).join(' '));
          } else {
            currentGc.naturezaOperacao = proxima.find(t => !RV_VALOR.test(t) && !GC_DATA.test(t)) || currentGc.naturezaOperacao;
            const v = valoresDe(proxima);
            if (v.length > 0) currentGc.valorAlienacao = parseMoneyBR(v[0]);
          }
          continue;
        }
        if (rowHasCell(row, 'Data de Alienação')) {
          currentGc.dataAlienacao = dataDDMMAAAAparaIso((primeiraData(proxima) || '').replace(/\D/g, ''));
          const vsAlien = valoresDe(proxima);
          // gc-01: a participação societária imprime TRÊS colunas nesta linha
          // (data | valor de alienação | corretagem). O imóvel/móvel imprime
          // só duas (data | corretagem), e o valor de alienação vem da linha
          // "Natureza da operação". A versão anterior cravava valoresDe[0] em
          // custoCorretagem, e na participação isso gravava o VALOR DE
          // ALIENAÇÃO como corretagem (28x maior), com valorAlienacao=0.
          if (cells.some(t => /Valor de alienação/i.test(t)) && vsAlien.length >= 2) {
            currentGc.valorAlienacao = parseMoneyBR(vsAlien[0]);
            currentGc.custoCorretagem = parseMoneyBR(vsAlien[1]);
          } else {
            currentGc.custoCorretagem = parseMoneyBR(vsAlien[0] || '0');
          }
          continue;
        }
        // Participação societária: nome, CNPJ, município, UF e espécie vêm em
        // pares rótulo-em-cima / valor-embaixo. gc-11: quando a MESMA linha traz
        // vários rótulos ("CNPJ da sociedade | Município | UF"), casa cada um
        // com o valor da coluna correspondente por posição x, e não só o
        // primeiro (a versão anterior usava .find(Boolean) e perdia município
        // e UF; o acerto do CNPJ era acidental).
        {
          const celulasRotuloPar = row.cells
            .map(c => ({ x: c.x, t: c.text.trim(), destino: GC_PARES_LINHA_SEGUINTE[gcNormalizaRotulo(c.text.trim())] }))
            .filter(c => c.destino);
          if (celulasRotuloPar.length > 0 && rows[ri + 1]) {
            const proxCells = rows[ri + 1].cells.map(c => ({ x: c.x, t: c.text.trim() })).filter(c => c.t);
            let casouPar = false;
            for (const rot of celulasRotuloPar) {
              const proximoRot = celulasRotuloPar.filter(r => r.x > rot.x).sort((a, b) => a.x - b.x)[0];
              const limite = proximoRot ? proximoRot.x : Infinity;
              const valorCells = proxCells.filter(c => c.x >= rot.x - 15 && c.x < limite && !RV_VALOR.test(c.t));
              const texto = normSpace(valorCells.map(c => c.t).join(' '));
              if (texto) {
                gcSet(currentGc, rot.destino, rot.destino === 'sociedade.cnpj' ? texto.replace(/\D/g, '') : texto);
                casouPar = true;
              }
            }
            if (casouPar) continue;
          }
        }
        // Endereço do imóvel alienado: o formulário imprime "Endereço" com o
        // logradouro na linha de baixo. Guardado como texto único, que é como
        // a ficha mostra.
        if (rowHasCell(row, 'Endereço') && currentGc.tipo === 'imovel') {
          const texto = normSpace(proxima.filter(t => !RV_VALOR.test(t)).join(' '));
          if (texto) { currentGc.endereco = texto; continue; }
        }
        if (rowHasCell(row, 'CPF/CNPJ') && rowHasCell(row, 'Nome')) {
          const doc = proxima.find(t => GC_DOC.test(t));
          if (doc) currentGc.adquirenteCpfCnpj = doc.replace(/\D/g, '');
          currentGc.adquirenteNome = normSpace(proxima.filter(t => t !== doc).join(' '));
          if (currentGc.adquirenteCpfCnpj || currentGc.adquirenteNome) {
            currentGc.adquirentes.push({ cpfCnpj: currentGc.adquirenteCpfCnpj, nome: currentGc.adquirenteNome });
          }
          continue;
        }

        // Perguntas da ficha (as do imóvel e a de valor do conjunto no móvel).
        // Ficam como texto impresso + resposta: são a informação que a
        // declaração mostra, e o .DBK já entrega as mesmas respostas em campos
        // próprios para quem precisar delas estruturadas.
        {
          const pergunta = cells.find(t => t.trim().endsWith('?'));
          if (pergunta) {
            // A resposta marcada aparece de duas formas no formulário: numa
            // célula só ("Sim (  )   Não ( X )") ou em DUAS células separadas
            // ("Sim ( )" e "Não ( X )"), que é como o pdf.js entrega na maior
            // parte das páginas. Juntar as células antes de procurar o "X"
            // cobre os dois casos — sem isso, metade das perguntas era
            // importada com resposta vazia.
            const marcacao = normSpace(cells.filter(t => /^(Sim|Não)\s*\(/.test(normSpace(t))).join(' '));
            const respostaSimples = cells.find(t => /^(Sim|Não)$/.test(t));
            let resposta = respostaSimples || null;
            if (!resposta && marcacao) resposta = /Sim\s*\(\s*X/i.test(marcacao) ? 'Sim' : (/Não\s*\(\s*X/i.test(marcacao) ? 'Não' : null);
            if (!resposta) {
              const naProxima = proxima.find(t => /^(Sim|Não)$/.test(t));
              if (naProxima) resposta = naProxima;
              else {
                const marcacaoProxima = normSpace(proxima.filter(t => /^(Sim|Não)\s*\(/.test(normSpace(t))).join(' '));
                if (marcacaoProxima) resposta = /Sim\s*\(\s*X/i.test(marcacaoProxima) ? 'Sim' : (/Não\s*\(\s*X/i.test(marcacaoProxima) ? 'Não' : null);
              }
            }
            // As perguntas "Última Parcela?" se repetem uma vez por parcela no
            // detalhamento; o dado delas já está em cada item de `parcelas`.
            if (gcBloco !== 'parcelasDetalhe') {
              currentGc.perguntasImpressas.push({ pergunta: normSpace(pergunta), resposta: resposta || '' });
            }
            if (/prazo\/presta/i.test(pergunta) && resposta) currentGc.alienacaoAPrazo = resposta === 'Sim';
            if (/Sujeito a Registro P[úu]blico/i.test(pergunta) && resposta) currentGc.sujeitoRegistroPublico = resposta === 'Sim';
            if (/alienação parcial desse bem/i.test(pergunta) && resposta) currentGc.houveAlienacaoParcialAnterior = resposta === 'Sim';
            continue;
          }
        }

        // Linha da tabela de parcelas (alienação a prazo): data seguida das 8
        // colunas do quadro, na ordem impressa. A linha "Total" tem a mesma
        // forma, sem data, e vira o total do quadro.
        if ((gcBloco === 'calculoPrazo' || gcBloco === 'parcelasDetalhe') && primeiraData(cells)) {
          const numeros = cells.filter(t => RV_VALOR.test(t) || GC_PERCENTUAL.test(t));
          if (numeros.length >= 8) {
            currentGc.parcelas.push({
              data: dataDDMMAAAAparaIso((primeiraData(cells) || '').replace(/\D/g, '')),
              valorRecebido: parseMoneyBR(numeros[0]),
              custoCorretagem: parseMoneyBR(numeros[1]),
              valorLiquido: parseMoneyBR(numeros[2]),
              custoAquisicaoProporcional: parseMoneyBR(numeros[3]),
              ganhoCapitalProporcional: parseMoneyBR(numeros[4]),
              aliquotaMedia: parseMoneyBR(numeros[5]),
              impostoDevido: parseMoneyBR(numeros[6]),
              impostoPago: parseMoneyBR(numeros[7]),
            });
            continue;
          }
        }

        // Linha "Total" do quadro de parcelas: mesmas colunas, sem data.
        if ((gcBloco === 'calculoPrazo' || gcBloco === 'parcelasDetalhe') && cells.some(t => /^Total$/.test(t))) {
          const numeros = cells.filter(t => RV_VALOR.test(t) || GC_PERCENTUAL.test(t));
          if (numeros.length >= 8) {
            currentGc.calculoImposto = {
              ...(currentGc.calculoImposto || {}),
              totalRecebidoParcelas: parseMoneyBR(numeros[0]),
              totalCorretagemParcelas: parseMoneyBR(numeros[1]),
              totalLiquidoParcelas: parseMoneyBR(numeros[2]),
              totalAquisicaoParcelas: parseMoneyBR(numeros[3]),
              ganhoCapitalTotal: parseMoneyBR(numeros[4]),
              aliquotaMedia: parseMoneyBR(numeros[5]),
              impostoDevido: parseMoneyBR(numeros[6]),
              impostoPago: parseMoneyBR(numeros[7]),
            };
            continue;
          }
        }

        // Soma dos ganhos de alienações anteriores: rótulo e valor podem cair
        // na mesma linha ou na de baixo.
        if (cells.some(t => /^Soma dos Ganhos de Capital de alienações anteriores/.test(t))) {
          const v = valoresDe(cells).concat(valoresDe(proxima));
          if (v.length > 0) currentGc.ganhoAlienacoesAnteriores = parseMoneyBR(v[0]);
          continue;
        }

        // Quadro por rótulo, dentro do bloco corrente.
        //
        // O casamento é POR POSIÇÃO, não pela ordem da lista: uma linha do
        // quadro "alienação a prazo" traz TRÊS pares rótulo-valor de uma vez
        // ("Valor Recebido (R$) 6.000,00 Custo de Corretagem (R$) 0,00 Valor
        // Líquido Recebido (R$) 6.000,00"). Pegar sempre o último valor da
        // linha, como a primeira versão fazia, colocaria o mesmo número nos
        // três campos.
        {
          const tabela = GC_ROTULOS[gcBloco] || {};
          const ehValor = (t) => RV_VALOR.test(t) || GC_PERCENTUAL.test(t);
          const soUnidade = (t) => /^\((R\$|%|US\$)\)$/.test(t);
          const celulas = row.cells.map(c => ({ x: c.x, t: c.text.trim() })).filter(c => c.t);
          const celulasRotulo = celulas.filter(c => !ehValor(c.t) && !soUnidade(c.t));
          const celulasValor = celulas.filter(c => ehValor(c.t));
          let casou = false;
          for (const cel of celulasRotulo) {
            const rotulo = gcNormalizaRotulo(cel.t);
            // "Devido em 2025" e "Referente à alienação em 2025" trazem o ano
            // junto; casa pelo prefixo.
            const destino = tabela[rotulo]
              || tabela[Object.keys(tabela).find(k => rotulo.startsWith(k)) || ''];
            if (!destino) continue;
            const proximoRotulo = celulasRotulo.find(r => r.x > cel.x);
            const limite = proximoRotulo ? proximoRotulo.x : Infinity;
            const valor = celulasValor.find(v => v.x > cel.x && v.x < limite);
            if (!valor) continue;
            gcSet(currentGc, destino, parseMoneyBR(valor.t));
            casou = true;
          }
          if (casou) {
            // O ganho apurado é o número que a tela do app mostra como "ganho
            // de capital" da operação — mantido no campo plano que o resto do
            // app já consome.
            if (currentGc.apuracao?.ganhoCapital != null) currentGc.ganhoCapital = currentGc.apuracao.ganhoCapital;
            continue;
          }
        }
        continue;
      }

      // Ganho de capital de MOEDA ESTRANGEIRA EM ESPÉCIE: ficha própria, com
      // uma tabela de alienações e a totalização mensal (que é onde a isenção
      // dos US$ 5.000 do ano aparece).
      if (section === 'ganhoCapitalMoeda') {
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        const fecharMoeda = () => {
          if (currentGcMoeda && (currentGcMoeda.data || currentGcMoeda.valor)) gcMoedaOperacoesPdf.push(currentGcMoeda);
          currentGcMoeda = null;
        };
        // TOTALIZAÇÃO fecha a alienação em montagem e troca de bloco.
        if (cells.some(t => /^TOTALIZAÇÃO$/.test(t))) { fecharMoeda(); gcMoedaBloco = 'totalizacao'; continue; }
        if (cells.some(t => /^ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE$/.test(t))) { gcMoedaBloco = 'alienacoes'; continue; }
        if (cells.some(t => /^Sem Informações$/.test(t))) continue;
        const numeros = cells.filter(t => RV_VALOR.test(t) || GC_PERCENTUAL.test(t));

        // gc-04: a alienação detalhada de moeda em espécie. O formulário NÃO
        // imprime o cabeçalho "ALIENAÇÃO DE MOEDA ESTRANGEIRA EM ESPÉCIE" que a
        // versão anterior exigia — a alienação vem como uma sequência de blocos
        // rótulo/valor (AJU-01 p22 r5-r11), e por isso nunca era lida.
        if (gcMoedaBloco !== 'totalizacao') {
          // "DÓLAR (ESTADOS UNIDOS)" abre uma nova moeda.
          if (cells.length === 1 && /\(.+\)$/.test(cells[0]) && !RV_VALOR.test(cells[0]) && !/R\$|US\$|%/.test(cells[0])) {
            fecharMoeda();
            currentGcMoeda = { moeda: normSpace(cells[0]), adquirenteNome: '', adquirenteCpfCnpj: '', data: '', quantidade: 0, valor: 0, custoMedio: 0, custoTotal: 0, ganhoCapital: 0, origem: 'pdf', origemDocumento: origemPdf(pageNum, ri + 1) };
            continue;
          }
          if (!currentGcMoeda) continue;
          const proxCells = (rows[ri + 1] ? rows[ri + 1].cells.map(c => c.text.trim()).filter(Boolean) : []);
          const proxNums = proxCells.filter(t => RV_VALOR.test(t) || GC_PERCENTUAL.test(t) || /^[\d.]+$/.test(t));
          // Adquirente: "CPF/CNPJ do Adquirente | Nome do Adquirente".
          if (cells.some(t => /CPF\/CNPJ do Adquirente/i.test(t))) {
            const doc = proxCells.find(t => GC_DOC.test(t));
            if (doc) currentGcMoeda.adquirenteCpfCnpj = doc.replace(/\D/g, '');
            currentGcMoeda.adquirenteNome = normSpace(proxCells.filter(t => t !== doc).join(' '));
            continue;
          }
          // "Data da Alienação | Quantidade | Valor da Alienação (R$)".
          if (cells.some(t => /Data da Aliena[çc][ãa]o/i.test(t))) {
            const d = proxCells.find(t => GC_DATA.test(t));
            if (d) currentGcMoeda.data = dataDDMMAAAAparaIso(d.replace(/\D/g, ''));
            const vs = proxCells.filter(t => RV_VALOR.test(t));
            if (vs.length >= 2) { currentGcMoeda.quantidade = parseMoneyBR(vs[0]); currentGcMoeda.valor = parseMoneyBR(vs[1]); }
            else if (vs.length === 1) currentGcMoeda.valor = parseMoneyBR(vs[0]);
            continue;
          }
          // "Custo Médio (R$) | Custo de Aquisição (R$) | Ganho de Capital (R$)".
          if (cells.some(t => /Custo M[ée]dio/i.test(t))) {
            const custoMedioTxt = proxCells.find(t => GC_PERCENTUAL.test(t) || /^[\d.]+,\d{4,6}$/.test(t));
            const vs = proxCells.filter(t => RV_VALOR.test(t));
            if (custoMedioTxt) currentGcMoeda.custoMedio = parseFloat(custoMedioTxt.replace(/\./g, '').replace(',', '.')) || 0;
            if (vs.length >= 2) { currentGcMoeda.custoTotal = parseMoneyBR(vs[0]); currentGcMoeda.ganhoCapital = parseMoneyBR(vs[1]); }
            continue;
          }
          continue;
        }
        if (gcMoedaBloco === 'totalizacao') {
          // Linha do mês: o nome do mês (ou o número) abre a linha e as sete
          // colunas do quadro vêm em seguida.
          const nomeMes = cells.map(t => GC_MOEDA_MESES.indexOf(normSpace(t).toUpperCase())).find(i => i >= 0);
          if (nomeMes != null && nomeMes >= 0 && numeros.length >= 6) {
            gcMoedaMensalPdf.push({
              mes: nomeMes + 1,
              alienacaoDolar: parseMoneyBR(numeros[0]),
              alienacaoConsolidadaDolar: parseMoneyBR(numeros[1]),
              ganhoCapital: parseMoneyBR(numeros[2]),
              ganhoCapitalTributavel: parseMoneyBR(numeros[3]),
              aliquota: parseMoneyBR(numeros[4]),
              impostoDevido: parseMoneyBR(numeros[5]),
              impostoPago: numeros[6] != null ? parseMoneyBR(numeros[6]) : 0,
          origem: 'pdf',
          origemDocumento: origemPdf(pageNum, ri + 1),
            });
          }
          continue;
        }
        if (gcMoedaBloco === 'alienacoes' && numeros.length >= 3) {
          const data = cells.find(t => GC_DATA.test(t));
          const doc = cells.find(t => GC_DOC.test(t));
          const texto = cells.filter(t => !RV_VALOR.test(t) && !GC_PERCENTUAL.test(t) && !GC_DATA.test(t) && !GC_DOC.test(t));
          gcMoedaOperacoesPdf.push({
            data: data ? dataDDMMAAAAparaIso(data.replace(/\D/g, '')) : '',
            descricao: normSpace(texto.join(' ')),
            adquirenteCpfCnpj: doc ? doc.replace(/\D/g, '') : '',
            valores: numeros.map(parseMoneyBR),
            origem: 'pdf',
          });
        }
        continue;
      }

      if (section === 'lei14754') {
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (cells.length === 0) continue;
        // A legenda no rodapé da ficha encerra a leitura.
        if (cells[0] === 'Legenda Tipo') { section = null; continue; }
        // Linha de um bem: número do bem, tipo (AF/LD) e as 5 colunas.
        if (/^\d+$/.test(cells[0]) && EXT_TIPO.test(cells[1] || '')) {
          const valores = cells.slice(2).filter(t => RV_VALOR.test(t) || t === '-');
          const item = { bem: parseInt(cells[0], 10), tipo: cells[1] };
          EXT_COLUNAS.forEach((chave, i) => {
            const t = valores[i];
            item[chave] = t === undefined || t === '-' ? 0 : parseMoneyBR(t);
          });
          demonstrativoExteriorOficial.push(item);
        }
        continue;
      }

      if (section === 'resumo') {
        if (rowHasCell(row, 'RENDIMENTOS TRIBUTÁVEIS')) { resumoBloco = 'rendimentos'; continue; }
        if (rowHasCell(row, 'DEDUÇÕES')) { resumoBloco = 'deducoes'; continue; }

        // resumo-01: "IMPOSTO A RESTITUIR" imprime o rótulo numa linha e o valor
        // na linha SEGUINTE, sozinho (Δy=3 > TOLERANCIA_LINHA), então nunca
        // caía no mesmo par rótulo/valor. Lido explicitamente da próxima linha.
        if (rowHasCell(row, 'IMPOSTO A RESTITUIR')) {
          const prox = rows[ri + 1] ? rows[ri + 1].cells.map(c => c.text.trim()).filter(Boolean) : [];
          const v = prox.find(t => RV_VALOR.test(t));
          if (v != null) impostoDevido.impostoRestituir = parseMoneyBR(v);
        }
        // resumo-07: "Número de Quotas" traz um INTEIRO ("1"), que não é
        // RV_VALOR e escapa de paresRotuloValor. Lido por célula adjacente.
        {
          const cellsR = row.cells.map(c => c.text.trim());
          const iQ = cellsR.findIndex(t => /^Número de Quotas$/.test(t));
          if (iQ >= 0 && cellsR[iQ + 1] && /^\d+$/.test(cellsR[iQ + 1])) {
            impostoDevido.numeroQuotas = parseInt(cellsR[iQ + 1], 10);
          }
        }

        for (const { rotulo, valor } of paresRotuloValor(row)) {
          // "TOTAL" aparece duas vezes na página, uma por bloco; o rótulo
          // sozinho não diz qual é.
          if (rotulo === 'TOTAL') {
            if (resumoBloco === 'rendimentos') impostoDevido.rendimentosTributaveisTotal = valor;
            else if (resumoBloco === 'deducoes') impostoDevido.totalDeducoes = valor;
            continue;
          }
          const campo = RESUMO_CAMPOS[rotulo]
            || (RESUMO_CAMPOS_PREFIXO.find(([pref]) => rotulo.startsWith(pref)) || [])[1];
          if (campo) { impostoDevido[campo] = valor; continue; }
          for (const [re, [campoAnterior, campoAtual]] of RESUMO_EVOLUCAO) {
            if (!re.test(rotulo)) continue;
            const vistos = resumoEvolucaoVistos[campoAnterior] || 0;
            impostoDevido[vistos === 0 ? campoAnterior : campoAtual] = valor;
            resumoEvolucaoVistos[campoAnterior] = vistos + 1;
            break;
          }
        }
        continue;
      }

      if (section === 'espolio') {
        // "Final de Espólio" e "Ano do óbito" são rótulos numa linha com os
        // valores na de BAIXO (ESP-01 p1 r19/r20), diferente do resto do
        // quadro, que é rótulo e valor na mesma linha.
        if (row.cells.some(c => /^Final de Espólio/.test(c.text.trim()))) {
          const abaixo = (rows[ri + 1]?.cells || []).map(c => c.text.trim()).filter(Boolean);
          if (abaixo[0]) { espolioOficial = espolioOficial || { origem: 'pdf' }; espolioOficial.modalidade = abaixo[0]; }
          if (abaixo[1]) { espolioOficial = espolioOficial || { origem: 'pdf' }; espolioOficial.anoObito = abaixo[1]; }
        }
        for (const { rotulo, valor } of paresRotuloTexto(row)) {
          const campo = ESPOLIO_CAMPOS[rotulo];
          if (campo && valor) { espolioOficial = espolioOficial || { origem: 'pdf' }; espolioOficial[campo] = valor; }
        }
        for (const [pergunta, campo] of ESPOLIO_PERGUNTAS) {
          const i = row.cells.findIndex(c => normSpace(c.text) === pergunta);
          if (i < 0) continue;
          const resposta = row.cells.slice(i + 1).map(c => c.text.trim()).find(Boolean);
          if (resposta) { espolioOficial = espolioOficial || { origem: 'pdf' }; espolioOficial[campo] = resposta; }
        }
        continue;
      }

      if (section === 'herdeirosEspolio') {
        if (rowHasCell(row, 'CPF / CNPJ') || rowHasCell(row, 'NOME')) continue;
        // Herdeiro do ESPÓLIO, que é a lista da declaração inteira. Não
        // confundir com bem.herdeiros, que é o rateio de UM bem na partilha.
        const doc = row.cells.map(c => c.text.trim()).find(t => /^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(t));
        if (doc) {
          const nome = row.cells.map(c => c.text.trim()).filter(t => t && t !== doc).join(' ');
          espolioOficial = espolioOficial || { origem: 'pdf' };
          espolioOficial.herdeiros = espolioOficial.herdeiros || [];
          espolioOficial.herdeiros.push({ cpf_cnpj: normalizarCpfCnpj(doc), nome: normSpace(nome) });
        }
        continue;
      }

      if (section === 'saida') {
        for (const { rotulo, valor } of paresRotuloTexto(row)) {
          const campo = SAIDA_CAMPOS[rotulo];
          // Valor vazio não vira campo: no SAI-01 a "data da caracterização da
          // condição de residente" vem em branco, e gravá-la como string vazia
          // faria a tela afirmar que a pessoa voltou a ser residente.
          if (campo && valor) { saidaDefinitivaOficial = saidaDefinitivaOficial || { origem: 'pdf' }; saidaDefinitivaOficial[campo] = valor; }
        }
        continue;
      }

      if (section === 'dependentes') {
        if (rowHasCell(row, 'CÓDIGO') && rowHasCell(row, 'NOME')) continue;
        // "TOTAL DE DEDUÇÃO COM DEPENDENTES" fecha a ficha; o valor dele é a
        // dedução legal por dependente, que já vem pela ficha de Imposto
        // Devido e não é atributo de nenhum dependente em particular.
        if (row.cells.some(c => /^TOTAL DE DEDUÇÃO COM DEPENDENTES$/.test(c.text.trim()))) { section = null; continue; }
        if (row.cells.some(c => DEP_RUIDO.test(c.text.trim()))) {
          const ultimo = dependentes[dependentes.length - 1];
          if (ultimo) {
            const linha = normSpace(row.cells.map(c => c.text).join(' '));
            const meta = /Email\s*:\s*(.*?)\s+Celular\s*:\s*(.*?)\s+Raça\/Cor:\s*(.*)$/i.exec(linha);
            if (meta) {
              ultimo.email = normSpace(meta[1]);
              const celularDigitos = normSpace(meta[2]).replace(/\D/g, '');
              ultimo.dddCelular = celularDigitos.length > 9 ? celularDigitos.slice(0, -9) : '';
              ultimo.celular = celularDigitos.slice(-9);
              ultimo.racaCor = normSpace(meta[3]);
              if (/^Não informada$/i.test(ultimo.racaCor)) ultimo.racaCorCodigo = '0';
            }
            const mora = /Dependente mora com o titular da declaração\?\s*(Sim|Não)/i.exec(linha);
            if (mora) ultimo.moraComTitular = simNaoTexto(mora[1]);
          }
          continue;
        }

        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        const data = cells.find(t => DEP_DATA.test(t));
        const cpf = cells.find(t => DEP_CPF.test(t));
        // Um dependente é reconhecido pelo par código + nome. Exigir a data
        // também deixaria de fora um dependente sem data preenchida, que a
        // ficha aceita.
        if (!/^\d{1,2}$/.test(cells[0] || '')) continue;
        const nome = cells.slice(1).find(t => !DEP_DATA.test(t) && !DEP_CPF.test(t));
        if (!nome) continue;
        dependentes.push({
          id: depId++,
          nome,
          cpf: cpf ? cpf.replace(/\D/g, '') : '',
          dataNascimento: data ? dataDDMMAAAAparaIso(data.replace(/\D/g, '')) : '',
          // Código cru, igual ao que o .DBK entrega (ver registro 25).
          parentesco: cells[0].padStart(2, '0'),
          saidaComDeclarante: false,
          nitPisPasep: '',
          moraComTitular: null,
          email: '',
          dddCelular: '',
          celular: '',
          racaCorCodigo: '',
          origemDocumento: origemPdf(pageNum, ri + 1),
        });
        continue;
      }

      if (section === 'rendimentosIsentosExclusiva') {
        // Cabeçalho da sub-tabela. Monta as âncoras de coluna a partir dele; a
        // variante comum tem "CNPJ/CPF da Fonte/Doador" + "Nome da Fonte/
        // Doador", a de prêmios tem só "Descrição", a do código 99 tem "Nome"
        // E "Descrição". Nenhuma é item.
        if (rowHasCell(row, 'Beneficiário') && rowHasCell(row, 'Valor')) {
          rieAnchors = {
            beneficiario: findCellX(row, 'Beneficiário'),
            cpf: findCellX(row, 'CPF'),
            doc: findCellXRegex(row, /CNPJ da Fonte|CPF\/CNPJ (do|da)/),
            nome: findCellXRegex(row, /^Nome (da|do)/),
            descricao: findCellX(row, 'Descrição'),
            valor: findCellX(row, 'Valor'),
          };
          rieAguardandoDetalhe = true;
          continue;
        }
        if (rowHasCell(row, 'TOTAL')) { flushRie(); rieAnchors = null; rieAguardandoDetalhe = false; continue; }
        if (rowHasCell(row, 'Sem Informações')) { flushRie(); rieAnchors = null; rieAguardandoDetalhe = false; continue; }

        const cells = row.cells.map(c => ({ ...c, t: c.text.trim() })).filter(c => c.t);
        if (cells.length === 0) continue;
        const valores = cells.filter(c => RV_VALOR.test(c.t));

        // Linha de DETALHE: começa com "Titular" ou "Dependente". Lida por
        // COLUNA (âncoras do cabeçalho), separando nome da fonte, descrição e o
        // documento da fonte/doador — que antes se misturavam num campo só.
        if (RIE_BENEFICIARIO.test(cells[0].t) && rieGrupo) {
          rieAguardandoDetalhe = false;
          const pick = rieAnchors ? makeColumnPicker(rieAnchors) : null;
          const naColuna = (nome) => pick ? normSpace(cells.filter(c => pick(c.x) === nome).map(c => c.t).join(' ')) : '';
          const cpf = cells.find(c => RIE_CPF.test(c.t) && (!pick || pick(c.x) === 'cpf'));
          // Documento da fonte/doador: pode ser CPF (doador PF) ou CNPJ. Fica
          // na coluna 'doc', à direita da coluna 'cpf' do beneficiário.
          const doc = cells.find(c => (RIE_CPF.test(c.t) || RIE_CNPJ.test(c.t)) && c !== cpf && (!pick || pick(c.x) === 'doc'));
          const ultimoValor = valores[valores.length - 1];
          let nome, descricao;
          if (pick && rieAnchors.nome != null) {
            // Tem coluna Nome (e talvez Descrição, no código 99): campos
            // separados.
            nome = naColuna('nome');
            descricao = rieAnchors.descricao != null ? naColuna('descricao') : '';
          } else if (pick && rieAnchors.descricao != null) {
            // Prêmios de loteria: só coluna Descrição, sem Nome. Aqui a
            // descrição É o nome da fonte (não há outro), então vira nome_fonte.
            nome = naColuna('descricao');
            descricao = '';
          } else {
            nome = normSpace(cells.filter(c => c !== cells[0] && c !== cpf && c !== doc && c !== ultimoValor).map(c => c.t).join(' '));
            descricao = '';
          }
          rieGrupo.detalhes.push({
            // Página e linha de onde ESTE detalhe saiu, para a tela poder
            // apontar o item de volta na declaração impressa.
            origemDocumento: origemPdf(pageNum, ri + 1),
            beneficiario: cells[0].t,
            cpf: cpf ? cpf.t.replace(/\D/g, '') : '',
            cnpj: doc ? doc.t.replace(/\D/g, '') : '',
            nome,
            ...(descricao ? { descricao } : {}),
            valor: ultimoValor ? parseMoneyBR(ultimoValor.t) : 0,
          });
          continue;
        }

        // Linha AGREGADA: "09. Lucros e dividendos recebidos ... 9.542.194,93".
        // Exige o valor na mesma linha para não confundir com a continuação da
        // descrição, que vem sem valor nenhum.
        const agregada = RIE_AGREGADA.exec(cells[0].t);
        if (agregada && valores.length === 1 && cells[0] !== valores[0]) {
          flushRie();
          rieGrupo = {
            categoria: rieCategoria,
            codigo: agregada[1],
            descricao: normSpace(agregada[2]),
            valorAgregado: parseMoneyBR(valores[0].t),
            // Origem da linha AGREGADA, usada quando o código não tem
            // sub-tabela e é ela que vira o rendimento.
            origemDocumento: origemPdf(pageNum, ri + 1),
            detalhes: [],
          };
          continue;
        }

        // Layout ALTERNATIVO de sub-tabela, usado pelo código 10 dos isentos
        // (parcela isenta de aposentadoria de quem tem 65 anos ou mais): ali o
        // cabeçalho não tem coluna "Valor" e a linha do beneficiário vem SEM
        // valor nenhum; o valor aparece na linha seguinte, rotulado, e ainda
        // dividido em dois ("Valor: 22.847,76   13º Salário: 1.903,98", que
        // somam os 24.751,74 do agregado).
        //
        // Este caso custou um valor inteiro sumindo do import: a linha do
        // beneficiário entrava com valor zero e a linha dos valores era
        // descartada por não parecer nem agregado nem detalhe. Achado ao
        // confrontar o resultado do PDF contra o do .DBK do mesmo declarante.
        if (rowHasCell(row, 'Valor:') && rieGrupo && rieGrupo.detalhes.length > 0) {
          const ultimo = rieGrupo.detalhes[rieGrupo.detalhes.length - 1];
          const xValor = findCellX(row, 'Valor:');
          const x13 = findCellXRegex(row, /^13º Salário:$/);
          const aposRotulo = (xRotulo) => xRotulo == null
            ? null
            : cells.filter(c => RV_VALOR.test(c.t) && c.x > xRotulo).sort((a, b) => a.x - b.x)[0];
          const principal = aposRotulo(xValor);
          const decimoTerceiro = aposRotulo(x13);
          // O 13º é somado no valor porque é assim que o agregado da ficha o
          // conta, e é assim que o .DBK entrega o mesmo código; fica também
          // guardado à parte, sem entrar em conta duas vezes.
          const v1 = principal ? parseMoneyBR(principal.t) : 0;
          const v2 = decimoTerceiro && decimoTerceiro !== principal ? parseMoneyBR(decimoTerceiro.t) : 0;
          ultimo.valor = v1 + v2;
          ultimo.decimoTerceiro = v2;
          continue;
        }

        // Sem valor e com texto: é continuação.
        if (valores.length === 0 && rieGrupo) {
          // rend-05: a linha entre o cabeçalho e o primeiro detalhe é a
          // CONTINUAÇÃO do cabeçalho ("Pagadora" / "Pagadora"), não a descrição
          // do código. Antes ela era colada em rieGrupo.descricao, produzindo
          // "Outros Pagadora Pagadora".
          if (rieAguardandoDetalhe) continue;
          const ultimo = rieGrupo.detalhes[rieGrupo.detalhes.length - 1];
          if (ultimo) {
            // Wrap de uma linha de detalhe: continua nome e descrição por
            // COLUNA, para o pedaço de descrição não invadir o nome.
            const pick = rieAnchors ? makeColumnPicker(rieAnchors) : null;
            if (pick && rieAnchors.descricao != null) {
              const nomeExtra = normSpace(cells.filter(c => pick(c.x) === 'nome').map(c => c.t).join(' '));
              const descExtra = normSpace(cells.filter(c => pick(c.x) === 'descricao').map(c => c.t).join(' '));
              if (nomeExtra) ultimo.nome = normSpace(`${ultimo.nome} ${nomeExtra}`);
              if (descExtra) ultimo.descricao = normSpace(`${ultimo.descricao || ''} ${descExtra}`);
            } else {
              const texto = normSpace(cells.map(c => c.t).join(' '));
              if (texto) ultimo.nome = normSpace(`${ultimo.nome} ${texto}`);
            }
          } else {
            const texto = normSpace(cells.map(c => c.t).join(' '));
            if (texto) rieGrupo.descricao = normSpace(`${rieGrupo.descricao} ${texto}`);
          }
        }
        continue;
      }

      if (section === 'rendimentosPJ') {
        // As duas linhas do cabeçalho da tabela ("NOME DA FONTE PAGADORA ..."
        // e a continuação "DE PES. JURÍDICA / OFICIAL / ...") não são item.
        if (rowHasCell(row, RPJ_CABECALHO)) { flushRpj(); continue; }
        if (rowHasCell(row, 'TOTAL')) { flushRpj(); continue; }

        // "Data da comunicação da condição de não residente à fonte pagadora"
        // (SAI-01 p1 r35). A ficha só a imprime na declaração de SAÍDA
        // DEFINITIVA, e ela vem DEPOIS da linha do CNPJ, que já fechou o item:
        // por isso a data é gravada no último rendimento emitido, e não no
        // item corrente.
        //
        // RIGOR FISCAL: é a partir dessa comunicação que a fonte pagadora
        // passa a tratar quem declara como NÃO RESIDENTE, e a retenção deixa
        // de seguir a tabela progressiva. A data da saída e a data da
        // comunicação são coisas diferentes e podem não coincidir.
        const comunicacao = RPJ_COMUNICACAO_NAO_RESIDENTE.exec(normSpace(row.cells.map(c => c.text).join(' ')));
        if (comunicacao) {
          const alvoRpj = currentRpj || [...rendimentos].reverse().find(r => r.tipo === 'tributavel_pj');
          if (alvoRpj) alvoRpj.dataComunicacaoNaoResidente = dataDDMMAAAAparaIso(comunicacao[1].replace(/\D/g, ''));
          continue;
        }

        // Linha "CNPJ/CPF: <doc>" fecha o item e traz os documentos. Na ficha
        // dos dependentes ela traz DOIS documentos: o da fonte pagadora
        // primeiro e, depois de "CPF DO DEPENDENTE:", o do dependente. É por
        // isso que a posição do rótulo importa aqui, e não só a ordem crua.
        if (rowHasCell(row, 'CNPJ/CPF:') && currentRpj) {
          const xRotuloDep = findCellXRegex(row, RPJ_CPF_DEPENDENTE);
          const docs = row.cells.filter(c => RPJ_DOC.test(c.text.trim()));
          const daFonte = docs.find(c => xRotuloDep == null || c.x < xRotuloDep);
          const doDependente = xRotuloDep == null ? null : docs.find(c => c.x > xRotuloDep);
          if (daFonte) currentRpj.cnpj_fonte = daFonte.text.trim().replace(/\D/g, '');
          if (doDependente) currentRpj.cpf_dependente = doDependente.text.trim().replace(/\D/g, '');
          flushRpj();
          continue;
        }

        const { rotulo, valores } = separarRotuloEValores(row);
        if (!rotulo && valores.length === 0) continue;
        // Ficha inteira vazia: não pode virar rendimento zerado.
        if (rotulo === 'Sem Informações') { flushRpj(); continue; }

        // Uma linha de item tem o nome da fonte e as 5 colunas de valor. Menos
        // que isso e não é item: exigir a contagem exata é o que impede uma
        // linha de outra tabela de virar rendimento se a seção ficar aberta
        // por engano.
        if (valores.length === RPJ_COLUNAS.length) {
          flushRpj();
          currentRpj = {
            id: rendId++,
            tipo: 'tributavel_pj',
            cnpj_fonte: '',
            nome_fonte: rotulo,
            beneficiario: rpjBeneficiario,
            cpf_dependente: null,
            // Mesma data convencional do .DBK (ver registro 21): a ficha é um
            // total anual, não um lançamento datado, e sem data o rendimento
            // seria descartado por qualquer consulta com período.
            data: anoCalendario ? `${anoCalendario}-12-31` : '',
            origemDocumento: origemPdf(pageNum, ri + 1),
          };
          RPJ_COLUNAS.forEach((chave, i) => { currentRpj[chave] = parseMoneyBR(valores[i]); });
          continue;
        }
        // Sem valor nenhum e com texto: é a continuação do nome da fonte, que
        // o formulário quebra em até três linhas.
        if (valores.length === 0 && currentRpj) {
          currentRpj.nome_fonte = normSpace(`${currentRpj.nome_fonte} ${rotulo}`);
        }
        continue;
      }

      if (section === 'rendaVariavel') {
        // O marcador do mês fecha a ficha anterior e abre a próxima. Vem
        // sozinho na linha ou dividindo a linha com "(Valores em Reais)", daí
        // a busca por célula exata em vez do rótulo montado.
        const marcador = row.cells
          .map(c => RV_MARCADOR_MES.exec(c.text.trim()))
          .find(Boolean);
        if (marcador) {
          flushRv();
          const idx = RV_MESES.indexOf(marcador[1]);
          if (idx >= 0) {
            currentRv = {
              mes: idx + 1,
              titular: rvTitular,
              cpfDependente: marcador[2] ? marcador[2].replace(/\D/g, '') : null,
              comuns: rvColunaVazia(),
              daytrade: rvColunaVazia(),
              consolidacao: {},
              temDados: false,
              origem: 'pdf',
              origemDocumento: origemPdf(pageNum, ri + 1),
            };
            rvAguardandoConteudo = true;
          }
          continue;
        }
        if (!currentRv) continue;
        const { rotulo, valores } = rvSepararLinha(row);
        // Mês inteiro sem operação: o formulário imprime só este texto no
        // lugar da tabela. Descarta a ficha aberta pelo marcador.
        //
        // Esta é a PRIMEIRA de duas barreiras contra inventar um mês zerado; a
        // segunda é o `temDados` exigido por flushRv. São redundantes de
        // propósito, e cada uma sozinha já basta — removendo só uma, a suíte
        // continua verde (conferido). O teste que prova as duas está em
        // importParsers.test.js ("não inventa ficha mensal quando a declaração
        // não tem operação nenhuma"): removendo AS DUAS, ele falha com as 12
        // fichas fantasmas do titular. Vale a redundância porque as duas
        // cobrem caminhos diferentes: esta pega o mês vazio no ato, o
        // `temDados` pega qualquer mês que termine sem nenhuma linha de valor,
        // inclusive por um layout que não conheçamos ainda.
        if (rvAguardandoConteudo && rotulo === 'Sem Informações') { currentRv = null; continue; }
        if (valores.length === 0) continue;

        const chaveDupla = RV_MERCADOS_MAP.get(rotulo) ?? RV_APURACAO_MAP.get(rotulo);
        if (chaveDupla) {
          currentRv.comuns[chaveDupla] = parseMoneyBR(valores[0]);
          // Coluna day-trade ausente na linha é deixada no zero da inicialização,
          // nunca preenchida com o valor da coluna comum.
          if (valores.length > 1) currentRv.daytrade[chaveDupla] = parseMoneyBR(valores[1]);
          currentRv.temDados = true;
          rvAguardandoConteudo = false;
          continue;
        }
        if (rotulo === 'Alíquota do imposto') {
          currentRv.comuns.aliquota = valores[0] ?? null;
          currentRv.daytrade.aliquota = valores[1] ?? null;
          rvAguardandoConteudo = false;
          continue;
        }
        const chaveConsolidacao = RV_CONSOLIDACAO_MAP.get(rotulo);
        if (chaveConsolidacao) {
          currentRv.consolidacao[chaveConsolidacao] = parseMoneyBR(valores[0]);
          currentRv.temDados = true;
          rvAguardandoConteudo = false;
        }
        continue;
      }

      // Ficha de FII/Fiagro: matriz com os meses nas colunas.
      if (section === 'fiiFiagro') {
        const textos = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (textos.length === 0) continue;
        if (textos.some(t => /^Sem Informações$/.test(t))) continue;
        // Subtítulo da ficha dos dependentes, que é onde o CPF é impresso
        // ("GANHOS LÍQUIDOS OU PERDAS (CPF DEPENDENTE: 000.000.000-00)").
        // Sem ele, dois dependentes diferentes cairiam na mesma chave em
        // `ultimosPorBeneficiario`.
        const cpfDep = /CPF DEPENDENTE:\s*([\d.-]+)/i.exec(normSpace(textos.join(' ')));
        if (cpfDep) { fiiCpfDependente = cpfDep[1].replace(/\D/g, ''); continue; }
        // Cabeçalho do quadro: "MÊS" seguido dos nomes dos meses. Guarda a
        // posição x de cada mês, que é o que identifica a coluna.
        //
        // A célula "MÊS" SOZINHA não é cabeçalho: é o pedaço final do rótulo
        // "RESULTADO LÍQUIDO DO MÊS", que o formulário quebra em três linhas
        // visuais. Enquanto ela era aceita aqui, `fiiMesesColuna` era zerada
        // no meio do quadro e a guarda logo abaixo descartava TODAS as linhas
        // seguintes — a ficha inteira do AJU-01 saía vazia, com movimento
        // impresso (auditoria de 31/08/2026). Por isso a troca só acontece
        // quando a linha realmente traz nome de mês.
        if (textos.some(t => /^MÊS$/.test(t))) {
          const colunas = row.cells
            .map(c => ({ x: c.x, mes: GC_MOEDA_MESES.indexOf(normSpace(c.text).toUpperCase()) + 1 }))
            .filter(c => c.mes > 0)
            .sort((a, b) => a.x - b.x);
          if (colunas.length > 0) {
            fiiMesesColuna = colunas;
            fiiRotuloPartes = [];
            fiiValoresPendentes = null;
            continue;
          }
        }
        if (fiiMesesColuna.length === 0) continue;

        const gravarFii = (campo, celulas) => {
          for (let vi = 0; vi < celulas.length; vi++) {
            const celula = celulas[vi];
            // Quando a linha traz exatamente um valor por coluna do quadro, a
            // ORDEM é o casamento certo, e não depende de coordenada nenhuma.
            // Bucketar pelo x de início erra aqui porque os números são
            // impressos alinhados à DIREITA e os nomes de mês à esquerda: em
            // AJU-01 p37 o valor de JANEIRO sai em x=189,4 e a âncora de
            // FEVEREIRO está em x=229,1, dentro da tolerância de 40 — janeiro
            // ia para fevereiro e era sobrescrito pelo valor de fevereiro logo
            // depois. O bucket por x fica só como reserva, para um quadro que
            // imprima menos valores do que colunas.
            let escolhido = celulas.length === fiiMesesColuna.length ? fiiMesesColuna[vi] : null;
            if (!escolhido) {
              escolhido = fiiMesesColuna[0];
              for (const col of fiiMesesColuna) if (col.x <= celula.x + 40) escolhido = col;
            }
            if (!escolhido) continue;
            let registro = fiiFiagroMensalOficial.find(r => r.mes === escolhido.mes && r.titular === (fiiBloco !== 'dependente'));
            if (!registro) {
              registro = { mes: escolhido.mes, titular: fiiBloco !== 'dependente', cpfDependente: fiiBloco === 'dependente' ? fiiCpfDependente : null, origem: 'pdf', temDados: false, origemDocumento: origemPdf(pageNum, ri + 1) };
              fiiFiagroMensalOficial.push(registro);
            }
            const texto = celula.text.trim();
            registro[campo] = campo === 'aliquota' ? texto : parseMoneyBR(texto);
            if (campo !== 'aliquota' && parseMoneyBR(texto) !== 0) registro.temDados = true;
          }
        };

        const valores = row.cells.filter(c => RV_VALOR.test(c.text.trim()) || RV_ALIQUOTA.test(c.text.trim()));
        const rotulo = normSpace(textos.filter(t => !RV_VALOR.test(t) && !RV_ALIQUOTA.test(t)).join(' ')).toUpperCase();

        if (valores.length > 0) {
          const campo = rotulo ? FII_LINHAS_MAP.get(rotulo) : null;
          if (campo) {
            // Rótulo inteiro na mesma linha dos valores: o caso simples.
            gravarFii(campo, valores);
            fiiRotuloPartes = [];
            fiiValoresPendentes = null;
          } else if (!rotulo) {
            // Linha só de valores: o rótulo dela está partido, com o final na
            // linha SEGUINTE. Segura os valores até o rótulo fechar.
            fiiValoresPendentes = valores;
          }
          continue;
        }

        // Linha só de texto: é pedaço de rótulo. Acumula e tenta fechar.
        fiiRotuloPartes.push(rotulo);
        const combinado = normSpace(fiiRotuloPartes.join(' '));
        const campoCombinado = FII_LINHAS_MAP.get(combinado);
        if (campoCombinado && fiiValoresPendentes) {
          gravarFii(campoCombinado, fiiValoresPendentes);
          fiiRotuloPartes = [];
          fiiValoresPendentes = null;
        } else if (!FII_LINHAS.some(([nome]) => nome.startsWith(combinado))) {
          // O acumulado não leva a rótulo nenhum: recomeça deste pedaço.
          fiiRotuloPartes = [rotulo];
        }
        continue;
      }

      if (section === 'doacoesEfetuadas') { processDoacaoRow(doacoesEfetuadasState, row); continue; }
      if (section === 'doacoesPartidos') { processDoacaoRow(doacoesPartidosState, row); continue; }
      if (section === 'doacoesEcaIdoso') { processDoacaoRow(doacoesEcaIdosoState, row); continue; }
    }
  }

  const textoIntegral = paginasTexto.map(p => `PÁGINA ${p.numero}\n${p.texto}`).join('\n\f\n');
  if (textoIntegral.replace(/PÁGINA \d+/g, '').trim().length < 100) {
    throw new Error('O PDF não possui uma camada de texto utilizável. Gere novamente a imagem da declaração no programa IRPF ou aplique OCR antes de importar.');
  }
  const assinaturaIrpf = [
    /DECLARAÇÃO DE AJUSTE ANUAL/i.test(textoIntegral),
    /IDENTIFICAÇÃO DO CONTRIBUINTE/i.test(textoIntegral),
    /ANO-CALENDÁRIO\s+\d{4}/i.test(textoIntegral),
    /(?:BENS E DIREITOS|PAGAMENTOS EFETUADOS|RESUMO)/i.test(textoIntegral),
  ].filter(Boolean).length;
  if (options.validarDocumento !== false && (assinaturaIrpf < 3 || !(contribuinte.cpf || contribuinte.nome) || !anoCalendario)) {
    throw new Error('O PDF tem texto, mas não foi reconhecido como uma declaração IRPF completa. Gere a imagem da declaração no programa oficial da Receita e tente novamente.');
  }
  const documentoFonte = await criarDocumentoFonte({ formato: 'pdf', textoIntegral, paginas: paginasTexto });

  if (currentBem) emitirBem(currentBem);
  if (currentDivida) dividas.push(currentDivida);
  if (currentPag) pagamentos.push(currentPag);
  if (doacoesEfetuadasState.current) doacoesEfetuadas.push(doacoesEfetuadasState.current);
  if (doacoesPartidosState.current) doacoesPartidos.push(doacoesPartidosState.current);
  if (doacoesEcaIdosoState.current) doacoesEcaIdoso.push(doacoesEcaIdosoState.current);
  flushRv();
  flushRpj();
  flushRie();
  flushGc();
  flushRuralTabelas();
  // Titular antes dos dependentes, e dentro de cada um a ordem dos meses.
  rendaVariavelMensalOficial.sort((a, b) => (b.titular - a.titular) || (a.mes - b.mes));

  if (contribuinte.cpf) {
    log(`Contribuinte: ${contribuinte.nome}, CPF: ${contribuinte.cpf}`, 'success');
  } else {
    log('Não foi possível identificar o contribuinte.', 'warning');
  }
  if (anoCalendario) {
    log(`Ano-calendário desta declaração: ${anoCalendario}`);
  } else {
    log('Não foi possível identificar o ano-calendário no PDF. Mantendo o ano selecionado na tela.', 'warning');
  }
  log(`Identificados ${bens.length} bens e direitos`);
  log(`Identificadas ${dividas.length} dívidas e ônus reais`);
  log(`Identificados ${pagamentos.length} pagamentos efetuados`);
  log(`Identificadas ${doacoesEfetuadas.length} doações efetuadas`);
  log(`Identificadas ${doacoesPartidos.length} doações a partidos políticos e candidatos`);
  log(`Identificadas ${doacoesEcaIdoso.length} doações diretamente na declaração (ECA/pessoa idosa)`);
  if (rendaVariavelMensalOficial.length > 0) {
    const doTitular = rendaVariavelMensalOficial.filter(r => r.titular).length;
    const deDependentes = rendaVariavelMensalOficial.length - doTitular;
    log(`Renda Variável: ${doTitular} ficha(s) mensal(is) do titular e ${deDependentes} de dependentes, com os valores lidos do PDF`, 'success');
  }
  if (rendimentos.length > 0) {
    const doTitular = rendimentos.filter(r => r.beneficiario === 'Titular');
    const soma = (lista) => lista
      .reduce((acc, r) => acc + (r.valor || 0), 0)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const deDependentes = rendimentos.filter(r => r.beneficiario !== 'Titular');
    log(`Identificados ${rendimentos.length} rendimentos tributáveis de pessoa jurídica: ${doTitular.length} do titular (R$ ${soma(doTitular)}) e ${deDependentes.length} de dependentes (R$ ${soma(deDependentes)})`, 'success');
  }
  const isentos = rendimentos.filter(r => r.tipo.startsWith('isento_'));
  const exclusivos = rendimentos.filter(r => r.tipo.startsWith('exclusivo_'));
  const totalDe = (lista) => lista
    .reduce((acc, r) => acc + (r.valor || 0), 0)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // Os dois campos agregados da Lei 14.754 na página RESUMO não existem como
  // linha própria lá: a página imprime "Imposto Lei 14.754/2023" (já lido) mas
  // não o ganho. Ele vem da soma da ficha detalhada, que é a mesma definição
  // que o `.DBK` usa no registro 20 — conferido no declarante que tem os dois
  // arquivos, onde `lei14754Ganho` é exatamente o ganho do único bem no
  // exterior.
  if (impostoDevido && demonstrativoExteriorOficial.length > 0) {
    impostoDevido.lei14754Ganho = demonstrativoExteriorOficial.reduce((s2, b) => s2 + b.ganhoPrejuizo, 0);
    if (impostoDevido.lei14754Imposto == null) {
      impostoDevido.lei14754Imposto = demonstrativoExteriorOficial.reduce((s2, b) => s2 + b.impostoDevido, 0);
    }
  }
  // Mesma correção do caminho .DBK, na mesma função (achado 07): o IRRF do 13º
  // salário sai da ficha de Rendimentos de PJ e entra no rendimento exclusivo
  // do 13º, que a declaração informa pelo bruto.
  aplicarIrrfDecimoTerceiro(rendimentos);

  for (const ficha of fichasNaoLidasComConteudo) {
    const aviso = `A ficha "${ficha}" tem informação nesta declaração e NÃO foi importada: o app ainda não lê essa ficha. Confira esses valores na declaração original antes de usar os números desta tela.`;
    avisosImportacao.push(aviso);
    log(aviso, 'warning');
  }
  if (apuracaoGanhoCapital.length > 0) {
    const porTipo = apuracaoGanhoCapital.reduce((acc, o) => { acc[o.tipo || 'movel'] = (acc[o.tipo || 'movel'] || 0) + 1; return acc; }, {});
    const partes = [];
    if (porTipo.imovel) partes.push(`${porTipo.imovel} de bem imóvel`);
    if (porTipo.movel) partes.push(`${porTipo.movel} de direito/bem móvel`);
    if (porTipo.participacao) partes.push(`${porTipo.participacao} de participação societária`);
    log(`Ganhos de Capital: ${apuracaoGanhoCapital.length} operação(ões) importada(s)${partes.length ? ` (${partes.join(', ')})` : ''}`, 'success');
  }
  if (gcMoedaOperacoesPdf.length > 0 || gcMoedaMensalPdf.length > 0) {
    log(`Ganhos de Capital: ficha de moedas em espécie importada (${gcMoedaOperacoesPdf.length} alienação(ões), ${gcMoedaMensalPdf.length} mês(es) na totalização)`, 'success');
  }
  // Descarta os meses de FII que ficaram só com zeros: a ficha imprime a
  // matriz inteira mesmo quando o contribuinte não operou naquele mês, e um
  // mês zerado importado apareceria na tela como se houvesse movimento.
  const fiiComDados = fiiFiagroMensalOficial.filter(r => r.temDados);
  fiiComDados.forEach(r => { delete r.temDados; });
  fiiComDados.sort((a, b) => (b.titular - a.titular) || (a.mes - b.mes));
  if (fiiComDados.length > 0) {
    log(`Renda Variável (FII/Fiagro): ${fiiComDados.length} mês(es) com movimento importado(s)`, 'success');
  }
  const rendaVariavelAnualOficial = consolidarRendaVariavelAnualPdf(rendaVariavelMensalOficial);
  const fiiFiagroAnualOficial = consolidarFiiFiagroAnualPdf(fiiComDados);
  // Ganhos de Capital no mesmo formato do .DBK, para as telas não precisarem
  // saber de qual arquivo o dado veio. O PDF não traz o cabeçalho consolidado
  // (registro 60), então `consolidacao` fica null aqui.
  const ganhosCapitalOficial = (apuracaoGanhoCapital.length > 0 || gcMoedaOperacoesPdf.length > 0 || gcMoedaMensalPdf.length > 0)
    ? {
      consolidacao: null,
      operacoes: apuracaoGanhoCapital.map(op => ({
        id: op.id,
        tipo: op.tipo || 'movel',
        numeroOperacao: '',
        especificacao: op.bem,
        sociedade: op.sociedade,
        especie: op.especie,
        endereco: op.endereco,
        dataAquisicao: op.dataAquisicao,
        custoAquisicao: op.custoAquisicao,
        natureza: { codigo: '', descricao: op.naturezaOperacao || '' },
        dataAlienacao: op.dataAlienacao,
        valorAlienacao: op.valorAlienacao,
        custoCorretagem: op.custoCorretagem,
        alienacaoAPrazo: op.alienacaoAPrazo ?? null,
        sujeitoRegistroPublico: op.sujeitoRegistroPublico ?? null,
        houveAlienacaoParcialAnterior: op.houveAlienacaoParcialAnterior ?? null,
        ganhoAlienacoesAnteriores: op.ganhoAlienacoesAnteriores ?? 0,
        adquirentes: op.adquirentes || [],
        perguntasImpressas: op.perguntasImpressas || [],
        parcelas: op.parcelas || [],
        apuracao: op.apuracao || null,
        calculoImposto: op.calculoImposto || null,
        consolidacaoBem: op.consolidacaoBem || null,
        // Estes três eram cravados em [] aqui, DESCARTANDO o que o parser
        // tinha acabado de ler. No AJU-01 a tabela de faixas está impressa
        // (p15 r25 a r30: quatro faixas mais a linha TOTAL), o handler de
        // `gcBloco === 'faixas'` a lia corretamente, e a montagem final jogava
        // fora. O achado gc-08 constava como resolvido no mapa e o retorno real
        // vinha vazio.
        faixasTributacao: op.faixasTributacao || [],
        ampliacoesReformas: op.ampliacoesReformas || [],
        custosAquisicao: op.custosAquisicao || [],
      })),
      moedaEspecie: { operacoes: gcMoedaOperacoesPdf, mensal: gcMoedaMensalPdf.sort((a, b) => a.mes - b.mes) },
      origem: 'pdf',
    }
    : null;
  const totalDoacoes = doacoesEfetuadas.length + doacoesPartidos.length + doacoesEcaIdoso.length;
  if (totalDoacoes > 0) {
    log(`Identificadas ${totalDoacoes} doação(ões): ${doacoesEfetuadas.length} efetuada(s), ${doacoesPartidos.length} a partidos/candidatos e ${doacoesEcaIdoso.length} diretamente na declaração (ECA/pessoa idosa)`, 'success');
  }

  // ACHADO 06 da auditoria de 24/08/2026: o bloco que ficava aqui filtrava
  // `tributavel_pf_exterior` de uma lista que este parser NUNCA preenche —
  // esse tipo é emitido em um ponto só do arquivo, dentro do `parseDBK`. Era
  // código morto que dava a impressão de que o caminho PDF lia o carnê-leão.
  //
  // Ele não lê, e o RRA também não: as quatro fichas correspondentes estão em
  // FICHAS_NAO_LIDAS e viram aviso quando trazem conteúdo. O que estava
  // faltando era o aviso SOBREVIVER à tela de importação — ele ia só para o
  // log, que some quando a pessoa navega. Agora `fichasNaoLidasComConteudo`
  // fica gravada no ano (ver reducer/blankYear) e o Dashboard a exibe fixa.
  // A ficha em si só será implementada com uma declaração de referência que a
  // traga preenchida: inventar o recorte da tabela sem um caso real é
  // exatamente o tipo de suposição que esta auditoria existe para eliminar.
  if (dependentes.length > 0) log(`Identificados ${dependentes.length} dependente(s)`, 'success');
  if (impostoDevido) log('Resumo da declaração (imposto devido, deduções e evolução patrimonial) lido das páginas RESUMO e EVOLUÇÃO PATRIMONIAL', 'success');
  if (demonstrativoExteriorOficial.length > 0) log(`Demonstrativo da Lei 14.754/2023: ${demonstrativoExteriorOficial.length} bem(ns) no exterior`, 'success');
  if (isentos.length > 0) log(`Identificados ${isentos.length} rendimentos isentos e não tributáveis (R$ ${totalDe(isentos)})`, 'success');
  if (exclusivos.length > 0) log(`Identificados ${exclusivos.length} rendimentos de tributação exclusiva ou definitiva (R$ ${totalDe(exclusivos)})`, 'success');
  // A ficha imprime, para cada código, um valor AGREGADO e logo abaixo a
  // sub-tabela detalhada. Os detalhes é que são importados; se a soma deles
  // não fecha com o agregado, alguma linha não foi entendida e o silêncio
  // seria pior que o aviso.
  for (const d of rieDivergencias) {
    const aviso = `Conferência da ficha de rendimentos: "${d.descricao}" soma R$ ${d.somaDetalhe.toFixed(2)} no detalhe, mas a própria declaração informa R$ ${d.valorAgregado.toFixed(2)} no total do código. Confira esse item na declaração original.`;
    avisosImportacao.push(aviso);
    log(aviso, 'warning');
  }
  // NÃO avisar aqui, incondicionalmente, que o carnê-leão não é lido do PDF:
  // esse aviso disparava em TODA importação por PDF, inclusive quando a ficha
  // vem "Sem Informações" (o caso das duas declarações reais), virando alarme
  // falso na tela de criação de perfil e no Dashboard. O loop de
  // `fichasNaoLidasComConteudo` acima já avisa, NOMEANDO a ficha, só quando o
  // carnê-leão vem preenchido — a única vez em que há algo a conferir.
  if (imoveisRurais.length > 0 || bensRurais.length > 0 || dividasRurais.length > 0) {
    log(`Atividade Rural: ${imoveisRurais.length} imóvel(is) explorado(s), ${bensRurais.length} bem(ns), ${dividasRurais.length} dívida(s) vinculada(s), ${participantesRuraisOficial.length} participante(s) e ${movimentacaoRebanhoOficial.length} espécie(s) no rebanho`, 'success');
  }
  // Não há aviso de Atividade Rural aqui: desde 23/08/2026 ela é lida INTEIRA
  // por este caminho (imóveis, bens, dívidas, receitas/despesas mensais,
  // apuração, rebanho e participantes). O texto antigo dizia que o livro-caixa
  // manual "não vem de arquivo nenhum" e caía como 'warning' na tela de criação
  // de perfil, sem nada acionável — já tinha sido corrigido duas vezes por ficar
  // desatualizado. Removido: o que de fato ficar de fora vira aviso pelo loop de
  // `fichasNaoLidasComConteudo`.
  // O .DBK de referência não tem NENHUM registro para as 4 fichas de
  // Doações (nem "sem informação" — o tipo de registro simplesmente não
  // aparece), então esse caminho fica de fora de propósito (ver
  // parseDBK): o único jeito de importar Doações hoje é pelo PDF.
  //
  // O aviso que ficava aqui dizia que o layout das doações "nunca pôde ser
  // conferido contra uma declaração com doação real". Isso deixou de valer na
  // auditoria de 31/08/2026: os três layouts (Efetuadas, Partidos e ECA/Idoso)
  // foram conferidos campo a campo contra uma declaração com doação impressa, e
  // as três fichas passaram a ser lidas — antes, duas doações DEDUTÍVEIS (ECA e
  // Pessoa Idosa) e a eleitoral eram detectadas e nunca lidas, e este mesmo
  // aviso sugeria o contrário, que elas tinham sido lidas e só precisavam de
  // conferência. Sem o aviso enganoso; o estado de cada ficha vai por
  // `estadoFichas`, como as demais.

  const estadoFichas = {};
  const temDadosPorFicha = {
    'identificacao-contribuinte': Boolean(contribuinte.cpf || contribuinte.nome),
    dependentes: dependentes.length > 0,
    'rendimentos-pj-titular': rendimentos.some(r => r.tipo === 'tributavel_pj' && r.beneficiario === 'Titular'),
    'rendimentos-pj-dependentes': rendimentos.some(r => r.tipo === 'tributavel_pj' && r.beneficiario === 'Dependente'),
    'rendimentos-isentos': isentos.length > 0,
    'rendimentos-tributacao-exclusiva': exclusivos.length > 0,
    'imposto-pago-retido': Boolean(impostoDevido),
    'pagamentos-efetuados': pagamentos.length > 0,
    'doacoes-efetuadas': doacoesEfetuadas.length > 0,
    'bens-direitos': bens.length > 0,
    'dividas-onus': dividas.length > 0,
    'doacoes-eleitorais': doacoesPartidos.length > 0,
    'doacoes-eca': doacoesEcaIdoso.some(d => d.categoria === 'eca'),
    'doacoes-idoso': doacoesEcaIdoso.some(d => d.categoria === 'idoso'),
    'rural-brasil-identificacao': imoveisRurais.length > 0,
    'rural-brasil-receitas-despesas': receitasDespesasRuraisOficial.length > 0,
    'rural-brasil-apuracao': Boolean(apuracaoResultadoRuralOficial),
    'rural-brasil-rebanho': movimentacaoRebanhoOficial.length > 0,
    'rural-brasil-bens': bensRurais.length > 0,
    'rural-brasil-dividas': dividasRurais.length > 0,
    'rural-brasil-participantes': participantesRuraisOficial.length > 0,
    'ganho-capital-imoveis': apuracaoGanhoCapital.some(op => op.tipo === 'imovel'),
    'ganho-capital-moveis': apuracaoGanhoCapital.some(op => op.tipo === 'movel'),
    'ganho-capital-participacao': apuracaoGanhoCapital.some(op => op.tipo === 'participacao'),
    'ganho-capital-moeda': gcMoedaOperacoesPdf.length > 0 || gcMoedaMensalPdf.length > 0,
    'renda-variavel-titular': rendaVariavelMensalOficial.some(item => item.titular),
    'renda-variavel-dependentes': rendaVariavelMensalOficial.some(item => !item.titular),
    'fii-fiagro-titular': fiiComDados.some(item => item.titular),
    'fii-fiagro-dependentes': fiiComDados.some(item => !item.titular),
    'lei-14754': demonstrativoExteriorOficial.length > 0,
    // As três fichas próprias das modalidades que NÃO são ajuste anual. O
    // parser estrutura as três desde sempre, e o mapa não as registrava: a
    // ficha era dada como localizada e sem conteúdo, virava ERRO, e o erro
    // bloqueava a importação inteira da declaração final de espólio e da de
    // saída definitiva. Ver o comentário do TOTAL zerado, acima.
    'saida-definitiva': Boolean(saidaDefinitivaOficial),
    inventariante: Boolean(espolioOficial),
    herdeiros: (espolioOficial?.herdeiros || []).length > 0,
    resumo: Boolean(impostoDevido),
  };

  for (const catalogada of CATALOGO_FICHAS_PDF_2026) {
    const observada = fichasPdfObservadas[catalogada.id];
    if (!observada) {
      estadoFichas[`pdf:${catalogada.id}`] = entradaEstadoFicha(
        'ausente', 'pdf', 'Esta ficha não foi impressa no documento selecionado',
        { titulo: catalogada.titulo, presenca: 'ausente', suporte: catalogada.suporte },
      );
      continue;
    }
    const temDados = temDadosPorFicha[catalogada.id] === true;
    // Uma ficha mensal pode imprimir "Sem Informações" em alguns meses e
    // trazer valores em outros. Conteúdo estruturado comprovado prevalece na
    // presença final da ficha inteira.
    if (temDados) observada.presenca = 'preenchida';
    const detalhes = {
      titulo: catalogada.titulo,
      paginaInicio: observada.paginaInicio,
      linhaInicio: observada.linhaInicio,
      presenca: observada.presenca,
      suporte: catalogada.suporte,
    };
    if (observada.presenca === 'vazia' && !temDados) {
      estadoFichas[`pdf:${catalogada.id}`] = entradaEstadoFicha('vazia', 'pdf', undefined, detalhes);
    } else if (catalogada.suporte === 'nao_suportada') {
      estadoFichas[`pdf:${catalogada.id}`] = entradaEstadoFicha(
        'nao_suportada', 'pdf',
        'Ficha impressa preservada no documento-fonte, mas ainda sem extração estruturada integral',
        { ...detalhes, presenca: observada.presenca === 'vazia' ? 'vazia' : 'indeterminada' },
      );
    } else if (temDados) {
      estadoFichas[`pdf:${catalogada.id}`] = entradaEstadoFicha(
        'parcial', 'pdf',
        'Dados estruturados, mas a ficha ainda não concluiu o gate de auditoria independente',
        { ...detalhes, presenca: 'preenchida' },
      );
    } else {
      estadoFichas[`pdf:${catalogada.id}`] = entradaEstadoFicha(
        'erro', 'pdf',
        'A ficha foi localizada no PDF, mas o parser não comprovou que estava vazia nem estruturou conteúdo',
        { ...detalhes, presenca: 'indeterminada' },
      );
    }
  }

  // Consolidações anuais são produtos derivados, não fichas impressas. Ficam
  // explicitamente fora do catálogo oficial para não serem confundidas com
  // conteúdo lido do PDF.
  if (rendaVariavelAnualOficial) {
    estadoFichas['pdf:derivado-renda-variavel-anual'] = entradaEstadoFicha(
      'parcial', 'pdf', 'Consolidação calculada a partir dos meses; não equivale a uma ficha anual integral',
      { derivado: true, presenca: 'preenchida' },
    );
  }
  if (fiiFiagroAnualOficial) {
    estadoFichas['pdf:derivado-fii-fiagro-anual'] = entradaEstadoFicha(
      'parcial', 'pdf', 'Consolidação calculada a partir dos meses; não equivale a uma ficha anual integral',
      { derivado: true, presenca: 'preenchida' },
    );
  }

  return {
    // Ver o comentário no return do parseDBK: 'pdf' é o que faz o Dashboard
    // avisar quais fichas ficaram de fora desta importação.
    formato: 'pdf',
    contribuinte, bens, dividas, rendimentos, pagamentos, anoCalendario,
    doacoesEfetuadasOficial: doacoesEfetuadas,
    doacoesPartidosOficial: doacoesPartidos,
    dependentes,
    impostoDevido,
    apuracaoGanhoCapital,
    receitasDespesasRuraisOficial,
    apuracaoResultadoRuralOficial,
    fichasNaoLidasComConteudo,
    imoveisRurais,
    bensRurais,
    dividasRurais,
    participantesRuraisOficial,
    movimentacaoRebanhoOficial,
    demonstrativoExteriorOficial,
    doacoesEcaIdosoOficial: doacoesEcaIdoso,
    espolioOficial,
    saidaDefinitivaOficial,
    // Mesma chave que o .DBK preenche pelo registro 76, mas aqui com os
    // valores de cada mês, que o .DBK não permite decifrar. Quem consome
    // precisa continuar aceitando as entradas só com `mes` vindas do .DBK.
    rendaVariavelMensalOficial,
    rendaVariavelAnualOficial,
    ganhosCapitalOficial,
    fiiFiagroMensalOficial: fiiComDados,
    fiiFiagroAnualOficial,
    estadoFichas,
    avisosImportacao,
    fichasPdfObservadas,
    totalFichasPdfCatalogadas: CATALOGO_FICHAS_PDF_2026.length,
    versaoCatalogoFichasPdf: 'IRPF2026-oficial-1',
    documentoFonte,
  };
}
