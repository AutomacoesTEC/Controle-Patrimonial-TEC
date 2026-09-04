# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
with sync_playwright() as p:
  browser=p.chromium.launch(); pagina=browser.new_page(viewport={'width':1366,'height':768})
  pagina.goto('http://localhost:4174/',wait_until='networkidle')
  pagina.evaluate("""dados=>{const id='fixture-modal';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE MODAL',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
  pagina.reload(wait_until='networkidle'); pagina.wait_for_selector('.saldo-hero')
  aviso=pagina.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click()
  pagina.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click()
  gatilho=pagina.locator('.page-header-actions .btn-primary'); gatilho.focus(); gatilho.click()
  pagina.wait_for_selector('.modal')
  inicial=pagina.evaluate("""() => {const m=document.querySelector('.modal');const id=m.getAttribute('aria-labelledby');return {role:m.getAttribute('role'),ariaModal:m.getAttribute('aria-modal'),labelledby:id,tituloId:m.querySelector('.modal-header h3')?.id||null,nome:id?document.getElementById(id)?.textContent.trim():null,focoDentro:m.contains(document.activeElement)}}""")
  focaveis=".modal button:not([disabled]),.modal input:not([disabled]),.modal select:not([disabled]),.modal textarea:not([disabled]),.modal [tabindex]:not([tabindex='-1'])"
  itens=pagina.locator(focaveis); primeiro=itens.first; ultimo=itens.last
  ultimo.focus(); pagina.keyboard.press('Tab'); tab_cicla=primeiro.evaluate('e=>e===document.activeElement')
  primeiro.focus(); pagina.keyboard.press('Shift+Tab'); shift_cicla=ultimo.evaluate('e=>e===document.activeElement')
  pagina.locator('.modal-close').click(); pagina.wait_for_timeout(200)
  retorno=gatilho.evaluate('e=>e===document.activeElement')
  print(json.dumps({'inicial':inicial,'tabCicla':tab_cicla,'shiftTabCicla':shift_cicla,'focoRetornou':retorno},ensure_ascii=False,separators=(',',':'))); browser.close()
