// O demonstrativo de Ganho de Capital como a declaração o imprime, operação
// por operação.
//
// A tela mostrava uma linha de resumo por operação (bem, datas, custo, valor,
// ganho, imposto). A extração entrega 24 campos por operação, e o que ficava
// de fora é justamente o que explica o número: no imóvel, a CADEIA DE
// REDUÇÕES que leva do resultado bruto ao ganho tributável; na alienação a
// prazo, o ganho e o imposto proporcionais de cada parcela.
//
// Lógica pura, testável contra o retorno real do parser, pelo mesmo motivo de
// resumoDeclaracao.js e modalidadeDeclaracao.js.
//
// RIGOR FISCAL, e é o ponto desta tela: no ganho de capital de IMÓVEL o valor
// tributável não é "alienação menos custo". Entre um e outro entram, nesta
// ordem, a redução do art. 18 da Lei 7.713/1988 (para imóvel adquirido até
// 1988) e os dois fatores de redução do art. 40 da Lei 11.196/2005 (FR1 e
// FR2), mais a redução por aplicação em outro imóvel. Mostrar só o começo e o
// fim da conta esconde exatamente a parte que a pessoa precisa conferir.

const ehNumero = (v) => typeof v === 'number' && Number.isFinite(v);

const linha = (rotulo, valor, formato = 'moeda') => (
  ehNumero(valor) ? { rotulo, valor, formato } : null
);
const texto = (rotulo, valor) => (valor ? { rotulo, valor, formato: 'texto' } : null);

const bloco = (id, titulo, linhas) => {
  const presentes = linhas.filter(Boolean);
  return presentes.length > 0 ? { id, titulo, linhas: presentes } : null;
};

export const NOME_FICHA_GC = {
  imovel: 'Bens imóveis',
  movel: 'Bens móveis',
  participacao: 'Participação societária',
  moeda: 'Moeda estrangeira em espécie',
};

// A cadeia impressa do imóvel, na ordem do documento. Cada redução aparece com
// o percentual e o valor, mesmo zerados, porque a declaração os imprime e é
// contra ela que se confere.
export function blocoApuracaoImovel(apuracao) {
  if (!apuracao) return null;
  return bloco('apuracao', 'Apuração do ganho de capital', [
    linha('Valor de alienação', apuracao.valorAlienacao),
    linha('Custo de corretagem', apuracao.custoCorretagem),
    linha('Valor líquido da alienação', apuracao.valorLiquido),
    linha('Ganho de capital, resultado 1', apuracao.resultado1),
    linha('Percentual de redução (Lei nº 7.713/1988)', apuracao.percentualReducao7713, 'percentual'),
    linha('Valor de redução (Lei nº 7.713/1988)', apuracao.valorReducao7713),
    linha('Ganho de capital, resultado 2', apuracao.resultado2),
    linha('Percentual de redução (Lei nº 11.196/2005, FR1)', apuracao.percentualReducaoFR1, 'percentual'),
    linha('Valor de redução (Lei nº 11.196/2005, FR1)', apuracao.valorReducaoFR1),
    linha('Ganho de capital, resultado 3', apuracao.resultado3),
    linha('Percentual de redução (Lei nº 11.196/2005, FR2)', apuracao.percentualReducaoFR2, 'percentual'),
    linha('Valor de redução (Lei nº 11.196/2005, FR2)', apuracao.valorReducaoFR2),
    linha('Ganho de capital, resultado 4', apuracao.resultado4),
    linha('Percentual de redução por aplicação em outro imóvel', apuracao.percentualReducaoOutroImovel, 'percentual'),
    linha('Valor de redução por aplicação em outro imóvel', apuracao.valorReducaoOutroImovel),
    linha('Ganho de capital, resultado 5', apuracao.resultado5),
    linha('Ganho de capital', apuracao.ganhoCapital),
  ]);
}

// Móvel e participação não têm a cadeia de reduções: o ganho sai direto do
// valor líquido menos o custo. Inventar as linhas de redução aqui sugeriria
// um benefício que essas famílias não têm.
export function blocoApuracaoSimples(apuracao) {
  if (!apuracao) return null;
  return bloco('apuracao', 'Apuração do ganho de capital', [
    linha('Valor de alienação', apuracao.valorAlienacao),
    linha('Custo de corretagem', apuracao.custoCorretagem),
    linha('Valor líquido da alienação', apuracao.valorLiquido),
    linha('Ganho de capital', apuracao.ganhoCapital),
  ]);
}

