const FICHAS = [
  ['rendimentos', 'Rendimentos'], ['pagamentos', 'Pagamentos'],
  ['doacoesEfetuadasOficial', 'Doações efetuadas'], ['doacoesPartidosOficial', 'Doações a partidos'],
  ['doacoesEcaIdosoOficial', 'Doações ECA/idoso'],
];
export function pendenciasRetificadora(estado = {}) {
  return FICHAS.flatMap(([campo, ficha]) => (estado[campo] || []).flatMap(item =>
    (item.ajustesLocaisRetificadora || []).map(ajuste => ({ ...ajuste, ficha,
      registro: item.nome_fonte || item.nome_beneficiario || item.discriminacao || String(item.id),
    }))));
}
