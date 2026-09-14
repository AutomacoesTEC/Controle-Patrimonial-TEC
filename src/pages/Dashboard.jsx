import VendasAnterioresAviso from '../components/VendasAnterioresAviso';
import ResumoDemonstrativo from '../components/ResumoDemonstrativo';
import { painelFinanceiro, posicoesFinanceiras, coberturaTemporal, pontePatrimonial, parcelasDeclaradas } from '../store/auditoriaDemonstrativo';
import { exportDemonstrativoToXlsx } from '../utils/exportDemonstrativo';
import { filtrarPorPessoa } from '../store/titularidade';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { useState, useMemo, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, formatCPF, resumirMeses, GRUPOS_BENS, MOVIMENTACAO_TIPOS, MOVIMENTACAO_DIVIDA_TIPOS, truncarComReticencias, nomeCurtoBem } from '../utils/formatters';
import { version as VERSAO_APP } from '../../package.json';
import { exportToXlsx } from '../utils/exportXlsx';
import { situacaoBemAteData, diaAnterior } from '../store/demonstrativos';
import { demonstrativoPeriodo, serieEvolucao, totaisNaData, dadosDoAno, anosComDado, movimentacoesNoPeriodo } from '../store/consultaPeriodo';
import { saldosQueAtravessam, disponibilidadesEmData } from '../store/saldosCompensaveis';
import { conferirContinuidade } from '../store/continuidade';
import { classificarPendenciasSaldo } from '../store/classificacaoSaldo';
import { montarPainelIrrf } from '../store/painelIrrf';
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

function acionarPorTeclado(evento, acao) {
  if (evento.key === 'Enter' || evento.key === ' ') {
    evento.preventDefault();
    acao();
  }
}


