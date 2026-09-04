# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
with sync_playwright() as p:
    browser=p.chromium.launch()
    pagina=browser.new_page(viewport={'width':1366,'height':768})
    pagina.add_init_script("window.__chamadasPrint=0;window.print=()=>{window.__chamadasPrint+=1}")
    pagina.goto('http://localhost:4174/',wait_until='networkidle')
    pagina.evaluate("""dados=>{const id='fixture-botoes-print';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE PRINT',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
    pagina.reload(wait_until='networkidle')
    pagina.wait_for_selector('.saldo-hero')
    aviso=pagina.get_by_role('button',name='OK, entendi')
    if aviso.is_visible(): aviso.click()
    botao=pagina.get_by_role('button',name='Imprimir demonstrativo',exact=True)
    dashboard=botao.count()
    if dashboard: botao.click()
    apos_dashboard=pagina.evaluate('window.__chamadasPrint')
    pagina.get_by_role('button',name='Relatório IRPF',exact=True).click()
    pagina.get_by_role('heading',name='Relatório para IRPF 2026').wait_for()
    botao=pagina.get_by_role('button',name='Imprimir demonstrativo',exact=True)
    relatorio=botao.count()
    if relatorio: botao.click()
    print(json.dumps({'botoesDashboard':dashboard,'chamadasAposDashboard':apos_dashboard,'botoesRelatorio':relatorio,'chamadasFinais':pagina.evaluate('window.__chamadasPrint')},separators=(',',':')))
    browser.close()
