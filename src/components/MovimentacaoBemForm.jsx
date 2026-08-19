import { useState } from 'react';
import { useData } from '../store/DataContext';
import { formatCurrency, formatDate, MOVIMENTACAO_TIPOS } from '../utils/formatters';
import MoneyInput from './MoneyInput';

// Bloco de "registrar movimentação" de um bem (venda, compra, benfeitoria,
// baixa, ajuste), reaproveitado entre Bens e Direitos (BemModal) e Bens da
// Atividade Rural. `actionType` escolhe qual reducer action disparar
// (REGISTRAR_MOVIMENTACAO_BEM ou REGISTRAR_MOVIMENTACAO_BEM_RURAL) — as
// duas fazem a mesma coisa, só em coleções diferentes do estado.
// Também serve para dívidas (DividasPage): `tipos` troca a tabela de
// rótulos/ajuda (MOVIMENTACAO_DIVIDA_TIPOS), `tipoInicial` o tipo
// pré-selecionado e `textoIntro` o parágrafo de explicação. Como nenhum
// tipo de dívida é venda, os campos valorVenda/irrfVenda nem aparecem.
export default function MovimentacaoBemForm({
  bem,
  actionType = 'REGISTRAR_MOVIMENTACAO_BEM',
  tipos = MOVIMENTACAO_TIPOS,
  tipoInicial = 'venda_parcial',
  textoIntro = 'Vendeu parte, vendeu tudo, comprou mais, fez uma benfeitoria? Registre aqui: o valor atual do bem é recalculado a partir da movimentação, e fica guardado o motivo de cada mudança de valor.',
}) {
  const { dispatch, addToast } = useData();
  const [movTipo, setMovTipo] = useState(tipoInicial);
  const [movValor, setMovValor] = useState('');
  const [movValorVenda, setMovValorVenda] = useState('');
  const [movIrrfVenda, setMovIrrfVenda] = useState('');
  const [movData, setMovData] = useState(new Date().toISOString().slice(0, 10));
  const [movDescricao, setMovDescricao] = useState('');

  const isVenda = movTipo === 'venda_parcial' || movTipo === 'venda_total';

  const handleRegistrar = () => {
    // Tipos com sinal '0' (venda_total/baixa em bens, quitacao em dívidas)
    // zeram o saldo e o campo "valor" fica desabilitado na tela — mas ainda
    // precisa guardar QUANTO estava sendo baixado (em bens, é o custo de
    // aquisição que sai, senão a aba Ganhos de Capital não tem como calcular
    // o ganho/perda de uma venda total depois). Usa o valor vivo no momento
    // do registro.
    const zeraTudo = tipos[movTipo]?.sinal === '0';
    const valor = zeraTudo ? bem.situacao_atual : (parseFloat(movValor) || 0);
    if (!zeraTudo && valor <= 0) {
      alert('Informe um valor maior que zero para essa movimentação.');
      return;
    }
    const movimentacao = { tipo: movTipo, valor, data: movData, descricao: movDescricao };
    // valorVenda (preço recebido) só faz sentido numa venda, e é opcional:
    // sem ele, a movimentação é registrada normalmente, só não entra na
    // aba Ganhos de Capital (que precisa do preço de venda pra calcular).
    if (isVenda && movValorVenda !== '') movimentacao.valorVenda = parseFloat(movValorVenda) || 0;
    // IRRF pago sobre o ganho da venda (15% em operações comuns de renda
    // variável/alienação, mas o valor real pago pode variar por alíquota
    // progressiva) — usado só para o Demonstrativo de Conciliação
    // Patrimonial do Dashboard calcular o "ganho líquido de IRRF".
    if (isVenda && movIrrfVenda !== '') movimentacao.irrfVenda = parseFloat(movIrrfVenda) || 0;
    dispatch({ type: actionType, payload: { bemId: bem.id, movimentacao } });
    addToast('Movimentação registrada.', 'success');
    setMovValor('');
    setMovValorVenda('');
    setMovIrrfVenda('');
    setMovDescricao('');
  };

  return (
    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', padding: '16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
        Registrar movimentação
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 0, marginBottom: '12px' }}>
        {textoIntro}
      </p>
      <div className="form-row">
        <div className="form-group">
          <label>Tipo de movimentação</label>
          <select className="form-control" value={movTipo} onChange={e => setMovTipo(e.target.value)}>
            {Object.entries(tipos).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
            {tipos[movTipo].ajuda}
          </p>
        </div>
        <div className="form-group">
          <label>Data</label>
          <input className="form-control" type="date" value={movData} onChange={e => setMovData(e.target.value)} />
        </div>
        <div className="form-group">
          <label>{movTipo === 'ajuste' ? 'Novo valor' : 'Valor da movimentação'}</label>
          <MoneyInput
            value={movValor}
            onChange={setMovValor}
            disabled={tipos[movTipo]?.sinal === '0'}
          />
        </div>
      </div>
      {isVenda && (
        <div className="form-row">
          <div className="form-group">
            <label>Valor de venda (preço recebido, opcional)</label>
            <MoneyInput value={movValorVenda} onChange={setMovValorVenda} />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
              Campo opcional. Se informado, o ganho desta venda é calculado automaticamente na aba Ganhos de Capital (preço de venda menos a parcela do custo baixada acima).
            </p>
          </div>
          <div className="form-group">
            <label>IRRF pago sobre o ganho (opcional)</label>
            <MoneyInput value={movIrrfVenda} onChange={setMovIrrfVenda} />
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', marginBottom: 0 }}>
              Usado no Demonstrativo de Conciliação Patrimonial do Dashboard para calcular o ganho líquido.
            </p>
          </div>
        </div>
      )}
      <div className="form-group">
        <label>Descrição da movimentação</label>
        <input className="form-control" value={movDescricao} onChange={e => setMovDescricao(e.target.value)} placeholder="Ex: venda de 1/3 do imóvel para fulano, reforma da cozinha..." />
      </div>
      <button type="button" className="btn btn-sm btn-primary" onClick={handleRegistrar}>
        Registrar movimentação
      </button>

      {(bem.movimentacoes || []).length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Movimentações já registradas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...bem.movimentacoes].reverse().map(m => (
              <div key={m.id} style={{ fontSize: '12px', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <strong>{MOVIMENTACAO_TIPOS[m.tipo]?.label || m.tipo}</strong>
                {' '}em {formatDate(m.data)}
                {m.valor > 0 && <>, {formatCurrency(m.valor)}</>}
                {m.valorVenda != null && <>, vendido por {formatCurrency(m.valorVenda)}</>}
                {m.irrfVenda != null && <>, IRRF {formatCurrency(m.irrfVenda)}</>}
                {m.descricao && <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{m.descricao}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
