// Motor de consulta por período livre (podendo cruzar anos). O
// demonstrativoConciliacao de demonstrativos.js opera sobre UM ano de dados
// (state.bens etc. valem para o ano-calendário corrente); aqui a gente
// costura os snapshots anuais do histórico para responder "de 01/03/2024 a
// 30/06/2026" como um período só:
//
// - ESTOQUE (bens/dívidas nas pontas): reconstruído no ano da data de corte,
//   usando o snapshot daquele ano (situacao_anterior + movimentações datadas
//   até a data). O ano corrente usa o estado vivo; anos anteriores usam
//   state.historico[ano].
// - FLUXO (rendimentos/pagamentos/ganhos/rural): somado ano a ano, cada ano
//   contribuindo só com o trecho do período que cai dentro dele.
//
// Ano sem dado nenhum no meio do intervalo NÃO é inventado: entra em
// `anosSemDado` para a UI sinalizar, e contribui zero nos fluxos. Lógica
// pura, sem React, pelo mesmo motivo de demonstrativos.js: testável sem
// montar componente.

import {
  totalBensAteData,
  totalDividas,
  totalRendimentos,
  resultadoAtividadeRuralPeriodo,
  ganhosApuradosPeriodo,
  totalPagamentos,
  totalPagamentosDiversos,
  fecharDemonstrativo,
  totalDoacoesPeriodo,
  rendaVariavelDoPeriodo,
  bensAlienadosSemValorDeVenda,
  aplicacoesResgatadasSemRendimento,
  bemZeradoSemMovimentacaoNoAno,
} from './demonstrativos';
import { snapshotHasData } from './reducer';
import { linhasFinanceirasDoAno } from './rendaVariavelMensal';

const anoDeUmaData = (data) => Number(String(data).slice(0, 4));
const maxData = (a, b) => (a >= b ? a : b);
const minData = (a, b) => (a <= b ? a : b);

// Dados de um ano específico: o estado vivo se for o ano-calendário em
// edição, senão o snapshot arquivado. null quando não existe dado do ano.
export function dadosDoAno(state, ano) {
  if (ano === state.anoCalendario) return state;
  return state.historico?.[ano] || null;
}

// Anos que têm dado real: snapshots do histórico com conteúdo (ano vazio
// herdado de versão antiga não conta) + ano corrente, se ele tiver dado.
export function anosComDado(state) {
  const anos = new Set(
    Object.keys(state.historico || {}).map(Number).filter(y => snapshotHasData(state.historico[y]))
  );
  if (state.anoCalendario != null) anos.add(state.anoCalendario);
  return [...anos].sort((a, b) => a - b);
}

