import re
from pathlib import Path

raiz = Path(__file__).resolve().parents[3]
fontes = [
    (raiz / 'src/pages/PerfilLauncherPage.jsx').read_text(),
    (raiz / 'src/pages/ImportPage.jsx').read_text(),
]

def sem_comentarios(texto):
    texto = re.sub(r'/\*[\s\S]*?\*/', '', texto)
    return re.sub(r'^\s*//.*$', '', texto, flags=re.MULTILINE)

tela = '\n'.join(sem_comentarios(fonte) for fonte in fontes)
# Somente texto apresentado. `.f2b` minúsculo em `accept` e na comparação da
# extensão é implementação, não uma promessa escrita para a pessoa usuária.
f2b = len(re.findall(r'\.F2B', tela))
extensao_restauracao = int('Restaure aqui um perfil salvo em {EXTENSAO_BACKUP}' in tela)

print(f'mencoes_visiveis_f2b={f2b}')
print(f'extensao_na_chamada_restauracao={extensao_restauracao}')
