"""Importações e perfis reais da interface, com documentos/contas sintéticos."""
import json
import re
import tempfile
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parents[2]
SAIDA = Path(tempfile.mkdtemp(prefix='cptec-perfis-auditoria-'))
resultados = []
with sync_playwright() as p:
    exe = sorted((Path.home()/'.cache/ms-playwright').glob('chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell'))[-1]
    browser = p.chromium.launch(executable_path=str(exe))

    def nova_pagina(nome='PERFIL SINTÉTICO E2E'):
        context = browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page = context.new_page(); page.set_default_timeout(15000)
        page.erros_js = []
        page.on('pageerror',lambda e: page.erros_js.append(str(e)))
        page.goto('http://127.0.0.1:5173',wait_until='networkidle')
        page.get_by_placeholder('Nome completo do titular').fill(nome)
        page.get_by_role('button',name='Criar e Entrar',exact=True).click()
        page.get_by_role('button',name='Trocar Perfil',exact=True).wait_for()
        return page

    def estado(page):
        return page.evaluate("JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao')))")

    def navegar(page,nome):
        page.locator('.sidebar-nav').get_by_text(nome,exact=True).click()
        page.wait_for_timeout(350)

    def caso(nome,fn):
        if len(sys.argv)>1 and not any(filtro in nome for filtro in sys.argv[1:]): return
        try:
            detalhe=fn()
            r={'funcao':nome,'resultado':'PASSOU','evidencia':detalhe}
        except Exception as e:
            import traceback
            r={'funcao':nome,'resultado':'FALHOU','erro':str(e),'trajetoria':traceback.format_exc()}
        resultados.append(r); print(json.dumps(r,ensure_ascii=False),flush=True)

    def importar_pdf(page,arquivo):
        navegar(page,'Importar Declaração')
        page.locator('input[type=file]').set_input_files(str(RAIZ/'output/pdf'/arquivo))
        page.get_by_role('button',name='Confirmar importação',exact=True).wait_for(timeout=60000)
        page.get_by_role('button',name='Confirmar importação',exact=True).click()
        for _ in range(30):
            if estado(page).get('importFormato')=='pdf': break
            alerta=page.get_by_role('alertdialog')
            if alerta.count():
                buttons=alerta.get_by_role('button'); buttons.last.click()
            page.wait_for_timeout(200)
        try:
            page.wait_for_function("() => JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao'))).importFormato === 'pdf'")
        except Exception as e:
            raise AssertionError('Importação não concluiu: '+page.locator('body').inner_text()[-6000:]+' JS: '+str(page.erros_js)) from e
        page.wait_for_timeout(400)
        return estado(page)

    def importacao_aju():
        page=nova_pagina('AUDITORIA PDF TEC AJUSTE')
        s=importar_pdf(page,'AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf')
        assert s['anoCalendario']==2025 and len(s['bens'])>0 and len(s['dependentes'])>0
        contagens={k:len(s.get(k,[])) for k in ['bens','dividas','rendimentos','pagamentos','dependentes','bensRurais','dividasRurais','rendaVariavelMensalOficial','fiiFiagroMensalOficial']}
        assert s['documentoFonte']['sha256ArquivoOriginal']
        with page.expect_download() as info: page.get_by_role('button',name='Exportar fonte',exact=True).first.click()
        d=info.value; d.save_as(SAIDA/d.suggested_filename)
        assert (SAIDA/d.suggested_filename).stat().st_size>1000
        page.evaluate('() => {window.__prints=0; window.print=()=>{window.__prints++};}')
        for ficha in ['Demonstrativo','Relatório IRPF']:
            navegar(page,ficha)
            # O PDF amplo contém fichas com cobertura parcial; ler e fechar
            # o aviso estrutural é parte do fluxo, não remover a proteção.
            if page.locator('.modal-close:visible').count():
                page.locator('.modal-close:visible').last.click()
                page.wait_for_timeout(250)
            page.get_by_role('button',name='Imprimir demonstrativo',exact=True).click()
            page.emulate_media(media='print')
            path=SAIDA/(ficha+'.pdf'); page.pdf(path=str(path),print_background=True)
            assert path.stat().st_size>1000
            page.emulate_media(media='screen')
        assert page.evaluate('window.__prints')==2
        assert not page.erros_js,page.erros_js
        page.context.close()
        return contagens
    caso('Importação PDF AJU completa, fonte e impressão de dois relatórios',importacao_aju)

    def troca_titular():
        page=nova_pagina('TITULAR ANTERIOR SINTÉTICO')
        s=importar_pdf(page,'AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf')
        assert s['contribuinte']['nome']=='AUDITORIA PDF TEC AJUSTE'
        assert len(s['dependentes'])>0, 'Substituir titular não pode descartar dependentes da NOVA declaração'
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'dependentes_novos':len(s['dependentes'])}
    caso('Importação de outro titular mantém dependentes da nova declaração',troca_titular)

    def modalidades():
        dados=[]
        for arquivo,rotulo in [('ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf','Final de Espólio'),('SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf','Saída Definitiva')]:
            page=nova_pagina()
            s=importar_pdf(page,arquivo)
            navegar(page,rotulo)
            assert page.locator('.page-body').inner_text().strip()
            handles=page.locator('.rdz-puxador').count()
            page.screenshot(path=str(SAIDA/(rotulo+'.png')),full_page=True)
            assert not page.erros_js,page.erros_js
            dados.append({'modalidade':rotulo,'ano':s['anoCalendario'],'divisorias':handles})
            page.context.close()
        return dados
    caso('Importação e consulta de espólio e saída definitiva',modalidades)

    def perfis_backup():
        page=nova_pagina('PERFIL BACKUP SINTÉTICO')
        id_original=page.evaluate("sessionStorage.getItem('controle-patrimonial-perfil-sessao')")
        page.evaluate("""async () => {
          const {initialState}=await import('/src/store/reducer.js');
          const id=sessionStorage.getItem('controle-patrimonial-perfil-sessao');
          localStorage.setItem('controle-patrimonial-data-'+id,JSON.stringify({...initialState,anoCalendario:2026,origemAnoAtual:'manual',contribuinte:{nome:'PERFIL BACKUP SINTÉTICO'},pagamentosDiversos:[{id:1,descricao:'COMPROVANTE SINTÉTICO',data:'2026-05-01',valor:42}]}));
        }""")
        page.reload(wait_until='networkidle')
        with page.expect_download() as info: page.get_by_role('button',name='Exportar Backup',exact=True).click()
        d=info.value; backup=SAIDA/d.suggested_filename;d.save_as(backup)
        arquivo=json.loads(backup.read_text());assert arquivo['conteudo']['pagamentosDiversos'][0]['valor']==42
        page.get_by_role('button',name='Trocar Perfil',exact=True).click()
        page.locator('input[type=file][accept*=".json"]').set_input_files(str(backup))
        page.get_by_role('button',name='Restaurar',exact=True).click()
        page.wait_for_function("JSON.parse(localStorage.getItem('controle-patrimonial-perfis')).length===2")
        page.locator('.perfil-card').first.get_by_role('button',name='Proteger com senha',exact=True).click()
        page.get_by_placeholder('Senha (mín. 6 caracteres)').fill('SenhaSintetica42')
        page.get_by_placeholder('Confirmar senha').fill('SenhaSintetica42')
        page.get_by_role('button',name='Ativar',exact=True).click()
        page.wait_for_function("id => JSON.parse(localStorage.getItem('controle-patrimonial-perfis')).find(x=>x.id===id).protegido",arg=id_original)
        cifrado=page.evaluate("id=>JSON.parse(localStorage.getItem('controle-patrimonial-data-'+id))",id_original)
        assert cifrado.get('ciphertext') and 'pagamentosDiversos' not in cifrado
        page.locator('.perfil-card').first.click()
        page.locator('input[type=password]').fill('SenhaErrada')
        page.get_by_role('button',name='Entrar',exact=True).click()
        page.get_by_text(re.compile('Senha incorreta|senha incorreta')).wait_for()
        page.locator('input[type=password]').fill('SenhaSintetica42')
        page.get_by_role('button',name='Entrar',exact=True).click()
        page.get_by_role('button',name='Exportar Backup',exact=True).wait_for()
        with page.expect_download() as info: page.get_by_role('button',name='Exportar Backup',exact=True).click()
        d=info.value;protegido=SAIDA/('protegido-'+d.suggested_filename);d.save_as(protegido)
        assert json.loads(protegido.read_text())['protegido'] is True
        page.reload(wait_until='networkidle')
        assert page.locator('input[type=password]').count()==1
        assert page.locator('.sidebar-nav').count()==0
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'backup_lido':True,'restauracao_novo_perfil':True,'criptografia':True,'senha_errada_recusada':True,'recarga_bloqueada':True}
    caso('Perfis: criar, exportar/restaurar, proteger, desbloquear e recarregar',perfis_backup)

    def pendencias_e_datas():
        page=nova_pagina()
        page.evaluate("""async () => {
          const {initialState}=await import('/src/store/reducer.js');
          const id=sessionStorage.getItem('controle-patrimonial-perfil-sessao');
          localStorage.setItem('controle-patrimonial-data-'+id,JSON.stringify({...initialState,anoCalendario:2026,origemAnoAtual:'manual',rendimentos:[{id:1,nome_fonte:'FONTE SINTÉTICA',valor:200,ajustesLocaisRetificadora:[{campo:'valor',valorLocal:100,valorDeclarado:200}]}]}));
        }""")
        page.reload(wait_until='networkidle');navegar(page,'Importar Declaração')
        painel=page.get_by_role('region',name='Pendências da retificadora')
        assert 'edição local: 100' in painel.inner_text() and 'nova declaração: 200' in painel.inner_text()
        navegar(page,'Bens e Direitos');page.get_by_role('button',name=re.compile('Novo Bem')).first.click()
        anterior=page.get_by_label('Situação em 31/12 (Ano Anterior)',exact=True)
        assert anterior.get_attribute('readonly') is not None and anterior.input_value()=='R$ 0,00'
        data=page.get_by_label('Data de aquisição',exact=True)
        data.fill('10000-01-01'); assert not data.evaluate('e=>e.validity.valid')
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'conflito_visivel':True,'abertura_zero':True,'ano_expandido_invalido':True}
    caso('Pendências da retificadora visíveis e limites do novo bem',pendencias_e_datas)

    def apelido_exclusao():
        page=nova_pagina('PERFIL TEMPORÁRIO SINTÉTICO')
        page.get_by_role('button',name='Trocar Perfil',exact=True).click()
        page.get_by_role('button',name='+ Apelido',exact=True).click()
        page.get_by_placeholder('Apelido (opcional)').fill('Apelido E2E')
        page.get_by_role('button',name='Salvar',exact=True).click()
        page.wait_for_function("JSON.parse(localStorage.getItem('controle-patrimonial-perfis'))[0].apelido==='Apelido E2E'")
        with page.expect_download() as info:page.get_by_role('button',name='Exportar backup',exact=True).click()
        d=info.value;d.save_as(SAIDA/('launcher-'+d.suggested_filename))
        page.locator('.perfil-card').get_by_role('button',name='Excluir',exact=True).click()
        page.get_by_role('alertdialog').get_by_role('button',name='Cancelar',exact=True).click()
        assert page.locator('.perfil-card').count()==1
        page.locator('.perfil-card').get_by_role('button',name='Excluir',exact=True).click()
        page.get_by_role('alertdialog').get_by_role('button',name='Excluir',exact=True).click()
        page.wait_for_function("JSON.parse(localStorage.getItem('controle-patrimonial-perfis')).length===0")
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'apelido':True,'export_launcher':True,'cancelamento':True,'exclusao':True}
    caso('Perfis: apelido, backup no painel, cancelar e confirmar exclusão',apelido_exclusao)

    def retificadora_historico():
        page=nova_pagina('AUDITORIA PDF TEC AJUSTE')
        s=importar_pdf(page,'AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf')
        quantidades=(len(s['bens']),len(s['rendimentos']),len(s['dependentes']))
        navegar(page,'Rendimentos')
        page.get_by_role('button',name='Editar',exact=True).first.click()
        page.get_by_label('Data',exact=True).fill('2025-02-15')
        page.get_by_role('button',name='Salvar',exact=True).last.click()
        page.wait_for_function("() => JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao'))).rendimentos.some(r=>r.data==='2025-02-15')")
        page.wait_for_timeout(250)
        navegar(page,'Importar Declaração')
        page.locator('input[type=file]').set_input_files(str(RAIZ/'output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf'))
        page.get_by_role('button',name='Confirmar importação',exact=True).wait_for(timeout=60000)
        page.get_by_role('button',name='Confirmar importação',exact=True).click()
        page.get_by_role('button',name='Sobrescrever',exact=True).click()
        page.get_by_role('button',name='Confirmar Conciliação',exact=True).click()
        page.get_by_text('Conciliação da retificadora concluída e salva localmente.',exact=True).wait_for()
        s=estado(page)
        assert (len(s['bens']),len(s['rendimentos']),len(s['dependentes']))==quantidades
        assert any(r.get('data')=='2025-02-15' for r in s['rendimentos'])
        page.locator('.sidebar-footer select').select_option('__avancar__')
        page.get_by_role('dialog').get_by_role('button',name=re.compile('Avançar|Confirmar')).last.click()
        page.wait_for_function("() => JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao'))).anoCalendario===2026")
        navegar(page,'Importar Declaração')
        page.locator('.card').filter(has=page.get_by_role('heading',name='Ano-Calendário 2025',exact=True)).click()
        page.wait_for_function("() => JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao'))).anoCalendario===2025")
        # A lista é arquivo de declarações importadas; o ano manual2026
        # permanece na seleção de trabalho e não deve aparecer nessa lista.
        page.get_by_title('Excluir o ano-calendário 2025 do histórico',exact=True).click()
        page.get_by_role('alertdialog').get_by_role('button',name='Excluir',exact=True).click()
        page.wait_for_function("() => {const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao')));return !s.historico[2025] && s.anoCalendario===2026}")
        antes=estado(page)
        page.locator('input[type=file]').set_input_files(str(RAIZ/'output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf'))
        page.get_by_role('button',name='Cancelar revisão',exact=True).wait_for(timeout=60000)
        page.get_by_role('button',name='Cancelar revisão',exact=True).click()
        assert estado(page)==antes
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'retificadora_sem_duplicar':True,'data_local_preservada':True,'avanco_ano':True,'carregar_excluir_historico':True,'cancelamento_sem_mutacao':True}
    caso('Retificadora e histórico: conciliar, preservar edição, avançar, carregar, excluir e cancelar',retificadora_historico)

    def titular_salvar():
        page=nova_pagina('TITULAR FORMULÁRIO SINTÉTICO')
        navegar(page,'Titular e Dependentes')
        page.get_by_label('Nome Completo',exact=True).first.fill('TITULAR SINTÉTICO REVISADO')
        page.get_by_label('CPF',exact=True).first.fill('11144477735')
        page.get_by_label('Data do cadastro',exact=True).first.fill('2026-01-05')
        page.get_by_role('button',name='Salvar Titular',exact=True).click()
        page.get_by_role('button',name='Gravar em 2026',exact=True).click()
        page.wait_for_function("() => {const s=JSON.parse(localStorage.getItem('controle-patrimonial-data-'+sessionStorage.getItem('controle-patrimonial-perfil-sessao'))); return s.anoCalendario===2026 && s.contribuinte.nome==='TITULAR SINTÉTICO REVISADO'}")
        page.reload(wait_until='networkidle')
        assert estado(page)['contribuinte']['data']=='2026-01-05'
        assert estado(page)['contribuinte']['cpf']=='11144477735'
        assert not page.erros_js,page.erros_js
        page.context.close()
        return {'ano_pela_data':2026,'nome_cpf_data_persistidos':True}
    caso('Titular: editar nome, CPF e data com criação do primeiro ano',titular_salvar)

    print(json.dumps({'resultados':resultados,'artefatos_temporarios_externos':str(SAIDA)},ensure_ascii=False,indent=2),flush=True)
    browser.close()
    if any(r['resultado']=='FALHOU' for r in resultados):raise SystemExit(1)
