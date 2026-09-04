# -*- coding: utf-8 -*-
"""Confirma que o painel consolidado é utilizável no Dashboard."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz = Path(__file__).resolve().parents[3]
perfil = json.loads((raiz / "src/store/__fixtures__/perfil-aju01-atual.json").read_text())

with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4174/", wait_until="networkidle")
    pagina.evaluate("""dados => {
      const id='fixture-painel-irrf';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE IRRF',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".painel-irrf", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()
    painel = pagina.locator(".painel-irrf")
    print(json.dumps({
        "paineis": painel.count(),
        "linhas": painel.locator("tbody tr").count(),
        "cabecalhos": [t.strip() for t in painel.locator("thead th").all_text_contents()],
        "tratamentos": sorted(set(t.strip() for t in painel.locator("tbody td:nth-child(4)").all_text_contents())),
        "selo": painel.locator(".card-header .badge").text_content().strip(),
        "overflowPagina": pagina.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
