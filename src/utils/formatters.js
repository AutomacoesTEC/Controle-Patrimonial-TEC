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

// Rótulos conhecidos para os tipos de rendimento que o import por .DBK gera
// (registros 21/23/24). Só entram aqui códigos que já estavam mapeados no
// app antes desta revisão — não inventar rótulo para código não conferido
// na fonte oficial. Qualquer outro código isento/exclusivo cai no fallback
// abaixo, que mostra o número do código em vez de esconder ou inventar.
const RENDIMENTO_TIPOS_CONHECIDOS = {
  tributavel_pj: 'Tributável recebido de pessoa jurídica',
  isento_09: 'Isento, código 09',
  isento_10: 'Isento, código 10',
  isento_12: 'Isento, código 12',
  exclusivo_01: 'Tributação exclusiva, código 01',
  exclusivo_06: 'Tributação exclusiva, código 06',
  exclusivo_10: 'Tributação exclusiva, código 10',
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

export const GRUPOS_BENS = [
  { codigo: '01', nome: 'Bens Imóveis', cor: 'blue' },
  { codigo: '02', nome: 'Bens Móveis', cor: 'green' },
  { codigo: '03', nome: 'Participações Societárias', cor: 'purple' },
  { codigo: '04', nome: 'Aplicações e Investimentos', cor: 'orange' },
  { codigo: '05', nome: 'Créditos e Poupança', cor: 'blue' },
  { codigo: '06', nome: 'Depósito à Vista e Numerário', cor: 'green' },
  { codigo: '07', nome: 'Fundos', cor: 'purple' },
  { codigo: '99', nome: 'Outros Bens e Direitos', cor: 'orange' },
];

export const CODIGOS_IMOVEL = [
  { codigo: '01', nome: 'Prédio residencial' },
  { codigo: '02', nome: 'Prédio comercial' },
  { codigo: '03', nome: 'Galpão' },
  { codigo: '11', nome: 'Apartamento' },
  { codigo: '12', nome: 'Casa' },
  { codigo: '13', nome: 'Terreno' },
  { codigo: '14', nome: 'Imóvel rural' },
  { codigo: '15', nome: 'Sala ou conjunto' },
  { codigo: '16', nome: 'Construção' },
  { codigo: '17', nome: 'Benfeitorias' },
  { codigo: '19', nome: 'Outros imóveis' },
];

export const CODIGOS_VEICULO = [
  { codigo: '01', nome: 'Veículo automotor terrestre' },
  { codigo: '02', nome: 'Aeronave' },
  { codigo: '03', nome: 'Embarcação' },
  { codigo: '99', nome: 'Outros bens móveis' },
];