# -*- coding: utf-8 -*-
# Capturas de baseline das telas do menu (itens B10 e B9 de
# MELHORIAS-PROPOSTAS-2026-09-03.md). NAO altera codigo de producao: sobe o
# build, importa o AJU-01 pelo fluxo real e fotografa cada tela nos dois temas
# e em tres tamanhos. Junto das imagens, mede overflow por JavaScript, para o
# inventario de defeitos nao depender so do olho.
#
#   npx vite build
#   npx vite preview --port 4173 --strictPort --host 0.0.0.0 &
#   ~/emails-tools/venv/bin/python AUDITORIA/capturar-telas-baseline.py
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
DESTINO = RAIZ / "AUDITORIA/telas-2026-09"

TAMANHOS = [(1366, 768), (1280, 720), (2880, 1620)]
TEMAS = ["escuro", "claro"]
TELAS = [
    ("importar", "Importar Declaração"),
    ("dashboard", "Dashboard"),
    ("titular", "Titular e Dependentes"),
    ("bens", "Bens e Direitos"),
    ("dividas", "Dívidas e Ônus"),
    ("rendimentos", "Rendimentos"),
    ("pagamentos", "Pagamentos"),
    ("despesas-gerais", "Despesas Gerais"),
    ("doacoes", "Doações"),
    ("atividade-rural", "Atividade Rural"),
    ("relatorio-irpf", "Relatório IRPF"),
    ("ganhos-de-capital", "Ganhos de Capital"),
    ("renda-variavel", "Renda Variável"),
    ("historico", "Histórico de Alterações"),
]

MEDIR = """() => {
  const doc = document.documentElement;
  const fora = [], cortados = [];
  const sel = el => {
    const id = el.id ? '#' + el.id : '';
    const cls = (el.className && typeof el.className === 'string')
      ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '';
    return el.tagName.toLowerCase() + id + cls;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden') continue;
    if (r.right > window.innerWidth + 2 || r.left < -2) {
      fora.push({ seletor: sel(el), left: Math.round(r.left), right: Math.round(r.right),
                  texto: (el.innerText || '').slice(0, 60) });
    }
    const rolaX = el.scrollWidth - el.clientWidth;
    if (rolaX > 2 && el.clientWidth > 0) {
      cortados.push({ seletor: sel(el), sobra: rolaX, overflowX: st.overflowX,
                      texto: (el.innerText || '').slice(0, 60) });
    }
  }
  const dedup = (lista, chave) => {
    const vistos = new Set(); const saida = [];
    for (const it of lista) { if (vistos.has(it[chave])) continue; vistos.add(it[chave]); saida.push(it); }
    return saida.slice(0, 12);
  };
  return {
    paginaRolaX: doc.scrollWidth > doc.clientWidth + 1,
    paginaScrollWidth: doc.scrollWidth,
    paginaClientWidth: doc.clientWidth,
    fora: dedup(fora, 'seletor'),
    cortados: dedup(cortados.filter(c => c.overflowX !== 'auto' && c.overflowX !== 'scroll'), 'seletor'),
    comRolagemPropria: dedup(cortados.filter(c => c.overflowX === 'auto' || c.overflowX === 'scroll'), 'seletor'),
  };
}"""


def fechar_avisos_estruturais(pg):
    try:
        botao = pg.get_by_role("button", name="OK, entendi")
        if botao.count() and botao.first.is_visible():
            botao.first.click()
            pg.wait_for_timeout(400)
    except Exception:
        pass


def confirmar_importacao(pg):
    botao = pg.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180000)
    for _ in range(180):
        if botao.is_enabled():
            break
        pg.wait_for_timeout(1000)
    botao.click()
    pg.wait_for_selector("text=Preenchido a partir de", timeout=60000)


relatorio = []

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1366, "height": 768})
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto("http://localhost:4173/", wait_until="networkidle")
    pg.set_input_files("input[type=file]", PDF)
    confirmar_importacao(pg)
    pg.locator("form input.form-control").first.fill("BASELINE AJU 01")
    pg.get_by_role("button", name="Criar e Entrar").click()
    pg.wait_for_timeout(2500)
    fechar_avisos_estruturais(pg)

    def tema_atual(pg):
        return pg.evaluate("() => document.documentElement.getAttribute('data-theme')")

    def por_tema(pg, alvo):
        # alvo: 'dark' ou 'light'
        for _ in range(3):
            if tema_atual(pg) == alvo:
                return
            pg.locator(".theme-toggle-fixed").first.click()
            pg.wait_for_timeout(500)

    for larg, alt in TAMANHOS:
        pg.set_viewport_size({"width": larg, "height": alt})
        pg.wait_for_timeout(600)
        for tema in TEMAS:
            por_tema(pg, "dark" if tema == "escuro" else "light")
            pasta = DESTINO / f"{larg}x{alt}" / tema
            pasta.mkdir(parents=True, exist_ok=True)
            for arquivo, rotulo in TELAS:
                pg.get_by_role("button", name=re.compile("^" + re.escape(rotulo) + "$")).first.click()
                pg.wait_for_timeout(900)
                fechar_avisos_estruturais(pg)
                pg.wait_for_timeout(200)
                pg.screenshot(path=str(pasta / f"{arquivo}.png"))
                m = pg.evaluate(MEDIR)
                m.update({"tamanho": f"{larg}x{alt}", "tema": tema, "tela": rotulo})
                relatorio.append(m)
                print(f"{larg}x{alt} {tema} {rotulo}: rolagemX={m['paginaRolaX']} "
                      f"fora={len(m['fora'])} cortados={len(m['cortados'])}", flush=True)

    print("ERROS JS:", erros[:3])
    b.close()

(DESTINO / "medicoes.json").write_text(json.dumps(relatorio, ensure_ascii=False, indent=1), encoding="utf-8")
print("Medicoes em", DESTINO / "medicoes.json")
