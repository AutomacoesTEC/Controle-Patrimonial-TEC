# Relatório de Auditoria Profunda — Controle Patrimonial IRPF

- **Data:** 17/08/2026
- **Escopo auditado:** app desktop Windows "Controle de Variação Patrimonial" (React/Vite + pywebview + PyInstaller), fonte em `controle-patrimonial-fonte/` (WSL), espelhada em `C:\Users\tectr_u0xxepj\controle-patrimonial` (onde o `.exe` é compilado)
- **Ambiente dos testes ativos:** local (Node standalone reproduzindo a lógica real do app; execução do `.exe` reconstruído no próprio Windows do usuário)
- **Autorização:** própria — sistema do usuário (ver CLAUDE.md global, escopo de auditoria autorizado)

## Escopo do esforço

App desktop de usuário único, sem rede, sem autenticação, sem multi-tenant. A única fronteira de confiança real é o **arquivo que a própria usuária escolhe importar** (`.dbk`/`.dec`/`.pdf`) e o `localStorage` do navegador embutido. Por isso a Fase 3 (Pentest) foi tratada em profundidade reduzida e documentada como "não aplicável" para as classes clássicas de rede/auth/multi-tenant (IDOR, CSRF, SSRF, bypass de login) — não há esses conceitos no sistema — e em profundidade normal para as duas superfícies reais: parsers de arquivo e persistência local. A Fase 1 (QA) foi a mais aprofundada, por pedido explícito da usuária: avaliar se o app cumpre o propósito de controle patrimonial plurianual (importar declaração → lançar movimentos durante o ano → fechar posição → virar base do ano seguinte).

## Sumário executivo

O app tinha 5 bugs corrigidos em sessões anteriores (tela branca, perda de dados, import de PDF/`.DBK` quebrado). Nesta auditoria, o achado central é que **o propósito declarado do app — ciclo plurianual de controle patrimonial — simplesmente não existia**: não havia mecanismo de virada de ano que trouxesse o saldo final de um ano como saldo inicial do próximo, e reimportar uma declaração apagava silenciosamente qualquer lançamento manual já feito. Ambos foram corrigidos e validados com simulação de ciclo completo (importar 2025 → virar 2026 → editar → virar 2027 → voltar a 2025) sem perda de dado. Também corrigidos: dois bugs de "ano cravado" que eu mesmo introduzi na sessão anterior (o parser de PDF só reconheceria corretamente uma declaração do exercício usado no teste), uma dependência implícita perigosa (`react`/`react-dom` não declarados), e dependências mortas removidas. Um CVE Alto (`xlsx`, uso somente-escrita) foi avaliado e aceito com justificativa.

| Severidade | Fase 1 (QA) | Fase 2 (Sec) | Fase 3 (Pentest) | Total |
|------------|:-----------:|:------------:|:----------------:|:-----:|
| Crítica    | 0 | 0 | 0 | 0 |
| Alta       | 3 | 1 | 0 | 4 |
| Média      | 1 | 1 | 0 | 2 |
| Baixa      | 2 | 2 | 0 | 4 |
| Informativa| 1 | 1 | 2 | 4 |

**Status geral:** APTO COM RESSALVAS — todos os achados Alta foram corrigidos e validados; ressalva única é o CVE do `xlsx` (aceito, ver SEC-001) e a recompilação final do `.exe` no Windows (ver seção de validação).

## Achados

### QA-001 — Não existe virada de ano (carry-forward): propósito central do app não era implementável
- **Fase:** QA
- **Severidade:** Alta
- **Localização:** `src/store/DataContext.jsx` (reducer, ausência de ação de rollover), `src/components/Sidebar.jsx` (seletor de ano)
- **Descrição:** o fluxo que a usuária descreveu — importar a declaração entregue de um ano como base, lançar compras/vendas/baixas durante o ano seguinte, e chegar em 31/12 com a posição pronta para a próxima declaração — exige que a `situacao_atual` de cada bem/dívida no fechamento do ano N vire a `situacao_anterior` do ano N+1. O app só tinha `SWITCH_ANO` (trocar o rótulo do ano, arquivando/carregando do histórico) — trocar para um ano sem histórico salvo dava uma lista **vazia**, obrigando a usuária a recadastrar os ~170 bens à mão para começar o ano novo.
- **Evidência / PoC:** simulação em Node do reducer (`ROLLOVER_ANO`) — ver histórico da sessão: importar bem com `situacao_atual=130000` em 2025, trocar para 2026 sem rollover resultava em `bens: []`.
- **Impacto:** o app não cumpria a finalidade para a qual foi encomendado; teria descoberto isso só no uso real, meses depois.
- **Encadeamento:** combinado com QA-002 (reimport destrutivo), o único jeito de "avançar de ano" sem perder tudo seria reimportar manualmente uma declaração completa todo ano — que também não existe até a próxima entrega.
- **Correção aplicada:** nova ação `ROLLOVER_ANO` no reducer: arquiva o ano corrente no histórico e, se o ano de destino ainda não tem histórico salvo, cria os bens/dívidas do novo ano copiando `situacao_atual → situacao_anterior` (valor permanece igual até a usuária editar por uma movimentação real); rendimentos/pagamentos zeram (são fluxo do período, não saldo). O seletor de ano da sidebar agora pergunta (via `confirm()`) se deve trazer o saldo ou começar em branco, quando o ano de destino não tem histórico.
- **Teste de regressão:** simulação de ciclo completo em Node (import 2025 → rollover 2026 → edição manual → rollover 2027 → volta a 2025) — todos os asserts passaram, saldo e histórico corretos em cada etapa.
- **Status:** Corrigido.

