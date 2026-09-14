import { useEffect, useRef, useState } from 'react';
import { useData } from '../store/DataContext';
import { hasWorkingData as hasWorkingDataCheck, snapshotHasData } from '../store/reducer';
import ConfirmarDependentesModal from './ConfirmarDependentesModal';
import NavIcon from './NavIcons';
import { MODALIDADES, NOME_CURTO_MODALIDADE, modalidadeDaDeclaracao } from '../store/modalidadeDeclaracao';

const navItems = [
  { id: 'importar', label: 'Importar Declaração', short: 'IM', section: 'VISÃO GERAL' },
  { id: 'dashboard', label: 'Demonstrativo', short: 'DM', section: 'VISÃO GERAL' },
  { id: 'acompanhamento', label: 'Acompanhamento financeiro', short: 'CF', section: 'VISÃO GERAL' },
  { id: 'revisaoPeriodica', label: 'Revisão e pendências', short: 'RP', section: 'VISÃO GERAL' },
  // Só aparece quando a declaração importada NÃO é de ajuste anual. O rótulo
  // vira o nome da modalidade, para a pessoa ver de imediato que este ano tem
  // regra própria (partilha no espólio, condição de não residente na saída).
  { id: 'modalidade', label: 'Modalidade', short: 'MO', section: 'VISÃO GERAL', somenteModalidade: true },
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
  const { state, dispatch, addToast, exportarPerfilAtual } = useData();
  const modalidade = modalidadeDaDeclaracao(state);
  const itensVisiveis = navItems
    .filter(item => !item.somenteModalidade || modalidade !== MODALIDADES.AJUSTE)
    .map(item => (item.somenteModalidade ? { ...item, label: NOME_CURTO_MODALIDADE[modalidade] } : item));
  let lastSection = '';
  const [confirmarDependentesOpen, setConfirmarDependentesOpen] = useState(false);
  const navRef = useRef(null);
  const [temMaisAbaixo, setTemMaisAbaixo] = useState(false);

  const atualizarContinuidadeNav = () => {
    const nav = navRef.current;
    if (!nav) return;
    setTemMaisAbaixo(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 2);
  };

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;
    atualizarContinuidadeNav();
    const observer = new ResizeObserver(atualizarContinuidadeNav);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [collapsed, itensVisiveis.length]);

  const avancarAno = (proximoAno) => {
    dispatch({ type: 'ROLLOVER_ANO', payload: proximoAno });
    addToast(`Ano-calendário ${proximoAno} iniciado.`, 'success');
  };

  // Backup do perfil aberto em arquivo (item A2). O trabalho todo é do
  // DataContext (`exportarPerfilAtual`), inclusive a criptografia do perfil
  // protegido: aqui só há o botão e o aviso do resultado.
  const [exportando, setExportando] = useState(false);
  const exportarBackup = async () => {
    setExportando(true);
    try {
      const nome = await exportarPerfilAtual();
      addToast(`Backup salvo como ${nome}. Guarde o arquivo fora deste computador.`, 'success');
    } catch (err) {
      addToast(err?.message || 'Não foi possível gerar o backup deste perfil.', 'error');
    }
    setExportando(false);
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
          <img className="logo-icon" src="./cp-tec.png" alt="" width="40" height="40" />
          {!collapsed && (
            <div className="logo-text">
              <h1>CP-TEC</h1>
              <span title={state.contribuinte?.nome || undefined}>{state.contribuinte?.nome || 'Variação Patrimonial IRPF'}</span>
            </div>
          )}
        </div>
        {!collapsed && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <button
              className="btn btn-sm btn-secondary"
              style={{ flex: 1 }}
              onClick={onTrocarPerfil}
              title="Voltar para a tela de seleção de perfil"
            >
              Trocar Perfil
            </button>
            <button
              className="btn btn-sm btn-secondary"
              style={{ flex: 1 }}
              onClick={exportarBackup}
              disabled={exportando}
              title="Salva um arquivo .cptec.json com tudo o que está neste perfil, para guardar como backup ou levar para outro computador"
            >
              {exportando ? 'Gerando...' : 'Exportar Backup'}
            </button>
          </div>
        )}
      </div>

      <div className="sidebar-nav-wrap">
        <nav ref={navRef} className="sidebar-nav" onScroll={atualizarContinuidadeNav}>
          {itensVisiveis.map(item => {
            const showSection = !collapsed && item.section !== lastSection;
            lastSection = item.section;
            return (
              <div key={item.id}>
                {showSection && <div className="nav-section-label">{item.section}</div>}
                <button
                  className={`nav-item ${collapsed ? 'nav-item-icone' : ''} ${activeView === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-label={collapsed ? item.label : undefined}
                >
                  <NavIcon id={item.id} />
                  {!collapsed && <span className="nav-item-label">{item.label}</span>}
                </button>
              </div>
            );
          })}
        </nav>
        {temMaisAbaixo && (
          <button
            type="button"
            className="sidebar-more"
            aria-label="Ver itens abaixo"
            onClick={() => navRef.current?.scrollTo({ top: navRef.current.scrollHeight, behavior: 'smooth' })}
          >
            <span className="sidebar-more-label">Ver itens abaixo</span><span aria-hidden="true">↓</span>
          </button>
        )}
      </div>

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
