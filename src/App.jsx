import { useState, useEffect } from 'react';
import { DataProvider, useData } from './store/DataContext';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ImportPage from './pages/ImportPage';
import BensPage from './pages/BensPage';
import DividasPage from './pages/DividasPage';
import RendimentosPage from './pages/RendimentosPage';
import PagamentosPage from './pages/PagamentosPage';
import RelatorioPage from './pages/RelatorioPage';
import HistoricoPage from './pages/HistoricoPage';

function AppContent() {
  const [activeView, setActiveView] = useState('dashboard');
  const { state } = useData();

  const renderPage = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'importar': return <ImportPage />;
      case 'bens': return <BensPage />;
      case 'dividas': return <DividasPage />;
      case 'rendimentos': return <RendimentosPage />;
      case 'pagamentos': return <PagamentosPage />;
      case 'relatorio': return <RelatorioPage />;
      case 'historico': return <HistoricoPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar activeView={activeView} onNavigate={setActiveView} />
      <main className="main-content">
        {renderPage()}
      </main>
      {/* Toasts */}
      {state.toasts.length > 0 && (
        <div className="toast-container">
          {state.toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type}`}>
              {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'} {t.message}
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