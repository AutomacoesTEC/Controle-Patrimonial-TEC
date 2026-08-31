# Mapa de cobertura da declaração IRPF 2026

Data da auditoria: 26/08/2026  
Escopo: declaração de ajuste anual, ano-calendário 2025, importada por PDF, DEC, DBK ou F2B.

## Como interpretar a cobertura

- **Estruturado e calculado**: entra em campos próprios e alimenta os totais aplicáveis do app.
- **Estruturado e informativo**: entra em campos próprios, aparece para conferência, mas não altera o caixa ou o patrimônio quando a regra fiscal não autoriza.
- **Preservado integralmente**: todo o texto do arquivo fica guardado localmente, com divisão por página no PDF e hash SHA-256. O dado não se perde, mas ainda não tem tela ou cálculo próprio.
- **Não aceitar silenciosamente**: PDF sem camada de texto é recusado com orientação para gerar novamente ou aplicar OCR.

Este desenho permite ingestão textual integral sem transformar em cálculo um campo cuja regra ou layout ainda não foi comprovado. “Receber 100%” não significa “somar 100%”: há fichas cadastrais, informativas e fiscais que não pertencem à conciliação patrimonial.

## Cobertura estruturada atual

| Bloco da declaração | PDF | DEC/DBK/F2B | Uso no app | Evidência atual |
|---|---|---|---|---|
| Identificação do contribuinte | Estruturado: nome, CPF, nascimento, raça/cor, cônjuge, endereço, contato, ocupação, tipo e recibo | Estruturado pelo registro 16, incluindo campos cadastrais, bancários, retorno ao país e Lei 14.973 | Cadastro e conferência | Dois PDFs reais e um DBK real |
| Dependentes | Estruturado, inclusive raça/cor, contato e “mora com titular” | Estruturado pelo registro 25 | Cadastro anual | Dois PDFs reais e um DBK real |
| Bens e direitos | Estruturado | Estruturado, registro 27 | Patrimônio e variação | 172 itens cruzados PDF x DBK; segundo PDF com 74 |
| Dívidas e ônus reais | Estruturado | Estruturado, registro 28 | Patrimônio e variação | Totais oficiais e casos reais |
| Rendimentos tributáveis de PJ, titular e dependentes | Estruturado | Estruturado, registros 21 e 32 | Rendimentos e caixa | Fontes, IRRF, previdência e 13º confrontados |
| Rendimentos isentos e não tributáveis | Estruturado, detalhe por fonte | Estruturado, registros 23 e 83 a 87 | Rendimentos e caixa | Agregado conciliado com detalhes |
| Tributação exclusiva/definitiva | Estruturado, detalhe por fonte | Estruturado, registros 24, 88 e 89 | Rendimentos líquidos de IRRF | Totais oficiais confrontados |
| RRA | Sem caso real preenchido; texto integral preservado | Estruturado, registros 45 e 47 | Linha própria de rendimento | Layout oficial e testes sintéticos |
| Pessoa física e exterior, Carnê-Leão | Sem caso real preenchido; texto integral preservado | Estruturado, registro 22 e totais 17/19 | Rendimentos | Layout oficial; falta PDF real preenchido |
| Exigibilidade suspensa | Preservado e gera alerta se preenchido | Detectado, não somado; registros 80/81 | Não entra como renda definitiva | Exclusão fiscal deliberada |
| Pagamentos efetuados | Estruturado | Estruturado, registro 26 | Reduz caixa pelo valor pago | Totais e descrição item a item |
| Doações efetuadas, campanha, ECA e pessoa idosa | Estruturado, layout PDF ainda sem amostra real preenchida | Estruturado, registros 34, 90, 91 e 92 | Reduz caixa | DBK oficial e fixtures; falta doação real no PDF |
| Atividade rural no Brasil | Sete subfichas estruturadas | Registros 50 a 57 estruturados | Resultado rural, dívida rural e conferência | PDF x DBK e equações de total/rebanho |
| Ganho de capital | Estruturado nas quatro famílias, inclusive parcelas quando impressas | Registros 60 a 76 estruturados nos blocos implementados; eventuais 77/78 permanecem na camada integral até validação | Ganho/perda e conferência fiscal | Três operações reais e casos de prazo |
| Renda variável comum e day trade | Mensal e anual estruturados | Registros 40 a 44 | Informativo; não duplica ajuste anual | Segundo PDF real preenchido |
| FII e Fiagro | Mensal e anual estruturados | Registros 41 a 44 | Informativo | Layout oficial e fixture; fichas reais vazias |
| Lei 14.754/2023 | Estruturado por bem e resumo | Registro 37 e resumo | Informativo e conferência | Um caso real cruzado |
| Resumo, imposto devido e evolução patrimonial | Estruturado, modelos completo e simplificado | Registros 18 e 20 | Conferência oficial | Dois PDFs e um DBK reais |
| Texto integral da declaração | Todas as páginas preservadas | Todos os registros preservados | Auditoria e reprocessamento futuro | Hash SHA-256 e exportação em TXT |

