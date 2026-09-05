// ISO civil estrito: evita truncar anos expandidos e normalizar dias inexistentes.
export function anoCadastroValido(ano) {
  return Number.isInteger(ano) && ano >= 1 && ano <= 9999;
}

export function anoDaDataCadastro(data) {
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const [ano, mes, dia] = data.split('-').map(Number);
  if (!anoCadastroValido(ano) || mes < 1 || mes > 12 || dia < 1) return null;
  const bissexto = ano % 4 === 0 && (ano % 100 !== 0 || ano % 400 === 0);
  const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return dia <= dias[mes - 1] ? ano : null;
}
