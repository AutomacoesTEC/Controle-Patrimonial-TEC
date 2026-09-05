import { hasWorkingData } from '../store/reducer';

// Política de proteção do conteúdo já existente no ano de destino.
export function avaliarDestinoImportacao(destino = {}) {
  const patrimoniais = ['bens', 'dividas', 'imoveisRurais', 'bensRurais', 'dividasRurais'];
  return {
    temDadosNoDestino: hasWorkingData(destino),
    origemConfiavelPorItem: patrimoniais.every(campo => (destino[campo] || []).every(item => ['importacao', 'manual', 'origem_legacy'].includes(item.origem))),
    temImportacaoAnterior: patrimoniais.some(campo => (destino[campo] || []).some(item => ['importacao', 'origem_legacy'].includes(item.origem))) || (destino.origemAnoAtual ?? destino.origem) === 'importacao',
  };
}
