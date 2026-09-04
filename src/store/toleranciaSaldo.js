export const TOLERANCIA_SALDO_PADRAO = Object.freeze({ tipo: 'fixa', valor: 0 });

export function normalizarToleranciaSaldo(configuracao) {
  const tipo = configuracao?.tipo === 'percentual' ? 'percentual' : 'fixa';
  const numero = Number(configuracao?.valor);
  const valorNaoNegativo = Number.isFinite(numero) ? Math.max(0, numero) : 0;
  return {
    tipo,
    valor: tipo === 'percentual' ? Math.min(100, valorNaoNegativo) : valorNaoNegativo,
  };
}

export function avaliarSaldoComTolerancia(saldo, configuracao, patrimonioLiquido = 0) {
  const normalizada = normalizarToleranciaSaldo(configuracao);
  const base = Math.abs(Number(patrimonioLiquido) || 0);
  const limiteBruto = normalizada.tipo === 'percentual'
    ? base * normalizada.valor / 100
    : normalizada.valor;
  const limite = Math.round(limiteBruto * 100) / 100;
  const saldoAbsoluto = Math.abs(Math.round((Number(saldo) || 0) * 100) / 100);
  return { fecha: saldoAbsoluto <= limite, limite, configuracao: normalizada };
}
