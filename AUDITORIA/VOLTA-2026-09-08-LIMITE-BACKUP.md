# Primeira execução — limite do backup automático

Data: 2026-09-08. Escopo: inspeção inicial e uma única correção na API desktop.

FALHA:
O método `salvar_backup_automatico` aceitava conteúdo acima do limite que
`selecionar_backup` permite abrir. Um backup automático podia ser criado com
sucesso, mas ser recusado pelo seletor nativo por tamanho. A retenção ainda podia
remover cópias anteriores ao salvar esse arquivo excedente.

TRAJETÓRIA:
`DataContext.jsx:304` → `salvarBackupAutomaticoDesktop` → API Python
`salvar_backup_automatico` → arquivo → `selecionar_backup`.
O teste reduz a constante da instância a 32 bytes, sem alterar o limite de produção,
e exercita 32 e 33 bytes, nomes existentes/novos e conteúdo ASCII/UTF-8.

IMPACTO:
Risco de produzir cópias que não podem ser abertas pelo seletor nativo e de gastar
a retenção com essas cópias. Ocorrência em dados reais: NÃO DETERMINADO.

CAMADA CAUSAL:
Validação de entrada da persistência de backups automáticos, na API Python.

CLASSIFICAÇÃO DAS EVIDÊNCIAS:
- PROVADO PELO CÓDIGO: `desktop_api.py:9` fixa 100 * 1024 * 1024 bytes;
  `selecionar_backup:50` recusa arquivos maiores. No HEAD original,
  `salvar_backup_automatico:144` não fazia essa validação.
- PROVADO PELO CÓDIGO: `src/store/backupAutomaticoDesktop.js` propaga erros da API;
  `src/store/DataContext.jsx:316` já apresenta toast de falha no backup automático.
  A apresentação real no PyWebView não foi executada nesta volta.
- PROVADO POR TESTE: os testes novos falham na implementação anterior e passam
  após a correção, mantendo conteúdo e constantes dos testes.
- INFERÊNCIA: backups maiores que o limite podem ocorrer em perfis volumosos.
  Não foi medido o tamanho dos perfis do usuário.

PREVISÃO REGISTRADA:
Antes da edição funcional: passar de cinco verificações sem a recusa esperada
para zero falhas; aceitar 32 bytes, recusar 33 bytes e preservar backups prévios.
Tolerância: zero byte acima do limite; zero alteração de arquivos na recusa.
Nenhuma promessa de desempenho ou de validação fiscal.

BASELINE CONGELADA:
- Raiz Git: `/home/automacaotec/PROJETOS/Planilha Eudúcio/controle-patrimonial-fonte`.
- Branch: `fix/auditoria-2026-08-24`.
- HEAD: `b9feb222a06dfa67129ead8b1c6c2611f86f69e7`.
- Estado inicial: nenhum arquivo rastreado modificado/preparado; não rastreados
  `AGENTS.md`, `COMANDO-FABLE.md`, `RELATORIO-FABLE.md`. Preservados.
- Instruções aplicadas: `AGENTS.md` da raiz e prompt anexado pelo usuário.
- Ambiente pareado: Ubuntu WSL, Linux 6.18.33.2-microsoft-standard-WSL2,
  Python 3.12.3, Node 24.18.0, npm 11.16.0.
- Node existente em `/home/automacaotec/.nvm/versions/node/v24.18.0/bin`.
  PATH usado: esse diretório seguido de `/usr/local/bin:/usr/bin:/bin`.
- `package.json`, `setup.iss`, `setup-simplificado.iss`: aplicação 1.2.0.
- `npm ls --depth=0`: React/React DOM 19.2.8, Vite 8.2.1, Vitest 4.1.10,
  PDF.js 6.2.108, Recharts 3.10.1, XLSX 0.20.3, plugin React 6.0.5,
  cross-env 10.1.0, Inter 5.2.8. Nenhuma dependência instalada/atualizada.
- Fixture: texto sintético construído em `test_desktop_api.py`, diretórios
  descartáveis `TemporaryDirectory`, limite de instância de 32 bytes.
- SHA-256 do arquivo de teste usado antes/depois:
  `4742733c920f6e73246208a421e8258ba11f1143ec48065257f9b29ee3d1342d`.
- Exercício fiscal, versão PGD, resolução e escala: não aplicáveis à correção.

FONTES FISCAIS:
Não aplicáveis; nenhuma regra fiscal foi implementada ou validada. Não houve
consulta externa nem leitura de declarações, planilha original ou manifesto real.

