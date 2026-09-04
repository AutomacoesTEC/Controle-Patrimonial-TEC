// Backup e restauração de um perfil inteiro num arquivo `.cptec.json`.
// Item A2 de MELHORIAS-PROPOSTAS-2026-09-03.md.
//
// POR QUE ISTO EXISTE. Até 03/09/2026 a única saída do app era o `.xlsx` do
// relatório, que não volta para dentro. Todo o dado de um perfil vive numa
// chave de localStorage (`controle-patrimonial-data-<id>`, ver perfis.js):
// limpar os dados do site, trocar de computador ou reinstalar o app apaga
// anos de trabalho sem aviso nenhum. Este módulo é o caminho de ida e volta.
//
// O QUE É PURO AQUI. Nada neste arquivo toca `document`, `window` nem o
// localStorage global: quem grava recebe o `storage` por parâmetro (mesmo
// contrato de `persistirDadosPerfil` em DataContext.jsx) e quem baixa o
// arquivo usa `src/utils/baixarArquivo.js`. É o que deixa a ida e volta
// inteira testável em Node puro, sem DOM.
//
// FORMATO DO ARQUIVO (versaoFormato 1):
//   {
//     formato: 'cptec-backup',      // carimbo que identifica o arquivo
//     versaoFormato: 1,             // versão do ENVELOPE do backup
//     versaoApp: '1.2.0',           // versão do app, lida do package.json
//     versaoEsquema: 2,             // versão do ESTADO (item A1), ou null
//     exportadoEm: '2026-09-03T...',// instante ISO da exportação
//     perfil: { nome, apelido, cpf, cpfFinal },
//     protegido: false,
//     salt: null,                   // base64 do salt, só em perfil protegido
//     hash: 'sha256-...',           // integridade de TUDO menos o próprio hash
//     conteudo: { ...estado... }    // ou o envelope {v,iv,ciphertext}
//   }
//
// DUAS VERSÕES CONVIVEM NO ARQUIVO, e não são a mesma coisa:
//   `versaoFormato` é a versão deste envelope (o que muda quando um campo
//   novo entra AQUI); `versaoEsquema` é a versão do estado do perfil, a de
//   `src/store/migracoes.js` (item A1). Um backup antigo do mesmo envelope
//   pode carregar um estado antigo, e é a cadeia de migração de A1 que o
//   atualiza na restauração. Nenhuma cadeia de migração nova foi criada aqui.
//
// SENHA. O perfil protegido é exportado JÁ CIFRADO, com a mesma chave que o
// app usa (AES-GCM derivado da senha por PBKDF2, ver utils/crypto.js). A
// senha e a chave derivada NUNCA entram no arquivo: o que vai junto é só o
// `salt`, que é público por natureza (já fica em claro no registro do perfil)
import { salvarIndiceDuravel, salvarPerfilDuravel } from './persistenciaDesktop';
// e sem o qual a senha certa não conseguiria derivar a chave de volta.
// Exportar não pede senha (o conteúdo cifrado já está no disco de qualquer
// jeito); restaurar pede, porque só assim dá para migrar o estado e regravar.
import { version as VERSAO_APP_PACKAGE } from '../../package.json';
import {
  PERFIS_STORAGE_KEY, dataStorageKeyFor, novoPerfil, adicionarPerfil, atualizarPerfil,
} from './perfis';
import { VERSAO_ESQUEMA_ATUAL, migrarEstadoPersistido, versaoDoEstado } from './migracoes';
import {
  criptografarObjeto, derivarChave, descriptografarObjeto, ehEnvelopeCriptografado,
} from '../utils/crypto';

export const FORMATO_BACKUP = 'cptec-backup';
export const VERSAO_FORMATO_BACKUP = 1;
export const EXTENSAO_BACKUP = '.cptec.json';
export const TIPO_MIME_BACKUP = 'application/json;charset=utf-8';
export const VERSAO_APP = VERSAO_APP_PACKAGE;

const ehObjeto = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// --- Erros -------------------------------------------------------------------
// Toda recusa sai por aqui, com um `codigo` estável (para o teste) e uma
// mensagem que diz o que houve E o que fazer (para quem está na frente da
// tela). Sem travessão e sem emoji, como o resto da interface.
export class ErroBackup extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'ErroBackup';
    this.codigo = codigo;
  }
}

