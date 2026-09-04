# -*- coding: utf-8 -*-
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
      const id='fixture-cabecalho-relatorio';
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE RELATORIO',cpf:'',apelido:'',protegido:false}]));
      localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao',id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-hero", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()
    pagina.get_by_role("button", name="Relatório IRPF", exact=True).click()
    pagina.get_by_role("heading", name="Relatório para IRPF 2026").wait_for()
    pagina.emulate_media(media="print")
    pagina.wait_for_timeout(100)
    resultado = pagina.evaluate("""() => {
      const header=document.querySelector('.page-header');
      const actions=document.querySelector('.page-header-actions');
      const dashboard=document.querySelector('.dashboard-screen-header');
      return {
        displayCabecalho:getComputedStyle(header).display,
        displayAcoes:getComputedStyle(actions).display,
        titulo:header.querySelector('h2')?.textContent.trim(),
        subtitulo:header.querySelector('p')?.textContent.trim(),
        tituloVisivel:header.querySelector('h2')?.checkVisibility() || false,
        cabecalhoDashboard:dashboard ? getComputedStyle(dashboard).display : null,
      };
    }""")
    print(json.dumps(resultado,ensure_ascii=False,separators=(",",":")))
    browser.close()
