// Demonstrativo de Conciliação Patrimonial: a mesma técnica de "evolução
// patrimonial a descoberto" que a planilha original (VARIAÇÃO PATRIMONIAL.xls)
// já usava — Bens/Dívidas são ESTOQUE (situação num ponto no tempo, De/Até);
// Rendimentos/Pagamentos/Ganhos são FLUXO (soma do que aconteceu no período).
// Fórmulas conferidas ao centavo contra as abas VAR PATRIMONIAL2024 e
// VAR PATRIMONIAL2025 da planilha real da usuária (ver
// ~/PROJETOS/Planilha Eudúcio/VARIAÇÃO PATRIMONIAL.xls) — ver
// demonstrativos.test.js, que reproduz os dois anos como regressão.
//
// Lógica pura, sem React, pelo mesmo motivo do reducer.js: testável sem
// montar componente.

import { linhasComunsDoAno } from './rendaVariavelMensal';
import { arredondarCentavos } from '../utils/formatters';

const emDataOuAntes = (data, corte) => !!data && (!corte || data <= corte);

// Bem com situação anterior E atual zeradas e nenhuma movimentação no ano: ele
// não existe neste ano-calendário — foi vendido ou baixado num ano anterior e o
// rollover só carregou o zero adiante. Não aparece nas listagens nem entra nas
// contagens exibidas. O terceiro critério distingue esse caso do bem que está
// SENDO baixado justamente neste ano, que continua aparecendo.
//
// Mora aqui, e não em cada tela, porque estava definido três vezes (BensPage,
// AtividadeRuralPage e, por omissão, os cards do Dashboard, que não aplicavam
// o critério e por isso contavam 74 bens onde a página contava 73 — achado 15
// da auditoria de 24/08/2026).
export const bemZeradoSemMovimentacaoNoAno = (bem) => (parseFloat(bem.situacao_anterior) || 0) === 0
  && (parseFloat(bem.situacao_atual) || 0) === 0
  && (bem.movimentacoes || []).length === 0;

