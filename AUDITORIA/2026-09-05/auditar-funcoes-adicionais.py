"""E2E suplementar em perfil sintético descartável; executar só com produção congelada."""
import json
import os
import re
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

resultados = []
erros_js = []
artefatos = Path(tempfile.mkdtemp(prefix='cptec-funcoes-adicionais-'))

with sync_playwright() as p:
    executavel = sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    browser = p.chromium.launch(executable_path=str(executavel))
    page = browser.new_page(viewport={'width': 1440, 'height': 900}, accept_downloads=True)
    page.set_default_timeout(8000)
    page.on('pageerror', lambda e: erros_js.append(str(e)))
    page.on('dialog', lambda d: d.dismiss())
    page.goto('http://127.0.0.1:5173', wait_until='networkidle')

    def reiniciar():
        page.evaluate("""async () => {
          const {initialState} = await import('/src/store/reducer.js');
          const bem=(id,nome,rural=false)=>({id,grupo:'01',codigo_bem:'12',codigo:rural?'16':undefined,discriminacao:nome,origem:'manual',data:'2026-01-01',data_aquisicao:'2025-01-01',beneficiario:'Titular',situacao_anterior:100,situacao_atual:120,movimentacoes:[{id:id+100,data:'2026-02-01',tipo:'benfeitoria',valor:20}]});
          const divida=(id,nome)=>({id,codigo:'13',discriminacao:nome,origem:'manual',data:'2025-01-01',beneficiario:'Titular',situacao_anterior:100,situacao_atual:80,movimentacoes:[{id:id+100,data:'2026-02-01',tipo:'amortizacao',valor:20}]});
          const doacao=(id,nome)=>({id,codigo:'80',categoria:'eca',nome_beneficiario:nome,cpf_cnpj:'11144477735',origem:'manual',beneficiario:'Titular',data:'2026-01-01',valor:100,descricao:'Sintético'});
          const s={...initialState,anoCalendario:2026,origemAnoAtual:'manual',contribuinte:{nome:'AUDITORIA ADICIONAL SINTÉTICA',cpf:'11144477735'},
            bens:[bem(1,'Alfa sintético'),bem(2,'Zulu sintético')],dividas:[divida(3,'Dívida sintética')],bensRurais:[bem(4,'Trator sintético',true)],dividasRurais:[divida(5,'Crédito rural sintético')],
            imoveisRurais:[{id:6,nomeLocalizacao:'Fazenda sintética',area:10,participacao:100,dataAquisicao:'2025-01-01',origem:'manual',beneficiario:'Titular'}],
            prejuizoRuralAcompensar:-100,lancamentosRurais:[{id:7,data:'2026-01-01',tipo:'receita',descricao:'Colheita sintética',valor:200}],
            rendimentos:[{id:10,tipo:'tributavel_pj',nome_fonte:'Fonte sintética',cnpj_fonte:'12345678000195',data:'2026-01-01',beneficiario:'Titular',valor:100,irrf:0,origem:'manual'},{id:11,tipo:'tributavel_pj',nome_fonte:'Fonte importada sintética',data:'2026-01-01',beneficiario:'Titular',valor:200,origem:'importacao'}],
            pagamentosDiversos:[{id:20,descricao:'Seguro sintético',categoria:'outros',data:'2026-01-01',valor:100,origem:'manual',beneficiario:'Titular'}],
            doacoesEfetuadasOficial:[doacao(30,'Entidade sintética')],doacoesPartidosOficial:[doacao(31,'Partido sintético')],doacoesEcaIdosoOficial:[doacao(32,'Fundo sintético')],
            alteracoes:[{id:'a',data:'2026-01-10T12:00:00Z',anoCalendario:2026,descricao:'Evento janeiro sintético'},{id:'b',data:'2026-02-10T12:00:00Z',anoCalendario:2026,descricao:'Evento fevereiro sintético'}]};
          localStorage.clear();sessionStorage.clear();
          localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'adicional',nome:'AUDITORIA ADICIONAL SINTÉTICA',protegido:false}]));
          localStorage.setItem('controle-patrimonial-data-adicional',JSON.stringify(s));
          sessionStorage.setItem('controle-patrimonial-perfil-sessao','adicional');
        }""")
        page.reload(wait_until='networkidle')

    def estado():
        return page.evaluate("JSON.parse(localStorage.getItem('controle-patrimonial-data-adicional'))")

    def esperar(expressao):
        page.wait_for_function("() => {const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-adicional'));return " + expressao + ";}")

    def navegar(nome):
        page.locator('.sidebar-nav').get_by_text(nome, exact=True).click()
        page.wait_for_timeout(200)

    def preencher(rotulo, valor):
        grupo = page.locator('.modal:visible .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^'+re.escape(rotulo)+'$')))
        grupo.locator('input,textarea').first.fill(valor)

    def selecionar(rotulo, valor):
        page.locator('.modal:visible .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^'+re.escape(rotulo)+'$'))).locator('select').select_option(valor)

    def salvar():
        page.get_by_role('button', name=re.compile(r'^Salvar(?: Dados do Bem| Dados da Dívida)?$')).last.click()
        page.wait_for_timeout(250)

    def excluir_linha(nome):
        page.locator('tr').filter(has_text=nome).get_by_role('button', name='Excluir', exact=True).click()
        page.get_by_role('button', name='Excluir', exact=True).last.click()

    def caso(nome, fn):
        if os.environ.get('CPTEC_CASO') and os.environ['CPTEC_CASO'].casefold() not in nome.casefold():
            return
        try:
            reiniciar()
            detalhe = fn()
            resultados.append({'funcao': nome, 'resultado': 'PASSOU', 'detalhe': detalhe})
        except Exception as e:
            screenshot=artefatos/f'falha-{len(resultados)+1}.png'
            try: page.screenshot(path=str(screenshot),full_page=True)
            except Exception: pass
            resultados.append({'funcao': nome, 'resultado': 'FALHOU_A_CLASSIFICAR', 'erro':str(e)[:1800], 'captura':str(screenshot)})
        print(json.dumps(resultados[-1],ensure_ascii=False),flush=True)

    def rendimento():
        navegar('Rendimentos')
        page.locator('tr').filter(has_text='Fonte sintética').get_by_role('button',name='Editar',exact=True).click()
        preencher('Valor','150,00');salvar();esperar('s.rendimentos.find(x=>x.id===10)?.valor===150')
        excluir_linha('Fonte sintética');esperar('s.rendimentos.length===1 && s.rendimentos[0].id===11')
        assert any('rendimento' in a['descricao'] for a in estado()['alteracoes'])
        return 'Editou valor, excluiu apenas alvo e registrou histórico.'
    caso('Rendimentos: editar/excluir com preservação de outra linha',rendimento)

    def despesa():
        navegar('Despesas Gerais');page.get_by_role('button',name='Editar',exact=True).click()
        preencher('Valor','180,00');preencher('Descrição','Seguro revisado sintético');salvar()
        esperar("s.pagamentosDiversos[0]?.valor===180 && s.pagamentosDiversos[0]?.descricao==='Seguro revisado sintético'")
        excluir_linha('Seguro revisado sintético');esperar('s.pagamentosDiversos.length===0')
    caso('Despesas Gerais: editar e excluir',despesa)

    for aba,colecao,nome in [
        ('Doações Efetuadas','doacoesEfetuadasOficial','Entidade sintética'),
        ('Doações a Partidos Políticos e Candidatos','doacoesPartidosOficial','Partido sintético'),
        ('Doações Diretamente na Declaração (ECA e Pessoa Idosa)','doacoesEcaIdosoOficial','Fundo sintético'),
    ]:
        def doacao(aba=aba,colecao=colecao,nome=nome):
            navegar('Doações');page.get_by_role('button',name=aba,exact=True).click()
            page.locator('tr').filter(has_text=nome).get_by_role('button',name='Editar',exact=True).click()
            preencher('Valor','160,00');salvar();esperar(f's.{colecao}[0]?.valor===160')
            with page.expect_download() as info: page.get_by_role('button',name='Exportar .xlsx',exact=True).click()
            download=info.value;download.save_as(artefatos/download.suggested_filename)
            excluir_linha(nome);esperar(f's.{colecao}.length===0')
            return 'Editou, baixou Excel e excluiu o registro.'
        caso(aba+': edição/exclusão/exportação',doacao)

    for pagina,subaba,campo,nome,valor_final in [
        ('Bens e Direitos',None,'bens','Alfa sintético',130),
        ('Dívidas e Ônus',None,'dividas','Dívida sintética',70),
        ('Atividade Rural','Bens da Atividade Rural','bensRurais','Trator sintético',130),
        ('Atividade Rural','Dívidas Vinculadas','dividasRurais','Crédito rural sintético',70),
    ]:
        def movimentos(pagina=pagina,subaba=subaba,campo=campo,nome=nome,valor_final=valor_final):
            navegar(pagina)
            if subaba: page.get_by_role('button',name=subaba,exact=True).click()
            page.locator('tr').filter(has_text=nome).get_by_role('button',name='Editar',exact=True).click()
            page.get_by_title('Editar esta movimentação',exact=True).click()
            preencher('Valor da movimentação','30,00')
            page.get_by_role('button',name='Salvar correção',exact=True).click()
            esperar(f's.{campo}[0]?.situacao_atual==={valor_final}')
            page.get_by_title('Excluir esta movimentação',exact=True).click()
            page.get_by_role('button',name='Excluir',exact=True).last.click()
            esperar(f's.{campo}[0]?.movimentacoes.length===0 && s.{campo}[0]?.situacao_atual===100')
            return 'Corrigiu movimento 20→30, excluiu e recuperou saldo base 100.'
        caso(campo+': editar e excluir movimento existente',movimentos)

    def filtros():
        navegar('Rendimentos');page.get_by_label('Filtrar por origem',exact=True).select_option('manual')
        assert page.locator('tbody').inner_text().count('Fonte importada sintética')==0
        assert 'Fonte sintética' in page.locator('tbody').inner_text()
        page.get_by_label('Filtrar por origem',exact=True).select_option('importacao')
        assert 'Fonte importada sintética' in page.locator('tbody').inner_text()
        navegar('Bens e Direitos');busca=page.get_by_placeholder('Buscar por descrição, CNPJ, RENAVAM...')
        busca.fill('Zulu');assert page.locator('tbody tr').count()==1;busca.fill('')
        page.get_by_role('columnheader',name=re.compile('Discriminação')).click()
        assert 'Alfa sintético' in page.locator('tbody tr').first.inner_text()
        page.get_by_role('columnheader',name=re.compile('Discriminação')).click()
        assert 'Zulu sintético' in page.locator('tbody tr').first.inner_text()
    caso('Filtros de origem/busca e ordenação crescente/decrescente',filtros)

    def historico():
        navegar('Histórico de Alterações')
        assert 'Evento fevereiro sintético' in page.locator('tbody tr').first.inner_text()
        page.get_by_role('button',name=re.compile('Mais recente primeiro')).click()
        assert 'Evento janeiro sintético' in page.locator('tbody tr').first.inner_text()
        datas=page.locator('.page-body input[placeholder="dd/mm/aaaa"]')
        datas.first.fill('01/02/2026');datas.last.fill('28/02/2026')
        assert page.locator('tbody tr').count()==1
        assert 'Evento fevereiro sintético' in page.locator('tbody tr').inner_text()
        page.get_by_role('button',name='Limpar filtro',exact=True).click()
        assert page.locator('tbody tr').count()==2
    caso('Histórico: ordem, período e limpar filtro',historico)

    for ficha,colecao,rotulo in [('Comuns','rendaVariavelMensalManual','Resultado líquido comuns'),('FII','fiiFiagroMensalManual','Resultado líquido do mês')]:
        def rv(ficha=ficha,colecao=colecao,rotulo=rotulo):
            navegar('Renda Variável')
            for valor in ['100,00','200,00']:
                page.get_by_role('button',name=re.compile(r'Incluir mês \('+ficha+r'\)')).click()
                selecionar('Mês','3');preencher(rotulo,valor);salvar()
                esperar(f's.{colecao}.length===1')
            linha=estado()[colecao][0]
            assert (linha.get('comuns') or linha)['resultadoLiquidoMes']==200, linha
            botoes=page.get_by_role('button',name=re.compile('Excluir|Remover')).count()
            return {'edicao':'Relançar mesmo mês substitui sem duplicar','botoesExcluirRemover':botoes,'exclusao':'NÃO OFERECIDA NA UI' if botoes==0 else 'Requer investigação específica'}
        caso('RV '+ficha+': sobrescrever mês e verificar opção de exclusão',rv)

    def impressao():
        navegar('Relatório IRPF')
        page.evaluate('() => { window.__impressao=0; window.print=()=>{window.__impressao+=1}; }')
        page.get_by_role('button',name='Imprimir demonstrativo',exact=True).click()
        page.wait_for_function('window.__impressao===1')
        page.pdf(path=str(artefatos/'relatorio-sintetico.pdf'),print_background=True)
        assert (artefatos/'relatorio-sintetico.pdf').stat().st_size>1000
        return 'Botão invoca impressão; Chromium produziu PDF. Diálogo nativo e impressora física não exercitados.'
    caso('Relatório: acionamento de impressão e PDF Chromium',impressao)

    for pagina,subaba,campo,nome,rotulo,chave in [
        ('Bens e Direitos',None,'bens','Alfa sintético','Discriminação','discriminacao'),
        ('Dívidas e Ônus',None,'dividas','Dívida sintética','Discriminação','discriminacao'),
        ('Atividade Rural','Imóveis Explorados','imoveisRurais','Fazenda sintética','Nome e Localização','nomeLocalizacao'),
        ('Atividade Rural','Bens da Atividade Rural','bensRurais','Trator sintético','Discriminação','discriminacao'),
        ('Atividade Rural','Dívidas Vinculadas','dividasRurais','Crédito rural sintético','Discriminação','discriminacao'),
    ]:
        def cadastro(pagina=pagina,subaba=subaba,campo=campo,nome=nome,rotulo=rotulo,chave=chave):
            navegar(pagina)
            if subaba: page.get_by_role('button',name=subaba,exact=True).click()
            original=estado()[campo][0]
            page.locator('tr').filter(has_text=nome).get_by_role('button',name='Editar',exact=True).click()
            revisado=nome+' revisado';preencher(rotulo,revisado);salvar()
            esperar(f's.{campo}[0]?.{chave}==='+json.dumps(revisado))
            editado=estado()[campo][0]
            for protegido in ['situacao_anterior','situacao_atual','movimentacoes','data_aquisicao','dataAquisicao']:
                assert editado.get(protegido)==original.get(protegido), protegido
            excluir_linha(revisado)
            esperar(f'!s.{campo}.some(x=>x.id==='+str(original['id'])+')')
            if campo=='bens': assert len(estado()['bens'])==1
            return 'Metadado alterado sem mudar saldos/movimentos; excluiu somente alvo.'
        caso('Complemento '+campo+': editar metadados e excluir cadastro',cadastro)

    def compensar_rural():
        navegar('Atividade Rural');page.get_by_role('button',name='Resultado',exact=True).click()
        grupo=page.locator('.page-body .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^Valor a compensar$')))
        grupo.locator('input').fill('30,00');page.get_by_role('button',name='Compensar',exact=True).click()
        esperar('s.prejuizoRuralAcompensar===-70')
        assert estado()['lancamentosRurais'][0]['valor']==200
        assert any('prejuízo' in a['descricao'] for a in estado()['alteracoes'])
        page.reload(wait_until='networkidle');assert estado()['prejuizoRuralAcompensar']==-70
        return 'Botão aplicou ajuste30, saldo -100→-70 persistiu; sem certificação da regra fiscal.'
    caso('Complemento rural: botão Compensar e persistência',compensar_rural)

    def ganho_capital():
        navegar('Ganhos de Capital');page.get_by_role('button',name='Novo bem',exact=True).click()
        preencher('Data de aquisição','2026-01-01');preencher('Código do Bem','12');preencher('Discriminação','Imóvel venda sintética');preencher('Situação em 31/12 (Ano Atual)','100,00');salvar()
        esperar("s.bens.some(x=>x.discriminacao==='Imóvel venda sintética')")
        page.get_by_label(re.compile('Tipo de movimentação')).select_option('venda_total')
        preencher('Data','2026-06-01')
        page.locator('.modal:visible .form-group').filter(has=page.locator('label').filter(has_text=re.compile('^Valor de venda'))).locator('input').fill('120,00')
        page.get_by_role('button',name='Registrar movimentação',exact=True).click()
        esperar("s.bens.find(x=>x.discriminacao==='Imóvel venda sintética')?.movimentacoes.some(m=>m.tipo==='venda_total'&&m.valorVenda===120)")
        assert next(b for b in estado()['bens'] if b['discriminacao']=='Imóvel venda sintética')['situacao_atual']==0
        page.locator('.modal-close:visible').last.click()
        descartar=page.get_by_role('button',name='Descartar alterações',exact=True)
        if descartar.count(): descartar.click()
        assert 'Imóvel venda sintética' in page.locator('.page-body').inner_text()
        with page.expect_download() as info: page.get_by_role('button',name='Exportar .xlsx',exact=True).click()
        d=info.value;d.save_as(artefatos/d.suggested_filename)
        assert (artefatos/d.suggested_filename).stat().st_size>1000
        return 'Criou bem, reabriu edição, registrou venda total e exportou; teste operacional.'
    caso('Complemento Ganhos Capital: novo bem, reabertura, venda e exportação',ganho_capital)

    print(json.dumps({'resultados':resultados,'errosJavascript':erros_js,'artefatosTemporarios':str(artefatos)},ensure_ascii=False,indent=2),flush=True)
    browser.close()
    if erros_js or any(r['resultado']=='FALHOU_A_CLASSIFICAR' for r in resultados): raise SystemExit(1)
