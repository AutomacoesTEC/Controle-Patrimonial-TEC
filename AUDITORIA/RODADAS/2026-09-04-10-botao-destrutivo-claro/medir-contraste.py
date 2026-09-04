# -*- coding: utf-8 -*-
"""Calcula contraste WCAG do botão destrutivo nos dois temas."""
import json

from playwright.sync_api import sync_playwright


TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, nome_tema):
    return pg.evaluate(
        r"""(tema) => {
          document.querySelector('#fixture-contraste')?.remove();
          const host = document.createElement('div');
          host.id = 'fixture-contraste'; host.className = 'card';
          host.innerHTML = '<button class="btn btn-danger">Excluir</button>';
          document.body.appendChild(host);
          const el = host.firstElementChild;
          const s = getComputedStyle(el);
          const rgb = valor => (valor.match(/[\d.]+/g) || []).slice(0,3).map(Number);
          const lum = cor => {
            const canais = cor.map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
            return .2126*canais[0] + .7152*canais[1] + .0722*canais[2];
          };
          const luminancias = [lum(rgb(s.color)), lum(rgb(s.backgroundColor))].sort((a,b)=>b-a);
          const resultado = {tema, cor:s.color, fundo:s.backgroundColor,
            razao:Number(((luminancias[0]+.05)/(luminancias[1]+.05)).toFixed(2))};
          host.remove();
          return resultado;
        }""",
        nome_tema,
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    resultado = []
    for nome_tema, tema_alvo in TEMAS:
        aplicar_tema(pagina, tema_alvo)
        resultado.append(medir(pagina, nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
