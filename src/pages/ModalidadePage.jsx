import TabelaRedimensionavel from '../components/TabelaRedimensionavel';
import { useState, useEffect } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatCpfCnpj } from '../utils/formatters';
import { dadosDoAno, anosComDado } from '../store/consultaPeriodo';
import {
  MODALIDADES, NOME_MODALIDADE, ALERTA_MODALIDADE, modalidadeDaDeclaracao,
  blocosEspolio, blocosSaida, bensDaPartilha, conferenciasPartilha,
} from '../store/modalidadeDeclaracao';
import Ajuda from '../components/Ajuda';
import Modal from '../components/Modal';

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
      <TabelaRedimensionavel><table style={{ width: '100%', fontSize: '13px' }}>
        <tbody>
          {bloco.linhas.map((l, i) => (
            <tr key={i}>
              <td style={{ padding: '3px 12px 3px 0', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{l.rotulo}</td>
              <td style={{ padding: '3px 0', textAlign: 'right' }}>{l.valor}</td>
            </tr>
          ))}
        </tbody>
      </table></TabelaRedimensionavel>
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

  // "O que muda nesta modalidade" aparece numa janela ao abrir a tela, para
  // quem chega saber como ler os valores ANTES de olhar qualquer número.
  // Fecha no OK/Esc/clique fora; uma vez por sessão por modalidade. Depois
  // fica no "?" ao lado do título.
  const [alertaVisto, setAlertaVisto] = useState(true);
  useEffect(() => {
    if (modalidade === MODALIDADES.AJUSTE) { setAlertaVisto(true); return; }
    let jaViu = false;
    try { jaViu = sessionStorage.getItem(`cp-modalidade-${modalidade}`) === '1'; } catch { /* indisponível */ }
    setAlertaVisto(jaViu);
  }, [modalidade]);
  const fecharAlerta = () => {
    try { sessionStorage.setItem(`cp-modalidade-${modalidade}`, '1'); } catch { /* ignore */ }
    setAlertaVisto(true);
  };

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
            {/* O alerta aparece na janela ao abrir (ver Modal no fim). Aqui
                fica como "?" discreto, para continuar acessível depois. */}
            <div style={{ marginBottom: '20px' }}>
              <Ajuda
                tom="ressalva"
                rotulo="O que muda nesta modalidade"
                titulo="O que muda nesta modalidade"
                texto={ALERTA_MODALIDADE[modalidade]}
              />
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
                <TabelaRedimensionavel>
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
                </TabelaRedimensionavel>
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
                  <div style={{ marginBottom: '16px' }}>
                    <Ajuda
                      tom="ressalva"
                      rotulo={`Conferência da partilha (${avisosPartilha.length})`}
                      titulo="Conferência da partilha"
                      texto={avisosPartilha.join('\n\n')}
                    />
                  </div>
                )}
                <TabelaRedimensionavel>
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
                </TabelaRedimensionavel>
              </div>
            )}
          </>
        )}
      </div>

      <Modal open={modalidade !== MODALIDADES.AJUSTE && !alertaVisto} onClose={fecharAlerta} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3>O que muda nesta modalidade</h3>
          <button className="modal-close" onClick={fecharAlerta} aria-label="Fechar aviso">✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ALERTA_MODALIDADE[modalidade]}</p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={fecharAlerta}>OK, entendi</button>
        </div>
      </Modal>
    </>
  );
}
