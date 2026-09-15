/**
 * Não usa @commitlint/config-conventional: o histórico deste repositório é
 * descritivo em português ("Acessibilidade em componentes de formulário...",
 * "P09/P10: teste DOM ponta a ponta com jsdom"), não "feat:"/"fix:" em
 * inglês. O parser abaixo trata a linha inteira do cabeçalho como "subject"
 * (sem exigir type/scope) para bater com esse estilo; as regras garantem
 * mensagem presente e substancial sem impor um formato que ninguém usa aqui.
 */
module.exports = {
  parserPreset: {
    parserOpts: {
      headerPattern: /^(.*)$/,
      headerCorrespondence: ['subject'],
    },
  },
  rules: {
    'header-max-length': [2, 'always', 100],
    'header-trim': [2, 'always'],
    'subject-empty': [2, 'never'],
    'subject-min-length': [2, 'always', 10],
    'subject-full-stop': [2, 'never', '.'],
    'body-leading-blank': [2, 'always'],
  },
};
