// Monta, a partir do `impostoDevido` importado, os blocos do RESUMO exatamente
// como a declaração os imprime. É lógica pura (sem React) pelo mesmo motivo de
// reducer.js e demonstrativos.js: dá para testar contra o retorno real do
// parser, sem montar componente.
//
// Por que existe: a extração passou a entregar 61 campos deste quadro e a tela
// Relatório IRPF exibia quatro. O resto do trabalho de conferência (a pessoa
// com a declaração impressa ao lado, conferindo linha a linha) não tinha para
// onde olhar dentro do app.
//
// Os rótulos são os IMPRESSOS pelo programa da Receita, conferidos contra
// AUDITORIA/rows-pdfjs/AJU-01.rows.txt, páginas 40 e 41. Não invente rótulo
// mais "amigável" aqui: o valor desta tela é casar com o papel.
//
// REGRA FISCAL que este arquivo preserva, e que não pode ser "simplificada":
// imposto DEVIDO e imposto PAGO são blocos separados, e o resultado é um dos
// dois, nunca os dois: ou há SALDO DE IMPOSTO A PAGAR, ou há IMPOSTO A
// RESTITUIR. Somar, subtrair ou fundir esses blocos troca o sentido do quadro.

// Valor do quadro. Aceita número e também texto que seja um número inteiro,
// porque descartar uma linha que TEM valor deixa o quadro exibido menor que o
// da declaração, e nada avisa. Texto que não é número continua fora: exibi-lo
// como moeda produziria "R$ NaN" na tela.
//
// Hoje nenhum caminho produz texto aqui (o parser devolve número), então isto é
// defesa, não correção de bug observado. Achado no ataque de 31/08/2026.
const comoNumero = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
};
const ehNumero = (v) => comoNumero(v) !== null;

// Campo ausente (null/undefined) significa "este modelo de declaração não
// informa", e é diferente de zero, que é "informou e é zero". O primeiro sai
// da lista; o segundo aparece, porque a declaração impressa também o imprime.
const linha = (rotulo, valor, formato = 'moeda') => {
  const n = comoNumero(valor);
  return n === null ? null : { rotulo, valor: n, formato };
};

const bloco = (id, titulo, linhas, total = null) => {
  const presentes = linhas.filter(Boolean);
  if (presentes.length === 0) return null;
  return { id, titulo, linhas: presentes, total: total && ehNumero(total.valor) ? total : null };
};

