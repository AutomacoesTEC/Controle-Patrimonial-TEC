"""Restaura iddeclaracoes.xml do backup, aplica o nome ESPOLIO e registra a SAI-01."""
import re
import shutil
import sys

BACKUP = "/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/output/backup-irpf-sintetico/2026-08-30-1620/iddeclaracoes.xml"
ALVO = "/mnt/c/Arquivos de Programas RFB/IRPF2026/aplicacao/dados/iddeclaracoes.xml"

shutil.copyfile(BACKUP, ALVO)
s = open(ALVO, encoding="utf-8").read()

# 1. nome do espolio conforme o roteiro
s = s.replace('nome="AUDITORIA PDF TEC HERANCA"', 'nome="AUDITORIA PDF TEC ESPOLIO"')
assert 'AUDITORIA PDF TEC ESPOLIO' in s, "nome do espolio nao aplicado"

# 2. item da SAI-01, espelhado no item do espolio
m = re.search(r'<item [^>]*cpf="555\.666\.777-20"[^>]*/>', s)
assert m, "item do espolio nao encontrado"
item = m.group(0)
sai = item
for de, para in [
    ('cpf="555.666.777-20"', 'cpf="999.000.111-12"'),
    ('nome="AUDITORIA PDF TEC ESPOLIO"', 'nome="AUDITORIA PDF TEC SAIDA"'),
    ('tipoDeclaracaoAES="E"', 'tipoDeclaracaoAES="S"'),
    ('dataCriacao="30/08/2026 15:06:44"', 'dataCriacao="30/08/2026 16:34:00"'),
    ('dataUltimoAcesso="30/08/2026 16:03:09"', 'dataUltimoAcesso="30/08/2026 16:34:00"'),
    ('enderecoDiferente=""', 'enderecoDiferente="1"'),
    ('resultadoDeclaracao="SSI"', 'resultadoDeclaracao=""'),
]:
    assert de in sai, f"nao encontrado no molde: {de}"
    sai = sai.replace(de, para)

s = s.replace('</classe>', sai + '</classe>')
open(ALVO, "w", encoding="utf-8", newline="").write(s)

itens = re.findall(r"<item ([^>]*)/>", s)
print("itens:", len(itens))
for it in itens:
    a = dict(re.findall(r'(\w+)="([^"]*)"', it))
    if a.get("nome", "").startswith("AUDITORIA"):
        print(f"  {a['cpf']} | {a['nome']} | AES={a['tipoDeclaracaoAES']} | criacao={a['dataCriacao']}")
