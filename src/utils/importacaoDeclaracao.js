// O resultado dos parsers e o payload de IMPORT_DECLARACAO são o mesmo
// contrato. Manter uma lista manual de campos aqui ou na tela já causou perda
// silenciosa de fichas novas: o parser passou a devolver Ganhos de Capital e
// FII/Fiagro, mas a tela de importação não as encaminhava ao reducer.
//
// Overrides existem só para decisões explícitas do fluxo, como limpar os
// dependentes ao substituir o titular por outra pessoa.
export function payloadImportacaoCompleto(resultado, overrides = {}) {
  if (!resultado || typeof resultado !== 'object') {
    throw new TypeError('Resultado de importação inválido');
  }
  return { ...resultado, ...overrides };
}

// A retificadora precisa levar todos os quadros oficiais da declaração nova
// até o reducer. Bens e dívidas são substituídos depois pelos resultados da
// conciliação item a item, para preservar ids e movimentações.
export function payloadRetificadoraCompleto(resultado, conciliacao) {
  return payloadImportacaoCompleto(resultado, conciliacao);
}

function bytesParaHex(bytes) {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

// O documento-fonte guarda o texto extraído para auditoria, mas o hash desse
// texto não identifica sozinho o PDF que a pessoa escolheu. Dois arquivos
// diferentes podem produzir a mesma camada de texto. Este hash é calculado
// sobre os bytes originais e só a identidade compacta do arquivo é persistida:
// o PDF bruto nunca entra no localStorage.
export async function sha256Arquivo(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new TypeError('Conteúdo do arquivo inválido para cálculo de integridade');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador não oferece o recurso criptográfico necessário para validar o arquivo');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', arrayBuffer);
  return bytesParaHex(new Uint8Array(digest));
}

export async function identificarArquivoFonte(resultado, arquivo, arrayBuffer) {
  if (!resultado?.documentoFonte) return resultado;
  if (Number(arquivo?.size || 0) > 0 && arrayBuffer.byteLength === 0) {
    throw new Error('Não foi possível preservar os bytes originais para validar a identidade deste arquivo. Selecione-o novamente.');
  }
  const sha256ArquivoOriginal = await sha256Arquivo(arrayBuffer);
  return {
    ...resultado,
    documentoFonte: {
      ...resultado.documentoFonte,
      nomeArquivo: arquivo?.name || '',
      tamanhoBytes: Number.isFinite(arquivo?.size) ? arquivo.size : arrayBuffer.byteLength,
      mimeType: arquivo?.type || '',
      ultimaModificacao: Number.isFinite(arquivo?.lastModified) ? arquivo.lastModified : null,
      sha256ArquivoOriginal,
      arquivoOriginalPersistido: false,
      revisaoManualAberta: true,
    },
  };
}

const COLECOES_RESUMO = [
  ['bens', 'Bens e direitos'],
  ['dividas', 'Dívidas e ônus reais'],
  ['rendimentos', 'Rendimentos'],
  ['pagamentos', 'Pagamentos efetuados'],
  ['dependentes', 'Dependentes'],
  ['doacoesEfetuadasOficial', 'Doações efetuadas'],
  ['doacoesPartidosOficial', 'Doações a partidos e candidatos'],
  ['doacoesEcaIdosoOficial', 'Doações ECA e pessoa idosa'],
  ['imoveisRurais', 'Imóveis rurais'],
  ['bensRurais', 'Bens rurais'],
  ['dividasRurais', 'Dívidas rurais'],
  ['rendaVariavelMensalOficial', 'Renda variável mensal'],
  ['fiiFiagroMensalOficial', 'FII e Fiagro mensal'],
  ['apuracaoGanhoCapital', 'Apuração do ganho de capital'],
  ['receitasDespesasRuraisOficial', 'Receitas e despesas rurais'],
  ['movimentacaoRebanhoOficial', 'Movimentação do rebanho'],
  ['participantesRuraisOficial', 'Participantes rurais'],
  ['demonstrativoExteriorOficial', 'Demonstrativo de bens no exterior'],
];

const QUADROS_RESUMO = [
  ['impostoDevido', 'Resumo e cálculo do imposto'],
  ['ganhosCapitalOficial', 'Demonstrativo de ganho de capital'],
  ['rendaVariavelAnualOficial', 'Fechamento anual de renda variável'],
  ['fiiFiagroAnualOficial', 'Fechamento anual de FII e Fiagro'],
  ['apuracaoResultadoRuralOficial', 'Apuração do resultado rural'],
];

function quadroTemConteudo(valor) {
  if (valor == null) return false;
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor !== 'object') return true;
  return Object.keys(valor).length > 0;
}

export function resumirImportacao(resultado) {
  const fichas = Object.entries(resultado?.estadoFichas || {})
    .map(([id, detalhe]) => ({ id, ...detalhe }))
    .sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'));
  const porEstado = fichas.reduce((acc, ficha) => {
    const estado = ficha.estado || 'erro';
    acc[estado] = (acc[estado] || 0) + 1;
    return acc;
  }, {});
  const colecoes = COLECOES_RESUMO.map(([campo, rotulo]) => ({
    campo,
    rotulo,
    quantidade: Array.isArray(resultado?.[campo]) ? resultado[campo].length : 0,
  })).filter(item => item.quantidade > 0);
  const quadros = QUADROS_RESUMO
    .filter(([campo]) => quadroTemConteudo(resultado?.[campo]))
    .map(([campo, rotulo]) => ({ campo, rotulo }));

  return {
    fichas,
    porEstado,
    colecoes,
    quadros,
    alertas: fichas.filter(f => ['parcial', 'nao_suportada', 'erro'].includes(f.estado)),
    temBloqueio: fichas.some(f => f.estado === 'erro'),
  };
}
