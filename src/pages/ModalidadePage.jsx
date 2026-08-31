import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj } from '../utils/formatters';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import {
  MODALIDADES, NOME_MODALIDADE, ALERTA_MODALIDADE, modalidadeDaDeclaracao,
  blocosEspolio, blocosSaida, bensDaPartilha, conferenciasPartilha,
} from '../store/modalidadeDeclaracao';

// Tela das modalidades que NÃO são declaração de ajuste anual. Só aparece na
// navegação quando a declaração importada é uma delas (ver Sidebar).
//
// A montagem dos blocos é lógica pura em src/store/modalidadeDeclaracao.js,
// testada contra o retorno real do parser sobre ESP-01 e SAI-01.

function BlocoTexto({ bloco }) {
  return (
    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '14px 16px' }}>
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
        {bloco.titulo}
      </div>
      <table style={{ width: '100%', fontSize: '13px' }}>
        <tbody>
          {bloco.linhas.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 12px 3px 0', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{l.rotulo}</td>
              <td style={{ padding: '3px 0', textAlign: 'right' }}>{l.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ModalidadePage() {
  const { state } = useData();
  const anosDisponiveis = anosComDado(state);
  const [anoEscolhido, setAnoEscolhido] = useState(state.anoCalendario);
  useEffect(() => { setAnoEscolhido(state.anoCalendario); }, [state.anoCalendario]);

  const anoCalendario = anoEscolhido;
  const dados = anoCalendario != null ? dadosDoAno(state, anoCalendario) : null;
  const modalidade = modalidadeDaDeclaracao(dados);
  const blocos = modalidade === MODALIDADES.ESPOLIO
    ? blocosEspolio(dados?.espolioOficial)
    : blocosSaida(dados?.saidaDefinitivaOficial);
  const partilhados = modalidade === MODALIDADES.ESPOLIO ? bensDaPartilha(dados?.bens) : [];
  const avisosPartilha = conferenciasPartilha(dados?.bens);
  const herdeiros = dados?.espolioOficial?.herdeiros || [];

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

  return (
    <>
      <div className="page-header">
        <div className="page-header-left">
          <h2>{NOME_MODALIDADE[modalidade]}</h2>
          <p>Quadros que existem apenas nesta modalidade de declaração</p>
        </div>
        {seletorAno && <div className="page-header-actions">{seletorAno}</div>}
      </div>

      <div className="page-body animate-in">
        {modalidade === MODALIDADES.AJUSTE ? (
          <div className="card">
            <p style={{ margin: 0 }}>
              A declaração importada neste ano-calendário é uma declaração de ajuste anual, que não
              tem quadro de espólio nem de saída definitiva.
            </p>
          </div>
        ) : (
          <>
            {/* O alerta vem ANTES dos números: quem abre esta tela precisa saber
                o que muda na leitura antes de ler qualquer valor. */}
            <div className="card" style={{ marginBottom: '20px', borderLeft: '3px solid var(--accent-warning)' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-warning)', marginBottom: '6px' }}>
                O que muda nesta modalidade
              </div>
              <p style={{ margin: 0, fontSize: '13px' }}>{ALERTA_MODALIDADE[modalidade]}</p>
            </div>

            {blocos.length > 0 && (
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header">
                  <h3 className="card-title">Quadro da declaração</h3>
                  <span className="badge badge-blue" title="Lido do arquivo importado, não é calculado pelo app">Da declaração original</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
                  {blocos.map(bl => <BlocoTexto key={bl.id} bloco={bl} />)}
                </div>
              </div>
            )}

            {modalidade === MODALIDADES.ESPOLIO && herdeiros.length > 0 && (
              <div className="card" style={{ marginBottom: '20px' }}>
                <div className="card-header"><h3 className="card-title">Herdeiros e meeiro</h3></div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>CPF ou CNPJ</th><th>Nome</th></tr></thead>
                    <tbody>
                      {herdeiros.map((h, i) => (
                        <tr key={i}>
                          <td>{formatCpfCnpj(h.cpf_cnpj)}</td>
                          <td>{h.nome}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {modalidade === MODALIDADES.ESPOLIO && partilhados.length > 0 && (
              <div className="card">
                <div className="card-header"><h3 className="card-title">Bens transferidos na partilha</h3></div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0 }}>
                  Estes bens saem do patrimônio do espólio e passam aos herdeiros pelos percentuais
                  abaixo. O valor de transferência é o que a declaração informa como transmitido, e
                  não um saldo que continua existindo em 31/12.
                </p>
                {avisosPartilha.length > 0 && (
                  <div style={{ padding: '12px 14px', marginBottom: '16px', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                    {avisosPartilha.map((aviso, i) => (
                      <div key={i} style={{ fontSize: '12px' }}>{aviso}</div>
                    ))}
                  </div>
                )}
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Bem</th>
                        <th style={{ textAlign: 'right' }}>Situação na data da partilha</th>
                        <th style={{ textAlign: 'right' }}>Valor de transferência</th>
                        <th>Herdeiros e percentual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partilhados.map(b => (
                        <tr key={b.id}>
                          <td>{b.discriminacao}</td>
                          <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(b.situacaoDataPartilha)}</td>
                          <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(b.valorTransferencia)}</td>
                          <td>
                            {(b.herdeiros || []).map((h, i) => (
                              <div key={i} style={{ fontSize: '12px' }}>
                                {h.nome} ({formatCpfCnpj(h.cpf_cnpj)}): {h.percentual}%
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