export function blocosResumoDeclaracao(imposto) {
  if (!imposto) return [];

  const simplificada = imposto.modeloDeclaracao === 'simplificada';

  const rendimentos = bloco('rendimentos', 'Rendimentos tributáveis', [
    linha('Recebidos de Pessoa Jurídica pelo titular', imposto.rendimentosPjTitular),
    linha('Recebidos de Pessoa Jurídica pelos dependentes', imposto.rendimentosPjDependentes),
    linha('Recebidos de Pessoa Física/Exterior pelo titular', imposto.rendimentosPfExteriorTitular),
    linha('Recebidos de Pessoa Física/Exterior pelos dependentes', imposto.rendimentosPfExteriorDependentes),
    linha('Recebidos acumuladamente pelo titular', imposto.rendimentosAcumuladosTitular),
    linha('Recebidos acumuladamente pelos dependentes', imposto.rendimentosAcumuladosDependentes),
    linha('Resultado tributável da Atividade Rural', imposto.resultadoTributavelRural),
  ], { rotulo: 'TOTAL', valor: imposto.rendimentosTributaveisTotal });

  // No modelo simplificado o desconto substitui TODAS as deduções legais, e é
  // ele que ocupa o lugar do total. Dependente e despesa médica não existem
  // nesse modelo, e os campos vêm zerados de propósito (ver registro 18).
  const deducoes = simplificada
    ? bloco('deducoes', 'Desconto simplificado', [
      linha('Desconto simplificado', imposto.descontoSimplificado),
    ], { rotulo: 'TOTAL', valor: imposto.totalDeducoes })
    : bloco('deducoes', 'Deduções', [
      linha('Contribuições às previdências oficial e complementar', imposto.previdenciaOficialComplementar),
      linha('Contribuição à previdência oficial (rendimentos recebidos acumuladamente)', imposto.previdenciaOficialRRA),
      linha('Contribuição à previdência complementar', imposto.previdenciaComplementar),
      linha('Dependentes', imposto.dependentes),
      linha('Despesas com instrução', imposto.despesasInstrucao),
      linha('Despesas médicas', imposto.despesasMedicas),
      linha('Pensão alimentícia judicial', imposto.pensaoJudicial),
      linha('Pensão alimentícia por escritura pública', imposto.pensaoEscritura),
      linha('Pensão alimentícia judicial (rendimentos recebidos acumuladamente)', imposto.pensaoJudicialRRA),
      linha('Livro caixa', imposto.livroCaixa),
    ], { rotulo: 'TOTAL', valor: imposto.totalDeducoes });

  const devido = bloco('devido', 'Imposto devido', [
    linha('Base de cálculo do imposto', imposto.baseCalculo),
    linha('Imposto devido', imposto.impostoDevidoBruto),
    linha('Dedução de incentivo', imposto.deducaoIncentivo),
    linha('Imposto devido I', imposto.impostoDevidoI),
    linha('Imposto devido RRA', imposto.impostoDevidoRRA),
    linha('Imposto Lei 14.754/2023', imposto.lei14754Imposto),
    // O programa da Receita imprime este rótulo SEM acento ("Aliquota efetiva
    // (%)", AUDITORIA/rows-pdfjs/AJU-01.rows.txt:208, p7 r35, e :1458, p40 r36).
    // Aqui ele vai acentuado de propósito: a regra de casar com o papel é sobre
    // QUAL rótulo e em que ordem, não sobre reproduzir erro de ortografia numa
    // tela nossa. Não "corrija" isto de volta.
    linha('Alíquota efetiva (%)', imposto.aliquotaEfetiva, 'percentual'),
  ], { rotulo: 'Total do imposto devido', valor: imposto.impostoDevidoTotal });

  const pago = bloco('pago', 'Imposto pago', [
    linha('Imposto retido na fonte do titular', imposto.irrfTitular),
    linha('Imposto retido na fonte dos dependentes', imposto.irrfDependentes),
    linha('Carnê-Leão do titular', imposto.carneLeaoTitular),
    linha('Carnê-Leão dos dependentes', imposto.carneLeaoDependentes),
    linha('Imposto complementar', imposto.impostoComplementar),
    linha('Imposto pago no exterior', imposto.impostoPagoExterior),
    linha('Imposto retido na fonte (Lei nº 11.033/2004)', imposto.irFonteLei11033Pago),
    linha('Imposto retido RRA', imposto.irrfRRA),
  ], { rotulo: 'Total do imposto pago', valor: imposto.impostoPagoTotal });

  // Ou paga, ou restitui. A declaração imprime os dois rótulos, cada um com o
  // seu valor, e um deles é zero. Mostrar os dois lado a lado sem essa
  // distinção faria a tela sugerir que existem duas obrigações ao mesmo tempo.
  const aRestituir = comoNumero(imposto.impostoRestituir) ?? 0;
  const aPagar = comoNumero(imposto.saldoPagar) ?? 0;
  // Se a declaração não informa NENHUM dos dois, não há resultado a mostrar. A
  // versão anterior caía no ramo "aPagar === 0 e aRestituir === 0" e produzia
  // um "Saldo de imposto a pagar R$ 0,00" para um quadro que não traz nada,
  // afirmando um resultado que a declaração não tem. Achado no ataque de
  // 31/08/2026.
  const informouResultado = ehNumero(imposto.saldoPagar) || ehNumero(imposto.impostoRestituir);
  const linhasResultado = [];
  if (informouResultado && (aPagar > 0 || (aPagar === 0 && aRestituir === 0))) {
    linhasResultado.push(linha('Saldo de imposto a pagar', aPagar));
  }
  if (aRestituir > 0) linhasResultado.push(linha('Imposto a restituir', aRestituir));
  if (aPagar > 0) {
    linhasResultado.push(linha('Valor da quota', imposto.valorQuota));
    linhasResultado.push(linha('Número de quotas', imposto.numeroQuotas, 'inteiro'));
  }
  const resultado = bloco('resultado', 'Resultado da declaração', linhasResultado);

  // O título diz "informada na declaração" de propósito: a tela Relatório tem
  // um card "Evolução Patrimonial" logo abaixo, calculado pelo app a partir
  // dos bens importados. São duas medidas diferentes do mesmo fato, e ver os
  // dois títulos iguais na mesma tela levaria a pessoa a achar que um deles
  // está errado. Confirmado no navegador: os dois aparecem juntos.
  const evolucao = bloco('evolucao', 'Evolução patrimonial informada na declaração', [
    linha('Bens e direitos na situação anterior', imposto.bensAnteriorOficial),
    linha('Bens e direitos na situação atual', imposto.bensAtualOficial),
    linha('Dívidas e ônus reais na situação anterior', imposto.dividasAnteriorOficial),
    linha('Dívidas e ônus reais na situação atual', imposto.dividasAtualOficial),
  ]);

  const outras = bloco('outras', 'Outras informações', [
    linha('Rendimentos isentos e não tributáveis', imposto.rendimentosIsentosOficial),
    linha('Rendimentos sujeitos à tributação exclusiva/definitiva', imposto.rendimentosExclusivoOficial),
    linha('Rendimentos tributáveis com imposto com exigibilidade suspensa', imposto.rendimentosExigibilidadeSuspensa),
    linha('Depósitos judiciais do imposto', imposto.depositosJudiciais),
    linha('Imposto pago sobre Ganhos de Capital', imposto.impostoPagoGanhosCapital),
    linha('Imposto pago sobre Ganhos de Capital em moeda estrangeira', imposto.impostoPagoGanhosCapitalMoeda),
    linha('Total do imposto retido na fonte (Lei nº 11.033/2004)', imposto.irFonteLei11033Ano),
    linha('Imposto pago sobre Renda Variável', imposto.impostoPagoRendaVariavel),
    linha('Doações a Partidos Políticos e Candidatos a Cargos Eletivos', imposto.doacoesPartidosOficial),
    linha('Imposto a pagar sobre Ganho de Capital em moeda estrangeira em espécie', imposto.impostoPagarGanhosCapitalMoeda),
    linha('Imposto diferido dos Ganhos de Capital', imposto.impostoDiferidoGanhosCapital),
    linha('Imposto devido sobre Ganhos de Capital', imposto.impostoDevidoGanhosCapital),
    linha('Imposto devido sobre ganhos líquidos em Renda Variável', imposto.impostoDevidoRendaVariavel),
    linha('Imposto devido sobre Ganhos de Capital em moeda estrangeira', imposto.impostoDevidoGanhosCapitalMoeda),
  ]);

  return [rendimentos, deducoes, devido, pago, resultado, evolucao, outras].filter(Boolean);
}

