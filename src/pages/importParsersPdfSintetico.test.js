// Regressão da fase de EXTRAÇÃO do caminho PDF, contra as TRÊS declarações
// sintéticas geradas pelo programa oficial da Receita e versionadas em
// `output/pdf/`. Diferente de importParsers.test.js, que depende de arquivos
// de pessoas reais guardados fora do repositório, estes rodam em qualquer
// máquina que tenha o repositório.
//
// Cada bloco aqui nasceu de um defeito PROVADO na auditoria de 31/08/2026
// (AUDITORIA/AUDITORIA-EXTRACAO-PDF-IRPF-2026.md). O que se testa é sempre o
// valor impresso no PDF, citado no comentário com a página e a linha visual do
// dump `AUDITORIA/rows-pdfjs/`.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { parsePDF, valoresDaLinhaDeDivida } from './importParsers';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const PDFS = {
  AJU: `${RAIZ}output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`,
  ESP: `${RAIZ}output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf`,
  SAI: `${RAIZ}output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf`,
};
const temPdfs = Object.values(PDFS).every(existsSync);

if (process.env.IRPF_FIXTURES_REQUIRED === '1' && !temPdfs) {
  throw new Error('IRPF_FIXTURES_REQUIRED=1 mas os PDFs sintéticos de output/pdf/ não foram encontrados');
}

const cache = new Map();
async function extrair(chave) {
  if (cache.has(chave)) return cache.get(chave);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await readFile(PDFS[chave]));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const resultado = await parsePDF(pdf, () => {}, () => {}, { validarDocumento: false });
  cache.set(chave, resultado);
  return resultado;
}

describe.skipIf(!temPdfs)('PDF sintético: FII e Fiagro (matriz mês a mês)', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // O defeito original: a célula órfã "MÊS" (pedaço final do rótulo
  // "RESULTADO LÍQUIDO DO MÊS", quebrado em três linhas visuais) era aceita
  // como cabeçalho de quadro, zerava as colunas de mês e fazia a guarda
  // seguinte descartar TODO o resto da ficha. Saída: lista vazia, com
  // movimento impresso.
  it('extrai a ficha do titular, que o formulário imprime preenchida', () => {
    const titular = aju.fiiFiagroMensalOficial.filter(m => m.titular);
    expect(titular.length).toBeGreaterThan(0);
    expect(titular.map(m => m.mes)).toEqual([5, 6, 7, 8, 9, 10, 11, 12]);
  });

  // AJU-01 p37 r7/r13/r15/r16/r17/r21/r23/r24, coluna "Maio".
  it('lê maio do titular campo a campo, inclusive os rótulos quebrados em duas linhas', () => {
    const maio = aju.fiiFiagroMensalOficial.find(m => m.titular && m.mes === 5);
    // Estes quatro só existem se o rótulo partido for remontado: a linha que
    // carrega os valores não tem texto nenhum.
    expect(maio.resultadoLiquidoMes).toBe(1801.81);
    expect(maio.resultadoNegativoMesAnterior).toBe(0);
    expect(maio.baseCalculoImposto).toBe(1801.81);
    expect(maio.impostoRetidoMesesAnteriores).toBe(0);
    // Estes vêm de linhas em que rótulo e valores dividem a mesma linha.
    expect(maio.prejuizoCompensar).toBe(0);
    expect(maio.aliquota).toBe('20,00');
    expect(maio.impostoDevido).toBe(360.36);
    expect(maio.impostoRetidoNoMes).toBe(18.82);
    expect(maio.impostoACompensar).toBe(0);
    expect(maio.impostoAPagar).toBe(341.54);
    expect(maio.impostoPago).toBe(361.83);
  });

  // AJU-01 p37, coluna "Junho": o único mês com resultado NEGATIVO, que é o
  // que prova que o sinal sobrevive à conversão.
  it('preserva o resultado negativo de junho e o prejuízo a compensar', () => {
    const junho = aju.fiiFiagroMensalOficial.find(m => m.titular && m.mes === 6);
    expect(junho.resultadoLiquidoMes).toBe(-902.84);
    expect(junho.baseCalculoImposto).toBe(0);
    expect(junho.prejuizoCompensar).toBe(902.84);
    expect(junho.impostoRetidoNoMes).toBe(9.85);
    expect(junho.impostoACompensar).toBe(9.85);
  });

  // O segundo quadro da página (julho a dezembro) tem cabeçalho próprio.
  // AJU-01 p37 r30/r35/r39/r42.
  it('lê o segundo quadro do titular, de julho a dezembro', () => {
    for (const mes of [7, 8, 9, 10, 11, 12]) {
      const m = aju.fiiFiagroMensalOficial.find(x => x.titular && x.mes === mes);
      expect(m, `mês ${mes}`).toBeTruthy();
      expect(m.resultadoNegativoMesAnterior, `mês ${mes}`).toBe(902.84);
      expect(m.prejuizoCompensar, `mês ${mes}`).toBe(902.84);
      expect(m.impostoRetidoMesesAnteriores, `mês ${mes}`).toBe(9.85);
      expect(m.impostoACompensar, `mês ${mes}`).toBe(9.85);
    }
  });

  // Este é o teste do casamento coluna/mês. Os números são impressos
  // alinhados à DIREITA e os nomes de mês à esquerda: o valor de JANEIRO sai
  // em x=189,4 e a âncora de FEVEREIRO fica em x=229,1, dentro da tolerância
  // de 40 do bucket por coordenada. Com aquele bucket, o valor de maio (o
  // único diferente de zero no primeiro quadro) seria atribuído a outro mês.
  it('não desloca a coluna: o movimento do primeiro quadro cai em maio, não em abril nem em junho', () => {
    const comMovimento = aju.fiiFiagroMensalOficial
      .filter(m => m.titular && m.mes <= 6 && m.resultadoLiquidoMes > 0);
    expect(comMovimento).toHaveLength(1);
    expect(comMovimento[0].mes).toBe(5);
  });

  // AJU-01 p38 r26 a r45, ficha dos dependentes: só julho tem movimento.
  it('separa a ficha dos dependentes e guarda o CPF impresso no subtítulo', () => {
    const dep = aju.fiiFiagroMensalOficial.filter(m => !m.titular);
    expect(dep).toHaveLength(1);
    expect(dep[0].mes).toBe(7);
    expect(dep[0].cpfDependente).toBe('33344455508');
    expect(dep[0].resultadoLiquidoMes).toBe(1811.86);
    expect(dep[0].impostoRetidoNoMes).toBe(18.87);
    expect(dep[0].impostoPago).toBe(362.88);
  });

  it('consolida o ano a partir dos meses lidos', () => {
    expect(aju.fiiFiagroAnualOficial).toBeTruthy();
    expect(aju.fiiFiagroAnualOficial.derivadoDosMeses).toBe(true);
    // 1.801,81 (maio, titular) - 902,84 (junho, titular) + 1.811,86 (julho, dependente)
    expect(aju.fiiFiagroAnualOficial.resultadoLiquido).toBeCloseTo(2710.83, 2);
    expect(aju.fiiFiagroAnualOficial.impostoDevido).toBeCloseTo(360.36, 2);
  });

  it('não inventa mês zerado: só entra o mês com movimento', () => {
    // Janeiro a abril do titular estão impressos, e todos com 0,00 em toda
    // linha. Mês zerado não é operação declarada.
    expect(aju.fiiFiagroMensalOficial.some(m => m.titular && m.mes <= 4)).toBe(false);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: FII e Fiagro em declaração sem a ficha', () => {
  // ESP-01 e SAI-01 imprimem as duas fichas de FII com "Sem Informações".
  // Nenhuma delas pode produzir mês fantasma.
  it.each([['ESP'], ['SAI']])('%s não produz ficha mensal de FII', async (chave) => {
    const r = await extrair(chave);
    expect(r.fiiFiagroMensalOficial).toHaveLength(0);
    expect(r.fiiFiagroAnualOficial).toBeNull();
  });
});

describe.skipIf(!temPdfs)('PDF sintético: ficha de rendimento com título quebrado em duas linhas', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // O formulário quebra o título quando ele não cabe na largura da ficha, e o
  // ponto do corte muda de declaração para declaração. Enquanto o parser só
  // olhava a cell isolada, três fichas PREENCHIDAS do AJU-01 sumiam sem aviso:
  // o fechamento genérico (/^RENDIMENTOS/) matava a seção e ninguém registrava
  // que havia dado ali.
  const QUEBRADAS = [
    // AJU-01 p6 r5 + r6: "...PELO TITULAR (IMPOSTO COM" / "EXIGIBILIDADE SUSPENSA)"
    ['rendimentos-exigibilidade-titular',
      'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM EXIGIBILIDADE SUSPENSA)'],
    // AJU-01 p6 r14 + r16, com "(Valores em Reais)" numa row própria no meio
    ['rendimentos-exigibilidade-dependentes',
      'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE SUSPENSA)'],
    // AJU-01 p6 r37 + r38: "...ACUMULADAMENTE PELOS" / "DEPENDENTES"
    ['rra-dependentes',
      'RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS DEPENDENTES'],
  ];

  it.each(QUEBRADAS)('registra a ficha %s no inventário do PDF', (id) => {
    expect(aju.fichasPdfObservadas[id]).toBeTruthy();
    expect(aju.fichasPdfObservadas[id].paginaInicio).toBe(6);
  });

  it.each(QUEBRADAS)('avisa que %s veio preenchida e não foi importada', (id, titulo) => {
    expect(aju.fichasNaoLidasComConteudo).toContain(titulo);
    expect(aju.avisosImportacao.some(a => a.includes(titulo))).toBe(true);
  });

  // A ficha que já era impressa numa linha só continua avisada: a emenda não
  // pode ter quebrado o caminho que já funcionava.
  it('mantém o aviso de RRA do titular, cujo título cabe numa linha só', () => {
    expect(aju.fichasNaoLidasComConteudo)
      .toContain('RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR');
  });

  // A linha que fecha o título é só o rabo dele e não pode ser reconhecida por
  // conta própria. O "DEPENDENTES" que fecha o título de RRA dos dependentes
  // casa por igualdade exata com a ficha DEPENDENTES: sem consumir a linha,
  // `fichaPdfAtual` era desviado para a ficha de dependentes no meio da tabela
  // de RRA, na página 6.
  it('não deixa o rabo do título ser lido como a ficha DEPENDENTES', () => {
    expect(aju.fichasPdfObservadas.dependentes.paginaInicio).toBe(1);
  });

  // Estas fichas são 'nao_suportada' no catálogo: o app não modela esses
  // rendimentos. A correção transforma perda SILENCIOSA em perda AVISADA, e
  // não importa os valores. Este teste existe para que ninguém leia o aviso
  // como se o dado tivesse entrado.
  it('continua sem importar os valores dessas fichas, que o app não modela', () => {
    const tudo = JSON.stringify(aju.rendimentos);
    for (const valor of ['17701.91', '7702.92', '8711.96', '3712.97', '9811.06']) {
      expect(tudo).not.toContain(valor);
    }
  });
});

