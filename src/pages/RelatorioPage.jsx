import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, formatCpfCnpj, GRUPOS_BENS, MOVIMENTACAO_TIPOS } from '../utils/formatters';
import { exportListaToXlsx, resumoMovimentacoes } from '../utils/exportXlsx';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import { totaisEvolucaoPatrimonial } from '../store/demonstrativos';

// As 3 tabelas de Doações compartilham o mesmo aviso: diferente dos demais
// cards "Da declaração original" deste arquivo (bens/pagamentos/renda
// variável/demonstrativo do exterior), o .DBK não tem nenhum registro para
// nenhuma das 4 fichas de doação, e a declaração de exemplo usada para
// decifrar todo o resto do app tem as 4 fichas como "Sem Informações" — não
// há nenhuma linha real de doação pra confirmar a posição das colunas. O
// layout foi extrapolado do mesmo padrão visual já confirmado em
// Pagamentos Efetuados (mesmo programa da Receita, mesma família de
// tabela), nunca conferido campo a campo contra um caso real.
function CardDoacoes({ titulo, itens, comCategoria = false }) {
  if (itens.length === 0) return null;
  // A ressalva de layout vale só para doação vinda do ARQUIVO. Doação
  // cadastrada à mão (origem 'manual', ver ADD_DOACAO_* no reducer) foi
  // digitada pela usuária: mandar conferir na declaração original um valor
  // que ela mesma acabou de digitar não ajuda, só tira a força do aviso onde
  // ele importa. Achado ao auditar a declaração de um segundo contribuinte em
  // 21/08/2026, cadastrando uma doação à mão. Item sem `origem` conta como
  // importado, porque o import grava a lista sem carimbar a marca.
  // A ressalva vale só para doação vinda do PDF: pelo `.DBK` o layout é
  // oficial (registros 34/90/91/92), e o que veio do cadastro manual foi
  // digitado pela usuária, sem layout a confirmar.
  const temImportada = itens.some(d => d.origem !== 'manual' && !d.layoutOficial);
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header">
        <h3 className="card-title">{titulo}</h3>
        {temImportada && (
          <span className="badge badge-orange" title="Lido do PDF importado, cujo layout de tabela foi extrapolado e nunca conferido contra uma declaração com doação real. Pelo arquivo .DBK esta ficha tem layout oficial.">Layout não confirmado contra dado real</span>
        )}
      </div>
      {temImportada && (
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
          Há doação lida do PDF da declaração. As
          colunas desta tabela foram extrapoladas do mesmo padrão visual de Pagamentos Efetuados, mas
          nunca foram conferidas contra um caso real de doação, já que a declaração de exemplo usada
          para decifrar o restante do app não tem nenhuma doação lançada. Confira os valores lidos do
          arquivo diretamente na declaração original. O que foi cadastrado à mão nesta tela não tem
          essa ressalva.
        </p>
      )}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Código</th>
              {comCategoria && <th>Categoria</th>}
              <th>Beneficiário</th>
              <th>CPF/CNPJ</th>
              <th style={{ textAlign: 'right' }}>Valor</th>
              <th>Descrição</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((it, i) => (
              <tr key={it.id ?? i}>
                <td>{it.codigo}</td>
                {comCategoria && <td>{it.categoria === 'idoso' ? 'Pessoa Idosa' : it.categoria === 'eca' ? 'ECA' : ''}</td>}
                <td>{it.nome_beneficiario}</td>
                <td>{formatCpfCnpj(it.cpf_cnpj)}</td>
                <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(it.valor)}</td>
                <td>{it.descricao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RelatorioPage() {
  const { state } = useData();
  const anosDisponiveis = anosComDado(state);
  const [anoEscolhido, setAnoEscolhido] = useState(state.anoCalendario);

  // O relatório acompanha o ano-calendário selecionado na sidebar por
  // padrão (mesmo comportamento do Dashboard), mas a escolha aqui é
  // independente dele — só resincroniza quando o ano ATIVO muda, nunca a
  // cada cadastro, senão ver o relatório de outro ano seria impossível sem
  // trocar o ano de trabalho na sidebar.
  useEffect(() => {
    setAnoEscolhido(state.anoCalendario);
  }, [state.anoCalendario]);

  const anoCalendario = anoEscolhido;
  const dados = anoCalendario != null ? dadosDoAno(state, anoCalendario) : null;
  const {
    bens = [], dividas = [], rendimentos = [], pagamentos = [], contribuinte, impostoDevido,
    demonstrativoExteriorOficial = [],
    doacoesEfetuadasOficial = [], doacoesPartidosOficial = [], doacoesEcaIdosoOficial = [],
    dividasRurais = [],
  } = dados || {};

  const seletorAno = anosDisponiveis.length > 0 && (
    <select
      className="form-control"
      style={{ width: 'auto' }}
      value={anoCalendario ?? ''}
      onChange={e => setAnoEscolhido(e.target.value === '' ? null : Number(e.target.value))}
    >
      {anosDisponiveis.map(y => <option key={y} value={y}>Ano-Calendário {y}</option>)}
    </select>
  );

  // Sem ano definido (antes da 1ª importação) não há relatório a emitir.
  if (anoCalendario == null || !dados) {
    return (
      <>
        <div className="page-header">
          <div className="page-header-left"><h2>Relatório para IRPF</h2><p>Prévia dos dados para a declaração</p></div>
          {seletorAno && <div className="page-header-actions">{seletorAno}</div>}
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

  // Mesmo critério do Dashboard (demonstrativos.js/variacaoPatrimonialTotal e
  // consultaPeriodo.js): BENS conta só a ficha Bens e Direitos, DÍVIDA conta
  // Dívidas e Ônus Reais MAIS a Dívida Rural.
  //
  // O bem da Atividade Rural fica de fora porque a aquisição dele já é
  // despesa de INVESTIMENTO no livro-caixa da atividade rural, dedutível
  // integralmente no resultado (IN SRF 83/2001, art. 8º, III e parágrafo
  // único; Decreto nº 9.580/2018, art. 55, § 2º, III; Lei 8.023/1990,
  // art. 4º, § 2º e art. 6º). Esse resultado já entra no demonstrativo como
  // rendimento, então somar o bem aqui também contaria o mesmo gasto duas
  // vezes. A dívida rural entra porque o empréstimo NÃO passa pelo
  // livro-caixa: é a origem real do dinheiro que financiou o que foi
  // aplicado.
  //
  // ATENÇÃO ao histórico, para não desfazer isto sem querer: esta tela somava
  // bensRurais desde a ATUALIZAÇÃO 9 de 21/08/2026, quando o critério de
  // então era "bens + bensRurais em toda tela de total agregado". As
  // ATUALIZAÇÕES 19 e 22 do mesmo dia inverteram o critério (áudio do chefe
  // da usuária) e varreram o Dashboard inteiro, mas não chegaram aqui, e o
  // Relatório ficou errado dos DOIS lados por quase um dia: somando bem rural
  // que não devia e ignorando dívida rural que devia entrar. Achado na
  // auditoria de 21/08/2026, com teste de regressão fixando o critério.
  const {
    bensAnterior: totalBensAnterior, bensAtual: totalBensAtual,
    dividaComumAtual, dividaRuralAnterior, dividaRuralAtual,
    dividasAnterior: totalDividasAnterior, dividasAtual: totalDividasAtual,
    patrimonioAnterior, patrimonioAtual,
  } = totaisEvolucaoPatrimonial({ bens, dividas, dividasRurais });

  // Ordem dos grupos: a de GRUPOS_BENS (01 a 08, depois 99), e não a que o
  // Object.keys devolve. Em JavaScript, chave que é inteiro canônico é
  // percorrida PRIMEIRO, em ordem crescente, antes das chaves de texto: "99"
  // é canônica, "01" a "08" não são por causa do zero à esquerda, e o
  // resultado era o relatório abrindo por "99 - Outros Bens e Direitos", na
  // frente de "01 - Bens Imóveis". A exportação .xlsx herdava a mesma ordem.
  // Achado na auditoria de 21/08/2026.
  const ordemGrupos = (chaves) => {
    const conhecidos = GRUPOS_BENS.map(g => g.codigo).filter(c => chaves.includes(c));
    const desconhecidos = chaves.filter(c => !GRUPOS_BENS.some(g => g.codigo === c)).sort();
    return [...conhecidos, ...desconhecidos];
  };

  const byGrupo = {};
  bens.forEach(b => {
    const g = b.grupo || '99';
    if (!byGrupo[g]) byGrupo[g] = { items: [], anterior: 0, atual: 0 };
    byGrupo[g].items.push(b);
    byGrupo[g].anterior += parseFloat(b.situacao_anterior) || 0;
    byGrupo[g].atual += parseFloat(b.situacao_atual) || 0;
  });

  // Mesma organização por grupo que a tela mostra: uma linha por bem, com o
  // grupo por extenso, na mesma ordem em que os cards aparecem aqui.
  const handleExport = () => {
    const bensOrdenados = ordemGrupos(Object.keys(byGrupo)).flatMap(g => byGrupo[g].items);
    exportListaToXlsx(
      bensOrdenados,
      [
        ['Grupo', b => { const g = GRUPOS_BENS.find(gb => gb.codigo === (b.grupo || '99')); return g ? `${g.codigo} - ${g.nome}` : `Grupo ${b.grupo || '99'}`; }],
        ['Código', b => b.codigo_bem || ''],
        ['Discriminação', b => b.discriminacao || ''],
        [`31/12/${anoCalendario - 1}`, b => b.situacao_anterior || 0],
        [`31/12/${anoCalendario}`, b => b.situacao_atual || 0],
        ['Variação', b => (b.situacao_atual || 0) - (b.situacao_anterior || 0)],
        ['Movimentações no Ano', b => resumoMovimentacoes(b)],
      ],
      `Relatório IRPF ${anoCalendario}`, 'relatorio_irpf', anoCalendario
    );
  };

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Relatório para IRPF {anoCalendario + 1}</h2>
          <p>Dados do ano-calendário {anoCalendario} prontos para declaração em {anoCalendario + 1}</p>
        </div>
        <div className="page-header-actions">
          {seletorAno}
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

        {impostoDevido && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Resumo da Declaração Importada</h3>
              <span className="badge badge-blue" title="Lido do arquivo .DBK importado, não é calculado pelo app">Da declaração original</span>
            </div>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base de Cálculo</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(impostoDevido.baseCalculo)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total do Imposto Devido</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(impostoDevido.impostoDevidoTotal)}</div>
              </div>
              <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total do Imposto Pago</div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(impostoDevido.impostoPagoTotal)}</div>
              </div>
              <div style={{ padding: '16px', background: 'rgba(59,130,246,0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontSize: '11px', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 600 }}>Saldo a Pagar</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatCurrency(impostoDevido.saldoPagar)}</div>
              </div>
              {impostoDevido.lei14754Imposto > 0 && (
                <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Imposto Lei 14.754/2023 (Exterior)</div>
                  <div style={{ fontSize: '18px', fontWeight: 700 }}>{formatCurrency(impostoDevido.lei14754Imposto)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {demonstrativoExteriorOficial.length > 0 && (
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <h3 className="card-title">Demonstrativo Lei 14.754/2023 (por bem)</h3>
              <span className="badge badge-blue" title="Lido do arquivo .DBK importado, não é calculado pelo app">Da declaração original</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
              Detalhamento por bem do total já mostrado acima (Imposto Lei 14.754/2023). O número do
              bem é o mesmo impresso na declaração original. Confira a identificação completa na
              ficha de Bens e Direitos dela, o arquivo importado não traz um vínculo direto.
            </p>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Bem</th>
                    <th style={{ textAlign: 'right' }}>Ganho/Prejuízo</th>
                    <th style={{ textAlign: 'right' }}>Imposto Devido</th>
                    <th style={{ textAlign: 'right' }}>Imposto Pago no Brasil/Exterior</th>
                    <th style={{ textAlign: 'right' }}>Base de Cálculo</th>
                    <th style={{ textAlign: 'right' }}>Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {demonstrativoExteriorOficial.map((d, i) => (
                    <tr key={i}>
                      <td>{d.bem}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.ganhoPrejuizo)}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.impostoDevido)}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.impostoPagoBrasilExterior)}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.baseCalculo)}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(d.saldo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <CardDoacoes titulo="Doações Efetuadas" itens={doacoesEfetuadasOficial} />
        <CardDoacoes titulo="Doações a Partidos Políticos e Candidatos a Cargos Eletivos" itens={doacoesPartidosOficial} />
        <CardDoacoes titulo="Doações Diretamente na Declaração (ECA e Pessoa Idosa)" itens={doacoesEcaIdosoOficial} comCategoria />

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header"><h3 className="card-title">Evolução Patrimonial</h3></div>
          {/* Composição da dívida em linha própria, mesmo tratamento que a
              ATUALIZAÇÃO 21 deu ao Dashboard: o total soma Dívidas e Ônus
              Reais com a Dívida Rural, e sem a decomposição não haveria como
              conferir de onde veio o número. Só aparece quando existe dívida
              rural, para não poluir a tela de quem não tem atividade rural. */}
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
          {(dividaRuralAnterior > 0 || dividaRuralAtual > 0) && (
            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
              A linha de Dívidas soma Dívidas e Ônus Reais com a Dívida Vinculada à Atividade Rural.
              Em 31/12/{anoCalendario} são {formatCurrency(dividaComumAtual)} da ficha Dívidas e Ônus Reais
              e {formatCurrency(dividaRuralAtual)} de dívida rural. Os bens da Atividade Rural não entram
              em Bens: a aquisição deles já é despesa de investimento no livro-caixa da atividade rural.
            </p>
          )}
        </div>

        {ordemGrupos(Object.keys(byGrupo)).map(g => {
          const data = byGrupo[g];
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
                    {data.items.map(b => {
                      const temMovimentacao = (b.movimentacoes || []).length > 0;
                      return (
                        <tr key={b.id} style={temMovimentacao ? { background: 'rgba(59,130,246,0.06)' } : undefined}>
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
                      );
                    })}
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