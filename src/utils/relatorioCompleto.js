// Cada ficha disponível conserva seus campos, inclusive os que ainda não têm
// coluna dedicada na interface. Valores aninhados viram colunas por caminho,
// evitando células JSON opacas e a perda de dados complementares importados.
export const FICHAS_RELATORIO = [
  ['contribuinte', 'Titular'], ['dependentes', 'Dependentes'], ['bens', 'Bens - dados completos'],
  ['dividas', 'Dívidas'], ['rendimentos', 'Rendimentos'], ['pagamentos', 'Pagamentos'],
  ['pagamentosDiversos', 'Despesas Gerais'], ['doacoesEfetuadasOficial', 'Doações Efetuadas'],
  ['doacoesPartidosOficial', 'Doações Partidos'], ['doacoesEcaIdosoOficial', 'Doações ECA e Idoso'],
  ['imoveisRurais', 'Imóveis Rurais'], ['bensRurais', 'Bens Rurais'], ['dividasRurais', 'Dívidas Rurais'],
  ['lancamentosRurais', 'Livro-caixa Rural'], ['prejuizoRuralAcompensar', 'Prejuízo Rural'],
  ['receitasDespesasRuraisOficial', 'Rural Mensal Importado'], ['apuracaoResultadoRuralOficial', 'Rural Apuração Importada'],
  ['movimentacaoRebanhoOficial', 'Rebanho'], ['participantesRuraisOficial', 'Participantes Rurais'],
  ['apuracaoGanhoCapital', 'Ganhos Capital Resumo'], ['ganhosCapitalOficial', 'Ganhos Capital Oficial'],
  ['rendaVariavelMensalOficial', 'RV Importada'], ['rendaVariavelMensalManual', 'RV Manual'],
  ['rendaVariavelAnualOficial', 'RV Anual Importada'], ['fiiFiagroMensalOficial', 'FII Importado'],
  ['fiiFiagroMensalManual', 'FII Manual'], ['fiiFiagroAnualOficial', 'FII Anual Importado'],
  ['impostoDevido', 'Resumo Importado'], ['demonstrativoExteriorOficial', 'Exterior Importado'],
  ['espolioOficial', 'Espólio'], ['saidaDefinitivaOficial', 'Saída Definitiva'],
  ['avisosImportacao', 'Avisos Importação'], ['fichasNaoLidasComConteudo', 'Fichas Não Lidas'],
];

const ROTULOS = {
  id: 'Identificador', nome: 'Nome', cpf: 'CPF', data: 'Data', valor: 'Valor',
  discriminacao: 'Discriminação', descricao: 'Descrição', beneficiario: 'Beneficiário',
  titularidade: 'Titularidade', cpf_beneficiario: 'CPF do beneficiário', cpf_dependente: 'CPF do dependente',
  cpf_titularidade: 'CPF do proprietário', dependenteId: 'Identificador do dependente', nome_dependente: 'Nome do dependente',
  data_aquisicao: 'Data de aquisição', dataAquisicao: 'Data de aquisição (cadastro)',
  situacao_anterior: 'Saldo anterior', situacao_atual: 'Saldo atual', valor_pago: 'Valor pago',
  previdencia_oficial: 'Previdência oficial', previdenciaOficial: 'Previdência oficial (cadastro)',
  pensao_alimenticia: 'Pensão alimentícia', pensaoAlimenticia: 'Pensão alimentícia (cadastro)',
  decimoTerceiro: '13º salário', irrf: 'IRRF', nome_fonte: 'Nome da fonte', cnpj_fonte: 'CNPJ da fonte',
  origem: 'Origem', movimentacoes: 'Movimentações', valorDeclarado: 'Dados declarados originais',
};

function achatar(valor, caminho = [], saida = {}) {
  if (valor !== null && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      achatar(filho, [...caminho, Array.isArray(valor) ? `Item ${Number(chave) + 1}` : (ROTULOS[chave] || chave)], saida);
    }
  } else {
    saida[caminho.join(' / ') || 'Valor'] = valor ?? '';
  }
  return saida;
}

export function abasRelatorioCompleto(dados = {}) {
  const fiscais = FICHAS_RELATORIO.flatMap(([campo, nome]) => {
    const valor = dados[campo];
    if (valor == null || (Array.isArray(valor) && !valor.length)) return [];
    const linhas = (Array.isArray(valor) ? valor : [valor]).map(item => achatar(item));
    return linhas.some(linha => Object.keys(linha).length) ? [{ nome, linhas }] : [];
  });
  const a = dados.acompanhamento;
  if (!a) return fiscais;
  const monetarios = new Set(['valor', 'saldoInicial', 'principal', 'juros', 'taxas', 'imposto', 'saldo', 'precoContrato', 'custoBaixado', 'despesasVenda']);
  const financeiros = [['contas', 'Contas globais'], ['operacoes', 'Operações globais'], ['parcelas', 'Parcelas globais'], ['lancamentos', 'Razão financeiro global'], ['extratos', 'Extratos globais'], ['documentos', 'Documentos externos'], ['avaliacoes', 'Mercado não fiscal'], ['fechamentos', 'Fechamentos financeiros'], ['revisoes', 'Pareceres de revisão']].flatMap(([campo, nome]) => {
    const linhas = (a[campo] || []).map(item => achatar(Object.fromEntries(Object.entries(item).filter(([k]) => k !== 'snapshot').map(([k, v]) => monetarios.has(k) ? [`${k} (R$)`, v == null ? 'Não informado' : v / 100] : [k, v]))));
    return linhas.length ? [{ nome, linhas }] : [];
  });
  return [...fiscais, ...financeiros];
}
