# -*- coding: utf-8 -*-
"""Mede se cada coluna fixa tem sua alça na borda visível."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TELAS = (
    ("Titular e Dependentes", "table.tabela-acoes-fixas", 1),
    ("Rendimentos", "table.tabela-acoes-fixas", 3),
    ("Pagamentos", "table.tabela-acoes-fixas", 4),
    ("Renda Variável", "table.rv-mensal", 4),
)
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tela, seletor, fixas, tema, posicao):
    return pg.evaluate(
        r"""([tela, seletor, fixas, tema, posicao]) => {
          const tabela = document.querySelector(seletor);
          const cont = tabela.closest('.table-container');
          cont.scrollLeft = posicao === 'inicio' ? 0 : cont.scrollWidth;
          const cr = cont.getBoundingClientRect();
          const handles = [...cont.querySelectorAll(':scope > .rdz-camada .rdz-puxador')]
            .map(el => { const r=el.getBoundingClientRect(); return (r.left+r.right)/2; });
          const colunas = [...tabela.tHead.rows[0].cells].slice(-fixas);
          const bordas = colunas.map(th => th.getBoundingClientRect().left);
          const coincidencias = bordas.map(x => handles.some(h => Math.abs(h-x) <= 2));
          return {
            tela, tema, posicao, colunasFixas:fixas,
            alcasCoincidentes:coincidencias.filter(Boolean).length,
            todasVisiveis:coincidencias.every(Boolean) && bordas.every(x => x >= cr.left-1 && x <= cr.right+1),
            sobraHorizontal:Math.round(cont.scrollWidth-cont.clientWidth),
            bordas:bordas.map(Math.round), alcas:handles.map(Math.round),
          };
        }""",
        [tela, seletor, fixas, tema, posicao],
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1280, "height": 720})
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
    pagina.locator("form input.form-control").first.fill("FIXTURE ALCAS")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for nome_tema, tema_alvo in TEMAS:
        aplicar_tema(pagina, tema_alvo)
        for tela, seletor, fixas in TELAS:
            pagina.get_by_role("button", name=tela, exact=True).first.click()
            pagina.wait_for_timeout(350)
            for posicao in ("inicio", "fim"):
                resultado.append(medir(pagina, tela, seletor, fixas, nome_tema, posicao))

    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
