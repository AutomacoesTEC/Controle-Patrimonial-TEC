import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { DataProvider, useData } from './store/DataContext';
import Sidebar from './components/Sidebar';
import PageSkeleton from './components/PageSkeleton';
import PerfilLauncherPage from './pages/PerfilLauncherPage';
import DesbloquearPerfilPage from './pages/DesbloquearPerfilPage';
import { snapshotHasData } from './store/reducer';
import {
  PERFIS_STORAGE_KEY, PERFIL_ATIVO_STORAGE_KEY, LEGADO_STORAGE_KEY,
  perfilAPartirDeDadosLegados, perfilParaResumir, dataStorageKeyFor,
} from './store/perfis';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const TitularPage = lazy(() => import('./pages/TitularPage'));
const BensPage = lazy(() => import('./pages/BensPage'));
const DividasPage = lazy(() => import('./pages/DividasPage'));
const RendimentosPage = lazy(() => import('./pages/RendimentosPage'));
const PagamentosPage = lazy(() => import('./pages/PagamentosPage'));
const PagamentosDiversosPage = lazy(() => import('./pages/PagamentosDiversosPage'));
const AtividadeRuralPage = lazy(() => import('./pages/AtividadeRuralPage'));
const GanhosCapitalPage = lazy(() => import('./pages/GanhosCapitalPage'));
const RelatorioPage = lazy(() => import('./pages/RelatorioPage'));
const HistoricoPage = lazy(() => import('./pages/HistoricoPage'));

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

// Decide com QUAL perfil o app abre, sem depender de nada em tela ainda —
// roda uma vez, na inicialização do estado do componente App (ver
// inicialRef abaixo).
// 1) Se já existe um registro de perfis, resume o último usado (se ele
//    ainda existir). Um perfil PROTEGIDO por senha nunca é resumido direto
//    pro app — ele vira "perfilPendente" (pede a senha na hora, sem passar
//    pela lista de novo) porque resumir sozinho por cima da senha
//    derrotaria a proteção inteira.
// 2) Senão, é alguém que já usava o app ANTES de perfis existirem: os
//    dados estão soltos na chave antiga (LEGADO_STORAGE_KEY) — migra pra
//    virar o primeiro perfil automaticamente, sem exigir uma escolha (é a
//    mesma pessoa continuando de onde parou, não uma decisão nova). A
//    chave antiga não é apagada (fica inerte, só não é mais lida). Um
//    perfil recém-migrado nunca é protegido (senha não existia antes).
// 3) Instalação nova, sem perfil nem dado legado: tela de seleção,
//    convidando a criar o primeiro perfil.
function inicializarAppInicial() {
  try {
    const perfisSalvosRaw = localStorage.getItem(PERFIS_STORAGE_KEY);
    if (perfisSalvosRaw) {
      const perfis = JSON.parse(perfisSalvosRaw);
      const idResumir = perfilParaResumir(perfis, localStorage.getItem(PERFIL_ATIVO_STORAGE_KEY));
      if (idResumir) {
        const perfil = perfis.find(p => p.id === idResumir);
        if (perfil?.protegido) return { perfilAtivo: null, perfilPendente: perfil };
        return { perfilAtivo: idResumir, perfilPendente: null };
      }
      return { perfilAtivo: null, perfilPendente: null };
    }
    const dadosLegadoRaw = localStorage.getItem(LEGADO_STORAGE_KEY);
    if (dadosLegadoRaw) {
      const dadosLegado = JSON.parse(dadosLegadoRaw);
      if (snapshotHasData(dadosLegado)) {
        const perfil = perfilAPartirDeDadosLegados(dadosLegado);
        localStorage.setItem(dataStorageKeyFor(perfil.id), dadosLegadoRaw);
        localStorage.setItem(PERFIS_STORAGE_KEY, JSON.stringify([perfil]));
        localStorage.setItem(PERFIL_ATIVO_STORAGE_KEY, perfil.id);
        return { perfilAtivo: perfil.id, perfilPendente: null };
      }
    }
  } catch {}
  return { perfilAtivo: null, perfilPendente: null };
}

