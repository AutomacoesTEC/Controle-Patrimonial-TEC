from pathlib import Path

raiz = Path(__file__).resolve().parents[3]
api = (raiz / 'desktop_api.py').read_text()
main = (raiz / 'main.py').read_text()
frontend = (raiz / 'src/pages/PerfilLauncherPage.jsx').read_text()

sinais = {
    'api_seletor_nativo': 'selecionar_backup' in api,
    'janela_vinculada': 'vincular_janela' in main,
    'downloads_do_usuario': "'Downloads'" in api and 'user_path' in api,
    'fallback_navegador': 'backupFileRef.current?.click()' in frontend and 'selecionarBackupDesktop' in frontend,
}
for nome, presente in sinais.items():
    print(f'{nome}={int(presente)}')
print(f'total={sum(sinais.values())}/{len(sinais)}')
