// Lógica pura do registro de perfis (titulares). Cada perfil é uma pessoa
// (titular) com seus próprios anos-calendário, bens, dívidas, dependentes
// etc. — um app inteiro à parte por baixo dos panos, isolado dos demais
// perfis por guardar os dados sob uma CHAVE DE LOCALSTORAGE DIFERENTE (ver
// dataStorageKeyFor). Este módulo só monta/edita a LISTA de perfis (nome,
// cpf, apelido) em memória; a leitura/escrita real no localStorage fica no
// chamador (App.jsx), pelo mesmo motivo de reducer.js ficar puro: testável
// sem montar nada.

export const PERFIS_STORAGE_KEY = 'controle-patrimonial-perfis';
export const PERFIL_ATIVO_STORAGE_KEY = 'controle-patrimonial-perfil-ativo';
export const LEGADO_STORAGE_KEY = 'controle-patrimonial-data';

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

// Qual perfil abrir sozinho ao iniciar o app (sem passar pela tela de
// seleção), a partir do que ficou salvo da última vez. Só resume se esse
// perfil ainda existir na lista — ele pode ter sido excluído entre uma
// sessão e outra, e nesse caso o app NUNCA entra sozinho em outro perfil
// qualquer (isso seria misturar sem a pessoa escolher). "Trocar perfil"
// (ver App.jsx) limpa esse ponteiro de propósito, pra próxima abertura
// pedir a escolha de novo.
export function perfilParaResumir(perfis, perfilAtivoSalvo) {
  if (!perfilAtivoSalvo) return null;
  return perfis.some(p => p.id === perfilAtivoSalvo) ? perfilAtivoSalvo : null;
}
