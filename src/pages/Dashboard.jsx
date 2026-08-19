import { useState, useMemo, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, GRUPOS_BENS } from '../utils/formatters';
import { exportToXlsx } from '../utils/exportXlsx';
import { situacaoBemAteData, diaAnterior } from '../store/demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import DateInput from '../components/DateInput';

const GRUPO_LABELS = Object.fromEntries(GRUPOS_BENS.map(g => [g.codigo, g.nome]));

// Paleta categórica validada (skill dataviz): 8 tons, ordem fixa, checada por
// CVD contra as cores reais do app (fundo escuro #161d2e e claro #ffffff) —
// `node scripts/validate_palette.js` passou nos dois modos. Os gráficos
// escolhem o par certo sozinhos, acompanhando o botão de tema.
const CATEGORICAS = {
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
};
const CROMO_GRAFICO = {
  dark: { grid: '#2c2c2a', axis: '#383835', tick: '#94a3b8', tooltipBg: '#1a2332', tooltipBorder: 'rgba(148,163,184,0.15)', tooltipText: '#f1f5f9' },
  light: { grid: '#e1e0d9', axis: '#c3c2b7', tick: '#5c6168', tooltipBg: '#ffffff', tooltipBorder: 'rgba(123,129,138,0.25)', tooltipText: '#1e273e' },
};

