# -*- coding: utf-8 -*-
"""Prova que parser/layout não baixam antes do arquivo e baixam ao importar."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz = Path(__file__).resolve().parents[3]
declaracao = raiz / "output/gcap/11144477735-0101-3112-GCAP-2025.DEC"
pdf = raiz / "output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf"

with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    scripts = []
    pagina.on("request", lambda req: scripts.append(req.url) if req.url.endswith(".js") else None)
    pagina.goto("http://localhost:4174/", wait_until="networkidle")
    iniciais = list(scripts)
    seletor = pagina.locator('input[type="file"][accept*=".dbk"]')
    seletor.set_input_files(str(declaracao))
    pagina.get_by_text("Arquivo eletrônico recusado por falha de integridade", exact=False).wait_for(timeout=30_000)
    dec_invalido_recusado = True
    apos_dec = [url for url in scripts if url not in iniciais]
    seletor.set_input_files(str(pdf))
    pagina.wait_for_selector("#revisao-importacao-titulo", timeout=60_000)
    print(json.dumps({
        "telaInicial": pagina.locator("h1").first.text_content().strip(),
        "parserNoInicio": any("importParsers" in url for url in iniciais),
        "layoutNoInicio": any("leitorRegistrosDbk" in url for url in iniciais),
        "parserAposArquivo": any("importParsers" in url for url in apos_dec),
        "layoutAposArquivo": any("leitorRegistrosDbk" in url for url in apos_dec),
        "decInvalidoRecusado": dec_invalido_recusado,
        "revisao": pagina.locator("#revisao-importacao-titulo").text_content().strip(),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
