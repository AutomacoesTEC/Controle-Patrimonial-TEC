import arquivoLayouts from './layoutArquivosIrpf2026.js';

const LAYOUT_POR_FORMATO = {
  dbk: 'ARQ_IRPF',
  dec: 'ARQ_IRPF',
  f2b: 'ARQ_IRPFANOANTERIOR',
  rec: 'ARQ_COMPLRECIBO',
};

function registrosDoFormato(formato) {
  const nome = LAYOUT_POR_FORMATO[String(formato || '').toLowerCase()];
  if (!nome) throw new Error(`Formato eletrônico não suportado: ${formato}`);
  return arquivoLayouts.layouts[nome];
}

function tipoDaLinha(linha) {
  if (/^\s{4}IRPF/.test(linha)) return 'IR';
  return linha.slice(0, 2).trim().toUpperCase();
}

function decimalExato(original, formato) {
  const limpo = original.trim();
  if (!limpo) return null;
  const decimais = Number(formato.match(/\.(\d+)$/)?.[1] || 0);
  const sinal = limpo.startsWith('-') ? '-' : '';
  const digitos = limpo.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '') || '0';
  if (!decimais) return `${sinal}${digitos}`;
  const preenchido = digitos.padStart(decimais + 1, '0');
  return `${sinal}${preenchido.slice(0, -decimais)}.${preenchido.slice(-decimais)}`;
}

export function converterCampoDbk(original, formato) {
  if (formato.startsWith('N')) return decimalExato(original, formato);
  return original.trimEnd();
}

function estruturarLinha(linha, numeroLinha, registro, formato) {
  const campos = {};
  for (const campo of registro.campos) {
    const inicio = campo.posicao - 1;
    const fim = inicio + campo.tamanho;
    const original = linha.slice(inicio, fim);
    campos[campo.nome] = {
      valorOriginal: original,
      valorConvertido: converterCampoDbk(original, campo.formato),
      formato: campo.formato,
      origem: {
        formato: formato.toUpperCase(),
        linha: numeroLinha,
        tipoRegistro: registro.tipo,
        posicaoInicial: campo.posicao,
        posicaoFinal: fim,
      },
    };
  }
  return {
    tipo: registro.tipo,
    linha: numeroLinha,
    larguraOriginal: linha.length,
    valorOriginal: linha,
    campos,
  };
}

export function estruturarRegistrosDbk(texto, formato = 'dbk') {
  if (typeof texto !== 'string') throw new TypeError('Conteúdo DBK deve ser texto');
  const formatoNormalizado = String(formato).toLowerCase();
  const layoutRegistros = registrosDoFormato(formatoNormalizado);
  const porTipo = new Map(layoutRegistros.map((registro) => [registro.tipo, registro]));
  const registros = [];
  const problemas = [];
  const contagens = {};
  const linhas = texto.split(/\r?\n/);

  linhas.forEach((linha, indice) => {
    if (linha.length === 0) return;
    const numeroLinha = indice + 1;
    const tipo = tipoDaLinha(linha);
    const contrato = porTipo.get(tipo);
    contagens[tipo] = (contagens[tipo] || 0) + 1;
    if (!contrato) {
      problemas.push({ codigo: 'tipo_desconhecido', linha: numeroLinha, tipo, largura: linha.length });
      return;
    }
    if (linha.length !== contrato.largura) {
      problemas.push({
        codigo: 'largura_invalida',
        linha: numeroLinha,
        tipo,
        larguraEncontrada: linha.length,
        larguraEsperada: contrato.largura,
      });
    }
    registros.push(estruturarLinha(linha, numeroLinha, contrato, formatoNormalizado));
  });

  const trailers = registros.filter((registro) => registro.tipo === 'T9');
  if (trailers.length !== 1) {
    problemas.push({ codigo: trailers.length ? 'multiplos_trailers_t9' : 'trailer_t9_ausente', quantidade: trailers.length });
  } else {
    const trailer = trailers[0];
    for (const [nome, campo] of Object.entries(trailer.campos)) {
      const tipoContado = nome.match(/^QT_R(.+)$/)?.[1];
      if (!tipoContado) continue;
      const esperado = Number(campo.valorConvertido || 0);
      const encontrado = contagens[tipoContado] || 0;
      if (esperado !== encontrado) {
        problemas.push({ codigo: 'contagem_t9_divergente', tipo: tipoContado, esperado, encontrado });
      }
    }
    const totalEsperado = Number(trailer.campos.QT_TOTAL?.valorConvertido || 0);
    // QT_TOTAL contabiliza os registros anteriores ao próprio trailer.
    const totalEncontrado = Object.entries(contagens)
      .filter(([tipo]) => tipo !== 'T9')
      .reduce((soma, [, quantidade]) => soma + quantidade, 0);
    if (totalEsperado !== totalEncontrado) {
      problemas.push({ codigo: 'total_t9_divergente', esperado: totalEsperado, encontrado: totalEncontrado });
    }
  }

  return {
    formato: formatoNormalizado,
    versaoLayout: arquivoLayouts.versao,
    registros,
    contagens,
    problemas,
    integro: problemas.length === 0,
  };
}

export function obterLayoutDbk(tipo, formato = 'dbk') {
  return registrosDoFormato(formato).find(
    (registro) => registro.tipo === String(tipo || '').toUpperCase(),
  ) || null;
}

export class ErroIntegridadeArquivoIrpf extends Error {
  constructor(resultado) {
    const resumo = resultado.problemas.slice(0, 3).map((problema) => {
      if (problema.codigo === 'largura_invalida') {
        return `linha ${problema.linha}, registro ${problema.tipo}: largura ${problema.larguraEncontrada}, esperada ${problema.larguraEsperada}`;
      }
      if (problema.codigo === 'tipo_desconhecido') {
        return `linha ${problema.linha}: tipo ${problema.tipo || '(vazio)'} desconhecido`;
      }
      if (problema.codigo === 'contagem_t9_divergente') {
        return `registro ${problema.tipo}: T9 informa ${problema.esperado}, arquivo contém ${problema.encontrado}`;
      }
      if (problema.codigo === 'total_t9_divergente') {
        return `T9 informa ${problema.esperado} registros, arquivo contém ${problema.encontrado}`;
      }
      return problema.codigo;
    }).join('; ');
    super(`Arquivo eletrônico recusado por falha de integridade: ${resumo}`);
    this.name = 'ErroIntegridadeArquivoIrpf';
    this.problemas = resultado.problemas;
    this.resultado = resultado;
  }
}

export function validarIntegridadeArquivoIrpf(texto, formato = 'dbk') {
  const resultado = estruturarRegistrosDbk(texto, formato);
  if (!resultado.integro) throw new ErroIntegridadeArquivoIrpf(resultado);
  return resultado;
}
