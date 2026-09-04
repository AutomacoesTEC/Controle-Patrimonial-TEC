from pathlib import Path

raiz = Path(__file__).resolve().parents[3]
setup = (raiz / 'setup-simplificado.iss').read_text()

presente = 'UsePreviousAppDir=no' in setup
print(f'nao_reutiliza_diretorio_anterior={int(presente)}')
print(f'total={int(presente)}/1')
