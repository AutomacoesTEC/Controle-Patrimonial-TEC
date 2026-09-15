import { describe, expect, it, vi } from 'vitest';

vi.mock('@sentry/react', () => ({ init: vi.fn(), ErrorBoundary: () => null }));

// beforeBreadcrumb/beforeSend não são exportados (não fazem sentido fora do
// Sentry.init), então o teste passa pela superfície pública real: chama
// iniciarObservabilidade com um DSN fake, captura os hooks que o mock de
// Sentry.init recebeu, e testa os hooks como a Sentry de verdade os chamaria.
import * as Sentry from '@sentry/react';
import { iniciarObservabilidade } from './sentry';

function pegarConfig() {
  vi.stubEnv('VITE_SENTRY_DSN', 'https://fake@sentry.example/1');
  iniciarObservabilidade();
  const config = Sentry.init.mock.calls.at(-1)[0];
  vi.unstubAllEnvs();
  return config;
}

describe('iniciarObservabilidade - redação de dado sensível', () => {
  it('não inicializa sem DSN configurado', () => {
    Sentry.init.mockClear();
    vi.stubEnv('VITE_SENTRY_DSN', '');
    iniciarObservabilidade();
    expect(Sentry.init).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('redige CPF em mensagem de breadcrumb', () => {
    const { beforeBreadcrumb } = pegarConfig();
    const resultado = beforeBreadcrumb({ message: 'Falha ao salvar titular 111.444.777-35' });
    expect(resultado.message).toBe('Falha ao salvar titular [cpf/cnpj removido]');
  });

  it('redige valor em reais em dado estruturado de breadcrumb', () => {
    const { beforeBreadcrumb } = pegarConfig();
    const resultado = beforeBreadcrumb({ data: { descricao: 'Venda de imóvel por R$ 450.000,00' } });
    expect(resultado.data.descricao).toBe('Venda de imóvel por [valor removido]');
  });

  it('redige CPF e valor dentro de event.extra aninhado, preservando o resto', () => {
    const { beforeSend } = pegarConfig();
    const evento = {
      extra: {
        bem: { discriminacao: 'Apartamento, CPF 123.456.789-09, valor 1.200.000,50', grupo: '01' },
      },
    };
    const resultado = beforeSend(evento);
    expect(resultado.extra.bem.discriminacao).toBe('Apartamento, CPF [cpf/cnpj removido], valor [valor removido]');
    expect(resultado.extra.bem.grupo).toBe('01');
  });

  it('remove event.request por completo (pode carregar querystring sensível)', () => {
    const { beforeSend } = pegarConfig();
    const resultado = beforeSend({ request: { url: 'http://localhost/?cpf=11144477735' } });
    expect(resultado.request).toBeUndefined();
  });

  it('redige a mensagem da exceção capturada', () => {
    const { beforeSend } = pegarConfig();
    const resultado = beforeSend({ exception: { values: [{ value: 'CPF 111.444.777-35 inválido' }] } });
    expect(resultado.exception.values[0].value).toBe('CPF [cpf/cnpj removido] inválido');
  });

  it('nunca declara integrations de replay/screenshot (gravaria a tela)', () => {
    const config = pegarConfig();
    expect(config.integrations).toEqual([]);
    expect(config.sendDefaultPii).toBe(false);
  });
});
