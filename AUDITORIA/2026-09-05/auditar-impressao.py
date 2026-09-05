"""Fixture AJU versionada; mede tabelas impressas em largura A4, sem dados reais."""
import json
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

saida=Path(tempfile.mkdtemp(prefix='cptec-impressao-'))
with sync_playwright() as p:
    exe=sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    browser=p.chromium.launch(executable_path=str(exe))
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.goto('http://127.0.0.1:5173',wait_until='networkidle')
    page.evaluate("""async () => {
      const s=await (await fetch('/src/store/__fixtures__/perfil-aju01-atual.json')).json();
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'impressao',nome:'SINTÉTICO',protegido:false}]));
      localStorage.setItem('controle-patrimonial-data-impressao',JSON.stringify(s));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao','impressao');
    }""")
    page.reload(wait_until='networkidle')
    page.wait_for_timeout(500)
    if page.get_by_role('button',name='Fechar aviso',exact=True).count():
        page.get_by_role('button',name='Fechar aviso',exact=True).click();page.wait_for_timeout(300)
    page.locator('.sidebar-nav').get_by_text('Relatório IRPF',exact=True).click()
    page.get_by_role('button',name='Exportar Relatório .xlsx',exact=True).wait_for()
    page.wait_for_timeout(500)
    page.emulate_media(media='print');page.set_viewport_size({'width':794,'height':1123})
    medidas=page.locator('.table-container:visible').evaluate_all("""xs=>xs.map(x=>{const t=x.querySelector(':scope > table');const r=t.getBoundingClientRect();const c=x.getBoundingClientRect();return {larguraTabela:r.width,larguraContainer:c.width,excesso:Math.max(0,r.right-c.right),ultimoTitulo:t.querySelector('thead th:last-child')?.textContent}})""")
    page.screenshot(path=str(saida/'impressao.png'),full_page=True)
    page.pdf(path=str(saida/'relatorio.pdf'),format='A4',print_background=True)
    print(json.dumps({'medidas':medidas,'artefatos_externos':str(saida)},ensure_ascii=False,indent=2))
    browser.close()
    assert all(x['excesso']<2 for x in medidas),'Tabela cortada na largura de impressão'
