const digitos = v => String(v || '').replace(/\D/g, '');
const nomeNormalizado = v => String(v || '').trim().toLocaleLowerCase('pt-BR');

export function pessoaDoRegistro(item = {}, dependentes = []) {
  const tipo = nomeNormalizado(item.titularidade || item.beneficiario);
  const cpf = digitos(item.cpf_titularidade || item.cpf_beneficiario || item.cpf_dependente || item.cpfDependente);
  if (tipo === 'titular' || tipo === 't') return 'titular';
  if (tipo === 'alimentando') return 'alimentando';
  if (cpf) return cpf;
  if (item.dependenteId != null) return `id:${item.dependenteId}`;
  const nome = nomeNormalizado(item.titularidadeNome || item.nome_dependente);
  if (nome && (tipo === 'dependente' || tipo === 'd')) {
    const encontrados = dependentes.filter(d => nomeNormalizado(d.nome) === nome);
    if (encontrados.length === 1) return digitos(encontrados[0].cpf) || `id:${encontrados[0].id}`;
  }
  return tipo === 'dependente' || tipo === 'd' ? 'dependente-sem-identificacao' : 'nao-informada';
}

export function rotuloTitularidade(item, dependentes = []) {
  const pessoa = pessoaDoRegistro(item, dependentes);
  if (pessoa === 'titular') return 'Titular';
  if (pessoa === 'nao-informada') return 'Não informada';
  if (pessoa === 'alimentando') return `Alimentando${item.titularidadeNome ? `: ${item.titularidadeNome}` : ''}`;
  const d = dependentes.find(d => (digitos(d.cpf) || `id:${d.id}`) === pessoa);
  return `Dependente: ${d?.nome || item.nome_dependente || item.titularidadeNome || (pessoa === 'dependente-sem-identificacao' ? 'não identificado' : pessoa)}`;
}

export function dependentesDoFormulario(state, data) {
  const ano = Number(String(data || '').slice(0, 4));
  return (ano && ano !== state.anoCalendario ? state.historico?.[ano]?.dependentes : null) || state.dependentes || [];
}

const COLECOES = [
  'bens', 'dividas', 'rendimentos', 'pagamentos', 'pagamentosDiversos',
  'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial',
  'imoveisRurais', 'bensRurais', 'dividasRurais', 'lancamentosRurais',
  'apuracaoGanhoCapital', 'receitasDespesasRuraisOficial',
  'rendaVariavelMensalOficial', 'rendaVariavelMensalManual',
  'fiiFiagroMensalOficial', 'fiiFiagroMensalManual',
];

export function filtrarPorPessoa(state, pessoa = 'todos') {
  if (pessoa === 'todos') return state;
  const recortarAno = ano => {
    const r = { ...ano };
    for (const campo of COLECOES) r[campo] = (ano[campo] || []).filter(item => {
      // Na ficha mensal da Receita, ausência de CPF do dependente identifica
      // a ficha do titular. Essa convenção não vale para pagamentos/dívidas.
      const mensal = /(?:Variavel|Fiagro)Mensal/.test(campo);
      const identificado = pessoaDoRegistro(item, ano.dependentes || []);
      return (mensal && identificado === 'nao-informada' ? 'titular' : identificado) === pessoa;
    });
    // Totais fiscais/rurais agregados não têm atribuição individual segura.
    r.impostoDevido = null;
    r.ganhosCapitalOficial = null;
    r.rendaVariavelAnualOficial = null;
    r.fiiFiagroAnualOficial = null;
    r.apuracaoResultadoRuralOficial = null;
    r.prejuizoRuralAcompensar = 0;
    return r;
  };
  return { ...recortarAno(state), historico: Object.fromEntries(Object.entries(state.historico || {}).map(([ano, dados]) => [ano, recortarAno(dados)])) };
}
