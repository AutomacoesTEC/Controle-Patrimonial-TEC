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
    linha('Total recebido nas parcelas', op.calculoImposto.totalRecebidoParcelas),
    linha('Total do custo de aquisição das parcelas', op.calculoImposto.totalAquisicaoParcelas),
    linha('Ganho de capital total', op.calculoImposto.ganhoCapitalTotal),
    linha('Alíquota média', op.calculoImposto.aliquotaMedia, 'percentual'),
    linha('Imposto devido', op.calculoImposto.impostoDevido),
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

  const anteriores = bloco('anteriores', 'Alienações anteriores', [
    texto('Já houve alienação parcial deste bem', op.houveAlienacaoParcialAnterior === true ? 'Sim'
      : op.houveAlienacaoParcialAnterior === false ? 'Não' : ''),
    linha('Soma dos ganhos de alienações anteriores', op.ganhoAlienacoesAnteriores),
  ]);

  return [identificacao, apuracao, calculo, consolidacao, anteriores].filter(Boolean);
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
