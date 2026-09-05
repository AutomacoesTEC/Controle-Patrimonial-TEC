import { expect, it } from 'vitest';
import { prepararBemParaSalvar } from './cadastroBem';

it('aquisição nova não cria saldo anterior à aquisição', () => {
  expect(prepararBemParaSalvar({ data_aquisicao: '2026-05-01', situacao_anterior: '100', situacao_atual: '100' })).toMatchObject({ situacao_anterior: 0, situacao_atual: 100 });
});
it('editar cadastro existente preserva saldos vivos e seus movimentos', () => {
  const liveBem = { situacao_anterior: 100, situacao_atual: 130, movimentacoes: [{ valor: 30 }] };
  expect(prepararBemParaSalvar({ data_aquisicao: '2010-05-01', situacao_anterior: '0', situacao_atual: '100', discriminacao: 'Revisado' }, liveBem)).toMatchObject({ ...liveBem, discriminacao: 'Revisado', data_aquisicao: '2010-05-01' });
});
it('conserva identificação e titularidade', () => {
  expect(prepararBemParaSalvar({ codigo_bem: '12', titularidade: 'dependente', cpf_beneficiario: '00000000000', situacao_atual: '50' })).toMatchObject({ codigo_bem: '12', titularidade: 'dependente', cpf_beneficiario: '00000000000', situacao_atual: 50 });
});