ARQUIVOS E FIXTURES UTILIZADOS:
Código técnico da API, inicialização, persistência e backups; manifestos e scripts
de build; três arquivos de teste JavaScript com dados construídos em memória;
testes Python com arquivos sintéticos temporários. O seletor usa janela falsa.

ALTERAÇÃO:
Antes de criar diretórios ou escrever, medir `len(conteudo.encode('utf-8'))` e
recusar valores acima de `MAX_BACKUP_BYTES`. Mesmo limite da leitura, inclusive
para caracteres multibyte. Nenhuma migração ou mudança no formato persistido.

ARQUIVOS MODIFICADOS:
- `desktop_api.py`: três linhas para validar tamanho antes de efeitos em disco.
- `test_desktop_api.py`: três testes, um deles com quatro subcasos.
- Este relatório e `AUDITORIA/evidencias-2026-09-08-backup/`: evidências novas.
- `dist/` foi regenerado pelo build, não editado como fonte; não é rastreado.

TESTES EXECUTADOS:
Comandos a partir da raiz Git, com o PATH WSL descrito acima:

```bash
python3 -m unittest test_desktop_api.py
python3 -m unittest -v test_desktop_api.py
npm test -- src/store/backupAutomaticoDesktop.test.js src/store/persistenciaDesktop.test.js src/store/bootstrapDesktop.test.js
npm run build
git diff --check
```

| Verificação | Executados | Aprovados | Falhos | Ignorados |
| --- | ---: | ---: | ---: | ---: |
| Python WSL original | 3 | 3 | 0 | 0 |
| Python WSL com novos testes, antes da correção | 6 métodos | 4 métodos | 2 métodos / 5 falhas de assertions | 0 |
| Python WSL depois | 6 | 6 | 0 | 0 |
| JavaScript antes | 10 | 10 | 0 | 0 |
| JavaScript depois | 10 | 10 | 0 | 0 |
| Python Windows original isolado | 3 | 2 | 1 | 0 |
| Python Windows depois | 6 | 5 | 1 | 0 |

Windows: Python 3.14.3, `python -m unittest -v test_desktop_api.py`.
O teste preexistente `test_seletor_backup_abre_em_downloads_do_usuario` falha
por comparar literalmente caminho 8.3 com caminho normalizado por `realpath`.
Reprodução independente: arquivos `desktop_api.py` e `test_desktop_api.py`
extraídos via `git show HEAD:<arquivo>` para pasta temporária e executados nela.
Saída: `Ran 3 tests ... FAILED (failures=1)`, mesma assertion de diretório.
Os três novos testes passaram no Windows. Não se declara a suíte Windows aprovada.

SAÍDA BRUTA ANTES:
Arquivo `evidencias-2026-09-08-backup/antes.txt`.
Trechos: `AssertionError: ValueError not raised`, `Ran 6 tests`,
`FAILED (failures=5)`. Baseline original: `Ran 3 tests in 2.135s`, `OK`.

SAÍDA BRUTA DEPOIS:
Arquivo `evidencias-2026-09-08-backup/depois.txt`: `Ran 6 tests in 5.671s`, `OK`.
JavaScript: `evidencias-2026-09-08-backup/javascript.txt`, 3 arquivos / 10 testes.
Os tempos são registros das execuções, não um benchmark comparável de desempenho.

VALIDAÇÃO VISUAL:
Não realizada. Nenhuma tela foi alterada. Testes da API usam diálogo simulado;
isso não prova integração visual PyWebView, WebView2, teclado, escala ou foco.

VALIDAÇÃO DE BUILD:
`npm run build` terminou com código 0; 683 módulos; gerou `dist/index.html` e
`dist/desktop.html`. Log em `evidencias-2026-09-08-backup/build.txt`.
Aviso `PLUGIN_TIMINGS` sobre tempo em plugins CSS/HTML; não é falha de compilação.
PyInstaller/Inno Setup/instalação/assinatura não executados. O script Windows
contém instalação/atualização incondicional via pip e não foi executado nesta volta.

REGRESSÕES:
Nenhuma identificada nos testes pareados selecionados. A falha Windows já existe
no HEAD original. Suíte fiscal completa e interface não foram validadas.

RISCOS REMANESCENTES:
O limite protege a gravação automática, mas não aumenta a capacidade de restaurar
arquivos grandes nem recupera backups antigos acima do limite. A medição UTF-8
aloca uma representação em bytes; consumo máximo de memória não foi medido.
Não foram testadas interrupção de energia, concorrência ou instalação real.

DECISÃO: MANTER.
Critério da volta atendido no ambiente pareado e nos novos testes Windows;
aprovação restrita à correção, com falha preexistente Windows explicitamente aberta.

COMMIT: não realizado, não autorizado. Branch e arquivos preexistentes preservados.

