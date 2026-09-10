import { pessoaDoRegistro } from '../store/titularidade';
import { GRUPOS_BENS, CODIGOS_POR_GRUPO, CODIGOS_PAGAMENTO, CODIGOS_DIVIDA, CODIGOS_DEPENDENCIA, RENDIMENTO_TIPOS_CONHECIDOS } from './formatters';

const campo = (chave, rotulo, tipo = 'texto') => ({ chave, rotulo, tipo });
const titularidade = campo('beneficiario', 'Titularidade', 'pessoa');
const descricao = campo('discriminacao', 'Discriminação');
const saldos = [campo('situacao_anterior', 'Saldo anterior', 'numero'), campo('situacao_atual', 'Saldo atual', 'numero')];
export const FICHAS_CLASSIFICACAO = {
  bens: { rotulo: 'Bens e direitos', campos: [titularidade, campo('grupo', 'Grupo', 'codigo'), campo('codigo_bem', 'Código do bem', 'codigo'), descricao, campo('cnpj', 'CNPJ do bem'), campo('renavam', 'RENAVAM'), ...saldos] },
  rendimentos: { rotulo: 'Rendimentos', campos: [titularidade, campo('tipo', 'Tipo de rendimento', 'tipo'), campo('nome_fonte', 'Nome da fonte pagadora'), campo('cnpj_fonte', 'CPF/CNPJ da fonte pagadora'), campo('data', 'Data', 'data'), campo('valor', 'Valor', 'numero'), campo('irrf', 'IRRF', 'numero')] },
  pagamentos: { rotulo: 'Pagamentos', campos: [titularidade, campo('codigo', 'Código do pagamento', 'codigo'), campo('nome_beneficiario', 'Nome do beneficiário do pagamento'), campo('cpf_cnpj', 'CPF/CNPJ do recebedor'), campo('valor_pago', 'Valor pago', 'numero'), campo('parcela_nao_dedutivel', 'Valor não dedutível', 'numero')] },
  dividas: { rotulo: 'Dívidas e ônus', campos: [titularidade, campo('codigo', 'Código da dívida', 'codigo'), descricao, ...saldos] },
  dependentes: { rotulo: 'Dependentes', campos: [campo('nome', 'Nome'), campo('cpf', 'CPF'), campo('parentesco', 'Código de dependência', 'codigo'), campo('dataNascimento', 'Data de nascimento', 'data'), campo('nitPisPasep', 'NIT/PIS/PASEP'), campo('saidaComDeclarante', 'Saída com declarante', 'booleano')] },
  imoveisRurais: { rotulo: 'Imóveis rurais', campos: [campo('nomeLocalizacao', 'Nome e localização'), campo('codigoAtividade', 'Código da atividade', 'codigo'), campo('cib', 'CIB'), campo('dataAquisicao', 'Data de aquisição', 'data'), campo('area', 'Área', 'numero'), campo('participacao', 'Participação (%)', 'numero')] },
  bensRurais: { rotulo: 'Bens rurais', campos: [campo('codigo', 'Código', 'codigo'), descricao, ...saldos] },
  dividasRurais: { rotulo: 'Dívidas rurais', campos: [descricao, ...saldos] },
};
export function camposClassificaveis(colecao, item) {
  const def = FICHAS_CLASSIFICACAO[colecao];
  if (!def) return [];
  // RENAVAM só se aplica a veículos; documento próprio do bem é opcional.
  return def.campos.filter(c => c.chave !== 'renavam' || (item.grupo === '02' && item.codigo_bem === '01') || !!item.renavam);
}
export function opcoesClassificacao(colecao, campo, item) {
  if (colecao === 'bens' && campo === 'grupo') return GRUPOS_BENS;
  if (colecao === 'bens' && campo === 'codigo_bem') return CODIGOS_POR_GRUPO[item.grupo] || [];
  if (colecao === 'pagamentos' && campo === 'codigo') return CODIGOS_PAGAMENTO;
  if (colecao === 'dividas' && campo === 'codigo') return CODIGOS_DIVIDA;
  if (colecao === 'dependentes' && campo === 'parentesco') return CODIGOS_DEPENDENCIA;
  if (campo === 'tipo') return Object.entries(RENDIMENTO_TIPOS_CONHECIDOS).map(([codigo, nome]) => ({codigo, nome}));
  return [];
}
export function valorDoCampo(item, campo) {
  if (campo !== 'beneficiario') return item[campo];
  const pessoa = pessoaDoRegistro(item);
  return pessoa === 'titular' ? 'Titular' : pessoa === 'nao-informada' ? '' : pessoa === 'alimentando' ? 'Alimentando' : 'Dependente';
}
export const valorAusente = v => v == null || v === '';
export function assinaturaFonte(state) { return state.documentoFonte?.sha256ArquivoOriginal || state.documentoFonte?.sha256TextoExtraido || ''; }
export function classificacaoVigente(state, item, campo) {
  const m = item.classificacaoManual?.[campo];
  return m && m.fonte === assinaturaFonte(state) && JSON.stringify(m.valor) === JSON.stringify(valorDoCampo(item, campo)) && (!m.vinculo || Object.entries(m.vinculo).every(([k, v]) => JSON.stringify(item[k]) === JSON.stringify(v))) ? m : null;
}
export function registrosClassificaveis(state) {
  return Object.entries(FICHAS_CLASSIFICACAO).flatMap(([colecao, def]) => (state[colecao] || [])
    .filter(item => item.origem !== 'manual' && item.id != null)
    .map(item => {
      const campos = camposClassificaveis(colecao, item);
      return { colecao, ficha: def.rotulo, item, campos,
        pendentes: campos.filter(c => !classificacaoVigente(state, item, c.chave) && (valorAusente(valorDoCampo(item, c.chave)) || c.tipo === 'pessoa' || c.tipo === 'codigo' || c.tipo === 'tipo')).length,
        nome: item.discriminacao || item.nome_fonte || item.nome_beneficiario || item.nome || item.nomeLocalizacao || 'Registro sem descrição' };
    }));
}

