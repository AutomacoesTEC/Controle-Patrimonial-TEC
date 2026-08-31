/**
 * Catálogo central do layout eletrônico DIRPF 2026.
 *
 * A estrutura física vem de LAYOUT-DBK-OFICIAL.md, extraído do
 * LayoutDadosDIRPF2026.xml do PGD. A situação atual não significa cobertura
 * integral: qualquer registro já lido pelo parser permanece "parcial" até
 * concluir o gate de auditoria da ficha correspondente.
 */

export const MODULOS_IRPF = Object.freeze({
  PESSOAS: 'Pessoas',
  RENDIMENTOS: 'Rendimentos',
  PAGAMENTOS_DOACOES: 'Pagamentos e Doações',
  PATRIMONIO: 'Patrimônio',
  ATIVIDADE_RURAL: 'Atividade Rural',
  GANHOS_MERCADOS: 'Ganhos e Mercados',
  DECLARACOES_ESPECIAIS: 'Declarações Especiais',
  ENTREGA_AUDITORIA: 'Entrega/Auditoria',
});

export const SITUACOES_REGISTRO = Object.freeze({
  PARCIAL: 'parcial',
  PRESERVADO_SEM_MODELAGEM: 'preservado_sem_modelagem',
  NAO_IMPLEMENTADO: 'nao_implementado',
});

export const SEPARADORES_CHAVE_ESTAVEL = Object.freeze(['+']);

const M = MODULOS_IRPF;

// Tipos declarados pelo parser atual como tratados. "Tratado" não equivale a
// ficha completa, por isso todos entram no catálogo como cobertura parcial.
const TIPOS_PARCIAIS = new Set([
  'IR', '16', '18', '20', '21', '22', '23', '24', '25', '26', '27', '28',
  '32', '34', '37', '40', '41', '42', '43', '45', '47', '50', '51', '52',
  '53', '54', '55', '57', '60', '61', '62', '63', '65', '66', '67', '68',
  '69', '70', '71', '72', '73', '74', '75', '76', '80', '81', '83', '84',
  '85', '86', '87', '88', '89', '90', '91', '92',
]);

// Tipos conscientemente reconhecidos, mas não convertidos em estrutura pelo
// parser atual. Eles não podem ser confundidos com ficha vazia.
const TIPOS_PRESERVADOS_SEM_MODELAGEM = new Set(['19', '33', '46', '48', 'T9']);

const EFEITO = Object.freeze({
  INFORMATIVO: 'informativo',
  ENTRADA: 'entrada_caixa',
  SAIDA: 'saida_caixa',
  ESTOQUE: 'estoque_patrimonial',
  RESULTADO: 'resultado_fiscal',
  CONTROLE: 'controle_administrativo',
});

const RETIFICACAO = Object.freeze({
  TOTALIZADOR: 'substituir_totalizador_oficial_preservando_ajustes',
  CHAVE: 'conciliar_por_chave_estavel_preservando_ajustes',
  DECLARACAO: 'substituir_bloco_oficial_preservando_ajustes',
  EVIDENCIA: 'preservar_como_evidencia_sem_efeito_fiscal',
});

