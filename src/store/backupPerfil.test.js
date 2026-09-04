import { describe, expect, it, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  EXTENSAO_BACKUP,
  FORMATO_BACKUP,
  VERSAO_APP,
  VERSAO_FORMATO_BACKUP,
  anosDoBackup,
  hashDoArquivoBackup,
  lerArquivoBackup,
  montarArquivoBackup,
  montarBackupDoArmazenamento,
  nomeArquivoBackup,
  restaurarBackup,
  serializarCanonico,
  textoDoArquivoBackup,
} from './backupPerfil';
import { VERSAO_ESQUEMA_ATUAL, versaoDoEstado } from './migracoes';
import { PERFIS_STORAGE_KEY, dataStorageKeyFor } from './perfis';
import { carregarEstadoDoPerfil } from './DataContext';
import { demonstrativoConciliacao } from './demonstrativos';
import { criptografarObjeto, derivarChave, descriptografarObjeto, ehEnvelopeCriptografado, gerarSaltBase64 } from '../utils/crypto';

const lerFixture = (nome) => JSON.parse(
  readFileSync(new URL(`./__fixtures__/${nome}`, import.meta.url), 'utf8')
);

// Os MESMOS fixtures do item A1: estado real da importação do PDF sintético
// AJU-01, com dois anos no histórico, no formato de hoje e como uma versão
// antiga do app o teria gravado.
const PERFIL_ATUAL = lerFixture('perfil-aju01-atual.json');
const PERFIL_V1 = lerFixture('perfil-aju01-v1.json');
const ANO = PERFIL_ATUAL.anoCalendario;

// localStorage de mentira, mesmo contrato usado por App.test.js e
// DataContext.test.js (os testes deste projeto rodam em Node puro, sem DOM).
function fakeStorage(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados,
  };
}

const PERFIL_REGISTRO = {
  id: 'perfil-1',
  nome: 'AJUSTE ANUAL UM',
  cpf: '11122233344',
  apelido: 'Cliente A',
  criadoEm: '2026-01-02T10:00:00.000Z',
  protegido: false,
  salt: null,
};

function armazenamentoComPerfil(estado = PERFIL_ATUAL, perfil = PERFIL_REGISTRO) {
  return fakeStorage({
    [PERFIS_STORAGE_KEY]: JSON.stringify([perfil]),
    [dataStorageKeyFor(perfil.id)]: JSON.stringify(estado),
  });
}

// Demonstrativo do estado como o app o carregaria: é a prova de que o dado
// atravessou o arquivo sem perder nada que muda número na tela.
const conciliacaoDe = (estadoBruto) => demonstrativoConciliacao(carregarEstadoDoPerfil(estadoBruto));
const CONCILIACAO_ESPERADA = conciliacaoDe(PERFIL_ATUAL);

const lerDados = (storage, perfilId) => JSON.parse(storage.getItem(dataStorageKeyFor(perfilId)));
const lerLista = (storage) => JSON.parse(storage.getItem(PERFIS_STORAGE_KEY));

