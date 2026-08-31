// Testa os parsers contra as declarações REAIS de exemplo (exercício 2026,
// ano-calendário 2025), não contra dado sintético: é o que teria pego a
// regressão do ano cravado no código. As declarações moram fora do
// repositório de propósito, porque carregam CPF e dado financeiro de pessoas
// reais.
//
// NENHUM dado pessoal fica neste arquivo. O nome dos arquivos e os valores
// pessoais esperados (nome de adquirente, de participante rural, de
// dependente, e-mail do titular) vêm de um MANIFESTO local, ao lado das
// próprias declarações, que também fica fora do repositório. Sem ele, os
// testes que dependem das declarações pulam em vez de falhar, e as asserções
// sobre valor pessoal simplesmente não rodam, sem enfraquecer o resto.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { parseDBK, parsePDF, normalizarCpfCnpj, isBensMetadataRow } from './importParsers';

// Por padrão, as declarações ficam na pasta imediatamente acima do
// repositório. IRPF_FIXTURES_DIR permite executar a mesma suíte em CI ou em
// outra máquina sem gravar o caminho pessoal de um desenvolvedor no código.
const DIR = process.env.IRPF_FIXTURES_DIR
  || fileURLToPath(new URL('../../../', import.meta.url));
// Manifesto local: nomes de arquivo e valores pessoais esperados. Fora do
// repositório, ao lado das declarações. IRPF_FIXTURES_MANIFEST permite
// apontá-lo para outro lugar.
const MANIFESTO_PATH = process.env.IRPF_FIXTURES_MANIFEST || `${DIR}/declaracoes-reais.local.json`;
const manifesto = existsSync(MANIFESTO_PATH) ? JSON.parse(readFileSync(MANIFESTO_PATH, 'utf8')) : null;
const arq = (chave) => (manifesto?.arquivos?.[chave] ? `${DIR}/${manifesto.arquivos[chave]}` : null);
// Valor pessoal esperado. Sem manifesto devolve null, e `esperaPessoal` não
// executa a asserção: é o mesmo critério do `describe.skipIf` dos arquivos.
const pessoal = (chave) => manifesto?.pessoais?.[chave] ?? null;
const esperaPessoal = (recebido, chave) => {
  const valor = pessoal(chave);
  if (valor == null) return;
  expect(recebido).toBe(valor);
};

// Para BUSCAR por um valor pessoal (nome de imóvel, município). Sem a chave no
// manifesto a busca não acha nada e o teste falha com um nome que diz o motivo,
// em vez de passar por engano comparando undefined com undefined.
const buscaPessoal = (chave) => pessoal(chave) ?? `__CHAVE_AUSENTE_NO_MANIFESTO_${chave}__`;

const DBK_PATH = arq('dbk');
const PDF_PATH = arq('pdf');
// Segundo contribuinte, SEM .DBK, usado para provar que o parser não depende
// do layout de um arquivo só: cabeçalho sem a coluna "BEM", coluna de valores
// alguns pixels mais à direita, fichas de Dívidas e de Doações vindo "Sem
// Informações", parcela não dedutível diferente de zero e pagamentos
// espalhados por duas páginas. Ver PDF2_PATH nos testes lá embaixo.
const PDF2_PATH = arq('pdf2');

const temArquivos = !!DBK_PATH && !!PDF_PATH && existsSync(DBK_PATH) && existsSync(PDF_PATH);
const temSegundoPdf = !!PDF2_PATH && existsSync(PDF2_PATH);

describe('parsePDF, validação de entrada', () => {
  const pdfSintetico = (textos) => ({
    numPages: 1,
    getPage: async () => ({
      getTextContent: async () => ({
        items: textos.map((str, i) => ({ str, transform: [1, 0, 0, 1, 20 + i * 8, 700] })),
      }),
    }),
  });

  it('recusa PDF sem camada de texto e orienta sobre OCR', async () => {
    await expect(parsePDF(pdfSintetico([]))).rejects.toThrow(/camada de texto utilizável.*OCR/i);
  });

  it('recusa PDF textual que não tem a assinatura estrutural de uma declaração IRPF', async () => {
    const texto = 'RELATÓRIO FINANCEIRO COMUM '.repeat(12);
    await expect(parsePDF(pdfSintetico([texto]))).rejects.toThrow(/não foi reconhecido como uma declaração IRPF completa/i);
  });
});

if (process.env.IRPF_FIXTURES_REQUIRED === '1' && (!temArquivos || !temSegundoPdf)) {
  throw new Error(
    `Fixtures reais do IRPF não encontradas em "${DIR}". `
    + 'Defina IRPF_FIXTURES_DIR ou coloque os três arquivos ao lado do repositório.'
  );
}

