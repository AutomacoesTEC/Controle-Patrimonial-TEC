# -*- coding: utf-8 -*-
"""Mede o espaço vertical vazio em tabelas curtas."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TELAS = (
    ("Doações", "Doações"),
    ("Dívidas e Ônus Reais", "Dívidas e Ônus"),
    ("Despesas Gerais", "Despesas Gerais"),
    ("Atividade Rural", "Atividade Rural"),
)
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo: return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tela, tema):
    return pg.evaluate(
        r"""([tela,tema]) => {
          const containers=[...document.querySelectorAll('.page-body .table-container')]
            .filter(el=>el.offsetParent!==null);
          const cont=containers[0], tabela=cont.querySelector('table');
          const cr=cont.getBoundingClientRect(), tr=tabela.getBoundingClientRect();
          return {tela,tema,linhas:tabela.tBodies[0]?.rows.length||0,
            alturaContainer:Math.round(cr.height),alturaTabela:Math.round(tr.height),
            espacoVazio:Math.max(0,Math.round(cont.clientHeight-tr.height)),
            overflowHorizontal:Math.max(0,Math.round(cont.scrollWidth-cont.clientWidth)),
            overflowVertical:tabela.scrollHeight>cont.clientHeight};
        }""",
        [tela, tema],
    )


with sync_playwright() as p:
    browser=p.chromium.launch()
    pagina=browser.new_page(viewport={"width":1366,"height":768})
    pagina.goto("http://localhost:4173/",wait_until="networkidle")
    pagina.set_input_files('input[type=file][accept*=".pdf"]',PDF)
    botao=pagina.get_by_role("button",name="Usar esta declaração")
    botao.wait_for(state="visible",timeout=180_000)
    for _ in range(180):
        if botao.is_enabled(): break
        pagina.wait_for_timeout(1_000)
    botao.click()
    pagina.wait_for_selector("text=Preenchido a partir de",timeout=60_000)
    pagina.locator("form input.form-control").first.fill("FIXTURE ALTURA")
    pagina.get_by_role("button",name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso=pagina.get_by_role("button",name="OK, entendi")
    if aviso.count() and aviso.first.is_visible(): aviso.first.click()

    resultado=[]
    for nome_tema,tema_alvo in TEMAS:
        aplicar_tema(pagina,tema_alvo)
        for tela, botao_menu in TELAS:
            pagina.get_by_role("button",name=botao_menu,exact=True).first.click()
            pagina.wait_for_timeout(350)
            resultado.append(medir(pagina,tela,nome_tema))
    browser.close()

print(json.dumps(resultado,ensure_ascii=False,separators=(",",":")))
