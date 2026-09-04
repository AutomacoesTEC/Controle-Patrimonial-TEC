import json
from pathlib import Path
import re


raiz = Path(__file__).resolve().parents[3]
arquivos = [raiz / 'src/pages/PerfilLauncherPage.jsx', raiz / 'src/store/backupPerfil.js']
padrao = re.compile(r'\b(?:localStorage|storage)\.(?:setItem|removeItem)\(')
contagens = {str(path.relative_to(raiz)): len(padrao.findall(path.read_text())) for path in arquivos}
print(json.dumps({'diretas': contagens, 'total': sum(contagens.values())}, sort_keys=True, separators=(',', ':')))
