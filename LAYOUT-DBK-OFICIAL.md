# Layout oficial do arquivo de dados da declaração (IRPF 2026)


Extraído de `LayoutDadosDIRPF2026.xml`, que vive dentro do `irpf.jar` do próprio
programa da Receita (`IRPF2026Win32v1.5.exe` é um ZIP; o jar está na raiz dele).
É a fonte PRIMÁRIA do layout dos arquivos `.DBK`, `.DEC` e `.F2B` — antes disto,
cada posição deste projeto tinha sido decifrada por tentativa e erro, casando
valores contra o PDF da mesma declaração.

Para regerar:

```
python3 -c "import zipfile; zipfile.ZipFile('IRPF2026Win32v1.5.exe').extract('irpf.jar')"
python3 -c "import zipfile; zipfile.ZipFile('irpf.jar').extract('LayoutDadosDIRPF2026.xml')"
```

Posições são 1-based e correspondem a `field(line, pos, tam)` em
`src/pages/importParsers.js`. Formato: `N` numérico, `C`/`A` texto.

**TODOS os tipos do XML estão aqui**, e não só os que o parser lê. A primeira
versão deste arquivo trazia só os "usados", e isso cobrou o preço na primeira
vez que precisei de um tipo de fora (o registro 32): foi preciso reextrair o
XML do instalador. O custo de listar tudo é algumas dezenas de KB.

**IN_EXTERIOR**: repare que os registros da Atividade Rural (50 a 55) usam o
MESMO tipo para Brasil e Exterior, distinguidos por esse campo na posição 14.
Ignorar isso faz o exterior somar com o Brasil.


