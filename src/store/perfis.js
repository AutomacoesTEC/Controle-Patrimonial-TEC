// Lógica pura do registro de perfis (titulares). Cada perfil é uma pessoa
// (titular) com seus próprios anos-calendário, bens, dívidas, dependentes
// etc. — um app inteiro à parte por baixo dos panos, isolado dos demais
// perfis por guardar os dados sob uma CHAVE DE LOCALSTORAGE DIFERENTE (ver
// dataStorageKeyFor). Este módulo só monta/edita a LISTA de perfis (nome,
// cpf, apelido) em memória; a leitura/escrita real no localStorage fica no
// chamador (App.jsx), pelo mesmo motivo de reducer.js ficar puro: testável
// sem montar nada.

export const PERFIS_STORAGE_KEY = 'controle-patrimonial-perfis';
export const LEGADO_STORAGE_KEY = 'controle-patrimonial-data';

// Qual perfil está aberto NESTA sessão do app. Fica em sessionStorage, e a
// escolha do armazenamento é a regra de negócio inteira: sessionStorage
// sobrevive ao recarregar a página (F5) e é apagado quando a janela fecha.
// É exatamente a fronteira que a usuária pediu em 21/08/2026: atualizar
// mantém o titular aberto, abrir o app depois de fechado volta para a lista
// de perfis. A chave ANTIGA `controle-patrimonial-perfil-ativo` era de
// localStorage e por isso retomava o perfil até depois de fechar o app; foi
// removida e não deve voltar.
export const PERFIL_SESSAO_KEY = 'controle-patrimonial-perfil-sessao';

export const dataStorageKeyFor = (perfilId) => `controle-patrimonial-data-${perfilId}`;

export function novoPerfil({ nome, cpf, apelido }, agora = new Date()) {
  return {
    id: `${agora.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    nome: (nome || '').trim(),
    cpf: (cpf || '').replace(/\D/g, ''),
    apelido: (apelido || '').trim(),
    criadoEm: agora.toISOString(),
    // protegido/salt: ver src/utils/crypto.js. A SENHA em si nunca fica
    // aqui nem em lugar nenhum persistido — só o salt (público por
    // natureza, serve pra derivar a chave a partir da senha digitada toda
    // vez que o perfil é aberto).
    protegido: false,
    salt: null,
  };
}

// Liga/desliga a proteção por senha de UM perfil na lista. Puras — quem
// efetivamente re-criptografa (ou descriptografa) o conteúdo salvo em
// dataStorageKeyFor(perfilId) é o chamador (App.jsx/PerfilLauncherPage),
// que já lida com o Web Crypto assíncrono; aqui só atualiza os metadados.
export function protegerPerfil(perfis, perfilId, saltBase64) {
  return atualizarPerfil(perfis, perfilId, { protegido: true, salt: saltBase64 });
}
export function desprotegerPerfil(perfis, perfilId) {
  return atualizarPerfil(perfis, perfilId, { protegido: false, salt: null });
}

export function adicionarPerfil(perfis, perfil) {
  return [...perfis, perfil];
}

export function atualizarPerfil(perfis, perfilId, patch) {
  return perfis.map(p => (p.id === perfilId ? { ...p, ...patch } : p));
}

export function removerPerfil(perfis, perfilId) {
  return perfis.filter(p => p.id !== perfilId);
}

// Nome/CPF do perfil acompanham o titular de verdade (state.contribuinte)
// sempre que ele muda — sem isso, o card do perfil na tela de seleção
// ficaria com o nome de quando o perfil foi criado, mesmo depois de
// corrigido ou de vir de outra importação. Apelido nunca é tocado aqui: é
// controlado só pela usuária.
export function sincronizarPerfilComContribuinte(perfis, perfilId, contribuinte) {
  if (!contribuinte || (!contribuinte.nome && !contribuinte.cpf)) return perfis;
  const perfil = perfis.find(p => p.id === perfilId);
  if (!perfil) return perfis;
  const nome = contribuinte.nome || perfil.nome;
  const cpf = contribuinte.cpf || perfil.cpf;
  if (nome === perfil.nome && cpf === perfil.cpf) return perfis;
  return atualizarPerfil(perfis, perfilId, { nome, cpf });
}

// Devolve o perfil apontado pela sessão, ou null. O id guardado pode ter
// virado pó desde que foi escrito (perfil excluído noutra aba, dado do
// navegador limpo pela metade), e nesse caso a resposta certa é a tela de
// perfis, não um app apontando para um titular que não existe mais.
export function perfilDaSessao(perfis, idSalvo) {
  if (!idSalvo || !Array.isArray(perfis)) return null;
  return perfis.find(p => p && p.id === idSalvo) || null;
}

// Migração de quem já usava o app ANTES de perfis existirem: os dados
// ficavam soltos numa chave única (LEGADO_STORAGE_KEY). Na primeira
// abertura depois dessa mudança, sem isso a pessoa cairia numa tela de
// seleção vazia parecendo ter perdido tudo. Vira o primeiro perfil da
// lista, com os MESMOS dados (a chamadora é quem copia o valor bruto do
// localStorage de uma chave pra outra; aqui só decide o `nome`/`cpf` do
// perfil a partir do que já tinha).
export function perfilAPartirDeDadosLegados(dadosLegado, agora = new Date()) {
  const contribuinte = dadosLegado?.contribuinte;
  return novoPerfil({ nome: contribuinte?.nome, cpf: contribuinte?.cpf, apelido: '' }, agora);
}
