// Gera os dois fixtures de perfil usados por migracoes.test.js. Rodar da
// raiz do projeto:
//
//   node src/store/__fixtures__/gerar-fixtures-perfil.mjs
//
// O estado NÃO é escrito à mão: sai da importação real do PDF sintético
// AJU-01 (a mesma extração já congelada em AUDITORIA/saida-parsepdf/
// AJU-01.json, usada pelo teste de pipeline), passada pelo reducer de
// verdade. Depois a virada de ano e a volta ao ano importado montam um
// perfil com histórico de dois anos, que é onde a migração de arquivo antigo
// realmente importa (ver migracoes.js).
//
// perfil-aju01-atual.json  estado no formato de hoje (versaoEsquema 3).
// perfil-aju01-v1.json     o MESMO estado como uma versão antiga do app o
//                          teria gravado: sem marca de versão e sem as
//                          chaves cujo valor é o vazio do formato — que é
//                          exatamente o que um app que ainda não conhecia
//                          aquele campo deixaria de gravar. Só chave vazia
//                          sai; nenhum dado da declaração é removido, senão
//                          o fixture provaria outra coisa que não a
//                          migração.
//
// Regerar só de propósito: o par de arquivos é a prova de regressão da
// carga de perfil antigo, e trocá-lo por acidente esvazia o teste.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerHooks } from 'node:module';

// O código do app é escrito para o Vite, que resolve import relativo sem
// extensão (`./demonstrativos`); o Node puro não. Como este script roda fora
// do Vite e fora do Vitest, o gancho abaixo repete essa resolução em vez de
// obrigar o projeto inteiro a mudar de estilo de import.
registerHooks({
  resolve(especificador, contexto, proximo) {
    try {
      return proximo(especificador, contexto);
    } catch (erro) {
      if (!especificador.startsWith('.')) throw erro;
      for (const extensao of ['.js', '.jsx']) {
        try { return proximo(especificador + extensao, contexto); } catch { /* tenta a próxima */ }
      }
      throw erro;
    }
  },
});

const { initialState, reducer } = await import('../reducer.js');
const { CAMPOS_DO_SNAPSHOT_V3 } = await import('../migracoes.js');
const { payloadImportacaoCompleto } = await import('../../utils/importacaoDeclaracao.js');

const aqui = (rel) => fileURLToPath(new URL(rel, import.meta.url));

const prova = JSON.parse(readFileSync(aqui('../../../AUDITORIA/saida-parsepdf/AJU-01.json'), 'utf8'));
if (prova.erro) throw new Error(`Extração de referência com erro: ${prova.erro}`);
const resultado = prova.resultado;
const anoDeclarado = Number(resultado.anoCalendario);

let estado = reducer({ ...initialState }, {
  type: 'IMPORT_DECLARACAO',
  payload: payloadImportacaoCompleto(resultado),
});
// Vira o ano (arquiva o ano importado) e volta para ele: o perfil fica com
// os dois anos no histórico e exibindo o ano da declaração.
estado = reducer(estado, { type: 'ROLLOVER_ANO', payload: anoDeclarado + 1 });
estado = reducer(estado, { type: 'LOAD_HISTORICO', payload: anoDeclarado });

const { toasts: _toasts, ...atual } = estado;

// Um valor "vazio" é o que o formato de hoje usaria como padrão daquele campo:
// null, lista/objeto vazio, 0 ou (desde a versão 3) o booleano false.
const ehVazio = (valor) => valor === null
  || valor === false
  || (Array.isArray(valor) && valor.length === 0)
  || (valor !== null && typeof valor === 'object' && Object.keys(valor).length === 0)
  || valor === 0;

function comoVersao1(objeto) {
  const { versaoEsquema: _v, ...resto } = objeto;
  const removidos = [];
  for (const campo of CAMPOS_DO_SNAPSHOT_V3) {
    if (campo in resto && ehVazio(resto[campo])) {
      delete resto[campo];
      removidos.push(campo);
    }
  }
  return { objeto: resto, removidos };
}

const raiz = comoVersao1(atual);
const antigo = raiz.objeto;
const relatorio = { raiz: raiz.removidos, historico: {} };
if (antigo.historico) {
  const historico = {};
  for (const [ano, snapshot] of Object.entries(antigo.historico)) {
    const r = comoVersao1(snapshot);
    historico[ano] = r.objeto;
    relatorio.historico[ano] = r.removidos;
  }
  antigo.historico = historico;
}

writeFileSync(aqui('./perfil-aju01-atual.json'), `${JSON.stringify(atual, null, 2)}\n`);
writeFileSync(aqui('./perfil-aju01-v1.json'), `${JSON.stringify(antigo, null, 2)}\n`);

console.log('ano da declaração:', anoDeclarado);
console.log('anos no histórico:', Object.keys(atual.historico).join(', '));
console.log('campos removidos na raiz:', relatorio.raiz.join(', '));
for (const [ano, campos] of Object.entries(relatorio.historico)) {
  console.log(`campos removidos em ${ano}:`, campos.join(', '));
}