// Evidências mínimas para decisões de chave e cardinalidade com maior risco
// de colisão ou duplicação. Os nomes abaixo são campos do layout oficial.
const AUDITORIA_CONTRATOS_CRITICOS = Object.freeze({
  '16': Object.freeze({
    justificativaCardinalidade: 'O registro identifica o contribuinte e ocorre uma vez por declaração.',
  }),
  '22': Object.freeze({
    justificativaChave: 'O mesmo beneficiário pode ter valores distintos em cada mês.',
    camposDiscriminadores: Object.freeze(['E_DEPENDENTE', 'NR_CPF_DEPEN', 'NR_MES']),
  }),
  '27': Object.freeze({
    justificativaChave: 'NR_CHAVE_BEM é o identificador oficial usado pelos registros vinculados ao bem.',
    camposDiscriminadores: Object.freeze(['NR_CHAVE_BEM']),
  }),
  '42': Object.freeze({
    justificativaChave: 'A consolidação mensal precisa separar titular e cada dependente.',
    camposDiscriminadores: Object.freeze(['NR_CPF', 'NR_MES', 'NR_CPF_DEPEN']),
  }),
  '49': Object.freeze({
    justificativaChave: 'Dois pagamentos no mesmo mês podem ter o mesmo dependente e beneficiário, mas titulares do pagamento diferentes.',
    camposDiscriminadores: Object.freeze([
      'NR_CPF_DEPENDENTE', 'NR_MES', 'NR_CPF_TITULAR_PAGAMENTO', 'NR_CPF_BENEFIC',
    ]),
    fixtureColisaoEvitada: Object.freeze([
      Object.freeze({
        NR_CPF_DEPENDENTE: '11111111111',
        NR_MES: '01',
        NR_CPF_TITULAR_PAGAMENTO: '22222222222',
        NR_CPF_BENEFIC: '33333333333',
      }),
      Object.freeze({
        NR_CPF_DEPENDENTE: '11111111111',
        NR_MES: '01',
        NR_CPF_TITULAR_PAGAMENTO: '44444444444',
        NR_CPF_BENEFIC: '33333333333',
      }),
    ]),
  }),
  '54': Object.freeze({
    justificativaChave: 'O indicador de exterior e o país impedem colisão entre bens rurais de contextos distintos.',
    camposDiscriminadores: Object.freeze(['IN_EXTERIOR', 'CD_PAIS', 'CD_BEMAR', 'TX_BEM']),
  }),
  IR: Object.freeze({
    justificativaCardinalidade: 'É o cabeçalho único que identifica declaração, exercício e ano-base.',
  }),
  T9: Object.freeze({
    justificativaCardinalidade: 'É o trailer único que encerra a declaração e informa as contagens por tipo.',
  }),
});

