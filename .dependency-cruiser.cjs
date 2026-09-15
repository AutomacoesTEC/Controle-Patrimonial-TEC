/**
 * Contrato de arquitetura do app (React/Vite). As regras abaixo codificam
 * invariantes que o código já segue hoje (conferidas antes de escrever este
 * arquivo, não inventadas): src/store e src/irpf são lógica pura, sem React,
 * exceto o único ponto de integração (DataContext.jsx); páginas não se
 * importam entre si; components não sobem para pages.
 */
module.exports = {
  forbidden: [
    {
      name: 'store-sem-react',
      comment:
        'src/store é o reducer e os cálculos puros (rollover, demonstrativos, conciliação). ' +
        'DataContext.jsx é a única ponte com React de propósito; o resto tem que continuar ' +
        'testável com vitest puro, sem montar componente.',
      severity: 'error',
      from: { path: '^src/store', pathNot: '^src/store/DataContext\\.jsx$' },
      to: { path: '^(react|react-dom)$', dependencyTypes: ['npm', 'npm-no-pkg'] },
    },
    {
      name: 'irpf-sem-react',
      comment: 'src/irpf é extração/parsing de declaração (PDF/DBK), domínio puro.',
      severity: 'error',
      from: { path: '^src/irpf' },
      to: { path: '^(react|react-dom)$', dependencyTypes: ['npm', 'npm-no-pkg'] },
    },
    {
      name: 'paginas-nao-se-importam',
      comment:
        'Cada página em src/pages é independente (composição acontece em App.jsx). ' +
        'Se duas páginas precisam do mesmo trecho, ele sai para components/ ou store/.',
      severity: 'error',
      from: { path: '^src/pages/(?!__fixtures__)([^/]+)\\.jsx$' },
      to: { path: '^src/pages/(?!__fixtures__)([^/]+)\\.jsx$', pathNot: '^src/pages/\\1\\.jsx$' },
    },
    {
      name: 'components-nao-importam-pages',
      comment: 'Direção errada: um component é peça mais baixa, não pode depender de uma tela.',
      severity: 'error',
      from: { path: '^src/components' },
      to: { path: '^src/pages' },
    },
    {
      name: 'sem-dependencia-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'sem-orfao',
      comment:
        'Arquivo que nada importa. Exclui entrypoints do Vite, fixtures de teste e o próprio ' +
        'arquivo de teste ao lado do que ele cobre (padrão *.test.js do projeto).',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '\\.(test|spec)\\.jsx?$',
          '^src/main\\.jsx$',
          '^src/App\\.jsx$',
          '__fixtures__/',
          '^src/setupTests\\.js$',
        ],
      },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require', 'node', 'default'] },
    reporterOptions: {
      dot: { collapsePattern: '^(src/pages|src/components|src/store|src/irpf|src/utils)/[^/]+' },
    },
  },
};
