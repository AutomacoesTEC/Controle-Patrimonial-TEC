import { anoDaDataCadastro } from './dataCadastro';

// Doação efetuada no ano é diferente da destinação feita na DAA.
// Na edição de uma DAA importada, conserva-se o ano-base do documento.
export function anoFiscalDoacao({ data, diretamenteNaDeclaracao, editando, anoAtivo }) {
  const anoPagamento = anoDaDataCadastro(data);
  if (!diretamenteNaDeclaracao) return anoPagamento;
  if (editando) return anoAtivo;
  return anoPagamento ? anoPagamento - 1 : null;
}
