import { useState } from 'react';
import { useData } from '../store/DataContext';
import { hasWorkingData as hasWorkingDataCheck, snapshotHasData } from '../store/reducer';
import ConfirmarDependentesModal from './ConfirmarDependentesModal';

const navItems = [
  { id: 'importar', label: 'Importar Declaração', short: 'IM', section: 'VISÃO GERAL' },
  { id: 'dashboard', label: 'Dashboard', short: 'DB', section: 'VISÃO GERAL' },
  { id: 'titular', label: 'Titular e Dependentes', short: 'TD', section: 'CADASTROS' },
  { id: 'bens', label: 'Bens e Direitos', short: 'BE', section: 'CADASTROS' },
  { id: 'dividas', label: 'Dívidas e Ônus', short: 'DV', section: 'CADASTROS' },
  { id: 'rendimentos', label: 'Rendimentos', short: 'RE', section: 'CADASTROS' },
  { id: 'pagamentos', label: 'Pagamentos', short: 'PG', section: 'CADASTROS' },
  { id: 'pagamentosDiversos', label: 'Despesas Gerais', short: 'DG', section: 'CADASTROS' },
  { id: 'doacoes', label: 'Doações', short: 'DO', section: 'CADASTROS' },
  { id: 'atividadeRural', label: 'Atividade Rural', short: 'AR', section: 'ATIVIDADE RURAL' },
  { id: 'relatorio', label: 'Relatório IRPF', short: 'RL', section: 'RELATÓRIOS' },
  { id: 'ganhosCapital', label: 'Ganhos de Capital', short: 'GC', section: 'RELATÓRIOS' },
  { id: 'rendaVariavel', label: 'Renda Variável', short: 'RV', section: 'RELATÓRIOS' },
  { id: 'historico', label: 'Histórico de Alterações', short: 'HS', section: 'RELATÓRIOS' },
];

export default function Sidebar({ activeView, onNavigate, collapsed, onToggleCollapsed, onTrocarPerfil }) {
  const { state, dispatch, addToast } = useData();
  let lastSection = '';
  const [confirmarDependentesOpen, setConfirmarDependentesOpen] = useState(false);

  const avancarAno = (proximoAno) => {
    dispatch({ type: 'ROLLOVER_ANO', payload: proximoAno });
    addToast(`Ano-calendário ${proximoAno} iniciado.`, 'success');
  };

  // Só anos com dado real: ano em edição (se tiver conteúdo) + snapshots do
  // histórico que realmente têm dado — ano vazio herdado de versão antiga
  // ou avançado por engano não aparece.
  const anosComDados = [...new Set([
    ...Object.keys(state.historico).map(Number).filter(y => snapshotHasData(state.historico[y])),
    ...(hasWorkingDataCheck(state) && state.anoCalendario != null ? [state.anoCalendario] : []),
  ])].sort((a, b) => a - b);

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
          <div className="logo-icon">CP</div>
          {!collapsed && (
            <div className="logo-text">
              <h1>CP-TEC</h1>
              <span title={state.contribuinte?.nome || undefined}>{state.contribuinte?.nome || 'Variação Patrimonial · IRPF'}</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            className="btn btn-sm btn-secondary"
            style={{ width: '100%', marginTop: '10px' }}
            onClick={onTrocarPerfil}
            title="Voltar para a tela de seleção de perfil"
          >
            Trocar Perfil
          </button>
        )}
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
        {!collapsed && (
          <div className="year-selector">
            <select
              value={state.anoCalendario ?? ''}
              onChange={e => {
                const valor = e.target.value;
                // Achado real (usuária, 21/08/2026): registrar uma
                // movimentação num bem já existente não cria o ano seguinte
                // (só o campo "Ano-calendário" escondido dentro de um
                // formulário de "Novo X" fazia isso) — confuso, ela teve que
                // descobrir na unha. Essa opção resolve direto aqui: avança
                // pro ano seguinte ao ativo sem exigir nenhum cadastro.
                if (valor === '__avancar__') {
                  const proximoAno = state.anoCalendario + 1;
                  // Pedido real da usuária: dependente pode deixar de sê-lo
                  // de um ano pro outro — confirma antes de levar todo mundo
                  // adiante em silêncio (ver ConfirmarDependentesModal).
                  if (state.dependentes.length > 0) {
                    setConfirmarDependentesOpen(true);
                    return;
                  }
                  avancarAno(proximoAno);
                  return;
                }
                const novoAno = parseInt(valor);
                // Sem dado, o valor do "option" vazio é "" — parseInt vira
                // NaN, não um ano de verdade. Sem essa checagem, escolher
                // essa linha (que só existe pra confirmar que a lista abriu,
                // não pra ser selecionável) disparava SWITCH_ANO com NaN.
                if (Number.isNaN(novoAno) || novoAno === state.anoCalendario) return;
                dispatch({ type: 'SWITCH_ANO', payload: novoAno });
                addToast(`Ano-calendário alterado para ${novoAno}`, 'info');
              }}
            >
              {/* Acompanha os dados que o app realmente tem: nenhum ano
                  cadastrado ainda, nenhuma opção pra escolher — o primeiro
                  ano nasce sozinho ao importar uma declaração ou ao criar o
                  primeiro registro em qualquer cadastro (ver
                  AnoCalendarioModal, que já faz o ROLLOVER_ANO sozinho).
                  Sem `disabled`: um select desabilitado não abre a lista ao
                  clicar (parecia que o clique não fazia nada) — melhor
                  deixar clicável e mostrar a própria ausência de dado como
                  a única linha da lista. */}
              {anosComDados.length === 0 ? (
                <option value="">Nenhum dado disponível</option>
              ) : (
                <>
                  {anosComDados.map(y => (
                    <option key={y} value={y}>Ano-Calendário {y}</option>
                  ))}
                  {state.anoCalendario != null && (
                    <option value="__avancar__">Avançar para {state.anoCalendario + 1}</option>
                  )}
                </>
              )}
            </select>
          </div>
        )}
      </div>

      <ConfirmarDependentesModal
        open={confirmarDependentesOpen}
        dependentes={state.dependentes}
        proximoAno={state.anoCalendario != null ? state.anoCalendario + 1 : null}
        onClose={() => setConfirmarDependentesOpen(false)}
        onConfirmar={(idsQueSaem) => {
          const proximoAno = state.anoCalendario + 1;
          setConfirmarDependentesOpen(false);
          avancarAno(proximoAno);
          // Despachado DEPOIS do ROLLOVER_ANO de propósito: o reducer
          // processa em ordem, então essa exclusão mira o dependente já no
          // ANO NOVO (que herdou todos por padrão), sem tocar no ano
          // anterior arquivado.
          idsQueSaem.forEach(id => dispatch({ type: 'DELETE_DEPENDENTE', payload: id }));
        }}
      />
    </aside>
  );
}