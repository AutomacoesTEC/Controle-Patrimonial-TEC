import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const fonte = readFileSync(new URL('./Dashboard.jsx', import.meta.url), 'utf8');
const expressao = fonte.match(/const varPctPeriodo = ([^;]+);/)[1];
const calcular = new Function('totIni', 'variacaoPeriodo', `return ${expressao}`);
it.each([[0,100000,null],[0,-10000,null],[0,0,null],[100000,10000,10],[-100000,50000,50]])(
  'D12: base %s e variação %s resultam em %s', (base, variacao, esperado) => {
    expect(calcular({liquido:base}, variacao)).toBe(esperado);
  });
