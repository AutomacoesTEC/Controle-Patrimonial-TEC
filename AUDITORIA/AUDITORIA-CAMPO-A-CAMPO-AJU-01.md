# Auditoria campo a campo do PDF sintético `AJU-01`

Data: `30/08/2026`  
Documento: `output/pdf/AJU-01-DECLARACAO-COMPLETA-IRPF-2026.pdf`  
SHA-256: `5e71e83a016c51ae28789f431cbf2a9489b36348b331d8b0b0091dd7a9ec84bb`  
Identidade: `AUDITORIA PDF TEC AJUSTE`, CPF sintético `111.444.777-35`  
Extensão: `33` páginas, todas com camada de texto utilizável.

## Critério

Um campo só é considerado coberto quando o valor sentinela pode ser atribuído sem ambiguidade à ficha e ao rótulo oficial no PDF. Valor encontrado em outra ficha, resumo ou pagamento relacionado não substitui o campo que o relatório deixou de imprimir.

## Exigibilidade suspensa — titular

Evidência: página `6`.

| Campo do roteiro | Sentinela | Evidência no PDF | Veredito |
|---|---:|---|---|
| CNPJ | `55.566.677/0001-83` | pág. 6 | Coberto |
| Fonte | `AJU EXI FONTE TITULAR` | pág. 6 | Coberto |
| Rendimentos tributáveis | `17.701,91` | pág. 6 | Coberto |
| Depósito judicial | `7.702,92` | pág. 6 | Coberto |
| Previdência oficial | `1.703,93` | não impresso | Aberto |
| Pensão alimentícia | `704,94` | não impresso | Aberto |
| IRRF | `1.705,95` | não impresso | Aberto |

## Exigibilidade suspensa — dependente

Evidência: página `6`.

| Campo do roteiro | Sentinela | Evidência no PDF | Veredito |
|---|---:|---|---|
| Dependente | CPF `333.444.555-08` | pág. 6 | Coberto |
| CNPJ | `55.566.677/0001-83` | pág. 6 | Coberto |
| Fonte | `AJU EXI FONTE DEPENDENTE` | pág. 6 | Coberto |
| Rendimentos | `8.711,96` | pág. 6 | Coberto |
| Depósito judicial | `3.712,97` | pág. 6 | Coberto |
| Previdência | `713,98` | não impresso | Aberto |
| Pensão | `314,99` | não impresso | Aberto |
| IRRF | `615,09` | não impresso | Aberto |

Conclusão do lote `AJU-EXI`: a amostra preenchida existe, mas o PDF oficial observado expõe somente fonte, identificadores, rendimento e depósito judicial. Os seis campos restantes não podem ser recuperados deste PDF e devem permanecer explicitamente `não impressos`, sem inferência pelo resumo.

## RRA — titular

Evidência: página `6`.

| Campo do roteiro | Sentinela | Evidência no PDF | Veredito |
|---|---:|---|---|
| Fonte/CNPJ | `AJU RRA TITULAR EXCLUSIVA` / `55.566.677/0001-83` | pág. 6 | Coberto |
| Opção | `Exclusiva` | pág. 6 | Coberto |
| Rendimentos | `31.801,01` | pág. 6 | Coberto |
| Previdência | `3.802,02` | pág. 6 | Coberto |
| Pensão | `1.803,03` | pág. 6, inclusive alimentando | Coberto |
| IRRF | `4.804,04` | pág. 6 | Coberto |
| Meses | `11,0` | pág. 6 | Coberto |
| Mês de recebimento | `Dez.` | pág. 6 | Coberto |
| Despesas com ação judicial | `2.805,05` | aparece como pagamento na pág. 7, não como campo RRA | Aberto |
| Imposto devido RRA | `0,00` | calculado na pág. 6 | Derivado |

## RRA — dependente

Evidência: página `7`.

| Campo do roteiro | Sentinela | Evidência no PDF | Veredito |
|---|---:|---|---|
| Dependente | CPF `333.444.555-08` | pág. 7 | Coberto |
| Fonte/CNPJ | `AJU RRA DEPENDENTE AJUSTE` / `55.566.677/0001-83` | pág. 7 | Coberto |
| Opção | `Ajuste` | pág. 7 | Coberto |
| Rendimentos | `9.811,06` | pág. 7 | Coberto |
| Previdência | `812,07` | pág. 7 | Coberto |
| Pensão | `313,08` | pág. 7, inclusive alimentando | Coberto |
| IRRF | `914,09` | pág. 7 | Coberto |
| Mês de recebimento | `Dez.` | pág. 7 | Coberto |
| Número de meses | `7` | não impresso para a opção Ajuste | Aberto |
| Despesas judiciais | `515,10` | não impresso | Aberto |

Conclusão do lote `AJU-RRA`: os quadros centrais estão comprovados. Despesas judiciais e, no caso do dependente em Ajuste, número de meses, continuam sem evidência no PDF.

## Coberturas que continuam abertas

| Caso/ficha | Evidência atual | Situação |
|---|---|---|
| ECA | pág. 30: `Sem Informações` | Bloqueada por decisão de escopo: salvar qualquer item gera DARF, o que o roteiro proíbe em absoluto |
| Pessoa Idosa | pág. 30: `Sem Informações` | Bloqueada pelo mesmo motivo do ECA |
| GCAP | demonstrativos não aparecem no `AJU-01` | Bloqueada por ambiente: o GCAP 2025 não está instalado nesta máquina e nenhum arquivo de importação foi fabricado |
| Espólio | modalidade ausente do `AJU-01` | Coberta pela `ESP-01` (CPF `555.666.777-20`, `AUDITORIA PDF TEC ESPOLIO`), preenchida e cadastrada; falta reexportar o PDF após a correção do nome |
| Saída definitiva | modalidade ausente do `AJU-01` | Coberta pela `SAI-01` (CPF `999.000.111-12`, `AUDITORIA PDF TEC SAIDA`), criada e preenchida em 30/08/2026; falta o PDF |

## Prova automatizada

O arquivo `src/irpf/pdfSinteticoAju01.audit.test.js` fixa o hash, as 33 páginas textuais, os campos comprovados e as lacunas acima. O teste não implementa nem modifica o importador.

## Situação da Parte B em 30/08/2026

As duas modalidades que não cabem na declaração de ajuste anual passaram a existir como declarações próprias no PGD, preenchidas pelas classes oficiais e cadastradas em `iddeclaracoes.xml`:

| Caso | CPF sintético | Nome | `tipoDeclaracaoAES` | PDF |
|---|---|---|---|---|
| `ESP-01` | `555.666.777-20` | `AUDITORIA PDF TEC ESPOLIO` | `E` | a reexportar (o PDF de 8 páginas das 15:23 traz o nome antigo `HERANCA`) |
| `SAI-01` | `999.000.111-12` | `AUDITORIA PDF TEC SAIDA` | `S` | a exportar |

O detalhamento campo a campo dessas duas declarações, e a conferência dos sentinelas `ESP` e `SAI` na camada de texto, só podem ser fechados depois que os PDFs oficiais forem gerados pela janela `Impressão` do programa. Até lá, nenhum campo dessas duas modalidades deve ser dado como coberto no PDF.
