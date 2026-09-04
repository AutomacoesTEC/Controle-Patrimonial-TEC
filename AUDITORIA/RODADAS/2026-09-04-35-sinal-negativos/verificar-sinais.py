# -*- coding: utf-8 -*-
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
raiz=Path(__file__).resolve().parents[3]
perfil=json.loads((raiz/'src/store/__fixtures__/perfil-aju01-atual.json').read_text())
def concluido():
  mapa=(raiz/'MELHORIAS-PROPOSTAS-2026-09-03.md').read_text(); linha=next(x for x in mapa.splitlines() if x.startswith('### B3.'))
  return 'CONCLUÍDO' in linha
with sync_playwright() as p:
  browser=p.chromium.launch(); pagina=browser.new_page(viewport={'width':1366,'height':768})
  pagina.goto('http://localhost:4174/',wait_until='networkidle')
  pagina.evaluate("""dados=>{const id='fixture-sinais';localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id,nome:'FIXTURE SINAIS',cpf:'',apelido:'',protegido:false}]));localStorage.setItem(`controle-patrimonial-data-${id}`,JSON.stringify(dados));sessionStorage.setItem('controle-patrimonial-perfil-sessao',id)}""",perfil)
  pagina.reload(wait_until='networkidle'); pagina.wait_for_selector('td.currency.negative')
  aviso=pagina.get_by_role('button',name='OK, entendi')
  if aviso.is_visible(): aviso.click()
  def medir():
    itens=pagina.locator('td.currency').evaluate_all("""els=>els.map(td=>({rotulo:td.parentElement?.cells[0]?.textContent.replace(/\s+/g,' ').trim(),texto:td.textContent.trim(),negativa:td.classList.contains('negative')}))""")
    negativos=[x for x in itens if x['negativa']]
    zeros=[x for x in negativos if x['texto'].replace('\u00a0',' ').replace(' ','') in ('R$0,00','-R$0,00')]
    sem_sinal=[x for x in negativos if x not in zeros and '-' not in x['texto']]
    return {'quantidadeNegativas':len(negativos),'negativasNaoZeroSemSinal':sem_sinal,'zerosComClasseNegativa':zeros,'textos':[x['texto'] for x in negativos]}
  tela=medir(); pagina.emulate_media(media='print'); impresso=medir()
  print(json.dumps({'b3Concluido':concluido(),'tela':tela,'impressao':impresso},ensure_ascii=False,separators=(',',':'))); browser.close()
