import webview
import os
import sys

def get_base_path():
    if hasattr(sys, '_MEIPASS'):
        return sys._MEIPASS
    return os.path.abspath(".")

def get_storage_path():
    # Perfil de navegação persistente fora do diretório do PyInstaller
    # (_MEIPASS é uma pasta temporária apagada a cada execução), para que
    # o localStorage do app sobreviva entre uma abertura e outra.
    base = os.environ.get('LOCALAPPDATA') or os.path.expanduser('~')
    path = os.path.join(base, 'ControlePatrimonialIRPF')
    os.makedirs(path, exist_ok=True)
    return path

if __name__ == '__main__':
    dist_path = os.path.join(get_base_path(), 'dist', 'index.html')
    webview.create_window('CP-TEC | Controle de Variação Patrimonial', dist_path, width=1280, height=800)
    # http_server=True: serve o dist/ via HTTP local em vez de file://, exigido
    # pelos ES modules (script type="module") e pelo fetch() do sql.js/pdf.js.
    # private_mode=False + storage_path: preserva o localStorage entre execuções
    # (o padrão do pywebview é private_mode=True, que descarta tudo ao fechar).
    webview.start(http_server=True, private_mode=False, storage_path=get_storage_path())
