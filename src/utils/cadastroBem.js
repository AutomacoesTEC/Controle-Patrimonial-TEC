export function prepararBemParaSalvar(form, liveBem = null) {
  return {
    ...form,
    situacao_anterior: liveBem ? liveBem.situacao_anterior : 0,
    situacao_atual: liveBem ? liveBem.situacao_atual : (parseFloat(form.situacao_atual) || 0),
    movimentacoes: liveBem ? liveBem.movimentacoes : undefined,
  };
}
