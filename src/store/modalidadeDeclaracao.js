// Modalidade da declaração importada e os quadros que só existem nela.
//
// Por que isto importa, e não é acabamento: a declaração final de espólio e a
// de saída definitiva NÃO são uma declaração de ajuste anual com campos a
// mais. Elas encerram uma situação. No espólio, os bens deixam o patrimônio do
// falecido e vão para os herdeiros pela partilha; na saída, a pessoa deixa de
// ser residente numa data certa, e a partir dali a tributação é outra. Exibir
// as duas como ajuste anual comum é erro de classificação fiscal.
//
// Lógica pura (sem React), pelo mesmo motivo de resumoDeclaracao.js: testável
// contra o retorno real do parser.
//
// Rótulos conferidos na impressão oficial: ESP-01 p1 r19 a r32 e p2 r5/r6,
// SAI-01 p1 r21 a r25 (AUDITORIA/rows-pdfjs/).

export const MODALIDADES = Object.freeze({
  AJUSTE: 'ajuste',
  ESPOLIO: 'espolio',
  SAIDA: 'saida',
});

// A modalidade é afirmada por DOIS caminhos independentes: o "Tipo de
// declaração" impresso na identificação e a existência do quadro próprio. Um
// só não basta: o tipo pode vir vazio numa declaração antiga, e o quadro pode
// vir vazio numa declaração recém-aberta. Quando os dois discordam, o QUADRO
// vence, porque ele só existe se a ficha foi impressa.
export function modalidadeDaDeclaracao(dados = {}) {
  const tipo = String(dados?.contribuinte?.tipoDeclaracao || '');
  if (dados?.espolioOficial) return MODALIDADES.ESPOLIO;
  if (dados?.saidaDefinitivaOficial) return MODALIDADES.SAIDA;
  if (/espólio|espolio/i.test(tipo)) return MODALIDADES.ESPOLIO;
  if (/saída definitiva|saida definitiva/i.test(tipo)) return MODALIDADES.SAIDA;
  return MODALIDADES.AJUSTE;
}

export const NOME_MODALIDADE = Object.freeze({
  [MODALIDADES.AJUSTE]: 'Declaração de Ajuste Anual',
  [MODALIDADES.ESPOLIO]: 'Declaração Final de Espólio',
  [MODALIDADES.SAIDA]: 'Declaração de Saída Definitiva',
});

// Rótulo curto, para a navegação lateral, onde o nome inteiro não cabe.
export const NOME_CURTO_MODALIDADE = Object.freeze({
  [MODALIDADES.AJUSTE]: 'Ajuste Anual',
  [MODALIDADES.ESPOLIO]: 'Final de Espólio',
  [MODALIDADES.SAIDA]: 'Saída Definitiva',
});

// O que muda na leitura dos números, dito na tela para quem confere. Não é
// texto decorativo: é a diferença entre ler o patrimônio final como "o que a
// pessoa tem" e como "o que foi transferido aos herdeiros".
export const ALERTA_MODALIDADE = Object.freeze({
  [MODALIDADES.ESPOLIO]: 'Esta é a declaração que encerra o espólio. Os bens listados são transferidos aos herdeiros pela partilha, então a situação em 31/12 não representa patrimônio que continua com o titular.',
  [MODALIDADES.SAIDA]: 'Esta é a declaração de saída definitiva do país. A partir da data da caracterização da condição de não residente, a tributação deixa de seguir as regras do residente no Brasil.',
});

const texto = (rotulo, valor) => (valor ? { rotulo, valor, formato: 'texto' } : null);

const montar = (id, titulo, linhas) => {
  const presentes = linhas.filter(Boolean);
  return presentes.length > 0 ? { id, titulo, linhas: presentes } : null;
};

export function blocosEspolio(espolio) {
  if (!espolio) return [];
  const situacao = montar('situacao', 'Situação do espólio', [
    texto('Modalidade', espolio.modalidade),
    texto('Ano do óbito', espolio.anoObito),
    texto('Ainda há bens a inventariar', espolio.aindaHaBensAInventariar),
  ]);
  const decisao = montar('decisao', 'Decisão judicial da partilha', [
    texto('Número do processo judicial', espolio.numeroProcessoJudicial),
    texto('Identificação da vara cível', espolio.varaCivel),
    texto('Comarca', espolio.comarca),
    texto('UF', espolio.uf),
    texto('Data da decisão judicial da partilha', espolio.dataDecisaoPartilha),
    texto('Data do trânsito em julgado', espolio.dataTransitoJulgado),
  ]);
  const inventariante = montar('inventariante', 'Inventariante da partilha', [
    texto('CPF', espolio.inventarianteCpf),
    texto('Nome', espolio.inventarianteNome),
  ]);
  const conjuge = montar('conjuge', 'Cônjuge ou companheiro', [
    texto('Óbito de ambos os cônjuges ou companheiros', espolio.obitoAmbosConjuges),
    texto('O cônjuge ou companheiro é meeiro', espolio.conjugeMeeiro),
    texto('Inventário conjunto', espolio.inventarioConjunto),
  ]);
  return [situacao, decisao, inventariante, conjuge].filter(Boolean);
}

export function blocosSaida(saida) {
  if (!saida) return [];
  const condicao = montar('condicao', 'Condição de residência', [
    texto('Data da caracterização da condição de não residente', saida.dataNaoResidente),
    // Só aparece quando a declaração informa. Ausente é ausente: afirmar
    // retorno à condição de residente sem o dado seria inventar.
    texto('Data da caracterização da condição de residente no país', saida.dataResidente),
    texto('País de destino', saida.paisDestino),
  ]);
  const procurador = montar('procurador', 'Procurador no Brasil', [
    texto('CPF', saida.procuradorCpf),
    texto('Nome', saida.procuradorNome),
    texto('Endereço', saida.procuradorEndereco),
  ]);
  return [condicao, procurador].filter(Boolean);
}

// Bens que a declaração marca como transferidos na partilha. O rateio por
// herdeiro vem no próprio bem (bens[].herdeiros), e a lista de herdeiros do
// espólio inteiro vem no quadro (espolioOficial.herdeiros): são coisas
// diferentes e a tela mostra as duas.
export function bensDaPartilha(bens = []) {
  return (bens || []).filter(b => b?.ehPartilha);
}

// Conferência do rateio: os percentuais dos herdeiros de um bem partilhado têm
// que somar 100. Divergência vira aviso, não correção automática, porque quem
// decide é a declaração.
export function conferenciasPartilha(bens = []) {
  const avisos = [];
  for (const bem of bensDaPartilha(bens)) {
    const herdeiros = bem.herdeiros || [];
    if (herdeiros.length === 0) continue;
    const soma = herdeiros.reduce((s, h) => s + (Number(h.percentual) || 0), 0);
    if (Math.abs(soma - 100) > 0.01) {
      const nome = bem.discriminacao || `bem ${bem.numeroItem ?? ''}`.trim();
      avisos.push(`Os percentuais dos herdeiros somam ${soma.toFixed(2)}% em "${nome}", e não 100%.`);
    }
  }
  return avisos;
}
