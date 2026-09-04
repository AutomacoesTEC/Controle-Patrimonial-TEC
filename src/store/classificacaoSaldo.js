import { arredondarCentavos } from '../utils/formatters';
import { dadosDoAno } from './consultaPeriodo';

const dinheiro = (valor) => arredondarCentavos(parseFloat(valor) || 0);

const noPeriodo = (data, de, ate) => {
  if (!de && !ate) return true;
  if (!data) return false;
  return (!de || data >= de) && (!ate || data <= ate);
};

// O código chega da digitação como isento_25 e do arquivo eletrônico como
// isento_0025. O número, e não a quantidade de zeros, identifica a ficha.
const ehRestituicaoIrpf = (tipo) => {
  const encontrado = /^isento_(\d+)$/.exec(String(tipo || ''));
  return encontrado && Number(encontrado[1]) === 25;
};

function restituiçõesAnterioresSemLançamento(state, dataDe, dataAte) {
  if (!dataDe || !dataAte || dataDe > dataAte) return [];
  const primeiroAno = Number(dataDe.slice(0, 4));
  const ultimoAno = Number(dataAte.slice(0, 4));
  const itens = [];

  for (let ano = primeiroAno; ano <= ultimoAno; ano += 1) {
    const anterior = dadosDoAno(state, ano - 1);
    const atual = dadosDoAno(state, ano);
    const previsto = dinheiro(anterior?.impostoDevido?.impostoRestituir);
    if (!atual || previsto <= 0) continue;

    const inicio = dataDe > `${ano}-01-01` ? dataDe : `${ano}-01-01`;
    const fim = dataAte < `${ano}-12-31` ? dataAte : `${ano}-12-31`;
    const lançado = dinheiro((atual.rendimentos || [])
      .filter(r => ehRestituicaoIrpf(r.tipo) && noPeriodo(r.data, inicio, fim))
      .reduce((total, r) => total + dinheiro(r.valor), 0));
    const diferença = dinheiro(Math.max(0, previsto - lançado));

    if (diferença > 0) {
      itens.push({
        tipo: 'restituicao_a_conferir',
        titulo: `Restituição de IRPF de ${ano - 1} a conferir`,
        texto: `A declaração anterior apurou restituição, mas o código 25 cobre ${lançado === 0 ? 'R$ 0,00' : 'apenas parte'} no período. Confirme se o valor foi recebido e, se foi, lance a diferença em Rendimentos.`,
        valor: diferença,
        destino: 'rendimentos',
      });
    }
  }
  return itens;
}

// Gera perguntas de conferência; não muda o demonstrativo nem presume que a
// diferença seja erro. Alienações e aplicações reaproveitam os diagnósticos
// do motor, em vez de recalcular a mesma regra em outra camada.
export function classificarPendenciasSaldo(state, demonstrativo, dataDe, dataAte) {
  if (!demonstrativo) return [];
  const itens = [];
  const aumentoBens = Math.max(0, dinheiro(demonstrativo.varPatrimonial?.deltaBens));
  const aumentoDividas = Math.max(0, dinheiro(demonstrativo.varPatrimonial?.deltaDivida));
  const dívidaSemContrapartida = dinheiro(Math.max(0, aumentoDividas - aumentoBens));

  if (dívidaSemContrapartida > 0) {
    itens.push({
      tipo: 'divida_sem_contrapartida',
      titulo: 'Dívida nova sem contrapartida em bens',
      texto: 'O aumento líquido das dívidas supera o aumento dos bens. Confira onde entrou ou foi usado o recurso do empréstimo.',
      valor: dívidaSemContrapartida,
      destino: 'dividas',
    });
  }

  itens.push(...restituiçõesAnterioresSemLançamento(state, dataDe, dataAte));

  const alienações = (demonstrativo.pendenciasAlienacao || [])
    .filter(item => !item.vendaForaDoPeriodo);
  const reduçãoSemPreço = dinheiro(alienações.reduce(
    (total, item) => total + dinheiro(item.reducao), 0,
  ));
  if (reduçãoSemPreço > 0) {
    itens.push({
      tipo: 'alienacao_sem_preco',
      titulo: `${alienações.length} bem(ns) baixaram sem valor de venda`,
      texto: 'O caixa considera que todo o custo voltou como dinheiro. Informe o valor de venda em Bens e Direitos para conferir a diferença real.',
      valor: reduçãoSemPreço,
      destino: 'bens',
      detalhes: alienações,
    });
  }

  const aplicações = demonstrativo.aplicacoesSemRendimento || [];
  const resgatesSemRendimento = dinheiro(aplicações.reduce(
    (total, item) => total + dinheiro(item.valorResgatado), 0,
  ));
  if (resgatesSemRendimento > 0) {
    itens.push({
      tipo: 'aplicacao_sem_rendimento',
      titulo: `${aplicações.length} aplicação(ões) resgatadas sem rendimento`,
      texto: 'Confira o informe da instituição e lance o rendimento do resgate na ficha correspondente.',
      valor: resgatesSemRendimento,
      destino: 'rendimentos',
      detalhes: aplicações,
    });
  }

  return itens;
}
