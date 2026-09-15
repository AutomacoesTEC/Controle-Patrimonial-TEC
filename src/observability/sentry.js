import * as Sentry from '@sentry/react';

// App fiscal: qualquer breadcrumb, contexto de erro ou stack de componente
// pode carregar CPF, valor ou discriminação de bem digitado pela usuária.
// Isso é filtrado ANTES de sair da máquina, não confiado à configuração do
// projeto Sentry (que pode mudar sem passar por este código).
const PADRAO_CPF_CNPJ = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const PADRAO_VALOR_BRL = /\b(?:R\$\s?)?-?\d{1,3}(?:\.\d{3})*,\d{2}\b/g;

function redigir(texto) {
  if (typeof texto !== 'string') return texto;
  return texto.replace(PADRAO_CPF_CNPJ, '[cpf/cnpj removido]').replace(PADRAO_VALOR_BRL, '[valor removido]');
}

function redigirProfundo(valor, profundidade = 0) {
  if (profundidade > 6 || valor == null) return valor;
  if (typeof valor === 'string') return redigir(valor);
  if (Array.isArray(valor)) return valor.map(item => redigirProfundo(item, profundidade + 1));
  if (typeof valor === 'object') {
    const saida = {};
    for (const [chave, item] of Object.entries(valor)) saida[chave] = redigirProfundo(item, profundidade + 1);
    return saida;
  }
  return valor;
}

export function iniciarObservabilidade() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // sem DSN, sem captura - não é erro, é o estado padrão sem configuração

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION,
    sendDefaultPii: false,
    // Replay/screenshot ficam fora de cogitação aqui: gravariam a tela com
    // CPF e valor de bem visíveis. Nem a versão "mask all text" entra,
    // porque a mensagem de erro precisa passar pela mesma redação abaixo.
    integrations: [],
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.message) breadcrumb.message = redigir(breadcrumb.message);
      if (breadcrumb.data) breadcrumb.data = redigirProfundo(breadcrumb.data);
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.message) event.message = redigir(event.message);
      if (event.exception?.values) {
        for (const excecao of event.exception.values) {
          if (excecao.value) excecao.value = redigir(excecao.value);
        }
      }
      if (event.extra) event.extra = redigirProfundo(event.extra);
      if (event.contexts) event.contexts = redigirProfundo(event.contexts);
      event.request = undefined; // URL/query nunca é útil aqui e pode carregar parâmetro sensível
      return event;
    },
  });
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
