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
    const id = 'fixture-foco-global'
    localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE FOCO',cpf:'',apelido:'',protegido:false}]))
    localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados))
    sessionStorage.setItem('controle-patrimonial-perfil-sessao', id)
    localStorage.setItem('controle-patrimonial-theme', 'dark')
  }""", perfil)
  pagina.reload(wait_until='networkidle')
  pagina.wait_for_selector('.demonstrativo-total-clicavel')
  aviso = pagina.get_by_role('button', name='OK, entendi')
  if aviso.is_visible():
    aviso.click()
    pagina.locator('.modal').wait_for(state='hidden')

  pagina.keyboard.press('Tab')
  seletores = ['.nav-item', '.theme-toggle-fixed', '.demonstrativo-total-clicavel']
  resultado = []
  for seletor in seletores:
    item = pagina.locator(seletor).first
    item.focus()
    pagina.wait_for_timeout(250)
    resultado.append(item.evaluate("""e => {const s=getComputedStyle(e);return {
      seletor:e.matches('.nav-item')?'.nav-item':e.matches('.theme-toggle-fixed')?'.theme-toggle-fixed':'.demonstrativo-total-clicavel',
      focusVisible:e.matches(':focus-visible'),style:s.outlineStyle,width:s.outlineWidth,
      color:s.outlineColor,offset:s.outlineOffset,accent:getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()
    }}"""))

  print(json.dumps(resultado, ensure_ascii=False, separators=(',', ':')))
  browser.close()
