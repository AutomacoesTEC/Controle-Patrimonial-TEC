# -*- coding: utf-8 -*-
"""Mede a hierarquia dos avisos ligados ao Demonstrativo do Dashboard."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
VIEWPORTS = ((1280, 720), (1366, 768))
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, largura, altura, tema):
    return pg.evaluate(
        r"""([largura,altura,tema]) => {
          const corpo=document.querySelector('.page-body');
          const titulo=[...corpo.querySelectorAll('h3')]
            .find(el=>el.textContent.trim()==='Demonstrativo de Conciliação Patrimonial');
          const cardPeriodo=corpo.querySelector('.card');
          const limiteSuperior=cardPeriodo.getBoundingClientRect().bottom;
          const limiteInferior=titulo.getBoundingClientRect().bottom;
          const avisos=[...corpo.querySelectorAll('.ajuda-wrap')].filter(el=>{
            const r=el.getBoundingClientRect();
            return r.top>=limiteSuperior && r.bottom<=limiteInferior+2;
          });
          const elementos=[titulo,...avisos], rects=elementos.map(el=>el.getBoundingClientRect());
          const cabecalho=titulo.closest('.dashboard-demonstrativo-cabecalho');
          return {
            largura,altura,tema,
            avisos:avisos.length,
            rotulos:avisos.map(el=>el.textContent.trim()),
            compartilhamCabecalho:!!cabecalho && avisos.every(el=>cabecalho.contains(el)),
            alturaFaixa:Math.round(Math.max(...rects.map(r=>r.bottom))-Math.min(...rects.map(r=>r.top))),
            overflowPagina:Math.max(0,Math.round(document.documentElement.scrollWidth-document.documentElement.clientWidth))
          };
        }""",
        [largura, altura, tema],
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    pagina.set_input_files('input[type=file][accept*=".pdf"]', PDF)
    botao = pagina.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180_000)
    for _ in range(180):
        if botao.is_enabled():
            break
        pagina.wait_for_timeout(1_000)
    botao.click()
    pagina.wait_for_selector("text=Preenchido a partir de", timeout=60_000)
    pagina.locator("form input.form-control").first.fill("FIXTURE AVISOS")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for largura, altura in VIEWPORTS:
        pagina.set_viewport_size({"width": largura, "height": altura})
        for nome_tema, tema_alvo in TEMAS:
            aplicar_tema(pagina, tema_alvo)
            pagina.wait_for_timeout(250)
            resultado.append(medir(pagina, largura, altura, nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
