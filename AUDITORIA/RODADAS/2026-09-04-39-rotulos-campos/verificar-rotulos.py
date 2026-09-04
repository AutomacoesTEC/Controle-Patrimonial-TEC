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
    const id = 'fixture-rotulos'
    localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE RÓTULOS',cpf:'',apelido:'',protegido:false}]))
    localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados))
    sessionStorage.setItem('controle-patrimonial-perfil-sessao', id)
  }""", perfil)
  pagina.reload(wait_until='networkidle')
  pagina.wait_for_selector('.saldo-hero')
  aviso = pagina.get_by_role('button', name='OK, entendi')
  if aviso.is_visible():
    aviso.click()
    pagina.locator('.modal').wait_for(state='hidden')
  pagina.get_by_role('navigation').get_by_role('button', name='Bens e Direitos', exact=True).click()
  pagina.locator('.page-header-actions .btn-primary').click()
  pagina.wait_for_selector('.modal')

  resultado = pagina.locator('input,select,textarea').evaluate_all("""campos => {
    const itens = campos.map((e, indice) => ({
      indice, tag:e.tagName.toLowerCase(), type:e.type || null,
      labels:e.labels?.length || 0, aria:e.getAttribute('aria-label'),
      valor:e.value
    }))
    return {quantidade:itens.length, semNome:itens.filter(i => !i.labels && !i.aria).length,
            tipos:itens.map(i => `${i.tag}:${i.type}`), valores:itens.map(i => i.valor), itens}
  }""")
  print(json.dumps(resultado, ensure_ascii=False, separators=(',', ':')))
  browser.close()
