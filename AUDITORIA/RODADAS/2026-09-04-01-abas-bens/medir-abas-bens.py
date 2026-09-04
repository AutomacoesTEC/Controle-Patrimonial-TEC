# -*- coding: utf-8 -*-
"""Mede o confinamento horizontal das abas de Bens e Direitos.

Pré-condição:
  npm run build
  npx vite preview --port 4173 --strictPort --host 0.0.0.0

O script só imprime JSON. Não grava nem altera artefatos do repositório.
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TAMANHOS = [(1366, 768), (1280, 720)]
TEMAS = (("escuro", "dark"), ("claro", "light"))


def tema(pg, alvo):
    for _ in range(3):
        atual = pg.evaluate("document.documentElement.dataset.theme")
        if atual == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medida(pg, tamanho, nome_tema):
    return pg.evaluate(
        """([tamanho, tema]) => {
          const tabs = document.querySelector('.page-body .toolbar .tabs');
          const toolbar = tabs.closest('.toolbar');
          const pageBody = tabs.closest('.page-body');
          const rect = tabs.getBoundingClientRect();
          const info = el => ({
            sobra: Math.max(0, Math.round(el.scrollWidth - el.clientWidth)),
            overflowX: getComputedStyle(el).overflowX,
          });
          return {
            tamanho,
            tema,
            paginaRolaX: document.documentElement.scrollWidth >
              document.documentElement.clientWidth + 1,
            tabs: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              sobra: Math.max(0, Math.round(tabs.scrollWidth - tabs.clientWidth)),
              overflowX: getComputedStyle(tabs).overflowX,
            },
            pageBody: info(pageBody),
            toolbar: info(toolbar),
          };
        }""",
        [tamanho, nome_tema],
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
    pagina.locator("form input.form-control").first.fill("FIXTURE ABAS BENS")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()
    pagina.get_by_role("button", name="Bens e Direitos", exact=True).first.click()

    resultado = []
    for largura, altura in TAMANHOS:
        pagina.set_viewport_size({"width": largura, "height": altura})
        for nome_tema, tema_alvo in TEMAS:
            tema(pagina, tema_alvo)
            pagina.wait_for_timeout(300)
            resultado.append(medida(pagina, f"{largura}x{altura}", nome_tema))

    browser.close()

print(json.dumps(resultado, ensure_ascii=False, indent=2))
