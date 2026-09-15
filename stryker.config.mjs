/**
 * Escopo deliberado: só a lógica pura de cálculo/regra fiscal (store/irpf/
 * utils), não o app inteiro. Mutar JSX de página tem custo alto (cada
 * mutante reroda testes de integração pesados) e retorno baixo (a maior
 * parte da tela é composição visual, não regra testável por mutação).
 * Rotina periódica (custo real, ver relatório da sessão), não gate de commit.
 */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  reporters: ['html', 'clear-text', 'progress'],
  coverageAnalysis: 'perTest',
  mutate: [
    'src/store/**/*.js',
    'src/irpf/**/*.js',
    'src/utils/**/*.js',
    '!src/**/__fixtures__/**',
    '!src/**/*.test.js',
    '!src/**/*.audit.test.js',
  ],
  ignoreStatic: true,
};