export const MENSAGENS_BACKUP = {
  arquivo_invalido: 'Este arquivo não é um backup do CP-TEC. Escolha o arquivo terminado em .cptec.json que foi gerado pelo botão Exportar backup.',
  corrompido: 'O arquivo está corrompido: a conferência de integridade não bateu, então o conteúdo mudou depois da exportação. Use outra cópia do backup, ou exporte o perfil de novo no computador de origem.',
  senha_incorreta: 'Senha incorreta. Digite a senha que protegia o perfil no momento em que este backup foi exportado, e não uma senha nova.',
  formato_novo: 'Este backup foi gerado por uma versão mais nova do CP-TEC. Atualize o CP-TEC neste computador e restaure de novo.',
  esquema_novo: 'Este backup foi gerado por uma versão mais nova do CP-TEC. Atualize o CP-TEC neste computador e restaure de novo, porque restaurar aqui apagaria o que a versão nova gravou.',
  perfil_inexistente: 'O perfil escolhido para ser substituído não existe mais nesta lista. Recarregue a tela de perfis e tente de novo.',
  sem_dados: 'Este perfil ainda não tem nada salvo neste computador, então não há o que exportar.',
  sem_salt: 'Não foi possível gerar o backup deste perfil protegido: falta o salt da senha, e sem ele nem a senha certa abriria o arquivo depois. Feche e abra o app e tente de novo.',
};

const erro = (codigo, complemento) => new ErroBackup(
  codigo,
  complemento ? `${MENSAGENS_BACKUP[codigo]} ${complemento}` : MENSAGENS_BACKUP[codigo],
);

// --- Integridade -------------------------------------------------------------

// Serialização CANÔNICA: mesmo conteúdo, mesmo texto, independentemente da
// ordem em que as chaves aparecem no objeto. Sem isso o hash seria refém da
// ordem de `JSON.stringify`, que muda conforme o arquivo é lido e regravado
// (chaves numéricas de `historico`, por exemplo, sobem para o começo quando
// o objeto é reconstruído). Mesmas regras do JSON para o resto: `undefined`
// e função somem do objeto e viram `null` dentro de array, NaN vira null.
export function serializarCanonico(valor) {
  if (valor === undefined || typeof valor === 'function' || typeof valor === 'symbol') return undefined;
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor);
  if (Array.isArray(valor)) {
    return `[${valor.map(item => serializarCanonico(item) ?? 'null').join(',')}]`;
  }
  const partes = [];
  for (const chave of Object.keys(valor).sort()) {
    const serializado = serializarCanonico(valor[chave]);
    if (serializado === undefined) continue;
    partes.push(`${JSON.stringify(chave)}:${serializado}`);
  }
  return `{${partes.join(',')}}`;
}

export async function hashSha256Hex(texto) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// O hash cobre o arquivo INTEIRO menos o próprio campo `hash`, não só o
// `conteudo`: adulterar a data da exportação, o nome do titular ou a marca de
// versão também precisa ser detectado.
export async function hashDoArquivoBackup(arquivo) {
  const { hash: _hash, ...resto } = arquivo;
  return `sha256-${await hashSha256Hex(serializarCanonico(resto))}`;
}

// --- Exportação --------------------------------------------------------------

// `conteudo` chega pronto de quem chama: o estado em texto puro (perfil sem
// senha) ou o envelope {v,iv,ciphertext} (perfil protegido). Manter a
// criptografia FORA daqui é o que permite exportar um perfil protegido a
// partir da lista de perfis sem pedir a senha: o envelope que já está no
// localStorage é copiado como está.
export async function montarArquivoBackup({
  perfil = {},
  conteudo,
  protegido = false,
  salt = null,
  versaoEsquema,
  agora = new Date(),
  versaoApp = VERSAO_APP,
}) {
  if (!ehObjeto(conteudo)) throw erro('sem_dados');
  // Envelope cifrado sem o salt seria um arquivo natimorto: nem a senha certa
  // derivaria a chave de volta. Recusar aqui é melhor do que entregar um
  // backup que só se descobre inútil no dia em que for preciso.
  if (protegido && !salt) throw erro('sem_salt');
  const marca = versaoEsquema !== undefined
    ? versaoEsquema
    // Perfil protegido exportado da lista: o estado está dentro do envelope,
    // então a versão do esquema só é conhecida depois da senha. Fica `null`
    // aqui e é conferida na restauração, logo após a decriptação.
    : (protegido ? null : versaoDoEstado(conteudo));
  const arquivo = {
    formato: FORMATO_BACKUP,
    versaoFormato: VERSAO_FORMATO_BACKUP,
    versaoApp,
    versaoEsquema: marca,
    exportadoEm: agora.toISOString(),
    perfil: {
      nome: perfil.nome || '',
      apelido: perfil.apelido || '',
      // Perfil protegido não guarda o CPF completo fora do envelope cifrado
      // (achado 21 da auditoria de 24/08/2026, ver protegerPerfil em
      // perfis.js). O backup respeita a mesma fronteira: copia o que a lista
      // de perfis tem, e para o perfil protegido isso são só os três últimos
      // dígitos.
      cpf: protegido ? '' : (perfil.cpf || ''),
      cpfFinal: protegido ? (perfil.cpfFinal || '') : '',
    },
    protegido: !!protegido,
    salt: protegido ? (salt || null) : null,
    conteudo,
  };
  return { ...arquivo, hash: await hashDoArquivoBackup(arquivo) };
}

