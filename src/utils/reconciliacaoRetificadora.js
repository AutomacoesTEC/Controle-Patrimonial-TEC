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

// Chave de pessoa de um bem/dívida para efeito de conciliação (item P06 da
// auditoria funcional 2026-09-09). Código + descrição iguais NÃO bastam para
// vincular quando as duas pontas apontam para pessoas DEFINIDAS e diferentes:
// seria transferir o histórico de movimentações de uma pessoa para o registro
// de outra. Aqui "definida" é titular, um CPF, um dependente identificado, ou
// o próprio rótulo "Dependente"/"Alimentando" — só a ausência total de
// identificação (`''`) fica ambígua e não bloqueia nada.
export function chavePessoaRegistro(item = {}) {
  const cpf = String(
    item.cpf_titularidade || item.cpf_beneficiario || item.cpf_dependente || item.cpfDependente || '',
  ).replace(/\D/g, '');
  if (cpf) return `cpf:${cpf}`;
  if (item.dependenteId != null) return `dep:${item.dependenteId}`;
  const tipo = normalizar(item.titularidade || item.beneficiario);
  if (tipo === 'TITULAR' || tipo === 'T') return 'titular';
  if (tipo === 'DEPENDENTE' || tipo === 'D' || tipo === 'ALIMENTANDO') return 'dependente';
  return '';
}

// true quando os dois registros têm pessoa definida e ela é diferente.
export function pessoasDefinidasEConflitantes(a, b) {
  const ka = chavePessoaRegistro(a);
  const kb = chavePessoaRegistro(b);
  return ka !== '' && kb !== '' && ka !== kb;
}

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
      // P06: não sugerir vínculo entre pessoas definidas e diferentes. Se for
      // mesmo o mesmo item, a usuária vincula à mão — agora vendo a
      // titularidade na lista do modal.
      if (pessoasDefinidasEConflitantes(antigo, novo)) continue;
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