describe('serialização canônica e hash', () => {
  test('a ordem das chaves não muda o texto canônico', () => {
    const a = { b: 1, a: { z: [1, 2], y: 'x' } };
    const b = { a: { y: 'x', z: [1, 2] }, b: 1 };
    expect(serializarCanonico(a)).toBe(serializarCanonico(b));
  });

  test('undefined some do objeto e vira null dentro de array, como no JSON', () => {
    expect(serializarCanonico({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(serializarCanonico([1, undefined, 2])).toBe('[1,null,2]');
  });

  test('o hash do arquivo ignora o próprio campo hash', async () => {
    const base = { formato: FORMATO_BACKUP, conteudo: { a: 1 } };
    expect(await hashDoArquivoBackup(base))
      .toBe(await hashDoArquivoBackup({ ...base, hash: 'sha256-mentira' }));
  });

  test('reordenar as chaves de um backup já gerado não invalida o hash', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    // JSON.parse reconstrói o objeto podendo mudar a ordem das chaves (as
    // numéricas de `historico` sobem para o começo). O hash canônico não pode
    // depender disso, senão TODO backup restaurado seria acusado de corrompido.
    const relido = JSON.parse(textoDoArquivoBackup(arquivo));
    const invertido = Object.fromEntries(Object.entries(relido).reverse());
    await expect(lerArquivoBackup(JSON.stringify(invertido))).resolves.toBeTruthy();
  });
});

describe('montagem do arquivo de backup', () => {
  test('carrega o que o item A2 pede: estado inteiro, versão de esquema, data e hora, nome, apelido, versão do app e hash', async () => {
    const agora = new Date('2026-09-03T22:10:00.000Z');
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL, agora });
    expect(arquivo.formato).toBe(FORMATO_BACKUP);
    expect(arquivo.versaoFormato).toBe(VERSAO_FORMATO_BACKUP);
    expect(arquivo.versaoApp).toBe(VERSAO_APP);
    expect(arquivo.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    expect(arquivo.exportadoEm).toBe('2026-09-03T22:10:00.000Z');
    expect(arquivo.perfil).toEqual({ nome: 'AJUSTE ANUAL UM', apelido: 'Cliente A', cpf: '11122233344', cpfFinal: '' });
    expect(arquivo.hash).toMatch(/^sha256-[0-9a-f]{64}$/);
    // Estado inteiro: raiz e histórico, sem recorte.
    expect(arquivo.conteudo).toEqual(PERFIL_ATUAL);
    expect(Object.keys(arquivo.conteudo.historico).sort()).toEqual([String(ANO), String(ANO + 1)]);
  });

  test('a versão do app sai do package.json, não de uma constante à parte', async () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(VERSAO_APP).toBe(pkg.version);
  });

  test('o nome do arquivo usa o apelido, a data LOCAL e a extensão .cptec.json', () => {
    // 22h no horário de Brasília já é o dia seguinte em UTC: usar
    // toISOString aqui carimbaria o arquivo com a data errada.
    const agora = new Date(2026, 8, 3, 22, 10, 0);
    expect(nomeArquivoBackup(PERFIL_REGISTRO, agora)).toBe(`cptec-cliente-a-2026-09-03${EXTENSAO_BACKUP}`);
    expect(nomeArquivoBackup({ nome: 'JOSÉ DA SILVA JÚNIOR' }, agora)).toBe(`cptec-jose-da-silva-junior-2026-09-03${EXTENSAO_BACKUP}`);
    expect(nomeArquivoBackup({}, agora)).toBe(`cptec-perfil-2026-09-03${EXTENSAO_BACKUP}`);
  });

  test('anosDoBackup lista os anos que o arquivo carrega', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    expect(anosDoBackup(arquivo)).toEqual([ANO, ANO + 1]);
  });

  test('exportar da lista de perfis lê o que está gravado no armazenamento', async () => {
    const storage = armazenamentoComPerfil();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    expect(arquivo.protegido).toBe(false);
    expect(arquivo.conteudo).toEqual(PERFIL_ATUAL);
  });

  test('perfil sem nada gravado recusa a exportação em vez de gerar arquivo vazio', async () => {
    const storage = fakeStorage({ [PERFIS_STORAGE_KEY]: JSON.stringify([PERFIL_REGISTRO]) });
    await expect(montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO }))
      .rejects.toMatchObject({ codigo: 'sem_dados' });
  });
});

