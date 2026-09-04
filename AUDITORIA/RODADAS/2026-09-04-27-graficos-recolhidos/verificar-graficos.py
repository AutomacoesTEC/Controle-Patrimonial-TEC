# -*- coding: utf-8 -*-
"""Mede a ocupação inicial e a reabertura dos gráficos do Dashboard."""
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
      const id='fixture-graficos-recolhidos';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE GRAFICOS',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".recharts-responsive-container", state="attached", timeout=30_000)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.is_visible():
        aviso.click()

    def medir():
        return pagina.evaluate("""() => {
          const detalhes=document.querySelector('.dashboard-graficos');
          const graficos=[...document.querySelectorAll('.recharts-responsive-container')];
          const cards=[...new Set(graficos.map(item => item.closest('.card')))];
          const dimensionados=graficos.filter(item => {
            const r=item.getBoundingClientRect();
            return item.checkVisibility() && r.width > 0 && r.height > 0;
          });
          const caixas=cards.map(item => item.getBoundingClientRect()).filter(r => r.height > 0);
          const altura=detalhes
            ? Math.round(detalhes.getBoundingClientRect().height)
            : caixas.length ? Math.round(Math.max(...caixas.map(r => r.bottom)) - Math.min(...caixas.map(r => r.top))) : 0;
          return {
            controles:document.querySelectorAll('.dashboard-graficos').length,
            aberto:detalhes?.open ?? null,
            graficosDom:graficos.length,
            graficosDimensionados:dimensionados.length,
            alturaInicial:altura,
            titulos:cards.map(card => card.querySelector('.card-title')?.textContent.trim()),
          };
        }""")

    inicial = medir()
    resumo = pagina.locator(".dashboard-graficos > summary")
    aberto = None
    if resumo.count():
        resumo.click()
        pagina.wait_for_timeout(300)
        aberto = medir()
    print(json.dumps({"inicial": inicial, "aposAbrir": aberto}, ensure_ascii=False, separators=(",", ":")))
    browser.close()
