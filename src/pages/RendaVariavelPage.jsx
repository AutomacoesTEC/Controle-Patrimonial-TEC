import { Fragment, useMemo, useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatarAliquotaFicha, descreverOrigemDocumento, formatCpfCnpj } from '../utils/formatters';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import { linhasConsolidacaoMes, conferenciaConsolidacaoMes } from '../store/consolidacaoRendaVariavel';
import Ajuda from '../components/Ajuda';
import {
  linhasAnualRendaVariavel, linhasAnualFiiFiagro, ehDerivadoDosMeses, AVISO_DERIVADO,
} from '../store/anualRendaVariavel';
import TabelaRedimensionavel from '../components/TabelaRedimensionavel';

// Renda Variável, exatamente as duas fichas do menu do programa da Receita:
// "Operações Comuns / Day-Trade" e "Operações em FII ou Fiagro".
//
// Esta tela NÃO calcula nada: mostra o que veio na declaração importada. É
// deliberado. O resultado de renda variável depende de notas de corretagem mês
// a mês, que o app não tem; inventar um número aqui seria pior que exibir o que
// a própria declaração apurou.
//
// O que o app faz com esses números está no Demonstrativo do Dashboard: a perda
// em renda variável reduz o saldo de caixa do ano (dinheiro que saiu e não
// voltou), e o imposto pago sobre ganho líquido entra como desembolso.
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const nomeMes = (m) => MESES[m - 1] || `Mês ${m}`;

// [rótulo curto do cabeçalho, campo em `linha.comuns`]. O "(comuns)" que
// aparecia em toda coluna era ruído: o título do quadro já diz "Operações
// Comuns / Day-Trade", e a coluna de day-trade está nomeada à parte.
const LINHAS_APURACAO = [
  ['Resultado líquido', 'resultadoLiquidoMes'],
  ['Prejuízo acum. (mês anterior)', 'resultadoNegativoMesAnterior'],
  ['Base de cálculo', 'baseCalculoImposto'],
  ['Prejuízo a compensar', 'prejuizoCompensar'],
  ['Imposto devido', 'impostoDevido'],
];
const MERCADOS = [
  ['Mercado à Vista - Ações', 'vistaAcoes'],
  ['Mercado à Vista - Ouro', 'vistaOuro'],
  ['Mercado à Vista - Ouro fora de bolsa', 'vistaOuroForaBolsa'],
  ['Mercado de Opções - Ações', 'opcoesAcoes'],
  ['Mercado de Opções - Ouro', 'opcoesOuro'],
  ['Mercado de Opções - Fora de bolsa', 'opcoesForaBolsa'],
  ['Mercado de Opções - Outros', 'opcoesOutros'],
  ['Mercado Futuro - Dólar', 'futuroDolar'],
  ['Mercado Futuro - Índices', 'futuroIndices'],
  ['Mercado Futuro - Juros', 'futuroJuros'],
  ['Mercado Futuro - Outros', 'futuroOutros'],
  ['Mercado a Termo - Ações/Ouro', 'termoAcoesOuro'],
  ['Mercado a Termo - Outros', 'termoOutros'],
];
const LINHAS_FII = [
  ['Resultado líquido', 'resultadoLiquidoMes'],
  ['Prejuízo acum. (mês anterior)', 'resultadoNegativoMesAnterior'],
  ['Base de cálculo', 'baseCalculoImposto'],
  ['Prejuízo a compensar', 'prejuizoCompensar'],
  // A ficha imprime a alíquota entre o prejuízo a compensar e o imposto
  // devido (AJU-01 p37 r16, "ALÍQUOTA DO IMPOSTO"), e a tabela pulava a
  // linha. Sem ela não há como conferir que o imposto devido é a base vezes a
  // alíquota, que é a única conta desta ficha. Vem como texto do PDF e como
  // número do .DBK, por isso tem formato próprio.
  ['Alíquota', 'aliquota', 'aliquota'],
  ['Imposto devido', 'impostoDevido'],
  ['Imposto retido no mês', 'impostoRetidoNoMes'],
  ['Imposto retido antes', 'impostoRetidoMesesAnteriores'],
  ['Imposto a compensar', 'impostoACompensar'],
  ['Imposto a pagar', 'impostoAPagar'],
  ['Imposto pago', 'impostoPago'],
];

