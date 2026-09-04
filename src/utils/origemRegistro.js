export function ehOrigemManual(item) {
  return item?.origem === 'manual';
}

export function rotuloOrigemRegistro(item) {
  if (ehOrigemManual(item)) return 'Manual';
  const formato = item?.origemDocumento?.formato;
  if (formato) return `Declaração ${String(formato).toUpperCase()}`;
  if (item?.origem === 'origem_legacy') return 'Declaração legada';
  return 'Declaração';
}

export function correspondeFiltroOrigem(item, filtro) {
  if (filtro === 'manual') return ehOrigemManual(item);
  if (filtro === 'importacao') return !ehOrigemManual(item);
  return true;
}
