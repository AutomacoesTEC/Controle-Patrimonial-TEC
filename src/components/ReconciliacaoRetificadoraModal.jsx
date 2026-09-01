import { useMemo, useState, useEffect } from 'react';
import Modal from './Modal';
import { formatCurrency, truncarComReticencias } from '../utils/formatters';
import { sugerirVinculos } from '../utils/reconciliacaoRetificadora';
import { payloadRetificadoraCompleto } from '../utils/importacaoDeclaracao';

// Tela de conciliação de uma declaração retificadora: a usuária já
// confirmou que quer reimportar por cima de um ano já importado antes, com
// o mesmo titular. Em vez de trocar tudo de uma vez (o que apagaria
// movimentações já lançadas e itens incluídos à mão), o sistema sugere os
// vínculos por código + semelhança de texto e a usuária revisa, corrige ou
// exclui cada sugestão antes de confirmar — nada é salvo até "Confirmar
// Conciliação".
export default function ReconciliacaoRetificadoraModal({
  open, anoDestino, contribuinte, formato,
  resultadoCompleto,
  bensAntigos, bensNovos, dividasAntigas, dividasNovas,
  imoveisRuraisAntigos, imoveisRuraisNovos,
  bensRuraisAntigos, bensRuraisNovos, dividasRuraisAntigas, dividasRuraisNovas,
  rendimentosNovos, pagamentosNovos,
  onConfirm, onCancel,
}) {
  const [resultadoBens, setResultadoBens] = useState(null);
  const [resultadoDividas, setResultadoDividas] = useState(null);
  const [resultadoImoveisRurais, setResultadoImoveisRurais] = useState(null);
  const [resultadoBensRurais, setResultadoBensRurais] = useState(null);
  const [resultadoDividasRurais, setResultadoDividasRurais] = useState(null);

  if (!open) return null;

  const podeConfirmar = resultadoBens != null && resultadoDividas != null
    && resultadoImoveisRurais != null && resultadoBensRurais != null && resultadoDividasRurais != null;

  const handleConfirmar = () => {
    onConfirm(payloadRetificadoraCompleto(resultadoCompleto, {
      anoCalendario: anoDestino,
      contribuinte,
      formato,
      bens: resultadoBens,
      dividas: resultadoDividas,
      imoveisRurais: resultadoImoveisRurais,
      bensRurais: resultadoBensRurais,
      dividasRurais: resultadoDividasRurais,
      rendimentos: rendimentosNovos,
      pagamentos: pagamentosNovos,
    }));
  };

  return (
    <Modal open={open} onClose={onCancel} style={{ maxWidth: '900px', width: '95vw' }}>
      <div className="modal-header">
        <h3>Conciliação da retificadora, ano-calendário {anoDestino}</h3>
        <button className="modal-close" onClick={onCancel}>✕</button>
      </div>
      <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
          Já existe uma declaração importada para {anoDestino} com o mesmo titular. Abaixo, cada item novo vem
          com uma sugestão automática de vínculo (por código e semelhança da discriminação). Revise, corrija ou
          desvincule antes de confirmar. Item vinculado atualiza os valores declarados mas preserva movimentações
          já lançadas nele. Nada é salvo até você confirmar. Bens/dívidas cadastrados manualmente não entram aqui
          e não são afetados.
        </p>

        <SecaoConciliacao
          titulo="Bens e Direitos"
          campoCodigo="codigo_bem"
          antigos={bensAntigos}
          novos={bensNovos}
          onChange={setResultadoBens}
        />
        <SecaoConciliacao
          titulo="Dívidas e Ônus Reais"
          campoCodigo="codigo"
          antigos={dividasAntigas}
          novos={dividasNovas}
          onChange={setResultadoDividas}
        />
        <SecaoConciliacao
          titulo="Imóveis explorados na atividade rural"
          campoCodigo="cib"
          campoDescricao="nomeLocalizacao"
          antigos={imoveisRuraisAntigos}
          novos={imoveisRuraisNovos}
          onChange={setResultadoImoveisRurais}
        />
        <SecaoConciliacao
          titulo="Bens da atividade rural"
          campoCodigo="codigo"
          antigos={bensRuraisAntigos}
          novos={bensRuraisNovos}
          onChange={setResultadoBensRurais}
        />
        <SecaoConciliacao
          titulo="Dívidas da atividade rural"
          campoCodigo="codigo"
          antigos={dividasRuraisAntigas}
          novos={dividasRuraisNovas}
          onChange={setResultadoDividasRurais}
        />

        {(rendimentosNovos?.length > 0 || pagamentosNovos?.length > 0) && (
          <div className="card" style={{ marginTop: '8px' }}>
            <div className="card-header"><h3 className="card-title">Rendimentos e Pagamentos</h3></div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', padding: '0 16px 16px' }}>
              São lançamentos do período, não saldo acumulado: os que vieram de uma importação anterior para{' '}
              {anoDestino} são substituídos pelos desta declaração ({rendimentosNovos?.length || 0} rendimento(s),{' '}
              {pagamentosNovos?.length || 0} pagamento(s)). O que foi cadastrado manualmente continua intacto.
            </p>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!podeConfirmar} onClick={handleConfirmar}>
          Confirmar Conciliação
        </button>
      </div>
    </Modal>
  );
}

// Uma seção (Bens ou Dívidas): calcula a sugestão uma vez, mantém o estado
// editável de cada vínculo e de cada órfão antigo, e devolve pro pai (via
// onChange) o formato pronto pro payload de RECONCILIAR_IMPORTACAO sempre
// que algo muda.
function SecaoConciliacao({ titulo, campoCodigo, campoDescricao = 'discriminacao', antigos, novos, onChange }) {
  const sugestao = useMemo(
    () => sugerirVinculos(antigos, novos, campoCodigo, campoDescricao),
    [antigos, novos, campoCodigo, campoDescricao],
  );
  const descricao = item => item?.[campoDescricao] || '';

  // vinculoPorNovo: índice do item novo -> id do antigo vinculado (ou null =
  // "é item novo mesmo"). Inicializa com a sugestão automática.
  const [vinculoPorNovo, setVinculoPorNovo] = useState(() =>
    (novos || []).map(novo => sugestao.vinculos.find(v => v.novo === novo)?.antigo.id ?? null)
  );
  // decisaoOrfao: id do antigo -> 'manter' | 'remover'. Default: quem já tem
  // movimentação lançada fica (com aviso); quem não tem, sai (assume que a
  // retificadora removeu esse item de propósito).
  const [decisaoOrfao, setDecisaoOrfao] = useState(() => {
    const m = new Map();
    for (const antigo of antigos || []) {
      const temMovimentacao = (antigo.movimentacoes || []).length > 0;
      m.set(antigo.id, temMovimentacao ? 'manter' : 'remover');
    }
    return m;
  });

  // Antigos já usados por algum vínculo não entram na lista de órfãos nem
  // ficam disponíveis pra vincular a outro item novo.
  const antigosUsados = new Set(vinculoPorNovo.filter(id => id != null));
  const antigosOrfaos = (antigos || []).filter(a => !antigosUsados.has(a.id));

  useEffect(() => {
    const antigoPorId = new Map((antigos || []).map(a => [a.id, a]));
    const vinculados = [];
    (novos || []).forEach((novo, i) => {
      const idAntigo = vinculoPorNovo[i];
      if (idAntigo == null) return;
      // O reducer precisa do registro declarado completo, especialmente da
      // situação atual, para reaplicar sobre ela as movimentações manuais já
      // existentes. Enviar só a situação anterior produzia saldo incorreto.
      const { id: _idDescartado, movimentacoes: _movimentosDoParser, ...dadosDeclarados } = novo;
      vinculados.push({ idAntigo, dados: dadosDeclarados });
    });
    const idsVinculados = new Set(vinculados.map(v => v.idAntigo));
    const novosSemVinculo = (novos || []).filter((_, i) => vinculoPorNovo[i] == null);
    const removerAntigos = antigosOrfaos
      .filter(a => !idsVinculados.has(a.id) && decisaoOrfao.get(a.id) === 'remover')
      .map(a => a.id);
    onChange({ vinculados, novos: novosSemVinculo, removerAntigos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vinculoPorNovo, decisaoOrfao]);

  if ((antigos || []).length === 0 && (novos || []).length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-header"><h3 className="card-title">{titulo}</h3></div>
      {(novos || []).length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Item na retificadora</th>
                <th style={{ textAlign: 'right' }}>Situação Anterior</th>
                <th>Vincular com item já importado</th>
              </tr>
            </thead>
            <tbody>
              {novos.map((novo, i) => {
                const idSelecionado = vinculoPorNovo[i];
                const sugerido = sugestao.vinculos.find(v => v.novo === novo);
                const opcoesDisponiveis = (antigos || []).filter(a => a.id === idSelecionado || !antigosUsados.has(a.id));
                return (
                  <tr key={i}>
                    <td title={descricao(novo)}>
                      <span className="badge badge-blue">{novo[campoCodigo]}</span> {truncarComReticencias(descricao(novo), 80)}
                    </td>
                    <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(novo.situacao_anterior)}</td>
                    <td>
                      <select
                        className="form-control"
                        value={idSelecionado ?? ''}
                        onChange={e => {
                          const v = e.target.value === '' ? null : Number(e.target.value);
                          setVinculoPorNovo(prev => prev.map((x, idx) => (idx === i ? v : x)));
                        }}
                      >
                        <option value="">Item novo (sem vínculo)</option>
                        {opcoesDisponiveis.map(a => (
                          <option key={a.id} value={a.id}>
                            {a[campoCodigo]} - {descricao(a).substring(0, 60)}
                          </option>
                        ))}
                      </select>
                      {sugerido && idSelecionado === sugerido.antigo.id && (
                        <div style={{ fontSize: '11px', color: 'var(--accent-success)', marginTop: '4px' }}>Sugestão automática</div>
                      )}
                      {idSelecionado != null && (!sugerido || idSelecionado !== sugerido.antigo.id) && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Vínculo escolhido manualmente</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {antigosOrfaos.length > 0 && (
        <div style={{ padding: '16px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase' }}>
            Itens da declaração anterior sem correspondência na retificadora
          </p>
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Item</th><th style={{ textAlign: 'right' }}>Situação Atual</th><th>Movimentação</th><th>O que fazer</th></tr>
              </thead>
              <tbody>
                {antigosOrfaos.map(a => {
                  const temMovimentacao = (a.movimentacoes || []).length > 0;
                  return (
                    <tr key={a.id}>
                      <td title={descricao(a)}><span className="badge badge-blue">{a[campoCodigo]}</span> {truncarComReticencias(descricao(a), 80)}</td>
                      <td style={{ textAlign: 'right' }} className="currency">{formatCurrency(a.situacao_atual)}</td>
                      <td>
                        {temMovimentacao
                          ? <span className="badge badge-orange">{a.movimentacoes.length} lançada(s)</span>
                          : <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Nenhuma</span>}
                      </td>
                      <td>
                        <select
                          className="form-control"
                          value={decisaoOrfao.get(a.id)}
                          onChange={e => setDecisaoOrfao(prev => new Map(prev).set(a.id, e.target.value))}
                        >
                          <option value="manter">Manter mesmo assim</option>
                          <option value="remover">Remover</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
