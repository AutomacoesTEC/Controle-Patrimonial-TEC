import { describe, it, expect } from 'vitest';
import { initialState } from './reducer';
import { filtrarPorPessoa, rotuloTitularidade } from './titularidade';

const dependentes = [{ id: 1, nome: 'Ana', cpf: '33344455508' }, { id: 2, nome: 'Bia', cpf: '55566677720' }];
const s = { ...initialState, anoCalendario: 2026, dependentes,
  bens: [{ id: 1, beneficiario: 'Titular', situacao_atual: 100 },
    { id: 2, beneficiario: 'Dependente', cpf_beneficiario: '333.444.555-08', situacao_atual: 50 }],
  pagamentos: [{ id: 3, titularidade: 'dependente', titularidadeNome: 'Ana', valor_pago: 10 }, { id: 4, valor_pago: 20 }],
  historico: { 2025: { ...initialState, dependentes, rendimentos: [{ tipo: 'tributavel_pj', beneficiario: 'Dependente', cpf_dependente: '33344455508', valor: 500 }] } },
};
describe('recorte de titularidade', () => {
  it('visão geral conserva o objeto e todos os valores', () => expect(filtrarPorPessoa(s, 'todos')).toBe(s));
  it('titular não recebe os dados de dependentes nem os sem identificação', () => {
    const r = filtrarPorPessoa(s, 'titular');
    expect(r.bens.map(b => b.id)).toEqual([1]); expect(r.pagamentos).toHaveLength(0);
  });
  it('dependente é selecionado pelo CPF em todos os anos, incluindo nome legado inequívoco', () => {
    const r = filtrarPorPessoa(s, '33344455508');
    expect(r.bens.map(b => b.id)).toEqual([2]); expect(r.pagamentos.map(p => p.id)).toEqual([3]);
    expect(r.historico[2025].rendimentos[0].valor).toBe(500);
  });
  it('nomes iguais não identificam um dependente sem CPF', () => {
    const r = filtrarPorPessoa({ ...s, dependentes: dependentes.map(d => ({ ...d, nome: 'Ana' })) }, '33344455508');
    expect(r.pagamentos).toHaveLength(0);
  });
  it('rótulo mostra o nome do dependente e distingue a titularidade ausente', () => {
    expect(rotuloTitularidade(s.bens[1], dependentes)).toContain('Ana');
    expect(rotuloTitularidade({})).toBe('Não informada');
  });
});