describe('ida e volta completa: exportar, apagar o perfil, restaurar', () => {
  test('o demonstrativo do perfil restaurado é idêntico ao do original', async () => {
    const storage = armazenamentoComPerfil();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    const texto = textoDoArquivoBackup(arquivo);

    // Apaga o perfil por completo, como faz "Excluir" na tela de perfis.
    storage.removeItem(dataStorageKeyFor(PERFIL_REGISTRO.id));
    storage.setItem(PERFIS_STORAGE_KEY, JSON.stringify([]));

    const relido = await lerArquivoBackup(texto);
    const { perfil, lista } = await restaurarBackup({ storage, arquivo: relido });

    expect(lista).toHaveLength(1);
    expect(perfil.id).not.toBe(PERFIL_REGISTRO.id); // perfil NOVO, id novo
    expect(perfil.nome).toBe(PERFIL_REGISTRO.nome);
    expect(perfil.cpf).toBe(PERFIL_REGISTRO.cpf);
    expect(perfil.apelido).toBe(PERFIL_REGISTRO.apelido);
    expect(perfil.protegido).toBe(false);

    const restaurado = lerDados(storage, perfil.id);
    expect(restaurado).toEqual(PERFIL_ATUAL);
    expect(conciliacaoDe(restaurado)).toEqual(CONCILIACAO_ESPERADA);
  });

  test('o estado carregado do perfil restaurado é igual campo a campo, inclusive dentro do histórico', async () => {
    const storage = armazenamentoComPerfil();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    storage.setItem(PERFIS_STORAGE_KEY, JSON.stringify([]));
    const { perfil } = await restaurarBackup({ storage, arquivo: await lerArquivoBackup(textoDoArquivoBackup(arquivo)) });
    expect(carregarEstadoDoPerfil(lerDados(storage, perfil.id)))
      .toEqual(carregarEstadoDoPerfil(PERFIL_ATUAL));
  });

  test('restaurar cria um perfil NOVO e não encosta no perfil que já existe', async () => {
    const storage = armazenamentoComPerfil();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    const { perfil, lista } = await restaurarBackup({ storage, arquivo });
    expect(lista.map(p => p.id)).toEqual([PERFIL_REGISTRO.id, perfil.id]);
    expect(lerDados(storage, PERFIL_REGISTRO.id)).toEqual(PERFIL_ATUAL);
    expect(lerLista(storage)).toHaveLength(2);
  });

  test('substituir um perfil existente troca os dados dele e mantém id, criação e apelido', async () => {
    const outro = { ...PERFIL_REGISTRO, id: 'perfil-2', nome: 'OUTRO TITULAR', cpf: '99988877766', apelido: 'Cliente B' };
    const storage = fakeStorage({
      [PERFIS_STORAGE_KEY]: JSON.stringify([PERFIL_REGISTRO, outro]),
      [dataStorageKeyFor(PERFIL_REGISTRO.id)]: JSON.stringify(PERFIL_ATUAL),
      [dataStorageKeyFor(outro.id)]: JSON.stringify({ contribuinte: { nome: 'OUTRO TITULAR' } }),
    });
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    const { perfil, lista, substituiu } = await restaurarBackup({ storage, arquivo, substituirPerfilId: outro.id });

    expect(substituiu).toBe(true);
    expect(lista).toHaveLength(2);
    expect(perfil.id).toBe(outro.id);
    expect(perfil.criadoEm).toBe(outro.criadoEm);
    expect(perfil.apelido).toBe('Cliente B'); // rótulo da usuária, não do arquivo
    expect(perfil.nome).toBe(PERFIL_REGISTRO.nome); // nome e CPF passam a ser os do arquivo
    expect(perfil.cpf).toBe(PERFIL_REGISTRO.cpf);
    expect(conciliacaoDe(lerDados(storage, outro.id))).toEqual(CONCILIACAO_ESPERADA);
  });

  test('substituir um perfil que sumiu da lista é recusado, sem gravar nada', async () => {
    const storage = armazenamentoComPerfil();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    await expect(restaurarBackup({ storage, arquivo, substituirPerfilId: 'perfil-que-nao-existe' }))
      .rejects.toMatchObject({ codigo: 'perfil_inexistente' });
    expect(lerLista(storage)).toHaveLength(1);
  });
});

