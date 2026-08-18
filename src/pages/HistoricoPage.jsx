import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';

export default function HistoricoPage() {
  const { state, dispatch, saveToStorage, addToast } = useData();
  const { historico, anoCalendario } = state;

  const handleSaveYear = () => {
    dispatch({ type: 'SAVE_HISTORICO' });
    saveToStorage();
    addToast(`Dados de ${anoCalendario} salvos no histórico!`, 'success');
  };

  const handleLoadYear = (ano) => {
    dispatch({ type: 'LOAD_HISTORICO', payload: ano });
    addToast(`Dados de ${ano} carregados!`, 'info');
  };

  const handleDeleteYear = (e, ano) => {
    e.stopPropagation();
    const confirmado = confirm(
      `Excluir o ano-calendário ${ano} do histórico?\n\n` +
      `Todos os bens, dívidas, rendimentos e pagamentos salvos desse ano serão apagados. Essa ação não pode ser desfeita.`
    );
    if (!confirmado) return;
    dispatch({ type: 'DELETE_HISTORICO_ANO', payload: ano });
    addToast(`Ano-calendário ${ano} excluído do histórico.`, 'info');
  };

  const anos = Object.keys(historico).sort().reverse();

  return (
    <>
      <div className="page-header">
        <div className="page-header-left"><h2>Histórico de Declarações</h2><p>Acesse dados de anos anteriores</p></div>
        <div className="page-header-actions">
          <button className="btn btn-primary" onClick={handleSaveYear}>Salvar {anoCalendario} no Histórico</button>
        </div>
      </div>
      <div className="page-body animate-in">
        {anos.length === 0 ? (
          <div className="empty-state">
            <h3>Nenhum histórico salvo</h3>
            <p>Clique em "Salvar no Histórico" para guardar os dados do ano atual</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {anos.map(ano => {
              const h = historico[ano];
              const totalBens = (h.bens || []).reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);
              return (
                <div className="card" key={ano} style={{ cursor: 'pointer' }} onClick={() => handleLoadYear(parseInt(ano))}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: 700 }}>Ano-Calendário {ano}</h3>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {(h.bens || []).length} bens, {(h.dividas || []).length} dívidas, salvo em {new Date(h.savedAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalBens)}</div>
                        <span className="badge badge-blue">Carregar</span>
                      </div>
                      <button
                        className="btn btn-sm btn-danger"
                        title={`Excluir o ano-calendário ${ano} do histórico`}
                        onClick={(e) => handleDeleteYear(e, parseInt(ano))}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}