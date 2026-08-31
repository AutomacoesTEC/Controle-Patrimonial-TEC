# -*- coding: utf-8 -*-
"""Tira dos handoffs o que identifica os contribuintes reais.

Dois cuidados que a primeira versao nao teve:
  1. Ordem: o padrao mais longo primeiro, senao a troca curta come a longa.
  2. QUEBRA DE LINHA. Nos .md o nome se parte no meio ("DECLARANTE 1\\nDECLARANTE 1"), e uma busca por texto literal passa direto por ele. Por isso
     cada nome vira regex com \\s+ entre as palavras.
"""
import io, os, re, sys

# (padrao com as palavras separadas por espaco, substituto)
NOMES = [
    ('DECLARANTE 1', 'DECLARANTE 1'),
    ('declarante 1', 'declarante 1'),
    ('DECLARANTE 1',               'DECLARANTE 1'),
    ('declarante 1',               'declarante 1'),
    ('DECLARANTE 1',                     'DECLARANTE 1'),
    ('declarante 1',                     'declarante 1'),
    ('DECLARANTE 2',           'DECLARANTE 2'),
    ('NOME DA FAZENDA',   'NOME DA FAZENDA'),
    ('NOME DA FAZENDA',                 'NOME DA FAZENDA'),
    ('NOME DA FAZENDA',              'NOME DA FAZENDA'),
    ('mesma fazenda',              'mesma fazenda'),
    ('mesma fazenda',                'mesma fazenda'),
    ('mesma fazenda',                 'mesma fazenda'),
    ('MUNICIPIO',                    'MUNICIPIO'),
    ('RAZAO SOCIAL DE UM PAGADOR', 'RAZAO SOCIAL DE UM PAGADOR'),
]
# palavra solta, sem risco de quebra
SOLTOS = [
    ('CPF no manifesto local', 'CPF no manifesto local'),
    ('CPF-DO-DECLARANTE-1',    'CPF-DO-DECLARANTE-1'),
    ('fazenda',     'fazenda'),
    ('declarante 2',         'declarante 2'),
    ('DECLARANTE 2',         'DECLARANTE 2'),
    ('declarante 1',          'declarante 1'),
    ('DECLARANTE 1',          'DECLARANTE 1'),
]

def compila(nome):
    partes = [re.escape(p) for p in nome.split(' ')]
    return re.compile(r'\s+'.join(partes))

REGEX = [(compila(a), b) for a, b in NOMES]

def redigir(texto):
    for rx, sub in REGEX:
        texto = rx.sub(sub, texto)
    for a, b in SOLTOS:
        texto = texto.replace(a, b)
    return texto

if __name__ == '__main__':
    n = 0
    for caminho in sys.argv[1:]:
        if not os.path.exists(caminho):
            continue
        orig = io.open(caminho, encoding='utf8', errors='surrogateescape').read()
        novo = redigir(orig)
        if novo != orig:
            io.open(caminho, 'w', encoding='utf8', errors='surrogateescape').write(novo)
            n += 1
    print('arquivos alterados: %d' % n)
