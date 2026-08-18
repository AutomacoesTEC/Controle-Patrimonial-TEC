import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, formatCpfCnpj, GRUPOS_BENS, MOVIMENTACAO_TIPOS } from '../utils/formatters';
import { exportToXlsx } from '../utils/exportXlsx';

export default function RelatorioPage() {
  const { state } = useData();
  const { bens, dividas, rendimentos, pagamentos, anoCalendario, contribuinte } = state;

  // Sem ano definido (antes da 1ª importação) não há relatório a emitir.
  if (anoCalendario == null) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-left"><h2>Relatório para IRPF</h2><p>Prévia dos dados para a declaração</p></div>
        </div>
        <div className="page-body animate-in">
          <div className="card">
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <p style={{ fontSize: '16px', fontWeight: 600 }}>Nenhum ano-calendário definido</p>
              <p>Importe a declaração do ano anterior na aba <strong>Importar</strong> para o relatório aparecer aqui.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const totalBensAnterior = bens.reduce((s, b) => s + (parseFloat(b.situacao_anterior) || 0), 0);
  const totalBensAtual = bens.reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);
  const totalDividasAnterior = dividas.reduce((s, d) => s + (parseFloat(d.situacao_anterior) || 0), 0);
  const totalDividasAtual = dividas.reduce((s, d) => s + (parseFloat(d.situacao_atual) || 0), 0);
  const patrimonioAnterior = totalBensAnterior - totalDividasAnterior;
  const patrimonioAtual = totalBensAtual - totalDividasAtual;

  const handleExport = () => {
    exportToXlsx({
      bens, dividas, rendimentos, pagamentos,
      totalBensAnterior, totalBensAtual, totalDividasAnterior, totalDividasAtual, anoCalendario,
    }, `relatorio_irpf_${anoCalendario}`);
  };

  const byGrupo = {};
  bens.forEach(b => {
    const g = b.grupo || '99';
    if (!byGrupo[g]) byGrupo[g] = { items: [], anterior: 0, atual: 0 };
    byGrupo[g].items.push(b);
    byGrupo[g].anterior += parseFloat(b.situacao_anterior) || 0;
    byGrupo[g].atual += parseFloat(b.situacao_atual) || 0;
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Relatório para IRPF {anoCalendario + 1}</h2>
          <p>Dados do ano-calendário {anoCalendario} prontos para declaração em {anoCalendario + 1}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-success" onClick={handleExport}>Exportar Relatório .xlsx</button>
        </div>
      </div>
      <div className="page-body animate-in">
        {contribuinte && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3 className="card-title">Identificação do Contribuinte</h3></div>
            <div className="form-row">
              <div><strong style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>NOME:</strong><br />{contribuinte.nome}</div>
              <div><strong style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>CPF:</strong><br />{formatCpfCnpj(contribuinte.cpf)}</div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Evolução Patrimonial</h3></div>
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bens 31/12/{anoCalendario - 1}</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalBensAnterior)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bens 31/12/{anoCalendario}</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(totalBensAtual)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dívidas 31/12/{anoCalendario - 1}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCurrency(totalDividasAnterior)}</div>
            </div>
            <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Dívidas 31/12/{anoCalendario}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--accent-danger)' }}>{formatCurrency(totalDividasAtual)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 600 }}>Patrimônio Líquido {anoCalendario - 1}</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(patrimonioAnterior)}</div>
            </div>
            <div style={{ padding: '16px', background: 'rgba(16,185,129,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div style={{ fontSize: '11px', color: 'var(--accent-success)', textTransform: 'uppercase', fontWeight: 600 }}>Patrimônio Líquido {anoCalendario}</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(patrimonioAtual)}</div>
            </div>
          </div>
        </div>

        {Object.entries(byGrupo).map(([g, data]) => {
          const grupo = GRUPOS_BENS.find(gb => gb.codigo === g);
          return (
            <div className="card" style={{ marginBottom: '16px' }} key={g}>
              <div className="card-header">
                <h3 className="card-title">{grupo ? `${grupo.codigo} - ${grupo.nome}` : `Grupo ${g}`}</h3>
                <span className="badge badge-blue">{data.items.length} itens</span>
              </div>
              <div className="table-container">
                <table>
                  <thead><tr><th>Cód.</th><th>Discriminação</th><th style={{ textAlign: 'right' }}>31/12/{anoCalendario - 1}</th><th style={{ textAlign: 'right' }}>31/12/{anoCalendario}</th><th>Movimentações no ano</th></tr></thead>
                  <tbody>
                    {data.items.map(b => (
                      <tr key={b.id}>
                        <td>{b.codigo_bem}</td>
                        <td>{(b.discriminacao || '').substring(0, 80)}</td>
                        <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(b.situacao_anterior)}</td>
                        <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(b.situacao_atual)}</td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {(b.movimentacoes || []).length === 0 ? '' : (b.movimentacoes || []).map(m =>
                            `${MOVIMENTACAO_TIPOS[m.tipo]?.label || m.tipo} em ${formatDate(m.data)}`
                          ).join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}