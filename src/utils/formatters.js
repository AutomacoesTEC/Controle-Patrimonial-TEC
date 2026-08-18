export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function formatCPF(cpf) {
  if (!cpf) return '';
  const nums = cpf.replace(/\D/g, '');
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const nums = cnpj.replace(/\D/g, '');
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

export function parseBRLCurrency(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  // Datas "YYYY-MM-DD" (de <input type="date">) são convertidas por string,
  // sem passar por Date: "new Date('2026-03-15')" é interpretado como
  // 00:00 UTC, que vira 14/03 ao formatar em horário de Brasília (UTC-3).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

// Rótulos oficiais para os tipos de rendimento que o import por .DBK gera
// (registros 21/23/24), conferidos em 17/08/2026 contra o manual de ajuda
// do programa IRPF2026 (exercício 2026, ano-calendário 2025), arquivo
// "AjudaIRPF-new.pdf" fornecido pela usuária — "Rendimentos Isentos e Não
// Tributáveis" e "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva".
// Nomes truncados para caber na tela; o código completo confere com o
// manual. Qualquer código isento/exclusivo fora desta tabela (o manual não
// muda todo ano, mas pode ganhar código novo) cai no fallback abaixo, que
// mostra o número em vez de esconder ou inventar um rótulo.
export const RENDIMENTO_TIPOS_CONHECIDOS = {
  tributavel_pj: 'Tributável recebido de pessoa jurídica',
  isento_01: 'Isento: bolsa de estudo/pesquisa (doação, exceto médico-residente)',
  isento_02: 'Isento: bolsa de estudo/pesquisa (doação a médico-residente)',
  isento_03: 'Isento: capital de apólice de seguro/pecúlio por morte',
  isento_04: 'Isento: indenização rescisão de contrato (inclusive PDV) e FGTS',
  isento_05: 'Isento: ganho de capital, bem de pequeno valor',
  isento_06: 'Isento: ganho de capital, único imóvel até R$ 440.000,00',
  isento_07: 'Isento: ganho de capital, venda de imóvel residencial com reaplicação em 180 dias',
  isento_08: 'Isento: ganho de capital, moeda estrangeira em espécie de pequeno valor',
  isento_09: 'Isento: lucros e dividendos recebidos',
  isento_10: 'Isento: parcela isenta de aposentadoria/reforma/pensão (65 anos ou mais)',
  isento_11: 'Isento: aposentadoria/reforma/pensão por moléstia grave',
  isento_12: 'Isento: poupança, LH, LCI, LCA e assemelhados',
  isento_13: 'Isento: rendimento de sócio/titular de ME ou EPP',
  isento_14: 'Isento: transferência patrimonial, doação e herança',
  isento_15: 'Isento: parcela não tributável da atividade rural',
  isento_16: 'Isento: IR de anos-calendário anteriores compensado judicialmente',
  isento_17: 'Isento: 75% do trabalho assalariado em município da faixa de fronteira',
  isento_18: 'Isento: incorporação de reservas ao capital / bonificação em ações',
  isento_19: 'Isento: transferência patrimonial, meação e dissolução de sociedade conjugal',
  isento_20: 'Isento: ganhos líquidos no mercado à vista de ações em bolsa',
  isento_21: 'Isento: ganhos líquidos em operações com ouro, ativo financeiro',
  isento_22: 'Isento: recuperação de prejuízos em renda variável',
  isento_23: 'Isento: até 90% do rendimento de transporte de carga',
  isento_24: 'Isento: até 40% do rendimento de transporte de passageiros',
  isento_25: 'Isento: restituição do IR de anos-calendário anteriores',
  isento_27: 'Isento: juros dos Rendimentos Recebidos Acumuladamente',
  isento_28: 'Isento: pensão alimentícia',
  isento_99: 'Isento: outros',
  exclusivo_01: 'Tributação exclusiva: 13º salário',
  exclusivo_02: 'Tributação exclusiva: ganho de capital na alienação de bens/direitos',
  exclusivo_03: 'Tributação exclusiva: ganho de capital, bens em moeda estrangeira',
  exclusivo_04: 'Tributação exclusiva: ganho de capital, moeda estrangeira em espécie',
  exclusivo_05: 'Tributação exclusiva: ganhos líquidos em renda variável',
  exclusivo_06: 'Tributação exclusiva: rendimentos de aplicações financeiras',
  exclusivo_07: 'Tributação exclusiva: rendimentos recebidos acumuladamente',
  exclusivo_08: 'Tributação exclusiva: 13º salário de dependente',
  exclusivo_09: 'Tributação exclusiva: rendimentos recebidos acumuladamente por dependente',
  exclusivo_10: 'Tributação exclusiva: juros sobre capital próprio',
  exclusivo_11: 'Tributação exclusiva: participação nos lucros ou resultados',
  exclusivo_12: 'Tributação exclusiva: aplicações financeiras/lucros no exterior (Lei 14.754/2023)',
  exclusivo_13: 'Tributação exclusiva: prêmios líquidos em loterias de aposta de quota fixa',
  exclusivo_99: 'Tributação exclusiva: outros',
};

export function describeRendimentoTipo(tipo) {
  if (!tipo) return 'Não classificado';
  if (RENDIMENTO_TIPOS_CONHECIDOS[tipo]) return RENDIMENTO_TIPOS_CONHECIDOS[tipo];
  const m = /^(isento|exclusivo)_(\d+)$/.exec(tipo);
  if (m) {
    const categoria = m[1] === 'isento' ? 'Isento' : 'Tributação exclusiva';
    return `${categoria}, código ${m[2]} (confira este código na tabela do programa da Receita)`;
  }
  return tipo;
}

export function categoriaRendimento(tipo) {
  if (!tipo) return 'outro';
  if (tipo.startsWith('tributavel')) return 'tributavel';
  if (tipo.startsWith('isento')) return 'isento';
  if (tipo.startsWith('exclusivo')) return 'exclusivo';
  return 'outro';
}

export const CATEGORIAS_RENDIMENTO = {
  tributavel: { label: 'Tributáveis', cor: 'blue' },
  isento: { label: 'Isentos e não tributáveis', cor: 'green' },
  exclusivo: { label: 'Tributação exclusiva/definitiva', cor: 'purple' },
  outro: { label: 'Outros', cor: 'orange' },
};

// Tabela Códigos de Pagamentos, conferida em 17/08/2026 contra o manual
// oficial do programa IRPF2026 ("AjudaIRPF-new.pdf", ficha "Pagamentos
// Efetuados"). Nomes truncados para caber no <select>.
export const CODIGOS_PAGAMENTO = [
  { codigo: '01', nome: 'Despesa com instrução no Brasil' },
  { codigo: '02', nome: 'Despesa com instrução no exterior' },
  { codigo: '09', nome: 'Fonoaudiólogos no Brasil' },
  { codigo: '10', nome: 'Médicos no Brasil' },
  { codigo: '11', nome: 'Dentistas no Brasil' },
  { codigo: '12', nome: 'Psicólogos no Brasil' },
  { codigo: '13', nome: 'Fisioterapeutas no Brasil' },
  { codigo: '14', nome: 'Terapeutas ocupacionais no Brasil' },
  { codigo: '15', nome: 'Médicos no exterior' },
  { codigo: '16', nome: 'Dentistas no exterior' },
  { codigo: '17', nome: 'Psicólogos no exterior' },
  { codigo: '18', nome: 'Fisioterapeutas no exterior' },
  { codigo: '19', nome: 'Terapeutas ocupacionais no exterior' },
  { codigo: '20', nome: 'Fonoaudiólogos no exterior' },
  { codigo: '21', nome: 'Hospitais, clínicas e laboratórios no Brasil' },
  { codigo: '22', nome: 'Hospitais, clínicas e laboratórios no exterior' },
  { codigo: '26', nome: 'Planos de saúde no Brasil' },
  { codigo: '30', nome: 'Pensão alimentícia judicial, alimentando residente no Brasil' },
  { codigo: '31', nome: 'Pensão alimentícia judicial, alimentando não residente no Brasil' },
  { codigo: '33', nome: 'Pensão alimentícia por escritura pública, residente no Brasil' },
  { codigo: '34', nome: 'Pensão alimentícia por escritura pública, não residente no Brasil' },
  { codigo: '36', nome: 'Previdência complementar (inclusive Fapi)' },
  { codigo: '37', nome: 'Entidade de previdência complementar (§15 art. 40 CF)' },
  { codigo: '60', nome: 'Advogados, ação judicial exceto trabalhista' },
  { codigo: '61', nome: 'Advogados, ação judicial trabalhista' },
  { codigo: '62', nome: 'Advogados, demais honorários' },
  { codigo: '66', nome: 'Engenheiros, arquitetos e demais profissionais liberais' },
  { codigo: '70', nome: 'Aluguéis de imóveis' },
  { codigo: '71', nome: 'Administrador de imóvel' },
  { codigo: '72', nome: 'Corretor de imóveis' },
  { codigo: '76', nome: 'Arrendamento rural' },
  { codigo: '99', nome: 'Outros' },
];

export function describePagamentoCodigo(codigo) {
  return CODIGOS_PAGAMENTO.find(c => c.codigo === codigo)?.nome || '';
}

// Tipo de movimentação de um bem: como a situação atual dele muda quando a
// usuária registra uma compra, venda, benfeitoria etc (ver BemModal e
// RelatorioPage). Fica aqui para os dois usarem o mesmo rótulo.
export const MOVIMENTACAO_TIPOS = {
  compra: { label: 'Compra ou aquisição adicional', sinal: '+', ajuda: 'Valor pago pela aquisição. Soma ao valor declarado do bem.' },
  benfeitoria: { label: 'Benfeitoria ou melhoria', sinal: '+', ajuda: 'Custo da benfeitoria (reforma, construção, plantio etc). Soma ao valor declarado do bem.' },
  venda_parcial: { label: 'Venda parcial', sinal: '-', ajuda: 'A "Situação em 31/12" é o custo de aquisição, não o valor de mercado: informe a PARCELA DO CUSTO que sai (ex: vendeu 1/3 do imóvel, tire 1/3 do valor declarado), não o preço recebido na venda. Guarde o preço de venda na descrição, para o cálculo de ganho de capital.' },
  venda_total: { label: 'Venda total (zera o valor)', sinal: '0', ajuda: 'Zera o valor declarado do bem. Guarde o preço de venda na descrição, para o cálculo de ganho de capital.' },
  baixa: { label: 'Baixa: perda, doação, destruição (zera o valor)', sinal: '0', ajuda: 'Zera o valor declarado do bem.' },
  ajuste: { label: 'Ajuste direto de valor', sinal: '=', ajuda: 'Substitui o valor declarado do bem pelo valor informado. Use só para corrigir um erro de cadastro, não para registrar uma movimentação real.' },
};

// Grupos e códigos de Bens e Direitos conferidos em 17/08/2026 contra o
// manual de ajuda do programa IRPF2026 ("AjudaIRPF-new.pdf", "Tabela de
// Códigos de Bens e Direitos"). O grupo 08 (Criptoativos) e vários códigos
// dos grupos 01/02 estavam faltando na versão anterior desta tabela, que
// não tinha sido conferida contra fonte nenhuma.
export const GRUPOS_BENS = [
  { codigo: '01', nome: 'Bens Imóveis', cor: 'blue' },
  { codigo: '02', nome: 'Bens Móveis', cor: 'green' },
  { codigo: '03', nome: 'Participações Societárias', cor: 'purple' },
  { codigo: '04', nome: 'Aplicações e Investimentos', cor: 'orange' },
  { codigo: '05', nome: 'Créditos', cor: 'blue' },
  { codigo: '06', nome: 'Depósitos à Vista e Numerário', cor: 'green' },
  { codigo: '07', nome: 'Fundos', cor: 'purple' },
  { codigo: '08', nome: 'Criptoativos', cor: 'orange' },
  { codigo: '99', nome: 'Outros Bens e Direitos', cor: 'orange' },
];

export const CODIGOS_POR_GRUPO = {
  '01': [
    { codigo: '01', nome: 'Prédio residencial' },
    { codigo: '02', nome: 'Prédio comercial' },
    { codigo: '03', nome: 'Galpão' },
    { codigo: '11', nome: 'Apartamento' },
    { codigo: '12', nome: 'Casa' },
    { codigo: '13', nome: 'Terreno' },
    { codigo: '14', nome: 'Imóvel rural' },
    { codigo: '15', nome: 'Sala ou conjunto' },
    { codigo: '16', nome: 'Construção' },
    { codigo: '17', nome: 'Benfeitorias até 1988' },
    { codigo: '18', nome: 'Loja' },
    { codigo: '19', nome: 'Garagem avulsa' },
    { codigo: '99', nome: 'Outros bens imóveis' },
  ],
  '02': [
    { codigo: '01', nome: 'Veículo automotor terrestre (caminhão, automóvel, moto etc)' },
    { codigo: '02', nome: 'Aeronave' },
    { codigo: '03', nome: 'Embarcação' },
    { codigo: '04', nome: 'Bem relacionado com atividade autônoma' },
    { codigo: '05', nome: 'Quadro, objeto de arte, de coleção, antiguidade etc' },
    { codigo: '06', nome: 'Joia' },
    { codigo: '99', nome: 'Outros bens móveis' },
  ],
  '03': [
    { codigo: '01', nome: 'Ações (inclusive listadas em bolsa)' },
    { codigo: '02', nome: 'Quotas ou quinhões de capital' },
    { codigo: '03', nome: 'Holding patrimonial (ações/quotas por integralização de bens)' },
    { codigo: '99', nome: 'Outras participações societárias' },
  ],
  '04': [
    { codigo: '01', nome: 'Depósito em conta poupança' },
    { codigo: '02', nome: 'Títulos públicos e privados sujeitos a tributação (Tesouro Direto, CDB, RDB etc)' },
    { codigo: '03', nome: 'Títulos isentos de tributação (LCI, LCA, LCD, CRI, CRA, LIG etc)' },
    { codigo: '04', nome: 'Ativos negociados em bolsa no Brasil (BDRs, opções etc, exceto ações e fundos)' },
    { codigo: '05', nome: 'Ouro, ativo financeiro' },
    { codigo: '99', nome: 'Outras aplicações e investimentos' },
  ],
  '05': [
    { codigo: '01', nome: 'Empréstimos concedidos' },
    { codigo: '02', nome: 'Crédito decorrente de alienação' },
    { codigo: '99', nome: 'Outros créditos' },
  ],
  '06': [
    { codigo: '01', nome: 'Depósito em conta-corrente ou conta pagamento' },
    { codigo: '02', nome: 'Conta gráfica de agente operador de loterias de aposta de quota fixa' },
    { codigo: '10', nome: 'Dinheiro em espécie, moeda nacional' },
    { codigo: '11', nome: 'Dinheiro em espécie, moeda estrangeira' },
    { codigo: '99', nome: 'Outros depósitos à vista' },
  ],
  '07': [
    { codigo: '01', nome: 'Fundos sujeitos à tributação periódica (come-cotas)' },
    { codigo: '02', nome: 'Fiagro' },
    { codigo: '03', nome: 'Fundo de Investimento Imobiliário (FII)' },
    { codigo: '04', nome: 'Fundo de Investimento em Ações / FMP-FGTS' },
    { codigo: '06', nome: 'FIP/FIDC/ETF entidade de investimento sem come-cotas' },
    { codigo: '07', nome: 'FIP-IE e FIP-PD&I' },
    { codigo: '08', nome: 'Fundo de Índice de Renda Fixa (ETF)' },
    { codigo: '10', nome: 'Fundos de Infraestrutura, FIDC e outros (alíquota 0%)' },
    { codigo: '12', nome: 'Fundo de Investimento em Empresas Emergentes (FIEE)' },
    { codigo: '13', nome: 'Fundo multimercado' },
    { codigo: '99', nome: 'Fundos de investimento no exterior' },
  ],
  '08': [
    { codigo: '01', nome: 'Bitcoin (BTC)' },
    { codigo: '02', nome: 'Outras criptomoedas / altcoins (ETH, XRP, BCH, LTC etc)' },
    { codigo: '03', nome: 'Stablecoins (USDT, USDC, BRZ, BUSD, DAI etc)' },
    { codigo: '10', nome: 'NFTs (Non-Fungible Tokens)' },
    { codigo: '99', nome: 'Outros criptoativos' },
  ],
  '99': [
    { codigo: '01', nome: 'Licença e concessão especiais' },
    { codigo: '02', nome: 'Título de clube e assemelhado' },
    { codigo: '03', nome: 'Direito de autor, de inventor e patente' },
    { codigo: '04', nome: 'Direito de lavra e assemelhado' },
    { codigo: '05', nome: 'Consórcio não contemplado' },
    { codigo: '06', nome: 'VGBL, Vida Gerador de Benefício Livre' },
    { codigo: '07', nome: 'Juros sobre capital próprio creditado, mas não pago' },
    { codigo: '08', nome: 'Leasing com opção de compra a exercer no fim do contrato' },
    { codigo: '99', nome: 'Outros bens e direitos' },
  ],
};

// Mantidos por compatibilidade com quem já importava estes nomes.
export const CODIGOS_IMOVEL = CODIGOS_POR_GRUPO['01'];
export const CODIGOS_VEICULO = CODIGOS_POR_GRUPO['02'];