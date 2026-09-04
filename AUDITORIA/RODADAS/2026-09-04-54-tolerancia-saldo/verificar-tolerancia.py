# -*- coding: utf-8 -*-
"""Confirma controles, efeito no selo e persistência após recarga."""
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
      const id='fixture-tolerancia-saldo';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE TOLERANCIA',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-hero-tolerancia", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()

    seletor = pagina.get_by_label("Tolerância para “fecha”")
    campo = pagina.get_by_label("Valor fixo da tolerância")
    opcoes = seletor.locator("option").all_text_contents()
    campo.fill("999999999")
    pagina.wait_for_timeout(300)
    selo_apos_ajuste = pagina.locator(".saldo-hero-estado").text_content().strip()
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-hero-tolerancia", timeout=30_000)
    print(json.dumps({
        "opcoes": opcoes,
        "tipoPersistido": pagina.get_by_label("Tolerância para “fecha”").input_value(),
        "valorPersistido": pagina.get_by_label("Valor fixo da tolerância").input_value(),
        "seloAposAjuste": selo_apos_ajuste,
        "limiteExibido": pagina.locator(".saldo-hero-tolerancia small").text_content().strip(),
        "overflowPagina": pagina.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
