import * as XLSX from 'xlsx';
import { formatCpfCnpj, formatDate, describeRendimentoTipo, MOVIMENTACAO_TIPOS } from './formatters';
import { rotuloOrigemRegistro } from './origemRegistro';

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
      // CPF de quem recebeu, quando o bem é do dependente: sem ele, a coluna
      // Beneficiário não diz DE QUAL dependente se trata (achado 14).
      'CPF do Beneficiário': formatCpfCnpj(b.cpf_beneficiario),
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
    // `describeRendimentoTipo`, e não o código cru: esta planilha é o que vai
    // para quem preenche a declaração, e "isento_09" não diz nada, enquanto
    // "Isento: lucros e dividendos recebidos" diz. A tela de Rendimentos já
    // exportava assim; só esta aba do export do Dashboard tinha ficado para
    // trás, junto com as colunas Data e IRRF, que faltavam. Achado na
    // auditoria de 21/08/2026.
    const rendData = data.rendimentos.map(r => ({
      'Tipo': describeRendimentoTipo(r.tipo),
      'Data': formatDate(r.data),
      'CNPJ Fonte': formatCpfCnpj(r.cnpj_fonte),
      'Nome Fonte': r.nome_fonte || '',
      'Beneficiário': r.beneficiario || 'Titular',
      'Valor': r.valor || 0,
      'IRRF': r.irrf || 0,
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
  // "Evolução Patrimonial", e não "Variação Patrimonial": esta linha é o
  // crescimento do patrimônio LÍQUIDO, e o Demonstrativo do Dashboard chama de
  // "Variação Patrimonial Total" o impacto no CAIXA, que é o negativo disso. A
  // auditoria de 24/08/2026 conferiu que o número exportado bate com o exibido
  // na tela (a inversão em relação ao valor interno é deliberada, e pedido da
  // usuária), então o que faltava era só não usar o mesmo nome para as duas
  // grandezas — é a ficha "Evolução Patrimonial" da própria declaração.
  const resumo = [
    { 'Item': 'Total Bens Ano Anterior', 'Valor': data.totalBensAnterior || 0 },
    { 'Item': 'Total Bens Ano Atual', 'Valor': data.totalBensAtual || 0 },
    { 'Item': 'Total Dívidas Ano Anterior', 'Valor': data.totalDividasAnterior || 0 },
    { 'Item': 'Total Dívidas Ano Atual', 'Valor': data.totalDividasAtual || 0 },
    { 'Item': 'Patrimônio Líquido Anterior', 'Valor': (data.totalBensAnterior || 0) - (data.totalDividasAnterior || 0) },
    { 'Item': 'Patrimônio Líquido Atual', 'Valor': (data.totalBensAtual || 0) - (data.totalDividasAtual || 0) },
    { 'Item': 'Evolução do Patrimônio Líquido', 'Valor': ((data.totalBensAtual || 0) - (data.totalDividasAtual || 0)) - ((data.totalBensAnterior || 0) - (data.totalDividasAnterior || 0)) },
  ];
  const ws5 = XLSX.utils.json_to_sheet(resumo);
  ws5['!cols'] = [{wch:30},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws5, 'Evolução Patrimonial');

  // Gerar o arquivo
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${fileName}_${data.anoCalendario || 'export'}_${today}.xlsx`);
}

// Exportador genérico de uma aba só: cada página de cadastro (Dívidas,
// Rendimentos, Pagamentos, Despesas Gerais...) passa suas próprias colunas,
// pra exportar exatamente o que está naquela tela — não um recorte de um
// export combinado de outra aba.
export function exportListaToXlsx(linhas, colunas, nomeAba, prefixoArquivo, anoCalendario) {
  const wb = XLSX.utils.book_new();
  const dados = linhas.map(linha => {
    const obj = {};
    colunas.forEach(([cabecalho, valor]) => { obj[cabecalho] = valor(linha); });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(dados);
  XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `${prefixoArquivo}_${anoCalendario || ''}_${today}.xlsx`);
}

export { resumoMovimentacoes };

export function exportBensToXlsx(bens, anoCalendario) {
  const wb = XLSX.utils.book_new();
  const bensData = bens.map(b => ({
    // Número do item impresso na ficha, que é como se acha o bem no papel e
    // no Demonstrativo da Lei 14.754/2023.
    'Item': b.numeroItem || '',
    'Origem': rotuloOrigemRegistro(b),
    'Grupo': b.grupo || '',
    'Cód. Bem': b.codigo_bem || '',
    'Discriminação': b.discriminacao || '',
    'Situação 31/12 Anterior': b.situacao_anterior || 0,
    'Situação 31/12 Atual': b.situacao_atual || 0,
    'Variação R$': (b.situacao_atual || 0) - (b.situacao_anterior || 0),
    // Nome do país quando a declaração o traz; o código sozinho ("105") não
    // diz nada para quem confere.
    'País': b.paisNome || b.localizacao || '',
    'CNPJ': formatCpfCnpj(b.cnpj),
    'Inscrição Municipal': b.inscricao_municipal || '',
    'Matrícula': b.matricula || '',
    'RENAVAM': b.renavam || '',
    // Sem beneficiário informado a coluna fica VAZIA. Assumir "Titular" é
    // afirmar de quem é o bem sem ter o dado, e bem de dependente não é
    // patrimônio do titular.
    'Beneficiário': b.beneficiario || '',
    'CPF do Beneficiário': formatCpfCnpj(b.cpf_beneficiario),
    'Movimentações no Ano': resumoMovimentacoes(b),
  }));
  const ws = XLSX.utils.json_to_sheet(bensData);
  ws['!cols'] = [{wch:6},{wch:18},{wch:6},{wch:8},{wch:50},{wch:18},{wch:18},{wch:15},{wch:24},{wch:20},{wch:18},{wch:12},{wch:16},{wch:14},{wch:18},{wch:50}];
  XLSX.utils.book_append_sheet(wb, ws, 'Bens e Direitos');
  const today = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `bens_direitos_${anoCalendario || ''}_${today}.xlsx`);
}
