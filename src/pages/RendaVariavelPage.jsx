import { Fragment, useMemo, useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency } from '../utils/formatters';
import { exportListaToXlsx } from '../utils/exportXlsx';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';

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

// Linhas do quadro mensal de operações comuns/day-trade, na ordem impressa na
// declaração. Só as de apuração: os 13 tipos de mercado ficam num quadro
// próprio, aberto por linha.
const LINHAS_APURACAO = [
  ['Resultado líquido do mês', 'resultadoLiquidoMes'],
  ['Resultado negativo até o mês anterior', 'resultadoNegativoMesAnterior'],
  ['Base de cálculo do imposto', 'baseCalculoImposto'],
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
  ['Resultado líquido do mês', 'resultadoLiquidoMes'],
  ['Resultado negativo até o mês anterior', 'resultadoNegativoMesAnterior'],
  ['Base de cálculo do imposto', 'baseCalculoImposto'],
  ['Prejuízo a compensar', 'prejuizoCompensar'],
  ['Imposto devido', 'impostoDevido'],
  ['Imposto retido no mês', 'impostoRetidoNoMes'],
  ['Imposto retido em meses anteriores', 'impostoRetidoMesesAnteriores'],
  ['Imposto a compensar', 'impostoACompensar'],
  ['Imposto a pagar', 'impostoAPagar'],
  ['Imposto pago', 'impostoPago'],
];

