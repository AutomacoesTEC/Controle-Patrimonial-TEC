"""API mínima e confinada exposta pelo pywebview ao frontend."""

import os
import re
import tempfile


class DesktopApi:
    MAX_BACKUP_BYTES = 100 * 1024 * 1024

    def __init__(self, storage_path, max_backups=30, user_path=None):
        self.storage_path = os.path.realpath(storage_path)
        self.backup_path = os.path.join(self.storage_path, 'BackupsAutomaticos')
        self.perfis_path = os.path.join(self.storage_path, 'perfis')
        self.max_backups = max_backups
        self.user_path = os.path.realpath(
            user_path or os.environ.get('USERPROFILE') or os.path.expanduser('~')
        )
        self.window = None

    def vincular_janela(self, window):
        self.window = window

    def _diretorio_inicial_usuario(self):
        # O backup exportado pelo WebView normalmente vai para Downloads.
        # Calcula sempre a partir do perfil do Windows em execução: nenhum
        # caminho da máquina de desenvolvimento entra no aplicativo.
        for nome in ('Downloads', 'Documents'):
            candidato = os.path.join(self.user_path, nome)
            if os.path.isdir(candidato):
                return candidato
        return self.user_path if os.path.isdir(self.user_path) else ''

    def selecionar_backup(self):
        """Abre o diálogo nativo e devolve somente o arquivo autorizado."""
        if self.window is None:
            raise RuntimeError('A janela do aplicativo ainda não está disponível.')
        caminhos = self.window.create_file_dialog(
            10,  # webview.FileDialog.OPEN, sem importar a GUI neste módulo puro
            directory=self._diretorio_inicial_usuario(),
            allow_multiple=False,
            file_types=('Backup do CP-TEC (*.cptec.json;*.json)',),
        )
        if not caminhos:
            return None
        caminho = os.path.realpath(caminhos[0])
        nome = os.path.basename(caminho)
        if not os.path.isfile(caminho) or not nome.lower().endswith(('.cptec.json', '.json')):
            raise ValueError('Escolha um arquivo de backup do CP-TEC.')
        if os.path.getsize(caminho) > self.MAX_BACKUP_BYTES:
            raise ValueError('O arquivo escolhido é grande demais para ser um backup do CP-TEC.')
        with open(caminho, encoding='utf-8') as arquivo:
            conteudo = arquivo.read(self.MAX_BACKUP_BYTES + 1)
        if len(conteudo.encode('utf-8')) > self.MAX_BACKUP_BYTES:
            raise ValueError('O arquivo escolhido é grande demais para ser um backup do CP-TEC.')
        return {'nomeArquivo': nome, 'conteudo': conteudo}

    @staticmethod
    def _validar_perfil_id(perfil_id):
        if not isinstance(perfil_id, str) or not re.fullmatch(
            r'[A-Za-z0-9][A-Za-z0-9_-]{0,127}', perfil_id
        ):
            raise ValueError('Identificador de perfil inválido.')
        return perfil_id

    @staticmethod
    def _validar_conteudo(conteudo):
        if not isinstance(conteudo, str):
            raise ValueError('O conteúdo deve ser texto.')
        return conteudo

    @staticmethod
    def _gravar_atomico(diretorio, nome, conteudo):
        os.makedirs(diretorio, exist_ok=True)
        destino = os.path.join(diretorio, nome)
        temporario = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', encoding='utf-8', newline='\n',
                prefix='.cptec-', suffix='.tmp', dir=diretorio, delete=False,
            ) as arquivo:
                temporario = arquivo.name
                arquivo.write(conteudo)
                arquivo.flush()
                os.fsync(arquivo.fileno())
            os.replace(temporario, destino)
            temporario = None
        finally:
            if temporario and os.path.exists(temporario):
                os.unlink(temporario)

    def salvar_perfil(self, perfil_id, conteudo):
        perfil_id = self._validar_perfil_id(perfil_id)
        conteudo = self._validar_conteudo(conteudo)
        self._gravar_atomico(self.perfis_path, f'{perfil_id}.json', conteudo)
        return {'salvo': True, 'perfilId': perfil_id}

    def salvar_indice_perfis(self, conteudo):
        conteudo = self._validar_conteudo(conteudo)
        self._gravar_atomico(self.perfis_path, '_perfis.json', conteudo)
        return {'salvo': True}

    def carregar_cache(self):
        if not os.path.isdir(self.perfis_path):
            return {'indice': None, 'perfis': {}}
        indice = self._ler_arquivo_seguro('_perfis.json')
        perfis = {}
        for nome in sorted(os.listdir(self.perfis_path)):
            if not nome.endswith('.json') or nome == '_perfis.json':
                continue
            perfil_id = nome[:-5]
            try:
                self._validar_perfil_id(perfil_id)
            except ValueError:
                continue
            conteudo = self._ler_arquivo_seguro(nome)
            if conteudo is not None:
                perfis[perfil_id] = conteudo
        return {'indice': indice, 'perfis': perfis}

    def _ler_arquivo_seguro(self, nome):
        caminho = os.path.join(self.perfis_path, nome)
        if not os.path.isfile(caminho) or os.path.islink(caminho):
            return None
        with open(caminho, encoding='utf-8') as arquivo:
            return arquivo.read()

    def excluir_perfil(self, perfil_id):
        perfil_id = self._validar_perfil_id(perfil_id)
        caminho = os.path.join(self.perfis_path, f'{perfil_id}.json')
        if not os.path.isfile(caminho) or os.path.islink(caminho):
            return {'excluido': False, 'perfilId': perfil_id}
        os.unlink(caminho)
        return {'excluido': True, 'perfilId': perfil_id}

    @staticmethod
    def _nome_seguro(nome):
        base = os.path.basename(str(nome or 'backup.cptec.json'))
        base = re.sub(r'[^A-Za-z0-9._-]+', '_', base).strip('._') or 'backup'
        if not base.endswith('.cptec.json'):
            base = f'{base}.cptec.json'
        return base

    def salvar_backup_automatico(self, nome, conteudo):
        self._validar_conteudo(conteudo)
        os.makedirs(self.backup_path, exist_ok=True)
        destino = os.path.join(self.backup_path, self._nome_seguro(nome))
        temporario = None
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', encoding='utf-8', newline='\n',
                prefix='.cptec-', suffix='.tmp', dir=self.backup_path, delete=False,
            ) as arquivo:
                temporario = arquivo.name
                arquivo.write(conteudo)
                arquivo.flush()
                os.fsync(arquivo.fileno())
            os.replace(temporario, destino)
            temporario = None
            self._limitar_backups()
            return {'salvo': True, 'nome': os.path.basename(destino)}
        finally:
            if temporario and os.path.exists(temporario):
                os.unlink(temporario)

    def _limitar_backups(self):
        arquivos = [
            os.path.join(self.backup_path, nome)
            for nome in os.listdir(self.backup_path)
            if nome.endswith('.cptec.json') and os.path.isfile(os.path.join(self.backup_path, nome))
        ]
        arquivos.sort(key=lambda caminho: (os.path.getmtime(caminho), caminho), reverse=True)
        for caminho in arquivos[self.max_backups:]:
            os.unlink(caminho)
