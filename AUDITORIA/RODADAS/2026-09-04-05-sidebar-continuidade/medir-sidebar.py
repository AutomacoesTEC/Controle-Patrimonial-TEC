# -*- coding: utf-8 -*-
"""Mede a indicação e o acesso aos itens finais da sidebar."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TAMANHOS = ((1366, 768), (1280, 720))
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tamanho, tema):
    topo = pg.evaluate(
        """() => {
          const nav = document.querySelector('.sidebar-nav');
          const nomes = ['Ganhos de Capital', 'Renda Variável', 'Histórico de Alterações'];
          nav.scrollTop = 0;
          return Math.round(nav.scrollHeight - nav.clientHeight);
        }"""
    )
    pg.wait_for_timeout(250)
    topo_estado = pg.evaluate(
        """() => {
          const nav = document.querySelector('.sidebar-nav');
          const nr = nav.getBoundingClientRect();
          const nomes = ['Ganhos de Capital', 'Renda Variável', 'Histórico de Alterações'];
          const itens = Object.fromEntries(nomes.map(nome => {
            const el = [...nav.querySelectorAll('.nav-item')].find(x => x.textContent.trim() === nome);
            const r = el.getBoundingClientRect();
            return [nome, r.top >= nr.top - 1 && r.bottom <= nr.bottom + 1];
          }));
          return {itens, indicador: !!document.querySelector('.sidebar-more')};
        }"""
    )
    indicador = pg.locator(".sidebar-more")
    if indicador.count():
        indicador.click()
    else:
        pg.evaluate("document.querySelector('.sidebar-nav').scrollTop = document.querySelector('.sidebar-nav').scrollHeight")
    pg.wait_for_timeout(500)
    fim_estado = pg.evaluate(
        """() => {
          const nav = document.querySelector('.sidebar-nav');
          const nr = nav.getBoundingClientRect();
          const nomes = ['Ganhos de Capital', 'Renda Variável', 'Histórico de Alterações'];
          const itens = Object.fromEntries(nomes.map(nome => {
            const el = [...nav.querySelectorAll('.nav-item')].find(x => x.textContent.trim() === nome);
            const r = el.getBoundingClientRect();
            return [nome, r.top >= nr.top - 1 && r.bottom <= nr.bottom + 1];
          }));
          return {itens, indicador: !!document.querySelector('.sidebar-more')};
        }"""
    )
    return {"tamanho": tamanho, "tema": tema, "sobraVertical": topo,
            "noTopo": topo_estado["itens"], "indicadorNoTopo": topo_estado["indicador"],
            "noFim": fim_estado["itens"], "indicadorNoFim": fim_estado["indicador"]}


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    pagina.set_input_files('input[type=file][accept*=".pdf"]', PDF)
    botao = pagina.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180_000)
    for _ in range(180):
        if botao.is_enabled():
            break
        pagina.wait_for_timeout(1_000)
    botao.click()
    pagina.wait_for_selector("text=Preenchido a partir de", timeout=60_000)
    pagina.locator("form input.form-control").first.fill("FIXTURE SIDEBAR")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for largura, altura in TAMANHOS:
        pagina.set_viewport_size({"width": largura, "height": altura})
        for nome_tema, tema_alvo in TEMAS:
            aplicar_tema(pagina, tema_alvo)
            pagina.wait_for_timeout(200)
            resultado.append(medir(pagina, f"{largura}x{altura}", nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
