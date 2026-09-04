import json
from pathlib import Path
raiz=Path(__file__).resolve().parents[3]
mapa=(raiz/'MELHORIAS-PROPOSTAS-2026-09-03.md').read_text()
inicio=mapa.index('### B4.')
fim=mapa.index('### B5.',inicio)
b4=mapa[inicio:fim]
pacote=json.loads((raiz/'package.json').read_text())
main=(raiz/'main.py').read_text()
teste=(raiz/'empacotamento.test.js').read_text()
deps={**pacote.get('dependencies',{}),**pacote.get('devDependencies',{})}
print(json.dumps({
  'marcadoresElectronB4':b4.lower().count('electron'),
  'b4Concluido':'### B4.' in b4 and 'CONCLUÍDO' in b4.splitlines()[0],
  'runtimePywebview':'webview.create_window' in main,
  'dependenciasElectron':len([k for k in deps if 'electron' in k.lower()]),
  'testeProibeElectron':'o Electron não voltou para o empacotamento' in teste,
},ensure_ascii=False,separators=(',',':')))