export function blocosOperacaoGanhoCapital(op) {
  if (!op) return [];

  const identificacao = bloco('identificacao', 'Identificação', [
    texto('Bem', op.especificacao),
    texto('Endereço', op.endereco),
    texto('Espécie', op.especie),
    texto('Natureza da operação', op.natureza?.descricao),
    texto('Sociedade', op.sociedade?.nome),
    texto('Município e UF da sociedade', op.sociedade?.municipio
      ? [op.sociedade.municipio, op.sociedade.uf].filter(Boolean).join(' / ')
      : ''),
  ]);

  const apuracao = op.tipo === 'imovel'
    ? blocoApuracaoImovel(op.apuracao)
    : blocoApuracaoSimples(op.apuracao);

  // Imposto DEVIDO e imposto PAGO em blocos vizinhos mas distintos, mesma
  // regra do RESUMO: são figuras diferentes e somá-las não significa nada.
  const calculo = op.calculoImposto ? bloco('calculo', op.alienacaoAPrazo
    ? 'Cálculo do imposto, alienação a prazo'
    : 'Cálculo do imposto, alienação à vista', [
    // Na ordem em que a declaração imprime as linhas do quadro: a prazo,
    // AJU-01 p18 r4/r5 (cabeçalho de duas linhas) e r8 (linha TOTAL); à
    // vista, AJU-01 p20 r39 a r44.
    linha('Total recebido nas parcelas', op.calculoImposto.totalRecebidoParcelas),
    linha('Total da corretagem das parcelas', op.calculoImposto.totalCorretagemParcelas),
    linha('Total líquido das parcelas', op.calculoImposto.totalLiquidoParcelas),
    linha('Total do custo de aquisição das parcelas', op.calculoImposto.totalAquisicaoParcelas),
    linha('Ganho de capital total', op.calculoImposto.ganhoCapitalTotal),
    linha('Alíquota média', op.calculoImposto.aliquotaMedia, 'percentual'),
    linha('Imposto devido', op.calculoImposto.impostoDevido),
    // RIGOR FISCAL: o imposto retido na fonte da Lei nº 11.033/2004 é
    // COMPENSADO com o imposto devido do ganho de capital, e o que a pessoa
    // efetivamente deve é o resultado dessa compensação. Mostrar só o imposto
    // devido bruto e o imposto pago, pulando as duas linhas do meio, faz a
    // tela afirmar um valor devido que a declaração não afirma sempre que
    // houver retenção. As duas só aparecem quando a ficha as imprime.
    linha('IR na fonte (Lei nº 11.033/2004)', op.calculoImposto.irFonteLei11033),
    linha('Imposto devido após compensação', op.calculoImposto.impostoDevidoAposCompensacao),
    linha('Imposto pago', op.calculoImposto.impostoPago),
  ]) : null;

  // A consolidação fecha a operação e diz PARA ONDE o ganho vai: as duas
  // últimas linhas são os valores que esta operação transfere para a ficha de
  // rendimentos isentos e para a de tributação exclusiva/definitiva. Sem elas,
  // o elo entre o demonstrativo e aquelas fichas fica invisível.
  const consolidacao = op.consolidacaoBem ? bloco('consolidacao', 'Consolidação do bem', [
    linha('Imposto diferido de anos anteriores', op.consolidacaoBem.impostoDiferidoAnosAnteriores),
    linha('Imposto do exercício', op.consolidacaoBem.impostoDoExercicio),
    linha('Imposto devido no exercício', op.consolidacaoBem.impostoDevidoNoExercicio),
    linha('Imposto diferido para anos posteriores', op.consolidacaoBem.impostoDiferidoAnosPosteriores),
    linha('Imposto total', op.consolidacaoBem.impostoTotal),
    linha('IR na fonte (Lei nº 11.033/2004)', op.consolidacaoBem.irFonteLei11033),
    linha('Imposto pago', op.consolidacaoBem.impostoPago),
    linha('Vai para rendimentos isentos e não tributáveis', op.consolidacaoBem.rendimentoIsento),
    linha('Vai para rendimentos de tributação definitiva', op.consolidacaoBem.rendimentoExclusivo),
  ]) : null;

  // As perguntas que a ficha imprime, com a resposta que a declaração deu.
  //
  // Elas não são preenchimento de formulário: cada uma CONDICIONA a apuração
  // que aparece nos outros blocos. "Bem atualizado de acordo com a Lei nº
  // 14.973/2024?" diz se o custo de aquisição é o valor atualizado com
  // tributação definitiva, e a resposta muda o ganho apurado. "Houve
  // edificação, ampliação ou reforma?" diz se existe a tabela de custos
  // acrescidos. "A prestação final foi recebida no ano?" fecha a alienação a
  // prazo. Nada disso aparecia na tela, e nenhuma delas é dedutível dos
  // números: a resposta só existe porque está escrita no documento.
  //
  // Conferidas no AJU-01: p14 r25/r26/r33 e p15 r21 (imóvel), p17 r15/r16/r26
  // e p18 r9 (móvel), p20 r14 e r28 (participação).
  const perguntas = (Array.isArray(op.perguntasImpressas) ? op.perguntasImpressas : [])
    .filter(q => q && q.pergunta && q.resposta);
  const blocoPerguntas = perguntas.length > 0
    ? { id: 'perguntas', titulo: 'Perguntas da ficha', linhas: perguntas.map(q => ({ rotulo: q.pergunta, valor: q.resposta, formato: 'texto' })) }
    : null;

  const anteriores = bloco('anteriores', 'Alienações anteriores', [
    // Quando as perguntas impressas vieram, esta linha já está entre elas: o
    // caminho .DBK não as traz, e é para ele que a linha continua existindo.
    blocoPerguntas ? null : texto('Já houve alienação parcial deste bem', op.houveAlienacaoParcialAnterior === true ? 'Sim'
      : op.houveAlienacaoParcialAnterior === false ? 'Não' : ''),
    linha('Soma dos ganhos de alienações anteriores', op.ganhoAlienacoesAnteriores),
  ]);

  return [identificacao, apuracao, blocoPerguntas, calculo, consolidacao, anteriores].filter(Boolean);
}

