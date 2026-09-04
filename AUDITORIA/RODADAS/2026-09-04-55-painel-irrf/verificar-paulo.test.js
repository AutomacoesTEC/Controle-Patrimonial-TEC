import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDBK } from '../../../src/pages/importParsers';
import { montarPainelIrrf } from '../../../src/store/painelIrrf';

const raiz = fileURLToPath(new URL('../../../', import.meta.url));
const arquivo = resolve(raiz, '..', '15533646604-IRPF-A-2026-2025-ORIGI.DBK');

describe.skipIf(!existsSync(arquivo))('fixture externo: painel IRRF de PAULO ROBERTO', () => {
  it('fecha o detalhe contra o total oficial do resumo', async () => {
    const dados = await parseDBK(readFileSync(arquivo, 'latin1'));
    const painel = montarPainelIrrf(dados);
    console.log(JSON.stringify({
      linhas: painel.linhas.length,
      totalPainel: painel.totalPainel,
      totalResumo: painel.totalResumo,
      diferenca: painel.diferenca,
      confere: painel.confere,
    }));
    expect(painel.confere).toBe(true);
    expect(painel.diferenca).toBe(0);
  });
});