describe.skipIf(!temArquivos)('parseDBK (arquivo real)', () => {
  it('bate os totais e a contagem contra o registro-resumo interno do próprio .DBK', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);

    expect(r.anoCalendario).toBe(2025);
    esperaPessoal(r.contribuinte.cpf, 'titularCpf');
    expect(r.contribuinte.dataNascimento).toBe('1952-06-10');
    esperaPessoal(r.contribuinte.cpfConjuge, 'conjugeCpf');
    esperaPessoal(r.contribuinte.municipio, 'titularMunicipio');
    expect(r.contribuinte.uf).toBe('MG');
    expect(r.contribuinte.ocupacaoCodigo).toBe('120');
    expect(r.documentoFonte.formato).toBe('dbk');
    expect(r.documentoFonte.totalRegistros).toBeGreaterThan(200);
    expect(r.documentoFonte.textoIntegral).toBe(text);
    expect(r.documentoFonte.sha256TextoExtraido).toMatch(/^[a-f0-9]{64}$/);
    expect(r.bens).toHaveLength(172);
    expect(r.dividas).toHaveLength(1);
    expect(r.pagamentos).toHaveLength(24);

    const somaAnt = r.bens.reduce((s, b) => s + b.situacao_anterior, 0);
    const somaAtu = r.bens.reduce((s, b) => s + b.situacao_atual, 0);
    expect(somaAnt).toBeCloseTo(79550353.28, 2);
    expect(somaAtu).toBeCloseTo(137977220.38, 2);
  });

  // CNPJ da fonte de cada bem (NM_CPFCNPJ, posição 1042 do registro 27). É o
  // campo que liga um bem ao rendimento pago pela MESMA instituição — ver
  // aplicacoesResgatadasSemRendimento em demonstrativos.js. O caminho PDF lê o
  // mesmo número de um rótulo impresso na coluna esquerda do bloco do bem, e
  // este teste prova que os dois chegam ao mesmo valor.
  it('lê o CNPJ da fonte de cada bem (registro 27) e o PDF chega ao mesmo número', async () => {
    const dbk = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await parsePDF(await pdfjsLib.getDocument({ data: new Uint8Array(await readFile(PDF_PATH)) }).promise);

    const acha = (lista, trecho) => lista.find(b => (b.discriminacao || '').includes(trecho));
    // Três rótulos diferentes na mesma ficha: "CNPJ:" com o número formatado,
    // "CNPJ do Fundo:" num fundo de investimento e "CPF:" em dígitos crus,
    // num empréstimo a pessoa física.
    for (const [trecho, esperado] of [
      ['XP INVESTIMENTOS SALDO EM CONTA CORRENTE', '02332886000104'],
      ['GAVEA MACRO SELECAO', '25682163000122'],
      // O terceiro par é o empréstimo a pessoa física: o trecho da
      // discriminação e o CPF vêm do manifesto local, porque identificam
      // alguém real. Sem manifesto, só este par sai da lista.
      ...(pessoal('emprestimoTrecho') ? [[pessoal('emprestimoTrecho'), pessoal('emprestimoCpf')]] : []),
    ]) {
      expect(acha(dbk.bens, trecho)?.cnpj).toBe(esperado);
      expect(acha(pdf.bens, trecho)?.cnpj).toBe(esperado);
    }

    // E o conjunto inteiro: casando bem a bem por discriminação e valores, os
    // dois caminhos têm que dar o mesmo CNPJ.
    const chave = (b) => `${(b.discriminacao || '').replace(/\s+/g, ' ')}|${b.situacao_anterior}|${b.situacao_atual}`;
    const doDbk = new Map(dbk.bens.map(b => [chave(b), b.cnpj || '']));
    const divergentes = [];
    let comparados = 0;
    for (const b of pdf.bens) {
      const esperado = doDbk.get(chave(b));
      if (esperado === undefined) continue;
      comparados++;
      if ((b.cnpj || '') !== esperado) divergentes.push(`${chave(b).slice(0, 50)} pdf=${b.cnpj || '-'} dbk=${esperado || '-'}`);
    }
    expect(comparados).toBeGreaterThan(150);
    // LIMITAÇÃO CONHECIDA, e por isso o teto é 1 e não 0: o bloco de um bem
    // pode atravessar a quebra de página, e o título "DECLARAÇÃO DE BENS E
    // DIREITOS" repetido no topo da página seguinte fecha o bem antes de a
    // linha do CNPJ ser lida. Acontece com 1 dos 172 bens desta declaração
    // (as ações da COBEB, cuja discriminação vai até o rodapé da página 19).
    // Pelo .DBK o campo vem sempre.
    expect(divergentes.length).toBeLessThanOrEqual(1);
  }, 90000);

  // Achado A6 da auditoria de 21/08/2026: a descrição de cada Pagamento
  // Efetuado só era lida pelo caminho PDF; pelo .DBK os 24 pagamentos vinham
  // com o campo vazio. A posição (147, largura 512) foi decifrada contra as
  // 18 descrições reais desta declaração, todas na mesma posição, e a largura
  // sai da estrutura da linha de 671 caracteres: sobram exatamente os 13 do
  // número interno de registro no fim.
  it('lê a descrição de cada Pagamento Efetuado (registro 26), batendo com o que o PDF lê', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);

    const comDescricao = r.pagamentos.filter(p => p.descricao.trim() !== '');
    expect(comDescricao).toHaveLength(18);

    const medico = r.pagamentos.find(p => p.cpf_cnpj === '09096353668');
    expect(medico.descricao).toBe('MEDICO');

    const jacare = r.pagamentos.filter(p => p.descricao === 'ARRENDAMENTO RURAL DA FAZENDA JACARE');
    expect(jacare).toHaveLength(4);

    // Nenhuma descrição pode arrastar o número interno de registro que vem
    // logo depois dela na linha (é o erro que uma largura maior que 512
    // produziria).
    for (const p of r.pagamentos) expect(p.descricao).not.toMatch(/\d{13}$/);
  });

  it('lê o Resumo/Imposto Devido (registro 20) batendo com a página RESUMO da declaração real', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.impostoDevido).toBeTruthy();
    expect(r.impostoDevido.rendimentosTributaveisTotal).toBeCloseTo(45567.84, 2);
    expect(r.impostoDevido.dependentes).toBeCloseTo(2275.08, 2);
    expect(r.impostoDevido.despesasMedicas).toBeCloseTo(24280, 2);
    expect(r.impostoDevido.totalDeducoes).toBeCloseTo(26555.08, 2);
    expect(r.impostoDevido.baseCalculo).toBeCloseTo(19012.76, 2);
    expect(r.impostoDevido.impostoDevidoTotal).toBeCloseTo(273308.93, 2);
    expect(r.impostoDevido.impostoPagoTotal).toBeCloseTo(774.78, 2);
    expect(r.impostoDevido.saldoPagar).toBeCloseTo(272534.15, 2);
    // Cruzamento com a página "Evolução Patrimonial" (conferido antes contra
    // os totais que o próprio app calcula a partir de bens/dívidas
    // importados — aqui é o valor OFICIAL da declaração, deve bater igual).
    expect(r.impostoDevido.bensAnteriorOficial).toBeCloseTo(79550353.28, 2);
    expect(r.impostoDevido.bensAtualOficial).toBeCloseTo(137977220.38, 2);
    expect(r.impostoDevido.dividasAnteriorOficial).toBeCloseTo(36000, 2);
    expect(r.impostoDevido.dividasAtualOficial).toBeCloseTo(36000, 2);
    expect(r.impostoDevido.rendimentosIsentosOficial).toBeCloseTo(69879549.10, 2);
    expect(r.impostoDevido.rendimentosExclusivoOficial).toBeCloseTo(7187950.30, 2);
    expect(r.impostoDevido.lei14754Ganho).toBeCloseTo(1822059.55, 2);
    expect(r.impostoDevido.lei14754Imposto).toBeCloseTo(273308.93, 2);
  });

  it('lê a Apuração do Ganho de Capital oficial (registros 62/65/69) batendo com as 3 operações reais da declaração', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.apuracaoGanhoCapital).toHaveLength(3);

    const jeep = r.apuracaoGanhoCapital.find(x => x.bem.includes('JEEP'));
    expect(jeep.dataAquisicao).toBe('2022-05-22');
    expect(jeep.custoAquisicao).toBeCloseTo(269655.86, 2);
    expect(jeep.dataAlienacao).toBe('2025-02-07');
    expect(jeep.valorAlienacao).toBeCloseTo(199000, 2);
    expect(jeep.ganhoCapital).toBe(0); // prejuízo, a declaração mostra 0,00 (não negativo)
    esperaPessoal(jeep.adquirenteCpfCnpj, 'jeepAdquirenteCpf');
    esperaPessoal(jeep.adquirenteNome, 'jeepAdquirenteNome');

    const ranger = r.apuracaoGanhoCapital.find(x => x.bem.includes('FORD RANGER'));
    expect(ranger.custoAquisicao).toBeCloseTo(341890, 2);
    expect(ranger.valorAlienacao).toBeCloseTo(270000, 2);
    expect(ranger.adquirenteCpfCnpj).toBe('10376703000768'); // CNPJ, não CPF
    expect(ranger.adquirenteNome).toBe('FOCO AUTOMOVEIS LTDA');

    const bmw = r.apuracaoGanhoCapital.find(x => x.bem.includes('BMW'));
    expect(bmw.custoAquisicao).toBeCloseTo(399234, 2);
    expect(bmw.valorAlienacao).toBeCloseTo(300000, 2);
    expect(bmw.adquirenteCpfCnpj).toBe('00416863000144');
    expect(bmw.adquirenteNome).toBe('EUROVILLE VEICULOS E PECAS LTDA');
  });

  it('lê Atividade Rural (registros 50/54) batendo com o total oficial de "Bens da Atividade Rural" da declaração real', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.imoveisRurais).toHaveLength(24);
    expect(r.bensRurais).toHaveLength(60);

    const olaria = r.imoveisRurais.find(i => i.nomeLocalizacao.includes(buscaPessoal('imovelOlariaNome')));
    expect(olaria.area).toBeCloseTo(147.4, 1);
    expect(olaria.participacao).toBeCloseTo(100, 2);
    expect(olaria.condicaoExploracao).toBe('1');
    expect(olaria.codigoAtividade).toBe('10');
    expect(olaria.cib).toBe('1330217-5');

    // Achado real: situação anterior/atual vêm em ORDEM INVERTIDA no
    // registro 54 (bens rurais) comparado ao registro 27 (bens comuns) —
    // conferido com um bem comprado só em 2025 (anterior=0).
    const semiReboque = r.bensRurais.find(b => b.discriminacao.startsWith('SEMI REBOQUE MARCA LIBRELATTO MODELO S,'));
    expect(semiReboque.situacao_anterior).toBe(0);
    expect(semiReboque.situacao_atual).toBeCloseTo(100000, 2);
    expect(semiReboque.controle).toMatch(/^\d{10}$/);
    expect(new Set(r.bensRurais.map(b => b.controle)).size).toBe(r.bensRurais.length);

    const somaAnt = r.bensRurais.reduce((s, b) => s + b.situacao_anterior, 0);
    const somaAtu = r.bensRurais.reduce((s, b) => s + b.situacao_atual, 0);
    expect(somaAnt).toBeCloseTo(12911826.81, 2);
    expect(somaAtu).toBeCloseTo(14404980.58, 2);
  });

  it('lê Dívidas Vinculadas à Atividade Rural (registro 55) batendo com as 6 dívidas reais da declaração', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.dividasRurais).toHaveLength(6);
    const somaAnt = r.dividasRurais.reduce((s, d) => s + d.situacao_anterior, 0);
    const somaAtu = r.dividasRurais.reduce((s, d) => s + d.situacao_atual, 0);
    const somaPago = r.dividasRurais.reduce((s, d) => s + d.valor_pago, 0);
    // Totais conferidos contra as coordenadas reais do PDF (não contra uma
    // leitura solta do texto — a ordem das 3 colunas na linha TOTAL só ficou
    // clara olhando a posição x de cada número).
    expect(somaAnt).toBeCloseTo(4400361.87, 2);
    expect(somaAtu).toBeCloseTo(2616738.92, 2);
    expect(somaPago).toBeCloseTo(2074797.15, 2);

    const sicoob = r.dividasRurais.find(d => d.discriminacao.startsWith('EMPRESTIMO  DE CREDITO RURAL NO SICOOB'));
    expect(sicoob.controle).toMatch(/^\d{10}$/);
    expect(sicoob.situacao_anterior).toBeCloseTo(721556.97, 2);
    expect(sicoob.situacao_atual).toBeCloseTo(541254.17, 2);
    expect(sicoob.valor_pago).toBeCloseTo(216819.99, 2);
  });

  it('lê Receitas e Despesas mensais (registro 51) batendo com a posição x real (coordenadas do PDF) de cada valor na página "RECEITAS E DESPESAS - BRASIL", não com a ordem em que o texto aparece no stream', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.receitasDespesasRuraisOficial).toHaveLength(12);
    expect(r.receitasDespesasRuraisOficial.map(m => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    // Achado real: os dois campos do registro 51 são o INVERSO do que a
    // leitura ingênua do texto do PDF sugere. Confirmado por coordenada x
    // (a coluna "DESPESAS DE CUSTEIO/INVESTIMENTO" fica à direita da
    // página, x≈515, onde na verdade cai o valor de field(17,13); a coluna
    // "RECEITA BRUTA" fica mais à esquerda, x≈223, onde cai field(30,13))
    // e pela soma dos 12 meses batendo com os totais do registro 52 (soma
    // de field(17,13) = despesaTotal 13.583.255,03; soma de field(30,13) =
    // receitaBrutaTotal 12.021.185,04) — ver HANDOFF.
    const jan = r.receitasDespesasRuraisOficial.find(m => m.mes === 1);
    expect(jan.despesaCusteioInvestimento).toBeCloseTo(986223.47, 2);
    expect(jan.receitaBruta).toBeCloseTo(571165.26, 2);

    const fev = r.receitasDespesasRuraisOficial.find(m => m.mes === 2);
    expect(fev.despesaCusteioInvestimento).toBeCloseTo(758276.87, 2);
    expect(fev.receitaBruta).toBeCloseTo(607676.54, 2);

    const dez = r.receitasDespesasRuraisOficial.find(m => m.mes === 12);
    expect(dez.despesaCusteioInvestimento).toBeCloseTo(1295200.83, 2);
    expect(dez.receitaBruta).toBeCloseTo(14940.39, 2);

    const somaReceita = r.receitasDespesasRuraisOficial.reduce((s, m) => s + m.receitaBruta, 0);
    const somaDespesa = r.receitasDespesasRuraisOficial.reduce((s, m) => s + m.despesaCusteioInvestimento, 0);
    expect(somaReceita).toBeCloseTo(12021185.04, 2);
    expect(somaDespesa).toBeCloseTo(13583255.03, 2);
  });

  // Os NOMES de três campos deste registro estavam errados até 23/08/2026. O
  // layout foi decifrado casando valores contra o PDF, mas sem os rótulos: os
  // nomes vieram da ordem esperada. Quando o caminho PDF passou a ler a mesma
  // ficha, com o rótulo impresso ao lado de cada valor, as deduções caíram.
  // Ver o comentário do registro 52 no parser. O erro era visível: a tela
  // Atividade Rural exibia "Resultado Tributável R$ 2.404.237,00" num card em
  // destaque, quando a declaração informa R$ 0,00.
  it('lê a Apuração do Resultado (registro 52) batendo com a página "APURAÇÃO DO RESULTADO - BRASIL"', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.apuracaoResultadoRuralOficial).toBeTruthy();
    expect(r.apuracaoResultadoRuralOficial.receitaBrutaTotal).toBeCloseTo(12021185.04, 2);
    expect(r.apuracaoResultadoRuralOficial.despesaTotal).toBeCloseTo(13583255.03, 2);
    expect(r.apuracaoResultadoRuralOficial.resultado).toBeCloseTo(-1562069.99, 2);

    // 3.099.318,03 é o SALDO de prejuízo de exercícios anteriores, impresso na
    // seção "INFORMAÇÃO DO EXERCÍCIO ANTERIOR"; a compensação do próprio ano é
    // 0,00, numa linha diferente da ficha.
    expect(r.apuracaoResultadoRuralOficial.saldoPrejuizoExercicioAnterior).toBeCloseTo(3099318.03, 2);
    expect(r.apuracaoResultadoRuralOficial.compensacaoPrejuizoAnterior).toBe(0);

    // 2.404.237,00 é o LIMITE de 20% sobre a receita bruta, não o resultado
    // tributável. Confere pela aritmética (20% de 12.021.185,04 = 2.404.237,01)
    // e pela lógica: com resultado do ano negativo não há o que tributar.
    expect(r.apuracaoResultadoRuralOficial.limite20PctReceitaBruta).toBeCloseTo(2404237.00, 2);
    expect(r.apuracaoResultadoRuralOficial.resultadoTributavel).toBe(0);
    expect(r.apuracaoResultadoRuralOficial.limite20PctReceitaBruta)
      .toBeCloseTo(r.apuracaoResultadoRuralOficial.receitaBrutaTotal * 0.20, 0);

    // 4.661.388,02 é o saldo de prejuízo a compensar no exercício SEGUINTE,
    // impresso em "INFORMAÇÕES PARA O EXERCÍCIO SEGUINTE", e não adiantamento
    // de venda para entrega futura (que é 0,00).
    expect(r.apuracaoResultadoRuralOficial.saldoPrejuizoExercicioSeguinte).toBeCloseTo(4661388.02, 2);
    expect(r.apuracaoResultadoRuralOficial.adiantamentoVendaFutura).toBe(0);
    expect(r.apuracaoResultadoRuralOficial.resultadoNaoTributavel).toBe(0);
  });

  it('lê a Movimentação do Rebanho (registro 53) batendo com a linha de Bovinos e bufalinos da página "MOVIMENTAÇÃO DO REBANHO - BRASIL"', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    // Só existe 1 registro no arquivo de referência: as demais espécies
    // (Suínos, Caprinos e ovinos, Asininos/equinos/muares, Outros) estão
    // todas zeradas na declaração real e não geram linha no .DBK.
    expect(r.movimentacaoRebanhoOficial).toHaveLength(1);
    const bovinos = r.movimentacaoRebanhoOficial[0];
    expect(bovinos.especieCodigo).toBe('01');

    // CORRIGIDO EM 23/08/2026: as seis colunas estavam sendo lidas na ordem
    // INVERSA, e este teste fixava os valores errados (estoque inicial 125 e
    // final 29, aquisições 27 e vendas 123). Os números certos são os que a
    // ficha imprime, na ordem do cabeçalho: ESTOQUE INICIAL, AQUISIÇÕES,
    // NASCIMENTOS, CONSUMO E PERDAS, VENDAS, ESTOQUE FINAL.
    expect(bovinos.estoqueInicial).toBeCloseTo(29, 2);
    expect(bovinos.aquisicoes).toBeCloseTo(123, 2);
    expect(bovinos.nascimentos).toBeCloseTo(0, 2);
    expect(bovinos.consumoPerdas).toBeCloseTo(0, 2);
    expect(bovinos.vendas).toBeCloseTo(27, 2);
    expect(bovinos.estoqueFinal).toBeCloseTo(125, 2);

    // A prova de que a ordem é esta e não a inversa: a equação da própria
    // ficha só fecha assim. Com os valores antigos ela produzia 29, que é o
    // estoque INICIAL, no lugar do final.
    expect(bovinos.estoqueInicial + bovinos.aquisicoes + bovinos.nascimentos - bovinos.consumoPerdas - bovinos.vendas)
      .toBeCloseTo(bovinos.estoqueFinal, 2);
  });

  it('lê os Participantes dos Imóveis Rurais (registro 57) batendo com os 18 "PARTICIPANTE(S)" da declaração real', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.participantesRuraisOficial).toHaveLength(18);

    const osires = r.participantesRuraisOficial.find(p => p.cpf === pessoal('participante1Cpf'));
    esperaPessoal(osires.cpf, 'participante1Cpf');
    esperaPessoal(osires.nome, 'participante1Nome');

    // Nome com apóstrofo vira espaço no .DBK (sem acentuação/pontuação
    // especial, mesma limitação já vista em outros campos de nome do
    // arquivo): o PDF traz o apóstrofo, o .DBK não.
    const joana = r.participantesRuraisOficial.find(p => p.cpf === pessoal('participante2Cpf'));
    esperaPessoal(joana.nome, 'participante2Nome');

    const adelia = r.participantesRuraisOficial.find(p => p.cpf === pessoal('participante3Cpf'));
    esperaPessoal(adelia.cpf, 'participante3Cpf');
  });

  it('lê o Demonstrativo Lei 14.754/2023 por bem (registro 37) batendo com a página "DEMONSTRATIVO DE APURAÇÃO - LEI 14.754/2023"', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    // Só existe 1 registro no arquivo de referência (bem 133, tipo AF —
    // "Tipo" não é decifrado, ver comentário em importParsers.js).
    expect(r.demonstrativoExteriorOficial).toHaveLength(1);
    const bem133 = r.demonstrativoExteriorOficial[0];
    expect(bem133.bem).toBe(133);
    expect(bem133.ganhoPrejuizo).toBeCloseTo(1822059.55, 2);
    expect(bem133.impostoDevido).toBeCloseTo(273308.93, 2);
    expect(bem133.impostoPagoBrasilExterior).toBe(0);
    expect(bem133.baseCalculo).toBeCloseTo(1822059.55, 2);
    expect(bem133.saldo).toBeCloseTo(1822059.55, 2);
    // Bate com o agregado do registro 20, já em produção.
    expect(r.impostoDevido.lei14754Ganho).toBeCloseTo(bem133.ganhoPrejuizo, 2);
    expect(r.impostoDevido.lei14754Imposto).toBeCloseTo(bem133.impostoDevido, 2);
  });

  // CORREÇÃO DE 24/08/2026. Este teste fixava um comportamento ERRADO: que o
  // registro 76 seria a renda variável mensal, e que os 12 registros dele nesta
  // declaração significavam 12 meses de ficha. O mapa oficial de registros
  // mostra que 76 é `REG_GCME_PARCELA_ESPECIE` (ganho de capital em moeda
  // estrangeira) e que a renda variável é o registro 40.
  //
  // Esta declaração NÃO tem renda variável nenhuma — o PDF dela traz as duas
  // fichas inteiras "Sem Informações", e não existe registro 40 no arquivo. Os
  // dois caminhos passam a concordar nisso.
  it('não inventa renda variável a partir do registro 76, que é de outra ficha', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    expect(r.rendaVariavelMensalOficial).toEqual([]);
  });

  it('lê a renda variável do registro 40, com as mesmas colunas do PDF', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    // Registro 40 montado nas posições oficiais: mês 07, ações comuns 1.500,00,
    // resultado líquido do mês 1.500,00 e alíquotas 15/20.
    const zeros = (n) => N13(0).repeat(n);
    const linha =
      '40' + '11144477735' + '07' +
      N13(1500) + zeros(12) +           // 16..172  operações comuns (13 mercados)
      zeros(13) +                       // 185..341 day-trade
      zeros(3) +                        // 354, 367, 380
      zeros(2) +                        // 393, 406
      zeros(1) +                        // 419
      N13(1500) + N13(0) +              // 432, 445 resultado líquido
      N13(1500) + N13(0) +              // 458, 471 base de cálculo
      zeros(2) +                        // 484, 497 prejuízo
      '015' + '020' +                   // 510, 513 alíquotas
      N13(225) + N13(0) +               // 516, 529 imposto devido
      N13(225) +                        // 542 total
      zeros(2) +                        // 555, 568
      N13(225) +                        // 581 imposto a pagar
      zeros(2) +                        // 594, 607
      'N' + '           ' + '0000000001';
    const arquivo = `${await readFile(DBK_PATH, 'latin1')}\n${linha}\n`;
    const r = await parseDBK(arquivo);

    expect(r.rendaVariavelMensalOficial).toHaveLength(1);
    const rv = r.rendaVariavelMensalOficial[0];
    expect(rv.mes).toBe(7);
    expect(rv.titular).toBe(true);
    expect(rv.comuns.vistaAcoes).toBeCloseTo(1500, 2);
    expect(rv.comuns.resultadoLiquidoMes).toBeCloseTo(1500, 2);
    expect(rv.comuns.baseCalculoImposto).toBeCloseTo(1500, 2);
    expect(rv.comuns.impostoDevido).toBeCloseTo(225, 2);
    // Alíquotas legais de cada coluna, no mesmo formato que o PDF entrega.
    expect(rv.comuns.aliquota).toBe('15%');
    expect(rv.daytrade.aliquota).toBe('20%');
    expect(rv.daytrade.vistaAcoes).toBe(0);
    expect(rv.consolidacao.totalImpostoDevido).toBeCloseTo(225, 2);
    expect(rv.consolidacao.impostoPagar).toBeCloseTo(225, 2);
    // Imposto devido de 15% sobre a base é a conferência aritmética da ficha.
    expect(rv.comuns.impostoDevido).toBeCloseTo(rv.comuns.baseCalculoImposto * 0.15, 2);
  });

  it('lê o detalhe por fonte dos rendimentos isentos e exclusivos (registros 84/88)', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    // Com o detalhe, o mesmo código passa a ter uma entrada por fonte.
    const lucros = r.rendimentos.filter(x => x.tipo === 'isento_0009');
    expect(lucros.length).toBeGreaterThan(1);
    expect(lucros.every(x => x.cnpj_fonte !== '' && x.nome_fonte !== '')).toBe(true);
    // E a soma continua sendo a do agregado do registro 23, que é o total que
    // a declaração informa para o código.
    expect(lucros.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(67086306.99, 2);

    // Beneficiário e CPF, que o agregado não tinha.
    const deDependente = r.rendimentos.filter(x => x.beneficiario === 'Dependente');
    expect(deDependente).toHaveLength(4);
    expect(deDependente.every(x => x.cpf_dependente && x.cpf_dependente.length === 11)).toBe(true);

    // O código 10 dos isentos soma DOIS campos do registro 84: o valor
    // (22.847,76) e o 13º salário (1.903,98), que juntos dão o total do
    // código. Ler só o primeiro perderia 1.903,98 — foi exatamente o valor que
    // sumia no caminho PDF antes da correção do layout alternativo.
    const idoso = r.rendimentos.filter(x => x.tipo === 'isento_0010');
    expect(idoso).toHaveLength(1);
    expect(idoso[0].valor).toBeCloseTo(24751.74, 2);
    expect(idoso[0].decimoTerceiro).toBeCloseTo(1903.98, 2);
  });

  it('não duplica: o agregado NÃO entra junto com o detalhe', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // O arquivo traz os dois (registros 23/24 agregados e 84/88 detalhados).
    // Somar os dois dobraria o rendimento isento e o exclusivo da declaração.
    // Os totais têm que continuar batendo com o registro-resumo oficial.
    const soma = (p) => r.rendimentos.filter(x => x.tipo.startsWith(p)).reduce((s, x) => s + x.valor, 0);
    expect(soma('isento_')).toBeCloseTo(r.impostoDevido.rendimentosIsentosOficial, 2);
    expect(soma('exclusivo_')).toBeCloseTo(r.impostoDevido.rendimentosExclusivoOficial, 2);
    expect(soma('isento_')).toBeCloseTo(69879549.10, 2);
    expect(soma('exclusivo_')).toBeCloseTo(7187950.30, 2);
  });

  // Código que existe no agregado e NÃO tem detalhe por fonte precisa entrar
  // pelo agregado, senão o valor some. É o caso do 13º salário (código 01) e
  // do rendimento da Lei 14.754/2023, que não têm fonte pagadora listada.
  it('código sem detalhe por fonte entra pelo agregado', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const decimo = r.rendimentos.filter(x => x.tipo === 'exclusivo_0001');
    expect(decimo).toHaveLength(1);
    expect(decimo[0].valor).toBeCloseTo(3573.29, 2);
    expect(decimo[0].nome_fonte).toBe('');
    const exterior = r.rendimentos.filter(x => x.tipo === 'exclusivo_0013');
    expect(exterior).toHaveLength(1);
    expect(exterior[0].valor).toBeCloseTo(1822059.55, 2);
  });

  // Espelho, no caminho .DBK, da rede que o PDF ganhou: registro de tipo não
  // tratado que venha COM valor tem que gerar aviso, senão o dado some em
  // silêncio. Esta declaração tem os tipos 19, 60 e 75 zerados, então serve
  // como teste do lado "não gera alarme falso".
  it('não avisa sobre os tipos de registro já investigados (19, 60, 75, T9)', async () => {
    const avisos = [];
    await parseDBK(await readFile(DBK_PATH, 'latin1'), (msg, nivel) => {
      if (nivel === 'warning') avisos.push(msg);
    });
    // Esses quatro existem neste arquivo e não são lidos, mas já foram
    // investigados: estão zerados ou são estrutura. Avisar sobre eles em toda
    // importação seria ruído, e ruído faz o aviso deixar de ser lido.
    expect(avisos.some(m => /tipo .*(19|60|75|T9)/.test(m))).toBe(false);
  });

  it('o registro 33 fica de fora para não duplicar os lucros e dividendos', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    // REG_LUCROSDIVIDENDOS: detalhe dos lucros por fonte pagadora. O MESMO valor
    // já entra pelo registro 84 (detalhe do rendimento isento código 09), e a
    // declaração de referência não tem registro 33 para confirmar a relação
    // entre os dois. Diante da dúvida, duplicar renda é o pior desfecho — então
    // ele fica de fora, e nem aviso gera, porque o valor NÃO está faltando.
    const r33 = '33' + '11144477735' + '00001' + 'T' + pad('11222333000144', 14) +
      pad('EMPRESA QUE DISTRIBUIU LUCRO', 60) + N13(999999) + '11144477735' + '0000000001';
    const avisos = [];
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${r33}\n`,
      (m, n) => { if (n === 'warning') avisos.push(m); });

    expect(r.rendimentos.some(x => x.valor === 999999)).toBe(false);
    expect(avisos.some(m => m.includes('tipo 33'))).toBe(false);
    // E o total de lucros e dividendos continua o que a declaração informa.
    const lucros = r.rendimentos.filter(x => x.tipo === 'isento_0009').reduce((s2, x) => s2 + x.valor, 0);
    expect(lucros).toBeCloseTo(67086306.99, 2);
  });

  it('avisa PELO NOME a ficha conhecida que o app não importa', async () => {
    const original = await readFile(DBK_PATH, 'latin1');
    // 58 é REG_HERDEIROS no mapa oficial. Dizer "esta declaração tem a ficha
    // Herdeiros" é acionável; dizer "tem registro do tipo 58" não é.
    const comFicha = `${original}\n58111444777350000012345678000000000000\n`;
    const avisos = [];
    const r = await parseDBK(comFicha, (m, n) => { if (n === 'warning') avisos.push(m); });
    expect(avisos.some(m => m.includes('Herdeiros') && m.includes('não importa'))).toBe(true);
    // E o aviso genérico de "tipo desconhecido" NÃO deve disparar junto: o app
    // sabe o que é essa ficha, só não a modela.
    expect(avisos.some(m => m.includes('tipo 58'))).toBe(false);
    // O aviso precisa sobreviver ao log transitório da tela para ser persistido
    // junto ao ano importado e continuar disponível no Dashboard.
    expect(r.fichasNaoLidasComConteudo).toContain('Herdeiros');
    expect(r.registrosDbkNaoModelados).toContainEqual(expect.objectContaining({
      tipoRegistro: '58', ocorrencias: 1,
    }));
    expect(r.avisosImportacao).toContainEqual(expect.objectContaining({
      codigo: 'DBK_FICHA_NAO_SUPORTADA', tipoRegistro: '58',
    }));
    expect(r.estadoFichas['dbk:58']).toEqual(expect.objectContaining({
      estado: 'nao_suportada', formato: 'dbk',
    }));
  });

  it('avisa como DESCONHECIDO o tipo que nem o mapa oficial cobre', async () => {
    const original = await readFile(DBK_PATH, 'latin1');
    // 99 existe no XML de layout e não está na lista de fichas nomeadas: é o
    // caso de "o arquivo mudou, ou tem algo que este parser nunca viu".
    const comTipoNovo = `${original}\n99111444777350000012345678000000000000\n`;
    const avisos = [];
    const r = await parseDBK(comTipoNovo, (m, n) => { if (n === 'warning') avisos.push(m); });
    expect(avisos.some(m => m.includes('tipo 99') && m.includes('não conhece'))).toBe(true);
    expect(r.fichasNaoLidasComConteudo).toContain('Registro DBK tipo 99');
    expect(r.estadoFichas['dbk:99']).toEqual(expect.objectContaining({
      estado: 'erro', formato: 'dbk',
    }));
  });

  it('distingue presença de dados de completude auditada no DBK', async () => {
    const r = await parseDBK('IRPF    20262025');
    expect(r.estadoFichas['dbk:IR']).toEqual(expect.objectContaining({
      estado: 'parcial', formato: 'dbk', presenca: 'preenchida',
      suporte: 'parcial', completudeAuditada: false,
    }));
    expect(r.estadoFichas['dbk:58']).toEqual(expect.objectContaining({
      estado: 'vazia', formato: 'dbk', presenca: 'vazia', completudeAuditada: false,
    }));
    expect(r.fichasNaoLidasComConteudo).toEqual([]);
  });


  // Correções vindas do LAYOUT OFICIAL da Receita, extraído do próprio programa
  // IRPF 2026 em 24/08/2026 (ver LAYOUT-DBK-OFICIAL.md). Até então cada posição
  // deste parser tinha sido decifrada por tentativa e erro, casando valores
  // contra o PDF da mesma declaração.
  it('registro 52: adiantamento e resultado não tributável nas posições oficiais', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const a = r.apuracaoResultadoRuralOficial;
    // A posição 132 é VR_ADIANT (o segundo adiantamento) e a 145 é
    // VR_RESNAOTRIBAR. Antes, 132 era lido como resultado não tributável e o
    // adiantamento nem existia: os dois campos ficavam errados numa declaração
    // que os usasse.
    expect(a.adiantamentoAnosAnteriores).toBe(0);
    expect(a.resultadoNaoTributavel).toBe(0);
    // Campos que o layout oficial revelou e que ninguém lia. A opção de
    // apuração vem como '2' nesta declaração, e o PDF da mesma declaração
    // imprime "Pelo resultado" — o código é guardado CRU, sem traduzir, porque
    // o layout não documenta a tabela de valores e inventar o "de-para" a
    // partir de um caso só seria chute (mesmo critério do código de parentesco
    // dos dependentes e do de atividade dos imóveis rurais).
    expect(a.opcaoApuracaoResultadoTributavel).toBe('2');
    expect(a.resultadoExteriorDolar).toBe(0);
  });

  it('registro 53: o código da espécie é UM dígito na posição 15', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // A leitura anterior era field(14,2), que pegava o IN_EXTERIOR junto e só
    // dava "01" por acaso, porque o imóvel é no Brasil. No exterior teria
    // produzido "11", uma espécie que não existe.
    expect(r.movimentacaoRebanhoOficial[0].especieCodigo).toBe('01');
  });

  // O bug mais grave que o layout oficial revelou: os registros 50 a 55 usam o
  // MESMO tipo para Brasil e Exterior, separados só pelo IN_EXTERIOR na posição
  // 14. Sem checar esse campo, a atividade rural do exterior soma com a do
  // Brasil — e o registro 52, que é um por flag, tem a apuração do Brasil
  // SOBRESCRITA pela do exterior.
  it('atividade rural do EXTERIOR não entra junto com a do Brasil', async () => {
    const original = await readFile(DBK_PATH, 'latin1');
    // Copia os registros rurais do arquivo trocando o IN_EXTERIOR para '1' e
    // multiplicando os valores, simulando uma declaração que tenha as duas.
    const linhas = original.split(/\r\n|\r|\n/);
    const doExterior = linhas
      .filter(l => ['50', '51', '52', '53', '54', '55'].includes(l.substring(0, 2)))
      .map(l => `${l.substring(0, 13)}1${l.substring(14)}`);
    const comExterior = [...linhas, ...doExterior].join('\n');

    const so = await parseDBK(original, () => {});
    const avisos = [];
    const com = await parseDBK(comExterior, (m, n) => { if (n === 'warning') avisos.push(m); });

    // Nada do exterior pode ter entrado: as contagens e os totais do Brasil
    // ficam idênticos aos do arquivo original.
    expect(com.imoveisRurais).toHaveLength(so.imoveisRurais.length);
    expect(com.bensRurais).toHaveLength(so.bensRurais.length);
    expect(com.dividasRurais).toHaveLength(so.dividasRurais.length);
    expect(com.movimentacaoRebanhoOficial).toHaveLength(so.movimentacaoRebanhoOficial.length);
    expect(com.receitasDespesasRuraisOficial).toHaveLength(12);
    expect(com.apuracaoResultadoRuralOficial.receitaBrutaTotal)
      .toBeCloseTo(so.apuracaoResultadoRuralOficial.receitaBrutaTotal, 2);
    // E o import avisa, em vez de calar sobre o que ficou de fora.
    expect(avisos.some(m => m.includes('Atividade Rural no EXTERIOR'))).toBe(true);
  });

  // Correções de posição vindas da auditoria do parser contra o LAYOUT OFICIAL
  // (LAYOUT-DBK-OFICIAL.md), feita em 24/08/2026.
  it('registro 57: CPF/CNPJ do participante tem 14 posições, não 11', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // Todos os 18 participantes desta declaração são pessoas físicas, e o CPF
    // vem preenchido com 3 espaços à direita — por isso a leitura antiga,
    // field(14,11), funcionava aqui. Com um participante pessoa JURÍDICA ela
    // truncaria o CNPJ nos 11 primeiros dígitos e empurraria os 3 restantes
    // para o começo do nome.
    expect(r.participantesRuraisOficial).toHaveLength(18);
    expect(r.participantesRuraisOficial.every(p => /^\d{11}$/.test(p.cpf))).toBe(true);
    expect(r.participantesRuraisOficial.every(p => !/^\d/.test(p.nome))).toBe(true);
    const osires = r.participantesRuraisOficial.find(p => p.cpf === pessoal('participante1Cpf'));
    esperaPessoal(osires.nome, 'participante1Nome');
  });

  it('registro 57: a chave NR_CHAVE_AR liga o participante ao imóvel', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // A ATUALIZAÇÃO 3 registrou que "não existe vínculo confiável ao imóvel no
    // .DBK", e a 45 repetiu. Era falso: o campo NR_CHAVE_AR sempre esteve lá,
    // no registro 50 (posição 164) e no 57 (posição 89).
    expect(r.participantesRuraisOficial.every(p => p.imovelId != null)).toBe(true);
    const osires = r.participantesRuraisOficial.find(p => p.cpf === pessoal('participante1Cpf'));
    esperaPessoal(osires.imovelNome, 'imovelMirandasNomeLocalizacao');
    // Três participantes da MESMA fazenda, que é o caso que prova que a chave
    // não é um índice sequencial disfarçado.
    const barreiras = r.participantesRuraisOficial.filter(p => p.imovelNome.startsWith(buscaPessoal('imovelBarreirasPrefixo')));
    expect(barreiras).toHaveLength(3);
    expect(barreiras.map(p => p.imovelId).every(id => id === barreiras[0].imovelId)).toBe(true);
  });

  it('registro 50: nome e localização são campos separados, como no PDF', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // NM_IMOVEL (23,60) e NM_LOCAL (83,55). A leitura antiga pegava os 114 de
    // uma vez e colava os dois sem pontuação, fazendo o .DBK divergir do PDF.
    const olaria = r.imoveisRurais[0];
    esperaPessoal(olaria.nomeImovel, 'imovelOlariaNome');
    esperaPessoal(olaria.localizacao, 'imovelOlariaLocalizacao');
    esperaPessoal(olaria.nomeLocalizacao, 'imovelOlariaNomeLocalizacao');
  });

  // Registro 22: rendimentos de PESSOA FÍSICA e do EXTERIOR (carnê-leão). É a
  // única ficha implementada a partir do LAYOUT OFICIAL sem uma declaração de
  // referência preenchida — nas duas disponíveis ela vem "Sem Informações".
  // O registro é montado aqui campo a campo, nas posições que a Receita
  // publica, para que o teste exercite o que o parser vai encontrar de verdade.
  it('lê rendimentos de pessoa física e do exterior (registro 22)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    // pos:  1     3            14  15            26   28      41     54     67     80     93     106    119    132     145     158
    //       tipo  CPF          dep CPF_DEPEN     mes  RENDTO  ALUG   OUTROS EXTER  LIVCX  ALIM   DEDUC  PREVID BASECAL IMPOSTO CONTROLE
    const linha =
      '22' + '11144477735' + 'N' + '           ' + '03' +
      N13(1000) + N13(2500) + N13(300) + N13(700) +
      N13(0) + N13(0) + N13(0) + N13(200) + N13(4300) + N13(150) + '0000000001';
    const arquivo = `${await readFile(DBK_PATH, 'latin1')}\n${linha}\n`;
    const r = await parseDBK(arquivo);

    const pf = r.rendimentos.filter(x => x.tipo === 'tributavel_pf_exterior');
    expect(pf).toHaveLength(1);
    // O valor do rendimento é a soma das QUATRO colunas de receita da ficha:
    // recebidos de PF, aluguéis, outros e exterior.
    expect(pf[0].valor).toBeCloseTo(4500, 2);
    expect(pf[0].recebidosPessoaFisica).toBeCloseTo(1000, 2);
    expect(pf[0].alugueis).toBeCloseTo(2500, 2);
    expect(pf[0].outrosRendimentos).toBeCloseTo(300, 2);
    expect(pf[0].rendimentosExterior).toBeCloseTo(700, 2);
    expect(pf[0].mes).toBe(3);
    expect(pf[0].beneficiario).toBe('Titular');
    // O imposto pago por carnê-leão entra como `irrf`, que é o campo que o app
    // já usa para imposto já recolhido sobre o rendimento.
    expect(pf[0].irrf).toBeCloseTo(150, 2);
    expect(pf[0].previdenciaPaga).toBeCloseTo(200, 2);
    expect(pf[0].baseCalculoCarneLeao).toBeCloseTo(4300, 2);
    // Data no mês do lançamento, não em 31/12 como os rendimentos anuais.
    expect(pf[0].data).toBe('2025-03-28');
  });

  it('registro 22: mês zerado não vira lançamento, e dependente é identificado', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const zerado = '22' + '11144477735' + 'N' + '           ' + '05' + N13(0).repeat(4) +
      N13(0).repeat(5) + N13(0) + '0000000002';
    const doDependente = '22' + '11144477735' + 'S' + '33344455508' + '07' +
      N13(800) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(800) + N13(0) + '0000000003';
    const arquivo = `${await readFile(DBK_PATH, 'latin1')}\n${zerado}\n${doDependente}\n`;
    const r = await parseDBK(arquivo);

    const pf = r.rendimentos.filter(x => x.tipo === 'tributavel_pf_exterior');
    // A ficha traz os 12 meses mesmo quando só alguns têm valor: mês zerado não
    // pode virar lançamento de R$ 0,00 na tela.
    expect(pf).toHaveLength(1);
    expect(pf[0].mes).toBe(7);
    expect(pf[0].beneficiario).toBe('Dependente');
    expect(pf[0].cpf_dependente).toBe('33344455508');
  });

  // DOAÇÕES pelo .DBK. Este handoff afirmava, desde a ATUALIZAÇÃO 6, que o
  // formato não tinha registro para essas fichas, e por isso elas eram PDF-only
  // com layout EXTRAPOLADO. O mapa oficial de registros mostra que existem:
  // REG_DOACOESCAMPANHA (34), REG_DOACAO (90), REG_DOACAO_ECA (91) e
  // REG_DOACAO_IDOSO (92). Só não aparecem no arquivo de referência porque
  // aquele contribuinte não doou — daí os registros montados aqui, nas posições
  // oficiais.
  it('lê as doações efetuadas e a partidos (registros 90 e 34)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    const efetuada = '90' + '11144477735' + '41' + pad('26459474000190', 14) +
      pad('FUNDO MUNICIPAL DA CRIANCA', 60) + N13(2857.33) + N13(0) + '2' + '0000000001';
    const partido = '34' + '11144477735' + pad('12345678000199', 14) +
      pad('PARTIDO EXEMPLO', 60) + N13(500) + '0000000002';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${efetuada}\n${partido}\n`);

    expect(r.doacoesEfetuadasOficial).toHaveLength(1);
    expect(r.doacoesEfetuadasOficial[0].codigo).toBe('41');
    expect(r.doacoesEfetuadasOficial[0].nome_beneficiario).toBe('FUNDO MUNICIPAL DA CRIANCA');
    expect(r.doacoesEfetuadasOficial[0].cpf_cnpj).toBe('26459474000190');
    expect(r.doacoesEfetuadasOficial[0].valor).toBeCloseTo(2857.33, 2);

    expect(r.doacoesPartidosOficial).toHaveLength(1);
    expect(r.doacoesPartidosOficial[0].nome_beneficiario).toBe('PARTIDO EXEMPLO');
    expect(r.doacoesPartidosOficial[0].valor).toBeCloseTo(500, 2);
  });

  it('lê as doações ECA e Pessoa Idosa (registros 91 e 92), montando o nome do fundo', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    // O beneficiário destas duas fichas não é uma pessoa e sim um FUNDO,
    // identificado por esfera (N/E/M), UF e município — não há campo de nome.
    const eca = '91' + '11144477735' + 'M' + 'MG' + pad('MINAS GERAIS', 30) +
      pad('CIDADE EXEMPLO', 40) + N13(1000) + pad('26459474000190', 14) + '0000000001';
    const idoso = '92' + '11144477735' + 'E' + 'MG' + pad('MINAS GERAIS', 30) +
      pad('', 40) + N13(750) + pad('11222333000144', 14) + '0000000002';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${eca}\n${idoso}\n`);

    expect(r.doacoesEcaIdosoOficial).toHaveLength(2);
    const doEca = r.doacoesEcaIdosoOficial.find(d => d.categoria === 'eca');
    expect(doEca.valor).toBeCloseTo(1000, 2);
    expect(doEca.cpf_cnpj).toBe('26459474000190');
    expect(doEca.esferaFundo).toBe('Municipal');
    expect(doEca.nome_beneficiario).toContain('Municipal');
    expect(doEca.nome_beneficiario).toContain('CIDADE EXEMPLO');
    // Sem município (fundo estadual), o nome cai para a UF, sem sobrar
    // separador solto.
    const doIdoso = r.doacoesEcaIdosoOficial.find(d => d.categoria === 'idoso');
    expect(doIdoso.esferaFundo).toBe('Estadual');
    expect(doIdoso.nome_beneficiario).toContain('MINAS GERAIS');
    expect(doIdoso.nome_beneficiario).not.toMatch(/- *$|- +-/);
  });

  it('declaração sem doação não gera doação nenhuma', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // O arquivo de referência não tem os registros 34/90/91/92. Antes de
    // 24/08/2026 o parseDBK nem devolvia essas chaves.
    expect(r.doacoesEfetuadasOficial).toEqual([]);
    expect(r.doacoesPartidosOficial).toEqual([]);
    expect(r.doacoesEcaIdosoOficial).toEqual([]);
  });

  // Declaração pelo DESCONTO SIMPLIFICADO. O arquivo traz os registros 17/18 no
  // lugar de 19/20, e até 24/08/2026 este parser só lia o 20 — numa declaração
  // simplificada o app ficava SEM o Resumo e SEM o Imposto Devido, com a tela
  // Relatório IRPF vazia. Nenhuma das duas declarações de referência é
  // simplificada, então o gap era invisível; achado ao ler o mapa oficial de
  // registros. O registro abaixo é montado nas posições oficiais.
  it('lê o Resumo da declaração SIMPLIFICADA (registro 18)', async () => {
    // Montado por POSIÇÃO ABSOLUTA, e não por índice de campo: o registro 18
    // tem um campo de 1 caractere no meio (NR_QUOTAS, posição 144), que quebra
    // qualquer aritmética de "todo campo tem 13". Foi o que o teste flagrou na
    // primeira tentativa.
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const buf = new Array(744).fill('0');
    const put = (pos, valor) => {
      const t = N13(valor);
      for (let k = 0; k < 13; k++) buf[pos - 1 + k] = t[k];
    };
    '18'.split('').forEach((c, k) => { buf[k] = c; });
    '11144477735'.split('').forEach((c, k) => { buf[2 + k] = c; });
    put(14, 80000);    // VR_RENDTRIB  rendimentos tributáveis
    put(27, 16754.34); // VR_DESCSIMP  desconto simplificado
    put(40, 63245.66); // VR_BASECALC  base de cálculo
    put(53, 9000);     // VR_IMPDEVIDO imposto devido
    put(66, 7000);     // VR_IMPOSTO   retido na fonte
    put(92, 500);      // VR_LEAO      carnê-leão
    put(131, 1500);    // VR_IMPPAGAR  saldo a pagar
    put(158, 12000);   // VR_TOTISENTO
    put(171, 3000);    // VR_TOTEXCLUSIVO
    put(275, 500000);  // bens ano anterior
    put(288, 560000);  // bens ano base
    put(366, 20000);   // dívidas ano anterior
    put(379, 15000);   // dívidas ano base
    const linha = buf.join('');
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${linha}\n`);

    expect(r.impostoDevido).toBeTruthy();
    expect(r.impostoDevido.modeloDeclaracao).toBe('simplificada');
    expect(r.impostoDevido.rendimentosTributaveisTotal).toBeCloseTo(80000, 2);
    // Na simplificada o desconto SUBSTITUI todas as deduções legais, e é ele
    // que ocupa o lugar de "total de deduções". Não há dedução por dependente
    // nem despesa médica: zerar é o certo, e não deixar o valor da completa.
    expect(r.impostoDevido.totalDeducoes).toBeCloseTo(16754.34, 2);
    expect(r.impostoDevido.descontoSimplificado).toBeCloseTo(16754.34, 2);
    expect(r.impostoDevido.dependentes).toBe(0);
    expect(r.impostoDevido.despesasMedicas).toBe(0);
    expect(r.impostoDevido.baseCalculo).toBeCloseTo(63245.66, 2);
    expect(r.impostoDevido.impostoDevidoTotal).toBeCloseTo(9000, 2);
    // O 18 não tem campo único de "imposto pago": traz os componentes, e o
    // total é a soma deles (retido na fonte + complementar/exterior +
    // carnê-leão + Lei 11.033).
    expect(r.impostoDevido.impostoPagoTotal).toBeCloseTo(7500, 2);
    expect(r.impostoDevido.saldoPagar).toBeCloseTo(1500, 2);
    expect(r.impostoDevido.rendimentosIsentosOficial).toBeCloseTo(12000, 2);
    expect(r.impostoDevido.rendimentosExclusivoOficial).toBeCloseTo(3000, 2);
    expect(r.impostoDevido.bensAtualOficial).toBeCloseTo(560000, 2);
    expect(r.impostoDevido.dividasAtualOficial).toBeCloseTo(15000, 2);
    // A base de cálculo tem que ser o rendimento menos o desconto — conferência
    // aritmética da própria ficha.
    expect(r.impostoDevido.baseCalculo)
      .toBeCloseTo(r.impostoDevido.rendimentosTributaveisTotal - r.impostoDevido.totalDeducoes, 2);
    // Campos que só a declaração completa informa ficam NULL, e não zero: "este
    // modelo não informa" é diferente de "não houve".
    expect(r.impostoDevido.lei14754Ganho).toBeNull();
  });

  it('a declaração completa continua sendo identificada como tal', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    expect(r.impostoDevido.modeloDeclaracao).toBe('completa');
    // E as deduções da completa continuam vindo preenchidas.
    expect(r.impostoDevido.dependentes).toBeCloseTo(2275.08, 2);
    expect(r.impostoDevido.despesasMedicas).toBeCloseTo(24280, 2);
  });

  // Rendimentos de PJ dos DEPENDENTES (registro 32). O parser lia só o 21, do
  // titular — numa declaração em que o dependente tem emprego ou aposentadoria,
  // os rendimentos dele sumiam do `.DBK`. Invisível na declaração de
  // referência, onde a dependente não tem rendimento de PJ; o outro
  // contribuinte, que só tem PDF, tem quatro fontes de dependente.
  it('lê os rendimentos de PJ dos dependentes (registro 32)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    // pos: 1 tipo | 3 CPF titular | 14 CPF depend. | 25 CNPJ | 39 nome |
    //      99 rendimento | 112 previdência | 125 13º | 138 IRRF |
    //      151 data saída | 159 IRRF 13º | 172 controle
    const linha = '32' + '11144477735' + '33344455508' + pad('16727230000197', 14) +
      pad('FUNDO DE RENDIMENTO GERAL DE PREVIDENCIA SOCIAL', 60) +
      N13(57754.33) + N13(0) + N13(4556.29) + N13(3360.61) +
      pad('', 8) + N13(274.90) + '0000000001';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${linha}\n`);

    const doDependente = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Dependente');
    expect(doDependente).toHaveLength(1);
    expect(doDependente[0].cpf_dependente).toBe('33344455508');
    expect(doDependente[0].cnpj_fonte).toBe('16727230000197');
    expect(doDependente[0].nome_fonte).toBe('FUNDO DE RENDIMENTO GERAL DE PREVIDENCIA SOCIAL');
    expect(doDependente[0].valor).toBeCloseTo(57754.33, 2);
    expect(doDependente[0].irrf).toBeCloseTo(3360.61, 2);
    expect(doDependente[0].decimoTerceiro).toBeCloseTo(4556.29, 2);
    expect(doDependente[0].irrfDecimoTerceiro).toBeCloseTo(274.90, 2);

    // O do titular continua vindo do registro 21, sem contaminação: o 32 tem o
    // CPF do dependente a mais no começo, e todo campo dele fica 11 posições à
    // frente. Ler os dois com o mesmo deslocamento embaralharia tudo.
    const doTitular = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Titular');
    expect(doTitular).toHaveLength(4);
    expect(doTitular.every(x => x.cpf_dependente === null)).toBe(true);
  });

  it('o registro 21 passa a trazer previdência, 13º e IRRF sobre 13º', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const pj = r.rendimentos.filter(x => x.tipo === 'tributavel_pj');
    // Os três campos existiam no layout e o `.DBK` não os lia, enquanto o
    // caminho PDF trazia desde a ATUALIZAÇÃO 40. A assimetria não aparecia na
    // auditoria cruzada porque ela compara `valor` e `irrf`.
    expect(pj.every(x => typeof x.contribuicaoPrevidenciaria === 'number')).toBe(true);
    expect(pj.every(x => typeof x.decimoTerceiro === 'number')).toBe(true);
    // Nesta declaração o titular tem 13º de 3.573,29 e IRRF sobre ele de 59,70,
    // que batem com a linha TOTAL da ficha impressa.
    expect(pj.reduce((s, x) => s + x.decimoTerceiro, 0)).toBeCloseTo(3573.29, 2);
    expect(pj.reduce((s, x) => s + x.irrfDecimoTerceiro, 0)).toBeCloseTo(59.70, 2);
  });

  // As SETE variantes de detalhe de rendimento isento e exclusivo. A
  // ATUALIZAÇÃO 50 implementou só duas (84 e 88), e o handoff registrou como se
  // fossem as únicas. A declaração de referência usa só a 84 e a 88, então as
  // outras cinco nunca foram exercitadas — os registros abaixo são montados nas
  // posições oficiais.
  it('lê o detalhe com IRRF (registro 85) e com descrição (86 e 89)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    const cab = (tipo, cod) => tipo + '11144477735' + 'T' + '11144477735' + cod + pad('11222333000144', 14) + pad('FONTE EXEMPLO LTDA', 60);
    // 85: valor + 13º + IRRF + IRRF sobre 13º
    const r85 = cab('85', '0011') + N13(1000) + N13(200) + N13(150) + N13(30) + '0000000001';
    // 86: valor + descrição + chave do bem
    const r86 = cab('86', '0014') + N13(5000) + pad('HERANCA RECEBIDA DO ESPOLIO', 60) + '00001' + '0000000002';
    // 89: exclusiva com descrição
    const r89 = cab('89', '0007') + N13(3000) + pad('RENDIMENTO ACUMULADO DE ACAO JUDICIAL', 60) + '0000000003';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${r85}\n${r86}\n${r89}\n`);

    // 85: o valor soma o 13º, como nas demais variantes, e o IRRF fica à parte.
    const i11 = r.rendimentos.filter(x => x.tipo === 'isento_0011');
    expect(i11).toHaveLength(1);
    expect(i11[0].valor).toBeCloseTo(1200, 2);
    expect(i11[0].decimoTerceiro).toBeCloseTo(200, 2);
    expect(i11[0].nome_fonte).toBe('FONTE EXEMPLO LTDA');

    // 86: a descrição é informação que só esta variante traz.
    const i14 = r.rendimentos.filter(x => x.tipo === 'isento_0014');
    expect(i14).toHaveLength(1);
    expect(i14[0].valor).toBeCloseTo(5000, 2);
    expect(i14[0].descricao).toBe('HERANCA RECEBIDA DO ESPOLIO');

    // 89: mesma coisa, do lado da tributação exclusiva.
    const e07 = r.rendimentos.filter(x => x.tipo === 'exclusivo_0007');
    expect(e07).toHaveLength(1);
    expect(e07[0].valor).toBeCloseTo(3000, 2);
    expect(e07[0].descricao).toBe('RENDIMENTO ACUMULADO DE ACAO JUDICIAL');
  });

  it('lê as variantes SEM fonte pagadora (registros 83 e 87)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    // 83: beneficiário e código, valor logo na 30 — sem CNPJ nem nome.
    const r83 = '83' + '11144477735' + 'D' + '33344455508' + '0016' + N13(800) + '0000000001';
    // 87: nem beneficiário tem — código na 14, valor na 18, e um valor de ganho
    // de capital à parte na 31.
    const r87 = '87' + '11144477735' + '0005' + N13(2000) + N13(1500) + '0000000002';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${r83}\n${r87}\n`);

    const i16 = r.rendimentos.filter(x => x.tipo === 'isento_0016');
    expect(i16).toHaveLength(1);
    expect(i16[0].valor).toBeCloseTo(800, 2);
    expect(i16[0].beneficiario).toBe('Dependente');
    // Sem fonte pagadora: os campos ficam vazios, e não inventados.
    expect(i16[0].cnpj_fonte).toBe('');
    expect(i16[0].nome_fonte).toBe('');

    const i05 = r.rendimentos.filter(x => x.tipo === 'isento_0005');
    expect(i05).toHaveLength(1);
    expect(i05[0].valor).toBeCloseTo(2000, 2);
    expect(i05[0].beneficiario).toBe('Titular');
  });

  // Rendimentos Recebidos Acumuladamente (RRA), registros 45 e 47. São valores
  // de anos anteriores pagos de uma vez, com regra própria: o imposto é
  // calculado sobre a média mensal e o contribuinte escolhe entre tributar na
  // fonte ou no ajuste. A declaração de referência não tem RRA.
  it('lê o RRA do titular e do dependente (registros 45 e 47)', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    // 45: filler(14,2) | fonte(16,14) | nome(30,60) | bruto(90) | previd(103) |
    //     pensão(116) | IRRF(129) | mês(142,2) | cod(144,5) | filler(149,1) |
    //     opção(150,1) | meses(151,4) | impRRA(155) | isento65(168) |
    //     tributável(181) | juros(194) | controle(207,10)
    const r45 = '45' + '11144477735' + '  ' + pad('11222333000144', 14) +
      pad('INSS - ACAO JUDICIAL', 60) +
      N13(120000) + N13(8000) + N13(0) + N13(9000) + '06' + '00001' + ' ' + '1' + '0024' +
      N13(9000) + N13(12000) + N13(100000) + N13(15000) + '0000000001';
    // 47: igual, com o CPF do dependente em (16,11) empurrando tudo 11 à frente.
    const r47 = '47' + '11144477735' + '  ' + '33344455508' + pad('99888777000166', 14) +
      pad('FONTE DO DEPENDENTE', 60) +
      N13(30000) + N13(0) + N13(0) + N13(2000) + '03' + '00002' + ' ' + '2' + '0012' +
      N13(2000) + N13(0) + N13(30000) + N13(0) + '0000000002';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${r45}\n${r47}\n`);

    const rra = r.rendimentos.filter(x => x.tipo === 'tributavel_rra');
    expect(rra).toHaveLength(2);

    const doTitular = rra.find(x => x.beneficiario === 'Titular');
    expect(doTitular.nome_fonte).toBe('INSS - ACAO JUDICIAL');
    // O que entra como rendimento é o valor TRIBUTÁVEL (100.000), e não o bruto
    // (120.000): do total saem a previdência, a pensão e a parcela isenta de 65
    // anos, e a própria ficha traz o tributável calculado.
    expect(doTitular.valor).toBeCloseTo(100000, 2);
    expect(doTitular.rendimentoBruto).toBeCloseTo(120000, 2);
    expect(doTitular.contribuicaoPrevidenciaria).toBeCloseTo(8000, 2);
    expect(doTitular.parcelaIsenta65Anos).toBeCloseTo(12000, 2);
    // Os juros do RRA são rendimento ISENTO (código 27 da ficha), por isso ficam
    // fora do valor tributável.
    expect(doTitular.juros).toBeCloseTo(15000, 2);
    expect(doTitular.numeroMeses).toBe(24);
    expect(doTitular.mesRecebimento).toBe(6);
    expect(doTitular.irrf).toBeCloseTo(9000, 2);
    // Opção de tributação guardada CRUA: o layout não documenta a tabela de
    // valores, e é por ela que se sabe se o RRA foi tributado na fonte ou levado
    // ao ajuste anual.
    expect(doTitular.opcaoTributacao).toBe('1');

    const doDependente = rra.find(x => x.beneficiario === 'Dependente');
    expect(doDependente.cpf_dependente).toBe('33344455508');
    expect(doDependente.nome_fonte).toBe('FONTE DO DEPENDENTE');
    expect(doDependente.valor).toBeCloseTo(30000, 2);
    expect(doDependente.numeroMeses).toBe(12);
    expect(doDependente.opcaoTributacao).toBe('2');
  });

  it('rendimento com exigibilidade suspensa NÃO entra, e vira aviso', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    const r80 = '80' + '11144477735' + pad('11222333000144', 14) +
      pad('EMPRESA EM DISCUSSAO JUDICIAL', 60) + N13(50000) + N13(50000) + '0000000001';
    const avisos = [];
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${r80}\n`,
      (m, n) => { if (n === 'warning') avisos.push(m); });

    // Imposto com exigibilidade suspensa está em discussão judicial: o valor não
    // é renda recebida em definitivo, e importá-lo como rendimento afirmaria uma
    // renda que a pessoa pode ter de devolver.
    expect(r.rendimentos.some(x => x.valor === 50000)).toBe(false);
    expect(r.rendimentos.some(x => x.cnpj_fonte === '11222333000144')).toBe(false);
    // Mas o silêncio também não serve: o app avisa que deixou algo de fora.
    expect(avisos.some(m => m.includes('EXIGIBILIDADE SUSPENSA') && m.includes('50.000,00'))).toBe(true);
  });

  it('lê os Dependentes (registro 25) batendo com a página "DEPENDENTES" da declaração real', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);
    // Só existe 1 dependente na declaração de exemplo.
    expect(r.dependentes).toHaveLength(1);
    const ana = r.dependentes[0];
    esperaPessoal(ana.nome, 'dependenteNome');
    esperaPessoal(ana.cpf, 'dependenteCpf');
    expect(ana.dataNascimento).toBe('1955-01-19');
    // Código cru da declaração (não traduzido, ver comentário no parser).
    expect(ana.parentesco).toBe('11');
    expect(ana.moraComTitular).toBe(true);
    expect(ana.celular).toBe('991946333');
  });
});

describe.skipIf(!temArquivos)('parsePDF (arquivo real, o mesmo declarante do .DBK)', () => {
  it('bate DÍGITO A DÍGITO com o .DBK — os dois caminhos de import têm que produzir o mesmo resultado', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const r = await parsePDF(pdf);

    expect(r.anoCalendario).toBe(2025);
    esperaPessoal(r.contribuinte.cpf, 'titularCpf');
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

    // Nenhuma discriminação pode terminar com o valor da coluna
    // Beneficiário grudado (bug real, achado numa auditoria item a item
    // contra o .DBK: 12 dos 172 bens vinham com " Titular" a mais no fim
    // do texto — ver isBensMetadataRow).
    const comTitularGrudado = r.bens.filter(b => /\bTitular$/.test(b.discriminacao.trim()));
    expect(comTitularGrudado).toEqual([]);

    // Doações: o .DBK não tem NENHUM registro para essas 4 fichas (nem
    // "sem informação"), então não há um resultado real pra bater contra
    // aqui — as 4 fichas desta declaração de exemplo vêm "Sem Informações"
    // no próprio PDF. Este teste não confirma o layout da tabela (nunca
    // visto de verdade), só que o parser não quebra e não inventa item
    // nenhum quando a seção realmente não existe no documento.
    expect(r.doacoesEfetuadasOficial).toEqual([]);
    expect(r.doacoesPartidosOficial).toEqual([]);
    expect(r.doacoesEcaIdosoOficial).toEqual([]);
  }, 30000); // PDF de 59 páginas: dá tempo do pdfjs processar

  // Rendimentos Tributáveis de PJ passaram a ser lidos pelos DOIS caminhos, e
  // este é o único caso em que dá para confrontar um contra o outro: mesmo
  // declarante, mesmo ano, dois arquivos independentes. Divergência aqui é
  // defeito em um dos dois parsers, não diferença de formato.
  it('TODOS os rendimentos batem entre PDF e .DBK, fonte por fonte', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    const chave = (x) => `${x.tipo}|${x.cnpj_fonte}|${x.beneficiario}|${x.valor.toFixed(2)}`;
    const doPdf = rp.rendimentos.map(chave).sort();
    const doDbk = rd.rendimentos.map(chave).sort();
    expect(doPdf).toHaveLength(76);

    // Desde 24/08/2026 NÃO HÁ MAIS DIFERENÇA NENHUMA. A última que restava era
    // o código da Lei 14.754/2023, que o .DBK grava como 0013 e o PDF imprime
    // como "12." — não porque um estivesse errado, mas porque o arquivo usa o
    // CÓDIGO INTERNO e a ficha numera as LINHAS da tela. O parser do PDF passou
    // a converter um no outro, com a tabela de-para que está na classe
    // `CadastroTabelasIRPF` do programa da Receita.
    expect(doPdf.filter(x => !doDbk.includes(x))).toEqual([]);
    expect(doDbk.filter(x => !doPdf.includes(x))).toEqual([]);
    expect(doPdf).toEqual(doDbk);

    // E o detalhe por fonte existe dos dois lados, com a mesma contagem de
    // rendimentos de dependente.
    expect(rd.rendimentos.filter(x => x.beneficiario === 'Dependente')).toHaveLength(4);
    expect(rp.rendimentos.filter(x => x.beneficiario === 'Dependente')).toHaveLength(4);
  }, 30000);

  it('os rendimentos de PJ lidos do PDF batem com os lidos do .DBK, fonte por fonte', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    const pj = (r) => r.rendimentos
      .filter(x => x.tipo === 'tributavel_pj')
      .map(x => ({ cnpj: x.cnpj_fonte, valor: Number(x.valor.toFixed(2)), irrf: Number(x.irrf.toFixed(2)) }))
      .sort((a, b) => a.cnpj.localeCompare(b.cnpj));

    const doPdf = pj(rp);
    const doDbk = pj(rd);
    expect(doPdf).toHaveLength(4);
    expect(doPdf).toEqual(doDbk);

    // E o total bate com a linha TOTAL impressa na própria ficha do PDF.
    expect(doPdf.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(45567.84, 2);
    expect(doPdf.reduce((s, x) => s + x.irrf, 0)).toBeCloseTo(774.78, 2);
  }, 30000);

  // Critério de aceite da correção da auditoria de 21/08/2026. Antes dela,
  // 45 dos 172 bens vinham com a discriminação errada pelo caminho PDF: 33
  // perdendo texto de verdade (nome de quem vendeu, agência e conta, chassi,
  // quantidade de cotas) e 12 com valor de campo do formulário grudado no
  // fim ("105 - BRASIL", "Não", "077 - BAHAMAS, ILHAS").
  //
  // A comparação ignora espaço em branco e o ordinal "º" de propósito, e a
  // ressalva vale a pena escrever: são as ÚNICAS duas diferenças que sobram
  // entre os dois caminhos, ambas inofensivas e nenhuma delas perda de dado.
  // (1) Quando a palavra é partida por hífen na quebra de linha do PDF
  // ("7827/0000501-" + "3"), o parser junta com um espaço no meio; colar sem
  // espaço parecia a correção óbvia, mas quebra o caso oposto, em que o texto
  // original tem mesmo um espaço depois do hífen ("NO. 5- QUADRA 11"), e não
  // há como distinguir os dois pelo texto. (2) O .DBK não guarda "º" nem
  // acentuação, então "Nº CONTRATO" do PDF vira "No CONTRATO" no .DBK: aqui
  // é o PDF que está mais fiel à declaração.
  it('cada uma das 172 discriminações do PDF bate caractere a caractere com o .DBK', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    const norm = (t) => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[ºª]/g, 'o').replace(/\s+/g, '').toUpperCase();
    const chave = (b) => `${b.grupo}|${b.codigo_bem}|${b.situacao_anterior.toFixed(2)}|${b.situacao_atual.toFixed(2)}`;

    // Casa cada bem do PDF com o do .DBK por grupo, código e par de valores
    // (a ORDEM difere entre os dois caminhos, então comparar por índice não
    // diria nada). Cada item do .DBK só pode ser usado uma vez.
    const porChave = new Map();
    for (const b of rd.bens) {
      if (!porChave.has(chave(b))) porChave.set(chave(b), []);
      porChave.get(chave(b)).push(b);
    }
    const divergentes = [];
    for (const b of rp.bens) {
      const candidatos = porChave.get(chave(b)) || [];
      const i = candidatos.findIndex(c => norm(c.discriminacao) === norm(b.discriminacao));
      if (i === -1) divergentes.push({ grupo: b.grupo, codigo: b.codigo_bem, pdf: b.discriminacao });
      else candidatos.splice(i, 1);
    }
    expect(divergentes).toEqual([]);
  }, 30000);

  it('a descrição dos Pagamentos Efetuados é a mesma pelos dois caminhos', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    const norm = (t) => (t || '').replace(/\s+/g, ' ').trim().toUpperCase();
    const chave = (p) => `${p.cpf_cnpj}|${p.valor_pago.toFixed(2)}`;
    const doPdf = new Map(rp.pagamentos.map(p => [chave(p), p]));
    const divergentes = rd.pagamentos
      .filter(d => norm(doPdf.get(chave(d))?.descricao) !== norm(d.descricao))
      .map(d => d.nome_beneficiario);
    expect(divergentes).toEqual([]);
  }, 30000);

  it('nenhum bem carrega valor de campo do formulário no fim da discriminação', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    // Os 12 sufixos indevidos encontrados na auditoria, mais o "Titular" que
    // já tinha teste próprio.
    const lixo = /(105 - BRASIL|077 - BAHAMAS, ILHAS|Aplicação Financeira|\bConta: [\d-]+|\bNão|\bTitular)$/;
    const sujos = r.bens.filter(b => lixo.test(b.discriminacao.trim())).map(b => b.discriminacao);
    expect(sujos).toEqual([]);
  }, 30000);
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

  // Estas duas linhas continuam sendo metadado, mas quem as descarta na
  // leitura de bens passou a ser o filtro por COLUNA (elas moram em x≈17, na
  // margem esquerda, fora da coluna DISCRIMINAÇÃO), e não mais este regex.
  // A mudança foi deliberada, na auditoria de 21/08/2026: exigir o rótulo em
  // qualquer posição da linha fazia o parser descartar texto REAL do bem que
  // apenas TERMINA num rótulo, porque o valor quebrou para a linha seguinte
  // ("...EMPREENDIMENTOS IMOBILIARIOS SPE LTDA CNPJ:"), ou que menciona um
  // rótulo no meio ("...7824/0019900-9 QUANTIDADE: 330.158,62550000"). Eram
  // 33 dos 172 bens perdendo o nome da contraparte, a agência e conta, o
  // chassi ou a quantidade de cotas.
  it('rótulo no MEIO da linha não é mais suficiente: quem separa isso é a coluna', () => {
    expect(isBensMetadataRow(linha('105 - BRASIL Bem com usufruto: Não'))).toBe(false);
    expect(isBensMetadataRow(linha('Bem com usufruto: Não'))).toBe(true);
  });

  it('NÃO descarta texto do bem que termina num rótulo, com o valor na linha seguinte', () => {
    expect(isBensMetadataRow(linha('EMPREENDIMENTOS IMOBILIARIOS SPE LTDA CNPJ:'))).toBe(false);
    expect(isBensMetadataRow(linha('9 QUANTIDADE: 330.158,62550000'))).toBe(false);
    expect(isBensMetadataRow(linha('RECEBIDA EM DOACAO DE DECLARANTE 1 DE CASTRO CPF:'))).toBe(false);
  });

  it('reconhece a pergunta fixa sobre perdas a compensar', () => {
    expect(isBensMetadataRow(linha('Possui perdas a compensar de acordo com a Lei nº 14.754, de 2023 (art. 9º)?'))).toBe(true);
  });

  it('NÃO trata texto descritivo real do bem como metadado, mesmo mencionando CNPJ sem ser um rótulo', () => {
    expect(isBensMetadataRow(linha('GALPAO URBANO'))).toBe(false);
    expect(isBensMetadataRow(linha('CONSTITUIDO EM 2023 CNPJ 34.368.882'))).toBe(false);
    expect(isBensMetadataRow(linha('APARTAMENTO SITUADO A RUA SANTA CATARINA NUMERO 1466'))).toBe(false);
  });

  it('reconhece "Titular"/"Dependente" sozinho na linha — é o VALOR da coluna Beneficiário sem o rótulo "Beneficiário:" na mesma linha (achado real, auditoria contra a declaração: 12 de 172 bens vinham com " Titular" grudado no fim da discriminação)', () => {
    expect(isBensMetadataRow(linha('Titular'))).toBe(true);
    expect(isBensMetadataRow(linha('Dependente'))).toBe(true);
    // Só a linha inteira sendo exatamente isso — "Titular" dentro de uma
    // frase real continua discriminação de verdade, não metadado.
    expect(isBensMetadataRow(linha('IMOVEL DO TITULAR ANTERIOR'))).toBe(false);
  });
});

// O app atende qualquer declaração de cliente, não só a que serviu para
// decifrar os formatos. Este bloco roda o parser contra um SEGUNDO
// contribuinte e confere contra os totais impressos na própria declaração
// (página "EVOLUÇÃO PATRIMONIAL" e linha TOTAL de cada ficha), que é o único
// gabarito disponível quando não existe .DBK do mesmo declarante.
describe.skipIf(!temSegundoPdf)('parsePDF, segundo contribuinte (layout diferente, sem .DBK)', () => {
  const lerPdf2 = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };

  it('bate com os totais impressos na própria declaração', async () => {
    const r = await lerPdf2();
    expect(r.anoCalendario).toBe(2025);
    esperaPessoal(r.contribuinte.cpf, 'titular2Cpf');
    expect(r.contribuinte.dataNascimento).toBe('1965-02-02');
    esperaPessoal(r.contribuinte.cpfConjuge, 'dependente2Cpf');
    expect(r.contribuinte.municipio).toBe('RIO POMBA');
    expect(r.contribuinte.uf).toBe('MG');
    esperaPessoal(r.contribuinte.email, 'titular2Email');
    expect(r.contribuinte.ocupacaoCodigo).toBe('120');
    expect(r.contribuinte.tipoDeclaracao).toContain('Original');
    expect(r.documentoFonte.formato).toBe('pdf');
    expect(r.documentoFonte.totalPaginas).toBe(50);
    expect(r.documentoFonte.paginas).toHaveLength(50);
    expect(r.documentoFonte.caracteresExtraidos).toBeGreaterThan(70000);
    expect(r.documentoFonte.sha256TextoExtraido).toMatch(/^[a-f0-9]{64}$/);

    // Página "EVOLUÇÃO PATRIMONIAL": 60.723.823,07 → 71.231.012,07.
    expect(r.bens).toHaveLength(74);
    expect(r.bens.reduce((s, b) => s + b.situacao_anterior, 0)).toBeCloseTo(60723823.07, 2);
    expect(r.bens.reduce((s, b) => s + b.situacao_atual, 0)).toBeCloseTo(71231012.07, 2);

    // Ficha "DÍVIDAS E ÔNUS REAIS" vem "Sem Informações": não pode inventar item.
    expect(r.dividas).toEqual([]);

    // Linha TOTAL de "PAGAMENTOS EFETUADOS": 141.998,42 e 27.446,58. São 20
    // pagamentos espalhados por DUAS páginas, e ao contrário do primeiro
    // contribuinte vários têm parcela não dedutível diferente de zero.
    expect(r.pagamentos).toHaveLength(20);
    expect(r.pagamentos.reduce((s, p) => s + p.valor_pago, 0)).toBeCloseTo(141998.42, 2);
    expect(r.pagamentos.reduce((s, p) => s + p.parcela_nao_dedutivel, 0)).toBeCloseTo(27446.58, 2);

    // As 4 fichas de Doações vêm "Sem Informações".
    expect(r.doacoesEfetuadasOficial).toEqual([]);
    expect(r.doacoesPartidosOficial).toEqual([]);
    expect(r.doacoesEcaIdosoOficial).toEqual([]);
  }, 30000);

  // Regressão do achado da auditoria de 21/08/2026 contra este segundo
  // arquivo: o rótulo "Negociados em Bolsa:" era desenhado em y=537 e o "Não"
  // correspondente em y=536. Como buildRows agrupava por y ARREDONDADO e
  // exato, os dois viravam linhas diferentes, o "Não" ficava órfão na coluna
  // de discriminação e grudava no fim do texto do bem. Corrigido agrupando
  // por proximidade (TOLERANCIA_LINHA).
  it('não gruda valor de campo do formulário no fim da discriminação', async () => {
    const r = await lerPdf2();
    const lixo = /\b(Não|Sim|Titular|Dependente)$|105 - BRASIL$|Conta: [\d-]+$/;
    const sujos = r.bens.filter(b => lixo.test(b.discriminacao.trim()))
      .map(b => `[${b.grupo}/${b.codigo_bem}] ...${b.discriminacao.trim().slice(-70)}`);
    expect(sujos).toEqual([]);
  }, 30000);

  it('todo bem tem grupo, código e discriminação', async () => {
    const r = await lerPdf2();
    expect(r.bens.filter(b => !b.grupo)).toEqual([]);
    expect(r.bens.filter(b => !b.codigo_bem)).toEqual([]);
    expect(r.bens.filter(b => !b.discriminacao.trim())).toEqual([]);
  }, 30000);
});

describe.skipIf(!temArquivos || !temSegundoPdf)('catálogo de fichas observado nos dois PDFs reais', () => {
  const ler = async (path) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(path));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };

  it('não confunde falha de reconhecimento com ficha oficialmente vazia', async () => {
    for (const path of [PDF_PATH, PDF2_PATH]) {
      const r = await ler(path);
      const erros = Object.entries(r.estadoFichas)
        .filter(([, detalhe]) => detalhe.estado === 'erro')
        .map(([id, detalhe]) => `${id}: ${detalhe.motivo}`);
      expect(erros).toEqual([]);
      expect(Object.keys(r.fichasPdfObservadas).length).toBeGreaterThan(15);
      expect(r.totalFichasPdfCatalogadas).toBeGreaterThan(40);
      expect(Object.keys(r.estadoFichas).filter(id => id.startsWith('pdf:')).length)
        .toBeGreaterThanOrEqual(r.totalFichasPdfCatalogadas);
      // A ficha de saída definitiva passou a ser ESTRUTURADA (o parser lê
      // procurador, país e a data da condição de não residente), mas numa
      // declaração de ajuste anual ela não é impressa: o que se afirma aqui é
      // a AUSÊNCIA no documento, não a falta de suporte do app.
      expect(r.estadoFichas['pdf:saida-definitiva']).toEqual(expect.objectContaining({
        estado: 'ausente', presenca: 'ausente', suporte: 'estruturada',
      }));
      expect(r.estadoFichas['pdf:alimentandos']).toEqual(expect.objectContaining({
        estado: 'vazia', presenca: 'vazia', suporte: 'nao_suportada',
        paginaInicio: expect.any(Number), linhaInicio: expect.any(Number),
      }));
      expect(r.estadoFichas['pdf:identificacao-contribuinte']).toEqual(expect.objectContaining({
        titulo: 'Identificação do contribuinte', paginaInicio: 1,
      }));
    }
  }, 60000);
});

// Regressão do achado de 21/08/2026, depois de a usuária cobrar detalhe na
// extração do PDF: as fichas "Doações Diretamente na Declaração - ECA" e
// "- Pessoa Idosa" NUNCA eram lidas, em declaração nenhuma. O gatilho delas
// exigia `!pastRuralAnnex`, uma trava criada para ignorar sub-tabelas de bens
// e dívidas do anexo de Atividade Rural; só que essas duas fichas são fichas
// próprias e ficam sempre DEPOIS do anexo (páginas 48 e 56 contra 20 e 41 nas
// duas declarações de referência), então a trava as engolia.
//
// O defeito ficou invisível porque nos dois arquivos de referência as quatro
// fichas de doação estão "Sem Informações". Por isso este teste usa um PDF
// sintético, versionado em __fixtures__, que reproduz a ORDEM REAL das
// páginas: anexo rural primeiro, fichas de doação depois, RESUMO por último.
describe('parsePDF: fichas de Doações que ficam depois do anexo de Atividade Rural', () => {
  const FIXTURE = new URL('./__fixtures__/doacoes-apos-anexo-rural.pdf', import.meta.url);

  const lerFixture = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(FIXTURE));
    // Esta fixture reproduz somente as páginas/seções necessárias ao teste,
    // não uma declaração inteira. A validação estrutural completa continua
    // obrigatória em toda chamada real do app e tem testes negativos próprios.
    return parsePDF(await pdfjsLib.getDocument({ data }).promise, undefined, undefined, { validarDocumento: false });
  };

  it('lê ECA e Pessoa Idosa mesmo vindo depois do Demonstrativo de Atividade Rural', async () => {
    const r = await lerFixture();
    expect(r.doacoesEcaIdosoOficial).toHaveLength(2);

    const eca = r.doacoesEcaIdosoOficial.find(d => d.categoria === 'eca');
    expect(eca.codigo).toBe('41');
    expect(eca.nome_beneficiario).toBe('FUNDO MUNICIPAL DA CRIANCA');
    expect(eca.cpf_cnpj).toBe('26459474000190');
    expect(eca.valor).toBeCloseTo(2857.33, 2);
    expect(eca.descricao).toBe('DOACAO ESTATUTO DA CRIANCA');

    const idoso = r.doacoesEcaIdosoOficial.find(d => d.categoria === 'idoso');
    expect(idoso.codigo).toBe('42');
    expect(idoso.valor).toBeCloseTo(1500, 2);
  });

  it('a seção fecha no RESUMO, sem transformar linha de outra página em doação', async () => {
    const r = await lerFixture();
    // A página de RESUMO da fixture tem uma linha com a mesma forma de uma
    // doação (código, nome, CNPJ, valor). Se a seção seguisse aberta, ela
    // entraria como uma terceira doação de 9.999,99.
    expect(r.doacoesEcaIdosoOficial.map(d => d.valor)).not.toContain(9999.99);
    expect(r.doacoesEcaIdosoOficial).toHaveLength(2);
  });

  it('a trava do anexo rural continua valendo para bens, dívidas e pagamentos', async () => {
    // A fixture tem uma linha de imóvel rural dentro do anexo. Ela não pode
    // virar bem, dívida nem pagamento: é isso que `pastRuralAnnex` protege, e
    // essa parte não mudou.
    const r = await lerFixture();
    expect(r.bens).toEqual([]);
    expect(r.dividas).toEqual([]);
    expect(r.pagamentos).toEqual([]);
  });
});

// Renda Variável pelo PDF. O registro 76 do .DBK só diz que a ficha existe em
// cada mês; o VALOR nunca pôde ser decifrado ali porque os dois arquivos de
// referência têm todos os campos zerados. No PDF do segundo contribuinte os
// valores existem e são legíveis, e batem com o que a planilha da usuária
// registra em "PREJUÍZO A COMPENSAR - BOLSA" (99.811,07, do titular) e
// "PERDA APURADA NA VENDA DE BOLSA-RPMM" (245,40, da dependente).
// Rendimentos Tributáveis de PJ do segundo contribuinte: é o único arquivo
// disponível que tem a ficha dos DEPENDENTES preenchida, com CPF do dependente
// e 13º salário diferente de zero. Os gabaritos são as linhas TOTAL impressas
// em cada uma das duas fichas, que por sua vez batem com a página RESUMO.
describe.skipIf(!temSegundoPdf)('parsePDF: Rendimentos de PJ do titular e dos dependentes (segundo contribuinte)', () => {
  const lerPdf2 = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };
  const somar = (lista, chave) => lista.reduce((s, r) => s + (r[chave] || 0), 0);

  it('bate com a linha TOTAL da ficha do titular, nas 5 colunas', async () => {
    const r = await lerPdf2();
    // Filtrar por tipo é obrigatório desde que as fichas de isentos e de
    // tributação exclusiva passaram a entrar na mesma lista: elas também
    // trazem beneficiário Titular/Dependente.
    const titular = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Titular');
    expect(titular).toHaveLength(3);
    // TOTAL impresso: 228.565,14 / 10.726,87 / 43.658,89 / 0,00 / 0,00. O
    // primeiro número é o mesmo da página RESUMO, linha "Recebidos de Pessoa
    // Jurídica pelo titular".
    expect(somar(titular, 'valor')).toBeCloseTo(228565.14, 2);
    expect(somar(titular, 'contribuicaoPrevidenciaria')).toBeCloseTo(10726.87, 2);
    expect(somar(titular, 'irrf')).toBeCloseTo(43658.89, 2);
    expect(somar(titular, 'decimoTerceiro')).toBe(0);
    expect(somar(titular, 'irrfDecimoTerceiro')).toBe(0);
    // Ficha do titular não tem CPF de dependente nenhum.
    expect(titular.every(x => x.cpf_dependente === null)).toBe(true);
  }, 60000);

  it('bate com a linha TOTAL da ficha dos dependentes, e traz o CPF do dependente', async () => {
    const r = await lerPdf2();
    const dep = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Dependente');
    expect(dep).toHaveLength(4);
    // TOTAL impresso: 112.084,33 / 5.976,30 / 3.360,61 / 4.556,29 / 274,90.
    expect(somar(dep, 'valor')).toBeCloseTo(112084.33, 2);
    expect(somar(dep, 'contribuicaoPrevidenciaria')).toBeCloseTo(5976.30, 2);
    expect(somar(dep, 'irrf')).toBeCloseTo(3360.61, 2);
    expect(somar(dep, 'decimoTerceiro')).toBeCloseTo(4556.29, 2);
    expect(somar(dep, 'irrfDecimoTerceiro')).toBeCloseTo(274.90, 2);
    // Nesta ficha cada linha traz DOIS documentos: o CNPJ da fonte e, depois
    // do rótulo "CPF DO DEPENDENTE:", o CPF de quem recebeu. Trocar um pelo
    // outro é o erro fácil aqui.
    expect(dep.every(x => x.cpf_dependente === pessoal('dependente2Cpf'))).toBe(true);
    const inss = dep.find(x => x.cnpj_fonte === '16727230000197');
    expect(inss.nome_fonte).toBe('FUNDO DE RENDIMENTO GERAL DE PREVIDENCIA SOCIAL');
    expect(inss.valor).toBeCloseTo(57754.33, 2);
    expect(inss.decimoTerceiro).toBeCloseTo(4556.29, 2);
  }, 60000);

  it('junta o nome da fonte quebrado em várias linhas, sem colar valor nem rótulo', async () => {
    const r = await lerPdf2();
    // "SOMA NUTRICAO ANIMAL INDUSTRIA" + "E COMERCIO LTDA", em duas linhas.
    const soma = r.rendimentos.find(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Titular' && x.cnpj_fonte === '64322423000100');
    expect(soma.nome_fonte).toBe('SOMA NUTRICAO ANIMAL INDUSTRIA E COMERCIO LTDA');
    expect(soma.valor).toBeCloseTo(208955.14, 2);
    // Nenhum nome pode carregar rótulo do formulário nem dígito de valor.
    for (const rend of r.rendimentos.filter(x => x.tipo === 'tributavel_pj')) {
      expect(rend.nome_fonte).not.toMatch(/CNPJ\/CPF|CPF DO DEPENDENTE|\d{2},\d{2}$/);
      expect(rend.nome_fonte.trim()).not.toBe('');
    }
  }, 60000);
});

// Atividade Rural pelo PDF: receitas e despesas mês a mês e a apuração do
// resultado. Foi este caminho que revelou os três nomes errados do registro 52
// do .DBK — aqui cada valor vem com o RÓTULO impresso ao lado, enquanto no
// .DBK os nomes tiveram que ser deduzidos pela ordem dos campos.
describe.skipIf(!temArquivos)('parsePDF: Atividade Rural (receitas/despesas e apuração)', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };

  it('os 12 meses saem idênticos aos do .DBK, sem trocar receita por despesa', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.receitasDespesasRuraisOficial).toHaveLength(12);
    for (const doDbk of rd.receitasDespesasRuraisOficial) {
      const doPdf = rp.receitasDespesasRuraisOficial.find(x => x.mes === doDbk.mes);
      expect(`m${doDbk.mes}.receita=${doPdf.receitaBruta}`).toBe(`m${doDbk.mes}.receita=${doDbk.receitaBruta}`);
      expect(`m${doDbk.mes}.despesa=${doPdf.despesaCusteioInvestimento}`).toBe(`m${doDbk.mes}.despesa=${doDbk.despesaCusteioInvestimento}`);
    }
  }, 30000);

  it('a soma dos 12 meses fecha com os totais da ficha de apuração', async () => {
    const { rp } = await lerAmbos();
    // É esta soma que prova qual coluna é qual: a primeira coluna da tabela
    // mensal fecha com "Receita bruta total" e a segunda com "Despesa de
    // custeio e investimento total". Trocar as duas quebra as duas somas.
    const somaReceita = rp.receitasDespesasRuraisOficial.reduce((s, m) => s + m.receitaBruta, 0);
    const somaDespesa = rp.receitasDespesasRuraisOficial.reduce((s, m) => s + m.despesaCusteioInvestimento, 0);
    expect(somaReceita).toBeCloseTo(12021185.04, 2);
    expect(somaDespesa).toBeCloseTo(13583255.03, 2);
    expect(somaReceita).toBeCloseTo(rp.apuracaoResultadoRuralOficial.receitaBrutaTotal, 2);
    expect(somaDespesa).toBeCloseTo(rp.apuracaoResultadoRuralOficial.despesaTotal, 2);
    // E o resultado impresso é a diferença entre os dois.
    expect(rp.apuracaoResultadoRuralOficial.resultado).toBeCloseTo(somaReceita - somaDespesa, 2);
  }, 30000);

  it('a apuração lida do PDF bate com a do .DBK depois da correção dos nomes', async () => {
    const { rp, rd } = await lerAmbos();
    for (const campo of Object.keys(rd.apuracaoResultadoRuralOficial)) {
      if (campo === 'origem') continue;
      // Campos que só o .DBK tem, vindos do layout oficial: a opção de
      // apuração e o resultado em dólar da atividade rural no exterior. O PDF
      // não os expõe em lugar comparável.
      if (campo === 'opcaoApuracaoResultadoTributavel' || campo === 'resultadoExteriorDolar') continue;
      expect(`${campo}=${rp.apuracaoResultadoRuralOficial[campo]}`)
        .toBe(`${campo}=${rd.apuracaoResultadoRuralOficial[campo]}`);
    }
    // O campo que estava errado, agora com o valor que a declaração imprime.
    expect(rp.apuracaoResultadoRuralOficial.resultadoTributavel).toBe(0);
    expect(rp.apuracaoResultadoRuralOficial.limite20PctReceitaBruta).toBeCloseTo(2404237.00, 2);
    // E cada caminho se identifica, para depuração.
    expect(rp.apuracaoResultadoRuralOficial.origem).toBe('pdf');
    expect(rd.apuracaoResultadoRuralOficial.origem).toBe('dbk');
  }, 30000);

  it('a linha TOTAL da tabela mensal não vira um 13º mês', async () => {
    const { rp } = await lerAmbos();
    expect(rp.receitasDespesasRuraisOficial.map(m => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    // E nenhum mês pode carregar o valor do total.
    expect(rp.receitasDespesasRuraisOficial.every(m => m.receitaBruta < 12021185.04)).toBe(true);
  }, 30000);
});

// Bens da Atividade Rural e Dívidas Vinculadas pelo PDF. São as duas
// sub-tabelas que ficam DENTRO do anexo rural e que a trava `pastRuralAnnex`
// impede de entrar como bens e dívidas comuns — o teste mais importante deste
// bloco é justamente o de que essa trava continua valendo.
describe.skipIf(!temArquivos)('parsePDF: bens e dívidas da Atividade Rural', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };
  const somar = (lista, chave) => lista.reduce((s, x) => s + (x[chave] || 0), 0);

  it('lê os 60 bens rurais com as mesmas somas do .DBK', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.bensRurais).toHaveLength(60);
    expect(rp.bensRurais).toHaveLength(rd.bensRurais.length);
    // Confirma, de forma independente, a correção do registro 54 (a situação
    // anterior e a atual vêm em ordem invertida naquele registro, ao contrário
    // do registro 27): se ainda estivessem trocadas, estas somas não bateriam.
    expect(somar(rp.bensRurais, 'situacao_anterior')).toBeCloseTo(somar(rd.bensRurais, 'situacao_anterior'), 2);
    expect(somar(rp.bensRurais, 'situacao_atual')).toBeCloseTo(somar(rd.bensRurais, 'situacao_atual'), 2);
    expect(somar(rp.bensRurais, 'situacao_anterior')).toBeCloseTo(12911826.81, 2);
    expect(somar(rp.bensRurais, 'situacao_atual')).toBeCloseTo(14404980.58, 2);
    // Código do bem e discriminação remontada de várias linhas.
    const trator = rp.bensRurais[0];
    expect(trator.codigo).toBe('16');
    expect(trator.discriminacao).toContain('TRATOR AGRICOLA DE RODAS NEW HOLAND');
    expect(trator.discriminacao).toContain('CARMO MAQUINAS COMERCIO E REPRES. LTDA');
    expect(new Set(rp.bensRurais.map(item => item.chaveImportacao)).size).toBe(60);
  }, 30000);

  it('lê as 6 dívidas vinculadas, batendo com a linha TOTAL impressa', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.dividasRurais).toHaveLength(6);
    // TOTAL impresso na ficha: 4.400.361,87 / 2.616.738,92 / 2.074.797,15.
    expect(somar(rp.dividasRurais, 'situacao_anterior')).toBeCloseTo(4400361.87, 2);
    expect(somar(rp.dividasRurais, 'situacao_atual')).toBeCloseTo(2616738.92, 2);
    expect(somar(rp.dividasRurais, 'valor_pago')).toBeCloseTo(2074797.15, 2);
    // E igual ao .DBK nas três colunas.
    for (const campo of ['situacao_anterior', 'situacao_atual', 'valor_pago']) {
      expect(somar(rp.dividasRurais, campo)).toBeCloseTo(somar(rd.dividasRurais, campo), 2);
    }
    // A coluna "VALOR PAGO EM 2025" é a terceira, e não pode ser confundida
    // com a situação atual: numa das dívidas a atual é 0,00 e o pago é
    // 1.460.550,08 (quitada no ano).
    const quitada = rp.dividasRurais.find(d => d.situacao_atual === 0);
    expect(quitada).toBeTruthy();
    expect(quitada.valor_pago).toBeGreaterThan(0);
    expect(new Set(rp.dividasRurais.map(item => item.chaveImportacao)).size).toBe(6);
  }, 30000);

  it('a trava do anexo rural continua valendo: nada disso entra como bem ou dívida comum', async () => {
    const { rp, rd } = await lerAmbos();
    // Este é o ponto crítico da mudança. As duas sub-tabelas rurais agora TÊM
    // seção própria; se o gatilho delas vazasse para as seções comuns, os 60
    // bens rurais entrariam na Declaração de Bens e Direitos e as 6 dívidas em
    // Dívidas e Ônus Reais, inflando o patrimônio da pessoa.
    expect(rp.bens).toHaveLength(172);
    expect(rp.bens).toHaveLength(rd.bens.length);
    expect(rp.dividas).toHaveLength(1);
    expect(rp.pagamentos).toHaveLength(24);
    // Nenhum bem comum pode ter a discriminação de um bem rural.
    const discRurais = new Set(rp.bensRurais.map(b => b.discriminacao));
    expect(rp.bens.some(b => discRurais.has(b.discriminacao))).toBe(false);
  }, 30000);
});

// Imóveis explorados, participantes e movimentação do rebanho pelo PDF.
describe.skipIf(!temArquivos)('parsePDF: imóveis rurais, participantes e rebanho', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };

  it('lê os 24 imóveis explorados, batendo com o .DBK nos campos numéricos e no CIB', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.imoveisRurais).toHaveLength(rd.imoveisRurais.length);
    expect(rp.imoveisRurais).toHaveLength(24);
    // Casados por POSIÇÃO, e não por CIB: nesta declaração dois imóveis
    // diferentes compartilham o CIB 2639188-0 (duas partes da Fazenda
    // fazenda V, 147 ha e 105,3 ha, com condições de exploração
    // diferentes). O CIB identifica o imóvel no cadastro da Receita, não a
    // linha da ficha, e os dois caminhos entregam na mesma ordem.
    rp.imoveisRurais.forEach((doPdf, i) => {
      const doDbk = rd.imoveisRurais[i];
      for (const campo of ['cib', 'area', 'participacao', 'condicaoExploracao', 'codigoAtividade']) {
        expect(`#${i}.${campo}=${doPdf[campo]}`).toBe(`#${i}.${campo}=${doDbk[campo]}`);
      }
    });
    // O CIB repetido é real e tem que sobreviver à importação, com os dois
    // imóveis preservados.
    const imoveisMesmoCib = rp.imoveisRurais.filter(x => x.cib === '2639188-0');
    expect(imoveisMesmoCib).toHaveLength(2);
    expect(imoveisMesmoCib.map(x => x.area).sort((a, b) => a - b)).toEqual([105.3, 147]);
    // O nome sai levemente diferente de propósito: no .DBK são dois campos
    // (nome e localização) concatenados sem pontuação, e no PDF é o texto
    // impresso, com a vírgula. O do PDF é o mais fiel à declaração.
    const olaria = rp.imoveisRurais.find(x => x.cib === '1330217-5');
    esperaPessoal(olaria.nomeLocalizacao, 'imovelOlariaNomeLocalizacao');
    expect(olaria.area).toBeCloseTo(147.4, 1);
    expect(olaria.participacao).toBeCloseTo(100, 2);
  }, 30000);

  it('lê os 18 participantes E o vínculo com o imóvel, que o .DBK não tem', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.participantesRuraisOficial).toHaveLength(18);
    // Os CPFs batem com o .DBK, participante a participante.
    expect(rp.participantesRuraisOficial.map(p => p.cpf).sort())
      .toEqual(rd.participantesRuraisOficial.map(p => p.cpf).sort());
    // Os NOMES batem depois de tirar acento: o .DBK grava sem acentuação
    // sem acentuação nem apóstrofo, e o PDF traz o texto impresso com os dois.
    // O do PDF é o mais fiel à
    // declaração; não é divergência de leitura.
    const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z ]/gi, ' ').replace(/\s+/g, ' ').trim();
    const porCpf = (lista) => Object.fromEntries(lista.map(p => [p.cpf, semAcento(p.nome)]));
    expect(porCpf(rp.participantesRuraisOficial)).toEqual(porCpf(rd.participantesRuraisOficial));

    // O ganho sobre o .DBK: no PDF os participantes vêm ANINHADOS sob a linha
    // do imóvel ("PARTICIPANTE(S)" logo abaixo dela), então dá para saber de
    // QUAL fazenda cada um é coproprietário. A ATUALIZAÇÃO 3 registrou esse
    // vínculo como impossível pelo arquivo .DBK.
    expect(rp.participantesRuraisOficial.every(p => p.imovelId != null)).toBe(true);
    const osires = rp.participantesRuraisOficial.find(p => p.cpf === pessoal('participante1Cpf'));
    esperaPessoal(osires.nome, 'participante1Nome');
    expect(osires.imovelCib).toBe('2211420-3');
    esperaPessoal(osires.imovelNome, 'imovelMirandasNomeLocalizacao');
    // O vínculo é pelo `id` do imóvel, e não pelo CIB, porque o CIB se repete
    // nesta declaração. Todo id citado existe mesmo na lista de imóveis, e
    // aponta para o imóvel cujo CIB e nome o participante carrega.
    const porId = Object.fromEntries(rp.imoveisRurais.map(i => [i.id, i]));
    for (const p of rp.participantesRuraisOficial) {
      expect(porId[p.imovelId], `participante ${p.cpf} aponta para imóvel inexistente`).toBeTruthy();
      expect(porId[p.imovelId].cib).toBe(p.imovelCib);
      expect(porId[p.imovelId].nomeLocalizacao).toBe(p.imovelNome);
    }
  }, 30000);

  it('lê a movimentação do rebanho com a equação da ficha fechando', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.movimentacaoRebanhoOficial).toHaveLength(1);
    const doPdf = rp.movimentacaoRebanhoOficial[0];
    const doDbk = rd.movimentacaoRebanhoOficial[0];
    for (const campo of Object.keys(doDbk)) {
      expect(`${campo}=${doPdf[campo]}`).toBe(`${campo}=${doDbk[campo]}`);
    }
    // É esta equação que prova a ordem das colunas, e foi ela que denunciou a
    // leitura invertida do registro 53 (ver a correção no parser):
    //   inicial + aquisições + nascimentos - consumo/perdas - vendas = final
    expect(doPdf.estoqueInicial + doPdf.aquisicoes + doPdf.nascimentos - doPdf.consumoPerdas - doPdf.vendas)
      .toBeCloseTo(doPdf.estoqueFinal, 2);
    expect(doDbk.estoqueInicial + doDbk.aquisicoes + doDbk.nascimentos - doDbk.consumoPerdas - doDbk.vendas)
      .toBeCloseTo(doDbk.estoqueFinal, 2);
    expect(doPdf.estoqueInicial).toBe(29);
    expect(doPdf.estoqueFinal).toBe(125);
    // Nome da espécie, que só o PDF traz.
    expect(doPdf.especieNome).toBe('Bovinos e bufalinos');
  }, 30000);

  it('as quatro espécies zeradas não viram linha, igual ao .DBK', async () => {
    const { rp } = await lerAmbos();
    // A ficha imprime as cinco espécies sempre; só Bovinos tem movimento nesta
    // declaração. Registrar as outras quatro encheria a tela de zeros que a
    // declaração não considera informação.
    expect(rp.movimentacaoRebanhoOficial).toHaveLength(1);
    expect(rp.movimentacaoRebanhoOficial[0].especieCodigo).toBe('01');
  }, 30000);
});