export default function RendaVariavelPage() {
  const { state } = useData();
  const anosDisponiveis = anosComDado(state);
  const [anoEscolhido, setAnoEscolhido] = useState(state.anoCalendario);
  const [mesAberto, setMesAberto] = useState(null);

  useEffect(() => { setAnoEscolhido(state.anoCalendario); }, [state.anoCalendario]);

  const dados = anoEscolhido != null ? dadosDoAno(state, anoEscolhido) : null;
  const mensal = dados?.rendaVariavelMensalOficial || [];
  const fii = dados?.fiiFiagroMensalOficial || [];
  const anual = dados?.rendaVariavelAnualOficial || null;
  const fiiAnual = dados?.fiiFiagroAnualOficial || null;

  // Titular e dependentes vêm na mesma lista, com `titular` marcando de quem é
  // cada ficha — a declaração imprime as duas separadas, e aqui elas também
  // ficam separadas, senão o resultado de um dependente somaria com o do
  // titular sem ninguém perceber.
  const grupos = useMemo(() => {
    const porBeneficiario = new Map();
    for (const linha of mensal) {
      const chave = linha.titular ? 'Titular' : `Dependente ${linha.cpfDependente || ''}`.trim();
      if (!porBeneficiario.has(chave)) porBeneficiario.set(chave, []);
      porBeneficiario.get(chave).push(linha);
    }
    return [...porBeneficiario.entries()].map(([nome, linhas]) => ({ nome, linhas: linhas.sort((a, b) => a.mes - b.mes) }));
  }, [mensal]);

  const gruposFii = useMemo(() => {
    const porBeneficiario = new Map();
    for (const linha of fii) {
      const chave = linha.titular ? 'Titular' : `Dependente ${linha.cpfDependente || ''}`.trim();
      if (!porBeneficiario.has(chave)) porBeneficiario.set(chave, []);
      porBeneficiario.get(chave).push(linha);
    }
    return [...porBeneficiario.entries()].map(([nome, linhas]) => ({ nome, linhas: linhas.sort((a, b) => a.mes - b.mes) }));
  }, [fii]);

  const totalImpostoPago = useMemo(
    () => mensal.reduce((s, m) => s + (m.consolidacao?.impostoPago || 0), 0)
      + fii.reduce((s, m) => s + (m.impostoPago || 0), 0),
    [mensal, fii]
  );

  const handleExport = () => exportListaToXlsx(
    [
      ...mensal.map(m => ({ ficha: 'Operações comuns/day-trade', beneficiario: m.titular ? 'Titular' : `Dependente ${m.cpfDependente || ''}`, m })),
      ...fii.map(m => ({ ficha: 'FII ou Fiagro', beneficiario: m.titular ? 'Titular' : `Dependente ${m.cpfDependente || ''}`, m })),
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

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Renda Variável</h2>
          <p>As duas fichas de Renda Variável como vieram na declaração importada: Operações Comuns / Day-Trade e Operações em FII ou Fiagro. Os valores são os que a própria declaração apurou, mês a mês. Nada aqui é recalculado pelo app.</p>
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
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Imposto pago sobre renda variável no ano</h3>
              <span className="badge badge-blue">Da declaração</span>
            </div>
            <p className="currency" style={{ margin: 0, fontSize: '20px' }}>{formatCurrency(totalImpostoPago)}</p>
          </div>
        )}

        {grupos.map(grupo => (
          <div className="card" style={{ marginBottom: '20px' }} key={`rv-${grupo.nome}`}>
            <div className="card-header">
              <h3 className="card-title">Operações Comuns / Day-Trade: {grupo.nome}</h3>
              <span className="badge badge-blue">{grupo.linhas.length} mês(es)</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    {LINHAS_APURACAO.map(([rotulo]) => <th key={rotulo} style={{ textAlign: 'right' }}>{rotulo} (comuns)</th>)}
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
                    <Fragment key={`${grupo.nome}-${linha.mes}`}>
                      <tr>
                        <td>{nomeMes(linha.mes)}</td>
                        {LINHAS_APURACAO.map(([rotulo, campo]) => (
                          <td key={rotulo} style={{ textAlign: 'right' }} className="currency">
                            {formatCurrency(linha.comuns?.[campo] || 0)}
                          </td>
                        ))}
                        <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha.daytrade?.resultadoLiquidoMes || 0)}</td>
                        <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha.consolidacao?.impostoPagar || 0)}</td>
                        <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha.consolidacao?.impostoPago || 0)}</td>
                        <td>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setMesAberto(mesAberto === `${grupo.nome}-${linha.mes}` ? null : `${grupo.nome}-${linha.mes}`)}
                          >
                            {mesAberto === `${grupo.nome}-${linha.mes}` ? 'Fechar' : 'Mercados'}
                          </button>
                        </td>
                      </tr>
                      {mesAberto === `${grupo.nome}-${linha.mes}` && (
                        <tr>
                          <td colSpan={LINHAS_APURACAO.length + 5}>
                            <table style={{ width: '100%' }}>
                              <thead><tr><th>Tipo de mercado/ativo</th><th style={{ textAlign: 'right' }}>Operações comuns</th><th style={{ textAlign: 'right' }}>Day-trade</th></tr></thead>
                              <tbody>
                                {MERCADOS.map(([rotulo, campo]) => (
                                  <tr key={rotulo}>
                                    <td>{rotulo}</td>
                                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha.comuns?.[campo] || 0)}</td>
                                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha.daytrade?.[campo] || 0)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {anual && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3 className="card-title">Consolidação anual: operações comuns/day-trade</h3></div>
            <div className="table-container">
              <table>
                <tbody>
                  <tr><td>Resultado líquido do ano</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.resultadoLiquido)}</td></tr>
                  <tr><td>Resultado negativo de meses anteriores</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.resultadoNegativoMesesAnteriores)}</td></tr>
                  <tr><td>Base de cálculo</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.baseCalculo)}</td></tr>
                  <tr><td>Prejuízo a compensar</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.prejuizoACompensar)}</td></tr>
                  <tr><td>Imposto devido</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.impostoDevido)}</td></tr>
                  <tr><td>Imposto a pagar (consolidação)</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(anual.consolidacaoImpostoAPagar)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {gruposFii.map(grupo => (
          <div className="card" style={{ marginBottom: '20px' }} key={`fii-${grupo.nome}`}>
            <div className="card-header">
              <h3 className="card-title">Operações em FII ou Fiagro: {grupo.nome}</h3>
              <span className="badge badge-blue">{grupo.linhas.length} mês(es)</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    {LINHAS_FII.map(([rotulo]) => <th key={rotulo} style={{ textAlign: 'right' }}>{rotulo}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {grupo.linhas.map(linha => (
                    <tr key={`fii-${grupo.nome}-${linha.mes}`}>
                      <td>{nomeMes(linha.mes)}</td>
                      {LINHAS_FII.map(([rotulo, campo]) => (
                        <td key={rotulo} style={{ textAlign: 'right' }} className="currency">{formatCurrency(linha[campo] || 0)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {fiiAnual && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header"><h3 className="card-title">Consolidação anual: FII ou Fiagro</h3></div>
            <div className="table-container">
              <table>
                <tbody>
                  <tr><td>Resultado líquido do ano</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.resultadoLiquido)}</td></tr>
                  <tr><td>Base de cálculo</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.baseCalculoImposto)}</td></tr>
                  <tr><td>Prejuízo a compensar</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.prejuizoCompensar)}</td></tr>
                  <tr><td>Imposto devido</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.impostoDevido)}</td></tr>
                  <tr><td>Imposto retido (Lei 11.033/2004)</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.impostoRetidoLei11033)}</td></tr>
                  <tr><td>Imposto a pagar</td><td style={{ textAlign: 'right' }} className="currency">{formatCurrency(fiiAnual.impostoAPagar)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