// Conferência aritmética que a própria declaração permite: o total de cada
// bloco tem que fechar com a soma das linhas dele. Serve para avisar quando a
// extração perdeu uma linha, em vez de exibir um total que não bate com o que
// está logo acima dele.
export function conferenciasResumo(imposto) {
  const avisos = [];
  const soma = (...valores) => valores
    .filter(v => typeof v === 'number' && Number.isFinite(v))
    .reduce((s, v) => s + v, 0);
  const perto = (a, b) => Math.abs(a - b) < 0.02;

  if (ehNumero(imposto?.rendimentosTributaveisTotal)) {
    const somado = soma(
      imposto.rendimentosPjTitular, imposto.rendimentosPjDependentes,
      imposto.rendimentosPfExteriorTitular, imposto.rendimentosPfExteriorDependentes,
      imposto.rendimentosAcumuladosTitular, imposto.rendimentosAcumuladosDependentes,
      imposto.resultadoTributavelRural,
    );
    if (!perto(somado, imposto.rendimentosTributaveisTotal)) {
      avisos.push(`As linhas de rendimentos tributáveis somam ${somado.toFixed(2)}, e o total informado na declaração é ${imposto.rendimentosTributaveisTotal.toFixed(2)}.`);
    }
  }

  // Só no modelo completo: no simplificado o total É o desconto, não a soma
  // de linha nenhuma.
  if (ehNumero(imposto?.totalDeducoes) && imposto.modeloDeclaracao !== 'simplificada') {
    const somado = soma(
      imposto.previdenciaOficialComplementar, imposto.previdenciaOficialRRA,
      imposto.previdenciaComplementar, imposto.dependentes, imposto.despesasInstrucao,
      imposto.despesasMedicas, imposto.pensaoJudicial, imposto.pensaoEscritura,
      imposto.pensaoJudicialRRA, imposto.livroCaixa,
    );
    if (!perto(somado, imposto.totalDeducoes)) {
      avisos.push(`As linhas de deduções somam ${somado.toFixed(2)}, e o total informado na declaração é ${imposto.totalDeducoes.toFixed(2)}.`);
    }
  }

  if (ehNumero(imposto?.impostoPagoTotal)) {
    const somado = soma(
      imposto.irrfTitular, imposto.irrfDependentes, imposto.carneLeaoTitular,
      imposto.carneLeaoDependentes, imposto.impostoComplementar, imposto.impostoPagoExterior,
      imposto.irFonteLei11033Pago, imposto.irrfRRA,
    );
    if (!perto(somado, imposto.impostoPagoTotal)) {
      avisos.push(`As linhas de imposto pago somam ${somado.toFixed(2)}, e o total informado na declaração é ${imposto.impostoPagoTotal.toFixed(2)}.`);
    }
  }

  return avisos;
}
