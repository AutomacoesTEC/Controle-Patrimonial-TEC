import { describe, it, expect, beforeEach } from 'vitest';
import { inicializarAppInicial } from './App.jsx';
import {
  PERFIS_STORAGE_KEY, LEGADO_STORAGE_KEY, PERFIL_SESSAO_KEY, dataStorageKeyFor,
} from './store/perfis';

// localStorage/sessionStorage de mentira: os testes deste projeto rodam em
// Node puro, sem DOM. Só precisam do contrato que inicializarAppInicial usa.
function fakeStorage(inicial = {}) {
  const dados = { ...inicial };
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados,
  };
}
function instalarStorages(local = {}, sessao = {}) {
  globalThis.localStorage = fakeStorage(local);
  globalThis.sessionStorage = fakeStorage(sessao);
  return globalThis.localStorage._dados;
}

// Regra pedida pela usuária em 21/08/2026, nas duas metades: ABRIR o app
// depois de fechado cai na tela de perfis; ATUALIZAR a página (F5) mantém o
// titular aberto. Quem separa os dois casos é o armazenamento: a sessão vive
// em sessionStorage, que morre com a janela e sobrevive ao recarregar.
describe('inicializarAppInicial: abrir o app cai nos perfis, F5 mantém o titular', () => {
  const doisPerfis = JSON.stringify([
    { id: 'a', nome: 'FULANO', protegido: false },
    { id: 'b', nome: 'BELTRANO', protegido: false },
  ]);

  beforeEach(() => { delete globalThis.localStorage; delete globalThis.sessionStorage; });

  describe('sem sessão aberta, que é o caso de abrir o app depois de fechado', () => {
    it('instalação nova, sem nada salvo', () => {
      instalarStorages();
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
    });

    it('com perfis já cadastrados, não entra em nenhum', () => {
      instalarStorages({ [PERFIS_STORAGE_KEY]: doisPerfis });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
    });

    it('nem quando existe um ponteiro antigo de perfil ativo gravado', () => {
      // Chave de versões anteriores. Era de localStorage, e por isso retomava
      // o perfil até depois de fechar o app. Hoje ela não é mais lida nem
      // escrita, e sobrar no navegador de quem já usava o app não pode
      // ressuscitar o comportamento.
      instalarStorages({
        [PERFIS_STORAGE_KEY]: doisPerfis,
        'controle-patrimonial-perfil-ativo': 'a',
      });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
    });
  });

  describe('com sessão aberta, que é o caso do F5', () => {
    it('volta para o mesmo titular que estava aberto', () => {
      instalarStorages({ [PERFIS_STORAGE_KEY]: doisPerfis }, { [PERFIL_SESSAO_KEY]: 'b' });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: 'b', perfilPendente: null });
    });

    it('perfil protegido por senha volta para a TELA DE SENHA, nunca direto para o app', () => {
      // A chave derivada da senha só existe em memória e se perde no F5, então
      // entrar direto seria impossível de qualquer forma: sem ela não há como
      // decriptar o conteúdo do perfil.
      const protegido = { id: 'a', nome: 'FULANO', protegido: true, salt: 'xxx' };
      instalarStorages(
        { [PERFIS_STORAGE_KEY]: JSON.stringify([protegido]) },
        { [PERFIL_SESSAO_KEY]: 'a' },
      );
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: protegido });
    });

    it('sessão apontando para perfil que não existe mais cai na tela de perfis', () => {
      instalarStorages({ [PERFIS_STORAGE_KEY]: doisPerfis }, { [PERFIL_SESSAO_KEY]: 'excluido' });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
    });

    it('lista de perfis corrompida não entra em nada e não derruba o app', () => {
      instalarStorages({ [PERFIS_STORAGE_KEY]: '{isso não é json' }, { [PERFIL_SESSAO_KEY]: 'a' });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
    });
  });

  describe('migração de quem usava o app antes de perfis existirem', () => {
    it('cria o perfil, mas sem entrar nele', () => {
      const legado = JSON.stringify({ contribuinte: { nome: 'FULANO', cpf: '11111111111' }, bens: [{ id: 1 }] });
      const dados = instalarStorages({ [LEGADO_STORAGE_KEY]: legado });

      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });

      const perfis = JSON.parse(dados[PERFIS_STORAGE_KEY]);
      expect(perfis).toHaveLength(1);
      expect(perfis[0].nome).toBe('FULANO');
      // Os dados antigos viraram os dados do perfil novo, e a chave antiga
      // continua lá, inerte.
      expect(dados[dataStorageKeyFor(perfis[0].id)]).toBe(legado);
      expect(dados[LEGADO_STORAGE_KEY]).toBe(legado);
    });

    it('chave antiga vazia não vira perfil', () => {
      const dados = instalarStorages({ [LEGADO_STORAGE_KEY]: JSON.stringify({ bens: [], dividas: [] }) });
      expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
      expect(dados[PERFIS_STORAGE_KEY]).toBeUndefined();
    });
  });

  it('localStorage indisponível não derruba o app', () => {
    globalThis.localStorage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {}, removeItem: () => {} };
    globalThis.sessionStorage = fakeStorage();
    expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
  });

  it('sessionStorage indisponível não derruba o app, só perde a retomada', () => {
    globalThis.localStorage = fakeStorage({ [PERFIS_STORAGE_KEY]: doisPerfis });
    globalThis.sessionStorage = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => {}, removeItem: () => {} };
    expect(inicializarAppInicial()).toEqual({ perfilAtivo: null, perfilPendente: null });
  });
});
