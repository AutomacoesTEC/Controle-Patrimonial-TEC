import { useState, useMemo } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, GRUPOS_BENS } from '../utils/formatters';
import { exportToXlsx } from '../utils/exportXlsx';
import { situacaoBemAteData } from '../store/demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const GRUPO_LABELS = Object.fromEntries(GRUPOS_BENS.map(g => [g.codigo, g.nome]));

// Período padrão: do início do primeiro ano com dado até hoje (se o ano
// corrente for um ano com dado) ou até 31/12 do último ano com dado. Nada
// de ano fixo no código — o app nasce sem data nenhuma até a 1ª importação.
function periodoPadrao(state) {
  const anos = anosComDado(state);
  if (anos.length === 0) return { de: '', ate: '' };
  const hoje = new Date();
  const ultimo = anos[anos.length - 1];
  const fim = ultimo === hoje.getFullYear()
    ? hoje.toISOString().slice(0, 10)
    : `${ultimo}-12-31`;
  return { de: `${anos[0]}-01-01`, ate: fim };
}

export default function Dashboard() {
  const { state } = useData();

  const padrao = useMemo(() => periodoPadrao(state), [state]);
  const [dataDe, setDataDe] = useState(padrao.de);
  const [dataAte, setDataAte] = useState(padrao.ate);
  // Se o filtro ainda não foi tocado (vazio) e chegou dado novo (ex.: primeira
  // importação), adota o período padrão; depois disso a escolha é da usuária.
  const de = dataDe || padrao.de;
  const ate = dataAte || padrao.ate;

  const temDado = anosComDado(state).length > 0;

  // UM filtro de período dirigindo TUDO: demonstrativo, cards, gráficos,
  // pizza e export — todos leem o mesmo de/ate, via motor multi-ano.
  const demo = useMemo(
    () => (de && ate ? demonstrativoPeriodo(state, de, ate) : null),
    [state, de, ate]
  );

  const totIni = useMemo(() => totaisNaData(state, de, 'de'), [state, de]);
  const totFim = useMemo(() => totaisNaData(state, ate, 'ate'), [state, ate]);
  const evolucaoData = useMemo(() => serieEvolucao(state, de, ate), [state, de, ate]);

  const variacaoPeriodo = totIni && totFim ? totFim.liquido - totIni.liquido : 0;
  const varPctPeriodo = totIni && totIni.liquido !== 0 ? (variacaoPeriodo / Math.abs(totIni.liquido)) * 100 : 0;

  // Distribuição por categoria na data "Até" — valor de cada bem RECONSTRUÍDO
  // naquela data (não o situacao_atual cru), senão a pizza discordaria dos
  // cards e do demonstrativo.
  const pieData = useMemo(() => {
    if (!ate) return [];
    const dados = dadosDoAno(state, Number(ate.slice(0, 4)));
    if (!dados) return [];
    const byGrupo = {};
    [...(dados.bens || []), ...(dados.bensRurais || [])].forEach(b => {
      const valor = situacaoBemAteData(b, ate, 'ate');
      if (valor <= 0) return;
      const g = b.grupo || '99';
      byGrupo[g] = (byGrupo[g] || 0) + valor;
    });
    return Object.entries(byGrupo)
      .map(([g, v]) => ({ name: GRUPO_LABELS[g] || `Grupo ${g}`, value: v }))
      .sort((a, b) => b.value - a.value);
  }, [state, ate]);

  const handleExport = () => {
    const dadosFim = ate ? dadosDoAno(state, Number(ate.slice(0, 4))) : null;
    exportToXlsx({
      bens: dadosFim?.bens || [],
      dividas: dadosFim?.dividas || [],
      rendimentos: dadosFim?.rendimentos || [],
      pagamentos: dadosFim?.pagamentos || [],
      totalBensAnterior: totIni?.totalBens || 0,
      totalBensAtual: totFim?.totalBens || 0,
      totalDividasAnterior: totIni?.totalDividas || 0,
      totalDividasAtual: totFim?.totalDividas || 0,
      anoCalendario: ate ? Number(ate.slice(0, 4)) : 'periodo',
    }, 'variacao_patrimonial');
  };

  if (!temDado) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-left">
            <h2>Dashboard</h2>
            <p>Visão geral do patrimônio</p>
          </div>
        </div>
        <div className="page-body animate-in">
          <div className="card">
            <div className="empty-state" style={{ padding: '60px 20px' }}>
              <p style={{ fontSize: '16px', fontWeight: 600 }}>Nenhum dado ainda</p>
              <p>Importe a declaração do ano anterior na aba <strong>Importar</strong> para começar. A partir daí o dashboard mostra evolução, demonstrativo de conciliação e consulta por qualquer período.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Dashboard</h2>
          <p>Período de {formatDate(de)} até {formatDate(ate)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-success" onClick={handleExport}>
            Exportar .xlsx
          </button>
        </div>
      </div>
      <div className="page-body animate-in">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Período da consulta</h3></div>
          <div className="form-row" style={{ alignItems: 'end', marginBottom: 0 }}>
            <div className="form-group">
              <label>De</label>
              <input className="form-control" type="date" value={de} onChange={e => setDataDe(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Até</label>
              <input className="form-control" type="date" value={ate} onChange={e => setDataAte(e.target.value)} />
            </div>
            <div className="form-group">
              <button className="btn btn-secondary" onClick={() => { setDataDe(padrao.de); setDataAte(padrao.ate); }}>
                Todo o histórico
              </button>
            </div>
          </div>
          {demo && demo.anosCobertos.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--accent-warning, #f59e0b)', marginTop: '12px', marginBottom: 0 }}>
              Não há dados neste período. Ajuste as datas ou importe a declaração do ano correspondente na aba Importar.
            </p>
          )}
          {demo && demo.anosCobertos.length > 0 && demo.anosSemDado.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--accent-warning, #f59e0b)', marginTop: '12px', marginBottom: 0 }}>
              Sem dados de {demo.anosSemDado.join(', ')}. Esses anos ficam de fora das contas e dos gráficos.
            </p>
          )}
        </div>

        {demo && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Demonstrativo de Conciliação Patrimonial</h3></div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '-8px', marginBottom: '16px' }}>
            A mesma conta da planilha de controle: a variação do patrimônio precisa bater com o que entrou de rendimento e ganho, menos o que saiu em pagamento. O Saldo de Caixa no final serve para conferir: perto de zero (ou do valor que você sabe que tem em caixa) indica que nada ficou de fora.
          </p>

          <table className="demonstrativo-table">
            <tbody>
              <tr className="demonstrativo-secao"><td colSpan={2}>Descrição dos Bens</td></tr>
              <tr><td>Situação em {formatDate(de)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensAte)}</td></tr>
              <tr className="demonstrativo-total"><td>Variação dos Bens</td><td className={`currency ${demo.varPatrimonial.deltaBens >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaBens)}</td></tr>

              <tr className="demonstrativo-secao"><td colSpan={2}>Descrição da Dívida</td></tr>
              <tr><td>Situação em {formatDate(de)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaAte)}</td></tr>
              <tr className="demonstrativo-total"><td>Variação da Dívida</td><td className={`currency ${demo.varPatrimonial.deltaDivida >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaDivida)}</td></tr>

              <tr className="demonstrativo-destaque"><td>Variação Patrimonial Total</td><td className={`currency ${demo.varPatrimonial.total >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.total)}</td></tr>

              <tr className="demonstrativo-secao"><td colSpan={2}>Descrição dos Rendimentos</td></tr>
              <tr><td>Tributáveis Recebidos de P.J.</td><td className="currency">{formatCurrency(demo.rendimentos.tributavelPJ)}</td></tr>
              <tr><td>Demais Rend. Tributáveis (Resultado da Atividade Rural)</td><td className={`currency ${demo.rendimentos.demaisTributaveis >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.rendimentos.demaisTributaveis)}</td></tr>
              <tr><td>Rendimentos Isentos e Não Tributáveis</td><td className="currency">{formatCurrency(demo.rendimentos.isentoValor)}</td></tr>
              <tr><td>Tributação Exclusiva, bruto</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoBruto)}</td></tr>
              <tr><td>Tributação Exclusiva, IRRF retido</td><td className="currency negative">{formatCurrency(-demo.rendimentos.exclusivoIrrf)}</td></tr>
              <tr><td>Tributação Exclusiva, líquido</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoLiquido)}</td></tr>
              <tr className="demonstrativo-total"><td>Total Geral dos Rendimentos</td><td className="currency positive">{formatCurrency(demo.rendimentos.totalGeral)}</td></tr>

              <tr className="demonstrativo-secao"><td colSpan={2}>Ganhos Apurados</td></tr>
              <tr><td>Ganho/perda líquido de IRRF nas vendas do período ({demo.ganhos.vendas.length} venda(s))</td><td className={`currency ${demo.ganhos.total >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.ganhos.total)}</td></tr>
              {demo.ganhos.semIrrfCount > 0 && (
                <tr><td colSpan={2} style={{ fontSize: '11px', color: 'var(--accent-warning, #f59e0b)', padding: '2px 12px 10px' }}>
                  {demo.ganhos.semIrrfCount} venda(s) com ganho sem o IRRF informado entraram pelo valor bruto. Edite a movimentação e preencha "IRRF pago sobre o ganho" para precisão.
                </td></tr>
              )}

              <tr className="demonstrativo-destaque"><td>Saldo de Caixa Geral</td><td className={`currency ${demo.saldoDeCaixaGeral >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.saldoDeCaixaGeral)}</td></tr>

              <tr className="demonstrativo-secao"><td colSpan={2}>Pagamentos</td></tr>
              <tr><td>Pagamentos Efetuados (ficha dedutível)</td><td className="currency negative">{formatCurrency(-demo.pagamentosEfetuados)}</td></tr>
              <tr><td>Pagamentos Diversos (despesas gerais)</td><td className="currency negative">{formatCurrency(-demo.pagamentosDiversos)}</td></tr>

              <tr className="demonstrativo-destaque demonstrativo-final"><td>Saldo de Caixa</td><td className={`currency ${demo.saldoDeCaixa >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.saldoDeCaixa)}</td></tr>
            </tbody>
          </table>
        </div>
        )}

        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.totalBens || 0)}</h3>
              <p>Bens e Direitos em {formatDate(ate)}</p>
              <span className="stat-change positive">{totFim?.qtdBens || 0} itens</span>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.totalDividas || 0)}</h3>
              <p>Dívidas em {formatDate(ate)}</p>
              <span className="stat-change negative">{totFim?.qtdDividas || 0} itens</span>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.liquido || 0)}</h3>
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
              <h3 className="card-title">Distribuição por Categoria em {formatDate(ate)}</h3>
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
              <div className="empty-state"><p>Sem bens com valor nesta data</p></div>
            )}
          </div>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Bens e Dívidas no período</h3>
            </div>
            {evolucaoData.some(d => d.bens > 0 || d.dividas > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                  <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={d => formatDate(d)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={v => formatCurrency(v)} labelFormatter={d => formatDate(d)} contentStyle={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                  <Bar dataKey="bens" name="Bens" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dividas" name="Dívidas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Legend />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><p>Sem dado neste período</p></div>
            )}
          </div>
        </div>

        {evolucaoData.length > 1 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Evolução do Patrimônio Líquido, {formatDate(de)} a {formatDate(ate)}</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="data" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={d => formatDate(d)} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={v => formatCurrency(v)} labelFormatter={d => formatDate(d)} contentStyle={{ background: '#1a2332', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="liquido" name="Patrimônio Líquido" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
