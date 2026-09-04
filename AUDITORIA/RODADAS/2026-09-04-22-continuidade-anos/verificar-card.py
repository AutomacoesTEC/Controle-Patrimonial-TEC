# -*- coding: utf-8 -*-
"""Confirma o card de continuidade no perfil persistido AJU-01 com dois anos."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz = Path(__file__).resolve().parents[3]
perfil = json.loads((raiz / "src/store/__fixtures__/perfil-aju01-atual.json").read_text())

with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    pagina.evaluate("""dados => {
      const id='fixture-continuidade';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE CONTINUIDADE',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".continuidade-card", timeout=30_000)
    card = pagina.locator(".continuidade-card")
    print(json.dumps({
        "cards": card.count(),
        "titulo": card.locator("h3").text_content(),
        "status": card.locator(".badge").text_content().strip(),
        "overflowPagina": pagina.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