// Escala monocromática da peça: os gráficos diferenciam categorias por
// luminosidade do navy, sem criar uma segunda linguagem de cor para a tela.
// O significado de ganho, perda ou ressalva continua reservado às classes
// semânticas usadas nas tabelas.
const CATEGORICAS = {
  dark: ['#aeb9d1', '#98a6c2', '#8291b1', '#6f7f9f', '#607292', '#526487', '#42557a', '#34486f'],
  light: ['#283453', '#3b4964', '#4d5c77', '#5f6e89', '#718099', '#8491a8', '#98a3b6', '#acb5c4'],
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

// O gráfico de distribuição precisa reservar menos espaço para o eixo de
// categorias em uma janela estreita. A leitura completa continua disponível
// no tooltip; aqui só evitamos que o eixo consuma toda a área das barras.
function useLarguraViewport() {
  const [largura, setLargura] = useState(() => typeof window === 'undefined' ? 1280 : window.innerWidth);
  useEffect(() => {
    const atualizar = () => setLargura(window.innerWidth);
    atualizar();
    window.addEventListener('resize', atualizar);
    return () => window.removeEventListener('resize', atualizar);
  }, []);
  return largura;
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
  const { state: estadoCompleto, dispatch } = useData();
  const [pessoaSelecionada, setPessoaSelecionada] = useState('todos');
  const state = useMemo(() => filtrarPorPessoa(estadoCompleto, pessoaSelecionada), [estadoCompleto, pessoaSelecionada]);
  const pessoas = useMemo(() => {
    const lista = [estadoCompleto, ...Object.values(estadoCompleto.historico || {})].flatMap(a => a.dependentes || []);
    return [...new Map(lista.map(d => [String(d.cpf || '').replace(/\D/g, '') || `id:${d.id}`, d])).entries()];
  }, [estadoCompleto]);
  const nomeRecorte = pessoaSelecionada === 'todos' ? 'Visão geral' : pessoaSelecionada === 'titular' ? 'Titular' : pessoas.find(([id]) => id === pessoaSelecionada)?.[1].nome || 'Dependente';
  // Categoria ('bens' | 'dividaComum' | 'dividaRural') cuja "Variação de..."
  // foi clicada — abre o modal com a lista de movimentações que compõem
  // aquele saldo. null = modal fechado.
  const [detalheCategoria, setDetalheCategoria] = useState(null);
  const tema = useTemaAtual();
  const cores = CATEGORICAS[tema];
  const cromo = CROMO_GRAFICO[tema];
  const larguraViewport = useLarguraViewport();
  const graficoCompacto = larguraViewport <= 560;
  const larguraEixoCategorias = graficoCompacto ? 132 : 210;
  const margemDireitaCategorias = graficoCompacto ? 70 : 110;
  const formatarCategoriaGrafico = graficoCompacto
    ? nome => nome.length > 19 ? `${nome.slice(0, 18)}…` : nome
    : undefined;

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
  const continuidade = useMemo(() => {
    const ano = Number(state.anoCalendario);
    const comAnterior = conferirContinuidade(state, ano - 1);
    return comAnterior.disponivel ? comAnterior : conferirContinuidade(state, ano);
  }, [state]);

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
  const checklistSaldo = useMemo(
    () => classificarPendenciasSaldo(state, demo, de, ate).filter(item => item.tipo !== 'aplicacao_sem_rendimento'),
    [state, demo, de, ate]
  );
  useEffect(() => {
    let fechados = [];
    const preparar = () => { fechados = [...document.querySelectorAll('.page-body details:not([open])')]; fechados.forEach(d => { d.open = true; }); };
    const restaurar = () => { fechados.forEach(d => { d.open = false; }); fechados = []; };
    window.addEventListener('beforeprint', preparar); window.addEventListener('afterprint', restaurar);
    return () => { window.removeEventListener('beforeprint', preparar); window.removeEventListener('afterprint', restaurar); };
  }, []);
  const geradoEm = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());

  // Saldos que ATRAVESSAM o exercício (prejuízos compensáveis) e
  // Disponibilidades — dois recortes do estudo de variação patrimonial, lidos
  // do fim do período (o snapshot do ano da data "até"). Ver saldosCompensaveis.js.
  const dadosFimPeriodo = useMemo(
    () => (ate ? dadosDoAno(state, Number(ate.slice(0, 4))) : null),
    [state, ate]
  );
  const saldosAtravessam = useMemo(
    () => saldosQueAtravessam(dadosFimPeriodo),
    [dadosFimPeriodo]
  );
  const disponibilidades = useMemo(
    () => (ate ? disponibilidadesEmData(dadosFimPeriodo, ate) : { total: 0, porGrupo: [] }),
    [dadosFimPeriodo, ate]
  );
  const painelIrrf = useMemo(
    () => montarPainelIrrf(dadosFimPeriodo || {}),
    [dadosFimPeriodo]
  );

  // Alertas de importação e cobertura ficam na ficha Importar declaração.
  // O demonstrativo mantém somente os avisos do período consultado.
  const avisosEstruturais = useMemo(() => {
    const lista = [];
    // Período: resposta ao filtro de datas. Marca discreta fica no próprio
    // card de período (onde as datas são editadas), e o texto também entra na
    // janela de abertura.
    if (demo && demo.anosCobertos.length === 0) {
      lista.push({ chave: 'semPeriodo', local: 'periodo', titulo: 'Não há dados neste período', texto: 'Ajuste as datas, ou importe a declaração do ano correspondente na aba Importar Declaração.' });
    } else if (demo && demo.anosSemDado.length > 0) {
      lista.push({ chave: 'anosSemDado', local: 'periodo', titulo: `Sem dados de ${demo.anosSemDado.join(', ')}`, texto: 'Esses anos ficam de fora das contas e dos gráficos.' });
    }
    return lista;
  }, [demo]);
  const assinaturaAviso = avisosEstruturais.map(a => a.chave).join('|');
  const [avisoVisto, setAvisoVisto] = useState(true);
  useEffect(() => {
    if (!assinaturaAviso) { setAvisoVisto(true); return; }
    let jaViu = false;
    try { jaViu = sessionStorage.getItem('cp-aviso-estrutural') === assinaturaAviso; } catch { /* sessionStorage indisponível */ }
    setAvisoVisto(jaViu);
  }, [assinaturaAviso]);
  const fecharAviso = () => {
    try { sessionStorage.setItem('cp-aviso-estrutural', assinaturaAviso); } catch { /* ignore */ }
    setAvisoVisto(true);
  };

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
  const varPctPeriodo = totIni && totIni.liquido !== 0 ? (variacaoPeriodo / Math.abs(totIni.liquido)) * 100 : null;

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

  const cobertura = useMemo(() => coberturaTemporal(state, de, ate), [state, de, ate]);
  const financeiro = useMemo(() => painelFinanceiro(estadoCompleto, de, ate, pessoaSelecionada), [estadoCompleto, de, ate, pessoaSelecionada]);
  const posicoes = useMemo(() => posicoesFinanceiras(dadosFimPeriodo, ate), [dadosFimPeriodo, ate]);
  const parcelas = useMemo(() => parcelasDeclaradas(state, de, ate), [state, de, ate]);
  const ponte = useMemo(() => detalheCategoria ? pontePatrimonial(state, CATEGORIA_VARIACAO[detalheCategoria].colecao, de, ate) : [], [state, detalheCategoria, de, ate]);
  const handleExport = () => exportDemonstrativoToXlsx({state, de, ate, pessoa: nomeRecorte, demo, financeiro, cobertura, painelIrrf, saldos: saldosAtravessam});

  if (!temDado) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-left">
            <h2>Demonstrativo</h2>
            <p>Visão geral do patrimônio</p>
          </div>
        </div>
        <div className="page-body demonstrativo-screen animate-in">
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
      <div className="page-header dashboard-screen-header">
        <div className="page-header-left">
          <h2>Demonstrativo</h2>
          <p>Período de {formatDate(de)} até {formatDate(ate)}</p>
        </div>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            Imprimir demonstrativo
          </button>
          <button className="btn btn-secondary" onClick={handleExport}>
            Exportar .xlsx
          </button>
        </div>
      </div>
      <div className="page-body demonstrativo-screen animate-in">
        <header className="print-header">
          <div>
            <strong>Demonstrativo de Conciliação Patrimonial: {nomeRecorte}</strong>
            <span>{state.contribuinte?.nome || 'Titular não informado'}</span>
          </div>
          <dl>
            <div><dt>CPF</dt><dd>{formatCPF(state.contribuinte?.cpf) || 'não informado'}</dd></div>
            <div><dt>Ano-calendário</dt><dd>{state.anoCalendario}</dd></div>
            <div><dt>Período</dt><dd>{formatDate(de)} a {formatDate(ate)}</dd></div>
          </dl>
        </header>

        {demo && (
        <>
        <ResumoDemonstrativo inicial={totIni?.liquido || 0} final={totFim?.liquido || 0} variacao={variacaoPeriodo} conciliacao={demo.saldoDeCaixa} financeiro={financeiro} posicoes={posicoes} cobertura={cobertura} parcelas={parcelas} state={estadoCompleto} pessoa={pessoaSelecionada} ate={ate} onNavigate={onNavigate} onDetalhar={() => setDetalheCategoria('bens')} controles={
          <div className="card dashboard-periodo-controles">
            <div className="card-header"><h3 className="card-title">Período da consulta</h3></div>
            <div className="form-group"><label>Visão do demonstrativo</label>
              <select className="form-control" aria-label="Visão do demonstrativo" value={pessoaSelecionada} onChange={e => setPessoaSelecionada(e.target.value)}>
                <option value="todos">Visão geral</option><option value="titular">Titular</option>
                {pessoas.map(([id, d]) => <option key={id} value={id}>Dependente: {d.nome}</option>)}
              </select>
            </div>
            {pessoaSelecionada !== 'todos' && <p role="status">Recorte de {nomeRecorte}. Dados sem titularidade identificada e totais fiscais agregados permanecem somente na visão geral.</p>}
            <div className="form-row">
              <div className="form-group">
                <label>De</label>
                <DateInput value={de} onChange={setDataDe} min={dateMinAttr} max={dateMaxAttr} ariaLabel="Data inicial do período" />
              </div>
              <div className="form-group">
                <label>Até</label>
                <DateInput value={ate} onChange={setDataAte} min={dateMinAttr} max={dateMaxAttr} ariaLabel="Data final do período" />
              </div>
              <div className="form-group">
                <button className="btn btn-secondary" onClick={() => { setDataDe(todoHistorico.de); setDataAte(todoHistorico.ate); }}>
                  Todo o histórico
                </button>
              </div>
            </div>
          </div>
        }
        contexto={continuidade.disponivel && (
          <div className="card continuidade-card">
            <div className="continuidade-resumo">
              <div>
                <h3 className="card-title">Continuidade com o ano anterior</h3>
                <p>Fechamento de {continuidade.anoAnterior} comparado à abertura de {continuidade.anoSeguinte}.</p>
              </div>
              <span className={`badge ${continuidade.divergencias.length ? 'badge-red' : 'badge-green'}`}>
                {continuidade.divergencias.length ? `${continuidade.divergencias.length} divergência(s)` : 'Saldos conferidos'}
              </span>
            </div>
            {continuidade.divergencias.length > 0 && (
              <details className="continuidade-detalhes">
                <summary>Ver divergências</summary>
                <ul>
                  {continuidade.divergencias.map((item, indice) => (
                    <li key={`${item.tipo}-${item.categoria}-${indice}`}>
                      <strong>{item.categoria}: {truncarComReticencias(item.identificacao, 90)}</strong>
                      {': '}{item.tipo === 'saldo_divergente'
                        ? `${formatCurrency(item.fechamento)} fechou / ${formatCurrency(item.abertura)} abriu`
                        : item.tipo === 'sumiu_com_saldo'
                          ? `sumiu levando saldo de ${formatCurrency(item.fechamento)}`
                          : `apareceu trazendo saldo anterior de ${formatCurrency(item.abertura)}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )} conciliacaoCards={<>
        <div className="card demonstrativo-bloco">
          <div className="card-header"><h3 className="card-title">Rendimentos</h3></div>
          <TabelaRedimensionavel responsive><table className="demonstrativo-table">
            <caption className="sr-only">Rendimentos do período consultado</caption>
            <thead className="demonstrativo-cabecalho"><tr><th scope="col">Descrição</th><th scope="col">Valor</th></tr></thead>
            <tbody>
              {/* Mesmo desenho da Tributação Exclusiva logo abaixo: bruto,
                  as retenções em linha própria e o líquido, que é o valor que
                  soma no Total Geral. As duas linhas de desconto só aparecem
                  quando existem, para não poluir a tela de quem só tem
                  rendimento sem retenção nenhuma. */}
              <tr><td>Tributáveis Recebidos de PJ, bruto</td><td className="currency">{formatCurrency(demo.rendimentos.tributavelPjBruto)}</td></tr>
              {demo.rendimentos.tributavelPjPrevidencia > 0 && (
                <tr>
                  <td>
                    PJ, contribuição previdenciária oficial
                    <Ajuda texto="INSS descontado na folha pela fonte pagadora. Sai daqui porque esta linha apresenta o líquido após as retenções informadas, e esse valor nunca chegou à conta de quem declara." />
                  </td>
                  <td className="currency negative">{formatCurrency(-demo.rendimentos.tributavelPjPrevidencia)}</td>
                </tr>
              )}
              {demo.rendimentos.tributavelPjIrrf > 0 && (
                <tr>
                  <td>
                    PJ, IRRF retido
                    <Ajuda texto="Imposto retido na fonte sobre o rendimento. Também não entra no caixa: a fonte pagadora reteve e recolheu. O acerto no ajuste anual aparece depois, em imposto a pagar ou a restituir. Não confundir com as quotas do IRPF em Pagamentos Diversos, que são o imposto do ano anterior." />
                  </td>
                  <td className="currency negative">{formatCurrency(-demo.rendimentos.tributavelPjIrrf)}</td>
                </tr>
              )}
              {(demo.rendimentos.tributavelPjPrevidencia > 0 || demo.rendimentos.tributavelPjIrrf > 0) && (
                <tr><td>Tributáveis Recebidos de PJ, líquido</td><td className="currency">{formatCurrency(demo.rendimentos.tributavelPJ)}</td></tr>
              )}
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
                      ? 'Receita bruta menos despesa de custeio e investimento da atividade rural, no período. Entra aqui porque este demonstrativo confronta a variação do patrimônio com o dinheiro que entrou e saiu, e o prejuízo rural saiu do caixa de verdade. Atenção: para o imposto, prejuízo na atividade rural NÃO reduz os outros rendimentos, e a declaração informa resultado tributável zero. Ele é compensado dentro da própria atividade, em anos seguintes.'
                      : `Receita bruta menos despesa de custeio e investimento da atividade rural, no período.${anosComRuralImportado.length > 0 ? ` Vem da apuração da declaração importada de ${anosComRuralImportado.join(', ')}, mês a mês; assim que houver lançamento no livro-caixa em Atividade Rural, aba Receitas e Despesas, passa a valer o lançamento.` : ''}`
                  } />
                </td><td className={`currency ${demo.rendimentos.demaisTributaveis >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.rendimentos.demaisTributaveis)}</td></tr>
              {demo.rendimentos.tributavelPfExterior !== 0 && (
                <tr>
                  <td>
                    Tributáveis Recebidos de PF e do Exterior
                    <Ajuda texto="Rendimentos de PF/exterior menos o Carnê-leão informado como pago. Ser antecipação do ajuste anual não elimina o desembolso. Não lance o mesmo imposto novamente em Despesas. O cadastro legado associa o pagamento à data do rendimento; confira a data efetiva antes de usar o recorte mensal." />
                  </td>
                  <td className="currency">{formatCurrency(demo.rendimentos.tributavelPfExterior)}</td>
                </tr>
              )}
              {demo.rendimentos.tributavelRra !== 0 && (
                <tr>
                  <td>
                    Recebidos Acumuladamente (RRA), após IRRF
                    <Ajuda texto="Rendimentos de anos anteriores pagos de uma vez, por decisão judicial ou administrativa. O valor é o tributável informado na ficha, já líquido da contribuição previdenciária, da pensão alimentícia e da parcela isenta de quem tem 65 anos ou mais. Entra aqui porque o dinheiro foi recebido no período; a opção de tributação escolhida (na fonte ou no ajuste) muda o cálculo do imposto, não o fato de a renda ter entrado." />
                  </td>
                  <td className="currency">{formatCurrency(demo.rendimentos.tributavelRra)}</td>
                </tr>
              )}
              <tr><td>Rendimentos Isentos e Não Tributáveis</td><td className="currency">{formatCurrency(demo.rendimentos.isentoValor)}</td></tr>
              <tr><td>Tributação Exclusiva, valores informados (13º já líquido)</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoBruto)}</td></tr>
              <tr><td>Tributação Exclusiva, IRRF ainda não descontado</td><td className="currency negative">{formatCurrency(-demo.rendimentos.exclusivoIrrf)}</td></tr>
              <tr><td>Tributação Exclusiva, líquido</td><td className="currency">{formatCurrency(demo.rendimentos.exclusivoLiquido)}</td></tr>
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Total Geral dos Rendimentos</td><td className="currency">{formatCurrency(demo.rendimentos.totalGeral)}</td></tr>
            </tbody>
          </table></TabelaRedimensionavel>
        </div>

        {/* Renda Variável é uma apuração complementar: seus valores não
            compõem o Total Geral dos Rendimentos. Mantemos o conteúdo e os
            detalhes existentes, mas damos a ele um bloco próprio para o
            total encerrar a tabela de rendimentos sem uma continuação ambígua. */}
        {demo.rendaVariavelMeses.length > 0 && (
          <div className="card demonstrativo-bloco demonstrativo-renda-variavel">
            <div className="card-header demonstrativo-complemento-cabecalho">
              <div>
                <h3 className="card-title">Renda Variável</h3>
                <p>Informação complementar. Não compõe o Total Geral dos Rendimentos.</p>
              </div>
            </div>
            {/* Desde 24/08/2026 os DOIS caminhos de importação trazem o valor
                de cada mês: o .DBK pelo registro 40 (a ficha mensal de
                operações comuns/day-trade) e o PDF pela página "GANHOS
                LÍQUIDOS OU PERDAS". A leitura sem valor continua possível em
                declaração importada por uma versão anterior do app, e é o
                que o ramo "ficha registrada em" atende — mostrar zero ali
                seria mentira. Em nenhum dos casos o ganho entra no total
                desta tela: ganho líquido em renda variável é tributação
                exclusiva, apurada e recolhida mês a mês fora do ajuste
                anual. A ficha de FII/Fiagro é exibida na tela Renda
                Variável e, por ora, não entra neste demonstrativo. */}
            <TabelaRedimensionavel responsive><table className="demonstrativo-table">
              <caption className="sr-only">Informações complementares de Renda Variável</caption>
              <thead className="demonstrativo-cabecalho"><tr><th scope="col">Descrição</th><th scope="col">Valor</th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    {demo.rendaVariavelComValor
                      ? `Renda Variável, ficha mensal: ${resumirMeses(demo.rendaVariavelMeses)}`
                      : `Renda Variável, ficha registrada em: ${resumirMeses(demo.rendaVariavelMeses)}`}
                    {demo.rendaVariavelComValor ? (
                      <Ajuda texto="Resultado mensal das operações, separado do imposto devido. A linha de ajuste acrescenta o resultado ainda não representado no resumo de rendimentos da mesma pessoa. A comparação é agregada: confira operações, retenções e pagamentos quando houver fontes incompletas ou divergentes." />
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
            </table></TabelaRedimensionavel>
          </div>
        )}

        <div className="card demonstrativo-bloco">
          <div className="card-header"><h3 className="card-title">Ganhos e Perdas Apurados</h3></div>
          <TabelaRedimensionavel responsive><table className="demonstrativo-table">
            <caption className="sr-only">Ganhos e Perdas Apurados no período consultado</caption>
            <thead className="demonstrativo-cabecalho"><tr><th scope="col">Descrição</th><th scope="col">Valor</th></tr></thead>
            <tbody>
              {demo.ganhos.vendas.map((v, i) => (
                <tr key={i}><td title={v.bem || ''}>{v.ganhoLiquido >= 0 ? 'GANHO APURADO NA VENDA DE' : 'PERDA APURADA NA VENDA DE'} {nomeCurtoBem(v.bem)}</td><td className={`currency ${v.ganhoLiquido >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(v.ganhoLiquido)}</td></tr>
              ))}
              {demo.ganhos.jaNosRendimentos > 0 && <tr><td>Menos: ganho já incluído nos rendimentos exclusivos (conferir resumo agregado)</td><td className="currency negative">{formatCurrency(-demo.ganhos.jaNosRendimentos)}</td></tr>}
              <tr>
                <td>
                  Ganho/perda após tributos informados nas vendas do período ({demo.ganhos.vendas.length} venda(s))
                  {demo.ganhos.daDeclaracao && (
                    <Ajuda texto="Valores vindos da Apuração do Ganho de Capital da declaração importada: valor de alienação menos custo de aquisição, por operação. A declaração informa ganho 0,00 quando a operação deu prejuízo, porque prejuízo não gera imposto, mas aqui a perda entra negativa, que é o efeito real no caixa. Assim que houver venda lançada como movimentação no bem, passa a valer a movimentação." />
                  )}
                  {!demo.ganhos.daDeclaracao && demo.ganhos.semIrrfCount > 0 && (
                    <Ajuda texto={`${demo.ganhos.semIrrfCount} venda(s) com ganho entraram pelo valor bruto, porque o IRRF não foi informado. Para o número ficar exato, edite a movimentação do bem e preencha "IRRF pago sobre o ganho".`} />
                  )}
                </td>
                <td className={`currency ${demo.ganhos.total >= 0 ? 'positive' : 'negative'}`}>{formatCurrency(demo.ganhos.total)}</td>
              </tr>
              {/* Perda em renda variável: dinheiro que saiu e não aparece em
                  ficha nenhuma da declaração. Ver a Ajuda da linha de Renda
                  Variável no card de Rendimentos, e o achado 12. */}
              {demo.rendaVariavelPerda !== 0 && (
                <tr>
                  <td>
                    Ajuste do resultado de Renda Variável no período
                    <Ajuda texto="Resultado das fichas mensais após tributos informados e ajustes para evitar repetir ganhos já incluídos nos rendimentos. Não corresponde ao total de vendas ou resgates." />
                  </td>
                  <td className={`currency ${demo.rendaVariavelPerda < 0 ? 'negative' : 'positive'}`}>{formatCurrency(demo.rendaVariavelPerda)}</td>
                </tr>
              )}
              {/* Venda financiada de ano anterior é uma distorção temporal,
                  não uma ausência de preço. Continua junto do ganho que afeta,
                  separada do checklist final desta rodada. */}
              {(demo.pendenciasAlienacao || []).some(p => p.vendaForaDoPeriodo) && <tr className="demonstrativo-nota"><td colSpan={2}><VendasAnterioresAviso pendencias={demo.pendenciasAlienacao} state={estadoCompleto} ate={ate} pessoa={pessoaSelecionada} onNavigate={onNavigate} /></td></tr>}
              <tr className="demonstrativo-espacador"><td colSpan={2}></td></tr>
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Resultado antes dos pagamentos</td><td className="currency">{formatCurrency(demo.saldoDeCaixaGeral)}</td></tr>
            </tbody>
          </table></TabelaRedimensionavel>
        </div>

        <div className="card demonstrativo-bloco">
          <div className="card-header"><h3 className="card-title">Pagamentos</h3></div>
          <TabelaRedimensionavel responsive><table className="demonstrativo-table">
            <caption className="sr-only">Pagamentos do período consultado</caption>
            <thead className="demonstrativo-cabecalho"><tr><th scope="col">Descrição</th><th scope="col">Valor</th></tr></thead>
            <tbody>
              <tr>
                <td>
                  Pagamentos efetuados (valores declarados)
                  <Ajuda texto="Soma o VALOR PAGO de cada item da ficha, como a declaração informa. A parcela não dedutível não é descontada aqui: ela diz que aquela parte não pode ser abatida do imposto, e não que o dinheiro voltou. Se num caso concreto ela for reembolso, o valor devolvido deve ser lançado em Rendimentos, que é onde ele entra no caixa de volta." />
                </td>
                <td className="currency negative">{formatCurrency(-demo.pagamentosEfetuados)}</td>
              </tr>
              <tr><td>Pagamentos Diversos (despesas gerais)</td><td className={`currency${demo.pagamentosDiversos > 0 ? ' negative' : ''}`}>{formatCurrency(-demo.pagamentosDiversos)}</td></tr>
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
              <tr className="demonstrativo-destaque demonstrativo-final"><td>Resultado da conciliação patrimonial</td><td className="currency">{formatCurrency(demo.saldoDeCaixa)}</td></tr>
              <tr className="demonstrativo-nota"><td colSpan={2}><p>Diferença entre os recursos registrados, os pagamentos e a variação do patrimônio líquido. Um valor positivo indica recursos acima das aplicações registradas; um valor negativo indica o contrário. O resultado orienta a conferência, mas não comprova saldo bancário disponível nem, sozinho, um erro na declaração.</p><p>Saldos anuais sem movimentos datados não comprovam a posição mensal. A diferença anual aparece no fechamento de 31/12, sem presumir que ocorreu em dezembro.</p></td></tr>
            </tbody>
          </table></TabelaRedimensionavel>
          {checklistSaldo.length > 0 && (
            <section className="saldo-checklist" aria-labelledby="saldo-checklist-titulo">
              <div className="saldo-checklist-cabecalho">
                <h4 id="saldo-checklist-titulo">Pontos para conferir na conciliação patrimonial</h4>
                <span>{checklistSaldo.length}</span>
              </div>
              <ul>
                {checklistSaldo.map((item, indice) => (
                  <li key={`${item.tipo}-${indice}`}>
                    <div>
                      <button type="button" onClick={() => onNavigate && onNavigate(item.destino)}>
                        {item.titulo}
                      </button>
                      <p>{item.texto}</p>
                    </div>
                    <strong className="currency">{formatCurrency(item.valor)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          )}

        </div>


</>} variacaoCard={<div className="card demonstrativo-bloco demonstrativo-variacao">
          <div className="card-header"><h3 className="card-title">Variação Patrimonial</h3></div>
          <TabelaRedimensionavel responsive><table className="demonstrativo-table">
            <caption className="sr-only">Variação Patrimonial no período consultado</caption>
            <thead className="demonstrativo-cabecalho"><tr><th scope="col">Descrição</th><th scope="col">Valor</th></tr></thead>
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
              <tr className="demonstrativo-total demonstrativo-total-clicavel" role="button" tabIndex={0} onClick={() => setDetalheCategoria('bens')} onKeyDown={evento => acionarPorTeclado(evento, () => setDetalheCategoria('bens'))} title="Ver as movimentações que compõem esse saldo">
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
              <tr className="demonstrativo-total demonstrativo-total-clicavel" role="button" tabIndex={0} onClick={() => setDetalheCategoria('dividaComum')} onKeyDown={evento => acionarPorTeclado(evento, () => setDetalheCategoria('dividaComum'))} title="Ver as movimentações que compõem esse saldo">
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
              <tr className="demonstrativo-total demonstrativo-total-clicavel" role="button" tabIndex={0} onClick={() => setDetalheCategoria('dividaRural')} onKeyDown={evento => acionarPorTeclado(evento, () => setDetalheCategoria('dividaRural'))} title="Ver as movimentações que compõem esse saldo">
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
          </table></TabelaRedimensionavel>
        </div>} />

        <details className="demo-detalhes-fiscais"><summary>Conferências fiscais anuais de {ate.slice(0, 4)}: IRRF e saldos transportáveis</summary><p>Dados anuais da declaração e do controle manual. Não são limitados ao mês selecionado.</p>
        {/* SALDOS QUE ATRAVESSAM O EXERCÍCIO (parte 2 do estudo de variação
            patrimonial). O que a lei deixa transportar de um ano para o outro
            são os PREJUÍZOS compensáveis — nunca o IRRF, que se resolve no
            próprio ajuste anual. Este card só EXIBE o que já veio na declaração
            (ver saldosCompensaveis.js), não recalcula. */}
        {saldosAtravessam.length > 0 && (
          <div className="card demonstrativo-bloco">
            <div className="card-header">
              <h3 className="card-title">Saldos que atravessam para o próximo exercício</h3>
              <span className="badge badge-blue">Declaração e controle manual</span>
            </div>
            <TabelaRedimensionavel responsive><table className="demonstrativo-table">
              <tbody>
                {saldosAtravessam.map(s => (
                  <tr key={s.chave}>
                    <td>
                      {s.rotulo}{s.requerRevisao && <small> (saldo oficial; conferir lançamentos manuais posteriores)</small>}
                      <Ajuda texto={s.base} />
                    </td>
                    <td className="currency">{formatCurrency(s.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table></TabelaRedimensionavel>
          </div>
        )}

        {(painelIrrf.linhas.length > 0 || painelIrrf.totalResumo != null) && (
          <div className="card painel-irrf demonstrativo-bloco">
            <div className="card-header">
              <div>
                <h3 className="card-title">IRRF do ano</h3>
                <p>Por fonte, beneficiário e tipo; conferência separada da conciliação patrimonial.</p>
              </div>
              {painelIrrf.confere != null && (
                <span className={`badge ${painelIrrf.confere ? 'badge-green' : 'badge-orange'}`}>
                  {painelIrrf.confere ? 'Total confere' : 'Total divergente'}
                </span>
              )}
            </div>
            {!painelIrrf.confere && painelIrrf.diferenca != null && (
              <Ajuda
                tom="ressalva"
                rotulo={`Diferença de ${formatCurrency(painelIrrf.diferenca)}`}
                titulo="IRRF detalhado não confere com o resumo"
                texto={`As linhas que compõem o ajuste somam ${formatCurrency(painelIrrf.totalPainel)}, mas o resumo importado informa ${formatCurrency(painelIrrf.totalResumo)}. Confira fontes ou fichas ainda sem detalhamento; o app não altera nenhum valor.`}
              />
            )}
            {painelIrrf.alertasRetencao.map(alerta => (
              <Ajuda
                key={`${alerta.fonte}-${alerta.beneficiario}-${alerta.data}`}
                tom="ressalva"
                rotulo={`Retenção possivelmente abaixo do esperado: ${alerta.fonte}`}
                titulo="Conferência mensal de IRRF"
                texto={`Em ${formatDate(alerta.data)}, foram informados ${formatCurrency(alerta.informado)}. Pela tabela de 2026, usando a maior dedução entre o simplificado e as deduções informadas, a referência é ${formatCurrency(alerta.esperado)}; diferença de ${formatCurrency(alerta.diferenca)}. É somente um alerta: confira a fonte pagadora e não altere o valor sem o comprovante.`}
              />
            ))}
            <TabelaRedimensionavel responsive>
              <table>
                <thead><tr><th>Fonte</th><th>Beneficiário</th><th>Tipo</th><th>Tratamento</th><th style={{ textAlign: 'right' }}>IRRF</th></tr></thead>
                <tbody>
                  {painelIrrf.linhas.map((linha, indice) => (
                    <tr key={`${linha.fonte}-${linha.beneficiario}-${linha.tipo}-${indice}`}>
                      <td>{linha.fonte}</td>
                      <td>{linha.beneficiario}</td>
                      <td>{linha.tipo}</td>
                      <td><span className={`badge ${linha.compoeAjuste ? 'badge-blue' : ''}`}>{linha.compoeAjuste ? 'Compõe o ajuste' : 'Informativo'}</span></td>
                      <td className="currency" style={{ textAlign: 'right' }}>{formatCurrency(linha.valor)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={4}>Total que compõe o ajuste</td><td className="currency" style={{ textAlign: 'right' }}>{formatCurrency(painelIrrf.totalPainel)}</td></tr>
                  {painelIrrf.totalResumo != null && <tr><td colSpan={4}>Total oficial do resumo</td><td className="currency" style={{ textAlign: 'right' }}>{formatCurrency(painelIrrf.totalResumo)}</td></tr>}
                </tfoot>
              </table>
            </TabelaRedimensionavel>
            <div className="painel-irrf-resumo">
              <span>Imposto devido <strong>{painelIrrf.impostoDevido == null ? 'Não individualizado / não informado' : formatCurrency(painelIrrf.impostoDevido)}</strong></span>
              <span>Saldo a pagar <strong>{painelIrrf.saldoPagar == null ? 'Não individualizado / não informado' : formatCurrency(painelIrrf.saldoPagar)}</strong></span>
              <span>Restituição <strong>{painelIrrf.impostoRestituir == null ? 'Não individualizado / não informado' : formatCurrency(painelIrrf.impostoRestituir)}</strong></span>
            </div>
          </div>
        )}
        </details>
        </>
        )}

        {/* Os gráficos ficam fora da peça principal e entram como consulta
            complementar, fechados na abertura para preservar a leitura do
            demonstrativo antes da exploração visual. */}
        <details className="dashboard-graficos">
          <summary>
            <span>Gráficos de apoio</span>
            <small>Distribuição e evolução patrimonial</small>
          </summary>
          <div className="dashboard-graficos-conteudo">
            {!cobertura.completa && <p>Há posições anuais sem movimentos completos. A linha mostra apenas as pontas registradas; não representa crescimento mensal comprovado.</p>}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Distribuição de Bens e Direitos por Categoria, situação em {formatDate(ate)}</h3>
          </div>
          {pieData.length > 0 ? (
            // Barra horizontal, não pizza: com 7-8 categorias e nomes longos
            // ("Aplicações e Investimentos"), fatia + rótulo colado sempre
            // amontoa — o rótulo do eixo Y já identifica a categoria, então
            // nem precisa de legenda à parte.
            <ResponsiveContainer width="100%" height={Math.max(220, pieData.length * 42 + 20)}>
              <BarChart data={pieData} layout="vertical" margin={{ top: 4, right: margemDireitaCategorias, bottom: 4, left: 4 }}>
                <CartesianGrid horizontal={false} stroke={cromo.grid} />
                <XAxis
                  type="number" domain={[0, dataMax => dataMax * 1.2]} tick={{ fill: cromo.tick, fontSize: 11 }}
                  tickFormatter={v => `${(v / 1000000).toFixed(1)}M`}
                  axisLine={{ stroke: cromo.axis }} tickLine={false}
                />
                <YAxis
                  type="category" dataKey="name" width={larguraEixoCategorias}
                  tick={{ fill: cromo.tick, fontSize: 11 }} tickFormatter={formatarCategoriaGrafico} axisLine={{ stroke: cromo.axis }} tickLine={false}
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
              <LineChart data={cobertura.completa ? evolucaoData : [evolucaoData[0], evolucaoData.at(-1)].filter(Boolean)} margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
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
                <Line type="stepAfter" dataKey="bens" name="Bens" stroke={cores[0]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                <Line type="stepAfter" dataKey="dividas" name="Dívidas" stroke={cores[7]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
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
              <LineChart data={cobertura.completa ? evolucaoData : [evolucaoData[0], evolucaoData.at(-1)].filter(Boolean)} margin={{ top: 4, right: 40, bottom: 4, left: 4 }}>
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
                <Line type="stepAfter" dataKey="liquido" name="Patrimônio Líquido" stroke={cores[2]} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
          </div>
        </details>
        <footer className="print-footer">
          <span>Gerado em {geradoEm}</span>
          <span>CP-TEC v{VERSAO_APP}</span>
        </footer>
      </div>

      <Modal open={!!detalheCategoria} onClose={() => setDetalheCategoria(null)} style={{ maxWidth: '1200px' }}>
        <div className="modal-header">
          <h3>{CATEGORIA_VARIACAO[detalheCategoria || 'bens'].titulo}, composição de {formatDate(de)} a {formatDate(ate)}</h3>
          <button className="modal-close" onClick={() => setDetalheCategoria(null)}>✕</button>
        </div>
        <div className="modal-body">
          <p>Posições e variação por registro. Diferenças sem movimentos datados permanecem identificadas; não são recebimentos presumidos.</p>
          {ponte.length === 0 ? <p>Nenhuma diferença de posição ou movimentação neste recorte.</p> : <div className="table-wrapper demo-ponte"><table><thead><tr><th>Registro / origem</th><th>Inicial</th><th>Final</th><th>Variação</th><th>Movimentos / evidência</th></tr></thead><tbody>{ponte.map((r,i) => <tr key={i}><td><details><summary>{r.ano} - {truncarComReticencias(r.descricao, 120)}</summary><p>{r.descricao}</p></details><br/><small>{r.origem}{r.origemDocumento && ' (PDF página ' + r.origemDocumento.pagina + ', linha ' + r.origemDocumento.linha + ')'}</small></td><td className="currency">{formatCurrency(r.inicial)}</td><td className="currency">{formatCurrency(r.final)}</td><td className="currency">{formatCurrency(r.variacao)}</td><td>{r.movimentos.length ? r.movimentos.map((m,j) => <div key={j}>{formatDate(m.data)}, {m.tipo}, {formatCurrency(m.valor)}</div>) : 'Posição registrada; completar movimentos e datas'}</td></tr>)}</tbody></table></div>}

        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setDetalheCategoria(null)}>Fechar</button>
        </div>
      </Modal>

      {/* Avisos relativos ao período consultado. */}
      <Modal open={avisosEstruturais.length > 0 && !avisoVisto} onClose={fecharAviso} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3>Antes de usar estes números</h3>
          <button className="modal-close" onClick={fecharAviso} aria-label="Fechar aviso">✕</button>
        </div>
        <div className="modal-body">
          {avisosEstruturais.map((a, i) => (
            <div key={a.chave} style={{ marginBottom: i < avisosEstruturais.length - 1 ? '18px' : 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px', color: a.grave ? 'var(--accent-danger)' : 'var(--accent-warning, #f59e0b)' }}>{a.titulo}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{a.texto}</div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={fecharAviso}>OK, entendi</button>
        </div>
      </Modal>
    </>
  );
}
