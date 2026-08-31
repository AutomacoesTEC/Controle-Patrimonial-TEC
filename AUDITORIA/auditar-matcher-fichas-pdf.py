"""Reproduz fielmente encontrarFichaPdf2026 sobre os itens de texto reais dos PDFs.

O importador chama o matcher por CÉLULA (item de texto posicionado), não por linha
concatenada, e normaliza com replace(/\\s+/g,' ').trim().toUpperCase().
Aceita igualdade exata, ou startsWith quando o padrão tem >= 24 caracteres.
"""
import re
import json
import pypdf

RAIZ = "/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte"
CAT = f"{RAIZ}/src/irpf/catalogoFichasPdf2026.js"

fonte = open(CAT, encoding="utf-8").read()
fichas = []
for m in re.finditer(r"ficha\(\s*'([^']+)'\s*,\s*'([^']*)'\s*,\s*'([^']+)'\s*(?:,\s*(\[[^\]]*\]))?\s*\)", fonte, re.S):
    fid, titulo, suporte, arr = m.group(1), m.group(2), m.group(3), m.group(4)
    padroes = re.findall(r"'([^']*)'", arr) if arr else [titulo]
    fichas.append({"id": fid, "titulo": titulo, "suporte": suporte, "padroes": padroes})


def normalizar(t):
    return re.sub(r"\s+", " ", str(t or "")).strip().upper()


def encontrar_ficha(texto):
    """Porte fiel de encontrarFichaPdf2026."""
    n = normalizar(texto)
    if not n:
        return None
    cands = []
    for item in fichas:
        for padrao in item["padroes"]:
            p = normalizar(padrao)
            if n == p or (len(p) >= 24 and n.startswith(p)):
                cands.append((len(p), item))
    if not cands:
        return None
    cands.sort(key=lambda c: -c[0])
    return cands[0][1]


ARQS = {
    "AJU-01": "AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf",
    "ESP-01": "ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf",
    "SAI-01": "SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf",
}

reconhecidas = {}   # id -> [(arquivo, pagina, texto)]
itens_total = 0
for nome, arq in ARQS.items():
    r = pypdf.PdfReader(f"{RAIZ}/output/pdf/{arq}")
    for npg, pg in enumerate(r.pages, 1):
        partes = []
        pg.extract_text(visitor_text=lambda t, cm, tm, fd, fs: partes.append(t))
        for t in partes:
            itens_total += 1
            f = encontrar_ficha(t)
            if f:
                reconhecidas.setdefault(f["id"], []).append((nome, npg, normalizar(t)[:70]))

print(f"itens de texto examinados: {itens_total}")
print(f"fichas do catálogo: {len(fichas)}")
print(f"fichas reconhecidas pelo matcher: {len(reconhecidas)}")

nao = [f for f in fichas if f["id"] not in reconhecidas]
print(f"\n{'=' * 78}\nFICHAS QUE O MATCHER NÃO RECONHECE EM NENHUM DOS 3 PDFs ({len(nao)})\n")
for f in nao:
    print(f"  [{f['suporte']:14}] {f['id']}")
    print(f"       título: {f['titulo']}")
    for p in f["padroes"]:
        print(f"       padrão: {p!r}  ({len(normalizar(p))} chars normalizados)")

print(f"\n{'=' * 78}\nRECONHECIDAS ({len(reconhecidas)})\n")
for f in fichas:
    if f["id"] in reconhecidas:
        hits = reconhecidas[f["id"]]
        onde = ", ".join(sorted({f"{a} p{p}" for a, p, _ in hits})[:4])
        print(f"  [{f['suporte']:14}] {f['id']:42} {len(hits):3}x  {onde}")

json.dump(
    {
        "nao_reconhecidas": nao,
        "reconhecidas": {k: v[:3] for k, v in reconhecidas.items()},
    },
    open("/tmp/claude-1000/-home-automacaotec/3bb57cc2-a900-4d9c-9ac2-a1b9bc2f105d/scratchpad/matcher.json", "w"),
    ensure_ascii=False,
    indent=1,
)
