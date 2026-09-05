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
    page.screenshot(path='/tmp/cptec-revisao-bens.png',full_page=True)
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
    # Novo DARF: não herdar imposto apurado como se fosse quitação.
    page.locator('.sidebar-nav').get_by_text('Renda Variável', exact=True).click()
    page.get_by_role('button',name='Incluir mês (Comuns)',exact=False).click()
    grupo = page.locator('.modal:visible .form-group').filter(has=page.locator('label',has_text='Resultado líquido comuns'))
    grupo.locator('input').first.fill('1000,00')
    pago = page.locator('.modal:visible .form-group').filter(has=page.locator('label',has_text='Imposto efetivamente pago (DARF)'))
    assert pago.locator('input').first.input_value() in ['0,00','0',''], pago.locator('input').first.input_value()
    pago.locator('input').first.fill('150,00')
    page.get_by_label('Confirmo o pagamento deste DARF').check()
    page.get_by_role('button',name='Salvar',exact=True).last.click()
    page.wait_for_function("JSON.parse(localStorage.getItem('controle-patrimonial-data-imagens')).rendaVariavelMensalManual.some(r=>r.pagamentoDarfConfirmado===true)")
    # DAA importada: data financeira não transporta a ficha fiscal de 2025.
    page.evaluate("""() => {
      const k='controle-patrimonial-data-imagens';const s=JSON.parse(localStorage.getItem(k));
      s.historico={...(s.historico||{}),2025:{...s,anoCalendario:2025,historico:{},doacoesEcaIdosoOficial:[{id:991,codigo:'40',nome_beneficiario:'Fundo sintético',valor:1000,origem:'importacao',categoria:'eca'}]}};
      s.anoCalendario=2025;s.doacoesEcaIdosoOficial=s.historico[2025].doacoesEcaIdosoOficial;
      localStorage.setItem(k,JSON.stringify(s));
    }""")
    page.reload(wait_until='networkidle')
    for _ in range(3):
        close = page.locator('.modal-close:visible')
        if close.count(): close.last.click()
    page.locator('.sidebar-nav').get_by_text('Doações',exact=True).click()
    page.get_by_role('button',name='Doações Diretamente na Declaração (ECA e Pessoa Idosa)',exact=True).click()
    page.get_by_role('button',name='Editar',exact=True).first.click()
    page.locator('.modal:visible input[type=date]').fill('2026-05-10')
    page.get_by_role('button',name='Salvar',exact=True).last.click()
    page.wait_for_function("(()=>{const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-imagens'));return s.anoCalendario===2025&&s.doacoesEcaIdosoOficial.some(d=>d.id===991&&d.data==='2026-05-10')})()")
    assert not errors, errors
    print(json.dumps({'resultado':'PASSOU','filtros':'geral/titular/dependente','alinhamento':align,'edicao_recolhida':True,'cadastro_visivel':True,'residual_identificado':True,'darf_sem_presuncao':True,'daa_ano_fiscal_preservado':True,'errosJavascript':errors}, ensure_ascii=False))
    browser.close()
