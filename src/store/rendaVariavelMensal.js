// Mescla as linhas mensais de Renda Variável OFICIAIS (da declaração
// importada, só leitura) com as MANUAIS (item E do HANDOFF-2026-09-03.md,
// calculadas por calculoRendaVariavelMes.js). Critério aprovado no handoff:
// mesmo (ano implícito no snapshot, mês, beneficiário, ficha) → o manual
// PREVALECE, por ser o dado mais recente/corrigido pela usuária.
//
// Módulo central: todo consumidor de rendaVariavelMensalOficial/
// fiiFiagroMensalOficial (RendaVariavelPage.jsx, saldosCompensaveis.js,
// demonstrativos.js) passa a ler daqui em vez do campo Oficial cru, senão
// um lançamento manual nunca apareceria fora da tela de Renda Variável.

const chaveBeneficiario = (l) => l.titular ? 'titular' : `dep:${l.cpfDependente || ''}`;
const chaveLinha = (l) => `${l.mes}|${chaveBeneficiario(l)}`;

// Ordena por mês e, dentro do mês, titular antes dos dependentes (mesmo
// critério de sort que o import já usa em importParsers.js:
// `(b.titular - a.titular) || (a.mes - b.mes)`, só que aqui o mês manda
// primeiro — é o que a tabela mensal precisa para não desenhar os meses
// fora de ordem).
function ordenar(lista) {
  return [...lista].sort((a, b) => (a.mes - b.mes) || ((b.titular ? 1 : 0) - (a.titular ? 1 : 0)) || String(a.cpfDependente || '').localeCompare(String(b.cpfDependente || '')));
}

export function mesclarMensal(oficial, manual) {
  const porChave = new Map();
  for (const linha of (oficial || [])) porChave.set(chaveLinha(linha), linha);
  // Roda por cima: colisão de chave, o manual sobrescreve o oficial.
  for (const linha of (manual || [])) porChave.set(chaveLinha(linha), linha);
  return ordenar([...porChave.values()]);
}

// Aplica a mesclagem sobre um snapshot de ano (state vivo ou
// state.historico[ano] — mesmo objeto que dadosDoAno() devolve).
export function linhasComunsDoAno(dados) {
  return mesclarMensal(dados?.rendaVariavelMensalOficial, dados?.rendaVariavelMensalManual);
}
export function linhasFiiDoAno(dados) {
  return mesclarMensal(dados?.fiiFiagroMensalOficial, dados?.fiiFiagroMensalManual);
}

// Projeção financeira somente: não altera as fichas nem compensa prejuízo
// tributário de FII com operações comuns. Cada modalidade conserva sua origem.
export function linhasFinanceirasDoAno(dados) {
  return [...linhasComunsDoAno(dados), ...linhasFiiDoAno(dados).map(l => ({
    ...l, modalidadeFinanceira: 'fii',
    comuns: { resultadoLiquidoMes: l.resultadoLiquidoMes || 0 },
    consolidacao: { totalImpostoDevido: l.impostoDevido || 0 },
  }))];
}