// Demonstrativo de Conciliação para um período livre, cruzando quantos anos
// forem necessários. Mesmo formato de retorno de demonstrativoConciliacao,
// mais `anosSemDado`/`anosCobertos` para a UI ser honesta sobre lacunas.
export function demonstrativoPeriodo(state, dataDe, dataAte) {
  const vazio = {
    varPatrimonial: {
      bensDe: 0, bensAte: 0, deltaBens: 0,
      dividaComumDe: 0, dividaComumAte: 0, deltaDividaComum: 0,
      dividaRuralDe: 0, dividaRuralAte: 0, deltaDividaRural: 0,
      dividaDe: 0, dividaAte: 0, deltaDivida: 0, total: 0,
    },
    rendimentos: { tributavelPjBruto: 0, tributavelPjPrevidencia: 0, tributavelPjIrrf: 0, tributavelPJ: 0, tributavelPfExterior: 0, tributavelRra: 0, demaisTributaveis: 0, isentoValor: 0, exclusivoBruto: 0, exclusivoIrrf: 0, exclusivoLiquido: 0, totalGeral: 0 },
    ganhos: { vendas: [], total: 0, semIrrfCount: 0, daDeclaracao: false, possiveisDuplicidades: [] },
    saldoDeCaixaGeral: 0,
    pagamentosEfetuados: 0,
    pagamentosDiversos: 0,
    totalDoacoes: 0,
    temDoacaoImportada: false,
    saldoDeCaixa: 0,
    rendaVariavelPerda: 0,
    pendenciasAlienacao: [],
    aplicacoesSemRendimento: [],
    rendaVariavelMeses: [],
    rendaVariavelResultado: 0,
    rendaVariavelImposto: 0,
    rendaVariavelComValor: false,
    anosSemDado: [],
    anosCobertos: [],
  };
  if (!dataDe || !dataAte || dataDe > dataAte) return vazio;

  const anoIni = anoDeUmaData(dataDe);
  const anoFim = anoDeUmaData(dataAte);

  // Estoque nas pontas: reconstruído no ano da respectiva data de corte.
  const dadosIni = dadosDoAno(state, anoIni);
  const dadosFim = anoFim === anoIni ? dadosIni : dadosDoAno(state, anoFim);
  const anosSemDado = [];
  if (!dadosIni) anosSemDado.push(anoIni);
  if (!dadosFim && anoFim !== anoIni) anosSemDado.push(anoFim);

  // bensRurais NÃO entram na Variação Patrimonial (mesmo critério de
  // demonstrativos.js/variacaoPatrimonialTotal): o bem rural já passa pelo
  // Livro Caixa da Atividade Rural via despesa de investimento, dedutível
  // integralmente no resultado (que já entra no demonstrativo como
  // rendimento) — contar o bem aqui também duplicaria o gasto. dividasRurais
  // SIM entram, porque o empréstimo rural não passa pelo livro-caixa e é a
  // fonte real do dinheiro.
  //
  // dividaComum/dividaRural ficam separados (além do combinado dividaDe/
  // dividaAte, usado no `total`) porque o Dashboard exibe as duas origens em
  // linhas próprias — pedido da usuária pra não misturar visualmente Dívidas
  // e Ônus Reais com Dívida Rural.
  const bensDe = dadosIni ? totalBensAteData(dadosIni.bens, dataDe, 'de') : 0;
  const bensAte = dadosFim ? totalBensAteData(dadosFim.bens, dataAte, 'ate') : 0;
  const dividaComumDe = dadosIni ? totalDividas(dadosIni.dividas, 'de', dataDe) : 0;
  const dividaComumAte = dadosFim ? totalDividas(dadosFim.dividas, 'ate', dataAte) : 0;
  const dividaRuralDe = dadosIni ? totalDividas(dadosIni.dividasRurais, 'de', dataDe) : 0;
  const dividaRuralAte = dadosFim ? totalDividas(dadosFim.dividasRurais, 'ate', dataAte) : 0;
  const dividaDe = dividaComumDe + dividaRuralDe;
  const dividaAte = dividaComumAte + dividaRuralAte;
  const varPatrimonial = {
    bensDe, bensAte, deltaBens: bensAte - bensDe,
    dividaComumDe, dividaComumAte, deltaDividaComum: dividaComumAte - dividaComumDe,
    dividaRuralDe, dividaRuralAte, deltaDividaRural: dividaRuralAte - dividaRuralDe,
    dividaDe, dividaAte, deltaDivida: dividaAte - dividaDe,
    total: -(bensAte - bensDe) + (dividaAte - dividaDe),
  };

  // Fluxos: cada ano do intervalo contribui com o trecho que lhe cabe.
  const rend = { tributavelPjBruto: 0, tributavelPjPrevidencia: 0, tributavelPjIrrf: 0, tributavelPJ: 0, tributavelPfExterior: 0, tributavelRra: 0, demaisTributaveis: 0, isentoValor: 0, exclusivoBruto: 0, exclusivoIrrf: 0, exclusivoLiquido: 0, totalGeral: 0 };
  const vendas = [];
  const possiveisDuplicidades = [];
  const pendenciasAlienacao = [];
  const aplicacoesSemRendimento = [];
  let semIrrfCount = 0;
  let rendaVariavelPerda = 0;
  let pagamentosEfetuados = 0;
  let pagamentosDiversos = 0;
  let totalDoacoes = 0;
  // Só as doações que vieram do ARQUIVO carregam a ressalva de layout não
  // confirmado. Doação cadastrada à mão (ADD_DOACAO_*, que marca
  // origem 'manual') foi digitada pela usuária e não tem layout nenhum a
  // confirmar — avisar ali dizia à pessoa para conferir na declaração um
  // valor que ela mesma acabou de digitar. Achado ao auditar a declaração de
  // um segundo contribuinte em 21/08/2026.
  let temDoacaoImportada = false;
  const rendaVariavelMeses = [];
  // Ganho líquido e imposto de Renda Variável do período. Só ficam confiáveis
  // quando a importação foi por PDF; `rendaVariavelComValor` é o que a tela usa
  // para não exibir um zero que na verdade significa "não foi possível ler".
  let rendaVariavelResultado = 0;
  let rendaVariavelImposto = 0;
  let rendaVariavelComValor = false;
  const anosCobertos = [];

  for (let ano = anoIni; ano <= anoFim; ano++) {
    const dados = dadosDoAno(state, ano);
    if (!dados) {
      if (!anosSemDado.includes(ano)) anosSemDado.push(ano);
      continue;
    }
    anosCobertos.push(ano);
    const trechoDe = maxData(dataDe, `${ano}-01-01`);
    const trechoAte = minData(dataAte, `${ano}-12-31`);

    const rural = resultadoAtividadeRuralPeriodo(dados.lancamentosRurais, trechoDe, trechoAte,
      { meses: dados.receitasDespesasRuraisOficial, ano });
    const r = totalRendimentos(dados.rendimentos, rural, trechoDe, trechoAte);
    for (const k of Object.keys(rend)) rend[k] += r[k];

    const g = ganhosApuradosPeriodo(dados, trechoDe, trechoAte);
    vendas.push(...g.vendas);
    semIrrfCount += g.semIrrfCount;
    possiveisDuplicidades.push(...(g.possiveisDuplicidades || []));
    // Bens que encolheram no período sem preço de venda conhecido (achado 04):
    // a lista atravessa os anos junto com o resto do fluxo.
    pendenciasAlienacao.push(...bensAlienadosSemValorDeVenda(dados, trechoDe, trechoAte));
    aplicacoesSemRendimento.push(...aplicacoesResgatadasSemRendimento(dados, trechoDe, trechoAte));

    pagamentosEfetuados += totalPagamentos(dados.pagamentos, trechoDe, trechoAte);
    pagamentosDiversos += totalPagamentosDiversos(dados.pagamentosDiversos, trechoDe, trechoAte);

    // Doações: ficha anual da declaração (Oficial, lida do PDF — sem data
    // por item, então entra o ano inteiro sempre que o ano cai dentro do
    // período, mesmo critério de "estoque anual" que Ganho de Capital
    // Oficial etc. já usam). É dinheiro que efetivamente saiu do caixa da
    // pessoa física, então reduz o Saldo de Caixa igual Pagamentos —
    // ficaria de fora da reconciliação (e o Saldo de Caixa pareceria
    // "sobrando" dinheiro que na verdade virou doação).
    totalDoacoes += totalDoacoesPeriodo({ ...dados, anoCalendario: ano }, trechoDe, trechoAte);
    // Importada = sem a marca 'manual' (o import grava a lista direto, sem
    // carimbar origem, então "não é manual" é o teste que também vale para
    // dado gravado antes desta distinção existir).
    temDoacaoImportada = temDoacaoImportada || [
      ...(dados.doacoesEfetuadasOficial || []),
      ...(dados.doacoesPartidosOficial || []),
      ...(dados.doacoesEcaIdosoOficial || []),
    // Só a doação importada por PDF carrega a ressalva de layout: pelo `.DBK`
    // as posições são oficiais (registros 34/90/91/92), e pelo cadastro manual
    // não há layout nenhum a confirmar.
    ].some(d => d.origem !== 'manual' && !d.layoutOficial);

    // Renda Variável. Pelo .DBK vem só o MÊS de cada ficha mensal (o campo de
    // valor do registro 76 nunca pôde ser decifrado, ver nota no import); pelo
    // PDF vêm também os valores. Aqui os dois casos convivem: `mes` sempre, e
    // o resultado do mês só quando a ficha o traz.
    //
    // Um mesmo mês pode aparecer DUAS vezes, porque titular e dependentes são
    // fichas separadas na declaração — daí a deduplicação por ano+mês para a
    // linha de meses, enquanto o resultado SOMA as duas (é o ganho líquido do
    // conjunto declarado, que é como a própria declaração consolida).
    const rv = rendaVariavelDoPeriodo(linhasFinanceirasDoAno(dados), ano, trechoDe, trechoAte, dados.rendimentos);
    for (const m of rv.meses) {
      if (!rendaVariavelMeses.some(x => x.ano === m.ano && x.mes === m.mes)) rendaVariavelMeses.push(m);
    }
    rendaVariavelResultado += rv.resultado;
    rendaVariavelImposto += rv.imposto;
    // Só a perda entra no caixa; o ganho já vem pela ficha de exclusivos.
    // Ver o comentário de rendaVariavelDoPeriodo em demonstrativos.js.
    rendaVariavelPerda += rv.ajusteFinanceiro;
    rendaVariavelComValor = rendaVariavelComValor || rv.comValor;
  }

  const rendimentos = rend;
  // `daDeclaracao`: toda venda do período veio da Apuração do Ganho de Capital
  // importada, e não de movimentação lançada (ver ganhosApuradosPeriodo). A
  // tela usa isso só para dizer de onde saiu o número.
  const ganhos = {
    vendas,
    total: vendas.reduce((s, v) => s + v.ganhoLiquido, 0),
    semIrrfCount,
    daDeclaracao: vendas.length > 0 && vendas.every(v => v.daDeclaracao),
    possiveisDuplicidades,
  };
  // Fórmula final vem de demonstrativos.js — uma cópia só, ver
  // `fecharDemonstrativo` (achado 09 da auditoria de 24/08/2026).
  return fecharDemonstrativo({
    varPatrimonial, rendimentos, ganhos,
    rendaVariavelPerda, pagamentosEfetuados, pagamentosDiversos, totalDoacoes,
    extras: {
      temDoacaoImportada,
      rendaVariavelMeses,
      rendaVariavelResultado,
      rendaVariavelImposto,
      rendaVariavelComValor,
      pendenciasAlienacao,
      aplicacoesSemRendimento,
      anosSemDado: anosSemDado.sort((a, b) => a - b),
      anosCobertos,
    },
  });
}

