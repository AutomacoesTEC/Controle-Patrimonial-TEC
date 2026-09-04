# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
perfil['bens'].append({'id':999999,'grupo':'99','codigo_bem':'99','discriminacao':'BEM MANUAL FIXTURE','situacao_anterior':0,'situacao_atual':1,'origem':'manual','movimentacoes':[]})
with sync_playwright() as p:
  browser=p.chromium.launch(); pagina=browser.new_page(viewport={'width':1366,'height':768})
  pagina.goto('http://localhost:4174/',wait_until='networkidle')
  pagina.evaluate("""dados=>{const id='fixture-origem-bens';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE ORIGEM',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
  pagina.reload(wait_until='networkidle'); pagina.wait_for_selector('.saldo-hero')
  aviso=pagina.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click(); pagina.locator('.modal').wait_for(state='hidden')
  pagina.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click(); pagina.wait_for_selector('tbody tr')
  filtro=pagina.locator('[aria-label="Filtrar por origem"]')
  resultado={'linhasTodas':pagina.locator('tbody tr').count(),'badges':pagina.locator('.badge-origem').count(),'filtro':filtro.count(),'linhasManual':None,'linhasDeclaracao':None}
  if filtro.count():
    filtro.select_option('manual'); resultado['linhasManual']=pagina.locator('tbody tr:not(:has(.estado-vazio))').count()
    filtro.select_option('importacao'); resultado['linhasDeclaracao']=pagina.locator('tbody tr:not(:has(.estado-vazio))').count()
  print(json.dumps(resultado,ensure_ascii=False,separators=(',',':'))); browser.close()
