import { linhasComunsDoAno, linhasFiiDoAno } from './rendaVariavelMensal';

const moedaOpcional = valor => valor == null || valor === '' || !Number.isFinite(Number(valor)) ? null : moeda(valor);
const moeda = valor => Math.round((Number(valor) || 0) * 100) / 100;

// Parâmetros oficiais a partir de janeiro de 2026:
// https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026
// Lei 15.270/2025, art. 3º-A. O redutor usa o rendimento BRUTO sujeito à
// incidência mensal; a tabela progressiva usa a base depois das deduções.
export function calcularIrrfMensal2026({
  bruto,
  previdencia = 0,
  quantidadeDependentes = 0,
  deducaoDependentes,
} = {}) {
  const rendimento = Math.max(0, Number(bruto) || 0);
  const dependentes = deducaoDependentes == null
    ? Math.max(0, Number(quantidadeDependentes) || 0) * 189.59
    : Math.max(0, Number(deducaoDependentes) || 0);
  // A fonte pode aplicar o desconto simplificado mensal. Usar a maior dedução
  // produz o menor IRRF lícito e evita falso alerta de "retenção a menor".
  const deducao = Math.max(607.20, Math.max(0, Number(previdencia) || 0) + dependentes);
  const base = Math.max(0, rendimento - deducao);
  let impostoTabela = 0;
  if (base <= 2428.80) impostoTabela = 0;
  else if (base <= 2826.65) impostoTabela = base * 0.075 - 182.16;
  else if (base <= 3751.05) impostoTabela = base * 0.15 - 394.16;
  else if (base <= 4664.68) impostoTabela = base * 0.225 - 675.49;
  else impostoTabela = base * 0.275 - 908.73;
  impostoTabela = Math.max(0, impostoTabela);

  let reducao = 0;
  if (rendimento <= 5000) reducao = impostoTabela;
  else if (rendimento <= 7350) reducao = Math.max(0, 978.62 - 0.133145 * rendimento);
  reducao = Math.min(impostoTabela, reducao);
  return {
    bruto: moeda(rendimento),
    deducao: moeda(deducao),
    base: moeda(base),
    impostoTabela: moeda(impostoTabela),
    reducao: moeda(reducao),
    esperado: moeda(impostoTabela - reducao),
  };
}

function alertasRetencaoMensal(rendimentos) {
  return (rendimentos || []).flatMap(rendimento => {
    const data = String(rendimento.data || '');
    const mensalExplicito = rendimento.periodicidade === 'mensal' || rendimento.competenciaMensal;
    const dataMensalNaoAmbigua = /^2026-\d{2}-\d{2}$/.test(data) && !data.endsWith('-12-31');
    if (!String(rendimento.tipo || '').startsWith('tributavel_pj') || (!mensalExplicito && !dataMensalNaoAmbigua)) return [];
    if (!data.startsWith('2026-')) return [];
    const calculo = calcularIrrfMensal2026({
      bruto: rendimento.valor,
      previdencia: rendimento.contribuicaoPrevidenciaria,
      quantidadeDependentes: rendimento.quantidadeDependentes ?? rendimento.numeroDependentes,
      deducaoDependentes: rendimento.deducaoDependentes,
    });
    const informado = moeda(rendimento.irrf);
    const diferenca = moeda(calculo.esperado - informado);
    if (diferenca <= 0.01) return [];
    return [{
      fonte: rendimento.nome_fonte || 'Fonte não detalhada',
      beneficiario: nomeBeneficiario(rendimento),
      data,
      informado,
      esperado: calculo.esperado,
      diferenca,
      calculo,
    }];
  });
}

function nomeBeneficiario(item) {
  if (item?.titular === true) return 'Titular';
  const nome = item?.beneficiario || (item?.titular === false ? 'Dependente' : 'Titular');
  const cpf = item?.cpf_beneficiario || item?.cpfDependente;
  return cpf ? `${nome} (${cpf})` : nome;
}

