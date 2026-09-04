import json
from pathlib import Path


raiz = Path(__file__).resolve().parents[3]
main_py = (raiz / 'main.py').read_text()
main_js = (raiz / 'src/main.jsx').read_text()
bootstrap = raiz / 'src/store/bootstrapDesktop.js'
sinais = {
    'janelaMarcada': '#desktop' in main_py,
    'bootstrapAntesDoRender': 'iniciarQuandoPersistenciaPronta' in main_js,
    'carregaDisco': bootstrap.exists() and 'carregar_cache' in bootstrap.read_text(),
}
print(json.dumps({'sinais': sinais, 'total': sum(sinais.values())}, sort_keys=True, separators=(',', ':')))
