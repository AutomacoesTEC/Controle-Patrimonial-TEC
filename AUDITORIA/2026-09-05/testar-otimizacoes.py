"""Funcional em Chromium descartável. Sem editar código durante a execução.
Requer Playwright e Chromium instalado. Nunca abre perfil real do navegador.
"""
import json
import re
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

resultados, erros_js = [], []
with sync_playwright() as p:
    executaveis = sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))
    if not executaveis:
        raise RuntimeError('Chromium do Playwright não instalado; sem fallback para perfil real.')
    browser = p.chromium.launch(executable_path=str(executaveis[-1]))
    page = browser.new_page(viewport={'width': 1366, 'height': 900}, accept_downloads=True)
    page.set_default_timeout(10000)
    page.on('pageerror', lambda e: erros_js.append(str(e)))
    page.goto('http://127.0.0.1:5173', wait_until='networkidle')
    page.evaluate("""async () => {
      const {initialState,snapshotYear} = await import('/src/store/reducer.js');
      const ano2026 = {...initialState,anoCalendario:2026,origemAnoAtual:'manual',
        contribuinte:{nome:'TESTE OTIMIZAÇÕES',cpf:'11144477735'},dependentes:[{id:9,nome:'Ana teste',cpf:'33344455508'}],
        bens:[{id:1,origem:'manual',beneficiario:'Titular',grupo:'02',codigo_bem:'01',discriminacao:'Carro teste',situacao_anterior:1500,situacao_atual:0,movimentacoes:[{id:2,tipo:'venda_total',data:'2026-01-03',valor:1500,valorVenda:2000,irrfVenda:50}]}],
        apuracaoGanhoCapital:[{id:3,bem:'Carro teste GCAP',dataAlienacao:'2026-01-03',custoAquisicao:1500,valorAlienacao:2000}],
        rendimentos:[{id:4,origem:'manual',beneficiario:'Titular',data:'2026-01-03',nome_fonte:'Venda carro rendimento',tipo:'exclusivo_02',valor:450,irrf:0}],
        rendaVariavelMensalOficial:[{mes:1,titular:true,comuns:{resultadoLiquidoMes:100},consolidacao:{}}],
        rendaVariavelMensalManual:[{mes:1,titular:true,origem:'manual',comuns:{resultadoLiquidoMes:200},consolidacao:{}}]
      };
      const s = {...initialState,anoCalendario:2025,origemAnoAtual:'manual',contribuinte:ano2026.contribuinte,dependentes:ano2026.dependentes,historico:{2026:snapshotYear(ano2026)}};
      localStorage.setItem('controle-patrimonial-perfis',JSON.stringify([{id:'otimizacoes',nome:'TESTE OTIMIZAÇÕES',protegido:false}]));
      localStorage.setItem('controle-patrimonial-data-otimizacoes',JSON.stringify(s));
      sessionStorage.setItem('controle-patrimonial-perfil-sessao','otimizacoes');
    }""")
    page.reload(wait_until='networkidle')

    def estado():
        return page.evaluate("JSON.parse(localStorage.getItem('controle-patrimonial-data-otimizacoes'))")

    def esperar(expr):
        page.wait_for_function("() => {const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-otimizacoes'));return " + expr + ';}')

    def navegar(nome):
        page.locator('.sidebar-nav').get_by_text(nome, exact=True).click()
        page.wait_for_timeout(300)

    def botao(nome):
        return page.get_by_role('button', name=nome, exact=True)

    def campo(nome):
        return page.locator('.modal:visible').get_by_label(nome, exact=True)

    def selecionar(nome, trecho):
        loc = campo(nome)
        opc = loc.locator('option').evaluate_all('(els)=>els.map(e=>({value:e.value,text:e.textContent}))')
        matches = [o for o in opc if trecho in o['text']]
        assert len(matches) == 1, (nome, trecho, matches)
        loc.select_option(matches[0]['value'])

    def salvar():
        botao('Salvar').last.click()
        page.locator('.modal:visible').wait_for(state='hidden')

    def abrir(nome):
        botao(nome).first.click()
        page.locator('.modal:visible').wait_for()

    def caso(nome, fn):
        try:
            fn()
            resultados.append({'funcao': nome, 'resultado': 'PASSOU'})
        except Exception as e:
            resultados.append({'funcao': nome, 'resultado': 'FALHOU', 'erro': str(e)[:2200], 'tela': page.locator('body').inner_text()[-1800:]})
            for _ in range(3):
                fechar = page.locator('.modal:visible').get_by_role('button',name='Fechar',exact=True)
                if fechar.count(): fechar.last.click(); page.wait_for_timeout(200)
        print(json.dumps(resultados[-1], ensure_ascii=False), flush=True)

    def contas():
        navegar('Acompanhamento financeiro')
        page.get_by_label('Mês de consulta',exact=True).fill('2026-01')
        for nome, pessoa, saldo in [('Banco teste', 'titular', '110000'), ('Banco Ana', '33344455508', '0')]:
            abrir('Nova conta')
            campo('Nome da conta').fill(nome)
            campo('Titular ou dependente').select_option(pessoa)
            campo('Data do saldo de abertura').fill('2026-01-01')
            campo('Saldo de abertura (R$)').fill(saldo)
            salvar()
        esperar('s.acompanhamento.contas.length===2')
        assert estado()['anoCalendario'] == 2025
        assert '110.000,00' in page.locator('.page-body').inner_text()
        botao('Editar conta').first.click()
        campo('Nome da conta').fill('Banco titular')
        salvar()
        assert estado()['acompanhamento']['contas'][0]['nome']=='Banco titular'
    caso('Contas datadas em 2026 com ano ativo 2025; titular/dependente e edição', contas)

    def operacoes():
        botao('Operações e parcelas').click()
        abrir('Nova operação')
        campo('Descrição da operação').fill('Venda parcelada teste')
        campo('Tipo da operação').select_option('venda')
        campo('Data do fato econômico').fill('2026-01-03')
        campo('Preço total do contrato (R$)').fill('2000')
        campo('Custo baixado (R$)').fill('1500')
        campo('Despesas da venda / corretagem (R$)').fill('50')
        salvar()
        op=estado()['acompanhamento']['operacoes'][0]['id']
        page.get_by_label('Operação em foco',exact=True).select_option(op)
        abrir('Nova parcela')
        campo('Data prevista de pagamento / recebimento').fill('2026-01-31')
        campo('Principal / amortização (R$)').fill('1000')
        campo('Juros (R$)').fill('10')
        salvar()
        assert estado()['acompanhamento']['lancamentos']==[]
        abrir('Referência documental')
        campo('Descrição do documento').fill('Contrato teste')
        campo('Caminho ou referência local do documento').fill('documentos/contrato-teste.pdf')
        salvar()
        assert estado()['acompanhamento']['documentos'][0]['externo'] is True
    caso('Operação, cronograma separado de caixa e referência documental externa', operacoes)

    def vinculos():
        for trecho in ['venda_total 2026-01-03','Carro teste GCAP','Venda carro rendimento']:
            abrir('Vincular ficha fiscal')
            selecionar('Registro fiscal (ano, ficha e identificação)', trecho)
            salvar()
        esperar('s.acompanhamento.operacoes[0].vinculos.length===3')
        result=page.evaluate("""async()=>{const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-otimizacoes'));const {dadosDoAno}=await import('/src/store/consultaPeriodo.js');const {ganhosApuradosPeriodo}=await import('/src/store/demonstrativos.js');return ganhosApuradosPeriodo(dadosDoAno(s,2026),'2026-01-01','2026-12-31')}""")
        assert result['totalOperacoes']==450 and result['jaNosRendimentos']==450 and result['total']==0, result
        assert 'operacaoId' not in estado()['historico']['2026']['bens'][0]['movimentacoes'][0]
    caso('Vínculo venda/GCAP/rendimento sem duplicação e sem alterar documento fiscal', vinculos)

    def transferencia():
        botao('Caixa e contas').click()
        abrir('Transferência entre contas')
        selecionar('Conta','Banco titular')
        selecionar('Conta de destino','Banco Ana')
        campo('Data efetiva de pagamento / recebimento').fill('2026-01-05')
        campo('Valor efetivo (R$)').fill('10000')
        campo('Descrição da baixa').fill('Transferência para Ana')
        salvar()
        assert 'Saldo final registrado: R$\xa0110.000,00' in page.locator('.page-body').inner_text()
        page.get_by_label('Titularidade',exact=True).select_option('33344455508')
        assert '10.000,00' in page.locator('.page-body').inner_text()
        page.get_by_label('Titularidade',exact=True).select_option('todos')
    caso('Transferência pareada: caixa consolidado inalterado e filtro de dependente', transferencia)

    def baixa():
        botao('Operações e parcelas').click()
        abrir('Dar baixa')
        selecionar('Conta','Banco titular')
        campo('Data efetiva de pagamento / recebimento').fill('2026-02-03')
        campo('Contraparte (pagador / recebedor)').fill('Comprador sintético')
        salvar()
        assert estado()['acompanhamento']['lancamentos'][-1]['valor']==101000
        botao('Caixa e contas').click()
        assert '110.000,00' in page.locator('.page-body').inner_text()
        page.get_by_label('Mês de consulta',exact=True).fill('2026-02')
        assert '111.010,00' in page.locator('.page-body').inner_text()
        with page.expect_download() as download:
            botao('Exportar razão .xlsx').click()
        assert download.value.suggested_filename.endswith('.xlsx')
    caso('Baixa na data de recebimento, consultas mensais e exportação Excel', baixa)

    def fechamento():
        page.get_by_label('Mês de consulta',exact=True).fill('2026-01')
        botao('Conciliação').click()
        for conta, saldo in [('Banco titular','100000'),('Banco Ana','10000')]:
            abrir('Informar extrato')
            selecionar('Conta',conta)
            campo('Saldo final do extrato (R$)').fill(saldo)
            campo('Referência local do extrato').fill('extratos/janeiro-teste.pdf')
            salvar()
        botao('Fechamento').click()
        abrir('Fechar mês')
        campo('Responsável').fill('Auditor sintético')
        for c in page.locator('.modal:visible input[type=checkbox]').all(): c.check()
        campo('Parecer sobre pendências e aprovação').fill('Parcela vence em janeiro e foi recebida em fevereiro; conferida.')
        salvar()
        assert estado()['acompanhamento']['fechamentos'][-1]['status']=='fechado'
        botao('Caixa e contas').click()
        abrir('Nova baixa financeira')
        selecionar('Conta','Banco titular')
        campo('Data efetiva de pagamento / recebimento').fill('2026-01-20')
        campo('Valor efetivo (R$)').fill('50')
        campo('Descrição da baixa').fill('Tentativa em mês fechado')
        campo('Contraparte (pagador / recebedor)').fill('Teste')
        botao('Salvar').last.click()
        page.get_by_role('alert').filter(has_text='fechado').wait_for()
        botao('Fechar').last.click()
        botao('Fechamento').click()
        abrir('Reabrir mês')
        campo('Responsável').fill('Auditor sintético')
        campo('Motivo da reabertura').fill('Conferência complementar autorizada')
        salvar()
        f=estado()['acompanhamento']['fechamentos']
        assert len(f)==2 and f[0]['status']=='fechado' and f[1]['status']=='reaberto'
        assert f[0]['snapshot']['conciliacoes'][0]['diferenca']==0
    caso('Extratos, fechamento com checklist, trava retroativa e reabertura versionada', fechamento)

    def economico():
        botao('Patrimônio econômico').click()
        assert '450,00' in page.locator('.page-body').inner_text()
        abrir('Avaliação de mercado')
        campo('Referência estável do bem (usar a mesma nas reavaliações)').fill('imovel-teste')
        campo('Descrição do bem').fill('Imóvel teste')
        campo('Data da avaliação').fill('2026-01-30')
        campo('Valor de mercado (R$)').fill('180000')
        campo('Fonte / laudo da avaliação').fill('Laudo sintético')
        salvar()
        assert '180.000,00' in page.locator('.page-body').inner_text()
        assert estado()['historico']['2026']['bens'][0]['situacao_atual']==0
        page.screenshot(path='/tmp/cptec-otimizacoes-economico.png',full_page=True)
    caso('Mercado e resultado econômico separados do custo fiscal e caixa', economico)

    def revisao_backup():
        navegar('Revisão e pendências')
        page.get_by_label('Mês de revisão',exact=True).fill('2026-01')
        botao('Registrar parecer').first.click()
        campo('Responsável').fill('Auditor sintético')
        campo('Decisão / providência').fill('Registro conferido; manter documentação em revisão.')
        botao('Salvar parecer').click()
        page.locator('.modal:visible').wait_for(state='hidden')
        assert len(estado()['acompanhamento']['revisoes'])==1
        page.get_by_label('Responsável pela revisão',exact=True).fill('Auditor sintético')
        with page.expect_download() as download:
            botao('Exportar Backup').click()
        caminho=Path(tempfile.mkdtemp(prefix='cptec-backup-funcional-'))/'perfil.cptec.json'
        download.value.save_as(caminho)
        page.get_by_label('Arquivo de backup .cptec.json',exact=True).set_input_files(caminho)
        botao('Testar restauração sem substituir perfil').click()
        page.get_by_role('status').filter(has_text='Backup relido com sucesso').wait_for()
        assert page.evaluate("JSON.parse(localStorage.getItem('controle-patrimonial-perfis')).length")==1
        assert len(estado()['acompanhamento']['revisoes'])==2
        with page.expect_download() as download:
            botao('Exportar revisão e fichas').click()
        assert download.value.suggested_filename.endswith('.xlsx')
    caso('Pendência acionável, parecer, backup restaurado em memória e exportação da revisão', revisao_backup)

    def teclado_responsivo():
        navegar('Acompanhamento financeiro')
        page.set_viewport_size({'width': 768, 'height': 900})
        abrir('Nova conta')
        for _ in range(18): page.keyboard.press('Tab')
        assert page.evaluate("!!document.activeElement.closest('.modal')")
        page.keyboard.press('Escape')
        page.locator('.modal:visible').wait_for(state='hidden')
        page.set_viewport_size({'width': 1366, 'height': 900})
        page.get_by_label('Mês de consulta',exact=True).fill('2026-01')
        divisoria=page.locator('.rdz-puxador').first
        assert divisoria.count()>0
        box=divisoria.bounding_box()
        page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        page.mouse.down(); page.mouse.move(box['x']+90,box['y']+box['height']/2); page.mouse.up()
        page.emulate_media(media='print')
        medidas=page.locator('.table-container table').evaluate_all('(ts)=>ts.map(t=>({w:t.getBoundingClientRect().width,c:t.parentElement.getBoundingClientRect().width}))')
        assert all(m['w']<=m['c']+2 for m in medidas),medidas
        page.pdf(path='/tmp/cptec-otimizacoes-impressao.pdf',format='A4',print_background=True)
        page.emulate_media(media='screen')
    caso('Teclado no modal, largura reduzida, dimensionamento e impressão sem corte lateral', teclado_responsivo)

    def remover_rv():
        navegar('Renda Variável')
        page.locator('.page-header select').select_option('2026')
        botao('＋ Incluir mês (Comuns)').click()
        botao('Remover ajuste e restaurar importado').click()
        botao('Remover ajuste').click()
        esperar('s.historico[2026].rendaVariavelMensalManual.length===0')
        assert estado()['historico']['2026']['rendaVariavelMensalOficial'][0]['comuns']['resultadoLiquidoMes']==100
    caso('Remover RV manual restaura importado sem apagar mês oficial', remover_rv)

    def persistencia():
        page.reload(wait_until='networkidle')
        navegar('Acompanhamento financeiro')
        page.get_by_label('Mês de consulta',exact=True).fill('2026-02')
        assert '111.010,00' in page.locator('.page-body').inner_text()
        assert estado()['anoCalendario']==2025
        navegar('Demonstrativo')
        assert 'Visão financeira separada' in page.locator('.page-body').inner_text()
    caso('Persistência após recarregar e demonstrativo com visão financeira separada', persistencia)

    print(json.dumps({'total':len(resultados),'aprovados':sum(r['resultado']=='PASSOU' for r in resultados),'erros_js':erros_js},ensure_ascii=False),flush=True)
    browser.close()
    if erros_js or any(r['resultado']!='PASSOU' for r in resultados): raise SystemExit(1)
