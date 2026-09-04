# -*- coding: utf-8 -*-
"""Mede a folha do Dashboard sob a mídia print do Chromium."""
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
      const id='fixture-folha-impressao';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE IMPRESSAO',cpf:dados.contribuinte?.cpf || '',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-hero", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()
    pagina.locator(".dashboard-graficos > summary").click()
    pagina.wait_for_timeout(300)
    pagina.emulate_media(media="print")
    pagina.wait_for_timeout(100)
    resultado = pagina.evaluate("""() => {
      const estilo=seletor => {
        const elemento=document.querySelector(seletor);
        return elemento ? getComputedStyle(elemento).display : null;
      };
      const layout=document.querySelector('.app-layout');
      const corpo=document.querySelector('.page-body');
      const card=[...document.querySelectorAll('.card')]
        .find(item => item.querySelector('.card-title')?.textContent.trim() === 'Variação Patrimonial');
      const visiveis=[...document.querySelectorAll('.btn,.ajuda-marca,.theme-toggle-fixed,.sidebar button')]
        .filter(item => item.checkVisibility()).length;
      return {
        displays:{
          sidebar:estilo('.sidebar'),
          tema:estilo('.theme-toggle-fixed'),
          acoes:estilo('.page-header-actions'),
          periodo:estilo('.dashboard-periodo-controles'),
          graficos:estilo('.dashboard-graficos'),
        },
        controlesVisiveis:visiveis,
        layout:{altura:getComputedStyle(layout).height,overflow:getComputedStyle(layout).overflow},
        corpo:{overflowY:getComputedStyle(corpo).overflowY,altura:getComputedStyle(corpo).height},
        fundo:getComputedStyle(document.querySelector('.main-content')).backgroundColor,
        breakCard:getComputedStyle(card).breakInside,
        cabecalhos:document.querySelectorAll('.print-header').length,
        rodapes:document.querySelectorAll('.print-footer').length,
        textoCabecalho:document.querySelector('.print-header')?.textContent.replace(/\s+/g,' ').trim() || null,
        textoRodape:document.querySelector('.print-footer')?.textContent.replace(/\s+/g,' ').trim() || null,
      };
    }""")
    print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
    browser.close()
