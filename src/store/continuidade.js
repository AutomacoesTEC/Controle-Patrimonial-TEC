import { arredondarCentavos } from '../utils/formatters';

const CONFIGURACOES = [
  { campo: 'bens', categoria: 'Bem', codigos: ['grupo', 'codigo_bem'] },
  { campo: 'dividas', categoria: 'Dívida', codigos: ['codigo'] },
  { campo: 'bensRurais', categoria: 'Bem rural', codigos: ['codigo'] },
  { campo: 'dividasRurais', categoria: 'Dívida rural', codigos: ['codigo'] },
];
const CAMPOS_IDENTIFICADORES = ['cnpj', 'cpf_cnpj', 'matricula', 'renavam', 'numeroConta', 'agencia'];

const normalizar = (valor) => String(valor || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const tokens = (valor) => new Set(normalizar(valor).split(' ').filter(Boolean));
const codigo = (item, campos) => campos.map(c => normalizar(item[c])).join('|');
const identificadores = (item) => new Set(CAMPOS_IDENTIFICADORES.map(c => normalizar(item[c])).filter(Boolean));

function similaridade(a, b, camposCodigo) {
  if (codigo(a, camposCodigo) !== codigo(b, camposCodigo)) return 0;
  const textoA = normalizar(a.discriminacao || a.descricao || a.nome);
  const textoB = normalizar(b.discriminacao || b.descricao || b.nome);
  if (!textoA || !textoB) return 0;
  // Descrição exata vem antes de CNPJ: duas contas podem pertencer ao mesmo
  // banco, e o documento compartilhado não pode trocar os pares pela ordem.
  if (textoA === textoB) return 1;
  const idsA = identificadores(a), idsB = identificadores(b);
  if ([...idsA].some(id => idsB.has(id))) return 0.95;
  const ta = tokens(textoA), tb = tokens(textoB);
  const intersecao = [...ta].filter(t => tb.has(t)).length;
  const uniao = new Set([...ta, ...tb]).size;
  return uniao ? intersecao / uniao : 0;
}

function casar(anteriores, seguintes, camposCodigo) {
  const candidatos = [];
  anteriores.forEach((a, ia) => seguintes.forEach((b, ib) => {
    const nota = similaridade(a, b, camposCodigo);
    if (nota >= 0.65) candidatos.push({ ia, ib, nota });
  }));
  candidatos.sort((a, b) => b.nota - a.nota || a.ia - b.ia || a.ib - b.ib);
  const usadosA = new Set(), usadosB = new Set(), pares = [];
  for (const candidato of candidatos) {
    if (usadosA.has(candidato.ia) || usadosB.has(candidato.ib)) continue;
    usadosA.add(candidato.ia);
    usadosB.add(candidato.ib);
    pares.push([candidato.ia, candidato.ib]);
  }
  return { pares, usadosA, usadosB };
}

const dadosDoAno = (state, ano) => Number(state?.anoCalendario) === Number(ano)
  ? state : state?.historico?.[ano] || null;
const nomeItem = (item) => item.discriminacao || item.descricao || item.nome || 'Item sem descrição';
const dinheiro = (valor) => arredondarCentavos(parseFloat(valor) || 0);

export function conferirContinuidade(state, anoAnterior) {
  const anoSeguinte = Number(anoAnterior) + 1;
  const anterior = dadosDoAno(state, anoAnterior);
  const seguinte = dadosDoAno(state, anoSeguinte);
  if (!anterior || !seguinte) {
    return { disponivel: false, anoAnterior: Number(anoAnterior), anoSeguinte, divergencias: [] };
  }

  const divergencias = [];
  for (const cfg of CONFIGURACOES) {
    const listaA = anterior[cfg.campo] || [], listaB = seguinte[cfg.campo] || [];
    const { pares, usadosA, usadosB } = casar(listaA, listaB, cfg.codigos);
    for (const [ia, ib] of pares) {
      const fechamento = dinheiro(listaA[ia].situacao_atual);
      const abertura = dinheiro(listaB[ib].situacao_anterior);
      const diferenca = arredondarCentavos(abertura - fechamento);
      if (Math.abs(diferenca) > 0.01) divergencias.push({
        tipo: 'saldo_divergente', categoria: cfg.categoria,
        identificacao: nomeItem(listaB[ib]), fechamento, abertura, diferenca,
      });
    }
    listaA.forEach((item, indice) => {
      const fechamento = dinheiro(item.situacao_atual);
      if (!usadosA.has(indice) && fechamento !== 0) divergencias.push({
        tipo: 'sumiu_com_saldo', categoria: cfg.categoria,
        identificacao: nomeItem(item), fechamento, abertura: null, diferenca: -fechamento,
      });
    });
    listaB.forEach((item, indice) => {
      const abertura = dinheiro(item.situacao_anterior);
      if (!usadosB.has(indice) && abertura !== 0) divergencias.push({
        tipo: 'apareceu_com_saldo', categoria: cfg.categoria,
        identificacao: nomeItem(item), fechamento: null, abertura, diferenca: abertura,
      });
    });
  }
  return { disponivel: true, anoAnterior: Number(anoAnterior), anoSeguinte, divergencias };
}