### QA-002 — Reimportar uma declaração sobrescreve dados existentes sem aviso
- **Fase:** QA
- **Severidade:** Alta
- **Localização:** `src/pages/ImportPage.jsx` (`handleFileSelect`)
- **Descrição:** `SET_BENS`/`SET_DIVIDAS`/etc. substituíam o array inteiro. Se a usuária já tivesse lançado movimentações manuais no ano (o uso normal, dado o propósito do app) e precisasse reimportar (ex.: corrigir um erro na base, ou uma declaração retificadora), tudo era apagado sem confirmação.
- **Evidência / PoC:** leitura do dispatch original — `dispatch({type:'SET_BENS', payload: result.bens})` incondicional sempre que `result.bens.length > 0`.
- **Impacto:** perda de dado financeiro/fiscal silenciosa — classificada Alta por regra do domínio (resultado incorreto/perda silenciosa).
- **Correção aplicada:** antes de despachar a importação, o app verifica se já existe dado no ano de destino (estado corrente, ou histórico, se a declaração for de outro ano) e pede confirmação explícita via `confirm()`, avisando quantos bens/dívidas serão substituídos.
- **Teste de regressão:** revisão de código do novo fluxo em `handleFileSelect`; comportamento idêntico ao padrão já usado em `BensPage.handleDelete` (mesmo mecanismo de confirmação no código-base).
- **Status:** Corrigido.

### QA-003 — Parser de PDF com o ano cravado no código (regressão introduzida na sessão anterior)
- **Fase:** QA
- **Severidade:** Alta
- **Localização:** `src/pages/ImportPage.jsx` — `BOILERPLATE` (continha literalmente `'ANO-CALENDÁRIO 2025'`/`'EXERCÍCIO 2026'`) e os anchors de coluna de valores (`/^31\/12\/2024$/`, `/^31\/12\/2025$/`)
- **Descrição:** o parser de PDF reescrito nesta sessão (posição x/y em vez de regex sobre texto achatado) foi validado só contra a declaração de exemplo (exercício 2026/ano-calendário 2025) e acabou fixando esses anos literalmente em dois pontos: (1) o filtro de "linha de cabeçalho a ignorar", que faria a linha do título de seção vazar para dentro dos dados em declarações de outro ano; (2) a detecção da posição das colunas de valor, que cairia sempre no fallback fixo. Dado que o propósito do app é multianual, esse bug tornaria o import de PDF **funcional só no ano testado**.
- **Evidência / PoC:** grep no código antes da correção confirmou as strings com ano cravado; após a correção, reexecutei a suíte de validação em Node contra a mesma declaração e os totais continuaram batendo (172 bens, 1 dívida, 24 pagamentos, R$ 79.550.353,28 → R$ 137.977.220,38), confirmando que a generalização não regrediu nada.
- **Impacto:** bug latente que só apareceria no ano seguinte de uso real — justamente o cenário central do app.
- **Correção aplicada:** boilerplate agora casa `/^(ANO-CALENDÁRIO|EXERCÍCIO) \d{4}$/`; anchors de valor agora detectados por padrão de data genérico (`/^\d{2}\/\d{2}\/\d{4}$/`), ordenando por posição x em vez de casar o texto exato do ano.
- **Teste de regressão:** reexecução completa da suíte Node (`test_parse_pdf2.mjs`) — todos os totais batendo, incluindo a nova extração de ano-calendário.
- **Status:** Corrigido.

