# -*- coding: utf-8 -*-
"""Mede a fonte real com os dois hosts externos deliberadamente bloqueados."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    externos = []

    def bloquear(rota):
        externos.append(rota.request.url)
        rota.abort()

    pagina.route("https://fonts.googleapis.com/**", bloquear)
    pagina.route("https://fonts.gstatic.com/**", bloquear)
    pagina.goto("http://localhost:4174/", wait_until="networkidle")
    resultado = pagina.evaluate("""async () => {
      await document.fonts.ready;
      const host = document.createElement('div');
      host.innerHTML = '<span class="currency">123</span><table><tbody><tr><td class="numero">123</td></tr></tbody></table><span class="stat-value">123</span>';
      document.body.append(host);
      const estilo = seletor => {
        const css = getComputedStyle(host.querySelector(seletor));
        return {variante: css.fontVariantNumeric, recursos: css.fontFeatureSettings};
      };
      return {
        titulo: document.querySelector('h1')?.textContent.trim(),
        larguraConteudo: document.querySelector('main > div')?.getBoundingClientRect().width,
        facesInter: [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Inter').map(face => ({peso: face.weight, estado: face.status})),
        estilos: {currency: estilo('.currency'), numero: estilo('.numero'), statValue: estilo('.stat-value')},
      };
    }""")
    resultado["requisicoesGoogle"] = externos
    print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
    browser.close()
