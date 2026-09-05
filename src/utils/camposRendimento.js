// Nomes compatíveis com os parsers do IRPF, para não criar um segundo modelo
// de dados para o mesmo campo só porque o lançamento foi feito manualmente.
const previdencia = ['contribuicaoPrevidenciaria', 'Contribuição previdenciária oficial'];
export function camposRendimento(tipo) {
  if (tipo === 'tributavel_pj') return [previdencia,
    ['decimoTerceiro', '13º salário líquido'], ['irrfDecimoTerceiro', 'IRRF sobre o 13º salário']];
  if (tipo === 'tributavel_pf_exterior') return [previdencia,
    ['pensaoAlimenticia', 'Pensão alimentícia'], ['livroCaixa', 'Despesas de livro-caixa']];
  if (tipo === 'tributavel_rra') return [
    ['rendimentoBruto', 'Rendimento bruto recebido'], previdencia,
    ['pensaoAlimenticia', 'Pensão alimentícia'], ['parcelaIsenta65Anos', 'Parcela isenta de 65 anos'],
    ['juros', 'Juros do RRA'], ['numeroMeses', 'Número de meses', 'numero']];
  return [];
}
export function rendimentoSemFonteObrigatoria(tipo) {
  return /^isento_0[5-8]$/.test(tipo || '');
}
export const COLUNAS_COMPLEMENTARES_RENDIMENTO = [...new Map(
  ['tributavel_pj', 'tributavel_pf_exterior', 'tributavel_rra'].flatMap(camposRendimento).map(c => [c[0], c]),
).values()];
