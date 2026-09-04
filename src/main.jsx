import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { iniciarQuandoPersistenciaPronta } from './store/bootstrapDesktop'

const root = document.getElementById('root')
const renderizar = () => ReactDOM.createRoot(root).render(
  <React.StrictMode><App /></React.StrictMode>,
)

void iniciarQuandoPersistenciaPronta({ janela: window, storage: localStorage, iniciar: renderizar })
  .catch((erro) => {
    const painel = document.createElement('main')
    painel.style.cssText = 'max-width:640px;margin:15vh auto;padding:24px;font:16px system-ui;line-height:1.5'
    const titulo = document.createElement('h1')
    titulo.textContent = 'Não foi possível carregar os dados do computador'
    const detalhe = document.createElement('p')
    detalhe.textContent = erro?.message || 'Feche e abra o aplicativo novamente.'
    painel.append(titulo, detalhe)
    root.replaceChildren(painel)
  })