describe.skipIf(!temPdfs)('PDF sintético: a emenda de título não inventa ficha preenchida', () => {
  // ESP-01 e SAI-01 imprimem essas mesmas fichas com "Sem Informações".
  // Emendar linhas não pode produzir aviso onde não há dado.
  it.each([['ESP'], ['SAI']])('%s não gera aviso de ficha não lida com conteúdo', async (chave) => {
    const r = await extrair(chave);
    expect(r.fichasNaoLidasComConteudo).toEqual([]);
    expect(r.avisosImportacao).toEqual([]);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: imóvel rural com a coluna CIB vazia', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // O CIB é a inscrição do imóvel no cadastro da Receita e a coluna vem VAZIA
  // quando o contribuinte não a preencheu. Enquanto ele era exigido para
  // reconhecer a linha, a ficha inteira era descartada: AJU-01 p11 r7 traz
  // código 11, participação 75,00, condição 2, nome e área 123,4, e nenhuma
  // célula na coluna CIB.
  it('reconhece o imóvel mesmo sem CIB impresso', () => {
    expect(aju.imoveisRurais).toHaveLength(1);
    const imovel = aju.imoveisRurais[0];
    expect(imovel.codigoAtividade).toBe('11');
    expect(imovel.participacao).toBe(75);
    expect(imovel.condicaoExploracao).toBe('2');
    expect(imovel.area).toBe(123.4);
    expect(imovel.cib).toBe('');
  });

  // AJU-01 p11 r7 + r8 + r9: nome e localização quebrados em três linhas.
  it('remonta o nome e a localização quebrados em três linhas', () => {
    expect(aju.imoveisRurais[0].nomeLocalizacao)
      .toBe('AJU RUR FAZENDA BRASIL SENTINELA, ESTRADA AJU RURAL KM 22 - UBERABA/MG - CEP 38000-000');
  });

  // Este é o dado que só o PDF entrega, e que o arquivo .DBK não tem. Sem o
  // imóvel, o participante era gravado órfão, com imovelId nulo.
  it('liga o participante ao imóvel que ele explora', () => {
    expect(aju.participantesRuraisOficial).toHaveLength(1);
    const p = aju.participantesRuraisOficial[0];
    expect(p.nome).toBe('AJU RUR PARTICIPANTE UM');
    expect(p.cpf).toBe('22233344405');
    expect(p.imovelId).toBe(aju.imoveisRurais[0].id);
    expect(p.imovelNome).toBe(aju.imoveisRurais[0].nomeLocalizacao);
    expect(p.imovelChaveImportacao).toBe(aju.imoveisRurais[0].chaveImportacao);
  });

  // A chave de importação precisa continuar única sem o CIB, senão dois
  // imóveis sem CIB na mesma declaração colidiriam.
  it('monta chave de importação sem CIB, ancorada no código, na condição e no texto', () => {
    expect(aju.imoveisRurais[0].chaveImportacao).toMatch(/^pdf:imovel-rural::11:2:[0-9a-f]+$/);
  });
});

describe('Dívidas: leitura das três colunas de valor (geometria real do AJU-01)', () => {
  // Âncoras medidas no cabeçalho real, AJU-01 p10 r4 e r5:
  //   [x=23.0]CÓDIGO [x=114.8]DISCRIMINAÇÃO [x=292.9]SITUAÇÃO EM
  //   [x=384.6]SITUAÇÃO EM 31/12/2025 [x=518.8]VALOR PAGO
  //   [x=300.5]31/12/2024 [x=529.0]EM 2025
  // val1 vem da célula de data da linha seguinte (300,5), como o parser faz.
  const ANCORAS = { codigo: 23, disc: 114.8, val1: 300.5, val2: 384.6, pago: 518.8 };

  // Os números são impressos alinhados à DIREITA. Estas três bordas e a
  // largura de 4,5 por glifo foram DERIVADAS dos seis valores reais da ficha e
  // reproduzem os seis x do documento exatamente:
  //   val1: "91.801,71" -> 333,4   "10.804,74" -> 333,4
  //   val2: "72.802,72" -> 446,4   "6.805,75"  -> 450,9
  //   pago: "19.003,73" -> 533,4   "3.998,99"  -> 537,9
  const BORDA = { val1: 373.9, val2: 486.9, pago: 573.9 };
  const GLIFO = 4.5;
  const xDe = (coluna, texto) => BORDA[coluna] - texto.length * GLIFO;

  const linha = (anterior, atual, pago, extras = []) => ({
    y: 697,
    cells: [
      { x: 23, text: '13' },
      { x: 72, text: 'CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO' },
      ...extras,
      { x: xDe('val1', anterior), text: anterior },
      { x: xDe('val2', atual), text: atual },
      { x: xDe('pago', pago), text: pago },
    ].sort((a, b) => a.x - b.x),
  });

  it('reproduz as coordenadas reais do documento', () => {
    expect(xDe('val1', '91.801,71')).toBeCloseTo(333.4, 1);
    expect(xDe('val2', '72.802,72')).toBeCloseTo(446.4, 1);
    expect(xDe('val2', '6.805,75')).toBeCloseTo(450.9, 1);
    expect(xDe('pago', '19.003,73')).toBeCloseTo(533.4, 1);
    expect(xDe('pago', '3.998,99')).toBeCloseTo(537.9, 1);
  });

  it('lê a linha real da declaração', () => {
    const v = valoresDaLinhaDeDivida(linha('91.801,71', '72.802,72', '19.003,73'), ANCORAS);
    expect(v.situacao_anterior).toBe(91801.71);
    expect(v.situacao_atual).toBe(72802.72);
    expect(v.valor_pago).toBe(19003.73);
    expect(v.lidoPorOrdem).toBe(true);
  });

  // O defeito: "999,99" tem 6 glifos e sai em x=459,9, além da fronteira
  // val2/pago em 451,70. No bucket por coordenada ele virava VALOR PAGO,
  // `situacao_atual` zerava e `valor_pago` recebia dois números concatenados.
  it('não migra para VALOR PAGO um saldo do ano corrente abaixo de mil reais', () => {
    const v = valoresDaLinhaDeDivida(linha('91.801,71', '999,99', '19.003,73'), ANCORAS);
    expect(v.situacao_atual).toBe(999.99);
    expect(v.valor_pago).toBe(19003.73);
    expect(v.situacao_anterior).toBe(91801.71);
  });

  // Mesma coisa na primeira coluna: "999,99" sai em x=346,9, além da fronteira
  // val1/val2 em 342,55.
  it('não migra para o ano corrente um saldo do ano anterior abaixo de mil reais', () => {
    const v = valoresDaLinhaDeDivida(linha('999,99', '72.802,72', '19.003,73'), ANCORAS);
    expect(v.situacao_anterior).toBe(999.99);
    expect(v.situacao_atual).toBe(72802.72);
    expect(v.valor_pago).toBe(19003.73);
  });

  it('lê uma dívida inteiramente abaixo de mil reais', () => {
    const v = valoresDaLinhaDeDivida(linha('850,00', '12,34', '837,66'), ANCORAS);
    expect(v.situacao_anterior).toBe(850);
    expect(v.situacao_atual).toBe(12.34);
    expect(v.valor_pago).toBe(837.66);
  });

  it('preserva saldo negativo', () => {
    const v = valoresDaLinhaDeDivida(linha('-500,00', '-1.200,50', '0,00'), ANCORAS);
    expect(v.situacao_anterior).toBe(-500);
    expect(v.situacao_atual).toBe(-1200.5);
    expect(v.valor_pago).toBe(0);
  });

  // Fora do caso de três valores, volta para o bucket por coluna, que é o
  // comportamento antigo. Aqui a discriminação traz um valor monetário à
  // direita da fronteira, e a linha passa a ter quatro.
  it('cai no bucket por coluna quando a linha não tem exatamente três valores', () => {
    const v = valoresDaLinhaDeDivida(
      linha('91.801,71', '72.802,72', '19.003,73', [{ x: 250, text: '1.500,00' }]),
      ANCORAS,
    );
    expect(v.lidoPorOrdem).toBe(false);
  });

  // O corte à esquerda não pode comer um valor monetário escrito dentro do
  // texto do credor: ele fica à esquerda da fronteira DISCRIMINAÇÃO/val1
  // (207,65) e não entra na contagem.
  it('ignora valor monetário escrito dentro da discriminação, à esquerda da fronteira', () => {
    const v = valoresDaLinhaDeDivida(
      linha('91.801,71', '72.802,72', '19.003,73', [{ x: 130, text: '2.000,00' }]),
      ANCORAS,
    );
    expect(v.lidoPorOrdem).toBe(true);
    expect(v.situacao_anterior).toBe(91801.71);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: as quatro fichas de Doações', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // Doações Efetuadas: CÓD. | NOME | CPF/CNPJ | VALOR PAGO | PARC. NÃO DEDUTÍVEL.
  // AJU-01 p8 r17/r18/r19.
  it('lê as três doações efetuadas com a parcela não dedutível como coluna própria', () => {
    expect(aju.doacoesEfetuadasOficial).toHaveLength(3);
    const [d1, d2, d3] = aju.doacoesEfetuadasOficial;
    expect(d1).toMatchObject({ codigo: '80', nome_beneficiario: 'AJU DOA PESSOA FISICA', cpf_cnpj: '22233344405', valor: 7101.41, parcela_nao_dedutivel: 0 });
    expect(d2).toMatchObject({ codigo: '81', valor: 8102.42 });
    expect(d3).toMatchObject({ codigo: '40', cpf_cnpj: '55566677000183', valor: 1103.43 });
  });

  // O valor não pode vir concatenado com a parcela não dedutível. Aqui a
  // parcela é 0,00, então o número certo prova que as duas colunas foram
  // separadas e não que parseFloat mascarou a concatenação.
  it('não concatena o valor doado com a parcela não dedutível', () => {
    expect(aju.doacoesEfetuadasOficial[0].valor).toBe(7101.41);
  });

  // Doações a partidos e candidatos: NOME | CNPJ | VALOR. AJU-01 p10 r11/r12.
  // Antes, o cabeçalho não casava com isDoacaoHeaderRow (CÓD./NOME DO
  // BENEFICIÁRIO) e a doação eleitoral de R$ 1.201,44 sumia por inteiro.
  it('lê a doação a partido/candidato, cujo cabeçalho é NOME|CNPJ|VALOR', () => {
    expect(aju.doacoesPartidosOficial).toHaveLength(1);
    expect(aju.doacoesPartidosOficial[0]).toMatchObject({
      nome_beneficiario: 'AJU ELEITORAL SENTINELA', cpf_cnpj: '55566677000183', valor: 1201.44,
    });
  });

  // ECA e Pessoa Idosa: TIPO DE FUNDO | FUNDO | CNPJ | VALOR. AJU-01 p38 r48 e
  // p39 r5. São doações DEDUTÍVEIS diretamente no imposto; sumiam inteiras.
  it('lê a doação ECA (fundo), com esfera e categoria', () => {
    const eca = aju.doacoesEcaIdosoOficial.find(d => d.categoria === 'eca');
    expect(eca).toBeTruthy();
    expect(eca.esferaFundo).toBe('Municipal');
    expect(eca.cpf_cnpj).toBe('97537776000187');
    expect(eca.valor).toBe(301.45);
    expect(eca.codigo).toBe('41');
  });

  it('lê a doação à Pessoa Idosa (fundo), com esfera e categoria', () => {
    const idoso = aju.doacoesEcaIdosoOficial.find(d => d.categoria === 'idoso');
    expect(idoso).toBeTruthy();
    expect(idoso.esferaFundo).toBe('Estadual');
    expect(idoso.cpf_cnpj).toBe('17087890000113');
    expect(idoso.valor).toBe(302.46);
    expect(idoso.codigo).toBe('42');
  });

  // O aviso enganoso ("as doações usam layout extrapolado, importe pelo .DBK")
  // não pode mais existir: as fichas agora são lidas.
  it('não emite mais o aviso de que as doações usam layout não conferido', () => {
    expect(aju.avisosImportacao.some(a => /layout de tabela extrapolado/.test(a))).toBe(false);
  });

  // Nenhuma ficha de doação pode ficar como 'erro' (detectada mas não lida).
  it('nenhuma ficha de doação fica em estado de erro', () => {
    for (const id of ['pdf:doacoes-eleitorais', 'pdf:doacoes-eca', 'pdf:doacoes-idoso']) {
      expect(aju.estadoFichas[id].estado).not.toBe('erro');
    }
  });
});

describe.skipIf(!temPdfs)('PDF sintético: titularidade dos Pagamentos Efetuados', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // O formulário agrupa os pagamentos por "Titular" / "Dependente: <nome>" /
  // "Alimentando: <nome>". AJU-01: p7 r29 Titular, p7 r40 Dependente, p8 r10
  // Alimentando. Antes, esses marcadores eram descartados e todo pagamento
  // ficava sem dono.
  it('marca os pagamentos do titular', () => {
    const doTitular = aju.pagamentos.filter(p => p.titularidade === 'titular');
    expect(doTitular.map(p => p.codigo)).toEqual(['10', '21', '60', '36', '99']);
  });

  // Este é o caso que o marcador atravessa a virada de página: o "Dependente:"
  // fica no fim da p7 e os pagamentos dele na p8, cujo topo REIMPRIME o título
  // "PAGAMENTOS EFETUADOS". A titularidade não pode ser zerada nessa reimpressão.
  it('mantém a titularidade do dependente através da virada de página', () => {
    const doDependente = aju.pagamentos.filter(p => p.titularidade === 'dependente');
    expect(doDependente.map(p => p.codigo)).toEqual(['11', '01']);
    expect(doDependente.every(p => p.titularidadeNome === 'AJU PES DEPENDENTE UM')).toBe(true);
  });

  it('marca o pagamento de pensão ao alimentando', () => {
    const doAlimentando = aju.pagamentos.filter(p => p.titularidade === 'alimentando');
    expect(doAlimentando).toHaveLength(1);
    expect(doAlimentando[0].codigo).toBe('30');
    expect(doAlimentando[0].titularidadeNome).toBe('AJU PES ALIMENTANDO UM');
  });

  // Os marcadores não podem virar pagamento nem contaminar o nome do anterior.
  it('não cria pagamento fantasma a partir dos marcadores de agrupamento', () => {
    expect(aju.pagamentos).toHaveLength(8);
    expect(aju.pagamentos.some(p => /^Alimentando:|^Dependente:/.test(p.nome_beneficiario))).toBe(false);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: metadados dos Bens e Direitos', () => {
  let aju, esp, sai;
  beforeAll(async () => { aju = await extrair('AJU'); esp = await extrair('ESP'); sai = await extrair('SAI'); });

  // bens-01: titularidade lida da linha "Bem ou direito pertencente ao:".
  // AJU-01 p9 r33 marca o bem NUMERÁRIO como do Dependente, com o CPF dele.
  it('lê a titularidade e o CPF do beneficiário do bem do dependente', () => {
    const bem = aju.bens.find(b => b.discriminacao.includes('NUMERARIO DEPENDENTE'));
    expect(bem.beneficiario).toBe('Dependente');
    expect(bem.cpf_beneficiario).toBe('33344455508');
  });

  it('mantém os demais bens como do titular, sem CPF de beneficiário', () => {
    const titulares = aju.bens.filter(b => !b.discriminacao.includes('NUMERARIO DEPENDENTE'));
    expect(titulares.every(b => b.beneficiario === 'Titular')).toBe(true);
    expect(titulares.every(b => b.cpf_beneficiario === '')).toBe(true);
  });

  // bens-02: país lido da linha "NNN - PAÍS". AJU-01 e SAI-01 têm um bem no
  // exterior (249 - Estados Unidos); os demais são 105 (Brasil).
  it('lê o país do bem no exterior, sem cravar Brasil', () => {
    const aExterior = aju.bens.find(b => b.localizacao === '249');
    expect(aExterior).toBeTruthy();
    expect(aExterior.paisNome).toBe('ESTADOS UNIDOS DA AMÉRICA');
    const sExterior = sai.bens.find(b => b.localizacao === '249');
    expect(sExterior).toBeTruthy();
  });

  it('mantém 105 (Brasil) nos bens nacionais', () => {
    const nacionais = aju.bens.filter(b => b.localizacao !== '249');
    expect(nacionais.length).toBe(6);
    expect(nacionais.every(b => b.localizacao === '105')).toBe(true);
  });

  // bens-04: o cabeçalho "Lucros e Dividendos (R$)" do subquadro do exterior
  // não pode grudar na discriminação.
  it('não gruda o cabeçalho do subquadro do exterior na discriminação', () => {
    for (const r of [aju, sai]) {
      const ext = r.bens.find(b => b.localizacao === '249');
      expect(ext.discriminacao).not.toMatch(/\(R\$\)/);
    }
  });

  // bens-06: número do item da coluna BEM, para casar com outras fichas.
  it('preserva o número do item impresso na coluna BEM', () => {
    const numeros = aju.bens.map(b => b.numeroItem).sort();
    expect(numeros).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    // O bem do exterior é o item 7, o mesmo que o Demonstrativo da Lei 14.754
    // referencia (bem 7).
    const ext = aju.bens.find(b => b.localizacao === '249');
    expect(ext.numeroItem).toBe('7');
    expect(aju.demonstrativoExteriorOficial.every(d => d.bem === 7)).toBe(true);
  });

  // bens-07: Inscrição Municipal (IPTU), Matrícula, RENAVAM.
  it('extrai Inscrição Municipal, Matrícula e RENAVAM quando impressos', () => {
    const imovel = aju.bens.find(b => b.matricula === '11001');
    expect(imovel.inscricao_municipal).toBe('AJU-IPTU-2101');
    const veiculo = aju.bens.find(b => b.renavam === '26262603903');
    expect(veiculo).toBeTruthy();
  });

  // bens-03: bloco de herdeiros do bem partilhado (Declaração Final de Espólio).
  it('lê os herdeiros do bem partilhado, com nome, CPF e percentual', () => {
    const bem = esp.bens[0];
    expect(bem.herdeiros).toHaveLength(2);
    expect(bem.herdeiros[0]).toMatchObject({ nome: 'ESP HERDEIRO UM', cpf_cnpj: '77788899941', percentual: 60 });
    expect(bem.herdeiros[1]).toMatchObject({ nome: 'ESP HERDEIRO DOIS', cpf_cnpj: '88899900078', percentual: 40 });
  });

  it('não deixa o CPF dos herdeiros nem o cabeçalho poluir a discriminação do bem', () => {
    expect(esp.bens[0].discriminacao).toBe('ESP BEM PARTILHA SENTINELA');
  });

  // bens-05: colunas de partilha do espólio identificadas pelo que são.
  it('marca o bem de partilha e nomeia as colunas de valor corretamente', () => {
    const bem = esp.bens[0];
    expect(bem.ehPartilha).toBe(true);
    expect(bem.situacaoDataPartilha).toBe(123401.41);
    expect(bem.valorTransferencia).toBe(123401.41);
  });

  // bens-08: âncoras de valor derivadas do cabeçalho quando não há linha de
  // datas puras (espólio e saída). Os valores do SAI-01 têm de sair corretos.
  it('lê os valores do SAI-01 sem depender de x fixos', () => {
    const imovel = sai.bens.find(b => b.discriminacao.includes('IMOVEL BRASIL'));
    expect(imovel.situacao_anterior).toBe(0);
    expect(imovel.situacao_atual).toBe(144401.41);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: Ganho de Capital', () => {
  let aju, op0, op1, op2;
  beforeAll(async () => {
    aju = await extrair('AJU');
    [op0, op1, op2] = aju.apuracaoGanhoCapital;
  });

  // gc-02: bem imóvel — "Especificação e endereço" (header) + linhas seguintes.
  it('lê a descrição e o endereço do imóvel (gc-02)', () => {
    expect(op0.tipo).toBe('imovel');
    expect(op0.bem).toBe('AJU GCI IMOVEL URBANO SENTINELA');
    expect(op0.endereco).toBe('RUA AJU GCI IMOVEL 2901, APTO 29 BAIRRO SENTINELA SAO PAULO SP 01001000');
  });

  // gc-03: data e custo de aquisição do imóvel (rótulo:valor na mesma linha).
  it('lê data e custo de aquisição do imóvel (gc-03)', () => {
    expect(op0.dataAquisicao).toBe('2018-08-18');
    expect(op0.custoAquisicao).toBe(100601.41);
  });

  // gc-06: apuração do imóvel usa "da Alienação" (com "da").
  it('lê valor e valor líquido da alienação do imóvel (gc-06)', () => {
    expect(op0.apuracao.valorAlienacao).toBe(160602.42);
    expect(op0.apuracao.valorLiquido).toBe(154998.99);
  });

  // gc-07: os cinco Resultado e as reduções não colidem mais.
  it('separa os cinco Resultado e as reduções do imóvel (gc-07)', () => {
    expect(op0.apuracao.resultado1).toBe(54397.58);
    expect(op0.apuracao.resultado5).toBe(54397.58);
    expect(op0.apuracao).toHaveProperty('percentualReducao7713', 0);
    expect(op0.apuracao).toHaveProperty('valorReducaoFR1', 0);
    expect(op0.apuracao).toHaveProperty('valorReducaoOutroImovel', 0);
  });

  // gc-08: tabela de faixas de tributação, forma do registro 75 do .DBK.
  it('extrai a tabela de faixas de tributação nas três operações (gc-08)', () => {
    for (const op of [op0, op1, op2]) {
      expect(op.faixasTributacao).toHaveLength(1);
      expect(op.faixasTributacao[0].faixa1.total).toBeGreaterThan(0);
      expect(op.faixasTributacao[0].faixa4).toEqual({ total: 0, anterior: 0, atual: 0 });
    }
    expect(op0.faixasTributacao[0].faixa1.total).toBe(54397.58);
  });

  // gc-01: participação — corretagem não recebe o valor de alienação.
  it('não troca valor de alienação por corretagem na participação (gc-01)', () => {
    expect(op2.tipo).toBe('participacao');
    expect(op2.valorAlienacao).toBe(70622.48);
    expect(op2.custoCorretagem).toBe(2623.49);
  });

  // gc-10: espécie da participação.
  it('lê a espécie da participação (gc-10)', () => {
    expect(op2.especie).toBe('QUOTAS');
    expect(op2.naturezaOperacao).toBe('ALIENAÇÕES, RESGATES E OUTRAS TRANSFERÊNCIAS');
  });

  // gc-11: município e UF da sociedade.
  it('lê município e UF da sociedade (gc-11)', () => {
    expect(op2.sociedade).toMatchObject({
      nome: 'AJU GCP EMPRESA SENTINELA', cnpj: '55566677000183', municipio: 'SAO PAULO', uf: 'SP',
    });
  });

  // gc-05: consolidação da participação societária (não "do bem").
  it('lê a consolidação da participação societária (gc-05)', () => {
    expect(op2.consolidacaoBem.impostoDoExercicio).toBe(4106.62);
    expect(op2.consolidacaoBem.impostoTotal).toBe(4106.62);
    expect(op2.consolidacaoBem.impostoDevidoNoExercicio).toBe(4106.62);
  });

  // gc-09: quadro CUSTO DE AQUISIÇÃO da participação.
  it('lê o custo de aquisição detalhado da participação (gc-09)', () => {
    expect(op2.custosAquisicao).toHaveLength(1);
    expect(op2.custosAquisicao[0]).toMatchObject({
      especie: 'Quota', quantidade: 1234, custoMedio: 32.918534, custoTotal: 40621.47,
    });
    expect(op2.custoAquisicao).toBe(40621.47);
  });

  // gc-12: data da última parcela na alienação a prazo (bem móvel).
  it('lê a data da última parcela da alienação a prazo (gc-12)', () => {
    expect(op1.tipo).toBe('movel');
    expect(op1.dataUltimaParcela).toBe('2025-11-19');
    expect(op1.parcelas).toHaveLength(3);
  });

  // gc-04: alienação detalhada de moeda estrangeira em espécie.
  it('lê a alienação de moeda estrangeira em espécie (gc-04)', () => {
    const moeda = aju.ganhosCapitalOficial.moedaEspecie;
    expect(moeda.operacoes).toHaveLength(1);
    expect(moeda.operacoes[0]).toMatchObject({
      moeda: 'DÓLAR (ESTADOS UNIDOS)',
      adquirenteCpfCnpj: '22233344405',
      adquirenteNome: 'AJU GCE ADQUIRENTE',
      data: '2025-11-21',
      quantidade: 1234.56,
      valor: 8632.51,
      custoMedio: 5.371549,
      custoTotal: 6631.49,
      ganhoCapital: 2001.02,
    });
    // A totalização mensal continua lida.
    expect(moeda.mensal).toHaveLength(12);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: Resumo e cálculo do imposto', () => {
  let aju, esp, sai;
  beforeAll(async () => { aju = await extrair('AJU'); esp = await extrair('ESP'); sai = await extrair('SAI'); });

  // resumo-01: IMPOSTO A RESTITUIR vem numa row separada do rótulo (Δy=3).
  // SAI-01 é a única com restituição impressa (R$ 2.032,33).
  it('lê o imposto a restituir, mesmo o valor vindo na linha seguinte', () => {
    expect(sai.impostoDevido.impostoRestituir).toBe(2032.33);
    expect(aju.impostoDevido.impostoRestituir).toBe(0);
  });

  // resumo-02: evolução patrimonial de Espólio e Saída, cujos rótulos não têm
  // "em dd/mm/aaaa".
  it('lê o patrimônio final do espólio (partilha) e da saída (não residente)', () => {
    expect(esp.impostoDevido.bensAtualOficial).toBe(123401.41);
    expect(esp.impostoDevido.dividasAtualOficial).toBe(0);
    expect(sai.impostoDevido.bensAtualOficial).toBe(179804.84);
    expect(sai.impostoDevido.bensAnteriorOficial).toBe(24402.42);
  });

  // resumo-03: decomposição do rendimento tributável.
  it('lê as parcelas do rendimento tributável (PJ, acumulados, rural)', () => {
    const i = aju.impostoDevido;
    expect(i.rendimentosPjTitular).toBe(51101.11);
    expect(i.rendimentosPjDependentes).toBe(12201.21);
    expect(i.rendimentosAcumuladosDependentes).toBe(9811.06);
    expect(i.resultadoTributavelRural).toBe(120529.23);
    // O total impresso continua batendo.
    expect(i.rendimentosTributaveisTotal).toBe(211696.46);
  });

  // resumo-04: deduções, inclusive as de rótulo quebrado em duas linhas.
  it('lê as deduções, inclusive previdência com rótulo em duas linhas', () => {
    const i = aju.impostoDevido;
    expect(i.previdenciaOficialComplementar).toBe(6304.34);
    expect(i.previdenciaComplementar).toBe(4999.99);
    expect(i.previdenciaOficialRRA).toBe(812.07);
    expect(i.despesasInstrucao).toBe(3561.50);
    expect(i.pensaoJudicial).toBe(6006.28);
    expect(i.livroCaixa).toBe(3020.40);
    expect(i.totalDeducoes).toBe(33595.97);
  });

  // resumo-05: linhas intermediárias do cálculo do imposto devido.
  it('lê o cálculo do imposto devido (bruto, incentivo, I, RRA, alíquota efetiva)', () => {
    const i = aju.impostoDevido;
    expect(i.impostoDevidoBruto).toBe(38123.85);
    expect(i.deducaoIncentivo).toBe(1707.34);
    expect(i.impostoDevidoI).toBe(36416.51);
    expect(i.aliquotaEfetiva).toBe(17.20);
    expect(i.impostoDevidoTotal).toBe(36658.91);
  });

  // resumo-06: componentes do imposto pago.
  it('lê os componentes do imposto pago', () => {
    const i = aju.impostoDevido;
    expect(i.irrfTitular).toBe(4104.14);
    expect(i.irrfDependentes).toBe(1818.33);
    expect(i.carneLeaoTitular).toBe(918.80);
    expect(i.impostoComplementar).toBe(1901.11);
    expect(i.irrfRRA).toBe(4804.04);
    expect(i.impostoPagoTotal).toBe(13751.06);
  });

  // resumo-07: parcelamento / quota única.
  it('lê valor e número de quotas do parcelamento', () => {
    expect(aju.impostoDevido.valorQuota).toBe(22907.85);
    expect(aju.impostoDevido.numeroQuotas).toBe(1);
  });

  // resumo-08: bloco OUTRAS INFORMAÇÕES da evolução patrimonial.
  it('lê as outras informações (exigibilidade suspensa, depósitos, GC, RV)', () => {
    const i = aju.impostoDevido;
    expect(i.rendimentosExigibilidadeSuspensa).toBe(26413.87);
    expect(i.depositosJudiciais).toBe(11415.89);
    expect(i.impostoDevidoGanhosCapital).toBe(13824.36);
    expect(i.impostoDevidoRendaVariavel).toBe(862.82);
    expect(i.doacoesPartidosOficial).toBe(1201.44);
    expect(i.irFonteLei11033Ano).toBe(111.71);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: Rendimentos isentos e de tributação exclusiva', () => {
  let aju;
  const acha = (tipo, benef) => aju.rendimentos.find(r => r.tipo === tipo && (!benef || r.beneficiario === benef));
  beforeAll(async () => { aju = await extrair('AJU'); });

  // rend-05: a continuação do CABEÇALHO ("Pagadora"/"Pagadora") não pode virar
  // parte da descrição do código nem do nome da fonte. Código 99 (isento).
  it('não cola "Pagadora" no nome nem na ficha do código 99', () => {
    const r = acha('isento_0026', 'Titular');
    expect(r.descricao_ficha).toBe('Outros');
    expect(r.nome_fonte).not.toMatch(/Pagadora/);
  });

  // rend-06: no código 99 (única ficha com coluna Descrição), nome da fonte e
  // descrição são campos SEPARADOS, sem concatenação nem intercalação.
  it('separa nome da fonte e descrição no código 99', () => {
    const r = acha('isento_0026', 'Titular');
    expect(r.nome_fonte).toBe('AJU ISE GANHO ISENTO');
    expect(r.descricao).toBe('AJU ISE GANHO ISENTO');
  });

  // rend-07: doação/herança (código 14) — o CPF/CNPJ do doador vai para
  // cnpj_fonte, não para dentro do nome.
  it('coloca o documento do doador em cnpj_fonte, e não no nome (código 14)', () => {
    const r = acha('isento_0014', 'Titular');
    expect(r.cnpj_fonte).toBe('22233344405');
    expect(r.nome_fonte).toBe('AJU ISE DOACAO RECEBIDA');
    expect(r.nome_fonte).not.toMatch(/\d/);
  });

  // rend-08: 13º salário recebido pelos DEPENDENTES (código 08) — beneficiário
  // Dependente, não Titular fixo.
  it('marca o 13º dos dependentes como do dependente', () => {
    const r = acha('exclusivo_0008');
    expect(r.beneficiario).toBe('Dependente');
    expect(r.valor).toBe(1205.25);
  });

  // Prêmios de loteria (código 13→interno 14): só coluna Descrição, que vira o
  // nome da fonte. Garante que o ajuste de colunas não quebrou este caso.
  it('mantém a descrição de prêmios de loteria como nome da fonte', () => {
    const r = acha('exclusivo_0014');
    expect(r.nome_fonte).toBe('AJU EXC PREMIO');
    expect(r.cnpj_fonte).toBe('');
  });
});

describe.skipIf(!temPdfs)('PDF sintético: Atividade Rural (apuração, rebanho, participantes)', () => {
  let aju, esp, sai;
  beforeAll(async () => { aju = await extrair('AJU'); esp = await extrair('ESP'); sai = await extrair('SAI'); });

  // rural-03: opção pela forma de apuração do resultado (valor de texto).
  it('lê a opção pela forma de apuração do resultado', () => {
    expect(aju.apuracaoResultadoRuralOficial).toBeTruthy();
    expect(aju.apuracaoResultadoRuralOficial.opcaoApuracao).toBe('Pelo resultado');
  });

  // rural-04: em declaração sem atividade rural, a Apuração não pode ser
  // reportada como preenchida (ESP-01 e SAI-01 imprimem "Sem Informações").
  it.each([['ESP'], ['SAI']])('%s não cria objeto de apuração rural vazio', async (chave) => {
    const r = chave === 'ESP' ? esp : sai;
    expect(r.apuracaoResultadoRuralOficial).toBeNull();
    expect(r.estadoFichas['pdf:rural-brasil-apuracao'].estado).toBe('vazia');
  });

  // rural-07: participante rural com a marca de estrangeiro.
  it('marca se o participante é estrangeiro', () => {
    expect(aju.participantesRuraisOficial).toHaveLength(1);
    expect(aju.participantesRuraisOficial[0].estrangeiro).toBe(false);
    expect(aju.participantesRuraisOficial[0].imovelId).toBe(aju.imoveisRurais[0].id);
  });
});

describe('Dívidas: discriminação usa a coluna, não uma faixa fixa (dividas-03)', () => {
  // A discriminação de uma dívida pode ser empurrada para a direita pela
  // justificação e cair além de uma faixa fixa. Aqui o texto "SENTINELA
  // FINANCEIRA S.A." vem numa célula em x=250, à direita do início da coluna
  // de discriminação (114,8) e à esquerda da primeira coluna de valor (300,5),
  // e tem que continuar na discriminação — não ser descartado.
  const ANCORAS = { codigo: 23, disc: 114.8, val1: 300.5, val2: 384.6, pago: 518.8 };

  it('lê a discriminação da dívida pela coluna, incluindo texto justificado', () => {
    // Simula a leitura da linha de dívida como o parser faz: código, texto na
    // coluna disc (incl. um pedaço empurrado para x=250), e três valores.
    const linhaBase = {
      y: 697,
      cells: [
        { x: 23, text: '13' },
        { x: 120, text: 'CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO' },
        { x: 250, text: 'SENTINELA FINANCEIRA S.A.' },
        { x: 333.4, text: '91.801,71' },
        { x: 446.4, text: '72.802,72' },
        { x: 533.4, text: '19.003,73' },
      ],
    };
    const v = valoresDaLinhaDeDivida(linhaBase, ANCORAS);
    // O foco do dividas-03 é que os valores continuam corretos mesmo com texto
    // na faixa entre disc e val1: o texto em x=250 NÃO é confundido com valor.
    expect(v.situacao_anterior).toBe(91801.71);
    expect(v.situacao_atual).toBe(72802.72);
    expect(v.valor_pago).toBe(19003.73);
    expect(v.lidoPorOrdem).toBe(true);
  });
});

describe.skipIf(!temPdfs)('PDF sintético: discriminação das dívidas (não perde texto justificado)', () => {
  let aju;
  beforeAll(async () => { aju = await extrair('AJU'); });

  // A continuação "SENTINELA" da primeira dívida do AJU-01 vem numa row
  // seguinte e tem que estar na discriminação. Garante que a leitura por
  // coluna (dividas-03) não perdeu o texto.
  it('preserva a discriminação completa das dívidas do AJU-01', () => {
    expect(aju.dividas).toHaveLength(2);
    expect(aju.dividas[0].discriminacao).toBe('CNPJ 55.566.677/0001-83 - AJU DIV FINANCIAMENTO SENTINELA');
    expect(aju.dividas[1].discriminacao).toBe('CPF 222.333.444-05 - AJU DIV EMPRESTIMO PESSOAL');
  });
});

describe.skipIf(!temPdfs)('PDF sintético: detecção das fichas antes lidas como "não impressas"', () => {
  let esp, sai;
  beforeAll(async () => { esp = await extrair('ESP'); sai = await extrair('SAI'); });

  // Antes, o matcher devolvia null para estas três fichas e o estadoFichas
  // gravava presenca "ausente" / "não foi impressa" para fichas que ESTÃO
  // impressas. Auditoria de detecção (AUDITORIA-INDEPENDENTE-MATCHER-PDF.md).

  // ESP-01 imprime HERDEIROS / MEEIRO (com dois herdeiros) e INFORMAÇÕES DO
  // CÔNJUGE OU COMPANHEIRO(A).
  it('detecta herdeiros e cônjuge na declaração final de espólio', () => {
    expect(esp.fichasPdfObservadas.herdeiros).toBeTruthy();
    expect(esp.fichasPdfObservadas.conjuge).toBeTruthy();
    expect(esp.estadoFichas['pdf:herdeiros'].presenca).not.toBe('ausente');
    expect(esp.estadoFichas['pdf:conjuge'].presenca).not.toBe('ausente');
    expect(esp.estadoFichas['pdf:herdeiros'].motivo).not.toMatch(/não foi impressa/i);
  });

  // ESP-01 NÃO é declaração de saída: saida-definitiva continua ausente (correto).
  it('não inventa a ficha de saída definitiva no espólio', () => {
    expect(esp.fichasPdfObservadas['saida-definitiva']).toBeFalsy();
  });

  // SAI-01 imprime o cabeçalho SAÍDA da declaração de saída definitiva.
  it('detecta a ficha de saída definitiva na declaração de saída', () => {
    expect(sai.fichasPdfObservadas['saida-definitiva']).toBeTruthy();
    expect(sai.estadoFichas['pdf:saida-definitiva'].presenca).not.toBe('ausente');
  });

  // SAI-01 NÃO é espólio: herdeiros continua ausente (correto).
  it('não inventa herdeiros na declaração de saída', () => {
    expect(sai.fichasPdfObservadas.herdeiros).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// Modalidades que não são declaração de ajuste anual. Até aqui o app importava
// ESP-01 e SAI-01 e as exibia como se fossem ajuste anual comum: partilha,
// inventariante, herdeiros e condição de não residente eram detectados e
// jogados fora. Isso é erro de classificação fiscal, não de acabamento.
// Rows de prova: ESP-01 p1 r18 a r32 e p2 r3 a r6; SAI-01 p1 r20 a r25.
describe.skipIf(!temPdfs)('quadros de espólio e de saída definitiva', () => {
  let esp, sai, aju;
  beforeAll(async () => {
    esp = await extrair('ESP');
    sai = await extrair('SAI');
    aju = await extrair('AJU');
  });

  it('espólio: modalidade, ano do óbito e se ainda há bens a inventariar (ESP-01 p1 r19/r20)', () => {
    expect(esp.espolioOficial).toBeTruthy();
    expect(esp.espolioOficial.modalidade).toBe('Partilha');
    expect(esp.espolioOficial.anoObito).toBe('2025');
    expect(esp.espolioOficial.aindaHaBensAInventariar).toBe('Não');
  });

  it('espólio: a decisão judicial da partilha, com as duas datas (ESP-01 p1 r23 a r26)', () => {
    const e = esp.espolioOficial;
    expect(e.numeroProcessoJudicial).toBe('ESP-PROC-4101');
    expect(e.comarca).toBe('SAO PAULO');
    expect(e.varaCivel).toBe('41 V');
    expect(e.uf).toBe('SP');
    expect(e.dataDecisaoPartilha).toBe('22/12/2025');
    // O rótulo do trânsito em julgado quebra em duas linhas visuais e o valor
    // cai na segunda (p1 r26). Ler só a primeira perderia a data.
    expect(e.dataTransitoJulgado).toBe('23/12/2025');
  });

  it('espólio: inventariante e as três respostas do quadro do cônjuge (ESP-01 p1 r28 a r32)', () => {
    const e = esp.espolioOficial;
    expect(e.inventarianteCpf).toBe('666.777.888-30');
    expect(e.inventarianteNome).toBe('ESP INVENTARIANTE SENTINELA');
    expect(e.obitoAmbosConjuges).toBe('Não');
    expect(e.conjugeMeeiro).toBe('Não');
    expect(e.inventarioConjunto).toBe('Não');
  });

  it('espólio: a lista de herdeiros da declaração (ESP-01 p2 r5/r6)', () => {
    expect(esp.espolioOficial.herdeiros).toEqual([
      { cpf_cnpj: '77788899941', nome: 'ESP HERDEIRO UM' },
      { cpf_cnpj: '88899900078', nome: 'ESP HERDEIRO DOIS' },
    ]);
  });

  it('saída definitiva: procurador, data da condição de não residente e país (SAI-01 p1 r21 a r25)', () => {
    const s = sai.saidaDefinitivaOficial;
    expect(s).toBeTruthy();
    // r21 traz "CPF do procurador: 101.202.303-64" numa célula só, com rótulo
    // e valor juntos, e o nome do procurador no par seguinte.
    expect(s.procuradorCpf).toBe('101.202.303-64');
    expect(s.procuradorNome).toBe('SAI PROCURADOR SENTINELA');
    expect(s.procuradorEndereco).toBe('4201 AUDIT EXIT AVENUE, SUITE 42, MIAMI/FL, 33101');
    expect(s.dataNaoResidente).toBe('24/12/2025');
    expect(s.paisDestino).toBe('249 - ESTADOS UNIDOS DA AMÉRICA');
  });

  it('saída definitiva: campo em branco não vira campo preenchido (SAI-01 p1 r24)', () => {
    // "Data da caracterização da condição de residente no país" vem vazia. Se
    // virasse string vazia, a tela afirmaria que a pessoa voltou a ser
    // residente, que é o oposto do que a declaração diz.
    expect(sai.saidaDefinitivaOficial.dataResidente).toBeUndefined();
  });

  it('cada modalidade só aparece na declaração que é dela', () => {
    expect(esp.saidaDefinitivaOficial).toBeNull();
    expect(sai.espolioOficial).toBeNull();
    // A declaração de ajuste anual não é nenhuma das duas.
    expect(aju.espolioOficial).toBeNull();
    expect(aju.saidaDefinitivaOficial).toBeNull();
  });
});
