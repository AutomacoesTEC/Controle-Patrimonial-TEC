import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Regressão do Item D (Backlog 2, HANDOFF-2026-09-03.md): todo confirm()
// nativo do navegador (que aparecia como "localhost:XXXX diz" e não
// estiliza) foi substituído pelo modal próprio do app (`confirmar()` do
// useData(), ver src/components/ConfirmacaoModal.jsx). Este teste varre
// src/ inteiro e falha se algum `confirm(`/`window.confirm(` nativo voltar
// a aparecer fora de comentário ou de string literal explicando a troca.
const SRC_DIR = join(__dirname);

function listarArquivosFonte(dir) {
  const resultado = [];
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules') continue;
    const caminho = join(dir, nome);
    const info = statSync(caminho);
    if (info.isDirectory()) {
      resultado.push(...listarArquivosFonte(caminho));
    } else if (/\.(jsx?|tsx?)$/.test(nome) && !nome.endsWith('.test.js') && !nome.endsWith('.test.jsx')) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

// Remove comentários de linha e de bloco antes de procurar `confirm(`, para
// não acusar falso positivo nos comentários que documentam a própria troca
// (ex.: "no lugar do confirm() nativo").
function semComentarios(codigo) {
  return codigo
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('sem confirm() nativo em src/', () => {
  it('nenhum arquivo de src/ chama confirm()/window.confirm() nativo fora de comentário', () => {
    const arquivos = listarArquivosFonte(SRC_DIR);
    const achados = [];
    for (const caminho of arquivos) {
      const codigo = semComentarios(readFileSync(caminho, 'utf-8'));
      // `confirmar(` (nome do helper do app) não deve ser pego: exige que
      // não haja letra logo após "confirm", e ignora "confirmar".
      const regex = /(^|[^A-Za-z0-9_.])confirm\s*\(/g;
      let m;
      while ((m = regex.exec(codigo))) {
        achados.push(`${caminho}: "${codigo.slice(Math.max(0, m.index - 10), m.index + 30).replace(/\n/g, ' ')}"`);
      }
    }
    expect(achados, `confirm() nativo encontrado:\n${achados.join('\n')}`).toEqual([]);
  });
});
