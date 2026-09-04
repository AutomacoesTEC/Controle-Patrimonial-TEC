# Rodada 24 — parser fiscal sob demanda na tela de perfis

## 1. Falha nomeada

Abrir a tela de seleção de perfis baixa no chunk inicial o parser de declaração
e as tabelas de layout do `.DBK`, embora nenhum arquivo tenha sido escolhido.
No commit-base, `vite build` produz um `index` de 837,79 kB.

Trajetória: construir o app com manifesto e medir o arquivo de entrada e seu
fechamento de imports estáticos antes de abrir qualquer perfil ou importador.

## 2. Previsão escrita antes da mudança

- O arquivo de entrada cairá de aproximadamente 838 kB para menos de 400 kB.
- Parser e validador estrutural passarão a ser requisitados somente depois de
  a pessoa escolher `.DBK`, `.DEC`, `.F2B` ou PDF.
- Os mesmos testes de parser continuarão passando; não muda regra de leitura.

## 3. Tarefa congelada

- Fixture: `verificar-bundle.mjs` sobre `dist/.vite/manifest.json`
- Comando: `npm run build -- --manifest`, seguido do fixture
- Seeds: não aplicável; grafo de módulos determinístico
- Modelo: Codex baseado em GPT-5; identificador exato não exposto
- Commit-base: `263db8b`
- Saídas brutas: `antes.txt` e `depois.txt`

## 4. Camada causal

Somente contexto entregue ao navegador: trocar imports estáticos por imports
sob demanda no handler de arquivo da tela inicial. Parser, regras fiscais,
estado persistido e interface permanecem iguais.

## 5. Decisão

**MANTER.** O arquivo de entrada caiu de 837.798 para 235.097 bytes (redução
de 71,9%) e o fechamento estático caiu de 929.050 para 326.349 bytes. Os dois
ficaram abaixo dos 400 kB previstos. A prova do navegador confirmou que parser
e layout estão ausentes na abertura e chegam somente depois da escolha de um
arquivo. Evidência bruta: `antes.txt` e `depois.txt`.

## 6. Verificação

- Mesmo fixture de manifesto: entrada 235.097 bytes; fechamento 326.349 bytes.
- Navegador: tela inicial abriu sem os chunks; `.DEC` inválido continuou
  recusado e o PDF canônico chegou à revisão.
- `npm test`: 41 arquivos e 885 testes aprovados.
- `npm run build -- --manifest`: aprovado, 658 módulos transformados.
