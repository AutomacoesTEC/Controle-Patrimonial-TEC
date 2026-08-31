"""Auditoria campo a campo dos PDFs sinteticos contra os sentinelas do roteiro."""
import sys
import pypdf

BASE = "/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte/output/pdf/"

AJU = [
    ("1  Identificacao", ["AUDITORIA PDF TEC AJUSTE", "111.444.777-35", "SENTINELA AJU PES",
                          "BAIRRO SENTINELA", "01001-000", "auditoria.pdf.aju@example.invalid"]),
    ("2  Dependentes", ["AJU PES DEPENDENTE UM", "333.444.555-08"]),
    ("3  Alimentandos", ["AJU PES ALIMENTANDO UM", "444.555.666-19", "CARTORIO AJU PES SENTINELA"]),
    ("4  RendPJ titular", ["AJU RPJ FONTE TITULAR", "51.101,11", "5.102,12", "4.104,14", "5.105,15"]),
    ("5  RendPJ dependente", ["AJU RPJ FONTE DEPENDENTE", "12.201,21", "1.202,22", "904,24"]),
    ("6  RendPF titular", ["6.301,31", "2.302,32", "303,33", "1.304,34", "7.311,41", "711,42"]),
    ("7  RendPF dependente", ["3.401,61", "1.402,62", "2.411,65"]),
    ("8  Rend isentos", ["AJU ISE DIVIDENDOS", "20.502,72", "AJU ISE APLICACAO", "3.503,73",
                         "AJU ISE DOACAO RECEBIDA", "14.504,74"]),
    ("9  Trib exclusiva", ["AJU EXC APLICACAO", "6.601,81", "AJU EXC JCP", "2.602,82", "AJU EXC PREMIO", "1.603,83"]),
    ("10 Exig suspensa tit", ["AJU EXI FONTE TITULAR", "17.701,91", "7.702,92"]),
    ("11 Exig suspensa dep", ["AJU EXI FONTE DEPENDENTE", "8.711,96", "3.712,97"]),
    ("12 RRA titular", ["AJU RRA TITULAR EXCLUSIVA", "31.801,01", "3.802,02", "4.804,04"]),
    ("13 RRA dependente", ["AJU RRA DEPENDENTE AJUSTE", "9.811,06", "812,07", "914,09"]),
    ("14 Imposto pago", ["1.901,11"]),
    ("15 Pagamentos", ["AJU PAG MEDICO", "2.001,21", "AJU PAG DENTISTA DEP", "1.502,23",
                       "AJU PAG HOSPITAL", "3.003,25", "AJU PAG ESCOLA DEP", "4.504,26",
                       "AJU PAG ADVOGADO RRA", "2.805,05", "AJU PAG PREVIDENCIA", "5.507,29"]),
    ("16 Doacoes efetuadas", ["AJU DOA PESSOA FISICA", "7.101,41", "AJU DOA BEM DEPENDENTE", "8.102,42",
                              "AJU DOA INCENTIVO", "1.103,43"]),
    ("17 Doacoes eleitorais", ["AJU ELEITORAL SENTINELA", "1.201,44"]),
    ("18 ECA", ["301,45", "97.537.776/0001-87"]),
    ("19 Pessoa Idosa", ["302,46", "17.087.890/0001-13"]),
    ("20 Bens e direitos", ["AJU BEM IMOVEL APARTAMENTO SENTINELA", "210.101,51",
                            "AJU BEM VEICULO MODELO SENTINELA", "82.202,52",
                            "AJU BEM CONTA BANCARIA TITULAR", "23.304,54",
                            "AJU BEM APLICACAO RENDA FIXA SENTINELA", "42.406,56",
                            "AJU BEM PARTICIPACAO SOCIETARIA", "61.508,58",
                            "AJU BEM NUMERARIO DEPENDENTE", "2.610,60",
                            "AJU BEM EXTERIOR LEI 14754", "22.712,62"]),
    ("21 Dividas", ["AJU DIV FINANCIAMENTO SENTINELA", "72.802,72",
                    "AJU DIV EMPRESTIMO PESSOAL", "6.805,75"]),
    ("22 Rural Brasil imovel", ["AJU RUR FAZENDA BRASIL SENTINELA", "UBERABA", "123,45"]),
    ("23 Rural Brasil receitas", ["18.101,01", "19.104,04", "20.107,07", "21.110,10"]),
    ("25 Rural rebanho", ["BOVINOS AJU SENTINELA"]),
    ("26 Rural bens", ["AJU RUR BEM TRATOR SENTINELA", "92.302,15"]),
    ("27 Rural dividas", ["AJU RUR DIVIDA CUSTEIO SENTINELA", "32.402,17"]),
    ("28 Rural exterior", ["AJU RUE FARM EXTERIOR SENTINELA", "AJU RUE CATTLE",
                           "AJU RUE BEM MAQUINA SENTINELA", "AJU RUE DIVIDA EXTERIOR SENTINELA"]),
    ("29 GC imovel", ["AJU GCI IMOVEL URBANO SENTINELA", "160.602,42", "100.601,41", "54.397,58", "8.159,63"]),
    ("30 GC bem movel", ["AJU GCM VEICULO SENTINELA", "42.612,45", "30.611,44", "10.387,55", "1.558,13"]),
    ("31 GC participacao", ["AJU GCP EMPRESA SENTINELA", "70.622,48", "40.621,47", "27.377,52", "4.106,62"]),
    ("32 GC moeda especie", ["2.001,02", "300,15"]),
    ("33 Renda variavel tit", ["2.701,61", "701,62", "3.703,71"]),
    ("34 Renda variavel dep", ["1.711,76", "411,77"]),
    ("35 FII titular", ["1.801,81", "361,83"]),
    ("36 FII dependente", ["1.811,86", "362,88"]),
    ("38 Resumo", ["22.907,85", "1.707,34"]),
]

