import { CATEGORIAS_FLUXO } from './classificacoesFinanceiras';
// Razão financeiro GLOBAL do perfil. Não é foto fiscal anual nem inferência
// de caixa a partir de patrimônio. Valores são inteiros em centavos aqui.
import { anoDaDataCadastro } from '../utils/dataCadastro';

export const acompanhamentoVazio = () => ({ versao: 1, contas: [], operacoes: [], parcelas: [], lancamentos: [], extratos: [], documentos: [], avaliacoes: [], fechamentos: [], eventos: [], revisoes: [] });
export const acompanhamentoDo = state => ({ ...acompanhamentoVazio(), ...state.acompanhamento });
// Estado inicial dos formulários da tela de acompanhamento. Fica no domínio,
// não no componente, porque "transferência própria não liquida parcela nem
// reconhece operação" é regra daqui: a tela abria o formulário já com a
// operação em foco e o lançamento era recusado ao salvar, com o modal preso.
export const ajusteDoTipoDeBaixa = (comando, tipo) => comando === 'lancamento' && tipo === 'transferencia' ? { operacaoId: '', parcelaId: null } : {};
export function formularioInicial(comando, valores = {}, contexto = {}) {
  const base = { pessoa: contexto.pessoa && contexto.pessoa !== 'todos' ? contexto.pessoa : 'titular', disponivel: true, saldoInicial: '0', mes: contexto.mes, tipo: comando === 'operacao' ? 'outro' : 'entrada', sentido: 'entrada', operacaoId: contexto.operacao || '', juros: '0', taxas: '0', imposto: '0', checklist: {}, ...valores };
  return { ...base, ...ajusteDoTipoDeBaixa(comando, base.tipo) };
}
export function centavos(valor) {
  if (valor === '' || valor == null || !Number.isFinite(Number(valor))) throw new Error('Informe um valor numérico.');
  const n = Math.round(Number(valor) * 100);
  if (!Number.isSafeInteger(n) || Math.abs(n) > 1e14) throw new Error('Valor fora do limite suportado.');
  return n;
}
const exigir = (ok, msg) => { if (!ok) throw new Error(msg); };
const dataValida = d => exigir(anoDaDataCadastro(d), 'Informe uma data válida.');
const texto = (s, nome) => { exigir(typeof s === 'string' && s.trim() && s.length <= 4000, `Informe ${nome} (até 4.000 caracteres).`); return s.trim(); };
const buscar = (lista, id, nome) => { const r = lista.find(x => x.id === id); exigir(r, `${nome} não encontrado.`); return r; };
export const valorParcela = p => p.principal + p.juros + p.taxas + p.imposto;
export function resultadoEconomicoOperacoes(a, de, ate, pessoa = 'todos') {
  const vendas = a.operacoes.filter(o => o.tipo === 'venda' && o.dataEconomica >= de && o.dataEconomica <= ate && (pessoa === 'todos' || o.pessoa === pessoa));
  const completas = vendas.filter(o => o.precoContrato != null && o.custoBaixado != null && o.despesasVenda != null);
  return { total: completas.reduce((s, o) => s + o.precoContrato - o.custoBaixado - o.despesasVenda, 0), completas: completas.length, incompletas: vendas.length - completas.length };
}
export const fechamentoAtual = (a, mes) => a.fechamentos.filter(f => f.mes === mes).at(-1);
const aberto = (a, data) => exigir(!a.fechamentos.some(f => f.mes >= data.slice(0, 7) && fechamentoAtual(a, f.mes)?.status === 'fechado'), 'Este lançamento afeta mês fechado. Reabra os fechamentos afetados, com motivo, antes de alterar.');
// Assinatura NÃO criptográfica, somente para avisar que a revisão fiscal ficou
// desatualizada. A integridade recuperável continua sendo o SHA-256 do backup.
export function assinaturaFiscalFechamento(state, ano) {
  const dados = Number(ano) === state.anoCalendario ? state : state.historico?.[ano];
  const campos = ['contribuinte', 'dependentes', 'bens', 'dividas', 'rendimentos', 'pagamentos', 'pagamentosDiversos', 'doacoesEfetuadasOficial', 'doacoesPartidosOficial', 'doacoesEcaIdosoOficial', 'apuracaoGanhoCapital', 'impostoDevido', 'bensRurais', 'dividasRurais', 'lancamentosRurais', 'receitasDespesasRuraisOficial', 'rendaVariavelMensalManual', 'rendaVariavelMensalOficial', 'fiiFiagroMensalManual', 'fiiFiagroMensalOficial'];
  const json = JSON.stringify(campos.map(c => dados?.[c] ?? null));
  let hash = 14695981039346656037n;
  for (let i = 0; i < json.length; i++) hash = BigInt.asUintN(64, (hash ^ BigInt(json.charCodeAt(i))) * 1099511628211n);
  return { ano: Number(ano), disponivel: !!dados, assinatura: hash.toString(16), tamanho: json.length };
}
export function limitesMes(mes) {
  exigir(/^\d{4}-(0[1-9]|1[0-2])$/.test(mes), 'Informe um mês válido.');
  dataValida(`${mes}-01`);
  const [ano, m] = mes.split('-').map(Number);
  const dias = [31, ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return [`${mes}-01`, `${mes}-${dias[m - 1]}`];
}
export function conciliarConta(a, contaId, mes) {
  const conta = buscar(a.contas, contaId, 'Conta');
  const [de, ate] = limitesMes(mes);
  const efeito = l => l.tipo === 'transferencia' ? (l.contaId === contaId ? -l.valor : l.destinoId === contaId ? l.valor : 0) : l.contaId === contaId ? (l.tipo === 'entrada' ? l.valor : -l.valor) : 0;
  const movimentos = a.lancamentos.filter(l => !l.canceladoEm && l.data <= ate && (l.contaId === contaId || l.destinoId === contaId));
  const anterior = movimentos.filter(l => l.data < de).reduce((s, l) => s + efeito(l), 0);
  const periodo = movimentos.filter(l => l.data >= de).map(l => ({ ...l, efeito: efeito(l) }));
  const inicial = conta.dataAbertura <= ate ? conta.saldoInicial + anterior : null;
  const entradas = periodo.reduce((s, l) => s + Math.max(l.efeito, 0), 0);
  const saidas = periodo.reduce((s, l) => s - Math.min(l.efeito, 0), 0);
  const calculado = inicial == null ? null : inicial + entradas - saidas;
  const extrato = a.extratos.find(e => e.contaId === contaId && e.mes === mes);
  return { conta, de, ate, aberturaDuranteMes: conta.dataAbertura > de && conta.dataAbertura <= ate, inicial, entradas, saidas, calculado, extrato, diferenca: extrato && calculado != null ? calculado - extrato.saldo : null, movimentos: periodo };
}
export function caixaPeriodo(a, de, ate, pessoa = 'todos') {
  dataValida(de); dataValida(ate); exigir(de <= ate, 'Período invertido.');
  const contas = a.contas.filter(c => c.disponivel && (pessoa === 'todos' || c.pessoa === pessoa));
  const ids = new Set(contas.map(c => c.id));
  const efeito = l => l.tipo === 'transferencia' ? (ids.has(l.destinoId) ? l.valor : 0) - (ids.has(l.contaId) ? l.valor : 0) : ids.has(l.contaId) ? l.valor * (l.tipo === 'entrada' ? 1 : -1) : 0;
  const movimentos = a.lancamentos.filter(l => !l.canceladoEm && l.data >= de && l.data <= ate).map(l => ({ ...l, efeito: efeito(l) })).filter(l => l.efeito !== 0);
  const saldoAte = corte => contas.filter(c => c.dataAbertura <= corte).reduce((s, c) => s + c.saldoInicial, 0) + a.lancamentos.filter(l => !l.canceladoEm && l.data <= corte).reduce((s, l) => s + efeito(l), 0);
  // Não subtrai um dia via fuso horário: comparação civil estrita.
  const inicial = contas.filter(c => c.dataAbertura < de).reduce((s, c) => s + c.saldoInicial, 0) + a.lancamentos.filter(l => !l.canceladoEm && l.data < de).reduce((s, l) => s + efeito(l), 0);
  const aberturas = contas.filter(c => c.dataAbertura >= de && c.dataAbertura <= ate).reduce((s, c) => s + c.saldoInicial, 0);
  const entradas = movimentos.filter(l => l.tipo === 'entrada').reduce((s, l) => s + l.efeito, 0);
  const saidas = movimentos.filter(l => l.tipo === 'saida').reduce((s, l) => s - l.efeito, 0);
  const transferencias = movimentos.filter(l => l.tipo === 'transferencia').reduce((s, l) => s + l.efeito, 0);
  const pendentes = a.parcelas.filter(p => !p.canceladoEm && !a.lancamentos.some(l => l.parcelaId === p.id && !l.canceladoEm && l.data <= ate));
  const projetos = pendentes.filter(p => p.vencimento >= de && p.vencimento <= ate && (pessoa === 'todos' || a.operacoes.find(o => o.id === p.operacaoId)?.pessoa === pessoa));
  return { contas: contas.length, inicial, aberturas, entradas, saidas, transferencias, final: saldoAte(ate), movimentos, projetado: projetos.reduce((s, p) => s + valorParcela(p) * (p.sentido === 'entrada' ? 1 : -1), 0), parcelas: projetos };
}
export function aplicarAcompanhamento(state, p, { id, agora }) {
  exigir(id && agora, 'A ação precisa de identificação e instante de registro.');
  const a = acompanhamentoDo(state);
  exigir(a.versao === 1, 'Versão financeira incompatível. Atualize o aplicativo.');
  let next = a;
  const guardar = (campo, item) => { exigir(!a[campo].some(x => x.id === item.id), 'Identificador repetido.'); next = { ...a, [campo]: [...a[campo], item] }; };
  switch (p.comando) {
    case 'conta': {
      dataValida(p.dataAbertura); aberto(a, p.dataAbertura);
      guardar('contas', { id, nome: texto(p.nome, 'nome da conta'), pessoa: texto(p.pessoa, 'titular/dependente'), dataAbertura: p.dataAbertura, saldoInicial: centavos(p.saldoInicial), disponivel: !!p.disponivel, criadoEm: agora });
      break;
    }
    case 'editarConta': {
      const original = buscar(a.contas, p.id, 'Conta');
      dataValida(p.dataAbertura); aberto(a, original.dataAbertura); aberto(a, p.dataAbertura);
      const movimentos = a.lancamentos.filter(l => !l.canceladoEm && (l.contaId === p.id || l.destinoId === p.id));
      exigir(movimentos.every(l => l.data >= p.dataAbertura), 'A abertura não pode ficar depois de lançamentos existentes.');
      exigir(!movimentos.length || p.pessoa === original.pessoa, 'Conta com movimentação não pode trocar titularidade. Cancele/reclassifique os lançamentos primeiro.');
      next = { ...a, contas: a.contas.map(c => c.id !== p.id ? c : { ...c, nome: texto(p.nome, 'nome da conta'), pessoa: texto(p.pessoa, 'titular/dependente'), dataAbertura: p.dataAbertura, saldoInicial: centavos(p.saldoInicial), disponivel: !!p.disponivel, atualizadoEm: agora }) }; break;
    }
    case 'editarOperacao': {
      const original = buscar(a.operacoes, p.id, 'Operação');
      dataValida(p.dataEconomica); aberto(a, original.dataEconomica); aberto(a, p.dataEconomica);
      exigir(['venda', 'compra', 'divida', 'rendimento', 'imposto', 'outro'].includes(p.tipo), 'Tipo de operação inválido.');
      exigir(p.pessoa === original.pessoa || (!original.vinculos.length && !a.lancamentos.some(l => l.operacaoId === original.id && !l.canceladoEm)), 'Operação vinculada não pode trocar titularidade. Revise os vínculos e baixas primeiro.');
      exigir(a.parcelas.filter(x => x.operacaoId === original.id && !x.canceladoEm).every(x => x.vencimento >= p.dataEconomica), 'A data econômica não pode ficar depois do cronograma.');
      const componentes = Object.fromEntries(['precoContrato', 'custoBaixado', 'despesasVenda'].map(k => [k, p[k] == null || p[k] === '' ? null : centavos(p[k])]));
      exigir(Object.values(componentes).every(v => v == null || v >= 0), 'Preço, custo e despesas devem ser não negativos.');
      next = { ...a, operacoes: a.operacoes.map(o => o.id !== p.id ? o : { ...o, descricao: texto(p.descricao, 'descrição'), pessoa: texto(p.pessoa, 'titular/dependente'), tipo: p.tipo, dataEconomica: p.dataEconomica, anoFiscal: anoDaDataCadastro(p.dataEconomica), ...componentes, atualizadoEm: agora }) }; break;
    }
    case 'operacao': {
      dataValida(p.dataEconomica); aberto(a, p.dataEconomica);
      exigir(['venda', 'compra', 'divida', 'rendimento', 'imposto', 'outro'].includes(p.tipo), 'Tipo de operação inválido.');
      const anoFiscal = p.anoFiscal == null ? anoDaDataCadastro(p.dataEconomica) : Number(p.anoFiscal);
      exigir(Number.isInteger(anoFiscal) && anoFiscal > 0 && anoFiscal < 10000, 'Ano fiscal inválido.');
      const componentes = Object.fromEntries(['precoContrato', 'custoBaixado', 'despesasVenda'].map(k => [k, p[k] == null || p[k] === '' ? null : centavos(p[k])]));
      exigir(Object.values(componentes).every(v => v == null || v >= 0), 'Preço, custo e despesas devem ser não negativos.');
      guardar('operacoes', { id, descricao: texto(p.descricao, 'descrição da operação'), tipo: p.tipo, pessoa: texto(p.pessoa, 'titular/dependente'), dataEconomica: p.dataEconomica, anoFiscal, ...componentes, criadoEm: agora, vinculos: [] });
      break;
    }
    case 'parcela': {
      const op = buscar(a.operacoes, p.operacaoId, 'Operação');
      dataValida(p.vencimento); aberto(a, p.vencimento);
      exigir(p.vencimento >= op.dataEconomica, 'Vencimento anterior à operação. Registre adiantamentos como operação própria.');
      exigir(['entrada', 'saida'].includes(p.sentido), 'Sentido inválido.');
      const r = { id, operacaoId: op.id, vencimento: p.vencimento, sentido: p.sentido, principal: centavos(p.principal), juros: centavos(p.juros || 0), taxas: centavos(p.taxas || 0), imposto: centavos(p.imposto || 0), criadoEm: agora };
      exigir([r.principal, r.juros, r.taxas, r.imposto].every(n => n >= 0) && valorParcela(r) > 0, 'Componentes devem ser não negativos e a parcela maior que zero.');
      guardar('parcelas', r); break;
    }
    case 'lancamento': {
      dataValida(p.data); aberto(a, p.data);
      const conta = buscar(a.contas, p.contaId, 'Conta');
      exigir(p.data >= conta.dataAbertura, 'Lançamento anterior à abertura da conta.');
      exigir(['entrada', 'saida', 'transferencia'].includes(p.tipo), 'Tipo de lançamento inválido.');
      const valor = centavos(p.valor); exigir(valor > 0, 'Valor deve ser maior que zero.');
      if (p.tipo === 'transferencia') {
        const destino = buscar(a.contas, p.destinoId, 'Conta de destino');
        exigir(destino.id !== conta.id && p.data >= destino.dataAbertura, 'Escolha outra conta aberta na data da transferência.');
        exigir(!p.parcelaId && !p.operacaoId, 'Transferência não liquida parcela nem reconhece operação de renda/despesa.');
      }
      let op = p.operacaoId ? buscar(a.operacoes, p.operacaoId, 'Operação') : null;
      if (p.parcelaId) {
        const parcela = buscar(a.parcelas, p.parcelaId, 'Parcela');
        exigir(!parcela.canceladoEm && !a.lancamentos.some(l => l.parcelaId === parcela.id && !l.canceladoEm), 'Parcela cancelada ou já liquidada.');
        exigir(valor === valorParcela(parcela) && p.tipo === parcela.sentido, 'A baixa deve corresponder ao total e sentido da parcela. Para pagamento parcial, desdobre o cronograma antes da baixa.');
        exigir(!op || op.id === parcela.operacaoId, 'Parcela de outra operação.');
        op = buscar(a.operacoes, parcela.operacaoId, 'Operação');
      }
      if (op) exigir(conta.pessoa === op.pessoa, 'Titularidade da conta difere da operação. Registre a transferência entre pessoas separadamente.');
      exigir(!p.categoriaFluxo || p.tipo === 'transferencia' || CATEGORIAS_FLUXO.some(([c, , sentido]) => c === p.categoriaFluxo && sentido === p.tipo), 'Classificação incompatível com o sentido da baixa.');
      guardar('lancamentos', { categoriaFluxo: p.tipo === 'transferencia' ? '' : (p.categoriaFluxo || ''), id, contaId: conta.id, destinoId: p.tipo === 'transferencia' ? p.destinoId : null, tipo: p.tipo, valor, data: p.data, descricao: texto(p.descricao, 'descrição do lançamento'), contraparte: texto(p.contraparte || (p.tipo === 'transferencia' ? a.contas.find(c => c.id === p.destinoId).pessoa : ''), 'contraparte'), operacaoId: op?.id || null, parcelaId: p.parcelaId || null, criadoEm: agora }); break;
    }
    case 'classificarLancamento': {
      const registro = buscar(a.lancamentos, p.id, 'Lançamento');
      exigir(!registro.canceladoEm && registro.tipo !== 'transferencia', 'Selecione uma entrada ou saída ativa.');
      aberto(a, registro.data);
      exigir(!p.categoriaFluxo || CATEGORIAS_FLUXO.some(([c, , sentido]) => c === p.categoriaFluxo && sentido === registro.tipo), 'Classificação incompatível com o sentido da baixa.');
      next = { ...a, lancamentos: a.lancamentos.map(l => l.id === registro.id ? { ...l, categoriaFluxo: p.categoriaFluxo || '', atualizadoEm: agora } : l) }; break;
    }
    case 'cancelarLancamento':
    case 'cancelarParcela': {
      const campo = p.comando === 'cancelarLancamento' ? 'lancamentos' : 'parcelas';
      const r = buscar(a[campo], p.id, 'Registro');
      exigir(!r.canceladoEm, 'Registro já cancelado.'); aberto(a, r.data || r.vencimento);
      if (campo === 'parcelas') exigir(!a.lancamentos.some(l => l.parcelaId === r.id && !l.canceladoEm), 'Cancele a baixa antes de cancelar a parcela.');
      const motivo = texto(p.motivo, 'motivo do cancelamento');
      next = { ...a, [campo]: a[campo].map(x => x.id === r.id ? { ...x, canceladoEm: agora, motivoCancelamento: motivo } : x) }; break;
    }
    case 'extrato': {
      const [de, ate] = limitesMes(p.mes); aberto(a, de);
      const conta = buscar(a.contas, p.contaId, 'Conta');
      exigir(conta.dataAbertura <= ate, 'Conta ainda não existia neste mês.');
      const item = { id, contaId: p.contaId, mes: p.mes, saldo: centavos(p.saldo), referencia: texto(p.referencia, 'referência do extrato'), registradoEm: agora };
      next = { ...a, extratos: [...a.extratos.filter(e => !(e.contaId === p.contaId && e.mes === p.mes)), item] }; break;
    }
    case 'documento': {
      buscar(a.operacoes, p.operacaoId, 'Operação');
      guardar('documentos', { id, operacaoId: p.operacaoId, descricao: texto(p.descricao, 'descrição do comprovante'), referencia: texto(p.referencia, 'caminho ou referência local'), externo: true, criadoEm: agora }); break;
    }
    case 'avaliacao': {
      dataValida(p.data); const valor = centavos(p.valor); exigir(valor >= 0, 'Valor de mercado não pode ser negativo.');
      guardar('avaliacoes', { id, chaveBem: texto(p.chaveBem, 'referência do bem'), descricao: texto(p.descricao, 'descrição do bem'), pessoa: texto(p.pessoa, 'titular/dependente'), data: p.data, valor, fonte: texto(p.fonte, 'fonte da avaliação'), criadoEm: agora }); break;
    }
    case 'fechar': {
      const [, ate] = limitesMes(p.mes);
      exigir(fechamentoAtual(a, p.mes)?.status !== 'fechado', 'Mês já fechado.');
      const contas = a.contas.filter(c => c.dataAbertura <= ate);
      exigir(contas.length > 0, 'Cadastre contas antes de fechar.');
      const conciliacoes = contas.map(c => conciliarConta(a, c.id, p.mes));
      exigir(conciliacoes.every(c => c.diferenca === 0), 'Todas as contas precisam de extrato e diferença zero.');
      exigir(p.checklist && ['contas', 'bens', 'dividas', 'rendimentos', 'impostos', 'titularidade', 'documentos'].every(k => p.checklist[k] === true), 'Conclua todos os itens do checklist.');
      guardar('fechamentos', { id, mes: p.mes, status: 'fechado', versao: a.fechamentos.filter(f => f.mes === p.mes && f.status === 'fechado').length + 1, responsavel: texto(p.responsavel, 'responsável'), observacoes: texto(p.observacoes, 'parecer sobre pendências'), criadoEm: agora, checklist: { ...p.checklist }, snapshot: JSON.parse(JSON.stringify({ contas: a.contas, operacoes: a.operacoes, parcelas: a.parcelas, lancamentos: a.lancamentos, extratos: a.extratos, documentos: a.documentos, conciliacoes, fiscal: assinaturaFiscalFechamento(state, p.mes.slice(0, 4)) })) }); break;
    }
    case 'reabrir': {
      const f = fechamentoAtual(a, p.mes); exigir(f?.status === 'fechado', 'Mês não está fechado.');
      guardar('fechamentos', { id, mes: p.mes, status: 'reaberto', versao: f.versao, fechamentoId: f.id, responsavel: texto(p.responsavel, 'responsável'), motivo: texto(p.motivo, 'motivo da reabertura'), criadoEm: agora }); break;
    }
    case 'revisao':
      guardar('revisoes', { id, origem: texto(p.origem, 'origem da pendência'), decisao: texto(p.decisao, 'decisão de revisão'), responsavel: texto(p.responsavel, 'responsável'), criadoEm: agora }); break;
    default: throw new Error('Comando financeiro desconhecido.');
  }
  const campoEditado = p.comando === 'editarConta' ? 'contas' : p.comando === 'editarOperacao' ? 'operacoes' : null;
  return { ...state, acompanhamento: { ...next, eventos: [...a.eventos, { id, comando: p.comando, registradoEm: agora, dados: { ...p }, ...(campoEditado ? { anterior: a[campoEditado].find(r => r.id === p.id) } : {}) }] } };
}