// Apuração do Ganho de Capital pelo PDF. Uma PÁGINA por operação, e o formato
// é diferente do resto do documento: na maior parte da ficha o valor está na
// linha DE BAIXO do rótulo, não na mesma linha.
describe.skipIf(!temArquivos)('parsePDF: Apuração do Ganho de Capital', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };

  it('as 3 operações saem idênticas às do .DBK, campo a campo', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.apuracaoGanhoCapital).toHaveLength(3);
    for (const doDbk of rd.apuracaoGanhoCapital) {
      const doPdf = rp.apuracaoGanhoCapital.find(x => x.bem === doDbk.bem);
      expect(doPdf, `operação "${doDbk.bem}" não veio do PDF`).toBeTruthy();
      // Compara só os campos que o .DBK também tem: o PDF traz alguns a mais.
      for (const campo of Object.keys(doDbk)) {
        if (campo === 'id') continue;
        expect(`${doDbk.bem}.${campo}=${doPdf[campo]}`).toBe(`${doDbk.bem}.${campo}=${doDbk[campo]}`);
      }
    }
  }, 30000);

  it('o rótulo "Ganho de Capital" não é confundido com os outros três parecidos', async () => {
    const { rp } = await lerAmbos();
    // Na mesma página existem "Ganho de Capital da alienação atual", "Ganho de
    // Capital Total" e "Faixa de Ganho de Capital", que são outros números. Se
    // o casamento fosse por prefixo, o campo pegaria o valor errado.
    // Nas 3 operações desta declaração houve prejuízo, e a ficha imprime 0,00.
    expect(rp.apuracaoGanhoCapital.every(x => x.ganhoCapital === 0)).toBe(true);
    // E o custo de aquisição é MAIOR que o valor de alienação nas três, que é
    // o que confirma o prejuízo (e que os dois campos não foram trocados).
    expect(rp.apuracaoGanhoCapital.every(x => x.custoAquisicao > x.valorAlienacao)).toBe(true);
  }, 30000);

  it('lê os campos que ficam na linha de baixo do rótulo, sem trocar data por valor', async () => {
    const { rp } = await lerAmbos();
    const ranger = rp.apuracaoGanhoCapital.find(x => x.bem.includes('FORD RANGER'));
    // "Data de aquisição" e "Custo de Aquisição R$" são rótulos lado a lado, e
    // os dois valores vêm na linha seguinte, também lado a lado.
    expect(ranger.dataAquisicao).toBe('2023-07-20');
    expect(ranger.custoAquisicao).toBeCloseTo(341890, 2);
    expect(ranger.dataAlienacao).toBe('2025-07-30');
    expect(ranger.valorAlienacao).toBeCloseTo(270000, 2);
    // Campos que só o PDF traz.
    expect(ranger.naturezaOperacao).toBe('VENDA');
    expect(ranger.custoCorretagem).toBe(0);
    // Adquirente: documento e nome também vêm na linha de baixo.
    expect(ranger.adquirenteCpfCnpj).toBe('10376703000768');
    expect(ranger.adquirenteNome).toBe('FOCO AUTOMOVEIS LTDA');
  }, 30000);
});

