// Criptografia dos dados de um perfil protegido por senha: AES-GCM de
// 256 bits, com a chave derivada da senha via PBKDF2 (Web Crypto nativo
// do navegador — sem dependência externa, sem biblioteca de terceiros
// mexendo com dado sensível). A senha em si NUNCA é gravada em lugar
// nenhum: só a CHAVE DERIVADA fica em memória (ver App.jsx), enquanto o
// perfil estiver desbloqueado — fechar o app ou trocar de perfil apaga
// essa chave, e a próxima entrada exige a senha de novo. Sem a senha
// certa, o AES-GCM falha ao decriptar (é autenticado, não tem "quase
// certo" nem decriptação parcial) — a chamadora decide o que fazer com
// esse erro (mostrar "senha incorreta").

const ITERACOES_PBKDF2 = 210000; // piso recomendado (OWASP) pra PBKDF2-SHA256 em 2024+

export function gerarSaltBase64() {
  return bufferParaBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function derivarChave(senha, saltBase64) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ParaBuffer(saltBase64), iterations: ITERACOES_PBKDF2, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function criptografarObjeto(chave, objeto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = new TextEncoder().encode(JSON.stringify(objeto));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, dados);
  return { v: 1, iv: bufferParaBase64(iv), ciphertext: bufferParaBase64(ciphertext) };
}

export async function descriptografarObjeto(chave, envelope) {
  const iv = base64ParaBuffer(envelope.iv);
  const ciphertext = base64ParaBuffer(envelope.ciphertext);
  const dados = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, ciphertext);
  return JSON.parse(new TextDecoder().decode(dados));
}

// Distingue um valor salvo criptografado (envelope {v,iv,ciphertext}) de
// um JSON normal — usado ao carregar, pra saber se precisa de senha antes
// de conseguir ler qualquer coisa.
export function ehEnvelopeCriptografado(valor) {
  return !!valor && typeof valor === 'object' &&
    valor.v === 1 && typeof valor.iv === 'string' && typeof valor.ciphertext === 'string';
}

function bufferParaBase64(buffer) {
  let binario = '';
  for (const byte of new Uint8Array(buffer)) binario += String.fromCharCode(byte);
  return btoa(binario);
}
function base64ParaBuffer(base64) {
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}
