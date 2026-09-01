# Prova no APP REAL, de produção: sobe o build, importa o AJU-01 pelo próprio
# fluxo de importação e confere na tela o que a extração entrega.
#
# Por que existe: os testes deste projeto rodam em Node puro, sem DOM, e
# provam os módulos que a tela chama, não a tela em si. Uma ligação esquecida
# no .jsx passa verde na suíte inteira. Este script fecha esse buraco.
#
# Como rodar, do diretório do projeto:
#
#   npx vite build
#   npx vite preview --port 4173 --strictPort &
#   ~/emails-tools/venv/bin/python AUDITORIA/verificar-telas-no-app.py saida.png
#
# Duas armadilhas que custaram tempo e ficam registradas: o Chromium devolve o
# texto JÁ com o text-transform aplicado, então cabeçalho de tabela chega em
# MAIÚSCULA; e a moeda em pt-BR usa espaço não separável depois do "R$". Por
# isso tudo passa por norm() antes de comparar.
import sys, re, unicodedata
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = str(Path(__file__).resolve().parent.parent)
PDF = f"{RAIZ}/output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf"
PDF_SAIDA = f"{RAIZ}/output/pdf/SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf"
PDF_ESPOLIO = f"{RAIZ}/output/pdf/ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf"
achados = []

def norm(t):
    # O Chromium devolve o texto JÁ com text-transform aplicado (cabeçalho em
    # maiúscula) e a moeda pt-BR usa espaço não separável depois de "R$".
    t = t.replace(" ", " ").replace(" ", " ")
    return unicodedata.normalize("NFC", t).upper()

def ok(cond, msg):
    achados.append(("OK  " if cond else "FALHA", msg))

def novo_perfil(pg, pdf, nome):
    pg.get_by_role("button", name=re.compile("Trocar Perfil")).first.click()
    pg.wait_for_timeout(1200)
    pg.get_by_role("button", name=re.compile("Novo Perfil")).first.click()
    pg.wait_for_timeout(600)
    pg.set_input_files("input[type=file]", pdf)
    confirmar_importacao(pg)
    pg.locator("form input.form-control").first.fill(nome)
    pg.get_by_role("button", name="Criar e Entrar").click()
    pg.wait_for_timeout(2500)

