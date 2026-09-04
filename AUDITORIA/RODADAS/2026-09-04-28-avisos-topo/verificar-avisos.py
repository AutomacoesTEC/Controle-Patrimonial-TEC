# -*- coding: utf-8 -*-
"""Mede dispersão e preservação dos avisos estruturais do Dashboard."""
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
      const id='fixture-avisos-topo';
      dados.historico={...(dados.historico || {}), 2027:dados.historico?.[2026]};
      delete dados.historico[2026];
      localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{
        id,nome:'FIXTURE AVISOS',cpf:'',apelido:'',protegido:false
      }]));
      localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao', id);
      sessionStorage.removeItem('cp-aviso-estrutural');
    }""", perfil)
    pagina.reload(wait_until="networkidle")
    pagina.wait_for_selector(".saldo-hero", timeout=30_000)
    modal = pagina.get_by_role("heading", name="Antes de usar estes números")
    janela_inicial = modal.is_visible()
    if janela_inicial:
        pagina.get_by_role("button", name="OK, entendi").click()
    pagina.get_by_role("button", name="Todo o histórico").click()
    pagina.wait_for_timeout(300)
    if modal.is_visible():
        pagina.get_by_role("button", name="OK, entendi").click()
    resultado = pagina.evaluate("""() => {
      const blocos=[...document.querySelectorAll('.dashboard-avisos')];
      const marcas=[...document.querySelectorAll('.ajuda-marca-ressalva')]
        .map(botao => botao.closest('.ajuda-wrap'))
        .filter(wrap => wrap?.querySelector('.ajuda-rotulo'));
      const local = wrap => {
        if (wrap.closest('.dashboard-avisos')) return 'bloco-topo';
        if (wrap.closest('.dashboard-demonstrativo-cabecalho')) return 'cabecalho-demonstrativo';
        const card=wrap.closest('.card');
        return card?.querySelector('.card-title')?.textContent.trim() || 'outro';
      };
      const caixa=blocos[0]?.getBoundingClientRect();
      const area=document.querySelector('.page-body');
      return {
        blocos:blocos.length,
        scrollTop:Math.round(area?.scrollTop || 0),
        titulos:marcas.map(wrap => wrap.querySelector('.ajuda-rotulo').textContent.trim()).sort(),
        locais:[...new Set(marcas.map(local))].sort(),
        caixaBloco:caixa ? {top:Math.round(caixa.top),bottom:Math.round(caixa.bottom)} : null,
        blocoVisivelSemRolar:Boolean(caixa && caixa.top >= 0 && caixa.bottom <= innerHeight && (area?.scrollTop || 0) === 0),
      };
    }""")
    resultado["janelaInicial"] = janela_inicial
    print(json.dumps(resultado, ensure_ascii=False, separators=(",", ":")))
    browser.close()
