import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const raiz = resolve(import.meta.dirname, '../../..');
const dist = resolve(raiz, 'dist');
const manifesto = JSON.parse(readFileSync(resolve(dist, '.vite/manifest.json'), 'utf8'));
const entrada = Object.values(manifesto).find(item => item.isEntry);
if (!entrada) throw new Error('Manifesto sem entrada principal');

const porChave = new Map(Object.entries(manifesto));
const arquivos = new Set();
function visitar(chave) {
  const item = porChave.get(chave);
  if (!item || arquivos.has(item.file)) return;
  arquivos.add(item.file);
  for (const importado of item.imports || []) visitar(importado);
}
const chaveEntrada = Object.entries(manifesto).find(([, item]) => item === entrada)[0];
visitar(chaveEntrada);

const bytes = arquivo => statSync(resolve(dist, arquivo)).size;
console.log(JSON.stringify({
  entrada: entrada.file,
  entradaBytes: bytes(entrada.file),
  fechamentoEstatico: [...arquivos],
  fechamentoEstaticoBytes: [...arquivos].reduce((total, arquivo) => total + bytes(arquivo), 0),
  importsDinamicosDaEntrada: entrada.dynamicImports || [],
}, null, 2));
