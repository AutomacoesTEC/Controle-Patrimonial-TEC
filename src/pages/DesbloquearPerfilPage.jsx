import { useState } from 'react';
import { iniciaisNome } from '../utils/formatters';
import { dataStorageKeyFor } from '../store/perfis';
import { derivarChave, descriptografarObjeto, ehEnvelopeCriptografado } from '../utils/crypto';

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
  </svg>
);

// Pede a senha do perfil escolhido e só então decriptografa o conteúdo
// salvo (ver src/utils/crypto.js). A chave derivada e o resultado
// decriptado só existem em memória — nunca voltam a tocar o disco fora do
// que o DataProvider grava criptografado de novo a cada mudança.
export default function DesbloquearPerfilPage({ perfil, theme, onToggleTheme, onDesbloqueado, onVoltar }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const chave = await derivarChave(senha, perfil.salt);
      const raw = localStorage.getItem(dataStorageKeyFor(perfil.id));
      const envelope = raw ? JSON.parse(raw) : null;
      const dados = envelope && ehEnvelopeCriptografado(envelope)
        ? await descriptografarObjeto(chave, envelope)
        : {};
      onDesbloqueado(chave, dados);
    } catch {
      setErro('Senha incorreta.');
      setCarregando(false);
    }
  };

  return (
    <div className="app-layout">
      <div className="launcher-ambient" />
      <button
        className="theme-toggle-fixed"
        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <main className="main-content" style={{ alignItems: 'center', justifyContent: 'center', overflowY: 'auto', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '380px', padding: '40px 20px', textAlign: 'center' }}>
          <div className="perfil-avatar" style={{ width: '64px', height: '64px', fontSize: '22px', margin: '0 auto 16px' }}>
            {iniciaisNome(perfil.nome)}
          </div>
          <h1 style={{ fontSize: '19px', fontWeight: 700, margin: 0 }}>{perfil.apelido || perfil.nome}</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 28px', fontSize: '13px' }}>Este perfil é protegido por senha</p>

          <form onSubmit={handleSubmit} className="card" style={{ textAlign: 'left' }}>
            <div className="form-group" style={{ marginBottom: erro ? '8px' : '20px' }}>
              <label>Senha</label>
              <input
                type="password"
                className={`form-control${erro ? ' form-control-invalid' : ''}`}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoFocus
              />
            </div>
            {erro && <p style={{ color: 'var(--accent-danger)', fontSize: '12px', marginBottom: '20px' }}>{erro}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={onVoltar}>Voltar</button>
              <button type="submit" className="btn btn-primary" disabled={!senha || carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
