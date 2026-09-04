# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz=Path(__file__).resolve().parents[3]
d=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
original=d['bens'][0]['discriminacao']; item_id=d['bens'][0]['id']
with sync_playwright() as p:
  b=p.chromium.launch(); page=b.new_page(viewport={'width':1366,'height':768}); page.goto('http://localhost:4174/',wait_until='networkidle')
  page.evaluate("""dados=>{const id='fixture-edicao';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE EDIÇÃO',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",d)
  page.reload(wait_until='networkidle'); page.wait_for_selector('.saldo-hero'); aviso=page.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click(); page.locator('.modal').wait_for(state='hidden')
  page.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click(); page.wait_for_selector('tbody tr')
  page.locator('tbody tr').first.get_by_role('button',name='Editar').click(); page.wait_for_selector('.modal')
  campo=page.get_by_role('textbox',name='Discriminação'); campo.fill(original+' EDITADO'); page.get_by_role('button',name='Salvar Dados do Bem',exact=True).click(); page.locator('.modal').wait_for(state='hidden')
  page.wait_for_timeout(300)
  atual=page.evaluate("""id=>JSON.parse(localStorage.getItem('controle-patrimonial-data-fixture-edicao')).bens.find(b=>b.id===id)""",item_id)
  out={'origem':atual.get('origem'),'snapshot':bool(atual.get('valorDeclarado')),'descricaoOriginal':(atual.get('valorDeclarado') or {}).get('discriminacao'),'descricaoAtual':atual.get('discriminacao'),'selosEditado':page.locator('.badge-editado').count()}
  print(json.dumps(out,ensure_ascii=False,separators=(',',':'))); b.close()
