import { describe, it, expect } from 'vitest';
import {
  novoPerfil, adicionarPerfil, atualizarPerfil, removerPerfil,
  sincronizarPerfilComContribuinte, perfilAPartirDeDadosLegados, dataStorageKeyFor,
  protegerPerfil, desprotegerPerfil,
} from './perfis';

const AGORA = new Date('2026-08-19T12:00:00.000Z');

describe('novoPerfil', () => {
  it('normaliza cpf (só dígitos) e nome/apelido (trim)', () => {
    const p = novoPerfil({ nome: '  Fulano de Tal  ', cpf: '111.111.111-11', apelido: ' Cliente A ' }, AGORA);
    expect(p.nome).toBe('Fulano de Tal');
    expect(p.cpf).toBe('11111111111');
    expect(p.apelido).toBe('Cliente A');
    expect(p.criadoEm).toBe(AGORA.toISOString());
  });

  it('gera ids diferentes para dois perfis criados em sequência', () => {
    const a = novoPerfil({ nome: 'A' }, AGORA);
    const b = novoPerfil({ nome: 'B' }, AGORA);
    expect(a.id).not.toBe(b.id);
  });
});

describe('adicionarPerfil/atualizarPerfil/removerPerfil', () => {
  it('adiciona, atualiza campos por id e remove por id, sem mexer nos outros perfis', () => {
    const p1 = novoPerfil({ nome: 'Fulano' }, AGORA);
    const p2 = novoPerfil({ nome: 'Cicrano' }, new Date(AGORA.getTime() + 1000));
    let perfis = adicionarPerfil(adicionarPerfil([], p1), p2);
    expect(perfis).toHaveLength(2);

    perfis = atualizarPerfil(perfis, p1.id, { apelido: 'Cliente A' });
    expect(perfis.find(p => p.id === p1.id).apelido).toBe('Cliente A');
    expect(perfis.find(p => p.id === p2.id).apelido).toBe('');

    perfis = removerPerfil(perfis, p1.id);
    expect(perfis).toHaveLength(1);
    expect(perfis[0].id).toBe(p2.id);
  });
});

describe('sincronizarPerfilComContribuinte', () => {
  it('atualiza nome/cpf do perfil quando o contribuinte muda, sem tocar no apelido', () => {
    const p = { ...novoPerfil({ nome: 'Nome Antigo', cpf: '11111111111' }, AGORA), apelido: 'Cliente A' };
    let perfis = [p];
    perfis = sincronizarPerfilComContribuinte(perfis, p.id, { nome: 'Nome Corrigido', cpf: '22222222222' });
    expect(perfis[0].nome).toBe('Nome Corrigido');
    expect(perfis[0].cpf).toBe('22222222222');
    expect(perfis[0].apelido).toBe('Cliente A');
  });

  it('não mexe na lista quando o contribuinte é nulo ou vazio', () => {
    const p = novoPerfil({ nome: 'Fulano' }, AGORA);
    const perfis = [p];
    expect(sincronizarPerfilComContribuinte(perfis, p.id, null)).toBe(perfis);
    expect(sincronizarPerfilComContribuinte(perfis, p.id, { nome: '', cpf: '' })).toBe(perfis);
  });

  it('não mexe na lista quando nome/cpf já batem (evita re-render/save à toa)', () => {
    const p = novoPerfil({ nome: 'Fulano', cpf: '11111111111' }, AGORA);
    const perfis = [p];
    expect(sincronizarPerfilComContribuinte(perfis, p.id, { nome: 'Fulano', cpf: '11111111111' })).toBe(perfis);
  });
});

describe('perfilAPartirDeDadosLegados (migração de quem já usava o app antes de perfis existirem)', () => {
  it('usa o contribuinte já salvo nos dados legados como identidade do primeiro perfil', () => {
    const p = perfilAPartirDeDadosLegados({ contribuinte: { nome: 'Fulano de Tal', cpf: '11111111111' } }, AGORA);
    expect(p.nome).toBe('Fulano de Tal');
    expect(p.cpf).toBe('11111111111');
  });

  it('não quebra quando os dados legados não têm contribuinte definido ainda', () => {
    const p = perfilAPartirDeDadosLegados({}, AGORA);
    expect(p.nome).toBe('');
    expect(p.cpf).toBe('');
  });
});

describe('novoPerfil nasce sem proteção', () => {
  it('protegido começa false e salt null', () => {
    const p = novoPerfil({ nome: 'Fulano' }, AGORA);
    expect(p.protegido).toBe(false);
    expect(p.salt).toBe(null);
  });
});

describe('protegerPerfil/desprotegerPerfil', () => {
  it('liga a proteção com o salt informado, sem mexer nos outros campos', () => {
    const p = novoPerfil({ nome: 'Fulano' }, AGORA);
    let perfis = [p];
    perfis = protegerPerfil(perfis, p.id, 'salt-base64-qualquer');
    expect(perfis[0].protegido).toBe(true);
    expect(perfis[0].salt).toBe('salt-base64-qualquer');
    expect(perfis[0].nome).toBe('Fulano');
  });

  it('desliga a proteção e limpa o salt', () => {
    const p = { ...novoPerfil({ nome: 'Fulano' }, AGORA), protegido: true, salt: 'algum-salt' };
    let perfis = [p];
    perfis = desprotegerPerfil(perfis, p.id);
    expect(perfis[0].protegido).toBe(false);
    expect(perfis[0].salt).toBe(null);
  });
});

describe('dataStorageKeyFor', () => {
  it('gera uma chave de localStorage diferente por perfil (isolamento)', () => {
    expect(dataStorageKeyFor('abc')).toBe('controle-patrimonial-data-abc');
    expect(dataStorageKeyFor('abc')).not.toBe(dataStorageKeyFor('xyz'));
  });
});