// Parcelas da alienação a prazo. Cada uma tem ganho e imposto PROPORCIONAIS,
// porque no parcelado o imposto é devido conforme o recebimento, e não de uma
// vez na data da alienação.
export function parcelasDaOperacao(op) {
  return (Array.isArray(op?.parcelas) ? op.parcelas : []).map((p, i) => ({ ...p, numero: i + 1 }));
}

// Faixas de tributação do ganho, na forma que a declaração imprime: quatro
// faixas de alíquota mais a linha TOTAL.
export const ALIQUOTAS_FAIXA_GC = ['15%', '17,5%', '20%', '22,5%'];

export function faixasDaOperacao(op) {
  const tabela = (Array.isArray(op?.faixasTributacao) ? op.faixasTributacao : [])[0];
  if (!tabela) return [];
  return [
    { rotulo: 'Até R$ 5.000.000,00', aliquota: ALIQUOTAS_FAIXA_GC[0], ...tabela.faixa1 },
    { rotulo: 'De R$ 5.000.000,01 até R$ 10.000.000,00', aliquota: ALIQUOTAS_FAIXA_GC[1], ...tabela.faixa2 },
    { rotulo: 'De R$ 10.000.000,01 até R$ 30.000.000,00', aliquota: ALIQUOTAS_FAIXA_GC[2], ...tabela.faixa3 },
    { rotulo: 'Acima de R$ 30.000.000,00', aliquota: ALIQUOTAS_FAIXA_GC[3], ...tabela.faixa4 },
    { rotulo: 'TOTAL', aliquota: '', total: tabela.total.total, anterior: tabela.total.anterior, atual: tabela.total.atual, ehTotal: true },
  ];
}

// Conferência ENTRE FICHAS, que é a mais forte que esta declaração permite
// aqui: o que as operações de ganho de capital transferem para a tributação
// definitiva tem que ser o mesmo valor que a ficha de rendimentos exclusivos
// informa no código 02, "Ganhos de capital na alienação de bens e/ou direitos".
//
// O código 04, de moeda estrangeira em espécie, fica FORA de propósito: ele
// vem da ficha de moedas, que tem apuração própria e não sai destas operações.
export function conferenciaGanhoCapitalContraFichaExclusiva(operacoes = [], rendimentos = []) {
  const lista = (v) => (Array.isArray(v) ? v : []);
  const transferido = lista(operacoes)
    .reduce((s, op) => s + (Number(op?.consolidacaoBem?.rendimentoExclusivo) || 0), 0);
  const naFicha = lista(rendimentos)
    .filter(r => r?.tipo === 'exclusivo_0002')
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);
  if (transferido === 0 && naFicha === 0) return null;
  if (Math.abs(transferido - naFicha) < 0.02) return null;
  return `As operações de ganho de capital transferem ${transferido.toFixed(2)} para a tributação definitiva, e a ficha de rendimentos exclusivos informa ${naFicha.toFixed(2)} no código 02.`;
}