// Acompanha o botão de tema (data-theme no <html>, ver App.jsx) — os
// gráficos são SVG puro do Recharts, não leem as CSS custom properties do
// resto do app, então precisam da própria leitura do tema.
function useTemaAtual() {
  const ler = () => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
  const [tema, setTema] = useState(ler);
  useEffect(() => {
    const obs = new MutationObserver(() => setTema(ler()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return tema;
}

// Período padrão: o ano-calendário selecionado na sidebar (01/01 até 31/12,
// ou até hoje se for o ano corrente) — o Dashboard já abre mostrando o ano
// que a usuária está trabalhando, sem precisar digitar nada. Continua
// independente dele: é só o valor de partida; ver o efeito abaixo que
// resincroniza esse padrão quando o ano selecionado muda, e "Todo o
// histórico" que usa periodoTodoHistorico em vez deste.
function periodoAnoSelecionado(state) {
  if (state.anoCalendario == null) return { de: '', ate: '' };
  const hoje = new Date();
  const ano = state.anoCalendario;
  const fim = ano === hoje.getFullYear() ? hoje.toISOString().slice(0, 10) : `${ano}-12-31`;
  return { de: `${ano}-01-01`, ate: fim };
}

// Do início do primeiro ano com dado até hoje (ou até 31/12 do último ano
// com dado) — usado só pelo botão "Todo o histórico", uma escolha explícita
// da usuária, não o padrão de abertura do Dashboard.
function periodoTodoHistorico(state) {
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
  const tema = useTemaAtual();
  const cores = CATEGORICAS[tema];
  const cromo = CROMO_GRAFICO[tema];

  const padrao = useMemo(() => periodoAnoSelecionado(state), [state]);
  const todoHistorico = useMemo(() => periodoTodoHistorico(state), [state]);
  const [dataDe, setDataDe] = useState(padrao.de);
  const [dataAte, setDataAte] = useState(padrao.ate);
  // Se o filtro ainda não foi tocado (vazio) e chegou dado novo (ex.: primeira
  // importação), adota o período padrão; depois disso a escolha é da usuária.
  const de = dataDe || padrao.de;
  const ate = dataAte || padrao.ate;

  // Trocar o ano-calendário selecionado (sidebar) reabre o Dashboard no
  // período desse ano — "acompanha o ano selecionado" — descartando um
  // período customizado que pertencia ao ano anterior. Só reage à TROCA de
  // ano, não a toda mudança de estado, senão cadastrar um bem no mesmo ano
  // apagaria o filtro que a usuária acabou de digitar.
  useEffect(() => {
    setDataDe('');
    setDataAte('');
  }, [state.anoCalendario]);

  const anosDisponiveis = useMemo(() => anosComDado(state), [state]);
  const temDado = anosDisponiveis.length > 0;

  // "De" é o INÍCIO do período consultado: o saldo anterior de verdade é da
  // véspera, não do próprio dia — senão um lançamento cadastrado exatamente
  // em "De" ficava escondido dentro do saldo anterior em vez de contar como
  // variação do período (mesma correção em situacaoBemAteData/
  // situacaoDividaAteData, que já usam a véspera por baixo dos panos).
  const dataSaldoAnterior = de ? diaAnterior(de) : '';

  // Limites do campo de data (DateInput valida contra eles antes de
  // confirmar): sem isso, um ano digitado fora de posição como "0024"
  // passava batido e o relatório recalculava pra um período sem sentido,
  // parecendo "travado" (números somem/zeram) em vez de dar erro claro.
  const anoMinData = anosDisponiveis.length > 0 ? anosDisponiveis[0] : new Date().getFullYear();
  const dateMinAttr = `${anoMinData}-01-01`;
  const dateMaxAttr = new Date().toISOString().slice(0, 10);

  // UM filtro de período dirigindo TUDO: demonstrativo, cards, gráficos,
  // pizza e export — todos leem o mesmo de/ate, via motor multi-ano.
  const demo = useMemo(
    () => (de && ate ? demonstrativoPeriodo(state, de, ate) : null),
    [state, de, ate]
  );

  const totIni = useMemo(() => totaisNaData(state, de, 'de'), [state, de]);
  const totFim = useMemo(() => totaisNaData(state, ate, 'ate'), [state, ate]);
  const evolucaoData = useMemo(() => serieEvolucao(state, de, ate), [state, de, ate]);
  // ~6 marcações no eixo X, sempre igualmente espaçadas — o intervalo
  // automático do Recharts pulava mês de forma desigual (parecia quebrado)
  // quando o período caía dentro de um ano só (13 pontos: 01/01 + 12 fins
  // de mês).
  const tickIntervalX = Math.max(0, Math.ceil(evolucaoData.length / 6) - 1);

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
              <DateInput value={de} onChange={setDataDe} min={dateMinAttr} max={dateMaxAttr} />
            </div>
            <div className="form-group">
              <label>Até</label>
              <DateInput value={ate} onChange={setDataAte} min={dateMinAttr} max={dateMaxAttr} />
            </div>
            <div className="form-group">
              <button className="btn btn-secondary" onClick={() => { setDataDe(todoHistorico.de); setDataAte(todoHistorico.ate); }}>
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

          <table className="demonstrativo-table">
            <tbody>
              <tr className="demonstrativo-secao"><td colSpan={2}>Descrição dos Bens</td></tr>
              <tr><td>Situação em {formatDate(dataSaldoAnterior)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensAte)}</td></tr>
              <tr className="demonstrativo-total"><td>Variação dos Bens</td><td className={`currency ${demo.varPatrimonial.deltaBens >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaBens)}</td></tr>

              <tr className="demonstrativo-secao"><td colSpan={2}>Descrição da Dívida</td></tr>
              <tr><td>Situação em {formatDate(dataSaldoAnterior)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaDe)}</td></tr>
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
          <div className="stat-card blue">
            <div className="stat-info">
              <h3>{formatCurrency(totIni?.liquido || 0)}</h3>
              <p>Patrimônio Líquido em {formatDate(dataSaldoAnterior)}</p>
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
          <div className="stat-card green">
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.liquido || 0)}</h3>
              <p>Patrimônio Líquido em {formatDate(ate)}</p>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Distribuição por Categoria em {formatDate(ate)}</h3>
          </div>
          {pieData.length > 0 ? (
            // Barra horizontal, não pizza: com 7-8 categorias e nomes longos
            // ("Aplicações e Investimentos"), fatia + rótulo colado sempre
            // amontoa — o rótulo do eixo Y já identifica a categoria, então
            // nem precisa de legenda à parte.
            <ResponsiveContainer width="100%" height={Math.max(220, pieData.length * 42 + 20)}>
              <BarChart data={pieData} layout="vertical" margin={{ top: 4, right: 110, bottom: 4, left: 4 }}>
                <CartesianGrid horizontal={false} stroke={cromo.grid} />
                <XAxis
                  type="number" domain={[0, dataMax => dataMax * 1.2]} tick={{ fill: cromo.tick, fontSize: 11 }}
                  tickFormatter={v => `${(v / 1000000).toFixed(1)}M`}
                  axisLine={{ stroke: cromo.axis }} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="name" width={190}
                  tick={{ fill: cromo.tick, fontSize: 12 }} axisLine={{ stroke: cromo.axis }} tickLine={false}
                />
                <Tooltip
                  formatter={v => formatCurrency(v)}
                  contentStyle={{ background: cromo.tooltipBg, border: `1px solid ${cromo.tooltipBorder}`, borderRadius: '8px' }}
                  labelStyle={{ color: cromo.tooltipText }}
                  cursor={{ fill: 'rgba(148,163,184,0.06)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {pieData.map((_, i) => <Cell key={i} fill={cores[i % cores.length]} />)}
                  <LabelList dataKey="value" position="right" formatter={formatCurrency} style={{ fill: cromo.tick, fontSize: 11 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sem bens com valor nesta data</p></div>
          )}
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Bens e Dívidas no período</h3>
          </div>
          {evolucaoData.some(d => d.bens > 0 || d.dividas > 0) ? (
            // Linha, não barra: é tendência ao longo do tempo — com até 13
            // pontos (um por mês dentro do mesmo ano), barras lado a lado
            // ficavam finas demais e o eixo pulava mês de forma desigual.
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoData} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={cromo.grid} vertical={false} />
                <XAxis
                  dataKey="data" tick={{ fill: cromo.tick, fontSize: 11 }} tickFormatter={d => formatDate(d)}
                  axisLine={{ stroke: cromo.axis }} tickLine={false} interval={tickIntervalX}
                />
                <YAxis tick={{ fill: cromo.tick, fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => formatCurrency(v)} labelFormatter={d => formatDate(d)}
                  contentStyle={{ background: cromo.tooltipBg, border: `1px solid ${cromo.tooltipBorder}`, borderRadius: '8px' }}
                  labelStyle={{ color: cromo.tooltipText }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="bens" name="Bens" stroke={cores[0]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="dividas" name="Dívidas" stroke={cores[7]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><p>Sem dado neste período</p></div>
          )}
        </div>

        {evolucaoData.length > 1 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Evolução do Patrimônio Líquido, {formatDate(de)} a {formatDate(ate)}</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoData} margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid stroke={cromo.grid} vertical={false} />
                <XAxis
                  dataKey="data" tick={{ fill: cromo.tick, fontSize: 11 }} tickFormatter={d => formatDate(d)}
                  axisLine={{ stroke: cromo.axis }} tickLine={false} interval={tickIntervalX}
                />
                <YAxis tick={{ fill: cromo.tick, fontSize: 11 }} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={v => formatCurrency(v)} labelFormatter={d => formatDate(d)}
                  contentStyle={{ background: cromo.tooltipBg, border: `1px solid ${cromo.tooltipBorder}`, borderRadius: '8px' }}
                  labelStyle={{ color: cromo.tooltipText }}
                />
                <Line type="monotone" dataKey="liquido" name="Patrimônio Líquido" stroke={cores[2]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