// [tipo, quantidade de campos, largura, ficha, módulo, cardinalidade,
//  chave estável, efeito fiscal, política de retificação]
const DEFINICOES_LAYOUT = [
  ['16', 65, 1250, 'Identificação do contribuinte', M.PESSOAS, 'um_por_declaracao', 'NR_CPF', EFEITO.INFORMATIVO, RETIFICACAO.DECLARACAO],
  ['17', 29, 361, 'Resumo de rendimentos e deduções', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['18', 60, 744, 'Resumo do cálculo do imposto', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['19', 29, 346, 'Resumo de informações complementares', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['20', 74, 926, 'Cálculo do imposto e deduções', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['21', 11, 170, 'Rendimentos tributáveis de PJ do titular', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_PAGADOR', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['22', 16, 167, 'Rendimentos de PF e exterior por mês', M.RENDIMENTOS, 'zero_ou_muitos', 'E_DEPENDENTE+NR_CPF_DEPEN+NR_MES', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['23', 5, 40, 'Rendimentos isentos agregados', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_COD_ISENTO', EFEITO.ENTRADA, RETIFICACAO.TOTALIZADOR],
  ['24', 5, 40, 'Rendimentos de tributação exclusiva agregados', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_COD_EXCLUSIVO', EFEITO.ENTRADA, RETIFICACAO.TOTALIZADOR],
  ['25', 15, 224, 'Dependentes', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['26', 16, 711, 'Pagamentos efetuados', M.PAGAMENTOS_DOACOES, 'zero_ou_muitos', 'CD_PAGTO+NR_CHAVE_DEPEND+NR_BENEF', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['27', 58, 1291, 'Bens e direitos', M.PATRIMONIO, 'zero_ou_muitos', 'NR_CHAVE_BEM', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['28', 8, 576, 'Dívidas e ônus reais', M.PATRIMONIO, 'zero_ou_muitos', 'CD_DIV+TX_DIV', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['29', 11, 113, 'Cônjuge ou companheiro', M.PESSOAS, 'zero_ou_um', 'NR_CONJ', EFEITO.INFORMATIVO, RETIFICACAO.DECLARACAO],
  ['30', 7, 164, 'Inventariante', M.PESSOAS, 'zero_ou_um', 'NR_INVENT', EFEITO.INFORMATIVO, RETIFICACAO.DECLARACAO],
  ['31', 13, 179, 'Pensão e proventos de aposentadoria ou reforma por moléstia grave ou acidente', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['32', 12, 181, 'Rendimentos tributáveis de PJ de dependente', M.RENDIMENTOS, 'zero_ou_muitos', 'CPF_BENEF+NR_PAGADOR', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['33', 9, 127, 'Lucros e dividendos por fonte pagadora', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['34', 6, 110, 'Doações a campanha eleitoral', M.PAGAMENTOS_DOACOES, 'zero_ou_muitos', 'NR_PARTIDO', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['35', 23, 331, 'Alimentandos', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['36', 7, 46, 'Proprietário ou usufrutuário de bem', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE_BEM+NR_CPF_CNPJ', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['37', 13, 103, 'Aplicações financeiras no exterior, Lei 14.754', M.PATRIMONIO, 'zero_ou_muitos', 'NR_CHAVE_BEM+NR_ORDEM', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['38', 30, 468, 'Declaração final de espólio', M.DECLARACOES_ESPECIAIS, 'zero_ou_um', 'NR_CPF', EFEITO.CONTROLE, RETIFICACAO.DECLARACAO],
  ['39', 10, 233, 'Saída definitiva do país', M.DECLARACOES_ESPECIAIS, 'zero_ou_um', 'NR_CPF', EFEITO.CONTROLE, RETIFICACAO.DECLARACAO],
  ['40', 54, 641, 'Renda variável por mês', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF+RV_MES', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['41', 13, 153, 'Renda variável, consolidação anual', M.GANHOS_MERCADOS, 'zero_ou_um', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['42', 17, 170, 'FII e Fiagro por mês', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF+NR_MES+NR_CPF_DEPEN', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['43', 10, 114, 'FII e Fiagro, consolidação anual', M.GANHOS_MERCADOS, 'zero_ou_um', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['45', 19, 216, 'RRA do titular', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_PAGADOR+CD_RRA_TITULAR', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['46', 7, 48, 'Pensão vinculada a RRA do titular', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE_ALIMENT+CD_RRA_TITULAR', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['47', 20, 227, 'RRA de dependente', M.RENDIMENTOS, 'zero_ou_muitos', 'CPF_BENEF+NR_PAGADOR+CD_RRA_DEPENDENTE', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['48', 7, 48, 'Pensão vinculada a RRA de dependente', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE_ALIMENT+CD_RRA_DEPENDENTE', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['49', 8, 71, 'Rendimentos de trabalho não assalariado de PF', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CPF_DEPENDENTE+NR_MES+NR_CPF_TITULAR_PAGAMENTO+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['50', 13, 178, 'Imóveis explorados na atividade rural', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+NR_CHAVE_AR', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['51', 7, 52, 'Receitas e despesas rurais mensais', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+NR_MES', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['52', 17, 181, 'Apuração do resultado rural', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['53', 11, 85, 'Movimentação de rebanho', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+CD_ESPEC', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['54', 10, 607, 'Bens da atividade rural', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+CD_PAIS+CD_BEMAR+TX_BEM', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['55', 8, 575, 'Dívidas da atividade rural', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+TX_DIVIDA', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['56', 9, 118, 'Receitas, despesas e resultado rural no exterior por país', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'CD_PAIS', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['57', 7, 103, 'Proprietários de imóvel rural', M.ATIVIDADE_RURAL, 'zero_ou_muitos', 'IN_EXTERIOR+NR_CHAVE_AR+NR_CPF_CNPJ_PROPRIETARIO', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['58', 6, 102, 'Herdeiros', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE_HERDEIRO', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['59', 6, 38, 'Percentual de bem por herdeiro', M.PESSOAS, 'zero_ou_muitos', 'NR_CHAVE_BEM+NR_CHAVE_HERDEIRO', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['60', 23, 299, 'Ganhos de capital, consolidação', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF_BENEFICIARIO+NR_IDENTIFICACAO', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['61', 71, 926, 'Ganho de capital sobre imóvel', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF_BENEFICIARIO+NR_IDENTIFICACAO+NR_OPERACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['62', 48, 644, 'Ganho de capital sobre bem móvel', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF_BENEFICIARIO+NR_IDENTIFICACAO+NR_OPERACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['63', 58, 876, 'Ganho de capital sobre participação societária', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF_BENEFICIARIO+NR_IDENTIFICACAO+NR_OPERACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['64', 53, 881, 'Ganho de capital, valores e reduções em moedas', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_CPF_BENEFICIARIO+NR_IDENTIFICACAO+NR_OPERACAO+IN_TIPO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['65', 9, 121, 'Adquirentes em ganho de capital', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+NR_CPFCNPJ', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['66', 13, 116, 'Edificação, ampliação ou reforma no Brasil', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+DT_DATA', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['67', 19, 190, 'Edificação, ampliação ou reforma no exterior', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+DT_DATA', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['68', 31, 335, 'Apuração de ganho de capital sobre imóvel', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+NR_TIPO_APURACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['69', 15, 151, 'Apuração de ganho de capital sobre bem móvel', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+NR_TIPO_APURACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['70', 18, 185, 'Parcelas de ganho de capital em ambas as moedas', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+DT_PARCELA', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['71', 41, 444, 'Parcelas de ganho de capital sobre imóvel', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+NR_TIPO_PARCELA+DT_PARCELA', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['72', 24, 235, 'Parcelas de ganho sobre móvel ou participação', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+IN_TIPO+DT_PARCELA', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['73', 12, 152, 'Custo de aquisição de participação societária', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+NR_ITEM', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['74', 21, 299, 'Moeda estrangeira mantida em espécie', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_ITEM', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['75', 23, 243, 'Faixas de tributação do ganho de capital', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_OPERACAO+IN_TIPO+IN_APURACAO', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['76', 13, 135, 'Moeda em espécie, totalização mensal', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'NR_IDENTIFICACAO+NR_MES', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['77', 9, 102, 'Ganho de capital em moeda estrangeira por moeda', M.GANHOS_MERCADOS, 'zero_ou_muitos', 'PAIS_MOEDA+NR_ITEM', EFEITO.RESULTADO, RETIFICACAO.CHAVE],
  ['78', 9, 101, 'Ganho de capital em moeda estrangeira, consolidado', M.GANHOS_MERCADOS, 'zero_ou_um', 'NR_CPF', EFEITO.RESULTADO, RETIFICACAO.TOTALIZADOR],
  ['80', 7, 123, 'Rendimentos com exigibilidade suspensa do titular', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_PAGADOR', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['81', 8, 134, 'Rendimentos com exigibilidade suspensa de dependente', M.RENDIMENTOS, 'zero_ou_muitos', 'CPF_BENEF+NR_PAGADOR', EFEITO.INFORMATIVO, RETIFICACAO.CHAVE],
  ['82', 9, 127, 'Transferências patrimoniais', M.PATRIMONIO, 'zero_ou_muitos', 'NR_CHAVE', EFEITO.ESTOQUE, RETIFICACAO.CHAVE],
  ['83', 7, 52, 'Rendimento isento por código e beneficiário', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['84', 11, 144, 'Rendimento isento detalhado por fonte', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD+NR_PAGADORA+NR_CHAVE_BEM', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['85', 13, 178, 'Rendimento exclusivo com retenções', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD+NR_PAGADORA', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['86', 11, 191, 'Rendimento isento com descrição e bem vinculado', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD+NR_PAGADORA+NR_CHAVE_BEM', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['87', 6, 53, 'Rendimento isento agregado de ganho de capital', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_COD', EFEITO.ENTRADA, RETIFICACAO.TOTALIZADOR],
  ['88', 10, 131, 'Rendimento exclusivo detalhado por fonte', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD+NR_PAGADORA+NR_CHAVE_BEM', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['89', 10, 186, 'Rendimento exclusivo com descrição', M.RENDIMENTOS, 'zero_ou_muitos', 'IN_TIPO+NR_CPF_BENEFIC+NR_COD+NR_PAGADORA', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['90', 9, 126, 'Doações efetuadas', M.PAGAMENTOS_DOACOES, 'zero_ou_muitos', 'CD_DOACAO+NR_BENEF', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['91', 9, 123, 'Doações aos fundos da criança e do adolescente', M.PAGAMENTOS_DOACOES, 'zero_ou_muitos', 'IN_TIPO_FUNDO+SG_UF+NOME_MUNICIPIO+NR_CNPJ_FUNDO', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['92', 9, 123, 'Doações aos fundos da pessoa idosa', M.PAGAMENTOS_DOACOES, 'zero_ou_muitos', 'IN_TIPO_FUNDO+SG_UF+NOME_MUNICIPIO+NR_CNPJ_FUNDO', EFEITO.SAIDA, RETIFICACAO.CHAVE],
  ['93', 9, 127, 'Rendimento detalhado oficial, registro 93', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['94', 9, 127, 'Rendimento detalhado oficial, registro 94', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['95', 9, 127, 'Rendimento detalhado oficial, registro 95', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['96', 9, 127, 'Rendimento detalhado oficial, registro 96', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['97', 11, 188, 'Rendimento detalhado com identificação de ficha', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC+IN_FICHA', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['98', 9, 127, 'Rendimento detalhado oficial, registro 98', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['99', 9, 127, 'Rendimento detalhado oficial, registro 99', M.RENDIMENTOS, 'zero_ou_muitos', 'NR_CHAVE+IN_TIPO+NR_PAGADORA+NR_CPF_BENEFIC', EFEITO.ENTRADA, RETIFICACAO.CHAVE],
  ['DR', 36, 496, 'Dados para impressão e recibo', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_CPF', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['FR', 14, 256, 'Informações de entrega', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_CPF+DT_ENTREGA+HR_ENTREGA', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['HC', 4, 26, 'Controle de hash por CPF ou CNPJ', M.ENTREGA_AUDITORIA, 'zero_ou_muitos', 'NR_CPFCNPJ', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['HR', 4, 26, 'Controle de hash por CPF', M.ENTREGA_AUDITORIA, 'zero_ou_muitos', 'NR_CPF', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['IR', 160, 1244, 'Cabeçalho da declaração', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF+EXERCICIO+ANO_BASE', EFEITO.CONTROLE, RETIFICACAO.DECLARACAO],
  ['MC', 3, 252, 'Mensagens de controle', M.ENTREGA_AUDITORIA, 'zero_ou_muitos', 'NR_CONTROLE', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['NC', 16, 262, 'Notificação e ação fiscal', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_DISTRIBUICAO+DT_VENCIMENTO', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['R9', 5, 36, 'Controle de integridade R9', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_CPF+NR_HASH', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['RC', 21, 131, 'Recibo e remessa', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_CPFCNPJ+ANOREC+MESREC+DIAREC+NR_REMESSA', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['T9', 85, 444, 'Trailer e contagens por tipo', M.ENTREGA_AUDITORIA, 'um_por_declaracao', 'NR_CPF', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['TC', 5, 58, 'Assinatura e controle TC', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'NR_CPFCNPJ+SIGNET', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
  ['VC', 22, 206, 'Validações, pendências e DARF', M.ENTREGA_AUDITORIA, 'zero_ou_um', 'DATA_MENSAGEM', EFEITO.CONTROLE, RETIFICACAO.EVIDENCIA],
];

function situacaoAtual(tipo) {
  if (TIPOS_PARCIAIS.has(tipo)) return SITUACOES_REGISTRO.PARCIAL;
  if (TIPOS_PRESERVADOS_SEM_MODELAGEM.has(tipo)) {
    return SITUACOES_REGISTRO.PRESERVADO_SEM_MODELAGEM;
  }
  return SITUACOES_REGISTRO.NAO_IMPLEMENTADO;
}

function criarRegistro(definicao) {
  const [
    tipo, quantidadeCampos, largura, ficha, modulo, cardinalidade,
    chaveEstavel, efeitoFiscal, politicaRetificacao,
  ] = definicao;
  const situacao = situacaoAtual(tipo);

  return Object.freeze({
    tipo,
    ficha,
    modulo,
    formatos: Object.freeze({
      documentadosNoLayout: Object.freeze(['DBK', 'DEC', 'F2B']),
      importacaoEstruturadaAtual: Object.freeze(
        situacao === SITUACOES_REGISTRO.PARCIAL ? ['DBK'] : [],
      ),
    }),
    campos: Object.freeze({
      quantidade: quantidadeCampos,
      largura,
      posicaoInicial: 1,
      posicaoFinal: largura,
      fonte: 'LAYOUT-DBK-OFICIAL.md',
      secao: `Registro ${tipo}`,
    }),
    cardinalidade,
    chaveEstavel,
    efeitoFiscal,
    politicaRetificacao,
    exportacao: Object.freeze({
      formatosEletronicosDoLayout: Object.freeze(['DBK', 'DEC', 'F2B']),
      situacaoAtual: 'nao_auditada',
    }),
    auditoriaContrato: AUDITORIA_CONTRATOS_CRITICOS[tipo] || null,
    situacaoAtual: situacao,
  });
}

export const CATALOGO_REGISTROS_DBK = Object.freeze(DEFINICOES_LAYOUT.map(criarRegistro));

export const CATALOGO_REGISTROS_DBK_POR_TIPO = Object.freeze(
  Object.fromEntries(CATALOGO_REGISTROS_DBK.map((registro) => [registro.tipo, registro])),
);

export function obterRegistroDbk(tipo) {
  return CATALOGO_REGISTROS_DBK_POR_TIPO[String(tipo || '').toUpperCase()] || null;
}
