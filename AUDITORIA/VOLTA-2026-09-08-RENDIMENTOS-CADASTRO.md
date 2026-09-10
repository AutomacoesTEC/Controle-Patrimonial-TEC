# Rendimentos e cadastro — 2026-09-08

FALHA: titularidade pouco visível em Rendimentos e dados cadastrais comprimidos
em tabela com textos longos invadindo o espaço dos rótulos vizinhos.

TRAJETÓRIA: abrir Rendimentos; abrir Titular e Dependentes com e-mail e ocupação
longos. Capturas antes/depois com fixture sintética em contexto Chromium isolado.

IMPACTO: dificuldade de identificar a pessoa do rendimento e de ler o cadastro.

CAMADA CAUSAL: apresentação. Duas alterações solicitadas explicitamente nesta
interação; não houve mudança de parser, cálculo, gravação ou exportação.

CLASSIFICAÇÃO DAS EVIDÊNCIAS: PROVADO PELO CÓDIGO: Rendimentos tinha Beneficiário
na quinta coluna e três colunas fixas à direita; cadastro usava tabela de quatro
colunas com colspans. PROVADO POR TESTE: fixture sintética renderizada, 15 campos
preservados, primeira coluna com Titular/Dependente, ausência de overflow nos
valores do cadastro em oito combinações de tema/largura.

PREVISÃO REGISTRADA: titularidade na primeira coluna; rótulo acima do valor no
cadastro; quebra de textos longos; nome, CPF e data alinhados. Critério: preservar
15 campos, zero overflow horizontal nos valores de leitura e titularidade visível.

BASELINE CONGELADA: branch `fix/auditoria-2026-08-24`, HEAD
`b9feb222a06dfa67129ead8b1c6c2611f86f69e7`. Alterações anteriores em API, testes
Python e BensPage, relatórios e evidências preservadas, assim como os arquivos
não rastreados AGENTS.md, COMANDO-FABLE.md e RELATORIO-FABLE.md.
React 19.2.8, Vite 8.2.1, Vitest 4.1.10, Node WSL 24.18.0.
Baseline visual 1513x912, tema claro, Chromium headless no Windows.

FONTES FISCAIS: não aplicáveis. Nenhuma interpretação fiscal nova.

ARQUIVOS E FIXTURES UTILIZADOS: RendimentosPage.jsx, TitularPage.jsx, index.css,
TabelaRedimensionavel.jsx, titularidade.js, formatters.js e dados sintéticos
registrados em `evidencias-2026-09-08-rendimentos-cadastro/verificacao.json`.
Sem leitura de documentos reais ou armazenamento do navegador do usuário.

ALTERAÇÃO: primeira coluna Titularidade com o mesmo resolvedor utilizado em Bens;
apenas Ações permanece fixa à direita, evitando que o bloco de valores cubra
outras colunas. Cadastro usa lista de descrição semântica `dl/dt/dd`, duas colunas
responsivas, linhas amplas para endereço/ocupação e quebra de palavras longas.
Formulário do titular em grade com associações explícitas label/input.

ARQUIVOS MODIFICADOS: src/pages/RendimentosPage.jsx, src/pages/TitularPage.jsx,
src/index.css; adicionados este relatório e evidências. dist regenerado pelo build.

TESTES EXECUTADOS:
- `npm test -- src/store/titularidade.test.js`: 5 executados, 5 aprovados,
  0 falhos, 0 ignorados; dados sintéticos; Ubuntu WSL.
- Browser: 15 campos e zero overflow em 1513, 1100, 900 e 700 px de largura,
  altura 912 px, nos temas claro/escuro; foco por Tab Nome → CPF → Data;
  primeira coluna Titularidade com identificação das duas pessoas da fixture.

SAÍDA BRUTA ANTES: screenshots `rendimentos-antes.png`, `cadastro-antes.png`.
SAÍDA BRUTA DEPOIS: `verificacao.json` e screenshots por tema/largura.
Vitest: `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

VALIDAÇÃO VISUAL: capturas reais e inspeção de cadastro claro 1513px e escuro
900px, além de Rendimentos. O quadro importado conserva todos os campos.
Não foram validados WebView2 nativo, escala do Windows 125%/150%, todos os estados
de formulário nem contraste por instrumento. Reduzir viewport não equivale a
validar DPI nativo. Nenhuma alegação de aprovação integral de acessibilidade.

VALIDAÇÃO DE BUILD: `npm run build`, código 0, 683 módulos, entradas web/desktop
geradas. Aviso informativo PLUGIN_TIMINGS. `git diff --check` sem erros.

REGRESSÕES: nenhuma identificada nas verificações realizadas.

RISCOS REMANESCENTES: a tabela de rendimentos continua usando rolagem horizontal
quando necessário. O resolvedor mostra Não informada quando não há titularidade,
sem assumir que o rendimento pertence ao titular. Instalador não recompilado.

DECISÃO: MANTER, dentro das condições verificadas.
COMMIT: não realizado, não autorizado.
PRÓXIMA FALHA CANDIDATA: nenhuma nova investigação iniciada nesta volta.
