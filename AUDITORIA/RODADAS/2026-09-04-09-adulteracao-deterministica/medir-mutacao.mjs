import { readFileSync } from 'node:fs';

const caminho = new URL('../../../src/store/backupPerfil.test.js', import.meta.url);
const fonte = readFileSync(caminho, 'utf8');
const linha = fonte.split('\n').find(l =>
  l.includes('adulterado.conteudo.ciphertext =')
);

if (!linha) throw new Error('atribuição de adulteração não encontrada');

const expressao = linha.match(/ciphertext\s*=\s*(.+);\s*$/)?.[1];
if (!expressao) throw new Error('expressão de adulteração não reconhecida');

const aplicar = new Function('adulterado', `return ${expressao}`);
const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const casos = [...alfabeto].map(prefixo => {
  const original = `${prefixo}resto-do-ciphertext`;
  const adulterado = { conteudo: { ciphertext: original } };
  const resultado = aplicar(adulterado);
  return { prefixo, mudou: resultado !== original };
});

console.log(JSON.stringify({
  expressao,
  total: casos.length,
  alterados: casos.filter(c => c.mudou).length,
  inalterados: casos.filter(c => !c.mudou).map(c => c.prefixo),
  casos,
}));
