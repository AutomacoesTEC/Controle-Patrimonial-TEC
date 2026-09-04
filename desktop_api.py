"""API mínima e confinada exposta pelo pywebview ao frontend."""

import os
import re
import tempfile


class DesktopApi:
    def __init__(self, storage_path, max_backups=30):
        self.backup_path = os.path.join(os.path.realpath(storage_path), 'BackupsAutomaticos')
        self.max_backups = max_backups

    @staticmethod
    def _nome_seguro(nome):
        base = os.path.basename(str(nome or 'backup.cptec.json'))
        base = re.sub(r'[^A-Za-z0-9._-]+', '_', base).strip('._') or 'backup'
        if not base.endswith('.cptec.json'):
            base = f'{base}.cptec.json'
        return base

    def salvar_backup_automatico(self, nome, conteudo):
        if not isinstance(conteudo, str):
            raise ValueError('O conteúdo do backup deve ser texto.')
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
