// Contratos do empacotamento Windows, que hoje só existem por convenção
// espalhada em quatro arquivos: package.json, vite.config.js, main.py,
// ControlePatrimonial.spec e setup.iss.
//
// Nenhum deles se conhece, e cada um assume algo dos outros. Quando um muda
// sozinho, o build não falha: ele gera um instalador ERRADO, que é pior. Os
// casos concretos que estes testes travam:
//
// - a versão do instalador ficar diferente da versão do pacote, e sair um
//   "1.2.0" com o código de outra versão;
// - alguém trocar o outDir do Vite e o PyInstaller continuar empacotando uma
//   pasta dist/ velha, gerando um .exe com a interface anterior;
// - o instalador deixar de copiar o que o PyInstaller produziu.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('./', import.meta.url));
const ler = (nome) => readFileSync(`${RAIZ}${nome}`, 'utf8');

const pacote = JSON.parse(ler('package.json'));
const setup = ler('setup.iss');
const spec = ler('ControlePatrimonial.spec');
const mainPy = ler('main.py');
const viteConfig = ler('vite.config.js');

describe('empacotamento Windows: os contratos entre os arquivos', () => {
  it('a versão do instalador é a mesma do pacote', () => {
    const noSetup = /#define AppVersion "([^"]+)"/.exec(setup)?.[1];
    expect(noSetup).toBe(pacote.version);
  });

  it('o instalador distribui o executável que o PyInstaller produz', () => {
    const nomeNoSpec = /name='([^']+)',\s*\n\s*icon=/.exec(spec)?.[1]
      || /name='([^']+)'/.exec(spec)?.[1];
    const exeNoSetup = /#define AppExe "([^"]+)"/.exec(setup)?.[1];
    expect(exeNoSetup).toBe(`${nomeNoSpec}.exe`);
    // E copia da pasta que o PyInstaller escreve (COLLECT com o mesmo nome).
    expect(setup).toContain(`dist-app\\${nomeNoSpec}\\*`);
  });

  it('o PyInstaller empacota a pasta que o Vite gera, e é dela que o app carrega', () => {
    // Sem outDir explícito, o Vite escreve em dist/. Se algum dia isso mudar,
    // este teste é o que denuncia: o spec e o main.py continuariam apontando
    // para dist/ e o .exe sairia com a interface velha.
    const outDirExplicito = /outDir:\s*['"]([^'"]+)['"]/.exec(viteConfig)?.[1];
    const pastaDoVite = outDirExplicito || 'dist';
    expect(pastaDoVite).toBe('dist');
    expect(spec).toContain(`datas=[('${pastaDoVite}', '${pastaDoVite}')]`);
    expect(mainPy).toContain(`'${pastaDoVite}', 'index.html'`);
  });

  it('o app abre sem console e com o ícone da marca', () => {
    expect(spec).toContain('console=False');
    expect(spec).toContain("icon='assets/cp-tec.ico'");
    expect(setup).toContain('SetupIconFile=assets\\cp-tec.ico');
  });

  it('o instalador não pede privilégio de administrador', () => {
    // Instala em {localappdata}, que é onde o app também guarda os dados
    // (ver main.py). Pedir administrador para um app de uso pessoal só cria
    // atrito e não é necessário aqui.
    expect(setup).toContain('PrivilegesRequired=lowest');
    expect(setup).toContain('DefaultDirName={localappdata}\\Programs\\ControlePatrimonial');
  });

  it('o Electron não voltou para o empacotamento', () => {
    // O app é pywebview mais PyInstaller. O Electron foi removido em
    // 31/08/2026 e não pode voltar por acidente numa mesclagem.
    const tudo = JSON.stringify(pacote);
    expect(tudo).not.toMatch(/electron/i);
    expect(pacote.main).toBeUndefined();
  });

  it('a persistência dos dados fica fora da pasta temporária do PyInstaller', () => {
    // _MEIPASS é apagado a cada execução. Se o localStorage for parar lá, o
    // app perde os dados da pessoa ao fechar. Ver main.py.
    expect(mainPy).toContain('LOCALAPPDATA');
    expect(mainPy).toContain('private_mode=False');
    expect(mainPy).toContain('storage_path = get_storage_path()');
    expect(mainPy).toContain('js_api=DesktopApi(storage_path)');
    expect(mainPy).toContain('storage_path=storage_path');
  });
});

// Regra de escrita da interface, que já vazou duas vezes: sem emoji, sem
// travessão conector e sem "·" decorativo. Um teste vale mais que a lembrança
// de quem escreve a próxima string.
describe('escrita da interface', () => {
  const arquivosDeTela = () => {
    const { globSync } = require('node:fs');
    return [...globSync(`${RAIZ}src/pages/*.jsx`), ...globSync(`${RAIZ}src/components/*.jsx`)];
  };

  it('nenhum texto de tela usa "·" como separador decorativo', () => {
    const comSeparador = arquivosDeTela().filter(f => readFileSync(f, 'utf8').includes('·'));
    expect(comSeparador.map(f => f.replace(RAIZ, ''))).toEqual([]);
  });

  it('nenhum texto de tela usa travessão conector', () => {
    // O travessão aparece legitimamente em COMENTÁRIO de código, que não é
    // interface, e o projeto usa muito comentário longo. Os comentários saem
    // ANTES da varredura, inclusive os de bloco, que atravessam várias linhas:
    // olhar linha a linha acusaria o meio de um /* */ como se fosse tela.
    const semComentarios = (fonte) => fonte
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/([^:])\/\/.*$/gm, '$1');
    const ofensores = [];
    for (const arquivo of arquivosDeTela()) {
      semComentarios(readFileSync(arquivo, 'utf8')).split('\n').forEach((linha, i) => {
        if (/—/.test(linha)) ofensores.push(`${arquivo.replace(RAIZ, '')}:${i + 1}`);
      });
    }
    expect(ofensores).toEqual([]);
  });
});
