# -*- coding: utf-8 -*-
"""Planta retenção mensal a menor e confirma a ressalva no painel."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz = Path(__file__).resolve().parents[3]
estado = json.loads((raiz / "src/store/__fixtures__/perfil-aju01-atual.json").read_text())
estado.update({
    "anoCalendario": 2026,
    "historico": {},
    "bens": [{"id": 1, "grupo": "01", "discriminacao": "Bem fixture", "situacao_anterior": 1, "situacao_atual": 1}],
    "rendimentos": [{
        "id": 2, "tipo": "tributavel_pj", "data": "2026-03-31",
        "nome_fonte": "EMPRESA FIXTURE", "beneficiario": "Titular",
        "valor": 6500, "contribuicaoPrevidenciaria": 650,
        "quantidadeDependentes": 1, "irrf": 500,
    }],
    "impostoDevido": None,
})

with sync_playwright() as p:
    browser = p.chromium.launch()
    pagina = browser.new_page(viewport={"width": 1366, "height": 768})
    pagina.goto("http://localhost:4174/", wait_until="networkidle")
    pagina.evaluate("""dados => {
      const id='fixture-alerta-irrf';
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE ALERTA',cpf:'',apelido:'',protegido:false}]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
    }""", estado)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".painel-irrf", timeout=30_000)
    alerta = pagina.get_by_text("Retenção possivelmente abaixo do esperado: EMPRESA FIXTURE", exact=True)
    print(json.dumps({
        "alertas": alerta.count(),
        "rotulo": alerta.text_content().strip(),
        "painelVisivel": pagina.locator(".painel-irrf").is_visible(),
        "overflowPagina": pagina.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth"),
    }, ensure_ascii=False, separators=(",", ":")))
    browser.close()
