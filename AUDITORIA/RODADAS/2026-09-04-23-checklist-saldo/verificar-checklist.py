# -*- coding: utf-8 -*-
"""Confirma checklist, valores e navegação no perfil persistido AJU-01."""
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
      const id='fixture-checklist-saldo';
      dados.historico = {...(dados.historico || {}), 2024: {
        impostoDevido: {impostoRestituir: 2032.33}
      }};
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE CHECKLIST',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-checklist", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()
    checklist = pagina.locator(".saldo-checklist")
    botoes = checklist.locator("li button")
    quantidade_checklists = checklist.count()
    quantidade_itens = botoes.count()
    primeiro = botoes.first.text_content().strip()
    valores = [texto.strip() for texto in checklist.locator("li strong").all_text_contents()]
    botoes.first.click()
    pagina.wait_for_timeout(100)
    print(json.dumps({
        "checklists": quantidade_checklists,
        "itens": quantidade_itens,
        "primeiroItem": primeiro,
        "valores": valores,
        "destinoAtivo": pagina.locator(".nav-item.active").text_content().strip(),
        "overflowPagina": pagina.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