## Registro `16` — 65 campos, largura 1250

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 60 | A | NM_NOME | nome do contribuinte |
| 74 | 15 | A | TIP_LOGRA | formato do Logradouro |
| 89 | 40 | C | NM_LOGRA | Endereço contribuinte: logradouro |
| 129 | 6 | C | NR_NUMERO | Endereço contribuinte: número |
| 135 | 21 | C | NM_COMPLEM | Endereço contribuinte: complemento |
| 156 | 19 | C | NM_BAIRRO | Endereço contribuinte: bairro |
| 175 | 9 | C | NR_CEP | Endereço contribuinte: CEP ou ZIPExterior |
| 184 | 4 | N | CD_MUNICIP | Endereço contribuinte: código do município |
| 188 | 40 | C | NM_MUNICIP | Endereço contribuinte: município |
| 228 | 2 | A | SG_UF | Endereço contribuinte: UF |
| 230 | 3 | C | CD_EX | Código do Exterior |
| 233 | 3 | C | CD_PAIS | Código do país |
| 236 | 40 | C | NM_PAIS | nome do país |
| 276 | 90 | C | NM_EMAIL | Email - Correio Eletrônico |
| 366 | 11 | C | NR_NITPISPASEP | informação do NIT/PIS/PASEP informação constante na ficha de Pessoa Fisica no Exterior. Sem valor informado campo em branco. |
| 377 | 11 | C | NR_CPF_CONJUGE | CPF do conjuge |
| 388 | 4 | C | NR_DDD_TELEFONE | Endereço contribuinte: Cod. área do telefone-DDI |
| 392 | 9 | A | FILLER1 | Espaços em branco |
| 401 | 8 | N | DT_NASCIM | Data nascimento do contribuinte DD-MM-AAAA |
| 409 | 13 | N | FILLER | Espaços em branco |
| 422 | 3 | A | CD_OCUP | Código de ocupação |
| 425 | 150 | C | NM_OCUP |  |
| 575 | 2 | A | CD_NAT_OCUP | Código natureza ocupação |
| 577 | 130 | C | NM_NAT_OCUP |  |
| 707 | 1 | N | NR_QUOTAS | Quantidades de quotas |
| 708 | 1 | C | IN_COMPLETA | Indicativo se declaração completa S - sim N - não |
| 709 | 1 | C | IN_RETIFICADORA | Indicativo se declaração retificadora S - sim N - não |
| 710 | 1 | C | IN_GERADO | Indicativo se a declaração foi gerada S - sim N - não |
| 711 | 1 | C | IN_ENDERECO | Indicativo se houve mudança de endereço S - sim N - não |
| 712 | 12 | C | NR_CONTROLE_ORIGINAL | Número do recibo da declaração original |
| 724 | 3 | N | NR_BANCO | Código do Banco para restituição ou débito |
| 727 | 4 | N | NR_AGENCIA | Número da Agência Bancária para restituição ou débito |
| 731 | 1 | C | IN_DOENCA_DEFICIENCIA | Indicativo se um dos declarantes(titular ou dependentes) é pessoa com doença grave ou portadora de deficiência física ou mental (V |
| 732 | 1 | C | IN_PREPREENCHIDA | Filler |
| 733 | 8 | N | DT_DIA_UTIL_RECIBO | 1o dia util pos entrega |
| 741 | 4 | C | FILLER | filler |
| 745 | 1 | N | IN_PROCESSO_ATUALIZACAO_BEM | O contribuinte fez atualização de algum bem de acordo com a Lei 14973 de 16/09/2024: 0-Não (padrão) 1-Sim |
| 746 | 2 | C | NR_DV_CONTA | Número do Dígito Verificador da Conta Corrente para restituição ou débito |
| 748 | 1 | A | IN_DEBITO_AUTOM | Indicativo se o contribuinte autoriza o débito automático das quotas do imposto devido em sua conta corrente. S - sim N -não |
| 749 | 1 | N | IN_DEBITO_PRIMEIRA_QUOTA | Indicativo se o débito automático é a partir da 1 Quota ou quota única - 1 - sim 0 -não |
| 750 | 14 | C | NR_FONTE_PRINCIPAL | CPF-CNPJ da principal Fonte Pagadora |
| 764 | 10 | C | NR_RECIBO_ULTIMA_DEC_ANO_ANTERIOR | Número do recibo da última declaração transmitida no ano anterior |
| 774 | 1 | C | IN_TIPODECLARACAO | Indica se a declaração é do tipo Ajuste, Espólio ou Saída |
| 775 | 11 | C | NR_CPF_PROCURADOR | CPF do procurador, caso a declaração seja de ajuste e o endereço no exterior |
| 786 | 20 | A | NR_REGISTRO_PROFISSIONAL | Numero do registro profissional |
| 806 | 2 | C | NR_DDD_CELULAR | Zeros - DDD do celular |
| 808 | 9 | C | NR_CELULAR | Zeros - Celular |
| 817 | 1 | C | IN_CONJUGE | S-Sim ; N-Não |
| 818 | 11 | C | NR_TELEFONE | Endereço contribuinte: telefone |
| 829 | 1 | C | IN_TIPO_CONTA | 0-Conta corrente 1-Conta Poupança 2-Conta pagamento |
| 830 | 20 | C | NR_CONTA | Numero da conta corrente para depósito de IAR |
| 850 | 17 | C | NR_NUMERO_PROCESSO | Numero do processo digital |
| 867 | 11 | C | CPF_RESPONSAVEL | CPF do Responsável declaração. |
| 878 | 14 | N | NR_DATA_HORA_ORIGINAL_RETIFICADORA | CPF do Responsável declaração. |
| 892 | 300 | C | TX_MENSAGEM_RECIBO | CPF do Responsável declaração. |
| 1192 | 1 | C | IN_RETORNO_PAIS | 0-Nao (padrao) 1-Sim |
| 1193 | 8 | C | DT_RETORNO_PAIS | Data de retorno ao pais, para quem estava morando no exterior. |
| 1201 | 17 | C | NR_PROCESSO_ATUALIZACAO_BEM | Número do processo em que foi formalizada a opção pela Lei 14973 DE 16/09/2024 |
| 1218 | 8 | C | NR_PROCESSO_ATUALIZACAO_BEM_FILLER | Filler de resto do processo que teria 25 caracteres e passo a ter apenas 17 |
| 1226 | 13 | N | VR_PREJUIZO_ANO_ANTERIOR_LEI_14754 | Prejuízo acumulado no ano anterior com aplicações financeiras no exterior |
| 1239 | 1 | C | IN_PREJUIZO_ANO_ANTERIOR_LEI_14754 | indicador de Prejuízo acumulado no ano anterior com aplicações financeiras no exterior |
| 1240 | 1 | N | IN_RACA_COR | Pergunta Raca cor 0 - Nao informada 1 - Amarela 2 - Branca 3 - Indigena 4 - Parda 5 - Preta |
| 1241 | 10 | N | NR_CONTROLE | Número de controle |

## Registro `17` — 29 campos, largura 361

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_IMPCOMP | Valor do Imposto Complementar do titular |
| 27 | 13 | N | VR_LUCROSTIT | Lucros e Dividendos recebidos pelo Titular |
| 40 | 13 | N | VR_ISENTOS | Demais Rendimentos isentos e não-tributáveis do titular exceto ativ. Rural, GC e GCME |
| 53 | 13 | N | VR_EXCLUSIVOS | Valor dos Rendimentos sujeitos à  tributação exclusiva Exceto 13 salário,Renda Variável, GC e GCME do titular |
| 66 | 13 | N | VR_TOTAL13 | Valor do 13o. do Titular |
| 79 | 13 | N | VR_IRFONTELEI11033 | Valor Retido na Fonte Lei n 11.033-2004 |
| 92 | 13 | N | VR_TOTAL13DEPEND | Valor do 13o. do Dependente |
| 105 | 13 | N | VR_LUCROSDEPEND | Lucros e Dividendos recebidos pelos Dependentes |
| 118 | 13 | N | VR_ISENTOSDEPEND | Demais Rendimentos isentos e não-tributáveis dos dependentes |
| 131 | 13 | N | VR_EXCLUSIVOSDEPEND | Valor dos Rendimentos sujeitos à  tributação exclusiva dos dependentes Exceto 13 salário |
| 144 | 13 | A | FILLER1 | Espaços em branco |
| 157 | 13 | A | FILLER2 | Espaços em branco |
| 170 | 13 | N | VR_RENDPF_TIT | Total de Rendimentos Recebidos de PF pelo titular |
| 183 | 13 | N | VR_RENDPF_DEPEND | Total de Rendimentos Recebidos de PF pelos dependentes |
| 196 | 13 | N | VR_RENDEXT_TIT | Total de Rendimentos Recebidos do exterior pelo titular |
| 209 | 13 | N | VR_RENDEXT_DEPEND | Total de Rendimentos Recebidos do exterior pelos dependentes |
| 222 | 13 | N | VR_CARNELEAO_TIT | Valor pago Carnê-LeãoTitular |
| 235 | 13 | N | VR_CARNELEAO_DEPEND | Valor pago Carnê-LeãoDependentes |
| 248 | 13 | N | VR_DEPEN | Dedução com dependentes (Ficha Dependentes) |
| 261 | 13 | N | VR_TOT_PREVOFC_AC_TIT | Total previdência oficial RRA - pelo titular (Ficha RRA - Titular - opção de tributação ajuste anual) |
| 274 | 13 | N | VR_TOT_PREVOFC_AC_DEP | Total previdência oficial RRA - pelos dependentes (Ficha RRA - Dependentes - opção de tributação ajuste anual) |
| 287 | 13 | N | VR_TOT_PENSALI_AC_TIT | Total Pensão Alimentícia RRA - pelo titular (Ficha RRA - Titular - opção de tributação ajuste anual) |
| 300 | 13 | N | VR_TOT_PENSALI_AC_DEP | Total Pensão Alimentícia RRA - pelos dependentes (Ficha RRA - Dependentes - opção de tributação ajuste anual |
| 313 | 13 | N | VR_IMPEXT | Valor do imposto pago exterior |
| 326 | 13 | N | VR_IMPDEVIDO_SEM_REND_EXT | Imposto devido sem o rendimento no exterior |
| 339 | 13 | N | VR_LIMITE_IMP_PAGO_EXT | Limite do imposto pago no exterior |
| 352 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `18` — 60 campos, largura 744

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_RENDTRIB | Valor do Rendto+Rendto. Atividade Rural +PF+Exterior do Titular + dependente. |
| 27 | 13 | N | VR_DESCSIMP | Desconto Simplificado |
| 40 | 13 | N | VR_BASECALC | Base de cálculo do imposto |
| 53 | 13 | N | VR_IMPDEVIDO | Total do Imposto devido |
| 66 | 13 | N | VR_IMPOSTO | Imposto retido na fonte-Titular e dependente |
| 79 | 13 | N | VR_IMPCOMP | Imposto complementar. e pago no exterior-Titular e Dependente |
| 92 | 13 | N | VR_LEAO | Carnê-leão, imposto complementar. e pago no exterior-Titular e Dependente |
| 105 | 13 | N | VR_IRFONTELEI11033 | Valor Retido na Fonte (Lei Nº 11.033/2004)-Titular e Dependente |
| 118 | 13 | N | VR_IMPRESTIT | Saldo do imposto a restituir |
| 131 | 13 | N | VR_IMPPAGAR | Saldo do Imposto a pagar |
| 144 | 1 | N | NR_QUOTAS | Numero de quotas |
| 145 | 13 | N | VR_QUOTA | Valor da quota |
| 158 | 13 | N | VR_TOTISENTO | Rendimento Isentos e não tributáveis - Titular e dependente |
| 171 | 13 | N | VR_TOTEXCLUSIVO | Rendimento sujeitos a Tributação exclusiva -Titular e dependente |
| 184 | 13 | N | FILLER | FILLER |
| 197 | 13 | N | VR_RENDTRIBDEPENDENTE | Valor do Rendimento PJ - Dependente |
| 210 | 13 | N | VR_IMPOSTODEPENDENTE | Imposto retido na fonte - Dependente |
| 223 | 13 | N | VR_IMPPAGARESPECIE | Imposto a Pagar Ganhos de Capital - Moeda em Espécie |
| 236 | 13 | N | VR_TOTRENDTRIBPJTITULAR | Total do rendimento Tributável PJ - Titular |
| 249 | 13 | N | VR_RENDTRIBARURAL | Total do rendimento AR-Brasil e Ext.(Linha 7 da ficha Apuração do Resultado |
| 262 | 13 | N | VR_TOTFONTETITULAR | Total do Imposto Retido na Fonte - Titular |
| 275 | 13 | N | VR_TOTBENSANOBASEANTERIOR | Total dos bens do ano anterior ao ano base |
| 288 | 13 | N | VR_TOTBENSANOBASE | Total dos bens do ano base |
| 301 | 13 | N | VR_RENDISENTOTITULAR | Total Rend. isentos/Não tributáveis - Titular |
| 314 | 13 | N | VR_RENDISENTODEPENDENTES | Total Rend. isentos/Não tributáveis - Depend. |
| 327 | 13 | N | VR_TOTRENDEXCLUSTITULAR | Total Rend. Tributação Exclusiva - Titular |
| 340 | 13 | N | VR_RENDEXCLUSDEPENDENTES | Total Rend. Tributação Exclusiva - Depend. |
| 353 | 13 | N | VR_RESNAOTRIB_AR | Total Não Tributável(Linha 11 do Resultado da AR, se Brasil e Linha 10, se Exterior.) |
| 366 | 13 | N | VR_TOTDIVIDAANOBASEANTERIOR | Total das dívidas do ano anterior ao ano base |
| 379 | 13 | N | VR_TOTDIVIDAANOBASE | Total das dívidas do ano base |
| 392 | 13 | N | VR_TOTIRFONTELEI11033 | Valor Retido na Fonte (Lei Nº 11.033/2004) - Titular+Dependente+Renda Variável+Ganho de Capital em PS |
| 405 | 13 | N | VR_SUBTOTALISENTOTRANSPORTE | Subtotal dos rendimentos isentos e não tributáveis |
| 418 | 13 | N | VR_SUBTOTALEXCLUSIVOTRANSPORTE | Subtotal dos rendimentos sujeitos à  tributação exclusiva |
| 431 | 13 | N | VR_GANHOLIQUIDORVTRANSPORTE | Ganhos líquidos em renda variável |
| 444 | 13 | N | VR_RENDISENTOGCTRANSPORTE | Parcela isenta proveniente dos Ganhos de Capital |
| 457 | 13 | N | VR_RENDPFEXT | Total de Rendimentos Recebidos de PF/exterior pelo titular |
| 470 | 13 | N | VR_RENDPFEXTDEPEN | Total de Rendimentos Recebidos de PF/exterior pelos dependentes |
| 483 | 13 | N | VR_DOACOESCAMPANHA | Total de Doacoes a Campanha Eleitoral |
| 496 | 13 | N | VR_TOTRENDPJ_EXIB_SUSPTITULAR | Total de Rendimentos Recebidos de PF-exigibilidade suspensa pelo titular |
| 509 | 13 | N | VR_TOTRENDPJ_EXIB_SUSPDEPEN | Total de Rendimentos Recebidos de PF-exigibilidade suspensa pelo dependente |
| 522 | 13 | N | VR_TOTDEPJUDIC_TITULAR | Total de depósitos judiciais-exigibilidade suspensa pelo titular |
| 535 | 13 | N | VR_TOTDEPJUDIC_DEPENDEN | Total de depósitos judiciais-exigibilidade suspensa pelos dependentes |
| 548 | 13 | N | VR_TOTREND_AC_TIT | Total de Rendimentos Recebidos acumuladamente pelo titular |
| 561 | 13 | N | VR_TOT_IRF_AC_TIT | Total IRF RRA - pelo titular |
| 574 | 13 | N | VR_TOT_IMPOSTO_RRA_TIT | Total IMPOSTO RRA - pelo titular |
| 587 | 13 | N | VR_TOTREND_AC_DEP | Total de Rendimentos Recebidos acumuladamente pelos dependentes |
| 600 | 13 | N | VR_TOT_IRF_AC_DEP | Total IRF RRA - pelos dependentes |
| 613 | 13 | N | VR_TOT_IMPOSTO_RRA_DEP | Total IMPOSTO RRA - pelos dependentes |
| 626 | 13 | N | VR_TOT_IMPOSTO_DEVIDO | Total do Imposto devido (incluindo RRA) |
| 639 | 13 | N | VR_IMPOSTO_DIFERIDO_GCAP | Imposto diferido GCAP |
| 652 | 13 | N | VR_IMPOSTO_DEVIDO_GCAP | Imposto devido sobre ganho de capital |
| 665 | 13 | N | VR_IMPOSTO_GANHOLIQ_RVAR | Imposto devido sobre ganho liquido em renda variável |
| 678 | 13 | N | VR_IMPOSTO_DEVIDO_GCME | Imposto devido sobre ganho de capital moeda estrangeira - bens, direitos e aplicações financeiras |
| 691 | 13 | N | VR_IMPEXT | Imposto pago no exterior(após cálculo do limite) |
| 704 | 5 | N | VR_ALIQUOTA_EFETIVA | Calculo do imposto - valor da aliquota efetiva |
| 709 | 13 | N | VR_BASE_CALCULO_LEI_14754 | Base de cálculo final de aplicações financeiras no exterior Obs.: Esse campo pode receber valores negativos. |
| 722 | 13 | N | VR_IMPOSTO_DEVIDO_LEI_14754 | Imposto devido final com aplicações financeiras no exterior |
| 735 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `19` — 29 campos, largura 346

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 14 | C | NR_FONTE | CNPJ-CPF principal fonte pagadora |
| 28 | 13 | N | VR_IMPEXT | Valor do imposto pago exterior |
| 41 | 13 | N | VR_IMPCOMP | Valor do imposto complementar pago |
| 54 | 13 | N | VR_IRFONTELEI11033 | Valor Retido na Fonte Lei n 11.033-2004 |
| 67 | 13 | N | VR_RECEX_TIT | Rendimentos recebidos do ExteriorTitular |
| 80 | 13 | N | VR_LIVCAIX_TIT | Livro caixaTitular |
| 93 | 13 | N | VR_CARNELEAO_TIT | Valor pago Carnê-LeãoTitular |
| 106 | 13 | N | VR_RECEX_DEP | Rendimentos recebidos do ExteriorDependentes |
| 119 | 13 | N | VR_LIVCAIX_DEP | Livro caixaDependentes |
| 132 | 13 | N | VR_CARNELEAO_DEP | Valor pago Carnê-LeãoDependentes |
| 145 | 13 | N | VR_PREVPRIV | Contribuição previdenciária privada |
| 158 | 13 | N | VR_FAPI | Contribuição FAPI |
| 171 | 13 | N | VR_PREVOFTITULAR | Total da contribuição previdenciária oficial do Titular (Exceto RRA) |
| 184 | 13 | N | VR_PREVOFDEPENDENTE | Total da contribuição previdenciária oficial do Dependente (Exceto RRA) |
| 197 | 13 | N | VR_TOTAL13TITULAR | Total do décimo terceiro salário do Titular |
| 210 | 13 | N | VR_TOTAL13DEPENDENTE | Total do décimo terceiro salário do Dependente |
| 223 | 5 | N | NR_DEPENDENTE_DESP_INSTRUCAO | Numero de Dependentes com despesa de instrução |
| 228 | 5 | N | NR_ALIMENTANDO_DESP_INSTRUCAO | Numero de Alimentandos com despesa de instrução |
| 233 | 13 | N | VR_RENDPF_TIT | Total de Rendimentos Recebidos de PF pelo titular |
| 246 | 13 | N | VR_RENDPF_DEPEND | Total de Rendimentos Recebidos de PF pelos dependentes |
| 259 | 13 | N | VR_RENDEXT_TIT | Total de Rendimentos Recebidos do exterior pelo titular |
| 272 | 13 | N | VR_RENDEXT_DEPEND | Total de Rendimentos Recebidos do exterior pelos dependentes |
| 285 | 13 | N | VR_IMPDEVIDO_SEM_REND_EXT | Imposto devido sem o rendimento do exterior |
| 298 | 13 | N | VR_LIMITE_IMP_PAGO_EXT | Limite do imposto pago no exterior |
| 311 | 13 | N | VR_ATE_LIMITE_FUNPRESP | Valor da FUNPRESP ate o limite do ente patrocionador |
| 324 | 13 | N | VR_ACIMA_LIMITE_FUNPRESP | Valor da FUNPRESP acima do limite do ente patrocionador |
| 337 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `20` — 74 campos, largura 926

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_RENDJUR | Rendimentos recebidos Pessoa JurídicaTitular |
| 27 | 13 | N | VR_RENDPFEXT | Total de Rendimentos Recebidos de PF, aluguéis, outros e exterior pelo titular |
| 40 | 13 | N | VR_RENDPFEXTDEPEN | Total de Rendimentos Recebidos de PF, aluguéis, outros e exterior pelos dependentes |
| 53 | 13 | N | VR_RESAR | Resultado da Atividade Rural |
| 66 | 13 | N | VR_TOTTRIB | Total de Rendimentos tributáveis |
| 79 | 13 | N | VR_PREVOF_FUNPRESP_LIMITE | Contribuição previdenciária oficial + FUNPRESP (Ate o limite do Ente) |
| 92 | 13 | N | VR_TOTPRIVADA_FAPI_FUNPRESP | Previdência privada + FAPI + FUNPRESP (acima do limite do ente) limitada a 12 Rend.Trib. |
| 105 | 13 | N | VR_DEPEN | Dedução com dependentes |
| 118 | 13 | N | VR_DESPINST | Despesas com instrução |
| 131 | 13 | N | VR_DESPMEDIC | Despesas médicas |
| 144 | 13 | N | VR_PENSAO | Pensão Alimentícia Judicial |
| 157 | 13 | N | VR_PENSAO_CARTORIO | Pensão Alimentícia por escritura pública |
| 170 | 13 | N | VR_LIVCAIX | Livro caixaTitular + Dependente |
| 183 | 13 | N | VR_DEDUC | Total das deduções |
| 196 | 13 | N | VR_BASECALC | Base de cálculo do imposto |
| 209 | 13 | N | VR_IMPOSTO | Valor do Imposto |
| 222 | 13 | N | VR_DEDIMPOSTO | Dedução do impostodedução de incentivo limitada a 6 do valor do imposto |
| 235 | 13 | N | VR_IMPDEV1 | Imposto menos deduções de incentivo. |
| 248 | 13 | N | VR_CONTRIBPREV | Contribuição Prev. Social emp. doméstico |
| 261 | 13 | N | VR_IMPDEV2 | Imposto devido I menos Contribuição Prev. Social emp. doméstico. |
| 274 | 13 | N | VR_IMPDEV3 | Imposto devido 2 mais imposto devido RRA |
| 287 | 13 | N | VR_IMPFONTE | Imposto na fonte - Titular |
| 300 | 13 | N | VR_CARNELEAO | Valor pago Carnê-LeãoTitular + Dependente |
| 313 | 13 | N | VR_IMPCOMPL | Imposto complementar |
| 326 | 13 | N | VR_IMPEXT | Imposto pago no exteriorapós cálculo do limite |
| 339 | 13 | N | VR_IRFONTELEI11033 | Valor Retido na Fonte Lei n 11.033-2004-Ficha Imposto Pago |
| 352 | 13 | N | VR_TOTIMPPAGO | Total do imposto pago |
| 365 | 13 | N | VR_IMPREST | Imposto a restituir |
| 378 | 13 | N | VR_IMPPAGAR | Imposto a pagar |
| 391 | 1 | N | NR_QUOTAS | Quantidade de quotas |
| 392 | 13 | N | VR_QUOTA | Valor de cada quota |
| 405 | 13 | N | VR_BENSANT | Total de Bens e Direitos do ano anterior |
| 418 | 13 | N | VR_BENSATUAL | Total de Bens e Direitos do ano atual |
| 431 | 13 | N | VR_DIVIDAANT | Total de Ônus e Dívidas do ano anterior |
| 444 | 13 | N | VR_DIVIDAATUAL | Total de Ônus e Dívidas do ano atual |
| 457 | 13 | N | FILLER | FILLER |
| 470 | 13 | N | VR_TOTISENTOS | Total dos Rendimentos isentos -Titular e Dependente |
| 483 | 13 | N | VR_TOTEXCLUS | Total dos Rendimentos exclusivos - Titular e Dependente |
| 496 | 13 | N | VR_IMPGC | Imposto sobre Ganhos de Capital |
| 509 | 13 | N | VR_TOTIRFONTELEI11033 | Valor Retido na Fonte Lei n 11.033-2004-Ficha Outras InformaçõesImposto Pago + GC em PS + RV |
| 522 | 13 | N | VR_IMPRV | Imposto sobre Renda Variável |
| 535 | 13 | N | VR_RENDJURDEPENDENTE | Rendimentos recebidos Pessoa Jurídica - Dependente |
| 548 | 13 | N | VR_IMPFONTEDEPENDENTE | Imposto na fonte - Dependente |
| 561 | 13 | N | VR_IMPPAGOVCBENS | Imposto Pago Moeda Estrangeira-Bens,Dir e Aplic.Fin. |
| 574 | 13 | N | VR_IMPPAGOVCESPECIE | Imposto a Pagar Ganhos de Capital - Moeda em Espécie |
| 587 | 13 | N | VR_TOTRENDISENTOSITULAR | Total de Rendimentos isentos do Titular |
| 600 | 13 | N | VR_TOTRENDISENTOSDEPENDENTE | Total de Rendimentos isentos do Dependente |
| 613 | 13 | N | VR_TOTRENDEXCLTITULAR | Total de Rendimentos exclusivos do Titular |
| 626 | 13 | N | VR_TOTRENDEXCLDEPENDENTE | Total de Rendimentos exclusivos do Dependente |
| 639 | 13 | N | VR_TOTDOACOESCAMPANHA | Total de doações da campanha eleitoral |
| 652 | 13 | N | VR_TOTRENDPJ_EXIB_SUSPTITULAR | Total de Rendimentos Recebidos de PJ-exigibilidade suspensa pelo titular |
| 665 | 13 | N | VR_TOTRENDPJ_EXIB_SUSPDEPENDEN | Total de Rendimentos Recebidos de PJ-exigibilidade suspensa pelos dependentes |
| 678 | 13 | N | VR_TOTDEPJUDIC_TITULAR | Total de depósitos judiciais-exigibilidade suspensa pelo titular |
| 691 | 13 | N | VR_TOTDEPJUDIC_DEPENDEN | Total de depósitos judiciais-exigibilidade suspensa pelos dependentes |
| 704 | 13 | N | VR_TOTREND_AC_TIT | Total de Rendimentos Recebidos acumuladamente pelo titular |
| 717 | 13 | N | VR_TOT_PREVOFC_AC_TIT | Total previdência oficial RRA - pelo titular |
| 730 | 13 | N | VR_TOT_PENSALI_AC_TIT | Total Pensão Alimentícia RRA - pelo titular |
| 743 | 13 | N | VR_TOT_IRF_AC_TIT | Total IRF RRA - pelo titular |
| 756 | 13 | N | VR_TOT_IMPOSTO_RRA_TIT | Total IMPOSTO RRA - pelo titular |
| 769 | 13 | N | VR_TOTREND_AC_DEP | Total de Rendimentos Recebidos acumuladamente pelos dependentes |
| 782 | 13 | N | VR_TOT_PREVOFC_AC_DEP | Total previdência oficial RRA - pelos dependentes |
| 795 | 13 | N | VR_TOT_PENSALI_AC_DEP | Total Pensão Alimentícia RRA - pelos dependentes |
| 808 | 13 | N | VR_TOT_IRF_AC_DEP | Total IRF RRA - pelos dependentes |
| 821 | 13 | N | VR_TOT_IMPOSTO_RRA_DEP | Total IMPOSTO RRA - pelos dependentes |
| 834 | 13 | N | VR_IMPOSTO_DIFERIDO_GCAP | Imposto diferido GCAP |
| 847 | 13 | N | VR_IMPOSTO_DEVIDO_GCAP | Imposto devido sobre ganho de capital |
| 860 | 13 | N | VR_IMPOSTO_GANHOLIQ_RVAR | Imposto devido sobre ganho liquido em renda variável |
| 873 | 13 | N | VR_IMPOSTO_DEVIDO_GCME | Imposto devido sobre ganho de capital moeda estrangeira - bens, direitos e aplicações financeiras |
| 886 | 5 | N | VR_ALIQUOTA_EFETIVA | Calculo do imposto - valor da aliquota efetiva |
| 891 | 13 | N | VR_BASE_CALCULO_LEI_14754 | Base de cálculo final de aplicações financeiras no exterior Obs.: Esse campo pode receber valores negativos. |
| 904 | 13 | N | VR_IMPOSTO_DEVIDO_LEI_14754 | Imposto devido final com aplicações financeiras no exterior |
| 917 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `21` — 11 campos, largura 170

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 14 | N | NR_PAGADOR | CNPJ fonte pagadora |
| 28 | 60 | N | NM_PAGADOR | nome fonte pagadora |
| 88 | 13 | C | VR_RENDTO | Valor rendimento recebido |
| 101 | 13 | A | VR_CONTRIB | Valor contribuição previdenciária oficial |
| 114 | 13 | N | VR_DECTERC | Valor décimo terceiro salário |
| 127 | 13 | N | VR_IMPOSTO | Valor imposto retido na fonte |
| 140 | 8 | C | DT_COMUNICACAO_SAIDA | Data da comunicação de saída à  fonte pagadora |
| 148 | 13 | N | VR_IRRF13SALARIO | Valor imposto retido na fonte sobre o 13 salario |
| 161 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `22` — 16 campos, largura 167

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | I | E_DEPENDENTE | Indicativo se registro de dependenteS ou TitularN |
| 15 | 11 | C | NR_CPF_DEPEN | CPF do Dependente |
| 26 | 2 | N | NR_MES | Mês de ocorrência |
| 28 | 13 | N | VR_RENDTO | Valor rendimentos recebidos |
| 41 | 13 | N | VR_ALUGUEIS | Valor rendimentos recebidos de alugueis |
| 54 | 13 | N | VR_OUTROS | Valor rendimentos recebidos outros |
| 67 | 13 | N | VR_EXTER | Valor rendimento recebido no exterior |
| 80 | 13 | N | VR_LIVCAIX | Valor dedução livro-caixa |
| 93 | 13 | N | VR_ALIMENT | Valor dedução com pensão alimentícia |
| 106 | 13 | N | VR_DEDUC | Valor dedução com dependente |
| 119 | 13 | N | VR_PREVID | Valor pago previdência |
| 132 | 13 | N | VR_BASECALCULO | Valor Base de cálculo rendimentos - deduções |
| 145 | 13 | N | VR_IMPOSTO | Valor imposto pagoCarnê-Leão |
| 158 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `23` — 5 campos, largura 40

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 4 | N | NR_COD_ISENTO | Código do rendimento isento e não tributavel |
| 18 | 13 | N | VR_VALOR | Valor do rendimento |
| 31 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `24` — 5 campos, largura 40

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 4 | N | NR_COD_EXCLUSIVO | Código do rendimento de tributação exclusivo |
| 18 | 13 | N | VR_VALOR | Valor do rendimento |
| 31 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `25` — 15 campos, largura 224

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Numero de chave do dependente |
| 19 | 2 | C | CD_DEPEND | Código da relação de dependência |
| 21 | 60 | A | NM_DEPEND | nome do dependente |
| 81 | 8 | N | DT_NASCIM | Data de nascimento DDMMAAAA |
| 89 | 11 | C | NI_DEPEND | CPF do dependente |
| 100 | 1 | N | IN_SAIDA | Indicador de saída junto com o declarante |
| 101 | 11 | C | NR_NITPISPASEP | informação do NIT/PIS/PASEP informação constante na ficha de Pessoa Fisica no Exterior. Sem valor informado campo em branco. |
| 112 | 1 | C | IN_ENDERECO_TITULAR | Indicativo se dependente mora com o titular (Valor 0 ou 1) |
| 113 | 90 | C | NM_EMAIL | Endereço contribuinte: Email - Correio Eletrônico |
| 203 | 2 | C | NR_DDD_CELULAR | Numero do ddd do celular |
| 205 | 9 | C | NR_CELULAR | Numero do celular |
| 214 | 1 | C | IN_RACA_COR | Pergunta: Raça/cor |
| 215 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `26` — 16 campos, largura 711

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | CD_PAGTO | Código de doações e pagamentos |
| 16 | 5 | N | NR_CHAVE_DEPEND | Numero de chave do dependente |
| 21 | 14 | C | NR_BENEF | CNPJ-CPF do beneficiário ou do Emp. Doméstico |
| 35 | 60 | A | NM_BENEF | nome do beneficiário |
| 95 | 11 | N | NR_NIT_EMP_DOM | NIT do empregado doméstico |
| 106 | 13 | N | VR_PAGTO | Valor do pagamento ou doação |
| 119 | 13 | N | VR_REDUC | Valor da parcela não dedutível ou reembolsada |
| 132 | 13 | N | VR_EFPC | Contribuição EFPC |
| 145 | 1 | N | IN_TIPO_CPF_CNPJ | Indicador se CPF ou CNPJ |
| 146 | 1 | C | IN_TIPO_PGTO | formato de pagamento: T - Titular, D - Dependente, A - Alimentando |
| 147 | 512 | C | NM_DESCRICAO | Descrição do pagamento |
| 659 | 3 | N | CD_PAIS | Código do País, se bem no Exterior |
| 662 | 40 | C | NM_PAIS | nome do País |
| 702 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `27` — 58 campos, largura 1291

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | CD_BEM | formato do bem ou direito |
| 16 | 1 | N | IN_EXTERIOR | 0 se imóvel no Brasil 1 se imóvel no Exterior |
| 17 | 3 | N | CD_PAIS | Código do País, se bem no Exterior |
| 20 | 40 | C | NM_PAIS | nome do País |
| 60 | 512 | C | TX_BEM | Descrição do bem |
| 572 | 13 | N | VR_ANTER | Valor em 31 de dezembro de 2009 |
| 585 | 13 | N | VR_ATUAL | Valor em 31 de dezembro de 2010 |
| 598 | 40 | C | NM_LOGRA | Endereço contribuinte: logradouro |
| 638 | 6 | C | NR_NUMERO | Endereço contribuinte: número |
| 644 | 40 | C | NM_COMPLEM | Endereço contribuinte: complemento |
| 684 | 40 | C | NM_BAIRRO | Endereço contribuinte: bairro |
| 724 | 9 | C | NR_CEP | Endereço contribuinte: CEP ou ZIP Exterior |
| 733 | 2 | C | SG_UF | Endereço contribuinte: UF |
| 735 | 4 | N | CD_MUNICIP | Endereço contribuinte: código do município |
| 739 | 40 | C | NM_MUNICIP | Endereço contribuinte: município |
| 779 | 1 | N | NM_IND_REG_IMOV | Indicador do tipo de imóveis |
| 780 | 40 | A | MATRIC_IMOV | Matrícula do imóvel |
| 820 | 40 | A | FILLER1 | tipo do imóvel |
| 860 | 11 | N | AREA | ?ea do imóvel |
| 871 | 1 | N | NM_UNID | Unidade de medida |
| 872 | 60 | A | NM_CARTORIO | nome do cartorio |
| 932 | 5 | N | NR_CHAVE_BEM | Chave de identificação do bem |
| 937 | 8 | N | DT_AQUISICAO |  |
| 945 | 20 | C | FILLER2 |  |
| 965 | 7 | C | FILLER3 |  |
| 972 | 1 | C | FILLER | filler |
| 973 | 30 | C | NR_RENAVAN |  |
| 1003 | 30 | C | NR_DEP_AVIACAO_CIVIL |  |
| 1033 | 30 | C | NR_CAPITANIA_PORTOS |  |
| 1063 | 4 | N | NR_AGENCIA |  |
| 1067 | 13 | C | FILLER4 |  |
| 1080 | 2 | C | NR_DV_CONTA |  |
| 1082 | 14 | C | NM_CPFCNPJ |  |
| 1096 | 30 | C | NR_IPTU |  |
| 1126 | 3 | N | NR_BANCO | Codigo do Banco |
| 1129 | 1 | C | IN_TIPO_BENEFIC | Indicador se o registro é do titular ou do dependente |
| 1130 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 1141 | 2 | C | CD_GRUPO_BEM | Grupo do Bem |
| 1143 | 1 | N | IN_BEM_INVENTARIAR | Indicador de bem a inventariar |
| 1144 | 20 | C | NR_CONTA | Número da conta bancária |
| 1164 | 8 | C | NR_CIB | Número do cib |
| 1172 | 12 | N | NR_CEI_CNO | Némro do cei cno |
| 1184 | 1 | N | IN_BOLSA | Negociado em bolsa 0-Não(Padrão) 1-Sim |
| 1185 | 20 | A | NR_COD_NEGOCIACAO_BOLSA |  |
| 1205 | 1 | N | IN_CUSTODIANTE | 0- Nao (padrao) 1- Sim |
| 1206 | 10 | C | COD_ALTCOIN |  |
| 1216 | 10 | C | COD_STABLECOIN |  |
| 1226 | 13 | N | VR_LUCRO_PREJUIZO_APLICACAO_FINANCEIRA | Lucro ou prejuízo de aplicação financeira no exterior |
| 1239 | 13 | N | VR_IMPOSTO_PAGO_EXTERIOR_APLICACAO_FINANCEIRA | Imposto pago sobre aplicação financeira no exterior |
| 1252 | 13 | N | VR_RECEBIDO_LUCROS_DIVIDENDOS | Valor recebido sobre lucros e dividendos |
| 1265 | 13 | N | VR_IMPOSTO_PAGO_EXTERIOR_LUCROS_DIVIDENDOS | Imposto pago no exterior sobre lucros e dividendos |
| 1278 | 1 | N | IN_CONTA_PAGAMENTO | Indicador se conta pagamento |
| 1279 | 1 | N | IN_RECLASSIFICAR | Indicador de necessidade de reclassificação de tipo de bem de um ano para o outro. Este campo não exibido para o usuário. |
| 1280 | 1 | C | IN_PROCESSO_ATUALIZACAO_BEM | O contribuinte fez atualização de algum bem de acordo com a Lei 14973 DE 16/09/2024 0-Não (padrão) 1-Sim |
| 1281 | 1 | N | IN_BEM_USUFRUTO | Indicador se bem com usufruto |
| 1282 | 10 | N | NR_CONTROLE | no de Controle |

## Registro `28` — 8 campos, largura 576

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | CD_DIV | formato da dívida |
| 16 | 512 | C | TX_DIV | Descrição da dívida |
| 528 | 13 | N | VR_ANTER | Valor em 31 de dezembro de 2009 |
| 541 | 13 | N | VR_ATUAL | Valor em 31 de dezembro de 2010 |
| 554 | 13 | N | VR_PAGAMENTOANUAL | Valor do pagamento anual |
| 567 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `29` — 11 campos, largura 113

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CONJ | CPF do cônjuge |
| 25 | 13 | N | VR_BASE | Base de cálculo |
| 38 | 13 | N | VR_IMPOSTO | Total do imposto |
| 51 | 13 | N | VR_ISENTO | Rend. Isentos e não tributáveis |
| 64 | 13 | N | VR_EXCLUSIVO | Rend. Tribut. Exclusivo Fonte |
| 77 | 13 | N | VR_RENDPJ_EXIB_SUSP | Resultado dos (Rendimentos Recebidos de PJ [Imposto com Exigibilidade Suspensa] - Depósitos Judiciais do Imposto) do titular e dos |
| 90 | 13 | N | VR_TOTALCONJ | Resultado total do cônjuge |
| 103 | 1 | C | IN_ENTREGOU | Indicativo o cônjuge entregou S ou Não N declaração no periodo |
| 104 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `30` — 7 campos, largura 164

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_INVENT | CPF do inventariante |
| 25 | 60 | C | NM_INVENT | nome do inventariante |
| 85 | 69 | C | FILLER | FILLER |
| 154 | 1 | C | IN_SOBREPARTILHA | Indicador de sobrepartilha |
| 155 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `31` — 13 campos, largura 179

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação da pensão, proventos de aposentadoria ou reforma por moléstia grave ou aposentadoria ou reforma por acident |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do Titular ou do Dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 13 | N | VR_13SALARIO | Valor do 13 Salario |
| 131 | 13 | N | VR_IRRF | Valor do IRRF |
| 144 | 13 | N | VR_IRRF13SALARIO | Valor do IRRF sobre 13 Salario |
| 157 | 13 | N | VR_PREVIDENCIA | valor da previdência oficial |
| 170 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `32` — 12 campos, largura 181

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | CPF_BENEF | CPF do Dependente |
| 25 | 14 | C | NR_PAGADOR | CNPJ da fonte pagadora |
| 39 | 60 | C | NM_PAGADOR | nome da fonte pagadora |
| 99 | 13 | N | VR_RENDTO | Valor do rendimento recebido |
| 112 | 13 | N | VR_CONTRIB | Valor contribuição previdenciária oficial |
| 125 | 13 | N | VR_DECTERC | Valor décimo terceiro salário |
| 138 | 13 | N | VR_IMPOSTO | Valor do imposto retido na fonte |
| 151 | 8 | C | DT_COMUNICACAO_SAIDA | Data da comunicação de saída à  fonte pagadora |
| 159 | 13 | N | VR_IRRF13SALARIO | Valor imposto retido na fonte sobre o 13 salario |
| 172 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `33` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do Lucro |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do Titular ou do Dependente |
| 20 | 14 | C | NR_PAGADORA | CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_LUCRO | Valor do Lucro ou Dividendo recebido |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `34` — 6 campos, largura 110

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 14 | C | NR_PARTIDO | CNPJ do Partido ou Candidato |
| 28 | 60 | C | NM_PARTIDO | nome do Partido ou Candidato |
| 88 | 13 | N | VR_DOACAO | Valor da doação |
| 101 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `35` — 23 campos, largura 331

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | INDICADOR_RESIDENCIA | Indicador de residência do alimentando: 0-Brasil 1-Exterior |
| 15 | 5 | N | NR_CHAVE | Identificador do alimentando |
| 20 | 60 | C | NM_NOME | nome do alimentando |
| 80 | 8 | C | DT_NASCIM | Data de nascimento DDMMAAAA |
| 88 | 11 | C | NI_ALIMENTANDO | CPF do alimentando |
| 99 | 11 | C | NR_CPF_VINCULADO | CPF vinculado |
| 110 | 1 | C | IN_TIPO_PROCESSO | Tipo de processo: J - Judicial, C – Cartorio,  A – Ambos |
| 111 | 25 | C | NR_PROCESSOJUDICIAL | Número do processo judicial |
| 136 | 4 | C | NR_IDENTIFICACAOVARACIVIL | Identificação da vara civil |
| 140 | 30 | C | NM_COMARCA | Nome da Comarca |
| 170 | 8 | C | DT_DECJUDICIAL | Data da decisão judicial |
| 178 | 2 | C | SG_UFCOMARCA | UF da Comarca |
| 180 | 14 | C | NR_CNPJ_CARTORIO | CNPJ do Cartório |
| 194 | 60 | C | NM_CARTORIO | Nome do Cartório |
| 254 | 8 | C | DT_LAVRATURA | Data da lavratura |
| 262 | 7 | C | NM_LIVRO | Número do Livro de Registro |
| 269 | 7 | C | NM_FOLHA | Folhas do Livro de Registro |
| 276 | 4 | C | CD_MUNICIP | Endereço contribuinte: código do município |
| 280 | 40 | C | NM_MUNICIPIO | Nome do município do Cartório |
| 320 | 2 | C | SG_UFCARTORIO | UF do Cartório |
| 322 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `36` — 7 campos, largura 46

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE_BEM | Chave de identificação do bem |
| 19 | 14 | C | NR_CPF_CNPJ | CPF/CNPJ Proprietário/Usufrutuário |
| 33 | 2 | C | CD_GRUPO_BEM | Grupo do Bem |
| 35 | 2 | N | CD_BEM | Tipo do bem ou direito |
| 37 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `37` — 13 campos, largura 103

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE_BEM | Chave de identificação do bem |
| 19 | 5 | N | NR_ORDEM | Número da linha da tabela do demonstrativo |
| 24 | 1 | N | TIPO | Tipo de Rendimento 1 = Aplicações Financeiras 2 = Lucros e Dividendos |
| 25 | 13 | N | VR_GANHO_PREJUIZO | Valor recebido informado no bem Obs.: Esse campo pode receber valores negativos. |
| 38 | 13 | N | VR_IMPOSTO_DEVIDO | 15% do Ganho. Apenas se o valor do campo VR_GANHO_PREJUIZO for positivo |
| 51 | 13 | N | VR_IMPOSTO_PAGO_EXTERIOR_BRASIL | Valor informado no bem |
| 64 | 13 | N | VR_BASE_CALCULO | Base de Cálculo |
| 77 | 13 | N | VR_SALDO | Somar o valor da Base de Cálculo se positivo ou compensá-lo se negativo. Obs.: Esse campo pode receber valores negativos. |
| 90 | 2 | C | CD_GRUPO_BEM | Grupo do Bem |
| 92 | 2 | N | CD_BEM | Tipo do bem ou direito |
| 94 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `38` — 30 campos, largura 468

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 4 | N | NR_ANOOBITO | Ano do óbito |
| 18 | 11 | C | FILLER | FILLER |
| 29 | 11 | C | NR_CPF_INVENT | CPF do inventariante |
| 40 | 60 | C | NM_INVENT | nome do inventariante |
| 100 | 68 | C | FILLER | FILLER |
| 168 | 1 | C | IN_SOBREPARTILHA | Indicador de sobrepartilha |
| 169 | 1 | C | IN_STATUS_SOBREPARTILHA | Indicador do status da sobrepartilha |
| 170 | 1 | C | IN_TIPO_PROCESSO | formato de processo: J - Judicial, C - Cartorio |
| 171 | 25 | C | NR_PROCESSOJUDICIAL | Número do processo judicial |
| 196 | 4 | C | NR_VARACIVIL | Identificação da vara civil |
| 200 | 30 | C | NM_COMARCA | nome da Comarca |
| 230 | 8 | N | DT_DECJUDICIALPARTILHA | Data da decisão judicial da partilha |
| 238 | 8 | N | DT_TRANSITOJULGADO | Data do trânsito em julgado da decisão judicial da partilha |
| 246 | 2 | C | SG_UFCOMARCA | UF da Comarca |
| 248 | 14 | C | NR_CNPJ_CARTORIO | CNPJ do Cartório |
| 262 | 60 | C | NM_CARTORIO | nome do Cartório |
| 322 | 7 | C | NM_LIVRO | Número do Livro de tipo |
| 329 | 7 | C | NM_FOLHA | Folhas do Livro de tipo |
| 336 | 40 | C | NM_MUNICIPIO | nome do município do Cartório |
| 376 | 2 | C | SG_UFCARTORIO | UF do Cartório |
| 378 | 8 | N | DT_LAVRATURA | Data da lavratura da partilha |
| 386 | 1 | C | IN_MORTEAMBOSCONJUGES | Morte de ambos os cônjuges e inventário único: 0 - Não, 1 - Sim, 2 - Não é morte de ambos |
| 387 | 60 | A | NM_CONJUGE | nome do cônjuge ou companheiro |
| 447 | 1 | C | IN_BENS_INVENTARIAR | Bens a iventariar: Sim - 1, Não - 0 |
| 448 | 9 | C | FILLER | (CPF do cônjuge ou companheiro) informação constará apenas no registro de identificação REG 16 |
| 457 | 1 | C | IN_MEEIRO | indicador se meeiro 0 - Não, 1 - Sim |
| 458 | 1 | C | IN_INVENTARIOCONJUNTO | Inventário único: 0 - Não, 1 - Sim |
| 459 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `39` — 10 campos, largura 233

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_PROCURADOR | CPF do Procurador |
| 25 | 60 | A | NM_PROCURADOR | nome do Procurador |
| 85 | 80 | C | NM_END_PROCURADOR | Endereço completo do Procurador |
| 165 | 8 | N | DT_NAORESIDENTE | Data da caracterização da condição de não-residente |
| 173 | 8 | N | DT_RESIDENTE | Data da caracterização da condição de residente no país |
| 181 | 3 | N | CD_NOVO_PAIS_RESIDENCIA | Novo país de residência |
| 184 | 40 | C | NM_PAIS | nome do País |
| 224 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `40` — 54 campos, largura 641

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | RV_MES | Mês da operação |
| 16 | 13 | N | GC_COMUM_MVISTA_ACOES | Operações Comuns - Mercado à  Vista - Ações |
| 29 | 13 | N | GC_COMUM_MVISTA_OURO | Operações Comuns - Mercado à  Vista - Ouro |
| 42 | 13 | N | GC_COMUM_MVISTA_OUROFORA | Operações Comuns - Mercado à  Vista - Ouro fora da bolsa |
| 55 | 13 | N | GC_COMUM_MOPC_ACOES | Operações Comuns - Mercado do Opções - Ações |
| 68 | 13 | N | GC_COMUM_MOPC_OURO | Operações Comuns - Mercado de Opções - Ouro |
| 81 | 13 | N | GC_COMUM_MOPC_OUROFORA | Operações Comuns - Mercado de Opções - Ouro fora da bolsa |
| 94 | 13 | N | GC_COMUM_MOPC_OUTROS | Operações Comuns - Mercado de Opções - Outros |
| 107 | 13 | N | GC_COMUM_MFUT_DOLAR | Operações Comuns - Mercado Futuro - Dólar dos EUA |
| 120 | 13 | N | GC_COMUM_MFUT_INDICES | Operações Comuns - Mercado Futuro - Índices |
| 133 | 13 | N | GC_COMUM_MFUT_JUROS | Operações Comuns - Mercado Futuro - Juros |
| 146 | 13 | N | GC_COMUM_MFUT_OUTROS | Operações Comuns - Mercado Futuro - Outros |
| 159 | 13 | N | GC_COMUM_MTERMO_ACOESOURO | Operações Comuns - Mercado a Termo - Ações-Ouro |
| 172 | 13 | N | GC_COMUM_MTERMO_OUTROS | Operações Comuns - Mercado a Termo - Outros |
| 185 | 13 | N | GC_DAYTR_MVISTA_ACOES | Operações Day-Trade - Mercado à  Vista - Ações |
| 198 | 13 | N | GC_DAYTR_MVISTA_OURO | Operações Day-Trade - Mercado à  Vista - Ouro |
| 211 | 13 | N | GC_DAYTR_MVISTA_OUROFORA | Operações Day-Trade - Mercado à  Vista - Ouro fora da bolsa |
| 224 | 13 | N | GC_DAYTR_MOPC_ACOES | Operações Day-Trade - Mercado do Opções - Ações |
| 237 | 13 | N | GC_DAYTR_MOPC_OURO | Operações Day-Trade - Mercado de Opções - Ouro |
| 250 | 13 | N | GC_DAYTR_MOPC_OUROFORA | Operações Day-Trade - Mercado de Opções - Ouro fora da bolsa |
| 263 | 13 | N | GC_DAYTR_MOPC_OUTROS | Operações Day-Trade - Mercado de Opções - Outros |
| 276 | 13 | N | GC_DAYTR_MFUT_DOLAR | Operações Day-Trade - Mercado Futuro - Dólar dos EUA |
| 289 | 13 | N | GC_DAYTR_MFUT_INDICES | Operações Day-Trade - Mercado Futuro - Índices |
| 302 | 13 | N | GC_DAYTR_MFUT_JUROS | Operações Day-Trade - Mercado Futuro - Juros |
| 315 | 13 | N | GC_DAYTR_MFUT_OUTROS | Operações Day-Trade - Mercado Futuro - Outros |
| 328 | 13 | N | GC_DAYTR_MTERMO_ACOESOURO | Operações Day-Trade - Mercado à  Termo - Ações-Ouro |
| 341 | 13 | N | GC_DAYTR_MTERMO_OUTROS | Operações Day-Trade - Mercado à  Termo - Outros |
| 354 | 13 | N | VR_FONTE_DAYTRADE | IR fonte de Day-Trade no mês |
| 367 | 13 | N | VR_IMPOSTOPAGO | Valor do imposto pago |
| 380 | 13 | N | VR_IMPRENDAFONTE | Valor Retido na Fonte Lei n 11.033-2004 |
| 393 | 13 | N | VRRESULT_NEG_MESANT_COMUM | Resultado negativo até o mês anterior-Comuns |
| 406 | 13 | N | VRRESULT_NEG_MESANT_DAYTR | Resultado negativo até o mês anterior-Day-Trade |
| 419 | 13 | N | VR_FONTE_DAYTRADEANTERIORJANEIRO | IR fonte de Day-Trade-Esse campo só existe no mês de janeiro |
| 432 | 13 | N | VR_RESLIQUIDO_MES_OPCOMUNS | Resultado Líquido do mês, para as operações comuns |
| 445 | 13 | N | VR_RESLIQUIDO_MES_DAYTRADE | Resultado Líquido do mês, para as operações day-trade |
| 458 | 13 | N | VR_BASECALCULO_MES_OPCOMUNS | Base de Cálculo do Imposto, para as operações comuns |
| 471 | 13 | N | VR_BASECALCULO_MES_DAYTRADE | Base de Cálculo do Imposto, para as operações day-trade |
| 484 | 13 | N | VR_PREJACOMPENSAR_MES_OPCOMUNS | Prejuízo a Compensar, para as operações comuns |
| 497 | 13 | N | VR_PREJACOMPENSAR_MES_DAYTRADE | Prejuízo a Compensar, para as operações day-trade |
| 510 | 3 | N | VR_ALIQUOTA_IMPOSTO_OPCOMUNS | Valor da alíquota15 |
| 513 | 3 | N | VR_ALIQUOTA_IMPOSTO_DAYTRADE | Valor da alíquota20 |
| 516 | 13 | N | VR_IMPOSTODEVIDO_MES_OPCOMUNS | Imposto Devido, para as operações comuns |
| 529 | 13 | N | VR_IMPOSTODEVIDO_MES_DAYTRADE | Imposto Devido, para as operações day-trade |
| 542 | 13 | N | VR_TOTAL_IMPDEVIDO | Total do Imposto Devido |
| 555 | 13 | N | VR_IRFONTE_MESESANT_DAYTRADE | IR Fonte de Day-trade meses anteriores |
| 568 | 13 | N | VR_IRFONTE_DAYTRADE_ACOMPENSAR | IR Fonte de Day-trade a Compensar |
| 581 | 13 | N | VR_IMPOSTOAPAGAR | Imposto a Pagar |
| 594 | 13 | N | VR_IRF_MESESANT | Valor Retido na Fonte Lei n 11.033-2004 meses anteriores |
| 607 | 13 | N | VR_IRF_COMPENSAR | Valor Retido na Fonte Lei n 11.033-2004 meses anteriores |
| 620 | 1 | I | E_DEPENDENTE | Indicativo se registro de dependente(S) ou Titular(N) |
| 621 | 11 | C | NR_CPF_DEPEN | CPF do dependente |
| 632 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `41` — 13 campos, largura 153

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_TOTALANUALRESULTADOLIQUIDOSRENDAVARIAVEL_COMUNSDT | Resultado Líquido do mês, para as operações comuns e day-trade nos meses de jan a dez |
| 27 | 13 | N | VR_TOTALANUALRESULTADONEGATIVOMESANTERIOR_COMUNSDT | Resultado negativo até o mês anterior, para as operações comuns e day-trade do mês de Dezembro |
| 40 | 13 | N | VR_TOTALANUALBASECALCULOIMPOSTO_COMUNSDT | Base de Cálculo do Imposto, para as operações comuns e day-trade nos meses de jan a dez |
| 53 | 13 | N | VR_TOTALANUALPREJUIZOCOMPENSAR_COMUNSDT | Prejuízo a Compensar, para as operações comuns e day-trade do mês de Dezembro |
| 66 | 13 | N | VR_TOTALANUALIMPOSTODEVIDO_CCOMUNSDT | Imposto Devido, para as operações comuns e day-trade nos meses de jan a dez |
| 79 | 13 | N | VR_TOTALANUALIMPOSTODEVIDOCONSOLIDACAO | Total do Imposto Devido nos meses de jan a dez |
| 92 | 13 | N | VR_TOTALANUALFONTEDAYTRADEMESESANTERIOR | IR Fonte de Day-trade meses anteriores do mês de Dezembro |
| 105 | 13 | N | VR_TOTALANUALFONTEDAYTRADECOMPENSAR | IR Fonte de Day-trade a Compensar do mês de Dezembro |
| 118 | 13 | N | VR_TOTALANUALIRFONTELEI11033 | Imposto Retido na Fonte Lei 11.033 nos meses de jan a dez |
| 131 | 13 | N | VR_TOTALANUALIMPOSTOPAGAR | Imposto a Pagar nos meses de jan a dez |
| 144 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `42` — 17 campos, largura 170

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | NR_MES | Mês da operação |
| 16 | 13 | N | VR_RESLIQUIDO_MES | Resultado Líquido do mês |
| 29 | 13 | N | VRRESULT_NEG_MESANT | Resultado negativo até o mês anterior |
| 42 | 13 | N | VR_BASECALCULO_MES | Base de Cálculo do Imposto |
| 55 | 13 | N | VR_PREJACOMPENSAR_MES_OPCOMUNS | Prejuízo a Compensar |
| 68 | 3 | N | VR_ALIQUOTA_IMPOSTO_OPCOMUNS | Valor da alíquota20 |
| 71 | 13 | N | VR_IMPOSTODEVIDO_MES_OPCOMUNS | Imposto Devido |
| 84 | 13 | N | VR_IMPOSTO_RETIDO_MESES_ANTERIORES | Valor do Imposto Retido meses anteriores |
| 97 | 13 | N | VR_IMPOSTO_RETIDO_FONTE | Valor do Imposto Retido no mês |
| 110 | 13 | N | VR_IMPOSTO_RETIDO_COMPENSAR | Valor do Imposto a Compensar (Lei 11.033/2004) |
| 123 | 13 | N | VR_IMPOSTO_PAGAR | Valor do Imposto a Pagar |
| 136 | 13 | N | VR_IMPOSTOPAGO | Valor do imposto pago |
| 149 | 1 | I | E_DEPENDENTE | Indicativo se registro de dependente(S) ou Titular(N) |
| 150 | 11 | C | NR_CPF_DEPEN | CPF do dependente |
| 161 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `43` — 10 campos, largura 114

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_TOTALANUALRESULTADOLIQUIDOSRENDAVARIAVEL_FII | Resultado Líquido do mês, para as operações FII nos meses de jan a dez |
| 27 | 13 | N | VR_TOTALANUALRESULTADONEGATIVOMESANTERIOR_FII | Resultado negativo até o mês anterior, para as operações FII do mês de Dezembro |
| 40 | 13 | N | VR_TOTALANUALBASECALCULOIMPOSTO_FII | Base de Cálculo do Imposto, para as operações FII nos meses de jan a dez |
| 53 | 13 | N | VR_TOTALANUALPREJUIZOCOMPENSAR_FII | Prejuízo a Compensar, para as operações FII do mês de Dezembro |
| 66 | 13 | N | VR_TOTALANUALIMPOSTODEVIDO_FII | Imposto Devido, para as operações FII nos meses de jan a dez |
| 79 | 13 | N | VR_TOTALANUALIMPOSTOPAGAR | Imposto a pagar para as operações FII nos meses de jan a dez |
| 92 | 13 | N | VR_TOTALANUALIMPOSTORETIDONAFONTE_FII | Imposto retido lei 11033/2004 para as operações FII nos meses de jan a dez |
| 105 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `45` — 19 campos, largura 216

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | FILLER | Espaços em branco |
| 16 | 14 | C | NR_PAGADOR | CPF ou CNPJ da fonte pagadora |
| 30 | 60 | C | NM_PAGADOR | nome fonte pagadora |
| 90 | 13 | N | VR_RENDTO | Valor rendimento recebido |
| 103 | 13 | N | VR_CONTRIB | Valor contribuição previdenciária oficial |
| 116 | 13 | N | VR_PENSAO | Valor da pensão alimenticia |
| 129 | 13 | N | VR_IMPOSTO | Valor imposto retido na fonte |
| 142 | 2 | N | NR_MES_RECEBIMENTO | Mês do recebimento |
| 144 | 5 | N | CD_RRA_TITULAR | Código de RRA Titular |
| 149 | 1 | C | FILLER | Espaços em branco |
| 150 | 1 | N | OPCAO_TRIBUTACAO | Opção de tributação escolhida |
| 151 | 4 | N | NUM_MESES | Numero de meses |
| 155 | 13 | N | IMPOSTO_RRA | Imposto RRA |
| 168 | 13 | N | VR_ISENTO_65 | Valor isento de 65 anos |
| 181 | 13 | N | VR_VALOR_TRIBUTAVEL | Valor tributável |
| 194 | 13 | N | VR_JUROS | Valor do pagamento de juros |
| 207 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `46` — 7 campos, largura 48

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | FILLER | Espaços em branco |
| 16 | 5 | N | NR_CHAVE_ALIMENT | Numero de chave do alimentando |
| 21 | 13 | N | VR_PAGTO | Valor do pagamento de pensão |
| 34 | 5 | N | CD_RRA_TITULAR | Código de RRA Titular |
| 39 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `47` — 20 campos, largura 227

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | FILLER | Espaços em branco |
| 16 | 11 | C | CPF_BENEF | CPF do Dependente |
| 27 | 14 | C | NR_PAGADOR | CPF ou CNPJ da fonte pagadora |
| 41 | 60 | C | NM_PAGADOR | nome fonte pagadora |
| 101 | 13 | N | VR_RENDTO | Valor rendimento recebido |
| 114 | 13 | N | VR_CONTRIB | Valor contribuição previdenciária oficial |
| 127 | 13 | N | VR_PENSAO | Valor da pensão alimenticia |
| 140 | 13 | N | VR_IMPOSTO | Valor imposto retido na fonte |
| 153 | 2 | N | NR_MES_RECEBIMENTO | Mês do recebimento |
| 155 | 5 | N | CD_RRA_DEPENDENTE | Código de RRA Dependente |
| 160 | 1 | C | FILLER | Espaços em branco |
| 161 | 1 | N | OPCAO_TRIBUTACAO | Opção de tributação escolhida |
| 162 | 4 | N | NUM_MESES | Numero de meses |
| 166 | 13 | N | IMPOSTO_RRA | Imposto RRA |
| 179 | 13 | N | VR_ISENTO_65 | Valor isento de 65 anos |
| 192 | 13 | N | VR_VALOR_TRIBUTAVEL | Valor tributável |
| 205 | 13 | N | VR_JUROS | Valor do pagamento de juros |
| 218 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `48` — 7 campos, largura 48

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | FILLER | Espaços em branco |
| 16 | 5 | N | NR_CHAVE_ALIMENT | Numero de chave do alimentando |
| 21 | 13 | N | VR_PAGTO | Valor do pagamento de pensão |
| 34 | 5 | N | CD_RRA_DEPENDENTE | Código de RRA Dependente |
| 39 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `49` — 8 campos, largura 71

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF_TITULAR | CPF contribuinte |
| 14 | 11 | C | NR_CPF_DEPENDENTE | CPF dependente |
| 25 | 2 | N | NR_MES | Mês de ocorrência |
| 27 | 11 | C | NR_CPF_TITULAR_PAGAMENTO | CPF do titular do pagamento |
| 38 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 49 | 13 | N | NR_VALOR | valor do pagamento |
| 62 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `50` — 13 campos, largura 178

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | N | IN_EXTERIOR | 0 se imóvel no Brasil - 1 se imóvel no Exterior |
| 15 | 8 | C | FILLER | filler |
| 23 | 60 | C | NM_IMOVEL | nome do imóvel |
| 83 | 55 | C | NM_LOCAL | Localização do imóvel |
| 138 | 10 | N | QT_AREA | Área do imóvel ha |
| 148 | 5 | N | PC_PARTIC | Percentual de participação no imóvel |
| 153 | 1 | C | CD_EXPLOR | Código da condição de exploração |
| 154 | 2 | C | CD_ATIV | Código atividade Rural Agricultura, pecuária , etc |
| 156 | 8 | C | NR_INCRA | Número do Imóvel na SRF |
| 164 | 5 | N | NR_CHAVE_AR | chave para associar participantes |
| 169 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `51` — 7 campos, largura 52

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | N | IN_EXTERIOR | Somente'0' - imóvel no Brasil |
| 15 | 2 | N | NR_MES | Mês de ocorrência |
| 17 | 13 | N | VR_DESP | Valor das despesas |
| 30 | 13 | N | VR_REC | Valor das receitas |
| 43 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `52` — 17 campos, largura 181

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | N | IN_EXTERIOR | 0 se imóvel no Brasil - 1 se imóvel no Exterior |
| 15 | 13 | N | VR_RECTOTAL | Receita Bruta Total (L01-Ficha Apuração Resultado Tributável).Se imóvel no Exterior(1),será zerado. |
| 28 | 13 | N | VR_DESPTOTAL | Despesas de custeio e investimento (L02). Se imóvel no Exterior(1),será zerado. |
| 41 | 13 | N | VR_RES1REAL | Resultado 1 (L03 = L01 - L02) |
| 54 | 13 | N | VR_PREJEXERCANT | Prejuízo do exercício anterior (L04) |
| 67 | 13 | N | VR_COMP_PREJ_EXERC_ANT | Compensação de prejuízo(s) de exercício(s) anteriores (L05) |
| 80 | 13 | N | VR_OPCAO | Limite de 20% sobre Rec. Bruta (L06) |
| 93 | 13 | N | VR_RESTRIB | Resultado Tributável (L07) |
| 106 | 13 | N | VR_PREJUIZO | Prejuízo a compensar (L08) |
| 119 | 13 | N | VR_RECVENDAFUTURA | Receita recebida por conta de venda para entrega futura (L09) |
| 132 | 13 | N | VR_ADIANT | Valor do adiantamento até 2002 referentes aos produtos entregues em 2004 do quadro apuração do resultado (L10 do programa) |
| 145 | 13 | N | VR_RESNAOTRIBAR | Apuração do resultado da Ativ. Rural (L11 do programa e L10 do formulário) |
| 158 | 13 | N | VR_RES1DOLAR | Resultado I - US$-Linha 01 da ficha Apuração do Resultado da A.R. no Exterior.(Quando imóvel no Brasil, será zerado). |
| 171 | 1 | N | IN_OPC_APURRESTRIB | Opção pela forma de apuração de resultado tributável. |
| 172 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `53` — 11 campos, largura 85

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | N | IN_EXTERIOR | 0 se imóvel no Brasil - 1 se imóvel no Exterior |
| 15 | 1 | N | CD_ESPEC | Código da espécie 1 a 5, sendo 5 = outros |
| 16 | 10 | N | QT_INIC | Estoque Inicial |
| 26 | 10 | N | QT_COMPRA | Compras |
| 36 | 10 | N | QT_NASCIM | Nascimentos |
| 46 | 10 | N | QT_PERDA | Perdas e consumo |
| 56 | 10 | N | QT_VENDA | Vendas |
| 66 | 10 | N | QT_ESTFINAL | Estoque final |
| 76 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `54` — 10 campos, largura 607

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | N | IN_EXTERIOR | 0 se imovel no Brasil 1 se imovel no Exterior |
| 15 | 3 | N | CD_PAIS | Codigo do Pais |
| 18 | 40 | C | NM_PAIS | nome do Pais se bem no Exterior |
| 58 | 2 | N | CD_BEMAR | formato do bem ou direito |
| 60 | 512 | C | TX_BEM | obs do bem |
| 572 | 13 | N | VR_BEM | Valor atual do bem |
| 585 | 13 | N | VR_BEM_ANTERIOR | Valor anterior do bem |
| 598 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `55` — 8 campos, largura 575

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_EXTERIOR | 0 se imóvel no Brasil - 1 se imóvel no Exterior |
| 15 | 512 | C | TX_DIVIDA | Discriminação da dívida |
| 527 | 13 | N | VR_DIVATE | Valor da dívida até o ano anterior |
| 540 | 13 | N | VR_DIVATU | Valor da dívida do ano-calendário |
| 553 | 13 | N | VR_PAGAMENTOANUAL | Valor do pagamento anual |
| 566 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `56` — 9 campos, largura 118

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 3 | N | CD_PAIS | Código do País |
| 17 | 40 | C | NM_PAIS | nome do País |
| 57 | 13 | N | RECBRUTA | Receita Bruta Anual - Moeda Original |
| 70 | 13 | N | DESPCUSTEIO | Despesas de Custeio-Investimento- Moeda Original |
| 83 | 13 | N | RESORIGINAL | Resultado I - Moeda original |
| 96 | 13 | N | RESDOLAR | Resultado I - US$ |
| 109 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `57` — 7 campos, largura 103

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | Tipo do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 14 | C | NR_CPF_CNPJ_PROPRIETARIO | CPF/CNPJ do propretario |
| 28 | 60 | C | NM_NOME_PROPRIETARIO | Nome_proprietario imovel Rural |
| 88 | 1 | C | IN_EXTERIOR | 0-Não 1-Sim |
| 89 | 5 | N | NR_CHAVE_AR | chave para associar participantes |
| 94 | 10 | N | NR_CONTROLE | Numero de controle |

## Registro `58` — 6 campos, largura 102

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE_HERDEIRO | Chave de identificação do herdeiro |
| 19 | 60 | C | NM_NOME | nome Herdeiro |
| 79 | 14 | C | NR_CPF_CNPJ | CPF/CNPJ Herdeiro |
| 93 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `59` — 6 campos, largura 38

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE_BEM | Chave de identificação do bem |
| 19 | 5 | N | NR_CHAVE_HERDEIRO | Chave de identificação do herdeiro |
| 24 | 5 | N | VR_PERCENTUAL | Percentual |
| 29 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `60` — 23 campos, largura 299

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF declarante do GCAP |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 8 | N | DT_INICIO | Data início permanência (DDMMAAAA) |
| 41 | 8 | N | DT_FIM | Data fim permanência(DDMMAAAA) |
| 49 | 3 | N | CD_PAIS | Código do país |
| 52 | 60 | C | NM_PAIS | Identificação da declaração |
| 112 | 13 | N | GC_TRANSP_VR_EXCLUSIVO | Somatório do rendimento sujeito à tributação exclusiva da ficha Cálculo do imposto , à vista e a prazo, de imóvel, móvel e partici |
| 125 | 13 | N | GC_TRANSP_VR_PEQUENO | Este valor e transportado para Rendimento do tipo 5 da ficha Rendimentos Isentos e Não Tributáveis, importado do Programa Ganhos d |
| 138 | 13 | N | GC_TRANSP_VR_UNICOIMOVEL | Este valor e transportado para Rendimento do tipo 6 da ficha Rendimentos Isentos e Não Tributáveis, importado do Programa Ganhos d |
| 151 | 13 | N | GC_TRANSP_VR_REDUCAO | Este valor e transportado para Rendimento do tipo 7 da ficha Rendimentos Isentos e Não Tributáveis, importado do Programa Ganhos d |
| 164 | 13 | N | GC_TRANSP_VR_IMPOSTOPAGO | Somatório do imposto pago da ficha Cálculo do imposto , à vista e a prazo, de imóvel, móvel e participação societária, importados  |
| 177 | 13 | N | GC_TRANSP_VR_IMPOSTODEVIDO | Somatório do imposto devido de imóvel, móvel e participação societária, importados do Programa Ganhos de Capital. |
| 190 | 13 | N | GC_TRANSP_VR_ISENTRIB | Somatório do VR_PEQUENO, VR_ÚNICO_IMOVEL e VR_REDUCAO |
| 203 | 13 | N | GC_TRANSP_VR_IMPOSTODIFERIDOANOSPOSTERIORES | Valor do imposto diferido anos posteriores |
| 216 | 13 | N | GC_GCAP_MOEDA | Ganho de capital total de moeda especie |
| 229 | 13 | N | GC_IMPOSTO_DEVIDO_MOEDA | Valor do imposto devido em moeda |
| 242 | 9 | N | GC_MOEDA_ALIQUOTA_MEDIA | Valor da aliquota media em moeda |
| 251 | 13 | N | GC_TRANSP_VR_EXCLUSIVO_EXTERIOR | Somatório do rendimento sujeito à tributação exclusiva da ficha 'Consolidado' , à vista e a prazo, de imóvel, móvel, importados do |
| 264 | 13 | N | GC_TRANSP_VR_IMPOSTOPAGO_EXTERIOR | Somatório do imposto pago da ficha 'Consolidado' , à vista e a prazo, de imóvel, móvel, importados do Programa Ganhos de Capital.  |
| 277 | 13 | N | GC_TRANSP_VR_ISENTO_EXTERIOR | Somatório do rendimento isento da ficha 'Consolidado', à vista e a prazo, de imóvel, móvel, importados do Programa Ganhos de Capit |
| 290 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `61` — 71 campos, largura 926

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF declarante do GCAP |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_BRASIL_EXTERIOR | Indicação de brasil exterior |
| 38 | 152 | C | NM_IMOVEL_DESCRICAO | Descrição do bem alienado (Especificação) |
| 190 | 15 | C | END_TIPO_LOGRADOURO | Endereço do bem: tipo de logradouro |
| 205 | 40 | C | END_LOGRADOURO | Endereço do bem: logradouro |
| 245 | 6 | C | END_NUMERO | Endereço do bem: número |
| 251 | 21 | C | END_COMPLEMENTO | Endereço do bem: complemento |
| 272 | 20 | C | END_BAIRRO | Endereço do bem: bairro |
| 292 | 9 | C | END_CEP | Endereço do bem: CEP (Brasil) ou ZIPExterior (Exterior) |
| 301 | 4 | N | END_CD_MUNICIPIO | Endereço do bem: código do município (Brasil) ; Exterior em branco |
| 305 | 40 | C | END_MUNICIPIO | Endereço do bem: município (Brasil) ; Cidade (Exterior) |
| 345 | 2 | C | END_UF | Endereço do bem: UF (Brasil) ; Exterior em branco |
| 347 | 3 | C | END_COD_PAIS | Endereço do bem: (Brasil) em Branco ; Exterior código do país |
| 350 | 60 | C | END_NOME_PAIS | Endereço do bem: (Brasil) em Branco ; Exterior nome do país |
| 410 | 8 | N | DT_AQUISICAO | Data aquisição |
| 418 | 13 | N | VR_AQUISICAO | Valor de aquisição |
| 431 | 1 | C | IN_REFORMA | indicador de reforma ou ampliação |
| 432 | 1 | C | IN_PEQUENO_VALOR | Perguntas se o bem é maior que 35000,00 |
| 433 | 1 | C | IN_PROPR_OUTRO_IMOVEL | Pergunta sobre propriedade de outro imóvel para imóvel com valor de alienação entre 35.000,00 e  440.000,00 |
| 434 | 1 | C | IN_OUTRA_ALIENACAO | Indicador de outra alienação nos últimos 05 anos |
| 435 | 1 | C | IN_RESIDENCIAL | Se imoveil é residencial ou comercial |
| 436 | 1 | C | IN_UTILIZAZAOOUTROIMOVEL | Pergunta se o valor vai ser aplicado na compra do outro imovel. |
| 437 | 13 | N | VR_UTILIZAZAOOUTROIMOVEL | Campo de preenchimento para informar valor aplicado em outro imóvel. |
| 450 | 2 | N | CD_OPERACAO | Código da Natureza da Operação |
| 452 | 70 | C | NM_OPERACAO | Descrição da Natureza da Operação |
| 522 | 1 | C | IN_DECISAO_JUDICIAL | indicador de decisão judicial ou escritura publica |
| 523 | 8 | N | DT_ALIENACAO | Data de alienação |
| 531 | 8 | N | DT_DECISAO_JUDICIAL | Data da decisão judicial |
| 539 | 8 | N | DT_LAVRATURA | Data da lavratura |
| 547 | 8 | N | DT_TRANSITO_JULGADO | Data do trânsito julgado |
| 555 | 1 | C | IN_ALIENPRAZO | Indicador de alienação à prazo |
| 556 | 13 | N | VR_OPERACAO | Valor da operação |
| 569 | 13 | N | VR_CORRETAGEM | Custo de corretagem |
| 582 | 13 | N | VR_TORNA | valor da torna |
| 595 | 1 | C | IN_GCAP_ANTERIOR | indicador de alienação parcial anterior |
| 596 | 13 | N | VR_GCAP_ANTERIOR | valor da alienação parcial anterior |
| 609 | 13 | N | VR_OPERACAO_BRUTO_ANT | (Seção Calculo do imposto) Valor bruto da operação de anos anteriores. |
| 622 | 13 | N | VR_CORRETAGEM_ANT | (Seção Calculo do imposto) Valor bruto da corretagem de anos anteriores. |
| 635 | 13 | N | VR_GCAP_CI_ANT_LIGUIDO | (Seção Calculo do imposto) Valor Líquido da operação de anos anteriores. |
| 648 | 13 | N | VR_GCAP_CI | (Seção Calculo do Imposto) ganho de capital a ser considerado para calculo do imposto. |
| 661 | 9 | N | VR_ALIQUOTA_MEDIA_CI | (Seção Calculo do Imposto) A vista: Aliquota Média porcentagem. |
| 670 | 13 | N | VR_IMPOSTO_DEVIDO_CI | Imposto devido |
| 683 | 13 | N | VR_IMPOSTO_PAGO_CI | imposto pago |
| 696 | 13 | N | VR_RECEBIDO_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total Recebido das parcela |
| 709 | 13 | N | VR_CORRETAGEM_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total da corretagem das parcelas |
| 722 | 13 | N | VR_VALOR_LIQUIDO | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total liquido das parcelas |
| 735 | 13 | N | VR_AQUISICAO_PROPORCIONAL_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total aquisição das parcelas |
| 748 | 13 | N | VR_DIFERIDO_ANTERIORES_CB | (Seção Consolidação) Valor do imposto diferido de anos anteriores |
| 761 | 13 | N | VR_EXERCICIO_CB | (Seção Consolidação) Valor do imposto referente ao exercicio |
| 774 | 13 | N | VR_TOTAL_CB | (Seção Consolidação) total do imposto |
| 787 | 13 | N | VR_IR_CB | (Seção Consolidação) Ir na fonte Lei 11033/2004 |
| 800 | 13 | N | VR_IR_DEVIDO_CB | (Seção Consolidação) imposto devido no exercicio |
| 813 | 13 | N | VR_DIFERIDO_POSTERIOR_CB | (Seção Consolidação) Valor do imposto diferido para anos posteriores |
| 826 | 13 | N | VR_IMPOSTO_PAGO_CB | (Seção Consolidação) Imposto pago |
| 839 | 13 | N | VR_ISENTO_CB | (Seção Consolidação) Rendimento isento e não tributável |
| 852 | 13 | N | VR_EXCLUSIVO_CB | (Seção Consolidação)  Rendimento exclusivo e não tributável |
| 865 | 8 | N | DT_DATA_DARF_TCM | Data de vencimento do darf quanto se trata de TCM |
| 873 | 8 | N | DT_DATA_ULTIMA_PARCELA | Data de vencimento da ultima parcela |
| 881 | 1 | C | IND_TER_PARAISO_FISCAL | indicador paraíso fiscal ou território paraíso fiscal |
| 882 | 3 | N | CD_PAIS_PARAISO_FISCAL | Código do país que o contribuinte estava no ato da alienação |
| 885 | 1 | C | IN_MULTIPLO_IMOVEL |  |
| 886 | 8 | N | DT_DATA_MULTIPLO_IMOVEL |  |
| 894 | 1 | C | IN_UTILIZACAOOUTROIMOVEL_PARTE2 | Quanto do valor vai ser aplicado na compra do outro imóvel. |
| 895 | 1 | C | IN_BEM_ATUALIZADO_LEI_14973 | Valor do imóvel atualizado de acordo com a lei 14.973/24? 0-Não 1-Sim OBS: Não pode haver resposta em branco |
| 896 | 13 | N | VR_ATUALIZACAO_LEI_14973 | Valor acrescido referente a atualização do valor do bem de acordo com a lei 14.973/24. |
| 909 | 8 | None | DT_DARF_LEI_14973 | Data de quitação do DARF relativo a atualização do valor do bem de acordo com a lei 14.973/24. A data deve necessariamente estar c |
| 917 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `62` — 48 campos, largura 644

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF declarante do GCAP |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_BRASIL_EXTERIOR | Indicação de brasil exterior |
| 38 | 152 | C | NM_MOVEL_DESCRICAO | Descrição do bem alienado (Especificação) |
| 190 | 1 | C | IN_REGISTRO_PUBLICO | Indicador de Possui registro público |
| 191 | 8 | N | DT_AQUISICAO | Data de aquisição |
| 199 | 13 | N | VR_AQUISICAO | Valor de aquisição |
| 212 | 1 | C | IN_PEQUENO_VALOR | Indicador  o conjunto de bens ou direitos da mesma natureza alienados é superior a  35.000,00 |
| 213 | 2 | N | CD_OPERACAO | Código da Natureza da Operação |
| 215 | 70 | C | NM_OPERACAO | Descrição da Natureza da Operação |
| 285 | 1 | C | IN_DECISAO_JUDICIAL | indicador de decisão judicial ou escritura publica |
| 286 | 8 | N | DT_ALIENACAO | Data de alienação |
| 294 | 8 | N | DT_DECISAO_JUDICIAL | Data da decisão judicial |
| 302 | 8 | N | DT_LAVRATURA | Data da lavratura |
| 310 | 8 | N | DT_TRANSITO_JULGADO | Data do trânsito julgado |
| 318 | 1 | C | IN_ALIENPRAZO | Indicador de alienação à prazo |
| 319 | 13 | N | VR_OPERACAO | Valor da operação |
| 332 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 345 | 1 | C | IN_GCAP_ANTERIOR | Indicador de alienação parcial anterior |
| 346 | 13 | N | VR_GCAP_ANTERIOR | valor da alienação parcial anterior |
| 359 | 13 | N | VR_OPERACAO_BRUTO_ANT | (Seção Calculo do imposto) Valor bruto da operação de anos anteriores. |
| 372 | 13 | N | VR_CORRETAGEM_ANT | (Seção Calculo do imposto) Valor bruto da corretagem de anos anteriores. |
| 385 | 13 | N | VR_GCAP_CI_ANT_LIGUIDO | (Seção Calculo do imposto) Valor Líquido da operação de anos anteriores. |
| 398 | 13 | N | VR_GCAP_CI | (Seção Calculo do Imposto) ganho de capital a ser considerado para calculo do imposto. |
| 411 | 9 | N | VR_ALIQUOTA_MEDIA_CI | (Seção Calculo do Imposto) A vista: Aliquota Média porcentagem. |
| 420 | 13 | N | VR_IMPOSTO_DEVIDO_CI | imposto devido |
| 433 | 13 | N | VR_IMPOSTO_PAGO_CI | imposto pago |
| 446 | 13 | N | VR_RECEBIDO_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total Recebido das parcela |
| 459 | 13 | N | VR_CORRETAGEM_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total da corretagem das parcelas |
| 472 | 13 | N | VR_VALOR_LIQUIDO | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total liquido das parcelas |
| 485 | 13 | N | VR_AQUISICAO_PROPORCIONAL_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total aquisição das parcelas |
| 498 | 13 | N | VR_DIFERIDO_ANTERIORES_CB | (Seção Consolidação) Valor do imposto diferido de anos anteriores |
| 511 | 13 | N | VR_EXERCICIO_CB | (Seção Consolidação) Valor do imposto referente ao exercicio |
| 524 | 13 | N | VR_TOTAL_CB | (Seção Consolidação) total do imposto |
| 537 | 13 | N | VR_IR_CB | (Seção Consolidação) Ir na fonte Lei 11033/2004 |
| 550 | 13 | N | VR_IR_DEVIDO_CB | (Seção Consolidação) imposto devido no exercicio |
| 563 | 13 | N | VR_DIFERIDO_POSTERIOR_CB | (Seção Consolidação) Valor do imposto diferido para anos posteriores |
| 576 | 13 | N | VR_IMPOSTO_PAGO_CB | (Seção Consolidação) Imposto pago |
| 589 | 13 | N | VR_ISENTO_CB | (Seção Consolidação) Rendimento isento e não tributável |
| 602 | 13 | N | VR_EXCLUSIVO_CB | (Seção Consolidação)  Rendimento exclusivo e não tributável |
| 615 | 8 | N | DT_DATA_DARF_TCM | Data de vencimento do darf quanto se trata de TCM |
| 623 | 8 | N | DT_DATA_ULTIMA_PARCELA | Data de vencimento da ultima parcela |
| 631 | 1 | C | IND_TER_PARAISO_FISCAL | indicador paraíso fiscal ou território paraíso fiscal |
| 632 | 3 | N | CD_PAIS_PARAISO_FISCAL | Código do país que o contribuinte estava no ato da alienação |
| 635 | 10 | N | NR_CONTROLE | Número de controle |

## Registro `63` — 58 campos, largura 876

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | Número do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 152 | C | NM_SOCIEDADE | nome da sociedade |
| 189 | 14 | N | NR_CNPJ | cnpj da sociedade |
| 203 | 4 | N | CD_MUNICIPIO | código do município |
| 207 | 40 | C | NM_MUNICIPIO | nome do município |
| 247 | 2 | C | NM_UF | UF |
| 249 | 2 | N | CD_OPERACAO | Código da natureza |
| 251 | 70 | C | NM_OPERACAO | Descrição da natureza |
| 321 | 1 | C | CD_ESPECIE | código da espécie de participação |
| 322 | 90 | C | NM_ESPECIE | descrição da espécie de participação |
| 412 | 1 | C | IN_DECISAO_JUDICIAL | flag que indica se TCM é por decisão judicial |
| 413 | 8 | N | DT_ALIENACAO | data de alienação |
| 421 | 8 | N | DT_DECISAO_JUDICIAL | data da decisão judicial |
| 429 | 8 | N | DT_LAVRATURA | data da lavratura |
| 437 | 8 | N | DT_TRANSITO_JULGADO | data do trânsito julgado |
| 445 | 1 | C | IN_ALIENPRAZO | flag de alienação a prazo |
| 446 | 13 | N | VR_OPERACAO | Valor da operação |
| 459 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 472 | 1 | C | IN_PEQUENO_VALOR | Indicador  o conjunto de bens ou direitos da mesma natureza alienados é superior a  20.000,00 |
| 473 | 1 | C | IN_GCAP_ANTERIOR | flag de alienação parcial anterior |
| 474 | 13 | N | VR_GCAP_ANTERIOR | valor da alienação parcial anterior |
| 487 | 13 | N | VR_VALOR_ALIENACAO_AP | Seção Apuração) valor da alienação |
| 500 | 13 | N | VR_CUSTO_CORRETAGEM_AP | Seção Apuração) custo de corretagem |
| 513 | 13 | N | VR_LIGUIDO_ALIENACAO_AP | Seção Apuração) valor líquido |
| 526 | 13 | N | VR_CUSTO_AQUISICAO_AP | Seção Apuração) custo de aquisição |
| 539 | 13 | N | VR_GCAP_AP | Seção Apuração) ganho de capital |
| 552 | 13 | N | VR_OPERACAO_BRUTO_ANT | (Seção Calculo do imposto) Valor bruto da operação de anos anteriores. |
| 565 | 13 | N | VR_CORRETAGEM_ANT | (Seção Calculo do imposto) Valor bruto de corretagem de anos anteriores. |
| 578 | 13 | N | VR_GCAP_CI_ANT_LIGUIDO | (Seção Calculo do imposto) Valor líquido da operação de anos anteriores. |
| 591 | 13 | N | VR_GCAP_CI | (Seção Calculo do Imposto) ganho de capital |
| 604 | 9 | N | VR_ALIQUOTA_MEDIA_CI | (Seção Calculo do Imposto) alíquota média |
| 613 | 13 | N | VR_IMPOSTO_DEVIDO_CI | (Seção Calculo do Imposto) imposto devido |
| 626 | 13 | N | VR_IRRF_CI | (Seção Calculo do Imposto) imposto retido na fonte |
| 639 | 13 | N | VR_IMPOSTO_DEVIDO_APOS_COMPENSACAO_CI | (Seção Calculo do Imposto) imposto devido após compensação |
| 652 | 13 | N | VR_IMPOSTO_PAGO_CI | (Seção Calculo do Imposto) imposto pago |
| 665 | 13 | N | VR_RECEBIDO_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total Recebido das parcela |
| 678 | 13 | N | VR_CORRETAGEM_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total da corretagem das parcelas |
| 691 | 13 | N | VR_VALOR_LIQUIDO | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total liquido das parcelas |
| 704 | 13 | N | VR_AQUISICAO_PROPORCIONAL_CL | (Seção Calculo do Imposto) A vista: Valor zerado. A prazo:Total aquisição das parcelas |
| 717 | 13 | N | VR_DIFERIDO_ANTERIORES_CB | (Seção Consolidação) Valor do imposto diferido de anos anteriores |
| 730 | 13 | N | VR_EXERCICIO_CB | (Seção Consolidação) Valor do imposto referente ao exercício |
| 743 | 13 | N | VR_TOTAL_CB | (Seção Consolidação) total do imposto |
| 756 | 13 | N | VR_IR_CB | (Seção Consolidação) IR na fonte Lei 11033/2004 |
| 769 | 13 | N | VR_IR_DEVIDO_CB | (Seção Consolidação) imposto devido no exercício após Lei 11033/2004 |
| 782 | 13 | N | VR_DIFERIDO_POSTERIOR_CB | (Seção Consolidação) Valor do imposto diferido para anos posteriores |
| 795 | 13 | N | VR_IMPOSTO_PAGO_CB | (Seção Consolidação) Imposto pago |
| 808 | 13 | N | VR_ISENTO_CB | (Seção Consolidação) Rendimento isento e não tributável |
| 821 | 13 | N | VR_EXCLUSIVO_CB | (Seção Consolidação)  Rendimento exclusivo e tributação definitiva |
| 834 | 13 | N | VR_CUSTO_TOTAL_AQUISICAO | (Seção Apuração do custo de aquisição) Valor do custo total consolidado |
| 847 | 8 | N | DT_DATA_DARF_TCM | Data de vencimento do darf quanto se trata de TCM |
| 855 | 8 | N | DT_DATA_ULTIMA_PARCELA | Data de vencimento da ultima parcela |
| 863 | 1 | C | IND_TER_PARAISO_FISCAL | indicador paraíso fiscal ou território paraíso fiscal |
| 864 | 3 | N | CD_PAIS_PARAISO_FISCAL | Código do país que o contribuinte estava no ato da alienação |
| 867 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `64` — 53 campos, largura 881

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | Número do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | C | IN_TIPO | flag de alienação a prazo |
| 38 | 13 | N | VR_COTACAO_OP | cotaçaõ do dolar na operação |
| 51 | 13 | N | VR_OPERACAO_DOLAR | (Seção Operação) Valor nominal da operação |
| 64 | 13 | N | VR_CORRETAGEM_DOLAR | (Seção Operação) custo corretagem da operação |
| 77 | 13 | N | VR_TORNA_ME_DOLAR | (Seção Operação) Custo de Torna ME |
| 90 | 13 | N | VR_TORNA_MN_DOLAR | (Seção Operação) Custo de Torna MN |
| 103 | 13 | N | VR_VALOR_ALIENACAO_AP_AMBAS | (Seção Apuração) valor da alienação independente da moeda |
| 116 | 13 | N | VR_CUSTO_CORRETAGEM_AP_AMBAS | (Seção Apuração) valor da corretagem independente da moeda |
| 129 | 13 | N | VR_LIQUIDO_ALIENACAO_AP_AMBAS | (Seção Apuração) valor da corretagem independente da moeda |
| 142 | 13 | N | VR_GCAP_TOTAL_AP_AMBAS | (Seção Apuração) GCAP total em ambas as moedas |
| 155 | 1 | C | IN_ORIGEM_REND | flag de alienação a prazo |
| 156 | 60 | C | NM_ORIGEM_REND_DESC | nome da origem dos rendimentos |
| 216 | 13 | N | VR_COTACAO_AQUISICAO | Seção Aquisição contação do dolar na data de aquisição |
| 229 | 13 | N | VR_BEM_AQUISICAO_DOLAR | (Seção Aquisição) sem reforma: Valor em Dolar - com reforma: Totalizador do bem |
| 242 | 13 | N | VR_BEM_AQUISICAO_RMN | Seção Aquisição Ambas as moedas - valor total das parcela em moeda nacional  (Dolar) |
| 255 | 5 | N | FT_BEM_AQUISICAO_RMN | Seção Aquisição Porcentagem do bem originado de moeda nacional quando ambas as moedas |
| 260 | 13 | N | VR_BEM_AQUISICAO_RME | Seção Aquisição Ambas as moedas - valor total das parcela em moeda estrangeira  (Dolar) |
| 273 | 5 | N | FT_BEM_AQUISICAO_RME | Seção Aquisição Porcentagem do bem originado de moeda estrangeira quando ambas as moedas |
| 278 | 3 | N | COD_PAIS_ACORDO | Código do país |
| 281 | 60 | C | NM_COD_PAIS_ACORDO | Identificação da declaração |
| 341 | 13 | N | VR_IMPOSTO_REAL_ACORDO | Seção Identificação Valor do imposto acordo em reais |
| 354 | 13 | N | VR_GCAP_TOTAL_AJUSTE | (Seção Ajuste) ganho de capital total relativo ao ajuste |
| 367 | 9 | N | FT_ALIQUOTA_MEDIA_AJUSTE | (Seção Ajuste) aliquota média do ajuste |
| 376 | 13 | N | VR_IMPOSTO_TOTAL_AJUSTE | (Seção Ajuste) imposto total devido |
| 389 | 13 | N | VR_IMPOSTO_PAGO_COMPENSACAO | (Seção Ajuste) imposto pago no exterior passivel de compensação |
| 402 | 13 | N | VR_SALDO_IMPOSTO_DEVIDO | (Seção Ajuste) saldo do imposto devido no Brasil |
| 415 | 13 | N | VR_IMPOSTO_PARCELA_AJUSTE | (Seção Ajuste) Imposto devido relativo as parcelas |
| 428 | 13 | N | VR_SALDO_IMPOSTO_AJUSTE | (Seção Ajuste) saldo do imposto devido na ultima parcela |
| 441 | 13 | N | VR_IMPOSTO_PAGO_AJUSTE | (Seção Ajuste) imposto pago brasil realtivo ao ajuste |
| 454 | 1 | C | IN_COBRANCA | flag de envio de cobrança ao CCPF |
| 455 | 13 | N | VR_TOTAL_RECEBIDO_DOLAR | somatório do valor recebido das parcelas em dolar |
| 468 | 13 | N | VR_TOTAL_CUSTO_CORRETAGEM_DOLAR | somatório do custo de corretagem das parcelas em dolar |
| 481 | 13 | N | VR_TOTAL_LIQUIDO_RECEBIDO_DOLAR | somatório do valor líquido das parcelas em dolar |
| 494 | 13 | N | VR_TOTAL_LIQUIDO_RECEBIDO_REAL | somatório do valor líquido das parcelas em real |
| 507 | 13 | N | VR_TOTAL_AQUISICAO_DOLAR | somatório do custo de aquisição das parcelas em dolar |
| 520 | 13 | N | VR_TOTAL_AQUISICAO_REAL | somatório do custo de aquisição das parcelas em real |
| 533 | 13 | N | VR_TOTAL_AQUISICAO_TORNA_DOLAR | somatório do custo de aquisição torna das parcelas em dolar |
| 546 | 13 | N | VR_TOTAL_AQUISICAO_TORNA_REAL | somatório do custo de aquisição torna das parcelas em real |
| 559 | 13 | N | VR_TOTAL_RESULTADO1 | somatório do ganho 1 das parcelas |
| 572 | 13 | N | VR_TOTAL_REDUCAO | somatório do das reduções das parcelas |
| 585 | 13 | N | VR_TOTAL_GCAP_DOLAR | somatório do ganho de capital final das parcelas |
| 598 | 13 | N | VR_TOTAL_IR | somatório do imposto devido das parcelas |
| 611 | 13 | N | VR_TOTAL_IR_PAGO | somatório do imposto pago das parcelas |
| 624 | 200 | C | NM_MENSAGEM | Texto. Em branco quando não existe alteração inicial de cobrança/isenção ou de isenção/cobrança. |
| 824 | 40 | C | NM_MOEDA_ESTRANGEIRA | Nome da moeda usada na aquisição do bem |
| 864 | 7 | C | CD_MOEDA_ESTRANGEIRA | Identifica a moeda usada na aquisição do bem |
| 871 | 1 | C | IN_RESIDENTE_BRASIL_APLICACAO_EXTERIOR | Indica a marcação da pergunta para residentes no Brasil com aplicações no exterior, conforme a Lei 14.754/2023 |
| 872 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `65` — 9 campos, largura 121

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do REG 60 campo NR_IDENTIFICACAO ( Concatenação de dia/ mês dos campos DT_INICIO + DT_FIM ) |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_TIPO | formato do bem: 1-Imovel; 2-Movel; 3-Participação Societaria |
| 38 | 14 | C | NR_CPFCNPJ | CPF / CNPJ do adquirente |
| 52 | 60 | C | NR_nome | nome do adquirente |
| 112 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `66` — 13 campos, largura 116

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do 'REG 60' campo 'NR_IDENTIFICACAO' ( Concatenação de dia/ mês dos campos DT_INICIO + DT_FI |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 8 | N | DT_DATA | Data da ampliação /reforma - DD/MM/AAAA |
| 45 | 13 | N | VR_VALOR_REAIS | Valor da parcela reais: Brasil -> valor da parcela; Exterior Moeda Nacional - Valor em reais da parcela; Exterior Ambas as Moedas  |
| 58 | 9 | N | VR_PORCENTAGEM_PARCELA | Custo unitario em comparação com o total % |
| 67 | 13 | N | VR_VALOR_REDUCAO | Valor passivel de redução |
| 80 | 9 | N | VR_PORCENTAGEM_RED7713 | Valor da porcentagem da redução da lei 7.713 |
| 89 | 9 | N | VR_PORCENTAGEM_REDFR1 | Valor da porcentagem da redução FR1 |
| 98 | 9 | N | VR_PORCENTAGEM_REDFR2 | Valor da porcentagem da redução FR2 |
| 107 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `67` — 19 campos, largura 190

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do REG 60 campo NR_IDENTIFICACAO (Concatenação de dia/ mês dos campos DT_INICIO + DT_FIM) |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 8 | N | DT_DATA | Data da ampliação /reforma - DD/MM/AAAA |
| 45 | 13 | N | VR_VALOR_RMN_REAIS | Valor da parcela reais: Moeda Nacional (Valor em reais da parcela).  Ambas as Moedas (Valor em reais de RMN) |
| 58 | 9 | N | VR_PORCENTAGEM_PARCELA_RMN | Valor em porcentagem, obtido mediante a comparação entre o 'Custo unitario' e o 'Custo total' |
| 67 | 13 | N | VR_COTACAO_AMPLIACAO | Cotação do dolar da parcela de ampliação/reforma: Moeda nacional (valor > 0). Moeda Estrangeira (valor = 0). Ambas as Moedas (valo |
| 80 | 13 | N | VR_VALOR_RMN_DOLAR | Valor da parcela de aquisicao para RMN em Dolar: Moeda Nacional (valor em Dolar da parcela). Moeda Estrangeira (valor = 0). Ambas  |
| 93 | 13 | N | VR_VALOR_RME_DOLAR | Valor da parcela de aquisicao para RME em Dolar: Moeda Nacional (valor = 0). Moeda Estrangeira (valor em Dolar da parcela). Ambas  |
| 106 | 13 | N | VR_TOTAL_PARCELA_DOLAR | Valor total da parcela de aquisicao em Dolar: Ambas as Moedas (valor =  VR_VALOR_RMN_DOLAR + VR_VALOR_RME_DOLAR). |
| 119 | 9 | N | VR_PORCENTAGEM_PARCELA_RME | Valor em porcentagem, obtido mediante a comparação entre o 'Custo unitario' e o 'Custo total' para RME |
| 128 | 13 | N | VR_VALOR_REDUCAO_RMN | Valor passivel de redução RMN |
| 141 | 13 | N | VR_VALOR_REDUCAO_RME | Valor passivel de redução RME |
| 154 | 9 | N | VR_PORCENTAGEM_RED7713 | Valor da porcentagem da redução da lei 7.713 |
| 163 | 9 | N | VR_PORCENTAGEM_REDFR1 | Valor da porcentagem da redução FR1 |
| 172 | 9 | N | VR_PORCENTAGEM_REDFR2 | Valor da porcentagem da redução FR2 |
| 181 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `68` — 31 campos, largura 335

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | NR_TIPO_APURACAO | formato de Apuração |
| 38 | 13 | N | VR_VALOR | Valor de alienação |
| 51 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 64 | 13 | N | VR_LIQUIDO_APURACAO | valor líquido de alienação em reais |
| 77 | 13 | N | VR_LIQUIDO_APURACAO_DOLAR | valor líquido de alienação em dólar |
| 90 | 13 | N | VR_CUSTO_APURACAO | custo de aquisição |
| 103 | 13 | N | VR_RESULTADO_1_APURACAO | ganho de capital 1 em reais |
| 116 | 13 | N | VR_RESULTADO_1_APURACAO_DOLAR | ganho de capital 1 em dólar |
| 129 | 9 | N | FT_REDUCAO_LEI7713_APURACAO | percentual redução lei 7713 |
| 138 | 13 | N | VR_REDUCAO_LEI7713_APURACAO | valor de redução lei 7713 |
| 151 | 13 | N | VR_RESULTADO_2_APURACAO | ganho de capital 2 |
| 164 | 9 | N | FT_REDUCAO_LEI11196FR1 | percentual redução fr1 |
| 173 | 13 | N | VR_REDUCAO_LEI11196FR1 | valor de redução fr1 |
| 186 | 13 | N | VR_RESULTADO_3_APURACAO | ganho de capital 3 |
| 199 | 9 | N | FT_REDUCAO_LEI11196FR2 | percentual redução fr2 |
| 208 | 13 | N | VR_REDUCAO_LEI11196FR2 | valor de redução fr2 |
| 221 | 13 | N | VR_RESULTADO_4_APURACAO | ganho de capital 4 |
| 234 | 9 | N | FT_APLICA_OUTRO_APURACAO | percentual redução aplicação ontro imóvel |
| 243 | 13 | N | VR_APLICA_OUTRO_APURACAO | valor de redução  aplicação ontro imóvel |
| 256 | 9 | N | FT_APLICA_PEQUENO_APURACAO | percentual redução pequeno valor |
| 265 | 13 | N | VR_APLICA_PEQUENO_APURACAO | valor de redução pequeno valor |
| 278 | 9 | N | FT_APLICA_UNICO_APURACAO | percentual redução único imóvel |
| 287 | 13 | N | VR_APLICA_UNICO_APURACAO | valor de redução único imóvel |
| 300 | 13 | N | VR_RESULTADO_5_APURACAO | ganho de capital 5 |
| 313 | 13 | N | VR_COTACAO_APURACAO | cotação do dolar da operação |
| 326 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `69` — 15 campos, largura 151

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | NR_TIPO_APURACAO | formato de Apuração |
| 38 | 13 | N | VR_VALOR | Valor de alienação |
| 51 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 64 | 13 | N | VR_LIQUIDO_APURACAO | valor líquido de alienação em reais |
| 77 | 13 | N | VR_LIQUIDO_APURACAO_DOLAR | valor líquido de alienação em dólar |
| 90 | 13 | N | VR_CUSTO_APURACAO | custo de aquisição |
| 103 | 13 | N | VR_RESULTADO_1_APURACAO | ganho de capital 1 em reais |
| 116 | 13 | N | VR_RESULTADO_1_APURACAO_DOLAR | ganho de capital 1 em dólar |
| 129 | 13 | N | VR_COTACAO_APURACAO | cotação do dolar da operação |
| 142 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `70` — 18 campos, largura 185

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_TIPO | Indicação se é movel ou imóvel |
| 38 | 8 | N | DT_PARCELA | Data da  parcela |
| 46 | 13 | N | VR_VALOR | Valor de alienação em dólar |
| 59 | 13 | N | VR_CORRETAGEM | custo de corretagem em dólar |
| 72 | 13 | N | VR_LIQUIDO | valor líquido de alienação em dólar |
| 85 | 13 | N | VR_APLICA_OUTRO_INFORMADO_PARCELA | (Seção Parcela) Valor reaplicado em outro imóvel em reais |
| 98 | 13 | N | VR_GCAP_TOTAL | ganho de capital Total em reais |
| 111 | 13 | N | VR_IMPOSTO_DEVIDO_PARCELA | Imposto Devido |
| 124 | 13 | N | VR_IMPOSTO_PAGO_COMPENSACAO | Imposto pago no exterior parssivel de compensação |
| 137 | 13 | N | VR_IMPOSTO_DEVIDO_BRASIL | Imposto devido no brasil |
| 150 | 13 | N | VR_IMPOSTO_PAGO_PARCELA_BRASIL | Imposto pago no Brasil |
| 163 | 13 | N | VR_TOTAL_REDUCAO | Total do somatório das reduções |
| 176 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `71` — 41 campos, largura 444

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | NR_TIPO_PARCELA | formato de parcela |
| 38 | 1 | C | IN_ULTIMA_PARCELA | indicador de ultima parcela |
| 39 | 8 | N | DT_PARCELA | data de recebimento da ultima parcela |
| 47 | 13 | N | VR_LIQUIDO_PARCELA_AMBAS | Valor de líquido da parcela somando MN e ME |
| 60 | 13 | N | VR_VALOR | Valor de alienação |
| 73 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 86 | 13 | N | VR_LIQUIDO_PARCELA | valor líquido da parcela em reais |
| 99 | 13 | N | VR_LIQUIDO_PARCELA_DOLAR | valor líquido da parcela em dólar |
| 112 | 13 | N | VR_CUSTO_PARCELA | custo de aquisição |
| 125 | 13 | N | VR_RESULTADO_1_PARCELA | ganho de capital 1 em reais |
| 138 | 13 | N | VR_RESULTADO_1_PARCELA_DOLAR | ganho de capital 1 em dólar |
| 151 | 9 | N | FT_REDUCAO_LEI7713_PARCELA | percentual redução lei 7713 |
| 160 | 13 | N | VR_REDUCAO_LEI7713_PARCELA | valor de redução lei 7713 |
| 173 | 13 | N | VR_RESULTADO_2_PARCELA | ganho de capital 2 |
| 186 | 9 | N | FT_REDUCAO_LEI11196FR1 | percentual redução fr1 |
| 195 | 13 | N | VR_REDUCAO_LEI11196FR1 | valor de redução fr1 |
| 208 | 13 | N | VR_RESULTADO_3_PARCELA | ganho de capital 3 |
| 221 | 9 | N | FT_REDUCAO_LEI11196FR2 | percentual redução fr2 |
| 230 | 13 | N | VR_REDUCAO_LEI11196FR2 | valor de redução fr2 |
| 243 | 13 | N | VR_RESULTADO_4_PARCELA | ganho de capital 4 |
| 256 | 13 | N | VR_APLICA_OUTRO_INFORMADO_PARCELA | valor informado de redução aplicação ontro imóvel |
| 269 | 9 | N | FT_APLICA_OUTRO_PARCELA | percentual redução aplicação ontro imóvel |
| 278 | 13 | N | VR_APLICA_OUTRO_PARCELA | valor de redução  aplicação ontro imóvel |
| 291 | 9 | N | FT_APLICA_PEQUENO_PARCELA | percentual redução pequeno valor |
| 300 | 13 | N | VR_APLICA_PEQUENO_PARCELA | valor de redução pequeno valor |
| 313 | 9 | N | FT_APLICA_UNICO_PARCELA | percentual redução único imóvel |
| 322 | 13 | N | VR_APLICA_UNICO_PARCELA | valor de redução único imóvel |
| 335 | 13 | N | VR_RESULTADO_5_PARCELA | ganho de capital 5 |
| 348 | 13 | N | VR_TOTAL_REDUCAO | somatório das reduções da parcela |
| 361 | 9 | N | VR_ALIQUOTA_MEDIA_PARCELA | aliquota de imposto |
| 370 | 13 | N | VR_IMPOSTO_DEVIDO_PARCELA | imposto devido total |
| 383 | 13 | N | VR_IMPOSTO_PAGO_COMPENSACAO | imposto pago no exterior |
| 396 | 13 | N | VR_IMPOSTO_DEVIDO_BRASIL | imposto devido brasil |
| 409 | 13 | N | VR_IMPOSTO_PAGO_PARCELA_BRASIL | imposto pago brasil |
| 422 | 13 | N | VR_COTACAO_PARCELA | cotação do dolar da operação |
| 435 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `72` — 24 campos, largura 235

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_TIPO | se é móvel ou participação societaria |
| 38 | 1 | N | NR_TIPO_PARCELA | formato de parcela |
| 39 | 1 | C | IN_ULTIMA_PARCELA | indicador de ultima parcela |
| 40 | 8 | N | DT_PARCELA | data de recebimento da ultima parcela |
| 48 | 13 | N | VR_LIQUIDO_PARCELA_AMBAS | Valor de líquido da parcela somando MN e ME |
| 61 | 13 | N | VR_VALOR | Valor de alienação |
| 74 | 13 | N | VR_CORRETAGEM | custo de corretagem |
| 87 | 13 | N | VR_LIQUIDO_PARCELA | valor líquido da parcela em reais |
| 100 | 13 | N | VR_LIQUIDO_PARCELA_DOLAR | valor líquido da parcela em dólar |
| 113 | 13 | N | VR_CUSTO_PARCELA | custo de aquisição |
| 126 | 13 | N | VR_RESULTADO_1_PARCELA | ganho de capital 1 em reais |
| 139 | 13 | N | VR_RESULTADO_1_PARCELA_DOLAR | ganho de capital 1 em dólar |
| 152 | 9 | N | VR_ALIQUOTA_MEDIA_PARCELA | aliquota de imposto |
| 161 | 13 | N | VR_IMPOSTO_DEVIDO_PARCELA | imposto devido total |
| 174 | 13 | N | VR_IMPOSTO_PAGO_COMPENSACAO | imposto pago no exterior |
| 187 | 13 | N | VR_IMPOSTO_DEVIDO_BRASIL | imposto devido brasil |
| 200 | 13 | N | VR_IMPOSTO_PAGO_PARCELA_BRASIL | imposto pago brasil |
| 213 | 13 | N | VR_COTACAO_PARCELA | cotação do dolar da operação |
| 226 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `73` — 12 campos, largura 152

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do REG 60 campo NR_IDENTIFICACAO ( Concatenação de dia/ mês dos campos DT_INICIO + DT_FIM ) |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 4 | C | NR_ITEM | Chave de Identificação da operação da ficha apuração do custo |
| 41 | 1 | N | IN_ESPECIE | formato da Especie de participação: 1.Ação preferencial nominativa; 2.Ação ordinária nominativa; 3.Quotas; 4.Outras; |
| 42 | 60 | C | NM_DESCRICAO_ESPECIE | Descrição da espécie de participação |
| 102 | 11 | N | VR_QUANTIDADE_ALIENADA | (Sessão apuração do custo de aquisição) quantidade de itens alienados |
| 113 | 17 | N | VR_CUSTO_MEDIO | (Sessão apuração do custo de aquisição) Valor do custo medio ponderado |
| 130 | 13 | N | VR_CUSTO_TOTAL | (Sessão apuração do custo de aquisição) Custo Total |
| 143 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `74` — 21 campos, largura 299

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do REG 60 campo NR_IDENTIFICACAO ( Concatenação de dia/ mês dos campos DT_INICIO + DT_FIM ) |
| 33 | 4 | C | NR_ITEM | Chave de Identificação da operação das vendas de moeda |
| 37 | 7 | C | CD_MOEDA | Identifica a moeda |
| 44 | 40 | C | NM_MOEDA | nome da moeda alienada |
| 84 | 1 | C | TIPO_OPERACAO | Código do tipo de operação. 1- Saldo inicial; 2 - Compra; 3 - Venda |
| 85 | 15 | C | NM_OPERACAO | nome do tipo de operação. Saldo inicial; Compra; Venda |
| 100 | 60 | C | NM_ADQUIR | nome do adquirente |
| 160 | 14 | C | NR_ADQUIR | CNPJ-CPF do adquirente |
| 174 | 8 | N | DT_OPERACAO | Data da aquisicao/alienação |
| 182 | 13 | N | VR_OPERACAO | Valor da aquisicao/alienação |
| 195 | 13 | N | NR_QUANTIDADE | Quantidade de moeda adquirida/alienada |
| 208 | 17 | N | VR_CUSTO | Custo médio / cotação média |
| 225 | 13 | N | VR_CUSTOTOTAQUIS | Custo total |
| 238 | 13 | N | VR_GANHOCAPITAL | Valor do Ganho de Capital |
| 251 | 13 | N | VR_SALDO_REAIS | Saldo em  reais |
| 264 | 13 | N | VR_SALDO_ME | Saldo em moeda estrangeira |
| 277 | 13 | N | VR_COTACAO_MOEDA_ESTRANGEIRA_DOLAR | Cotação da moeda estrangeira em relação ao dólar para definir isenção 5k USD |
| 290 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `75` — 23 campos, largura 243

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | Tipo do registro |
| 3 | 11 | N | NR_CPF | cpf do contribuinte |
| 14 | 11 | N | NR_CPF_BENEFICIARIO | cpf do declarante do gcap |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração |
| 33 | 4 | N | NR_OPERACAO | Chave de Identificação da operação |
| 37 | 1 | N | IN_TIPO | se é imóvel, móvel ou participação societaria |
| 38 | 1 | N | IN_APURACAO | se é baseado na apuração ou na apuração final |
| 39 | 13 | N | VR_FAIXA1_TOTAL | Ganho total tributável da primeira faixa de imposto |
| 52 | 13 | N | VR_FAIXA1_ANTERIOR | Ganho anterior tributável da primeira faixa de imposto |
| 65 | 13 | N | VR_FAIXA1_ATUAL | Ganho atual tributável da primeira faixa de imposto |
| 78 | 13 | N | VR_FAIXA2_TOTAL | Ganho total tributável da segunda faixa de imposto |
| 91 | 13 | N | VR_FAIXA2_ANTERIOR | Ganho anterior tributável da segunda faixa de imposto |
| 104 | 13 | N | VR_FAIXA2_ATUAL | Ganho atual tributável da segunda faixa de imposto |
| 117 | 13 | N | VR_FAIXA3_TOTAL | Ganho total tributável da terceira faixa de imposto |
| 130 | 13 | N | VR_FAIXA3_ANTERIOR | Ganho anterior tributável da terceira faixa de imposto |
| 143 | 13 | N | VR_FAIXA3_ATUAL | Ganho atual tributável da terceira faixa de imposto |
| 156 | 13 | N | VR_FAIXA4_TOTAL | Ganho total tributável da quarta faixa de imposto |
| 169 | 13 | N | VR_FAIXA4_ANTERIOR | Ganho anterior tributável da quarta faixa de imposto |
| 182 | 13 | N | VR_FAIXA4_ATUAL | Ganho atual tributável da quarta faixa de imposto |
| 195 | 13 | N | VR_FAIXAT_TOTAL | Ganho total tributável do quadro de fatiamento de faixas de imposto |
| 208 | 13 | N | VR_FAIXAT_ANTERIOR | Ganho anterior tributável do quadro de fatiamento de faixas de imposto |
| 221 | 13 | N | VR_FAIXAT_ATUAL | Ganho atual tributável do quadro de fatiamento de faixas de imposto |
| 234 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `76` — 13 campos, largura 135

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | Tipo do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | NR_CPF_BENEFICIARIO | CPF do beneficiário seja titular ou dependente |
| 25 | 8 | N | NR_IDENTIFICACAO | Identificação da declaração.Originado do REG 60 campo NR_IDENTIFICACAO( Concatenação de dia/ mês dos campos DT_INICIO + DT_FIM ) |
| 33 | 2 | N | NR_MES | Mês de ocorrência |
| 35 | 13 | N | VR_ALIENACAO_DOLAR | Total de alienação em dólar por mês |
| 48 | 13 | N | VR_ALIENACAO_CONSOLIDADA_DOLAR | Total de alienações em dólar consolidado |
| 61 | 13 | N | VR_GANHO_CAPITAL | Total de ganhos de capital no mês (somar apenas valores maiores que zero, pois não compensa prejuízo). |
| 74 | 13 | N | VR_GANHO_CAPITAL_TRIBUTAVEL | Ganho de capital tributável. Essa coluna será zero até que o a coluna B seja maior que US$ 5.000,00. No primeiro mês que o valor d |
| 87 | 13 | N | VR_ALIQUOTA_MEDIA | Alíquota de acordo com a tabela progressiva |
| 100 | 13 | N | VR_IMPOSTO_DEVIDO | Imposto devido no mês |
| 113 | 13 | N | VR_IMPOSTO_PAGO | Imposto pago. Informado pelo contribuinte na tela |
| 126 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `77` — 9 campos, largura 102

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | C | FILLER | Filler |
| 16 | 7 | N | PAIS_MOEDA | Pais origem da moeda |
| 23 | 40 | C | NM_MOEDA | nome da moeda alienada |
| 63 | 13 | N | VR_GANHOCAPITAL | Vlr G Capital consolidado das alien. da moeda |
| 76 | 13 | N | VR_IMPOSTO | Vlr imposto devido das alien. da moeda |
| 89 | 4 | N | NR_ITEM | Numero do item |
| 93 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `78` — 9 campos, largura 101

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 13 | N | VR_BENSISENTO | Vlr isentos e não-tributáveis, de bens ou direitos |
| 27 | 13 | N | VR_BENSIMPOSTO | Vlr imposto pago, de bens ou direitos |
| 40 | 13 | N | VR_BENSEXCLUSIVO | Vlr rend. tributação exclusiva, de bens ou direitos |
| 53 | 13 | N | VR_ESPIMPOSTO | Vr imposto devido, de espécie |
| 66 | 13 | N | VR_ESPEXCLUSIVO | Vr rend. tributação exclusiva, de espécie |
| 79 | 13 | N | TRANSPORTEVC_VR_IMPOSTODEVIDO | Valor do imposto devido |
| 92 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `80` — 7 campos, largura 123

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 14 | C | NR_PAGADOR | CNPJ fonte pagadora |
| 28 | 60 | C | NM_PAGADOR | nome fonte pagadora |
| 88 | 13 | N | VR_RENDTO | Valor rendimento recebido |
| 101 | 13 | N | VR_DEP_JUDICIAL | Valor depósito judicial |
| 114 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `81` — 8 campos, largura 134

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 11 | C | CPF_BENEF | CPF do Dependente |
| 25 | 14 | C | NR_PAGADOR | CNPJ fonte pagadora |
| 39 | 60 | C | NM_PAGADOR | nome fonte pagadora |
| 99 | 13 | N | VR_RENDTO | Valor rendimento recebido |
| 112 | 13 | N | VR_DEP_JUDICIAL | Valor depósito judicial |
| 125 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `82` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação da transferência patrimonial |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ do doador/espólio |
| 34 | 60 | C | NM_NOME | nome do doador/espólio |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `83` — 7 campos, largura 52

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 26 | 4 | N | NR_COD |  |
| 30 | 13 | N | VR_VALOR | Valor do recebimento |
| 43 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `84` — 11 campos, largura 144

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF contribuinte |
| 26 | 4 | N | NR_COD |  |
| 30 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 44 | 60 | C | NM_NOME | nome da fonte pagadora |
| 104 | 13 | N | VR_VALOR | Valor do recebimento |
| 117 | 13 | N | VR_VALOR_13 | Valor recebido de décimo terceiro |
| 130 | 5 | N | NR_CHAVE_BEM | chave do bem associado |
| 135 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `85` — 13 campos, largura 178

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 26 | 4 | N | NR_COD |  |
| 30 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 44 | 60 | C | NM_NOME | nome da fonte pagadora |
| 104 | 13 | N | VR_RECEB | Valor do recebimento |
| 117 | 13 | N | VR_13SALARIO | Valor do 13 Salario |
| 130 | 13 | N | VR_IRRF | Valor do IRRF |
| 143 | 13 | N | VR_IRRF13SALARIO | Valor do IRRF sobre 13 Salario |
| 156 | 13 | N | VR_PREVIDENCIA | Contribuição previdenciária oficial |
| 169 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `86` — 11 campos, largura 191

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 26 | 4 | N | NR_COD |  |
| 30 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 44 | 60 | C | NM_NOME | nome da fonte pagadora |
| 104 | 13 | N | VR_VALOR | Valor do recebimento |
| 117 | 60 | C | NM_DESCRICAO | Descrição |
| 177 | 5 | N | NR_CHAVE_BEM | chave do bem associado |
| 182 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `87` — 6 campos, largura 53

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 4 | N | NR_COD |  |
| 18 | 13 | N | VR_VALOR | Valor do recebimento |
| 31 | 13 | N | VR_VALORGCAP | Valor do recebimento |
| 44 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `88` — 10 campos, largura 131

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 26 | 4 | N | NR_COD |  |
| 30 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 44 | 60 | C | NM_NOME | nome da fonte pagadora |
| 104 | 13 | N | VR_VALOR | Valor do recebimento |
| 117 | 5 | N | NR_CHAVE_BEM | chave do bem associado |
| 122 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `89` — 10 campos, largura 186

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 15 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 26 | 4 | N | NR_COD |  |
| 30 | 14 | C | NR_PAGADORA | CNPJ da fonte pagadora |
| 44 | 60 | C | NM_NOME | nome da fonte pagadora |
| 104 | 13 | N | VR_VALOR | Valor do recebimento |
| 117 | 60 | C | NM_DESCRICAO | nome da fonte pagadora |
| 177 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `90` — 9 campos, largura 126

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 2 | N | CD_DOACAO | Codigo de doação |
| 16 | 14 | C | NR_BENEF | CNPJ/CPF do beneficiário |
| 30 | 60 | A | NM_BENEF | nome do beneficiario |
| 90 | 13 | N | VR_DOACAO | Valor da doação |
| 103 | 13 | N | VR_PARC_NAO_DEDUT | Valor da parcela não dedutível ou reembolsada |
| 116 | 1 | N | IN_TIPO_CPF_CNPJ | Indicador se CPF ou CNPJ |
| 117 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `91` — 9 campos, largura 123

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO_FUNDO | formato do fundo: (N)acional, (E)stadual ou (M)unicipal |
| 15 | 2 | C | SG_UF | Sigla da UF |
| 17 | 30 | C | NOME_UF | NOME da UF |
| 47 | 40 | A | NOME_MUNICIPIO | nome do município |
| 87 | 13 | N | VR_DOACAO | Valor da doação |
| 100 | 14 | C | NR_CNPJ_FUNDO | CNPJ do fundo |
| 114 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `92` — 9 campos, largura 123

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 1 | C | IN_TIPO_FUNDO | formato do fundo: (N)acional, (E)stadual ou (M)unicipal |
| 15 | 2 | C | SG_UF | Sigla da UF |
| 17 | 30 | C | NOME_UF | NOME da UF |
| 47 | 40 | A | NOME_MUNICIPIO | nome do município |
| 87 | 13 | N | VR_DOACAO | Valor da doação |
| 100 | 14 | C | NR_CNPJ_FUNDO | CNPJ do fundo |
| 114 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `93` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação da indenização |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `94` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do IRRF ano anterior |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `95` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do IRRF ano anterior |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `96` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do IRRF ano anterior |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `97` — 11 campos, largura 188

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do rendimento |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CPF/CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 1 | C | IN_FICHA | Indicador se o registro é da ficha Rend. Isentos (1) ou Rend. Tributação Exclusiva (2) |
| 119 | 60 | C | NM_RENDIMENTO | Descrição do rendimento |
| 179 | 10 | N | NR_CONTROLE | Número de Controle |

## Registro `98` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do rendimento de caderneta de poupança e letras hipotecárias |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `99` — 9 campos, largura 127

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 5 | N | NR_CHAVE | Chave de identificação do rendimento de aplicações financeiras |
| 19 | 1 | C | IN_TIPO | Indicador se o registro é do titular ou do dependente |
| 20 | 14 | C | NR_PAGADORA | CNPJ da fonte pagadora |
| 34 | 60 | C | NM_NOME | nome da fonte pagadora |
| 94 | 13 | N | VR_RECEB | Valor do recebimento |
| 107 | 11 | C | NR_CPF_BENEFIC | CPF do beneficiário |
| 118 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `DR` — 36 campos, largura 496

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | C | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 3 | C | FILLER | Espaco em branco |
| 17 | 1 | C | IN_COMPLETA | Indicativo dec. Completa(S)/simplificada(N) |
| 18 | 60 | A | NM_NOME | nome do contribuinte |
| 78 | 15 | A | TIP_LOGRA | formato do Logradouro |
| 93 | 40 | C | NM_LOGRA | Endereco contribuinte: logradouro |
| 133 | 6 | C | NR_NUMERO | Endereco contribuinte: numero |
| 139 | 21 | C | NM_COMPLEM | Endereco contribuinte: complemento |
| 160 | 19 | C | NM_BAIRRO | Endereco contribuinte: bairro |
| 179 | 9 | C | NR_CEP | Endereco contribuinte: CEP/ZIP |
| 188 | 4 | N | CD_MUNICIP | Codigo municipio |
| 192 | 40 | C | NM_MUNICIP | Endereco contribuinte: municipio |
| 232 | 2 | A | SG_UF | Endereco contribuinte: UF |
| 234 | 100 | C | FILLER1 | Espaços em branco (Endereço contribuinte: Email - Correio Eletrônico) |
| 334 | 4 | C | FILLER2 | Endereco contribuinte: DDD do FAX |
| 338 | 8 | C | FILLER3 | Endereco contribuinte: FAX |
| 346 | 4 | C | NR_DDD_TELEFONE | Endereco contribuinte: DDD do telefone |
| 350 | 9 | C | FILLER4 | FILLER |
| 359 | 1 | C | IN_RETIFICADORA | Indicativo se declaracao retificadora |
| 360 | 13 | N | VR_TOTTRIB | Valor dos rendimentos tributaveis |
| 373 | 13 | N | VR_IMPDEV | Valor do imposto devido |
| 386 | 13 | N | VR_IMPREST | Valor do imposto a restituir |
| 399 | 13 | N | VR_IMPPAGAR | Valor do imposto a pagar |
| 412 | 1 | N | NR_QUOTAS | Quantidades de quotas |
| 413 | 13 | N | VR_QUOTA | Valor da quota |
| 426 | 3 | N | NR_BANCO | Codigo do Banco |
| 429 | 4 | N | NR_AGENCIA | Numero da Agencia Bancaria |
| 433 | 1 | C | FILLER | Filler |
| 434 | 1 | N | IN_DEBITO_PRIMEIRA_QUOTA | Indicador de Débito Automático da 1ª quota |
| 435 | 13 | N | VR_GCIMPOSTOPAGO | Valor do Imposto pago do Ganho de Capital |
| 448 | 13 | C | NR_CONTA | Numero da conta corrente para deposito de IAR |
| 461 | 2 | C | NR_DV_CONTA | Numero do Digito Verificador da Conta Corrente |
| 463 | 13 | N | VR_VCMOEDAEST | Imposto sobre alienacao de ME em especie |
| 476 | 11 | C | NR_TELEFONE | Endereco contribuinte: telefone |
| 487 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `FR` — 14 campos, largura 256

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | N | NR_REG | formato do registro |
| 3 | 5 | C | NOME_DEC | nome da declaracao |
| 8 | 11 | C | NR_CPF | CPF contribuinte |
| 19 | 10 | C | ND_DEC | ND da declaracao |
| 29 | 10 | C | DT_ENTREGA | Data da entrega |
| 39 | 8 | C | HR_ENTREGA | Hora da entrega |
| 47 | 10 | C | MEIO_ENTREGA | Meio de Entrega |
| 57 | 12 | C | TIPO_DEC | formato Completa ou Simplificada |
| 69 | 63 | C | SIT_DEC | Situacao da declaracao |
| 132 | 3 | C | IN_CERT | Indicador Certificado |
| 135 | 14 | C | CERT_DEC | Certificado da declaracao |
| 149 | 86 | C | OBSERVACAO | Observação |
| 235 | 12 | C | TIPO | Original ou Retificadora |
| 247 | 10 | C | ND_FAR | ND do FAR |

## Registro `HC` — 4 campos, largura 26

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | NR_REG | formato de registro |
| 3 | 11 | C | NR_CPFCNPJ | CPF/CNPJ do Contribuinte |
| 14 | 3 | C | FILLER | Espaco reservado |
| 17 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `HR` — 4 campos, largura 26

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | C | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 3 | C | FILLER | Espaco reservado |
| 17 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `IR` — 160 campos, largura 1244

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 8 | C | SISTEMA | Identificador do Sistema - IRPF - Pessoa Física, com 4 espaços em branco na frente. |
| 9 | 4 | N | EXERCICIO | Exercicio do PGD |
| 13 | 4 | N | ANO_BASE | Ano calendario |
| 17 | 4 | N | CODIGO_RECNET | Código interno da declaração no sistema Receitanet: (2600) - Ajuste (2621) - Espólio (2620 ) - Saída |
| 21 | 1 | C | IN_RETIFICADORA | Indicador se declaracao retificadora |
| 22 | 11 | C | NR_CPF | CPF do contribuinte |
| 33 | 3 | C | FILLER | Filler |
| 36 | 1 | N | TIPO_NI | Indica o tipo de NI: 1 Pessoa Fisica (CPF) |
| 37 | 3 | N | NR_VERSAO | Versao do Programa Gerador da declaracao: 100 (primeira versão) |
| 40 | 60 | A | NM_NOME | nome do contribuinte |
| 100 | 2 | A | SG_UF | UF - Domicilio do Contribuinte |
| 102 | 10 | N | NR_HASH | Hash calculado sobre todos os registros da declaracao,exceto o Header da declaracao e todos os registros do recibo(Nr. Controle SR |
| 112 | 1 | N | IN_CERTIFICAVEL | Indicativo se declaracao eh certificavel |
| 113 | 8 | N | DT_NASCIM | Data de Nascimento (DDMMAAAA) |
| 121 | 1 | C | IN_COMPLETA | Indicativo se declaracao completa |
| 122 | 1 | C | IN_RESULTADO_IMPOSTO | Indicativo de resultado do imposto |
| 123 | 1 | C | IN_GERADA | Indicativo se declaracao gerada |
| 124 | 10 | C | NR_RECIBO_ULTIMA_DEC_EX_ATUAL | Número do recibo da declaração original ou retificadora do exercicio atual a ser retificada |
| 134 | 1 | C | FILLER | Espaço em branco |
| 135 | 14 | C | nome_SO | nome do Sistema Operacional |
| 149 | 7 | C | VERSAO_SO | Numero da versao do Sistema Operacional(SO) |
| 156 | 9 | C | VERSAO_JVM | Numero da versao do Java |
| 165 | 10 | C | NR_RECIBO_DECLARACAO_TRANSMITIDA | Numero do recibo da última declaracao transmitida |
| 175 | 4 | C | CD_MUNICIP | Codigo do municipio |
| 179 | 11 | C | NR_CONJ | CPF do cônjuge |
| 190 | 1 | C | IN_OBRIGAT_ENTREGA | Indicador de Obrigatoriedade de Entrega |
| 191 | 13 | N | VR_IMPDEVIDO | Valor do Carnê-leão e Imposto Complementar dos dependentes. |
| 204 | 10 | C | NR_RECIBO_ULTIMA_DEC_EX_ANTERIOR | Numero do recibo da última do ano anterior |
| 214 | 1 | C | IN_SEGURANCA | Indicador de segurança da declaração |
| 215 | 2 | N | IN_IMPOSTO_PAGO | Indicador se teve imposto pago |
| 217 | 1 | N | IN_IMPOSTO_ANTECIPADO | Indicador se teve imposto antecipado |
| 218 | 1 | N | IN_MUDA_ENDERECO | Indicador de Mudança de Endereço |
| 219 | 8 | N | NR_CEP | Número do CEP informado |
| 227 | 1 | N | IN_DEBITO_PRIMEIRA_QUOTA | Indicador de Débito Automático da 1ª quota |
| 228 | 3 | N | NR_BANCO | Número do Banco Informado |
| 231 | 4 | N | NR_AGENCIA | Número da Agência Informada |
| 235 | 1 | C | IN_SOBREPARTILHA | Ocorreu partilha |
| 236 | 8 | N | DATA_TRANSITO_JULGADO_LAVRATURA | Somente será gravada se a declaração for de espólio:No caso de decisão judicial, grava a data de trânsito julgado se esta for >= 0 |
| 244 | 13 | N | VR_SOMA_IMPOSTO_PAGAR | Valor do imposto a pagar(somatório do imposto a pagar da declaração + GCAP + Renda Variável + GCME Bens, Direitos e Aplic. Finance |
| 257 | 1 | C | IN_OPCAO_TRIBUTACAO_BENEFICIARIO_UM_RRA | Opção de tributação da maior fonte pagadora de RRA |
| 258 | 11 | C | CPF_BENEFICIARIO_UM_RRA | CPF do maior beneficiário de RRA |
| 269 | 1 | C | IN_OPCAO_TRIBUTACAO_BENEFICIARIO_DOIS_RRA | Opção de tributação da segunda maior fonte pagadora de RRA |
| 270 | 11 | C | CPF_BENEFICIARIO_DOIS_RRA | CPF do segundo maior beneficiário de RRA |
| 281 | 1 | C | IN_OPCAO_TRIBUTACAO_BENEFICIARIO_TRES_RRA | Opção de tributação da terceira maior fonte pagadora de RRA |
| 282 | 11 | C | CPF_BENEFICIARIO_TRES_RRA | CPF do terceiro maior beneficiário de RRA |
| 293 | 1 | C | IN_OPCAO_TRIBUTACAO_BENEFICIARIO_QUATRO_RRA | Opção de tributação do quarto maior beneficiário de RRA |
| 294 | 11 | C | CPF_BENEFICIARIO_QUATRO_RRA | CPF do quarto maior beneficiário de RRA |
| 305 | 13 | N | VR_DOACAO_ECA | Valor total das doações na declaração a fundos de Estatuto da Criança e do Adolescente |
| 318 | 13 | N | VR_DOACAO_IDOSO | Valor total das doações na declaração a fundos de Estatuto do Idoso |
| 331 | 14 | C | NR_BASE_FONTE_MAIOR | CPF/CNPJ Base da Maior Fonte Pagadora |
| 345 | 14 | C | NR_BASE_FONTE_DOIS | CPF/CNPJ Base da 2a Maior Fonte Pagadora |
| 359 | 14 | C | NR_BASE_FONTE_TRES | CPF/CNPJ Base da 3a Maior Fonte Pagadora |
| 373 | 14 | C | NR_BASE_FONTE_QUATRO | CPF/CNPJ Base da 4a Maior Fonte Pagadora |
| 387 | 11 | C | NR_CPF_DEPE_REND_MAIOR | CPF de Dependente com maior Rend. Tributavel de PJ |
| 398 | 8 | C | DT_NASC_DEPE_REND_MAIOR | Data Nascimento de Dependente com maior Rend. Tributável de PJ (DDMMAAAA) |
| 406 | 11 | C | NR_CPF_DEPE_REND_DOIS | CPF de Dependente com 2a maior Rend. Tributavel de PJ |
| 417 | 8 | C | DT_NASC_DEPE_REND_DOIS | Data Nascimento de Dependente com 2o maior Rend. Tributável de PJ (DDMMAAAA) |
| 425 | 11 | C | NR_CPF_DEPE_REND_TRES | CPF de Dependente com 3a maior Rend. Tributavel de PJ |
| 436 | 8 | C | DT_NASC_DEPE_REND_TRES | Data Nascimento de Dependente com 3o maior Rend. Tributável de PJ (DDMMAAAA) |
| 444 | 11 | C | NR_CPF_DEPE_REND_QUATRO | CPF de Dependente com 4a maior Rend. Tributavel de PJ |
| 455 | 8 | C | DT_NASC_DEPE_REND_QUATRO | Data Nascimento de Dependente com 4o maior Rend. Tributável de PJ (DDMMAAAA) |
| 463 | 11 | C | NR_CPF_DEPE_REND_CINCO | CPF de Dependente com 5a maior Rend. Tributavel de PJ |
| 474 | 8 | C | DT_NASC_DEPE_REND_CINCO | Data Nascimento de Dependente com 5o maior Rend. Tributável de PJ (DDMMAAAA) |
| 482 | 11 | C | NR_CPF_DEPE_REND_SEIS | CPF de Dependente com 6a maior Rend. Tributavel de PJ |
| 493 | 8 | C | DT_NASC_DEPE_REND_SEIS | Data Nascimento de Dependente com 6o maior Rend. Tributável de PJ (DDMMAAAA) |
| 501 | 14 | C | NR_BASE_BENEF_DESP_MED_MAIOR | CPF/CNPJ Base do maior beneficiário de Despesas Médicas |
| 515 | 14 | C | NR_BASE_BENEF_DESP_MED_DOIS | CPF/CNPJ Base do 2o maior beneficiário de Despesas Médicas |
| 529 | 11 | C | NR_CPF_DEST_PENSAO_ALIMENT_MAIOR | CPF de destinatário com maior pensão alimentícia |
| 540 | 11 | C | NR_CPF_INVENTARIANTE | CPF do inventariante |
| 551 | 40 | A | NM_MUNICIPIO | nome do Município do Contribuinte |
| 591 | 60 | A | NM_CONTRIBUINTE | nome do Contribuinte |
| 651 | 11 | A | FILLER | Espaços em branco |
| 662 | 12 | C | ENDERECO_MAC | Endereço físico da estação |
| 674 | 8 | N | DT_COND_NAO_RESIDENTE | Data da condição de Não-Residente informada na ficha de Saída (formato AAAAMMDD) |
| 682 | 11 | C | NR_CPF_PROCURADOR | CPF do Procurador - informado na ficha saída |
| 693 | 3 | N | FILLER |  |
| 696 | 13 | N | VR_TOTAL_RENDTRIB_PFPJ_TITDEP | Valor total dos rendimentos tributáveis recebidos de pessoa jurídica e de pessoa física pelo titular e dependentes |
| 709 | 11 | C | FILLER | Espaços em branco |
| 720 | 1 | C | IN_CONFIABILIDADE |  |
| 721 | 2 | C | TP_INICIADA | de foi iniciada a declaração: 1-PGD; 2-m-IRPF ; 3-m-IRPF OnLine ; 4-Retificadora OnLine |
| 723 | 2 | C | TP_TRANSMITIDA | Em qual aplicativo foi realizada a transmissão: 1-PGD; 2-m-IRPF ; 3-m-IRPF OnLine; 4-Retificadora OnLine |
| 725 | 11 | C | NR_CPF_TRANSMISSAO | CPF logado no momento da transmissão. |
| 736 | 1 | C | IN_CPF_TRANSMISSAO_PERFIL | Perfil/Papel do CPF no momento da transmissão: 0-Não definido, 1-Próprio, 2- Procurador, 3-Autorizado |
| 737 | 13 | N | VR_TOTISENTOS | Valor total de rendimentos isentos |
| 750 | 13 | N | VR_TOTEXCLUSIVO | Valor total de rendimentos sujeitos a tributação exclusiva |
| 763 | 13 | N | VR_TOTAL_PAGAMENTOS | Valor total de pagamentos (somatório de todos os valores da ficha pagamentos) |
| 776 | 1 | N | IN_PROCESSO_ATUALIZACAO_BEM | O contribuinte fez atualização de algum bem de acordo com a Lei 14973 DE 16/09/2024 0-Não (padrão) 1-Sim |
| 777 | 12 | C | FILLER | Espaços em branco. |
| 789 | 2 | C | NR_DV_CONTA | Numero do Digito Verificador da Conta Corrente |
| 791 | 1 | N | IN_DV_CONTA | Indicador para revalidar DV de conta corrente. 0 - Não revalidar; 1 - Revalidar |
| 792 | 2 | N | CD_NATUR | Código da natureza da ocupação |
| 794 | 11 | A | NR_CPF_EMPREGADA_DOMESTICA_MAIOR | CPF da Empregada Doméstica com maior contribuição patronal |
| 805 | 11 | A | NR_NIT_EMP_DOM_MAIOR | NIT do empregado doméstico com maior contruibuição |
| 816 | 11 | A | NR_CPF_EMPREGADA_DOMESTICA_DOIS | CPF da Empregada Doméstica com segunda maior contribuição patronal |
| 827 | 11 | A | NR_NIT_EMP_DOM_DOIS | NIT do empregado doméstico com segunda maior contruibuição |
| 838 | 11 | A | NR_CPF_EMPREGADA_DOMESTICA_TRES | CPF da Empregada Doméstica com terceira maior contribuição patronal |
| 849 | 11 | A | NR_NIT_EMP_DOM_TRES | NIT do empregado doméstico com terceira maior contruibuição |
| 860 | 1 | C | FILLER | Espaços em branco |
| 861 | 1 | C | IN_UTILIZOU_PGD | Utilizou o PGD:0-Não ; 1-Sim |
| 862 | 1 | C | IN_UTILIZOU_APP | Utilizou o m-IRPF APP:0-Não ; 1-Sim |
| 863 | 1 | C | IN_UTILIZOU_ONLINE | Utilizou o m-IRPF Online:0-Não ; 1-Sim |
| 864 | 1 | C | IN_UTILIZOU_RASCUNHO | Utilizou o Rascunho IRPF:0-Não ; 1-Sim |
| 865 | 1 | C | IN_UTILIZOU_PRE_PREENCHIDA | Utilizou a Pré-Preenchida:0-Não ; 1-Sim |
| 866 | 1 | C | IN_UTILIZOU_ASSISTIDA_FONTE_PAGADORA | Utilizou a Assistida das Fontes Pagadoras:0-Não ; 1-Sim |
| 867 | 1 | C | IN_UTILIZOU_ASSISTIDA_PLANO_SAUDE | Utilizou a Assistida dos Planos de Saúde:0-Não ; 1-Sim |
| 868 | 1 | C | IN_UTILIZOU_SALVAR_RECUPERAR_ONLINE | Utilizou o Salvar / Recuperar Online:0-Não ; 1-Sim |
| 869 | 1 | C | FILLER | Espaços em branco |
| 870 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_UM | CPF-CNPJ do maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 884 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_DOIS | CPF-CNPJ do 2 maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 898 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_TRES | CPF-CNPJ do 3 maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 912 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_QUATRO | CPF-CNPJ do 4 maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 926 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_CINCO | CPF-CNPJ do 5 maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 940 | 14 | C | NR_PAGAMENTO_DEDUTIVEL_MAIOR_SEIS | CPF-CNPJ do 6 maior pagamento dedutível (cod 01; 10 ; 11; 12; 13; 14; 21; 26; 30; 33; 36; 37; 38; 50) |
| 954 | 27 | C | FILLER | Espaços em branco |
| 981 | 1 | C | IN_TIPO_CONTA | 0-Conta corrente 1-Conta Poupança 2-Conta pagamento |
| 982 | 20 | C | NR_CONTA | Numero da conta corrente para débito automático |
| 1002 | 1 | C | IN_SOCIAL | Indicador de que deve devolver o auxilio emergencial 0-Não 1-Sim |
| 1003 | 1 | C | IN_CLWEB |  |
| 1004 | 1 | C | IN_ISENCAO_GCAP_TITULAR | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1005 | 1 | C | IN_ISENCAO_GCAP_MAIOR | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1006 | 1 | C | IN_ISENCAO_GCAP_DOIS | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1007 | 1 | C | IN_ISENCAO_GCAP_TRES | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1008 | 1 | C | IN_ISENCAO_GCAP_QUATRO | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1009 | 1 | C | IN_ISENCAO_GCAP_CINCO | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1010 | 1 | C | IN_ISENCAO_GCAP_SEIS | 0-Não (padrão), 1-Não possui Isenção, 2-180 Dias, 3-Único Imovel, 4- 180 dias e Único Imovel |
| 1011 | 2 | C | IN_FICHA_1 |  |
| 1013 | 2 | C | IN_COD_FICHA_1 |  |
| 1015 | 14 | C | CNPJ_MAIOR_VALOR_1 |  |
| 1029 | 2 | C | IN_FICHA_2 |  |
| 1031 | 2 | C | IN_COD_FICHA_2 |  |
| 1033 | 14 | C | CNPJ_MAIOR_VALOR_2 |  |
| 1047 | 2 | C | IN_FICHA_3 |  |
| 1049 | 2 | C | IN_COD_FICHA_3 |  |
| 1051 | 14 | C | CNPJ_MAIOR_VALOR_3 |  |
| 1065 | 2 | C | IN_FICHA_4 |  |
| 1067 | 2 | C | IN_COD_FICHA_4 |  |
| 1069 | 14 | C | CNPJ_MAIOR_VALOR_4 |  |
| 1083 | 2 | C | IN_FICHA_5 |  |
| 1085 | 2 | C | IN_COD_FICHA_5 |  |
| 1087 | 14 | C | CNPJ_MAIOR_VALOR_5 |  |
| 1101 | 2 | C | IN_FICHA_6 |  |
| 1103 | 2 | C | IN_COD_FICHA_6 |  |
| 1105 | 14 | C | CNPJ_MAIOR_VALOR_6 |  |
| 1119 | 2 | C | IN_FICHA_7 |  |
| 1121 | 2 | C | IN_COD_FICHA_7 |  |
| 1123 | 14 | C | CNPJ_MAIOR_VALOR_7 |  |
| 1137 | 2 | C | IN_FICHA_8 |  |
| 1139 | 2 | C | IN_COD_FICHA_8 |  |
| 1141 | 14 | C | CNPJ_MAIOR_VALOR_8 |  |
| 1155 | 2 | C | IN_FICHA_9 |  |
| 1157 | 2 | C | IN_COD_FICHA_9 |  |
| 1159 | 14 | C | CNPJ_MAIOR_VALOR_9 |  |
| 1173 | 2 | C | IN_FICHA_10 |  |
| 1175 | 2 | C | IN_COD_FICHA_10 |  |
| 1177 | 14 | C | CNPJ_MAIOR_VALOR_10 |  |
| 1191 | 8 | C | DT_RETORNO_PAIS | Data de retorno ao pais, para quem estava morando no exterior. |
| 1199 | 25 | C | FILLER |  |
| 1224 | 8 | N | IN_CRIT_OBRIGAT | Critérios de obrigatoriedade nos quais incidiram a declaração |
| 1232 | 3 | C | VERSAOTESTEPGD | Numero da versao de desenvolvimento do PGD. Esse campo irá compor o campo FILLER2, quando da versão final. |
| 1235 | 10 | N | NR_CONTROLE | Número de controle |

## Registro `MC` — 3 campos, largura 252

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | TP_REG | formato do tipo |
| 3 | 240 | A | DES_MENSAGEM | Descrição da mensagem enviada pelo Validador para o PGD |
| 243 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `NC` — 16 campos, largura 262

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | NR_REG | formato de registro |
| 3 | 1 | N | IN_ACAO_FISCAL | formato de registro |
| 4 | 60 | C | NM_DELEGADO | nome do Delegado da SRF |
| 64 | 8 | C | NR_MATRIC_DELEGADO | Numero da Matricula do Delegado |
| 72 | 1 | N | NR_CARGO | Cargo do Delegado( 1 - AFRF 2 - TRF) |
| 73 | 7 | C | NR_UA | Código da Unidade de Atendimento |
| 80 | 50 | C | NM_UA | nome da Unidade de Atendimento |
| 130 | 8 | N | DT_VENCIMENTO | Data de Vencimento da Multa(Formato AAAAMMDD) |
| 138 | 2 | N | QT_MESES | Qtd. Meses de atraso |
| 140 | 13 | N | VR_MULTA | Valor da Multa |
| 153 | 14 | C | NR_DISTRIBUICAO | Código da Notificação - XHHHHHHHHHHY - DD onde: X - identificador do sistema que está cobrando a multa. Para o IRPF, X = 5 HHHHHHH |
| 167 | 1 | C | IN_OBRIGATORIEDADE | Indicador de obrigatoriedade de entrega atualizado |
| 168 | 57 | C | TP_DELEGACIA | formato da Delegacia |
| 225 | 3 | N | IN_CRIT_OBRIG | Criterio de obrigatoriedade verificado pelo validador |
| 228 | 25 | C | FILLER | Espaco em branco |
| 253 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `R9` — 5 campos, largura 36

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | C | NR_REG | formato do registro |
| 3 | 11 | C | NR_CPF | CPF contribuinte |
| 14 | 3 | C | FILLER | Espaco reservado |
| 17 | 10 | N | NR_HASH | Hash calculado sobre todos os registros da dec.,exceto o Header e o Trailler do recibo |
| 27 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `RC` — 21 campos, largura 131

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | NR_REG | formato de registro |
| 3 | 11 | C | NR_CPFCNPJ | CPF/CNPJ do Contribuinte |
| 14 | 3 | C | FILLER1 | Espaço em branco |
| 17 | 2 | N | DIAREC | Data de recepcao: dia |
| 19 | 2 | N | MESREC | Data de recepcao: mes |
| 21 | 4 | N | ANOREC | Data de recepcao: ano |
| 25 | 2 | N | HORAREC | Horario : hora |
| 27 | 2 | N | MINREC | Horario : minutos |
| 29 | 2 | N | SEGREC | Horario : segundos |
| 31 | 25 | C | LOCALREC | Local de recepcao |
| 56 | 4 | C | NR_REMESSA | N. da remessa |
| 60 | 10 | C | ASSINATURA | Assinatura |
| 70 | 1 | N | IN_GATEWAY | Indicador gateway |
| 71 | 1 | C | FILLER2 | campo reservado |
| 72 | 1 | N | IN_APLIC_TRANSMISSAO | Indica o aplicativo de transmissão: 1- Receitanet; 2-ReceitanetWEB |
| 73 | 2 | C | APLIC_TRANSMISSAO | Indica a expressão associada ao aplicativo de transmissão :RW - se ReceitanetWEB; RN - se Receitanet |
| 75 | 3 | C | COD_AG_TRANSMISSOR | Agente transmissor |
| 78 | 14 | C | NI_ASSINATURA_DECL | NI assinante |
| 92 | 10 | C | CONTROLE_SRF | Número do controle SRF da declaração criptografado. OBS: Essa informação somente deve ser utilizada para a validação do recibo par |
| 102 | 20 | C | FILLER3 | Espaco reservado |
| 122 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `T9` — 85 campos, largura 444

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | C | NR_REG | formato do registro |
| 3 | 11 | N | NR_CPF | CPF contribuinte |
| 14 | 6 | N | QT_TOTAL | Total de registros |
| 20 | 5 | N | QT_R16 | Total de registros tipo 16 |
| 25 | 5 | N | QT_R17 | Total de registros tipo 17 |
| 30 | 5 | N | QT_R18 | Total de registros tipo 18 |
| 35 | 5 | N | QT_R19 | Total de registros tipo 19 |
| 40 | 5 | N | QT_R20 | Total de registros tipo 20 |
| 45 | 5 | N | QT_R21 | Total de registros tipo 21 |
| 50 | 5 | N | QT_R22 | Total de registros tipo 22 |
| 55 | 5 | N | QT_R23 | Total de registros tipo 23 |
| 60 | 5 | N | QT_R24 | Total de registros tipo 24 |
| 65 | 5 | N | QT_R25 | Total de registros tipo 25 |
| 70 | 5 | N | QT_R26 | Total de registros tipo 26 |
| 75 | 5 | N | QT_R27 | Total de registros tipo 27 |
| 80 | 5 | N | QT_R28 | Total de registros tipo 28 |
| 85 | 5 | N | Filler | Filler |
| 90 | 5 | N | QT_R30 | Total de registros tipo 30 |
| 95 | 5 | N | Filler | Filler |
| 100 | 5 | N | QT_R32 | Total de registros tipo 32 |
| 105 | 5 | C | Filler | Filler |
| 110 | 5 | N | QT_R34 | Total de registros tipo 34 |
| 115 | 5 | N | QT_R35 | Total de registros tipo 35 |
| 120 | 5 | C | Filler | Filler |
| 125 | 5 | C | Filler | Filler |
| 130 | 5 | N | QT_R38 | Total de registros tipo 38 |
| 135 | 5 | N | QT_R39 | Total de registros tipo 39 |
| 140 | 5 | N | QT_R40 | Total de registros tipo 40 |
| 145 | 5 | N | QT_R41 | Total de registros tipo 41 |
| 150 | 5 | N | QT_R42 | Total de registros tipo 42 |
| 155 | 5 | N | QT_R43 | Total de registros tipo 43 |
| 160 | 5 | C | Filler | Filler |
| 165 | 5 | N | QT_R45 | Total de registros tipo 45 |
| 170 | 5 | N | QT_R46 | Total de registros tipo 46 |
| 175 | 5 | N | QT_R47 | Total de registros tipo 47 |
| 180 | 5 | N | QT_R48 | Total de registros tipo 48 |
| 185 | 5 | N | QT_R49 | Total de registros tipo 49 |
| 190 | 5 | N | QT_R50 | Total de registros tipo 50 |
| 195 | 5 | N | QT_R51 | Total de registros tipo 51 |
| 200 | 5 | N | QT_R52 | Total de registros tipo 52 |
| 205 | 5 | N | QT_R53 | Total de registros tipo 53 |
| 210 | 5 | N | QT_R54 | Total de registros tipo 54 |
| 215 | 5 | N | QT_R55 | Total de registros tipo 55 |
| 220 | 5 | N | QT_R56 | Total de registros tipo 56 |
| 225 | 5 | N | QT_R57 | Total de registros tipo 57 |
| 230 | 5 | N | QT_R58 | Total de registros tipo 58 |
| 235 | 5 | N | QT_R59 | Total de registros tipo 59 |
| 240 | 5 | N | QT_R60 | Total de registros tipo 60 |
| 245 | 5 | N | QT_R61 | Total de registros tipo 61 |
| 250 | 5 | N | QT_R62 | Total de registros tipo 62 |
| 255 | 5 | N | QT_R63 | Total de registros tipo 63 |
| 260 | 5 | N | QT_R65 | Total de registros tipo 65 |
| 265 | 5 | N | QT_R66 | Total de registros tipo 66 |
| 270 | 5 | N | QT_R67 | Total de registros tipo 67 |
| 275 | 5 | N | QT_R68 | Total de registros tipo 68 |
| 280 | 5 | N | QT_R69 | Total de registros tipo 69 |
| 285 | 5 | N | QT_R70 | Total de registros tipo 70 |
| 290 | 5 | N | QT_R71 | Total de registros tipo 71 |
| 295 | 5 | N | QT_R72 | Total de registros tipo 72 |
| 300 | 5 | N | QT_R73 | Total de registros tipo 73 |
| 305 | 5 | N | QT_R74 | Total de registros tipo 74 |
| 310 | 5 | N | QT_R75 | Total de registros tipo 75 |
| 315 | 5 | N | QT_R76 | Total de registros tipo 76 |
| 320 | 15 | C | Filler | Filler |
| 335 | 5 | N | QT_R80 | Total de registros tipo 80 |
| 340 | 5 | N | QT_R81 | Total de registros tipo 81 |
| 345 | 5 | C | Filler | Filler |
| 350 | 5 | N | QT_R83 | Total de registros tipo 83 |
| 355 | 5 | N | QT_R84 | Total de registros tipo 84 |
| 360 | 5 | N | QT_R85 | Total de registros tipo 85 |
| 365 | 5 | N | QT_R86 | Total de registros tipo 86 |
| 370 | 5 | N | QT_R87 | Total de registros tipo 87 |
| 375 | 5 | N | QT_R88 | Total de registros tipo 88 |
| 380 | 5 | N | QT_R89 | Total de registros tipo 89 |
| 385 | 5 | N | QT_R90 | Total de registros tipo 90 |
| 390 | 5 | N | QT_R91 | Total de registros tipo 91 |
| 395 | 5 | N | QT_R92 | Total de registros tipo 92 |
| 400 | 5 | C | Filler | Filler |
| 405 | 5 | C | Filler | Filler |
| 410 | 5 | C | Filler | Filler |
| 415 | 5 | C | Filler | Filler |
| 420 | 5 | C | Filler | Filler |
| 425 | 5 | C | Filler | Filler |
| 430 | 5 | C | Filler | Filler |
| 435 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `TC` — 5 campos, largura 58

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | NR_REG | formato de registro |
| 3 | 11 | C | NR_CPFCNPJ | CPF/CNPJ do Contribuinte |
| 14 | 3 | C | FILLER | Espaco reservado |
| 17 | 32 | C | SIGNET | Assinatura MD5 |
| 49 | 10 | N | NR_CONTROLE | Numero de Controle |

## Registro `VC` — 22 campos, largura 206

| pos | tam | fmt | campo | observação |
|---|---|---|---|---|
| 1 | 2 | A | TP_REG | formato do tipo |
| 3 | 5 | N | IN_PENDENCIA | Indicador de pendência dos anos anteriores. |
| 8 | 3 | N | QTD_RETIFICADORAS | Quantidade de Retificadoras (já entregues anteriormente) |
| 11 | 1 | A | IN_DEBITO | Indicador de débito com a RFB |
| 12 | 8 | N | DATA_MENSAGEM | Data de geração da mensagem |
| 20 | 1 | A | IN_SALDO_RESTITUICAO | Indicador de existência de saldo de restituição de IRPF não resgatado |
| 21 | 8 | N | DATA_SALDO_RESTITUICAO | Data (formato AAAAMMDD) da apuração da existência de saldo de restituição de IRPF não resgatado |
| 29 | 11 | C | NR_CPF_DARF1 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 40 | 13 | N | VL_DARF1 | Valor do DARF. |
| 53 | 11 | C | NR_CPF_DARF2 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 64 | 13 | N | VL_DARF2 | Valor do DARF. |
| 77 | 11 | C | NR_CPF_DARF3 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 88 | 13 | N | VL_DARF3 | Valor do DARF. |
| 101 | 11 | C | NR_CPF_DARF4 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 112 | 13 | N | VL_DARF4 | Valor do DARF. |
| 125 | 11 | C | NR_CPF_DARF5 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 136 | 13 | N | VL_DARF5 | Valor do DARF. |
| 149 | 11 | C | NR_CPF_DARF6 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 160 | 13 | N | VL_DARF6 | Valor do DARF. |
| 173 | 11 | C | NR_CPF_DARF7 | CPF do contribuinte para emissão do DARF de auxilio emergencial. |
| 184 | 13 | N | VL_DARF7 | Valor do DARF. |
| 197 | 10 | N | NR_CONTROLE | Numero de Controle |


## Mapa oficial: tipo de registro -> significado

Extraído da classe `ConstantesRepositorio` do `irpf-importacao-exportacao.jar`
(as constantes `REG_*`). É o que diz o que cada tipo de registro É — o
`LayoutDadosDIRPF2026.xml` dá os campos, mas não o nome da ficha.

Foi este mapa que revelou, em 24/08/2026, que o registro **76 não é renda
variável** (é ganho de capital em moeda estrangeira) e que as **doações têm
registro no `.DBK`** (90, 91 e 92), duas coisas que o handoff afirmava ao
contrário.

| tipo | constante oficial |
|---|---|
| `16` | REG_IDENTIFICACAO |
| `16` | REG_GCAP_IDENTIFICACAO |
| `16` | REG_GCME_IDENTIFICACAO_CONTRIBUINTE |
| `17` | REG_SIMPLES |
| `18` | REG_RESUMOSIMPLES |
| `19` | REG_COMPLETA |
| `20` | REG_RESUMOCOMPLETA |
| `21` | REG_RENDPJ |
| `22` | REG_RENDPF |
| `23` | REG_RENDISENTOS |
| `24` | REG_RENDEXCLUSIVA |
| `25` | REG_DEPENDENTE |
| `26` | REG_PAGAMENTO |
| `27` | REG_BEM |
| `28` | REG_DIVIDA |
| `29` | REG_CONJUGE |
| `30` | REG_INVENTARIANTE |
| `31` | REG_PENSAO |
| `32` | REG_RENDPJDEPENDENTE |
| `33` | REG_LUCROSDIVIDENDOS |
| `34` | REG_DOACOESCAMPANHA |
| `35` | REG_ALIMENTANDO |
| `36` | REG_PROPRIETARIOUSUFRUTUARIOBEM |
| `37` | REG_APLICACOES_FINANCEIRAS_EXTERIOR |
| `38` | REG_FINALESPOLIO |
| `39` | REG_SAIDA |
| `40` | REG_RENDAVARRESUMOMENSAL |
| `41` | REG_RENDAVARTOTAISANUAIS |
| `42` | REG_RENDAVARINVESTMENSAL |
| `43` | REG_RENDAVARTOTAISINVEST |
| `45` | REG_RRATITULAR |
| `46` | REG_RRATITULAR_PENSAO |
| `47` | REG_RRADEPENDENTE |
| `48` | REG_RRADEPENDENTE_PENSAO |
| `49` | REG_RENDIMENTOS_TRABALHO_NAO_ASSALARIADO_PF |
| `50` | REG_ATIVIDADE_RURAL_ID_IMOVEL |
| `51` | REG_ATIVIDADE_RURAL_REC_DESP_BRASIL |
| `52` | REG_ATIVIDADE_RURAL_APURACAO_RESULTADO |
| `53` | REG_ATIVIDADE_RURAL_MOV_REBANHO |
| `54` | REG_ATIVIDADE_RURAL_BENS |
| `55` | REG_ATIVIDADE_RURAL_DIVIDAS |
| `56` | REG_ATIVIDADE_RURAL_REC_DESP_EXT |
| `57` | REG_ATIVIDADE_RURAL_PROPRIETARIO |
| `58` | REG_HERDEIROS |
| `59` | REG_PERCENTUALBEM |
| `60` | REG_GCAP |
| `61` | REG_GCAP_BEM_IMOVEL |
| `62` | REG_GCAP_BEM_MOVEL |
| `63` | REG_GCAP_PSOCIETARIA |
| `63` | REG_GCAP_APURACAO |
| `63` | REG_GCAP_COMUNS_TXT |
| `64` | REG_GCAP_EXTERIOR |
| `64` | REG_GCAP_ALIENACAO |
| `64` | REG_GCAP_REDUCAO_TXT |
| `65` | REG_GCAP_ADQUIRENTES |
| `66` | REG_GCAP_AMPLIACAO_REFORMA |
| `66` | REG_GCAP_ALIENACAO_TXT |
| `67` | REG_GCAP_AMPLIACAO_REFORMA_EXT |
| `68` | REG_GCAP_APURACAO_IMOVEL |
| `68` | REG_GCAP_REFORMA |
| `69` | REG_GCAP_APURACAO_MOVEL |
| `69` | REG_GCAP_ADQUIRENTE |
| `70` | REG_GCAP_APURACAO_AMBAS |
| `70` | REG_GCME_IDENTIFICACAO_BEM |
| `71` | REG_GCAP_PARCELA_IMOVEL |
| `71` | REG_GCME_DADO_REAIS |
| `72` | REG_GCAP_PARCELA_MOVEL |
| `72` | REG_GCME_PARCELA_APURACAO_REAIS |
| `73` | REG_GCAP_CUSTO_AQUIS_PS |
| `73` | REG_GCME_DADO_MOEDA_ESTRANGEIRA |
| `74` | REG_GCAP_ESPECIE |
| `74` | REG_GCME_PARCELA_APURACAO_ME |
| `75` | REG_GCAP_FAIXAS_GANHO |
| `75` | REG_GCME_DADO_CONSOLIDADO_REAIS_ME |
| `76` | REG_GCAP_TOTALIZACAO_MOEDAS_ALIENADAS |
| `76` | REG_GCME_PARCELA_ESPECIE |
| `77` | REG_GCME_DADO_ESPECIE |
| `78` | REG_GCME_DADO_CONSOLIDADO_GERAL |
| `80` | REG_RENDPJ_EXIG_TIT |
| `81` | REG_RENDPJ_EXIG_DEPEN |
| `83` | REG_RENDIMENTO_ISENTO_TIPO_INFORMACAO_2 |
| `84` | REG_RENDIMENTO_ISENTO_TIPO_INFORMACAO_3 |
| `85` | REG_RENDIMENTO_ISENTO_TIPO_INFORMACAO_4 |
| `86` | REG_RENDIMENTO_ISENTO_TIPO_INFORMACAO_5 |
| `87` | REG_RENDIMENTO_ISENTO_TIPO_INFORMACAO_6 |
| `88` | REG_RENDIMENTO_EXCLUSIVO_TIPO_INFORMACAO_2 |
| `89` | REG_RENDIMENTO_EXCLUSIVO_TIPO_INFORMACAO_3 |
| `90` | REG_DOACAO |
| `91` | REG_DOACAO_ECA |
| `92` | REG_DOACAO_IDOSO |
| `DR` | REG_RECIBODETALHE |
| `GC` | REG_HEADER_MOEDA_ESTRANGEIRA |
| `HC` | REG_COMPLRECIBOHEADER |
| `HR` | REG_RECIBOHEADER |
| `IP` | REG_IMP_PAGO |
| `IR` | REG_HEADER |
| `IR` | REG_HEADERANOANTERIOR |
| `MC` | REG_COMPLRECIBOMENSAGEM |
| `NC` | REG_COMPLRECIBOMULTA |
| `R9` | REG_RECIBOTRAILLER |
| `RC` | REG_COMPLRECIBODETALHE |
| `SR` | REG_HEADER_SR_ONLINE |
| `T9` | REG_TRAILLER |
| `TC` | REG_COMPLRECIBOTRAILLER |
| `VC` | REG_COMPLRECIBOVALIDADOR |
