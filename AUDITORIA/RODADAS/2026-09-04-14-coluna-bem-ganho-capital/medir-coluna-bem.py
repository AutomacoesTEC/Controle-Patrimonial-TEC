# -*- coding: utf-8 -*-
"""Mede largura e quebra da coluna Bem na apuração de ganho de capital."""
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


def medir(pg, tema, tamanho):
    return pg.evaluate(
        r"""([tema,tamanho]) => {
          const titulo=[...document.querySelectorAll('.card-title')]
            .find(el=>el.textContent.trim()==='Apuração do Ganho de Capital');
          const tabela=titulo.closest('.card').querySelector('table');
          const cont=tabela.closest('.table-container');
          cont.scrollLeft=0;
          const th=[...tabela.tHead.rows[0].cells];
          const linha=tabela.tBodies[0].rows[0];
          const celula=linha.cells[1];
          const noTexto=[...celula.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
          const faixa=document.createRange(); faixa.selectNode(noTexto);
          const linhas=new Set([...faixa.getClientRects()].map(r=>Math.round(r.top)));
          const cr=cont.getBoundingClientRect();
          const monetarias=th.slice(-5).map((cab,i)=>{
            const r=cab.getBoundingClientRect();
            const td=linha.cells[th.length-5+i].getBoundingClientRect();
            return {titulo:cab.textContent.trim(),largura:Math.round(r.width),
              visivel:r.left>=cr.left-1&&r.right<=cr.right+1&&td.left>=cr.left-1&&td.right<=cr.right+1};
          });
          return {tema,tamanho,linhasBem:linhas.size,
            larguras:{bem:Math.round(th[1].getBoundingClientRect().width),
              aquisicao:Math.round(th[3].getBoundingClientRect().width),
              alienacao:Math.round(th[4].getBoundingClientRect().width)},
            sobraHorizontal:Math.round(cont.scrollWidth-cont.clientWidth),monetarias,
            textoBem:noTexto.textContent.trim()};
        }""",
        [tema, tamanho],
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4173/", wait_until="networkidle")
    pagina.set_input_files('input[type=file][accept*=".pdf"]', PDF)
    botao = pagina.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180_000)
    for _ in range(180):
        if botao.is_enabled(): break
        pagina.wait_for_timeout(1_000)
    botao.click()
    pagina.wait_for_selector("text=Preenchido a partir de", timeout=60_000)
    pagina.locator("form input.form-control").first.fill("FIXTURE COLUNA BEM")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible(): aviso.first.click()
    pagina.get_by_role("button", name="Ganhos de Capital", exact=True).first.click()

    resultado=[]
    for largura,altura in TAMANHOS:
        pagina.set_viewport_size({"width":largura,"height":altura})
        for nome_tema,tema_alvo in TEMAS:
            aplicar_tema(pagina,tema_alvo)
            pagina.wait_for_timeout(350)
            resultado.append(medir(pagina,nome_tema,f"{largura}x{altura}"))
    browser.close()

print(json.dumps(resultado,ensure_ascii=False,separators=(",",":")))