describe.skipIf(!temSegundoPdf)('parsePDF: Ganho de Capital do segundo contribuinte (alienação a prazo)', () => {
  it('lê as 2 operações, inclusive a alienada em ano anterior e recebida em parcelas', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    expect(r.apuracaoGanhoCapital).toHaveLength(2);

    // Esta operação tem data de alienação em 2024 numa declaração do
    // ano-calendário 2025, e isso está CERTO: é alienação a prazo, com as
    // parcelas recebidas em 2025 (a página traz o bloco "CÁLCULO DO IMPOSTO -
    // ALIENAÇÃO A PRAZO" com seis parcelas). Não é data lida errada, e o
    // parser não pode "corrigir" para o ano da declaração.
    const aPrazo = r.apuracaoGanhoCapital.find(x => x.dataAlienacao.startsWith('2024'));
    expect(aPrazo).toBeTruthy();
    expect(aPrazo.dataAlienacao).toBe('2024-02-08');
    expect(aPrazo.dataAquisicao).toBe('2014-09-16');
    expect(aPrazo.valorAlienacao).toBeCloseTo(11500, 2);
    esperaPessoal(aPrazo.adquirenteNome, 'aPrazoAdquirenteNome');

    const outra = r.apuracaoGanhoCapital.find(x => x.dataAlienacao.startsWith('2025'));
    expect(outra.custoAquisicao).toBeCloseTo(21000, 2);
    expect(outra.valorAlienacao).toBeCloseTo(18000, 2);
    expect(outra.adquirenteCpfCnpj).toBe('57967008634');

    // As parcelas do bloco "ALIENAÇÃO A PRAZO" NÃO podem virar operações
    // próprias: são seis linhas com data e valor, na mesma página.
    expect(r.apuracaoGanhoCapital).toHaveLength(2);
  }, 60000);
});

