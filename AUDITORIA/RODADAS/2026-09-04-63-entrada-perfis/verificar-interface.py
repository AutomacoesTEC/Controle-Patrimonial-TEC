from pathlib import Path

raiz = Path(__file__).resolve().parents[3]
jsx = (raiz / 'src/pages/PerfilLauncherPage.jsx').read_text()
css = (raiz / 'src/index.css').read_text()

sinais = {
    'restauracao_estruturada': 'launcher-restore-action' in jsx and '.launcher-restore-action' in css,
    'importacao_centralizada': 'launcher-import-option' in jsx and '.launcher-import-option' in css,
    'divisor_cadastro_manual': 'launcher-choice-divider' in jsx and 'Preencher manualmente' in jsx,
    'placeholder_nome': 'placeholder="Nome completo do titular"' in jsx,
}

for nome, presente in sinais.items():
    print(f'{nome}={int(presente)}')
print(f'total={sum(sinais.values())}/{len(sinais)}')
