// Catálogo da imagem completa da declaração IRPF 2026. A fonte é o relatório
// oficial DIRPF2026.jrxml e os sub-relatórios do irpf-impressao.jar distribuído
// no programa da Receita. Ele é separado do catálogo de 94 tipos do .DBK:
// registro eletrônico e ficha impressa são universos relacionados, mas não
// possuem correspondência um para um.

const ficha = (id, titulo, suporte, padroes = [titulo]) => Object.freeze({
  id,
  titulo,
  suporte,
  padroes: Object.freeze(padroes),
});

export const CATALOGO_FICHAS_PDF_2026 = Object.freeze([
  ficha('identificacao-contribuinte', 'Identificação do contribuinte', 'estruturada', ['IDENTIFICAÇÃO DO CONTRIBUINTE']),
  ficha('inventariante', 'Espólio, inventariante e partilha', 'estruturada', ['ESPÓLIO', 'INVENTARIANTE', 'PARTILHA', 'SOBREPARTILHA']),
  ficha('saida-definitiva', 'Saída definitiva do país', 'estruturada', ['SAÍDA DEFINITIVA DO PAÍS', 'SAÍDA']),
  ficha('dependentes', 'Dependentes', 'estruturada', ['DEPENDENTES']),
  ficha('alimentandos', 'Alimentandos', 'nao_suportada', ['ALIMENTANDOS']),
  ficha('herdeiros', 'Herdeiros', 'estruturada', ['HERDEIROS', 'HERDEIROS / MEEIRO']),

  ficha('rendimentos-pj-titular', 'Rendimentos tributáveis de PJ do titular', 'estruturada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR']),
  ficha('rendimentos-pj-dependentes', 'Rendimentos tributáveis de PJ dos dependentes', 'estruturada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOAS JURÍDICAS PELOS DEPENDENTES', 'RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES']),
  ficha('rendimentos-pf-exterior-titular', 'Rendimentos de PF e exterior do titular', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELO TITULAR']),
  ficha('rendimentos-pf-exterior-dependentes', 'Rendimentos de PF e exterior dos dependentes', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA FÍSICA E DO EXTERIOR PELOS DEPENDENTES']),
  ficha('rendimentos-isentos', 'Rendimentos isentos e não tributáveis', 'estruturada', ['RENDIMENTOS ISENTOS E NÃO TRIBUTÁVEIS']),
  ficha('rendimentos-tributacao-exclusiva', 'Rendimentos sujeitos à tributação exclusiva ou definitiva', 'estruturada', ['RENDIMENTOS SUJEITOS À TRIBUTAÇÃO EXCLUSIVA / DEFINITIVA']),
  ficha('rendimentos-exigibilidade-titular', 'Rendimentos de PJ com exigibilidade suspensa do titular', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELO TITULAR (IMPOSTO COM EXIGIBILIDADE SUSPENSA)']),
  ficha('rendimentos-exigibilidade-dependentes', 'Rendimentos de PJ com exigibilidade suspensa dos dependentes', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS RECEBIDOS DE PESSOA JURÍDICA PELOS DEPENDENTES (IMPOSTO COM EXIGIBILIDADE']),
  ficha('rra-titular', 'Rendimentos recebidos acumuladamente pelo titular', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELO TITULAR']),
  ficha('rra-dependentes', 'Rendimentos recebidos acumuladamente pelos dependentes', 'nao_suportada', ['RENDIMENTOS TRIBUTÁVEIS DE PESSOA JURÍDICA RECEBIDOS ACUMULADAMENTE PELOS DEPENDENTES']),
  ficha('demais-rendimentos-titular', 'Demais rendimentos do titular', 'nao_suportada', ['DEMAIS RENDIMENTOS DO TITULAR']),
  ficha('demais-rendimentos-dependentes', 'Demais rendimentos dos dependentes', 'nao_suportada', ['DEMAIS RENDIMENTOS DOS DEPENDENTES']),
  ficha('transportes', 'Rendimentos de transportes', 'nao_suportada', ['TRANSPORTES']),

  ficha('imposto-pago-retido', 'Imposto pago ou retido', 'parcial', ['IMPOSTO PAGO / RETIDO']),
  ficha('pagamentos-efetuados', 'Pagamentos efetuados', 'estruturada', ['PAGAMENTOS EFETUADOS']),
  ficha('doacoes-efetuadas', 'Doações efetuadas', 'estruturada', ['DOAÇÕES EFETUADAS']),
  ficha('bens-direitos', 'Bens e direitos', 'estruturada', ['DECLARAÇÃO DE BENS E DIREITOS']),
  ficha('dividas-onus', 'Dívidas e ônus reais', 'estruturada', ['DÍVIDAS E ÔNUS REAIS']),
  ficha('conjuge', 'Informações do cônjuge', 'nao_suportada', ['INFORMAÇÕES DO CÔNJUGE', 'CÔNJUGE OU COMPANHEIRO', 'INFORMAÇÕES DO CÔNJUGE OU COMPANHEIRO(A)']),
  ficha('doacoes-eleitorais', 'Doações a partidos e candidatos', 'estruturada', ['DOAÇÕES A PARTIDOS POLÍTICOS E CANDIDATOS A CARGOS ELETIVOS']),
  ficha('doacoes-eca', 'Doações diretamente na declaração - ECA', 'estruturada', ['DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - ECA']),
  ficha('doacoes-idoso', 'Doações diretamente na declaração - pessoa idosa', 'estruturada', ['DOAÇÕES DIRETAMENTE NA DECLARAÇÃO - PESSOA IDOSA']),

  ficha('rural-brasil-identificacao', 'Atividade rural Brasil - imóveis explorados', 'estruturada', ['DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - BRASIL']),
  ficha('rural-brasil-receitas-despesas', 'Atividade rural Brasil - receitas e despesas', 'estruturada', ['RECEITAS E DESPESAS - BRASIL']),
  ficha('rural-brasil-apuracao', 'Atividade rural Brasil - apuração do resultado', 'estruturada', ['APURAÇÃO DO RESULTADO - BRASIL']),
  ficha('rural-brasil-rebanho', 'Atividade rural Brasil - movimentação do rebanho', 'estruturada', ['MOVIMENTAÇÃO DO REBANHO - BRASIL']),
  ficha('rural-brasil-bens', 'Atividade rural Brasil - bens', 'estruturada', ['BENS DA ATIVIDADE RURAL - BRASIL']),
  ficha('rural-brasil-dividas', 'Atividade rural Brasil - dívidas vinculadas', 'estruturada', ['DÍVIDAS VINCULADAS À ATIVIDADE RURAL - BRASIL']),
  ficha('rural-brasil-participantes', 'Atividade rural Brasil - participantes', 'estruturada', ['PARTICIPANTE(S)']),
  ficha('rural-exterior-identificacao', 'Atividade rural exterior - imóveis explorados', 'nao_suportada', ['DADOS E IDENTIFICAÇÃO DO IMÓVEL EXPLORADO - EXTERIOR']),
  ficha('rural-exterior-receitas-despesas', 'Atividade rural exterior - receitas e despesas', 'nao_suportada', ['RECEITAS E DESPESAS - EXTERIOR']),
  ficha('rural-exterior-apuracao', 'Atividade rural exterior - apuração do resultado', 'nao_suportada', ['APURAÇÃO DO RESULTADO - EXTERIOR']),
  ficha('rural-exterior-rebanho', 'Atividade rural exterior - movimentação do rebanho', 'nao_suportada', ['MOVIMENTAÇÃO DO REBANHO - EXTERIOR']),
  ficha('rural-exterior-bens', 'Atividade rural exterior - bens', 'nao_suportada', ['BENS DA ATIVIDADE RURAL - EXTERIOR']),
  ficha('rural-exterior-dividas', 'Atividade rural exterior - dívidas vinculadas', 'nao_suportada', ['DÍVIDAS VINCULADAS À ATIVIDADE RURAL - EXTERIOR']),

  ficha('ganho-capital-imoveis', 'Ganho de capital - bens imóveis', 'estruturada', ['DEMONSTRATIVO DA APURAÇÃO DO GANHO DE CAPITAL - BENS IMÓVEIS']),
  ficha('ganho-capital-moveis', 'Ganho de capital - bens móveis', 'estruturada', ['DEMONSTRATIVO DA APURAÇÃO DO GANHO DE CAPITAL - BENS MÓVEIS']),
  ficha('ganho-capital-participacao', 'Ganho de capital - participação societária', 'estruturada', ['DEMONSTRATIVO DA APURAÇÃO DO GANHO DE CAPITAL - PARTICIPAÇÃO SOCIETÁRIA']),
  ficha('ganho-capital-moeda', 'Ganho de capital - moeda em espécie', 'parcial', ['DEMONSTRATIVO DA APURAÇÃO DO GANHO DE CAPITAL - MOEDAS EM ESPÉCIE']),
  ficha('renda-variavel-titular', 'Renda variável - operações do titular', 'estruturada', ['RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - TITULAR']),
  ficha('renda-variavel-dependentes', 'Renda variável - operações dos dependentes', 'estruturada', ['RENDA VARIÁVEL - OPERAÇÕES COMUNS/DAYTRADE - DEPENDENTES']),
  ficha('fii-fiagro-titular', 'FII e Fiagro - titular', 'parcial', ['FUNDOS DE INVESTIMENTO IMOBILIÁRIO OU NAS CADEIAS PRODUTIVAS AGROINDUSTRIAIS - TITULAR']),
  ficha('fii-fiagro-dependentes', 'FII e Fiagro - dependentes', 'parcial', ['FUNDOS DE INVESTIMENTO IMOBILIÁRIO OU NAS CADEIAS PRODUTIVAS AGROINDUSTRIAIS - DEPENDENTES']),
  ficha('lei-14754', 'Demonstrativo de apuração - Lei 14.754/2023', 'estruturada', ['DEMONSTRATIVO DE APURAÇÃO - LEI 14.754/2023']),
  ficha('resumo', 'Resumo da declaração e evolução patrimonial', 'estruturada', ['RESUMO', 'EVOLUÇÃO PATRIMONIAL']),
]);

const normalizar = (texto) => String(texto || '').replace(/\s+/g, ' ').trim().toUpperCase();

export function encontrarFichaPdf2026(texto) {
  const normalizado = normalizar(texto);
  if (!normalizado) return null;
  const candidatos = [];
  for (const item of CATALOGO_FICHAS_PDF_2026) {
    for (const padrao of item.padroes) {
      const p = normalizar(padrao);
      // Títulos longos podem trazer complementos impressos, como "(Valores
      // em Reais)". Rótulos curtos precisam coincidir por inteiro: aceitar
      // "TRANSPORTES E LOGÍSTICA LTDA" como a ficha "Transportes" já gerou
      // um falso positivo dentro da discriminação de um bem real.
      if (normalizado === p || (p.length >= 24 && normalizado.startsWith(p))) {
        candidatos.push({ item, tamanho: p.length });
      }
    }
  }
  // Um título especializado pode começar pelo título de outra ficha. Exemplo:
  // rendimentos de PJ do titular com exigibilidade suspensa começa exatamente
  // como a ficha comum do titular. O padrão mais longo é sempre o específico.
  candidatos.sort((a, b) => b.tamanho - a.tamanho);
  return candidatos[0]?.item || null;
}

// `texto` parece o COMEÇO de um título de ficha que o formulário cortou ao
// meio? O programa da Receita quebra o título em duas linhas visuais quando ele
// não cabe na largura da ficha, e o ponto do corte muda de declaração para
// declaração: a mesma ficha de exigibilidade suspensa dos dependentes sai como
// "... (IMPOSTO COM" numa declaração e "... (IMPOSTO COM EXIGIBILIDADE" noutra.
// Quem chama usa isto para decidir se vale emendar a linha seguinte antes de
// aceitar um casamento parcial — sem isso, a cell truncada casa por prefixo com
// a ficha GENÉRICA (a comum do titular é prefixo da de exigibilidade suspensa)
// e a row inteira é atribuída à ficha errada.
export function ehPrefixoDeFichaPdf2026(texto) {
  const normalizado = normalizar(texto);
  // O mesmo limiar do casamento por prefixo: abaixo dele o texto é curto
  // demais para ser um título cortado, e casaria por acidente.
  if (normalizado.length < 24) return false;
  for (const item of CATALOGO_FICHAS_PDF_2026) {
    for (const padrao of item.padroes) {
      const p = normalizar(padrao);
      if (p.length > normalizado.length && p.startsWith(normalizado)) return true;
    }
  }
  return false;
}

export const CATALOGO_FICHAS_PDF_2026_POR_ID = Object.freeze(
  Object.fromEntries(CATALOGO_FICHAS_PDF_2026.map(item => [item.id, item])),
);

// Cobertura dos parâmetros de ficha declarados pelo relatório principal
// DIRPF2026.jrxml. Alguns parâmetros imprimem várias subfichas, por isso o
// valor é uma lista. O teste de integração confronta estas chaves diretamente
// com o arquivo oficial extraído do módulo de impressão da Receita.
export const FICHAS_PDF_2026_POR_PARAMETRO_JRXML = Object.freeze({
  fichaBensDireitos: ['bens-direitos'],
  fichaContribuinte: ['identificacao-contribuinte'],
  fichaConjuge: ['conjuge'],
  fichaRendimentosTributaveisPJTitular: ['rendimentos-pj-titular'],
  fichaRendimentosTributaveisPJDependente: ['rendimentos-pj-dependentes'],
  fichaRendimentosTributaveisPFTitular: ['rendimentos-pf-exterior-titular'],
  fichaRendimentosTributaveisPFDependente: ['rendimentos-pf-exterior-dependentes'],
  fichaRendimentosIsentosNaoTributaveis: ['rendimentos-isentos'],
  fichaRendimentosSujTribExclusiva: ['rendimentos-tributacao-exclusiva'],
  fichaImpostoPago: ['imposto-pago-retido'],
  fichaDependentes: ['dependentes'],
  fichaPagamentos: ['pagamentos-efetuados'],
  fichaDividasOnusReais: ['dividas-onus'],
  fichaInventariante: ['inventariante'],
  fichaDoacoesEleitorais: ['doacoes-eleitorais'],
  fichaRendaVariavelFundoInvestimentoTitular: ['fii-fiagro-titular'],
  fichaRendaVariavelFundoInvestimentoDependente: ['fii-fiagro-dependentes'],
  fichaARBrasil: [
    'rural-brasil-identificacao', 'rural-brasil-participantes', 'rural-brasil-receitas-despesas',
    'rural-brasil-apuracao', 'rural-brasil-rebanho', 'rural-brasil-bens', 'rural-brasil-dividas',
  ],
  fichaARExterior: [
    'rural-exterior-identificacao', 'rural-exterior-receitas-despesas', 'rural-exterior-apuracao',
    'rural-exterior-rebanho', 'rural-exterior-bens', 'rural-exterior-dividas',
  ],
  fichaResumo: ['resumo', 'lei-14754'],
  fichaGCAP: ['ganho-capital-imoveis', 'ganho-capital-moveis', 'ganho-capital-participacao', 'ganho-capital-moeda'],
  fichaDemaisRendTit: ['demais-rendimentos-titular'],
  fichaDemaisRendDep: ['demais-rendimentos-dependentes'],
  fichaTransportes: ['transportes'],
  fichaAlimentandos: ['alimentandos'],
  fichaRendimentosAcmTitular: ['rra-titular'],
  fichaRendimentosAcmDependente: ['rra-dependentes'],
  fichaHerdeiros: ['herdeiros'],
  fichaRendimentosAcumuladamenteTitular: ['rra-titular'],
  fichaRendimentosAcumuladamenteDependente: ['rra-dependentes'],
  fichaSaida: ['saida-definitiva'],
  fichaDoacoes: ['doacoes-efetuadas'],
  fichaDoacoesDiretamenteDeclaracao: ['doacoes-eca', 'doacoes-idoso'],
  fichaRendaVariavelTitular: ['renda-variavel-titular'],
  fichaRendaVariavelDependente: ['renda-variavel-dependentes'],
  fichaRendimentosPJComExigibilidadeTitular: ['rendimentos-exigibilidade-titular'],
  fichaRendimentosPJComExigibilidadeDependente: ['rendimentos-exigibilidade-dependentes'],
});
