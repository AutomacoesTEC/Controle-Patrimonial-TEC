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
    const id = 'fixture-legendas'
    localStorage.setItem('controle-patrimonial-perfis', JSON.stringify([{id,nome:'FIXTURE LEGENDAS',cpf:'',apelido:'',protegido:false}]))
    localStorage.setItem(`controle-patrimonial-data-${id}`, JSON.stringify(dados))
    sessionStorage.setItem('controle-patrimonial-perfil-sessao', id)
  }""", perfil)
  pagina.reload(wait_until='networkidle')
  pagina.wait_for_selector('.demonstrativo-table')
  aviso = pagina.get_by_role('button', name='OK, entendi')
  if aviso.is_visible():
    aviso.click()
    pagina.locator('.modal').wait_for(state='hidden')

  resultado = pagina.locator('table').evaluate_all("""tabelas => ({
    quantidade:tabelas.length,
    comCaption:tabelas.filter(t => t.querySelector(':scope > caption')).length,
    captions:tabelas.map(t => {
      const c=t.querySelector(':scope > caption');
      if(!c)return null;
      const s=getComputedStyle(c);
      return {texto:c.textContent.trim(),classe:c.className,posicao:s.position,
              largura:s.width,altura:s.height,clip:s.clip};
    })
  })""")
  print(json.dumps(resultado, ensure_ascii=False, separators=(',', ':')))
  browser.close()