// Um dia antes de uma data ISO (aaaa-mm-dd). "De" é o INÍCIO do período de
// consulta — o saldo anterior tem que ser da véspera, não do próprio dia,
// senão uma movimentação cadastrada exatamente no dia "De" ficava escondida
// dentro do saldo anterior em vez de contar como variação do período.
//
// A conta é feita INTEIRAMENTE em UTC. A versão anterior construía a data com
// `new Date(\`${iso}T00:00:00\`)`, que o motor interpreta no fuso LOCAL, e
// devolvia com `toISOString()`, que converte para UTC — dois erros que só se
// cancelam em fuso negativo. Em qualquer fuso a leste de Greenwich a função
// errava um dia a mais (auditoria de 24/08/2026: com TZ=Europe/Berlin,
// diaAnterior('2025-01-01') devolvia '2024-12-30'), deslocando a véspera do
// saldo anterior e fazendo uma movimentação da véspera ser contada dentro do
// período além de já estar no saldo de abertura. O app roda na máquina do
// usuário final, onde o fuso não é escolha nossa.
export function diaAnterior(dataIso) {
  const [ano, mes, dia] = String(dataIso).split('-').map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
// Sem filtro ativo (dataDe e dataAte ambos vazios), conta o item mesmo sem
// `data` — registros de rendimento/pagamento cadastrados antes desse campo
// existir não podem sumir do total só porque não tinha onde informar a
// data. Com filtro ativo, um item sem data não entra (não dá pra saber se
// cai dentro do período escolhido).
const noPeriodo = (data, dataDe, dataAte) => {
  if (!dataDe && !dataAte) return true;
  if (!data) return false;
  return (!dataDe || data >= dataDe) && (!dataAte || data <= dataAte);
};

// Reconstrói a situação de um bem numa data de corte, a partir da
// situacao_anterior + movimentações até aquela data (inclusive).
//
// Um bem sem NENHUMA movimentação registrada (comum: acabou de ser
// importado, ainda não foi editado neste ano) não tem como ser
// reconstruído numa data do meio do caminho — o salto de anterior pra
// atual não tem data nenhuma associada. Nesse caso a resposta depende do
// lado da comparação: "de" (início do período) assume, na falta de outra
// informação, que a mudança AINDA NÃO tinha acontecido (usa a situação
// anterior); "ate" (fim do período) assume que ela JÁ tinha acontecido
// (usa a situação atual). Essa convenção fecha certo no caso mais comum —
// o ano inteiro, De=01/01 a Até=hoje/31-12 — e é conservadora nos casos de
// sub-período em que a data exata da mudança é mesmo desconhecida.
function aplicarMovimentoBem(situacao, m) {
  if (m.tipo === 'compra' || m.tipo === 'benfeitoria') return situacao + m.valor;
  if (m.tipo === 'venda_parcial') return Math.max(0, situacao - m.valor);
  if (m.tipo === 'venda_total' || m.tipo === 'baixa') return 0;
  if (m.tipo === 'ajuste') return m.valor;
  return situacao;
}

// Reaplica movimentações já confirmadas pela usuária sobre um novo saldo
// declarado. É usado na importação de retificadora: o valor oficial novo é a
// base, e somente os eventos manuais posteriores são reaplicados em ordem.
export function reaplicarMovimentacoesBem(saldoDeclarado, movimentacoes = []) {
  return arredondarCentavos(ordenarPorData(movimentacoes).reduce(
    aplicarMovimentoBem,
    parseFloat(saldoDeclarado) || 0,
  ));
}

// Mesma conta SEM o piso em zero. Serve só para MEDIR quanto do caminho de
// situacao_anterior até situacao_atual as movimentações explicam (o
// `explicadoPelasMovimentacoes` logo abaixo), nunca para exibir saldo.
//
// BUG REAL que motivou a separação (auditoria de 21/08/2026): usar a versão
// COM piso nessa medição fazia a movimentação ser contada DUAS VEZES. Um bem
// cadastrado no ano (anterior 0, atual 350.000 digitado direto no
// formulário) e depois vendido parcialmente por 100.000 tinha
// "explicado" = max(0, 0 - 100.000) = 0 em vez de -100.000; o salto sem data
// virava 250.000 em vez de 350.000; e a venda era subtraída de novo em cima
// dele, devolvendo 150.000 onde o certo é 250.000. O piso continua valendo
// na aplicação final, que é onde ele faz sentido (saldo exibido não fica
// negativo). Ver o teste de regressão em demonstrativos.test.js.
function aplicarMovimentoBemSemPiso(situacao, m) {
  if (m.tipo === 'compra' || m.tipo === 'benfeitoria') return situacao + m.valor;
  if (m.tipo === 'venda_parcial') return situacao - m.valor;
  if (m.tipo === 'venda_total' || m.tipo === 'baixa') return 0;
  if (m.tipo === 'ajuste') return m.valor;
  return situacao;
}

const ordenarPorData = (movs) =>
  [...movs].sort((a, b) => (a.data || '').localeCompare(b.data || '') || (a.id || 0) - (b.id || 0));

export function situacaoBemAteData(bem, dataCorte, lado = 'ate') {
  const movs = bem.movimentacoes || [];
  if (!dataCorte || movs.length === 0) {
    return lado === 'de' ? bem.situacao_anterior : bem.situacao_atual;
  }
  // As movimentações registradas explicam só uma PARTE do caminho de
  // situacao_anterior até situacao_atual: o resto ("salto sem data") é o
  // que já mudou antes de qualquer movimentação existir — bem importado ou
  // cadastrado com um valor atual diferente do anterior direto no
  // formulário. Sem isso, um bem que tem ESSE salto e TAMBÉM alguma
  // movimentação datada perdia o salto inteiro na reconstrução (o corte por
  // data ficava sempre menor que o valor de verdade). Mesma convenção do
  // bem sem NENHUMA movimentação (documentada acima): "ate" assume que o
  // salto sem data já aconteceu, "de" assume que ainda não.
  const explicadoPelasMovimentacoes = ordenarPorData(movs).reduce(aplicarMovimentoBemSemPiso, bem.situacao_anterior);
  const saltoSemData = bem.situacao_atual - explicadoPelasMovimentacoes;

  const corteReal = lado === 'de' ? diaAnterior(dataCorte) : dataCorte;
  const movsAteCorte = ordenarPorData(movs.filter(m => emDataOuAntes(m.data, corteReal)));
  const inicio = bem.situacao_anterior + (lado === 'ate' ? saltoSemData : 0);
  return movsAteCorte.reduce(aplicarMovimentoBem, inicio);
}

export function totalBensAteData(listaBens, dataCorte, lado = 'ate') {
  return (listaBens || []).reduce((s, b) => s + situacaoBemAteData(b, dataCorte, lado), 0);
}

// Recalcula a situação atual de um bem depois que uma movimentação foi
// excluída da lista (ver reducer.js, DELETE_MOVIMENTACAO_BEM): reaplica as
// movimentações restantes, na mesma ordem por data, sobre
// situacao_anterior + o "salto sem data" (mesmo raciocínio de
// situacaoBemAteData acima) — assim, excluir uma movimentação nunca apaga
// de quebra a diferença entre anterior/atual que já existia antes de
// qualquer movimentação (bem importado, ou editado manualmente antes da 1ª
// movimentação).
export function situacaoBemAposExclusao(bem, movimentacoesRestantes) {
  const movsOriginais = bem.movimentacoes || [];
  const explicadoPelasMovimentacoes = ordenarPorData(movsOriginais).reduce(aplicarMovimentoBemSemPiso, bem.situacao_anterior);
  const saltoSemData = bem.situacao_atual - explicadoPelasMovimentacoes;
  return arredondarCentavos(ordenarPorData(movimentacoesRestantes).reduce(aplicarMovimentoBem, bem.situacao_anterior + saltoSemData));
}

// Reconstrói o saldo devedor de uma dívida numa data de corte, a partir da
// situacao_anterior + movimentações datadas (contratação soma, amortização
// subtrai sem passar de zero, quitação zera, ajuste substitui) — mesma
// lógica de situacaoBemAteData, com os tipos de dívida.
//
// Migração suave: dívida SEM movimentação registrada (importada ou
// cadastrada antes desse recurso existir) não tem como ser reconstruída no
// meio do ano — vale a convenção conservadora de sempre: "de" usa a
// situação anterior, "ate" usa a atual.
function aplicarMovimentoDivida(saldo, m) {
  if (m.tipo === 'contratacao') return saldo + m.valor;
  if (m.tipo === 'amortizacao') return Math.max(0, saldo - m.valor);
  if (m.tipo === 'quitacao') return 0;
  if (m.tipo === 'ajuste') return m.valor;
  return saldo;
}

export function reaplicarMovimentacoesDivida(saldoDeclarado, movimentacoes = []) {
  return arredondarCentavos(ordenarPorData(movimentacoes).reduce(
    aplicarMovimentoDivida,
    parseFloat(saldoDeclarado) || 0,
  ));
}

// Sem piso, pelo mesmo motivo de `aplicarMovimentoBemSemPiso` (ver o
// comentário lá em cima): só para medir o "explicado pelas movimentações".
// Caso real da auditoria de 21/08/2026: dívida cadastrada com saldo de
// 800.000 direto no formulário e depois amortizada em 200.000 aparecia no
// Dashboard por 400.000, com a amortização descontada duas vezes, enquanto a
// tela de Dívidas, o Relatório para IRPF e o .xlsx mostravam os 600.000
// corretos.
function aplicarMovimentoDividaSemPiso(saldo, m) {
  if (m.tipo === 'contratacao') return saldo + m.valor;
  if (m.tipo === 'amortizacao') return saldo - m.valor;
  if (m.tipo === 'quitacao') return 0;
  if (m.tipo === 'ajuste') return m.valor;
  return saldo;
}

export function situacaoDividaAteData(divida, dataCorte, lado = 'ate') {
  const movs = divida.movimentacoes || [];
  const anterior = parseFloat(divida.situacao_anterior) || 0;
  const atual = parseFloat(divida.situacao_atual) || 0;
  if (!dataCorte || movs.length === 0) {
    return lado === 'de' ? anterior : atual;
  }
  // Mesmo raciocínio de situacaoBemAteData: o salto sem data (dívida
  // importada/cadastrada com anterior≠atual antes de qualquer movimentação)
  // segue a convenção "ate" já aconteceu / "de" ainda não, em vez de sumir
  // quando a dívida também tem movimentação datada.
  const explicadoPelasMovimentacoes = ordenarPorData(movs).reduce(aplicarMovimentoDividaSemPiso, anterior);
  const saltoSemData = atual - explicadoPelasMovimentacoes;

  const corteReal = lado === 'de' ? diaAnterior(dataCorte) : dataCorte;
  const movsAteCorte = ordenarPorData(movs.filter(m => emDataOuAntes(m.data, corteReal)));
  const inicio = anterior + (lado === 'ate' ? saltoSemData : 0);
  return movsAteCorte.reduce(aplicarMovimentoDivida, inicio);
}

// Mesma técnica de situacaoBemAposExclusao acima, para dívida.
export function situacaoDividaAposExclusao(divida, movimentacoesRestantes) {
  const movsOriginais = divida.movimentacoes || [];
  const anterior = parseFloat(divida.situacao_anterior) || 0;
  const atual = parseFloat(divida.situacao_atual) || 0;
  const explicadoPelasMovimentacoes = ordenarPorData(movsOriginais).reduce(aplicarMovimentoDividaSemPiso, anterior);
  const saltoSemData = atual - explicadoPelasMovimentacoes;
  return arredondarCentavos(ordenarPorData(movimentacoesRestantes).reduce(aplicarMovimentoDivida, anterior + saltoSemData));
}

// Totais do card "Evolução Patrimonial" do Relatório para IRPF: uma FOTO do
// ano-calendário inteiro (situação anterior x situação atual do snapshot
// daquele ano), sem reconstrução por data — diferente do Demonstrativo do
// Dashboard, que responde por um período livre.
//
// O CRITÉRIO DE INCLUSÃO, porém, é o mesmo dos dois lados, e mora aqui para
// não voltar a divergir: BENS conta só a ficha Bens e Direitos; DÍVIDA conta
// Dívidas e Ônus Reais MAIS a Dívida Rural. A justificativa completa, com a
// base legal, está no comentário de `variacaoPatrimonialTotal` mais abaixo.
export function totaisEvolucaoPatrimonial({ bens = [], dividas = [], dividasRurais = [] } = {}) {
  const somar = (lista, campo) => (lista || []).reduce((s, item) => s + (parseFloat(item[campo]) || 0), 0);
  const bensAnterior = somar(bens, 'situacao_anterior');
  const bensAtual = somar(bens, 'situacao_atual');
  const dividaComumAnterior = somar(dividas, 'situacao_anterior');
  const dividaComumAtual = somar(dividas, 'situacao_atual');
  const dividaRuralAnterior = somar(dividasRurais, 'situacao_anterior');
  const dividaRuralAtual = somar(dividasRurais, 'situacao_atual');
  const dividasAnterior = dividaComumAnterior + dividaRuralAnterior;
  const dividasAtual = dividaComumAtual + dividaRuralAtual;
  return {
    bensAnterior, bensAtual,
    dividaComumAnterior, dividaComumAtual,
    dividaRuralAnterior, dividaRuralAtual,
    dividasAnterior, dividasAtual,
    patrimonioAnterior: bensAnterior - dividasAnterior,
    patrimonioAtual: bensAtual - dividasAtual,
  };
}

export function totalDividas(dividas, ponto, dataCorte) {
  return (dividas || []).reduce((s, d) => s + situacaoDividaAteData(d, dataCorte, ponto === 'de' ? 'de' : 'ate'), 0);
}

// Variação Patrimonial Total = -(Δ Bens) + (Δ Dívida). Negativo quando o
// patrimônio líquido cresceu (dinheiro "saiu" pra virar bem ou pagar
// dívida); positivo quando encolheu (bem vendido/dívida contraída "liberou"
// caixa). Mesma fórmula por trás da planilha, verificada a centavo.
//
// bensRurais NÃO entram aqui (só `bens`) — regra confirmada pelo chefe da
// usuária (áudio de 21/08/2026): o bem da Atividade Rural já passa pelo
// Livro Caixa da Atividade Rural, porque a aquisição é despesa de
// investimento, DEDUTÍVEL INTEGRALMENTE no resultado do próprio livro-caixa
// (IN SRF 83/2001, art. 8º, III e parágrafo único; Decreto nº 9.580/2018,
// art. 55, § 2º, III; Lei 8.023/1990, art. 4º, § 2º e art. 6º). Esse
// resultado (lucro ou prejuízo da atividade rural) já entra no demonstrativo
// como rendimento (ver `resultadoAtividadeRuralPeriodo`/`totalRendimentos`,
// campo `demaisTributaveis`). Se o bem rural TAMBÉM entrasse aqui como
// estoque (uso de caixa), o mesmo gasto seria descontado duas vezes.
//
// dividasRurais SIM entram (junto com `dividas`) — o empréstimo rural NÃO
// passa pelo livro-caixa (não é receita nem despesa da atividade rural), e é
// a origem/fonte de caixa real que financiou o que quer que tenha sido
// comprado. Sem contar a dívida aqui, não haveria de onde "veio" esse
// dinheiro na reconciliação — por isso ela conta, mesmo o bem que ela
// financiou ficando de fora.
export function variacaoPatrimonialTotal({ bens, dividas, dividasRurais }, dataDe, dataAte) {
  const bensDe = totalBensAteData(bens, dataDe, 'de');
  const bensAte = totalBensAteData(bens, dataAte, 'ate');
  const dividaDe = totalDividas(dividas, 'de', dataDe) + totalDividas(dividasRurais, 'de', dataDe);
  const dividaAte = totalDividas(dividas, 'ate', dataAte) + totalDividas(dividasRurais, 'ate', dataAte);
  return {
    bensDe, bensAte, deltaBens: bensAte - bensDe,
    dividaDe, dividaAte, deltaDivida: dividaAte - dividaDe,
    total: -(bensAte - bensDe) + (dividaAte - dividaDe),
  };
}

// Rendimentos: tributavel = "Tributáveis Recebidos de P.J." (ficha própria);
// demaisTributaveis = Resultado da Atividade Rural (vem da ficha própria,
// não do cadastro de rendimentos — por isso entra como parâmetro à parte).
//
// O nome `demaisTributaveis` é HERANÇA e não descreve bem o que o campo é: ele
// carrega o resultado REAL da atividade rural (receita menos despesa), que pode
// ser negativo. Prejuízo rural não é rendimento tributável negativo — para o
// imposto ele nem reduz os outros rendimentos, é compensado dentro da própria
// atividade em anos seguintes, e a declaração informa resultado tributável
// zero. Aqui ele entra assim mesmo porque este demonstrativo é de FLUXO DE
// CAIXA: o dinheiro gasto na atividade saiu de verdade. O rótulo da tela foi
// corrigido em 24/08/2026 para não chamar isso de "tributável"; o nome do campo
// ficou, para não quebrar dado já gravado no histórico dos perfis.
// isento e exclusivo somam por categoria. Exclusiva usa o valor LÍQUIDO de
// IRRF (é o que efetivamente veio de caixa; o IRRF retido não sobra pra
// gastar) — conferido contra a planilha, que faz exatamente essa conta.
export function totalRendimentos(rendimentos, resultadoAtividadeRural, dataDe, dataAte) {
  // `naoSomar` marca o lançamento que a declaração informa DUAS VEZES em
  // fichas diferentes, e que já entrou pela outra: hoje só o RRA tributado
  // exclusivamente na fonte, que o programa da Receita transporta para a
  // ficha de exclusivos (ver o achado 05 em importParsers.js). Ele continua
  // na lista, visível na tela de Rendimentos como detalhe, sem somar de novo.
  const doPeriodo = (rendimentos || [])
    .filter(r => !r.naoSomar)
    .filter(r => noPeriodo(r.data, dataDe, dataAte));
  const somaPorPrefixo = (prefixo) => doPeriodo.filter(r => r.tipo?.startsWith(prefixo))
    .reduce((acc, r) => ({ valor: acc.valor + (parseFloat(r.valor) || 0), irrf: acc.irrf + (parseFloat(r.irrf) || 0) }), { valor: 0, irrf: 0 });

  // Tributável de PJ: entra LÍQUIDO de contribuição previdenciária oficial e
  // de IRRF, os dois valores que a fonte pagadora retém e que nunca chegam ao
  // bolso de quem declara. Este demonstrativo é uma reconciliação de CAIXA, e
  // era o último lugar do motor que ainda somava rendimento bruto: a
  // tributação exclusiva já usava `exclusivoLiquido` desde sempre, o RRA já
  // vem líquido de previdência da própria ficha, e nenhuma das duas retenções
  // sai por outra linha (as quotas do IRPF em Pagamentos Diversos são o
  // imposto do ANO ANTERIOR, coisa diferente). Contando o bruto, o Saldo de
  // Caixa Geral vinha inflado exatamente pelo imposto e pelo INSS retidos.
  // Achado na conferência de 24/08/2026 contra a planilha da usuária, que
  // sempre lançou esses rendimentos líquidos (a linha "Prolabore" da aba
  // VAR PATRIMONIAL2025 decompõe em cinco vínculos, cada um já sem os 11%).
  //
  // O IRRF descontado aqui é só o da coluna de imposto retido sobre o
  // rendimento. O imposto do 13º NÃO entra: o 13º é rendimento de tributação
  // exclusiva, vem em coluna separada da ficha, e já é somado (líquido do
  // próprio IRRF) pelo bloco `exclusivo`.
  const pj = doPeriodo.filter(r => r.tipo === 'tributavel_pj').reduce((acc, r) => ({
    bruto: acc.bruto + (parseFloat(r.valor) || 0),
    previdencia: acc.previdencia + (parseFloat(r.contribuicaoPrevidenciaria) || 0),
    irrf: acc.irrf + (parseFloat(r.irrf) || 0),
  }), { bruto: 0, previdencia: 0, irrf: 0 });
  const tributavelPjBruto = pj.bruto;
  const tributavelPjPrevidencia = pj.previdencia;
  const tributavelPjIrrf = pj.irrf;
  const tributavelPJ = tributavelPjBruto - tributavelPjPrevidencia - tributavelPjIrrf;
  // Rendimentos recebidos de pessoa física e do exterior (carnê-leão). São
  // TRIBUTÁVEIS e entram no ajuste anual, por isso somam no total geral. O
  // imposto pago por carnê-leão fica guardado no `irrf` de cada lançamento,
  // e reduz os recursos disponíveis, mesmo sendo antecipação do ajuste.
  // Não representa imposto apenas devido: o campo do cadastro é "pago".
  const tributavelPfExterior = doPeriodo.filter(r => r.tipo === 'tributavel_pf_exterior')
    .reduce((s, r) => s + (parseFloat(r.valor) || 0) - (parseFloat(r.irrf) || 0), 0);
  // Rendimentos Recebidos Acumuladamente. Entram porque o dinheiro ENTROU no
  // período, que é o que este demonstrativo mede — independentemente da opção
  // de tributação do contribuinte (na fonte ou no ajuste), que muda como o
  // imposto é calculado, não se a renda foi recebida. O valor somado é o
  // TRIBUTÁVEL informado na ficha, já líquido de previdência, pensão e da
  // parcela isenta de quem tem 65 anos ou mais.
  const tributavelRra = doPeriodo.filter(r => r.tipo === 'tributavel_rra')
    .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  const isento = somaPorPrefixo('isento');
  const exclusivo = somaPorPrefixo('exclusivo');
  const exclusivoLiquido = exclusivo.valor - exclusivo.irrf;
  const demaisTributaveis = resultadoAtividadeRural || 0;

  const totalGeral = tributavelPJ + tributavelPfExterior + tributavelRra + demaisTributaveis + isento.valor + exclusivoLiquido;

  return {
    tributavelPjBruto,
    tributavelPjPrevidencia,
    tributavelPjIrrf,
    // `tributavelPJ` é o valor LÍQUIDO, o que de fato entra no total geral —
    // mesma convenção do `exclusivoLiquido`. Quem precisa do bruto usa
    // `tributavelPjBruto`.
    tributavelPJ,
    tributavelPfExterior,
    tributavelRra,
    demaisTributaveis,
    isentoValor: isento.valor,
    exclusivoBruto: exclusivo.valor,
    exclusivoIrrf: exclusivo.irrf,
    exclusivoLiquido,
    totalGeral,
  };
}

// Resultado da Atividade Rural no período (receita - despesa) — é o que a
// planilha chama de "DEMAIS REND. TRIBUTÁVEIS" e o que entra no
// demonstrativo como rendimento.
//
// DUAS FONTES, nesta ordem de precedência:
//
// 1. `lancamentosRurais`, o livro-caixa cadastrado à mão no app. Quando
//    existe, manda: é o dado mais granular e é o que a usuária curou.
// 2. `receitasDespesasRuraisOficial`, os 12 meses que vieram do registro 51
//    do .DBK. Usado quando o ano não tem NENHUM lançamento manual, que é o
//    caso logo depois de importar uma declaração.
//
// Por que a fonte 2 precisa existir: até a auditoria de 21/08/2026 a
// apuração importada era só exibida, nunca somada, e um ano recém-importado
// mostrava "Resultado da Atividade Rural R$ 0,00" mesmo com a declaração
// apurando milhões. Isso quebrava a premissa em que o resto do critério se
// apoia (ver `variacaoPatrimonialTotal`): o bem da Atividade Rural fica FORA
// de Bens PORQUE o resultado do livro-caixa já o cobre, e a dívida rural
// ENTRA como origem de caixa. Com o resultado zerado, tirava-se o bem e
// contava-se a dívida, sem a contrapartida.
//
// A figura é o RESULTADO (receita recebida menos despesa paga), não o
// "resultado tributável" da declaração: a lei define o resultado da
// atividade rural exatamente assim, em regime de caixa (Lei 8.023/1990,
// art. 4º; IN SRF 83/2001, art. 4º), e o resultado tributável já vem depois
// da compensação de prejuízo de anos anteriores (Lei 8.023/1990, art. 14),
// que é conta fiscal e não movimenta dinheiro no ano. O demonstrativo é uma
// reconciliação de CAIXA, então a figura certa é a de caixa — a mesma que o
// caminho manual (fonte 1) sempre calculou.
//
// Os 12 meses importados são datados no ÚLTIMO DIA de cada mês para poderem
// ser filtrados por período, mesma solução já usada nos rendimentos e
// pagamentos importados (que ganham 31/12): o arquivo não traz dia, e o mês
// é a maior precisão que ele tem.
export function resultadoAtividadeRuralPeriodo(lancamentosRurais, dataDe, dataAte, oficial) {
  const manuais = (lancamentosRurais || []).filter(l => noPeriodo(l.data, dataDe, dataAte));
  const { meses = [], ano } = oficial || {};
  const totalManual = manuais.reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0);

  // Lançamento manual SEM data não permite saber a qual mês ele se refere, e
  // portanto qual mês oficial ele substitui. Nesse caso vale a regra antiga
  // (o manual manda no ano inteiro), que é a única que não corre o risco de
  // contar a mesma receita duas vezes. Só acontece com dado gravado antes de
  // a data existir no formulário — o cadastro atual sempre exige a data.
  if (manuais.some(l => !l.data)) return totalManual;

  // CORREÇÃO DE 24/08/2026, achado da auditoria independente. Antes, a
  // precedência entre livro-caixa manual e apuração importada era TUDO OU
  // NADA: bastava UM lançamento manual para os DOZE meses vindos da
  // declaração serem descartados em silêncio. Reproduzido clicando na tela:
  // uma despesa de R$ 100,00 lançada num ano importado levava o resultado de
  // -460.078,43 para -100,00 e movia o Saldo de Caixa Geral em R$ 459.978,43
  // (na outra declaração de referência, R$ 1.562.069,99).
  //
  // A precedência agora é POR MÊS, que é a granularidade que as duas fontes
  // têm em comum: no mês em que a usuária lançou algo à mão, vale o que ela
  // lançou; nos demais, continua valendo o mês da declaração. Assim, corrigir
  // um mês não apaga os outros onze.
  const mesesComManual = new Set(manuais.map(l => l.data.slice(0, 7)));
  const totalOficial = meses
    .filter(m => {
      const iso = ultimoDiaDoMes(ano, m.mes);
      if (!noPeriodo(iso, dataDe, dataAte)) return false;
      return !mesesComManual.has(iso.slice(0, 7));
    })
    .reduce((s, m) => s + (m.receitaBruta || 0) - (m.despesaCusteioInvestimento || 0), 0);

  return totalManual + totalOficial;
}

