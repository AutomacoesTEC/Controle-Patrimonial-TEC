import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { iniciarObservabilidade, SentryErrorBoundary } from './observability/sentry';
import { iniciarQuandoPersistenciaPronta } from './store/bootstrapDesktop';

iniciarObservabilidade();

const root = document.getElementById('root');
const estiloPainelErro = { maxWidth: '640px', margin: '15vh auto', padding: '24px', font: '16px system-ui', lineHeight: 1.5 };
const painelDeErro = ({ error }) => (
  <main style={estiloPainelErro}>
    <h1>Algo deu errado nesta tela</h1>
    <p>{error?.message || 'Feche e abra o aplicativo novamente. Nenhum dado foi perdido no disco.'}</p>
  </main>
);
const renderizar = () =>
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SentryErrorBoundary fallback={painelDeErro}>
        <App />
      </SentryErrorBoundary>
    </React.StrictMode>,
  );

void iniciarQuandoPersistenciaPronta({ janela: window, storage: localStorage, iniciar: renderizar }).catch(erro => {
  const painel = document.createElement('main');
  painel.style.cssText = 'max-width:640px;margin:15vh auto;padding:24px;font:16px system-ui;line-height:1.5';
  const titulo = document.createElement('h1');
  titulo.textContent = 'Não foi possível carregar os dados do computador';
  const detalhe = document.createElement('p');
  detalhe.textContent = erro?.message || 'Feche e abra o aplicativo novamente.';
  painel.append(titulo, detalhe);
  root.replaceChildren(painel);
});
