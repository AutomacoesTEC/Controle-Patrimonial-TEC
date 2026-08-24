// Testa os parsers contra os arquivos REAIS de exemplo (declaração de
// declarante 1, exercício 2026/ano-calendário 2025),
// não contra dado sintético — é o que teria pego a regressão do ano
// cravado no código (ver commit da correção). Os arquivos moram fora do
// repositório de propósito: têm CPF e dado financeiro de uma pessoa real,
// e não fazem sentido entrar no histórico do git.
//
// Se os arquivos de exemplo não existirem (outra máquina, outra pasta),
// os testes deste arquivo pulam em vez de falhar — ver `describe.skipIf`.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { parseDBK, parsePDF, normalizarCpfCnpj, isBensMetadataRow } from './importParsers';

const DIR = '/home/automacaotec/PROJETOS/Planilha Eudúcio';
const DBK_PATH = `${DIR}/CPF-DO-DECLARANTE-1-IRPF-A-2026-2025-ORIGI.DBK`;
const PDF_PATH = `${DIR}/DECLARANTE 1 2026-2025.pdf`;
// Segundo contribuinte, SEM .DBK, usado para provar que o parser não depende
// do layout de um arquivo só: cabeçalho sem a coluna "BEM", coluna de valores
// alguns pixels mais à direita, fichas de Dívidas e de Doações vindo "Sem
// Informações", parcela não dedutível diferente de zero e pagamentos
// espalhados por duas páginas. Ver PDF2_PATH nos testes lá embaixo.
const PDF2_PATH = `${DIR}/DECLARANTE 2 2026-2025.pdf`;

const temArquivos = existsSync(DBK_PATH) && existsSync(PDF_PATH);
const temSegundoPdf = existsSync(PDF2_PATH);

