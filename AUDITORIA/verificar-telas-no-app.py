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
achados = []

def norm(t):
    # O Chromium devolve o texto JÁ com text-transform aplicado (cabeçalho em
    # maiúscula) e a moeda pt-BR usa espaço não separável depois de "R$".
    t = t.replace(" ", " ").replace(" ", " ")
    return unicodedata.normalize("NFC", t).upper()

def ok(cond, msg):
    achados.append(("OK  " if cond else "FALHA", msg))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 1600, "height": 1200})
    erros = []
    pg.on("pageerror", lambda e: erros.append(str(e)))
    pg.goto("http://localhost:4173/", wait_until="networkidle")
    pg.set_input_files("input[type=file]", PDF)
    pg.wait_for_selector("text=Usar esta declaração", timeout=180000)
    pg.get_by_role("button", name="Usar esta declaração").click()
    pg.wait_for_selector("text=Preenchido a partir de", timeout=60000)
    pg.fill("input.form-control >> nth=0", "TESTE AJU 01")
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

    t = ir("Relatório IRPF")
    ok("APLICAÇÃO FINANCEIRA" in t and "LUCROS E DIVIDENDOS" in t, "Relatório: legenda AF e LD do demonstrativo do exterior")
    ok("PARCELA NÃO DEDUTÍVEL" in t, "Relatório: coluna de parcela não dedutível")

    ok(not erros, f"Sem erro de JavaScript ({erros[:2]})")
    if len(sys.argv) > 1: pg.screenshot(path=sys.argv[1], full_page=True)
    b.close()

for st, msg in achados: print(st, "|", msg)
print("TOTAL", sum(1 for s, _ in achados if s.startswith("OK")), "de", len(achados))
