# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
with sync_playwright() as p:
    browser=p.chromium.launch()
    pagina=browser.new_page(viewport={'width':1366,'height':768})
    pagina.goto('http://localhost:4174/',wait_until='networkidle')
    pagina.evaluate("""dados=>{const id='fixture-densidade';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE DENSIDADE',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));localStorage.removeItem('cp-tec-tabelas-compactas');sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
    pagina.reload(wait_until='networkidle')
    pagina.wait_for_selector('.saldo-hero')
    aviso=pagina.get_by_role('button',name='OK, entendi')
    if aviso.is_visible(): aviso.click()
    pagina.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click()
    pagina.wait_for_selector('.table-container tbody td')
    def padding():
        return pagina.locator('.table-container tbody td').first.evaluate("e=>{const s=getComputedStyle(e);return {vertical:s.paddingTop,horizontal:s.paddingLeft}}")
    botao=pagina.get_by_role('button',name='Compacto',exact=True)
    inicial={'botoes':botao.count(),'padding':padding(),'armazenamento':pagina.evaluate("localStorage.getItem('cp-tec-tabelas-compactas')")}
    apos_clique=None
    apos_reload=None
    dividas=None
    if botao.count():
        botao.click()
        apos_clique={'padding':padding(),'armazenamento':pagina.evaluate("localStorage.getItem('cp-tec-tabelas-compactas')")}
        pagina.reload(wait_until='networkidle')
        pagina.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click()
        pagina.wait_for_selector('.table-container tbody td')
        apos_reload={'padding':padding(),'pressionado':pagina.get_by_role('button',name='Compacto',exact=True).get_attribute('aria-pressed')}
        pagina.get_by_role('navigation').get_by_role('button',name='Dívidas e Ônus',exact=True).click()
        pagina.wait_for_selector('.table-container tbody td')
        dividas={'padding':padding(),'pressionado':pagina.get_by_role('button',name='Compacto',exact=True).get_attribute('aria-pressed')}
    print(json.dumps({'inicial':inicial,'aposClique':apos_clique,'aposReload':apos_reload,'dividas':dividas},ensure_ascii=False,separators=(',',':')))
    browser.close()
