import { arredondarCentavos } from '../utils/formatters';
import { pessoaDoRegistro } from './titularidade';

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

// Identidade estável do item entre anos: a chave que o rollover carimba
// (chaveContinuidade) ou a que veio da importação. É o pareamento sem
// ambiguidade — texto e valor não entram.
const identidadeEstavel = (item) => item.chaveContinuidade || item.chaveImportacao || item.controle || null;

// P05: pessoa definida e diferente nas duas pontas ⇒ não é o mesmo registro.
// 'nao-informada' e 'dependente-sem-identificacao' ficam ambíguos e não
// bloqueiam (mantém o comportamento de quem não declara titularidade no item).
const pessoaDefinida = (p) => p !== 'nao-informada' && p !== 'dependente-sem-identificacao';
function pessoasConflitantes(a, b, dependentes) {
  const pa = pessoaDoRegistro(a, dependentes);
  const pb = pessoaDoRegistro(b, dependentes);
  return pessoaDefinida(pa) && pessoaDefinida(pb) && pa !== pb;
}

function similaridade(a, b, camposCodigo, dependentes = []) {
  if (codigo(a, camposCodigo) !== codigo(b, camposCodigo)) return 0;
  // P05: não parear o registro de uma pessoa com o de outra, por mais
  // parecido que o texto seja.
  if (pessoasConflitantes(a, b, dependentes)) return 0;
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

function casar(anteriores, seguintes, camposCodigo, dependentes = []) {
  const usadosA = new Set(), usadosB = new Set(), pares = [];

  // Passo 1: identidade estável exata, 1-para-1. Se a mesma chave aparece
  // mais de uma vez de um lado, é ambígua — não pareia por aqui.
  const seguintesPorChave = new Map();
  seguintes.forEach((b, ib) => {
    const k = identidadeEstavel(b);
    if (k == null) return;
    if (!seguintesPorChave.has(k)) seguintesPorChave.set(k, []);
    seguintesPorChave.get(k).push(ib);
  });
  anteriores.forEach((a, ia) => {
    const k = identidadeEstavel(a);
    if (k == null) return;
    const livres = (seguintesPorChave.get(k) || []).filter(ib => !usadosB.has(ib));
    if (livres.length === 1 && (seguintesPorChave.get(k) || []).length === 1) {
      usadosA.add(ia); usadosB.add(livres[0]); pares.push([ia, livres[0]]);
    }
  });

  // Passo 2: pontuação por texto/documento, só entre o que sobrou.
  const candidatos = [];
  anteriores.forEach((a, ia) => {
    if (usadosA.has(ia)) return;
    seguintes.forEach((b, ib) => {
      if (usadosB.has(ib)) return;
      const nota = similaridade(a, b, camposCodigo, dependentes);
      if (nota >= 0.65) candidatos.push({ ia, ib, nota });
    });
  });
  candidatos.sort((a, b) => b.nota - a.nota || a.ia - b.ia || a.ib - b.ib);
  for (const candidato of candidatos) {
    if (usadosA.has(candidato.ia) || usadosB.has(candidato.ib)) continue;
    // Empate real: mais de um par livre com a MESMA nota disputando este
    // item dos dois lados ⇒ ambiguidade, não pareia por índice (P05).
    const empatados = candidatos.filter(x => x.nota === candidato.nota
      && !usadosA.has(x.ia) && !usadosB.has(x.ib)
      && (x.ia === candidato.ia || x.ib === candidato.ib));
    if (empatados.length > 1) continue;
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

  const dependentes = [...(anterior.dependentes || []), ...(seguinte.dependentes || [])];
  const divergencias = [];
  for (const cfg of CONFIGURACOES) {
    const listaA = anterior[cfg.campo] || [], listaB = seguinte[cfg.campo] || [];
    const { pares, usadosA, usadosB } = casar(listaA, listaB, cfg.codigos, dependentes);
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
