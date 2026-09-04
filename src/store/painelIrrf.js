import { linhasComunsDoAno, linhasFiiDoAno } from './rendaVariavelMensal';

const moeda = valor => Math.round((Number(valor) || 0) * 100) / 100;

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
  const totalResumo = Number.isFinite(Number(imposto.impostoPagoTotal)) ? moeda(imposto.impostoPagoTotal) : null;
  const diferenca = totalResumo == null ? null : moeda(totalPainel - totalResumo);
  return {
    linhas: consolidadas,
    totalPainel,
    totalResumo,
    diferenca,
    confere: diferenca == null ? null : Math.abs(diferenca) <= 0.01,
    impostoDevido: moeda(imposto.impostoDevidoTotal),
    saldoPagar: moeda(imposto.saldoPagar),
    impostoRestituir: moeda(imposto.impostoRestituir),
  };
}