describe('arquivo que não é um backup, ou que chegou quebrado', () => {
  test('texto que nem é JSON', async () => {
    await expect(lerArquivoBackup('isto não é json')).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  test('JSON qualquer, sem o carimbo do formato', async () => {
    await expect(lerArquivoBackup('{"bens":[],"dividas":[]}')).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
    // O estado cru de um perfil (o que está no localStorage) não é um backup:
    // não tem o envelope, e restaurá-lo às cegas perderia nome e proteção.
    await expect(lerArquivoBackup(JSON.stringify(PERFIL_ATUAL))).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  test('backup sem o campo hash', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    const { hash: _h, ...semHash } = arquivo;
    await expect(lerArquivoBackup(JSON.stringify(semHash))).rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  test('um número alterado no conteúdo é pego pelo hash', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    const adulterado = JSON.parse(textoDoArquivoBackup(arquivo));
    adulterado.conteudo.bens[0].situacao_atual = Number(adulterado.conteudo.bens[0].situacao_atual || 0) + 0.01;
    await expect(lerArquivoBackup(JSON.stringify(adulterado))).rejects.toMatchObject({ codigo: 'corrompido' });
  });

  test('mexer nos METADADOS também é pego (o hash não cobre só o conteúdo)', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    for (const alterar of [
      a => { a.exportadoEm = '2020-01-01T00:00:00.000Z'; },
      a => { a.perfil.nome = 'OUTRA PESSOA'; },
      a => { a.versaoApp = '9.9.9'; },
      a => { a.versaoEsquema = 1; },
    ]) {
      const adulterado = JSON.parse(textoDoArquivoBackup(arquivo));
      alterar(adulterado);
      await expect(lerArquivoBackup(JSON.stringify(adulterado))).rejects.toMatchObject({ codigo: 'corrompido' });
    }
  });

  test('arquivo cortado no meio do download', async () => {
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    const texto = textoDoArquivoBackup(arquivo);
    await expect(lerArquivoBackup(texto.slice(0, Math.floor(texto.length / 2))))
      .rejects.toMatchObject({ codigo: 'arquivo_invalido' });
  });

  test('backup de uma versão futura do CP-TEC é recusado, e a mensagem diz o que fazer', async () => {
    const arquivo = await montarArquivoBackup({
      perfil: PERFIL_REGISTRO,
      conteudo: { ...PERFIL_ATUAL, versaoEsquema: VERSAO_ESQUEMA_ATUAL + 1 },
      versaoEsquema: VERSAO_ESQUEMA_ATUAL + 1,
    });
    const recusa = await lerArquivoBackup(textoDoArquivoBackup(arquivo)).catch(e => e);
    expect(recusa.codigo).toBe('esquema_novo');
    expect(recusa.message).toContain('Atualize o CP-TEC');
    expect(recusa.message).toContain(`esquema ${VERSAO_ESQUEMA_ATUAL + 1}`);
  });

  test('formato de arquivo mais novo que o conhecido é recusado antes de qualquer leitura de conteúdo', async () => {
    const base = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo: PERFIL_ATUAL });
    const futuro = { ...base, versaoFormato: VERSAO_FORMATO_BACKUP + 1 };
    futuro.hash = await hashDoArquivoBackup(futuro);
    await expect(lerArquivoBackup(JSON.stringify(futuro))).rejects.toMatchObject({ codigo: 'formato_novo' });
  });

  test('um estado de esquema futuro escondido dentro de um arquivo bem formado não escapa na restauração', async () => {
    // A marca da raiz do arquivo diz 2, mas o estado lá dentro diz 3: a
    // conferência da leitura passa e a da restauração precisa pegar.
    const conteudo = { ...PERFIL_ATUAL, versaoEsquema: VERSAO_ESQUEMA_ATUAL + 1 };
    const arquivo = await montarArquivoBackup({ perfil: PERFIL_REGISTRO, conteudo, versaoEsquema: VERSAO_ESQUEMA_ATUAL });
    const relido = await lerArquivoBackup(textoDoArquivoBackup(arquivo));
    const storage = fakeStorage({ [PERFIS_STORAGE_KEY]: '[]' });
    await expect(restaurarBackup({ storage, arquivo: relido })).rejects.toMatchObject({ codigo: 'esquema_novo' });
    expect(lerLista(storage)).toEqual([]);
  });
});

describe('backup de esquema antigo é migrado na restauração', () => {
  test('o arquivo da versão 1 entra já no formato de hoje, na raiz e em cada ano', async () => {
    const storage = armazenamentoComPerfil(PERFIL_V1);
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    expect(arquivo.versaoEsquema).toBe(1); // o arquivo é honesto sobre o que carrega

    const { perfil } = await restaurarBackup({ storage, arquivo: await lerArquivoBackup(textoDoArquivoBackup(arquivo)) });
    const restaurado = lerDados(storage, perfil.id);

    expect(restaurado.versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    for (const ano of Object.keys(restaurado.historico)) {
      expect(restaurado.historico[ano].versaoEsquema, `ano ${ano}`).toBe(VERSAO_ESQUEMA_ATUAL);
    }
    // Campos que a versão antiga nem conhecia chegam preenchidos, e nenhum
    // ano herda a coleção do outro (o array vazio é próprio de cada ano).
    expect(restaurado.rendaVariavelMensalManual).toEqual([]);
    expect(restaurado.historico[ANO].rendaVariavelMensalManual).toEqual([]);
    expect(restaurado.historico[ANO].rendaVariavelMensalManual)
      .not.toBe(restaurado.historico[ANO + 1].rendaVariavelMensalManual);
  });

  test('e o demonstrativo continua igual ao do perfil no formato de hoje', async () => {
    const storage = armazenamentoComPerfil(PERFIL_V1);
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil: PERFIL_REGISTRO });
    const { perfil } = await restaurarBackup({ storage, arquivo });
    expect(conciliacaoDe(lerDados(storage, perfil.id))).toEqual(CONCILIACAO_ESPERADA);
  });
});

