import { describe, it, expect } from 'vitest';
import { gerarSaltBase64, derivarChave, criptografarObjeto, descriptografarObjeto, ehEnvelopeCriptografado } from './crypto';

describe('criptografia de perfil (AES-GCM + PBKDF2, Web Crypto)', () => {
  it('criptografa e descriptografa de volta o mesmo objeto, com a senha certa', async () => {
    const salt = gerarSaltBase64();
    const chave = await derivarChave('minha senha forte', salt);
    const original = { bens: [{ id: 1, discriminacao: 'Apto' }], contribuinte: { nome: 'Fulano' } };
    const envelope = await criptografarObjeto(chave, original);
    const decriptado = await descriptografarObjeto(chave, envelope);
    expect(decriptado).toEqual(original);
  });

  it('falha ao descriptografar com a senha errada (autenticação do AES-GCM)', async () => {
    const salt = gerarSaltBase64();
    const chaveCerta = await derivarChave('senha-certa', salt);
    const chaveErrada = await derivarChave('senha-errada', salt);
    const envelope = await criptografarObjeto(chaveCerta, { segredo: 42 });
    await expect(descriptografarObjeto(chaveErrada, envelope)).rejects.toThrow();
  });

  it('salts diferentes produzem chaves diferentes para a mesma senha (não dá pra pré-computar uma chave por senha só)', async () => {
    const saltA = gerarSaltBase64();
    const saltB = gerarSaltBase64();
    expect(saltA).not.toBe(saltB);
    const chaveA = await derivarChave('mesma senha', saltA);
    const envelope = await criptografarObjeto(chaveA, { x: 1 });
    const chaveB = await derivarChave('mesma senha', saltB);
    await expect(descriptografarObjeto(chaveB, envelope)).rejects.toThrow();
  });

  it('ehEnvelopeCriptografado distingue um envelope de um objeto de dados normal', async () => {
    const salt = gerarSaltBase64();
    const chave = await derivarChave('senha', salt);
    const envelope = await criptografarObjeto(chave, { a: 1 });
    expect(ehEnvelopeCriptografado(envelope)).toBe(true);
    expect(ehEnvelopeCriptografado({ bens: [], dividas: [] })).toBe(false);
    expect(ehEnvelopeCriptografado(null)).toBe(false);
    expect(ehEnvelopeCriptografado('string qualquer')).toBe(false);
  });

  it('duas criptografias do mesmo objeto com a mesma chave usam IVs diferentes (nunca reusa nonce)', async () => {
    const salt = gerarSaltBase64();
    const chave = await derivarChave('senha', salt);
    const e1 = await criptografarObjeto(chave, { a: 1 });
    const e2 = await criptografarObjeto(chave, { a: 1 });
    expect(e1.iv).not.toBe(e2.iv);
    expect(e1.ciphertext).not.toBe(e2.ciphertext);
  });
});