// Dependentes, Resumo/Imposto Devido e Demonstrativo da Lei 14.754/2023 pelo
// PDF. As três eram .DBK-only, e as três podem ser confrontadas objeto a objeto
// contra o .DBK do mesmo declarante — o teste mais forte possível: dois
// arquivos independentes, dois parsers independentes, resultado idêntico.
describe.skipIf(!temArquivos)('parsePDF: Dependentes, Resumo e Lei 14.754 batendo com o .DBK', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };

  it('a ficha de Dependentes sai idêntica pelos dois caminhos', async () => {
    const { rp, rd } = await lerAmbos();
    // A proveniência é justamente o que DIFERE entre os dois caminhos (página e
    // linha no PDF, número do registro no arquivo eletrônico), e por isso sai
    // da comparação dos dois lados. O que tem que ser idêntico é a ficha.
    const semProveniencia = (lista) => lista.map(({ origemDocumento, ...dependente }) => dependente);
    expect(semProveniencia(rp.dependentes)).toEqual(semProveniencia(rd.dependentes));
    // E cada caminho tem que dizer de onde tirou o dependente, no formato dele.
    expect(rp.dependentes[0].origemDocumento).toMatchObject({ formato: 'pdf' });
    expect(rd.dependentes[0].origemDocumento).toMatchObject({ formato: 'dbk' });
    expect(rd.dependentes[0].origemDocumento.registro).toBeGreaterThan(0);
    expect(rp.dependentes).toHaveLength(1);
    // O código de parentesco vai cru nos dois, sem tradução (ver registro 25).
    expect(rp.dependentes[0].parentesco).toBe('11');
    expect(rp.dependentes[0].dataNascimento).toBe('1955-01-19');
  }, 30000);

  it('o título "DEPENDENTES" não captura as fichas que só terminam nessa palavra', async () => {
    const { rp } = await lerAmbos();
    // "RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES",
    // "... PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE SUSPENSA)" e a de renda
    // variável dos dependentes contêm a palavra, mas não são a ficha. Se
    // alguma delas abrisse a seção, sobrariam dependentes inventados.
    expect(rp.dependentes).toHaveLength(1);
    expect(rp.dependentes.every(d => d.nome && d.cpf)).toBe(true);
  }, 30000);

  it('os 16 campos do Resumo/Imposto Devido batem com o registro 20 do .DBK', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.impostoDevido).toBeTruthy();
    for (const campo of Object.keys(rd.impostoDevido)) {
      // `origem` e `modeloDeclaracao` são metadados, não valores da declaração:
      // o primeiro diz de qual arquivo veio, o segundo se a declaração é
      // completa ou simplificada (o .DBK sabe pelo tipo de registro, o PDF pelo
      // cabeçalho da página RESUMO).
      if (campo === 'origem') continue;
      if (campo === 'modeloDeclaracao') {
        expect(rp.impostoDevido.modeloDeclaracao).toBe(rd.impostoDevido.modeloDeclaracao);
        expect(rd.impostoDevido.modeloDeclaracao).toBe('completa');
        continue;
      }
      expect(`${campo}=${rp.impostoDevido[campo]?.toFixed(2)}`)
        .toBe(`${campo}=${rd.impostoDevido[campo].toFixed(2)}`);
    }
  }, 30000);

  it('a página RESUMO tem duas colunas, e o valor da direita não vira o da esquerda', async () => {
    const { rp } = await lerAmbos();
    // Nesta linha o formulário imprime, lado a lado:
    //   "Base de cálculo do imposto" 19.012,76 "SALDO DE IMPOSTO A PAGAR" 272.534,15
    // Pegar "o último valor da linha" daria 272.534,15 para a base de cálculo.
    expect(rp.impostoDevido.baseCalculo).toBeCloseTo(19012.76, 2);
    expect(rp.impostoDevido.saldoPagar).toBeCloseTo(272534.15, 2);
    expect(rp.impostoDevido.baseCalculo).not.toBeCloseTo(rp.impostoDevido.saldoPagar, 2);
  }, 30000);

  it('distingue os dois "TOTAL" da página, o de rendimentos e o de deduções', async () => {
    const { rp } = await lerAmbos();
    // A palavra TOTAL aparece uma vez em cada bloco; o rótulo sozinho não diz
    // qual é, e sem o bloco corrente o segundo sobrescreveria o primeiro.
    expect(rp.impostoDevido.rendimentosTributaveisTotal).toBeCloseTo(45567.84, 2);
    expect(rp.impostoDevido.totalDeducoes).toBeCloseTo(26555.08, 2);
  }, 30000);

  it('o Demonstrativo da Lei 14.754/2023 sai igual ao do .DBK, com o tipo do bem a mais', async () => {
    const { rp, rd } = await lerAmbos();
    expect(rp.demonstrativoExteriorOficial).toHaveLength(1);
    const doPdf = rp.demonstrativoExteriorOficial[0];
    const doDbk = rd.demonstrativoExteriorOficial[0];
    for (const campo of Object.keys(doDbk)) {
      expect(`${campo}=${doPdf[campo]}`).toBe(`${campo}=${doDbk[campo]}`);
    }
    // A coluna de imposto pago vem impressa como "-" e não como "0,00": tem
    // que virar zero, e não NaN nem o valor da coluna seguinte.
    expect(doPdf.impostoPagoBrasilExterior).toBe(0);
    expect(doPdf.baseCalculo).toBeCloseTo(1822059.55, 2);
    // Campo que só o PDF traz.
    expect(doPdf.tipo).toBe('AF');
  }, 30000);
});