## Dados que entram somente na camada integral, sem modelo próprio

| Dado/ficha | Registro oficial quando aplicável | Situação | Tratamento seguro atual |
|---|---:|---|---|
| Cônjuge com totais próprios | 29 | Sem coleção/tela específica | Identificação do cônjuge fica estruturada; registro e PDF ficam preservados integralmente |
| Inventariante | 30 | Não modelado | Preservado integralmente e avisado quando aparece no arquivo eletrônico |
| Pensão, proventos por moléstia grave e aposentadoria especial | 31 | Não modelado como ficha própria | Preservado integralmente e avisado |
| Alimentandos e dados do processo judicial/cartório | 35 | Não modelado | Preservado integralmente e avisado |
| Proprietário/usufrutuário de bem | 36 | Vínculo ainda sem tela própria | Preservado integralmente e avisado |
| Declaração final de espólio | 38 | Fluxo especial não modelado | Preservado integralmente e avisado; não tratado como declaração comum sem alerta |
| Saída definitiva do país | 39 | Fluxo especial não modelado | Preservado integralmente e avisado |
| Herdeiros e percentuais por bem | 58/59 | Não modelado | Preservado integralmente e avisado |
| Atividade rural no exterior | 50 a 55 com `IN_EXTERIOR=1` | Não entra nos cálculos brasileiros do app | Separada do Brasil, preservada e avisada; nunca somada ao rural Brasil |
| Imposto pago/retido detalhado | 17/19 e ficha PDF | Totais já entram pelo Resumo | Detalhe preservado integralmente para não duplicar imposto |
| Campos novos de exercícios futuros | Tipo ainda desconhecido | Não podem ser interpretados antecipadamente | Arquivo integral preservado; tipo desconhecido gera alerta explícito |

## Riscos que ainda impedem afirmar cobertura sem ressalvas

1. Não existe, no acervo de teste, PDF real preenchido de doações, Carnê-Leão, RRA, FII/Fiagro, espólio, saída definitiva, alimentandos ou atividade rural no exterior.
2. PDFs digitalizados como imagem exigem OCR. O app agora recusa importação sem texto em vez de concluir com dados vazios.
3. A camada integral preserva toda informação textual, mas campos não modelados não alimentam cálculos nem telas fiscais específicas.
4. O instalador ainda não possui assinatura digital; o Windows pode mostrar aviso de editor desconhecido.
5. Perfis protegidos por senha usam AES-GCM com chave derivada por PBKDF2. Perfis sem senha ficam somente no computador, porém armazenados sem criptografia. A tela de importação agora deixa essa diferença explícita e recomenda senha para declarações reais.

## Critério de aceite para declarar uma ficha “100% estruturada”

1. Layout oficial identificado.
2. Pelo menos um caso preenchido real ou uma fixture marcada como sintética.
3. Totais da ficha fecham com o Resumo ou com outra fonte independente.
4. PDF e arquivo eletrônico concordam quando ambos existem.
5. Fluxo parser → tela de importação → reducer → histórico → retificadora testado.
6. Campo vazio numa retificadora remove o valor antigo quando o formato é o mesmo.
7. Nenhum dado é incluído em caixa, patrimônio ou imposto sem regra explícita.

## Testes reais de referência

- Declaração real A: 59 páginas, cruzada com o DBK do mesmo titular.
- Declaração real B: 50 páginas, outro titular e outro desenho de páginas.
- Planilha `VARIAÇÃO PATRIMONIAL.xls`, aba `VAR PATRIMONIAL2025`, usada como gabarito da fórmula de conciliação, não como gabarito do parser.
- Suíte automatizada com fixtures reais e sintéticas para fichas ausentes nas declarações reais.