function consolidar(linhas) {
  const agrupadas = new Map();
  for (const linha of linhas.filter(item => moeda(item.valor) !== 0)) {
    const chave = [linha.fonte, linha.beneficiario, linha.tipo, linha.compoeAjuste].join('|');
    const atual = agrupadas.get(chave);
    if (atual) atual.valor = moeda(atual.valor + linha.valor);
    else agrupadas.set(chave, { ...linha, valor: moeda(linha.valor) });
  }
  return [...agrupadas.values()].sort((a, b) =>
    Number(b.compoeAjuste) - Number(a.compoeAjuste)
      || a.beneficiario.localeCompare(b.beneficiario)
      || a.tipo.localeCompare(b.tipo)
      || a.fonte.localeCompare(b.fonte)
  );
}

export function montarPainelIrrf(dados = {}) {
  const linhas = [];
  for (const rendimento of dados.rendimentos || []) {
    const valor = moeda(rendimento.irrf);
    if (!valor) continue;
    const tipo = String(rendimento.tipo || '');
    const tributavelPj = tipo.startsWith('tributavel_pj');
    const carneLeao = tipo === 'tributavel_pf_exterior';
    const rra = tipo.startsWith('tributavel_rra');
    linhas.push({
      fonte: rendimento.nome_fonte || (carneLeao ? 'Pessoa física ou exterior' : 'Fonte não detalhada'),
      beneficiario: nomeBeneficiario(rendimento),
      tipo: tributavelPj ? 'Tributável PJ' : carneLeao ? 'Carnê-leão' : rra ? 'RRA' : 'Tributação exclusiva',
      valor,
      compoeAjuste: tributavelPj || carneLeao || rra,
    });
  }

  for (const mensal of linhasComunsDoAno(dados)) {
    const beneficiario = nomeBeneficiario(mensal);
    const consolidacao = mensal.consolidacao || {};
    linhas.push(
      { fonte: `Renda variável, mês ${mensal.mes}`, beneficiario, tipo: 'RV comuns, IRRF Lei 11.033', valor: consolidacao.irFonteLei11033Mes, compoeAjuste: false },
      { fonte: `Renda variável, mês ${mensal.mes}`, beneficiario, tipo: 'RV day-trade', valor: consolidacao.irFonteDayTradeMes, compoeAjuste: false },
    );
  }
  for (const mensal of linhasFiiDoAno(dados)) {
    linhas.push({
      fonte: `FII/Fiagro, mês ${mensal.mes}`,
      beneficiario: nomeBeneficiario(mensal),
      tipo: 'FII/Fiagro',
      valor: mensal.impostoRetidoNoMes,
      compoeAjuste: false,
    });
  }
  for (const bem of dados.bens || []) {
    for (const movimento of bem.movimentacoes || []) {
      linhas.push({
        fonte: bem.discriminacao || 'Bem não identificado',
        beneficiario: bem.beneficiario || 'Titular',
        tipo: 'Ganho de capital',
        valor: movimento.irrfVenda,
        compoeAjuste: false,
      });
    }
  }

  const imposto = dados.impostoDevido || {};
  const linhasDiretasResumo = [
    ['Resumo da declaração', 'Titular', 'Imposto complementar', imposto.impostoComplementar],
    ['Resumo da declaração', 'Titular', 'Imposto pago no exterior', imposto.impostoPagoExterior],
    ['Resumo da declaração', 'Titular', 'IRRF Lei 11.033 aproveitado no ajuste', imposto.irFonteLei11033Pago],
  ];
  for (const [fonte, beneficiario, tipo, valor] of linhasDiretasResumo) {
    linhas.push({ fonte, beneficiario, tipo, valor, compoeAjuste: true });
  }

  const consolidadas = consolidar(linhas);
  const totalPainel = moeda(consolidadas.filter(linha => linha.compoeAjuste).reduce((soma, linha) => soma + linha.valor, 0));
  const totalResumo = moedaOpcional(imposto.impostoPagoTotal);
  const diferenca = totalResumo == null ? null : moeda(totalPainel - totalResumo);
  return {
    linhas: consolidadas,
    totalPainel,
    totalResumo,
    diferenca,
    confere: diferenca == null ? null : Math.abs(diferenca) <= 0.01,
    impostoDevido: moedaOpcional(imposto.impostoDevidoTotal),
    saldoPagar: moedaOpcional(imposto.saldoPagar),
    impostoRestituir: moedaOpcional(imposto.impostoRestituir),
    alertasRetencao: alertasRetencaoMensal(dados.rendimentos),
  };
}
