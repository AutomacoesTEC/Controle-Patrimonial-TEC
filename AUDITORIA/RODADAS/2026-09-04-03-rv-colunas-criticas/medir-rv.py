# -*- coding: utf-8 -*-
"""Mede as colunas críticas da tabela mensal de Renda Variável."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TAMANHOS = ((1366, 768), (1280, 720))
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tamanho, tema):
    return pg.evaluate(
        """([tamanho, tema]) => {
          const tabela = document.querySelector('table.rv-mensal');
          const cont = tabela.closest('.table-container');
          const headers = [...tabela.tHead.rows[0].cells];
          const acha = texto => headers.find(h => h.textContent.trim().toLowerCase() === texto);
          const dentro = el => {
            const r = el.getBoundingClientRect(), c = cont.getBoundingClientRect();
            return r.left >= c.left - 1 && r.right <= c.right + 1;
          };
          cont.scrollLeft = 0;
          const iniciais = {
            dayTrade: dentro(acha('resultado day-trade')),
            impostoPagar: dentro(acha('imposto a pagar')),
            impostoPago: dentro(acha('imposto pago')),
            mercados: dentro(tabela.querySelector('button')),
          };
          cont.scrollLeft = cont.scrollWidth;
          const mesNoFim = dentro(acha('mês'));
          return {tamanho, tema,
            sobraHorizontal: Math.round(cont.scrollWidth - cont.clientWidth),
            iniciais, mesNoFim};
        }""",
        [tamanho, tema],
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
    pagina.locator("form input.form-control").first.fill("FIXTURE RV COLUNAS")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()
    pagina.get_by_role("button", name="Renda Variável", exact=True).first.click()

    resultado = []
    for largura, altura in TAMANHOS:
        pagina.set_viewport_size({"width": largura, "height": altura})
        for nome_tema, tema_alvo in TEMAS:
            aplicar_tema(pagina, tema_alvo)
            pagina.wait_for_timeout(300)
            resultado.append(medir(pagina, f"{largura}x{altura}", nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