describe.skipIf(!temArquivos)('parseDBK (arquivo real)', () => {
  it('bate os totais e a contagem contra o registro-resumo interno do próprio .DBK', async () => {
    const text = await readFile(DBK_PATH, 'latin1');
    const r = await parseDBK(text);

    expect(r.anoCalendario).toBe(2025);
    expect(r.contribuinte.cpf).toBe('CPF-DO-DECLARANTE-1');
    expect(r.bens).toHaveLength(172);
    expect(r.dividas).toHaveLength(1);
    expect(r.pagamentos).toHaveLength(24);

    const somaAnt = r.bens.reduce((s, b) => s + b.situacao_anterior, 0);
    const somaAtu = r.bens.reduce((s, b) => s + b.situacao_atual, 0);
    expect(somaAnt).toBeCloseTo(79550353.28, 2);
    expect(somaAtu).toBeCloseTo(137977220.38, 2);
  });

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
    expect(jeep.adquirenteCpfCnpj).toBe('47395192672');
    expect(jeep.adquirenteNome).toBe('CLAUDIA DECLARANTE 1 MACIEL');

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

    const olaria = r.imoveisRurais.find(i => i.nomeLocalizacao.includes('NOME DA FAZENDA'));
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

    const osires = r.participantesRuraisOficial.find(p => p.nome.startsWith('OSIRES'));
    expect(osires.cpf).toBe('04176006668');
    expect(osires.nome).toBe('OSIRES PEREIRA CAMPOS');

    // Nome com apóstrofo vira espaço no .DBK (sem acentuação/pontuação
    // especial, mesma limitação já vista em outros campos de nome do
    // arquivo) — "JOANA DAR'C BAIA ANTUNES" no PDF.
    const joana = r.participantesRuraisOficial.find(p => p.cpf === '59614544600');
    expect(joana.nome).toBe('JOANA DAR C BAIA ANTUNES');

    const adelia = r.participantesRuraisOficial.find(p => p.nome.startsWith('ADELIA'));
    expect(adelia.cpf).toBe('75476827668');
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
      '40' + 'CPF-DO-DECLARANTE-1' + '07' +
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
    const r33 = '33' + 'CPF-DO-DECLARANTE-1' + '00001' + 'T' + pad('11222333000144', 14) +
      pad('EMPRESA QUE DISTRIBUIU LUCRO', 60) + N13(999999) + 'CPF-DO-DECLARANTE-1' + '0000000001';
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
    const comFicha = `${original}\n58CPF-DO-DECLARANTE-10000012345678000000000000\n`;
    const avisos = [];
    await parseDBK(comFicha, (m, n) => { if (n === 'warning') avisos.push(m); });
    expect(avisos.some(m => m.includes('Herdeiros') && m.includes('não importa'))).toBe(true);
    // E o aviso genérico de "tipo desconhecido" NÃO deve disparar junto: o app
    // sabe o que é essa ficha, só não a modela.
    expect(avisos.some(m => m.includes('tipo 58'))).toBe(false);
  });

  it('avisa como DESCONHECIDO o tipo que nem o mapa oficial cobre', async () => {
    const original = await readFile(DBK_PATH, 'latin1');
    // 99 existe no XML de layout e não está na lista de fichas nomeadas: é o
    // caso de "o arquivo mudou, ou tem algo que este parser nunca viu".
    const comTipoNovo = `${original}\n99CPF-DO-DECLARANTE-10000012345678000000000000\n`;
    const avisos = [];
    await parseDBK(comTipoNovo, (m, n) => { if (n === 'warning') avisos.push(m); });
    expect(avisos.some(m => m.includes('tipo 99') && m.includes('não conhece'))).toBe(true);
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
    const osires = r.participantesRuraisOficial.find(p => p.cpf === '04176006668');
    expect(osires.nome).toBe('OSIRES PEREIRA CAMPOS');
  });

  it('registro 57: a chave NR_CHAVE_AR liga o participante ao imóvel', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // A ATUALIZAÇÃO 3 registrou que "não existe vínculo confiável ao imóvel no
    // .DBK", e a 45 repetiu. Era falso: o campo NR_CHAVE_AR sempre esteve lá,
    // no registro 50 (posição 164) e no 57 (posição 89).
    expect(r.participantesRuraisOficial.every(p => p.imovelId != null)).toBe(true);
    const osires = r.participantesRuraisOficial.find(p => p.cpf === '04176006668');
    expect(osires.imovelNome).toBe('NOME DA FAZENDA, MUNICIPIO');
    // Três participantes da MESMA fazenda, que é o caso que prova que a chave
    // não é um índice sequencial disfarçado.
    const barreiras = r.participantesRuraisOficial.filter(p => p.imovelNome.startsWith('NOME DA FAZENDA'));
    expect(barreiras).toHaveLength(3);
    expect(barreiras.map(p => p.imovelId).every(id => id === barreiras[0].imovelId)).toBe(true);
  });

  it('registro 50: nome e localização são campos separados, como no PDF', async () => {
    const r = await parseDBK(await readFile(DBK_PATH, 'latin1'));
    // NM_IMOVEL (23,60) e NM_LOCAL (83,55). A leitura antiga pegava os 114 de
    // uma vez e colava os dois sem pontuação, fazendo o .DBK divergir do PDF.
    const olaria = r.imoveisRurais[0];
    expect(olaria.nomeImovel).toBe('NOME DA FAZENDA');
    expect(olaria.localizacao).toBe('MUNICIPIO');
    expect(olaria.nomeLocalizacao).toBe('NOME DA FAZENDA, MUNICIPIO');
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
      '22' + 'CPF-DO-DECLARANTE-1' + 'N' + '           ' + '03' +
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
    const zerado = '22' + 'CPF-DO-DECLARANTE-1' + 'N' + '           ' + '05' + N13(0).repeat(4) +
      N13(0).repeat(5) + N13(0) + '0000000002';
    const doDependente = '22' + 'CPF-DO-DECLARANTE-1' + 'S' + '25307150687' + '07' +
      N13(800) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(0) + N13(800) + N13(0) + '0000000003';
    const arquivo = `${await readFile(DBK_PATH, 'latin1')}\n${zerado}\n${doDependente}\n`;
    const r = await parseDBK(arquivo);

    const pf = r.rendimentos.filter(x => x.tipo === 'tributavel_pf_exterior');
    // A ficha traz os 12 meses mesmo quando só alguns têm valor: mês zerado não
    // pode virar lançamento de R$ 0,00 na tela.
    expect(pf).toHaveLength(1);
    expect(pf[0].mes).toBe(7);
    expect(pf[0].beneficiario).toBe('Dependente');
    expect(pf[0].cpf_dependente).toBe('25307150687');
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
    const efetuada = '90' + 'CPF-DO-DECLARANTE-1' + '41' + pad('26459474000190', 14) +
      pad('FUNDO MUNICIPAL DA CRIANCA', 60) + N13(2857.33) + N13(0) + '2' + '0000000001';
    const partido = '34' + 'CPF-DO-DECLARANTE-1' + pad('12345678000199', 14) +
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
    const eca = '91' + 'CPF-DO-DECLARANTE-1' + 'M' + 'MG' + pad('MINAS GERAIS', 30) +
      pad('MUNICIPIO', 40) + N13(1000) + pad('26459474000190', 14) + '0000000001';
    const idoso = '92' + 'CPF-DO-DECLARANTE-1' + 'E' + 'MG' + pad('MINAS GERAIS', 30) +
      pad('', 40) + N13(750) + pad('11222333000144', 14) + '0000000002';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${eca}\n${idoso}\n`);

    expect(r.doacoesEcaIdosoOficial).toHaveLength(2);
    const doEca = r.doacoesEcaIdosoOficial.find(d => d.categoria === 'eca');
    expect(doEca.valor).toBeCloseTo(1000, 2);
    expect(doEca.cpf_cnpj).toBe('26459474000190');
    expect(doEca.esferaFundo).toBe('Municipal');
    expect(doEca.nome_beneficiario).toContain('Municipal');
    expect(doEca.nome_beneficiario).toContain('MUNICIPIO');
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
    'CPF-DO-DECLARANTE-1'.split('').forEach((c, k) => { buf[2 + k] = c; });
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
    const linha = '32' + 'CPF-DO-DECLARANTE-1' + '25307150687' + pad('16727230000197', 14) +
      pad('FUNDO DE RENDIMENTO GERAL DE PREVIDENCIA SOCIAL', 60) +
      N13(57754.33) + N13(0) + N13(4556.29) + N13(3360.61) +
      pad('', 8) + N13(274.90) + '0000000001';
    const r = await parseDBK(`${await readFile(DBK_PATH, 'latin1')}\n${linha}\n`);

    const doDependente = r.rendimentos.filter(x => x.tipo === 'tributavel_pj' && x.beneficiario === 'Dependente');
    expect(doDependente).toHaveLength(1);
    expect(doDependente[0].cpf_dependente).toBe('25307150687');
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
    const cab = (tipo, cod) => tipo + 'CPF-DO-DECLARANTE-1' + 'T' + 'CPF-DO-DECLARANTE-1' + cod + pad('11222333000144', 14) + pad('FONTE EXEMPLO LTDA', 60);
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
    const r83 = '83' + 'CPF-DO-DECLARANTE-1' + 'D' + '25307150687' + '0016' + N13(800) + '0000000001';
    // 87: nem beneficiário tem — código na 14, valor na 18, e um valor de ganho
    // de capital à parte na 31.
    const r87 = '87' + 'CPF-DO-DECLARANTE-1' + '0005' + N13(2000) + N13(1500) + '0000000002';
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
    const r45 = '45' + 'CPF-DO-DECLARANTE-1' + '  ' + pad('11222333000144', 14) +
      pad('INSS - ACAO JUDICIAL', 60) +
      N13(120000) + N13(8000) + N13(0) + N13(9000) + '06' + '00001' + ' ' + '1' + '0024' +
      N13(9000) + N13(12000) + N13(100000) + N13(15000) + '0000000001';
    // 47: igual, com o CPF do dependente em (16,11) empurrando tudo 11 à frente.
    const r47 = '47' + 'CPF-DO-DECLARANTE-1' + '  ' + '25307150687' + pad('99888777000166', 14) +
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
    expect(doDependente.cpf_dependente).toBe('25307150687');
    expect(doDependente.nome_fonte).toBe('FONTE DO DEPENDENTE');
    expect(doDependente.valor).toBeCloseTo(30000, 2);
    expect(doDependente.numeroMeses).toBe(12);
    expect(doDependente.opcaoTributacao).toBe('2');
  });

  it('rendimento com exigibilidade suspensa NÃO entra, e vira aviso', async () => {
    const N13 = (v) => String(Math.round(v * 100)).padStart(13, '0');
    const pad = (t, n) => String(t).padEnd(n).slice(0, n);
    const r80 = '80' + 'CPF-DO-DECLARANTE-1' + pad('11222333000144', 14) +
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
    expect(ana.nome).toBe('ANA MARIA DECLARANTE 1');
    expect(ana.cpf).toBe('25307150687');
    expect(ana.dataNascimento).toBe('1955-01-19');
    // Código cru da declaração (não traduzido, ver comentário no parser).
    expect(ana.parentesco).toBe('11');
  });
});

describe.skipIf(!temArquivos)('parsePDF (arquivo real, o mesmo declarante do .DBK)', () => {
  it('bate DÍGITO A DÍGITO com o .DBK — os dois caminhos de import têm que produzir o mesmo resultado', async () => {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(await readFile(PDF_PATH));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const r = await parsePDF(pdf);

    expect(r.anoCalendario).toBe(2025);
    expect(r.contribuinte.cpf).toBe('CPF-DO-DECLARANTE-1');
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
    expect(r.contribuinte.cpf).toBe('CPF no manifesto local');

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
    return parsePDF(await pdfjsLib.getDocument({ data }).promise);
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
    expect(dep.every(x => x.cpf_dependente === '65578791620')).toBe(true);
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
    expect(olaria.nomeLocalizacao).toBe('NOME DA FAZENDA, MUNICIPIO');
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
    // ("JOSE VIDAL", "JOANA DAR C") e o PDF traz o texto impresso, com acento
    // e apóstrofo ("JOSÉ VIDAL", "JOANA DAR'C"). O do PDF é o mais fiel à
    // declaração; não é divergência de leitura.
    const semAcento = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z ]/gi, ' ').replace(/\s+/g, ' ').trim();
    const porCpf = (lista) => Object.fromEntries(lista.map(p => [p.cpf, semAcento(p.nome)]));
    expect(porCpf(rp.participantesRuraisOficial)).toEqual(porCpf(rd.participantesRuraisOficial));

    // O ganho sobre o .DBK: no PDF os participantes vêm ANINHADOS sob a linha
    // do imóvel ("PARTICIPANTE(S)" logo abaixo dela), então dá para saber de
    // QUAL fazenda cada um é coproprietário. A ATUALIZAÇÃO 3 registrou esse
    // vínculo como impossível pelo arquivo .DBK.
    expect(rp.participantesRuraisOficial.every(p => p.imovelId != null)).toBe(true);
    const osires = rp.participantesRuraisOficial.find(p => p.cpf === '04176006668');
    expect(osires.nome).toBe('OSIRES PEREIRA CAMPOS');
    expect(osires.imovelCib).toBe('2211420-3');
    expect(osires.imovelNome).toBe('NOME DA FAZENDA, MUNICIPIO');
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
    expect(aPrazo.adquirenteNome).toBe('FABIANO DOS SANTOS DA SILVA');

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
    expect(rp.dependentes).toEqual(rd.dependentes);
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
    expect(r.dependentes[0].nome).toBe('ROSIMAR DE PAULA MOREIRA MARTINS');
    expect(r.dependentes[0].cpf).toBe('65578791620');
    expect(r.dependentes[0].dataNascimento).toBe('1965-06-23');

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
  }, 60000);

  it('lê a ficha da dependente só a partir de julho, com a perda de 245,40 e o CPF dela', async () => {
    const r = await lerPdf2();
    const dep = r.rendaVariavelMensalOficial.filter(f => !f.titular);
    // Janeiro a junho vêm "Sem Informações" na declaração: não podem virar
    // ficha zerada, senão o app afirma um dado que a declaração não traz.
    expect(dep.map(f => f.mes)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(dep.every(f => f.cpfDependente === '65578791620')).toBe(true);

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
    expect(r.contribuinte.cpf).toBe('CPF-DO-DECLARANTE-1');
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