// Conferências que a própria declaração permite. Divergência vira aviso, e
// nunca correção automática: quem decide o número é o documento.
export function conferenciasGanhoCapital(operacoes = []) {
  const avisos = [];
  const perto = (a, b) => Math.abs(a - b) < 0.02;
  // `= []` no parâmetro só cobre undefined. Um `null` chegando aqui, vindo de
  // estado antigo ou de um quadro sem operações, lançava "operacoes is not
  // iterable" e derrubava a tela inteira de Ganhos de Capital, levando junto os
  // números que estavam certos. Achado no ataque de 31/08/2026.
  for (const op of (Array.isArray(operacoes) ? operacoes : [])) {
    const nome = op.especificacao || NOME_FICHA_GC[op.tipo] || 'operação';
    const ap = op.apuracao;
    if (ap && ehNumero(ap.valorAlienacao) && ehNumero(ap.custoCorretagem) && ehNumero(ap.valorLiquido)
      && !perto(ap.valorAlienacao - ap.custoCorretagem, ap.valorLiquido)) {
      avisos.push(`Em "${nome}", o valor líquido informado não é a alienação menos a corretagem.`);
    }
    // No imóvel, o fim da cadeia de reduções tem que ser o ganho apurado.
    if (op.tipo === 'imovel' && ap && ehNumero(ap.resultado5) && ehNumero(ap.ganhoCapital)
      && !perto(ap.resultado5, ap.ganhoCapital)) {
      avisos.push(`Em "${nome}", o resultado 5 da apuração não fecha com o ganho de capital informado.`);
    }
    const parcelas = op.parcelas || [];
    if (parcelas.length > 0 && ehNumero(op.calculoImposto?.totalRecebidoParcelas)) {
      const soma = parcelas.reduce((s, p) => s + (p.valorRecebido || 0), 0);
      if (!perto(soma, op.calculoImposto.totalRecebidoParcelas)) {
        avisos.push(`Em "${nome}", as parcelas somam ${soma.toFixed(2)} e o total informado é ${op.calculoImposto.totalRecebidoParcelas.toFixed(2)}.`);
      }
    }
    const tabela = (op.faixasTributacao || [])[0];
    if (tabela) {
      const somaFaixas = ['faixa1', 'faixa2', 'faixa3', 'faixa4'].reduce((s, k) => s + (tabela[k]?.total || 0), 0);
      if (!perto(somaFaixas, tabela.total?.total || 0)) {
        avisos.push(`Em "${nome}", as faixas de tributação somam ${somaFaixas.toFixed(2)} e o total da tabela é ${(tabela.total?.total || 0).toFixed(2)}.`);
      }
    }
  }
  return avisos;
}

// Junta a tabela oficial (`apuracaoGanhoCapital`, uma linha por operação) com o
// demonstrativo completo (`ganhosCapitalOficial.operacoes`). São duas listas
// separadas no retorno do parser, e a tela mostrava as duas empilhadas: a mesma
// operação aparecia duas vezes, em formatos diferentes.
//
// A CHAVE É O `id`, NUNCA O NOME DO BEM. Dois veículos da mesma marca e modelo
// se distinguem só pela placa, e há operação sem nome nenhum (participação
// societária vem com `bem` vazio). Casar por nome fundiria dois bens diferentes
// numa linha só, ou deixaria a operação sem nome fora da tela.
// Conferido nas duas declarações reais: ids únicos nas duas listas e iguais
// entre elas, inclusive nos dois FIAT UNO de placas diferentes.
//
// A união é pelos dois lados de propósito: uma operação que exista só numa das
// listas continua aparecendo, marcada, em vez de sumir em silêncio.
export function linhasApuracaoGanhoCapital(apuracao, operacoes) {
  const resumos = Array.isArray(apuracao) ? apuracao : [];
  const detalhes = Array.isArray(operacoes) ? operacoes : [];
  const porId = new Map();
  for (const d of detalhes) if (d && d.id != null) porId.set(d.id, d);

  const linhas = [];
  const usados = new Set();
  resumos.forEach((r, i) => {
    if (!r) return;
    const detalhe = r.id != null ? porId.get(r.id) : undefined;
    if (detalhe) usados.add(r.id);
    linhas.push({ chave: r.id != null ? `r${r.id}` : `r-idx${i}`, resumo: r, detalhe: detalhe || null });
  });
  detalhes.forEach((d, i) => {
    if (!d || (d.id != null && usados.has(d.id))) return;
    linhas.push({ chave: d.id != null ? `d${d.id}` : `d-idx${i}`, resumo: null, detalhe: d });
  });
  return linhas;
}

// Como a operação terminou, dito a partir dos números da própria declaração e
// não de suposição. A distinção importa: no imóvel o ganho pode ser zero mesmo
// com alienação acima do custo, porque a redução da Lei nº 7.713/1988 e os
// fatores da Lei nº 11.196/2005 entram entre um e outro. Chamar isso de
// prejuízo seria erro de classificação fiscal.
export function resultadoDaOperacao(resumo) {
  if (!resumo) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const ganho = num(resumo.ganhoCapital);
  const alienacao = num(resumo.valorAlienacao);
  const custo = num(resumo.custoAquisicao);
  if (ganho == null) return null;
  if (ganho > 0) return { tipo: 'ganho', texto: 'Ganho de capital apurado' };
  if (alienacao != null && custo != null && alienacao < custo) {
    return { tipo: 'prejuizo', texto: 'Prejuízo na alienação, sem ganho tributável' };
  }
  return { tipo: 'semGanho', texto: 'Sem ganho tributável' };
}
