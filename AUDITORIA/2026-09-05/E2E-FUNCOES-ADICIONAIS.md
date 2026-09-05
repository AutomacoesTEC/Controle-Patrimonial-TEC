# E2E adicional independente

Script: `auditar-funcoes-adicionais.py`. Perfil sintético `adicional`, em contexto Chromium descartável, reiniciado antes de cada caso; nenhum perfil real acessado. URL `http://127.0.0.1:5173`. Intérprete `/home/automacaotec/emails-tools/venv/bin/python`. Execução liberada fora do sandbox após Chromium falhar ao iniciar dentro dele. `python3` do sistema não tinha Playwright: falha de ambiente, anterior aos testes do produto.

## Primeira rodada, produção congelada

11 de 14 casos completos passaram. Dois defeitos de produto confirmados e uma asserção de impressão ainda sob classificação:

| Caso | Resultado observado |
|---|---|
| Rendimentos | Editar valor 100→150; excluir alvo; conservar outra linha; histórico da operação: passou. |
| Despesas Gerais | Editar descrição/valor; excluir: passou. |
| Doações Efetuadas | Editar valor; baixar XLSX; excluir: passou. |
| Doações Partidos | Editar valor passou; exportação gerou erro JS e não baixou arquivo. Exclusão não foi alcançada nesse caso. |
| Doações ECA/Idoso | Editar valor passou; exportação gerou erro JS e não baixou arquivo. Exclusão não foi alcançada nesse caso. |
| Bens comuns | Editar benfeitoria 20→30; excluir movimento; recuperar saldo100: passou. |
| Dívidas comuns | Editar amortização 20→30; excluir; recuperar saldo100: passou. |
| Bens rurais | Editar benfeitoria 20→30; excluir; recuperar saldo100: passou. |
| Dívidas rurais | Editar amortização 20→30; excluir; recuperar saldo100: passou. |
| Filtros/ordenação | Filtrar rendimento por origem; buscar bem; ordenar descrição crescente/decrescente: passou. |
| Histórico | Ordenar; filtrar fevereiro; limpar filtro: passou. |
| RV Comuns | Relançar mesmo mês com resultado100→200 sem duplicar: passou. Não há botão de exclusão. |
| RV FII | Relançar mesmo mês com resultado100→200 sem duplicar: passou. Não há botão de exclusão. |
| Relatório/Impressão | Clique foi executado; asserção imediata do contador falhou sem mensagem. PDF não foi alcançado; não classificado como defeito do produto nesta rodada. |

Erros JS coletados: exatamente duas ocorrências de `Sheet name cannot exceed 31 chars`. Causa verificada em `DoacoesPage`: passa o título completo da subficha ao exportador Excel. `exportXlsxNomes.test.js` reproduziu os dois títulos reais e um título com caracteres inválidos: três casos falharam antes da correção de produção, às16:06:49.

Capturas iniciais e downloads são artefatos externos temporários em `/tmp/cptec-funcoes-adicionais-ovr1mybc`; não são selados como arquivos presentes no repositório.

Limitação funcional: não há exclusão de mês de RV oferecida pela interface. Relançar corrige os valores, mas não remove o registro manual para voltar à origem importada. Recomendar exclusão/restauração do original em melhoria futura; não declarar função inexistente como teste aprovado nem implementá-la nesta rodada.

Reexecução focada preparada com variável `CPTEC_CASO` (substring do nome do caso). Asserção de impressão alterada para aguardar contador do handler; essa é correção de sincronização do teste, não alteração do produto. A classificação depende da nova execução.

## Reexecuções após correção e novo congelamento

O agente principal corrigiu sanitização/unicidade de nomes de abas no exportador geral. Comandos executados:

```text
CPTEC_CASO=Doações /home/automacaotec/emails-tools/venv/bin/python AUDITORIA/2026-09-05/auditar-funcoes-adicionais.py
CPTEC_CASO=Relatório /home/automacaotec/emails-tools/venv/bin/python AUDITORIA/2026-09-05/auditar-funcoes-adicionais.py
```

Saída das reexecuções:

```json
{"funcao":"Doações Efetuadas: edição/exclusão/exportação","resultado":"PASSOU","detalhe":"Editou, baixou Excel e excluiu o registro."}
{"funcao":"Doações a Partidos Políticos e Candidatos: edição/exclusão/exportação","resultado":"PASSOU","detalhe":"Editou, baixou Excel e excluiu o registro."}
{"funcao":"Doações Diretamente na Declaração (ECA e Pessoa Idosa): edição/exclusão/exportação","resultado":"PASSOU","detalhe":"Editou, baixou Excel e excluiu o registro."}
{"errosJavascript":[],"artefatosTemporarios":"/tmp/cptec-funcoes-adicionais-d2uz6qsz"}
{"funcao":"Relatório: acionamento de impressão e PDF Chromium","resultado":"PASSOU","detalhe":"Botão invoca impressão; Chromium produziu PDF. Diálogo nativo e impressora física não exercitados."}
{"errosJavascript":[],"artefatosTemporarios":"/tmp/cptec-funcoes-adicionais-fu5wnckg"}
```

Classificação final da impressão: erro do teste. A expressão de configuração retornava a função atribuída a `window.print`; o mecanismo de avaliação do Playwright podia invocá-la, alterando o contador antes do clique. A configuração foi substituída por callback com bloco sem retorno, além de espera explícita. O botão funcionou e Chromium gerou PDF; nenhuma mudança no componente de impressão foi necessária.

Cobertura consolidada: os 14 casos têm resultado aprovado, combinando a primeira execução e as reexecuções focadas. Não houve execução única final de todos os 14 após a correção de exportação, portanto esse número não é apresentado como uma rodada única. A falta de exclusão de mês RV permanece uma limitação documentada, não uma função testada com sucesso.

Nenhum código de produção foi editado por este auditor durante os testes de navegador. Alteração realizada nesta etapa em `src` foi exclusivamente o teste de regressão `exportXlsxNomes.test.js`, entregue ao agente principal antes da correção.

## Complemento final: cadastros, compensação e Ganhos de Capital

Comando: `CPTEC_CASO=Complemento /home/automacaotec/emails-tools/venv/bin/python AUDITORIA/2026-09-05/auditar-funcoes-adicionais.py`.

Sete casos adicionais foram incorporados ao script. Na primeira execução, três passaram e quatro pararam no seletor incorreto `Salvar`: os botões reais se chamam `Salvar Dados do Bem` ou `Salvar Dados da Dívida`. Essa foi falha do teste; nenhum erro JavaScript foi emitido. O helper do teste foi ajustado aos rótulos reais sem alteração de produção. A segunda execução passou os sete casos:

```json
{"funcao":"Complemento bens: editar metadados e excluir cadastro","resultado":"PASSOU"}
{"funcao":"Complemento dividas: editar metadados e excluir cadastro","resultado":"PASSOU"}
{"funcao":"Complemento imoveisRurais: editar metadados e excluir cadastro","resultado":"PASSOU"}
{"funcao":"Complemento bensRurais: editar metadados e excluir cadastro","resultado":"PASSOU"}
{"funcao":"Complemento dividasRurais: editar metadados e excluir cadastro","resultado":"PASSOU"}
{"funcao":"Complemento rural: botão Compensar e persistência","resultado":"PASSOU"}
{"funcao":"Complemento Ganhos Capital: novo bem, reabertura, venda e exportação","resultado":"PASSOU"}
{"errosJavascript":[],"artefatosTemporarios":"/tmp/cptec-funcoes-adicionais-mhf5gjnr"}
```

Nos cinco cadastros, descrição/nome foram alterados e saldos, movimentos e datas patrimoniais conferidos sem alteração. Em seguida, o registro-alvo foi excluído; no caso de bens, o outro bem permaneceu. Na compensação rural, o botão ajustou saldo sintético de -100 para -70 após informar 30; recarga conservou o saldo e o lançamento de receita permaneceu 200. O teste é operacional e não certifica a regra fiscal.

Em Ganhos de Capital, clicou-se `Novo bem`, criou-se imóvel sintético de 100 com aquisição em 2026, conferiu-se reabertura em edição, registrou-se venda total por 120 em 2026, verificou-se saldo zero e baixou-se o Excel. Não se certificaram regras de isenção, cálculo de imposto ou operação fiscal complexa.

Cobertura consolidada desta auditoria de navegador: 21 casos distintos aprovados, combinando as rodadas documentadas; não uma única execução final de 21 casos. Os sete novos casos alteraram apenas fixture/script e foram executados com produção congelada.