// A entrada é validada no reducer, inclusive quando a ação não veio da interface.
export function aplicarClassificacao(state, p) {
  if (Number(p.anoCalendario) !== Number(state.anoCalendario) || p.fonte !== assinaturaFonte(state)) throw new Error('A declaração mudou. Reabra a revisão antes de salvar.');
  const lista = FICHAS_CLASSIFICACAO[p.colecao] && state[p.colecao];
  const item = lista?.find(i => i.id === p.id);
  const def = item && camposClassificaveis(p.colecao, item).find(c => c.chave === p.campo);
  if (!def || item.origem === 'manual') throw new Error('Campo importado não disponível para classificação.');
  if (!['informado', 'nao_informado', 'sem_codigo'].includes(p.estado)) throw new Error('Escolha como classificar o campo.');
  if (p.estado === 'sem_codigo' && def.tipo !== 'codigo') throw new Error('Sem código só se aplica a campos de código.');
  let valor = p.valor;
  let complemento = {};
  if (p.estado !== 'informado') valor = ['numero', 'booleano'].includes(def.tipo) ? null : '';
  else if (def.tipo === 'numero') {
    if (valorAusente(valor) || !Number.isFinite(Number(valor))) throw new Error('Informe um número válido.');
    valor = Number(valor);
  } else if (def.tipo === 'booleano') {
    if (![true, false, 'true', 'false'].includes(valor)) throw new Error('Selecione Sim ou Não.');
    valor = valor === true || valor === 'true';
  } else {
    valor = String(valor ?? '').trim();
    if (!valor) throw new Error('Preencha o campo ou selecione Não informado.');
    if (def.tipo === 'data' && (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || !Number.isFinite(Date.parse(valor)) || new Date(valor).toISOString().slice(0, 10) !== valor)) throw new Error('Informe uma data válida.');
    if (def.tipo === 'tipo' && !RENDIMENTO_TIPOS_CONHECIDOS[valor]) throw new Error('Selecione um tipo de rendimento válido.');
    if (def.tipo === 'codigo' && !/^\d{1,4}$/.test(valor)) throw new Error('Use um código numérico de até quatro dígitos.');
    if (def.tipo === 'codigo' && valor.length === 1) valor = valor.padStart(2, '0');
  }
  if (p.estado === 'informado' && ['cpf', 'cnpj', 'cnpj_fonte', 'cpf_cnpj'].includes(p.campo)) {
    valor = String(valor).replace(/[.\/\s-]/g, '');
    const tamanhos = p.campo === 'cpf' ? [11] : p.campo === 'cnpj' ? [14] : [11, 14];
    if (!/^\d+$/.test(valor) || !tamanhos.includes(valor.length)) throw new Error('Informe o documento completo ou selecione Não informado.');
  }
  if (def.tipo === 'pessoa') {
    complemento = { titularidade: '', cpf_titularidade: '', cpf_beneficiario: '', cpf_dependente: '', cpfDependente: '', dependenteId: null, titularidadeNome: '', nome_dependente: '' };
    if (p.estado === 'informado') {
      if (!['Titular', 'Dependente'].includes(valor)) throw new Error('Selecione Titular ou Dependente.');
      complemento.titularidade = valor.toLowerCase();
      if (valor === 'Dependente') {
        const d = (state.dependentes || []).find(d => String(d.id) === String(p.dependenteId));
        if (!d) throw new Error('Selecione um dependente cadastrado.');
        const cpf = String(d.cpf || '').replace(/\D/g, '');
        Object.assign(complemento, { dependenteId: d.id, cpf_titularidade: cpf, cpf_beneficiario: cpf, cpf_dependente: cpf, titularidadeNome: d.nome, nome_dependente: d.nome });
      }
    }
  }
  if (/^situacao_/.test(p.campo) && item.movimentacoes?.length) throw new Error('Este saldo tem movimentações. Corrija-o na ficha do bem ou dívida para preservar os cálculos.');
  if (p.campo === 'grupo' && valor !== item.grupo && item.codigo_bem) throw new Error('Classifique primeiro o código do bem como Sem código antes de trocar o grupo.');
  const opcoes = opcoesClassificacao(p.colecao, p.campo, item);
  if (p.estado === 'informado' && opcoes.length && def.tipo === 'codigo' && !opcoes.some(o => o.codigo === valor)) throw new Error('Selecione um código compatível com esta ficha e grupo.');
  // A marca de RRA agregado pertence ao tipo importado, como na ficha de Rendimentos.
  if (p.colecao === 'rendimentos' && p.campo === 'tipo' && valor !== item.tipo && item.naoSomar) complemento.naoSomar = false;
  const atualizado = { ...item, ...complemento, [p.campo]: valor,
    valorDeclarado: item.valorDeclarado || { ...item },
    classificacaoManual: { ...item.classificacaoManual, [p.campo]: { estado: p.estado, valor, fonte: p.fonte, origem: 'usuario', ...(def.tipo === 'pessoa' ? {vinculo: complemento} : {}), atualizadoEm: p.atualizadoEm } } };
  return { ...state, [p.colecao]: lista.map(i => i.id === p.id ? atualizado : i) };
}
