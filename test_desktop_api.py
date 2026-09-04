import os
import tempfile
import unittest

from desktop_api import DesktopApi


class DesktopApiTest(unittest.TestCase):
    def test_seletor_backup_abre_em_downloads_do_usuario(self):
        class JanelaFalsa:
            def __init__(self, retorno):
                self.retorno = retorno
                self.chamada = None

            def create_file_dialog(self, dialog_type, **opcoes):
                self.chamada = (dialog_type, opcoes)
                return self.retorno

        with tempfile.TemporaryDirectory() as pasta:
            usuario = os.path.join(pasta, 'usuario')
            downloads = os.path.join(usuario, 'Downloads')
            os.makedirs(downloads)
            caminho = os.path.join(downloads, 'perfil.cptec.json')
            with open(caminho, 'w', encoding='utf-8') as arquivo:
                arquivo.write('{"formato":"cptec-backup"}')
            janela = JanelaFalsa((caminho,))
            api = DesktopApi(os.path.join(pasta, 'dados'), user_path=usuario)
            api.vincular_janela(janela)

            self.assertEqual(
                {'nomeArquivo': 'perfil.cptec.json', 'conteudo': '{"formato":"cptec-backup"}'},
                api.selecionar_backup(),
            )
            self.assertEqual(10, janela.chamada[0])
            self.assertEqual(downloads, janela.chamada[1]['directory'])
            self.assertFalse(janela.chamada[1]['allow_multiple'])

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
