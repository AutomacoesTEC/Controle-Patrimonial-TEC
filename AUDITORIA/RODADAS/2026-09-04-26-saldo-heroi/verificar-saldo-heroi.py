# -*- coding: utf-8 -*-
"""Mede se a leitura decisiva do Saldo de Caixa aparece sem rolagem."""
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
      const id='fixture-saldo-heroi';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE SALDO HEROI',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector("tr.demonstrativo-final", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()
    resultado = pagina.evaluate("""() => {
      const linha=[...document.querySelectorAll('tr.demonstrativo-final')]
        .find(item => item.cells[0]?.textContent.trim() === 'Saldo de Caixa');
      const hero=document.querySelector('.saldo-hero');
      const caixa=elemento => {
        if (!elemento) return null;
        const r=elemento.getBoundingClientRect();
        return {top:Math.round(r.top),bottom:Math.round(r.bottom)};
      };
      const valor=hero?.querySelector('.saldo-hero-valor');
      const css=valor ? getComputedStyle(valor) : null;
      const area=document.querySelector('.page-body');
      const retanguloHero=caixa(hero);
      return {
        herois:document.querySelectorAll('.saldo-hero').length,
        scrollTop:Math.round(area?.scrollTop || 0),
        viewport:innerHeight,
        caixaHero:retanguloHero,
        visivelSemRolar:Boolean(retanguloHero && retanguloHero.top >= 0 && retanguloHero.bottom <= innerHeight && (area?.scrollTop || 0) === 0),
        textoHero:hero?.querySelector('.saldo-hero-rotulo')?.textContent.trim() || null,
        valorHero:valor?.textContent.trim() || null,
        selo:hero?.querySelector('.saldo-hero-estado')?.textContent.trim() || null,
        estiloValor:css ? {tamanho:css.fontSize,peso:css.fontWeight,variante:css.fontVariantNumeric} : null,
        valorLinha:linha?.cells[1]?.textContent.trim() || null,
        caixaLinha:caixa(linha),
      };
    }""")
    print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
    browser.close()
