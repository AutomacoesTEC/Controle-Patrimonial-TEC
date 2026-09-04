# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

raiz = Path(__file__).resolve().parents[3]
perfil = json.loads((raiz / 'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
with sync_playwright() as p:
  browser = p.chromium.launch()
  pagina = browser.new_page(viewport={'width': 1366, 'height': 768})
  pagina.goto('http://localhost:4174/', wait_until='networkidle')
  pagina.evaluate("""dados=>{const id='fixture-nome';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE NOME',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""", perfil)
  pagina.reload(wait_until='networkidle')
  pagina.wait_for_selector('.saldo-hero')
  aviso=pagina.get_by_role('button',name='OK, entendi')
  if aviso.is_visible():
    aviso.click(); pagina.locator('.modal').wait_for(state='hidden')
  resultado={
    'dashboardVisivel':pagina.get_by_text('Dashboard',exact=True).count(),
    'demonstrativoVisivel':pagina.get_by_text('Demonstrativo',exact=True).count(),
    'destinoInternoPresente':pagina.locator('.nav-item.active').count()==1,
  }
  print(json.dumps(resultado,ensure_ascii=False,separators=(',',':')))
  browser.close()
