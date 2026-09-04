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
  pagina.evaluate("""dados => {
    const id = 'fixture-linhas-teclado'
    localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE LINHAS',cpf:'',apelido:'',protegido:false}]))
    localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados))
    sessionStorage.setItem('controle-patrimonial-perfil-sessao', id)
  }""", perfil)
  pagina.reload(wait_until='networkidle')
  pagina.wait_for_selector('.demonstrativo-total-clicavel')
  aviso = pagina.get_by_role('button', name='OK, entendi')
  if aviso.is_visible():
    aviso.click()
    pagina.locator('.modal').wait_for(state='hidden')

  linhas = pagina.locator('.demonstrativo-total-clicavel')
  atributos = linhas.evaluate_all("els => els.map(e => ({role:e.getAttribute('role'),tabIndex:e.tabIndex}))")

  primeira = linhas.first
  primeira.focus()
  pagina.keyboard.press('Enter')
  abriu_enter = pagina.locator('.modal').is_visible()
  if abriu_enter:
    pagina.locator('.modal-close').click()
    pagina.locator('.modal').wait_for(state='hidden')

  primeira.focus()
  pagina.keyboard.press('Space')
  abriu_espaco = pagina.locator('.modal').is_visible()
  if abriu_espaco:
    pagina.locator('.modal-close').click()
    pagina.locator('.modal').wait_for(state='hidden')

  primeira.click()
  abriu_clique = pagina.locator('.modal').is_visible()

  print(json.dumps({'quantidade': linhas.count(), 'atributos': atributos,
                    'enterAbriu': abriu_enter, 'espacoAbriu': abriu_espaco,
                    'cliqueAbriu': abriu_clique}, ensure_ascii=False, separators=(',', ':')))
  browser.close()
