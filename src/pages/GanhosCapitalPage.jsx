import { useMemo, useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';

// Ganhos de Capital não tem cadastro próprio: é calculado a partir das
// movimentações de venda (venda_parcial/venda_total) que já foram
// registradas em Bens e Direitos e em Bens da Atividade Rural, desde que
// a movimentação tenha o "valor de venda" preenchido. Ganho/perda =
// preço de venda − parcela do custo baixada.
export default function GanhosCapitalPage() {
  const { state } = useData();
  const anosDisponiveis = anosComDado(state);
  const [anoEscolhido, setAnoEscolhido] = useState(state.anoCalendario);

  // Acompanha o ano-calendário selecionado na sidebar por padrão (mesmo
  // comportamento do Dashboard), mas a escolha aqui é independente dele —
  // só resincroniza quando o ano ATIVO muda.
  useEffect(() => {
    setAnoEscolhido(state.anoCalendario);
  }, [state.anoCalendario]);

  const dados = anoEscolhido != null ? dadosDoAno(state, anoEscolhido) : null;
  const bensDoAno = dados?.bens || [];
  const bensRuraisDoAno = dados?.bensRurais || [];

  const vendas = useMemo(() => {
    const lista = [];
    const origem = [
      ...bensDoAno.map(b => ({ b, tipoOrigem: 'Bens e Direitos' })),
      ...bensRuraisDoAno.map(b => ({ b, tipoOrigem: 'Atividade Rural' })),
    ];
    for (const { b, tipoOrigem } of origem) {
      for (const m of (b.movimentacoes || [])) {
        if ((m.tipo === 'venda_parcial' || m.tipo === 'venda_total') && m.valorVenda != null) {
          const ganho = m.valorVenda - m.valor;
          lista.push({
            id: m.id,
            origem: tipoOrigem,
            bem: b.discriminacao,
            data: m.data,
            tipoVenda: m.tipo === 'venda_total' ? 'Total' : 'Parcial',
            custo: m.valor,
            valorVenda: m.valorVenda,
            ganho,
            irrf: ganho > 0 ? (m.irrfVenda || 0) : 0,
            descricao: m.descricao,
          });
        }
      }
    }
    return lista.sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [bensDoAno, bensRuraisDoAno]);

  const totalGanho = vendas.reduce((s, v) => s + v.ganho, 0);
  const semValorVenda = useMemo(() => {
    let count = 0;
    for (const b of [...bensDoAno, ...bensRuraisDoAno]) {
      for (const m of (b.movimentacoes || [])) {
        if ((m.tipo === 'venda_parcial' || m.tipo === 'venda_total') && m.valorVenda == null) count++;
      }
    }
    return count;
  }, [bensDoAno, bensRuraisDoAno]);

  const handleExport = () => exportListaToXlsx(
    vendas,
    [
      ['Origem', v => v.origem],
      ['Bem', v => v.bem || ''],
      ['Data', v => formatDate(v.data)],
      ['Tipo de Venda', v => v.tipoVenda],
      ['Custo Baixado', v => v.custo],
      ['Valor de Venda', v => v.valorVenda],
      ['Ganho/Perda', v => v.ganho],
      ['IRRF', v => v.irrf],
      ['Descrição', v => v.descricao || ''],
    ],
    'Ganhos de Capital', 'ganhos_capital', anoEscolhido
  );

  const seletorAno = anosDisponiveis.length > 0 && (
    <select
      className="form-control"
      style={{ width: 'auto' }}
      value={anoEscolhido ?? ''}
      onChange={e => setAnoEscolhido(e.target.value === '' ? null : Number(e.target.value))}
    >
      {anosDisponiveis.map(y => <option key={y} value={y}>Ano-Calendário {y}</option>)}
    </select>
  );

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Ganhos de Capital</h2>
          <p>Calculado sozinho a partir das vendas registradas em Bens e Direitos e Bens da Atividade Rural. Para uma venda entrar aqui, preencha o "Valor de venda" ao registrar a movimentação.</p>
        </div>
        <div className="page-header-actions">
          {seletorAno}
          {vendas.length > 0 && <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>}
        </div>
      </div>
      <div className="page-body animate-in">
        {semValorVenda > 0 && (
          <div className="card" style={{ marginBottom: '20px', borderColor: 'var(--accent-warning, #f59e0b)' }}>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Há {semValorVenda} venda(s) registrada(s) sem o valor de venda preenchido, então não entram nesse cálculo. Edite o bem e complete a movimentação se quiser incluí-las.
            </p>
          </div>
        )}
        <div className="stats-grid" style={{ marginBottom: '24px' }}>
          <div className="stat-card purple">
            <div className="stat-info">
              <h3>{formatCurrency(totalGanho)}</h3>
              <p>{totalGanho >= 0 ? 'Ganho apurado no ano' : 'Perda apurada no ano'}</p>
              <span className="stat-change positive">{vendas.length} venda(s)</span>
            </div>
          </div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Bem</th><th>Origem</th><th>Data</th><th>Tipo</th><th style={{ textAlign: 'right' }}>Custo Baixado</th><th style={{ textAlign: 'right' }}>Valor de Venda</th><th style={{ textAlign: 'right' }}>Ganho/Perda</th><th style={{ textAlign: 'right' }}>IRRF</th></tr></thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Nenhuma venda com valor de venda registrado ainda.</td></tr>
              ) : vendas.map(v => (
                <tr key={v.id}>
                  <td style={{ maxWidth: '300px' }}>{(v.bem || '').substring(0, 80)}</td>
                  <td>{v.origem}</td>
                  <td>{formatDate(v.data)}</td>
                  <td>{v.tipoVenda}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(v.custo)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(v.valorVenda)}</td>
                  <td style={{ textAlign: 'right' }} className={`currency ${v.ganho >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(v.ganho)}</td>
                  <td style={{ textAlign: 'right' }} className="currency">{v.ganho > 0 ? formatCurrency(v.irrf) : '-'}</td>
                </tr>
              ))}
            </tbody>
            {vendas.length > 0 && (
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={6} style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, borderTop: '2px solid var(--border-color)' }} className={`currency ${totalGanho >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(totalGanho)}</td>
                  <td style={{ borderTop: '2px solid var(--border-color)' }}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
