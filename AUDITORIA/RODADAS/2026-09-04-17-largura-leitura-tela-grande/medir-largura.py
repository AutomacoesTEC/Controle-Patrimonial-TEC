# -*- coding: utf-8 -*-
"""Mede largura e distância de leitura do demonstrativo."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
TAMANHOS = ((2880, 1620), (1366, 768))
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tema, tamanho):
    return pg.evaluate(
        r"""([tema,tamanho]) => {
          const body=document.querySelector('.page-body');
          const main=document.querySelector('.main-content');
          const titulo=[...document.querySelectorAll('.card-title')]
            .find(el=>el.textContent.trim()==='Variação Patrimonial');
          const card=titulo.closest('.card');
          const linha=card.querySelector('.demonstrativo-table tbody tr:nth-child(2)');
          const texto=linha.cells[0].firstChild;
          const valor=linha.cells[1].firstChild;
          const faixaTexto=document.createRange(); faixaTexto.selectNode(texto);
          const faixaValor=document.createRange(); faixaValor.selectNode(valor);
          const br=body.getBoundingClientRect(), mr=main.getBoundingClientRect();
          const tr=faixaTexto.getBoundingClientRect(), vr=faixaValor.getBoundingClientRect();
          return {tema,tamanho,larguraCorpo:Math.round(br.width),
            larguraCard:Math.round(card.getBoundingClientRect().width),
            distanciaTextoValor:Math.round(vr.left-tr.right),
            margemEsquerda:Math.round(br.left-mr.left),
            margemDireita:Math.round(mr.right-br.right),
            scrollVertical:body.scrollHeight>body.clientHeight};
        }""",
        [tema,tamanho],
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 2880, "height": 1620})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    pagina.set_input_files('input[type=file][accept*=".pdf"]', PDF)
    botao = pagina.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180_000)
    for _ in range(180):
        if botao.is_enabled(): break
        pagina.wait_for_timeout(1_000)
    botao.click()
    pagina.wait_for_selector("text=Preenchido a partir de", timeout=60_000)
    pagina.locator("form input.form-control").first.fill("FIXTURE TELA GRANDE")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible(): aviso.first.click()

    resultado=[]
    for largura,altura in TAMANHOS:
        pagina.set_viewport_size({"width":largura,"height":altura})
        for nome_tema,tema_alvo in TEMAS:
            aplicar_tema(pagina,tema_alvo)
            pagina.wait_for_timeout(350)
            resultado.append(medir(pagina,nome_tema,f"{largura}x{altura}"))
    browser.close()

print(json.dumps(resultado,ensure_ascii=False,separators=(",",":")))
