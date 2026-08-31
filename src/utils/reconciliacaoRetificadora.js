// Sugestão automática de vínculo entre um bem/dívida da declaração anterior
// (já importada) e o mesmo item na retificadora — pura, sem estado, pra
// poder testar isolado e pra ser reaproveitada pelo componente de tela.

function normalizar(s) {
  return (s || '')
    .toString()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function bigramas(s) {
  const t = normalizar(s);
  if (t.length < 2) return new Set([t]);
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

// Coeficiente de Dice sobre bigramas: 1 = textos idênticos, 0 = nada em
// comum. Simples e sem dependência externa — suficiente pra sugerir, a
// decisão final é sempre da usuária.
export function similaridade(a, b) {
  const ba = bigramas(a);
  const bb = bigramas(b);
  if (ba.size === 0 && bb.size === 0) return 1;
  let comuns = 0;
  for (const bg of ba) if (bb.has(bg)) comuns++;
  return (2 * comuns) / (ba.size + bb.size);
}

const LIMIAR_SUGESTAO = 0.35;

// Casa cada item novo (da retificadora) com o melhor candidato entre os
// antigos (já importados antes), exigindo código igual e pontuando por
// similaridade da discriminação. Não usa o id (o parser gera ids novos a
// cada import) — só código + texto. Vínculo é 1-para-1 (guloso pela maior
// similaridade), sobra vira órfão dos dois lados.
// `campoCodigo` existe porque bens guardam o código em `codigo_bem`
// (BemModal/importParsers) e dívidas em `codigo` (DividasPage) — nomes de
// campo diferentes para o mesmo conceito.
export function sugerirVinculos(antigos, novos, campoCodigo = 'codigo', campoDescricao = 'discriminacao') {
  const antigosDisponiveis = new Map((antigos || []).map(a => [a.id, a]));
  const candidatos = [];
  for (const novo of novos || []) {
    for (const antigo of antigos || []) {
      if (normalizar(antigo[campoCodigo]) !== normalizar(novo[campoCodigo])) continue;
      const score = similaridade(antigo[campoDescricao], novo[campoDescricao]);
      if (score >= LIMIAR_SUGESTAO) candidatos.push({ novo, antigo, score });
    }
  }
  candidatos.sort((x, y) => y.score - x.score);

  const novosVinculados = new Set();
  const vinculos = [];
  for (const c of candidatos) {
    if (novosVinculados.has(c.novo)) continue;
    if (!antigosDisponiveis.has(c.antigo.id)) continue;
    vinculos.push({ novo: c.novo, antigo: c.antigo, similaridade: c.score });
    novosVinculados.add(c.novo);
    antigosDisponiveis.delete(c.antigo.id);
  }

  const novosOrfaos = (novos || []).filter(n => !novosVinculados.has(n));
  const antigosOrfaos = [...antigosDisponiveis.values()];
  return { vinculos, novosOrfaos, antigosOrfaos };
}