// R$ 0,00 sai apagado: num quadro de 12 meses em que a maioria é zero, isso é
// o que deixa o olho achar o mês que teve movimento.
function Valor({ n, formato }) {
  const num = Number(n) || 0;
  if (formato === 'aliquota') return <>{formatarAliquotaFicha(n)}</>;
  return <span className={num === 0 ? 'rv-zero' : undefined}>{formatCurrency(num)}</span>;
}

function ResumoFicha({ itens }) {
  const validos = itens.filter(i => i.valor != null);
  if (validos.length === 0) return null;
  return (
    <div className="rv-resumo">
      {validos.map(i => (
        <div key={i.rotulo}>
          <span className="rv-resumo-rotulo">{i.rotulo}</span>
          <span className={`rv-resumo-valor${i.destaque ? ' ' + i.destaque : ''}`}>
            {typeof i.valor === 'number' ? formatCurrency(i.valor) : i.valor}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RendaVariavelPage() {
  const { state } = useData();
  const anosDisponiveis = anosComDado(state);
  const [anoEscolhido, setAnoEscolhido] = useState(state.anoCalendario);
  const [mesAberto, setMesAberto] = useState(null);
  // Beneficiário em foco dentro de cada ficha (titular, dependente...). Só
  // vira aba quando há mais de um; com um só, mostra direto.
  const [benComuns, setBenComuns] = useState(null);
  const [benFii, setBenFii] = useState(null);

  useEffect(() => { setAnoEscolhido(state.anoCalendario); }, [state.anoCalendario]);

  const dados = anoEscolhido != null ? dadosDoAno(state, anoEscolhido) : null;
  const mensal = dados?.rendaVariavelMensalOficial || [];
  const fii = dados?.fiiFiagroMensalOficial || [];
  const anual = dados?.rendaVariavelAnualOficial || null;
  const fiiAnual = dados?.fiiFiagroAnualOficial || null;

  // Nome de aba de um beneficiário dependente. A usuária pediu (03/09/2026) para
  // a aba NÃO trazer o CPF cru ("Dependente 33344455508"). Mostra o nome do
  // dependente; cai no CPF formatado só quando o CPF do lançamento não casa com
  // nenhum dependente cadastrado no ano (dependente que saiu da lista) — mesma
  // regra de descreverBeneficiarioRendimento.
  const dependentes = state.dependentes || [];
  const nomeDependente = (cpf) => {
    const digitos = String(cpf || '').replace(/\D/g, '');
    const d = dependentes.find(x => String(x?.cpf || '').replace(/\D/g, '') === digitos);
    const nome = (d?.nome || '').trim();
    return nome || (digitos ? `Dependente ${formatCpfCnpj(digitos)}` : 'Dependente');
  };

  // Titular e dependentes vêm na mesma lista, com `titular` marcando de quem é
  // cada ficha — a declaração imprime as duas separadas, e aqui elas também
  // ficam separadas, senão o resultado de um dependente somaria com o do
  // titular sem ninguém perceber. `chave` é o identificador estável (React key,
  // estado de aba, composição do mês aberto); `nome` é só o rótulo exibido.
  const agrupar = (lista) => {
    const porBeneficiario = new Map();
    for (const linha of lista) {
      const chave = linha.titular ? 'titular' : (String(linha.cpfDependente || '').replace(/\D/g, '') || 'dependente');
      if (!porBeneficiario.has(chave)) porBeneficiario.set(chave, []);
      porBeneficiario.get(chave).push(linha);
    }
    return [...porBeneficiario.entries()].map(([chave, linhas]) => ({
      chave,
      nome: chave === 'titular' ? 'Titular' : nomeDependente(chave),
      linhas: linhas.sort((a, b) => a.mes - b.mes),
    }));
  };
  const grupos = useMemo(() => agrupar(mensal), [mensal]);
  const gruposFii = useMemo(() => agrupar(fii), [fii]);

  const totalImpostoPago = useMemo(
    () => mensal.reduce((s, m) => s + (m.consolidacao?.impostoPago || 0), 0)
      + fii.reduce((s, m) => s + (m.impostoPago || 0), 0),
    [mensal, fii]
  );

  const resumoComuns = (linhas) => {
    const ultimo = linhas[linhas.length - 1];
    const resultadoAno = linhas.reduce((s, l) => s + (l.comuns?.resultadoLiquidoMes || 0) + (l.daytrade?.resultadoLiquidoMes || 0), 0);
    const impostoDevido = linhas.reduce((s, l) => s + (l.consolidacao?.totalImpostoDevido ?? l.comuns?.impostoDevido ?? 0), 0);
    const impostoPago = linhas.reduce((s, l) => s + (l.consolidacao?.impostoPago || 0), 0);
    const mesesComResultado = linhas.filter(l => (l.comuns?.resultadoLiquidoMes || 0) !== 0 || (l.daytrade?.resultadoLiquidoMes || 0) !== 0).length;
    return [
      { rotulo: 'Resultado líquido no ano', valor: resultadoAno, destaque: resultadoAno < 0 ? 'currency negative' : resultadoAno > 0 ? 'currency positive' : undefined },
      { rotulo: 'Prejuízo a compensar no ano seguinte', valor: ultimo?.comuns?.prejuizoCompensar || 0 },
      { rotulo: 'Imposto devido no ano', valor: impostoDevido },
      { rotulo: 'Imposto pago no ano', valor: impostoPago },
      { rotulo: 'Meses com resultado', valor: String(mesesComResultado) },
    ];
  };
  const resumoFii = (linhas) => {
    const ultimo = linhas[linhas.length - 1];
    const resultadoAno = linhas.reduce((s, l) => s + (l.resultadoLiquidoMes || 0), 0);
    const impostoDevido = linhas.reduce((s, l) => s + (l.impostoDevido || 0), 0);
    const impostoPago = linhas.reduce((s, l) => s + (l.impostoPago || 0), 0);
    const mesesComResultado = linhas.filter(l => (l.resultadoLiquidoMes || 0) !== 0).length;
    return [
      { rotulo: 'Resultado líquido no ano', valor: resultadoAno, destaque: resultadoAno < 0 ? 'currency negative' : resultadoAno > 0 ? 'currency positive' : undefined },
      { rotulo: 'Prejuízo a compensar no ano seguinte', valor: ultimo?.prejuizoCompensar || 0 },
      { rotulo: 'Imposto devido no ano', valor: impostoDevido },
      { rotulo: 'Imposto pago no ano', valor: impostoPago },
      { rotulo: 'Meses com resultado', valor: String(mesesComResultado) },
    ];
  };

  const handleExport = () => exportListaToXlsx(
    [
      ...mensal.map(m => ({ ficha: 'Operações comuns/day-trade', beneficiario: m.titular ? 'Titular' : nomeDependente(m.cpfDependente), m })),
      ...fii.map(m => ({ ficha: 'FII ou Fiagro', beneficiario: m.titular ? 'Titular' : nomeDependente(m.cpfDependente), m })),
    ],
    [
      ['Ficha', l => l.ficha],
      ['Beneficiário', l => l.beneficiario],
      ['Mês', l => nomeMes(l.m.mes)],
      ['Resultado líquido do mês', l => l.m.comuns ? l.m.comuns.resultadoLiquidoMes : l.m.resultadoLiquidoMes],
      ['Resultado day-trade', l => l.m.daytrade ? l.m.daytrade.resultadoLiquidoMes : ''],
      ['Base de cálculo', l => l.m.comuns ? l.m.comuns.baseCalculoImposto : l.m.baseCalculoImposto],
      ['Prejuízo a compensar', l => l.m.comuns ? l.m.comuns.prejuizoCompensar : l.m.prejuizoCompensar],
      ['Imposto devido', l => l.m.comuns ? (l.m.consolidacao?.totalImpostoDevido ?? l.m.comuns.impostoDevido) : l.m.impostoDevido],
      ['Imposto pago', l => l.m.comuns ? (l.m.consolidacao?.impostoPago ?? 0) : l.m.impostoPago],
    ],
    'Renda Variável', 'renda_variavel', anoEscolhido
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

  const temAlgo = mensal.length > 0 || fii.length > 0 || anual || fiiAnual;

  // As DUAS fichas do menu do programa da Receita ficam SEMPRE visíveis como
  // abas (a usuária apontou em 03/09/2026 que sumiam quando só uma tinha dado).
  // A ficha sem dado fica desabilitada, para deixar claro que existe e está
  // vazia — igual ao programa do IRPF.
  const temComuns = grupos.length > 0 || anual;
  const temFii = gruposFii.length > 0 || fiiAnual;
  const abas = [
    { id: 'comuns', rotulo: 'Operações Comuns / Day-Trade', vazia: !temComuns },
    { id: 'fii', rotulo: 'FII ou Fiagro', vazia: !temFii },
  ];
  const [aba, setAba] = useState('comuns');
  const primeiraComDado = abas.find(a => !a.vazia)?.id || 'comuns';
  const abaAtiva = abas.find(a => a.id === aba && !a.vazia) ? aba : primeiraComDado;

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Renda Variável</h2>
          <p title="O resultado de renda variável depende das notas de corretagem mês a mês, que o app não tem. Os números aqui são os que a própria declaração apurou.">
            As duas fichas como vieram na declaração importada. Nada aqui é recalculado pelo app.
          </p>
        </div>
        <div className="page-header-actions">
          {seletorAno}
          {temAlgo && <button className="btn btn-secondary" onClick={handleExport}>Exportar .xlsx</button>}
        </div>
      </div>
      <div className="page-body animate-in">
        {!temAlgo && (
          <div className="card">
            <p style={{ margin: 0, fontSize: '13px' }}>
              Nenhuma ficha de Renda Variável nesta declaração. Se a sua declaração tem operações em bolsa, FII ou Fiagro,
              importe o arquivo .DBK (ou o PDF) de novo: as duas fichas são lidas pelos dois caminhos.
            </p>
          </div>
        )}

        {totalImpostoPago > 0 && (
          <div className="rv-total-imposto">
            <span>Imposto pago sobre renda variável no ano</span>
            <strong className="currency">{formatCurrency(totalImpostoPago)}</strong>
          </div>
        )}

        {temAlgo && (
          <div className="tabs" style={{ marginBottom: '20px' }}>
            {abas.map(a => (
              <button
                key={a.id}
                className={`tab ${abaAtiva === a.id ? 'active' : ''}`}
                disabled={a.vazia}
                title={a.vazia ? 'Sem dados nesta ficha' : undefined}
                onClick={() => !a.vazia && setAba(a.id)}
              >
                {a.rotulo}{a.vazia ? ' (sem dados)' : ''}
              </button>
            ))}
          </div>
        )}

        {abaAtiva === 'comuns' && (<>
        {grupos.length > 1 && (
          <div className="tabs" style={{ marginBottom: '16px' }}>
            {grupos.map(g => {
              const ativo = (grupos.some(x => x.chave === benComuns) ? benComuns : grupos[0].chave) === g.chave;
              return <button key={g.chave} className={`tab ${ativo ? 'active' : ''}`} onClick={() => setBenComuns(g.chave)}>{g.nome}</button>;
            })}
          </div>
        )}
        {grupos.filter(g => grupos.length === 1 || (grupos.some(x => x.chave === benComuns) ? benComuns : grupos[0].chave) === g.chave).map(grupo => (
          <div className="card" style={{ marginBottom: '20px' }} key={`rv-${grupo.chave}`}>
            <div className="card-header">
              <h3 className="card-title">Operações Comuns / Day-Trade: {grupo.nome}</h3>
              <span className="badge badge-blue">{grupo.linhas.length} mês(es)</span>
            </div>
            <ResumoFicha itens={resumoComuns(grupo.linhas)} />
            <TabelaRedimensionavel className="altura-natural">
              <table className="rv-mensal">
                <thead>
                  <tr>
                    <th>Mês</th>
                    {LINHAS_APURACAO.map(([rotulo]) => <th key={rotulo} style={{ textAlign: 'right' }}>{rotulo}</th>)}
                    <th style={{ textAlign: 'right' }}>Resultado day-trade</th>
                    <th style={{ textAlign: 'right' }}>Imposto a pagar</th>
                    <th style={{ textAlign: 'right' }}>Imposto pago</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.linhas.map(linha => (
                    // A key vai no Fragment, e não no <tr>: quem está na lista
                    // é o fragmento (a linha do mês mais a linha de detalhe que
                    // ela abre), e é dele que o React precisa da identidade.
                    <Fragment key={`${grupo.chave}-${linha.mes}`}>
                      <tr>
                        <td>
                          {nomeMes(linha.mes)}
                          {/* Cada mês é um quadro próprio na ficha impressa, e
                              a página muda de um mês para o outro. */}
                          {descreverOrigemDocumento(linha) && (
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(linha)}</div>
                          )}
                        </td>
                        {LINHAS_APURACAO.map(([rotulo, campo]) => (
                          <td key={rotulo} style={{ textAlign: 'right' }} className="currency">
                            <Valor n={linha.comuns?.[campo]} />
                          </td>
                        ))}
                        <td style={{ textAlign: 'right' }} className="currency"><Valor n={linha.daytrade?.resultadoLiquidoMes} /></td>
                        <td style={{ textAlign: 'right' }} className="currency"><Valor n={linha.consolidacao?.impostoPagar} /></td>
                        <td style={{ textAlign: 'right' }} className="currency"><Valor n={linha.consolidacao?.impostoPago} /></td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setMesAberto(mesAberto === `${grupo.chave}-${linha.mes}` ? null : `${grupo.chave}-${linha.mes}`)}
                          >
                            {mesAberto === `${grupo.chave}-${linha.mes}` ? 'Fechar' : 'Mercados'}
                          </button>
                        </td>
                      </tr>
                      {mesAberto === `${grupo.chave}-${linha.mes}` && (
                        <tr>
                          <td colSpan={LINHAS_APURACAO.length + 5}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
                              <table style={{ width: '100%' }}>
                                <thead><tr><th>Tipo de mercado/ativo</th><th style={{ textAlign: 'right' }}>Operações comuns</th><th style={{ textAlign: 'right' }}>Day-trade</th></tr></thead>
                                <tbody>
                                  {MERCADOS.map(([rotulo, campo]) => (
                                    <tr key={rotulo}>
                                      <td>{rotulo}</td>
                                      <td style={{ textAlign: 'right' }} className="currency"><Valor n={linha.comuns?.[campo]} /></td>
                                      <td style={{ textAlign: 'right' }} className="currency"><Valor n={linha.daytrade?.[campo]} /></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {/* CONSOLIDAÇÃO DO MÊS, como a declaração a imprime. É
                                  aqui que se vê POR QUE o imposto a pagar é menor que
                                  o devido: as duas retenções na fonte, a de day-trade
                                  e a da Lei nº 11.033/2004, são abatidas do mês. */}
                              {linhasConsolidacaoMes(linha.consolidacao).length > 0 && (
                                <div>
                                  <table style={{ width: '100%' }}>
                                    <thead><tr><th colSpan={2}>Consolidação do mês</th></tr></thead>
                                    <tbody>
                                      {linhasConsolidacaoMes(linha.consolidacao).map(l => (
                                        <tr key={l.campo}>
                                          <td>{l.rotulo}</td>
                                          <td style={{ textAlign: 'right' }} className="currency"><Valor n={l.valor} /></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {conferenciaConsolidacaoMes(linha.consolidacao) && (
                                    <div style={{ marginTop: '8px' }}>
                                      <Ajuda
                                        tom="ressalva"
                                        rotulo="Conferência da consolidação"
                                        titulo="Conferência da consolidação do mês"
                                        texto={conferenciaConsolidacaoMes(linha.consolidacao)}
                                      />
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </TabelaRedimensionavel>
          </div>
        ))}

        {anual && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Consolidação anual: operações comuns/day-trade</h3>
              {/* A ficha impressa de renda variável é MENSAL: não existe quadro
                  anual na declaração. Estes totais são soma do app, e dizer isso
                  evita que a pessoa procure no papel algo que não está lá. */}
              {ehDerivadoDosMeses(anual)
                ? <span className="badge badge-orange" title={AVISO_DERIVADO}>Somado pelo app</span>
                : <span className="badge badge-blue" title="Lido do arquivo importado">Da declaração original</span>}
            </div>
            {ehDerivadoDosMeses(anual) && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>{AVISO_DERIVADO}</p>
            )}
            <table className="rv-anual">
              <tbody>
                {linhasAnualRendaVariavel(anual).map(l => (
                  <tr key={l.rotulo}>
                    <td>{l.rotulo}</td>
                    <td style={{ textAlign: 'right' }} className="currency"><Valor n={l.valor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}

        {abaAtiva === 'fii' && (<>
        {gruposFii.length > 1 && (
          <div className="tabs" style={{ marginBottom: '16px' }}>
            {gruposFii.map(g => {
              const ativo = (gruposFii.some(x => x.chave === benFii) ? benFii : gruposFii[0].chave) === g.chave;
              return <button key={g.chave} className={`tab ${ativo ? 'active' : ''}`} onClick={() => setBenFii(g.chave)}>{g.nome}</button>;
            })}
          </div>
        )}
        {gruposFii.filter(g => gruposFii.length === 1 || (gruposFii.some(x => x.chave === benFii) ? benFii : gruposFii[0].chave) === g.chave).map(grupo => (
          <div className="card" style={{ marginBottom: '20px' }} key={`fii-${grupo.chave}`}>
            <div className="card-header">
              <h3 className="card-title">Operações em FII ou Fiagro: {grupo.nome}</h3>
              <span className="badge badge-blue">{grupo.linhas.length} mês(es)</span>
            </div>
            <ResumoFicha itens={resumoFii(grupo.linhas)} />
            <TabelaRedimensionavel className="altura-natural">
              <table className="rv-mensal">
                <thead>
                  <tr>
                    <th>Mês</th>
                    {LINHAS_FII.map(([rotulo]) => <th key={rotulo} style={{ textAlign: 'right' }}>{rotulo}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grupo.linhas.map(linha => (
                    <tr key={`fii-${grupo.chave}-${linha.mes}`}>
                      <td>
                        {nomeMes(linha.mes)}
                        {descreverOrigemDocumento(linha) && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{descreverOrigemDocumento(linha)}</div>
                        )}
                      </td>
                      {LINHAS_FII.map(([rotulo, campo, formato]) => (
                        <td key={rotulo} style={{ textAlign: 'right' }} className="currency">
                          <Valor n={linha[campo]} formato={formato} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TabelaRedimensionavel>
          </div>
        ))}

        {fiiAnual && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Consolidação anual: FII ou Fiagro</h3>
              {ehDerivadoDosMeses(fiiAnual)
                ? <span className="badge badge-orange" title={AVISO_DERIVADO}>Somado pelo app</span>
                : <span className="badge badge-blue" title="Lido do arquivo importado">Da declaração original</span>}
            </div>
            {ehDerivadoDosMeses(fiiAnual) && (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>{AVISO_DERIVADO}</p>
            )}
            <table className="rv-anual">
              <tbody>
                {linhasAnualFiiFiagro(fiiAnual).map(l => (
                  <tr key={l.rotulo}>
                    <td>{l.rotulo}</td>
                    <td style={{ textAlign: 'right' }} className="currency"><Valor n={l.valor} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </>)}
      </div>
    </>
  );
}
