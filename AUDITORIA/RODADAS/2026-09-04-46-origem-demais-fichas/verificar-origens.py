# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz=Path(__file__).resolve().parents[3]
d=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
d['dividas'].append({'id':99001,'codigo':'99','discriminacao':'MANUAL','origem':'manual'})
d['rendimentos'].append({'id':99002,'tipo':'isento_0001','nome_fonte':'MANUAL','valor':1,'origem':'manual'})
d['pagamentos'].append({'id':99003,'codigo':'21','nome_beneficiario':'MANUAL','valor_pago':1,'origem':'manual'})
with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(viewport={'width':1366,'height':768}); page.goto('http://localhost:4174/',wait_until='networkidle')
  page.evaluate("""dados=>{const id='fixture-origens';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE ORIGENS',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",d)
  page.reload(wait_until='networkidle'); page.wait_for_selector('.saldo-hero'); aviso=page.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click(); page.locator('.modal').wait_for(state='hidden')
  saida={}
  for nome,titulo,chave in [('Dívidas e Ônus','Dívidas e Ônus Reais','dividas'),('Rendimentos','Rendimentos','rendimentos'),('Pagamentos','Pagamentos Efetuados','pagamentos')]:
    page.get_by_role('navigation').get_by_role('button',name=nome,exact=True).click()
    page.get_by_role('heading',name=titulo,exact=True).wait_for()
    filtro=page.locator('[aria-label="Filtrar por origem"]'); item={'todas':page.locator('tbody tr:not(:has(.estado-vazio))').count(),'badges':page.locator('.badge-origem').count(),'filtro':filtro.count(),'manual':None,'declaracao':None}
    if filtro.count():
      filtro.select_option('manual'); item['manual']=page.locator('tbody tr:not(:has(.estado-vazio))').count()
      filtro.select_option('importacao'); item['declaracao']=page.locator('tbody tr:not(:has(.estado-vazio))').count()
    saida[chave]=item
  print(json.dumps(saida,ensure_ascii=False,separators=(',',':'))); b.close()
