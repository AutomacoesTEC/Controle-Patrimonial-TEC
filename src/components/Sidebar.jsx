import { useData } from '../store/DataContext';

const navItems = [
  { id: 'importar', label: 'Importar Declaração', icon: '📥', section: 'VISÃO GERAL' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊', section: 'VISÃO GERAL' },
  { id: 'bens', label: 'Bens e Direitos', icon: '🏠', section: 'CADASTROS' },
  { id: 'dividas', label: 'Dívidas e Ônus', icon: '💳', section: 'CADASTROS' },
  { id: 'rendimentos', label: 'Rendimentos', icon: '💰', section: 'CADASTROS' },
  { id: 'pagamentos', label: 'Pagamentos', icon: '🧾', section: 'CADASTROS' },
  { id: 'relatorio', label: 'Relatório IRPF', icon: '📋', section: 'RELATÓRIOS' },
  { id: 'historico', label: 'Histórico', icon: '🗂️', section: 'RELATÓRIOS' },
];

export default function Sidebar({ activeView, onNavigate }) {
  const { state, dispatch, saveToStorage, addToast } = useData();
  let lastSection = '';

  const anosComDados = [...new Set([...Object.keys(state.historico).map(Number), state.anoCalendario])].sort((a, b) => a - b);
  const proximoAno = Math.max(...anosComDados) + 1;
  const hasWorkingData = state.bens.length > 0 || state.dividas.length > 0 || state.rendimentos.length > 0 || state.pagamentos.length > 0;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">VP</div>
          <div className="logo-text">
            <h1>Variação Patrimonial</h1>
            <span>Controle IRPF</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const showSection = item.section !== lastSection;
          lastSection = item.section;
          return (
            <div key={item.id}>
              {showSection && <div className="nav-section-label">{item.section}</div>}
              <button
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                {item.label}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="year-selector">
          <span style={{ fontSize: '14px' }}>📅</span>
          <select
            value={state.anoCalendario}
            onChange={e => {
              const novoAno = parseInt(e.target.value);
              if (novoAno === state.anoCalendario) return;
              dispatch({ type: 'SWITCH_ANO', payload: novoAno });
              addToast(`Ano-calendário alterado para ${novoAno}`, 'info');
            }}
          >
            {/* Só lista os anos que realmente têm dado (salvo no histórico ou
                sendo editado agora). Uma lista fixa de anos que não existem
                só confundia: nada para escolher, nenhuma declaração ali. */}
            {anosComDados.map(y => (
              <option key={y} value={y}>Ano-Calendário {y}</option>
            ))}
          </select>
        </div>
        <button
          className="btn btn-sm btn-secondary"
          style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
          title={`Fecha ${state.anoCalendario} e inicia ${proximoAno} trazendo o saldo final como situação inicial`}
          onClick={() => {
            const semDadosAgora = !hasWorkingData;
            const confirmado = semDadosAgora
              ? true
              : confirm(
                  `Iniciar o ano-calendário ${proximoAno}?\n\n` +
                  `A situação em 31/12/${state.anoCalendario} de cada bem e dívida vira a situação anterior de ${proximoAno}. ` +
                  `Os valores atuais começam iguais, até você registrar uma movimentação real durante o ano.`
                );
            if (!confirmado) return;
            dispatch({ type: 'ROLLOVER_ANO', payload: proximoAno });
            addToast(`Ano-calendário ${proximoAno} iniciado.`, 'success');
          }}
        >
          ➡️ Avançar para {proximoAno}
        </button>
        <button className="btn btn-sm btn-secondary" style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
          onClick={saveToStorage}>
          💾 Salvar Dados
        </button>
      </div>
    </aside>
  );
}