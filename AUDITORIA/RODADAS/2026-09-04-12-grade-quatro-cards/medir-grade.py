# -*- coding: utf-8 -*-
"""Mede a distribuição das grades de quatro cards em laptop."""
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


def medir(pg, tela, tema, tamanho, seletor):
    return pg.evaluate(
        r"""([tela, tema, tamanho, seletor]) => {
          let grade;
          if (seletor === 'rendimentos') grade = document.querySelector('.page-body .stats-grid');
          else {
            const titulo = [...document.querySelectorAll('.card-title')]
              .find(el => el.textContent.trim() === 'Resumo da Declaração Importada');
            grade = titulo.closest('.card').querySelector('.stats-grid');
          }
          const filhos = [...grade.children];
          const linhas = new Map();
          for (const el of filhos) {
            const topo = Math.round(el.getBoundingClientRect().top);
            linhas.set(topo, (linhas.get(topo) || 0) + 1);
          }
          return {
            tela, tema, tamanho, cards:filhos.length,
            distribuicao:[...linhas.values()],
            overflowHorizontal:Math.max(0, Math.round(grade.scrollWidth-grade.clientWidth)),
            textos:filhos.map(el => el.textContent.replace(/\s+/g,' ').trim()),
          };
        }""",
        [tela, tema, tamanho, seletor],
    )


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
    pagina.locator("form input.form-control").first.fill("FIXTURE GRADE")
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
            for tela, seletor in (("Rendimentos", "rendimentos"), ("Relatório IRPF", "relatorio")):
                pagina.get_by_role("button", name=tela, exact=True).first.click()
                pagina.wait_for_timeout(350)
                resultado.append(medir(pagina, tela, nome_tema, f"{largura}x{altura}", seletor))

    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
