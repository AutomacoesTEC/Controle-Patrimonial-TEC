// Salvar um arquivo no computador da usuária usando SÓ API de navegador
// (Blob + URL de objeto + âncora com `download`). É o mesmo caminho que a
// exportação da fonte de auditoria (ImportPage.jsx) e o `.xlsx` do SheetJS já
// usam em produção, e funciona tanto no navegador quanto no app empacotado,
// que é um WebView2/Edge dirigido por pywebview (ver build-windows.ps1 e
// main.py). O download MANUAL permanece neste caminho comum. A ponte Python
// adicionada para backup automático é deliberadamente restrita à pasta de
// backups e não substitui o seletor/download das exportações feitas à mão.
export function baixarTexto({ nome, texto, tipo = 'text/plain;charset=utf-8' }) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  // Revogar na volta do event loop, não na mesma linha: o download de um
  // arquivo grande (o estado de um perfil passa de 170 KB e ainda carrega o
  // documentoFonte) pode não ter terminado de ler o Blob quando o clique
  // retorna, e revogar cedo demais entrega arquivo truncado.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