// Quais meses da apuração importada foram substituídos por lançamento manual,
// e quais continuam valendo. É o que a tela Atividade Rural usa para dizer de
// onde vem cada pedaço do resultado, em vez de mostrar um card de livro-caixa
// que contradiz a tabela dos doze meses logo acima dele (era o que acontecia:
// "Resultado do Ano R$ 0,00 / Lucro" impresso embaixo de uma tabela que apura
// prejuízo de meio milhão).
export function origemResultadoRural(lancamentosRurais, dataDe, dataAte, oficial) {
  const manuais = (lancamentosRurais || []).filter(l => noPeriodo(l.data, dataDe, dataAte));
  const { meses = [], ano } = oficial || {};
  const semData = manuais.some(l => !l.data);
  const mesesComManual = semData ? null : new Set(manuais.map(l => l.data.slice(0, 7)));
  const oficiaisNoPeriodo = meses.filter(m => noPeriodo(ultimoDiaDoMes(ano, m.mes), dataDe, dataAte));
  const substituidos = semData
    ? oficiaisNoPeriodo.map(m => m.mes)
    : oficiaisNoPeriodo.filter(m => mesesComManual.has(ultimoDiaDoMes(ano, m.mes).slice(0, 7))).map(m => m.mes);
  return {
    temManual: manuais.length > 0,
    temOficial: oficiaisNoPeriodo.length > 0,
    mesesSubstituidos: substituidos,
    mesesOficiaisMantidos: oficiaisNoPeriodo.filter(m => !substituidos.includes(m.mes)).map(m => m.mes),
    anoInteiroManual: semData && manuais.length > 0,
  };
}