function AppContent({ theme, onToggleTheme, onTrocarPerfil }) {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('controle-patrimonial-sidebar') === 'collapsed'; } catch { return false; }
  });
  const { state } = useData();

  const toggleSidebar = () => {
    setSidebarCollapsed(prev => {
      const novo = !prev;
      try { localStorage.setItem('controle-patrimonial-sidebar', novo ? 'collapsed' : 'expanded'); } catch {}
      return novo;
    });
  };

  const renderPage = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'importar': return <ImportPage />;
      case 'titular': return <TitularPage />;
      case 'bens': return <BensPage />;
      case 'dividas': return <DividasPage />;
      case 'rendimentos': return <RendimentosPage />;
      case 'pagamentos': return <PagamentosPage />;
      case 'pagamentosDiversos': return <PagamentosDiversosPage />;
      case 'atividadeRural': return <AtividadeRuralPage />;
      case 'ganhosCapital': return <GanhosCapitalPage />;
      case 'relatorio': return <RelatorioPage />;
      case 'historico': return <HistoricoPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={setActiveView} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} onTrocarPerfil={onTrocarPerfil} />
      <button
        className="theme-toggle-fixed"
        title={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
        onClick={onToggleTheme}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
      <main className="main-content">
        <Suspense fallback={<PageSkeleton />}>
          {renderPage()}
        </Suspense>
      </main>
      {/* Toasts */}
      {state.toasts.length > 0 && (
        <div className="toast-container">
          {state.toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}${t.closing ? ' closing' : ''}`}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  // O tema vive aqui (não dentro de AppContent) porque também precisa
  // pintar a tela de seleção de perfil, que aparece ANTES de qualquer
  // perfil (e portanto antes do DataProvider) existir.
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('controle-patrimonial-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  const toggleTheme = () => {
    setTheme(prev => {
      const novo = prev === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('controle-patrimonial-theme', novo); } catch {}
      return novo;
    });
  };

  // A inicialização pode ter efeito colateral (migração do dado legado) —
  // roda exatamente uma vez, guardada num ref, nunca de novo em re-renders.
  const inicialRef = useRef(null);
  if (inicialRef.current === null) inicialRef.current = inicializarAppInicial();
  const [perfilAtivo, setPerfilAtivo] = useState(inicialRef.current.perfilAtivo);
  const [perfilPendente, setPerfilPendente] = useState(inicialRef.current.perfilPendente);
  // Chave derivada da senha (CryptoKey) e o conteúdo já decriptado do
  // perfil protegido que acabou de ser desbloqueado — só existem em
  // memória, nunca são persistidos (ver DesbloquearPerfilPage/crypto.js).
  // `dados` alimenta o DataProvider UMA VEZ (na montagem); depois disso ele
  // já vive dentro do estado do próprio DataProvider.
  const [sessaoProtegida, setSessaoProtegida] = useState(null); // { chave, dados } | null

  const handleTrocarPerfil = () => {
    try { localStorage.removeItem(PERFIL_ATIVO_STORAGE_KEY); } catch {}
    setPerfilAtivo(null);
    setPerfilPendente(null);
    setSessaoProtegida(null);
  };

  const handleSelecionarPerfil = (perfil) => {
    if (perfil.protegido) {
      setPerfilPendente(perfil);
    } else {
      try { localStorage.setItem(PERFIL_ATIVO_STORAGE_KEY, perfil.id); } catch {}
      setPerfilAtivo(perfil.id);
    }
  };

  const handleDesbloqueado = (chave, dados) => {
    try { localStorage.setItem(PERFIL_ATIVO_STORAGE_KEY, perfilPendente.id); } catch {}
    setSessaoProtegida({ chave, dados });
    setPerfilAtivo(perfilPendente.id);
    setPerfilPendente(null);
  };

  if (perfilPendente) {
    return (
      <DesbloquearPerfilPage
        perfil={perfilPendente}
        theme={theme}
        onToggleTheme={toggleTheme}
        onDesbloqueado={handleDesbloqueado}
        onVoltar={() => setPerfilPendente(null)}
      />
    );
  }

  if (perfilAtivo == null) {
    return <PerfilLauncherPage theme={theme} onToggleTheme={toggleTheme} onSelecionarPerfil={handleSelecionarPerfil} />;
  }

  return (
    // `key={perfilAtivo}` força o DataProvider a desmontar e remontar do
    // zero ao trocar de perfil — um useReducer NOVO lendo a chave de
    // localStorage do perfil novo, em vez de qualquer resquício do estado
    // do perfil anterior sobrevivendo por engano.
    <DataProvider key={perfilAtivo} perfilId={perfilAtivo} chave={sessaoProtegida?.chave} initialData={sessaoProtegida?.dados}>
      <AppContent theme={theme} onToggleTheme={toggleTheme} onTrocarPerfil={handleTrocarPerfil} />
    </DataProvider>
  );
}