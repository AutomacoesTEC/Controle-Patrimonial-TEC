# -*- coding: utf-8 -*-
"""Calcula contraste WCAG das cores funcionais nos dois temas."""
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
        """(tema) => {
          document.querySelector('#fixture-contraste')?.remove();
          const host = document.createElement('div');
          host.id = 'fixture-contraste'; host.className = 'card';
          host.innerHTML = `
            <span data-id="badge-blue" class="badge badge-blue">Azul</span>
            <span data-id="badge-green" class="badge badge-green">Verde</span>
            <span data-id="badge-orange" class="badge badge-orange">Laranja</span>
            <span data-id="badge-purple" class="badge badge-purple">Roxo</span>
            <span data-id="badge-red" class="badge badge-red">Vermelho</span>
            <span data-id="positive" class="currency positive">R$ 1.234,56</span>
            <span data-id="negative" class="currency negative">-R$ 1.234,56</span>`;
          document.body.appendChild(host);
          const rgba = valor => (valor.match(/[\d.]+/g) || []).map(Number);
          const compor = (frente, fundo) => {
            const a = frente.length > 3 ? frente[3] : 1;
            return frente.slice(0,3).map((v,i) => v*a + fundo[i]*(1-a));
          };
          const lum = cor => {
            const canais = cor.map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
            return .2126*canais[0] + .7152*canais[1] + .0722*canais[2];
          };
          const razao = (a,b) => {
            const [maior,menor] = [lum(a),lum(b)].sort((x,y)=>y-x);
            return (maior+.05)/(menor+.05);
          };
          const fundoHost = rgba(getComputedStyle(host).backgroundColor);
          const saida = {};
          for (const el of host.children) {
            const s = getComputedStyle(el);
            const fg = rgba(s.color);
            const bgLido = rgba(s.backgroundColor);
            const bg = bgLido.length ? compor(bgLido, fundoHost) : fundoHost;
            saida[el.dataset.id] = {cor:s.color, fundo:s.backgroundColor,
              razao:Number(razao(fg,bg).toFixed(2))};
          }
          host.remove();
          return {tema, componentes:saida};
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