PRÓXIMA FALHA CANDIDATA:
Comparação de caminhos no teste do seletor Windows: caminho temporário abreviado
e caminho completo representam o mesmo diretório, mas a assertion literal falha.
Não corrigida nesta volta para preservar uma causa por ciclo.

## Inventário técnico inicial

| Grupo | Pontos localizados | Evidência/limite |
| --- | --- | --- |
| Entradas | `index.html`, `desktop.html`, `src/main.jsx`, `src/App.jsx`, `main.py` | PROVADO PELO ARQUIVO; Vite configura duas entradas |
| Importação | `src/pages/ImportPage.jsx`, `importParsers.js`, `src/irpf/` | Inventário; sem alegação de cobertura fiscal |
| Estado/cálculos | `src/store/reducer.js`, `migracoes.js`, `demonstrativos.js`, `continuidade.js` | Inventário; não auditados integralmente |
| Persistência | `desktop_api.py`, `persistenciaDesktop.js`, `bootstrapDesktop.js`, `backupAutomaticoDesktop.js` | Código lido e testes selecionados executados |
| Saídas | `src/utils/exportXlsx.js`, `relatorioCompleto.js` | Localizados, não validados nesta volta |
| Empacotamento | `ControlePatrimonial.spec`, `build-windows.ps1`, dois `.iss` | PROVADO PELO ARQUIVO; dist incluído no PyInstaller |
| Gerados | `dist/`, `build-app/`, `dist-app/`, `installer/`, `.build-venv/`, `node_modules/`, `__pycache__/` | Fora das edições de fonte |
| Auditorias | `AUDITORIA/`, `output/`, documentos de handoff | Evidências históricas não equivalem a aprovação atual |
| Dados reais | Material fiscal e manifesto na pasta pai | Conteúdo não lido nem usado nos testes |

Comandos declarados: `npm run dev`, `npm run preview`, `npm test`,
`npm run test:full` (ativa `IRPF_FIXTURES_REQUIRED=1`), `npm run build`,
`python main.py`, `powershell -ExecutionPolicy Bypass -File build-windows.ps1`.
Os dois últimos não foram executados.

Triagem dos testes: `importParsers.test.js` e `leitorRegistrosDbk.test.js` podem
abrir manifestos/declarações automaticamente; não foram executados.
Testes `dumpParsePdf.audit`, `dumpRowsPdfjs.audit` leem PDFs e gravam auditorias;
testes de resumo/modalidade/consolidação leem JSONs de auditorias.
Embora alguns sejam descritos como sintéticos, não foram incluídos sem conferir
as entradas. Os três testes JavaScript selecionados usam dados em memória.
Não houve `skip` nos testes executados; o restante da suíte foi deliberadamente
não executado, o que é diferente de afirmar que passou ou foi ignorado pelo runner.

## Matriz inicial de riscos

Prioridades abaixo são INFERÊNCIA de impacto potencial, não defeitos confirmados.

| Risco | Prioridade | Evidência atual e lacuna |
| --- | --- | --- |
| Corrupção/perda de perfil | Alta | PROVADO POR TESTE: salvar/carregar/excluir sintético; falha parcial e energia não determinados |
| Mistura de contribuintes | Alta | PROVADO PELO CÓDIGO: chaves por ID e filtro do índice; isolamento fiscal completo não determinado |
| DBK incorreto | Alta | Parser/leitor/layout localizados; posições/exercícios não validados nesta volta |
| PDF incorreto | Alta | Parser e fixtures localizados; extração/integralidade não determinadas |
| Interpretação fiscal | Alta | NÃO DETERMINADO; exige fontes oficiais por exercício |
| Duplicidade | Alta | Integração e reducer localizados; reprocessamento não testado nesta volta |
| Retificadora/continuidade | Alta | Módulos específicos localizados; preservação integral não determinada |
| Centavos/sinais/períodos | Alta | Testes especializados localizados; não executados nesta volta |
| Exportação XLSX | Alta | Exportador localizado; Excel, fórmulas e correspondência de totais não determinados |
| Privacidade | Alta | PROVADO PELO CÓDIGO: suíte genérica pode ler dados externos automaticamente; usada seleção sintética |
| Caminhos/backups | Alta | PROVADO POR TESTE: traversal simples, retenção e limite; symlinks/concorrência não cobertos integralmente |
| Usabilidade/acessibilidade | Média | NÃO DETERMINADO; sem renderização real nesta volta |
| Desempenho | Média | NÃO DETERMINADO; build isolado não é benchmark |
| Build/instalação | Alta | PROVADO POR TESTE: frontend compila; teste de caminho Windows falha; instaladores não validados |
