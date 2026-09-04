import os
import tempfile
import unittest

from desktop_api import DesktopApi


class DesktopApiTest(unittest.TestCase):
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
