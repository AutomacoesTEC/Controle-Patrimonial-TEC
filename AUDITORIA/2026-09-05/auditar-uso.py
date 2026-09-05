"""Exercita o app real em contexto descartável, com CPF e valores sintéticos."""
import json
import re
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

resultados = []
erros_js = []
with sync_playwright() as p:
    executavel = sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    browser = p.chromium.launch(executable_path=str(executavel))
    page = browser.new_page(viewport={'width':1366,'height':768}, accept_downloads=True)
    page.set_default_timeout(10000)
    page.on('pageerror', lambda e: erros_js.append(str(e)))
    page.on('dialog', lambda d: d.dismiss())
    page.goto('http://127.0.0.1:5173',wait_until='networkidle')
    page.evaluate("""async () => {
      const {initialState} = await import('/src/store/reducer.js');
      const s = {...initialState, anoCalendario:2025, origemAnoAtual:'manual',
        contribuinte:{nome:'AUDITORIA SINTÉTICA',cpf:'11144477735'},
        dependentes:[{id:9,nome:'Ana sintética',cpf:'33344455508'}],
        bens:[{id:1,grupo:'01',codigo_bem:'12',discriminacao:'Casa sintética',situacao_anterior:80000,situacao_atual:100000,beneficiario:'Titular'}],
        dividas:[{id:2,codigo:'13',discriminacao:'Empréstimo sintético',situacao_anterior:60000,situacao_atual:50000,beneficiario:'Titular'}]};
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'uso',nome:'AUDITORIA SINTÉTICA',protegido:false}]));
      localStorage.setItem('controle-patrimonial-data-uso',JSON.stringify(s));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao','uso');
    }""")
    page.reload(wait_until='networkidle')

    def estado():
        return page.evaluate("JSON.parse(localStorage.getItem('controle-patrimonial-data-uso'))")

    def esperar(js):
        page.wait_for_function("() => {const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-uso'));return " + js + ";}")

    def fechar():
        page.wait_for_timeout(400)
        for _ in range(5):
            closes = page.locator('.modal-close:visible')
            if not closes.count(): break
            closes.last.click()
            page.wait_for_timeout(400)
            cancelar = page.get_by_role('button',name='Descartar alterações',exact=True)
            if cancelar.count(): cancelar.click()

    def navegar(nome, botao=None):
        fechar()
        page.locator('.sidebar-nav').get_by_text(nome,exact=True).click()
        if botao: page.get_by_role('button',name=botao,exact=False).first.wait_for()
        else: page.wait_for_timeout(400)

    def preencher(rotulo, valor):
        grupo = page.locator('.modal:visible .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^'+re.escape(rotulo)+'$')))
        grupo.locator('input, textarea').first.fill(valor)

    def pessoa():
        page.get_by_label('Titularidade',exact=True).select_option('dependente')
        page.get_by_label('Dependente',exact=True).select_option('33344455508')

    def salvar():
        page.get_by_role('button',name='Salvar',exact=True).last.click()
        page.wait_for_timeout(150)
        for _ in range(3):
            botao=page.get_by_role('button',name=re.compile('^Gravar em [0-9]+$'))
            if botao.count(): botao.last.click(); break
            page.wait_for_timeout(100)

    def ano(a):
        fechar()
        page.locator('.sidebar-footer select').select_option(str(a))
        esperar('s.anoCalendario === '+str(a))

    def caso(nome, fn):
        try:
            fn()
            resultados.append({'funcao':nome,'resultado':'PASSOU'})
        except Exception as e:
            resultados.append({'funcao':nome,'resultado':'FALHOU','erro':str(e)[:1800]})
            try: fechar()
            except Exception: pass
        print(json.dumps(resultados[-1],ensure_ascii=False),flush=True)

    def movimento():
        navegar('Bens e Direitos','Novo Bem')
        page.get_by_role('button',name='Editar',exact=True).first.click()
        page.get_by_label(re.compile('Tipo de movimentação')).select_option('benfeitoria')
        preencher('Data','2026-04-10')
        preencher('Valor da movimentação','20000,00')
        page.get_by_role('button',name='Registrar movimentação',exact=True).click()
        page.get_by_role('button',name='Confirmar',exact=True).last.click()
        esperar('s.historico[2026]?.bens[0]?.situacao_atual === 120000')
        assert estado()['bens'][0]['situacao_atual']==100000
        ano(2026)
        assert '120.000,00' in page.locator('.page-body').inner_text()
        page.reload(wait_until='networkidle')
        assert estado()['anoCalendario']==2026
        ano(2025)
    caso('Bens: benfeitoria em 2026, base 2025 intacta, troca e recarga',movimento)

    def criar_pagamento():
        navegar('Pagamentos','Novo Pagamento'); page.get_by_role('button',name=re.compile('Novo Pagamento')).click()
        pessoa(); preencher('Nome do Beneficiário','Clínica E2E'); preencher('Data','2026-03-10'); preencher('Valor Pago','500,00'); salvar()
        esperar("s.historico[2026]?.pagamentos.some(x=>x.nome_beneficiario==='Clínica E2E'&&x.cpf_titularidade==='33344455508')")
        assert estado()['anoCalendario']==2025
    caso('Pagamentos: cadastro por data com dependente identificado',criar_pagamento)

    def editar_pagamento():
        ano(2026); navegar('Pagamentos','Novo Pagamento')
        page.get_by_role('button',name='Editar',exact=True).first.click(); preencher('Data','2027-03-10'); preencher('Valor Pago','600,00'); salvar()
        esperar('s.pagamentos.length===0 && s.historico[2027]?.pagamentos[0]?.valor_pago===600')
        ano(2027); navegar('Pagamentos','Novo Pagamento'); page.get_by_role('button',name='Excluir',exact=True).first.click()
        page.get_by_role('button',name='Excluir',exact=True).last.click(); esperar('s.pagamentos.length===0'); ano(2025)
    caso('Pagamentos: edição da data move entre anos e exclusão funciona',editar_pagamento)

    def despesa():
        navegar('Despesas Gerais','Nova Despesa'); page.get_by_role('button',name=re.compile('Nova Despesa')).click()
        pessoa(); preencher('Descrição','Seguro E2E'); preencher('Data','2026-05-10'); preencher('Valor','80,00'); salvar()
        esperar("s.historico[2026]?.pagamentosDiversos.some(x=>x.descricao==='Seguro E2E'&&x.cpf_titularidade==='33344455508')")
    caso('Despesas: cadastro com data e dependente',despesa)

    def doacao():
        navegar('Doações','Nova Doação'); page.get_by_role('button',name=re.compile('Nova Doação')).click()
        pessoa(); preencher('Data do cadastro','2026-06-10'); preencher('Código','80'); preencher('Beneficiário','Entidade E2E'); preencher('Valor','120,00'); salvar()
        esperar("s.historico[2026]?.doacoesEfetuadasOficial.some(x=>x.nome_beneficiario==='Entidade E2E'&&x.data==='2026-06-10')")
    caso('Doações: data e identificação do doador',doacao)

    def rendimento():
        navegar('Rendimentos','Novo Rendimento'); page.get_by_role('button',name=re.compile('Novo Rendimento')).click()
        pessoa(); preencher('CPF/CNPJ da fonte pagadora','12.345.678/0001-95'); preencher('Nome Fonte Pagadora','Empresa E2E'); preencher('Data','2026-07-10'); preencher('Valor','3000,00'); preencher('Contribuição previdenciária oficial','300,00'); salvar()
        esperar("s.historico[2026]?.rendimentos.some(x=>x.nome_fonte==='Empresa E2E'&&x.contribuicaoPrevidenciaria===300)")
    caso('Rendimentos PJ: cadastro com previdência e dependente',rendimento)

    def tipos_rendimento():
        navegar('Rendimentos','Novo Rendimento'); page.get_by_role('button',name=re.compile('Novo Rendimento')).click()
        tipos = [('tributavel_pj','13º salário líquido'),('tributavel_pf_exterior','Despesas de livro-caixa'),('tributavel_rra','Número de meses'),('isento_07','Descrição da operação')]
        for tipo, campo in tipos:
            page.get_by_label('Tipo',exact=True).select_option(tipo)
            assert page.locator('.modal label').filter(has_text=campo).count()>0
        fechar()
    caso('Rendimentos: campos variam entre PJ, PF/exterior, RRA e isentos',tipos_rendimento)

    def bem():
        navegar('Bens e Direitos','Novo Bem'); page.get_by_role('button',name=re.compile('Novo Bem')).first.click()
        pessoa(); preencher('Data de aquisição','2026-08-10'); preencher('Código do Bem','12'); preencher('Discriminação','Apartamento E2E'); preencher('Situação em 31/12 (Ano Atual)','70000,00'); salvar()
        esperar("s.historico[2026]?.bens.some(x=>x.discriminacao==='Apartamento E2E'&&x.cpf_beneficiario==='33344455508')")
    caso('Bens: aquisição cria patrimônio no ano da data e informa dependente',bem)

    def divida():
        navegar('Dívidas e Ônus','Nova Dívida'); page.get_by_role('button',name=re.compile('Nova Dívida')).click()
        pessoa(); preencher('Data do cadastro','2026-08-11'); preencher('Discriminação','Dívida E2E'); preencher('Situação 31/12 Atual','15000,00'); salvar()
        esperar("s.historico[2026]?.dividas.some(x=>x.discriminacao==='Dívida E2E'&&x.data==='2026-08-11')")
    caso('Dívidas: cadastro datado e titularidade',divida)

    def recorte():
        ano(2026); navegar('Demonstrativo')
        seletor=page.get_by_label('Visão do demonstrativo',exact=True); seletor.wait_for()
        for value in ['titular','33344455508','todos']:
            seletor.select_option(value); page.wait_for_timeout(200)
            assert page.locator('.dashboard-saldo-heroi').count() or page.get_by_text('Saldo de Caixa',exact=False).count()
        page.screenshot(path=str(Path(__file__).parent/'demonstrativo-1366.png'),full_page=True)
    caso('Demonstrativo: visão geral, titular e dependente sem erro de renderização',recorte)

    def tabelas():
        for nome, botao in [('Bens e Direitos','Novo Bem'),('Dívidas e Ônus','Nova Dívida'),('Pagamentos','Novo Pagamento'),('Doações','Nova Doação'),('Atividade Rural','Novo Imóvel')]:
            navegar(nome,botao)
            assert page.get_by_role('button',name='Compacto',exact=True).count()==0
            alca=page.locator('.rdz-puxador').first
            alca.wait_for()
            table=page.locator('.page-body table').first
            antes=table.locator('tr').first.locator('th,td').first.bounding_box()['width']
            box=alca.bounding_box(); page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.mouse.move(box['x']+100,box['y']+box['height']/2);page.mouse.up()
            depois=table.locator('tr').first.locator('th,td').first.bounding_box()['width']
            assert abs(depois-antes)>30, (nome,antes,depois)
        navegar('Dívidas e Ônus','Nova Dívida')
        page.screenshot(path=str(Path(__file__).parent/'dividas-1366.png'),full_page=True)
    caso('Tabelas: arraste real nas divisórias, sem Compacto',tabelas)

    def selecionar(rotulo, valor):
        page.locator('.modal:visible .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^'+re.escape(rotulo)+'$'))).locator('select').select_option(valor)

    def dependente_crud():
        ano(2026); navegar('Titular e Dependentes','Novo Dependente')
        page.get_by_role('button',name=re.compile('Novo Dependente')).click()
        preencher('Nome Completo','Dependente E2E temporário'); preencher('CPF','52998224725'); preencher('Data do cadastro','2026-02-01'); salvar()
        esperar("s.dependentes.some(x=>x.nome==='Dependente E2E temporário')")
        row=page.locator('tr').filter(has_text='Dependente E2E temporário')
        row.get_by_role('button',name='Editar',exact=True).click(); preencher('Nome Completo','Dependente E2E revisado'); salvar()
        esperar("s.dependentes.some(x=>x.nome==='Dependente E2E revisado')")
        page.locator('tr').filter(has_text='Dependente E2E revisado').get_by_role('button',name='Excluir',exact=True).click()
        page.get_by_role('button',name='Excluir',exact=True).last.click(); esperar('s.dependentes.length===1')
    caso('Dependentes: inclusão, edição e exclusão sem remover os demais',dependente_crud)

    def rural_cadastros():
        ano(2025); navegar('Atividade Rural','Novo Imóvel')
        page.get_by_role('button',name=re.compile('Novo Imóvel')).click()
        pessoa(); preencher('Nome e Localização','Fazenda E2E'); preencher('Data de Aquisição','2026-01-02'); salvar()
        esperar("s.historico[2026]?.imoveisRurais.some(x=>x.nomeLocalizacao==='Fazenda E2E')")
        fechar(); page.get_by_role('button',name='Bens da Atividade Rural',exact=True).click()
        page.get_by_role('button',name=re.compile('Novo Bem')).click(); pessoa()
        preencher('Data do cadastro','2026-02-02'); preencher('Discriminação','Trator E2E'); preencher('Situação em 31/12 (Ano Atual)','50000,00'); salvar()
        esperar("s.historico[2026]?.bensRurais.some(x=>x.discriminacao==='Trator E2E')")
        fechar(); page.get_by_role('button',name='Dívidas Vinculadas',exact=True).click()
        page.get_by_role('button',name=re.compile('Nova Dívida')).click(); pessoa()
        preencher('Data do cadastro','2026-03-02'); preencher('Discriminação','Crédito Rural E2E'); preencher('Situação 31/12 Atual','20000,00'); salvar()
        esperar("s.historico[2026]?.dividasRurais.some(x=>x.discriminacao==='Crédito Rural E2E')")
        fechar(); page.get_by_role('button',name='Receitas e Despesas',exact=True).click()
        page.get_by_role('button',name=re.compile('Novo Lançamento')).click(); pessoa()
        preencher('Data','2026-04-02'); preencher('Descrição','Venda rural E2E'); preencher('Valor','2000,00'); salvar()
        esperar("s.historico[2026]?.lancamentosRurais.some(x=>x.descricao==='Venda rural E2E')")
        assert estado()['anoCalendario']==2025
        ano(2026)
    caso('Rural: quatro cadastros datados com dependente em ano não ativo',rural_cadastros)

    def rural_edicao():
        navegar('Atividade Rural')
        page.get_by_role('button',name='Receitas e Despesas',exact=True).click()
        page.locator('tr').filter(has_text='Venda rural E2E').get_by_role('button',name='Editar',exact=True).click()
        preencher('Data','2027-04-02'); preencher('Valor','2100,00'); salvar()
        esperar('s.lancamentosRurais.length===0 && s.historico[2027]?.lancamentosRurais[0]?.valor===2100')
        ano(2027)
        page.locator('tr').filter(has_text='Venda rural E2E').get_by_role('button',name='Excluir',exact=True).click()
        page.get_by_role('button',name='Excluir',exact=True).last.click(); esperar('s.lancamentosRurais.length===0'); ano(2026)
    caso('Rural: edição de data transporta lançamento e permite exclusão',rural_edicao)

    def rv_cadastros():
        navegar('Renda Variável','Incluir mês (Comuns)')
        page.get_by_role('button',name=re.compile('Incluir mês \\(Comuns\\)')).click()
        selecionar('Mês','3'); preencher('Resultado líquido comuns','1000,00'); preencher('Imposto pago (DARF), se diferente do apurado','150,00'); salvar()
        esperar('s.rendaVariavelMensalManual.some(x=>Number(x.mes)===3)')
        fechar(); page.get_by_role('button',name=re.compile('Incluir mês \\(FII\\)')).click()
        selecionar('Mês','4'); preencher('Resultado líquido do mês','500,00'); preencher('Imposto pago (DARF), se diferente do apurado','100,00'); salvar()
        esperar('s.fiiFiagroMensalManual.some(x=>Number(x.mes)===4)')
        assert estado()['anoCalendario']==2026
    caso('Renda variável: meses comuns e FII com DARF informado',rv_cadastros)

    downloads=Path(tempfile.mkdtemp(prefix='cptec-auditoria-downloads-'))
    def exportacoes():
        for nome,botao in [('Bens e Direitos','Novo Bem'),('Dívidas e Ônus','Nova Dívida'),('Rendimentos','Novo Rendimento'),('Despesas Gerais','Nova Despesa'),('Doações','Nova Doação'),('Relatório IRPF',None)]:
            navegar(nome,botao)
            exportar=page.get_by_role('button',name=re.compile(r'^Exportar (Relatório )?\.xlsx$')).first;exportar.wait_for()
            with page.expect_download() as info: exportar.click()
            d=info.value;d.save_as(downloads/d.suggested_filename)
            assert (downloads/d.suggested_filename).stat().st_size>500
        with page.expect_download() as info: page.get_by_role('button',name='Exportar Backup',exact=True).click()
        d=info.value;d.save_as(downloads/d.suggested_filename)
        json.loads((downloads/d.suggested_filename).read_text())
    caso('Exportações: seis fichas XLSX e backup JSON baixados',exportacoes)

    print(json.dumps({'resultados':resultados,'errosJavascript':erros_js,'downloadsTemporarios':str(downloads)},ensure_ascii=False,indent=2),flush=True)
    browser.close()
    if erros_js or any(r['resultado']=='FALHOU' for r in resultados): raise SystemExit(1)
