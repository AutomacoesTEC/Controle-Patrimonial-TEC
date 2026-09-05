import { it, expect } from 'vitest';
import { demonstrativoPeriodo } from './consultaPeriodo';
import { initialState } from './reducer';
const calcular = (consolidacao, extras = {}) => demonstrativoPeriodo({
  ...structuredClone(initialState), anoCalendario:2026,
  rendaVariavelMensalManual:[{mes:6,titular:true,origem:'manual',comuns:{resultadoLiquidoMes:10000},consolidacao,...extras}],
},'2026-01-01','2026-12-31');
it('RV: imposto devido não é desembolso',()=>expect(calcular({totalImpostoDevido:1500}).saldoDeCaixa).toBe(10000));
it('RV: retenção do mês e DARF confirmado reduzem recursos uma vez',()=>{
  expect(calcular({irFonteLei11033Mes:100,irFonteLei11033MesesAnteriores:200,impostoPago:1400},{pagamentoDarfConfirmado:true}).saldoDeCaixa).toBe(8500);
});
it('RV: valor legado automático não é confirmação de DARF pago',()=>{
  expect(calcular({impostoPago:1500}).saldoDeCaixa).toBe(10000);
});
