import { it, expect } from 'vitest';
import { ganhosApuradosPeriodo, rendaVariavelDoPeriodo } from './demonstrativos';
const de = '2026-01-01', ate = '2026-12-31';
it('RV: resumo do ganho não absorve perda de outro mês', () => {
  const meses = [10000, -4000].map((v,i) => ({mes:i+1,titular:true,comuns:{resultadoLiquidoMes:v}}));
  expect(rendaVariavelDoPeriodo(meses,2026,de,ate,[{tipo:'exclusivo_05',data:'2026-01-31',valor:10000,beneficiario:'Titular'}]).ajusteFinanceiro).toBe(-4000);
});
it('GCAP: resumo do ganho não absorve perda de outra venda', () => {
  const apuracaoGanhoCapital = [10000,-4000].map((v,i)=>({id:i,bem:`Bem ${i}`,dataAlienacao:'2026-02-01',custoAquisicao:20000,valorAlienacao:20000+v}));
  expect(ganhosApuradosPeriodo({apuracaoGanhoCapital,rendimentos:[{tipo:'exclusivo_02',data:'2026-02-01',valor:10000}]},de,ate).total).toBe(-4000);
});
it('GCAP: rendimento do dependente não elimina ganho do titular', () => {
  const bens=[{id:1,beneficiario:'Titular',movimentacoes:[{tipo:'venda_total',data:'2026-02-01',valor:10000,valorVenda:20000}]}];
  expect(ganhosApuradosPeriodo({bens,rendimentos:[{tipo:'exclusivo_02',data:'2026-02-01',valor:10000,beneficiario:'Dependente',cpfDependente:'123'}]},de,ate).total).toBe(10000);
});
