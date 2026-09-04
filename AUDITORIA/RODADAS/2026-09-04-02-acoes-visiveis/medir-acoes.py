# -*- coding: utf-8 -*-
"""Mede a visibilidade da última coluna Ações nas cinco telas congeladas."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TELAS = (
    "Bens e Direitos",
    "Titular e Dependentes",
    "Rendimentos",
    "Pagamentos",
    "Atividade Rural",
)
TAMANHOS = ((1366, 768), (1280, 720))
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tela, tamanho, tema):
    return pg.evaluate(
        """([tela, tamanho, tema]) => {
          const cab = [...document.querySelectorAll('th')]
            .find(el => el.textContent.trim().toUpperCase() === 'AÇÕES');
          const tabela = cab.closest('table');
          const cont = tabela.closest('.table-container');
          cont.scrollLeft = 0;
          const acao = tabela.tBodies[0]?.rows[0]?.cells[cab.cellIndex];
          const excluir = acao?.querySelector('.btn-danger');
          const cr = cont.getBoundingClientRect();
          const visivel = el => {
            const r = el.getBoundingClientRect();
            return r.left >= cr.left - 1 && r.right <= cr.right + 1;
          };
          return {
            tela, tamanho, tema,
            sobraHorizontal: Math.round(cont.scrollWidth - cont.clientWidth),
            cabecalhoVisivel: visivel(cab),
            excluirVisivel: excluir ? visivel(excluir) : null,
          };
        }""",
        [tela, tamanho, tema],
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
    pagina.locator("form input.form-control").first.fill("FIXTURE ACOES")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for largura, altura in TAMANHOS:
        pagina.set_viewport_size({"width": largura, "height": altura})
        for nome_tema, tema_alvo in TEMAS:
            aplicar_tema(pagina, tema_alvo)
            for tela in TELAS:
                pagina.get_by_role("button", name=tela, exact=True).first.click()
                pagina.wait_for_timeout(350)
                resultado.append(medir(pagina, tela, f"{largura}x{altura}", nome_tema))

    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
