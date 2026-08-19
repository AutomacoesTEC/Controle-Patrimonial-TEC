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

export async function parseDBK(text, log = noop) {
  log('Lendo arquivo .DBK...');
  const lines = text.split(/\r\n|\r|\n/);

  const contribuinte = { cpf: '', nome: '' };
  const bens = [];
  const dividas = [];
  const rendimentos = [];
  const pagamentos = [];
  let anoCalendario = null;

  let bemId = 1, dividaId = 1, rendId = 1, pagId = 1;

  for (const line of lines) {
    const tipo = line.substring(0, 2);

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
          discriminacao: discriminacao.substring(0, 200),
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
          discriminacao: discriminacao.substring(0, 200),
          situacao_anterior: anterior,
          situacao_atual: atual,
          valor_pago: valorPago,
        });
      }
      continue;
    }

    if (tipo === '21') {
      const cnpj = field(line, 14, 14);
      const fonte = field(line, 28, 60);
      const rendimento = parseValorN13(field(line, 88, 13));
      const irrf = parseValorN13(field(line, 127, 13));
      if (fonte || rendimento) {
        rendimentos.push({
          id: rendId++,
          tipo: 'tributavel_pj',
          cnpj_fonte: cnpj,
          nome_fonte: fonte,
          beneficiario: 'Titular',
          valor: rendimento,
          irrf,
        });
      }
      continue;
    }

    if (tipo === '23' || tipo === '24') {
      const codigo = field(line, 14, 4);
      const valor = parseValorN13(field(line, 18, 13));
      if (valor) {
        rendimentos.push({
          id: rendId++,
          tipo: `${tipo === '23' ? 'isento' : 'exclusivo'}_${codigo}`,
          cnpj_fonte: '',
          nome_fonte: '',
          beneficiario: 'Titular',
          valor,
          irrf: 0,
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
      if (beneficiario || valorPago) {
        pagamentos.push({
          id: pagId++,
          codigo,
          nome_beneficiario: beneficiario,
          cpf_cnpj: normalizarCpfCnpj(ni),
          valor_pago: valorPago,
          parcela_nao_dedutivel: parcelaNaoDedutivel,
          descricao: '',
        });
      }
      continue;
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

  return { contribuinte, bens, dividas, rendimentos, pagamentos, anoCalendario };
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

const buildRows = (items) => {
  const rows = new Map();
  for (const it of items) {
    if (!it.text.trim()) continue;
    const key = Math.round(it.y);
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(it);
  }
  return [...rows.keys()]
    .sort((a, b) => b - a) // y do pdf.js cresce para cima: linha do topo primeiro
    .map(k => ({ y: k, cells: rows.get(k).sort((a, b) => a.x - b.x) }));
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
// curta terminando em ":" logo no início da linha — que o texto descritivo
// de um bem nunca usa.
const ROTULO_METADADO_RE = /(^|\s)[A-ZÀ-Ý][\wÀ-ÿ()°ºª./-]*(\s[A-ZÀ-Üa-zà-ÿ()°ºª./-]{1,20}){0,3}:(\s|$)/;
export const isBensMetadataRow = (row) => {
  const texto = normSpace(row.cells.map(c => c.text).join(' '));
  if (texto === 'Possui perdas a compensar de acordo com a Lei nº 14.754, de 2023 (art. 9º)?') return true;
  // A linha pode trazer o rótulo grudado a um pedacinho de boilerplate do
  // próprio formulário antes dele (ex.: "105 - BRASIL Bem com usufruto:
  // Não") — o rótulo não precisa estar bem no início da linha pra ela
  // inteira ser metadado, não discriminação de verdade.
  return ROTULO_METADADO_RE.test(texto);
};
const isBoilerplateRow = (row) =>
  row.cells.some(c => BOILERPLATE.has(c.text.trim()) || /^(ANO-CALENDÁRIO|EXERCÍCIO) \d{4}$/.test(c.text.trim())) ||
  /^Página \d+ de \d+$/.test(row.cells.map(c => c.text).join(' ').trim());

export async function parsePDF(pdf, log = noop, onProgress = noop) {
  log(`PDF aberto, ${pdf.numPages} páginas`, 'success');

  const contribuinte = { cpf: '', nome: '' };
  const bens = [];
  const dividas = [];
  const pagamentos = [];
  let anoCalendario = null;
  let bemId = 1, dividaId = 1, pagId = 1;

  // 'bens' | 'dividas' | 'pagamentos' | null — seção corrente do formulário
  let section = null;
  // Uma vez visto o anexo de Atividade Rural, ignora bens/dívidas/pagamentos
  // adicionais: são sub-tabelas com layout de colunas diferente (sem os
  // campos que o app modela) e o .DBK também não as cobre — mesmo escopo.
  let pastRuralAnnex = false;

  let bensAnchors = null;
  let dividasAnchors = null;
  let pagAnchors = null;

  let currentBem = null;
  let currentDivida = null;
  let currentPag = null;

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
      if (
        rowHasCell(row, 'DOAÇÕES EFETUADAS') ||
        rowHasCell(row, 'DÍVIDAS VINCULADAS À ATIVIDADE RURAL - BRASIL') ||
        row.cells.some(c => /^(RENDIMENTOS|DEMONSTRATIVO|OUTRAS INFORMAÇÕES|EVOLUÇÃO PATRIMONIAL)/.test(c.text.trim()))
      ) {
        if (currentBem) { bens.push(currentBem); currentBem = null; }
        if (currentDivida) { dividas.push(currentDivida); currentDivida = null; }
        if (currentPag) { pagamentos.push(currentPag); currentPag = null; }
        section = null;
        continue;
      }

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
            bem: findCellX(row, 'BEM') ?? 17,
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
            discriminacao: textInColumn(row, pick, 'disc').substring(0, 500),
            situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
            situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            localizacao: '105',
            beneficiario: 'Titular',
          };
        } else if (currentBem && !isBensMetadataRow(row)) {
          const extra = normSpace(row.cells.map(c => c.text).join(' '));
          if (extra) currentBem.discriminacao = normSpace((currentBem.discriminacao + ' ' + extra)).substring(0, 500);
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
            discriminacao: textInColumn(row, pick, 'disc').substring(0, 500),
            situacao_anterior: parseMoneyBR(textInColumn(row, pick, 'val1', '')),
            situacao_atual: parseMoneyBR(textInColumn(row, pick, 'val2', '')),
            valor_pago: parseMoneyBR(textInColumn(row, pick, 'pago', '')),
          };
        } else if (currentDivida) {
          const extra = normSpace(row.cells.map(c => c.text).join(' '));
          if (extra) currentDivida.discriminacao = normSpace((currentDivida.discriminacao + ' ' + extra)).substring(0, 500);
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
          };
        } else if (currentPag) {
          const extra = textInColumn(row, pick, 'nome');
          if (extra) currentPag.nome_beneficiario = normSpace(currentPag.nome_beneficiario + ' ' + extra);
        }
      }
    }
  }

  if (currentBem) bens.push(currentBem);
  if (currentDivida) dividas.push(currentDivida);
  if (currentPag) pagamentos.push(currentPag);

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
  log('Rendimentos do Demonstrativo de Atividade Rural não são lidos do PDF; importe pelo arquivo .DBK se precisar deles.', 'warning');
  log('Imóveis, bens e dívidas da Atividade Rural não são lidos nem pelo PDF nem pelo .DBK — cadastre-os na aba Atividade Rural.', 'warning');

  return { contribuinte, bens, dividas, rendimentos: [], pagamentos, anoCalendario };
}
