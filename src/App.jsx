import { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { DataProvider, useData } from './store/DataContext';
import Sidebar from './components/Sidebar';
import PageSkeleton from './components/PageSkeleton';
import PerfilLauncherPage from './pages/PerfilLauncherPage';
import DesbloquearPerfilPage from './pages/DesbloquearPerfilPage';
import useRotulosAcessiveis from './components/useRotulosAcessiveis';
import useLegendasTabelas from './components/useLegendasTabelas';
import {
  PERFIS_STORAGE_KEY, PERFIL_SESSAO_KEY, perfilDaSessao,
} from './store/perfis';
import { migrarLegadoParaCache } from './store/bootstrapDesktop';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const TitularPage = lazy(() => import('./pages/TitularPage'));
const BensPage = lazy(() => import('./pages/BensPage'));
const DividasPage = lazy(() => import('./pages/DividasPage'));
const RendimentosPage = lazy(() => import('./pages/RendimentosPage'));
const PagamentosPage = lazy(() => import('./pages/PagamentosPage'));
const PagamentosDiversosPage = lazy(() => import('./pages/PagamentosDiversosPage'));
const DoacoesPage = lazy(() => import('./pages/DoacoesPage'));
const AtividadeRuralPage = lazy(() => import('./pages/AtividadeRuralPage'));
const GanhosCapitalPage = lazy(() => import('./pages/GanhosCapitalPage'));
const RendaVariavelPage = lazy(() => import('./pages/RendaVariavelPage'));
const RelatorioPage = lazy(() => import('./pages/RelatorioPage'));
const HistoricoPage = lazy(() => import('./pages/HistoricoPage'));
const ModalidadePage = lazy(() => import('./pages/ModalidadePage'));
const AcompanhamentoPage = lazy(() => import('./pages/AcompanhamentoPage'));
const RevisaoPeriodicaPage = lazy(() => import('./pages/RevisaoPeriodicaPage'));

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

// ABRIR o app (depois de fechado) cai na tela de perfis; ATUALIZAR a página
// (F5) mantém o titular que estava aberto. Pedido da usuária em 21/08/2026,
// nessas duas metades: com mais de um titular cadastrado, entrar sozinho no
// último usado ao abrir o app é convite a lançar dado na pessoa errada, e o
// preço de errar isso é alto (o app existe para montar declaração). Mas
// recarregar a página no meio do trabalho é outra coisa, e voltar para a
// lista ali só atrapalha.
//
// Quem separa os dois casos é o ARMAZENAMENTO: PERFIL_SESSAO_KEY vive em
// sessionStorage, que sobrevive ao F5 e morre com a janela (ou com o
// fechamento do app no Electron). Nada disso passa por localStorage, senão a
// retomada voltaria a atravessar o fechamento do app.
//
// Perfil protegido por senha é caso à parte: a chave derivada da senha só
// existe em memória (ver sessaoProtegida/crypto.js) e se perde no F5. Aí a
// sessão leva à TELA DE SENHA daquele perfil, e não ao Dashboard: mantém a
// intenção da usuária sem furar a proteção.
//
// Esta função também faz a MIGRAÇÃO de quem usava o app antes de perfis
// existirem: os dados ficavam soltos numa chave antiga, e viram o primeiro
// perfil automaticamente (a chave antiga não é apagada, fica inerte). Aí
// ninguém entra direto: o perfil é criado e a tela de perfis aparece com ele
// na lista, pronto para ser escolhido.
const APP_SEM_PERFIL = Object.freeze({ perfilAtivo: null, perfilPendente: null });

export function inicializarAppInicial() {
  let perfisRaw = null;
  try {
    perfisRaw = localStorage.getItem(PERFIS_STORAGE_KEY);
    if (!perfisRaw) {
      migrarLegadoParaCache(localStorage);
      // Perfil recém-migrado nunca tem sessão aberta: cai na tela de perfis.
      return APP_SEM_PERFIL;
    }
  } catch { return APP_SEM_PERFIL; }

  try {
    const idSalvo = sessionStorage.getItem(PERFIL_SESSAO_KEY);
    if (!idSalvo) return APP_SEM_PERFIL;
    const perfil = perfilDaSessao(JSON.parse(perfisRaw), idSalvo);
    if (!perfil) return APP_SEM_PERFIL;
    if (perfil.protegido) return { perfilAtivo: null, perfilPendente: perfil };
    return { perfilAtivo: perfil.id, perfilPendente: null };
  } catch {}
  return APP_SEM_PERFIL;
}

// Escrita/apagamento da sessão. Em try/catch pelo mesmo motivo do resto do
// arquivo: navegador com armazenamento bloqueado não pode derrubar o app,
// só perde a retomada no F5.
function lembrarPerfilDaSessao(perfilId) {
  try { sessionStorage.setItem(PERFIL_SESSAO_KEY, perfilId); } catch {}
}
function esquecerPerfilDaSessao() {
  try { sessionStorage.removeItem(PERFIL_SESSAO_KEY); } catch {}
}

function AppContent({ theme, onToggleTheme, onTrocarPerfil }) {
  const [activeView, setActiveView] = useState('dashboard');
  // Preenchido só quando a navegação partiu de um clique de "detalhe" no
  // Dashboard (ex.: clicar em "Bens e Direitos" na Variação Patrimonial) —
  // guarda pra onde/qual aba voltar. Navegação normal pela Sidebar limpa
  // isso, porque aí não faz sentido nenhum botão "Voltar ao Dashboard"
  // aparecer (a pessoa não veio de lá).
  const [dashboardRetorno, setDashboardRetorno] = useState(null);
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

  const navegarPelaSidebar = (view) => { setDashboardRetorno(null); setActiveView(view); };
  const navegarDoDashboard = (view, aba) => { setDashboardRetorno({ view, aba }); setActiveView(view); };
  const voltarAoDashboard = () => { setDashboardRetorno(null); setActiveView('dashboard'); };

  const renderPage = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard onNavigate={navegarDoDashboard} />;
      case 'acompanhamento': return <AcompanhamentoPage />;
      case 'revisaoPeriodica': return <RevisaoPeriodicaPage onNavigate={navegarPelaSidebar} />;
      case 'importar': return <ImportPage />;
      case 'titular': return <TitularPage />;
      case 'bens': return <BensPage onVoltar={dashboardRetorno?.view === 'bens' ? voltarAoDashboard : null} />;
      case 'dividas': return <DividasPage onVoltar={dashboardRetorno?.view === 'dividas' ? voltarAoDashboard : null} />;
      case 'rendimentos': return <RendimentosPage />;
      case 'pagamentos': return <PagamentosPage />;
      case 'pagamentosDiversos': return <PagamentosDiversosPage />;
      case 'doacoes': return <DoacoesPage />;
      case 'atividadeRural': return (
        <AtividadeRuralPage
          abaInicial={dashboardRetorno?.view === 'atividadeRural' ? dashboardRetorno.aba : undefined}
          onVoltar={dashboardRetorno?.view === 'atividadeRural' ? voltarAoDashboard : null}
        />
      );
      case 'ganhosCapital': return <GanhosCapitalPage />;
      case 'rendaVariavel': return <RendaVariavelPage onImportar={() => navegarPelaSidebar('importar')} />;
      case 'relatorio': return <RelatorioPage onImportar={() => navegarPelaSidebar('importar')} />;
      case 'historico': return <HistoricoPage onImportar={() => navegarPelaSidebar('importar')} />;
      case 'modalidade': return <ModalidadePage />;
      default: return <Dashboard onNavigate={navegarDoDashboard} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={navegarPelaSidebar} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} onTrocarPerfil={onTrocarPerfil} />
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
  useRotulosAcessiveis();
  useLegendasTabelas();
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
    esquecerPerfilDaSessao();
    setPerfilAtivo(null);
    setPerfilPendente(null);
    setSessaoProtegida(null);
  };

  const handleSelecionarPerfil = (perfil) => {
    // A sessão é gravada nos dois ramos: no protegido também, para que um F5
    // na tela de senha volte para a tela de senha DAQUELE perfil, e não para
    // a lista.
    lembrarPerfilDaSessao(perfil.id);
    if (perfil.protegido) {
      setPerfilPendente(perfil);
    } else {
      setPerfilAtivo(perfil.id);
    }
  };

  const handleDesbloqueado = (chave, dados) => {
    setSessaoProtegida({ chave, dados });
    lembrarPerfilDaSessao(perfilPendente.id);
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
