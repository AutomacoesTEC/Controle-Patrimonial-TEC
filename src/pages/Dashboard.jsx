import { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, GRUPOS_BENS } from '../utils/formatters';
import { exportToXlsx } from '../utils/exportXlsx';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const GRUPO_LABELS = Object.fromEntries(GRUPOS_BENS.map(g => [g.codigo, g.nome]));

export default function Dashboard() {
  const { state } = useData();
  const { anoCalendario } = state;

  // Anos com dado real: o ano corrente (em edição) mais tudo que já foi
  // arquivado no histórico. O comparador de período só pode navegar entre
  // esses — é o propósito do app funcionar para vários anos, não só o atual.
  const anosDisponiveis = useMemo(
    () => [...new Set([...Object.keys(state.historico).map(Number), anoCalendario])].sort((a, b) => a - b),
    [state.historico, anoCalendario]
  );

  const [anoDeSel, setAnoDeSel] = useState(anosDisponiveis[0]);
  const [anoAteSel, setAnoAteSel] = useState(anoCalendario);
  const anoDe = anosDisponiveis.includes(anoDeSel) ? anoDeSel : anosDisponiveis[0];
  const anoAte = anosDisponiveis.includes(anoAteSel) ? anoAteSel : anoCalendario;
  const ini = Math.min(anoDe, anoAte);
  const fim = Math.max(anoDe, anoAte);

  const getDadosAno = (ano) => {
    if (ano === anoCalendario) return { bens: state.bens, dividas: state.dividas };
    const h = state.historico[ano];
    return h ? { bens: h.bens || [], dividas: h.dividas || [] } : { bens: [], dividas: [] };
  };

  const totaisAno = (ano) => {
    const { bens, dividas } = getDadosAno(ano);
    const totalBens = bens.reduce((s, b) => s + (parseFloat(b.situacao_atual) || 0), 0);
    const totalDividas = dividas.reduce((s, d) => s + (parseFloat(d.situacao_atual) || 0), 0);
    return { totalBens, totalDividas, liquido: totalBens - totalDividas, qtdBens: bens.length, qtdDividas: dividas.length };
  };

  const serieAnos = [];
  for (let a = ini; a <= fim; a++) serieAnos.push(a);
  const evolucaoData = serieAnos.map(a => {
    const t = totaisAno(a);
    return { ano: a, data: `31/12/${a}`, bens: t.totalBens, dividas: t.totalDividas, liquido: t.liquido };
  });

  // Com um único ano selecionado (ini === fim), comparar totaisAno(ini) com
  // totaisAno(fim) daria sempre variação zero (mesma situacao_atual dos dois
  // lados). Nesse caso o período natural é a abertura do próprio ano
  // (situacao_anterior) contra o fechamento (situacao_atual) — dado que já
  // existe por bem, sem precisar de um segundo ano arquivado.
  const totaisAberturaAno = (ano) => {
    const { bens, dividas } = getDadosAno(ano);
    const totalBens = bens.reduce((s, b) => s + (parseFloat(b.situacao_anterior) || 0), 0);
    const totalDividas = dividas.reduce((s, d) => s + (parseFloat(d.situacao_anterior) || 0), 0);
    return { totalBens, totalDividas, liquido: totalBens - totalDividas, qtdBens: bens.length, qtdDividas: dividas.length };
  };

  const totIni = ini === fim ? totaisAberturaAno(ini) : totaisAno(ini);
  const totFim = totaisAno(fim);
  const variacaoPeriodo = totFim.liquido - totIni.liquido;
  const varPctPeriodo = totIni.liquido !== 0 ? (variacaoPeriodo / Math.abs(totIni.liquido)) * 100 : 0;

  // Distribuição por categoria e comparativo mostram o ano final do período
  // selecionado, não sempre o ano corrente.
  const { bens: bensFim, dividas: dividasFim } = getDadosAno(fim);
  const byGrupo = {};
  bensFim.forEach(b => {
    const g = b.grupo || '99';
    if (!byGrupo[g]) byGrupo[g] = { atual: 0 };
    byGrupo[g].atual += parseFloat(b.situacao_atual) || 0;
  });
  const pieData = Object.entries(byGrupo)
    .map(([g, v]) => ({ name: GRUPO_LABELS[g] || `Grupo ${g}`, value: v.atual }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const handleExport = () => {
    const totalBensAnterior = totIni.totalBens;
    const totalBensAtual = totFim.totalBens;
    const totalDividasAnterior = totIni.totalDividas;
    const totalDividasAtual = totFim.totalDividas;
    exportToXlsx({
      bens: bensFim,
      dividas: dividasFim,
      rendimentos: fim === anoCalendario ? state.rendimentos : (state.historico[fim]?.rendimentos || []),
      pagamentos: fim === anoCalendario ? state.pagamentos : (state.historico[fim]?.pagamentos || []),
      totalBensAnterior,
      totalBensAtual,
      totalDividasAnterior,
      totalDividasAtual,
      anoCalendario: fim,
    }, 'variacao_patrimonial');
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard</h2>
          <p>Visão geral do patrimônio no ano-calendário {anoCalendario}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-success" onClick={handleExport}>
            Exportar .xlsx
          </button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Comparar período</h3></div>
          <div className="form-row" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label>De (situação em 31/12)</label>
              <select className="form-control" value={anoDe} onChange={e => setAnoDeSel(parseInt(e.target.value))}>
                {anosDisponiveis.map(a => <option key={a} value={a}>31/12/{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Até (situação em 31/12)</label>
              <select className="form-control" value={anoAte} onChange={e => setAnoAteSel(parseInt(e.target.value))}>
                {anosDisponiveis.map(a => <option key={a} value={a}>31/12/{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-info">
              <h3>{formatCurrency(totFim.totalBens)}</h3>
              <p>Bens e Direitos</p>
              <span className="stat-change positive">{totFim.qtdBens} itens</span>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-info">
              <h3>{formatCurrency(totFim.totalDividas)}</h3>
              <p>Dívidas</p>
              <span className="stat-change negative">{totFim.qtdDividas} itens</span>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-info">
              <h3>{formatCurrency(totFim.liquido)}</h3>
              <p>Patrimônio Líquido</p>
            </div>
          </div>
          <div className="stat-card purple">
            <div className="stat-info">
              <h3>{formatCurrency(variacaoPeriodo)}</h3>
              <p>Variação no período</p>
              <span className={`stat-change ${variacaoPeriodo >= 0 ? 'positive' : 'negative'}`}>
                {variacaoPeriodo >= 0 ? '▲' : '▼'} {varPctPeriodo.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div className="charts-grid">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Distribuição por Categoria em 31/12/{fim}</h3>
            </div>
            {pieData.length > 0 ? (
              // Sem rótulo grudado na fatia: nome de categoria comprido
              // ("Aplicações e Investimentos") vazava para fora do card.
              // Legenda embaixo, com espaço próprio, não tem esse risco.
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" outerRadius={90} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p>Sem bens cadastrados em 31/12/{fim}</p></div>
            )}
          </div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Bens e Dívidas no período selecionado</h3>
            </div>
            {evolucaoData.some(d => d.bens > 0 || d.dividas > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="bens" name="Bens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dividas" name="Dívidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p>Importe uma declaração para visualizar</p></div>
            )}
          </div>
        </div>

        {serieAnos.length > 1 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Evolução do Patrimônio Líquido, 31/12/{ini} a 31/12/{fim}</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="liquido" name="Patrimônio Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
