# Acompanhamento patrimonial e de caixa por data

Pedido: importar saldos de 2025, trabalhar em 2026 e continuar anualmente.
Base congelada: `9e77273`; modelo da sessão Codex (identificador exato não
exposto); fixtures sintéticos, datas e valores explícitos, sem aleatoriedade.
Dados reais do navegador da usuária não serão usados como fixture de escrita.

## Rodada 1: estado entre anos

Falha observada: MovimentacaoBemForm confirma data de outro ano, mas despacha
REGISTRAR_MOVIMENTACAO_* no estado ativo. ADD_EM_ANO cria destino com blankYear,
sem saldos dos bens/dívidas. Edições de fluxos não mudam o registro de ano.
Previsão anterior à mudança: os casos de regressão em fluxoAnual.test.js passam
de falha a 100% de acerto; 2025 permanece intacto, 2026 recebe o evento uma vez,
carrega os saldos finais anteriores e mantém os dados após ida/volta e JSON.
Camada: estado. Evidências brutas: rodada-1-antes.txt e rodada-1-depois.txt.

Decisão: **MANTER**. Mesmo fixture: 6 falhas antes, 6 acertos depois. Com
regressões do reducer e trilha: 131/131. Comando: `node
node_modules/vitest/vitest.mjs run src/store/fluxoAnual.test.js
src/store/reducer.test.js src/store/reducer.historicoCobertura.test.js`.
O roteamento por data é usado pelo formulário de movimentações; a próxima
rodada conecta a mesma infraestrutura às edições das fichas de fluxos.

## Sequência autorizada

2. Formulários por data: retirar seleção de ano dos cadastros, manter RV mensal;
   pedir data nos novos registros, preservar datas de aquisição históricas.
3. Titularidade: identificação de dependente, tabelas e filtro do Demonstrativo.
4. Tabelas: redimensionamento universal, apenas ações fixas nos pagamentos,
   sem opção compacta, sem rolagem vertical em abas horizontais.
5. Campos de rendimentos conforme ficha e pesquisa oficial.
6. Auditor independente após implementação: inventário por ficha, testes de
   funções, correções de defeitos comprovados fora do cálculo do Demonstrativo.
7. Relatório específico do Demonstrativo antes de corrigir suas fórmulas;
   relatório de otimizações para acompanhamento periódico.

Cada rodada registra previsão antes da implementação, comando, saída bruta e
decisão MANTER/REVERTER no respectivo commit. Verificação no navegador isolado,
suíte completa e build ao final. Sem atribuir validação tributária a testes
que somente reproduzem a implementação.