describe.skipIf(!temSegundoPdf)('parsePDF: Dependentes e Resumo do segundo contribuinte', () => {
  it('lê o dependente e o resumo, batendo com os totais impressos', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);

    expect(r.dependentes).toHaveLength(1);
    esperaPessoal(r.dependentes[0].nome, 'dependente2Nome');
    esperaPessoal(r.dependentes[0].cpf, 'dependente2Cpf');
    expect(r.dependentes[0].dataNascimento).toBe('1965-06-23');
    expect(r.dependentes[0].racaCor).toBe('Não informada');
    expect(r.dependentes[0].moraComTitular).toBe(true);

    // Valores impressos na página RESUMO desta declaração.
    expect(r.impostoDevido.rendimentosTributaveisTotal).toBeCloseTo(340649.47, 2);
    expect(r.impostoDevido.totalDeducoes).toBeCloseTo(133530.09, 2);
    expect(r.impostoDevido.despesasMedicas).toBeCloseTo(114551.84, 2);
    expect(r.impostoDevido.baseCalculo).toBeCloseTo(207119.38, 2);
    expect(r.impostoDevido.impostoDevidoTotal).toBeCloseTo(46104.04, 2);
    expect(r.impostoDevido.impostoPagoTotal).toBeCloseTo(47019.50, 2);
    // Este contribuinte tem imposto A RESTITUIR, então o saldo a pagar é zero:
    // o parser não pode trocar um pelo outro (são colunas vizinhas na página).
    expect(r.impostoDevido.saldoPagar).toBe(0);

    // O total de rendimentos do resumo tem que fechar com a soma dos
    // rendimentos que o próprio parser extraiu, item a item, das fichas.
    const somaPJ = r.rendimentos
      .filter(x => x.tipo === 'tributavel_pj')
      .reduce((s, x) => s + x.valor, 0);
    expect(somaPJ).toBeCloseTo(r.impostoDevido.rendimentosTributaveisTotal, 2);

    // Sem bem no exterior: a ficha da Lei 14.754 não existe nesta declaração e
    // não pode inventar item nem campo.
    expect(r.demonstrativoExteriorOficial).toEqual([]);
    expect(r.impostoDevido.lei14754Ganho).toBeUndefined();
  }, 60000);
});

// Rendimentos Isentos e de Tributação Exclusiva pelo PDF. Estas duas fichas
// imprimem cada código DUAS vezes: uma linha agregada e, logo abaixo, a
// sub-tabela detalhada que soma exatamente o agregado. O parser importa o
// detalhe e usa o agregado como conferência; ler os dois duplicaria tudo.
// Conversão do número IMPRESSO na ficha para o CÓDIGO INTERNO do arquivo. A
// tabela de-para veio da classe `CadastroTabelasIRPF` do programa da Receita, e
// a lista da TELA foi conferida no manual (páginas 35 e 36 para os isentos,
// 74 e 79 para a exclusiva).
// Contraprova da conversão: os códigos de PAGAMENTO não são traduzidos, e não
// devem ser. O programa da Receita define constantes `_TELA` apenas para as
// duas fichas de rendimento; para pagamentos, o número impresso É o gravado.
describe.skipIf(!temArquivos)('códigos de pagamento não passam por conversão', () => {
  it('o código lido é o mesmo nos dois caminhos e bate com o manual', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    const codigos = (r) => [...new Set(r.pagamentos.map(p => p.codigo))].sort();
    expect(codigos(rp)).toEqual(codigos(rd));
    // Os que ESTA declaração tem: 10 (médicos no Brasil), 21 (hospitais,
    // clínicas e laboratórios) e 76 (arrendamento rural), conferidos no manual
    // — o de saúde na página 107. Se algum dia surgir uma tradução tela/arquivo
    // para esta ficha, é a igualdade acima que vai denunciar.
    expect(codigos(rp)).toContain('10');
    expect(codigos(rp)).toContain('21');
    expect(codigos(rp)).toContain('76');
  }, 30000);
});

describe('conversão de código impresso para código interno', () => {
  const lerPdf = async (caminho) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(caminho));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };

  it.skipIf(!temArquivos)('a Lei 14.754/2023 vira o código interno 13, e guarda o 12 impresso', async () => {
    const r = await lerPdf(PDF_PATH);
    const lei = r.rendimentos.filter(x => x.tipo === 'exclusivo_0013');
    expect(lei).toHaveLength(1);
    expect(lei[0].valor).toBeCloseTo(1822059.55, 2);
    // O número impresso continua acessível: é por ele que a pessoa acha a
    // linha na declaração em papel.
    expect(lei[0].codigo_impresso).toBe('12');
    // E não pode sobrar nada com o código antigo.
    expect(r.rendimentos.some(x => x.tipo === 'exclusivo_0012')).toBe(false);
  }, 30000);

  it.skipIf(!temSegundoPdf)('os prêmios de loteria viram o código interno 14', async () => {
    const r = await lerPdf(PDF2_PATH);
    const premio = r.rendimentos.filter(x => x.tipo === 'exclusivo_0014');
    expect(premio).toHaveLength(1);
    expect(premio[0].valor).toBeCloseTo(24412.89, 2);
    expect(premio[0].codigo_impresso).toBe('13');
  }, 60000);

  it.skipIf(!temArquivos)('os códigos que COINCIDEM entre tela e arquivo passam intactos', async () => {
    const r = await lerPdf(PDF_PATH);
    // Até o 11 as duas numerações são a mesma, e converter à toa seria pior que
    // não converter. O manual (página 35) lista os isentos 01..25, 27, 28 e 99,
    // e a tabela interna só renomeia o 99 para 26 — os códigos 27 e 28 existem
    // como constante mas apontam para eles mesmos.
    expect(r.rendimentos.some(x => x.tipo === 'isento_0009')).toBe(true);
    expect(r.rendimentos.some(x => x.tipo === 'isento_0012')).toBe(true);
    expect(r.rendimentos.some(x => x.tipo === 'exclusivo_0001')).toBe(true);
    expect(r.rendimentos.some(x => x.tipo === 'exclusivo_0006')).toBe(true);
    expect(r.rendimentos.some(x => x.tipo === 'exclusivo_0010')).toBe(true);
  }, 30000);
});

describe.skipIf(!temArquivos)('parsePDF: Rendimentos Isentos e de Tributação Exclusiva', () => {
  const lerPdf = async (caminho) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(caminho));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };
  const totalDe = (r, prefixo) => r.rendimentos
    .filter(x => x.tipo.startsWith(prefixo))
    .reduce((s, x) => s + x.valor, 0);

  it('bate com as linhas TOTAL impressas nas duas fichas', async () => {
    const r = await lerPdf(PDF_PATH);
    // TOTAL impresso na ficha de isentos: 69.879.549,10. Na de exclusiva:
    // 7.187.950,30. São os gabaritos da própria declaração.
    expect(totalDe(r, 'isento_')).toBeCloseTo(69879549.10, 2);
    expect(totalDe(r, 'exclusivo_')).toBeCloseTo(7187950.30, 2);
  }, 30000);

  it('cada código bate com o mesmo código lido do .DBK do mesmo declarante', async () => {
    const rp = await lerPdf(PDF_PATH);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const porCodigo = (r, prefixo) => {
      const acc = {};
      for (const x of r.rendimentos.filter(y => y.tipo.startsWith(prefixo))) {
        acc[x.tipo] = Number(((acc[x.tipo] || 0) + x.valor).toFixed(2));
      }
      return acc;
    };
    // Isentos batem código a código, inclusive o 0010, que só foi lido depois
    // de tratar o layout alternativo de sub-tabela (ver o teste seguinte).
    expect(porCodigo(rp, 'isento_')).toEqual(porCodigo(rd, 'isento_'));

    // A exclusiva também bate código a código desde a conversão tela->arquivo:
    // a Lei 14.754/2023 é o código interno 0013 nos DOIS caminhos, embora a
    // ficha impressa a numere como "12."
    expect(porCodigo(rp, 'exclusivo_')).toEqual(porCodigo(rd, 'exclusivo_'));
    expect(rp.rendimentos.some(x => x.tipo === 'exclusivo_0013')).toBe(true);
    expect(rp.rendimentos.find(x => x.tipo === 'exclusivo_0013').codigo_impresso).toBe('12');
  }, 30000);

  it('lê o valor quando ele vem em linha separada e rotulada (código 10 dos isentos)', async () => {
    const r = await lerPdf(PDF_PATH);
    // Este código imprime a sub-tabela SEM coluna de valor: a linha do
    // beneficiário vem sem número e o valor aparece embaixo, como
    // "Valor: 22.847,76   13º Salário: 1.903,98". Antes de tratar esse
    // layout, o item entrava zerado e os 24.751,74 sumiam do import inteiro.
    const dez = r.rendimentos.filter(x => x.tipo === 'isento_0010');
    expect(dez).toHaveLength(1);
    expect(dez[0].valor).toBeCloseTo(24751.74, 2);
    expect(dez[0].decimoTerceiro).toBeCloseTo(1903.98, 2);
    expect(dez[0].nome_fonte).toBe('FUNDO DO REGIME GERAL DE PREVIDENCIA SOCIAL');
    expect(dez[0].cnpj_fonte).toBe('16727230000197');
  }, 30000);

  // O cruzamento mais forte que existe para esta ficha: o registro 20 do .DBK
  // guarda os TOTAIS OFICIAIS que a Receita imprime na página RESUMO, calculados
  // pelo próprio programa da declaração. Conferir a soma item a item do PDF
  // contra eles é confrontar a extração com o número que a Receita considera
  // certo, e não com outra extração nossa.
  it('a soma item a item do PDF bate com os totais oficiais do registro-resumo da declaração', async () => {
    const rp = await lerPdf(PDF_PATH);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    expect(totalDe(rp, 'isento_')).toBeCloseTo(rd.impostoDevido.rendimentosIsentosOficial, 2);
    expect(totalDe(rp, 'exclusivo_')).toBeCloseTo(rd.impostoDevido.rendimentosExclusivoOficial, 2);
    expect(totalDe(rp, 'tributavel_pj')).toBeCloseTo(rd.impostoDevido.rendimentosTributaveisTotal, 2);
  }, 30000);

  it('importa o DETALHE por fonte pagadora, sem somar junto a linha agregada', async () => {
    const r = await lerPdf(PDF_PATH);
    // O código 09 (lucros e dividendos) tem várias fontes. Se o agregado
    // fosse lido junto com elas, o total dobraria.
    const nove = r.rendimentos.filter(x => x.tipo === 'isento_0009');
    expect(nove.length).toBeGreaterThan(1);
    expect(nove.reduce((s, x) => s + x.valor, 0)).toBeCloseTo(67086306.99, 2);
    // E cada item tem a identificação que só o PDF traz.
    expect(nove.every(x => x.nome_fonte !== '' && x.cnpj_fonte !== '')).toBe(true);
    expect(nove.every(x => ['Titular', 'Dependente'].includes(x.beneficiario))).toBe(true);
  }, 30000);
});

describe.skipIf(!temSegundoPdf)('parsePDF: Rendimentos Isentos e Exclusiva do segundo contribuinte', () => {
  it('bate com os TOTAIS impressos e separa dependente de titular', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const total = (p) => r.rendimentos.filter(x => x.tipo.startsWith(p)).reduce((s, x) => s + x.valor, 0);
    // TOTAL impresso: isentos 9.543.669,17 e exclusiva 2.234.711,09.
    expect(total('isento_')).toBeCloseTo(9543669.17, 2);
    expect(total('exclusivo_')).toBeCloseTo(2234711.09, 2);

    // Neste contribuinte a ficha imprime "13 - Prêmios líquidos obtidos em
    // loterias", que é o código INTERNO 14 (ver a tabela de-para em
    // importParsers.js). A sub-tabela dele tem layout próprio: traz "Descrição"
    // no lugar de CNPJ e nome da fonte, e o texto tem que virar o nome, sem
    // CNPJ inventado.
    const premio = r.rendimentos.filter(x => x.tipo === 'exclusivo_0014');
    expect(premio).toHaveLength(1);
    expect(premio[0].valor).toBeCloseTo(24412.89, 2);
    expect(premio[0].cnpj_fonte).toBe('');
    expect(premio[0].nome_fonte).toContain('APOSTAS');

    // Código sem sub-tabela nenhuma (13º dos dependentes) entra pelo agregado.
    const decimo = r.rendimentos.filter(x => x.tipo === 'exclusivo_0008');
    expect(decimo).toHaveLength(1);
    expect(decimo[0].valor).toBeCloseTo(4556.29, 2);
    // Esse é o MESMO 4.556,29 que aparece como 13º na ficha de rendimentos de
    // PJ dos dependentes. Ele entra uma vez só, pela ficha de exclusiva, que é
    // onde a declaração o tributa. Somar o `decimoTerceiro` da ficha de PJ em
    // qualquer total seria contá-lo duas vezes.
    const dep = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Dependente');
    expect(dep.reduce((s, x) => s + (x.decimoTerceiro || 0), 0)).toBeCloseTo(4556.29, 2);
  }, 60000);
});

// Ponta a ponta: importa a declaração real, monta o demonstrativo e confere
// que a conferência de aplicação resgatada aponta o caso certo e SÓ ele.
// Achado de 24/08/2026, o segundo maior item da conciliação daquele ano.
describe.skipIf(!temSegundoPdf || !temArquivos)('aplicação resgatada sem rendimento: as duas declarações reais', () => {
  const demonstrativoDoPdf = async (caminho) => {
    const { reducer, initialState } = await import('../store/reducer');
    const { demonstrativoConciliacao } = await import('../store/demonstrativos');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const payload = await parsePDF(await pdfjsLib.getDocument({ data: new Uint8Array(await readFile(caminho)) }).promise);
    return demonstrativoConciliacao(reducer(initialState, { type: 'IMPORT_DECLARACAO', payload }), '2025-01-01', '2025-12-31');
  };

  it('aponta a LCI do Sicoob e mostra os 102.194,93 que a mesma cooperativa pagou como lucros e dividendos', async () => {
    const d = await demonstrativoDoPdf(PDF2_PATH);
    expect(d.aplicacoesSemRendimento).toHaveLength(1);
    const a = d.aplicacoesSemRendimento[0];
    expect(a.discriminacao).toContain('SICOOB LCI');
    expect(a.cnpj).toBe('02335109000105');
    expect(a.valorResgatado).toBeCloseTo(483154.01, 2);
    // O que a declaração informa dessa mesma fonte, e que é o motivo do aviso:
    // 102.194,93 no código 09 (lucros e dividendos) e 4.396,57 no código 06.
    const porTipo = Object.fromEntries(a.outrosDaMesmaFonte.map(o => [o.tipo, o.valor]));
    expect(porTipo.isento_0009).toBeCloseTo(102194.93, 2);
    expect(porTipo.exclusivo_0006).toBeCloseTo(4396.57, 2);
    // Nenhum outro bem do contribuinte entra: a conta poupança de 122,08 que
    // também zerou fica abaixo do piso, e as demais aplicações têm rendimento
    // da própria fonte na ficha certa.
  }, 60000);

  it('não gera ruído na outra declaração, com 172 bens e nenhum caso', async () => {
    const d = await demonstrativoDoPdf(PDF_PATH);
    expect(d.aplicacoesSemRendimento).toEqual([]);
  }, 60000);
});

describe.skipIf(!temSegundoPdf)('parsePDF: Renda Variável com valores (segundo contribuinte)', () => {
  const lerPdf2 = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };

  it('lê os 12 meses do titular com o prejuízo a compensar de 99.811,07 arrastado', async () => {
    const r = await lerPdf2();
    const titular = r.rendaVariavelMensalOficial.filter(f => f.titular);
    expect(titular).toHaveLength(12);
    expect(titular.map(f => f.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);

    for (const ficha of titular) {
      expect(ficha.cpfDependente).toBeNull();
      // Nenhuma operação no ano: o resultado do mês é zero e o prejuízo de
      // anos anteriores atravessa os 12 meses sem ser consumido.
      expect(ficha.comuns.resultadoLiquidoMes).toBe(0);
      expect(ficha.comuns.resultadoNegativoMesAnterior).toBeCloseTo(99811.07, 2);
      expect(ficha.comuns.prejuizoCompensar).toBeCloseTo(99811.07, 2);
      expect(ficha.comuns.baseCalculoImposto).toBe(0);
      expect(ficha.comuns.impostoDevido).toBe(0);
      // Day-trade nunca herda o valor da coluna de operações comuns.
      expect(ficha.daytrade.prejuizoCompensar).toBe(0);
      expect(ficha.daytrade.resultadoNegativoMesAnterior).toBe(0);
      // Alíquotas legais de cada coluna, lidas do próprio formulário.
      expect(ficha.comuns.aliquota).toBe('15%');
      expect(ficha.daytrade.aliquota).toBe('20%');
      // As 9 linhas do bloco "CONSOLIDAÇÃO DO MÊS".
      expect(Object.keys(ficha.consolidacao)).toHaveLength(9);
      expect(ficha.consolidacao.totalImpostoDevido).toBe(0);
      expect(ficha.consolidacao.impostoPagar).toBe(0);
    }
    expect(r.rendaVariavelAnualOficial).toEqual(expect.objectContaining({
      origem: 'pdf', derivadoDosMeses: true,
    }));
    expect(r.rendaVariavelAnualOficial.prejuizoACompensar).toBeCloseTo(100056.47, 2);
    expect(r.rendaVariavelAnualOficial.resultadoLiquido).toBeCloseTo(-245.4, 2);
    expect(r.fiiFiagroAnualOficial).toBeNull();
    expect(r.estadoFichas['pdf:derivado-renda-variavel-anual']).toEqual(expect.objectContaining({
      estado: 'parcial', presenca: 'preenchida', derivado: true, completudeAuditada: false,
    }));
    // Uma consolidação anual de FII/Fiagro não é uma ficha impressa. Se o
    // documento não traz essa seção, o parser não deve inventar uma ficha
    // vazia nem confundir ausência com o texto oficial "Sem Informações".
    expect(r.estadoFichas['pdf:derivado-fii-fiagro-anual']).toBeUndefined();
  }, 60000);

  it('lê a ficha da dependente só a partir de julho, com a perda de 245,40 e o CPF dela', async () => {
    const r = await lerPdf2();
    const dep = r.rendaVariavelMensalOficial.filter(f => !f.titular);
    // Janeiro a junho vêm "Sem Informações" na declaração: não podem virar
    // ficha zerada, senão o app afirma um dado que a declaração não traz.
    expect(dep.map(f => f.mes)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(dep.every(f => f.cpfDependente === pessoal('dependente2Cpf'))).toBe(true);
    expect(r.fichasPdfObservadas['renda-variavel-dependentes'].presenca).toBe('preenchida');
    expect(r.estadoFichas['pdf:renda-variavel-dependentes']).toEqual(expect.objectContaining({
      estado: 'parcial', presenca: 'preenchida',
    }));

    const julho = dep.find(f => f.mes === 7);
    // Valor NEGATIVO: a perda tem que chegar com sinal, não em módulo.
    expect(julho.comuns.resultadoLiquidoMes).toBeCloseTo(-245.4, 2);
    expect(julho.comuns.opcoesAcoes).toBeCloseTo(-245.4, 2);
    expect(julho.comuns.resultadoNegativoMesAnterior).toBe(0);
    expect(julho.comuns.prejuizoCompensar).toBeCloseTo(245.4, 2);

    // A partir de agosto a perda de julho vira "resultado negativo até o mês
    // anterior" e segue arrastada até dezembro.
    for (const ficha of dep.filter(f => f.mes > 7)) {
      expect(ficha.comuns.resultadoLiquidoMes).toBe(0);
      expect(ficha.comuns.resultadoNegativoMesAnterior).toBeCloseTo(245.4, 2);
      expect(ficha.comuns.prejuizoCompensar).toBeCloseTo(245.4, 2);
    }
  }, 60000);
});

// A declaração que serviu para decifrar o .DBK tem as duas fichas de Renda
// Variável inteiras "Sem Informações" (os 12 meses do titular e a dos
// dependentes). Mês sem operação não pode virar ficha zerada: seria o app
// afirmando um dado que a declaração não traz. Este teste é o contraponto do
// bloco acima e vale como regressão do "Sem Informações".
describe.skipIf(!temArquivos)('parsePDF: Renda Variável inteiramente "Sem Informações"', () => {
  it('não inventa ficha mensal quando a declaração não tem operação nenhuma', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    expect(r.rendaVariavelMensalOficial).toEqual([]);
    // Na mesma página ficam as fichas de Fundos Imobiliários e as duas de
    // doação: a seção de Renda Variável tem que fechar antes delas, sem
    // contaminar nem ser contaminada.
    expect(r.doacoesEcaIdosoOficial).toEqual([]);
    // E o resto da declaração continua sendo lido como antes.
    expect(r.bens).toHaveLength(172);
    expect(r.pagamentos).toHaveLength(24);
  }, 60000);
});

