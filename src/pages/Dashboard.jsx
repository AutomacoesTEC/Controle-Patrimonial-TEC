import { useState, useMemo, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, resumirMeses, GRUPOS_BENS, MOVIMENTACAO_TIPOS, MOVIMENTACAO_DIVIDA_TIPOS } from '../utils/formatters';
import { exportToXlsx } from '../utils/exportXlsx';
import { situacaoBemAteData, diaAnterior } from '../store/demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, dadosDoAno, anosComDado, movimentacoesNoPeriodo } from '../store/consultaPeriodo';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend, LabelList } from 'recharts';
import DateInput from '../components/DateInput';
import Modal from '../components/Modal';
import Ajuda from '../components/Ajuda';

// Categorias clicáveis da Variação Patrimonial: cada uma sabe pra onde
// navegar (destino da Sidebar + aba, quando aplicável) e em qual coleção do
// estado buscar as movimentações do período pro modal de detalhe.
const CATEGORIA_VARIACAO = {
  bens: { titulo: 'Bens e Direitos', destino: 'bens', colecao: 'bens', tipos: MOVIMENTACAO_TIPOS },
  dividaComum: { titulo: 'Dívidas e Ônus Reais', destino: 'dividas', colecao: 'dividas', tipos: MOVIMENTACAO_DIVIDA_TIPOS },
  dividaRural: { titulo: 'Dívida Rural', destino: 'atividadeRural', destinoAba: 'dividas', colecao: 'dividasRurais', tipos: MOVIMENTACAO_DIVIDA_TIPOS },
};

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

// Ícones dos 3 cards de estatística do topo (mesmo estilo de linha das
// SunIcon/MoonIcon do App.jsx: viewBox 24, stroke, sem fill) — a classe CSS
// `.stat-icon` já existia (index.css) mas nunca tinha sido usada em nenhuma
// tela; sem ícone os cards ficavam só número + texto pequeno, "vagos".
const IconCarteira = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
const IconQuedaVermelha = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
    <polyline points="16 17 22 17 22 11" />
  </svg>
);
const IconBalanca = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" />
    <path d="M6 8l-4 8a4 4 0 0 0 8 0Z" />
    <path d="M18 8l-4 8a4 4 0 0 0 8 0Z" />
    <path d="M4 8h16" />
    <path d="M9 3h6" />
  </svg>
);

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