// Texto que vai para o disco. Compacto de propósito: o estado de um perfil
// real passa de 170 KB só de dado estruturado, e ainda carrega o
// `documentoFonte` (cópia textual do arquivo importado). Indentar dobraria o
// tamanho sem ajudar ninguém, e o hash é sobre a forma canônica, não sobre
// este texto, então a formatação não muda a conferência.
export function textoDoArquivoBackup(arquivo) {
  return JSON.stringify(arquivo);
}

const semAcento = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function nomeArquivoBackup(perfil = {}, agora = new Date()) {
  const base = semAcento(String(perfil.apelido || perfil.nome || 'perfil'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'perfil';
  // Data LOCAL, não `toISOString`: exportar às 22h no horário de Brasília
  // cairia no dia seguinte em UTC, e o arquivo nasceria com a data errada.
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `cptec-${base}-${agora.getFullYear()}-${mes}-${dia}${EXTENSAO_BACKUP}`;
}

// Exporta um perfil QUALQUER a partir do armazenamento, sem precisar abri-lo
// (é o caminho da tela de perfis). Perfil protegido sai com o envelope que já
// está gravado, sem senha nenhuma.
export async function montarBackupDoArmazenamento({ storage, perfil, agora = new Date() }) {
  const bruto = storage.getItem(dataStorageKeyFor(perfil.id));
  if (!bruto) throw erro('sem_dados');
  let conteudo;
  try {
    conteudo = JSON.parse(bruto);
  } catch {
    throw erro('sem_dados', 'O que está gravado para este perfil não é legível.');
  }
  const protegido = ehEnvelopeCriptografado(conteudo);
  return montarArquivoBackup({
    perfil,
    conteudo,
    protegido,
    salt: protegido ? perfil.salt || null : null,
    agora,
  });
}

// --- Leitura ------------------------------------------------------------------

// Confere que o arquivo é MESMO um backup do CP-TEC e que chegou inteiro,
// ANTES de qualquer senha. Devolve o arquivo já validado; recusa com
// ErroBackup em qualquer outro caso.
export async function lerArquivoBackup(texto) {
  let arquivo;
  try {
    arquivo = JSON.parse(texto);
  } catch {
    throw erro('arquivo_invalido');
  }
  if (!ehObjeto(arquivo) || arquivo.formato !== FORMATO_BACKUP) throw erro('arquivo_invalido');
  if (!Number.isInteger(arquivo.versaoFormato) || arquivo.versaoFormato < 1) throw erro('arquivo_invalido');
  if (arquivo.versaoFormato > VERSAO_FORMATO_BACKUP) {
    throw erro('formato_novo', `O arquivo é do formato ${arquivo.versaoFormato} e este app entende até o ${VERSAO_FORMATO_BACKUP}.`);
  }
  if (typeof arquivo.hash !== 'string' || !arquivo.hash) throw erro('arquivo_invalido');
  if (!ehObjeto(arquivo.conteudo)) throw erro('corrompido');
  if (await hashDoArquivoBackup(arquivo) !== arquivo.hash) throw erro('corrompido');
  if (arquivo.protegido && (!ehEnvelopeCriptografado(arquivo.conteudo) || typeof arquivo.salt !== 'string' || !arquivo.salt)) {
    throw erro('corrompido', 'O arquivo se diz protegido por senha, mas o conteúdo cifrado não está completo.');
  }
  conferirVersaoDoEsquema(arquivo.versaoEsquema);
  return arquivo;
}

// A cadeia de A1 devolve intacto um estado de versão MAIOR que a do app (ver
// migrarEstadoPersistido): rebaixar formato destruiria dado. Na restauração
// isso não pode passar em silêncio, porque o app gravaria por cima com um
// código que não entende metade dos campos. Aqui a recusa é explícita.
function conferirVersaoDoEsquema(versao) {
  if (Number.isInteger(versao) && versao > VERSAO_ESQUEMA_ATUAL) {
    throw erro('esquema_novo', `O arquivo está no esquema ${versao} e este app entende até o ${VERSAO_ESQUEMA_ATUAL}.`);
  }
}

// Anos que o backup carrega, para a tela mostrar o que está prestes a entrar.
// Perfil protegido devolve lista vazia: o conteúdo só é legível com a senha.
export function anosDoBackup(arquivo) {
  if (!arquivo || arquivo.protegido) return [];
  const conteudo = arquivo.conteudo || {};
  const anos = new Set(Object.keys(conteudo.historico || {}).map(Number));
  if (conteudo.anoCalendario != null) anos.add(Number(conteudo.anoCalendario));
  return [...anos].filter(Number.isFinite).sort((a, b) => a - b);
}

// --- Restauração ---------------------------------------------------------------

// Restaura o backup no armazenamento. Por padrão CRIA UM PERFIL NOVO: nunca
// sobrescrever nada é o comportamento seguro, e um perfil a mais na lista se
// apaga com um clique, enquanto um perfil sobrescrito por engano não volta.
// Substituir um perfil existente só acontece quando quem chama passa
// `substituirPerfilId` de propósito, e a tela só faz isso depois da
// confirmação no ConfirmacaoModal (nunca no confirm() nativo, ver
// src/semConfirmNativo.test.js).
//
// O estado gravado é sempre o MIGRADO pela cadeia do item A1: um backup de
// esquema antigo entra já no formato de hoje, em vez de ficar esperando a
// próxima carga para se adaptar.
export async function restaurarBackup({
  storage,
  desktopApi,
  arquivo,
  senha = '',
  substituirPerfilId = null,
  agora = new Date(),
}) {
  let listaAtual;
  try {
    listaAtual = JSON.parse(storage.getItem(PERFIS_STORAGE_KEY) || '[]');
  } catch {
    listaAtual = [];
  }
  if (!Array.isArray(listaAtual)) listaAtual = [];

  const protegido = !!arquivo.protegido;
  const salt = protegido ? arquivo.salt : null;
  let estado;
  let conteudoParaGravar;

  if (protegido) {
    let chave;
    try {
      chave = await derivarChave(senha, salt);
    } catch {
      throw erro('corrompido', 'O salt gravado no arquivo não é válido.');
    }
    try {
      estado = await descriptografarObjeto(chave, arquivo.conteudo);
    } catch {
      throw erro('senha_incorreta');
    }
    if (!ehObjeto(estado)) throw erro('corrompido');
    conferirVersaoDoEsquema(versaoDoEstado(estado));
    estado = migrarEstadoPersistido(estado);
    // Recifrado com a MESMA chave (mesmo salt do arquivo), para a senha do
    // backup continuar valendo, e com IV novo, porque o conteúdo mudou na
    // migração e AES-GCM nunca reusa nonce.
    conteudoParaGravar = await criptografarObjeto(chave, estado);
  } else {
    conferirVersaoDoEsquema(versaoDoEstado(arquivo.conteudo));
    estado = migrarEstadoPersistido(arquivo.conteudo);
    conteudoParaGravar = estado;
  }

  const doArquivo = arquivo.perfil || {};
  let perfil;
  let lista;
  if (substituirPerfilId) {
    const alvo = listaAtual.find(p => p && p.id === substituirPerfilId);
    if (!alvo) throw erro('perfil_inexistente');
    // Id, data de criação e APELIDO são do perfil que fica: o apelido é o
    // rótulo que a usuária deu àquele card e não é dado da declaração.
    // Nome, CPF e proteção vêm do arquivo, porque agora os dados são dele.
    perfil = {
      ...alvo,
      nome: doArquivo.nome || alvo.nome || '',
      cpf: protegido ? '' : (doArquivo.cpf || ''),
      cpfFinal: protegido ? (doArquivo.cpfFinal || '') : '',
      protegido,
      salt,
    };
    lista = atualizarPerfil(listaAtual, alvo.id, perfil);
  } else {
    const base = novoPerfil({
      nome: doArquivo.nome,
      cpf: protegido ? '' : doArquivo.cpf,
      apelido: doArquivo.apelido,
    }, agora);
    perfil = {
      ...base,
      protegido,
      salt,
      cpfFinal: protegido ? (doArquivo.cpfFinal || '') : '',
    };
    lista = adicionarPerfil(listaAtual, perfil);
  }

  // Dados primeiro, lista depois: se a gravação falhar no meio (quota), o
  // pior caso é uma chave de dados órfã, e não um perfil na lista apontando
  // para nada.
  await salvarPerfilDuravel({ storage, desktopApi, perfilId: perfil.id, conteudo: conteudoParaGravar });
  await salvarIndiceDuravel({ storage, desktopApi, perfis: lista });
  return { perfil, lista, estado, substituiu: !!substituirPerfilId };
}
