// Corta um texto para caber numa célula de tabela, mas sem esconder que foi
// cortado: acrescenta reticências, para quem usar o valor com `title={texto}`
// no elemento que envolve o resultado, para o texto completo aparecer ao
// passar o mouse. Achado na auditoria de interface de 01/09/2026: várias
// telas cortavam discriminação/descrição/nome com `.substring(0, N)` puro,
// sem reticências nem `title`, e o usuário via a frase interrompida no meio
// sem nenhum indício de que faltava texto nem como ver o valor completo.
export function truncarComReticencias(texto, max) {
  const s = String(texto || '');
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

// Nome curto e legível de um bem, para rótulos onde a discriminação inteira
// não cabe e ATRAPALHA. A discriminação dos veículos importados começa sempre
// com "AQUISIÇÃO DE UM VEÍCULO ..." e muitas vezes já traz o preço de compra
// logo em seguida ("... POR R$ 353.690,00 ..."). Jogada crua num rótulo como
// "PERDA APURADA NA VENDA DE ..." a frase fica sem pé nem cabeça e o usuário lê
// o valor de COMPRA como se fosse o da venda (achado de 03/09/2026: a usuária
// apontou "se ele comprou 2 veículos, por que os valores estão negativos?").
// Tira o trecho de aquisição e devolve marca/modelo/placa. Fora do padrão de
// veículo, corta no primeiro separador de detalhe. SEMPRE combinar com
// title={discriminacaoCompleta} no elemento, para o texto integral aparecer ao
// passar o mouse.
export function nomeCurtoBem(discriminacao) {
  const bruto = String(discriminacao || '').trim();
  if (!bruto) return '';
  const semAquisicao = bruto.replace(
    /^\s*(?:\d+\s*%\s*[-–]\s*)?AQUISI[ÇC][ÃA]O\b[\s\S]*?\bDE\s+UM\s+(?:VE[IÍ]CULO|IM[OÓ]VEL|BEM)\s+/i,
    ''
  );
  const base = semAquisicao || bruto;
  // Corta no primeiro separador que introduz detalhe (vírgula) ou no termo que
  // não faz parte da identificação do bem (preço, verbo de venda, data).
  const corte = base.split(/\s*,|\s+(?:POR|PELO|VENDID[OA]|EM)\s+/i)[0].trim();
  return truncarComReticencias(corte || base, 48);
}

// Normalizador de busca (sem acento, sem caixa), usado pelos comboboxes de
// filtro (SeletorCodigo, SeletorBem). Extraído aqui para as duas casas usarem
// a mesma regra, sem duplicar.
export function normalizarBusca(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Opções do seletor de bens da aba Ganhos de Capital (item F, SeletorBem):
// rótulo principal = nomeCurtoBem (marca/modelo/placa, sem o preço de
// compra); linha secundária = grupo/código do bem + discriminação completa
// truncada, para desambiguar dois bens com nome curto parecido (ex.: dois
// veículos "Q3-AUDI"). Sufixo "(baixado)" quando o bem já foi vendido por
// inteiro ou baixado (situacao_atual zerada por venda_total/baixa) — a
// pessoa pode precisar corrigir a venda, então continua na lista.
export function opcoesSeletorBem(bens = []) {
  return (bens || []).map(b => {
    const baixado = Number(b.situacao_atual) === 0 &&
      (b.movimentacoes || []).some(m => m.tipo === 'venda_total' || m.tipo === 'baixa');
    return {
      id: b.id,
      rotulo: `${nomeCurtoBem(b.discriminacao)}${baixado ? ' (baixado)' : ''}`,
      detalhe: `${b.grupo || ''}/${b.codigo_bem || ''} - ${truncarComReticencias(b.discriminacao || '', 90)}`,
      baixado,
    };
  });
}

// Filtra as opções do SeletorBem por trecho do nome curto, da discriminação
// completa (ambas embutidas no rótulo/detalhe) ou do código, sem acento nem
// caixa. Função pura para poder testar o filtro sem montar o componente (o
// projeto não usa testing-library/jsdom).
export function filtrarOpcoesBem(opcoes, termo) {
  const t = normalizarBusca(termo).trim();
  if (!t) return opcoes;
  return opcoes.filter(o => normalizarBusca(o.rotulo).includes(t) || normalizarBusca(o.detalhe).includes(t));
}

// Depois de salvar um bem NOVO a partir da aba Ganhos de Capital (item F):
// se o ano de gravação é o mesmo ano ativo, o bem entrou em state.bens e dá
// pra reabrir o BemModal já em edição, para a pessoa lançar a venda na
// sequência sem procurar o bem. Se caiu num ano diferente (ADD_EM_ANO fora
// do ano ativo — item G), o bem não está em state.bens: não reabre, e a
// tela avisa onde ele foi gravado, no mesmo tom da confirmação de G
// (DataContext.jsx:garantirAnoCadastro, "Será gravado em X; a tela continua
// mostrando Y").
export function decidirReaberturaAposNovoBem(anoAlvo, anoAtivo, bemCriado) {
  if (anoAlvo === anoAtivo) {
    return { reabrirEdicao: true, bemParaEditar: bemCriado, mensagemToast: null };
  }
  return {
    reabrirEdicao: false,
    bemParaEditar: null,
    mensagemToast: `O bem foi gravado no ano ${anoAlvo}; a tela continua mostrando ${anoAtivo}.`,
  };
}

export function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  // Normaliza o zero negativo antes de formatar. O Intl formata -0 como
  // "-R$ 0,00", e o Dashboard exibia exatamente isso na Variação Patrimonial
  // Total de um período sem variação, porque aquela linha inverte o sinal
  // para exibição (formatCurrency(-total), ver ATUALIZAÇÃO 18). Corrigir
  // aqui resolve de uma vez em qualquer lugar que inverta sinal. Achado na
  // auditoria de 21/08/2026.
  const n = Object.is(value, -0) || value === 0 ? 0 : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

// O estado continua usando Number por compatibilidade, mas dinheiro não pode
// carregar para a próxima operação o resíduo binário de uma soma. Esta é a
// fronteira única para valores monetários calculados: converte o resultado
// novamente à unidade mínima que o app aceita (centavo) e normaliza -0.
export function arredondarCentavos(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const margem = Number.EPSILON * Math.max(1, Math.abs(n));
  const arredondado = Math.round((n + Math.sign(n) * margem) * 100) / 100;
  return Object.is(arredondado, -0) ? 0 : arredondado;
}

export function formatCPF(cpf) {
  if (!cpf) return '';
  const nums = cpf.replace(/\D/g, '');
  return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const nums = cnpj.replace(/\D/g, '');
  return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

// Campo que pode guardar CPF (11 dígitos) ou CNPJ (14), conforme o
// beneficiário: detecta pela quantidade de dígitos. Fora desses dois
// tamanhos (campo vazio, incompleto, ou já formatado de outro jeito),
// devolve o valor como veio, sem tentar adivinhar.
export function formatCpfCnpj(valor) {
  if (!valor) return '';
  const nums = String(valor).replace(/\D/g, '');
  if (nums.length === 11) return formatCPF(nums);
  if (nums.length === 14) return formatCNPJ(nums);
  return valor;
}

// Máscaras PROGRESSIVAS, para digitação em <input>. O formatCpfCnpj acima só
// formata quando o número está completo (11 ou 14 dígitos); enquanto a pessoa
// digita, ela via o valor cru. A usuária pediu (03/09/2026) máscara em TODO
// campo de CPF/CNPJ do app. Guardar o valor JÁ mascarado é seguro: todo lugar
// que compara documento faz .replace(/\D/g,'') antes, e o app nunca reescreve a
// declaração.
export function mascaraCpf(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
export function mascaraCnpj(valor) {
  const d = String(valor || '').replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
// CPF ou CNPJ conforme a quantidade de dígitos: até 11 formata como CPF, de 12
// em diante como CNPJ — o mesmo ponto de virada que o programa da Receita usa.
export function mascaraCpfCnpj(valor) {
  const d = String(valor || '').replace(/\D/g, '');
  return d.length <= 11 ? mascaraCpf(d) : mascaraCnpj(d);
}

export function parseBRLCurrency(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(clean) || 0;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  // Datas "YYYY-MM-DD" (de <input type="date">) são convertidas por string,
  // sem passar por Date: "new Date('2026-03-15')" é interpretado como
  // 00:00 UTC, que vira 14/03 ao formatar em horário de Brasília (UTC-3).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('pt-BR');
}

// Carimbo de auditoria (criadoEm/registradoEm): o valor gravado é ISO em UTC.
// Na tela ele vira data brasileira mais a hora de quem lê. Data pura, sem
// hora, continua indo por formatDate, que não passa por Date e não erra o dia.
export function formatDateTime(valor) {
  if (!valor) return '';
  // Sem instante no valor não há hora para mostrar, e passar "YYYY-MM-DD" por
  // Date devolveria o dia anterior num fuso negativo. Ver formatDate acima.
  if (!/\d[T ]\d/.test(String(valor))) return formatDate(valor);
  const d = new Date(valor);
  if (isNaN(d.getTime())) return formatDate(valor);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

// Rótulos oficiais para os tipos de rendimento que o import por .DBK gera
// (registros 21/23/24), conferidos em 17/08/2026 contra o manual de ajuda
// do programa IRPF2026 (exercício 2026, ano-calendário 2025), arquivo
// "AjudaIRPF-new.pdf" fornecido pela usuária — "Rendimentos Isentos e Não
// Tributáveis" e "Rendimentos Sujeitos à Tributação Exclusiva/Definitiva".
// Nomes truncados para caber na tela; o código completo confere com o
// manual. Qualquer código isento/exclusivo fora desta tabela (o manual não
// muda todo ano, mas pode ganhar código novo) cai no fallback abaixo, que
// mostra o número em vez de esconder ou inventar um rótulo.
export const RENDIMENTO_TIPOS_CONHECIDOS = {
  tributavel_pj: 'Tributável recebido de pessoa jurídica',
  tributavel_pf_exterior: 'Tributável recebido de pessoa física ou do exterior (carnê-leão)',
  tributavel_rra: 'Tributável recebido acumuladamente (RRA)',
  isento_01: 'Isento: bolsa de estudo/pesquisa (doação, exceto médico-residente)',
  isento_02: 'Isento: bolsa de estudo/pesquisa (doação a médico-residente)',
  isento_03: 'Isento: capital de apólice de seguro/pecúlio por morte',
  isento_04: 'Isento: indenização rescisão de contrato (inclusive PDV) e FGTS',
  isento_05: 'Isento: ganho de capital, bem de pequeno valor',
  isento_06: 'Isento: ganho de capital, único imóvel até R$ 440.000,00',
  isento_07: 'Isento: ganho de capital, venda de imóvel residencial com reaplicação em 180 dias',
  isento_08: 'Isento: ganho de capital, moeda estrangeira em espécie de pequeno valor',
  isento_09: 'Isento: lucros e dividendos recebidos',
  isento_10: 'Isento: parcela isenta de aposentadoria/reforma/pensão (65 anos ou mais)',
  isento_11: 'Isento: aposentadoria/reforma/pensão por moléstia grave',
  isento_12: 'Isento: poupança, LH, LCI, LCA e assemelhados',
  isento_13: 'Isento: rendimento de sócio/titular de ME ou EPP',
  isento_14: 'Isento: transferência patrimonial, doação e herança',
  isento_15: 'Isento: parcela não tributável da atividade rural',
  isento_16: 'Isento: IR de anos-calendário anteriores compensado judicialmente',
  isento_17: 'Isento: 75% do trabalho assalariado em município da faixa de fronteira',
  isento_18: 'Isento: incorporação de reservas ao capital / bonificação em ações',
  isento_19: 'Isento: transferência patrimonial, meação e dissolução de sociedade conjugal',
  isento_20: 'Isento: ganhos líquidos no mercado à vista de ações em bolsa',
  isento_21: 'Isento: ganhos líquidos em operações com ouro, ativo financeiro',
  isento_22: 'Isento: recuperação de prejuízos em renda variável',
  isento_23: 'Isento: até 90% do rendimento de transporte de carga',
  isento_24: 'Isento: até 40% do rendimento de transporte de passageiros',
  isento_25: 'Isento: restituição do IR de anos-calendário anteriores',
  isento_26: 'Isento: outros (linha 99 da ficha impressa)',
  isento_27: 'Isento: juros dos Rendimentos Recebidos Acumuladamente',
  isento_28: 'Isento: pensão alimentícia',
  exclusivo_01: 'Tributação exclusiva: 13º salário',
  exclusivo_02: 'Tributação exclusiva: ganho de capital na alienação de bens/direitos',
  exclusivo_03: 'Tributação exclusiva: ganho de capital, bens em moeda estrangeira',
  exclusivo_04: 'Tributação exclusiva: ganho de capital, moeda estrangeira em espécie',
  exclusivo_05: 'Tributação exclusiva: ganhos líquidos em renda variável',
  exclusivo_06: 'Tributação exclusiva: rendimentos de aplicações financeiras',
  exclusivo_07: 'Tributação exclusiva: rendimentos recebidos acumuladamente',
  exclusivo_08: 'Tributação exclusiva: 13º salário de dependente',
  exclusivo_09: 'Tributação exclusiva: rendimentos recebidos acumuladamente por dependente',
  exclusivo_10: 'Tributação exclusiva: juros sobre capital próprio',
  exclusivo_11: 'Tributação exclusiva: participação nos lucros ou resultados',
  // ATENÇÃO à numeração daqui para baixo. O arquivo da declaração usa o CÓDIGO
  // INTERNO do rendimento, e a ficha IMPRESSA numera as linhas da tela — as
  // duas coincidem até o 11 e divergem depois, porque a Lei 14.754/2023 e os
  // prêmios de loteria foram inseridos e a ficha renumerou. A tabela de-para
  // está na classe `CadastroTabelasIRPF` do programa da Receita (ver o
  // comentário em importParsers.js).
  //
  // Esta tabela usa o CÓDIGO INTERNO, que é o que os dois parsers geram desde
  // 24/08/2026. O número entre parênteses é como a ficha impressa chama a mesma
  // linha, para quem estiver conferindo no papel.
  exclusivo_12: 'Tributação exclusiva: outros (linha 99 da ficha impressa)',
  exclusivo_13: 'Tributação exclusiva: aplicações financeiras/lucros no exterior, Lei 14.754/2023 (linha 12 da ficha impressa)',
  exclusivo_14: 'Tributação exclusiva: prêmios líquidos em loterias de aposta de quota fixa, Lei 14.790/2023 (linha 13 da ficha impressa)',
};

export function describeRendimentoTipo(tipo) {
  if (!tipo) return 'Não classificado';
  if (RENDIMENTO_TIPOS_CONHECIDOS[tipo]) return RENDIMENTO_TIPOS_CONHECIDOS[tipo];
  const m = /^(isento|exclusivo)_(\d+)$/.exec(tipo);
  if (m) {
    // O MESMO código chega aqui em dois formatos, e essa normalização é o que
    // faz os rótulos aparecerem para rendimento IMPORTADO. Os parsers geram o
    // código com 4 dígitos, como o .DBK o grava ("isento_0009"), enquanto o
    // cadastro manual da tela usa as chaves de 2 dígitos desta mesma tabela
    // ("isento_09"). Sem normalizar, todo rendimento vindo de arquivo caía no
    // texto genérico "código 0009, confira na tabela do programa da Receita",
    // e a tabela acima só valia para o que a usuária digitasse à mão. Defeito
    // antigo, que só ficou visível quando o caminho PDF passou a importar as
    // fichas de isentos e de tributação exclusiva, em 23/08/2026.
    const curto = `${m[1]}_${m[2].replace(/^0+(?=\d\d)/, '')}`;
    if (RENDIMENTO_TIPOS_CONHECIDOS[curto]) return RENDIMENTO_TIPOS_CONHECIDOS[curto];
    const categoria = m[1] === 'isento' ? 'Isento' : 'Tributação exclusiva';
    return `${categoria}, código ${m[2]} (confira este código na tabela do programa da Receita)`;
  }
  return tipo;
}

export function categoriaRendimento(tipo) {
  if (!tipo) return 'outro';
  if (tipo.startsWith('tributavel')) return 'tributavel';
  if (tipo.startsWith('isento')) return 'isento';
  if (tipo.startsWith('exclusivo')) return 'exclusivo';
  return 'outro';
}

export const CATEGORIAS_RENDIMENTO = {
  tributavel: { label: 'Tributáveis', cor: 'blue' },
  isento: { label: 'Isentos e não tributáveis', cor: 'green' },
  exclusivo: { label: 'Tributação exclusiva/definitiva', cor: 'purple' },
  outro: { label: 'Outros', cor: 'orange' },
};

// Tabela Códigos de Pagamentos, conferida em 17/08/2026 contra o manual
// oficial do programa IRPF2026 ("AjudaIRPF-new.pdf", ficha "Pagamentos
// Efetuados"). Nomes truncados para caber no <select>.
export const CODIGOS_PAGAMENTO = [
  { codigo: '01', nome: 'Despesa com instrução no Brasil' },
  { codigo: '02', nome: 'Despesa com instrução no exterior' },
  { codigo: '09', nome: 'Fonoaudiólogos no Brasil' },
  { codigo: '10', nome: 'Médicos no Brasil' },
  { codigo: '11', nome: 'Dentistas no Brasil' },
  { codigo: '12', nome: 'Psicólogos no Brasil' },
  { codigo: '13', nome: 'Fisioterapeutas no Brasil' },
  { codigo: '14', nome: 'Terapeutas ocupacionais no Brasil' },
  { codigo: '15', nome: 'Médicos no exterior' },
  { codigo: '16', nome: 'Dentistas no exterior' },
  { codigo: '17', nome: 'Psicólogos no exterior' },
  { codigo: '18', nome: 'Fisioterapeutas no exterior' },
  { codigo: '19', nome: 'Terapeutas ocupacionais no exterior' },
  { codigo: '20', nome: 'Fonoaudiólogos no exterior' },
  { codigo: '21', nome: 'Hospitais, clínicas e laboratórios no Brasil' },
  { codigo: '22', nome: 'Hospitais, clínicas e laboratórios no exterior' },
  { codigo: '26', nome: 'Planos de saúde no Brasil' },
  { codigo: '30', nome: 'Pensão alimentícia judicial, alimentando residente no Brasil' },
  { codigo: '31', nome: 'Pensão alimentícia judicial, alimentando não residente no Brasil' },
  { codigo: '33', nome: 'Pensão alimentícia por escritura pública, residente no Brasil' },
  { codigo: '34', nome: 'Pensão alimentícia por escritura pública, não residente no Brasil' },
  { codigo: '36', nome: 'Previdência complementar (inclusive Fapi)' },
  { codigo: '37', nome: 'Entidade de previdência complementar (§15 art. 40 CF)' },
  { codigo: '60', nome: 'Advogados, ação judicial exceto trabalhista' },
  { codigo: '61', nome: 'Advogados, ação judicial trabalhista' },
  { codigo: '62', nome: 'Advogados, demais honorários' },
  { codigo: '66', nome: 'Engenheiros, arquitetos e demais profissionais liberais' },
  { codigo: '70', nome: 'Aluguéis de imóveis' },
  { codigo: '71', nome: 'Administrador de imóvel' },
  { codigo: '72', nome: 'Corretor de imóveis' },
  { codigo: '76', nome: 'Arrendamento rural' },
  { codigo: '99', nome: 'Outros' },
];

// Diferente dos rendimentos isentos e de tributação exclusiva, os códigos de
// PAGAMENTO não têm tradução entre o número impresso na ficha e o gravado no
// arquivo: o programa da Receita só define constantes `_TELA` para as duas
// fichas de rendimento (conferido varrendo `CadastroTabelasIRPF` em
// 24/08/2026 — são exatamente seis, todas de rendimento). Os códigos abaixo
// foram conferidos contra o manual, página 107, e batem inclusive na redação.
//
// Vale registrar a ausência: foi justamente supor que "código é código" que
// produziu o erro de rótulo da Lei 14.754, corrigido na ATUALIZAÇÃO 56.
export function describePagamentoCodigo(codigo) {
  return CODIGOS_PAGAMENTO.find(c => c.codigo === codigo)?.nome || '';
}

// Código do credor na ficha "Dívidas e Ônus Reais". Lista oficial da Receita
// (tabelas-irpf2026/tipoDividas.xml, mesma que o programa do IRPF mostra).
// Antes o campo era texto livre com o placeholder "Ex: 11, 12, 13".
export const CODIGOS_DIVIDA = [
  { codigo: '11', nome: 'Estabelecimento bancário comercial' },
  { codigo: '12', nome: 'Sociedades de crédito, financiamento e investimento' },
  { codigo: '13', nome: 'Outras pessoas jurídicas' },
  { codigo: '14', nome: 'Pessoas físicas' },
  { codigo: '15', nome: 'Empréstimos contraídos no exterior' },
  { codigo: '16', nome: 'Outras dívidas e ônus reais' },
];

export function describeDividaCodigo(codigo) {
  return CODIGOS_DIVIDA.find(c => c.codigo === String(codigo || '').trim())?.nome || '';
}

// A quem o pagamento se refere. A ficha imprime isso como um marcador que
// vale para as linhas seguintes ("Dependente: FULANO", "Alimentando: FULANO")
// e o parser o resolve item a item (ver importParsers, pagamentos-01).
//
// Não é rótulo decorativo: titular, dependente e alimentando têm regras de
// dedução diferentes na declaração. Despesa de instrução de dependente tem
// limite individual; pensão a alimentando é dedução própria, e não despesa do
// titular. Exibir tudo como se fosse do titular apaga essa distinção na hora
// de conferir.
export const TITULARIDADE_PAGAMENTO = {
  titular: 'Titular',
  dependente: 'Dependente',
  alimentando: 'Alimentando',
};

export function descreverTitularidade(pagamento) {
  const tipo = pagamento?.titularidade;
  const rotulo = TITULARIDADE_PAGAMENTO[tipo];
  // Sem titularidade informada, não afirma que é do titular: pagamento
  // cadastrado à mão antes deste campo existir simplesmente não tem o dado.
  if (!rotulo) return '';
  const nome = (pagamento?.titularidadeNome || '').trim();
  return nome ? `${rotulo}: ${nome}` : rotulo;
}

// De QUEM é o rendimento, quando ele é de um dependente.
//
// A coluna "Beneficiário" da tela mostrava só "Titular" ou "Dependente". Numa
// declaração com mais de um dependente, e são a maioria, "Dependente" sozinho
// não permite dizer de quem é o rendimento. O CPF vem no próprio lançamento
// (`cpf_dependente`), lido tanto do PDF quanto do .DBK, e nunca era mostrado.
//
// RIGOR FISCAL: a atribuição importa. O rendimento do dependente entra na
// declaração do titular, mas continua sendo rendimento DAQUELE dependente, e é
// o que decide, por exemplo, se compensa mantê-lo como dependente ou declarar
// em separado. Confundir de quem é o rendimento erra essa conta.
//
// Quando o CPF não casa com nenhum dependente cadastrado no ano, mostra o CPF
// e não um nome: o lançamento pode ser de um dependente que saiu da lista, e
// inventar o nome de outro seria pior que não ter nome.
export function descreverBeneficiarioRendimento(rendimento, dependentes = []) {
  const rotulo = rendimento?.beneficiario || '';
  const cpf = String(rendimento?.cpf_dependente || '').replace(/\D/g, '');
  if (!cpf) return { rotulo, detalhe: '' };
  const lista = Array.isArray(dependentes) ? dependentes : [];
  const achado = lista.find(d => String(d?.cpf || '').replace(/\D/g, '') === cpf);
  const nome = (achado?.nome || '').trim();
  return { rotulo, detalhe: nome ? `${nome} (${formatCpfCnpj(cpf)})` : formatCpfCnpj(cpf) };
}

// Número da LINHA na ficha impressa, quando ele é diferente do código interno
// que o arquivo grava.
//
// Os dois divergiram quando a Lei 14.754/2023 e os prêmios de loteria da Lei
// 14.790/2023 foram inseridos na ficha de tributação exclusiva: a ficha
// impressa renumerou as linhas e o arquivo manteve o código interno. Quem
// confere com a declaração em papel procura pelo número IMPRESSO, e a tela só
// mostrava o interno.
//
// Zero à esquerda não é divergência: "0009" e "09" são a mesma linha. A
// comparação é numérica de propósito, senão TODO rendimento apareceria como se
// tivesse dois códigos diferentes.
export function codigosDoRendimento(rendimento) {
  const interno = String(rendimento?.codigo_rendimento || '').trim();
  const impresso = String(rendimento?.codigo_impresso || '').trim();
  if (!interno && !impresso) return null;
  const mesmoNumero = interno !== '' && impresso !== ''
    && Number.parseInt(interno, 10) === Number.parseInt(impresso, 10);
  return {
    interno,
    impresso,
    // O que a pessoa procura no papel. Sem código impresso, o interno é o que há.
    naFichaImpressa: impresso || interno,
    divergem: !mesmoNumero && interno !== '' && impresso !== '',
  };
}

// As outras COLUNAS da ficha de Rendimentos Tributáveis Recebidos de Pessoa
// Jurídica. A ficha impressa tem cinco colunas de valor por fonte pagadora
// (AJU-01 p2 r5/r6: "REND. RECEBIDOS DE PES. JURÍDICA", "CONTR. PREVID.
// OFICIAL", "IMPOSTO RETIDO NA FONTE", "13º SALÁRIO" e "IRRF SOBRE 13º
// SALÁRIO"), e a tabela do app mostrava só duas delas, valor e imposto
// retido. As três que sobravam são extraídas desde sempre e morriam no estado.
//
// RIGOR FISCAL, e é o motivo de cada uma aparecer com o seu próprio nome:
//
// - A contribuição previdenciária oficial descontada pela fonte é DEDUÇÃO da
//   base de cálculo do ajuste anual (art. 4º, IV, da Lei nº 9.250/1995), não
//   é imposto e não se soma ao IRRF.
// - O 13º salário é rendimento de TRIBUTAÇÃO EXCLUSIVA na fonte (art. 638 do
//   Decreto nº 9.580/2018): não entra na base do ajuste anual e o imposto
//   dele não é compensável na apuração do saldo. Por isso ele não está no
//   valor da linha, e a nota diz onde ele é somado, para ninguém contá-lo
//   duas vezes ao conferir. O próprio programa da Receita o transporta para a
//   ficha de Rendimentos Sujeitos à Tributação Exclusiva/Definitiva, no
//   código 01 (titular) ou 08 (dependentes) — conferido no AJU-01, cujo 13º
//   do titular, 5.105,15 com IRRF de 505,16, reaparece inteiro no
//   `exclusivo_0001`.
const ehNumeroPositivo = (v) => Number.isFinite(Number(v)) && Number(v) > 0;

export function colunasDaFontePagadora(rendimento) {
  if (!rendimento) return [];
  const colunas = [];
  if (ehNumeroPositivo(rendimento.contribuicaoPrevidenciaria)) {
    colunas.push({
      chave: 'previdencia',
      rotulo: 'Contribuição previdenciária oficial',
      valor: Number(rendimento.contribuicaoPrevidenciaria),
      nota: 'Descontada pela fonte pagadora. É dedução da base de cálculo do ajuste anual, não é imposto.',
    });
  }
  if (ehNumeroPositivo(rendimento.decimoTerceiro)) {
    colunas.push({
      chave: 'decimoTerceiro',
      rotulo: '13º salário',
      valor: Number(rendimento.decimoTerceiro),
      nota: 'Tributação exclusiva na fonte: não entra na base do ajuste anual e já está lançado à parte, na ficha de rendimentos sujeitos à tributação exclusiva. Não some com o valor desta linha.',
    });
  }
  if (ehNumeroPositivo(rendimento.irrfDecimoTerceiro)) {
    colunas.push({
      chave: 'irrfDecimoTerceiro',
      rotulo: 'IRRF sobre o 13º salário',
      valor: Number(rendimento.irrfDecimoTerceiro),
      nota: 'Imposto da tributação exclusiva do 13º salário. É definitivo: não se soma ao imposto retido da coluna ao lado nem se compensa no ajuste anual.',
    });
  }
  return colunas;
}

// Alíquota como a ficha a imprime. O parser devolve a célula do PDF do jeito
// que ela está no papel ("20,00"), e o caminho .DBK devolve número. Os dois
// entram aqui e saem no mesmo formato.
//
// Célula vazia devolve string vazia, e não "0,00%": a ficha de FII e Fiagro
// imprime 0,00 nos meses sem movimento, mas mês que a declaração não trouxe
// não tem alíquota nenhuma, e escrever zero ali seria afirmar uma alíquota
// que o documento não afirma.
export function formatarAliquotaFicha(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const numero = typeof valor === 'number' ? valor : Number(String(valor).trim().replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(numero)) return '';
  return `${numero.toFixed(2).replace('.', ',')}%`;
}

// A data em que a condição de não residente foi comunicada à FONTE PAGADORA,
// impressa dentro da ficha de rendimentos de pessoa jurídica da declaração de
// saída definitiva (SAI-01 p1 r35).
//
// RIGOR FISCAL: é dessa data em diante que a fonte deixa de aplicar a tabela
// progressiva do residente. Ela é distinta da data de caracterização da
// condição de não residente, que fica no quadro da saída definitiva, e as duas
// podem não coincidir. Aparece na linha da fonte pagadora, que é a quem a
// comunicação foi feita.
export function descreverComunicacaoNaoResidente(rendimento) {
  const iso = rendimento?.dataComunicacaoNaoResidente;
  if (!iso) return '';
  const data = formatDate(iso);
  return data ? `Condição de não residente comunicada a esta fonte em ${data}` : '';
}

// A coluna "Tipo" do Demonstrativo de Apuração da Lei nº 14.754/2023, com a
// legenda que a própria ficha imprime logo abaixo da tabela (AJU-01 p39 r11,
// r14, r15 e r18 a r20).
//
// RIGOR FISCAL: as duas siglas não são detalhe de layout. O rendimento de
// APLICAÇÃO FINANCEIRA no exterior é tributado pelo art. 3º da Lei nº
// 14.754/2023, no momento da realização; o LUCRO de entidade CONTROLADA no
// exterior é tributado pelo art. 5º, em 31 de dezembro, tenha sido distribuído
// ou não. Ficam nas mesmas colunas da mesma tabela e o número do bem se
// repete, então sem esta coluna as duas linhas do AJU-01 aparecem como "bem 7"
// duas vezes, sem nada que diga qual é qual.
export const TIPO_DEMONSTRATIVO_EXTERIOR = {
  AF: 'Aplicação financeira',
  LD: 'Lucros e dividendos',
};

export function descreverTipoDemonstrativoExterior(tipo) {
  const sigla = String(tipo || '').trim().toUpperCase();
  if (!sigla) return null;
  return { sigla, descricao: TIPO_DEMONSTRATIVO_EXTERIOR[sigla] || '' };
}

// Documento de um participante de imóvel rural explorado em condomínio ou
// parceria. O participante pode ser ESTRANGEIRO e, nesse caso, a ficha o
// imprime sem CPF: célula vazia ali parece dado perdido na importação, quando
// na verdade é o documento que não existe.
export function descreverDocumentoParticipante(participante) {
  if (participante?.estrangeiro) return { estrangeiro: true, texto: 'Estrangeiro, sem CPF' };
  const cpf = formatCpfCnpj(participante?.cpf);
  return { estrangeiro: false, texto: cpf || '-' };
}

// De onde veio um item importado: formato do arquivo, página e linha.
//
// Todo item que o parser do PDF produz carrega `origemDocumento`, e nada
// disso aparecia na interface. É o que permite conferir um número contra a
// declaração impressa sem procurar página por página.
//
// O caminho .DBK ainda NÃO marca origem nos itens (ver importParsers): lá o
// arquivo é de largura fixa e a referência útil seria o número do registro.
// Enquanto isso não existe, item vindo do .DBK simplesmente não mostra origem,
// em vez de mostrar uma origem inventada.
export function descreverOrigemDocumento(item) {
  const o = item?.origemDocumento;
  if (!o) return '';
  if (o.formato === 'pdf') {
    if (!o.pagina) return 'PDF da declaração';
    return o.linha
      ? `PDF, página ${o.pagina}, linha ${o.linha}`
      : `PDF, página ${o.pagina}`;
  }
  if (o.formato === 'dbk') {
    return o.registro ? `Arquivo da declaração, registro ${o.registro}` : 'Arquivo da declaração';
  }
  return '';
}

// Relação de dependência, a tabela oficial do programa da Receita
// (tabelas-irpf2026/dependencias.xml, extraído do IRPF 2026). O app guardava
// e exibia o CÓDIGO CRU, e "21" sozinho não permite conferir nada: a dedução
// por dependente depende da relação (filho até 21 anos, até 24 se cursando
// nível superior, com deficiência em qualquer idade, e assim por diante).
//
// `curto` é o rótulo que o próprio programa mostra na tela; `oficial` é o
// texto legal completo, usado como dica ao passar o mouse.
export const RELACAO_DEPENDENCIA = {
  '11': { curto: 'Companheiro(a) ou cônjuge', oficial: "Companheiro(a) com o(a) qual o(a) contribuinte tenha filho ou viva há mais de 5 (cinco) anos, ou cônjuge." },
  '21': { curto: 'Filho(a) ou enteado(a) até 21 (vinte e um) anos.', oficial: "Filho(a) ou enteado(a) até 21 (vinte e um) anos." },
  '22': { curto: 'Filho(a) ou enteado(a) cursando nível superior, até 24 anos', oficial: "Filho(a) ou enteado(a) cursando estabelecimento de nível superior ou escola técnica de 2º grau, até 24 (vinte e quatro) anos." },
  '23': { curto: 'Filho(a) ou enteado(a) em qualquer idade, com deficiência', oficial: "Filho(a) ou enteado(a) com deficiência, em qualquer idade, quando a sua remuneração não exceder as deduções autorizadas por lei." },
  '24': { curto: 'Irmãos, netos ou bisnetos até 21 anos com guarda judicial', oficial: "Irmão(ã), neto(a) ou bisneto(a) sem arrimo dos pais, do(a) qual o contribuinte detém a guarda judicial, até 21 (vinte e um) anos." },
  '25': { curto: 'Irmãos, netos ou bisnetos até 24 anos, com guarda judicial', oficial: "Irmão(ã), neto(a) ou bisneto(a) sem arrimo dos pais, com idade até 24 anos, se ainda estiver cursando estabelecimento de nível superior ou escola técnica de 2º grau, desde que o contribuinte tenha detido sua guarda judicial até os 21 anos." },
  '26': { curto: 'Irmãos, netos ou bisnetos com deficiência e guarda judicial.', oficial: "Irmão(ã), neto(a) ou bisneto(a) com deficiência, sem arrimo dos pais, do(a) qual o contribuinte detém a guarda judicial, em qualquer idade, quando a sua remuneração não exceder as deduções autorizadas por lei (Acórdão proferido pelo STF na ADI 5583/DF)." },
  '31': { curto: 'Pais, avós e bisavós com ou sem rend. até  R$ 28.467,20.', oficial: "Pais, avós e bisavós que, em 2025, receberam rendimentos, tributáveis ou não, até R$ 28.467,20." },
  '41': { curto: 'Menor pobre, até 21 (vinte e um) anos, com guarda judicial', oficial: "Menor pobre, até 21 (vinte e um) anos, que o contribuinte crie e eduque e do qual detenha a guarda judicial." },
  '51': { curto: 'Tutor ou Curador de pessoa absolutamente incapaz', oficial: "A pessoa absolutamente incapaz, da qual o contribuinte seja tutor ou curador." },
};

// Lista [{ codigo, nome }] para o SeletorCodigo da tela Titular e Dependentes.
// Mesma fonte de RELACAO_DEPENDENCIA (tabelas-irpf2026/dependencias.xml); o
// `nome` é a redação curta.
export const CODIGOS_DEPENDENCIA = Object.entries(RELACAO_DEPENDENCIA).map(
  ([codigo, { curto }]) => ({ codigo, nome: curto })
);

export function describeRelacaoDependencia(codigo) {
  return RELACAO_DEPENDENCIA[String(codigo || '').trim()]?.curto || '';
}

export function textoOficialRelacaoDependencia(codigo) {
  return RELACAO_DEPENDENCIA[String(codigo || '').trim()]?.oficial || '';
}

// Marcadores de um bem que mudam a leitura fiscal dele e que a tabela não
// mostrava: de quem o bem é, e onde ele está.
//
// - Bem do DEPENDENTE é declarado na declaração do titular, mas não é
//   patrimônio do titular. Confundir os dois erra a atribuição do bem.
// - Bem NO EXTERIOR tem regra própria (a começar pela Lei 14.754/2023) e
//   precisa ser visível sem abrir o bem um por um.
//
// O código 105 é o Brasil na tabela oficial de países do programa da Receita.
export const CODIGO_PAIS_BRASIL = '105';

export function bemNoExterior(bem) {
  const codigo = String(bem?.localizacao || '').trim();
  if (codigo) return codigo !== CODIGO_PAIS_BRASIL;
  const nome = String(bem?.paisNome || '').trim().toUpperCase();
  // Sem código e sem nome, não se afirma nada: a maioria das declarações
  // antigas do app não tem esses campos, e marcar tudo como exterior seria
  // pior que não marcar.
  return nome !== '' && nome !== 'BRASIL';
}

export function marcadoresDoBem(bem) {
  const marcas = [];
  if (String(bem?.beneficiario || '').toLowerCase() === 'dependente') {
    const cpf = (bem?.cpf_beneficiario || '').trim();
    marcas.push({ tipo: 'dependente', texto: cpf ? `Dependente: ${formatCpfCnpj(cpf)}` : 'Dependente' });
  }
  if (bemNoExterior(bem)) {
    const pais = (bem?.paisNome || '').trim();
    marcas.push({ tipo: 'exterior', texto: pais ? `Exterior: ${pais}` : 'Exterior' });
  }
  return marcas;
}

// Tipo de movimentação de um bem: como a situação atual dele muda quando a
// usuária registra uma compra, venda, benfeitoria etc (ver BemModal e
// RelatorioPage). Fica aqui para os dois usarem o mesmo rótulo.
export const MOVIMENTACAO_TIPOS = {
  compra: { label: 'Compra ou aquisição adicional', sinal: '+', ajuda: 'Valor pago pela aquisição. Soma ao valor declarado do bem.' },
  benfeitoria: { label: 'Benfeitoria ou melhoria', sinal: '+', ajuda: 'Custo da benfeitoria (reforma, construção, plantio etc). Soma ao valor declarado do bem.' },
  venda_parcial: { label: 'Venda parcial', sinal: '-', ajuda: '"Situação em 31/12" é custo de aquisição, não valor de mercado: informe a parcela do custo que sai (ex: vendeu 1/3, tire 1/3 do valor). O preço recebido vai no campo "Valor de venda" abaixo.' },
  venda_total: { label: 'Venda total (zera o valor)', sinal: '0', ajuda: 'Zera o valor declarado do bem. O preço recebido vai no campo "Valor de venda" abaixo.' },
  baixa: { label: 'Baixa: perda, doação, destruição (zera o valor)', sinal: '0', ajuda: 'Zera o valor declarado do bem.' },
  ajuste: { label: 'Ajuste direto de valor', sinal: '=', ajuda: 'Substitui o valor declarado do bem pelo valor informado. Use só para corrigir um erro de cadastro, não para registrar uma movimentação real.' },
};

// Tipos de movimentação de uma dívida: como o saldo devedor muda quando a
// usuária registra uma contração, amortização etc (ver DividasPage). Mesmo
// formato de MOVIMENTACAO_TIPOS para o MovimentacaoBemForm servir aos dois.
export const MOVIMENTACAO_DIVIDA_TIPOS = {
  contratacao: { label: 'Contratação (nova dívida ou refinanciamento)', sinal: '+', ajuda: 'Valor novo contratado. Soma ao saldo devedor.' },
  amortizacao: { label: 'Amortização ou pagamento parcial', sinal: '-', ajuda: 'Valor pago que abate o saldo devedor (parcela de principal, não os juros). Subtrai do saldo, sem passar de zero.' },
  quitacao: { label: 'Quitação (zera o saldo)', sinal: '0', ajuda: 'Zera o saldo devedor. Guarde o valor total pago na descrição, se quiser rastreá-lo.' },
  ajuste: { label: 'Ajuste direto de saldo', sinal: '=', ajuda: 'Substitui o saldo devedor pelo valor informado. Use só para corrigir um erro de cadastro, não para registrar uma movimentação real.' },
};

// Grupos e códigos de Bens e Direitos conferidos em 17/08/2026 contra o
// manual de ajuda do programa IRPF2026 ("AjudaIRPF-new.pdf", "Tabela de
// Códigos de Bens e Direitos"). O grupo 08 (Criptoativos) e vários códigos
// dos grupos 01/02 estavam faltando na versão anterior desta tabela, que
// não tinha sido conferida contra fonte nenhuma.
export const GRUPOS_BENS = [
  { codigo: '01', nome: 'Bens Imóveis', cor: 'blue' },
  { codigo: '02', nome: 'Bens Móveis', cor: 'green' },
  { codigo: '03', nome: 'Participações Societárias', cor: 'purple' },
  { codigo: '04', nome: 'Aplicações e Investimentos', cor: 'orange' },
  { codigo: '05', nome: 'Créditos', cor: 'blue' },
  { codigo: '06', nome: 'Depósitos à Vista e Numerário', cor: 'green' },
  { codigo: '07', nome: 'Fundos', cor: 'purple' },
  { codigo: '08', nome: 'Criptoativos', cor: 'orange' },
  { codigo: '99', nome: 'Outros Bens e Direitos', cor: 'orange' },
];

export const CODIGOS_POR_GRUPO = {
  '01': [
    { codigo: '01', nome: 'Prédio residencial' },
    { codigo: '02', nome: 'Prédio comercial' },
    { codigo: '03', nome: 'Galpão' },
    { codigo: '11', nome: 'Apartamento' },
    { codigo: '12', nome: 'Casa' },
    { codigo: '13', nome: 'Terreno' },
    { codigo: '14', nome: 'Imóvel rural' },
    { codigo: '15', nome: 'Sala ou conjunto' },
    { codigo: '16', nome: 'Construção' },
    { codigo: '17', nome: 'Benfeitorias até 1988' },
    { codigo: '18', nome: 'Loja' },
    { codigo: '19', nome: 'Garagem avulsa' },
    { codigo: '99', nome: 'Outros bens imóveis' },
  ],
  '02': [
    { codigo: '01', nome: 'Veículo automotor terrestre (caminhão, automóvel, moto etc)' },
    { codigo: '02', nome: 'Aeronave' },
    { codigo: '03', nome: 'Embarcação' },
    { codigo: '04', nome: 'Bem relacionado com atividade autônoma' },
    { codigo: '05', nome: 'Quadro, objeto de arte, de coleção, antiguidade etc' },
    { codigo: '06', nome: 'Joia' },
    { codigo: '99', nome: 'Outros bens móveis' },
  ],
  '03': [
    { codigo: '01', nome: 'Ações (inclusive listadas em bolsa)' },
    { codigo: '02', nome: 'Quotas ou quinhões de capital' },
    { codigo: '03', nome: 'Holding patrimonial (ações/quotas por integralização de bens)' },
    { codigo: '99', nome: 'Outras participações societárias' },
  ],
  '04': [
    { codigo: '01', nome: 'Depósito em conta poupança' },
    { codigo: '02', nome: 'Títulos públicos e privados sujeitos a tributação (Tesouro Direto, CDB, RDB etc)' },
    { codigo: '03', nome: 'Títulos isentos de tributação (LCI, LCA, LCD, CRI, CRA, LIG etc)' },
    { codigo: '04', nome: 'Ativos negociados em bolsa no Brasil (BDRs, opções etc, exceto ações e fundos)' },
    { codigo: '05', nome: 'Ouro, ativo financeiro' },
    { codigo: '99', nome: 'Outras aplicações e investimentos' },
  ],
  '05': [
    { codigo: '01', nome: 'Empréstimos concedidos' },
    { codigo: '02', nome: 'Crédito decorrente de alienação' },
    { codigo: '99', nome: 'Outros créditos' },
  ],
  '06': [
    { codigo: '01', nome: 'Depósito em conta-corrente ou conta pagamento' },
    { codigo: '02', nome: 'Conta gráfica de agente operador de loterias de aposta de quota fixa' },
    { codigo: '10', nome: 'Dinheiro em espécie, moeda nacional' },
    { codigo: '11', nome: 'Dinheiro em espécie, moeda estrangeira' },
    { codigo: '99', nome: 'Outros depósitos à vista' },
  ],
  '07': [
    { codigo: '01', nome: 'Fundos sujeitos à tributação periódica (come-cotas)' },
    { codigo: '02', nome: 'Fiagro' },
    { codigo: '03', nome: 'Fundo de Investimento Imobiliário (FII)' },
    { codigo: '04', nome: 'Fundo de Investimento em Ações / FMP-FGTS' },
    { codigo: '06', nome: 'FIP/FIDC/ETF entidade de investimento sem come-cotas' },
    { codigo: '07', nome: 'FIP-IE e FIP-PD&I' },
    { codigo: '08', nome: 'Fundo de Índice de Renda Fixa (ETF)' },
    { codigo: '10', nome: 'Fundos de Infraestrutura, FIDC e outros (alíquota 0%)' },
    { codigo: '12', nome: 'Fundo de Investimento em Empresas Emergentes (FIEE)' },
    { codigo: '13', nome: 'Fundo multimercado' },
    { codigo: '99', nome: 'Fundos de investimento no exterior' },
  ],
  '08': [
    { codigo: '01', nome: 'Bitcoin (BTC)' },
    { codigo: '02', nome: 'Outras criptomoedas / altcoins (ETH, XRP, BCH, LTC etc)' },
    { codigo: '03', nome: 'Stablecoins (USDT, USDC, BRZ, BUSD, DAI etc)' },
    { codigo: '10', nome: 'NFTs (Non-Fungible Tokens)' },
    { codigo: '99', nome: 'Outros criptoativos' },
  ],
  '99': [
    { codigo: '01', nome: 'Licença e concessão especiais' },
    { codigo: '02', nome: 'Título de clube e assemelhado' },
    { codigo: '03', nome: 'Direito de autor, de inventor e patente' },
    { codigo: '04', nome: 'Direito de lavra e assemelhado' },
    { codigo: '05', nome: 'Consórcio não contemplado' },
    { codigo: '06', nome: 'VGBL, Vida Gerador de Benefício Livre' },
    { codigo: '07', nome: 'Juros sobre capital próprio creditado, mas não pago' },
    { codigo: '08', nome: 'Leasing com opção de compra a exercer no fim do contrato' },
    { codigo: '99', nome: 'Outros bens e direitos' },
  ],
};

// Mantidos por compatibilidade com quem já importava estes nomes.
export const CODIGOS_IMOVEL = CODIGOS_POR_GRUPO['01'];
export const CODIGOS_VEICULO = CODIGOS_POR_GRUPO['02'];

// Duas letras pra identificar um perfil visualmente sem depender de foto
// (avatar da tela de seleção/desbloqueio de perfil): iniciais do primeiro
// e do último nome, ou as duas primeiras letras se só houver uma palavra.
export function iniciaisNome(nome) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

// Resume uma lista de meses em texto curto, por ano: "o ano inteiro de 2025",
// "01 a 06/2025", "03, 07 e 11/2025". Listar os 12 meses um a um, que era o
// que a tela fazia, gasta três linhas para dizer "todos".
export const resumirMeses = (lista) => {
  // Sem esta guarda, lista vazia caía na junção com "e" lá embaixo e devolvia
  // " e undefined" (achado pelo próprio teste). Hoje a tela só chama isto
  // quando há mês, mas a função não deve depender disso.
  if (!lista || lista.length === 0) return '';
  const porAno = new Map();
  for (const { mes, ano } of (lista || [])) {
    if (!mes || !ano) continue;
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push(mes);
  }
  const dois = (n) => String(n).padStart(2, '0');
  const trechos = [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, meses]) => {
    const ordenados = [...new Set(meses)].sort((a, b) => a - b);
    if (ordenados.length === 12) return `o ano inteiro de ${ano}`;
    // Comprime sequências seguidas: 1,2,3,7 vira "01 a 03 e 07".
    const faixas = [];
    let ini = ordenados[0], ant = ordenados[0];
    for (const m of ordenados.slice(1)) {
      if (m === ant + 1) { ant = m; continue; }
      faixas.push(ini === ant ? dois(ini) : `${dois(ini)} a ${dois(ant)}`);
      ini = m; ant = m;
    }
    faixas.push(ini === ant ? dois(ini) : `${dois(ini)} a ${dois(ant)}`);
    const texto = faixas.length === 1 ? faixas[0]
      : `${faixas.slice(0, -1).join(', ')} e ${faixas[faixas.length - 1]}`;
    return `${texto}/${ano}`;
  });
  if (trechos.length === 0) return '';
  return trechos.length === 1 ? trechos[0]
    : `${trechos.slice(0, -1).join(', ')} e ${trechos[trechos.length - 1]}`;
};