// Período padrão: o ano-calendário selecionado na sidebar, INTEIRO, de 01/01
// a 31/12 — o Dashboard já abre mostrando o ano que a usuária está
// trabalhando, sem precisar digitar nada. Continua independente dele: é só o
// valor de partida; ver o efeito abaixo que resincroniza esse padrão quando o
// ano selecionado muda, e "Todo o histórico" que usa periodoTodoHistorico em
// vez deste.
//
// O ano corrente também vai até 31/12, e não até hoje (decisão da usuária na
// auditoria de 21/08/2026). Parar na data de hoje fazia o card dizer
// "Situação em 21/08/2026" enquanto o Relatório para IRPF, na mesma sessão,
// falava em 31/12 — duas fotos diferentes do mesmo ano, sem nada explicando a
// diferença. Quem quiser a posição de hoje continua digitando a data no
// filtro, que é o que ele existe para fazer.
function periodoAnoSelecionado(state) {
  if (state.anoCalendario == null) return { de: '', ate: '' };
  const ano = state.anoCalendario;
  return { de: `${ano}-01-01`, ate: `${ano}-12-31` };
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

export default function Dashboard({ onNavigate } = {}) {
  const { state } = useData();
  // Categoria ('bens' | 'dividaComum' | 'dividaRural') cuja "Variação de..."
  // foi clicada — abre o modal com a lista de movimentações que compõem
  // aquele saldo. null = modal fechado.
  const [detalheCategoria, setDetalheCategoria] = useState(null);
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
  // Até 31/12 do último ano com dado, e não até hoje: desde que o período
  // padrão passou a ser o ano-calendário INTEIRO (ver periodoAnoSelecionado),
  // um teto na data de hoje deixaria o próprio valor de abertura do filtro
  // fora do limite dele no ano corrente.
  const anoMaxData = Math.max(
    anosDisponiveis.length > 0 ? anosDisponiveis[anosDisponiveis.length - 1] : new Date().getFullYear(),
    state.anoCalendario ?? 0,
  );
  const dateMaxAttr = `${anoMaxData}-12-31`;

  // UM filtro de período dirigindo TUDO: demonstrativo, cards, gráficos,
  // pizza e export — todos leem o mesmo de/ate, via motor multi-ano.
  const demo = useMemo(
    () => (de && ate ? demonstrativoPeriodo(state, de, ate) : null),
    [state, de, ate]
  );

  // Anos do período consultado cuja declaração veio do PDF. O caminho PDF só
  // lê 4 fichas (Bens e Direitos, Dívidas e Ônus Reais, Pagamentos Efetuados
  // e Doações); Rendimentos, Atividade Rural, Ganho de Capital, Imposto
  // Devido e Dependentes ficam de fora. Sem este aviso, o Demonstrativo
  // fechava com "Total Geral dos Rendimentos R$ 0,00" e um Saldo de Caixa
  // muito negativo, que é exatamente o desenho de acréscimo patrimonial a
  // descoberto — alarme falso, achado na auditoria de 21/08/2026.
  const anosImportadosPorPdf = useMemo(() => {
    if (!demo) return [];
    return demo.anosCobertos.filter(ano => dadosDoAno(state, ano)?.importFormato === 'pdf');
  }, [state, demo]);

  // Mesmo aviso, para o ano que foi importado mas é ANTERIOR ao campo
  // `importFormato` existir: não dá pra saber de qual arquivo ele veio, mas dá
  // pra ver o sintoma, que é o que importa aqui — declaração importada, com
  // bens, e nenhum rendimento lançado. Sem esta segunda checagem a correção
  // do aviso não valeria para nenhum perfil já existente, que é justamente
  // onde o alarme falso aparece hoje. Um .DBK de alguém que realmente não
  // teve renda nenhuma cai aqui também, e o texto cobre os dois casos sem
  // afirmar de qual arquivo veio.
  // Fichas que a declaração importada tem PREENCHIDAS e que o app não lê.
  // Agrupadas por ano do período consultado, sem repetir a mesma ficha duas
  // vezes. Ver FICHAS_NAO_LIDAS em importParsers.js.
  const fichasNaoLidas = useMemo(() => {
    if (!demo) return [];
    const acc = [];
    for (const ano of demo.anosCobertos) {
      const dados = dadosDoAno(state, ano);
      for (const ficha of (dados?.fichasNaoLidasComConteudo || [])) {
        if (!acc.includes(ficha)) acc.push(ficha);
      }
    }
    return acc;
  }, [demo, state]);

  const anosImportadosSemRendimento = useMemo(() => {
    if (!demo) return [];
    return demo.anosCobertos.filter(ano => {
      const dados = dadosDoAno(state, ano);
      if (!dados || dados.importFormato) return false;
      const origem = ano === state.anoCalendario ? state.origemAnoAtual : dados.origem;
      return origem === 'importacao'
        && (dados.bens || []).length > 0
        && (dados.rendimentos || []).length === 0;
    });
  }, [state, demo]);

  // Anos do período cujo resultado da Atividade Rural veio da APURAÇÃO
  // IMPORTADA da declaração, e não de lançamento no livro-caixa do app (ver
  // resultadoAtividadeRuralPeriodo, que prefere o manual quando existe). Não
  // é aviso de erro: é dizer de onde saiu o número, porque as duas fontes
  // convivem e a diferença entre elas importa na hora de conferir.
  const anosComRuralImportado = useMemo(() => {
    if (!demo) return [];
    return demo.anosCobertos.filter(ano => {
      const dados = dadosDoAno(state, ano);
      return dados
        && (dados.lancamentosRurais || []).length === 0
        && (dados.receitasDespesasRuraisOficial || []).length > 0;
    });
  }, [state, demo]);

  const totIni = useMemo(() => totaisNaData(state, de, 'de'), [state, de]);
  const totFim = useMemo(() => totaisNaData(state, ate, 'ate'), [state, ate]);
  const movimentacoesDetalhe = useMemo(
    () => (detalheCategoria ? movimentacoesNoPeriodo(state, CATEGORIA_VARIACAO[detalheCategoria].colecao, de, ate) : []),
    [state, detalheCategoria, de, ate]
  );
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
  // cards e do demonstrativo. Só `bens` (Bens e Direitos): bensRurais não
  // tem `grupo` da taxonomia de GRUPOS_BENS (código/discriminação apenas —
  // ficha própria, mais simples) e, misturado aqui, inflava o total além do
  // que a BensPage e o Demonstrativo de Conciliação mostram como "Bens e
  // Direitos" (achado real: usuária percebeu o valor descrepante).
  const pieData = useMemo(() => {
    if (!ate) return [];
    const dados = dadosDoAno(state, Number(ate.slice(0, 4)));
    if (!dados) return [];
    const byGrupo = {};
    (dados.bens || []).forEach(b => {
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

        {anosImportadosPorPdf.length === 0 && anosImportadosSemRendimento.length > 0 && (
          <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--accent-warning, #f59e0b)' }}>
            <div className="card-header"><h3 className="card-title">Sem rendimentos lançados: confira antes de usar estes números</h3></div>
            <p style={{ margin: 0, fontSize: '13px' }}>
              {anosImportadosSemRendimento.length === 1
                ? `O ano-calendário ${anosImportadosSemRendimento[0]} veio de uma declaração importada, tem bens cadastrados e nenhum rendimento.`
                : `Os anos-calendário ${anosImportadosSemRendimento.join(', ')} vieram de declarações importadas, têm bens cadastrados e nenhum rendimento.`}
              {' '}O demonstrativo abaixo confronta a variação do patrimônio com os rendimentos do período, então sem eles o
              Saldo de Caixa fica muito negativo mesmo que a declaração tenha renda. Reimporte o arquivo .DBK da mesma
              declaração em Importar Declaração, ou cadastre os rendimentos à mão.
            </p>
          </div>
        )}

        {/* Único aviso sobre ficha que ficou de fora. Só aparece quando a
            declaração REALMENTE tem dado numa ficha que o app não lê — o
            parser confirma isso lendo cada ficha e distinguindo "Sem
            Informações" de conteúdo (ver fichasNaoLidasComConteudo em
            importParsers.js). O carnê-leão (rendimentos de pessoa física e do
            exterior) é uma dessas fichas: se vier preenchido no PDF, cai aqui
            nomeado; se vier vazio, não há o que avisar, e a linha zerada
            abaixo está correta. Antes existia um segundo aviso ("Importação
            parcial") que gritava em TODO import por PDF mesmo com o carnê-leão
            vazio — alarme falso removido, porque um aviso que grita à toa
            deixa de ser lido quando gritar por um motivo real. */}
        {fichasNaoLidas.length > 0 && (
          <div className="card" style={{ marginBottom: '16px', borderColor: 'var(--accent-danger, #ef4444)' }}>
            <div className="card-header"><h3 className="card-title">Parte da declaração não foi importada</h3></div>
            <p style={{ margin: 0, fontSize: '13px' }}>
              A declaração importada tem informação nestas fichas, que o app ainda não lê:
            </p>
            <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '13px' }}>
              {fichasNaoLidas.map((ficha, i) => <li key={i}>{ficha}</li>)}
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: '13px' }}>
              Os valores dessas fichas não entram em nenhum número desta tela. Confira-os na declaração
              original, ou cadastre-os à mão, antes de usar o demonstrativo abaixo.
            </p>
          </div>
        )}


        {demo && (
        <>
        <h3 style={{ margin: '0 0 4px', fontSize: '16px' }}>Demonstrativo de Conciliação Patrimonial</h3>
        {/* Virou 4 cards separados (Variação Patrimonial / Rendimentos /
            Ganhos Apurados / Pagamentos), em vez de uma tabela só gigante —
            pedido real da usuária, "está tudo muito junto, separe por
            sessões diferentes pra melhor visualizar". Cada card fecha no seu
            próprio subtotal de destaque (Variação Patrimonial Total / Total
            Geral dos Rendimentos / Saldo de Caixa Geral / Saldo de Caixa),
            então a fronteira visual do card já bate com a fronteira lógica
            do cálculo. */}

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header"><h3 className="card-title">Variação Patrimonial</h3></div>
          <table className="demonstrativo-table">
            <tbody>
              <tr className="demonstrativo-secao">
                <td colSpan={2}>
                  <button type="button" className="demonstrativo-secao-link" onClick={() => onNavigate && onNavigate('bens')}>
                    Bens e Direitos
                  </button>
                </td>
              </tr>
              <tr><td>Situação em {formatDate(dataSaldoAnterior)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.bensAte)}</td></tr>
              <tr className="demonstrativo-total demonstrativo-total-clicavel" onClick={() => setDetalheCategoria('bens')} title="Ver as movimentações que compõem esse saldo">
                <td>Variação dos Bens</td><td className={`currency ${demo.varPatrimonial.deltaBens >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaBens)}</td>
              </tr>

              <tr className="demonstrativo-secao">
                <td colSpan={2}>
                  <button type="button" className="demonstrativo-secao-link" onClick={() => onNavigate && onNavigate('dividas')}>
                    Dívidas e Ônus Reais
                  </button>
                </td>
              </tr>
              <tr><td>Situação em {formatDate(dataSaldoAnterior)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaComumDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaComumAte)}</td></tr>
              <tr className="demonstrativo-total demonstrativo-total-clicavel" onClick={() => setDetalheCategoria('dividaComum')} title="Ver as movimentações que compõem esse saldo">
                <td>Variação das Dívidas e Ônus Reais</td><td className={`currency ${demo.varPatrimonial.deltaDividaComum >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaDividaComum)}</td>
              </tr>

              <tr className="demonstrativo-secao">
                <td colSpan={2}>
                  <button type="button" className="demonstrativo-secao-link" onClick={() => onNavigate && onNavigate('atividadeRural', 'dividas')}>
                    Dívida Rural
                  </button>
                </td>
              </tr>
              <tr><td>Situação em {formatDate(dataSaldoAnterior)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaRuralDe)}</td></tr>
              <tr><td>Situação em {formatDate(ate)}</td><td className="currency">{formatCurrency(demo.varPatrimonial.dividaRuralAte)}</td></tr>
              <tr className="demonstrativo-total demonstrativo-total-clicavel" onClick={() => setDetalheCategoria('dividaRural')} title="Ver as movimentações que compõem esse saldo">
                <td>Variação da Dívida Rural</td><td className={`currency ${demo.varPatrimonial.deltaDividaRural >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.varPatrimonial.deltaDividaRural)}</td>
              </tr>

              <tr className="demonstrativo-espacador"><td colSpan={2}></td></tr>
              {/* demo.varPatrimonial.total (o valor calculado, usado sem mudar em
                  Saldo de Caixa Geral logo abaixo) é "impacto no caixa": negativo
                  quando o patrimônio líquido CRESCEU (dinheiro saiu do caixa pra
                  virar bem ou pagar dívida) — mesma convenção da planilha
                  original (lá aparece como "PERDAS APURADAS" quando negativo).
                  Pedido real da usuária: essa tela é "Demonstrativo de
                  Conciliação PATRIMONIAL", não de caixa — só NESTA linha exibida
                  na tela, o sinal mostrado é invertido pra bater com a leitura
                  intuitiva (patrimônio cresceu = positivo/verde), sem alterar o
                  valor usado no resto do cálculo (Saldo de Caixa Geral etc.
                  continuam somando demo.varPatrimonial.total como está,
                  intocado). */}
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Variação Patrimonial Total</td><td className={`currency ${-demo.varPatrimonial.total >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(-demo.varPatrimonial.total)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header"><h3 className="card-title">Rendimentos</h3></div>
          <table className="demonstrativo-table">
            <tbody>
              <tr><td>Tributáveis Recebidos de P.J.</td><td className="currency">{formatCurrency(demo.rendimentos.tributavelPJ)}</td></tr>
              <tr>
                {/* O rótulo dizia "Demais Rend. Tributáveis", e isso era
                    incorreto quando o resultado é NEGATIVO: prejuízo na
                    atividade rural não reduz outros rendimentos, ele é
                    compensado dentro da própria atividade em anos seguintes, e
                    a declaração informa "Resultado tributável da Atividade
                    Rural: 0,00" nesse caso. O NÚMERO continua sendo o
                    resultado real (receita menos despesa), que é o que este
                    demonstrativo mede — ele é de FLUXO DE CAIXA, não a
                    apuração do IRPF. Só o rótulo mudou, então nenhum total
                    desta tela se altera. */}
                <td>
                  Resultado da Atividade Rural
                  <Ajuda texto={
                    demo.rendimentos.demaisTributaveis < 0
                      ? 'Receita bruta menos despesa de custeio e investimento da atividade rural, no período. Entra aqui porque este demonstrativo confronta a variação do patrimônio com o dinheiro que entrou e saiu, e o prejuízo rural saiu do caixa de verdade. Atenção: para o imposto, prejuízo na atividade rural NÃO reduz os outros rendimentos, e a declaração informa resultado tributável zero — ele é compensado dentro da própria atividade, em anos seguintes.'
                      : `Receita bruta menos despesa de custeio e investimento da atividade rural, no período.${anosComRuralImportado.length > 0 ? ` Vem da apuração da declaração importada de ${anosComRuralImportado.join(', ')}, mês a mês; assim que houver lançamento no livro-caixa em Atividade Rural, aba Receitas e Despesas, passa a valer o lançamento.` : ''}`
                  } />
                </td><td className={`currency ${demo.rendimentos.demaisTributaveis >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.rendimentos.demaisTributaveis)}</td></tr>
              {demo.rendimentos.tributavelPfExterior !== 0 && (
                <tr>
                  <td>
                    Tributáveis Recebidos de P.F. e do Exterior
                    <Ajuda texto="Rendimentos recebidos de pessoa física, aluguéis, outros e do exterior, sujeitos ao carnê-leão. São tributáveis e entram no ajuste anual; o imposto pago mensalmente por carnê-leão é antecipação, e por isso não é descontado desta linha." />
                  </td>
                  <td className="currency">{formatCurrency(demo.rendimentos.tributavelPfExterior)}</td>
                </tr>
              )}
              {demo.rendimentos.tributavelRra !== 0 && (
                <tr>
                  <td>
                    Recebidos Acumuladamente (RRA)
                    <Ajuda texto="Rendimentos de anos anteriores pagos de uma vez, por decisão judicial ou administrativa. O valor é o tributável informado na ficha, já líquido da contribuição previdenciária, da pensão alimentícia e da parcela isenta de quem tem 65 anos ou mais. Entra aqui porque o dinheiro foi recebido no período; a opção de tributação escolhida (na fonte ou no ajuste) muda o cálculo do imposto, não o fato de a renda ter entrado." />
                  </td>
                  <td className="currency">{formatCurrency(demo.rendimentos.tributavelRra)}</td>
                </tr>
              )}
              <tr><td>Rendimentos Isentos e Não Tributáveis</td><td className="currency">{formatCurrency(demo.rendimentos.isentoValor)}</td></tr>
              <tr><td>Tributação Exclusiva, bruto</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoBruto)}</td></tr>
              <tr><td>Tributação Exclusiva, IRRF retido</td><td className="currency negative">{formatCurrency(-demo.rendimentos.exclusivoIrrf)}</td></tr>
              <tr><td>Tributação Exclusiva, líquido</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoLiquido)}</td></tr>
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Total Geral dos Rendimentos</td><td className="currency positive">{formatCurrency(demo.rendimentos.totalGeral)}</td></tr>
              {/* Renda Variável vira uma LINHA da tabela, e não um parágrafo,
                  para que a coluna de valores possa dizer o que se sabe sobre
                  ela. O detalhe fica no "?" (ver Ajuda). */}
              {/* Duas leituras possíveis nesta linha, e a diferença importa:
                  importando por PDF o ganho ou a perda de cada mês é lido de
                  verdade e aparece aqui; importando por .DBK só os meses são
                  conhecidos (o campo de valor do registro 76 nunca pôde ser
                  decifrado), e aí a coluna continua dizendo isso em vez de
                  mostrar um zero que seria mentira. Em nenhum dos dois casos o
                  valor entra em total desta tela: ganho líquido em renda
                  variável é tributação exclusiva, apurada e recolhida mês a
                  mês fora do ajuste anual. */}
              {demo.rendaVariavelMeses.length > 0 && (
                <tr>
                  <td>
                    {demo.rendaVariavelComValor
                      ? `Renda Variável, ficha mensal: ${resumirMeses(demo.rendaVariavelMeses)}`
                      : `Renda Variável, ficha registrada em: ${resumirMeses(demo.rendaVariavelMeses)}`}
                    {demo.rendaVariavelComValor ? (
                      <Ajuda texto="Ganho líquido ou perda somando as fichas do titular e dos dependentes nos meses do período, lido da declaração importada. Não entra em nenhum total desta tela porque a renda variável é de tributação exclusiva, apurada e paga mês a mês, fora do ajuste anual. Perda de um mês não some: fica como prejuízo a compensar em meses seguintes." />
                    ) : (
                      <Ajuda texto="Os meses em que a declaração tem ficha de Renda Variável, sem o valor do ganho ou da perda. Não entra em nenhum total desta tela." />
                    )}
                  </td>
                  {demo.rendaVariavelComValor ? (
                    <td className={`currency ${demo.rendaVariavelResultado >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(demo.rendaVariavelResultado)}
                    </td>
                  ) : (
                    <td className="currency" style={{ color: 'var(--text-muted)' }}>valor não lido</td>
                  )}
                </tr>
              )}
              {demo.rendaVariavelComValor && demo.rendaVariavelImposto > 0 && (
                <tr>
                  <td>
                    Renda Variável, imposto devido no período
                    <Ajuda texto="Soma do imposto devido apurado nas fichas mensais de Renda Variável do período. É imposto de tributação exclusiva, recolhido por DARF até o último dia útil do mês seguinte ao da apuração, e por isso não se confunde com o imposto do ajuste anual." />
                  </td>
                  <td className="currency">{formatCurrency(demo.rendaVariavelImposto)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header"><h3 className="card-title">Ganhos Apurados</h3></div>
          <table className="demonstrativo-table">
            <tbody>
              {demo.ganhos.vendas.map((v, i) => (
                <tr key={i}><td>{v.ganhoLiquido >= 0 ? 'GANHO APURADO NA VENDA DE' : 'PERDA APURADA NA VENDA DE'} {v.bem}</td><td className={`currency ${v.ganhoLiquido >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(v.ganhoLiquido)}</td></tr>
              ))}
              <tr>
                <td>
                  Ganho/perda líquido de IRRF nas vendas do período ({demo.ganhos.vendas.length} venda(s))
                  {demo.ganhos.daDeclaracao && (
                    <Ajuda texto="Valores vindos da Apuração do Ganho de Capital da declaração importada: valor de alienação menos custo de aquisição, por operação. A declaração informa ganho 0,00 quando a operação deu prejuízo, porque prejuízo não gera imposto, mas aqui a perda entra negativa, que é o efeito real no caixa. Assim que houver venda lançada como movimentação no bem, passa a valer a movimentação." />
                  )}
                  {!demo.ganhos.daDeclaracao && demo.ganhos.semIrrfCount > 0 && (
                    <Ajuda texto={`${demo.ganhos.semIrrfCount} venda(s) com ganho entraram pelo valor bruto, porque o IRRF não foi informado. Para o número ficar exato, edite a movimentação do bem e preencha "IRRF pago sobre o ganho".`} />
                  )}
                </td>
                <td className={`currency ${demo.ganhos.total >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.ganhos.total)}</td>
              </tr>
              <tr className="demonstrativo-espacador"><td colSpan={2}></td></tr>
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Saldo de Caixa Geral</td><td className={`currency ${demo.saldoDeCaixaGeral >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.saldoDeCaixaGeral)}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Pagamentos</h3></div>
          <table className="demonstrativo-table">
            <tbody>
              <tr>
                <td>
                  Pagamentos Efetuados (ficha dedutível)
                  <Ajuda texto="Soma o VALOR PAGO de cada item da ficha, como a declaração informa. A parcela não dedutível não é descontada aqui: ela diz que aquela parte não pode ser abatida do imposto, e não que o dinheiro voltou. Se num caso concreto ela for reembolso, o valor devolvido deve ser lançado em Rendimentos, que é onde ele entra no caixa de volta." />
                </td>
                <td className="currency negative">{formatCurrency(-demo.pagamentosEfetuados)}</td>
              </tr>
              <tr><td>Pagamentos Diversos (despesas gerais)</td><td className="currency negative">{formatCurrency(-demo.pagamentosDiversos)}</td></tr>
              {/* Doações (Efetuadas + Partidos/Candidatos + ECA/Pessoa
                  Idosa): dinheiro que saiu de verdade do caixa da pessoa
                  física, por isso reduz o Saldo de Caixa igual Pagamentos —
                  sem isso, uma doação grande faria o Saldo de Caixa parecer
                  "sobrando" dinheiro que na real virou doação. Lidas do PDF,
                  não do .DBK, com layout NUNCA conferido contra um caso real
                  (ver aviso em Relatório IRPF > Doações) — por isso o valor
                  entra aqui, mas com o mesmo aviso de cautela. */}
              {demo.totalDoacoes > 0 && (
                <>
                  <tr>
                    <td>
                      Doações Efetuadas, a Partidos/Candidatos e ECA/Pessoa Idosa
                      {demo.temDoacaoImportada && (
                        <Ajuda texto="Há doação lida do PDF da declaração, e o layout dessa ficha nunca foi conferido contra um caso real (ver Relatório IRPF, seção Doações). Confira o valor antes de confiar no Saldo de Caixa. Doação cadastrada à mão não tem essa ressalva." />
                      )}
                    </td>
                    <td className="currency negative">{formatCurrency(-demo.totalDoacoes)}</td>
                  </tr>
                </>
              )}
              <tr className="demonstrativo-espacador"><td colSpan={2}></td></tr>
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Saldo de Caixa</td><td className={`currency ${demo.saldoDeCaixa >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.saldoDeCaixa)}</td></tr>
            </tbody>
          </table>
        </div>
        </>
        )}

        {/* 3 cards em vez de 5: os dois "Patrimônio Líquido" (anterior/
            atual) e o card solto de "Variação no período" viraram UM só,
            com a comparação e o delta dentro do mesmo card — pedido real da
            usuária ("unificaria os saldos de patrimônio líquido em um só").
            Ícone em cada card (classe `.stat-icon` já existia no CSS, nunca
            tinha sido usada em lugar nenhum do app) pra parar de ficar
            "vago" — só número e texto pequeno, sem nenhuma âncora visual. */}
        <div className="stats-grid">
          <div className="stat-card blue">
            <div className="stat-icon blue"><IconCarteira /></div>
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.totalBens || 0)}</h3>
              <p>Bens e Direitos em {formatDate(ate)}</p>
              <span className="stat-change positive">{totFim?.qtdBens || 0} itens</span>
            </div>
          </div>
          <div className="stat-card orange">
            <div className="stat-icon orange"><IconQuedaVermelha /></div>
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.totalDividas || 0)}</h3>
              <p>Dívidas em {formatDate(ate)}</p>
              <span className="stat-change negative">{totFim?.qtdDividas || 0} itens</span>
            </div>
          </div>
          <div className="stat-card green">
            <div className="stat-icon green"><IconBalanca /></div>
            <div className="stat-info">
              <h3>{formatCurrency(totFim?.liquido || 0)}</h3>
              <p>Patrimônio Líquido em {formatDate(ate)}</p>
              <div className="stat-comparativo">
                <span className="stat-comparativo-label">Em {formatDate(dataSaldoAnterior)}</span>
                <span className="stat-comparativo-valor">{formatCurrency(totIni?.liquido || 0)}</span>
              </div>
              <span className={`stat-change ${variacaoPeriodo >= 0 ? 'positive' : 'negative'}`}>
                {variacaoPeriodo >= 0 ? '▲' : '▼'} {formatCurrency(Math.abs(variacaoPeriodo))} ({varPctPeriodo.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginTop: '20px' }}>
          <div className="card-header">
            <h3 className="card-title">Distribuição de Bens e Direitos por Categoria, situação em {formatDate(ate)}</h3>
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
            <h3 className="card-title">Bens e Dívidas, período de {formatDate(de)} até {formatDate(ate)}</h3>
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

      <Modal open={!!detalheCategoria} onClose={() => setDetalheCategoria(null)}>
        <div className="modal-header">
          <h3>{CATEGORIA_VARIACAO[detalheCategoria || 'bens'].titulo}, movimentações de {formatDate(de)} a {formatDate(ate)}</h3>
          <button className="modal-close" onClick={() => setDetalheCategoria(null)}>✕</button>
        </div>
        <div className="modal-body">
          {movimentacoesDetalhe.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Nenhuma movimentação registrada nesse período.</p>
          ) : (
            <div className="table-container">
              <table>
                <thead><tr><th>Data</th><th>Tipo</th><th>Discriminação</th><th style={{ textAlign: 'right' }}>Valor</th></tr></thead>
                <tbody>
                  {movimentacoesDetalhe.map((m, i) => (
                    <tr key={i}>
                      <td>{formatDate(m.data)}</td>
                      <td>{CATEGORIA_VARIACAO[detalheCategoria || 'bens'].tipos[m.tipo]?.label || m.tipo}</td>
                      <td style={{ maxWidth: '320px' }}>{(m.discriminacao || '').substring(0, 100)}</td>
                      <td className="currency">{formatCurrency(m.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setDetalheCategoria(null)}>Fechar</button>
        </div>
      </Modal>
    </>
  );
}
