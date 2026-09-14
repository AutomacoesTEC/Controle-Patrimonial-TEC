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
    <div className="app-layout app-layout-entrada">
      <button
        className="theme-toggle-fixed"
        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      {/* Mesma estrutura de duas colunas da seleção de perfil, para que entrar
          no app seja sempre a mesma tela. */}
      <div className="entrada">
        <main className="entrada-coluna">
          <div className="entrada-conteudo">
            <div className="entrada-marca">
              <div className="entrada-marca-simbolo">CP</div>
              <div className="entrada-marca-nome">CP-TEC<span>Controle Patrimonial</span></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <div className="perfil-avatar">{iniciaisNome(perfil.nome)}</div>
              <h1 className="entrada-titulo">{perfil.apelido || perfil.nome}</h1>
            </div>
            <p className="entrada-subtitulo">Este perfil é protegido por senha.</p>

            <form onSubmit={handleSubmit}>
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
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!senha || carregando}>
                  {carregando ? 'Entrando...' : 'Entrar'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={onVoltar}>Voltar</button>
              </div>
            </form>
            <p className="entrada-rodape">O conteúdo deste perfil só é decifrado depois da senha correta.</p>
          </div>
        </main>
        <aside className="entrada-vitrine">
          <p className="entrada-vitrine-eyebrow">CP-TEC</p>
          <h2>O patrimônio do seu cliente, ano após ano.</h2>
          <div className="entrada-vitrine-regua" aria-hidden="true"><span /><span /></div>
          <p>
            Importe a declaração entregue, registre compra, venda e baixa ao longo do ano
            e feche 31/12 com a posição pronta para a próxima declaração.
          </p>
        </aside>
      </div>
    </div>
  );
}