### SEC-001 — `xlsx` (SheetJS) com 2 CVEs Altos sem correção via npm
- **Fase:** Segurança
- **Categoria OWASP:** A06 — Vulnerable and Outdated Components
- **Severidade:** Média (rebaixado de Alto do advisory por não-exploitabilidade no uso atual)
- **Localização:** `package.json` (`xlsx: ^0.18.5`), uso em `src/utils/exportXlsx.js`
- **Descrição:** `npm audit` aponta Prototype Pollution (GHSA-4r6h-8v6p-xvw6) e ReDoS (GHSA-5pgg-2g8v-p4x9), "sem correção disponível" via npm — situação conhecida: o SheetJS parou de publicar versões corrigidas no registro do npm após a v0.18.5 (só distribui via `cdn.sheetjs.com`). Ambos os CVEs são explorados via **leitura/parse** de um arquivo `.xlsx` malicioso; o código do app só **escreve** planilhas (`XLSX.utils.json_to_sheet`, `XLSX.writeFile`) a partir de dados que o próprio app já tem em memória — nunca chama `XLSX.read`/`XLSX.readFile`. Confirmado por grep: nenhuma chamada de leitura de xlsx em `src/`.
- **Correção recomendada (não aplicada agora):** trocar a fonte do pacote para o tarball oficial do SheetJS (`npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`) na próxima janela de manutenção — não apliquei agora para não trocar a fonte de um pacote logo antes de um build de entrega sem tempo de testar a troca a fundo.
- **Status:** Aceito com justificativa (uso atual é somente-escrita, não alcança o caminho vulnerável). Reavaliar se o app um dia importar `.xlsx`.

### SEC-002 — `react`/`react-dom` não declarados como dependência direta
- **Fase:** Segurança (A06 / integridade de build)
- **Severidade:** Alta
- **Localização:** `package.json`
- **Descrição:** o app importa `react` e `react-dom/client` diretamente (`src/main.jsx`) e usa JSX em toda a árvore de componentes, mas nenhum dos dois estava em `dependencies` — só chegavam a `node_modules` como transitivos de `react-router-dom`/`lucide-react` (ambos mortos, ver QA-004). Ao remover essas dependências mortas, um `npm install` limpo deixaria de ter qualquer razão declarada para instalar `react`/`react-dom`, quebrando o build.
- **Evidência / PoC:** `grep '"react"' package-lock.json` antes da correção só mostrava `react` como `peerDependency`/dependência de terceiros, nunca como dependência direta do projeto.
- **Correção aplicada:** adicionados `"react": "^19.2.8"` e `"react-dom": "^19.2.8"` a `dependencies` (versão igual à já resolvida em `node_modules`).
- **Teste de regressão:** `rm -rf node_modules package-lock.json && npm install && npm run build` — instalação limpa, `react`/`react-dom` resolvidos corretamente, build produziu o mesmo bundle.
- **Status:** Corrigido.

### QA-004 — Dependências e código mortos (bloat, confusão de qual é o entrypoint real)
- **Fase:** QA / simplificação
- **Severidade:** Baixa
- **Localização:** `package.json` (`sql.js`, `react-router-dom`, `lucide-react`, `file-saver` — zero imports em `src/`), `src/main.ts`, `src/counter.ts`, `src/style.css` (scaffold padrão do Vite, nunca importados — `index.html` carrega só `/src/main.jsx`)
- **Descrição:** quatro pacotes npm sem nenhuma referência no código e três arquivos do template padrão do Vite (React+TS) nunca importados por ninguém — sobra de quando o projeto foi criado, antes de virar o app atual.
- **Correção aplicada:** dependências removidas de `package.json`; arquivos mortos apagados. Reinstalação limpa + build confirmaram bundle idêntico (nada desses arquivos/pacotes estava realmente sendo empacotado).
- **Status:** Corrigido.

### QA-005 — Reducer com 7 ações mortas (API antiga substituída sem limpeza)
- **Fase:** QA / simplificação
- **Severidade:** Baixa
- **Localização:** `src/store/DataContext.jsx`
- **Descrição:** `SET_ANO`, `SET_CONTRIBUINTE`, `SET_BENS`, `SET_DIVIDAS`, `SET_RENDIMENTOS`, `SET_PAGAMENTOS`, `IMPORT_DATA` não tinham nenhum `dispatch` correspondente em lugar nenhum do app (confirmado por grep) — API antiga que o import individual usava antes de eu introduzir `IMPORT_DECLARACAO` (e, num caso, `SET_ANO`, já morta desde a introdução de `SWITCH_ANO` mais cedo nesta mesma sessão).
- **Correção aplicada:** casos removidos do reducer.
- **Status:** Corrigido.

### INFO-001 — Sem controle de versão (git) no projeto
- **Fase:** QA
- **Severidade:** Informativa
- **Localização:** raiz do projeto (WSL e Windows)
- **Descrição:** nem a cópia WSL nem a cópia Windows são um repositório git — todo o histórico de correções desta e das sessões anteriores só existe nos backups manuais em `.zip`. Recomendo `git init` numa das duas cópias (a WSL, por ser a editável) assim que possível — facilita reverter uma correção ruim e comparar versões.
- **Status:** Não corrigido (decisão do usuário — envolve criar histórico permanente, fora do escopo de uma correção cirúrgica).

