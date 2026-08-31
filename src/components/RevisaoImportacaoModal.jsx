import { formatCpfCnpj } from '../utils/formatters';
import { resumirImportacao } from '../utils/importacaoDeclaracao';

const ROTULOS_ESTADO = {
  completa: 'Completa',
  parcial: 'Em auditoria',
  vazia: 'Vazia',
  ausente: 'Não impressa',
  nao_suportada: 'Não estruturada',
  erro: 'Erro',
};

const BADGES_ESTADO = {
  completa: 'badge-green',
  parcial: 'badge-orange',
  vazia: 'badge-blue',
  ausente: 'badge-blue',
  nao_suportada: 'badge-orange',
  erro: 'badge-red',
};

function nomeFicha(id) {
  return String(id || '')
    .replace(/^(pdf|dbk):/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, letra => letra.toUpperCase());
}

function formatarBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Tamanho não informado';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function RevisaoImportacaoModal({
  open, resultado, nomeArquivo, onConfirm, onCancel, confirmLabel = 'Confirmar importação',
}) {
  if (!open || !resultado) return null;
  const resumo = resumirImportacao(resultado);
  const fonte = resultado.documentoFonte || {};
  const cpf = resultado.contribuinte?.cpf || '';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="revisao-importacao-titulo">
      <div className="modal modal-import-review">
        <div className="modal-header">
          <div>
            <h3 id="revisao-importacao-titulo">Revisar antes de importar</h3>
            <p className="import-review-subtitle">O arquivo foi analisado. Nenhum dado do perfil foi alterado ainda.</p>
          </div>
          <button className="modal-close" type="button" aria-label="Cancelar revisão" onClick={onCancel}>✕</button>
        </div>

        <div className="modal-body import-review-body">
          <section className="import-review-identity">
            <div>
              <span className="import-review-eyebrow">Arquivo</span>
              <strong title={nomeArquivo}>{nomeArquivo || fonte.nomeArquivo || 'Declaração'}</strong>
              <small>{String(resultado.formato || '').toUpperCase()} · {formatarBytes(fonte.tamanhoBytes)}</small>
            </div>
            <div>
              <span className="import-review-eyebrow">Titular e período</span>
              <strong>{resultado.contribuinte?.nome || 'Titular não identificado'}</strong>
              <small>{cpf ? `CPF ${formatCpfCnpj(cpf)} · ` : ''}Ano-calendário {resultado.anoCalendario || 'não identificado'}</small>
            </div>
          </section>

          <section className="import-review-integrity">
            <span className="badge badge-green">Arquivo identificado</span>
            <div>
              <strong>SHA-256 do arquivo original</strong>
              <code title={fonte.sha256ArquivoOriginal}>{fonte.sha256ArquivoOriginal || 'Não calculado'}</code>
            </div>
            <small>
              {fonte.totalPaginas
                ? `${fonte.totalPaginas} página(s), ${Number(fonte.caracteresExtraidos || 0).toLocaleString('pt-BR')} caracteres extraídos.`
                : `${fonte.totalRegistros || 0} registro(s) preservados.`}
              {' '}O arquivo binário não é salvo no navegador.
            </small>
          </section>

          <section>
            <div className="import-review-section-title">
              <h4>Dados estruturados encontrados</h4>
              <span>
                {resumo.colecoes.reduce((soma, item) => soma + item.quantidade, 0)} itens
                {resumo.quadros.length > 0 ? ` · ${resumo.quadros.length} quadro(s)` : ''}
              </span>
            </div>
            {resumo.colecoes.length > 0 ? (
              <div className="import-review-counts">
                {resumo.colecoes.map(item => (
                  <div key={item.campo}><strong>{item.quantidade}</strong><span>{item.rotulo}</span></div>
                ))}
              </div>
            ) : <p className="import-review-empty">Nenhuma coleção estruturada foi encontrada.</p>}
            {resumo.quadros.length > 0 && (
              <div className="import-review-counts" style={{ marginTop: '10px' }}>
                {resumo.quadros.map(item => (
                  <div key={item.campo}><strong>✓</strong><span>{item.rotulo}</span></div>
                ))}
              </div>
            )}
          </section>

          {(resultado.avisosImportacao || []).length > 0 && (
            <section className="import-review-warnings">
              <h4>Conferências que permanecerão salvas</h4>
              <ul>
                {resultado.avisosImportacao.map((aviso, indice) => <li key={indice}>{aviso}</li>)}
              </ul>
            </section>
          )}

          <section>
            <div className="import-review-section-title">
              <h4>Cobertura das fichas</h4>
              <span>{resumo.fichas.length} fichas classificadas</span>
            </div>
            <div className="import-review-state-summary">
              {Object.entries(ROTULOS_ESTADO).map(([estado, rotulo]) => (
                resumo.porEstado[estado] ? <span key={estado} className={`badge ${BADGES_ESTADO[estado]}`}>{resumo.porEstado[estado]} {rotulo}</span> : null
              ))}
            </div>
            <details className="import-review-details" open={resumo.alertas.length > 0}>
              <summary>{resumo.alertas.length > 0 ? `${resumo.alertas.length} ficha(s) exigem atenção` : 'Ver classificação por ficha'}</summary>
              <div className="import-review-fichas">
                {resumo.fichas.map(ficha => (
                  <div key={ficha.id} className="import-review-ficha">
                    <div>
                      <strong>{ficha.titulo || nomeFicha(ficha.id)}</strong>
                      {(ficha.paginaInicio || ficha.linhaInicio) && (
                        <small>
                          {ficha.paginaInicio ? `Página ${ficha.paginaInicio}` : ''}
                          {ficha.linhaInicio ? `${ficha.paginaInicio ? ', ' : ''}linha ${ficha.linhaInicio}` : ''}
                        </small>
                      )}
                      {ficha.motivo && <small>{ficha.motivo}</small>}
                    </div>
                    <span className={`badge ${BADGES_ESTADO[ficha.estado] || 'badge-red'}`}>
                      {ficha.derivado ? 'Derivada dos meses' : (ROTULOS_ESTADO[ficha.estado] || ficha.estado)}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          </section>

          {resumo.temBloqueio && (
            <div className="import-review-blocker">Há ficha com erro. Cancele e confira o arquivo antes de importar.</div>
          )}
        </div>

        <div className="modal-footer import-review-footer">
          <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={resumo.temBloqueio} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