// ---------------------------------------------------------------------------
// AUDITORIA CRUZADA: PDF contra .DBK, no único declarante que tem os dois
// arquivos. Este bloco não confere um valor específico, e sim que os DOIS
// CAMINHOS CONTINUAM CONCORDANDO em tudo que ambos leem.
//
// Vale como rede permanente porque foi exatamente este confronto que achou os
// três bugs reais de 23/08/2026, todos no caminho .DBK e todos invisíveis
// olhando um formato só: os nomes trocados na apuração do resultado rural (que
// exibia "Resultado Tributável R$ 2.404.237,00" onde a declaração informa
// R$ 0,00), a movimentação do rebanho lida ao contrário (rebanho aparecendo
// como encolhido de 125 para 29 cabeças quando cresceu de 29 para 125), e o
// valor de 24.751,74 que sumia da ficha de isentos.
//
// A comparação é por SOMA de cada campo numérico, e não item a item, porque as
// duas fontes legitimamente diferem em granularidade e em texto (ver os casos
// documentados abaixo). Soma diferente é defeito; formatação diferente, não.
describe.skipIf(!temArquivos)('auditoria cruzada: os dois caminhos têm que concordar', () => {
  const lerAmbos = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const rp = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
    const rd = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    return { rp, rd };
  };

  // Coleção -> campos numéricos cuja SOMA tem que bater entre os dois caminhos.
  const SOMAS = {
    bens: ['situacao_anterior', 'situacao_atual'],
    dividas: ['situacao_anterior', 'situacao_atual', 'valor_pago'],
    pagamentos: ['valor_pago', 'parcela_nao_dedutivel'],
    // `contribuicaoPrevidenciaria`, `decimoTerceiro` e `irrfDecimoTerceiro`
    // entraram aqui em 24/08/2026: o caminho PDF os trazia e o `.DBK` não, e a
    // auditoria não percebia porque comparava só `valor` e `irrf`. Toda
    // assimetria de campo entre os dois caminhos passa a aparecer nesta lista.
    rendimentos: ['valor', 'irrf', 'contribuicaoPrevidenciaria', 'decimoTerceiro', 'irrfDecimoTerceiro'],
    apuracaoGanhoCapital: ['custoAquisicao', 'valorAlienacao', 'ganhoCapital'],
    imoveisRurais: ['area', 'participacao'],
    bensRurais: ['situacao_anterior', 'situacao_atual'],
    dividasRurais: ['situacao_anterior', 'situacao_atual', 'valor_pago'],
    receitasDespesasRuraisOficial: ['receitaBruta', 'despesaCusteioInvestimento'],
    movimentacaoRebanhoOficial: ['estoqueInicial', 'aquisicoes', 'nascimentos', 'consumoPerdas', 'vendas', 'estoqueFinal'],
    demonstrativoExteriorOficial: ['ganhoPrejuizo', 'impostoDevido', 'impostoPagoBrasilExterior', 'baseCalculo', 'saldo'],
  };

  it('toda soma numérica bate entre PDF e .DBK, coleção por coleção', async () => {
    const { rp, rd } = await lerAmbos();
    const somar = (lista, campo) => (lista || []).reduce((s, x) => s + (typeof x[campo] === 'number' ? x[campo] : 0), 0);
    for (const [colecao, campos] of Object.entries(SOMAS)) {
      for (const campo of campos) {
        expect(
          `${colecao}.${campo}=${somar(rp[colecao], campo).toFixed(2)}`,
          `divergência de soma em ${colecao}.${campo}`,
        ).toBe(`${colecao}.${campo}=${somar(rd[colecao], campo).toFixed(2)}`);
      }
    }
  }, 60000);

  it('as contagens batem, exceto onde a diferença é conhecida e explicada', async () => {
    const { rp, rd } = await lerAmbos();
    // Mesma granularidade nos dois caminhos.
    for (const colecao of ['bens', 'dividas', 'pagamentos', 'dependentes', 'apuracaoGanhoCapital',
      'imoveisRurais', 'bensRurais', 'dividasRurais', 'receitasDespesasRuraisOficial',
      'movimentacaoRebanhoOficial', 'participantesRuraisOficial', 'demonstrativoExteriorOficial']) {
      expect(`${colecao}=${rp[colecao].length}`).toBe(`${colecao}=${rd[colecao].length}`);
    }

    // Rendimentos: até 23/08/2026 esta era uma diferença conhecida, porque o
    // .DBK só entregava o AGREGADO por código (registros 23/24) e o PDF o
    // detalhe por fonte pagadora. Deixou de ser: os registros 84/88, que
    // estavam sendo ignorados, trazem o mesmo detalhe. Agora os dois caminhos
    // têm a MESMA granularidade, e é isso que este teste passa a exigir.
    expect(rd.rendimentos).toHaveLength(rp.rendimentos.length);

    // Renda variável: até 24/08/2026 esta era uma "diferença conhecida", com o
    // .DBK trazendo 12 meses e o PDF nenhum. Não era diferença de formato, era
    // BUG: o parser lia o registro 76 (ganho de capital em moeda estrangeira)
    // como se fosse renda variável. Corrigido, os dois concordam — esta
    // declaração não tem renda variável nenhuma.
    expect(rd.rendaVariavelMensalOficial).toEqual([]);
    expect(rp.rendaVariavelMensalOficial).toEqual([]);
  }, 60000);

  it('os pagamentos batem um a um, inclusive os dois do mesmo beneficiário', async () => {
    const { rp, rd } = await lerAmbos();
    // A chave é CNPJ + valor, e não só o CNPJ: esta declaração tem DOIS
    // pagamentos ao mesmo consultório (700,00 e 790,00), com descrições
    // diferentes. Indexar só pelo documento compara o primeiro de um lado com
    // o primeiro do outro e inventa divergência onde não há.
    const chave = (x) => `${x.cpf_cnpj}|${x.valor_pago.toFixed(2)}`;
    const doDbk = Object.fromEntries(rd.pagamentos.map(x => [chave(x), x]));
    for (const x of rp.pagamentos) {
      const par = doDbk[chave(x)];
      expect(par, `pagamento ${chave(x)} não tem par no .DBK`).toBeTruthy();
      for (const campo of ['codigo', 'nome_beneficiario', 'descricao', 'parcela_nao_dedutivel']) {
        expect(`${chave(x)}.${campo}=${x[campo]}`).toBe(`${chave(x)}.${campo}=${par[campo]}`);
      }
    }
  }, 60000);

  it('o vínculo participante-imóvel é o MESMO nos dois caminhos', async () => {
    const { rp, rd } = await lerAmbos();
    // Desde 24/08/2026 os dois caminhos entregam esse vínculo: o PDF pelo
    // aninhamento impresso, o .DBK pela chave NR_CHAVE_AR. Se divergirem, um
    // dos dois está lendo errado — e este é o teste que avisa.
    const semAcento = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    for (const doDbk of rd.participantesRuraisOficial) {
      const doPdf = rp.participantesRuraisOficial.find(x => x.cpf === doDbk.cpf);
      expect(doPdf, `participante ${doDbk.cpf} não veio do PDF`).toBeTruthy();
      expect(semAcento(doPdf.imovelNome)).toBe(semAcento(doDbk.imovelNome));
    }
    // E o nome do imóvel também ficou idêntico, agora que o .DBK lê nome e
    // localização como campos separados.
    rd.imoveisRurais.forEach((doDbk, i) => {
      expect(semAcento(rp.imoveisRurais[i].nomeLocalizacao)).toBe(semAcento(doDbk.nomeLocalizacao));
    });
  }, 60000);

  it('o objeto do Resumo bate campo a campo, e o do imóvel com CIB repetido sobrevive', async () => {
    const { rp, rd } = await lerAmbos();
    for (const campo of Object.keys(rd.impostoDevido)) {
      if (campo === 'origem' || campo === 'modeloDeclaracao') continue;
      expect(`${campo}=${rp.impostoDevido[campo].toFixed(2)}`).toBe(`${campo}=${rd.impostoDevido[campo].toFixed(2)}`);
    }
    // O CIB não é chave: dois imóveis diferentes compartilham 2639188-0.
    // Casados por posição, os dois lados entregam os mesmos dois imóveis.
    const pdfCib = rp.imoveisRurais.filter(x => x.cib === '2639188-0');
    const dbkCib = rd.imoveisRurais.filter(x => x.cib === '2639188-0');
    expect(pdfCib).toHaveLength(2);
    expect(pdfCib.map(x => `${x.area}|${x.condicaoExploracao}`))
      .toEqual(dbkCib.map(x => `${x.area}|${x.condicaoExploracao}`));
  }, 60000);
});

// ---------------------------------------------------------------------------
// REDE CONTRA FICHA NÃO LIDA. Ficha que existe na declaração e que o parser não
// lê tem que FECHAR a seção anterior: sem isso a seção segue aberta e engole o
// conteúdo dela como se fosse seu. Foi assim que as duas fichas de doação
// ECA/Pessoa Idosa ficaram sendo engolidas pelo anexo rural, e o defeito só
// apareceu porque alguém foi conferir — nos arquivos de referência elas estão
// vazias, então o erro era invisível.
//
// Pelo mesmo motivo este teste usa um PDF SINTÉTICO: nas duas declarações reais
// TODAS as fichas não lidas estão "Sem Informações", e um teste contra elas
// passaria mesmo com a rede desligada. A fixture reproduz duas situações de
// risco com dado dentro.
describe('parsePDF: ficha não lida não pode contaminar a seção anterior', () => {
  const FIXTURE = new URL('./__fixtures__/fichas-nao-lidas.pdf', import.meta.url);
  const lerFixture = async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(FIXTURE));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
  };

  it('rendimento com exigibilidade suspensa não entra como rendimento tributável', async () => {
    const r = await lerFixture();
    // Cenário exato do risco: a ficha de rendimentos de PJ (que É lida) e,
    // logo abaixo, a ficha "(IMPOSTO COM EXIGIBILIDADE SUSPENSA)" com o MESMO
    // layout de colunas. A linha "TOTAL" fecha o item corrente mas não a seção,
    // então a segunda ficha precisa ser barrada por título — imposto com
    // exigibilidade suspensa está em discussão judicial, não é rendimento
    // recebido, e não pode somar no total do contribuinte.
    //
    // Quem barra ESTE caso hoje é o bloco de fechamento genérico, que casa
    // qualquer título começando com "RENDIMENTOS", e não a lista
    // FICHAS_NAO_LIDAS (conferido desligando a lista: este teste continua
    // passando, e só o do rebanho do exterior quebra). O teste fica porque o
    // comportamento é o exigido, venha ele de onde vier — se um dia alguém
    // mexer no regex genérico, é aqui que vai aparecer.
    const pj = r.rendimentos.filter(x => x.tipo === 'tributavel_pj');
    expect(pj).toHaveLength(1);
    expect(pj[0].valor).toBeCloseTo(1000, 2);
    expect(pj[0].nome_fonte).toBe('EMPRESA NORMAL LTDA');
    expect(r.rendimentos.some(x => x.valor === 7777.77)).toBe(false);
    expect(r.rendimentos.some(x => x.cnpj_fonte === '99999999000199')).toBe(false);
  }, 30000);

  it('rebanho do EXTERIOR não entra junto com o do Brasil', async () => {
    const r = await lerFixture();
    // As duas fichas têm o mesmo layout e o mesmo nome de espécie. Um gatilho
    // por prefixo ("MOVIMENTAÇÃO DO REBANHO") casaria as duas e somaria os
    // dois rebanhos — era assim antes de 23/08/2026.
    expect(r.movimentacaoRebanhoOficial).toHaveLength(1);
    const bovinos = r.movimentacaoRebanhoOficial[0];
    expect(bovinos.estoqueInicial).toBe(10);
    expect(bovinos.aquisicoes).toBe(5);
    expect(bovinos.vendas).toBe(2);
    expect(bovinos.estoqueFinal).toBe(14);
    // A equação da ficha continua fechando com os valores do Brasil sozinhos.
    expect(bovinos.estoqueInicial + bovinos.aquisicoes + bovinos.nascimentos - bovinos.consumoPerdas - bovinos.vendas)
      .toBeCloseTo(bovinos.estoqueFinal, 2);
    // E nenhum valor do exterior vazou.
    expect(JSON.stringify(r.movimentacaoRebanhoOficial)).not.toContain('900');
  }, 30000);
});

// Aviso de ficha não lida COM conteúdo. Fechar a seção protege os números, mas
// deixa a pessoa sem saber que um pedaço da declaração não entrou. Este bloco
// cobre a diferença entre "a ficha está vazia na sua declaração" (silêncio
// correto) e "a ficha tem dado que o app não importou" (aviso obrigatório).
describe('parsePDF: avisa quando uma ficha não lida vem PREENCHIDA', () => {
  const FIXTURE = new URL('./__fixtures__/fichas-nao-lidas.pdf', import.meta.url);
  const lerFixture = async (log) => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(FIXTURE));
    return parsePDF(await pdfjsLib.getDocument({ data }).promise, log);
  };

  it('reporta as duas fichas preenchidas da fixture, e só elas', async () => {
    const r = await lerFixture();
    // A fixture tem a ficha "(IMPOSTO COM EXIGIBILIDADE SUSPENSA)" com
    // 7.777,77 e o "MOVIMENTAÇÃO DO REBANHO - EXTERIOR" com 900 cabeças.
    expect(r.fichasNaoLidasComConteudo).toContain('MOVIMENTAÇÃO DO REBANHO - EXTERIOR');
    expect(r.fichasNaoLidasComConteudo).toContain('RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM EXIGIBILIDADE SUSPENSA)');
    expect(r.fichasNaoLidasComConteudo).toHaveLength(2);
    expect(r.estadoFichas['pdf:rural-exterior-rebanho']).toEqual(expect.objectContaining({
      estado: 'nao_suportada', formato: 'pdf',
    }));
    // E o aviso chega ao log da tela de importação, não fica só no objeto.
    const avisos = [];
    await lerFixture((msg, tipo) => { if (tipo === 'warning') avisos.push(msg); });
    expect(avisos.some(m => m.includes('REBANHO - EXTERIOR') && m.includes('NÃO foi importada'))).toBe(true);
  }, 30000);

  it('o aviso não rouba o dado: o que É lido continua sendo lido', async () => {
    const r = await lerFixture();
    // Observar a ficha não lida não pode atrapalhar as seções vizinhas.
    expect(r.rendimentos.filter(x => x.tipo === 'tributavel_pj')).toHaveLength(1);
    expect(r.movimentacaoRebanhoOficial).toHaveLength(1);
    expect(r.movimentacaoRebanhoOficial[0].estoqueFinal).toBe(14);
  }, 30000);
});

describe.skipIf(!temArquivos)('parsePDF: declaração real não gera aviso falso', () => {
  it('nenhuma ficha não lida das duas declarações reais é reportada como preenchida', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    for (const caminho of [PDF_PATH, PDF2_PATH]) {
      const data = new Uint8Array(await readFile(caminho));
      const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);
      // Nos dois arquivos TODAS as fichas não lidas estão "Sem Informações".
      // Um aviso aqui seria falso positivo, e o custo de um aviso falso num app
      // de conferência é alto: manda a pessoa procurar um dado que não existe.
      expect(r.fichasNaoLidasComConteudo, `aviso falso em ${caminho}`).toEqual([]);
    }
  }, 60000);
});

