import { useState } from 'react';
import { formatCpfCnpj, iniciaisNome } from '../utils/formatters';
import {
  PERFIS_STORAGE_KEY, PERFIL_ATIVO_STORAGE_KEY,
  novoPerfil, adicionarPerfil, removerPerfil, atualizarPerfil, protegerPerfil, dataStorageKeyFor,
} from '../store/perfis';
import { gerarSaltBase64, derivarChave, criptografarObjeto } from '../utils/crypto';

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
const LockIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" {...props}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

const FORM_VAZIO = { nome: '', cpf: '', apelido: '' };
const SENHA_VAZIA = { senha: '', confirmar: '' };

// Tela de entrada do app: cada perfil é um titular inteiro, com seus
// próprios anos/bens/dívidas/dependentes guardados numa chave de
// localStorage isolada da dos outros perfis (ver perfis.js). Escolher um
// perfil aqui é a única forma de entrar nos dados dele — não existe um
// jeito de "ver os dois ao mesmo tempo" de propósito, pra nunca misturar
// titulares diferentes. Quem decide se pede senha antes de entrar é o
// App.jsx (ver onSelecionarPerfil): aqui só entrega o perfil escolhido.
export default function PerfilLauncherPage({ theme, onToggleTheme, onSelecionarPerfil }) {
  const [perfis, setPerfis] = useState(() => {
    try { return JSON.parse(localStorage.getItem(PERFIS_STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [formOpen, setFormOpen] = useState(perfis.length === 0);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoApelidoId, setEditandoApelidoId] = useState(null);
  const [apelidoEdicao, setApelidoEdicao] = useState('');
  const [protegendoId, setProtegendoId] = useState(null);
  const [senhaForm, setSenhaForm] = useState(SENHA_VAZIA);
  const [senhaErro, setSenhaErro] = useState('');

  const persistir = (novaLista) => {
    setPerfis(novaLista);
    try { localStorage.setItem(PERFIS_STORAGE_KEY, JSON.stringify(novaLista)); } catch {}
  };

  const handleCriarPerfil = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return;
    const perfil = novoPerfil(form);
    persistir(adicionarPerfil(perfis, perfil));
    // O nome/CPF digitados aqui já são o titular — sem isso, a pessoa
    // acabava de digitar o nome e teria que digitar de novo na tela
    // Titular e Dependentes assim que entrasse no perfil.
    try {
      localStorage.setItem(dataStorageKeyFor(perfil.id), JSON.stringify({ contribuinte: { nome: perfil.nome, cpf: perfil.cpf } }));
    } catch {}
    onSelecionarPerfil(perfil);
  };

  const handleExcluirPerfil = (e, perfil) => {
    e.stopPropagation();
    const confirmado = confirm(
      `EXCLUIR o perfil "${perfil.apelido || perfil.nome || 'sem nome'}"?\n\n` +
      `Todos os anos, bens, dívidas, rendimentos e dependentes cadastrados nele são apagados por completo. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    try {
      localStorage.removeItem(dataStorageKeyFor(perfil.id));
      if (localStorage.getItem(PERFIL_ATIVO_STORAGE_KEY) === perfil.id) localStorage.removeItem(PERFIL_ATIVO_STORAGE_KEY);
    } catch {}
    persistir(removerPerfil(perfis, perfil.id));
  };

  const iniciarEdicaoApelido = (e, perfil) => {
    e.stopPropagation();
    setEditandoApelidoId(perfil.id);
    setApelidoEdicao(perfil.apelido || '');
  };
  const salvarApelido = (e, perfilId) => {
    e.stopPropagation();
    persistir(atualizarPerfil(perfis, perfilId, { apelido: apelidoEdicao.trim() }));
    setEditandoApelidoId(null);
  };

  const iniciarProtecao = (e, perfil) => {
    e.stopPropagation();
    setProtegendoId(perfil.id);
    setSenhaForm(SENHA_VAZIA);
    setSenhaErro('');
  };

  // Cripografa o que já está salvo (texto puro, já que o perfil ainda não
  // era protegido) com uma chave nova derivada da senha — dali em diante,
  // sem a senha, o conteúdo desse perfil é ilegível de verdade (ver
  // src/utils/crypto.js). A senha em si nunca é gravada, só o salt.
  const confirmarProtecao = async (e, perfil) => {
    e.stopPropagation();
    if (senhaForm.senha.length < 6) { setSenhaErro('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (senhaForm.senha !== senhaForm.confirmar) { setSenhaErro('As senhas não coincidem.'); return; }
    try {
      const salt = gerarSaltBase64();
      const chave = await derivarChave(senhaForm.senha, salt);
      const atualRaw = localStorage.getItem(dataStorageKeyFor(perfil.id));
      const atual = atualRaw ? JSON.parse(atualRaw) : {};
      const envelope = await criptografarObjeto(chave, atual);
      localStorage.setItem(dataStorageKeyFor(perfil.id), JSON.stringify(envelope));
      persistir(protegerPerfil(perfis, perfil.id, salt));
      setProtegendoId(null);
    } catch {
      setSenhaErro('Não foi possível ativar a proteção. Tente novamente.');
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
        <div style={{ width: '100%', maxWidth: '560px', padding: '40px 20px' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div className="launcher-logo">CP</div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '20px 0 0', letterSpacing: '-0.02em' }}>
              Controle Patrimonial <span className="perfil-apelido-badge" style={{ fontSize: '13px', padding: '3px 10px', verticalAlign: 'middle' }}>TEC</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '14px' }}>Selecione um perfil para continuar, ou cadastre um novo titular</p>
          </div>

          {perfis.length > 0 && (
            <div style={{ display: 'grid', gap: '12px', marginBottom: formOpen ? '24px' : '0' }}>
              {perfis.map(p => (
                <div key={p.id} className="perfil-card" onClick={() => onSelecionarPerfil(p)}>
                  <div className="perfil-avatar">{iniciaisNome(p.nome)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '15px', fontWeight: 700 }}>{p.nome || 'Sem nome'}</span>
                      {p.apelido && <span className="perfil-apelido-badge">{p.apelido}</span>}
                      {p.protegido && <span title="Protegido por senha" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}><LockIcon /></span>}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                      {p.cpf ? formatCpfCnpj(p.cpf) : 'CPF não informado'}
                    </div>
                    {editandoApelidoId === p.id ? (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                        <input className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={apelidoEdicao} onChange={e => setApelidoEdicao(e.target.value)} placeholder="Apelido (opcional)" autoFocus />
                        <button className="btn btn-sm btn-primary" onClick={e => salvarApelido(e, p.id)}>Salvar</button>
                      </div>
                    ) : protegendoId === p.id ? (
                      <div style={{ marginTop: '10px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input type="password" className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={senhaForm.senha} onChange={e => setSenhaForm(s => ({ ...s, senha: e.target.value }))} placeholder="Senha (mín. 6 caracteres)" autoFocus />
                          <input type="password" className="form-control" style={{ padding: '4px 8px', fontSize: '12px' }} value={senhaForm.confirmar} onChange={e => setSenhaForm(s => ({ ...s, confirmar: e.target.value }))} placeholder="Confirmar senha" />
                          <button className="btn btn-sm btn-primary" onClick={e => confirmarProtecao(e, p)}>Ativar</button>
                        </div>
                        {senhaErro && <p style={{ color: 'var(--accent-danger)', fontSize: '11px', marginTop: '4px' }}>{senhaErro}</p>}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
                        <button className="perfil-link-btn" onClick={e => iniciarEdicaoApelido(e, p)}>
                          {p.apelido ? 'Editar apelido' : '+ Apelido'}
                        </button>
                        {!p.protegido && (
                          <button className="perfil-link-btn" onClick={e => iniciarProtecao(e, p)}>Proteger com senha</button>
                        )}
                      </div>
                    )}
                  </div>
                  <button className="btn btn-sm btn-danger" onClick={e => handleExcluirPerfil(e, p)}>Excluir</button>
                </div>
              ))}
              {!formOpen && (
                <button className="perfil-add-card" onClick={() => { setForm(FORM_VAZIO); setFormOpen(true); }}>
                  ＋ Novo Perfil
                </button>
              )}
            </div>
          )}

          {formOpen && (
            <div className="card">
              <div className="card-header"><h3 className="card-title">Novo Perfil</h3></div>
              <form onSubmit={handleCriarPerfil}>
                <div style={{ padding: '0 16px' }}>
                  <div className="form-group"><label>Nome do Titular</label><input className="form-control" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} autoFocus /></div>
                  <div className="form-row">
                    <div className="form-group"><label>CPF</label><input className="form-control" value={form.cpf} onChange={e => setForm(p => ({ ...p, cpf: e.target.value }))} placeholder="Opcional, se já souber" /></div>
                    <div className="form-group"><label>Apelido</label><input className="form-control" value={form.apelido} onChange={e => setForm(p => ({ ...p, apelido: e.target.value }))} placeholder="Ex: Cliente A" /></div>
                  </div>
                </div>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  {perfis.length > 0 && <button type="button" className="btn btn-secondary" onClick={() => setFormOpen(false)}>Cancelar</button>}
                  <button type="submit" className="btn btn-primary" disabled={!form.nome.trim()}>Criar e Entrar</button>
                </div>
              </form>
            </div>
          )}

          {perfis.length === 0 && !formOpen && (
            <div className="card"><div className="empty-state" style={{ padding: '40px 20px' }}>
              <p style={{ fontSize: '16px', fontWeight: 600 }}>Nenhum perfil cadastrado ainda</p>
              <p>Cada perfil é um titular (com seus dependentes, bens, dívidas etc.), isolado dos demais.</p>
            </div></div>
          )}
        </div>
      </main>
    </div>
  );
}
