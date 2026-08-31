# Matriz de casos sintéticos — IRPF 2026

## Objetivo

Produzir, exclusivamente no PGD IRPF 2026 oficial e sem transmissão, PDFs controlados que cubram as fichas ainda sem amostra preenchida. Cada informação recebe um valor sentinela único para permitir a reconciliação campo a campo entre tela, PDF e importação.

## Identificação dos casos

| Caso | Modalidade | CPF sintético | Nome no PGD | Escopo exclusivo |
|---|---|---:|---|---|
| `AJU-01` | Declaração de Ajuste Anual | `111.444.777-35` | `AUDITORIA PDF TEC AJUSTE` | pessoas, rendimentos, pagamentos, patrimônio, atividade rural, ganhos e mercados |
| `ESP-01` | Declaração Final de Espólio | a definir no PGD | `AUDITORIA PDF TEC ESPOLIO` | inventariante, decisão/escritura, partilha e herdeiros |
| `SAI-01` | Declaração de Saída Definitiva | a definir no PGD | `AUDITORIA PDF TEC SAIDA` | data da saída, procurador, endereço e país de destino |

Os CPFs existem apenas para satisfazer a validação local do PGD. Nenhum caso será transmitido.

## Convenção dos sentinelas

- Nomes e descrições começam com o ID do caso e o ID da ficha.
- Valores monetários usam centenas distintas por ficha e centavos distintos por campo.
- Percentuais e quantidades usam sequências próprias, sem repetição dentro da ficha.
- Datas usam dias distintos, respeitando os limites do ano-calendário e da modalidade.
- CNPJ, CPF, CEP e códigos sujeitos a validação usam números públicos de teste ou números válidos gerados exclusivamente para a simulação.
- Campos calculados pelo PGD são registrados como `calculado`, nunca forçados manualmente.

## Lotes do caso AJU-01

| Lote | Fichas prioritárias |
|---|---|
| `AJU-PES` | identificação, dependentes, alimentandos e cônjuge |
| `AJU-RPF` | rendimentos de PF/exterior do titular e dependentes, inclusive Carnê-Leão |
| `AJU-EXI` | rendimentos com exigibilidade suspensa do titular e dependentes |
| `AJU-RRA` | RRA do titular e dependentes |
| `AJU-DEM` | demais rendimentos do titular e dependentes e transportes |
| `AJU-DOA` | doações efetuadas, eleitorais, ECA e pessoa idosa |
| `AJU-RUE` | seis fichas da atividade rural no exterior |
| `AJU-GCA` | ganhos de capital em imóveis, participação societária e moeda em espécie |
| `AJU-RVA` | renda variável dos dependentes e FII/Fiagro do titular e dependentes |
| `AJU-IMP` | detalhes de imposto pago ou retido ainda não observados |

## Valores preenchidos — AJU-PES

### Identificação do contribuinte

| Campo no PGD | Valor sentinela | Situação |
|---|---|---|
| Tipo de declaração | Declaração de Ajuste Anual Original | preenchido |
| CPF do contribuinte | `111.444.777-35` | preenchido |
| Nome | `AUDITORIA PDF TEC AJUSTE` | preenchido |
| Data de nascimento | `11/01/1980` | preenchido |
| Raça/cor | `Parda` | preenchido |
| Houve alteração de dados cadastrais? | `Sim` | preenchido |
| Possui cônjuge ou companheiro(a)? | `Sim` | preenchido |
| CPF do cônjuge ou companheiro(a) | `222.333.444-05` | preenchido |
| Era residente no exterior e passou a ser residente no Brasil em 2025? | `Não` | preenchido |
| Endereço | `Rua SENTINELA AJU PES, 1101, APTO 11` | preenchido |
| Bairro/distrito | `BAIRRO SENTINELA` | preenchido |
| Município/UF | `SAO PAULO/SP` | preenchido |
| CEP | `01001-000` | preenchido |
| Telefone | `(11) 3456-7890` | preenchido |
| Celular | `(11) 99876-5432` | preenchido |
| E-mail | `auditoria.pdf.aju@example.invalid` | preenchido |
| Natureza da ocupação | `12 - Proprietário de empresa ou de firma individual ou empregador-titular` | preenchido |
| Ocupação principal | `391 - Outros técnicos de nível médio` | preenchido |

### Dependente 1

| Campo no PGD | Valor sentinela | Situação |
|---|---|---|
| Tipo de dependente | `21 - Filho(a) ou enteado(a) até 21 anos` | preenchido |
| CPF | `333.444.555-08` | preenchido |
| Data de nascimento | `12/02/2015` | preenchido |
| Raça/cor | `Parda` | preenchido |
| Nome | `AJU PES DEPENDENTE UM` | preenchido |
| E-mail | `aju.pes.dep1@example.invalid` | preenchido |
| Celular | `(11) 99765-4321` | preenchido |
| Endereço diferente do titular | `Sim` | preenchido |
| Dedução calculada pelo PGD | `2.275,08` | calculado |

### Alimentando 1

| Campo no PGD | Valor sentinela | Situação |
|---|---|---|
| Residência | `No Brasil` | preenchido |
| CPF | `444.555.666-19` | preenchido |
| Data de nascimento | `13/03/2010` | preenchido |
| Nome | `AJU PES ALIMENTANDO UM` | preenchido |
| Alimentando do | `Titular` | preenchido |
| Tipo de processo | `Escritura pública` | preenchido |
| CNPJ do cartório | `55.566.677/0001-83` | preenchido |
| Nome do cartório | `CARTORIO AJU PES SENTINELA` | preenchido |
| Livro | `L11` | preenchido |
| Folhas | `F22` | preenchido |
| Município/UF | `SAO PAULO/SP` | preenchido |
| Data da lavratura | `14/04/2025` | preenchido |
| Ciência dos requisitos legais | `Confirmada` | preenchido |

Validação do PGD após o preenchimento: `0 erros` e `1 aviso` esperado (`Alimentando não relacionado a despesa dedutível`). Os valores acima ainda aguardam a conferência no PDF oficial. O núcleo de pessoas do lote `AJU-PES` está preenchido; a próxima etapa é a ampliação para as fichas financeiras antes da emissão do PDF consolidado.

## Evidência obrigatória por ficha

1. Captura ou anotação dos campos preenchidos no PGD.
2. PDF oficial exportado pelo próprio PGD.
3. Página inicial e intervalo de linhas da ficha no PDF.
4. Tabela `campo esperado → valor sentinela → valor extraído`.
5. Estado da ficha no importador e veredito independente.

## Regras de segurança

- Não usar dados pessoais reais.
- Não abrir, alterar ou excluir declarações preexistentes.
- Não acionar `Entregar Declaração`, transmissão ou autenticação gov.br.
- Manter os artefatos finais em `output/pdf` e o dossiê em `AUDITORIA`.
