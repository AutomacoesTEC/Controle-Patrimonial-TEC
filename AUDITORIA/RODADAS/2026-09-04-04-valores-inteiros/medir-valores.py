# -*- coding: utf-8 -*-
"""Mede se os blocos monetários ficam inteiros em 1280x720."""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright


RAIZ = Path(__file__).resolve().parents[3]
PDF = str(RAIZ / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf")
CASOS = (
    ("Rendimentos", ("VALOR", "IRRF")),
    ("Pagamentos", ("VALOR PAGO", "PARCELA NÃO DEDUTÍVEL")),
    ("Ganhos de Capital", ("CUSTO", "VALOR ALIENAÇÃO", "GANHO", "IMPOSTO DEVIDO", "IMPOSTO PAGO")),
)
TEMAS = (("escuro", "dark"), ("claro", "light"))


def aplicar_tema(pg, alvo):
    for _ in range(3):
        if pg.evaluate("document.documentElement.dataset.theme") == alvo:
            return
        pg.locator(".theme-toggle-fixed").first.click()


def medir(pg, tela, alvos, tema):
    return pg.evaluate(
        """([tela, alvos, tema]) => {
          let tabela;
          if (tela === 'Ganhos de Capital') {
            const titulo = [...document.querySelectorAll('h3')]
              .find(h => h.textContent.trim() === 'Apuração do Ganho de Capital');
            tabela = titulo.closest('.card').querySelector('table');
          } else {
            tabela = document.querySelector('table.tabela-acoes-fixas');
          }
          const cont = tabela.closest('.table-container');
          cont.scrollLeft = 0;
          const hs = [...tabela.tHead.rows[0].cells];
          const dentro = el => {
            const r = el.getBoundingClientRect(), c = cont.getBoundingClientRect();
            return r.left >= c.left - 1 && r.right <= c.right + 1;
          };
          const colunas = {};
          for (const alvo of alvos) {
            const h = hs.find(x => x.textContent.trim().toUpperCase() === alvo);
            const cel = tabela.tBodies[0].rows[0].cells[h.cellIndex];
            colunas[alvo] = {cabecalho: dentro(h), valor: dentro(cel)};
          }
          const acao = hs.find(x => x.textContent.trim().toUpperCase() === 'AÇÕES');
          return {tela, tema,
            sobraHorizontal: Math.round(cont.scrollWidth - cont.clientWidth),
            colunas, acoesVisiveis: acao ? dentro(acao) : null};
        }""",
        [tela, list(alvos), tema],
    )


with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1280, "height": 720})
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
    pagina.locator("form input.form-control").first.fill("FIXTURE VALORES")
    pagina.get_by_role("button", name="Criar e Entrar").click()
    pagina.wait_for_timeout(2_500)
    aviso = pagina.get_by_role("button", name="OK, entendi")
    if aviso.count() and aviso.first.is_visible():
        aviso.first.click()

    resultado = []
    for nome_tema, tema_alvo in TEMAS:
        aplicar_tema(pagina, tema_alvo)
        for tela, alvos in CASOS:
            pagina.get_by_role("button", name=tela, exact=True).first.click()
            pagina.wait_for_timeout(350)
            resultado.append(medir(pagina, tela, alvos, nome_tema))
    browser.close()

print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
