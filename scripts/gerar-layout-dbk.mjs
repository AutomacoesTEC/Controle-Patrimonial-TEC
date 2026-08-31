import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [arquivoEntrada = 'LAYOUT-DBK-OFICIAL.md', arquivoSaida = 'src/irpf/layoutDbk2026.js'] = process.argv.slice(2);
const texto = await readFile(resolve(arquivoEntrada), 'utf8');
const linhas = texto.split(/\r?\n/);
const registros = [];
let atual = null;

for (const linha of linhas) {
  const titulo = linha.match(/^## Registro `([^`]+)`.+?(\d+) campos, largura (\d+)$/);
  if (titulo) {
    atual = {
      tipo: titulo[1],
      quantidadeCamposDeclarada: Number(titulo[2]),
      larguraDeclarada: Number(titulo[3]),
      campos: [],
    };
    registros.push(atual);
    continue;
  }

  if (!atual || !linha.startsWith('|') || /^\|\s*(?:pos|---)/.test(linha)) continue;
  const colunas = linha.split('|').slice(1, -1).map((parte) => parte.trim());
  if (colunas.length < 5 || !/^\d+$/.test(colunas[0]) || !/^\d+$/.test(colunas[1])) continue;
  atual.campos.push({
    posicao: Number(colunas[0]),
    tamanho: Number(colunas[1]),
    formato: colunas[2],
    nome: colunas[3],
    descricao: colunas.slice(4).join(' | '),
  });
}

const erros = [];
for (const registro of registros) {
  const larguraCalculada = registro.campos.reduce(
    (maior, campo) => Math.max(maior, campo.posicao + campo.tamanho - 1),
    0,
  );
  if (registro.campos.length !== registro.quantidadeCamposDeclarada) {
    erros.push(`${registro.tipo}: ${registro.campos.length} campos extraídos, esperado ${registro.quantidadeCamposDeclarada}`);
  }
  if (larguraCalculada !== registro.larguraDeclarada) {
    erros.push(`${registro.tipo}: largura calculada ${larguraCalculada}, esperada ${registro.larguraDeclarada}`);
  }
}

if (registros.length !== 94) erros.push(`${registros.length} registros extraídos, esperado 94`);
if (erros.length) throw new Error(`Layout inconsistente:\n${erros.join('\n')}`);

await writeFile(
  resolve(arquivoSaida),
  `// Gerado por scripts/gerar-layout-dbk.mjs. Não editar manualmente.\nexport default ${JSON.stringify({ versao: 'IRPF2026', registros }, null, 2)};\n`,
  'utf8',
);
console.log(`Layout gerado: ${registros.length} registros em ${resolve(arquivoSaida)}`);