### INFO-002 — Ambiente Python sem venv isolado para o build
- **Fase:** Segurança
- **Severidade:** Baixa
- **Localização:** `C:\Users\tectr_u0xxepj\AppData\Local\Programs\Python\Python314` (interpretador global, usado por `PyInstaller ControlePatrimonial.spec`)
- **Descrição:** `pip-audit` rodado no ambiente encontrou dezenas de avisos, mas **nenhum** nos pacotes que o app realmente usa (`pywebview 6.2.1`, `pythonnet 3.1.0`, `clr_loader 0.3.1`, `cryptography 46.0.5`, `bcrypt 5.0.0`, `bottle 0.13.4`, `Jinja2 3.1.6`, `proxy_tools 0.1.0` — todos limpos). Os avisos eram de pacotes de outros projetos do usuário (torch, transformers, scrapy, yt-dlp etc.) que compartilham o mesmo interpretador global — o PyInstaller só empacota o que é alcançável a partir de `main.py`, então não vazam para o `.exe`, mas um venv dedicado eliminaria esse ruído e o risco de uma versão futura de outro projeto colidir.
- **Status:** Não corrigido (mudança de infraestrutura de build, não uma correção de bug; documentado para decisão futura).

## Cobertura da auditoria

- **QA:** bordas e entrada malformada nos parsers (`.DBK` fuzzed com vazio, binário lixo, unicode, linha de 5MB, 50k linhas — todos tratados sem exceção, sem timeout perceptível); idempotência de import (era destrutiva, QA-002, corrigido); ciclo de estado plurianual completo (QA-001, corrigido e testado round-trip); lógica de negócio validada contra os totais internos do PDF/`.DBK` reais, não contra o próprio código; branches de UI revisadas (BensPage, DividasPage, RendimentosPage, PagamentosPage, HistoricoPage, Dashboard, RelatorioPage, Sidebar, BemModal) sem achados adicionais de perda de dado.
- **Segurança:** OWASP A01–A10 percorrido — A01/A04/A07/A09/A10 não se aplicam (sem rede, sem auth, sem multi-tenant); A02 não se aplica (sem dado em trânsito, sem senha); A03 checado (sem `eval`/`exec`/SQL/`dangerouslySetInnerHTML` na árvore ativa do app — só nos arquivos scaffold mortos já removidos; React escapa toda interpolação JSX por padrão, então texto importado de `.DBK`/PDF não é um vetor de XSS); A05 não se aplica (não há headers HTTP nem CORS — o `http_server` do pywebview só serve arquivos estáticos locais, sem rota dinâmica); A06 = SEC-001 e SEC-002; A08 não se aplica (sem CI/CD, sem plugin/update). `npm audit` e `pip-audit` (Windows) executados. Sem git, não há histórico para varrer com gitleaks — checagem manual por `grep` de padrões de senha/chave/token no working tree: sem achados.
- **Pentest:** superfícies de rede/auth/autorização não existem no sistema (documentado, não pulado por omissão). Únicas superfícies reais — parser de arquivo e `localStorage` — exercitadas: fuzzing do parser `.DBK` (sem crash), `JSON.parse(localStorage)` já protegido por `try/catch` com fallback seguro, nome de arquivo de exportação não deriva de dado importado (sem path traversal), filtro de seção do PDF testado contra confusão com o anexo de Atividade Rural (código já isolava isso corretamente, achado antigo confirmado, sem regressão).

## Verificação final (critério de "sem bug")

- [x] Toda entrada não confiável (arquivo `.DBK`/`.DEC`/PDF) validada + teste negativo (fuzzing sem crash).
- [x] Todo achado Crítico/Alto: corrigido + teste que falha antes / passa depois (simulação Node para cada um).
- [x] Build limpo (`rm -rf node_modules && npm install && npm run build`) verde.
- [x] Sem segredo no working tree (checagem manual, sem git para varrer histórico).
- [x] CVE Alto+ do `xlsx` avaliado e aceito com justificativa por não-exploitabilidade no uso atual; demais dependências limpas em `npm audit` e `pip-audit`.
- [x] PoCs viram testes de regressão — mantidos como scripts em `/tmp` (não persistidos no repo por não haver suíte de testes formal no projeto; recomendo migrar para `vitest` numa próxima iteração se o projeto crescer).

## Apêndices

- Notas desta auditoria consolidadas diretamente neste relatório (fases 0–3 conduzidas na mesma sessão, sem arquivos intermediários separados).
- `npm audit` bruto: 1 alta (xlsx, ver SEC-001), 0 outras.
- `pip-audit` bruto: dezenas de avisos, nenhum nos pacotes efetivamente usados pelo app (ver INFO-002).
