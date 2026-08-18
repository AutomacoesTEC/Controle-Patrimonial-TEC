import { useState, useEffect, Suspense, lazy } from 'react';
import { DataProvider, useData } from './store/DataContext';
import Sidebar from './components/Sidebar';
import PageSkeleton from './components/PageSkeleton';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const BensPage = lazy(() => import('./pages/BensPage'));
const DividasPage = lazy(() => import('./pages/DividasPage'));
const RendimentosPage = lazy(() => import('./pages/RendimentosPage'));
const PagamentosPage = lazy(() => import('./pages/PagamentosPage'));
const PagamentosDiversosPage = lazy(() => import('./pages/PagamentosDiversosPage'));
const AtividadeRuralPage = lazy(() => import('./pages/AtividadeRuralPage'));
const GanhosCapitalPage = lazy(() => import('./pages/GanhosCapitalPage'));
const RelatorioPage = lazy(() => import('./pages/RelatorioPage'));
const HistoricoPage = lazy(() => import('./pages/HistoricoPage'));

function AppContent() {
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
      <Sidebar activeView={activeView} onNavigate={setActiveView} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
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
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}