ESP = [
    ("41 Espolio", ["AUDITORIA PDF TEC HERANCA", "555.666.777-20", "DECLARAÇÃO FINAL DE ESPÓLIO",
                    "ESP INVENTARIANTE SENTINELA", "666.777.888-30", "ESP-PROC-4101", "41 V",
                    "22/12/2025", "23/12/2025", "ESP HERDEIRO UM", "777.888.999-41", "60,00",
                    "ESP HERDEIRO DOIS", "888.999.000-78", "40,00",
                    "ESP BEM PARTILHA SENTINELA", "123.401,41", "11/01/1980", "SENTINELA ESP PES"]),
]

SAI = [
    ("42 Saida definitiva", ["AUDITORIA PDF TEC SAIDA", "999.000.111-12", "DECLARAÇÃO DE SAÍDA",
                             "24/12/2025", "SAI PROCURADOR SENTINELA", "101.202.303-64",
                             "AUDIT EXIT AVENUE", "33101", "sai.auditoria@example.invalid",
                             "SAI RPJ FONTE TITULAR", "43.201,11", "4.202,12", "3.203,13",
                             "SAI BEM IMOVEL BRASIL SENTINELA", "144.401,41",
                             "SAI BEM EXTERIOR CONTA SENTINELA", "35.403,43", "2.032,33"]),
]


def paginas(caminho):
    r = pypdf.PdfReader(caminho)
    return [" ".join((p.extract_text() or "").split()) for p in r.pages]


def auditar(nome, arquivo, grupos):
    pgs = paginas(BASE + arquivo)
    todo = " ".join(pgs)
    print(f"\n{'=' * 78}\n{nome}: {len(pgs)} páginas, {sum(1 for p in pgs if p.strip())} com texto, {len(todo)} caracteres")
    faltando = []
    for grupo, alvos in grupos:
        achados = []
        for a in alvos:
            ps = [i + 1 for i, t in enumerate(pgs) if a in t]
            if ps:
                achados.append(f"{a}=p{ps[0]}")
            else:
                faltando.append((grupo, a))
                achados.append(f"{a}=AUSENTE")
        marca = "ok " if not any("AUSENTE" in x for x in achados) else "!! "
        print(f"  {marca}{grupo}")
        if marca == "!! ":
            for x in achados:
                if "AUSENTE" in x:
                    print(f"        {x}")
    print(f"  --> {len(faltando)} sentinelas ausentes de {sum(len(a) for _, a in grupos)}")
    return faltando


f1 = auditar("AJU-01", "AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf", AJU)
f2 = auditar("ESP-01", "ESP-01-DECLARACAO-FINAL-ESPOLIO-IRPF-2026.pdf", ESP)
f3 = auditar("SAI-01", "SAI-01-DECLARACAO-SAIDA-DEFINITIVA-IRPF-2026.pdf", SAI)
print(f"\nTOTAL AUSENTES: {len(f1) + len(f2) + len(f3)}")
