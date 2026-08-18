import { useData } from '../store/DataContext';
import { hasWorkingData as hasWorkingDataCheck } from '../store/reducer';

const navItems = [
  { id: 'importar', label: 'Importar Declaração', short: 'IM', section: 'VISÃO GERAL' },
  { id: 'dashboard', label: 'Dashboard', short: 'DB', section: 'VISÃO GERAL' },
  { id: 'bens', label: 'Bens e Direitos', short: 'BE', section: 'CADASTROS' },
  { id: 'dividas', label: 'Dívidas e Ônus', short: 'DV', section: 'CADASTROS' },
  { id: 'rendimentos', label: 'Rendimentos', short: 'RE', section: 'CADASTROS' },
  { id: 'pagamentos', label: 'Pagamentos', short: 'PG', section: 'CADASTROS' },
  { id: 'pagamentosDiversos', label: 'Despesas Gerais', short: 'DG', section: 'CADASTROS' },
  { id: 'atividadeRural', label: 'Atividade Rural', short: 'AR', section: 'ATIVIDADE RURAL' },
  { id: 'relatorio', label: 'Relatório IRPF', short: 'RL', section: 'RELATÓRIOS' },
  { id: 'ganhosCapital', label: 'Ganhos de Capital', short: 'GC', section: 'RELATÓRIOS' },
  { id: 'historico', label: 'Histórico', short: 'HS', section: 'RELATÓRIOS' },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapsed }) {
  const { state, dispatch, addToast } = useData();
  let lastSection = '';

  // Só anos com dado real (histórico + ano em edição). Antes da 1ª
  // importação não há ano nenhum — o seletor fica oculto e no lugar aparece
  // o onboarding.
  const anosComDados = [...new Set([...Object.keys(state.historico).map(Number), state.anoCalendario].filter(y => y != null))].sort((a, b) => a - b);
  const proximoAno = anosComDados.length > 0 ? Math.max(...anosComDados) + 1 : new Date().getFullYear();
  const hasWorkingData = hasWorkingDataCheck(state);

  const avancarAno = () => {
    const confirmado = !hasWorkingData || state.anoCalendario == null || confirm(
      `Iniciar o ano-calendário ${proximoAno}?\n\n` +
      `A situação em 31/12/${state.anoCalendario} de cada bem e dívida vira a situação anterior de ${proximoAno}. ` +
      `Os valores atuais começam iguais, até você registrar uma movimentação real durante o ano.`
    );
    if (!confirmado) return;
    dispatch({ type: 'ROLLOVER_ANO', payload: proximoAno });
    addToast(`Ano-calendário ${proximoAno} iniciado.`, 'success');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        onClick={onToggleCollapsed}
      >
        {collapsed ? '»' : '«'}
      </button>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">VP</div>
          {!collapsed && (
            <div className="logo-text">
              <h1>Variação Patrimonial</h1>
              <span>Controle IRPF</span>
            </div>
          )}
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map(item => {
          const showSection = !collapsed && item.section !== lastSection;
          lastSection = item.section;
          return (
            <div key={item.id}>
              {showSection && <div className="nav-section-label">{item.section}</div>}
              <button
                className={`nav-item ${activeView === item.id ? 'active' : ''}`}
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
              >
                {collapsed ? item.short : item.label}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        {state.anoCalendario == null ? (
          // Onboarding: nenhum ano definido ainda. O caminho principal é
          // importar a declaração do ano anterior (define o ano sozinho);
          // quem preferir pode começar cadastrando à mão no ano corrente.
          collapsed ? null : (
            <>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                Importe a primeira declaração para definir o ano-calendário, ou comece cadastrando à mão:
              </p>
              <button
                className="btn btn-sm btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={avancarAno}
              >
                Começar pelo ano {proximoAno}
              </button>
            </>
          )
        ) : collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button className="btn btn-sm btn-secondary" title={`Avançar para ${proximoAno}`} onClick={avancarAno}>→</button>
          </div>
        ) : (
          <>
            <div className="year-selector">
              <select
                value={state.anoCalendario}
                onChange={e => {
                  const novoAno = parseInt(e.target.value);
                  if (novoAno === state.anoCalendario) return;
                  dispatch({ type: 'SWITCH_ANO', payload: novoAno });
                  addToast(`Ano-calendário alterado para ${novoAno}`, 'info');
                }}
              >
                {/* Só lista os anos que realmente têm dado (salvo no histórico
                    ou sendo editado agora). Uma lista fixa de anos que não
                    existem só confundia: nada para escolher, nenhuma
                    declaração ali. */}
                {anosComDados.map(y => (
                  <option key={y} value={y}>Ano-Calendário {y}</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-sm btn-secondary"
              style={{ width: '100%', marginTop: '8px', justifyContent: 'center' }}
              title={`Fecha ${state.anoCalendario} e inicia ${proximoAno} trazendo o saldo final como situação inicial`}
              onClick={avancarAno}
            >
              Avançar para {proximoAno}
            </button>
          </>
        )}
      </div>
    </aside>
  );
}