// Extensões OFICIAIS do programa da Receita, conferidas na classe
// `ConstantesGlobais` do IRPF 2026: `.DEC` (arquivo da declaração), `.DBK`
// (cópia de segurança), `.F2B` (backup do ano anterior) e `.REC` (recibo).
//
// Os três primeiros são gravados pelo mesmo componente e têm o mesmo layout de
// registros, que é o que este parser lê — daí o mesmo `parseDBK` servir para os
// três. O `.REC` é só o recibo de entrega e não é declaração.
describe.skipIf(!temArquivos)('o mesmo parser serve para .DEC, .DBK e .F2B', () => {
  it('o conteúdo é que decide, não a extensão do arquivo', async () => {
    // parseDBK recebe TEXTO, não arquivo: a extensão nunca chega até aqui, e é
    // por isso que os três formatos podem compartilhar o parser. Este teste
    // fixa esse contrato — se alguém passar a ramificar por extensão dentro do
    // parser, ele quebra.
    const texto = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(texto);
    expect(r.formato).toBe('dbk');
    esperaPessoal(r.contribuinte.cpf, 'titularCpf');
    expect(r.bens).toHaveLength(172);
  });

  it('conteúdo que não é declaração não vira importação silenciosa', async () => {
    // Um arquivo com a extensão certa e conteúdo errado (renomeado, corrompido)
    // não pode produzir uma declaração vazia com cara de válida.
    const avisos = [];
    const r = await parseDBK('isto nao e uma declaracao\noutra linha qualquer\n', (m, n) => {
      if (n === 'warning' || n === 'error') avisos.push(m);
    });
    expect(r.bens).toEqual([]);
    expect(r.contribuinte.cpf).toBe('');
    expect(avisos.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Regressões da auditoria independente de 24/08/2026.
// ---------------------------------------------------------------------------

describe.skipIf(!temArquivos)('achado 14: a quem o bem pertence (registro 27)', () => {
  it('lê os SEIS bens da dependente, que vinham todos marcados como do Titular', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const doDependente = r.bens.filter(b => b.beneficiario === 'Dependente');
    expect(r.bens).toHaveLength(172);
    expect(doDependente).toHaveLength(6);
    // Todos apontam para a MESMA dependente, a única da declaração (registro 25).
    const cpfs = [...new Set(doDependente.map(b => b.cpf_beneficiario))];
    expect(cpfs).toHaveLength(1);
    expect(cpfs[0]).toBe(r.dependentes[0].cpf);
    // E os outros 166 continuam do titular, sem CPF de beneficiário.
    expect(r.bens.filter(b => b.beneficiario === 'Titular')).toHaveLength(166);
  });

  it('as posições continuam certas com o registro na largura OFICIAL (com NM_PAIS)', async () => {
    // O arquivo real omite NM_PAIS e a linha tem 1251 caracteres; o layout
    // oficial prevê 1291. O parser deriva o deslocamento do comprimento, então
    // os dois formatos leem igual. Achado 18.
    const texto = await readFile(DBK_PATH, 'latin1');
    const linhas = texto.split(/\r\n/).filter(l => l.trim());
    const comPais = linhas.map(l => (l.startsWith('27')
      ? `${l.slice(0, 19)}${' '.repeat(40)}${l.slice(19)}`
      : l));
    const r = await parseDBK(comPais.join('\r\n'));
    expect(r.bens).toHaveLength(172);
    expect(r.bens.reduce((s, b) => s + b.situacao_atual, 0)).toBeCloseTo(137977220.38, 2);
    expect(r.bens.filter(b => b.beneficiario === 'Dependente')).toHaveLength(6);
  });
});

describe.skipIf(!temArquivos)('achado 07: IRRF sobre o 13º salário chega ao rendimento exclusivo', () => {
  it('.DBK: o exclusivo do 13º entra com o IRRF que a ficha de PJ informa', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const decimoTerceiro = r.rendimentos.find(x => x.tipo === 'exclusivo_0001');
    expect(decimoTerceiro.valor).toBeCloseTo(3573.29, 2);
    // A própria declaração informa 59,70 de IRRF sobre o 13º, e o valor da
    // ficha de exclusivos é o BRUTO (Ajuda oficial, aba Totais, linha 01).
    expect(decimoTerceiro.irrf).toBeCloseTo(59.70, 2);
  });

  it('o IRRF do 13º não é somado duas vezes quando há mais de uma fonte pagadora', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    const totalIrrf13 = r.rendimentos
      .filter(x => x.tipo === 'exclusivo_0001' || x.tipo === 'exclusivo_0008')
      .reduce((s, x) => s + (x.irrf || 0), 0);
    expect(totalIrrf13).toBeCloseTo(59.70, 2);
  });
});

describe.skipIf(!temArquivos)('achado 08: divergência entre detalhe e agregado não passa em silêncio', () => {
  it('avisa quando a soma do detalhe por fonte não fecha com o total do código', async () => {
    const texto = await readFile(DBK_PATH, 'latin1');
    const linhas = texto.split(/\r\n/).filter(l => l.trim());
    const i84 = linhas.findIndex(l => l.startsWith('84'));
    // Zera o valor de UM detalhe: o agregado do registro 23 continua dizendo o
    // total cheio, e a diferença tem que virar aviso.
    const adulterado = linhas[i84].slice(0, 103) + '0000000000000' + linhas[i84].slice(116);
    const avisos = [];
    await parseDBK(linhas.map((l, k) => (k === i84 ? adulterado : l)).join('\r\n'),
      (msg, nivel) => avisos.push([nivel || 'info', msg]));
    const warnings = avisos.filter(a => a[0] === 'warning').map(a => a[1]);
    expect(warnings.some(m => /Conferência da ficha de rendimentos/.test(m))).toBe(true);
  });

  it('o arquivo íntegro não gera nenhum aviso de conferência', async () => {
    const avisos = [];
    await parseDBK(await readFile(DBK_PATH, 'latin1'), (msg, nivel) => avisos.push([nivel || 'info', msg]));
    const warnings = avisos.filter(a => a[0] === 'warning').map(a => a[1]);
    expect(warnings.filter(m => /Conferência da ficha de rendimentos/.test(m))).toHaveLength(0);
  });
});

describe('achado 19: normalizarCpfCnpj com preenchimento em branco', () => {
  it('CNPJ cujo preenchimento veio em espaços não perde os três primeiros dígitos', () => {
    // O campo tem 19 posições; com preenchimento em branco, o trim de field()
    // devolve só os 14 dígitos do CNPJ. A regra antiga classificava isso como
    // CPF e cortava em 11.
    expect(normalizarCpfCnpj('     12345678000199')).toBe('12345678000199');
  });
  it('continua lendo o CPF com preenchimento NUMÉRICO, que é o caso do arquivo real', () => {
    expect(normalizarCpfCnpj('0000111144477735')).toBe('11144477735');
  });
  it('continua lendo o CNPJ com preenchimento numérico', () => {
    expect(normalizarCpfCnpj('0000112345678000199')).toBe('12345678000199');
  });
});

describe.skipIf(!temArquivos)('achado 05: RRA que a declaração informa duas vezes', () => {
  it('marca o RRA como já contado quando o valor bate com o código 0007 dos exclusivos', async () => {
    const texto = await readFile(DBK_PATH, 'latin1');
    const linhas = texto.split(/\r\n/).filter(l => l.trim());
    const cpf = '11144477735';
    const n13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const rra = '45' + cpf + '  ' + '12345678000199' + 'FONTE RRA TESTE'.padEnd(60)
      + n13(120000) + n13(10000) + n13(0) + n13(5000) + '12' + '00001' + ' ' + '1' + '0024'
      + n13(5000) + n13(0) + n13(105000) + n13(3000) + '0000000001';
    const agregado = '24' + cpf + '0007' + n13(105000) + '0000000002';
    const avisos = [];
    const r = await parseDBK([...linhas, rra, agregado].join('\r\n'),
      (msg, nivel) => avisos.push([nivel || 'info', msg]));
    const doRra = r.rendimentos.find(x => x.tipo === 'tributavel_rra');
    expect(doRra.valor).toBeCloseTo(105000, 2);
    expect(doRra.naoSomar).toBe(true);
    expect(avisos.filter(a => a[0] === 'warning').some(a => /já entra por lá/.test(a[1]))).toBe(true);
  });

  it('RRA de valor DIFERENTE do exclusivo continua somando normalmente', async () => {
    const texto = await readFile(DBK_PATH, 'latin1');
    const linhas = texto.split(/\r\n/).filter(l => l.trim());
    const cpf = '11144477735';
    const n13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const rra = '45' + cpf + '  ' + '12345678000199' + 'FONTE RRA TESTE'.padEnd(60)
      + n13(120000) + n13(10000) + n13(0) + n13(5000) + '12' + '00001' + ' ' + '2' + '0024'
      + n13(5000) + n13(0) + n13(105000) + n13(3000) + '0000000001';
    const r = await parseDBK([...linhas, rra].join('\r\n'));
    const doRra = r.rendimentos.find(x => x.tipo === 'tributavel_rra');
    expect(doRra.naoSomar).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GANHOS DE CAPITAL (as quatro fichas do menu do programa da Receita) e RENDA
// VARIÁVEL (as duas fichas), pelos DOIS caminhos de importação.
//
// A declaração de referência só tem operações de BEM MÓVEL, e as fichas de
// imóvel, participação societária, moedas em espécie, FII/Fiagro e o
// fechamento anual da renda variável nunca apareceram preenchidas em arquivo
// real. Para essas, o teste monta a linha do registro no LAYOUT OFICIAL
// (mapeamentoTxt.xml do próprio IRPF2026) e confere que cada valor cai no
// campo certo — que é exatamente o risco de um layout posicional: um campo
// deslocado passa despercebido até alguém conferir número a número.
describe('Ganhos de Capital e Renda Variável: layout dos registros', () => {
  const pad = (t, n) => String(t).padEnd(n).slice(0, n);
  const num = (v, n) => String(Math.round(v * 100)).padStart(n, '0');       // N13.2
  const numDec = (v, n, casas) => String(Math.round(v * Math.pow(10, casas))).padStart(n, '0');
  const CPF = '11144477735';

  // Registro 61: bem imóvel. Monta por posição absoluta, do jeito que o
  // arquivo é: cada campo escrito na sua coluna, o resto em branco.
  const registro61 = () => {
    const buf = new Array(926).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '61'); put(3, CPF); put(14, CPF); put(25, '01013112'); put(33, '0001'); put(37, '1');
    put(38, pad('APARTAMENTO 101 EDIFICIO SOL', 152));
    put(190, pad('RUA', 15)); put(205, pad('DAS FLORES', 40)); put(245, pad('100', 6));
    put(272, pad('CENTRO', 20)); put(292, pad('30140000', 9)); put(305, pad('BELO HORIZONTE', 40)); put(345, 'MG');
    put(410, '15032010'); put(418, num(300000, 13));
    put(431, '0'); put(432, '0'); put(433, '1'); put(434, '0'); put(435, '1'); put(436, '2');
    put(437, num(0, 13));
    put(450, '01'); put(452, pad('VENDA', 70));
    put(522, '0'); put(523, '20062025');
    put(555, '0'); put(556, num(800000, 13)); put(569, num(24000, 13)); put(582, num(0, 13));
    put(595, '0'); put(596, num(0, 13));
    put(648, num(476000, 13)); put(661, numDec(15, 9, 6)); put(670, num(71400, 13)); put(683, num(71400, 13));
    put(748, num(0, 13)); put(761, num(71400, 13)); put(774, num(71400, 13)); put(787, num(0, 13));
    put(800, num(71400, 13)); put(813, num(0, 13)); put(826, num(71400, 13));
    put(839, num(0, 13)); put(852, num(476000, 13));
    put(895, '0'); put(896, num(0, 13));
    return buf.join('');
  };
  // Registro 68: apuração do ganho do imóvel, com as reduções.
  const registro68 = () => {
    const buf = new Array(335).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '68'); put(3, CPF); put(14, CPF); put(25, '01013112'); put(33, '0001'); put(37, '1');
    put(38, num(800000, 13)); put(51, num(24000, 13)); put(64, num(776000, 13)); put(77, num(0, 13));
    put(90, num(300000, 13)); put(103, num(476000, 13)); put(116, num(0, 13));
    put(129, numDec(0, 9, 6)); put(138, num(0, 13)); put(151, num(476000, 13));
    put(164, numDec(0, 9, 6)); put(173, num(0, 13)); put(186, num(476000, 13));
    put(199, numDec(0, 9, 6)); put(208, num(0, 13)); put(221, num(476000, 13));
    put(300, num(476000, 13)); put(313, numDec(0, 13, 4));
    return buf.join('');
  };
  // Registro 63: participação societária, com apuração embutida.
  const registro63 = () => {
    const buf = new Array(876).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '63'); put(3, CPF); put(14, CPF); put(25, '01013112'); put(33, '0002');
    put(37, pad('PADARIA DO BAIRRO LTDA', 152));
    put(189, '11222333000181'); put(203, '4123'); put(207, pad('CONTAGEM', 40)); put(247, 'MG');
    put(249, '01'); put(251, pad('VENDA', 70));
    put(321, '3'); put(322, pad('QUOTAS', 90));
    put(412, '0'); put(413, '10112025');
    put(445, '0'); put(446, num(150000, 13)); put(459, num(0, 13)); put(472, '0'); put(473, '0'); put(474, num(0, 13));
    put(487, num(150000, 13)); put(500, num(0, 13)); put(513, num(150000, 13)); put(526, num(50000, 13)); put(539, num(100000, 13));
    put(591, num(100000, 13)); put(604, numDec(15, 9, 6)); put(613, num(15000, 13)); put(626, num(0, 13));
    put(639, num(15000, 13)); put(652, num(15000, 13));
    put(834, num(50000, 13));
    return buf.join('');
  };
  // Registro 65: adquirente, com o indicador de tipo na posição 37.
  const registro65 = (tipo, operacao, doc, nome) => {
    const buf = new Array(121).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '65'); put(3, CPF); put(14, CPF); put(25, '01013112'); put(33, operacao); put(37, tipo);
    put(38, pad(doc, 14)); put(52, pad(nome, 60));
    return buf.join('');
  };
  // Registro 74: moeda estrangeira em espécie (uma venda).
  const registro74 = () => {
    const buf = new Array(299).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '74'); put(3, CPF); put(14, CPF); put(25, '01013112'); put(33, '0001');
    put(37, pad('USD', 7)); put(44, pad('DOLAR DOS ESTADOS UNIDOS', 40));
    put(84, '3'); put(85, pad('Venda', 15));
    put(100, pad('CASA DE CAMBIO XYZ LTDA', 60)); put(160, pad('11222333000181', 14));
    put(174, '15082025'); put(182, num(60000, 13)); put(195, num(10000, 13));
    put(208, numDec(4.5, 17, 6)); put(225, num(45000, 13)); put(238, num(15000, 13));
    put(251, num(0, 13)); put(264, num(0, 13)); put(277, numDec(1, 13, 4));
    return buf.join('');
  };
  // Registro 42: FII/Fiagro mês a mês.
  const registro42 = (mes) => {
    const buf = new Array(170).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '42'); put(3, CPF); put(14, String(mes).padStart(2, '0'));
    put(16, num(2500, 13)); put(29, num(0, 13)); put(42, num(2500, 13)); put(55, num(0, 13));
    put(68, '020'); put(71, num(500, 13)); put(84, num(0, 13)); put(97, num(120, 13));
    put(110, num(0, 13)); put(123, num(380, 13)); put(136, num(380, 13)); put(149, 'N');
    return buf.join('');
  };
  // Registro 41 e 43: fechamentos anuais.
  const registro41 = () => {
    const buf = new Array(153).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '41'); put(3, CPF);
    put(14, num(9000, 13)); put(27, num(1000, 13)); put(40, num(8000, 13)); put(53, num(0, 13));
    put(66, num(1200, 13)); put(79, num(1200, 13)); put(92, num(0, 13)); put(105, num(0, 13));
    put(118, num(50, 13)); put(131, num(1150, 13));
    return buf.join('');
  };
  const registro43 = () => {
    const buf = new Array(114).fill(' ');
    const put = (pos, texto) => { for (let i = 0; i < texto.length; i++) buf[pos - 1 + i] = texto[i]; };
    put(1, '43'); put(3, CPF);
    put(14, num(30000, 13)); put(27, num(0, 13)); put(40, num(30000, 13)); put(53, num(0, 13));
    put(66, num(6000, 13)); put(79, num(4560, 13)); put(92, num(1440, 13));
    return buf.join('');
  };

  it('lê a ficha de BENS IMÓVEIS inteira, com endereço, perguntas, reduções e consolidação', async () => {
    const texto = [registro61(), registro68(), registro65('1', '0001', '09735390620', 'MARIA DA SILVA')].join('\r\n');
    const r = await parseDBK(texto);

    expect(r.ganhosCapitalOficial.operacoes).toHaveLength(1);
    const op = r.ganhosCapitalOficial.operacoes[0];
    expect(op.tipo).toBe('imovel');
    expect(op.especificacao).toBe('APARTAMENTO 101 EDIFICIO SOL');
    expect(op.endereco.logradouro).toBe('DAS FLORES');
    expect(op.endereco.municipio).toBe('BELO HORIZONTE');
    expect(op.endereco.uf).toBe('MG');
    expect(op.dataAquisicao).toBe('2010-03-15');
    expect(op.custoAquisicao).toBeCloseTo(300000, 2);
    expect(op.dataAlienacao).toBe('2025-06-20');
    expect(op.valorAlienacao).toBeCloseTo(800000, 2);
    expect(op.custoCorretagem).toBeCloseTo(24000, 2);
    expect(op.natureza).toEqual({ codigo: '01', descricao: 'VENDA' });
    // A pergunta do conjunto de bens é gravada INVERTIDA em relação ao texto
    // impresso ("0" no arquivo = "Sim" na ficha) — ver o comentário no parser.
    expect(op.perguntas.conjuntoSuperiorA35Mil).toBe(true);
    expect(op.perguntas.possuiOutroImovel).toBe(true);
    expect(op.perguntas.outraAlienacaoUltimos5Anos).toBe(false);
    expect(op.perguntas.imovelResidencial).toBe(true);
    // Apuração vem do registro 68, com o ganho já líquido das reduções.
    expect(op.apuracao.valorLiquido).toBeCloseTo(776000, 2);
    expect(op.apuracao.ganhoCapital).toBeCloseTo(476000, 2);
    expect(op.apuracao.reducoes.ganhoTributavel).toBeCloseTo(476000, 2);
    // Alíquota é N9.6: 15% e não 150.000,00 (seria o erro de ler como N13.2).
    expect(op.calculoImposto.aliquotaMedia).toBeCloseTo(15, 6);
    expect(op.calculoImposto.impostoDevido).toBeCloseTo(71400, 2);
    expect(op.consolidacaoBem.rendimentoExclusivo).toBeCloseTo(476000, 2);
    expect(op.adquirentes).toEqual([{ cpfCnpj: '09735390620', nome: 'MARIA DA SILVA' }]);

    // E o resumo que o resto do app consome sai coerente com isso.
    expect(r.apuracaoGanhoCapital[0].ganhoCapital).toBeCloseTo(476000, 2);
    expect(r.apuracaoGanhoCapital[0].impostoDevido).toBeCloseTo(71400, 2);
  });

  it('lê a ficha de PARTICIPAÇÕES SOCIETÁRIAS, com a apuração que vem no próprio registro', async () => {
    const r = await parseDBK([registro63(), registro65('3', '0002', '11222333000181', 'COMPRADOR LTDA')].join('\r\n'));

    const op = r.ganhosCapitalOficial.operacoes[0];
    expect(op.tipo).toBe('participacao');
    expect(op.sociedade.nome).toBe('PADARIA DO BAIRRO LTDA');
    expect(op.sociedade.cnpj).toBe('11222333000181');
    expect(op.sociedade.municipio).toBe('CONTAGEM');
    expect(op.especie).toEqual({ codigo: '3', descricao: 'QUOTAS' });
    expect(op.apuracao.custoAquisicao).toBeCloseTo(50000, 2);
    expect(op.apuracao.ganhoCapital).toBeCloseTo(100000, 2);
    expect(op.calculoImposto.impostoDevidoAposCompensacao).toBeCloseTo(15000, 2);
    expect(op.custoTotalAquisicaoConsolidado).toBeCloseTo(50000, 2);
    expect(op.adquirentes[0].nome).toBe('COMPRADOR LTDA');
  });

  it('não mistura operações de fichas diferentes que tenham o mesmo número', async () => {
    // Imóvel 0001 e móvel 0001 coexistem numa declaração real. O vínculo dos
    // adquirentes é (tipo + número), não a ordem das linhas: sem o tipo, o
    // adquirente do móvel entraria no imóvel.
    const texto = [
      registro61(),
      registro65('1', '0001', '09735390620', 'COMPRADOR DO IMOVEL'),
      registro65('2', '0001', '11222333000181', 'COMPRADOR DO CARRO'),
    ].join('\r\n');
    const r = await parseDBK(texto);
    const imovel = r.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'imovel');
    const movel = r.ganhosCapitalOficial.operacoes.find(o => o.tipo === 'movel');
    expect(imovel.adquirentes.map(a => a.nome)).toEqual(['COMPRADOR DO IMOVEL']);
    expect(movel.adquirentes.map(a => a.nome)).toEqual(['COMPRADOR DO CARRO']);
  });

  it('lê a ficha de MOEDAS EM ESPÉCIE', async () => {
    const r = await parseDBK(registro74());
    const moeda = r.ganhosCapitalOficial.moedaEspecie.operacoes[0];
    expect(moeda.moeda).toBe('DOLAR DOS ESTADOS UNIDOS');
    expect(moeda.tipoOperacaoDescricao).toBe('Venda');
    expect(moeda.data).toBe('2025-08-15');
    expect(moeda.valor).toBeCloseTo(60000, 2);
    expect(moeda.quantidade).toBeCloseTo(10000, 2);
    // Custo médio é N17.6: 4,50 por dólar, não 45.000.000,00.
    expect(moeda.custoMedio).toBeCloseTo(4.5, 6);
    expect(moeda.custoTotal).toBeCloseTo(45000, 2);
    expect(moeda.ganhoCapital).toBeCloseTo(15000, 2);
    expect(moeda.adquirenteCpfCnpj).toBe('11222333000181');
  });

  it('lê as duas fichas de RENDA VARIÁVEL: FII/Fiagro mês a mês e os fechamentos anuais', async () => {
    const r = await parseDBK([registro42(3), registro42(4), registro41(), registro43()].join('\r\n'));

    expect(r.fiiFiagroMensalOficial).toHaveLength(2);
    const marco = r.fiiFiagroMensalOficial.find(m => m.mes === 3);
    expect(marco.titular).toBe(true);
    expect(marco.resultadoLiquidoMes).toBeCloseTo(2500, 2);
    expect(marco.baseCalculoImposto).toBeCloseTo(2500, 2);
    // Alíquota do FII vem como inteiro de 3 dígitos no arquivo.
    expect(marco.aliquota).toBe('20%');
    expect(marco.impostoDevido).toBeCloseTo(500, 2);
    expect(marco.impostoRetidoNoMes).toBeCloseTo(120, 2);
    expect(marco.impostoAPagar).toBeCloseTo(380, 2);

    expect(r.rendaVariavelAnualOficial.resultadoLiquido).toBeCloseTo(9000, 2);
    expect(r.rendaVariavelAnualOficial.baseCalculo).toBeCloseTo(8000, 2);
    expect(r.rendaVariavelAnualOficial.consolidacaoImpostoAPagar).toBeCloseTo(1150, 2);

    expect(r.fiiFiagroAnualOficial.resultadoLiquido).toBeCloseTo(30000, 2);
    expect(r.fiiFiagroAnualOficial.impostoDevido).toBeCloseTo(6000, 2);
    expect(r.fiiFiagroAnualOficial.impostoRetidoLei11033).toBeCloseTo(1440, 2);
  });

  it('não inventa ficha de Ganhos de Capital numa declaração que não tem nenhuma', async () => {
    const r = await parseDBK('16' + '11144477735' + ' '.repeat(900));
    expect(r.ganhosCapitalOficial).toBeNull();
    expect(r.apuracaoGanhoCapital).toEqual([]);
    expect(r.fiiFiagroMensalOficial).toEqual([]);
    expect(r.rendaVariavelAnualOficial).toBeNull();
  });
});

describe.skipIf(!temArquivos)('Ganhos de Capital: arquivo real', () => {
  it('lê as 3 operações de bem móvel com apuração, adquirente e a ficha de moedas', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));

    expect(r.ganhosCapitalOficial.operacoes).toHaveLength(3);
    expect(r.ganhosCapitalOficial.operacoes.every(o => o.tipo === 'movel')).toBe(true);
    const jeep = r.ganhosCapitalOficial.operacoes.find(o => o.especificacao.startsWith('JEEP'));
    expect(jeep.dataAquisicao).toBe('2022-05-22');
    expect(jeep.custoAquisicao).toBeCloseTo(269655.86, 2);
    expect(jeep.dataAlienacao).toBe('2025-02-07');
    expect(jeep.valorAlienacao).toBeCloseTo(199000, 2);
    expect(jeep.sujeitoRegistroPublico).toBe(true);
    expect(jeep.alienacaoAPrazo).toBe(false);
    expect(jeep.adquirentes).toHaveLength(1);
    esperaPessoal(jeep.adquirentes[0].cpfCnpj, 'jeepAdquirenteCpf');
    esperaPessoal(jeep.adquirentes[0].nome, 'jeepAdquirenteNome');
    // Venda com prejuízo: a declaração apura ganho ZERO, não negativo.
    expect(jeep.apuracao.ganhoCapital).toBe(0);
    expect(jeep.apuracao.custoAquisicao).toBeCloseTo(269655.86, 2);
    // O cabeçalho do demonstrativo (registro 60) traz o período e o país.
    expect(r.ganhosCapitalOficial.consolidacao.periodoInicio).toBe('2025-01-01');
    expect(r.ganhosCapitalOficial.consolidacao.periodoFim).toBe('2025-12-31');
    expect(r.ganhosCapitalOficial.consolidacao.pais).toBe('BRASIL');
    // Ficha de moedas: 12 meses zerados (a declaração não tem alienação de
    // moeda), com a alíquota de 15% que o próprio programa grava.
    expect(r.ganhosCapitalOficial.moedaEspecie.mensal).toHaveLength(12);
    expect(r.ganhosCapitalOficial.moedaEspecie.mensal.every(m => m.ganhoCapital === 0)).toBe(true);
    expect(r.ganhosCapitalOficial.moedaEspecie.operacoes).toEqual([]);
  });
});

describe.skipIf(!temSegundoPdf)('Ganhos de Capital pelo PDF: alienação a prazo e colisão de títulos', () => {
  it('lê as parcelas, as perguntas e os quadros de consolidação da operação', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF2_PATH));
    const r = await parsePDF(await pdfjsLib.getDocument({ data }).promise);

    const fiat = r.ganhosCapitalOficial.operacoes.find(o => o.especificacao.startsWith('FIAT UNO'));
    expect(fiat.tipo).toBe('movel');
    expect(fiat.custoAquisicao).toBeCloseTo(15000, 2);
    expect(fiat.valorAlienacao).toBeCloseTo(11500, 2);
    expect(fiat.alienacaoAPrazo).toBe(true);
    // Seis parcelas recebidas em 2025, com a última marcada.
    expect(fiat.parcelas).toHaveLength(6);
    expect(fiat.parcelas[0].data).toBe('2025-01-06');
    expect(fiat.parcelas[0].valorRecebido).toBeCloseTo(500, 2);
    expect(fiat.parcelas[0].custoAquisicaoProporcional).toBeCloseTo(652.18, 2);
    expect(fiat.parcelas[5].valorRecebido).toBeCloseTo(3000, 2);
    // Totais do quadro a prazo: a soma das parcelas do ano e o que já havia
    // sido recebido em anos anteriores, que são números diferentes.
    expect(fiat.calculoImposto.totalRecebidoParcelas).toBeCloseTo(5500, 2);
    expect(fiat.calculoImposto.valorBrutoAnosAnteriores).toBeCloseTo(6000, 2);
    expect(fiat.calculoImposto.aliquotaMedia).toBeCloseTo(15, 6);
    // Perguntas com resposta lida (a marcação "Sim ( )  Não ( X )" vem em
    // duas células separadas no PDF).
    const respostas = Object.fromEntries(fiat.perguntasImpressas.map(p => [p.pergunta, p.resposta]));
    expect(respostas['Sujeito a Registro Público?']).toBe('Não');
    expect(respostas['A alienação foi a prazo/prestação?']).toBe('Sim');
    expect(respostas['Já houve alienação parcial desse bem?']).toBe('Não');
    // Os quadros de transporte no fim da ficha (RENDIMENTOS ISENTOS e
    // RENDIMENTOS SUJEITOS À TRIBUTAÇÃO DEFINITIVA) têm o mesmo título de duas
    // FICHAS da declaração. Sem a guarda, o parser abandonava a operação ali e
    // abria uma ficha de rendimentos fantasma no meio do demonstrativo.
    expect(fiat.consolidacaoBem).not.toBeNull();
    expect(fiat.consolidacaoBem.rendimentoIsento).toBeDefined();
    expect(fiat.consolidacaoBem.rendimentoExclusivo).toBeDefined();
  }, 30000);
});
