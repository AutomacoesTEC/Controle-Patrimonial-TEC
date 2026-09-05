"""Dados sintéticos em contexto descartável; não acessa perfis do usuário."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    exe = sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    browser = p.chromium.launch(executable_path=str(exe))
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:5173', wait_until='networkidle')
    page.evaluate("""async () => {
      const {initialState} = await import('/src/store/reducer.js');
      const s = {...initialState, anoCalendario:2026, origemAnoAtual:'manual',
        contribuinte:{nome:'Teste imagens',cpf:'11144477735'},
        dependentes:[{id:9,nome:'Ana sintética',cpf:'33344455508'}],
        bens:[{id:1,grupo:'02',codigo_bem:'01',discriminacao:'Bem titular',situacao_anterior:0,situacao_atual:100,beneficiario:'Titular'},
              {id:2,grupo:'02',codigo_bem:'01',discriminacao:'Bem dependente',numeroItem:'7',situacao_anterior:0,situacao_atual:200,titularidade:'dependente',cpf_titularidade:'33344455508'}]};
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'imagens',nome:'Teste imagens',protegido:false}]));
      localStorage.setItem('controle-patrimonial-data-imagens',JSON.stringify(s));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao','imagens');
    }""")
    page.reload(wait_until='networkidle')
    for _ in range(3):
        close = page.locator('.modal-close:visible')
        if close.count(): close.last.click()
    page.locator('.sidebar-nav').get_by_text('Bens e Direitos', exact=True).click()
    filtro = page.get_by_label('Filtrar bens por titularidade')
    expect(page.locator('.tabela-bens tbody tr')).to_have_count(2)
    assert page.locator('.tabela-bens th').filter(has_text='Titularidade').count() == 1
    filtro.select_option('33344455508')
    assert page.locator('.tabela-bens tbody tr').count() == 1
    assert '200,00' in page.locator('.page-header-left').inner_text()
    filtro.select_option('titular')
    assert page.locator('.tabela-bens th').first.inner_text().casefold() == 'titularidade'
    assert '100,00' in page.locator('.page-header-left').inner_text()
    align = page.locator('.tabela-bens tbody tr').first.locator('td').evaluate_all('(cells)=>cells.slice(0,3).map(c=>getComputedStyle(c).textAlign)')
    assert align == ['center'] * 3, align
    page.get_by_role('button', name='Editar', exact=True).click()
    assert not page.get_by_label('Titularidade', exact=True).is_visible()
    page.get_by_role('button', name='Mostrar mais', exact=True).click()
    assert page.get_by_label('Titularidade', exact=True).is_visible()
    page.locator('.modal-close:visible').last.click()
    page.get_by_role('button', name='Novo Bem', exact=False).click()
    assert page.get_by_label('Titularidade', exact=True).is_visible()
    page.locator('.modal-close:visible').last.click()
    page.locator('.sidebar-nav').get_by_text('Demonstrativo', exact=True).click()
    assert page.get_by_text('Diferença de conciliação', exact=True).is_visible()
    assert page.get_by_text('Tolerância para “fecha”', exact=True).count() == 0
    assert not errors, errors
    print(json.dumps({'resultado':'PASSOU','filtros':'geral/titular/dependente','alinhamento':align,'edicao_recolhida':True,'cadastro_visivel':True,'residual_identificado':True,'errosJavascript':errors}, ensure_ascii=False))
    browser.close()
