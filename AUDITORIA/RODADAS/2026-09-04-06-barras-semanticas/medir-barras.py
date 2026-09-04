# -*- coding: utf-8 -*-
"""Mede gradiente, espessura e variante das barras estatísticas."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TELAS = ("Dashboard", "Ganhos de Capital", "Atividade Rural")
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tela, tema):
    return pg.evaluate(
        """([tela, tema]) => {
          const cards = [...document.querySelectorAll('.stat-card')].map(card => {
            const s = getComputedStyle(card, '::after');
            return {variante: [...card.classList].find(x => ['blue','green','orange','purple','danger'].includes(x)),
              gradiente: s.backgroundImage !== 'none', altura: s.height,
              cor: s.backgroundColor};
          });
          const sucesso = document.querySelector('.btn-success');
          const bs = sucesso ? getComputedStyle(sucesso) : null;
          return {tela, tema, cards,
            botaoSucesso: bs ? {gradiente: bs.backgroundImage !== 'none', cor: bs.backgroundColor} : null};
        }""",
        [tela, tema],
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
    pagina.locator("form input.form-control").first.fill("FIXTURE BARRAS")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for nome_tema, tema_alvo in TEMAS:
        aplicar_tema(pagina, tema_alvo)
        for tela in TELAS:
            pagina.get_by_role("button", name=tela, exact=True).first.click()
            if tela == "Atividade Rural":
                pagina.get_by_role("button", name="Receitas e Despesas", exact=True).click()
            pagina.wait_for_timeout(300)
            resultado.append(medir(pagina, tela, nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
