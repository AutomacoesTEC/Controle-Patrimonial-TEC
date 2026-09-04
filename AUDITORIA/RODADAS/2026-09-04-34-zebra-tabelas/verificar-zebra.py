# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
with sync_playwright() as p:
  browser=p.chromium.launch(); pagina=browser.new_page(viewport={'width':1366,'height':768})
  pagina.goto('http://localhost:4174/',wait_until='networkidle')
  pagina.evaluate("""dados=>{const id='fixture-zebra';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE ZEBRA',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));localStorage.removeItem('cp-tec-tabelas-compactas');sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
  pagina.reload(wait_until='networkidle'); pagina.wait_for_selector('.saldo-hero')
  aviso=pagina.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click()
  pagina.get_by_role('navigation').get_by_role('button',name='Bens e Direitos',exact=True).click(); pagina.wait_for_selector('.table-container tbody tr:nth-child(2)')
  def medir():
    return pagina.evaluate("""() => {const rows=[...document.querySelectorAll('.table-container tbody tr')].slice(0,2);const td=rows[0].cells[0];const s=getComputedStyle(td);return {fundos:rows.map(r=>getComputedStyle(r).backgroundColor),diferentes:getComputedStyle(rows[0]).backgroundColor!==getComputedStyle(rows[1]).backgroundColor,padding:{vertical:s.paddingTop,horizontal:s.paddingLeft},textos:rows.map(r=>r.textContent.replace(/\s+/g,' ').trim())}}""")
  escuro=medir(); pagina.locator('.theme-toggle-fixed').click(); pagina.wait_for_timeout(350); claro=medir()
  print(json.dumps({'escuro':escuro,'claro':claro},ensure_ascii=False,separators=(',',':'))); browser.close()
