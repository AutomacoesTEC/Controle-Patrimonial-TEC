import json
import os
from pathlib import Path
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from desktop_api import DesktopApi


OPERACOES = ('salvar_perfil', 'salvar_indice_perfis', 'carregar_cache', 'excluir_perfil')


with tempfile.TemporaryDirectory() as pasta:
    api = DesktopApi(pasta)
    capacidades = {nome: callable(getattr(api, nome, None)) for nome in OPERACOES}
    resultado = {'capacidades': capacidades, 'total': sum(capacidades.values())}

    if all(capacidades.values()):
        api.salvar_indice_perfis('[{"id":"perfil-1"},{"id":"perfil-2"}]')
        api.salvar_perfil('perfil-1', '{"nome":"João","valor":1}')
        api.salvar_perfil('perfil-1', '{"nome":"João","valor":2}')
        api.salvar_perfil('perfil-2', '{"nome":"Maria"}')
        antes_excluir = api.carregar_cache()
        api.excluir_perfil('perfil-2')
        depois_excluir = api.carregar_cache()
        try:
            api.salvar_perfil('../escape', '{}')
            travessia_rejeitada = False
        except ValueError:
            travessia_rejeitada = True
        resultado.update({
            'antesExcluir': antes_excluir,
            'depoisExcluir': depois_excluir,
            'travessiaRejeitada': travessia_rejeitada,
            'temporarios': sorted(
                nome for nome in os.listdir(api.perfis_path) if nome.endswith('.tmp')
            ),
            'escapeExiste': os.path.exists(os.path.join(pasta, 'escape.json')),
        })

print(json.dumps(resultado, ensure_ascii=False, sort_keys=True, separators=(',', ':')))
