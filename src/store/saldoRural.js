export function saldoRuralInformado(dados = {}) {
  const oficial = dados.apuracaoResultadoRuralOficial?.saldoPrejuizoExercicioSeguinte;
  if (oficial != null && !dados.prejuizoRuralAjustadoManualmente) return -Math.abs(Number(oficial) || 0);
  return Math.min(0, Number(dados.prejuizoRuralAcompensar) || 0);
}