def confirmar_importacao(pg):
    # O botão do modal de revisão NASCE DESABILITADO e só habilita quando a
    # leitura do PDF termina. Esperar só pelo texto pega o botão ainda inerte.
    botao = pg.get_by_role("button", name="Usar esta declaração")
    botao.wait_for(state="visible", timeout=180000)
    for _ in range(180):
        if botao.is_enabled(): break
        pg.wait_for_timeout(1000)
    botao.click()
    pg.wait_for_selector("text=Preenchido a partir de", timeout=60000)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 1200})
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto("http://localhost:4173/", wait_until="networkidle")
    pg.set_input_files("input[type=file]", PDF)
    confirmar_importacao(pg)
    pg.locator("form input.form-control").first.fill("TESTE AJU 01")
    pg.get_by_role("button", name="Criar e Entrar").click()
    pg.wait_for_timeout(2500)

    def ir(nome):
        pg.get_by_role("button", name=re.compile(nome)).first.click()
        pg.wait_for_timeout(1200)
        return norm(pg.inner_text("body"))

    t = ir("Rendimentos")
    ok("CONTRIBUIÇÃO PREVIDENCIÁRIA OFICIAL: R$ 5.102,12" in t, "Rendimentos: previdência oficial do titular")
    ok("13º SALÁRIO: R$ 5.105,15" in t, "Rendimentos: 13º salário do titular")
    ok("IRRF SOBRE O 13º SALÁRIO: R$ 505,16" in t, "Rendimentos: IRRF do 13º do titular")
    ok("13º SALÁRIO: R$ 1.205,25" in t, "Rendimentos: 13º do dependente")
    ok("IRRF SOBRE O 13º SALÁRIO: R$ 105,26" in t, "Rendimentos: IRRF do 13º do dependente")

    t = ir("Titular e Dependentes")
    ok("ERA RESIDENTE NO EXTERIOR E PASSOU A SER RESIDENTE NO BRASIL" in t, "Titular: pergunta da condição de residência")
    ok("HOUVE ALTERAÇÃO DE DADOS CADASTRAIS" in t, "Titular: pergunta da alteração cadastral")

    ir("Ganhos de Capital")
    for botao in pg.query_selector_all("button"):
        if botao.inner_text().strip() == "▶":
            botao.click(); pg.wait_for_timeout(400)
    t = norm(pg.inner_text("body"))
    ok("BEM ATUALIZADO DE ACORDO COM A LEI 14.973/2024?" in t, "Ganhos de capital: pergunta da Lei 14.973/2024")
    ok("HOUVE NO IMÓVEL ALIENADO EDIFICAÇÃO, AMPLIAÇÃO, REFORMA" in t, "Ganhos de capital: pergunta da edificação e reforma")
    ok("A PRESTAÇÃO/PARCELA FINAL FOI RECEBIDA EM 2025?" in t, "Ganhos de capital: pergunta da parcela final")
    ok("SUJEITO A REGISTRO PÚBLICO?" in t, "Ganhos de capital: pergunta do registro público")
    ok("IMPOSTO DEVIDO APÓS COMPENSAÇÃO" in t, "Ganhos de capital: imposto devido após compensação")
    ok("IR NA FONTE (LEI Nº 11.033/2004)" in t, "Ganhos de capital: IR na fonte da Lei 11.033/2004")
    ok("TOTAL DA CORRETAGEM DAS PARCELAS" in t, "Ganhos de capital: corretagem das parcelas")
    ok("TOTAL LÍQUIDO DAS PARCELAS" in t, "Ganhos de capital: líquido das parcelas")

    t = ir("Renda Variável")
    ok("ALÍQUOTA DO IMPOSTO" in t, "Renda variável: coluna da alíquota do FII")
    ok("20,00%" in t, "Renda variável: alíquota de 20,00%")

    # Rastreabilidade: página e linha da declaração impressa, nas telas que
    # ainda não a mostravam. Os endereços são os do AJU-01, conferidos no dump
    # AUDITORIA/rows-pdfjs/AJU-01.rows.txt.
    t = ir("Dívidas e Ônus")
    ok("PDF, PÁGINA 10, LINHA 7" in t, "Dívidas: página e linha da declaração")

    t = ir("Titular e Dependentes")
    ok("PDF, PÁGINA 1, LINHA 23" in t, "Dependentes: página e linha da declaração")

    t = ir("Ganhos de Capital")
    ok("PDF, PÁGINA 14, LINHA 13" in t, "Ganhos de capital: página e linha da apuração")

    t = ir("Atividade Rural")
    ok("PDF, PÁGINA 11, LINHA 8" in t, "Atividade rural: página e linha do imóvel")

    t = ir("Renda Variável")
    ok("PDF, PÁGINA 23, LINHA 5" in t, "Renda variável: página e linha do mês")
    ok("PDF, PÁGINA 37, LINHA 9" in t, "FII e Fiagro: página e linha do mês")

    t = ir("Relatório IRPF")
    ok("APLICAÇÃO FINANCEIRA" in t and "LUCROS E DIVIDENDOS" in t, "Relatório: legenda AF e LD do demonstrativo do exterior")
    ok("PARCELA NÃO DEDUTÍVEL" in t, "Relatório: coluna de parcela não dedutível")

    # Segundo perfil, com a declaração de SAÍDA DEFINITIVA: é a única que
    # imprime a comunicação da condição de não residente à fonte pagadora.
    novo_perfil(pg, PDF_SAIDA, "TESTE SAI 01")

    t = ir("Rendimentos")
    ok("CONDIÇÃO DE NÃO RESIDENTE COMUNICADA A ESTA FONTE EM 24/12/2025" in t,
       "Saída definitiva: comunicação à fonte pagadora na linha do rendimento")

    t = ir("Saída Definitiva|Modalidade|Final de Espólio")
    ok("DATA DA CARACTERIZAÇÃO DA CONDIÇÃO DE NÃO RESIDENTE" in t,
       "Saída definitiva: quadro da condição de residência")

    # Terceiro perfil, com a DECLARAÇÃO FINAL DE ESPÓLIO. Nem ela nem a de
    # saída definitiva conseguiam entrar no app antes de 31/08/2026: as fichas
    # próprias da modalidade caíam em estado de erro e o erro desabilitava o
    # botão da revisão da importação.
    novo_perfil(pg, PDF_ESPOLIO, "TESTE ESP 01")

    t = ir("Final de Espólio|Saída Definitiva|Modalidade")
    ok("ESP INVENTARIANTE SENTINELA" in t, "Espólio: inventariante da partilha")
    ok("ESP HERDEIRO UM" in t and "ESP HERDEIRO DOIS" in t, "Espólio: herdeiros e meeiro")
    ok("BENS TRANSFERIDOS NA PARTILHA" in t, "Espólio: bens transferidos na partilha")
    ok("R$ 123.401,41" in t, "Espólio: valor de transferência do bem partilhado")

    ok(not erros, f"Sem erro de JavaScript ({erros[:2]})")
    if len(sys.argv) > 1: pg.screenshot(path=sys.argv[1], full_page=True)
    b.close()

for st, msg in achados: print(st, "|", msg)
print("TOTAL", sum(1 for s, _ in achados if s.startswith("OK")), "de", len(achados))
