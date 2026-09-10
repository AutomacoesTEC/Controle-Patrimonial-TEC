import os
import tempfile
import unittest

from desktop_api import DesktopApi


class DesktopApiTest(unittest.TestCase):
    def test_backup_no_limite_utf8_pode_ser_reaberto(self):
        with tempfile.TemporaryDirectory() as pasta:
            api = DesktopApi(pasta)
            api.MAX_BACKUP_BYTES = 32
            conteudo = '"' + 'á' * 15 + '"'
            self.assertEqual(32, len(conteudo.encode('utf-8')))
            resultado = api.salvar_backup_automatico('limite', conteudo)
            caminho = os.path.join(api.backup_path, resultado['nome'])

            class JanelaFalsa:
                def create_file_dialog(self, *args, **kwargs):
                    return (caminho,)

            api.vincular_janela(JanelaFalsa())
            self.assertEqual(conteudo, api.selecionar_backup()['conteudo'])

    def test_backup_excedente_preserva_copias_e_retencao(self):
        for conteudo in ('"' + 'a' * 31 + '"', '"' + 'á' * 15 + 'a"'):
            for nome in ('existente', 'novo'):
                with self.subTest(conteudo=conteudo, nome=nome):
                    with tempfile.TemporaryDirectory() as pasta:
                        api = DesktopApi(pasta, max_backups=1)
                        api.MAX_BACKUP_BYTES = 32
                        self.assertEqual(33, len(conteudo.encode('utf-8')))
                        api.salvar_backup_automatico('existente', '{"valor":1}')
                        with self.assertRaisesRegex(ValueError, 'grande demais'):
                            api.salvar_backup_automatico(nome, conteudo)
                        self.assertEqual(['existente.cptec.json'], os.listdir(api.backup_path))
                        with open(os.path.join(api.backup_path, 'existente.cptec.json'),
                                  encoding='utf-8') as arquivo:
                            self.assertEqual('{"valor":1}', arquivo.read())

    def test_backup_excedente_nao_cria_diretorio(self):
        with tempfile.TemporaryDirectory() as pasta:
            api = DesktopApi(pasta)
            api.MAX_BACKUP_BYTES = 32
            with self.assertRaisesRegex(ValueError, 'grande demais'):
                api.salvar_backup_automatico('novo', 'a' * 33)
            self.assertFalse(os.path.exists(api.backup_path))

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
            # DesktopApi normaliza `user_path` com os.path.realpath (segurança do
            # confinamento). Em máquina Windows cujo %TEMP% carrega o nome curto
            # 8.3 do usuário (ex.: TECTR_~1), realpath expande para o nome longo,
            # então a expectativa tem que passar pela mesma normalização.
            downloads = os.path.realpath(downloads)
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
