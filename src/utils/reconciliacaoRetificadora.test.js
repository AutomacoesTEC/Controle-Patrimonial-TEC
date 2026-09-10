import { describe, it, expect } from 'vitest';
import {
  sugerirVinculos, similaridade, chavePessoaRegistro, pessoasDefinidasEConflitantes,
} from './reconciliacaoRetificadora';

describe('sugerirVinculos (conciliação de retificadora)', () => {
  it('sugere vínculo entre item antigo e novo com mesmo código e discriminação parecida', () => {
    const antigos = [{ id: 1, codigo: '21', discriminacao: 'Apartamento Rua das Flores, 123' }];
    const novos = [{ codigo: '21', discriminacao: 'Apartamento Rua das Flores, 123 - matrícula 456' }];
    const r = sugerirVinculos(antigos, novos);
    expect(r.vinculos).toHaveLength(1);
    expect(r.vinculos[0].antigo.id).toBe(1);
    expect(r.novosOrfaos).toHaveLength(0);
    expect(r.antigosOrfaos).toHaveLength(0);
  });

  it('não sugere vínculo entre códigos diferentes, mesmo com texto idêntico', () => {
    const antigos = [{ id: 1, codigo: '21', discriminacao: 'Mesmo texto' }];
    const novos = [{ codigo: '12', discriminacao: 'Mesmo texto' }];
    const r = sugerirVinculos(antigos, novos);
    expect(r.vinculos).toHaveLength(0);
    expect(r.novosOrfaos).toHaveLength(1);
    expect(r.antigosOrfaos).toHaveLength(1);
  });

  it('item sem nenhum candidato parecido vira órfão dos dois lados', () => {
    const antigos = [{ id: 1, codigo: '21', discriminacao: 'Sítio Fazenda Boa Vista' }];
    const novos = [{ codigo: '21', discriminacao: 'Automóvel Fiat Uno 2015' }];
    const r = sugerirVinculos(antigos, novos);
    expect(r.vinculos).toHaveLength(0);
    expect(r.novosOrfaos).toHaveLength(1);
    expect(r.antigosOrfaos).toHaveLength(1);
  });

  it('vínculo é 1-para-1: dois novos não competem pelo mesmo antigo', () => {
    const antigos = [{ id: 1, codigo: '21', discriminacao: 'Apartamento Rua A' }];
    const novos = [
      { codigo: '21', discriminacao: 'Apartamento Rua A' },
      { codigo: '21', discriminacao: 'Apartamento Rua A (duplicata)' },
    ];
    const r = sugerirVinculos(antigos, novos);
    expect(r.vinculos).toHaveLength(1);
    expect(r.novosOrfaos).toHaveLength(1);
    expect(r.antigosOrfaos).toHaveLength(0);
  });

  it('similaridade de textos idênticos é 1 e de textos completamente diferentes é baixa', () => {
    expect(similaridade('Casa na Praia', 'Casa na Praia')).toBe(1);
    expect(similaridade('Casa na Praia', 'Fiat Uno')).toBeLessThan(0.2);
  });

  it('P06: não sugere vínculo entre Titular e Dependente com mesmo código e descrição', () => {
    const antigos = [{ id: 1, codigo_bem: '02', discriminacao: 'Aplicação renda fixa', beneficiario: 'Titular' }];
    const novos = [{ codigo_bem: '02', discriminacao: 'Aplicação renda fixa', beneficiario: 'Dependente', cpf_beneficiario: '22233344455' }];
    const r = sugerirVinculos(antigos, novos, 'codigo_bem');
    expect(r.vinculos).toHaveLength(0);
    expect(r.novosOrfaos).toHaveLength(1);
    expect(r.antigosOrfaos).toHaveLength(1);
  });

  it('P06: continua sugerindo quando as duas pontas são do mesmo titular', () => {
    const antigos = [{ id: 1, codigo_bem: '02', discriminacao: 'Aplicação renda fixa', beneficiario: 'Titular' }];
    const novos = [{ codigo_bem: '02', discriminacao: 'Aplicação renda fixa (corrigida)', beneficiario: 'Titular' }];
    const r = sugerirVinculos(antigos, novos, 'codigo_bem');
    expect(r.vinculos).toHaveLength(1);
  });

  it('P06: CPFs diferentes no mesmo rótulo também bloqueiam a sugestão', () => {
    const antigos = [{ id: 1, codigo_bem: '02', discriminacao: 'Aplicação', beneficiario: 'Dependente', cpf_beneficiario: '11122233344' }];
    const novos = [{ codigo_bem: '02', discriminacao: 'Aplicação', beneficiario: 'Dependente', cpf_beneficiario: '55566677788' }];
    const r = sugerirVinculos(antigos, novos, 'codigo_bem');
    expect(r.vinculos).toHaveLength(0);
  });

  it('chavePessoaRegistro / pessoasDefinidasEConflitantes', () => {
    expect(chavePessoaRegistro({ beneficiario: 'Titular' })).toBe('titular');
    expect(chavePessoaRegistro({ beneficiario: 'Dependente' })).toBe('dependente');
    expect(chavePessoaRegistro({ cpf_beneficiario: '111.222.333-44' })).toBe('cpf:11122233344');
    expect(chavePessoaRegistro({})).toBe('');
    expect(pessoasDefinidasEConflitantes({ beneficiario: 'Titular' }, { beneficiario: 'Dependente' })).toBe(true);
    expect(pessoasDefinidasEConflitantes({ beneficiario: 'Titular' }, { beneficiario: 'Titular' })).toBe(false);
    // Sem identificação de um dos lados: não bloqueia (ambíguo, não conflitante).
    expect(pessoasDefinidasEConflitantes({ beneficiario: 'Titular' }, {})).toBe(false);
  });

  it('bens usam codigo_bem (não codigo) — campoCodigo tem que ser respeitado, senão casa tudo com tudo', () => {
    // Bug real: bens guardam o código em `codigo_bem` (BemModal/importParsers),
    // não em `codigo` (esse é o campo das dívidas). Sem o parâmetro
    // campoCodigo, item.codigo dava undefined nos dois lados e undefined ===
    // undefined virava "mesmo código" pra qualquer par de bens.
    const antigos = [{ id: 1, codigo_bem: '21', discriminacao: 'Apartamento' }];
    const novos = [{ codigo_bem: '12', discriminacao: 'Fiat Uno' }]; // código diferente, nada a ver
    const r = sugerirVinculos(antigos, novos, 'codigo_bem');
    expect(r.vinculos).toHaveLength(0);
    expect(r.novosOrfaos).toHaveLength(1);
    expect(r.antigosOrfaos).toHaveLength(1);
  });
});