describe('perfil protegido por senha', () => {
  const SENHA = 'senha-do-perfil-2026';

  async function armazenamentoProtegido(estado = PERFIL_ATUAL) {
    const salt = gerarSaltBase64();
    const chave = await derivarChave(SENHA, salt);
    const perfil = { ...PERFIL_REGISTRO, protegido: true, salt, cpf: '', cpfFinal: '344' };
    const storage = fakeStorage({
      [PERFIS_STORAGE_KEY]: JSON.stringify([perfil]),
      [dataStorageKeyFor(perfil.id)]: JSON.stringify(await criptografarObjeto(chave, estado)),
    });
    return { storage, perfil, salt };
  }

  test('exporta cifrado, sem senha e sem chave no arquivo, e sem o CPF completo', async () => {
    const { storage, perfil, salt } = await armazenamentoProtegido();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil });
    const texto = textoDoArquivoBackup(arquivo);

    expect(arquivo.protegido).toBe(true);
    expect(arquivo.salt).toBe(salt);
    expect(ehEnvelopeCriptografado(arquivo.conteudo)).toBe(true);
    expect(arquivo.versaoEsquema).toBe(null); // só se sabe depois da senha
    expect(arquivo.perfil).toEqual({ nome: PERFIL_REGISTRO.nome, apelido: 'Cliente A', cpf: '', cpfFinal: '344' });

    // Nada do que abre o perfil pode estar no arquivo.
    expect(texto).not.toContain(SENHA);
    expect(texto).not.toMatch(/"senha"|"chave"|"password"/);
    // E nenhum dado da declaração vaza em claro: o nome do titular aparece
    // uma vez só, no bloco de identificação do perfil.
    expect(texto).not.toContain(PERFIL_ATUAL.bens[0].discriminacao);
    expect(texto).not.toContain(PERFIL_ATUAL.contribuinte.cpf);
  });

  test('ida e volta com a senha certa devolve o demonstrativo idêntico, e o perfil volta protegido', async () => {
    const { storage, perfil, salt } = await armazenamentoProtegido();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil });
    const texto = textoDoArquivoBackup(arquivo);

    storage.removeItem(dataStorageKeyFor(perfil.id));
    storage.setItem(PERFIS_STORAGE_KEY, JSON.stringify([]));

    const { perfil: novo } = await restaurarBackup({ storage, arquivo: await lerArquivoBackup(texto), senha: SENHA });
    expect(novo.protegido).toBe(true);
    expect(novo.salt).toBe(salt);
    expect(novo.cpf).toBe('');
    expect(novo.cpfFinal).toBe('344');

    // O que foi gravado continua cifrado, e a MESMA senha abre.
    const gravado = lerDados(storage, novo.id);
    expect(ehEnvelopeCriptografado(gravado)).toBe(true);
    const aberto = await descriptografarObjeto(await derivarChave(SENHA, novo.salt), gravado);
    expect(conciliacaoDe(aberto)).toEqual(CONCILIACAO_ESPERADA);
    expect(aberto).toEqual(PERFIL_ATUAL);
  });

  test('senha errada recusa com mensagem própria e não grava nada', async () => {
    const { storage, perfil } = await armazenamentoProtegido();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil });
    const recusa = await restaurarBackup({ storage, arquivo, senha: 'senha-errada' }).catch(e => e);
    expect(recusa.codigo).toBe('senha_incorreta');
    expect(recusa.message).toContain('Senha incorreta');
    expect(lerLista(storage)).toHaveLength(1); // nenhum perfil novo entrou
  });

  test('backup protegido de esquema antigo é migrado e recifrado com a mesma senha', async () => {
    const { storage, perfil } = await armazenamentoProtegido(PERFIL_V1);
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil });
    storage.setItem(PERFIS_STORAGE_KEY, JSON.stringify([]));
    const { perfil: novo } = await restaurarBackup({ storage, arquivo, senha: SENHA });
    const aberto = await descriptografarObjeto(await derivarChave(SENHA, novo.salt), lerDados(storage, novo.id));
    expect(versaoDoEstado(aberto)).toBe(VERSAO_ESQUEMA_ATUAL);
    expect(aberto.historico[ANO].versaoEsquema).toBe(VERSAO_ESQUEMA_ATUAL);
    expect(conciliacaoDe(aberto)).toEqual(CONCILIACAO_ESPERADA);
  });

  test('corrupção no ciphertext é pega pelo hash, antes mesmo de pedir a senha', async () => {
    const { storage, perfil } = await armazenamentoProtegido();
    const arquivo = await montarBackupDoArmazenamento({ storage, perfil });
    const adulterado = JSON.parse(textoDoArquivoBackup(arquivo));
    adulterado.conteudo.ciphertext = `${adulterado.conteudo.ciphertext[0] === 'A' ? 'B' : 'A'}${adulterado.conteudo.ciphertext.slice(1)}`;
    await expect(lerArquivoBackup(JSON.stringify(adulterado))).rejects.toMatchObject({ codigo: 'corrompido' });
  });

  test('perfil protegido cujo registro perdeu o salt não gera backup natimorto', async () => {
    const { storage, perfil } = await armazenamentoProtegido();
    await expect(montarBackupDoArmazenamento({ storage, perfil: { ...perfil, salt: null } }))
      .rejects.toMatchObject({ codigo: 'sem_salt' });
  });

  test('anosDoBackup não tenta adivinhar os anos de um arquivo cifrado', async () => {
    const { storage, perfil } = await armazenamentoProtegido();
    expect(anosDoBackup(await montarBackupDoArmazenamento({ storage, perfil }))).toEqual([]);
  });
});
