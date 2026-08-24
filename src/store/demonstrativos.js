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

const emDataOuAntes = (data, corte) => !!data && (!corte || data <= corte);

// Um dia antes de uma data ISO (aaaa-mm-dd). "De" é o INÍCIO do período de
// consulta — o saldo anterior tem que ser da véspera, não do próprio dia,
// senão uma movimentação cadastrada exatamente no dia "De" ficava escondida
// dentro do saldo anterior em vez de contar como variação do período.
export function diaAnterior(dataIso) {
  const d = new Date(`${dataIso}T00:00:00`);
  d.setDate(d.getDate() - 1);
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
  return ordenarPorData(movimentacoesRestantes).reduce(aplicarMovimentoBem, bem.situacao_anterior + saltoSemData);
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
  return ordenarPorData(movimentacoesRestantes).reduce(aplicarMovimentoDivida, anterior + saltoSemData);
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
  const doPeriodo = (rendimentos || []).filter(r => noPeriodo(r.data, dataDe, dataAte));
  const somaPorPrefixo = (prefixo) => doPeriodo.filter(r => r.tipo?.startsWith(prefixo))
    .reduce((acc, r) => ({ valor: acc.valor + (parseFloat(r.valor) || 0), irrf: acc.irrf + (parseFloat(r.irrf) || 0) }), { valor: 0, irrf: 0 });

  const tributavelPJ = doPeriodo.filter(r => r.tipo === 'tributavel_pj').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
  // Rendimentos recebidos de pessoa física e do exterior (carnê-leão). São
  // TRIBUTÁVEIS e entram no ajuste anual, por isso somam no total geral. O
  // imposto pago por carnê-leão fica guardado no `irrf` de cada lançamento,
  // mas NÃO é descontado aqui: diferente da tributação exclusiva, ele não
  // encerra a tributação do rendimento, é antecipação do imposto do ajuste.
  const tributavelPfExterior = doPeriodo.filter(r => r.tipo === 'tributavel_pf_exterior')
    .reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
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
  const manuais = lancamentosRurais || [];
  if (manuais.length > 0) {
    return manuais
      .filter(l => noPeriodo(l.data, dataDe, dataAte))
      .reduce((s, l) => s + (l.tipo === 'receita' ? l.valor : -l.valor), 0);
  }
  const { meses = [], ano } = oficial || {};
  return meses
    .filter(m => noPeriodo(ultimoDiaDoMes(ano, m.mes), dataDe, dataAte))
    .reduce((s, m) => s + (m.receitaBruta || 0) - (m.despesaCusteioInvestimento || 0), 0);
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
      vendas.push({ bem: b.discriminacao, data: m.data, ganhoBruto, irrf, ganhoLiquido: ganhoBruto - irrf, semIrrf: ganhoBruto > 0 && m.irrfVenda == null });
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
  if (vendas.length === 0) {
    for (const g of (apuracaoGanhoCapital || [])) {
      if (!noPeriodo(g.dataAlienacao, dataDe, dataAte)) continue;
      const ganhoBruto = (g.valorAlienacao || 0) - (g.custoAquisicao || 0);
      vendas.push({
        bem: g.bem, data: g.dataAlienacao, ganhoBruto, irrf: 0,
        ganhoLiquido: ganhoBruto, semIrrf: ganhoBruto > 0, daDeclaracao: true,
      });
    }
  }

  return {
    vendas,
    total: vendas.reduce((s, v) => s + v.ganhoLiquido, 0),
    semIrrfCount: vendas.filter(v => v.semIrrf).length,
    daDeclaracao: vendas.length > 0 && vendas.every(v => v.daDeclaracao),
  };
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
  const saldoDeCaixaGeral = varPatrimonial.total + rendimentos.totalGeral + ganhos.total;
  const pagamentosEfetuados = totalPagamentos(state.pagamentos, dataDe, dataAte);
  const pagamentosDiversos = totalPagamentosDiversos(state.pagamentosDiversos, dataDe, dataAte);
  const saldoDeCaixa = saldoDeCaixaGeral - pagamentosEfetuados - pagamentosDiversos;

  return {
    varPatrimonial,
    rendimentos,
    ganhos,
    saldoDeCaixaGeral,
    pagamentosEfetuados,
    pagamentosDiversos,
    saldoDeCaixa,
  };
}