// Fim de cada mês entre duas datas (inclusive), em ISO. Usado só dentro de
// um ano só — ver serieEvolucao.
function fimDeCadaMesEntre(dataDe, dataAte) {
  let [ano, mes] = dataDe.split('-').map(Number);
  const [anoFim, mesFim] = dataAte.split('-').map(Number);
  const pontos = [];
  while (ano < anoFim || (ano === anoFim && mes <= mesFim)) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    pontos.push(`${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
  }
  return pontos;
}

// Série temporal da evolução patrimonial dentro do período.
// Dentro de UM ano só (o caso mais comum, já que o Dashboard abre no
// ano-calendário selecionado): um ponto por mês, do início ao fim do
// período — sem isso, o intervalo virava sempre 1 ponto só (sempre na data
// "Até", ignorando a "De"), e o gráfico parecia não acompanhar as datas
// escolhidas.
// Cruzando anos: um ponto por ano COM dado (na data de corte daquele ano
// dentro do período) — granularidade mensal ano a ano viraria ruído demais
// numa consulta de vários anos. Ano sem dado não entra — o gráfico nunca
// inventa ano intermediário zerado.
export function serieEvolucao(state, dataDe, dataAte) {
  if (!dataDe || !dataAte || dataDe > dataAte) return [];

  const anoDe = anoDeUmaData(dataDe);
  const anoAte = anoDeUmaData(dataAte);

  // bensRurais fica de fora (mesmo critério do Demonstrativo de Conciliação
  // — ver variacaoPatrimonialTotal/demonstrativoPeriodo): sem isso, "Bens"
  // aqui contava um valor diferente do que "Bens e Direitos" mostra em todo
  // resto do app (BensPage, a tabela de conciliação), inclusive um bem
  // rural sem `grupo` da taxonomia de Bens e Direitos não faz sentido
  // nenhum misturado nesse total. dividasRurais continua somando junto de
  // dividas, mesmo raciocínio de sempre (empréstimo rural não passa pelo
  // livro-caixa da atividade rural).
  const pontoNaData = (dados, ano, data) => {
    const bens = totalBensAteData(dados.bens, data, 'ate');
    const dividas = totalDividas(dados.dividas, 'ate', data) + totalDividas(dados.dividasRurais, 'ate', data);
    return { ano, data, bens, dividas, liquido: bens - dividas };
  };

  if (anoDe === anoAte) {
    const dados = dadosDoAno(state, anoDe);
    if (!dados) return [];
    const cortes = [dataDe, ...fimDeCadaMesEntre(dataDe, dataAte).map(c => minData(c, dataAte))];
    const semRepetido = [...new Set(cortes)];
    return semRepetido.map(corte => pontoNaData(dados, anoDe, corte));
  }

  const pontos = [];
  for (let ano = anoDe; ano <= anoAte; ano++) {
    const dados = dadosDoAno(state, ano);
    if (!dados) continue;
    const corte = minData(dataAte, `${ano}-12-31`);
    pontos.push(pontoNaData(dados, ano, corte));
  }
  return pontos;
}

// Totais de estoque numa data de corte qualquer (cards do Dashboard): bens,
// dívidas, líquido e contagens — reconstruídos no ano da data.
export function totaisNaData(state, dataCorte, lado = 'ate') {
  if (!dataCorte) return null;
  const dados = dadosDoAno(state, anoDeUmaData(dataCorte));
  if (!dados) return null;
  // bensRurais fica de fora — mesmo critério de serieEvolucao/pontoNaData
  // logo acima (ver o comentário lá): "Bens" precisa significar a mesma
  // coisa em toda tela do Dashboard, e igual à BensPage.
  const totalBens = totalBensAteData(dados.bens, dataCorte, lado);
  const totalDividasComuns = totalDividas(dados.dividas, lado, dataCorte);
  const totalDividasRurais = totalDividas(dados.dividasRurais, lado, dataCorte);
  const totalDividas_ = totalDividasComuns + totalDividasRurais;
  // ACHADO 15 da auditoria de 24/08/2026: os cards contavam itens por um
  // critério e as páginas de cadastro por outro, com o MESMO rótulo.
  //   - Bens: o card dizia 74 e a página Bens e Direitos dizia 73, porque só
  //     a página esconde bem zerado sem movimentação (não existe no ano).
  //   - Dívidas: o card dizia "7 itens, R$ 2.652.738,92" somando a dívida
  //     rural, e a página Dívidas e Ônus Reais dizia "1 item, R$ 36.000,00".
  //     Dois lugares com o mesmo nome e R$ 2,6 milhões de diferença.
  // A contagem de bens agora usa o mesmo critério da página, e a de dívidas
  // vem separada para o card poder nomear as duas origens.
  const bensVisiveis = (dados.bens || []).filter(b => !bemZeradoSemMovimentacaoNoAno(b));
  return {
    totalBens,
    totalDividas: totalDividas_,
    totalDividasComuns,
    totalDividasRurais,
    liquido: totalBens - totalDividas_,
    qtdBens: bensVisiveis.length,
    qtdDividas: (dados.dividas || []).length + (dados.dividasRurais || []).length,
    qtdDividasComuns: (dados.dividas || []).length,
    qtdDividasRurais: (dados.dividasRurais || []).length,
  };
}


// Lista as movimentações (de bens ou de dívidas) de UMA coleção
// (`categoria`: 'bens' | 'dividas' | 'dividasRurais') com data dentro do
// período, cruzando quantos anos forem necessários — o detalhe por trás de
// clicar numa linha "Variação de..." no Dashboard ("quais lançamentos
// compõem esse saldo"). Cada item volta com a discriminação/nome de quem
// sofreu a movimentação, pra identificar de qual bem/dívida ela é. Sem data
// (`de`/`ate` vazios) não dá pra saber o que está "dentro" do período —
// devolve lista vazia em vez de tentar adivinhar.
export function movimentacoesNoPeriodo(state, categoria, dataDe, dataAte) {
  if (!dataDe || !dataAte || dataDe > dataAte) return [];
  const anoIni = anoDeUmaData(dataDe);
  const anoFim = anoDeUmaData(dataAte);
  const resultado = [];
  for (let ano = anoIni; ano <= anoFim; ano++) {
    const dados = dadosDoAno(state, ano);
    if (!dados) continue;
    for (const item of (dados[categoria] || [])) {
      for (const m of (item.movimentacoes || [])) {
        if (m.data && m.data >= dataDe && m.data <= dataAte) {
          resultado.push({ ...m, discriminacao: item.discriminacao || '', itemId: item.id });
        }
      }
    }
  }
  return resultado.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
}
