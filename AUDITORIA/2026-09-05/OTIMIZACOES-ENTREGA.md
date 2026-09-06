# Otimizações autorizadas — fechamento

Continuação direta de [IMPLEMENTACAO-OTIMIZACOES.md](IMPLEMENTACAO-OTIMIZACOES.md). A sessão anterior parou às 18h55 de 05/09/2026 com o código escrito e dois cenários funcionais reprovados. Este documento registra o que faltava, a correção aplicada e a verificação final.

## O que estava em aberto

O reteste funcional de 18h56 (`otimizacoes-funcional-reteste.txt`) fechou em 9 de 11 cenários. Os dois reprovados apontavam o mesmo sintoma: depois de "Salvar", o modal permanecia aberto e o Playwright expirava esperando `.modal:visible` ficar oculto.

## Causa única, confirmada no código

`AcompanhamentoPage.jsx` montava o formulário de qualquer modal com `operacaoId: operacao`, ou seja, com a operação selecionada no filtro "Operação em foco". No lançamento do tipo transferência esse campo nem é exibido, e o domínio o proíbe (`acompanhamento.js`, caso `lancamento`: `exigir(!p.parcelaId && !p.operacaoId, 'Transferência não liquida parcela nem reconhece operação de renda/despesa.')`). Com uma operação em foco, "Transferência entre contas" nunca salvava.

O cenário de fechamento reprovava por consequência: sem a transferência de R$ 10.000,00 entre as contas, os extratos informados (R$ 100.000,00 e R$ 10.000,00) não conciliavam com os saldos calculados (R$ 110.000,00 e R$ 0,00), e `exigir(conciliacoes.every(c => c.diferenca === 0))` recusava o fechamento.

Não é defeito só do teste. Qualquer pessoa que filtre uma operação na aba Operações e parcelas e em seguida registre uma transferência recebe a mesma recusa.

## Previsão registrada antes da mudança

Extrair para o domínio a montagem do formulário e o efeito da troca de tipo. Previsão: os três casos novos de `acompanhamento.test.js` passam de falha a acerto; os dois cenários funcionais reprovados passam sem alterar os nove que já passavam; nenhuma regressão na suíte. Antes bruto: 3 falhas em 9 casos do arquivo (`node node_modules/vitest/vitest.mjs run src/store/acompanhamento.test.js`).

## Mudança aplicada

Uma camada só, a de estado.

- `src/store/acompanhamento.js`: `formularioInicial(comando, valores, contexto)` e `ajusteDoTipoDeBaixa(comando, tipo)` passam a viver no domínio, junto da regra que recusa o vínculo.
- `src/pages/AcompanhamentoPage.jsx`: `abrir()` usa `formularioInicial`; o seletor "Tipo de baixa" aceita um ajuste no `onChange`, de modo que trocar para "Transferência própria" dentro do modal descarta operação e parcela na hora, em vez de guardar um vínculo invisível que seria recusado no fim.

O comportamento de "Nova baixa financeira" com entrada ou saída não muda: a operação em foco continua sendo pré-selecionada, e o campo continua visível.

## Decisão: MANTER

- `acompanhamento.test.js`: 3 falhas antes, 9 acertos depois.
- Funcional em Chromium descartável: **11 de 11 aprovados, sem erro de JavaScript** (`otimizacoes-funcional-final.txt`). Os dois cenários reprovados passaram; os nove anteriores continuam passando.
- Suíte completa: 73 arquivos e 1.064 testes aprovados, sem falha esperada (`otimizacoes-suite-final.txt`). Eram 1.061 antes dos três casos novos.
- Build de produção: aprovado em diretório temporário, sem tocar no pacote desktop existente (`otimizacoes-build-final.txt`).

## Checklist da implementação

- [x] Estado financeiro, contas, operações, parcelas e extratos — `src/store/acompanhamento.js`, `src/pages/AcompanhamentoPage.jsx`. Razão global do perfil, em centavos inteiros, fora dos snapshots fiscais.
- [x] Vínculos fiscais explícitos e não duplicação — `src/store/vinculosOperacoes.js`; `ganhosApuradosPeriodo` abate pelo vínculo da mesma operação e mantém o fallback agregado só para registros não vinculados.
- [x] Três visões, projeção e data financeira — abas Caixa e contas, Operações e parcelas, Conciliação, Fechamento e Patrimônio econômico; parcela prevista não entra no saldo registrado.
- [x] Pendências, documentos, checklist e fechamento/reabertura — `src/store/revisaoPeriodica.js`, `src/pages/RevisaoPeriodicaPage.jsx`; fechamento versionado com responsável, parecer e trava retroativa.
- [x] Prévia de migração e proveniência — `previaDatasLegadas` e a ação `MIGRAR_DATA_LEGADA`, que exige backup confirmado, responsável e prévia inalterada, e recusa destino importado ou vínculo ambíguo.
- [x] Backup e ensaio de restauração — `src/store/ensaioBackup.js`, com armazenamento em memória e releitura do conteúdo gravado; nunca sobre o perfil de trabalho.
- [x] Remoção do ajuste RV e impressão — `REMOVER_RENDA_VARIAVEL_MES_MANUAL` e `REMOVER_FII_MES_MANUAL`, botão no `RendaVariavelMesModal` com confirmação própria; regras de impressão para as tabelas novas em `index.css`.
- [x] Suíte completa, build e testes funcionais finais — evidências acima.

## Limites que continuam valendo

O caixa registrado depende dos extratos informados: ele não prova saldo bancário nem substitui a diferença de conciliação fiscal. Contratos e parcelas não são recebimentos. O ensaio de backup confirma integridade, senha e releitura, não o estado físico da mídia. A migração de data legada é individual e nunca automática. Nada foi executado sobre a base real do usuário, e o executável Windows empacotado não foi exercitado nesta rodada.

## Acabamento visto na tela, 06/09/2026

Os testes de estado e o funcional passavam, mas três defeitos só apareciam nas telas renderizadas. Capturas em Chromium descartável, perfil sintético.

1. **Carimbo de auditoria em ISO cru.** As colunas de data das tabelas de operações, documentos, fechamentos e pareceres mostravam `2026-09-06T14:29:26.130Z`. Passaram a usar `formatDateTime()`, novo em `src/utils/formatters.js`. Datas puras continuam por `formatDate`, porque `new Date('2026-03-15')` é meia-noite UTC e devolveria o dia anterior em fuso negativo — o teste de regressão cobre exatamente esse caso.
2. **Indicador do menu tapando um item.** `.sidebar-more` era uma pílula flutuante sobre a área rolável; o `padding-bottom` do `.sidebar-nav` só reserva espaço depois do último item, então "Renda Variável" ficava por baixo dela depois que as duas entradas novas alongaram a lista. Virou faixa de rodapé com desvanecimento.
3. **Rótulo colado no campo.** Em Revisão e pendências, "Mês de revisão" e "Responsável pela revisão" ficavam grudados no controle, porque a regra de `.form-group` só valia dentro do modal. Estendida para os formulários da própria página.

Verificação: suíte com 73 arquivos e 1.067 testes aprovados (`acabamento-suite.txt`), funcional com 11 de 11 e nenhum erro de JavaScript (`acabamento-funcional.txt`), build de produção limpo em diretório temporário (`acabamento-build.txt`).
