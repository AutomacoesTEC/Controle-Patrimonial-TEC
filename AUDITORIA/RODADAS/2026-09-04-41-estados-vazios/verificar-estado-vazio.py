# -*- coding: utf-8 -*-
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
  browser = p.chromium.launch()
  pagina = browser.new_page(viewport={'width': 1366, 'height': 768})
  pagina.goto('http://localhost:4174/', wait_until='networkidle')
  pagina.evaluate("""() => {
    const id = 'fixture-vazio'
    localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE VAZIO',cpf:'',apelido:'',protegido:false}]))
    localStorage.removeItem(`controle-patrimonial-data-${id}`)
    sessionStorage.setItem('controle-patrimonial-perfil-sessao', id)
  }""")
  pagina.reload(wait_until='networkidle')
  pagina.get_by_role('navigation').get_by_role('button', name='Bens e Direitos', exact=True).click()
  pagina.wait_for_selector('table')
  estado = pagina.locator('.estado-vazio')
  antes = {'linhasDados': pagina.locator('tbody tr').count(), 'estados': estado.count(),
           'titulo': None, 'contexto': None, 'acoes': 0, 'acaoAbriuModal': False}
  if estado.count():
    antes['titulo'] = estado.locator('h3').text_content()
    antes['contexto'] = estado.locator('p').text_content()
    antes['acoes'] = estado.get_by_role('button').count()
    if antes['acoes']:
      estado.get_by_role('button').click()
      try:
        pagina.locator('.modal').wait_for(state='visible', timeout=2000)
        antes['acaoAbriuModal'] = True
      except Exception:
        antes['acaoAbriuModal'] = False
  print(json.dumps(antes, ensure_ascii=False, separators=(',', ':')))
  browser.close()
