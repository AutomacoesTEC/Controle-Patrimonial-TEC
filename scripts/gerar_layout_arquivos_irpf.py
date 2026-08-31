import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


entrada = Path(sys.argv[1] if len(sys.argv) > 1 else '../mapeamentoTxt.xml')
saida = Path(sys.argv[2] if len(sys.argv) > 2 else 'src/irpf/layoutArquivosIrpf2026.js')
tipos_arquivo = {'ARQ_IRPF', 'ARQ_IRPFANOANTERIOR', 'ARQ_COMPLRECIBO'}
layouts = {}

for declaracao in ET.parse(entrada).getroot().findall('DeclaracaoTXT'):
    tipo_arquivo = declaracao.get('TipoArquivo')
    if tipo_arquivo not in tipos_arquivo:
        continue
    registros = []
    for elemento_registro in declaracao.findall('Registro'):
        campos = []
        posicao = 1
        for elemento_campo in elemento_registro.findall('Campo'):
            tamanho = int(elemento_campo.get('Tamanho'))
            decimais = int(elemento_campo.get('Decimais', '0'))
            tipo = elemento_campo.get('Tipo')
            campos.append({
                'nome': elemento_campo.get('Nome'),
                'descricao': elemento_campo.get('Descricao', ''),
                'formato': f'{tipo}{tamanho}' + (f'.{decimais}' if decimais else ''),
                'tipo': tipo,
                'tamanho': tamanho,
                'decimais': decimais,
                'posicao': posicao,
            })
            posicao += tamanho
        registros.append({
            'tipo': elemento_registro.get('Identificador'),
            'nome': elemento_registro.get('Nome'),
            'descricao': elemento_registro.get('Descricao', ''),
            'colecao': elemento_registro.get('Colecao'),
            'largura': posicao - 1,
            'campos': campos,
        })
    if len({registro['tipo'] for registro in registros}) != len(registros):
        raise RuntimeError(f'Tipos duplicados em {tipo_arquivo}')
    layouts[tipo_arquivo] = registros

esperados = {'ARQ_IRPF': 86, 'ARQ_IRPFANOANTERIOR': 85, 'ARQ_COMPLRECIBO': 6}
for nome, quantidade in esperados.items():
    if len(layouts.get(nome, [])) != quantidade:
        raise RuntimeError(f'{nome}: {len(layouts.get(nome, []))} registros, esperado {quantidade}')

conteudo = {'versao': 'IRPF2026', 'layouts': layouts}
saida.write_text(
    '// Gerado por scripts/gerar_layout_arquivos_irpf.py. Não editar manualmente.\n'
    f'export default {json.dumps(conteudo, ensure_ascii=False, indent=2)};\n',
    encoding='utf-8',
)
print(', '.join(f'{nome}={len(registros)}' for nome, registros in layouts.items()))
