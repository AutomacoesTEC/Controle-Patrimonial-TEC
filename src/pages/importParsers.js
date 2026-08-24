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

// O campo de CPF/CNPJ do beneficiário (registro 26) tem largura fixa de 19
// caracteres, com um prefixo de preenchimento de exatamente 5 caracteres
// antes do número real — 11 dígitos de CPF (campo fica com 16 chars
// significativos) ou 14 de CNPJ (19 chars, sem sobra). Conferido contra o
// mesmo pagamento já extraído (corretamente) pelo caminho PDF: o prefixo
// de preenchimento NÃO é necessariamente só zeros (ex.: "00001" antes de
// um CNPJ real), então tirar "zeros à esquerda" na unha cortava um dígito
// de verdade — o certo é sempre pegar os últimos 11 ou 14 caracteres,
// nunca inferir o tamanho do preenchimento pelo conteúdo dele.
export const normalizarCpfCnpj = (raw) => {
  const campo = (raw || '').trim();
  if (!campo) return '';
  const alvo = campo.length <= 16 ? 11 : 14;
  return campo.slice(-alvo).padStart(alvo, '0');
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
  // Apuração do Ganho de Capital oficial (bens móveis vendidos, já
  // apurados NA PRÓPRIA declaração original — diferente da aba Ganhos de
  // Capital do app, que calcula a partir de movimentações lançadas depois
  // da importação). Vem espalhado em 3 registros por operação (62=bem+
  // datas+custo, 65=adquirente, 69=valores de alienação), sempre na MESMA
  // ordem/quantidade nesta declaração de exemplo (3 registros de cada
  // tipo, 1 por operação) — junta por posição no array, não por um campo
  // de vínculo explícito (não achado com confiança). Registro 60 (âncora
  // da seção, 1 só) e 75 (resultado por operação) não são lidos: o ganho
  // já sai certo calculando alienação − custo (mesma conta que a própria
  // declaração mostra em "Apuração do Ganho de Capital"), sem depender de
  // decifrar mais um registro sem exemplo não-zero pra conferir.
  const gcBens = [], gcAdquirentes = [], gcValores = [];
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

  let bemId = 1, dividaId = 1, rendId = 1, pagId = 1, depId = 1;

  // Espelho da rede que o caminho PDF ganhou em 23/08/2026: o arquivo pode
  // conter informação que este parser não lê, e o silêncio é o pior desfecho.
  //
  // A PRIMEIRA versão tentava detectar "registro não tratado COM valor",
  // procurando qualquer sequência de 13 dígitos não-zero na linha. Não funciona
  // e o teste provou na hora: sem conhecer o layout do registro, o regex
  // desliza sobre a linha inteira e casa pedaços de CPF, de tipo e de data
  // ("19CPF-DO-DECLARANTE-1", "0131120101202"), acusando valor nos três tipos que estão
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
    '34', '37', '40', '50', '51', '52', '53', '54', '55', '57', '62', '65', '69', '84', '88',
    '45', '47', '80', '81', '83', '85', '86', '87', '89', '90', '91', '92']);
  // Tipos JÁ investigados que este parser não lê, e que por isso não geram
  // aviso: nas declarações de referência estão todos zerados ou são estrutura.
  //   19 - traz o CNPJ do INSS e o valor do 13º salário, que já entra pelo
  //        registro 24 (código 01) e não pode ser contado duas vezes.
  //   60 - período de residência no país e código do país (105 BRASIL).
  //   75 - três registros de estrutura, sem valor financeiro.
  //   T9 - trailer do arquivo, só contagens de registro.
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
  const TIPOS_CONHECIDOS_NAO_LIDOS = new Set(['19', '33', '46', '48', '60', '75', '76', 'T9']);
  const TIPOS_RURAIS_COM_FLAG_EXTERIOR = new Set(['50', '51', '52', '53', '54', '55']);
  const rurodoExterior = new Set();
  const tiposDesconhecidos = new Set();

  for (const line of lines) {
    const tipo = line.substring(0, 2);

    // Linha vazia (o arquivo termina com quebra de linha, e pode ter linha em
    // branco no meio) não é registro nenhum. Sem esta guarda o aviso de tipo
    // desconhecido dispara em TODA importação, com um tipo de nome vazio — foi
    // o que o teste flagrou assim que passou a existir.
    if (line.trim() === '') continue;

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
        contribuinte.cpf = cpf;
        contribuinte.nome = nome;
      }
      continue;
    }

    if (tipo === '25') {
      const codigo = field(line, 19, 2);
      const nome = field(line, 21, 60);
      const dataNascimento = dataDDMMAAAAparaIso(field(line, 81, 8));
      const cpf = field(line, 89, 11);
      if (nome) {
        dependentes.push({
          id: depId++,
          nome,
          cpf,
          dataNascimento,
          parentesco: codigo,
        });
      }
      continue;
    }

    if (tipo === '27') {
      const codigo = field(line, 14, 2);
      const discriminacao = field(line, 20, 512);
      const anterior = parseValorN13(field(line, 532, 13));
      const atual = parseValorN13(field(line, 545, 13));
      const grupo = field(line, 1101, 2);
      if (discriminacao || anterior || atual) {
        bens.push({
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
          beneficiario: 'Titular',
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
      // colava os dois sem pontuação ("NOME DA FAZENDA MUNICIPIO") e
      // fazia o `.DBK` divergir do PDF, que imprime "NOME DA FAZENDA,
      // MUNICIPIO". Lendo separado, os dois caminhos passam a produzir o
      // mesmo texto.
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
      const discriminacao = field(line, 20, 512);
      // Ordem invertida (ver comentário acima): pos 532 é a ATUAL, pos 545
      // é a ANTERIOR neste registro — trocado de propósito em relação ao
      // padrão do registro 27.
      const situacaoAtual = parseValorN13(field(line, 532, 13));
      const situacaoAnterior = parseValorN13(field(line, 545, 13));
      if (discriminacao) {
        bensRurais.push({
          id: bemRuralId++,
          codigo: field(line, 18, 2),
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
        resultadoNaoTributavel: parseValorN13(field(line, 145, 13)),
        // Campos que o layout oficial revelou e que ninguém lia. O primeiro é
        // a opção de apuração do resultado tributável, guardada CRUA: vem '2'
        // nesta declaração, cujo PDF imprime "Pelo resultado", mas o layout não
        // documenta a tabela de valores e deduzir o "de-para" de um caso só
        // seria chute (mesmo critério já usado no código de parentesco dos
        // dependentes). O segundo só tem valor com atividade rural no exterior.
        opcaoApuracaoResultadoTributavel: field(line, 171, 1),
        resultadoExteriorDolar: parseValorN13(field(line, 158, 13)),
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

    if (tipo === '62') {
      gcBens.push({
        bem: field(line, 38, 83),
        dataAquisicao: dataDDMMAAAAparaIso(field(line, 191, 8)),
        custoAquisicao: parseValorN13(field(line, 199, 13)),
        dataAlienacao: dataDDMMAAAAparaIso(field(line, 286, 8)),
      });
      continue;
    }

    if (tipo === '65') {
      // Um dígito fixo ("2", nas 3 operações conferidas) antes do
      // documento — não indica CPF x CNPJ (as 3 têm o mesmo dígito, uma é
      // CPF e duas são CNPJ). O que distingue é só o próprio tamanho: CPF
      // vem com espaço sobrando à direita até completar 14, CNPJ preenche
      // os 14 inteiros — bastando cortar o espaço (field() já faz isso).
      gcAdquirentes.push({
        cpfCnpj: field(line, 38, 14),
        nome: field(line, 52, 60),
      });
      continue;
    }

    if (tipo === '69') {
      gcValores.push({
        valorAlienacao: parseValorN13(field(line, 38, 13)),
      });
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
      log(`Esta declaração tem a ficha "${FICHAS_NAO_MODELADAS[t]}", que o app não importa. Confira esses dados na declaração original.`, 'warning');
    }
    if (novas.length > 0) {
      log(`Este arquivo tem registro(s) de tipo ${novas.join(', ')}, que o app não conhece. Alguma informação da declaração pode não ter sido importada; confira na declaração original.`, 'warning');
    }
  }

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
        // O IRRF só existe na variante 85 do detalhe; nas demais é zero.
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
          divergenciasRendimento.push({ chave, soma, agregado: ag.valor });
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
      divergenciasRendimento.push({ chave, soma: detalhe.reduce((a, d) => a + d.valor, 0), agregado: 0 });
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

  // Ganho de Capital = valor de alienação − custo de aquisição, sem passar
  // de zero (perda não gera ganho negativo aqui — mesma regra que a
  // própria declaração aplica: as 3 operações reais conferidas tiveram
  // prejuízo e a declaração mostrou "Ganho de Capital: 0,00" em vez de um
  // valor negativo).
  const apuracaoGanhoCapital = gcBens.map((b, i) => {
    const adquirente = gcAdquirentes[i] || {};
    const valorAlienacao = gcValores[i]?.valorAlienacao ?? 0;
    return {
      id: i + 1,
      bem: b.bem,
      dataAquisicao: b.dataAquisicao,
      custoAquisicao: b.custoAquisicao,
      dataAlienacao: b.dataAlienacao,
      valorAlienacao,
      ganhoCapital: Math.max(0, valorAlienacao - b.custoAquisicao),
      adquirenteCpfCnpj: adquirente.cpfCnpj || '',
      adquirenteNome: adquirente.nome || '',
    };
  });
  if (apuracaoGanhoCapital.length > 0) {
    log(`Identificadas ${apuracaoGanhoCapital.length} operações na Apuração do Ganho de Capital oficial`);
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
  rendaVariavelMensalOficial.sort((a, b) => a.mes - b.mes);
  if (rendaVariavelMensalOficial.length > 0) {
    log(`Renda Variável: ficha mensal identificada em ${rendaVariavelMensalOficial.length} mês(es) (valor do mês não pôde ser decifrado, ver nota na tela)`, 'warning');
  }

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
    doacoesEfetuadasOficial: doacoesEfetuadas,
    doacoesPartidosOficial: doacoesPartidos,
    doacoesEcaIdosoOficial: doacoesEcaIdoso,
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
    .filter(([, x]) => x != null)
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
const BOILERPLATE = new Set([
  'NOME:', 'CPF:', 'DECLARAÇÃO DE AJUSTE ANUAL', 'IMPOSTO SOBRE A RENDA - PESSOA FÍSICA',
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
const isDoacaoHeaderRow = (row) => rowHasCell(row, 'CÓD.') && row.cells.some(c => /NOME DO BENEFICIÁRIO/.test(c.text));
const buildDoacaoAnchors = (row) => ({
  codigo: findCellX(row, 'CÓD.'),
  nome: findCellXRegex(row, /NOME DO BENEFICIÁRIO/) ?? 53,
  cpfcnpj: findCellXRegex(row, /CPF\/CNPJ DO/) ?? 254,
  valor: findCellXRegex(row, /^VALOR/) ?? 431,
});
// Processa uma linha de uma das tabelas de doações, no mesmo padrão de
// `section === 'pagamentos'` acima. `st` é mutado in-place
// ({anchors, current, items, nextId, categoria?}) — um objeto por seção
// (doacoesEfetuadas/doacoesPartidos/doacoesEcaIdoso), pra reaproveitar a
// mesma lógica sem repetir o bloco 3 vezes.
const processDoacaoRow = (st, row) => {
  if (isDoacaoHeaderRow(row)) { st.anchors = buildDoacaoAnchors(row); return; }
  if (!st.anchors) return;
  if (rowHasCell(row, 'TOTAL')) {
    if (st.current) { st.items.push(st.current); st.current = null; }
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
  const pick = makeColumnPicker(st.anchors);
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
  'Recebidos de Pessoa Física/Exterior pelo titular': 'rendimentosPfExteriorTitular',
  'Recebidos de Pessoa Física/Exterior pelos dependentes': 'rendimentosPfExteriorDependentes',
  'Dependentes': 'dependentes',
  'Despesas médicas': 'despesasMedicas',
  'Base de cálculo do imposto': 'baseCalculo',
  'Total do imposto devido': 'impostoDevidoTotal',
  'Total do imposto pago': 'impostoPagoTotal',
  'SALDO DE IMPOSTO A PAGAR': 'saldoPagar',
  'Imposto Lei 14.754/2023': 'lei14754Imposto',
  'Rendimentos isentos e não tributáveis': 'rendimentosIsentosOficial',
  'Rendimentos sujeitos à tributação exclusiva/definitiva': 'rendimentosExclusivoOficial',
};
// As quatro linhas da Evolução Patrimonial trazem a data no próprio rótulo, que
// muda a cada exercício: a PRIMEIRA de cada par é sempre o ano anterior e a
// segunda o ano da declaração. Nunca cravar o ano aqui (mesma lição da
// correção do cabeçalho de Bens).
const RESUMO_EVOLUCAO = [
  [/^Bens e direitos em \d{2}\/\d{2}\/\d{4}$/, ['bensAnteriorOficial', 'bensAtualOficial']],
  [/^Dívidas e ônus reais em \d{2}\/\d{2}\/\d{4}$/, ['dividasAnteriorOficial', 'dividasAtualOficial']],
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
const nomeDaFichaNaoLida = (row) => {
  for (const c of row.cells) {
    const t = c.text.trim();
    if (FICHAS_NAO_LIDAS.includes(t)) return t;
    const pref = FICHAS_NAO_LIDAS_PREFIXO.find(p => t.startsWith(p));
    if (pref) return pref;
  }
  return null;
};

const GC_TITULO = /^Demonstrativo da Apuração do Ganho de Capital/;
const GC_DATA = /^\d{2}\/\d{2}\/\d{4}$/;
const GC_DOC = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

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

export async function parsePDF(pdf, log = noop, onProgress = noop) {
  log(`PDF aberto, ${pdf.numPages} páginas`, 'success');

  const contribuinte = { cpf: '', nome: '' };
  const bens = [];
  const dividas = [];
  const pagamentos = [];
  const doacoesEfetuadas = [];
  const doacoesPartidos = [];
  const doacoesEcaIdoso = [];
  let anoCalendario = null;
  let bemId = 1, dividaId = 1, pagId = 1;
  let doacaoEfId = 1, doacaoPartId = 1, doacaoEcaIdosoId = 1;
  const doacoesEfetuadasState = { anchors: null, current: null, items: doacoesEfetuadas, nextId: () => doacaoEfId++ };
  const doacoesPartidosState = { anchors: null, current: null, items: doacoesPartidos, nextId: () => doacaoPartId++ };
  // categoria começa null e é setada ao entrar em cada uma das duas
  // sub-fichas (ECA / Pessoa Idosa) que dividem esta mesma seção — ver os
  // dois gatilhos de título abaixo.
  const doacoesEcaIdosoState = { anchors: null, current: null, items: doacoesEcaIdoso, nextId: () => doacaoEcaIdosoId++, categoria: null };

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

  // Demonstrativo da Lei 14.754/2023, detalhado por bem.
  const demonstrativoExteriorOficial = [];

  // Dependentes: a ficha fica no fim da página 1, antes de qualquer rendimento.
  const dependentes = [];
  let depId = 1;

  // Isentos / Tributação Exclusiva: 'isento' | 'exclusivo', e o grupo do código
  // corrente com seus detalhes por fonte pagadora.
  let rieCategoria = null;
  let rieGrupo = null;
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
    if (currentBemRural) { bensRurais.push(currentBemRural); currentBemRural = null; }
    if (currentDividaRural) { dividasRurais.push(currentDividaRural); currentDividaRural = null; }
  };

  const flushGc = () => {
    if (currentGc) { apuracaoGanhoCapital.push(currentGc); currentGc = null; }
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
          cnpj_fonte: d.cnpj,
          nome_fonte: d.nome,
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
      rendimentos.push({
        ...base,
        id: rendId++,
        cnpj_fonte: '',
        nome_fonte: '',
        beneficiario: 'Titular',
        cpf_dependente: null,
        valor: g.valorAgregado,
      });
    }
  };

  const flushAllCurrent = () => {
    if (currentBem) { bens.push(currentBem); currentBem = null; }
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

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items
      .map(it => ({ text: it.str, x: it.transform[4], y: it.transform[5] }))
      .filter(it => it.text.trim() !== '');
    const rows = buildRows(items);
    onProgress(pageNum, pdf.numPages);

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];

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
        if (currentBem) { bens.push(currentBem); currentBem = null; }
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
        if (!apuracaoResultadoRuralOficial) apuracaoResultadoRuralOficial = { origem: 'pdf' };
        continue;
      }
      // Cada página desta ficha é uma operação nova; o título é o separador.
      if (row.cells.some(c => GC_TITULO.test(c.text.trim()))) {
        flushAllCurrent();
        section = 'ganhoCapital';
        currentGc = { id: gcId++, bem: '', dataAquisicao: '', custoAquisicao: 0, dataAlienacao: '', valorAlienacao: 0, custoCorretagem: 0, naturezaOperacao: '', ganhoCapital: 0, adquirenteCpfCnpj: '', adquirenteNome: '' };
        continue;
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
      if (rowHasCell(row, 'RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS')) {
        flushAllCurrent();
        section = 'rendimentosIsentosExclusiva';
        rieCategoria = 'isento';
        continue;
      }
      if (row.cells.some(c => /^RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA\s*\/\s*DEFINITIVA$/.test(c.text.trim()))) {
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
      // AGROINDUSTRIAIS" (titular e dependentes) é uma ficha IRMÃ da Renda
      // Variável, impressa logo depois dela e antes das doações — numa das
      // declarações de referência as três estão na mesma página. Ela NÃO é
      // lida hoje: está "Sem Informações" nas duas declarações disponíveis, e
      // sem um exemplo com dado real não há como confirmar que o layout é o
      // mesmo da Renda Variável. Fechar a seção aqui é o que impede que, numa
      // declaração que TENHA dado de FII, essas linhas entrem como se fossem
      // ganho de Renda Variável do contribuinte.
      if (row.cells.some(c => /^FUNDOS DE INVESTIMENTO IMOBILIÁRIO/.test(c.text.trim()))) {
        flushAllCurrent();
        section = null;
        continue;
      }
      // ANTES do fechamento genérico logo abaixo, de propósito: aquele bloco
      // casa qualquer título começando com "RENDIMENTOS" e faria `continue`,
      // e as fichas de rendimento não lidas nunca chegariam aqui para serem
      // observadas. Fechar a seção elas fechariam de qualquer jeito; o que se
      // perderia é o AVISO de que vieram preenchidas.
      const fichaNaoLida = nomeDaFichaNaoLida(row);
      if (fichaNaoLida) {
        flushAllCurrent();
        section = 'fichaNaoLida';
        fichaNaoLidaAtual = { nome: fichaNaoLida, temConteudo: false };
        continue;
      }

      // Observa a ficha não lida só o suficiente para saber se ela tem dado.
      // Nada daqui é importado: o objetivo é poder AVISAR, não adivinhar o
      // layout de uma ficha que nunca foi vista preenchida.
      if (section === 'fichaNaoLida') {
        const textos = row.cells.map(c => c.text.trim()).filter(Boolean);
        if (textos.some(t => t === 'Sem Informações')) {
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
          bensAnchors = {
            // Sem `?? 17`: nem toda declaração imprime a coluna "BEM" no
            // cabeçalho, e o padrão antigo colocava a âncora de `bem` no
            // MESMO x da de `GRUPO`, criando uma faixa de largura zero no
            // makeColumnPicker. Ausente é melhor que duplicada: o picker já
            // descarta âncora nula.
            bem: findCellX(row, 'BEM'),
            grupo: findCellX(row, 'GRUPO'),
            codigo: findCellX(row, 'CÓDIGO') ?? 95,
            disc: findCellX(row, 'DISCRIMINAÇÃO'),
            val1: dateCells[0]?.x ?? 389,
            val2: dateCells[1]?.x ?? 498,
          };
          continue;
        }
        if (!bensAnchors) continue;
        if (rowHasCell(row, 'TOTAL')) {
          if (currentBem) { bens.push(currentBem); currentBem = null; }
          continue;
        }
        const pick = makeColumnPicker(bensAnchors);
        const grupoTxt = textInColumn(row, pick, 'grupo');
        if (/^\d{2}$/.test(grupoTxt)) {
          if (currentBem) bens.push(currentBem);
          currentBem = {
            id: bemId++,
            grupo: grupoTxt,
            codigo_bem: textInColumn(row, pick, 'codigo'),
            discriminacao: textoDaColunaDisc(row, pick, bensAnchors).substring(0, 512),
            situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
            situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            localizacao: '105',
            beneficiario: 'Titular',
          };
        } else if (currentBem) {
          // Só o que cai na COLUNA de discriminação continua o texto do bem.
          // Este é o filtro principal, e resolve dois defeitos de uma vez
          // (auditoria de 21/08/2026, 45 dos 172 bens afetados):
          //
          // 1. Valor de campo do formulário que ficou sozinho numa linha,
          //    sem o rótulo ao lado, e por isso nenhum regex pegava: a
          //    localização ("105 - BRASIL", x≈17), a resposta de "Bem com
          //    usufruto" ("Não", x≈470) e a continuação do nome do cartório
          //    ("MUNICIPIO", x≈399) entravam como se fossem descrição
          //    do bem. Nenhum deles mora na coluna de discriminação.
          // 2. Texto REAL que era descartado inteiro por terminar num rótulo
          //    ("... SPE LTDA CNPJ:"), agora preservado, porque a coluna diz
          //    que aquilo é discriminação.
          //
          // `isBensMetadataRow` continua como segunda barreira, para o caso
          // em que o valor de um campo cai DENTRO da coluna de discriminação
          // (o "Titular"/"Dependente" da coluna Beneficiário, já documentado
          // lá), mas aplicado só ao texto dessa coluna.
          const extra = linhaTemRotuloAEsquerdaDaDisc(row, pick) ? '' : textoDaColunaDisc(row, pick, bensAnchors);
          if (extra && !valorDeCampoNaColunaDisc(extra)) {
            currentBem.discriminacao = normSpace(currentBem.discriminacao + ' ' + extra).substring(0, 512);
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
          currentDivida = {
            id: dividaId++,
            codigo: codigoTxt,
            discriminacao: textInColumn(row, pick, 'disc').substring(0, 512),
            situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
            situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            valor_pago: parseMoneyBR(textInColumn(row, pick, 'pago', '')),
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
        if (row.cells.some(c => /^Dependente:/.test(c.text.trim()))) continue;
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
            // Mesmo achado do caminho .DBK (ver parseDBK, registro 26): sem
            // data, o Dashboard zerava Pagamentos Efetuados sempre que um
            // período estava ativo.
            data: anoCalendario ? `${anoCalendario}-12-31` : '',
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
            currentBemRural = {
              id: bemRuralId++,
              codigo: cells[0].padStart(2, '0'),
              discriminacao: texto,
              situacao_anterior: parseMoneyBR(valores[0]),
              situacao_atual: parseMoneyBR(valores[1]),
              movimentacoes: [],
            };
          } else {
            currentDividaRural = {
              id: dividaRuralId++,
              discriminacao: texto,
              situacao_anterior: parseMoneyBR(valores[0]),
              situacao_atual: parseMoneyBR(valores[1]),
              valor_pago: parseMoneyBR(valores[2]),
              movimentacoes: [],
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
        // Linha de imóvel: código da atividade na primeira célula e CIB na
        // última. Exigir o CIB evita confundir com linha de participante.
        if (/^\d{2}$/.test(cells[0].t) && cib) {
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
            codigoAtividade: cells[0].t,
            participacao,
            condicaoExploracao: condicao,
            nomeLocalizacao: normSpace(texto.map(c => c.t).join(' ')),
            area,
            cib: cib.t,
            dataAquisicao: '',
          };
          imoveisRurais.push(ultimoImovelRural);
          emParticipantes = false;
          continue;
        }

        if (emParticipantes) {
          const m = AR_PARTICIPANTE.exec(cells[0].t);
          if (m) {
            participantesRuraisOficial.push({
              nome: normSpace(m[1]),
              cpf: m[2].replace(/\D/g, ''),
              // Vínculo que só o PDF entrega (ver ATUALIZAÇÃO 3, que registrou
              // isso como impossível pelo `.DBK`). A chave é o `id` do imóvel,
              // e NÃO o CIB: numa das declarações de referência dois imóveis
              // diferentes compartilham o CIB 2639188-0 (duas partes da mesma
              // mesma fazenda, uma de 147 ha e outra de 105,3 ha, com
              // condições de exploração diferentes). O CIB identifica o imóvel
              // no cadastro da Receita, não a linha da ficha.
              imovelId: ultimoImovelRural ? ultimoImovelRural.id : null,
              imovelCib: ultimoImovelRural ? ultimoImovelRural.cib : '',
              imovelNome: ultimoImovelRural ? ultimoImovelRural.nomeLocalizacao : '',
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
        const item = { especieCodigo: especie[1], especieNome: cells[0] };
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
        for (const { rotulo, valor } of paresRotuloValor(row)) {
          const campo = AR_APURACAO_CAMPOS[rotulo];
          if (campo) { apuracaoResultadoRuralOficial[campo] = valor; continue; }
          if (AR_ADIANTAMENTO_ANO.test(rotulo)) apuracaoResultadoRuralOficial.adiantamentoVendaFutura = valor;
          else if (AR_ADIANTAMENTO_ANTERIOR.test(rotulo)) apuracaoResultadoRuralOficial.adiantamentoAnosAnteriores = valor;
        }
        continue;
      }

      if (section === 'ganhoCapital') {
        if (!currentGc) continue;
        const cells = row.cells.map(c => c.text.trim()).filter(Boolean);
        const proxima = (rows[ri + 1] ? rows[ri + 1].cells.map(c => c.text.trim()).filter(Boolean) : []);
        const primeiraData = (lista) => lista.find(t => GC_DATA.test(t));
        const valoresDe = (lista) => lista.filter(t => RV_VALOR.test(t));

        // Blocos com o valor na linha DE BAIXO.
        if (rowHasCell(row, 'Especificação')) {
          currentGc.bem = normSpace(cells.filter(t => t !== 'Especificação').join(' '));
          continue;
        }
        if (rowHasCell(row, 'Data de aquisição')) {
          currentGc.dataAquisicao = dataDDMMAAAAparaIso((primeiraData(proxima) || '').replace(/\D/g, ''));
          currentGc.custoAquisicao = parseMoneyBR(valoresDe(proxima)[0] || '0');
          continue;
        }
        if (rowHasCell(row, 'Natureza da operação')) {
          currentGc.naturezaOperacao = proxima.find(t => !RV_VALOR.test(t) && !GC_DATA.test(t)) || '';
          currentGc.valorAlienacao = parseMoneyBR(valoresDe(proxima)[0] || '0');
          continue;
        }
        if (rowHasCell(row, 'Data de Alienação')) {
          currentGc.dataAlienacao = dataDDMMAAAAparaIso((primeiraData(proxima) || '').replace(/\D/g, ''));
          currentGc.custoCorretagem = parseMoneyBR(valoresDe(proxima)[0] || '0');
          continue;
        }
        if (rowHasCell(row, 'CPF/CNPJ') && rowHasCell(row, 'Nome')) {
          const doc = proxima.find(t => GC_DOC.test(t));
          if (doc) currentGc.adquirenteCpfCnpj = doc.replace(/\D/g, '');
          currentGc.adquirenteNome = normSpace(proxima.filter(t => t !== doc).join(' '));
          continue;
        }
        // Bloco final: rótulo e valor na MESMA linha. O rótulo tem que ser
        // exato: "Ganho de Capital" aparece também em "Ganho de Capital da
        // alienação atual", "Ganho de Capital Total" e "Faixa de Ganho de
        // Capital", que são outros números.
        if (rowHasCell(row, 'Ganho de Capital')) {
          const v = valoresDe(cells);
          if (v.length > 0) currentGc.ganhoCapital = parseMoneyBR(v[v.length - 1]);
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

        for (const { rotulo, valor } of paresRotuloValor(row)) {
          // "TOTAL" aparece duas vezes na página, uma por bloco; o rótulo
          // sozinho não diz qual é.
          if (rotulo === 'TOTAL') {
            if (resumoBloco === 'rendimentos') impostoDevido.rendimentosTributaveisTotal = valor;
            else if (resumoBloco === 'deducoes') impostoDevido.totalDeducoes = valor;
            continue;
          }
          const campo = RESUMO_CAMPOS[rotulo];
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

      if (section === 'dependentes') {
        if (rowHasCell(row, 'CÓDIGO') && rowHasCell(row, 'NOME')) continue;
        // "TOTAL DE DEDUÇÃO COM DEPENDENTES" fecha a ficha; o valor dele é a
        // dedução legal por dependente, que já vem pela ficha de Imposto
        // Devido e não é atributo de nenhum dependente em particular.
        if (row.cells.some(c => /^TOTAL DE DEDUÇÃO COM DEPENDENTES$/.test(c.text.trim()))) { section = null; continue; }
        if (row.cells.some(c => DEP_RUIDO.test(c.text.trim()))) continue;

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
        });
        continue;
      }

      if (section === 'rendimentosIsentosExclusiva') {
        // Cabeçalho da sub-tabela, em duas variantes: a comum tem "CNPJ da
        // Fonte Pagadora" e "Nome da Fonte Pagadora"; a de prêmios de loteria
        // tem só "Descrição" no lugar das duas. Nenhuma das duas é item.
        if (rowHasCell(row, 'Beneficiário') && rowHasCell(row, 'Valor')) continue;
        if (rowHasCell(row, 'TOTAL')) { flushRie(); continue; }
        if (rowHasCell(row, 'Sem Informações')) { flushRie(); continue; }

        const cells = row.cells.map(c => ({ ...c, t: c.text.trim() })).filter(c => c.t);
        if (cells.length === 0) continue;
        const valores = cells.filter(c => RV_VALOR.test(c.t));

        // Linha de DETALHE: começa com "Titular" ou "Dependente".
        if (RIE_BENEFICIARIO.test(cells[0].t) && rieGrupo) {
          const cpf = cells.find(c => RIE_CPF.test(c.t));
          const cnpj = cells.find(c => RIE_CNPJ.test(c.t));
          const ultimoValor = valores[valores.length - 1];
          // Nome/descrição da fonte: o que sobra entre os documentos e o valor.
          // Filtrar por identidade de célula (e não por texto) evita descartar
          // um pedaço de nome que por acaso repita um documento.
          const nome = normSpace(cells
            .filter(c => c !== cells[0] && c !== cpf && c !== cnpj && c !== ultimoValor)
            .map(c => c.t).join(' '));
          rieGrupo.detalhes.push({
            beneficiario: cells[0].t,
            cpf: cpf ? cpf.t.replace(/\D/g, '') : '',
            cnpj: cnpj ? cnpj.t.replace(/\D/g, '') : '',
            nome,
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

        // Sem valor e com texto: é continuação. Do nome da fonte, se a
        // sub-tabela já começou; da descrição do código, se ainda não.
        if (valores.length === 0 && rieGrupo) {
          const texto = normSpace(cells.map(c => c.t).join(' '));
          if (!texto) continue;
          const ultimo = rieGrupo.detalhes[rieGrupo.detalhes.length - 1];
          if (ultimo) ultimo.nome = normSpace(`${ultimo.nome} ${texto}`);
          else rieGrupo.descricao = normSpace(`${rieGrupo.descricao} ${texto}`);
        }
        continue;
      }

      if (section === 'rendimentosPJ') {
        // As duas linhas do cabeçalho da tabela ("NOME DA FONTE PAGADORA ..."
        // e a continuação "DE PES. JURÍDICA / OFICIAL / ...") não são item.
        if (rowHasCell(row, RPJ_CABECALHO)) { flushRpj(); continue; }
        if (rowHasCell(row, 'TOTAL')) { flushRpj(); continue; }

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

      if (section === 'doacoesEfetuadas') { processDoacaoRow(doacoesEfetuadasState, row); continue; }
      if (section === 'doacoesPartidos') { processDoacaoRow(doacoesPartidosState, row); continue; }
      if (section === 'doacoesEcaIdoso') { processDoacaoRow(doacoesEcaIdosoState, row); continue; }
    }
  }

  if (currentBem) bens.push(currentBem);
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
  for (const ficha of fichasNaoLidasComConteudo) {
    log(`A ficha "${ficha}" tem informação nesta declaração e NÃO foi importada: o app ainda não lê essa ficha. Confira esses valores na declaração original antes de usar os números desta tela.`, 'warning');
  }
  if (apuracaoGanhoCapital.length > 0) log(`Identificada(s) ${apuracaoGanhoCapital.length} operação(ões) na Apuração do Ganho de Capital`, 'success');
  const totalDoacoes = doacoesEfetuadas.length + doacoesPartidos.length + doacoesEcaIdoso.length;
  if (totalDoacoes > 0) {
    log(`Identificadas ${totalDoacoes} doação(ões): ${doacoesEfetuadas.length} efetuada(s), ${doacoesPartidos.length} a partidos/candidatos e ${doacoesEcaIdoso.length} diretamente na declaração (ECA/pessoa idosa)`, 'success');
  }

  const pfExterior = rendimentos.filter(r => r.tipo === 'tributavel_pf_exterior');
  if (pfExterior.length > 0) {
    const total = pfExterior.reduce((acc, r) => acc + r.valor, 0)
      .toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    log(`Identificados ${pfExterior.length} mês(es) com rendimentos de pessoa física ou do exterior, somando R$ ${total}`, 'success');
    log('Esta ficha (carnê-leão) foi implementada a partir do layout oficial da Receita, mas nunca pôde ser conferida contra uma declaração real preenchida. Confira esses valores na declaração original.', 'warning');
  }
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
    log(`Conferência da ficha de rendimentos: "${d.descricao}" soma R$ ${d.somaDetalhe.toFixed(2)} no detalhe, mas a própria declaração informa R$ ${d.valorAgregado.toFixed(2)} no total do código. Confira esse item na declaração original.`, 'warning');
  }
  log('Rendimentos recebidos de pessoa física e do exterior ainda não são lidos do PDF. Importe pelo arquivo .DBK se a declaração tiver esses rendimentos.', 'warning');
  if (imoveisRurais.length > 0 || bensRurais.length > 0 || dividasRurais.length > 0) {
    log(`Atividade Rural: ${imoveisRurais.length} imóvel(is) explorado(s), ${bensRurais.length} bem(ns), ${dividasRurais.length} dívida(s) vinculada(s), ${participantesRuraisOficial.length} participante(s) e ${movimentacaoRebanhoOficial.length} espécie(s) no rebanho`, 'success');
  }
  // Este aviso já foi corrigido duas vezes por ficar desatualizado (auditoria
  // de 21/08/2026 e agora), sempre pelo mesmo motivo: ele aparece também na
  // tela de criação de perfil, então errar aqui manda a pessoa cadastrar à mão
  // o que o arquivo já traz. Desde 23/08/2026 a Atividade Rural é lida INTEIRA
  // por este caminho; o que sobrou de fora está no aviso abaixo.
  log('Rendimentos lançados manualmente na Atividade Rural (livro-caixa do app) não vêm de arquivo nenhum; a ficha traz os totais mensais, que são importados.', 'warning');
  // O .DBK de referência não tem NENHUM registro para as 4 fichas de
  // Doações (nem "sem informação" — o tipo de registro simplesmente não
  // aparece), então esse caminho fica de fora de propósito (ver
  // parseDBK): o único jeito de importar Doações hoje é pelo PDF.
  // Este aviso dizia que o `.DBK` "não tem registro correspondente" a essas
  // fichas, o que era falso (registros 34, 90, 91 e 92 — ver ATUALIZAÇÃO 54).
  // O que continua verdade é que o layout LIDO AQUI, do PDF, nunca foi
  // conferido contra uma declaração com doação de verdade.
  if (doacoesEfetuadas.length > 0 || doacoesPartidos.length > 0 || doacoesEcaIdoso.length > 0) {
    log('As doações lidas deste PDF usam um layout de tabela extrapolado, que nunca pôde ser conferido contra uma declaração com doação real. Pelo arquivo .DBK essas fichas têm layout oficial: importe por lá se precisar de garantia.', 'warning');
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
    // Mesma chave que o .DBK preenche pelo registro 76, mas aqui com os
    // valores de cada mês, que o .DBK não permite decifrar. Quem consome
    // precisa continuar aceitando as entradas só com `mes` vindas do .DBK.
    rendaVariavelMensalOficial,
  };
}
