"""Fixture isolado. Não usa o perfil do navegador da usuária."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    executaveis = sorted((Path.home() / '.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))
    browser = p.chromium.launch(executable_path=str(executaveis[-1]))
    page = browser.new_page(viewport={"width": 1366, "height": 768})
    page.goto('http://127.0.0.1:5173', wait_until='networkidle')
    page.evaluate("""async () => {
      const {initialState} = await import('/src/store/reducer.js');
      const s = {...initialState, anoCalendario:2025, origemAnoAtual:'manual',
        contribuinte:{nome:'TESTE SINTÉTICO',cpf:'11144477735'},
        dependentes:[{id:9,nome:'Dependente sintético',cpf:'33344455508'}],
        bens:[{id:1,grupo:'01',codigo_bem:'12',discriminacao:'Casa sintética',situacao_anterior:80000,situacao_atual:100000,beneficiario:'Titular'}],
        dividas:[{id:2,codigo:'13',discriminacao:'Empréstimo sintético',situacao_anterior:60000,situacao_atual:50000}],
        imoveisRurais:[{id:3,nomeLocalizacao:'Fazenda sintética',area:12,cib:'1234567-8',participacao:100}],
        pagamentos:[{id:4,codigo:'21',nome_beneficiario:'Clínica sintética',valor_pago:500,parcela_nao_dedutivel:0,data:'2025-03-10'}]};
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'auditoria',nome:'TESTE SINTÉTICO',protegido:false}]));
      localStorage.setItem('controle-patrimonial-data-auditoria',JSON.stringify(s));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao','auditoria');
    }""")
    page.reload(wait_until='networkidle')
    resultados = []
    for nome, novo in [('Bens e Direitos','Novo Bem'),('Dívidas e Ônus','Nova Dívida'),('Rendimentos','Novo Rendimento'),('Pagamentos','Novo Pagamento'),('Despesas Gerais','Nova Despesa'),('Doações','Nova Doação'),('Atividade Rural','Novo Imóvel'),('Titular e Dependentes','Novo Dependente')]:
        page.locator('.sidebar-nav').get_by_text(nome, exact=True).click()
        page.get_by_role('button',name=novo,exact=False).first.wait_for(state='visible')
        page.wait_for_timeout(200)
        r = page.evaluate("""() => ({
          compactos:[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Compacto').length,
          abasVerticais:[...document.querySelectorAll('.tabs')].filter(e=>e.scrollHeight>e.clientHeight+1).length,
          tabelas:[...document.querySelectorAll('.page-body table')].map(t=>({
            colunas:t.tHead?.rows[0]?.cells.length || 0,
            alcas:t.parentElement.querySelectorAll('.rdz-puxador').length,
            fixas:[...(t.tBodies[0]?.rows[0]?.cells||[])].filter(c=>getComputedStyle(c).position==='sticky').length
          }))
        })""")
        page.get_by_role('button',name=novo,exact=False).first.click()
        page.wait_for_timeout(100)
        r.update(page.evaluate("""() => ({
          camposAno:[...document.querySelectorAll('.modal label')].filter(l=>l.textContent.toLowerCase().includes('ano-calendário')).length,
          camposData:document.querySelectorAll('.modal input[type=date]').length
        })"""))
        r['ficha'] = nome
        resultados.append(r)
        page.locator('.modal-close').last.click()
    print(json.dumps(resultados,ensure_ascii=False,indent=2))
    browser.close()
