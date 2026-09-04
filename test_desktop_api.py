import os
import tempfile
import unittest

from desktop_api import DesktopApi


class DesktopApiTest(unittest.TestCase):
    def test_persiste_carrega_e_exclui_perfis_com_confinamento(self):
        with tempfile.TemporaryDirectory() as pasta:
            api = DesktopApi(pasta)
            api.salvar_indice_perfis('[{"id":"perfil-1"}]')
            api.salvar_perfil('perfil-1', '{"nome":"João","valor":1}')
            api.salvar_perfil('perfil-1', '{"nome":"João","valor":2}')

            self.assertEqual(
                {
                    'indice': '[{"id":"perfil-1"}]',
                    'perfis': {'perfil-1': '{"nome":"João","valor":2}'},
                },
                api.carregar_cache(),
            )
            self.assertFalse(any(nome.endswith('.tmp') for nome in os.listdir(api.perfis_path)))
            with self.assertRaises(ValueError):
                api.salvar_perfil('../escape', '{}')
            self.assertFalse(os.path.exists(os.path.join(pasta, 'escape.json')))

            self.assertEqual(
                {'excluido': True, 'perfilId': 'perfil-1'},
                api.excluir_perfil('perfil-1'),
            )
            self.assertEqual({'indice': '[{"id":"perfil-1"}]', 'perfis': {}}, api.carregar_cache())

    def test_confina_escrita_atomica_e_limita_retencao(self):
        with tempfile.TemporaryDirectory() as pasta:
            api = DesktopApi(pasta, max_backups=30)
            for indice in range(32):
                resultado = api.salvar_backup_automatico(
                    f'../../perfil-{indice:02d}.cptec.json',
                    f'{{"indice":{indice}}}',
                )

            arquivos = os.listdir(api.backup_path)
            self.assertEqual(30, len(arquivos))
            self.assertTrue(all(nome.endswith('.cptec.json') for nome in arquivos))
            self.assertFalse(any(nome.endswith('.tmp') for nome in arquivos))
            self.assertNotIn('..', resultado['nome'])
            with open(os.path.join(api.backup_path, resultado['nome']), encoding='utf-8') as arquivo:
                self.assertEqual('{"indice":31}', arquivo.read())


if __name__ == '__main__':
    unittest.main()
