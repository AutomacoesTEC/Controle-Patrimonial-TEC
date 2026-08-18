import * as XLSX from 'xlsx';
import { formatCpfCnpj, formatDate, MOVIMENTACAO_TIPOS } from './formatters';

const resumoMovimentacoes = (bem) => (bem.movimentacoes || []).map(m =>
  `${MOVIMENTACAO_TIPOS[m.tipo]?.label || m.tipo} em ${formatDate(m.data)}`
).join('; ');

export function exportToXlsx(data, fileName = 'variacao_patrimonial') {
  const wb = XLSX.utils.book_new();

  // Aba 1: Bens e Direitos
  if (data.bens && data.bens.length > 0) {
    const bensData = data.bens.map(b => ({
      'Grupo': b.grupo || '',
      'Código': b.codigo_bem || '',
      'Discriminação': b.discriminacao || '',
      'Situação Ano Anterior': b.situacao_anterior || 0,
      'Situação Ano Atual': b.situacao_atual || 0,
      'Variação': (b.situacao_atual || 0) - (b.situacao_anterior || 0),
      'Localização': b.localizacao || '',
      'CNPJ/CPF': formatCpfCnpj(b.cnpj),
      'Beneficiário': b.beneficiario || 'Titular',
      'Movimentações no Ano': resumoMovimentacoes(b),
    }));
    const ws1 = XLSX.utils.json_to_sheet(bensData);
    ws1['!cols'] = [
      {wch:6},{wch:8},{wch:50},{wch:18},{wch:18},{wch:18},{wch:12},{wch:20},{wch:12},{wch:50}
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Bens e Direitos');
  }

  // Aba 2: Dívidas e Ônus Reais
  if (data.dividas && data.dividas.length > 0) {
    const dividasData = data.dividas.map(d => ({
      'Código': d.codigo || '',
      'Discriminação': d.discriminacao || '',
      'Situação Ano Anterior': d.situacao_anterior || 0,
      'Situação Ano Atual': d.situacao_atual || 0,
      'Valor Pago no Ano': d.valor_pago || 0,
    }));
    const ws2 = XLSX.utils.json_to_sheet(dividasData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Dívidas');
  }

  // Aba 3: Rendimentos
  if (data.rendimentos && data.rendimentos.length > 0) {
    const rendData = data.rendimentos.map(r => ({
      'Tipo': r.tipo || '',
      'CNPJ Fonte': formatCpfCnpj(r.cnpj_fonte),
      'Nome Fonte': r.nome_fonte || '',
      'Beneficiário': r.beneficiario || 'Titular',
      'Valor': r.valor || 0,
    }));
    const ws3 = XLSX.utils.json_to_sheet(rendData);
    XLSX.utils.book_append_sheet(wb, ws3, 'Rendimentos');
  }

  // Aba 4: Pagamentos Efetuados
  if (data.pagamentos && data.pagamentos.length > 0) {
    const pagData = data.pagamentos.map(p => ({
      'Código': p.codigo || '',
      'Nome Beneficiário': p.nome_beneficiario || '',
      'CPF/CNPJ': formatCpfCnpj(p.cpf_cnpj),
      'Valor Pago': p.valor_pago || 0,
      'Parcela Não Dedutível': p.parcela_nao_dedutivel || 0,
      'Descrição': p.descricao || '',
    }));
    const ws4 = XLSX.utils.json_to_sheet(pagData);
    XLSX.utils.book_append_sheet(wb, ws4, 'Pagamentos');
  }

  // Aba 5: Resumo / Variação Patrimonial
  const resumo = [
    { 'Item': 'Total Bens Ano Anterior', 'Valor': data.totalBensAnterior || 0 },
    { 'Item': 'Total Bens Ano Atual', 'Valor': data.totalBensAtual || 0 },
    { 'Item': 'Total Dívidas Ano Anterior', 'Valor': data.totalDividasAnterior || 0 },
    { 'Item': 'Total Dívidas Ano Atual', 'Valor': data.totalDividasAtual || 0 },
    { 'Item': 'Patrimônio Líquido Anterior', 'Valor': (data.totalBensAnterior || 0) - (data.totalDividasAnterior || 0) },
    { 'Item': 'Patrimônio Líquido Atual', 'Valor': (data.totalBensAtual || 0) - (data.totalDividasAtual || 0) },
    { 'Item': 'Variação Patrimonial', 'Valor': ((data.totalBensAtual || 0) - (data.totalDividasAtual || 0)) - ((data.totalBensAnterior || 0) - (data.totalDividasAnterior || 0)) },
  ];
  const ws5 = XLSX.utils.json_to_sheet(resumo);
  ws5['!cols'] = [{wch:30},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws5, 'Variação Patrimonial');

  // Gerar o arquivo
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${fileName}_${data.anoCalendario || 'export'}_${today}.xlsx`);
}

export function exportBensToXlsx(bens, anoCalendario) {
  const wb = XLSX.utils.book_new();
  const bensData = bens.map(b => ({
    'Grupo': b.grupo || '',
    'Cód. Bem': b.codigo_bem || '',
    'Discriminação': b.discriminacao || '',
    'Situação 31/12 Anterior': b.situacao_anterior || 0,
    'Situação 31/12 Atual': b.situacao_atual || 0,
    'Variação R$': (b.situacao_atual || 0) - (b.situacao_anterior || 0),
    'Localização': b.localizacao || '',
    'CNPJ': formatCpfCnpj(b.cnpj),
    'Inscrição Municipal': b.inscricao_municipal || '',
    'Matrícula': b.matricula || '',
    'RENAVAM': b.renavam || '',
    'Beneficiário': b.beneficiario || 'Titular',
    'Movimentações no Ano': resumoMovimentacoes(b),
  }));
  const ws = XLSX.utils.json_to_sheet(bensData);
  ws['!cols'] = [{wch:6},{wch:8},{wch:50},{wch:18},{wch:18},{wch:15},{wch:10},{wch:20},{wch:18},{wch:12},{wch:16},{wch:12},{wch:50}];
  XLSX.utils.book_append_sheet(wb, ws, 'Bens e Direitos');
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `bens_direitos_${anoCalendario || ''}_${today}.xlsx`);
}