// Último dia do mês em ISO. O `ano` vem de QUEM CHAMA (o motor já sabe de
// qual ano-calendário é o snapshot que está lendo), e não do item: o
// registro 51 do .DBK guarda só o número do mês, e tirar o ano do chamador
// faz isto valer também para perfil já importado, sem migrar dado gravado.
// Sem ano, devolve string vazia, e `noPeriodo` descarta o item quando há
// filtro ativo, em vez de chutar um ano errado.
const ultimoDiaDoMes = (ano, mes) => {
  if (!ano || !mes) return '';
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`;
};

// Ganhos Apurados: soma o ganho/perda de cada venda com valorVenda
// preenchido, no período. Ganho entra líquido de IRRF (quando a movimentação
// informou o IRRF pago); perda entra pelo valor cheio. Sem IRRF informado
// numa venda com ganho, usa o ganho bruto (mais otimista que a planilha
// real, que sempre desconta) e o flag correspondente sinaliza a diferença
// em vez de estimar uma alíquota que pode estar errada.
//
// SÓ `bens` (a ficha Bens e Direitos). A venda de um bem da Atividade Rural
// NÃO gera ganho de capital: o valor recebido é RECEITA BRUTA DA ATIVIDADE
// RURAL, apurada no livro-caixa (IN SRF 83/2001, art. 5º, § 2º, III:
// "integram também a receita bruta da atividade rural [...] o valor de
// alienação de investimentos utilizados exclusivamente na exploração da
// atividade rural"; mesma regra no Decreto nº 9.580/2018, art. 54, § 1º, III,
// e na Lei 8.023/1990, art. 4º, § 3º, a contrario). É o outro lado da moeda
// do critério de `variacaoPatrimonialTotal`: se a AQUISIÇÃO do bem rural é
// despesa de investimento no livro-caixa, a ALIENAÇÃO dele é receita no
// mesmo livro-caixa, e contá-la aqui de novo somaria a mesma entrada de
// caixa duas vezes (uma em `demaisTributaveis`, via resultado da atividade
// rural, outra em Ganhos Apurados).
//
// A única exceção legal é a TERRA NUA, que sai da atividade rural e vai para
// ganho de capital (IN SRF 83/2001, art. 9º, § 2º; Decreto nº 9.580/2018,
// art. 54, § 7º). Ela já fica preservada sozinha, sem tratamento especial
// aqui: no app o imóvel rural é declarado em Bens e Direitos (grupo 01,
// código 14), dentro de `bens`, e nunca em `bensRurais` (registro 54 do
// .DBK), que só guarda os bens de investimento da atividade.
//
// Achado na auditoria de 21/08/2026, confirmado na fonte oficial antes de
// mexer, e decidido junto com o chefe da usuária.
export function ganhosApuradosPeriodo({ bens, apuracaoGanhoCapital }, dataDe, dataAte) {
  const vendas = [];
  for (const b of (bens || [])) {
    for (const m of (b.movimentacoes || [])) {
      if ((m.tipo !== 'venda_parcial' && m.tipo !== 'venda_total') || m.valorVenda == null) continue;
      if (!noPeriodo(m.data, dataDe, dataAte)) continue;
      const ganhoBruto = m.valorVenda - m.valor;
      const irrf = ganhoBruto > 0 ? (m.irrfVenda || 0) : 0;
      // `valorVenda` vai junto porque é uma das duas chaves que identificam a
      // operação contra a Apuração do Ganho de Capital da declaração (ver o
      // casamento logo abaixo). Sem ele, a mesma venda relançada à mão era
      // contada duas vezes.
      vendas.push({ bem: b.discriminacao, data: m.data, ganhoBruto, irrf, valorVenda: m.valorVenda, ganhoLiquido: ganhoBruto - irrf, semIrrf: ganhoBruto > 0 && m.irrfVenda == null });
    }
  }

  // Mesmas DUAS FONTES de resultadoAtividadeRuralPeriodo, mesma precedência:
  // a venda lançada como movimentação manda; sem NENHUMA no período, vale a
  // Apuração do Ganho de Capital que veio na declaração importada (registros
  // 62/65/69 do .DBK), que traz por operação o custo, o valor de alienação e
  // a data da alienação. Antes desta correção a apuração oficial era só
  // exibida e o Dashboard mostrava "0 venda(s), R$ 0,00" num ano importado
  // com vendas apuradas de verdade. Achado na auditoria de 21/08/2026.
  //
  // ATENÇÃO ao valor usado: é `valorAlienacao - custoAquisicao`, e NÃO o campo
  // `ganhoCapital` da declaração. A declaração informa 0,00 quando a operação
  // deu PREJUÍZO, porque prejuízo não gera imposto; mas o demonstrativo é uma
  // reconciliação de CAIXA, e nele a perda precisa aparecer negativa, que é o
  // dinheiro que não voltou. É também o que a planilha de referência da
  // usuária faz (as 4 linhas de "PERDA APURADA NA VENDA DE ..." na aba
  // VAR PATRIMONIAL2025) e o que o caminho por movimentação sempre calculou.
  //
  // O IRRF por operação não é decifrado nesses registros, então uma operação
  // com GANHO vinda daqui entra pelo bruto e levanta o mesmo `semIrrf` que já
  // sinaliza esse caso na tela, em vez de arbitrar uma alíquota.
  // CORREÇÃO DE 24/08/2026, o achado mais grave da auditoria independente.
  // Antes, a linha era `if (vendas.length === 0)`: a apuração oficial só era
  // usada quando NÃO havia nenhuma venda lançada à mão no período. Ou seja, a
  // precedência era por PERÍODO, não por operação — qualquer venda registrada
  // em qualquer bem apagava TODAS as operações apuradas na declaração.
  //
  // Reproduzido clicando na tela: numa declaração com três perdas de veículo
  // somando -241.779,86, registrar uma venda parcial de R$ 1.000,00 num saldo
  // de conta bancária (bem sem relação nenhuma) fazia as três desaparecerem e
  // o Saldo de Caixa Geral subir R$ 241.979,86, sem aviso nenhum.
  //
  // Agora a operação oficial só é suprimida quando a própria usuária já
  // lançou AQUELA venda à mão. O casamento é por data de alienação MAIS valor
  // de alienação, os dois únicos campos que as duas fontes têm em comum e que
  // identificam a operação (o texto do bem na apuração é um resumo, não a
  // discriminação completa do cadastro, e não serve de chave).
  //
  // Quando a data coincide mas o valor não, nada é suprimido — pode ser outra
  // venda no mesmo dia — mas a operação entra em `possiveisDuplicidades` para
  // a tela poder pedir conferência, em vez de escolher sozinha entre esconder
  // renda e contar duas vezes.
  const mesmoValor = (a, b) => Math.abs((a || 0) - (b || 0)) < 0.01;
  const vendasManuais = [...vendas];
  const possiveisDuplicidades = [];
  for (const g of (apuracaoGanhoCapital || [])) {
    if (!noPeriodo(g.dataAlienacao, dataDe, dataAte)) continue;
    const jaLancada = vendasManuais.some(v => v.data === g.dataAlienacao && mesmoValor(v.valorVenda, g.valorAlienacao));
    if (jaLancada) continue;
    if (vendasManuais.some(v => v.data === g.dataAlienacao)) {
      possiveisDuplicidades.push({ bem: g.bem, data: g.dataAlienacao, valorAlienacao: g.valorAlienacao || 0 });
    }
    const ganhoBruto = (g.valorAlienacao || 0) - (g.custoAquisicao || 0);
    vendas.push({
      bem: g.bem, data: g.dataAlienacao, ganhoBruto, irrf: 0, valorVenda: g.valorAlienacao || 0,
      ganhoLiquido: ganhoBruto, semIrrf: ganhoBruto > 0, daDeclaracao: true,
    });
  }

  // TERCEIRA FONTE, a de menor precedência: a venda que só existe escrita na
  // discriminação do bem. Só entra onde as outras duas não chegaram — bem que
  // zerou no período, sem movimentação com preço e sem operação na Apuração do
  // Ganho de Capital —, exatamente o conjunto que antes virava pendência sem
  // número. Ver vendaLidaDaDiscriminacao.
  for (const v of vendasDaDiscriminacaoPeriodo({ bens, apuracaoGanhoCapital }, dataDe, dataAte)) {
    // Mesma trava de duplicidade das operações oficiais: se a usuária já
    // lançou aquela venda à mão, o texto não entra de novo.
    if (vendasManuais.some(m => m.data === v.data && mesmoValor(m.valorVenda, v.valorVenda))) continue;
    vendas.push({
      bem: v.bem, data: v.data, ganhoBruto: v.ganho, irrf: 0, valorVenda: v.valorVenda,
      ganhoLiquido: v.ganho, semIrrf: v.ganho > 0, daDiscriminacao: true,
      custo: v.custo, baseCusto: v.baseCusto,
    });
  }

  return {
    vendas,
    total: vendas.reduce((s, v) => s + v.ganhoLiquido, 0),
    semIrrfCount: vendas.filter(v => v.semIrrf).length,
    daDeclaracao: vendas.length > 0 && vendas.every(v => v.daDeclaracao || v.daDiscriminacao),
    possiveisDuplicidades,
  };
}

// Bens que ENCOLHERAM no período sem que o app saiba por quanto foram
// vendidos: nem movimentação com "Valor de venda" preenchido, nem operação
// correspondente na Apuração do Ganho de Capital da declaração.
//
// Existe porque a Variação Patrimonial trata a saída do bem como se todo o
// CUSTO tivesse virado dinheiro. Quando o bem foi vendido por menos que o
// custo — o caso normal de veículo, que nem aparece na ficha de Ganhos de
// Capital porque prejuízo não gera imposto — a diferença é caixa que não
// entrou, e ninguém tem como adivinhá-la. Na declaração de referência são
// R$ 108.578,32, 13,7% do Saldo de Caixa Geral correto.
//
// O app NÃO inventa esse valor: devolve a lista para a tela pedir que a
// pessoa informe o preço recebido. Achado 04 da auditoria de 24/08/2026.
// Grupos da ficha Bens e Direitos em que o valor declarado JÁ É dinheiro:
// aplicações e investimentos (04), créditos (05), depósitos à vista e
// numerário (06) e fundos (07). Neles, uma redução no ano é resgate, saque ou
// recebimento — o valor sai como caixa pelo valor de face, sem "preço de
// venda" nenhum a informar, e apontá-los seria alarme falso.
//
// Sem este filtro o aviso disparava 18 vezes na declaração de referência (14
// resgates e saldos de conta, o dinheiro em cofre e um cartão pré-pago que só
// oscilou pelo câmbio) para 3 casos reais. Um alerta que grita à toa deixa de
// ser lido quando gritar por um motivo real.
const GRUPOS_QUE_JA_SAO_DINHEIRO = new Set(['04', '05', '06', '07']);

// ---------------------------------------------------------------------------
// VENDA ESCRITA NA DISCRIMINAÇÃO DO BEM.
//
// A ficha Bens e Direitos não tem campo de "valor de venda": quando o bem sai
// do patrimônio, o contribuinte escreve a venda no texto livre da
// discriminação. E há venda que NÃO tem demonstrativo de Ganho de Capital
// nenhum — prejuízo não gera imposto, então o contribuinte não preenche a
// ficha —, o que deixa a única informação do preço dentro desse texto.
//
// Na declaração de referência isso vale R$ 108.332,92 em duas operações (um
// Audi Q3 e uma Rampage), que a planilha da usuária traz em "GANHOS APURADOS"
// e o app não tinha como saber.
//
// O QUE ESTA LEITURA ASSUME, e o que ela recusa a fazer:
//
// - Só olha bem que ZEROU no período e que não tem nem movimentação de venda
//   com preço nem operação na Apuração do Ganho de Capital. Ou seja, entra
//   exatamente onde antes o app levantava a pendência "bem alienado sem valor
//   de venda" e ficava sem número.
// - Exige data E valor no texto. Faltando um dos dois, não lê nada: a
//   pendência continua aparecendo, que é melhor do que um número inventado
//   dentro de uma reconciliação de imposto de renda.
// - A data lida precisa cair dentro do período consultado.
// - O resultado vem marcado (`daDiscriminacao`) e a tela mostra a origem, para
//   a conferência ser possível sem abrir a declaração.
//
// A redação vem padronizada do escritório ("VENDIDO EM <data> POR R$ <valor>",
// "COM APURACAO DE PERDA DE R$ <valor>", "ATE A DATA DA VENDA, FOI PAGO O
// MONTANTE DE <valor>"), e é essa padronização que torna a leitura viável. Se
// a redação mudar, o texto deixa de casar e o app volta a pedir o dado, em vez
// de errar calado.
const semAcento = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const moedaBR = (s) => {
  const limpo = (s || '').replace(/\s/g, '');
  if (!limpo) return null;
  const n = parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
// "VENDIDO EM 27/11/2025", "VENDIDA EM 15/12/2025".
const RE_DATA_VENDA = /VEND[IA]D[OA]\s+EM\s+(\d{2})\/(\d{2})\/(\d{4})/i;
// "POR R$ 226.200,00", "PELO VALOR R$ 18.000,00", "PELO VALOR DE R$ 18.000,00".
// Deliberadamente ancorado no verbo: sem isso, "PARCELADO DE 9X DE R$ 2.000,00"
// na mesma frase viraria o preço da venda.
const RE_VALOR_VENDA = /(?:POR|PELO\s+VALOR(?:\s+DE)?|VALOR\s+DE)\s*R?\$?\s*([\d.]+,\d{2})/i;
const RE_PERDA = /APURACAO\s+DE\s+PERDA\s+DE\s*R?\$?\s*([\d.]+,\d{2})/i;
const RE_GANHO = /APURACAO\s+DE\s+GANHO\s+DE\s*R?\$?\s*([\d.]+,\d{2})/i;
// "*ATE A DATA DA VENDA, FOI PAGO O MONTANTE DE 328.240,92." — o custo real de
// um bem financiado, que inclui as parcelas pagas no próprio ano da venda e
// por isso NÃO é a situação de 31/12 do ano anterior.
const RE_MONTANTE_PAGO = /FOI\s+PAGO\s+O\s+MONTANTE\s+DE\s*R?\$?\s*([\d.]+,\d{2})/i;

export function vendaLidaDaDiscriminacao(discriminacao, custoNoInicioDoPeriodo = null) {
  const texto = semAcento(discriminacao || '').toUpperCase();
  const mData = RE_DATA_VENDA.exec(texto);
  if (!mData) return null;
  const data = `${mData[3]}-${mData[2]}-${mData[1]}`;
  // O preço tem que vir DEPOIS do "VENDIDO EM": um texto que cite o valor de
  // aquisição antes ("ADQUIRIDO POR R$ X ... VENDIDO EM ...") não pode ter o
  // preço de compra lido como preço de venda.
  const depoisDaVenda = texto.slice(mData.index);
  const mValor = RE_VALOR_VENDA.exec(depoisDaVenda);
  const valorVenda = mValor ? moedaBR(mValor[1]) : null;
  if (valorVenda == null) return null;

  const perda = RE_PERDA.test(texto) ? moedaBR(RE_PERDA.exec(texto)[1]) : null;
  const ganhoExplicito = RE_GANHO.test(texto) ? moedaBR(RE_GANHO.exec(texto)[1]) : null;
  const montantePago = RE_MONTANTE_PAGO.test(texto) ? moedaBR(RE_MONTANTE_PAGO.exec(texto)[1]) : null;

  // Ordem de confiança do resultado, da mais forte para a mais fraca:
  //   1. o ganho ou a perda que o próprio contribuinte apurou e escreveu;
  //   2. preço menos o montante efetivamente pago até a venda;
  //   3. preço menos o custo que estava na declaração no início do período.
  // A 3 é a mesma conta que o app faz para uma venda lançada à mão, e é a
  // única possível quando o texto não diz mais nada — mas erra quando o bem
  // foi financiado e houve parcela paga no ano (o Audi da declaração de
  // referência: 34.867,44 pela conta 3 contra 102.040,92 reais). Por isso a 2
  // existe, e por isso a base usada viaja junto no resultado.
  let ganho = null;
  let baseCusto = null;
  let custo = null;
  if (perda != null) {
    ganho = -perda; baseCusto = 'perda declarada no texto'; custo = valorVenda + perda;
  } else if (ganhoExplicito != null) {
    ganho = ganhoExplicito; baseCusto = 'ganho declarado no texto'; custo = valorVenda - ganhoExplicito;
  } else if (montantePago != null) {
    ganho = valorVenda - montantePago; baseCusto = 'montante pago até a venda'; custo = montantePago;
  } else if (custoNoInicioDoPeriodo != null) {
    ganho = valorVenda - custoNoInicioDoPeriodo; baseCusto = 'custo declarado no início do período'; custo = custoNoInicioDoPeriodo;
  } else {
    return null;
  }
  return { data, valorVenda, ganho, custo, baseCusto };
}

// Bens que SAÍRAM inteiros do patrimônio no período sem que o app conheça o
// preço por outra via (movimentação lançada ou Apuração do Ganho de Capital).
// É a lista de candidatos das DUAS funções abaixo: a que lê a venda do texto e
// a que pede o dado à usuária. Ficam juntas de propósito — quando eram duas
// varreduras independentes, bastava uma mudar de critério para a tela pedir um
// dado que o demonstrativo já tinha usado.
function bensSaidosSemPrecoConhecido({ bens, apuracaoGanhoCapital }, dataDe, dataAte) {
  const candidatos = [];
  for (const b of (bens || [])) {
    if (GRUPOS_QUE_JA_SAO_DINHEIRO.has(b.grupo)) continue;
    const de = situacaoBemAteData(b, dataDe, 'de');
    const ate = situacaoBemAteData(b, dataAte, 'ate');
    const reducao = de - ate;
    if (reducao <= 0.01) continue;
    // Só a alienação TOTAL: o bem saiu inteiro do patrimônio e o app está
    // assumindo que todo o custo virou dinheiro. Redução parcial de bem não
    // financeiro (venda de uma fração de imóvel, por exemplo) é rara e vem
    // acompanhada de movimentação lançada, onde o preço já é pedido.
    if (ate > 0.01) continue;
    const movs = (b.movimentacoes || []).filter(m => noPeriodo(m.data, dataDe, dataAte));
    const temVendaComPreco = movs.some(m => (m.tipo === 'venda_parcial' || m.tipo === 'venda_total') && m.valorVenda != null);
    if (temVendaComPreco) continue;
    // Uma baixa (perda, doação, destruição) é uma saída SEM contrapartida em
    // dinheiro, e foi declarada como tal: não é uma venda por valor
    // desconhecido, e não entra na lista.
    if (movs.some(m => m.tipo === 'baixa')) continue;
    const temApuracaoOficial = (apuracaoGanhoCapital || []).some(g => noPeriodo(g.dataAlienacao, dataDe, dataAte)
      && Math.abs((g.custoAquisicao || 0) - reducao) < 0.01);
    if (temApuracaoOficial) continue;
    candidatos.push({ bem: b, de, ate, reducao });
  }
  return candidatos;
}

// Vendas que só existem no texto da discriminação, prontas para entrar no
// demonstrativo. Data fora do período consultado é descartada aqui.
export function vendasDaDiscriminacaoPeriodo(dados, dataDe, dataAte) {
  const lidas = [];
  for (const c of bensSaidosSemPrecoConhecido(dados, dataDe, dataAte)) {
    const venda = vendaLidaDaDiscriminacao(c.bem.discriminacao, c.de);
    if (!venda) continue;
    if (!noPeriodo(venda.data, dataDe, dataAte)) continue;
    lidas.push({ ...venda, id: c.bem.id, bem: c.bem.discriminacao || '' });
  }
  return lidas;
}

export function bensAlienadosSemValorDeVenda(dados, dataDe, dataAte) {
  const pendentes = [];
  for (const c of bensSaidosSemPrecoConhecido(dados, dataDe, dataAte)) {
    // O que a leitura da discriminação resolveu sai da lista: pedir à usuária
    // um preço que o demonstrativo já está usando seria ruído, e ela deixaria
    // de ler o aviso quando ele apontasse um caso de verdade.
    const venda = vendaLidaDaDiscriminacao(c.bem.discriminacao, c.de);
    if (venda && noPeriodo(venda.data, dataDe, dataAte)) continue;
    // Venda ESCRITA no texto mas com data de outro ano: o bem só saiu do
    // patrimônio agora porque a última parcela caiu neste período (caso real
    // na declaração de referência, um veículo vendido em 08/02/2024 e quitado
    // em 21/05/2025). Não é preço faltando, e o ganho pertence ao ano da
    // alienação — a tela precisa dizer isso, senão a pessoa vai procurar um
    // dado que não existe.
    pendentes.push({
      id: c.bem.id, discriminacao: c.bem.discriminacao || '', reducao: c.reducao, de: c.de, ate: c.ate,
      vendaForaDoPeriodo: venda ? venda.data : null,
      valorVendaForaDoPeriodo: venda ? venda.valorVenda : null,
    });
  }
  return pendentes;
}

// ---------------------------------------------------------------------------
// APLICAÇÃO RESGATADA SEM O RENDIMENTO CORRESPONDENTE NA DECLARAÇÃO.
//
// Poupança, CDB, RDB, Tesouro Direto, LCI, LCA, CRI, CRA: são aplicações que
// rendem juros, e o resgate credita esse rendimento. Quando uma delas some do
// patrimônio no período e a MESMA fonte pagadora não aparece na ficha de
// rendimentos que lhe cabe, ou o rendimento não foi declarado, ou foi
// declarado em outro código.
//
// O caso que motivou a conferência, na declaração de referência de 24/08/2026:
// a LCI do Sicoob da conta 243914 (CNPJ 02.335.109/0001-05) saiu de 483.154,01
// para zero, e o único rendimento do código 12 do ano é de 1.474,24 da Caixa.
// O que existe da cooperativa são 102.194,93 no código 09, de lucros e
// dividendos — que é onde o rendimento da aplicação provavelmente foi parar. A
// planilha da usuária lançou 4.488,60 nessa linha, e a diferença de 97.706,33
// foi o segundo maior item da conciliação daquele ano.
//
// O que a conferência NÃO faz: afirmar erro. Ela mostra o resgate, o que a
// declaração informa daquela fonte e onde o rendimento deveria estar, e deixa
// a conclusão para quem tem o informe de rendimentos na mão.
//
// Escopo deliberadamente estreito, para o aviso não virar ruído:
//
// - Só o grupo 04 (Aplicações e Investimentos), e dentro dele só os códigos em
//   que o rendimento é juros: 01 poupança, 02 títulos tributados, 03 títulos
//   isentos e 99 outras. Ficam de fora o código 04 (ativos negociados em
//   bolsa) e o 05 (ouro), onde o resultado é ganho de renda variável e não
//   rendimento, e o grupo 07 (fundos), que tem come-cotas, prejuízo possível e
//   cota que cai — falso positivo fácil.
// - Só o resgate TOTAL: aplicação que apenas encolheu pode ter tido saque
//   parcial sem crédito de juros no período.
// - Só acima do piso de materialidade, porque conta de poupança esquecida com
//   saldo de dezenas de reais existe em quase toda declaração.
// - Só quando o bem tem CNPJ. Sem a fonte não há cruzamento possível, e
//   declaração importada antes de 24/08/2026 não tem esse campo.
const APLICACOES_QUE_RENDEM = {
  '01': { esperado: ['isento:12'], onde: 'Rendimentos Isentos, código 12 (poupança, LCI, LCA, CRI, CRA)' },
  '02': { esperado: ['exclusivo:06'], onde: 'Tributação Exclusiva, código 06 (aplicações financeiras)' },
  '03': { esperado: ['isento:12'], onde: 'Rendimentos Isentos, código 12 (poupança, LCI, LCA, CRI, CRA)' },
  '99': { esperado: ['isento:12', 'exclusivo:06'], onde: 'Rendimentos Isentos, código 12, ou Tributação Exclusiva, código 06' },
};
const PISO_APLICACAO_RESGATADA = 1000;

// O tipo do rendimento sai do import com o código em duas ou em quatro casas
// ('isento_09' e 'isento_0009' convivem, conforme o registro de origem), então
// a comparação é pelo NÚMERO, não pelo texto.
const familiaECodigo = (tipo) => {
  const m = /^(isento|exclusivo)_(\d+)$/.exec(tipo || '');
  return m ? `${m[1]}:${String(parseInt(m[2], 10)).padStart(2, '0')}` : '';
};
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

export function aplicacoesResgatadasSemRendimento(dados, dataDe, dataAte, piso = PISO_APLICACAO_RESGATADA) {
  const doPeriodo = (dados.rendimentos || []).filter(r => noPeriodo(r.data, dataDe, dataAte));
  const achados = [];
  for (const b of (dados.bens || [])) {
    if (b.grupo !== '04') continue;
    const cfg = APLICACOES_QUE_RENDEM[b.codigo_bem];
    if (!cfg) continue;
    const cnpj = soDigitos(b.cnpj);
    if (!cnpj) continue;
    const de = situacaoBemAteData(b, dataDe, 'de');
    const ate = situacaoBemAteData(b, dataAte, 'ate');
    if (ate > 0.01) continue;
    const resgatado = de - ate;
    if (resgatado < piso) continue;
    const daFonte = doPeriodo.filter(r => soDigitos(r.cnpj_fonte) === cnpj);
    if (daFonte.some(r => cfg.esperado.includes(familiaECodigo(r.tipo)))) continue;
    achados.push({
      id: b.id,
      discriminacao: b.discriminacao || '',
      cnpj,
      valorResgatado: resgatado,
      onde: cfg.onde,
      // O que a declaração informa dessa mesma fonte em QUALQUER ficha. É o
      // que aponta para o rendimento lançado no código errado.
      outrosDaMesmaFonte: daFonte.map(r => ({
        tipo: r.tipo,
        nome: r.nome_fonte || '',
        valor: parseFloat(r.valor) || 0,
      })),
    });
  }
  return achados;
}

export function totalPagamentos(pagamentos, dataDe, dataAte) {
  return (pagamentos || []).filter(p => noPeriodo(p.data, dataDe, dataAte)).reduce((s, p) => s + (parseFloat(p.valor_pago) || 0), 0);
}

export function totalPagamentosDiversos(pagamentosDiversos, dataDe, dataAte) {
  return (pagamentosDiversos || []).filter(p => noPeriodo(p.data, dataDe, dataAte)).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
}

// Monta o demonstrativo inteiro, na mesma ordem da planilha original:
// Bens/Dívidas → Variação Patrimonial Total → Rendimentos → Ganhos Apurados
// → Saldo de Caixa Geral → Pagamentos (Efetuados e Diversos) → Saldo de
// Caixa. Esse último é o número de validação: perto de zero (ou de um saldo
// de caixa/cofre conhecido) indica que a declaração fecha; um valor grande
// sinaliza rendimento ou bem não lançado.
export function demonstrativoConciliacao(state, dataDe, dataAte) {
  const varPatrimonial = variacaoPatrimonialTotal(state, dataDe, dataAte);
  const resultadoRural = resultadoAtividadeRuralPeriodo(state.lancamentosRurais, dataDe, dataAte,
    { meses: state.receitasDespesasRuraisOficial, ano: state.anoCalendario });
  const rendimentos = totalRendimentos(state.rendimentos, resultadoRural, dataDe, dataAte);
  const ganhos = ganhosApuradosPeriodo(state, dataDe, dataAte);
  const rv = rendaVariavelDoPeriodo(linhasComunsDoAno(state), state.anoCalendario, dataDe, dataAte);
  const totalDoacoes = totalDoacoesPeriodo(state);
  const pagamentosEfetuados = totalPagamentos(state.pagamentos, dataDe, dataAte);
  const pagamentosDiversos = totalPagamentosDiversos(state.pagamentosDiversos, dataDe, dataAte);
  return fecharDemonstrativo({
    varPatrimonial, rendimentos, ganhos,
    rendaVariavelPerda: rv.perda,
    pagamentosEfetuados, pagamentosDiversos, totalDoacoes,
    extras: {
      rendaVariavelMeses: rv.meses,
      rendaVariavelResultado: rv.resultado,
      rendaVariavelImposto: rv.imposto,
      rendaVariavelComValor: rv.comValor,
      pendenciasAlienacao: bensAlienadosSemValorDeVenda(state, dataDe, dataAte),
      aplicacoesSemRendimento: aplicacoesResgatadasSemRendimento(state, dataDe, dataAte),
    },
  });
}

// A FÓRMULA FINAL, num lugar só. Antes ela existia duas vezes, aqui e em
// consultaPeriodo.js, e as duas cópias já tinham divergido: só a de
// consultaPeriodo subtraía as doações do Saldo de Caixa. Como nenhuma tela
// chamava `demonstrativoConciliacao`, as duas regressões contra a planilha da
// usuária provavam uma fórmula que o app não executava — e a diferença só
// aparecia numa declaração com doação, que nenhum dos arquivos de referência
// tem. Achado 09 da auditoria de 24/08/2026: agora os dois motores montam o
// resultado por aqui, e o que o teste prova é o que a tela mostra.
export function fecharDemonstrativo({
  varPatrimonial, rendimentos, ganhos,
  rendaVariavelPerda = 0, pagamentosEfetuados = 0, pagamentosDiversos = 0, totalDoacoes = 0,
  extras = {},
}) {
  const arredondarNumeros = (objeto) => Object.fromEntries(Object.entries(objeto)
    .map(([chave, valor]) => [chave, typeof valor === 'number' ? arredondarCentavos(valor) : valor]));
  const varPatrimonialFechada = arredondarNumeros(varPatrimonial);
  const rendimentosFechados = arredondarNumeros(rendimentos);
  const ganhosFechados = arredondarNumeros(ganhos);
  const rendaVariavelPerdaFechada = arredondarCentavos(rendaVariavelPerda);
  const pagamentosEfetuadosFechados = arredondarCentavos(pagamentosEfetuados);
  const pagamentosDiversosFechados = arredondarCentavos(pagamentosDiversos);
  const totalDoacoesFechado = arredondarCentavos(totalDoacoes);
  const saldoDeCaixaGeral = arredondarCentavos(varPatrimonialFechada.total
    + rendimentosFechados.totalGeral + ganhosFechados.total + rendaVariavelPerdaFechada);
  const saldoDeCaixa = arredondarCentavos(saldoDeCaixaGeral
    - pagamentosEfetuadosFechados - pagamentosDiversosFechados - totalDoacoesFechado);
  return {
    varPatrimonial: varPatrimonialFechada,
    rendimentos: rendimentosFechados,
    ganhos: ganhosFechados,
    rendaVariavelPerda: rendaVariavelPerdaFechada,
    saldoDeCaixaGeral,
    pagamentosEfetuados: pagamentosEfetuadosFechados,
    pagamentosDiversos: pagamentosDiversosFechados,
    totalDoacoes: totalDoacoesFechado,
    saldoDeCaixa,
    ...arredondarNumeros(extras),
  };
}

const somaDoacoes = (lista) => (lista || []).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
export const totalDoacoesPeriodo = (dados) => somaDoacoes(dados.doacoesEfetuadasOficial)
  + somaDoacoes(dados.doacoesPartidosOficial) + somaDoacoes(dados.doacoesEcaIdosoOficial);

// Renda Variável do período, e a PARTE DELA QUE ENTRA NO CAIXA.
//
// Achado 12 da auditoria de 24/08/2026. O resultado mensal era lido, exibido
// no Dashboard e mantido fora de todos os totais, com a justificativa de que
// "renda variável é de tributação exclusiva, apurada e paga mês a mês, fora do
// ajuste anual". Isso confunde regime de tributação com movimento de caixa:
// este demonstrativo é uma reconciliação de CAIXA e, por esse mesmo critério,
// já soma todos os OUTROS rendimentos de tributação exclusiva.
//
// A correção é ASSIMÉTRICA de propósito, e o motivo é dupla contagem:
//   - GANHO líquido em renda variável, quando existe, o contribuinte informa
//     na ficha de exclusivos (código 05) e ele JÁ ENTRA por `exclusivoLiquido`.
//     Somá-lo de novo aqui contaria a mesma entrada duas vezes.
//   - PERDA nunca vai para aquela ficha (ela não gera imposto, vira prejuízo a
//     compensar em meses seguintes), então não entra por caminho nenhum — e é
//     dinheiro que saiu do caixa de verdade.
// Por isso só o resultado NEGATIVO de cada mês é levado ao saldo.
export function rendaVariavelDoPeriodo(rendaVariavelMensalOficial, ano, dataDe, dataAte) {
  const meses = [];
  let resultado = 0, imposto = 0, perda = 0, comValor = false;
  for (const m of (rendaVariavelMensalOficial || [])) {
    if (!noPeriodo(ultimoDiaDoMes(ano, m.mes), dataDe, dataAte)) continue;
    if (!meses.some(x => x.ano === ano && x.mes === m.mes)) meses.push({ ano, mes: m.mes });
    if (!m.comuns && !m.daytrade) continue;
    const doMes = (m.comuns?.resultadoLiquidoMes || 0) + (m.daytrade?.resultadoLiquidoMes || 0);
    resultado += doMes;
    if (doMes < 0) perda += doMes;
    imposto += m.consolidacao?.totalImpostoDevido || 0;
    comValor = true;
  }
  return { meses, resultado, imposto, perda, comValor };
}
